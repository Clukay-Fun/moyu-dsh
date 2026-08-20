import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import React from 'react'

export const name = 'moyu-legacy-tools-client'
export const inject = ['slots']

function LegacyToolsPanel(): React.ReactElement {
  const [status, setStatus] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const openModule = async (module: string, label: string): Promise<void> => {
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/moyu/open-legacy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ module }),
      })
      if (!response.ok) throw new Error(`请求失败：HTTP ${response.status}`)
      setStatus(`${label}已打开`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const tools = [
    ['image', '图片'],
    ['pdf', 'PDF'],
    ['bc', '条码'],
    ['video', '格式转换'],
  ]

  return React.createElement('section', { id: 'moyu-legacy-tools', style: { padding: 24 } },
    React.createElement('h2', null, '摸鱼工具'),
    React.createElement('p', null, '迁移期间从 DSH 内打开已有离线工具。'),
    React.createElement('div', { style: { display: 'flex', gap: 12, flexWrap: 'wrap' } },
      ...tools.map(([module, label]) => React.createElement('button', {
        key: module,
        type: 'button',
        disabled: busy,
        onClick: () => openModule(module, label),
      }, busy ? '正在打开…' : label)),
    ),
    status ? React.createElement('p', { role: 'status' }, status) : null,
  )
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'moyu-legacy-tools',
    order: 20,
    label: () => '摸鱼工具',
  } as never, LegacyToolsPanel as never))
}
