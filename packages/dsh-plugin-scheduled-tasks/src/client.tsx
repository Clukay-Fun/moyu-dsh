import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import React from 'react'
import { computeNextRun, describeSchedule, taskPresetOf } from './schedule'
import type { ScheduleSpec, RecurrencePattern, RunMode } from './schedule'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'surface.scheduled': {
      kind: 'single'
      scope: 'root'
    }
  }
}

// ---- Shared DTOs (mirror the Host side, no cwd/prompt leakage) ----
export interface TaskSummary {
  id: string
  title: string
  enabled: boolean
  schedule: ScheduleSpec
  nextRunAt: number | null
  lastRunAt: number | null
  lastRunStatus: 'succeeded' | 'failed' | 'interrupted' | null
  unreadCount: number
  running: boolean
  preset?: string
  runMode?: RunMode
}

export interface RunSummary {
  runId: string
  taskId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted' | 'missed' | 'cancelled'
  startedAt: number
  finishedAt: number | null
  sessionId: string | null
  unread: boolean
  errorMessage?: string
  scheduledFor?: number
}

export interface WorkspaceSummary {
  id: string
  title: string
}

type RecurrenceMode = 'once' | RecurrencePattern

interface Draft {
  taskId?: string
  title: string
  prompt: string
  workspaceId: string
  recurrence: RecurrenceMode
  runAtLocal: string
  timeOfDay: string
  weekday: number
  dayOfMonth: number
  timeZone: string
  enabled: boolean
  runMode: RunMode
}

function fmtTime(ts: number | null): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return '—'
  }
}

function taskStateLabel(t: TaskSummary): string {
  if (t.running) return '正在运行'
  if (t.unreadCount > 0) return '需要处理'
  if (t.lastRunStatus === 'failed') return '执行失败'
  if (t.lastRunStatus === 'interrupted') return '已中断'
  if (!t.enabled && t.nextRunAt) return '已暂停'
  if (t.nextRunAt) return '等待执行'
  if (t.lastRunStatus === 'succeeded') return '已完成'
  return '已暂停'
}

function runStatusText(s: RunSummary['status']): string {
  switch (s) {
    case 'running':
      return '运行中'
    case 'succeeded':
      return '成功'
    case 'failed':
      return '失败'
    case 'interrupted':
      return '已中断'
    case 'missed':
      return '错过'
    case 'cancelled':
      return '已取消'
    default:
      return '排队中'
  }
}

function runStatusClass(s: RunSummary['status']): string {
  return s === 'succeeded' ? 'moyu-st-ok' : s === 'failed' || s === 'interrupted' || s === 'missed' ? 'moyu-st-bad' : ''
}

function datetimeLocalToMs(value: string): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

const COMMON_TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function msToDatetimeLocal(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/
const WEEKDAY_OPTIONS = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
]

