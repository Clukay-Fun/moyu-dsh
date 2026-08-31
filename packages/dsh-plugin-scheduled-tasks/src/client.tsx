import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import React from 'react'
import { computeNextRun, describeSchedule } from './schedule'
import type { ScheduleSpec, RecurrencePattern } from './schedule'

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
.moyu-st-page { box-sizing: border-box; width: 100%; min-height: 100%; color: var(--dsw-alias-label-primary, var(--fg, #111)); background: var(--dsw-alias-bg-base, var(--bg, #fff)); overflow: auto; }
.moyu-st-shell { box-sizing: border-box; width: min(100%, 1040px); margin: 0 auto; padding: 56px 40px 72px; }
.moyu-st-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.moyu-st-heading { margin: 0; font-size: 30px; font-weight: 560; line-height: 1.25; letter-spacing: -0.02em; }
.moyu-st-subtitle { margin: 8px 0 0; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 14px; line-height: 22px; }
.moyu-st-search { box-sizing: border-box; width: 100%; height: 40px; margin-top: 28px; padding: 0 14px; color: inherit; background: transparent; border: 1px solid var(--dsw-alias-border-l2, var(--border, #ccd)); border-radius: 20px; font: inherit; outline: none; }
.moyu-st-search:focus { border-color: var(--dsw-alias-state-business-primary, var(--accent, #3b82f6)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary, #3b82f6) 18%, transparent); }
.moyu-st-list { list-style: none; margin: 28px 0 0; padding: 0; }
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
@media (max-width: 720px) { .moyu-st-shell { padding: 32px 20px 48px; } .moyu-st-heading { font-size: 26px; } .moyu-st-header { gap: 16px; } }
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
    'div',
    { style: overlayStyle },
    React.createElement(
      'div',
      { style: modalStyle },
      React.createElement('h4', { style: { margin: '0 0 12px' } }, isEdit ? '编辑任务' : '新建任务'),
      field(
        '任务名称',
        React.createElement('input', {
          value: draft.title, maxLength: 80,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ title: e.target.value }),
          style: inputStyle,
        }),
      ),
      field(
        '任务内容',
        React.createElement('textarea', {
          value: draft.prompt, maxLength: 20000,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => set({ prompt: e.target.value }),
          style: { ...inputStyle, height: 120, resize: 'vertical' },
        }),
      ),
      field(
        '工作区',
        React.createElement(
          'select',
          {
            value: draft.workspaceId,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ workspaceId: e.target.value }),
            style: inputStyle,
          },
          React.createElement('option', { value: '' }, '— 选择工作区 —'),
          ...props.workspaces.map((w) =>
            React.createElement('option', { key: w.id, value: w.id }, w.title),
          ),
        ),
      ),
      field(
        '重复',
        React.createElement(
          'select',
          {
            value: draft.recurrence,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ recurrence: e.target.value as RecurrenceMode }),
            style: inputStyle,
          },
          React.createElement('option', { value: 'once' }, '一次性'),
          React.createElement('option', { value: 'daily' }, '每天'),
          React.createElement('option', { value: 'weekday' }, '工作日'),
          React.createElement('option', { value: 'weekly' }, '每周'),
          React.createElement('option', { value: 'monthly' }, '每月'),
        ),
      ),
      isRecurring
        ? field(
            '时间',
            React.createElement('input', {
              type: 'time',
              value: draft.timeOfDay,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ timeOfDay: e.target.value }),
              style: inputStyle,
            }),
          )
        : field(
            '执行时间',
            React.createElement('input', {
              type: 'datetime-local',
              value: draft.runAtLocal,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ runAtLocal: e.target.value }),
              style: inputStyle,
            }),
          ),
      isRecurring && draft.recurrence === 'weekly'
        ? field(
            '星期',
            React.createElement(
              'select',
              {
                value: String(draft.weekday),
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ weekday: Number(e.target.value) }),
                style: inputStyle,
              },
              ...WEEKDAY_OPTIONS.map((w) =>
                React.createElement('option', { key: w.value, value: String(w.value) }, w.label),
              ),
            ),
          )
        : null,
      isRecurring && draft.recurrence === 'monthly'
        ? field(
            '日期',
            React.createElement(
              'select',
              {
                value: String(draft.dayOfMonth),
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ dayOfMonth: Number(e.target.value) }),
                style: inputStyle,
              },
              ...Array.from({ length: 31 }, (_, i) =>
                React.createElement('option', { key: i + 1, value: String(i + 1) }, `${i + 1} 日`),
              ),
            ),
          )
        : null,
      isRecurring
        ? field(
            '时区',
            React.createElement(
              'select',
              {
                value: draft.timeZone,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => set({ timeZone: e.target.value }),
                style: inputStyle,
              },
              ...tzOptions.map((z) => React.createElement('option', { key: z, value: z }, z)),
            ),
          )
        : null,
      isRecurring
        ? React.createElement(
            'div',
            { style: { fontSize: 12, opacity: 0.7, margin: '4px 0 8px' } },
            `下次运行：${nextRun ? fmtTime(nextRun) : '时间无效'}${nextRun && previewSpec ? `（${tzOf(previewSpec)}）` : ''}`,
          )
        : null,
      React.createElement(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: draft.enabled,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ enabled: e.target.checked }),
        }),
        '启用（到点自动执行）',
      ),
      React.createElement(
        'div',
        { style: { marginTop: 12, display: 'flex', gap: 8 } },
        btn('保存', () => props.onSave(draft)),
        btn('保存并立即运行', () => props.onRunNow(draft)),
        btn('取消', () => props.onCancel()),
      ),
    ),
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

