import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { randomUUID } from 'node:crypto'
import { createReadStream, watch, type FSWatcher } from 'node:fs'
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'

import type {
  ArtifactStatus,
  DirectoryView,
  FileTokenOp,
  MediaArtifact,
  MediaDirectory,
  MediaRun,
  MediaSettings,
  MediaStore,
  PersistedSource,
  RunEvent,
  ServerRequest,
  ServerResponse as MediaServerResponse,
  SessionCapabilities,
  VideoListItem,
} from './types.js'

import {
  getSessionCapabilities,
  hasCapability,
} from './session-filter.js'
import { parseRangeHeader, resolveRange, MAX_MEDIA_BYTES } from './range.js'
import { matchSubtitleFiles, scanDirectory, toPersistedSource } from './scan.js'
import { isArtifactKind, isArtifactStatus, normalizeArtifact, normalizeCandidates } from './artifact.js'
import { MEDIA_PERSONA_TEXT } from './media-prompt.js'

export type { RunEvent, ServerRequest, ServerResponse, MediaArtifact, MediaRun, MediaStore, SessionCapabilities } from './types.js'
export {
  getSessionCapabilities,
  hasCapability,
  parseRangeHeader,
  resolveRange,
  normalizeCandidates,
  normalizeArtifact,
  MEDIA_PERSONA_TEXT,
}

export const name = 'moyu-media'
export const inject = ['tools', 'webServer']

const STORE_VERSION = 2
const MAX_BODY_BYTES = 16 * 1024
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024
const MAX_SUBTITLE_BYTES = 256 * 1024
const FILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_SUFFIXES = ['.srt', '.txt']
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const LIBRARY_TOKEN_OPS: readonly FileTokenOp[] = ['read', 'subtitle', 'thumbnail', 'artifact-bind']
const MEDIA_LIBRARY_SUBJECT = 'media-library'
const MEDIA_ONLY_TOOLS = ['video_scan', 'video_subtitle_read', 'media_artifact_save'] as const

type FileToken = {
  sourceId: string
  path: string
  sourceType: PersistedSource['sourceType']
  generation: number
  mtimeMs: number
  size: number
  subject: string
  ops: FileTokenOp[]
  expiresAt: number
}

function persistArtifact(item: MediaArtifact): Omit<MediaArtifact, 'videoFileId'> {
  const { videoFileId: _drop, ...rest } = item
  return rest
}

function agentPresetOf(exec: unknown): string {
  if (!exec || typeof exec !== 'object') return 'moyu'
  const agent = (exec as { agent?: Record<string, unknown> }).agent
  if (!agent || typeof agent !== 'object') return 'moyu'
  const session = agent.session
  if (session && typeof session === 'object') {
    const rec = session as Record<string, unknown>
    if (typeof rec.agentPreset === 'string' && rec.agentPreset.trim()) return rec.agentPreset.trim()
    const header = rec.header as Record<string, unknown> | undefined
    if (typeof header?.agentPreset === 'string' && header.agentPreset.trim()) return header.agentPreset.trim()
    if (Array.isArray(rec.events)) {
      for (let i = rec.events.length - 1; i >= 0; i--) {
        const ev = rec.events[i] as { type?: string; data?: { agentPreset?: string } }
        if (ev?.type === 'agent-preset/selected' && typeof ev.data?.agentPreset === 'string') {
          return ev.data.agentPreset
        }
      }
    }
  }
  const nested =
    (agent.preset as { id?: string } | string | undefined) ??
    (agent.meta as { agentPreset?: string } | undefined)?.agentPreset ??
    (agent.setup as { meta?: { agentPreset?: string } } | undefined)?.meta?.agentPreset
  if (typeof nested === 'string' && nested.trim()) return nested.trim()
  if (nested && typeof nested === 'object' && typeof nested.id === 'string') return nested.id
  return 'moyu'
}

function assertMediaToolAccess(exec: unknown): void {
  if (agentPresetOf(exec) !== 'media') {
    throw new Error('not available in this session')
  }
}

