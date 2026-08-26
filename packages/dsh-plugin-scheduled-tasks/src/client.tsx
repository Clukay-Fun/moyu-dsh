import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import React from 'react'

// ---- Shared DTOs (mirror the Host side, no cwd/prompt leakage) ----
export interface TaskSummary {
  id: string
  title: string
  enabled: boolean
  nextRunAt: number | null
  lastRunAt: number | null
  lastRunStatus: 'succeeded' | 'failed' | 'interrupted' | null
  unreadCount: number
  running: boolean
}

export interface RunSummary {
  runId: string
  taskId: string
  status: 'running' | 'succeeded' | 'failed' | 'interrupted'
  startedAt: number
  finishedAt: number | null
  sessionId: string | null
  unread: boolean
}

export interface WorkspaceSummary {
  id: string
  title: string
}

interface Draft {
  taskId?: string
  title: string
  prompt: string
  workspaceId: string
  runAtLocal: string
  enabled: boolean
}

const PLUGIN_ID = 'scheduled-tasks' as const

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

function datetimeLocalToMs(value: string): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
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
        '执行时间',
        React.createElement('input', {
          type: 'datetime-local',
          value: draft.runAtLocal,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ runAtLocal: e.target.value }),
          style: inputStyle,
        }),
      ),
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
        React.createElement('button', { onClick: () => props.onSave(draft) }, '保存'),
        React.createElement('button', { onClick: () => props.onRunNow(draft) }, '保存并立即运行'),
        React.createElement('button', { onClick: props.onCancel }, '取消'),
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
          setEditing({
            taskId,
            draft: {
              taskId,
              title: detail.title || '',
              prompt: detail.prompt || '',
              workspaceId: detail.workspaceId || '',
              runAtLocal: '',
              enabled: Boolean(detail.enabled),
            },
          })
        } else {
          setEditing({
            draft: { title: '', prompt: '', workspaceId: '', runAtLocal: '', enabled: true },
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
      const runAt = datetimeLocalToMs(d.runAtLocal)
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
      if (runAt != null && !Number.isFinite(runAt)) {
        setError('执行时间无效')
        return
      }
      if (!runNow && runAt == null) {
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
      if (runAt != null) body.runAt = runAt
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

  const rows = (tasks || []).map((t) => {
    const actions: React.ReactNode[] = [
      React.createElement('button', { key: 'run', onClick: () => void runTask(t.id) }, '立即运行'),
      React.createElement('button', { key: 'edit', onClick: () => void openEditor(t.id) }, '编辑'),
      React.createElement(
        'button',
        { key: 'pause', onClick: () => void togglePause(t.id, t.enabled) },
        t.enabled && t.nextRunAt ? '暂停' : '恢复',
      ),
      React.createElement('button', { key: 'del', onClick: () => setConfirmDelete(t.id) }, '删除'),
      React.createElement(
        'button',
        { key: 'expand', onClick: () => setSelected(selected === t.id ? null : t.id) },
        selected === t.id ? '收起运行' : '运行历史',
      ),
    ]
    return React.createElement(
      'li',
      { key: t.id, style: { padding: '8px 0', borderBottom: '1px solid var(--border, #eee)' } },
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', gap: 8 } },
        React.createElement('strong', null, t.title),
        React.createElement('span', { style: { fontSize: 12, opacity: 0.7 } }, taskStateLabel(t)),
      ),
      React.createElement(
        'div',
        { style: { fontSize: 12, opacity: 0.7, marginTop: 2 } },
        `下次：${fmtTime(t.nextRunAt)}　上次：${fmtTime(t.lastRunAt)}` +
          (t.lastRunStatus ? `（${t.lastRunStatus}）` : '') +
          (t.unreadCount > 0 ? `　未读：${t.unreadCount}` : ''),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' } }, ...actions),
      selected === t.id
        ? React.createElement(
            'div',
            { style: { marginTop: 8 } },
            runsError
              ? React.createElement('div', { style: { color: 'var(--danger, #c00)' } }, runsError)
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
                          `${fmtTime(r.startedAt)} · ${r.status}　`,
                          r.unread ? '（未读）' : '',
                          ' ',
                          React.createElement(
                            'button',
                            { onClick: () => openRun(r.sessionId), disabled: !r.sessionId },
                            '打开对话',
                          ),
                          r.unread
                            ? ' '
                            : '',
                          r.unread
                            ? React.createElement(
                                'button',
                                {
                                  onClick: () => void props.request({ operation: 'mark-run-read', runId: r.runId }).then(() => loadRuns(t.id)),
                                },
                                '标记已读',
                              )
                            : '',
                        ),
                      ),
                    ),
          )
        : null,
    )
  })

  return React.createElement(
    'div',
    { style: { padding: 12, maxWidth: 560 } },
    React.createElement(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement('h3', { style: { margin: 0 } }, '安排任务'),
      React.createElement('button', { onClick: () => void openEditor() }, '新建任务'),
    ),
    error ? React.createElement('div', { style: { color: 'var(--danger, #c00)', marginTop: 8 } }, error) : null,
    sessionError
      ? React.createElement('div', { style: { color: 'var(--danger, #c00)', marginTop: 8 } }, `打开对话失败：${sessionError}`)
      : null,
    tasks == null
      ? React.createElement('div', { style: { marginTop: 12, opacity: 0.6 } }, '加载中…')
      : tasks.length === 0
        ? React.createElement('div', { style: { marginTop: 12, opacity: 0.6 } }, '暂无任务')
        : React.createElement('ul', { style: { listStyle: 'none', margin: '12px 0 0', padding: 0 } }, ...rows),
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
              React.createElement('button', { onClick: () => void doDelete(confirmDelete) }, '删除'),
              React.createElement('button', { onClick: () => setConfirmDelete(null) }, '取消'),
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
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: PLUGIN_ID,
        order: 50,
        label: () => '安排任务',
        inject: () => ({}),
      },
      (props: ConvViewProps) => React.createElement(ScheduledTasksPanel, { request, openSession }),
    ),
  )
}
