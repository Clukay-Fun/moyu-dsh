import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import { randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { realpathSync, statSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

export const name = 'moyu-scheduled-tasks'
export const inject = ['agents', 'sessions', 'tools']

const PLUGIN_ID = 'moyu-scheduled-tasks'
const PLUGIN_NAME = '@moyu/dsh-plugin-scheduled-tasks'
const MAX_TIMEOUT_MS = 2_147_483_647

export interface ScheduledTask {
  id: string
  title: string
  prompt: string
  workspaceId?: string
  cwd: string
  enabled: boolean
  nextRunAt: number | null
  lastRunAt: number | null
  createdAt: number
  updatedAt: number
}

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'missed' | 'cancelled'

export interface ScheduledRun {
  id: string
  taskId: string
  scheduledFor: number
  startedAt: number | null
  finishedAt: number | null
  status: RunStatus
  sessionId: string | null
  unread: boolean
  errorCode?: string
  errorMessage?: string
}

function resolveDataDir(): string {
  const base =
    process.env.MOYU_DSH_HOME ||
    process.env.DSH_HOME ||
    join(homedir(), 'Library', 'Application Support', 'dsh')
  return join(base, 'scheduled-tasks')
}

export class ScheduledTasksService extends Service {
  private tasks = new Map<string, ScheduledTask>()
  private runs = new Map<string, ScheduledRun[]>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private handles = new Set<AgentHandle>()
  private activeRuns = new Map<string, string>()
  private writeChain: Promise<void> = Promise.resolve()
  private storeFile = join(resolveDataDir(), 'store.json')
  ready: Promise<void>

  constructor(ctx: Context) {
    super(ctx, 'moyuScheduledTasks')
    this.ready = this.load()
  }

  async load(): Promise<void> {
    this.tasks.clear()
    this.runs.clear()
    try {
      const raw = await readFile(this.storeFile, 'utf8')
      const parsed = JSON.parse(raw) as {
        tasks?: ScheduledTask[]
        runs?: Record<string, ScheduledRun[]>
      }
      for (const t of parsed.tasks ?? []) this.tasks.set(t.id, t)
      for (const [taskId, list] of Object.entries(parsed.runs ?? {})) this.runs.set(taskId, list)
      await this.recover()
      this.rescheduleAll()
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.ctx.logger?.error?.('[moyu-scheduled-tasks] load failed', e)
      }
    }
  }

  /**
   * Reconcile state left by a previous process after restart/reload: any run
   * still marked `running` can never finish (its agent/handle is gone), so it is
   * marked interrupted. Active-run tracking is cleared — a fresh process owns
   * nothing in flight.
   */
  private async recover(): Promise<void> {
    let changed = false
    for (const runs of this.runs.values()) {
      for (const run of runs) {
        if (run.status === 'running') {
          run.status = 'failed'
          run.errorCode = 'interrupted'
          run.errorMessage = 'run interrupted by host restart or reload'
          run.finishedAt = Date.now()
          changed = true
        }
      }
    }
    this.activeRuns.clear()
    if (changed) {
      await this.persist().catch((e) =>
        this.ctx.logger?.error?.('[moyu-scheduled-tasks] recover persist failed', e),
      )
    }
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(
      {
        tasks: [...this.tasks.values()],
        runs: Object.fromEntries([...this.runs.entries()]),
      },
      null,
      2,
    )
    const write = (async () => {
      await this.writeChain.catch(() => {})
      await mkdir(resolveDataDir(), { recursive: true })
      const tmp = `${this.storeFile}.${randomUUID()}.tmp`
      await writeFile(tmp, snapshot, 'utf8')
      await rename(tmp, this.storeFile)
    })()
    // Keep the internal chain from rejecting so future writes still proceed,
    // but return the raw promise so callers observe real failures.
    this.writeChain = write.catch(() => {})
    return write
  }

  listTasks(): ScheduledTask[] {
    return [...this.tasks.values()]
  }

  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id)
  }

  listRuns(taskId: string): ScheduledRun[] {
    return this.runs.get(taskId) ?? []
  }

  async createTask(input: {
    title: string
    prompt: string
    cwd: string
    workspaceId?: string
    enabled?: boolean
    runAt?: number
  }): Promise<ScheduledTask> {
    await this.ready
    await this.validateCwd(input.cwd)
    const now = Date.now()
    const task: ScheduledTask = {
      id: randomUUID(),
      title: input.title,
      prompt: input.prompt,
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      enabled: input.enabled ?? true,
      nextRunAt: input.runAt ?? null,
      lastRunAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await this.ensureWorkspace(task)
    this.tasks.set(task.id, task)
    await this.persist()
    this.schedule(task)
    return task
  }

  async setEnabled(taskId: string, enabled: boolean): Promise<void> {
    const t = this.tasks.get(taskId)
    if (!t) return
    t.enabled = enabled
    t.updatedAt = Date.now()
    await this.persist()
    this.schedule(t)
  }

  private schedule(task: ScheduledTask): void {
    this.clearTimer(task.id)
    if (!task.enabled || !task.nextRunAt) return
    const tick = () => {
      const delay = task.nextRunAt! - Date.now()
      if (delay <= 0) {
        void this.runTaskNow(task.id).catch((e) =>
          this.ctx.logger?.error?.(`[moyu-scheduled-tasks] scheduled run failed: ${String((e as Error).message)}`),
        )
        return
      }
      const wait = Math.min(delay, MAX_TIMEOUT_MS)
      this.timers.set(task.id, setTimeout(tick, wait))
    }
    tick()
  }

  private clearTimer(taskId: string): void {
    const t = this.timers.get(taskId)
    if (t) {
      clearTimeout(t)
      this.timers.delete(taskId)
    }
  }

  private clearAllTimers(): void {
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
  }

  private async validateCwd(cwd: string): Promise<void> {
    if (!isAbsolute(cwd)) throw new Error(`cwd must be an absolute path: ${cwd}`)
    let real: string
    try {
      real = realpathSync(cwd)
    } catch {
      throw new Error(`cwd is not accessible: ${cwd}`)
    }
    let st
    try {
      st = statSync(real)
    } catch {
      throw new Error(`cwd is not accessible: ${cwd}`)
    }
    if (!st.isDirectory()) throw new Error(`cwd is not a directory: ${cwd}`)
  }

  private async ensureWorkspace(task: ScheduledTask): Promise<void> {
    const reg = (
      this.ctx as {
        workspaceRegistry?: {
          resolveByPath: (p: string) => Promise<{ id: string } | undefined>
          create: (p: string) => Promise<{ id: string }>
        }
      }
    ).workspaceRegistry
    if (!reg) return
    try {
      let ws = await reg.resolveByPath(task.cwd)
      if (!ws) ws = await reg.create(task.cwd)
      if (ws?.id) task.workspaceId = task.workspaceId ?? ws.id
    } catch (e) {
      this.ctx.logger?.warn?.(`[moyu-scheduled-tasks] workspace check skipped: ${String((e as Error).message)}`)
    }
  }

  async runTaskNow(taskId: string): Promise<ScheduledRun> {
    await this.ready
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`scheduled task not found: ${taskId}`)
    if (this.activeRuns.has(taskId)) throw new Error(`task already running: ${taskId}`)

    const runId = randomUUID()
    const run: ScheduledRun = {
      id: runId,
      taskId,
      scheduledFor: Date.now(),
      startedAt: null,
      finishedAt: null,
      status: 'running',
      sessionId: null,
      unread: true,
    }
    const arr = this.runs.get(taskId) ?? []
    arr.push(run)
    this.runs.set(taskId, arr)
    // Reserve synchronously (before any await) so a concurrent invocation of the
    // same task sees the guard and cannot start a second run.
    this.activeRuns.set(taskId, runId)

    await this.validateCwd(task.cwd)
    await this.ensureWorkspace(task)

    task.lastRunAt = Date.now()
    task.nextRunAt = null

    const sessionId = `scheduled-${taskId}-${runId}` as unknown as SessionId

    let handle: AgentHandle
    try {
      handle = await this.ctx.agents.create({
        sessionId,
        meta: { cwd: task.cwd, agentPreset: 'moyu' },
      })
    } catch (e) {
      run.status = 'failed'
      run.errorCode = 'agent_create_failed'
      run.errorMessage = String((e as Error).message)
      run.finishedAt = Date.now()
      this.activeRuns.delete(taskId)
      await this.persist()
      throw e
    }
    this.handles.add(handle)

    const agent = handle.agent
    run.sessionId = String(sessionId)
    run.startedAt = Date.now()

    let failed = false
    let errorInfo: unknown
    const offError = agent.ctx.on('agent/error', (p: { error: unknown }) => {
      failed = true
      errorInfo = p.error
    })

    try {
      const message = createUserMessage({
        content: [{ type: 'text', text: task.prompt }],
        source: {
          kind: 'plugin',
          plugin: PLUGIN_NAME,
          summary: `scheduled: ${task.title}`,
        } as never,
      })
      try {
        agent.followup(message)
      } catch (e) {
        failed = true
        errorInfo = e
      }
      await agent.whenIdle()
    } catch (e) {
      failed = true
      errorInfo = errorInfo ?? e
    } finally {
      if (typeof offError === 'function') offError()
      this.activeRuns.delete(taskId)
    }

    if (failed) {
      run.status = 'failed'
      run.errorCode = run.errorCode ?? 'agent_error'
      run.errorMessage = errorInfo instanceof Error ? errorInfo.message : String(errorInfo)
    } else {
      run.status = 'succeeded'
    }
    run.finishedAt = Date.now()
    await this.persist()

    // Explicit release: stop the live agent loop once the turn is done.
    // The session log persists; only the live agent handle is torn down.
    this.handles.delete(handle)
    await handle.dispose().catch(() => {})

    return run
  }

  private rescheduleAll(): void {
    for (const t of this.tasks.values()) this.schedule(t)
  }

  async dispose(): Promise<void> {
    // Mark every in-flight run as interrupted. Iterate `this.runs` (not just
    // `activeRuns`) so a run started on another microtask tick is still caught.
    for (const runs of this.runs.values()) {
      for (const run of runs) {
        if (run.status === 'running') {
          run.status = 'failed'
          run.errorCode = 'interrupted'
          run.errorMessage = 'run interrupted by plugin unload'
          run.finishedAt = Date.now()
        }
      }
    }
    this.activeRuns.clear()
    this.clearAllTimers()
    for (const h of this.handles) await h.dispose().catch(() => {})
    this.handles.clear()
    await this.persist().catch(() => {})
  }
}

