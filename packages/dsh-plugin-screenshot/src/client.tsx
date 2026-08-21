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

function ScreenshotPanel(): React.ReactElement {
  const [job, setJob] = React.useState<Job>()
  const [message, setMessage] = React.useState('')

  React.useEffect(() => {
    if (!job || ['completed', 'cancelled', 'failed'].includes(job.status)) return
    const timer = window.setInterval(() => {
      void request({ operation: 'status', job_id: job.jobId }).then(setJob).catch((error) => {
        setMessage(error instanceof Error ? error.message : String(error))
        window.clearInterval(timer)
      })
    }, 350)
    return () => window.clearInterval(timer)
  }, [job?.jobId, job?.status])

  const submit = async (): Promise<void> => {
    setMessage('')
    try { setJob(await request({ operation: 'start' })) }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  const action = async (operation: string): Promise<void> => {
    if (!job) return
    setMessage('')
    try {
      const value = await request({ operation, job_id: job.jobId })
      if (operation === 'cancel') setJob(value)
      else if (operation === 'save' && !value.canceled) setMessage('截图已保存')
      else if (operation === 'show') setMessage('已在 Finder 中定位')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  const waiting = job && !['completed', 'cancelled', 'failed'].includes(job.status)
  const completed = job?.status === 'completed' && job.resultStatus !== 'expired' && job.result
  const card: React.CSSProperties = { maxWidth: 720, padding: 24, border: '1px solid color-mix(in srgb, currentColor 16%, transparent)', borderRadius: 16 }
  const row: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }
  return React.createElement('section', { id: 'moyu-screenshot-capture', style: { padding: 24 } },
    React.createElement('div', { style: card },
      React.createElement('h2', { style: { marginTop: 0 } }, '截图'),
      React.createElement('p', null, '模型截图会先请求确认；这里是人工入口，结果只留在截图面板，不会自动进入 legacy 画布。'),
      React.createElement('div', { style: row },
        React.createElement('button', { type: 'button', onClick: submit, disabled: Boolean(waiting) }, '开始区域截图'),
        waiting ? React.createElement('button', { type: 'button', onClick: () => action('cancel') }, '取消') : null,
      ),
      job ? React.createElement('div', { style: { marginTop: 20 } },
        React.createElement('p', { role: 'status' },
          job.error || (completed
            ? `完成 · ${job.result?.width}×${job.result?.height} · ${job.result?.backend || 'screen'}`
            : job.status === 'cancelled'
              ? `已取消 · ${job.reason || 'cancelled'}`
              : `等待操作 · ${job.phase || job.status}`)),
        completed ? React.createElement('div', { style: row },
          React.createElement('button', { type: 'button', onClick: () => action('save') }, '另存为'),
          React.createElement('button', { type: 'button', onClick: () => action('show') }, '在 Finder 中显示'),
          React.createElement('small', null, '临时截图结果保留 1 小时。'),
        ) : null,
      ) : null,
      message ? React.createElement('p', { role: 'alert' }, message) : null,
    ),
  )
}

export const name = 'moyu-screenshot-client'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'moyu-screenshot-capture-view', order: 30, label: () => '截图',
  } as never, ScreenshotPanel as never))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'moyu-screenshot-capture', order: 25, label: () => '截图',
  } as never, ScreenshotPanel as never))
}
