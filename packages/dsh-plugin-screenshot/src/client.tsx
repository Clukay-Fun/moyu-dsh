import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import React from 'react'


type Job = {
  jobId: string
  status: string
  phase?: string
  reason?: string
  resultStatus?: string
  result?: { fileId: string; name?: string; width?: number; height?: number; backend?: string }
  error?: string
}

type DraftImage = { id: unknown }

type InputShell = {
  actions?: { addImages(ids: readonly unknown[]): boolean }
}

type ConversationService = {
  createDraftImages(files: readonly File[]): readonly DraftImage[]
  input?: { shells?: Map<string, InputShell> }
}

async function request(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch('/moyu/screenshot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || `请求失败：HTTP ${response.status}`)
  return value
}

async function pollUntilTerminal(jobId: string): Promise<Job> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const job: Job = await request({ operation: 'status', job_id: jobId })
    if (['completed', 'cancelled', 'failed'].includes(job.status)) return job
    await new Promise((resolve) => window.setTimeout(resolve, 350))
  }
  throw new Error('截图等待超时')
}

async function readResultPng(jobId: string): Promise<ArrayBuffer> {
  const response = await fetch('/moyu/screenshot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'read', job_id: jobId }),
  })
  if (!response.ok) {
    const value = await response.json().catch(() => ({}))
    throw new Error(value.error || `读取截图失败：HTTP ${response.status}`)
  }
  return response.arrayBuffer()
}

/**
 * Inline `ic-capture` style glyph — a viewfinder-with-shutter mark used by the
 * legacy Moyu toolbar, converted to a self-contained React SVG so the screenshot
 * button needs no external asset pipeline.
 */
function CaptureIcon({ size = 16 }: { size?: number }): React.ReactElement {
  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      focusable: false,
    },
    React.createElement('path', { d: 'M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z' }),
    React.createElement('circle', { cx: 12, cy: 12.75, r: 3.5 }),
    React.createElement('path', { d: 'M12 2v3M2 12.75h3M19 12.75h3' }),
  )
}

function CaptureButton(props: { conversation?: () => ConversationService | undefined }): React.ReactElement {
  const [busy, setBusy] = React.useState(false)
  const [note, setNote] = React.useState('')
  const [pressed, setPressed] = React.useState(false)
  const [hover, setHover] = React.useState(false)

  const capture = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setNote('')
    try {
      const start = await request({
        operation: 'start',
        caller: 'renderer:moyu-screenshot-composer',
        resultSink: 'session',
      })
      if (start.status === 'busy') {
        throw new Error('已有截图进行中')
      }
      const job = await pollUntilTerminal(start.jobId)
      if (job.status !== 'completed' || !job.result?.fileId) {
        throw new Error(job.status === 'cancelled' ? '已取消' : job.error || '截图未完成')
      }
      const conversation = props.conversation?.()
      const shells = conversation?.input?.shells ? [...conversation.input.shells.values()] : []
      const shell = shells.at(-1)
      if (!shell?.actions?.addImages) {
        throw new Error('输入框尚未就绪，请进入会话后重试')
      }
      const bytes = await readResultPng(job.jobId)
      const file = new File([bytes], `screenshot-${Date.now()}.png`, { type: 'image/png' })
      const drafts = conversation!.createDraftImages([file])
      shell.actions.addImages(drafts.map((draft) => draft.id))
      window.__moyuScreenshotLastResult = {
        fileId: job.result?.fileId,
        name: job.result?.name,
        width: job.result?.width,
        height: job.result?.height,
        backend: job.result?.backend,
        draftIds: drafts.map((draft) => draft.id),
        at: Date.now(),
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return React.createElement('button', {
    type: 'button',
    title: note || '区域截图（截完作为附件插入输入框）',
    'aria-label': '区域截图',
    'data-testid': 'moyu-screenshot',
    onClick: () => void capture(),
    disabled: busy,
    onMouseDown: () => { if (!busy) setPressed(true) },
    onMouseUp: () => { setPressed(false) },
    onMouseLeave: () => { setPressed(false); setHover(false) },
    onMouseEnter: () => { setHover(true) },
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      padding: 0,
      border: 'none',
      borderRadius: 8,
      background: hover && !busy ? 'rgba(127,127,127,0.16)' : 'transparent',
      color: 'inherit',
      cursor: busy ? 'default' : 'pointer',
      opacity: busy ? 0.45 : 1,
      transition: 'transform 120ms ease, background-color 120ms ease',
      transform: pressed ? 'scale(0.97)' : 'none',
    },
  }, busy ? '…' : React.createElement(CaptureIcon))
}

export const name = 'moyu-screenshot-client'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  const conversation = () => {
    try { return (ctx as unknown as { get(key: string): unknown }).get('conversation') as ConversationService }
    catch { return undefined }
  }
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'moyu-screenshot-composer',
    order: 100,
  } as never, (() => React.createElement(CaptureButton, { conversation })) as never))
}