function sessionSubjectOf(exec: unknown): string | undefined {
  if (!exec || typeof exec !== 'object') return undefined
  const agent = (exec as { agent?: Record<string, unknown> }).agent
  if (!agent || typeof agent !== 'object') return undefined
  if (typeof agent.id === 'string' && agent.id.trim()) return agent.id.trim()
  const session = agent.session
  if (session && typeof session === 'object') {
    const id = (session as { id?: unknown }).id
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return undefined
}

function requireToolSubject(exec: unknown): string {
  const subject = sessionSubjectOf(exec)
  if (!subject) throw new Error('not found')
  return subject
}

function defaultSettings(): MediaSettings {
  return { directories: [], subtitleSuffixes: [...DEFAULT_SUFFIXES], inventoryThreshold: 3 }
}

function emptyStore(generation = 0): MediaStore {
  return { version: STORE_VERSION, generation, runs: [], settings: defaultSettings(), sources: [], artifacts: [] }
}

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

function readRawBody(req: NodeJS.ReadableStream, limit: number): Promise<Buffer> {
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
    const onEnd = () => resolve(Buffer.concat(chunks))
    const stream = req as NodeJS.ReadableStream & {
      on?: (ev: string, cb: (chunk?: unknown) => void) => void
    }
    if (stream.on) {
      stream.on('data', onData as (chunk: unknown) => void)
      stream.on('end', onEnd)
      stream.on('error', reject)
    } else {
      resolve(Buffer.alloc(0))
    }
  })
}

function pipeFile(
  filePath: string,
  start: number,
  end: number,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const stream = createReadStream(filePath, { start, end })
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      stream.destroy()
      reject(error)
    }
    const onDrain = () => stream.resume()
    stream.on('error', fail)
    req.on?.('close', () => {
      stream.destroy()
      finish()
    })
    res.on?.('close', () => {
      stream.destroy()
      finish()
    })
    stream.on('data', (chunk: Buffer | string) => {
      const ok = res.write(chunk)
      if (ok === false) {
        stream.pause()
        if (typeof res.once === 'function') res.once('drain', onDrain)
        else stream.resume()
      }
    })
    stream.on('end', () => {
      res.end()
      finish()
    })
  })
}

type EventListener = (event: RunEvent) => void
type RequestListener = (request: ServerRequest) => void

interface SseConnection {
  write(data: string): boolean
  end(): void
}

export class MockMediaRunService extends Service {
  private store: MediaStore = emptyStore()
  private storeFile = join(resolveDataDir(), 'store.json')
  private writeChain: Promise<void> = Promise.resolve()
  private sequence = 0
  private eventListeners = new Set<EventListener>()
  private requestListeners = new Set<RequestListener>()
  private sseConnections = new Set<SseConnection>()
  private activeRun: string | null = null
  private requestResolvers = new Map<string, (response: MediaServerResponse) => void>()
  private tokens = new Map<string, FileToken>()
  // UI-F03: 目录实时监听。fs.watch 结果防抖后重扫 + SSE 主动推送，Client 不轮询。
  private watchers = new Set<FSWatcher>()
  private watchDebounce: ReturnType<typeof setTimeout> | null = null
  private rescanInFlight = false
  private rescanQueued = false
  ready: Promise<void>

