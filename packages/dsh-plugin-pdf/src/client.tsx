import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import React from 'react'

type PickedFile = { fileId: string; name: string; size?: number }
type Job = { jobId: string; status: string; progress: number; resultId?: string; pageCount?: number; fileCount?: number; pdfOperation?: string; error?: string }

async function request(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch('/moyu/pdf', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || `请求失败：HTTP ${response.status}`)
  return value
}

function PdfPanel(): React.ReactElement {
  const [operation, setOperation] = React.useState('merge')
  const [files, setFiles] = React.useState<PickedFile[]>([])
  const [rotation, setRotation] = React.useState(90)
  const [pages, setPages] = React.useState('1')
  const [start, setStart] = React.useState(1)
  const [position, setPosition] = React.useState('footer')
  const [afterPage, setAfterPage] = React.useState(0)
  const [password, setPassword] = React.useState('')
  const [watermarkFile, setWatermarkFile] = React.useState<PickedFile>()
  const [watermarkText, setWatermarkText] = React.useState('摸鱼工具箱')
  const [watermarkOpacity, setWatermarkOpacity] = React.useState(0.28)
  const [renderFormat, setRenderFormat] = React.useState('png')
  const [renderScale, setRenderScale] = React.useState(2)
  const [renderQuality, setRenderQuality] = React.useState(92)
  const [job, setJob] = React.useState<Job>()
  const [message, setMessage] = React.useState('')

  React.useEffect(() => {
    if (!job || !['running', 'cancelling'].includes(job.status)) return
    const timer = window.setInterval(() => {
      void request({ operation: 'status', job_id: job.jobId }).then(setJob).catch((error) => {
        setMessage(error instanceof Error ? error.message : String(error))
        window.clearInterval(timer)
      })
    }, 350)
    return () => window.clearInterval(timer)
  }, [job?.jobId, job?.status])

  React.useEffect(() => { setFiles([]); setWatermarkFile(undefined); setJob(undefined); setMessage('') }, [operation])

  const choose = async (): Promise<void> => {
    setMessage('')
    try {
      const picked = await request({
        operation: 'pick', kind: operation === 'images_to_pdf' ? 'image' : 'pdf',
        multiple: ['merge', 'insert_pages', 'watermark_text', 'watermark_image', 'images_to_pdf'].includes(operation),
      })
      if (!picked.canceled) { setFiles(picked.files || []); setJob(undefined) }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  const chooseWatermark = async (): Promise<void> => {
    setMessage('')
    try {
      const picked = await request({ operation: 'pick', kind: 'image', multiple: false })
      if (!picked.canceled) setWatermarkFile(picked.files?.[0])
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  const submit = async (): Promise<void> => {
    setMessage('')
    const options = operation === 'rotate' ? { rotation }
      : operation === 'extract_pages' ? { pages }
        : operation === 'insert_pages' ? { after_page: afterPage }
          : ['encrypt', 'decrypt'].includes(operation) ? { password }
            : operation === 'watermark_text' ? { text: watermarkText, opacity: watermarkOpacity, density: 6, rotation: -30, pages: 'all' }
              : operation === 'watermark_image' ? { watermark_file_id: watermarkFile?.fileId, opacity: watermarkOpacity, density: 1, pages: 'all' }
                : operation === 'render_pages' ? { format: renderFormat, pages, scale: renderScale, quality: renderQuality }
                  : operation === 'page_numbers' ? { start, position } : {}
    try {
      setJob(await request({
        operation: 'submit', pdf_operation: operation,
        input_file_ids: files.map((file) => file.fileId), output_name: `${operation}.pdf`, options,
      }))
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  const action = async (type: string): Promise<void> => {
    if (!job) return
    setMessage('')
    try {
      const value = await request({ operation: type, job_id: job.jobId })
      if (type === 'cancel') setJob(value)
      if (type === 'save' && !value.canceled) setMessage('结果已保存')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  const running = Boolean(job && ['running', 'cancelling'].includes(job.status))
  const complete = job?.status === 'completed'
  const enoughFiles = operation === 'merge' ? files.length >= 2
    : operation === 'insert_pages' ? files.length === 2
      : ['watermark_text', 'watermark_image', 'images_to_pdf'].includes(operation) ? files.length >= 1
        : files.length === 1
  const row: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }
  const card: React.CSSProperties = { maxWidth: 760, padding: 24, border: '1px solid color-mix(in srgb, currentColor 16%, transparent)', borderRadius: 16 }
  const labels: Record<string, string> = {
    merge: '合并 PDF', rotate: '旋转 PDF', extract_pages: '提取页面', split_pages: '逐页拆分',
    insert_pages: '插入页面', page_numbers: '添加页码', encrypt: '加密 PDF', decrypt: '移除 PDF 口令',
    watermark_text: '文字水印', watermark_image: '图片水印', images_to_pdf: '图片转 PDF',
    extract_text: '提取文字', extract_images: '提取内嵌图片', render_pages: '整页转图',
  }

  return React.createElement('section', { id: 'moyu-pdf-tools', style: { padding: 24 } },
    React.createElement('div', { style: card },
      React.createElement('h2', { style: { marginTop: 0 } }, 'PDF 工具'),
      React.createElement('p', null, 'PDF 仅在本机 DSH Host 中处理，页面不会获得文件路径。'),
      React.createElement('div', { style: row },
        React.createElement('label', null, '功能 ', React.createElement('select', {
          value: operation, disabled: running, onChange: (event) => setOperation(event.target.value),
        }, ...Object.entries(labels).map(([value, label]) => React.createElement('option', { key: value, value }, label)))),
        React.createElement('button', { type: 'button', onClick: choose, disabled: running },
          operation === 'merge' ? '选择多个 PDF'
            : operation === 'insert_pages' ? '依次选择原 PDF 与待插入 PDF'
              : operation === 'images_to_pdf' ? '选择图片' : '选择 PDF'),
        React.createElement('span', null, files.length ? files.map((file) => file.name).join('、') : '尚未选择'),
      ),
      operation === 'rotate' ? React.createElement('div', { style: row },
        React.createElement('label', null, '角度 ', React.createElement('select', { value: rotation, onChange: (event) => setRotation(Number(event.target.value)), disabled: running },
          ...[90, 180, 270].map((value) => React.createElement('option', { key: value, value }, `${value}°`)))),
      ) : null,
      operation === 'extract_pages' ? React.createElement('div', { style: row },
        React.createElement('label', null, '页码 ', React.createElement('input', { value: pages, onChange: (event) => setPages(event.target.value), placeholder: '1-3,5', disabled: running })),
      ) : null,
      operation === 'render_pages' ? React.createElement('div', { style: row },
        React.createElement('label', null, '格式 ', React.createElement('select', { value: renderFormat, onChange: (event) => setRenderFormat(event.target.value), disabled: running },
          React.createElement('option', { value: 'png' }, 'PNG'), React.createElement('option', { value: 'jpeg' }, 'JPEG'))),
        React.createElement('label', null, '页码 ', React.createElement('input', { value: pages, onChange: (event) => setPages(event.target.value), placeholder: '留空为全部', disabled: running })),
        React.createElement('label', null, '缩放 ', React.createElement('input', {
          type: 'number', min: 0.25, max: 4, step: 0.25, value: renderScale,
          onChange: (event) => setRenderScale(Number(event.target.value)), disabled: running, style: { width: 88 },
        })),
        renderFormat === 'jpeg' ? React.createElement('label', null, '质量 ', React.createElement('input', {
          type: 'number', min: 1, max: 100, step: 1, value: renderQuality,
          onChange: (event) => setRenderQuality(Number(event.target.value)), disabled: running, style: { width: 88 },
        })) : null,
      ) : null,
      operation === 'insert_pages' ? React.createElement('div', { style: row },
        React.createElement('label', null, '插在第几页之后（0 表示最前） ', React.createElement('input', {
          type: 'number', min: 0, value: afterPage, onChange: (event) => setAfterPage(Number(event.target.value)), disabled: running, style: { width: 88 },
        })),
      ) : null,
      ['encrypt', 'decrypt'].includes(operation) ? React.createElement('div', { style: row },
        React.createElement('label', null, operation === 'encrypt' ? '打开口令 ' : '当前口令 ', React.createElement('input', {
          type: 'password', maxLength: 127, value: password, autoComplete: 'off',
          onChange: (event) => setPassword(event.target.value), disabled: running,
        })),
      ) : null,
      operation === 'watermark_text' ? React.createElement('div', { style: row },
        React.createElement('label', null, '文字 ', React.createElement('input', {
          value: watermarkText, onChange: (event) => setWatermarkText(event.target.value), disabled: running,
        })),
      ) : null,
      ['watermark_text', 'watermark_image'].includes(operation) ? React.createElement('div', { style: row },
        operation === 'watermark_image' ? React.createElement('button', { type: 'button', onClick: chooseWatermark, disabled: running }, watermarkFile?.name || '选择水印图片') : null,
        React.createElement('label', null, '透明度 ', React.createElement('input', {
          type: 'number', min: 0.05, max: 1, step: 0.05, value: watermarkOpacity,
          onChange: (event) => setWatermarkOpacity(Number(event.target.value)), disabled: running,
        })),
      ) : null,
      operation === 'page_numbers' ? React.createElement('div', { style: row },
        React.createElement('label', null, '起始 ', React.createElement('input', { type: 'number', min: 0, max: 99999, value: start, onChange: (event) => setStart(Number(event.target.value)), disabled: running, style: { width: 88 } })),
        React.createElement('label', null, '位置 ', React.createElement('select', { value: position, onChange: (event) => setPosition(event.target.value), disabled: running },
          React.createElement('option', { value: 'footer' }, '页脚'), React.createElement('option', { value: 'header' }, '页眉'))),
      ) : null,
      React.createElement('div', { style: row },
        React.createElement('button', {
          type: 'button', onClick: submit,
          disabled: !enoughFiles || running || (operation === 'watermark_image' && !watermarkFile),
        }, '开始处理'),
        running ? React.createElement('button', { type: 'button', onClick: () => action('cancel') }, '取消') : null,
      ),
      job ? React.createElement('div', { style: { marginTop: 20 } },
        React.createElement('progress', { max: 1, value: job.progress, style: { width: '100%' } }),
        React.createElement('p', { role: 'status' }, job.error || (complete
          ? `完成 · ${job.pageCount} 页${job.fileCount && job.fileCount > 1 ? ` · ${job.fileCount} 个文件` : ''}`
          : `处理中 · ${Math.round(job.progress * 100)}%`)),
        complete ? React.createElement('div', { style: row },
          React.createElement('button', { type: 'button', onClick: () => action('save') }, job.fileCount && job.fileCount > 1 ? '保存全部' : '另存为'),
          React.createElement('button', { type: 'button', onClick: () => action('show') }, '在 Finder 中显示'),
          React.createElement('small', null, '临时结果保留 10 分钟。'),
        ) : null,
      ) : null,
      message ? React.createElement('p', { role: 'alert' }, message) : null,
    ),
  )
}

export const name = 'moyu-pdf-client'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'moyu-pdf-view', order: 21, label: () => 'PDF 工具',
  } as never, PdfPanel as never))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'moyu-pdf-settings', order: 16, label: () => 'PDF 工具',
  } as never, PdfPanel as never))
}