// Scoped CSS so button sizing / hover / focus / danger states are consistent
// without touching the host page's global styles.
const STYLE = `
.moyu-st-page { box-sizing: border-box; width: 100%; height: 100%; min-height: 0; color: var(--dsw-alias-label-primary, var(--fg, #111)); background: var(--dsw-alias-bg-base, var(--bg, #fff)); overflow: hidden; position: relative; }
.moyu-st-main { height: 100%; overflow: auto; transition: margin-right 180ms ease-out; }
.moyu-st-main[data-drawer="true"] { margin-right: min(520px, 38vw); }
.moyu-st-shell { box-sizing: border-box; width: min(100%, 980px); margin: 0 auto; padding: 46px 34px 72px; }
.moyu-st-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.moyu-st-heading { margin: 0; font-size: 31px; font-weight: 560; line-height: 1.2; letter-spacing: -0.025em; }
.moyu-st-subtitle { margin: 10px 0 0; color: var(--dsw-alias-label-secondary, #777b82); font-size: 15px; line-height: 22px; }
.moyu-st-primary { min-width: 76px; height: 38px; border: 0; border-radius: 11px; color: #fff; background: #17191b; font: inherit; font-weight: 550; cursor: pointer; transition: transform 140ms ease-out, background-color 140ms ease-out; }
.moyu-st-primary:active { transform: scale(.97); }
.moyu-st-primary:disabled { background: #a8aaad; cursor: not-allowed; }
.moyu-st-search-wrap { position: relative; margin-top: 28px; }
.moyu-st-search-icon { position: absolute; left: 15px; top: 50%; width: 17px; height: 17px; transform: translateY(-50%); color: #7c8188; pointer-events: none; }
.moyu-st-search { box-sizing: border-box; width: 100%; height: 42px; padding: 0 16px 0 42px; color: inherit; background: transparent; border: 1px solid var(--dsw-alias-border-l2, #d9dadd); border-radius: 22px; font: inherit; outline: none; }
.moyu-st-search:focus { border-color: var(--dsw-alias-state-business-primary, var(--accent, #3b82f6)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary, #3b82f6) 18%, transparent); }
.moyu-st-tabs { display: flex; gap: 24px; margin-bottom: 22px; }
.moyu-st-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.moyu-st-toolbar .moyu-st-tabs { margin-bottom: 0; }
.moyu-st-tab { padding: 4px 10px; border: 0; border-radius: 9px; color: #74787e; background: transparent; font: inherit; cursor: pointer; }
.moyu-st-tab[data-active="true"] { color: inherit; background: #f0f1f2; font-weight: 600; }
.moyu-st-section-title { margin: 30px 0 12px 12px; color: #70747a; font-size: 15px; font-weight: 560; }
.moyu-st-list { list-style: none; margin: 24px 0 0; padding: 0; }
.moyu-st-row { position: relative; display: flex; align-items: flex-start; gap: 12px; min-height: 62px; padding: 13px 52px 12px 16px; border-radius: 13px; cursor: pointer; transition: background-color 140ms ease-out; }
.moyu-st-row[data-selected="true"], .moyu-st-row:hover { background: #f2f2f3; }
.moyu-st-state-dot { flex: none; width: 15px; height: 15px; margin-top: 3px; border: 1.5px solid #8f9499; border-radius: 50%; box-sizing: border-box; }
.moyu-st-state-dot[data-running="true"] { border-color: #377dff; box-shadow: inset 0 0 0 3px #fff; background: #377dff; }
.moyu-st-row-copy { min-width: 0; }
.moyu-st-row-title { font-size: 15px; font-weight: 600; line-height: 20px; }
.moyu-st-row-meta { margin-top: 2px; color: #85898f; font-size: 14px; line-height: 20px; }
.moyu-st-more { position: absolute; top: 10px; right: 10px; width: 34px; height: 34px; border: 0; border-radius: 10px; background: transparent; color: #72767c; font-size: 20px; cursor: pointer; }
.moyu-st-more:hover, .moyu-st-more[data-open="true"] { background: #e7e7e8; }
.moyu-st-menu { position: absolute; z-index: 15; top: 45px; right: 10px; width: 174px; padding: 6px; border: 1px solid #dedfe1; border-radius: 14px; background: var(--bg, #fff); box-shadow: 0 12px 34px rgba(0,0,0,.12); transform-origin: top right; }
.moyu-st-menu[data-visible="false"] { display: none; }
.moyu-st-menu button { display: block; width: 100%; height: 36px; padding: 0 12px; border: 0; border-radius: 8px; color: inherit; background: transparent; text-align: left; font: inherit; cursor: pointer; }
.moyu-st-menu button:hover { background: #f3f3f4; }
.moyu-st-menu button[data-danger="true"] { color: #ef4444; }
.moyu-st-suggestions { list-style: none; margin: 0; padding: 0; }
.moyu-st-suggestion { display: flex; gap: 14px; min-height: 66px; padding: 12px 16px; border-radius: 12px; cursor: pointer; }
.moyu-st-suggestion:hover { background: #f3f3f4; }
.moyu-st-suggestion-icon { width: 18px; color: #8b5cf6; font-size: 21px; line-height: 20px; }
.moyu-st-suggestion-title { font-weight: 600; }
.moyu-st-suggestion-time { margin-left: 8px; color: #85898f; font-weight: 400; }
.moyu-st-suggestion-desc { margin-top: 4px; color: #777b82; font-size: 14px; }
.moyu-st-empty { margin-top: 28px; color: var(--dsw-alias-label-secondary, #6b7280); }
.moyu-st-btn { font: inherit; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border, #ccd); background: var(--bg, #fff); color: var(--fg, #111); cursor: pointer; }
.moyu-st-btn:hover:not(:disabled) { background: var(--hover, #f0f0f0); }
.moyu-st-btn:focus-visible { outline: 2px solid var(--accent, #3b82f6); outline-offset: 1px; }
.moyu-st-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.moyu-st-btn.moyu-st-danger { color: var(--danger, #c0392b); border-color: var(--danger, #c0392b); }
.moyu-st-btn.moyu-st-danger:hover:not(:disabled) { background: var(--danger-weak, #fdecea); }
.moyu-st-title { word-break: break-word; overflow-wrap: anywhere; }
.moyu-st-err { color: var(--danger, #c0392b); word-break: break-word; overflow-wrap: anywhere; white-space: pre-wrap; }
.moyu-st-ok { color: var(--ok, #1a7f37); }
.moyu-st-bad { color: var(--danger, #c0392b); }
.moyu-st-notice { border: 1px solid var(--border, #ccd); border-radius: 8px; padding: 10px 12px; margin-top: 12px; background: var(--notice-bg, #f7f9ff); }
.moyu-st-notice-item { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 4px 0; }
.moyu-st-drawer { position: absolute; z-index: 30; inset: 0 0 0 auto; box-sizing: border-box; width: min(520px, 38vw); min-width: 390px; padding: 24px 26px 84px; overflow: auto; border-left: 1px solid #e5e5e6; background: var(--bg, #fff); box-shadow: -8px 0 24px rgba(0,0,0,.025); transition: transform 180ms ease-out, opacity 140ms ease-out; }
.moyu-st-drawer-head { display: flex; align-items: center; justify-content: space-between; color: #7c8086; font-size: 14px; }
.moyu-st-close { width: 32px; height: 32px; border: 0; border-radius: 8px; color: #666b70; background: transparent; font-size: 25px; line-height: 1; cursor: pointer; }
.moyu-st-close:hover { background: #f2f2f3; }
.moyu-st-drawer-title { margin: 14px 0 22px; font-size: 20px; font-weight: 620; }
.moyu-st-field-label { margin: 24px 4px 8px; color: #8a8e94; font-size: 14px; }
.moyu-st-text, .moyu-st-textarea { box-sizing: border-box; width: 100%; border: 1px solid #e0e1e3; border-radius: 16px; background: transparent; color: inherit; font: inherit; outline: none; }
.moyu-st-text { height: 48px; padding: 0 16px; }
.moyu-st-textarea { height: 92px; padding: 15px 16px; resize: vertical; }
.moyu-st-text:focus, .moyu-st-textarea:focus { border-color: #4d83f7; box-shadow: 0 0 0 2px rgba(77,131,247,.12); }
.moyu-st-card { overflow: hidden; border: 1px solid #e1e2e4; border-radius: 16px; }
.moyu-st-setting { display: grid; grid-template-columns: 112px minmax(0,1fr); align-items: center; min-height: 50px; padding: 0 16px; border-top: 1px solid #ececee; }
.moyu-st-setting:first-child { border-top: 0; }
.moyu-st-setting > span { font-weight: 550; }
.moyu-st-setting select, .moyu-st-setting input { min-width: 0; width: 100%; border: 0; outline: 0; color: inherit; background: transparent; text-align: right; font: inherit; }
.moyu-st-drawer-footer { position: absolute; right: 0; bottom: 0; left: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 14px 26px; border-top: 1px solid #ececee; background: var(--bg, #fff); }
.moyu-st-secondary { height: 38px; padding: 0 18px; border: 1px solid #dddfe1; border-radius: 11px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.moyu-st-detail-prompt { padding: 17px 18px; border: 1px solid #e1e2e4; border-radius: 16px; line-height: 1.55; white-space: pre-wrap; }
.moyu-st-status { color: #3478f6; font-weight: 600; }
.moyu-st-overlay { position: fixed; z-index: 1000; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.18); }
.moyu-st-confirm { box-sizing: border-box; width: 520px; max-width: calc(100vw - 40px); padding: 26px; border: 1px solid #e2e2e3; border-radius: 18px; background: var(--bg, #fff); box-shadow: 0 18px 50px rgba(0,0,0,.14); }
.moyu-st-confirm h2 { margin: 0; font-size: 20px; }
.moyu-st-confirm p { margin: 8px 0 24px; color: #888c92; }
.moyu-st-confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
.moyu-st-delete { height: 38px; padding: 0 18px; border: 0; border-radius: 10px; color: #ef4444; background: #fee9e9; font: inherit; font-weight: 600; cursor: pointer; }
@media (max-width: 980px) { .moyu-st-main[data-drawer="true"] { margin-right: 0; } .moyu-st-drawer { width: min(520px, 100%); min-width: 0; box-shadow: -16px 0 40px rgba(0,0,0,.12); } }
@media (max-width: 720px) { .moyu-st-shell { padding: 32px 20px 48px; } .moyu-st-heading { font-size: 27px; } .moyu-st-header { gap: 16px; } }
@media (prefers-reduced-motion: reduce) { .moyu-st-main, .moyu-st-drawer { transition: opacity 120ms ease-out; } }
`
function btn(
  label: string,
  onClick: () => void,
  opts: { danger?: boolean; disabled?: boolean } = {},
): React.ReactElement {
  const cls = 'moyu-st-btn' + (opts.danger ? ' moyu-st-danger' : '')
  return React.createElement('button', { className: cls, disabled: Boolean(opts.disabled), onClick }, label)
}
function tzOf(spec: ScheduleSpec): string {
  return spec.kind === 'recurring' ? spec.timeZone : detectTimeZone()
}

