import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

import type {
  MediaArtifact,
  MediaRun,
  MediaStore,
  RunEvent,
  ServerRequest,
  ServerResponse,
  SessionCapabilities,
} from './types.js'

import {
  getSessionCapabilities,
  hasCapability,
  buildPresetSessionIndex,
  filterSessionListByPreset,
  filterSearchResultsByPreset,
  createPresetSessionSelector,
} from './session-filter.js'

export type { RunEvent, ServerRequest, ServerResponse, MediaArtifact, MediaRun, MediaStore, SessionCapabilities }
export {
  getSessionCapabilities,
  hasCapability,
  buildPresetSessionIndex,
  filterSessionListByPreset,
  filterSearchResultsByPreset,
  createPresetSessionSelector,
}

export const name = 'moyu-media'
export const inject = ['tools', 'webServer']

const STORE_VERSION = 1
const MAX_BODY_BYTES = 16 * 1024

function resolveDataDir(): string {
  const base =
    process.env.MOYU_DSH_HOME ||
    process.env.DSH_HOME ||
    join(homedir(), 'Library', 'Application Support', 'dsh')
  return join(base, 'media')
}

function sendJson(
  res: { writeHead(status: number, headers: Record<string, string>): void; end(body: string): void },
  status: number,
  value: unknown,
): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

