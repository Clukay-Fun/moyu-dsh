import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import React from 'react'

type Mod = {
  id: string
  version: string
  displayName: string
  enabled: boolean
  permissions: string[]
  integrity: 'ok' | 'missing' | 'error'
}

async function modsRequest(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch('/moyu/mods', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || `请求失败：HTTP ${response.status}`)
  return value
}

const CARD: React.CSSProperties = {
  padding: 16,
  border: '1px solid rgba(127,127,127,0.24)',
  borderRadius: 12,
  margin: '12px 0',
}
const HINT: React.CSSProperties = { fontSize: 12, opacity: 0.7, marginTop: 4 }

/** Mods 管理：读 /moyu/mods，启停/卸载写 registry，改动"下次重启生效"。 */
function ModsPanel(): React.ReactElement {
  const [mods, setMods] = React.useState<Mod[] | null>(null)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [dirty, setDirty] = React.useState(false)

  const refresh = React.useCallback(async () => {
    setError('')
    try {
      const r = await modsRequest({ operation: 'list' })
      setMods(r.mods as Mod[])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  React.useEffect(() => { void refresh() }, [refresh])

  const setEnabled = async (id: string, enabled: boolean): Promise<void> => {
    if (busy) return
    setBusy(id); setError('')
    try {
      const r = await modsRequest({ operation: 'set-enabled', id, enabled })
      setMods(r.mods as Mod[]); setDirty(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy('') }
  }

  const uninstall = async (id: string, name: string): Promise<void> => {
    if (busy) return
    if (!window.confirm(`卸载「${name}」？该操作将在下次重启后生效。`)) return
    setBusy(id); setError('')
    try {
      const r = await modsRequest({ operation: 'uninstall', id })
      setMods(r.mods as Mod[]); setDirty(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy('') }
  }

  const rows = (mods || []).map((m) => React.createElement('div', {
    key: m.id,
    style: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderTop: '1px solid rgba(127,127,127,0.14)',
    },
  },
    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
      React.createElement('div', { style: { fontWeight: 600 } }, m.displayName),
      React.createElement('div', { style: HINT },
        `${m.id} · v${m.version}` + (m.integrity !== 'ok' ? ` · ⚠ ${m.integrity}` : '')),
    ),
    React.createElement('button', {
      type: 'button',
      disabled: !!busy,
      onClick: () => void setEnabled(m.id, !m.enabled),
      style: { padding: '4px 12px', borderRadius: 8, cursor: busy ? 'default' : 'pointer' },
    }, m.enabled ? '已启用' : '已禁用'),
    React.createElement('button', {
      type: 'button',
      disabled: !!busy,
      onClick: () => void uninstall(m.id, m.displayName),
      style: { padding: '4px 12px', borderRadius: 8, cursor: busy ? 'default' : 'pointer', color: '#c0392b' },
    }, '卸载'),
  ))

  return React.createElement('section', { style: CARD },
    React.createElement('div', { style: { fontWeight: 700, fontSize: 15 } }, 'Mods 管理'),
    React.createElement('div', { style: HINT }, '启用 / 禁用 / 卸载已安装的 Mod。改动将在下次重启 MOYU DSH 后生效。'),
    dirty && React.createElement('div', {
      style: { ...HINT, color: '#b8860b', marginTop: 8 },
    }, '⟳ 有改动待生效，请重启应用。'),
    error && React.createElement('div', { style: { ...HINT, color: '#c0392b' } }, error),
    mods === null
      ? React.createElement('div', { style: HINT }, '加载中…')
      : mods.length === 0
        ? React.createElement('div', { style: HINT }, '尚未安装任何 Mod。')
        : React.createElement('div', null, ...rows),
    React.createElement('button', {
      type: 'button', onClick: () => void refresh(),
      style: { marginTop: 12, padding: '4px 12px', borderRadius: 8, cursor: 'pointer' },
    }, '刷新'),
  )
}

/** 状态占位分区（内核 C4 / 更新 C5）：只展示状态，不放可点击的假按钮。 */
function StatusPanel({ title, status, note }: { title: string; status: string; note: string }): React.ReactElement {
  return React.createElement('section', { style: CARD },
    React.createElement('div', { style: { fontWeight: 700, fontSize: 15 } }, title),
    React.createElement('div', { style: { marginTop: 8 } }, status),
    React.createElement('div', { style: HINT }, note),
  )
}

export const name = 'moyu-shell-client'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.section' as never, () => ctx.slots.register({
    name: 'settings.section',
    id: 'moyu-shell-mods',
    order: 20,
    label: () => 'Mods',
  } as never, ModsPanel as never))

  ctx.slots.inject('settings.section' as never, () => ctx.slots.register({
    name: 'settings.section',
    id: 'moyu-shell-kernel',
    order: 30,
    label: () => 'DSH 内核',
  } as never, (() => React.createElement(StatusPanel, {
    title: 'DSH 内核',
    status: '当前内核：随应用内置。',
    note: '内核下载与版本切换功能将在 C4 提供。',
  })) as never))

  ctx.slots.inject('settings.section' as never, () => ctx.slots.register({
    name: 'settings.section',
    id: 'moyu-shell-update',
    order: 40,
    label: () => '更新',
  } as never, (() => React.createElement(StatusPanel, {
    title: '应用更新',
    status: '当前为手动更新。',
    note: '自动检查与应用更新功能将在 C5 提供。',
  })) as never))
}
