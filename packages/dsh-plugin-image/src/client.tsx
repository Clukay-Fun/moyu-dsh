import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import React from 'react'

type Job = { jobId: string; status: string; progress: number; resultId?: string; width?: number; height?: number; format?: string; error?: string }
type PickedFile = { fileId: string; name: string; size?: number }

async function request(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch('/moyu/image', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || `请求失败：HTTP ${response.status}`)
  return value
}

function ImagePanel(): React.ReactElement {
  const [file, setFile] = React.useState<PickedFile>()
  const [target, setTarget] = React.useState('png')
  const [quality, setQuality] = React.useState(82)
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

  const choose = async (): Promise<void> => {
    setMessage('')
    try {
      const picked = await request({ operation: 'pick' })
      if (!picked.canceled && picked.files?.[0]) {
        setFile(picked.files[0])
        setJob(undefined)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  const submit = async (): Promise<void> => {
    if (!file) return
    setMessage('')
    try { setJob(await request({ operation: 'submit', input_file_id: file.fileId, target, quality })) }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  const action = async (operation: string): Promise<void> => {
    if (!job) return
    setMessage('')
    try {
      const value = await request({ operation, job_id: job.jobId })
      if (operation === 'cancel') setJob(value)
      if (operation === 'save' && !value.canceled) setMessage('结果已保存')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  const running = job && ['running', 'cancelling'].includes(job.status)
  const complete = job?.status === 'completed'
  const card: React.CSSProperties = { maxWidth: 720, padding: 24, border: '1px solid color-mix(in srgb, currentColor 16%, transparent)', borderRadius: 16 }
  const row: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }
  return React.createElement('section', { id: 'moyu-image-convert', style: { padding: 24 } },
    React.createElement('div', { style: card },
      React.createElement('h2', { style: { marginTop: 0 } }, '图片转换'),
      React.createElement('p', null, '图片只通过本机文件令牌交给 DSH Host，不上传、不向模型暴露路径。'),
      React.createElement('div', { style: row },
        React.createElement('button', { type: 'button', onClick: choose, disabled: Boolean(running) }, '选择图片'),
        React.createElement('span', null, file?.name || '尚未选择'),
      ),
      React.createElement('div', { style: row },
        React.createElement('label', null, '格式 ', React.createElement('select', { value: target, onChange: (event) => setTarget(event.target.value), disabled: Boolean(running) },
          ...['png', 'jpg', 'webp', 'avif', 'tiff', 'gif'].map((value) => React.createElement('option', { key: value, value }, value.toUpperCase())))),
        React.createElement('label', null, '质量 ', React.createElement('input', { type: 'number', min: 10, max: 100, value: quality, onChange: (event) => setQuality(Number(event.target.value)), disabled: Boolean(running), style: { width: 72 } })),
        React.createElement('button', { type: 'button', onClick: submit, disabled: !file || Boolean(running) }, '开始转换'),
        running ? React.createElement('button', { type: 'button', onClick: () => action('cancel') }, '取消') : null,
      ),
      job ? React.createElement('div', { style: { marginTop: 20 } },
        React.createElement('progress', { max: 1, value: job.progress, style: { width: '100%' } }),
        React.createElement('p', { role: 'status' }, job.error || (complete ? `完成 · ${job.width}×${job.height} · ${job.format?.toUpperCase()}` : `处理中 · ${Math.round(job.progress * 100)}%`)),
        complete ? React.createElement('div', { style: row },
          React.createElement('button', { type: 'button', onClick: () => action('save') }, '另存为'),
          React.createElement('button', { type: 'button', onClick: () => action('show') }, '在 Finder 中显示'),
          React.createElement('small', null, '临时结果保留 10 分钟，过期后请重新转换。'),
        ) : null,
      ) : null,
      message ? React.createElement('p', { role: 'alert' }, message) : null,
    ),
  )
}

export const name = 'moyu-image-client'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'moyu-image-convert-view', order: 20, label: () => '图片转换',
  } as never, ImagePanel as never))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'moyu-image-convert', order: 15, label: () => '图片转换',
  } as never, ImagePanel as never))
}
