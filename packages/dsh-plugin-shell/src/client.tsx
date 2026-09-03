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

type KernelProbe = { status: 'passed' | 'failed'; reason?: string | null; at: string }
type KernelInfo = { version: string; dshVersion: string; channel?: string | null; notes?: string | null; probe?: KernelProbe | null; metadataUrl?: string; signatureUrl?: string; payloadUrl?: string }
type KernelState = {
  builtinVersion: string | null
  active: string | null
  previous: string | null
  installed: KernelInfo[]
  failed: Record<string, { reason?: string }>
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

async function kernelRequest(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch('/moyu/kernel', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
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

function KernelPanel(): React.ReactElement {
  const [state, setState] = React.useState<KernelState | null>(null)
  const [channel, setChannel] = React.useState<'stable' | 'beta'>('stable')
  const [available, setAvailable] = React.useState<KernelInfo[]>([])
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const refresh = React.useCallback(async () => {
    try { setState(await kernelRequest({ operation: 'status' }) as KernelState) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [])
  React.useEffect(() => { void refresh() }, [refresh])

  const run = async (key: string, payload: Record<string, unknown>, message?: string): Promise<any> => {
    if (busy) return undefined
    setBusy(key); setError(''); setNotice('')
    try {
      const result = await kernelRequest(payload)
      if (message) setNotice(message)
      await refresh()
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return undefined
    } finally { setBusy('') }
  }

  const install = async (): Promise<void> => {
    const result = await run('install', { operation: 'install-local' })
    if (!result || result.canceled) return
    setNotice(result.status === 'already' ? '该内核已经安装。' : result.status === 'installed' ? '内核已安装，请先运行兼容探针。' : `安装被拒绝：${result.reason}`)
  }
  const check = async (): Promise<void> => {
    const result = await run('feed', { operation: 'check-feed', channel })
    if (result) { setAvailable(result.releases || []); setNotice(`已检查 ${channel} 通道。`) }
  }
  const restart = async (): Promise<void> => {
    await run('restart', { operation: 'restart-app' })
  }
  const downloadInstall = async (item: KernelInfo): Promise<void> => {
    if (!item.metadataUrl || !item.signatureUrl || !item.payloadUrl) return
    const release = { version: item.version, metadataUrl: item.metadataUrl, signatureUrl: item.signatureUrl, payloadUrl: item.payloadUrl }
    const result = await run(`download:${item.version}`, { operation: 'download-install', release })
    if (!result) return
    setNotice(result.status === 'installed' ? `${item.version} 已安装，请运行兼容探针。` : result.status === 'already' ? `${item.version} 已安装。` : `安装被拒绝：${result.reason}`)
  }

  const active = state?.active && state.active !== 'builtin' ? state.active : `内置 ${state?.builtinVersion || '未知'}`
  return React.createElement('section', { style: CARD },
    React.createElement('div', { style: { fontWeight: 700, fontSize: 15 } }, 'DSH 内核'),
    React.createElement('div', { style: { marginTop: 8 } }, `当前内核：${active}`),
    React.createElement('div', { style: HINT }, `上一版本：${state?.previous || '无'}。只接受 MOYU 签名并通过兼容探针的内核包。`),
    error && React.createElement('div', { style: { ...HINT, color: '#c0392b', marginTop: 8 } }, error),
    notice && React.createElement('div', { style: { ...HINT, color: '#287a45', marginTop: 8 } }, notice),
    React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 } },
      React.createElement('button', { type: 'button', disabled: !!busy, onClick: () => void install() }, '安装本地内核包'),
      React.createElement('select', { value: channel, disabled: !!busy, onChange: (e) => setChannel(e.target.value as 'stable' | 'beta') },
        React.createElement('option', { value: 'stable' }, '稳定通道'),
        React.createElement('option', { value: 'beta' }, '测试通道')),
      React.createElement('button', { type: 'button', disabled: !!busy, onClick: () => void check() }, '检查可用版本'),
      React.createElement('button', { type: 'button', disabled: !!busy || !state?.previous, onClick: () => void run('rollback', { operation: 'rollback' }, '已选择上一内核，重启后生效。') }, '回退上一版本'),
      React.createElement('button', { type: 'button', disabled: !!busy || state?.active === 'builtin', onClick: () => void run('builtin', { operation: 'restore-builtin' }, '已恢复内置内核，重启后生效。') }, '恢复内置版本'),
      React.createElement('button', { type: 'button', disabled: !!busy, onClick: () => void restart() }, '重启应用')),
    available.length > 0 && React.createElement('div', { style: { ...CARD, marginTop: 12 } },
      React.createElement('div', { style: { fontWeight: 600 } }, '远端可用版本'),
      ...available.map((item) => React.createElement('div', { key: item.version, style: { display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' } },
        React.createElement('span', { style: { flex: 1 } }, `${item.version} · ${item.notes || '无更新说明'}`),
        React.createElement('button', { type: 'button', disabled: !!busy, onClick: () => void downloadInstall(item) }, '下载并安装')))),
    React.createElement('div', { style: { marginTop: 16, fontWeight: 600 } }, '已安装内核'),
    ...(state?.installed || []).map((item) => React.createElement('div', {
      key: item.version, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid rgba(127,127,127,0.14)' },
    },
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', null, item.version),
        React.createElement('div', { style: HINT }, item.probe ? `探针：${item.probe.status}${item.probe.reason ? ` · ${item.probe.reason}` : ''}` : '尚未运行兼容探针')),
      React.createElement('button', { type: 'button', disabled: !!busy, onClick: () => void run(`probe:${item.version}`, { operation: 'probe', version: item.version }, '兼容探针完成。') }, '运行探针'),
      React.createElement('button', { type: 'button', disabled: !!busy || item.probe?.status !== 'passed' || state?.active === item.version, onClick: () => void run(`activate:${item.version}`, { operation: 'activate', version: item.version }, '已选择该内核，重启后生效。') }, '设为当前'))),
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
  } as never, KernelPanel as never))

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