function field(label: string, control: React.ReactNode): React.ReactNode {
  return React.createElement(
    'label',
    { style: { display: 'block', margin: '8px 0' } },
    React.createElement('div', { style: { fontSize: 12, opacity: 0.7, marginBottom: 4 } }, label),
    control,
  )
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 13 }
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const modalStyle: React.CSSProperties = {
  background: 'var(--bg, #fff)', color: 'var(--fg, #111)', padding: 20, borderRadius: 10,
  width: 420, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
}

function EditorModal(props: {
  initial: Draft
  workspaces: WorkspaceSummary[]
  onSave: (d: Draft) => void
  onRunNow: (d: Draft) => void
  onCancel: () => void
}): React.ReactElement {
  const [draft, setDraft] = React.useState<Draft>(props.initial)
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const isEdit = Boolean(props.initial.taskId)
  const isRecurring = draft.recurrence !== 'once'
  const previewSpec: ScheduleSpec | null = (() => {
    if (draft.recurrence === 'once') {
      const ms = datetimeLocalToMs(draft.runAtLocal)
      return ms != null ? { kind: 'once', runAt: ms } : null
    }
    if (!HHMM.test(draft.timeOfDay)) return null
    const spec: {
      kind: 'recurring'
      pattern: RecurrencePattern
      timeOfDay: string
      timeZone: string
      weekday?: number
      dayOfMonth?: number
    } = { kind: 'recurring', pattern: draft.recurrence, timeOfDay: draft.timeOfDay, timeZone: draft.timeZone }
    if (draft.recurrence === 'weekly') spec.weekday = draft.weekday
    if (draft.recurrence === 'monthly') spec.dayOfMonth = draft.dayOfMonth
    return spec
  })()
  const nextRun = previewSpec ? computeNextRun(previewSpec, Date.now()) : null
  const tzOptions = COMMON_TIMEZONES.includes(draft.timeZone)
    ? COMMON_TIMEZONES
    : [draft.timeZone, ...COMMON_TIMEZONES]
  return React.createElement(
    'aside',
    { className: 'moyu-st-drawer', 'aria-label': isEdit ? '编辑任务' : '新建任务' },
    React.createElement('div', { className: 'moyu-st-drawer-head' }, React.createElement('span', null, isEdit ? '编辑任务' : '新建任务'), React.createElement('button', { className: 'moyu-st-close', onClick: props.onCancel, 'aria-label': '关闭' }, '×')),
    React.createElement('h2', { className: 'moyu-st-drawer-title' }, isEdit ? '编辑已安排任务' : '已安排任务标题'),
    React.createElement('input', { className: 'moyu-st-text', value: draft.title, maxLength: 80, placeholder: '输入任务名称', onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ title: e.target.value }) }),
    React.createElement('textarea', { className: 'moyu-st-textarea', value: draft.prompt, maxLength: 20000, placeholder: '描述 MOYU 应该做什么', style: { marginTop: 12 }, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => set({ prompt: e.target.value }) }),
    React.createElement('div', { className: 'moyu-st-field-label' }, '详情'),
    React.createElement(
      'div',
      { className: 'moyu-st-card' },
      React.createElement('label', { className: 'moyu-st-setting' }, React.createElement('span', null, '运行位置'), React.createElement('select', { value: draft.workspaceId, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ workspaceId: e.target.value }) }, React.createElement('option', { value: '' }, '选择项目'), ...props.workspaces.map((w) => React.createElement('option', { key: w.id, value: w.id }, w.title)))),
      React.createElement('label', { className: 'moyu-st-setting' }, React.createElement('span', null, '运行于'), React.createElement('select', { value: draft.runMode || 'standalone', onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ runMode: e.target.value === 'continuation' ? 'continuation' : 'standalone' }) }, React.createElement('option', { value: 'standalone' }, '每次新建会话'), React.createElement('option', { value: 'continuation' }, '续写当前会话'))),
    ),
    React.createElement('div', { className: 'moyu-st-field-label' }, '频率'),
    React.createElement(
      'div',
      { className: 'moyu-st-card' },
      React.createElement('label', { className: 'moyu-st-setting' }, React.createElement('span', null, '重复'), React.createElement('select', { value: draft.recurrence, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ recurrence: e.target.value as RecurrenceMode }) }, React.createElement('option', { value: 'once' }, '一次'), React.createElement('option', { value: 'daily' }, '每天'), React.createElement('option', { value: 'weekday' }, '工作日'), React.createElement('option', { value: 'weekly' }, '每周'), React.createElement('option', { value: 'monthly' }, '每月'))),
      isRecurring && draft.recurrence === 'weekly' ? React.createElement('label', { className: 'moyu-st-setting' }, React.createElement('span', null, '开启'), React.createElement('select', { value: String(draft.weekday), onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ weekday: Number(e.target.value) }) }, ...WEEKDAY_OPTIONS.map((w) => React.createElement('option', { key: w.value, value: String(w.value) }, w.label)))) : null,
      isRecurring && draft.recurrence === 'monthly' ? React.createElement('label', { className: 'moyu-st-setting' }, React.createElement('span', null, '日期'), React.createElement('select', { value: String(draft.dayOfMonth), onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dayOfMonth: Number(e.target.value) }) }, ...Array.from({ length: 31 }, (_, i) => React.createElement('option', { key: i + 1, value: String(i + 1) }, `${i + 1} 日`)))) : null,
      React.createElement('label', { className: 'moyu-st-setting' }, React.createElement('span', null, isRecurring ? '时间' : '执行时间'), React.createElement('input', { type: isRecurring ? 'time' : 'datetime-local', value: isRecurring ? draft.timeOfDay : draft.runAtLocal, onChange: (e: React.ChangeEvent<HTMLInputElement>) => isRecurring ? set({ timeOfDay: e.target.value }) : set({ runAtLocal: e.target.value }) })),
      isRecurring ? React.createElement('label', { className: 'moyu-st-setting' }, React.createElement('span', null, '时区'), React.createElement('select', { value: draft.timeZone, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ timeZone: e.target.value }) }, ...tzOptions.map((z) => React.createElement('option', { key: z, value: z }, z)))) : null,
      React.createElement('label', { className: 'moyu-st-setting' }, React.createElement('span', null, '通知'), React.createElement('select', { value: draft.enabled ? 'enabled' : 'disabled', onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ enabled: e.target.value === 'enabled' }) }, React.createElement('option', { value: 'enabled' }, '所有运行'), React.createElement('option', { value: 'disabled' }, '暂停任务'))),
    ),
    isRecurring ? React.createElement('div', { style: { margin: '10px 4px', color: '#85898f', fontSize: 12 } }, `下次运行：${nextRun ? fmtTime(nextRun) : '时间无效'}`) : null,
    React.createElement('div', { className: 'moyu-st-drawer-footer' }, React.createElement('button', { style: { display: 'none' }, onClick: () => props.onSave(draft) }, '保存'), React.createElement('button', { className: 'moyu-st-secondary', onClick: () => props.onRunNow(draft) }, '保存并立即运行'), React.createElement('button', { className: 'moyu-st-primary', disabled: !draft.title.trim() || !draft.prompt.trim() || !draft.workspaceId, onClick: () => props.onSave(draft) }, isEdit ? '保存更改' : '创建')),
  )
}