  constructor(ctx: Context) {
    super(ctx, 'moyuMedia')
    this.ready = this.load()
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.storeFile, 'utf8')
      const parsed = JSON.parse(raw) as Partial<MediaStore>
      this.store = {
        version: STORE_VERSION,
        generation: (parsed.generation ?? 0) + 1,
        runs: parsed.runs ?? [],
        settings: {
          directories: Array.isArray(parsed.settings?.directories) ? parsed.settings.directories : [],
          subtitleSuffixes: Array.isArray(parsed.settings?.subtitleSuffixes) && parsed.settings.subtitleSuffixes.length
            ? parsed.settings.subtitleSuffixes
            : [...DEFAULT_SUFFIXES],
          inventoryThreshold: typeof parsed.settings?.inventoryThreshold === 'number' && parsed.settings.inventoryThreshold >= 1
            ? Math.min(99, Math.trunc(parsed.settings.inventoryThreshold))
            : 3,
        },
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        artifacts: (Array.isArray(parsed.artifacts)
          ? parsed.artifacts
          : (parsed.runs ?? []).flatMap((run) => run.artifacts ?? [])
        ).map((item) => normalizeArtifact(item)).filter((item): item is MediaArtifact => item !== null),
      }
      for (const run of this.store.runs) {
        run.artifacts = (run.artifacts ?? []).map((item) => normalizeArtifact(item)).filter((item): item is MediaArtifact => item !== null)
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.ctx.logger?.error?.('[moyu-media] load failed', e)
      }
      this.store = emptyStore(1)
    }
    this.sequence = 0
    this.tokens.clear()
    await this.recover()
    await this.reissueTokens()
    if (this.store.settings.directories.length > 0) {
      await this.scan().catch((err) => {
        this.ctx.logger?.error?.('[moyu-media] startup scan failed', err)
      })
    }
    this.startWatching()
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
    const snapshot = JSON.stringify(
      {
        ...this.store,
        artifacts: this.store.artifacts.map(persistArtifact),
        runs: this.store.runs.map((run) => ({
          ...run,
          artifacts: (run.artifacts ?? []).map(persistArtifact),
        })),
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

  private thumbnailPath(sourceId: string): string {
    return join(resolveDataDir(), 'thumbnails', `${sourceId}.jpg`)
  }

  private issueToken(
    source: PersistedSource,
    options?: { ops?: readonly FileTokenOp[]; subject?: string; ttlMs?: number },
  ): string {
    const fileId = randomUUID()
    this.tokens.set(fileId, {
      sourceId: source.sourceId,
      path: source.path,
      sourceType: source.sourceType,
      generation: this.store.generation,
      mtimeMs: source.mtimeMs,
      size: source.size,
      subject: options?.subject ?? MEDIA_LIBRARY_SUBJECT,
      ops: [...(options?.ops ?? LIBRARY_TOKEN_OPS)],
      expiresAt: Date.now() + (options?.ttlMs ?? TOKEN_TTL_MS),
    })
    return fileId
  }

  private async reissueTokens(): Promise<void> {
    this.tokens.clear()
    for (const source of this.store.sources) {
      this.issueToken(source)
    }
  }

  private tokenFor(fileId: string, op: FileTokenOp, subject: string): FileToken | undefined {
    if (!subject || !FILE_ID_RE.test(fileId)) return undefined
    const token = this.tokens.get(fileId)
    if (!token || token.generation !== this.store.generation) return undefined
    if (token.expiresAt <= Date.now()) return undefined
    if (!token.ops.includes(op)) return undefined
    if (token.subject === subject) return token
    // Shared project sources: media-library tokens may be consumed by a media
    // session Tool. HTTP always presents media-library itself (exact match).
    if (token.subject === MEDIA_LIBRARY_SUBJECT && subject !== MEDIA_LIBRARY_SUBJECT) return token
    return undefined
  }

  /** Test/harness: mint a capability token with explicit subject, ops, and TTL. */
  issueCapabilityToken(
    sourceId: string,
    options: { ops: readonly FileTokenOp[]; subject: string; ttlMs?: number },
  ): string | undefined {
    const source = this.store.sources.find((item) => item.sourceId === sourceId)
    if (!source) return undefined
    return this.issueToken(source, options)
  }

  inspectToken(fileId: string, op: FileTokenOp, subject: string): FileToken | undefined {
    return this.tokenFor(fileId, op, subject)
  }

  private fileIdForSource(sourceId: string, subject: string = MEDIA_LIBRARY_SUBJECT): string | undefined {
    for (const [fileId, token] of this.tokens) {
      if (token.sourceId === sourceId && token.subject === subject) return fileId
    }
    return undefined
  }

  private publicError(error: unknown): string {
    return String((error as Error).message ?? error)
      .replace(/\/Users\/[^ "'\n]+/g, '[path]')
      .replace(/[A-Z]:\\[^ "'\n]+/g, '[path]')
      .slice(0, 240)
  }

  settingsView(): { directories: DirectoryView[]; subtitleSuffixes: string[]; inventoryThreshold: number } {
    return {
      directories: this.store.settings.directories.map((d) => ({
        id: d.id,
        label: basename(d.path) || d.id,
      })),
      subtitleSuffixes: this.store.settings.subtitleSuffixes,
      inventoryThreshold: this.store.settings.inventoryThreshold,
    }
  }

  listVideos(): VideoListItem[] {
    return this.store.sources.map((source) => {
      let fileId = this.fileIdForSource(source.sourceId, MEDIA_LIBRARY_SUBJECT)
      if (!fileId) fileId = this.issueToken(source, { subject: MEDIA_LIBRARY_SUBJECT })
      return {
        sourceId: source.sourceId,
        fileId,
        fileName: basename(source.path),
        size: source.size,
        mtimeMs: source.mtimeMs,
        durationMs: source.durationMs,
        subtitles: source.subtitles,
        hasThumbnail: source.thumbnailMtimeMs === source.mtimeMs,
      }
    })
  }

  async scan(): Promise<VideoListItem[]> {
    const suffixes = this.store.settings.subtitleSuffixes
    const found: PersistedSource[] = []
    const seen = new Set<string>()
    for (const directory of this.store.settings.directories) {
      let videos
      try {
        videos = await scanDirectory(directory.path, suffixes)
      } catch (e) {
        this.ctx.logger?.warn?.('[moyu-media] scan directory skipped', this.publicError(e))
        continue
      }
      for (const video of videos) {
        const next = toPersistedSource(video, 'project-source')
        if (seen.has(next.sourceId)) continue
        seen.add(next.sourceId)
        const previous = this.store.sources.find((s) => s.sourceId === next.sourceId)
        if (previous && previous.mtimeMs === next.mtimeMs && previous.size === next.size) {
          next.thumbnailMtimeMs = previous.thumbnailMtimeMs
          next.durationMs = previous.durationMs ?? next.durationMs
        } else if (previous) {
          await rm(this.thumbnailPath(next.sourceId), { force: true }).catch(() => {})
          next.thumbnailMtimeMs = null
        }
        found.push(next)
      }
    }
    for (const old of this.store.sources) {
      if (!seen.has(old.sourceId)) {
        await rm(this.thumbnailPath(old.sourceId), { force: true }).catch(() => {})
      }
    }
    this.store.sources = found
    await this.reissueTokens()
    await this.persist()
    return this.listVideos()
  }

  // UI-F03: 为当前所有已配置目录建立监听。macOS 支持 recursive；不可访问的目录跳过并告警。
  startWatching(): void {
    this.stopWatching()
    for (const directory of this.store.settings.directories) {
      try {
        const w = watch(directory.path, { recursive: true }, () => this.scheduleRescan())
        w.on('error', (e) => this.ctx.logger?.warn?.('[moyu-media] watch error', this.publicError(e)))
        this.watchers.add(w)
      } catch (e) {
        this.ctx.logger?.warn?.('[moyu-media] watch directory skipped', this.publicError(e))
      }
    }
  }

  private stopWatching(): void {
    for (const w of this.watchers) {
      try { w.close() } catch { /* already closed */ }
    }
    this.watchers.clear()
  }

  // 防抖 + 合并：复制大文件会连发很多事件；等空档再重扫，重扫期间又来的事件排队一次。
  private scheduleRescan(): void {
    if (this.watchDebounce) clearTimeout(this.watchDebounce)
    this.watchDebounce = setTimeout(() => {
      this.watchDebounce = null
      void this.runRescan()
    }, 800)
  }

  private async runRescan(): Promise<void> {
    if (this.rescanInFlight) { this.rescanQueued = true; return }
    this.rescanInFlight = true
    try {
      const videos = await this.scan()
      this.sseBroadcast('media-updated', { count: videos.length })
    } catch (e) {
      this.ctx.logger?.warn?.('[moyu-media] auto rescan failed', this.publicError(e))
    } finally {
      this.rescanInFlight = false
      if (this.rescanQueued) { this.rescanQueued = false; this.scheduleRescan() }
    }
  }

  async setSuffixes(suffixes: unknown): Promise<{ directories: DirectoryView[]; subtitleSuffixes: string[] }> {
    if (!Array.isArray(suffixes)) throw new Error('subtitleSuffixes required')
    const next: string[] = []
    for (const item of suffixes) {
      if (typeof item !== 'string') continue
      const suffix = item.startsWith('.') ? item.toLowerCase() : `.${item.toLowerCase()}`
      if (!/^\.[a-z0-9]{1,8}$/.test(suffix)) continue
      if (!next.includes(suffix)) next.push(suffix)
    }
    this.store.settings.subtitleSuffixes = next.length ? next : [...DEFAULT_SUFFIXES]
    await this.persist()
    return this.settingsView()
  }

  async setInventoryThreshold(value: unknown): Promise<{ directories: DirectoryView[]; subtitleSuffixes: string[]; inventoryThreshold: number }> {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n) || n < 1 || n > 99) throw new Error('inventoryThreshold must be 1-99')
    this.store.settings.inventoryThreshold = Math.trunc(n)
    await this.persist()
    return this.settingsView()
  }

  async removeDirectory(id: string): Promise<{ directories: DirectoryView[]; subtitleSuffixes: string[] }> {
    this.store.settings.directories = this.store.settings.directories.filter((d) => d.id !== id)
    await this.persist()
    await this.scan()
    this.startWatching()
    return this.settingsView()
  }

  async addDirectoryPath(path: string): Promise<{ directories: DirectoryView[]; subtitleSuffixes: string[] }> {
    if (typeof path !== 'string' || !path) throw new Error('directory required')
    const resolved = await realpath(path)
    const info = await stat(resolved)
    if (!info.isDirectory()) throw new Error('directory required')
    if (this.store.settings.directories.some((d) => d.path === resolved)) return this.settingsView()
    const entry: MediaDirectory = { id: randomUUID(), path: resolved }
    this.store.settings.directories.push(entry)
    await this.persist()
    await this.scan()
    this.startWatching()
    return this.settingsView()
  }

  async pickDirectory(): Promise<{ directories: DirectoryView[]; subtitleSuffixes: string[] } | { canceled: true }> {
    const desktop = (globalThis as { __moyuDesktop?: { call: (method: string, payload?: unknown) => Promise<unknown> } }).__moyuDesktop
    if (!desktop) throw new Error('Moyu 桌面桥尚未就绪')
    const picked = await desktop.call('desktop.pickDirectory') as { canceled?: boolean; directory?: { fileId?: string } }
    if (picked?.canceled || !picked?.directory?.fileId) return { canceled: true }
    const resolved = await desktop.call('desktop.resolveFile', { fileId: picked.directory.fileId }) as { path?: string }
    if (!resolved?.path) throw new Error('directory required')
    return this.addDirectoryPath(resolved.path)
  }

  async subtitleText(fileId: string, subject: string): Promise<{ files: Array<{ fileName: string; text: string }> }> {
    const token = this.tokenFor(fileId, 'subtitle', subject)
    if (!token) return Promise.reject(Object.assign(new Error('not found'), { status: 404 }))
    const suffixes = this.store.settings.subtitleSuffixes
    const matched = matchSubtitleFiles(token.path, suffixes)
    const files: Array<{ fileName: string; text: string }> = []
    for (const item of matched) {
      const full = join(dirname(token.path), item.fileName)
      try {
        const raw = await readFile(full, { encoding: 'utf8' })
        files.push({ fileName: item.fileName, text: raw.slice(0, MAX_SUBTITLE_BYTES) })
      } catch {
        // skip unreadable subtitle; do not leak path
      }
    }
    return { files }
  }

  async readSubtitles(fileId: string, subject: string): Promise<{ text: string; files: Array<{ label: string; fileName: string }> }> {
    const token = this.tokenFor(fileId, 'subtitle', subject)
    if (!token) throw Object.assign(new Error('not found'), { status: 404 })
    const { files } = await this.subtitleText(fileId, subject)
    return {
      text: files.map((file) => file.text).join('\n\n'),
      files: files.map((file) => ({
        label: file.fileName.replace(/\.[^.]+$/, ''),
        fileName: file.fileName,
      })),
    }
  }

  listArtifacts(): MediaArtifact[] {
    return this.store.artifacts.map((item) => this.artifactView(item))
  }

  private artifactView(item: MediaArtifact): MediaArtifact {
    const view: MediaArtifact = { ...item }
    if (item.videoSourceId) {
      const fileId = this.fileIdForSource(item.videoSourceId, MEDIA_LIBRARY_SUBJECT)
      if (fileId) view.videoFileId = fileId
      else delete view.videoFileId
    } else {
      delete view.videoFileId
    }
    return view
  }

  personaText(): string {
    return MEDIA_PERSONA_TEXT
  }

  async saveArtifact(input: {
    kind: unknown
    candidates: unknown
    videoFileId?: unknown
    parentArtifactId?: unknown
    platform?: unknown
    feedbackSessionId?: unknown
    subject: string
  }): Promise<MediaArtifact> {
    if (!isArtifactKind(input.kind)) throw new Error('kind required')
    const candidates = normalizeCandidates(input.candidates)
    if (candidates.length === 0) throw new Error('candidates required')
    let revision = 1
    let parentArtifactId: string | undefined
    if (typeof input.parentArtifactId === 'string' && input.parentArtifactId) {
      const parent = this.store.artifacts.find((item) => item.artifactId === input.parentArtifactId)
      if (!parent) throw Object.assign(new Error('not found'), { status: 404 })
      parentArtifactId = parent.artifactId
      revision = parent.revision + 1
    }
    if (typeof input.videoFileId === 'string' && input.videoFileId) {
      const token = this.tokenFor(input.videoFileId, 'artifact-bind', input.subject)
      if (!token) throw Object.assign(new Error('not found'), { status: 404 })
    }
    const artifact: MediaArtifact = {
      artifactId: randomUUID(),
      revision,
      kind: input.kind,
      candidates,
      status: 'draft',
      createdAt: Date.now(),
    }
    if (parentArtifactId) artifact.parentArtifactId = parentArtifactId
    if (typeof input.videoFileId === 'string' && input.videoFileId) {
      const token = this.tokenFor(input.videoFileId, 'artifact-bind', input.subject)
      if (token) artifact.videoSourceId = token.sourceId
    }
    if (typeof input.platform === 'string' && input.platform) artifact.platform = input.platform
    if (typeof input.feedbackSessionId === 'string' && input.feedbackSessionId) {
      artifact.feedbackSessionId = input.feedbackSessionId
    }
    this.store.artifacts.push(artifact)
    const view = this.artifactView(artifact)
    const event: RunEvent = {
      type: 'artifact_created',
      runId: 'media-library',
      artifact: view,
      generation: this.store.generation,
      sequence: this.nextSequence(),
    }
    this.emit(event)
    await this.persist()
    return view
  }

  async setArtifactStatus(artifactId: string, status: unknown): Promise<MediaArtifact> {
    if (!isArtifactStatus(status) || status === 'draft') throw new Error('status required')
    const artifact = this.store.artifacts.find((item) => item.artifactId === artifactId)
    if (!artifact) throw Object.assign(new Error('not found'), { status: 404 })
    artifact.status = status
    await this.persist()
    return this.artifactView(artifact)
  }

  logRange(req: IncomingMessage, pathname: string): void {
    const range = req.headers.range
    this.ctx.logger?.info?.(
      `[moyu-media][range] method=${req.method || ''} path=${pathname} range=${JSON.stringify(range ?? null)}`,
    )
    console.log(`[moyu-media][range] method=${req.method || ''} path=${pathname} range=${JSON.stringify(range ?? null)}`)
  }

  async serveFile(fileId: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const token = this.tokenFor(fileId, 'read', MEDIA_LIBRARY_SUBJECT)
    if (!token) {
      sendJson(res, 404, { error: 'not found' })
      return
    }
    const pathname = `/moyu/media/${fileId}`
    this.logRange(req, pathname)
    const size = token.size
    // UI-F05: .mov 作为 QuickTime 容器返回，其余按 MP4。
    const contentType = token.path.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'
    if (size > MAX_MEDIA_BYTES) {
      sendJson(res, 404, { error: 'not found' })
      return
    }
    const method = (req.method || 'GET').toUpperCase()
    if (method === 'HEAD') {
      res.writeHead(200, {
        'accept-ranges': 'bytes',
        'content-type': contentType,
        'content-length': String(size),
      })
      res.end()
      return
    }
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }
    const header = Array.isArray(req.headers.range) ? req.headers.range[0] : req.headers.range
    const resolved = resolveRange(header, size)
    if (resolved.type === 'bad-request') {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
      res.end()
      return
    }
    if (resolved.type === 'unsatisfiable') {
      res.writeHead(416, {
        'content-range': `bytes */${size}`,
        'accept-ranges': 'bytes',
      })
      res.end()
      return
    }
    if (resolved.type === 'full') {
      res.writeHead(200, {
        'accept-ranges': 'bytes',
        'content-type': contentType,
        'content-length': String(size),
      })
      await pipeFile(token.path, 0, size - 1, req, res)
      return
    }
    const length = resolved.end - resolved.start + 1
    res.writeHead(206, {
      'accept-ranges': 'bytes',
      'content-type': contentType,
      'content-range': `bytes ${resolved.start}-${resolved.end}/${size}`,
      'content-length': String(length),
    })
    await pipeFile(token.path, resolved.start, resolved.end, req, res)
  }

  async serveThumbnail(fileId: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const token = this.tokenFor(fileId, 'thumbnail', MEDIA_LIBRARY_SUBJECT)
    if (!token) {
      sendJson(res, 404, { error: 'not found' })
      return
    }
    const source = this.store.sources.find((s) => s.sourceId === token.sourceId)
    if (!source) {
      sendJson(res, 404, { error: 'not found' })
      return
    }
    const method = (req.method || 'GET').toUpperCase()
    const thumb = this.thumbnailPath(source.sourceId)
    if (method === 'GET' || method === 'HEAD') {
      if (source.thumbnailMtimeMs !== source.mtimeMs) {
        sendJson(res, 404, { error: 'not found' })
        return
      }
      try {
        const data = method === 'HEAD' ? null : await readFile(thumb)
        res.writeHead(200, {
          'content-type': 'image/jpeg',
          'cache-control': 'no-store',
        })
        if (method === 'HEAD') res.end()
        else res.end(data as Buffer)
      } catch {
        sendJson(res, 404, { error: 'not found' })
      }
      return
    }
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'method not allowed' })
      return
    }
    let body: Buffer
    try {
      body = await readRawBody(req, MAX_THUMBNAIL_BYTES)
    } catch {
      sendJson(res, 400, { error: 'not found' })
      return
    }
    if (!body.length) {
      sendJson(res, 400, { error: 'not found' })
      return
    }
    await mkdir(join(resolveDataDir(), 'thumbnails'), { recursive: true })
    const tmp = `${thumb}.${randomUUID()}.tmp`
    await writeFile(tmp, body)
    await rename(tmp, thumb)
    source.thumbnailMtimeMs = source.mtimeMs
    await this.persist()
    res.writeHead(204)
    res.end()
  }

  async respondToRequest(response: MediaServerResponse): Promise<boolean> {
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
        candidates: [{ content: 'Recovered Title' }],
        status: 'draft',
        createdAt: Date.now(),
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
      const responsePromise = new Promise<MediaServerResponse>((resolve) => {
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
        candidates: [
          { content: 'Mock Title A' },
          { content: 'Mock Title B' },
          { content: 'Mock Title C' },
        ],
        status: 'draft',
        createdAt: Date.now(),
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
    this.stopWatching()
    if (this.watchDebounce) { clearTimeout(this.watchDebounce); this.watchDebounce = null }
    for (const conn of this.sseConnections) conn.end()
    this.sseConnections.clear()
    this.activeRun = null
    await this.persist().catch(() => {})
  }
}

const SUPPORTED_OPERATIONS = new Set([
  'list-runs',
  'run-mock',
  'respond',
  'status',
  'capabilities',
  'scan',
  'list',
  'settings-get',
  'settings-pick-directory',
  'settings-remove-directory',
  'settings-set-suffixes',
  'settings-set-threshold',
  'subtitle-text',
  'list-artifacts',
  'artifact-save',
  'artifact-set-status',
  'instructions',
])

export function apply(ctx: Context): Promise<void> {
  const svc = new MockMediaRunService(ctx)
  ;(ctx as { moyuMedia?: MockMediaRunService }).moyuMedia = svc
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
          if (operation === 'scan') {
            sendJson(res, 200, { videos: await svc.scan() })
            return
          }
          if (operation === 'list') {
            sendJson(res, 200, { videos: svc.listVideos() })
            return
          }
          if (operation === 'settings-get') {
            sendJson(res, 200, svc.settingsView())
            return
          }
          if (operation === 'settings-pick-directory') {
            const result = await svc.pickDirectory()
            sendJson(res, 200, result)
            return
          }
          if (operation === 'settings-remove-directory') {
            const id = (body as { id?: unknown }).id
            if (typeof id !== 'string') {
              sendJson(res, 400, { error: 'id required' })
              return
            }
            sendJson(res, 200, await svc.removeDirectory(id))
            return
          }
          if (operation === 'settings-set-suffixes') {
            sendJson(res, 200, await svc.setSuffixes((body as { subtitleSuffixes?: unknown }).subtitleSuffixes))
            return
          }
          if (operation === 'settings-set-threshold') {
            sendJson(res, 200, await svc.setInventoryThreshold((body as { inventoryThreshold?: unknown }).inventoryThreshold))
            return
          }
          if (operation === 'subtitle-text') {
            const fileId = (body as { fileId?: unknown }).fileId
            if (typeof fileId !== 'string') {
              sendJson(res, 404, { error: 'not found' })
              return
            }
            try {
              sendJson(res, 200, await svc.subtitleText(fileId, MEDIA_LIBRARY_SUBJECT))
            } catch (e) {
              if ((e as { status?: number }).status === 404) sendJson(res, 404, { error: 'not found' })
              else throw e
            }
            return
          }
          if (operation === 'list-artifacts') {
            sendJson(res, 200, { artifacts: svc.listArtifacts() })
            return
          }
          if (operation === 'instructions') {
            sendJson(res, 200, { text: svc.personaText() })
            return
          }
          if (operation === 'artifact-save') {
            try {
              const artifact = await svc.saveArtifact({
                ...(body as {
                  kind: unknown
                  candidates: unknown
                  videoFileId?: unknown
                  parentArtifactId?: unknown
                  platform?: unknown
                }),
                subject: MEDIA_LIBRARY_SUBJECT,
              })
              sendJson(res, 200, { artifact })
            } catch (e) {
              if ((e as { status?: number }).status === 404) sendJson(res, 404, { error: 'not found' })
              else throw e
            }
            return
          }
          if (operation === 'artifact-set-status') {
            const artifactId = (body as { artifactId?: unknown }).artifactId
            const statusValue = (body as { status?: unknown }).status
            if (typeof artifactId !== 'string') {
              sendJson(res, 404, { error: 'not found' })
              return
            }
            try {
              sendJson(res, 200, { artifact: await svc.setArtifactStatus(artifactId, statusValue) })
            } catch (e) {
              if ((e as { status?: number }).status === 404) sendJson(res, 404, { error: 'not found' })
              else throw e
            }
            return
          }
        } catch (e) {
          const message = String((e as Error).message ?? e).slice(0, 240)
          sendJson(res, 500, { error: message })
        }
      },
    }),
  )

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/moyu/media',
      handler: async (req, res) => {
        const pathname = (() => {
          try {
            return decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname)
          } catch {
            return ''
          }
        })()
        const parts = pathname.split('/').filter(Boolean)
        // /moyu/media/:fileId  or  /moyu/media/:fileId/thumbnail
        if (parts.length < 3 || parts[0] !== 'moyu' || parts[1] !== 'media') {
          sendJson(res, 404, { error: 'not found' })
          return
        }
        const fileId = parts[2]
        await svc.ready
        if (parts.length === 4 && parts[3] === 'thumbnail') {
          await svc.serveThumbnail(fileId, req, res)
          return
        }
        if (parts.length === 3) {
          await svc.serveFile(fileId, req, res)
          return
        }
        sendJson(res, 404, { error: 'not found' })
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

  const toolsApi = ctx.tools as {
    register: typeof ctx.tools.register
    guard?: (guard: (execution: { name: string; agent?: unknown }) => string | undefined) => () => void
  }
  if (typeof toolsApi.guard === 'function') {
    toolsApi.guard((execution) => {
      if (!(MEDIA_ONLY_TOOLS as readonly string[]).includes(execution.name)) return undefined
      if (agentPresetOf(execution) !== 'media') return 'not available in this session'
      return undefined
    })
  }
  const maybeOn = (ctx as { on?: (event: string, listener: (session: unknown) => void, options?: { global?: boolean }) => void }).on
  if (typeof maybeOn === 'function') {
    maybeOn('session/created', (session) => {
      const preset = agentPresetOf({ agent: { session } })
      const agent = (session as { agent?: { ctx?: { tools?: { restrict?: (filter: { deny: string[] }) => void } } } })?.agent
      if (preset !== 'media') {
        agent?.ctx?.tools?.restrict?.({ deny: [...MEDIA_ONLY_TOOLS] })
      }
    }, { global: true })
  }

  return svc.ready.then(() => {
    ctx.tools.register(
      defineTool({
        name: 'video_scan',
        description: 'Scan configured video directories and return the indexed media library (file names, duration, size, subtitle association). Does not transcode.',
        parameters: {},
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              videos: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    sourceId: { type: 'string' },
                    fileId: { type: 'string' },
                    fileName: { type: 'string' },
                    size: { type: 'number' },
                    mtimeMs: { type: 'number' },
                    durationMs: { type: 'number' },
                    hasThumbnail: { type: 'boolean' },
                  },
                },
              },
            },
          },
          render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }],
        },
        execute: async (_args: Record<string, never>, exec: ToolRunContext) => {
          assertMediaToolAccess(exec)
          return {
          videos: (await svc.scan()).map((video) => ({
            sourceId: video.sourceId,
            fileId: video.fileId,
            fileName: video.fileName,
            size: video.size,
            mtimeMs: video.mtimeMs,
            durationMs: video.durationMs ?? undefined,
            hasThumbnail: video.hasThumbnail,
          })),
          }
        },
      }),
    )

    ctx.tools.register(
      defineTool({
        name: 'video_subtitle_read',
        description: 'Read same-stem subtitle text for a video fileId. Returns basename labels only, never filesystem paths. Empty files array when no subtitle exists.',
        parameters: {
          videoFileId: { type: 'string', required: true },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              text: { type: 'string' },
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    label: { type: 'string' },
                    fileName: { type: 'string' },
                  },
                },
              },
            },
          },
          render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }],
        },
        execute: async (args: { videoFileId?: string }, exec: ToolRunContext) => {
          assertMediaToolAccess(exec)
          const subject = requireToolSubject(exec)
          if (typeof args?.videoFileId !== 'string' || !args.videoFileId) throw new Error('not found')
          try {
            return await svc.readSubtitles(args.videoFileId, subject)
          } catch (e) {
            if ((e as { status?: number }).status === 404) throw new Error('not found')
            throw e
          }
        },
      }),
    )

    ctx.tools.register(
      defineTool({
        name: 'media_artifact_save',
        description: 'Persist generated media candidates as a draft MediaArtifact. Deterministic write only; does not call a model.',
        parameters: {
          kind: { type: 'string', enum: ['tags', 'title', 'cover', 'script', 'subtitle', 'bundle'], required: true },
          candidates: { type: 'array', required: true },
          videoFileId: { type: 'string' },
          parentArtifactId: { type: 'string' },
          platform: { type: 'string' },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: true,
            properties: {
              artifactId: { type: 'string' },
              revision: { type: 'number' },
              kind: { type: 'string' },
              status: { type: 'string' },
            },
          },
          render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }],
        },
        execute: async (args, exec: ToolRunContext) => {
          assertMediaToolAccess(exec)
          const subject = requireToolSubject(exec)
          try {
            const artifact = await svc.saveArtifact({
              kind: args.kind,
              candidates: args.candidates,
              videoFileId: args.videoFileId,
              parentArtifactId: args.parentArtifactId,
              platform: args.platform,
              subject,
            })
            return JSON.parse(JSON.stringify(artifact))
          } catch (e) {
            if ((e as { status?: number }).status === 404) throw new Error('not found')
            throw e
          }
        },
      }),
    )

    svc.reEmitPendingRequests()
  })
}