function readBody(req: NodeJS.ReadableStream, limit = MAX_BODY_BYTES): Promise<unknown> {
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

type EventListener = (event: RunEvent) => void
type RequestListener = (request: ServerRequest) => void

interface SseConnection {
  write(data: string): boolean
  end(): void
}

export class MockMediaRunService extends Service {
  private store: MediaStore = { version: STORE_VERSION, generation: 0, runs: [] }
  private storeFile = join(resolveDataDir(), 'store.json')
  private writeChain: Promise<void> = Promise.resolve()
  private sequence = 0
  private eventListeners = new Set<EventListener>()
  private requestListeners = new Set<RequestListener>()
  private sseConnections = new Set<SseConnection>()
  private activeRun: string | null = null
  private requestResolvers = new Map<string, (response: ServerResponse) => void>()
  ready: Promise<void>

  constructor(ctx: Context) {
    super(ctx, 'moyuMedia')
    this.ready = this.load()
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.storeFile, 'utf8')
      const parsed = JSON.parse(raw) as MediaStore
      this.store = {
        version: parsed.version ?? STORE_VERSION,
        generation: (parsed.generation ?? 0) + 1,
        runs: parsed.runs ?? [],
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.ctx.logger?.error?.('[moyu-media] load failed', e)
      }
      this.store = { version: STORE_VERSION, generation: 1, runs: [] }
    }
    this.sequence = 0
    await this.recover()
  }

  private async recover(): Promise<void> {
    let changed = false
    for (const run of this.store.runs) {
      if (run.status === 'running') {
        if (run.checkpoint) {
          // Has checkpoint — could resume, but M0 does not implement resume.
          // Mark interrupted so user can manually retry.
          run.status = 'interrupted'
        } else {
          run.status = 'interrupted'
        }
        run.finishedAt = Date.now()
        const event: RunEvent = {
          type: 'completed',
          runId: run.runId,
          status: 'interrupted',
          summary: 'run interrupted by host restart',
          generation: this.store.generation,
          sequence: this.nextSequence(),
        }
        run.events.push(event)
        changed = true
      }
      if (run.status === 'awaiting_user' && run.pendingRequest) {
        // Re-emit the server request so Client can restore approval UI
        changed = true
      }
    }
    this.activeRun = null
    if (changed) {
      try {
        await this.persist()
      } catch (e) {
        this.ctx.logger?.error?.('[moyu-media] recover persist failed', e)
        throw e
      }
    }
  }

  reEmitPendingRequests(): void {
    for (const run of this.store.runs) {
      if (run.status === 'awaiting_user' && run.pendingRequest) {
        this.emitRequest(run.pendingRequest)
      }
    }
  }

  private nextSequence(): number {
    return ++this.sequence
  }

  private sseBroadcast(eventType: string, data: unknown): void {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
    for (const conn of this.sseConnections) {
      conn.write(payload)
    }
  }

  private emit(event: RunEvent): void {
    this.sseBroadcast('notification', event)
    for (const listener of this.eventListeners) {
      listener(event)
    }
  }

  private emitRequest(request: ServerRequest): void {
    this.sseBroadcast('server_request', request)
    for (const listener of this.requestListeners) {
      listener(request)
    }
  }

  addSseConnection(conn: SseConnection): () => void {
    this.sseConnections.add(conn)
    return () => { this.sseConnections.delete(conn) }
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener)
    return () => { this.eventListeners.delete(listener) }
  }

  onRequest(listener: RequestListener): () => void {
    this.requestListeners.add(listener)
    return () => { this.requestListeners.delete(listener) }
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.store, null, 2)
    const write = (async () => {
      await this.writeChain.catch(() => {})
      await mkdir(resolveDataDir(), { recursive: true })
      const tmp = `${this.storeFile}.${randomUUID()}.tmp`
      await writeFile(tmp, snapshot, 'utf8')
      await rename(tmp, this.storeFile)
    })()
    this.writeChain = write.catch(() => {})
    return write
  }

  getRuns(): MediaRun[] {
    return this.store.runs
  }

  getRun(runId: string): MediaRun | undefined {
    return this.store.runs.find(r => r.runId === runId)
  }

  getGeneration(): number {
    return this.store.generation
  }

  async respondToRequest(response: ServerResponse): Promise<boolean> {
    const resolver = this.requestResolvers.get(response.requestId)
    if (resolver) {
      resolver(response)
      return true
    }
    // Handle persisted pending requests from restart recovery
    const run = this.store.runs.find(
      r => r.status === 'awaiting_user' && r.pendingRequest?.requestId === response.requestId,
    )
    if (!run) return false
    run.pendingRequest = undefined
    const generation = this.store.generation
    if (response.approved) {
      run.status = 'success'
      run.finishedAt = Date.now()
      const artifact: MediaArtifact = {
        artifactId: randomUUID(),
        revision: 1,
        kind: 'title',
        candidates: ['Recovered Title'],
        status: 'draft',
      }
      run.artifacts.push(artifact)
      const events: RunEvent[] = [
        { type: 'server_request_resolved', runId: run.runId, requestId: response.requestId, approved: true, generation, sequence: this.nextSequence() },
        { type: 'artifact_created', runId: run.runId, artifact, generation, sequence: this.nextSequence() },
        { type: 'completed', runId: run.runId, status: 'success', summary: 'resumed after restart', generation, sequence: this.nextSequence() },
      ]
      for (const event of events) {
        run.events.push(event)
        this.emit(event)
      }
    } else {
      run.status = 'cancelled'
      run.finishedAt = Date.now()
      const events: RunEvent[] = [
        { type: 'server_request_resolved', runId: run.runId, requestId: response.requestId, approved: false, generation, sequence: this.nextSequence() },
        { type: 'completed', runId: run.runId, status: 'cancelled', summary: 'user rejected after restart', generation, sequence: this.nextSequence() },
      ]
      for (const event of events) {
        run.events.push(event)
        this.emit(event)
      }
    }
    await this.persist()
    return true
  }

  async runMockTask(): Promise<string> {
    if (this.activeRun) throw new Error('a run is already active')

    const runId = randomUUID()
    const generation = this.store.generation
    const run: MediaRun = {
      runId,
      status: 'running',
      generation,
      events: [],
      artifacts: [],
      createdAt: Date.now(),
    }
    this.store.runs.push(run)
    this.activeRun = runId

    const pushEvent = (event: RunEvent) => {
      run.events.push(event)
      this.emit(event)
    }

    try {
      // 1. started
      pushEvent({
        type: 'started',
        runId,
        generation,
        sequence: this.nextSequence(),
      })
      await this.persist()

      // 2. progress × 3
      for (let i = 1; i <= 3; i++) {
        pushEvent({
          type: 'progress',
          runId,
          message: `mock step ${i}/3`,
          percent: Math.round((i / 3) * 100),
          generation,
          sequence: this.nextSequence(),
        })
      }
      await this.persist()

      // 3. server_request — pause and wait for response
      const requestId = randomUUID()
      const serverRequest: ServerRequest = {
        requestId,
        runId,
        action: 'confirm_publish',
        detail: 'Approve mock artifact publication?',
        ttlMs: 30_000,
      }
      // Install resolver BEFORE publishing request to prevent race
      const responsePromise = new Promise<ServerResponse>((resolve) => {
        this.requestResolvers.set(requestId, resolve)
      })
      run.status = 'awaiting_user'
      run.pendingRequest = serverRequest
      await this.persist()
      this.emitRequest(serverRequest)

      const response = await responsePromise
      this.requestResolvers.delete(requestId)

      // 4. server_request_resolved
      run.status = 'running'
      run.pendingRequest = undefined
      pushEvent({
        type: 'server_request_resolved',
        runId,
        requestId,
        approved: response.approved,
        generation,
        sequence: this.nextSequence(),
      })
      await this.persist()

      if (!response.approved) {
        run.status = 'cancelled'
        run.finishedAt = Date.now()
        pushEvent({
          type: 'completed',
          runId,
          status: 'cancelled',
          summary: 'user rejected approval',
          generation,
          sequence: this.nextSequence(),
        })
        await this.persist()
        this.activeRun = null
        return runId
      }

      // 5. artifact_created
      const artifact: MediaArtifact = {
        artifactId: randomUUID(),
        revision: 1,
        kind: 'title',
        candidates: ['Mock Title A', 'Mock Title B', 'Mock Title C'],
        status: 'draft',
      }
      run.artifacts.push(artifact)
      pushEvent({
        type: 'artifact_created',
        runId,
        artifact,
        generation,
        sequence: this.nextSequence(),
      })
      await this.persist()

      // 6. completed
      run.status = 'success'
      run.finishedAt = Date.now()
      pushEvent({
        type: 'completed',
        runId,
        status: 'success',
        summary: 'mock task completed',
        generation,
        sequence: this.nextSequence(),
      })
      await this.persist()
    } catch (e) {
      run.status = 'failed'
      run.finishedAt = Date.now()
      const event: RunEvent = {
        type: 'completed',
        runId,
        status: 'failed',
        summary: String((e as Error).message ?? e),
        generation,
        sequence: this.nextSequence(),
      }
      run.events.push(event)
      this.emit(event)
      await this.persist().catch(() => {})
    } finally {
      this.activeRun = null
    }

    return runId
  }

  async dispose(): Promise<void> {
    this.requestResolvers.clear()
    this.eventListeners.clear()
    this.requestListeners.clear()
    for (const conn of this.sseConnections) conn.end()
    this.sseConnections.clear()
    this.activeRun = null
    await this.persist().catch(() => {})
  }
}