export function apply(ctx: Context): Promise<void> {
  const svc = new ScheduledTasksService(ctx)
  ctx.effect(() => () => svc.dispose())

  return svc.ready.then(() => {
    ctx.tools.register(
      defineTool({
        name: 'moyu_schedule_run_now',
        description:
          'Moyu 安排任务：立即用给定提示词在指定工作区创建一个新会话并自动执行（无人值守，单次）。',
        parameters: {
          title: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
          cwd: { type: 'string', required: true },
          workspaceId: { type: 'string' },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              taskId: { type: 'string' },
              runId: { type: 'string' },
              sessionId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        execute: async (args: {
          title: string
          prompt: string
          cwd: string
          workspaceId?: string
        }) => {
          const task = await svc.createTask({
            title: args.title,
            prompt: args.prompt,
            cwd: args.cwd,
            workspaceId: args.workspaceId,
            enabled: false,
          })
          const run = await svc.runTaskNow(task.id)
          return {
            taskId: task.id,
            runId: run.id,
            sessionId: run.sessionId ?? '',
            status: run.status,
          }
        },
      }),
    )

    ctx.tools.register(
      defineTool({
        name: 'moyu_schedule_create',
        description:
          'Moyu 安排任务：创建一个定时任务（spike 仅支持单次，runAt 为未来毫秒时间戳）。',
        parameters: {
          title: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
          cwd: { type: 'string', required: true },
          runAt: { type: 'number', required: true },
          workspaceId: { type: 'string' },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: { taskId: { type: 'string' }, nextRunAt: { type: 'number' } },
          },
          render: (_a, v) => [{ type: 'text', text: JSON.stringify(v) }],
        },
        execute: async (args: {
          title: string
          prompt: string
          cwd: string
          runAt: number
          workspaceId?: string
        }) => {
          if (!Number.isFinite(args.runAt) || args.runAt <= Date.now()) {
            throw new Error('runAt must be a finite future timestamp in milliseconds')
          }
          const task = await svc.createTask({
            title: args.title,
            prompt: args.prompt,
            cwd: args.cwd,
            workspaceId: args.workspaceId,
            enabled: true,
            runAt: args.runAt,
          })
          return { taskId: task.id, nextRunAt: task.nextRunAt ?? 0 }
        },
      }),
    )
  })
}

export default { name: PLUGIN_ID, inject: ['agents', 'sessions', 'tools'], apply }
