import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import { randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { realpathSync, statSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'

export const name = 'moyu-scheduled-tasks'
export const inject = ['agents', 'sessions', 'tools', 'webServer', 'workspaceRegistry']

const SUPPORTED_OPERATIONS = new Set([
  'list',
  'runs',
  'detail',
  'workspaces',
  'create',
  'update',
  'set-enabled',
  'run',
  'delete',
  'mark-run-read',
])

/** Folder name only — a non-sensitive display label, never a full path. */
function workspaceLabel(cwd: string): string {
  try {
    return basename(cwd)
  } catch {
    return 'workspace'
  }
}

/** Non-empty, length-bounded id string (taskId / runId / workspaceId). */
function isId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 128
}

function sanitizeError(error: unknown): string {
  const message = String((error as { message?: string })?.message || error || 'request failed')
    .replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i, '')
    .replace(/\/Users\/[^ "'\n]+/g, '[path]')
    .replace(/[A-Z]:\\[^ "'\n]+/g, '[path]')
    .slice(0, 240)
  return message
}

function sendJson(res: { writeHead(status: number, headers: Record<string, string>): void; end(body: string): void }, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

function readBody(req: NodeJS.ReadableStream & Partial<{ method: string }>, limit = MAX_BODY_BYTES): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const onData = (chunk: Buffer | string) => {
      const data = Buffer.from(chunk)
      size += data.length
      if (size > limit) {
        reject(new Error('request body too large'))
        return
      }
      chunks.push(data)
    }
    const onEnd = () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw.length ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    }
    const stream = req as unknown as {
      on?: (ev: string, cb: (chunk?: unknown) => void) => void
      [Symbol.asyncIterator]?: () => AsyncIterableIterator<Buffer>
    }
    if (stream.on) {
      stream.on('data', onData as (chunk: unknown) => void)
      stream.on('end', onEnd)
      stream.on('error', reject)
    } else if (stream[Symbol.asyncIterator]) {
      void (async () => {
        try {
          for await (const chunk of stream[Symbol.asyncIterator]!()) onData(chunk)
          onEnd()
        } catch (e) {
          reject(e)
        }
      })()
    } else {
      resolve({})
    }
  })
}

const PLUGIN_ID = 'moyu-scheduled-tasks'
const PLUGIN_NAME = '@moyu/dsh-plugin-scheduled-tasks'
const MAX_TIMEOUT_MS = 2_147_483_647
const MAX_BODY_BYTES = 16 * 1024
const WRITE_BODY_BYTES = 64 * 1024

const READ_OPS = new Set(['list', 'runs', 'detail', 'workspaces'])
const WRITE_OPS = new Set([
  'create',
  'update',
  'set-enabled',
  'run',
  'delete',
  'mark-run-read',
  'mark-all-read',
])

// Scheduling types + pure engine live in ./schedule (shared with the Client
// bundle, which must not import Host-only code). Re-exported so the host
// harness can keep importing computeNextRun/validateSchedule from lib/index.mjs.
import { computeNextRun, validateSchedule, ServiceError, taskPresetOf, taskRunModeOf } from './schedule'
import type { ScheduleSpec, RecurrencePattern, RunMode } from './schedule'
export * from './schedule'

export interface ScheduledTask {
  id: string
  title: string
  prompt: string
  workspaceId?: string
  cwd: string
  enabled: boolean
  schedule: ScheduleSpec
  nextRunAt: number | null
  lastRunAt: number | null
  createdAt: number
  updatedAt: number
  /** Creating workbench. Missing on disk is treated as moyu. */
  preset: string
  runMode: RunMode
  /** Required when runMode is continuation; reused as the live session id. */
  continuationSessionId?: string
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

// Safe DTOs returned to the Client. Never include cwd, the full prompt,
// internal file paths, AgentHandle or Host objects.
export interface TaskSummary {
  id: string
  title: string
  workspaceId: string
  enabled: boolean
  schedule: ScheduleSpec
  nextRunAt: number | null
  lastRunAt: number | null
  lastRunStatus: RunStatus | null
  unreadCount: number
  running: boolean
  preset: string
  runMode: RunMode
}

/** Full task detail, only returned when the editor explicitly opens it. No cwd. */
export interface TaskDetail {
  id: string
  title: string
  prompt: string
  workspaceId: string
  enabled: boolean
  schedule: ScheduleSpec
  nextRunAt: number | null
  lastRunAt: number | null
  createdAt: number
  updatedAt: number
  preset: string
  runMode: RunMode
}

export interface WorkspaceSummary {
  id: string
  title: string
}

// ServiceError is defined in ./schedule and imported above.

/** Minimal structural view of the Host workspace registry (no new dependency). */
interface WorkspaceLike {
  id: string
  title: string
  path: string
  status(): Promise<'ok' | 'missing-dir'>
}
interface WorkspaceRegistryLike {
  get(id: string): WorkspaceLike | undefined
  list(): WorkspaceLike[]
  resolveByPath(p: string): Promise<WorkspaceLike | undefined>
}

export interface RunSummary {
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

const STORE_VERSION = 2
const MAX_BACKFILL_GAP_MS = 24 * 60 * 60 * 1000

// Pure scheduling helpers (daysInMonth, addDays, localParts, tzOffsetMs,
// zonedWallToUtc, parseHHmm, computeNextRun, validateSchedule) moved to
// ./schedule and imported above.

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
        version?: number
        tasks?: (ScheduledTask & { schedule?: ScheduleSpec })[]
        runs?: Record<string, ScheduledRun[]>
      }
      let migrated = false
      for (const t of parsed.tasks ?? []) {
        const base = t.schedule ? (t as ScheduledTask) : this.migrateV1Task(t)
        if (!t.schedule) migrated = true
        this.tasks.set(base.id, {
          ...base,
          preset: taskPresetOf(base),
          runMode: taskRunModeOf(base),
          continuationSessionId:
            typeof (base as ScheduledTask).continuationSessionId === 'string'
              ? (base as ScheduledTask).continuationSessionId
              : undefined,
        })
      }
      for (const [taskId, list] of Object.entries(parsed.runs ?? {})) this.runs.set(taskId, list)
      // Write the migrated store back so subsequent loads don't re-migrate and the
      // on-disk version/shape matches memory.
      if (migrated) await this.persist()
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.ctx.logger?.error?.('[moyu-scheduled-tasks] load failed', e)
      }
    }
    // Propagate: if recover's reconciliation persist fails, ready rejects and the
    // plugin enters an unavailable state rather than silently serving stale state.
    await this.recover()
    this.rescheduleAll()
  }

  /** v1 tasks had no `schedule`; infer an `once` spec from runAt/createdAt. */
  private migrateV1Task(t: ScheduledTask & { schedule?: ScheduleSpec }): ScheduledTask {
    const runAt = t.nextRunAt && t.nextRunAt > Date.now() ? t.nextRunAt : t.createdAt
    return { ...t, schedule: { kind: 'once', runAt } }
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
      // Persist reconciliation. Errors are logged AND propagated so that
      // `load()`'s `ready` rejects and the plugin enters an unavailable state
      // rather than serving state that disagrees with disk.
      try {
        await this.persist()
      } catch (e) {
        this.ctx.logger?.error?.('[moyu-scheduled-tasks] recover persist failed', e)
        throw e
      }
    }
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(
      {
        version: STORE_VERSION,
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

  /** Client-safe projection of all tasks (no cwd / prompt / handles). */
  listTaskSummaries(): TaskSummary[] {
    return [...this.tasks.values()].map((t) => {
      const runs = this.runs.get(t.id) ?? []
      const last = runs.length ? runs[runs.length - 1] : undefined
      return {
        id: t.id,
        title: t.title,
        workspaceId: t.workspaceId ?? workspaceLabel(t.cwd),
        enabled: t.enabled,
        schedule: t.schedule,
        nextRunAt: t.nextRunAt,
        lastRunAt: t.lastRunAt,
        lastRunStatus: last ? last.status : null,
        unreadCount: runs.filter((r) => r.unread).length,
        running: this.activeRuns.has(t.id),
        preset: taskPresetOf(t),
        runMode: taskRunModeOf(t),
      }
    })
  }

  /** Full detail for the editor; includes prompt but never cwd / handles. */
  getTaskDetail(taskId: string): TaskDetail | undefined {
    const t = this.tasks.get(taskId)
    if (!t) return undefined
    return {
      id: t.id,
      title: t.title,
      prompt: t.prompt,
      workspaceId: t.workspaceId ?? workspaceLabel(t.cwd),
      enabled: t.enabled,
      schedule: t.schedule,
      nextRunAt: t.nextRunAt,
      lastRunAt: t.lastRunAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      preset: taskPresetOf(t),
      runMode: taskRunModeOf(t),
    }
  }

  /** Workspace picker options (id + title only; no paths). */
  listWorkspaces(): WorkspaceSummary[] {
    const reg = (this.ctx as { workspaceRegistry?: WorkspaceRegistryLike }).workspaceRegistry
    if (!reg) return []
    return reg.list().map((w) => ({ id: w.id, title: w.title }))
  }

  /** Client-safe projection of one task's runs (no cwd / prompt / handles). */
  getRunSummaries(taskId: string): RunSummary[] {
    return (this.runs.get(taskId) ?? []).map((r) => ({
      id: r.id,
      taskId: r.taskId,
      scheduledFor: r.scheduledFor,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      status: r.status,
      sessionId: r.sessionId,
      unread: r.unread,
      ...(r.status === 'failed' && r.errorCode
        ? { errorCode: r.errorCode, errorMessage: r.errorMessage }
        : {}),
    }))
  }

  async createTask(input: {
    title: string
    prompt: string
    cwd: string
    workspaceId?: string
    enabled?: boolean
    schedule?: ScheduleSpec
    runAt?: number
    preset?: string
    runMode?: RunMode
    continuationSessionId?: string
  }): Promise<ScheduledTask> {
    await this.ready
    this.validateInput(input.title, input.prompt)
    const schedule: ScheduleSpec = input.schedule
      ? input.schedule
      : { kind: 'once', runAt: input.runAt ?? 0 }
    validateSchedule(schedule)
    const enabled = input.enabled ?? true
    await this.validateCwd(input.cwd)
    const now = Date.now()
    const runMode = taskRunModeOf({ runMode: input.runMode })
    const continuationSessionId =
      typeof input.continuationSessionId === 'string' && input.continuationSessionId.trim()
        ? input.continuationSessionId.trim()
        : undefined
    if (runMode === 'continuation' && !continuationSessionId) {
      throw new ServiceError('invalid_input', 'continuation tasks require continuationSessionId', 400)
    }
    const task: ScheduledTask = {
      id: randomUUID(),
      title: input.title,
      prompt: input.prompt,
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      enabled,
      schedule,
      nextRunAt: enabled ? computeNextRun(schedule, now) : null,
      lastRunAt: null,
      createdAt: now,
      updatedAt: now,
      preset: taskPresetOf({ preset: input.preset }),
      runMode,
      continuationSessionId,
    }
    await this.ensureWorkspace(task)
    this.tasks.set(task.id, task)
    await this.persist()
    this.schedule(task)
    return task
  }

  async updateTask(
    taskId: string,
    patch: {
      title?: string
      prompt?: string
      workspaceId?: string
      schedule?: ScheduleSpec
      runAt?: number
      enabled?: boolean
      runMode?: RunMode
      continuationSessionId?: string
    },
  ): Promise<ScheduledTask> {
    await this.ready
    const t = this.requireTask(taskId)
    if (patch.title !== undefined) {
      this.validateInput(patch.title, patch.prompt ?? t.prompt)
      t.title = patch.title
    }
    if (patch.prompt !== undefined) {
      this.validateInput(patch.title ?? t.title, patch.prompt)
      t.prompt = patch.prompt
    }
    if (patch.workspaceId !== undefined) {
      t.cwd = await this.resolveWorkspaceCwd(patch.workspaceId)
      t.workspaceId = patch.workspaceId
    }
    let schedule = t.schedule
    if (patch.schedule) schedule = patch.schedule
    else if (patch.runAt !== undefined) schedule = { kind: 'once', runAt: patch.runAt }
    if (patch.schedule || patch.runAt !== undefined) {
      validateSchedule(schedule)
      const enabled = patch.enabled ?? t.enabled
      t.schedule = schedule
      t.nextRunAt = enabled ? computeNextRun(schedule, Date.now()) : null
    }
    if (patch.enabled !== undefined) {
      if (patch.enabled) this.assertResumable(t)
      t.enabled = patch.enabled
    }
    if (patch.runMode !== undefined) t.runMode = taskRunModeOf({ runMode: patch.runMode })
    if (patch.continuationSessionId !== undefined) {
      t.continuationSessionId = patch.continuationSessionId.trim() || undefined
    }
    if (taskRunModeOf(t) === 'continuation' && !t.continuationSessionId) {
      throw new ServiceError('invalid_input', 'continuation tasks require continuationSessionId', 400)
    }
    t.updatedAt = Date.now()
    await this.persist()
    this.schedule(t)
    return t
  }

  async setEnabled(taskId: string, enabled: boolean): Promise<void> {
    const t = this.requireTask(taskId)
    if (enabled) this.assertResumable(t)
    t.enabled = enabled
    t.updatedAt = Date.now()
    await this.persist()
    this.schedule(t)
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.ready
    const t = this.requireTask(taskId)
    if (this.activeRuns.has(taskId)) {
      throw new ServiceError('task_running', 'cannot delete a task that is currently running', 409)
    }
    this.clearTimer(taskId)
    this.tasks.delete(taskId)
    this.runs.delete(taskId)
    await this.persist()
  }

  async markRunRead(runId: string): Promise<boolean> {
    await this.ready
    for (const arr of this.runs.values()) {
      const run = arr.find((r) => r.id === runId)
      if (run) {
        run.unread = false
        await this.persist()
        return true
      }
    }
    return false
  }

  async markAllRead(): Promise<number> {
    await this.ready
    let marked = 0
    for (const arr of this.runs.values()) {
      for (const run of arr) {
        if (run.unread) {
          run.unread = false
          marked++
        }
      }
    }
    if (marked > 0) await this.persist()
    return marked
  }

  private schedule(task: ScheduledTask): void {
    this.clearTimer(task.id)
    if (!task.enabled || !task.nextRunAt) return
    const tick = () => {
      const delay = task.nextRunAt! - Date.now()
      if (delay <= 0) {
        // Same task still in flight when its next fire arrives: record a
        // `missed` occurrence and continue the series rather than starting a
        // second concurrent run.
        if (this.activeRuns.has(task.id)) {
          this.recordMissed(task)
          return
        }
        void this.runTaskNow(task.id, true).catch((e) =>
          this.ctx.logger?.error?.(`[moyu-scheduled-tasks] scheduled run failed: ${String((e as Error).message)}`),
        )
        return
      }
      const wait = Math.min(delay, MAX_TIMEOUT_MS)
      this.timers.set(task.id, setTimeout(tick, wait))
    }
    tick()
  }

  /** Record a skipped occurrence (concurrency) and continue the series. */
  private recordMissed(task: ScheduledTask): void {
    const run: ScheduledRun = {
      id: randomUUID(),
      taskId: task.id,
      scheduledFor: task.nextRunAt ?? Date.now(),
      startedAt: null,
      finishedAt: Date.now(),
      status: 'missed',
      sessionId: null,
      unread: true,
    }
    const arr = this.runs.get(task.id) ?? []
    arr.push(run)
    this.runs.set(task.id, arr)
    if (task.schedule.kind === 'recurring') {
      task.nextRunAt = computeNextRun(task.schedule, Date.now())
    } else {
      task.nextRunAt = null
    }
    void this.persist().catch((e) =>
      this.ctx.logger?.error?.(`[moyu-scheduled-tasks] persist failed: ${String((e as Error).message)}`),
    )
    this.schedule(task)
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
    const reg = (this.ctx as { workspaceRegistry?: WorkspaceRegistryLike }).workspaceRegistry
    if (!reg) return
    try {
      if (task.workspaceId) {
        const ws = reg.get(task.workspaceId)
        if (ws) {
          task.workspaceId = ws.id
          return
        }
      }
      const ws = await reg.resolveByPath(task.cwd)
      if (ws) task.workspaceId = task.workspaceId ?? ws.id
    } catch (e) {
      this.ctx.logger?.warn?.(`[moyu-scheduled-tasks] workspace check skipped: ${String((e as Error).message)}`)
    }
  }

  private validateInput(title: string, prompt: string): void {
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 80) {
      throw new ServiceError('invalid_input', 'title must be a non-empty string of 1-80 characters', 400)
    }
    if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 20000) {
      throw new ServiceError('invalid_input', 'prompt must be a non-empty string of 1-20000 characters', 400)
    }
  }

  private requireTask(taskId: string): ScheduledTask {
    const t = this.tasks.get(taskId)
    if (!t) throw new ServiceError('not_found', `scheduled task not found: ${taskId}`, 404)
    return t
  }

  /** Enabling a task is only valid when it still has a future schedule. */
  private assertResumable(t: ScheduledTask): void {
    if (!t.nextRunAt) {
      throw new ServiceError('invalid_state', 'task has no future schedule; use run-now or edit the time', 400)
    }
    if (t.nextRunAt <= Date.now()) {
      throw new ServiceError('invalid_run_at', 'nextRunAt already passed; pick a new time before resuming', 400)
    }
  }

  /** Resolve a Client-submitted workspaceId into an authoritative, accessible cwd. */
  async resolveWorkspaceCwd(workspaceId: string): Promise<string> {
    const reg = (this.ctx as { workspaceRegistry?: WorkspaceRegistryLike }).workspaceRegistry
    if (!reg) throw new ServiceError('workspace_not_found', 'workspace registry is unavailable', 400)
    const ws = reg.get(workspaceId)
    if (!ws) throw new ServiceError('workspace_not_found', 'workspace not found', 404)
    let st: 'ok' | 'missing-dir'
    try {
      st = await ws.status()
    } catch (e) {
      const msg = String((e as Error)?.message ?? '')
      if (msg.includes('EACCES')) throw new ServiceError('workspace_permission_denied', 'workspace directory is not accessible', 400)
      throw new ServiceError('workspace_unavailable', 'workspace directory is unavailable', 400)
    }
    if (st !== 'ok') throw new ServiceError('workspace_unavailable', 'workspace directory is missing', 400)
    return ws.path
  }

  /**
   * Create the running record synchronously (idempotency guard + persist) and
   * return it. The actual agent work is driven separately so the route can
   * return 202 immediately instead of blocking on model execution.
   */
  private async beginRun(taskId: string, advanceSchedule = false): Promise<ScheduledRun> {
    const task = this.requireTask(taskId)
    if (this.activeRuns.has(taskId)) throw new ServiceError('task_running', 'task is already running', 409)

    const runId = randomUUID()
    const run: ScheduledRun = {
      id: runId,
      taskId,
      // The planned (or overdue, for a backfilled run) due time. Captured before
      // `nextRunAt` is advanced so the run history distinguishes "scheduled for"
      // from "actually started". Manual/immediate runs (no pending schedule)
      // fall back to the wall-clock now.
      scheduledFor: task.nextRunAt ?? Date.now(),
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
    task.lastRunAt = Date.now()
    if (task.schedule.kind === 'recurring') {
      // Only advance the series when this run IS the scheduled occurrence.
      // Manual runs (立即运行 / 重新运行) must NOT skip an occurrence.
      if (advanceSchedule) task.nextRunAt = computeNextRun(task.schedule, task.lastRunAt)
    } else {
      // One-time task: any run consumes the single schedule.
      task.nextRunAt = null
    }
    await this.persist()
    this.schedule(task)
    return run
  }

  /** Drive one run to completion: validate, create the agent, follow up, persist. */
  private async driveTaskRun(task: ScheduledTask, run: ScheduledRun): Promise<void> {
    try {
      try {
        await this.validateCwd(task.cwd)
        await this.ensureWorkspace(task)
      } catch (e) {
        run.status = 'failed'
        run.errorCode = 'validation'
        run.errorMessage = String((e as Error).message)
        run.finishedAt = Date.now()
        await this.persist()
        throw e
      }

      const preset = taskPresetOf(task)
      const runMode = taskRunModeOf(task)
      let handle: AgentHandle
      let sessionId: string
      try {
        if (runMode === 'continuation' && task.continuationSessionId) {
          sessionId = task.continuationSessionId
          handle = await this.ctx.agents.resume({
            resumeSessionId: sessionId as unknown as SessionId,
          })
        } else {
          // standalone: new session identity every run. No parentSession / seed,
          // so the background agent does not inherit a foreground session's
          // temporary grants (decision 15).
          sessionId = `scheduled-${task.id}-${run.id}`
          handle = await this.ctx.agents.create({
            sessionId: sessionId as unknown as SessionId,
            meta: { cwd: task.cwd, agentPreset: preset },
          })
        }
      } catch (e) {
        run.status = 'failed'
        run.errorCode = runMode === 'continuation' ? 'agent_resume_failed' : 'agent_create_failed'
        run.errorMessage = String((e as Error).message)
        run.finishedAt = Date.now()
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
      }

      // Only transition to a terminal state if this run is still 'running'.
      // A concurrent dispose()/recover() may have already marked it interrupted,
      // and we must not overwrite that with a success.
      if (run.status === 'running') {
        if (failed) {
          run.status = 'failed'
          run.errorCode = run.errorCode ?? 'agent_error'
          run.errorMessage = errorInfo instanceof Error ? errorInfo.message : String(errorInfo)
        } else {
          run.status = 'succeeded'
        }
        run.finishedAt = Date.now()
      }
      await this.persist()

      // Explicit release: stop the live agent loop once the turn is done.
      // The session log persists; only the live agent handle is torn down.
      this.handles.delete(handle)
      await handle.dispose().catch(() => {})
    } finally {
      // Every exit path must release the active-run guard.
      this.activeRuns.delete(task.id)
    }
  }

  /** Non-blocking run for the UI route: returns the running record (202). */
  async startTaskRun(taskId: string, advanceSchedule = false): Promise<ScheduledRun> {
    await this.ready
    const task = this.requireTask(taskId)
    const run = await this.beginRun(taskId, advanceSchedule)
    void this.driveTaskRun(task, run).catch((e) =>
      this.ctx.logger?.error?.(`[moyu-scheduled-tasks] scheduled run failed: ${String((e as Error)?.message)}`),
    )
    return run
  }

  /** Blocking run used by the Tool (waits for the final status). */
  async runTaskNow(taskId: string, advanceSchedule = false): Promise<ScheduledRun> {
    await this.ready
    const task = this.requireTask(taskId)
    const run = await this.beginRun(taskId, advanceSchedule)
    await this.driveTaskRun(task, run)
    return run
  }

  private rescheduleAll(): void {
    for (const t of this.tasks.values()) this.reconcileMissed(t)
  }

  /**
   * On startup/reload, re-arm future schedules and reconcile occurrences that
   * were missed while the host was down:
   * - `once` missed ≤24h: backfill immediately. >24h: record `missed`, drop.
   * - `recurring` missed ≤24h: backfill only the most recent occurrence, then
   *   continue the series. >24h: skip missed occurrences, jump to next future.
   */
  private reconcileMissed(task: ScheduledTask): void {
    if (!task.enabled || !task.nextRunAt || task.nextRunAt > Date.now()) {
      this.schedule(task)
      return
    }
    const now = Date.now()
    const gap = now - task.nextRunAt
    if (task.schedule.kind === 'once') {
      if (gap <= MAX_BACKFILL_GAP_MS) {
        this.schedule(task)
        return
      }
      const run: ScheduledRun = {
        id: randomUUID(),
        taskId: task.id,
        scheduledFor: task.nextRunAt,
        startedAt: null,
        finishedAt: now,
        status: 'missed',
        sessionId: null,
        unread: true,
      }
      const arr = this.runs.get(task.id) ?? []
      arr.push(run)
      this.runs.set(task.id, arr)
      task.nextRunAt = null
      void this.persist().catch((e) =>
        this.ctx.logger?.error?.(`[moyu-scheduled-tasks] persist failed: ${String((e as Error).message)}`),
      )
      return
    }
    if (gap <= MAX_BACKFILL_GAP_MS) {
      this.schedule(task)
    } else {
      task.nextRunAt = computeNextRun(task.schedule, now)
      this.schedule(task)
    }
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

  // Read-only query bridge (A'): same-origin fetch from the Client hits this
  // exact route and calls the SAME ScheduledTasksService instance as the Tools.
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/moyu/scheduled-tasks',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        let body: unknown
        try {
          body = await readBody(req, WRITE_BODY_BYTES)
        } catch {
          sendJson(res, 400, { error: 'request body must be valid JSON and <= 64KB' })
          return
        }
        const operation = (body as { operation?: unknown }).operation
        if (typeof operation !== 'string' || !SUPPORTED_OPERATIONS.has(operation)) {
          sendJson(res, 400, { error: 'unknown operation' })
          return
        }
        // Read-only queries keep the stricter 16KB cap.
        if (READ_OPS.has(operation) && Buffer.byteLength(JSON.stringify(body)).valueOf() > MAX_BODY_BYTES) {
          sendJson(res, 400, { error: 'read request body must be <= 16KB' })
          return
        }
        try {
          await svc.ready
          if (operation === 'list') {
            sendJson(res, 200, { tasks: svc.listTaskSummaries() })
            return
          }
          if (operation === 'workspaces') {
            sendJson(res, 200, { workspaces: svc.listWorkspaces() })
            return
          }
          if (operation === 'runs') {
            const taskId = (body as { taskId?: unknown }).taskId
            if (!isId(taskId)) {
              sendJson(res, 400, { error: 'taskId must be a non-empty string <= 128 chars' })
              return
            }
            if (!svc.getTask(taskId)) {
              sendJson(res, 404, { error: 'task not found' })
              return
            }
            sendJson(res, 200, { runs: svc.getRunSummaries(taskId) })
            return
          }
          if (operation === 'detail') {
            const taskId = (body as { taskId?: unknown }).taskId
            if (!isId(taskId)) {
              sendJson(res, 400, { error: 'taskId must be a non-empty string <= 128 chars' })
              return
            }
            const detail = svc.getTaskDetail(taskId)
            if (!detail) {
              sendJson(res, 404, { error: 'task not found' })
              return
            }
            sendJson(res, 200, { detail })
            return
          }
          if (operation === 'create') {
            const b = body as {
              title?: unknown
              prompt?: unknown
              workspaceId?: unknown
              runAt?: unknown
              enabled?: unknown
              schedule?: unknown
              preset?: unknown
              runMode?: unknown
              continuationSessionId?: unknown
            }
            if (typeof b.workspaceId !== 'string' || !isId(b.workspaceId)) {
              sendJson(res, 400, { error: 'workspaceId must be a non-empty string' })
              return
            }
            const incoming = (b.schedule && typeof b.schedule === 'object' ? b.schedule : { kind: 'once', runAt: b.runAt }) as ScheduleSpec
            if (incoming.kind === 'once' && typeof incoming.runAt === 'number' && incoming.runAt <= Date.now()) {
              sendJson(res, 400, { error: 'runAt must be a finite future timestamp in milliseconds' })
              return
            }
            const cwd = await svc.resolveWorkspaceCwd(b.workspaceId)
            const task = await svc.createTask({
              title: String(b.title ?? ''),
              prompt: String(b.prompt ?? ''),
              cwd,
              workspaceId: b.workspaceId,
              enabled: b.enabled === undefined ? true : Boolean(b.enabled),
              schedule: b.schedule && typeof b.schedule === 'object' ? (b.schedule as ScheduleSpec) : undefined,
              runAt: typeof b.runAt === 'number' ? b.runAt : undefined,
              preset: typeof b.preset === 'string' ? b.preset : undefined,
              runMode: b.runMode === 'continuation' ? 'continuation' : 'standalone',
              continuationSessionId: typeof b.continuationSessionId === 'string' ? b.continuationSessionId : undefined,
            })
            sendJson(res, 200, { taskId: task.id, nextRunAt: task.nextRunAt ?? 0 })
            return
          }
          if (operation === 'update') {
            const b = body as {
              taskId?: unknown
              title?: unknown
              prompt?: unknown
              workspaceId?: unknown
              runAt?: unknown
              enabled?: unknown
              schedule?: unknown
              runMode?: unknown
              continuationSessionId?: unknown
            }
            if (!isId(b.taskId)) {
              sendJson(res, 400, { error: 'taskId must be a non-empty string <= 128 chars' })
              return
            }
            const incoming = (b.schedule && typeof b.schedule === 'object' ? b.schedule : b.runAt !== undefined ? { kind: 'once', runAt: b.runAt } : null) as ScheduleSpec | null
            if (incoming && incoming.kind === 'once' && typeof incoming.runAt === 'number' && incoming.runAt <= Date.now()) {
              sendJson(res, 400, { error: 'runAt must be a finite future timestamp in milliseconds' })
              return
            }
            const task = await svc.updateTask(b.taskId, {
              title: typeof b.title === 'string' ? b.title : undefined,
              prompt: typeof b.prompt === 'string' ? b.prompt : undefined,
              workspaceId: typeof b.workspaceId === 'string' ? b.workspaceId : undefined,
              schedule: b.schedule && typeof b.schedule === 'object' ? (b.schedule as ScheduleSpec) : undefined,
              runAt: typeof b.runAt === 'number' ? b.runAt : undefined,
              enabled: typeof b.enabled === 'boolean' ? b.enabled : undefined,
              runMode: b.runMode === 'continuation' ? 'continuation' : b.runMode === 'standalone' ? 'standalone' : undefined,
              continuationSessionId: typeof b.continuationSessionId === 'string' ? b.continuationSessionId : undefined,
            })
            sendJson(res, 200, { taskId: task.id, nextRunAt: task.nextRunAt ?? 0 })
            return
          }
          if (operation === 'set-enabled') {
            const b = body as { taskId?: unknown; enabled?: unknown }
            if (!isId(b.taskId)) {
              sendJson(res, 400, { error: 'taskId must be a non-empty string <= 128 chars' })
              return
            }
            if (typeof b.enabled !== 'boolean') {
              sendJson(res, 400, { error: 'enabled must be a boolean' })
              return
            }
            await svc.setEnabled(b.taskId, b.enabled)
            sendJson(res, 200, { taskId: b.taskId, enabled: b.enabled })
            return
          }
          if (operation === 'run') {
            const taskId = (body as { taskId?: unknown }).taskId
            if (!isId(taskId)) {
              sendJson(res, 400, { error: 'taskId must be a non-empty string <= 128 chars' })
              return
            }
            if (!svc.getTask(taskId)) {
              sendJson(res, 404, { error: 'task not found' })
              return
            }
            const run = await svc.startTaskRun(taskId)
            sendJson(res, 202, { runId: run.id, taskId, status: run.status })
            return
          }
          if (operation === 'delete') {
            const taskId = (body as { taskId?: unknown }).taskId
            if (!isId(taskId)) {
              sendJson(res, 400, { error: 'taskId must be a non-empty string <= 128 chars' })
              return
            }
            if (!svc.getTask(taskId)) {
              sendJson(res, 404, { error: 'task not found' })
              return
            }
            await svc.deleteTask(taskId)
            sendJson(res, 200, { taskId })
            return
          }
          if (operation === 'mark-run-read') {
            const runId = (body as { runId?: unknown }).runId
            if (!isId(runId)) {
              sendJson(res, 400, { error: 'runId must be a non-empty string <= 128 chars' })
              return
            }
            const ok = await svc.markRunRead(runId)
            sendJson(res, ok ? 200 : 404, { runId, ok })
            return
          }
          if (operation === 'mark-all-read') {
            const marked = await svc.markAllRead()
            sendJson(res, 200, { ok: true, marked })
            return
          }
          sendJson(res, 400, { error: 'unknown operation' })
        } catch (e) {
          if (e instanceof ServiceError) {
            sendJson(res, e.httpStatus, { error: e.code, message: sanitizeError(e) })
            return
          }
          sendJson(res, 500, { error: sanitizeError(e) })
        }
      },
    }),
  )

  return svc.ready.then(() => {
    ctx.tools.register(
      defineTool({
        name: 'moyu_schedule_run_now',
        description:
          'Moyu 安排任务：立即用给定提示词在指定工作区创建一个新会话并自动执行（无人值守，单次）。默认 runMode=standalone，不继承前台会话临时授权。',
        parameters: {
          title: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
          cwd: { type: 'string', required: true },
          workspaceId: { type: 'string' },
          preset: { type: 'string' },
          runMode: { type: 'string' },
          continuationSessionId: { type: 'string' },
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
          preset?: string
          runMode?: string
          continuationSessionId?: string
        }) => {
          const task = await svc.createTask({
            title: args.title,
            prompt: args.prompt,
            cwd: args.cwd,
            workspaceId: args.workspaceId,
            enabled: false,
            preset: args.preset,
            runMode: args.runMode === 'continuation' ? 'continuation' : 'standalone',
            continuationSessionId: args.continuationSessionId,
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
          'Moyu 安排任务：创建一个定时任务（单次 runAt 为未来毫秒时间戳）。自媒体待发布/库存不足提醒请用 runMode=standalone（默认），每次独立会话报告。',
        parameters: {
          title: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
          cwd: { type: 'string', required: true },
          runAt: { type: 'number', required: true },
          workspaceId: { type: 'string' },
          preset: { type: 'string' },
          runMode: { type: 'string' },
          continuationSessionId: { type: 'string' },
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
          preset?: string
          runMode?: string
          continuationSessionId?: string
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
            preset: args.preset,
            runMode: args.runMode === 'continuation' ? 'continuation' : 'standalone',
            continuationSessionId: args.continuationSessionId,
          })
          return { taskId: task.id, nextRunAt: task.nextRunAt ?? 0 }
        },
      }),
    )
  })
}

export default { name: PLUGIN_ID, inject, apply }
