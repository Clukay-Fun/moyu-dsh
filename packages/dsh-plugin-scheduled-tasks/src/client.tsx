import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation'
import React from 'react'

type TaskSummary = {
  id: string
  title: string
  workspaceId: string
  enabled: boolean
  nextRunAt: number | null
  lastRunAt: number | null
  lastRunStatus: string | null
  unreadCount: number
}

type RunSummary = {
  id: string
  taskId: string
  scheduledFor: number
  startedAt: number | null
  finishedAt: number | null
  status: string
  sessionId: string | null
  unread: boolean
  errorCode?: string
  errorMessage?: string
}

async function request(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch('/moyu/scheduled-tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error || `请求失败：HTTP ${response.status}`)
  return value
}

function fmtTime(ms: number | null): string {
  if (ms === null || ms === undefined) return '—'
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return '—'
  }
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const color =
    status === 'succeeded'
      ? '#2e7d32'
      : status === 'failed' || status === 'interrupted'
      ? '#c62828'
      : status === 'running'
      ? '#1565c0'
      : '#757575'
  return React.createElement(
    'span',
    {
      style: {
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 10,
        fontSize: 12,
        color: '#fff',
        background: color,
      },
    },
    status,
  )
}

function ScheduledTasksPanel(props: { openSession: (sessionId: string) => void }): React.ReactElement {
  const [tasks, setTasks] = React.useState<TaskSummary[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [runs, setRuns] = React.useState<RunSummary[] | null>(null)
  const [runsError, setRunsError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true
    setTasks(null)
    setError(null)
    request({ operation: 'list' })
      .then((v) => {
        if (alive) setTasks(Array.isArray(v.tasks) ? v.tasks : [])
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      alive = false
    }
  }, [])

  const openRuns = (taskId: string): void => {
    setSelected(taskId)
    setRuns(null)
    setRunsError(null)
    request({ operation: 'runs', taskId })
      .then((v) => setRuns(Array.isArray(v.runs) ? v.runs : []))
      .catch((e) => setRunsError(e instanceof Error ? e.message : String(e)))
  }

  const wrapStyle: React.CSSProperties = {
    padding: 16,
    height: '100%',
    overflow: 'auto',
    boxSizing: 'border-box',
  }
  const hStyle: React.CSSProperties = { margin: '0 0 12px', fontSize: 16 }

  let body: React.ReactElement
  if (error) {
    body = React.createElement(
      'div',
      { style: { color: '#c62828', padding: 12 } },
      `加载失败：${error}`,
    )
  } else if (tasks === null) {
    body = React.createElement('div', { style: { padding: 12, opacity: 0.7 } }, '加载中…')
  } else if (tasks.length === 0) {
    body = React.createElement(
      'div',
      { style: { padding: 12, opacity: 0.7 } },
      '还没有安排的任务。可用 Tool（moyu_schedule_create / moyu_schedule_run_now）创建。',
    )
  } else {
    body = React.createElement(
      'ul',
      { style: { listStyle: 'none', margin: 0, padding: 0 } },
      ...tasks.map((t) =>
        React.createElement(
          'li',
          {
            key: t.id,
            style: {
              border: '1px solid rgba(127,127,127,0.25)',
              borderRadius: 10,
              padding: 10,
              marginBottom: 8,
              cursor: 'pointer',
              background: selected === t.id ? 'rgba(127,127,127,0.12)' : 'transparent',
            },
            onClick: () => openRuns(t.id),
          },
          React.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', gap: 8 } },
            React.createElement('strong', null, t.title),
            React.createElement(StatusBadge, { status: t.lastRunStatus ?? 'none' }),
          ),
          React.createElement(
            'div',
            { style: { fontSize: 12, opacity: 0.7, marginTop: 4 } },
            `workspace: ${t.workspaceId} · ${t.enabled ? '已启用' : '已停用'} · 未读 ${t.unreadCount}`,
          ),
        ),
      ),
    )
  }

  let runsBlock: React.ReactElement | null = null
  if (selected) {
    let runsContent: React.ReactElement
    if (runsError) {
      runsContent = React.createElement('div', { style: { color: '#c62828', padding: 8 } }, `运行历史加载失败：${runsError}`)
    } else if (runs === null) {
      runsContent = React.createElement('div', { style: { padding: 8, opacity: 0.7 } }, '加载运行历史…')
    } else if (runs.length === 0) {
      runsContent = React.createElement('div', { style: { padding: 8, opacity: 0.7 } }, '暂无运行记录')
    } else {
      runsContent = React.createElement(
        'ul',
        { style: { listStyle: 'none', margin: 0, padding: 0 } },
        ...runs.map((r) =>
          React.createElement(
            'li',
            {
              key: r.id,
              style: {
                borderTop: '1px solid rgba(127,127,127,0.18)',
                padding: '8px 0',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                alignItems: 'center',
              },
            },
            React.createElement(
              'div',
              null,
              React.createElement(StatusBadge, { status: r.status }),
              React.createElement(
                'div',
                { style: { fontSize: 12, opacity: 0.7, marginTop: 4 } },
                `${fmtTime(r.startedAt)} → ${fmtTime(r.finishedAt)}`,
              ),
              r.errorCode
                ? React.createElement('div', { style: { fontSize: 12, color: '#c62828' } }, `${r.errorCode}: ${r.errorMessage ?? ''}`)
                : null,
            ),
            r.sessionId
              ? React.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: () => props.openSession(r.sessionId as string),
                    style: {
                      border: '1px solid rgba(127,127,127,0.4)',
                      borderRadius: 8,
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: '4px 10px',
                    },
                  },
                  '打开会话',
                )
              : null,
          ),
        ),
      )
    }
    runsBlock = React.createElement(
      'div',
      { style: { marginTop: 12 } },
      React.createElement('div', { style: { fontSize: 13, opacity: 0.8, marginBottom: 6 } }, '运行历史'),
      runsContent,
    )
  }

  return React.createElement('section', { style: wrapStyle }, React.createElement('h3', { style: hStyle }, '安排任务'), body, runsBlock)
}

export const name = 'moyu-scheduled-tasks-client'
export const inject = ['slots', 'sessions']

export function apply(ctx: ClientContext): void {
  const openSession = (sessionId: string): void => {
    try {
      ;(ctx as unknown as { sessions?: { open(id: string): void } }).sessions?.open(sessionId)
    } catch {
      /* session may already be gone; ignore */
    }
  }
  ctx.slots.inject('conversation.view' as never, () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'moyu-scheduled-tasks',
        order: 50,
        label: () => '安排任务',
      } as never,
      (() => React.createElement(ScheduledTasksPanel, { openSession })) as never,
    ),
  )
}