function ScheduledTasksPanel(props: {
  request: (payload: Record<string, unknown>, signal?: AbortSignal) => Promise<any>
  openSession: (id: string) => void
}): React.ReactElement {
  const [tasks, setTasks] = React.useState<TaskSummary[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [workspaces, setWorkspaces] = React.useState<WorkspaceSummary[]>([])
  const [editing, setEditing] = React.useState<{ taskId?: string; draft: Draft } | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [runs, setRuns] = React.useState<RunSummary[] | null>(null)
  const [runsError, setRunsError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState('')
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
    if (!selected) {
      setRuns(null)
      return
    }
    loadRuns(selected)
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
            },
          })
        } else {
          setEditing({
            draft: {
              title: '', prompt: '', workspaceId: '',
              recurrence: 'once', runAtLocal: '', timeOfDay: '09:00', weekday: 1, dayOfMonth: 1,
              timeZone: detectTimeZone(), enabled: true,
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
      const body: Record<string, unknown> = {
        operation: taskId ? 'update' : 'create',
        title: d.title,
        prompt: d.prompt,
        workspaceId: d.workspaceId,
        enabled: d.enabled,
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
    [props.request, editing, selected, loadRuns, reload],
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
  const visibleTasks = (tasks || []).filter((t) =>
    normalizedQuery === '' || t.title.toLocaleLowerCase().includes(normalizedQuery),
  )
  const rows = visibleTasks.map((t) => {
    const actions: React.ReactNode[] = [
      btn('立即运行', () => void runTask(t.id), { disabled: t.running }),
      btn('编辑', () => void openEditor(t.id)),
      btn(t.enabled && t.nextRunAt ? '暂停' : '恢复', () => void togglePause(t.id, t.enabled)),
      btn('删除', () => setConfirmDelete(t.id), { danger: true }),
      btn(selected === t.id ? '收起运行' : '运行历史', () => setSelected(selected === t.id ? null : t.id)),
    ]
    return React.createElement(
      'li',
      { key: t.id, style: { padding: '8px 0', borderBottom: '1px solid var(--border, #eee)' } },
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', gap: 8 } },
        React.createElement('strong', { className: 'moyu-st-title' }, t.title),
        React.createElement('span', { style: { fontSize: 12, opacity: 0.7, whiteSpace: 'nowrap' } }, taskStateLabel(t)),
      ),
      React.createElement(
        'div',
        { style: { fontSize: 12, opacity: 0.7, marginTop: 2 } },
        `计划：${describeSchedule(t.schedule)}　下次：${fmtTime(t.nextRunAt)}（${tzOf(t.schedule)}）　上次：${fmtTime(t.lastRunAt)}` +
          (t.lastRunStatus ? `（${t.lastRunStatus}）` : '') +
          (t.unreadCount > 0 ? `　未读：${t.unreadCount}` : ''),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' } }, ...actions),
      selected === t.id
        ? React.createElement(
            'div',
            { style: { marginTop: 8 } },
            runsError
              ? React.createElement('div', { className: 'moyu-st-err' }, runsError)
              : runs == null
                ? React.createElement('div', { style: { fontSize: 12, opacity: 0.6 } }, '加载运行记录…')
                : runs.length === 0
                  ? React.createElement('div', { style: { fontSize: 12, opacity: 0.6 } }, '暂无运行记录')
                  : React.createElement(
                      'ul',
                      { style: { margin: 0, paddingLeft: 16 } },
                      ...runs.map((r) =>
                        React.createElement(
                          'li',
                          { key: r.runId, style: { fontSize: 12, margin: '4px 0' } },
                          React.createElement('span', { className: runStatusClass(r.status) }, `${fmtTime(r.startedAt)} · ${runStatusText(r.status)}`),
                          r.unread ? '（未读）' : '',
                          ' ',
                          btn('打开对话', () => openRun(r.sessionId), { disabled: !r.sessionId }),
                          (r.status === 'failed' || r.status === 'interrupted' || r.status === 'missed')
                            ? btn('重新运行', () => void runTask(t.id))
                            : '',
                          r.unread
                            ? btn('标记已读', () =>
                                void props
                                  .request({ operation: 'mark-run-read', runId: r.runId })
                                  .then(() => loadRuns(t.id)),
                              )
                            : '',
                          r.errorMessage
                            ? React.createElement('div', { className: 'moyu-st-err', style: { marginTop: 2 } }, r.errorMessage)
                            : '',
                        ),
                      ),
                    ),
          )
        : null,
    )
  })

  return React.createElement(
    'main',
    { className: 'moyu-st-page', 'data-surface': 'scheduled' },
    React.createElement('style', null, STYLE),
    React.createElement(
      'div',
      { className: 'moyu-st-shell' },
      React.createElement(
        'div',
        { className: 'moyu-st-header' },
        React.createElement(
          'div',
          null,
          React.createElement('h1', { className: 'moyu-st-heading' }, '已安排的任务'),
          React.createElement('p', { className: 'moyu-st-subtitle' }, '让 MOYU 定时执行任务、生成会话并汇报运行结果'),
        ),
        btn('创建', () => void openEditor()),
      ),
      React.createElement('input', {
        className: 'moyu-st-search',
        type: 'search',
        value: query,
        placeholder: '搜索已安排任务',
        'aria-label': '搜索已安排任务',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
      }),
      error ? React.createElement('div', { className: 'moyu-st-err', style: { marginTop: 16 } }, error) : null,
      sessionError
        ? React.createElement('div', { className: 'moyu-st-err', style: { marginTop: 16 } }, `打开对话失败：${sessionError}`)
        : null,
      React.createElement(
        ScheduledNotifications,
        { tasks: tasks || [], onOpen: (id: string) => setSelected(selected === id ? null : id), onMarkAll: () => void markAllRead() },
      ),
      tasks == null
        ? React.createElement('div', { className: 'moyu-st-empty' }, '加载中…')
        : tasks.length === 0
          ? React.createElement('div', { className: 'moyu-st-empty' }, '暂无已安排任务')
          : rows.length === 0
            ? React.createElement('div', { className: 'moyu-st-empty' }, '没有匹配的任务')
            : React.createElement('ul', { className: 'moyu-st-list' }, ...rows),
    ),
    confirmDelete
      ? React.createElement(
          'div',
          { style: overlayStyle },
          React.createElement(
            'div',
            { style: modalStyle },
            React.createElement('p', null, '确定删除该任务？此操作不可撤销，且不会删除已生成的对话。'),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8, marginTop: 12 } },
              btn('删除', () => void doDelete(confirmDelete), { danger: true }),
              btn('取消', () => setConfirmDelete(null)),
            ),
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
      () => React.createElement(ScheduledTasksPanel, { request, openSession }),
    ),
  )
}