function ScheduledNotifications(props: {
  tasks: TaskSummary[]
  onOpen: (id: string) => void
  onMarkAll: () => void
}): React.ReactElement | null {
  const notices = props.tasks.filter((t) => t.unreadCount > 0)
  if (notices.length === 0) return null
  const total = notices.reduce((a, t) => a + t.unreadCount, 0)
  return React.createElement(
    'div',
    { className: 'moyu-st-notice' },
    React.createElement(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 } },
      React.createElement('strong', null, `通知：${total} 条未读运行结果`),
      btn('全部标已读', props.onMarkAll),
    ),
    ...notices.map((t) =>
      React.createElement(
        'div',
        { key: t.id, className: 'moyu-st-notice-item' },
        React.createElement(
          'button',
          {
            className: 'moyu-st-btn',
            style: { border: 'none', background: 'transparent', padding: 0, textAlign: 'left', color: 'var(--fg, #111)' },
            onClick: () => props.onOpen(t.id),
          },
          `「${t.title}」${t.unreadCount} 条未读`,
        ),
      ),
    ),
  )
}

function readActivePreset(): string {
  if (typeof window === 'undefined') return 'moyu'
  const value = (window as unknown as { __moyuActivePreset?: unknown }).__moyuActivePreset
  return typeof value === 'string' && value.trim() ? value.trim() : 'moyu'
}

