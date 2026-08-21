import { randomUUID } from 'node:crypto'

export const name = 'moyu-screenshot'
export const inject = ['webServer']

const DEFAULT_STAGE_TIMEOUT_MS = 120_000
const DEFAULT_RESULT_RETENTION_MS = 60 * 60_000

function desktop() {
  if (!globalThis.__moyuDesktop) throw new Error('Moyu 桌面桥尚未就绪')
  return globalThis.__moyuDesktop
}

function publicError(error) {
  const message = String(error?.message || error || '截图失败')
  return message
    .replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i, '')
    .replace(/\/Users\/[^ "'\n]+/g, '[path]')
    .slice(0, 240)
}

function isTerminal(job) {
  return ['completed', 'cancelled', 'failed'].includes(job.status)
}

function serialize(job) {
  const value = {
    jobId: job.id,
    status: job.status,
    phase: job.phase,
    reason: job.reason,
    error: job.error
  }
  if (job.status === 'completed') {
    value.resultStatus = job.resultExpired ? 'expired' : 'available'
    if (!job.resultExpired && job.result) value.result = job.result
  }
  return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined))
}

function requireJob(jobs, id) {
  if (typeof id !== 'string' || !id) throw new Error('job_id 必须是非空字符串')
  const job = jobs.get(id)
  if (!job) throw new Error('截图任务不存在或已失效')
  return job
}

function defaultCapture({ signal } = {}) {
  if (signal?.aborted) throw Object.assign(new Error('TASK_CANCELLED'), { code: 'TASK_CANCELLED' })
  return desktop().call('desktop.requestScreenCapture')
}

function defaultSelect() {
  throw new Error('截图 overlay 尚未接入新协议')
}

export function createScreenshotService(options = {}) {
  const capture = options.capture || defaultCapture
  const select = options.select || defaultSelect
  const createId = options.createId || randomUUID
  const stageTimeoutMs = options.stageTimeoutMs || DEFAULT_STAGE_TIMEOUT_MS
  const resultRetentionMs = options.resultRetentionMs || DEFAULT_RESULT_RETENTION_MS
  const timers = options.timers || { setTimeout, clearTimeout }
  const jobs = new Map()
  let activeJobId = null

  const clearStageTimer = (job) => {
    if (!job.stageTimer) return
    timers.clearTimeout(job.stageTimer)
    job.stageTimer = undefined
  }

  const finish = (job, status, patch = {}) => {
    if (isTerminal(job)) return serialize(job)
    clearStageTimer(job)
    job.status = status
    Object.assign(job, patch)
    if (activeJobId === job.id) activeJobId = null
    if (status === 'completed') {
      job.resultTimer = timers.setTimeout(() => {
        job.resultExpired = true
        job.result = undefined
      }, resultRetentionMs)
      job.resultTimer.unref?.()
    }
    return serialize(job)
  }

  const armStageTimer = (job, phase) => {
    clearStageTimer(job)
    job.stageTimer = timers.setTimeout(() => {
      const reason = phase === 'awaiting_consent' ? 'cancelled_by_consent' : 'cancelled_by_user'
      job.controller.abort(Object.assign(new Error(reason), { code: reason }))
      finish(job, 'cancelled', { reason })
    }, stageTimeoutMs)
    job.stageTimer.unref?.()
  }

  const run = async (job) => {
    try {
      armStageTimer(job, 'awaiting_consent')
      const captured = await capture({ jobId: job.id, signal: job.controller.signal })
      if (isTerminal(job)) return
      if (captured?.canceled) {
        finish(job, 'cancelled', { reason: captured.reason || 'cancelled_by_consent' })
        return
      }
      job.phase = 'awaiting_selection'
      armStageTimer(job, 'awaiting_selection')
      const selected = await select({ jobId: job.id, capture: captured, signal: job.controller.signal })
      if (isTerminal(job)) return
      if (selected?.canceled) {
        finish(job, 'cancelled', { reason: selected.reason || 'cancelled_by_user' })
        return
      }
      job.phase = 'processing'
      clearStageTimer(job)
      finish(job, 'completed', {
        result: {
          fileId: selected?.file?.fileId || captured?.file?.fileId,
          name: selected?.file?.name || captured?.file?.name,
          width: selected?.width || captured?.width,
          height: selected?.height || captured?.height,
          backend: captured?.backend
        }
      })
    } catch (error) {
      if (isTerminal(job)) return
      const reason = job.controller.signal.aborted ? 'cancelled_by_user' : undefined
      finish(job, reason ? 'cancelled' : 'failed', reason ? { reason } : { error: publicError(error) })
    }
  }

  const service = {
    start(payload = {}) {
      if (activeJobId) {
        return { status: 'busy', activeJobId }
      }
      const id = createId()
      const job = {
        id,
        caller: payload.caller || 'dsh',
        resultSink: payload.resultSink || 'session',
        status: 'awaiting_consent',
        phase: 'awaiting_consent',
        controller: new AbortController()
      }
      jobs.set(id, job)
      activeJobId = id
      void run(job)
      return serialize(job)
    },

    status(payload = {}) {
      return serialize(requireJob(jobs, payload.job_id || payload.jobId))
    },

    cancel(payload = {}) {
      const job = requireJob(jobs, payload.job_id || payload.jobId)
      if (!isTerminal(job)) {
        job.controller.abort(Object.assign(new Error('cancelled_by_user'), { code: 'cancelled_by_user' }))
        return finish(job, 'cancelled', { reason: 'cancelled_by_user' })
      }
      return serialize(job)
    },

    dispose() {
      for (const job of jobs.values()) {
        clearStageTimer(job)
        if (job.resultTimer) timers.clearTimeout(job.resultTimer)
        if (!isTerminal(job)) job.controller.abort(Object.assign(new Error('Host 正在退出'), { code: 'HOST_EXIT' }))
      }
      jobs.clear()
      activeJobId = null
    },

    _jobs: jobs
  }

  return service
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on?.('data', (chunk) => {
      const data = Buffer.from(chunk)
      size += data.length
      if (size > 4096) reject(new Error('请求内容过大'))
      else chunks.push(data)
    })
    req.on?.('error', reject)
    req.on?.('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch (error) {
        reject(error)
      }
    })
    if (!req.on && req[Symbol.asyncIterator]) {
      ;(async () => {
        for await (const chunk of req) {
          const data = Buffer.from(chunk)
          size += data.length
          if (size > 4096) throw new Error('请求内容过大')
          chunks.push(data)
        }
        return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
      })().then(resolve, reject)
    }
  })
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

export function apply(ctx) {
  const service = createScreenshotService()
  const unregister = [
    ctx.webServer.register({
      kind: 'exact',
      path: '/moyu/screenshot',
      handler: async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
        try {
          const args = await readBody(req)
          if (args.operation === 'start') return sendJson(res, 200, service.start(args))
          if (args.operation === 'status') return sendJson(res, 200, service.status(args))
          if (args.operation === 'cancel') return sendJson(res, 200, service.cancel(args))
          throw new Error('不支持的截图操作')
        } catch (error) {
          return sendJson(res, 400, { error: publicError(error) })
        }
      }
    })
  ]

  ctx.effect(() => () => {
    service.dispose()
    unregister.forEach((dispose) => dispose())
  }, 'moyu screenshot host service')
}