const SUPPORTED_OPERATIONS = new Set(['list-runs', 'run-mock', 'respond', 'status', 'capabilities'])

export function apply(ctx: Context): Promise<void> {
  const svc = new MockMediaRunService(ctx)
  ctx.effect(() => () => svc.dispose())

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/moyu/media',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        let body: unknown
        try {
          body = await readBody(req)
        } catch {
          sendJson(res, 400, { error: 'request body must be valid JSON and <= 16KB' })
          return
        }
        const operation = (body as { operation?: unknown }).operation
        if (typeof operation !== 'string' || !SUPPORTED_OPERATIONS.has(operation)) {
          sendJson(res, 400, { error: 'unknown operation' })
          return
        }
        try {
          await svc.ready
          if (operation === 'capabilities') {
            const preset = (body as { preset?: unknown }).preset
            const caps = getSessionCapabilities(typeof preset === 'string' ? preset : 'moyu')
            sendJson(res, 200, { capabilities: caps })
            return
          }
          if (operation === 'list-runs') {
            sendJson(res, 200, { runs: svc.getRuns() })
            return
          }
          if (operation === 'status') {
            const runId = (body as { runId?: unknown }).runId
            if (typeof runId !== 'string') {
              sendJson(res, 400, { error: 'runId required' })
              return
            }
            const run = svc.getRun(runId)
            if (!run) {
              sendJson(res, 404, { error: 'run not found' })
              return
            }
            sendJson(res, 200, { run })
            return
          }
          if (operation === 'respond') {
            const requestId = (body as { requestId?: unknown }).requestId
            const approved = (body as { approved?: unknown }).approved
            if (typeof requestId !== 'string' || typeof approved !== 'boolean') {
              sendJson(res, 400, { error: 'requestId (string) and approved (boolean) required' })
              return
            }
            const ok = await svc.respondToRequest({ requestId, approved })
            if (!ok) {
              sendJson(res, 404, { error: 'no pending request with that id' })
              return
            }
            sendJson(res, 200, { ok: true })
            return
          }
          if (operation === 'run-mock') {
            const runId = await svc.runMockTask()
            sendJson(res, 200, { runId })
            return
          }
        } catch (e) {
          const message = String((e as Error).message ?? e).slice(0, 240)
          sendJson(res, 500, { error: message })
        }
      },
    }),
  )

  // SSE endpoint: Client subscribes for notification + server_request push
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/moyu/media/events',
      handler: async (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        await svc.ready
        const sseRes = res as unknown as {
          writeHead(status: number, headers: Record<string, string>): void
          write(chunk: string): boolean
          end(): void
          on?(event: string, cb: () => void): void
        }
        sseRes.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
        })
        sseRes.write('event: connected\ndata: {}\n\n')
        const remove = svc.addSseConnection(sseRes)
        sseRes.on?.('close', remove)
        // Re-emit pending requests on new SSE connection
        svc.reEmitPendingRequests()
      },
    }),
  )

  return svc.ready.then(() => {
    ctx.tools.register(
      defineTool({
        name: 'mock_media_task',
        description: 'Run a mock media task to exercise the run protocol (M0 spike only)',
        parameters: {},
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: { runId: { type: 'string' }, status: { type: 'string' } },
          },
          render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }],
        },
        execute: async () => {
          const runId = await svc.runMockTask()
          return { runId, status: 'started' }
        },
      }),
    )

    svc.reEmitPendingRequests()
  })
}