function ScheduledTasksPanel(props: {
  request: (payload: Record<string, unknown>, signal?: AbortSignal) => Promise<any>
  openSession: (id: string) => void
  getCurrentSessionId?: () => string | undefined
}): React.ReactElement {
  const [tasks, setTasks] = React.useState<TaskSummary[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [workspaces, setWorkspaces] = React.useState<WorkspaceSummary[]>([])
  const [editing, setEditing] = React.useState<{ taskId?: string; draft: Draft } | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = React.useState<Record<string, any> | null>(null)
  const [openMenu, setOpenMenu] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<'all' | 'enabled' | 'paused' | 'completed'>('all')
  const [runs, setRuns] = React.useState<RunSummary[] | null>(null)
  const [runsError, setRunsError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState('')
  const [activePreset, setActivePreset] = React.useState(readActivePreset)
  const pollRef = React.useRef<{ cancel: () => void } | null>(null)

  const reload = React.useCallback(async () => {
    try {
      const v = await props.request({ operation: 'list' })
      setTasks((v && v.tasks) || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [props.request])

  const loadWorkspaces = React.useCallback(async () => {
    try {
      const v = await props.request({ operation: 'workspaces' })
      setWorkspaces((v && v.workspaces) || [])
    } catch {
      setWorkspaces([])
    }
  }, [props.request])

  const loadRuns = React.useCallback(
    (taskId: string) => {
      if (pollRef.current) pollRef.current.cancel()
      let cancelled = false
      const ac = new AbortController()
      pollRef.current = {
        cancel: () => {
          cancelled = true
          ac.abort()
        },
      }
      const tick = async () => {
        try {
          const v = await props.request({ operation: 'runs', taskId }, ac.signal)
          if (cancelled) return
          const list: RunSummary[] = (v && v.runs) || []
          setRuns(list)
          setRunsError(null)
          if (list.some((r) => r.status === 'running')) {
            setTimeout(tick, 2000)
          }
        } catch (e) {
          if (!cancelled) setRunsError(e instanceof Error ? e.message : String(e))
        }
      }
      tick()
    },
    [props.request],
  )

  React.useEffect(() => {
    void reload()
    void loadWorkspaces()
  }, [reload, loadWorkspaces])

  React.useEffect(() => {
    const onPreset = () => setActivePreset(readActivePreset())
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
    window.addEventListener('moyu-preset-changed', onPreset)
    return () => window.removeEventListener('moyu-preset-changed', onPreset)
  }, [])

  React.useEffect(() => {
    if (!selected) {
      setRuns(null)
      setSelectedDetail(null)
      return
    }
    loadRuns(selected)
    void props.request({ operation: 'detail', taskId: selected })
      .then((value) => setSelectedDetail((value && value.detail) || null))
      .catch((e) => setRunsError(e instanceof Error ? e.message : String(e)))
    return () => {
      if (pollRef.current) pollRef.current.cancel()
    }
  }, [selected, loadRuns])

  const runTask = React.useCallback(
    async (taskId: string) => {
      try {
        await props.request({ operation: 'run', taskId })
        if (selected === taskId) loadRuns(taskId)
        else await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [props.request, selected, loadRuns, reload],
  )

  const cancelTask = React.useCallback(
    async (taskId: string) => {
      try {
        await props.request({ operation: 'cancel', taskId })
        if (selected === taskId) loadRuns(taskId)
        else await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [props.request, selected, loadRuns, reload],
  )

  const togglePause = React.useCallback(
    async (taskId: string, enabled: boolean) => {
      try {
        await props.request({ operation: 'set-enabled', taskId, enabled: !enabled })
        await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [props.request, reload],
  )

  const doDelete = React.useCallback(
    async (taskId: string) => {
      setConfirmDelete(null)
      try {
        await props.request({ operation: 'delete', taskId })
        if (selected === taskId) setSelected(null)
        await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [props.request, selected, reload],
  )

  const openEditor = React.useCallback(
    async (taskId?: string) => {
      try {
        if (taskId) {
          const v = await props.request({ operation: 'detail', taskId })
          const detail = (v && v.detail) || {}
          const s = detail.schedule
          const isOnce = !s || s.kind === 'once'
          setEditing({
            taskId,
            draft: {
              taskId,
              title: detail.title || '',
              prompt: detail.prompt || '',
              workspaceId: detail.workspaceId || '',
              recurrence: isOnce ? 'once' : s.pattern,
              runAtLocal: isOnce && s ? msToDatetimeLocal(s.runAt) : '',
              timeOfDay: !isOnce ? s.timeOfDay : '09:00',
              weekday: !isOnce && s.weekday != null ? s.weekday : 1,
              dayOfMonth: !isOnce && s.dayOfMonth != null ? s.dayOfMonth : 1,
              timeZone: !isOnce ? s.timeZone : detectTimeZone(),
              enabled: Boolean(detail.enabled),
              runMode: detail.runMode === 'continuation' ? 'continuation' : 'standalone',
            },
          })
        } else {
          setEditing({
            draft: {
              title: '', prompt: '', workspaceId: '',
              recurrence: 'once', runAtLocal: '', timeOfDay: '09:00', weekday: 1, dayOfMonth: 1,
              timeZone: detectTimeZone(), enabled: true, runMode: 'standalone',
            },
          })
        }
        if (workspaces.length === 0) void loadWorkspaces()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [props.request, workspaces.length, loadWorkspaces],
  )

  const saveEditor = React.useCallback(
    async (d: Draft, runNow: boolean) => {
      const isRecurring = d.recurrence !== 'once'
      let schedule: ScheduleSpec | undefined
      let runAt: number | null = null
      if (d.recurrence !== 'once') {
        if (!HHMM.test(d.timeOfDay)) {
          setError('请填写有效的时间（HH:mm）')
          return
        }
        const spec: {
          kind: 'recurring'
          pattern: RecurrencePattern
          timeOfDay: string
          timeZone: string
          weekday?: number
          dayOfMonth?: number
        } = { kind: 'recurring', pattern: d.recurrence, timeOfDay: d.timeOfDay, timeZone: d.timeZone }
        if (d.recurrence === 'weekly') spec.weekday = d.weekday
        if (d.recurrence === 'monthly') spec.dayOfMonth = d.dayOfMonth
        schedule = spec
      } else {
        runAt = datetimeLocalToMs(d.runAtLocal)
        if (runAt != null && !Number.isFinite(runAt)) {
          setError('执行时间无效')
          return
        }
      }
      if (!d.title.trim()) {
        setError('请填写任务名称')
        return
      }
      if (!d.prompt.trim()) {
        setError('请填写任务内容')
        return
      }
      if (!d.workspaceId) {
        setError('请选择工作区')
        return
      }
      if (!isRecurring && !runNow && runAt == null) {
        setError('请选择执行时间，或使用“保存并立即运行”')
        return
      }
      const taskId = editing?.taskId
      const activePreset = readActivePreset()
      const currentSessionId = props.getCurrentSessionId?.()
      const body: Record<string, unknown> = {
        operation: taskId ? 'update' : 'create',
        title: d.title,
        prompt: d.prompt,
        workspaceId: d.workspaceId,
        enabled: d.enabled,
        preset: activePreset,
        runMode: d.runMode,
      }
      if (d.runMode === 'continuation') {
        if (currentSessionId) body.continuationSessionId = currentSessionId
        else if (!taskId) {
          setError('续写会话需要当前打开的对话')
          return
        }
      }
      if (taskId) body.taskId = taskId
      if (isRecurring && schedule) body.schedule = schedule
      else if (runAt != null) body.runAt = runAt
      try {
        const v = await props.request(body)
        if (runNow) {
          const rid = taskId || (v && v.taskId)
          if (rid) await props.request({ operation: 'run', taskId: rid })
        }
        setEditing(null)
        if (selected && (taskId === selected)) loadRuns(selected)
        else await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [props.request, editing, selected, loadRuns, reload, props.getCurrentSessionId],
  )

  const openRun = React.useCallback(
    (sessionId: string | null) => {
      if (!sessionId) return
      try {
        props.openSession(sessionId)
        setSessionError(null)
      } catch (e) {
        setSessionError(e instanceof Error ? e.message : String(e))
      }
    },
    [props.openSession],
  )

  const markAllRead = React.useCallback(async () => {
    try {
      await props.request({ operation: 'mark-all-read' })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [props.request, reload])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleTasks = (tasks || []).filter((t) => {
    if (taskPresetOf(t) !== activePreset) return false
    if (normalizedQuery !== '' && !t.title.toLocaleLowerCase().includes(normalizedQuery)) return false
    if (filter === 'enabled' && (!t.enabled || t.lastRunStatus === 'succeeded' && !t.nextRunAt)) return false
    if (filter === 'paused' && t.enabled) return false
    if (filter === 'completed' && (t.nextRunAt || t.running || t.lastRunStatus !== 'succeeded')) return false
    return true
  })
  const rows = visibleTasks.map((t) => {
    return React.createElement(
      'li',
      { key: t.id, className: 'moyu-st-row', 'data-selected': selected === t.id, onClick: () => { setSelected(t.id); setEditing(null); setOpenMenu(null) } },
      React.createElement('span', { className: 'moyu-st-state-dot', 'data-running': t.running }),
      React.createElement('div', { className: 'moyu-st-row-copy' }, React.createElement('div', { className: 'moyu-st-row-title' }, t.title), React.createElement('div', { className: 'moyu-st-row-meta' }, `${describeSchedule(t.schedule)}${t.nextRunAt ? ` · 下次运行 ${fmtTime(t.nextRunAt)}` : ''}`)),
      React.createElement('button', { className: 'moyu-st-more', 'data-open': openMenu === t.id, 'aria-label': `${t.title}更多操作`, onClick: (e: React.MouseEvent) => { e.stopPropagation(); setOpenMenu(openMenu === t.id ? null : t.id) } }, '•••'),
      React.createElement('div', { className: 'moyu-st-menu', 'data-visible': openMenu === t.id, onClick: (e: React.MouseEvent) => e.stopPropagation() },
        React.createElement('button', { disabled: t.running, onClick: () => { setOpenMenu(null); void runTask(t.id) } }, '▷　立即运行'),
        t.running ? React.createElement('button', { onClick: () => { setOpenMenu(null); void cancelTask(t.id) } }, '□　取消运行') : null,
        React.createElement('button', { onClick: () => { setOpenMenu(null); void togglePause(t.id, t.enabled) } }, t.enabled ? 'Ⅱ　暂停' : '▷　恢复'),
        React.createElement('button', { onClick: () => { setOpenMenu(null); setEditing(null); setSelected(t.id) } }, '运行历史'),
        React.createElement('button', { 'data-danger': 'true', onClick: () => { setOpenMenu(null); setConfirmDelete(t.id) } }, '删除'),
      ),
    )
  })

  const selectedTask = (tasks || []).find((task) => task.id === selected) || null
  const hasDrawer = Boolean(editing || selectedTask)
  const suggestions = [
    ['＋', '每日简报', '工作日 8:00', '汇总项目进展和今天最需要关注的事项'],
    ['▣', '每周回顾', '星期五 16:00', '将最近的工作整理成简明的状态更新'],
    ['⌕', '跟进监控', '工作日 9:00', '检查项目变化，并标记需要你关注的事项'],
  ]

  return React.createElement(
    'main',
    { className: 'moyu-st-page', 'data-surface': 'scheduled' },
    React.createElement('style', null, STYLE),
    React.createElement('div', { className: 'moyu-st-main', 'data-drawer': hasDrawer }, React.createElement('div', { className: 'moyu-st-shell' },
      (tasks || []).length > 0 ? React.createElement('div', { className: 'moyu-st-toolbar' }, React.createElement('div', { className: 'moyu-st-tabs' }, ...([['all', '全部'], ['enabled', '已开启'], ['paused', '已暂停'], ['completed', '已完成']] as const).map(([value, label]) => React.createElement('button', { key: value, className: 'moyu-st-tab', 'data-active': filter === value, onClick: () => setFilter(value) }, label))), React.createElement('button', { className: 'moyu-st-primary', onClick: () => { setSelected(null); void openEditor() } }, '创建⌄')) : React.createElement(
        'div',
        { className: 'moyu-st-header' },
        React.createElement(
          'div',
          null,
          React.createElement('h1', { className: 'moyu-st-heading' }, '已安排的任务'),
          React.createElement('p', { className: 'moyu-st-subtitle' }, '让 MOYU 安排任务、设置提醒或监测更新'),
        ),
        React.createElement('button', { className: 'moyu-st-primary', onClick: () => { setSelected(null); void openEditor() } }, '创建⌄'),
      ),
      React.createElement('div', { className: 'moyu-st-search-wrap' }, React.createElement('span', { className: 'moyu-st-search-icon' }, '⌕'), React.createElement('input', { className: 'moyu-st-search', type: 'search', value: query, placeholder: '搜索已安排任务', 'aria-label': '搜索已安排任务', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value) })),
      error ? React.createElement('div', { className: 'moyu-st-err', style: { marginTop: 16 } }, error) : null,
      sessionError
        ? React.createElement('div', { className: 'moyu-st-err', style: { marginTop: 16 } }, `打开对话失败：${sessionError}`)
        : null,
      React.createElement(
        ScheduledNotifications,
        { tasks: visibleTasks, onOpen: (id: string) => setSelected(selected === id ? null : id), onMarkAll: () => void markAllRead() },
      ),
      tasks == null
        ? React.createElement('div', { className: 'moyu-st-empty' }, '加载中…')
        : visibleTasks.length === 0 && (tasks || []).length > 0
          ? React.createElement('div', { className: 'moyu-st-empty', 'data-preset-empty': activePreset }, '当前工作台没有安排任务')
        : tasks.length === 0
          ? React.createElement(React.Fragment, null, React.createElement('div', { className: 'moyu-st-section-title' }, '建议'), React.createElement('ul', { className: 'moyu-st-suggestions' }, ...suggestions.map(([icon, title, time, desc]) => React.createElement('li', { key: title, className: 'moyu-st-suggestion', onClick: () => void openEditor() }, React.createElement('span', { className: 'moyu-st-suggestion-icon' }, icon), React.createElement('div', null, React.createElement('div', { className: 'moyu-st-suggestion-title' }, title, React.createElement('span', { className: 'moyu-st-suggestion-time' }, time)), React.createElement('div', { className: 'moyu-st-suggestion-desc' }, desc))))))
          : rows.length === 0
            ? React.createElement('div', { className: 'moyu-st-empty' }, '没有匹配的任务')
            : React.createElement('ul', { className: 'moyu-st-list' }, ...rows),
    )),
    confirmDelete
      ? React.createElement(
          'div',
          { style: overlayStyle },
          React.createElement(
          'div', { className: 'moyu-st-confirm' },
            React.createElement('h2', null, `删除 ${tasks?.find((t) => t.id === confirmDelete)?.title || '已安排任务'}？`),
            React.createElement('p', null, '这将永久删除已安排的任务，并停止今后的运行'),
            React.createElement('div', { className: 'moyu-st-confirm-actions' }, React.createElement('button', { className: 'moyu-st-secondary', onClick: () => setConfirmDelete(null) }, '取消'), React.createElement('button', { className: 'moyu-st-delete', onClick: () => void doDelete(confirmDelete) }, '删除')),
          ),
        )
      : null,
    editing
      ? React.createElement(EditorModal, {
          initial: editing.draft,
          workspaces,
          onSave: (d: Draft) => void saveEditor(d, false),
          onRunNow: (d: Draft) => void saveEditor(d, true),
          onCancel: () => setEditing(null),
      })
      : null,
    !editing && selectedTask ? React.createElement('aside', { className: 'moyu-st-drawer', 'aria-label': '任务详情' },
      React.createElement('div', { className: 'moyu-st-drawer-head' }, React.createElement('span', { className: 'moyu-st-status' }, taskStateLabel(selectedTask)), React.createElement('button', { className: 'moyu-st-close', onClick: () => setSelected(null), 'aria-label': '关闭' }, '×')),
      React.createElement('h2', { className: 'moyu-st-drawer-title' }, selectedTask.title),
      React.createElement('div', { className: 'moyu-st-detail-prompt' }, selectedDetail?.prompt || '加载任务内容…'),
      React.createElement('div', { className: 'moyu-st-field-label' }, '详情'),
      React.createElement('div', { className: 'moyu-st-card' },
        React.createElement('div', { className: 'moyu-st-setting' }, React.createElement('span', null, '运行于'), React.createElement('div', { style: { textAlign: 'right' } }, selectedTask.runMode === 'continuation' ? '续写当前会话' : '每次新建会话')),
        React.createElement('div', { className: 'moyu-st-setting' }, React.createElement('span', null, '项目'), React.createElement('div', { style: { textAlign: 'right' } }, workspaces.find((w) => w.id === selectedDetail?.workspaceId)?.title || '—')),
      ),
      React.createElement('div', { className: 'moyu-st-field-label' }, '频率'),
      React.createElement('div', { className: 'moyu-st-card' }, React.createElement('div', { className: 'moyu-st-setting' }, React.createElement('span', null, '重复'), React.createElement('div', { style: { textAlign: 'right' } }, describeSchedule(selectedTask.schedule))), React.createElement('div', { className: 'moyu-st-setting' }, React.createElement('span', null, '通知'), React.createElement('div', { style: { textAlign: 'right' } }, selectedTask.enabled ? '所有运行' : '已暂停'))),
      React.createElement('div', { className: 'moyu-st-field-label' }, '运行记录'),
      runsError ? React.createElement('div', { className: 'moyu-st-err' }, runsError) : runs == null ? React.createElement('div', { className: 'moyu-st-empty' }, '加载运行记录…') : runs.length === 0 ? React.createElement('div', { className: 'moyu-st-empty' }, '暂无运行记录') : React.createElement('ul', { className: 'moyu-st-list' }, ...runs.map((r) => React.createElement('li', { key: r.runId, style: { marginBottom: 10, fontSize: 13 } }, React.createElement('span', { className: runStatusClass(r.status) }, `${fmtTime(r.startedAt)} · ${runStatusText(r.status)}`), ' ', btn('打开对话', () => openRun(r.sessionId), { disabled: !r.sessionId })))),
      React.createElement('div', { className: 'moyu-st-drawer-footer' }, React.createElement('button', { className: 'moyu-st-secondary', onClick: () => void openEditor(selectedTask.id) }, '编辑'), React.createElement('button', { className: 'moyu-st-primary', disabled: selectedTask.running, onClick: () => void runTask(selectedTask.id) }, '立即运行')),
    ) : null,
  )
}

export const name = 'moyu-scheduled-tasks-client'

export const inject = ['slots', 'sessions'] as const

export function apply(ctx: ClientContext): void {
  const request = async (payload: Record<string, unknown>, signal?: AbortSignal): Promise<any> => {
    const response = await fetch('/moyu/scheduled-tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
    const value = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error((value && value.error) || `请求失败：HTTP ${response.status}`)
    return value
  }
  const openSession = (id: string) => {
    ctx.sessions.open(id as SessionId)
  }
  ctx.slots.inject('surface.scheduled', () =>
    ctx.slots.register(
      {
        name: 'surface.scheduled',
        inject: () => ({}),
      },
      () => React.createElement(ScheduledTasksPanel, {
        request,
        openSession,
        getCurrentSessionId: () =>
          (ctx.sessions as { list?: { getSnapshot?: () => { current?: string } } }).list?.getSnapshot?.()?.current,
      }),
    ),
  )
}
