import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { assertMoyuToolSurface } from '@moyu/dsh-profile'

export const name = 'moyu-screenshot'
export const inject = ['webServer', 'tools']

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

function serializeForTool(value) {
  const output = {
    jobId: value.jobId,
    activeJobId: value.activeJobId,
    status: value.status,
    phase: value.phase,
    reason: value.reason,
    resultStatus: value.resultStatus,
    resultId: value.result?.fileId,
    width: value.result?.width,
    height: value.result?.height,
    backend: value.result?.backend,
    error: value.error
  }
  return Object.fromEntries(Object.entries(output).filter(([, nested]) => nested !== undefined))
}

function requireJob(jobs, id) {
  if (typeof id !== 'string' || !id) throw new Error('job_id 必须是非空字符串')
  const job = jobs.get(id)
  if (!job) throw new Error('截图任务不存在或已失效')
  return job
}

// 模型路径确认：等待用户在原生对话框里「允许/取消」。用户需要时间决策，故给足
// 超时；超时则任务以 cancelled_by_consent 终态返回（不会卡死模型回路）。
function defaultCapture({ signal, scope } = {}) {
  if (signal?.aborted) throw Object.assign(new Error('TASK_CANCELLED'), { code: 'TASK_CANCELLED' })
  return desktop().call('desktop.requestScreenCapture', { scope }, { timeoutMs: 300000 })
}

// 人工路径（composer 按钮）：desktop.captureScreen 不弹确认。
function defaultDirectCapture({ signal } = {}) {
  if (signal?.aborted) throw Object.assign(new Error('TASK_CANCELLED'), { code: 'TASK_CANCELLED' })
  return desktop().call('desktop.captureScreen')
}

function defaultSelect({ capture } = {}) {
  return desktop().call('desktop.selectScreenshotRegion', { capture })
}

export function createScreenshotService(options = {}) {
  const capture = options.capture || defaultCapture
  const captureDirect = options.captureDirect || defaultDirectCapture
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
      const captureFn = job.entry === 'direct' ? captureDirect : capture
      const captured = await captureFn({ jobId: job.id, signal: job.controller.signal, scope: job.scope })
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

  const startInternal = ({ entry, caller, resultSink, scope }) => {
    if (activeJobId) {
      return { status: 'busy', activeJobId }
    }
    const id = createId()
    const job = {
      id,
      caller,
      resultSink,
      entry,
      scope,
      status: 'awaiting_consent',
      phase: 'awaiting_consent',
      controller: new AbortController()
    }
    jobs.set(id, job)
    activeJobId = id
    void run(job)
    return serialize(job)
  }

  const service = {
    // 确认策略的入口结构（§13.2）：两个命名入口各自固定 entry，调用方没有任何
    // 字段能选择采集路径——人工路径免确认（desktop.captureScreen），
    // 模型路径逐次确认（desktop.requestScreenCapture）。不要新增第三个入口。
    startFromUser() {
      return startInternal({ entry: 'direct', caller: 'renderer:moyu-screenshot-composer', resultSink: 'session' })
    },

    // scope = 发起调用的 DSH 会话 id（来自 exec.agent.session.id）：
    // 「本次会话内允许」的授权粒度由 main 按它记账。
    startFromTool({ scope } = {}) {
      return startInternal({ entry: 'tool', caller: 'dsh', resultSink: 'session', scope })
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

  const operate = async (args = {}, exec = {}) => {
    if (args.operation === 'submit') {
      const submitted = service.startFromTool({ scope: exec?.agent?.session?.id })
      return serializeForTool(submitted)
    }
    if (args.operation === 'status') {
      return serializeForTool(service.status(args))
    }
    if (args.operation === 'cancel') {
      return serializeForTool(service.cancel(args))
    }
    throw new Error('operation 必须是 submit、status 或 cancel')
  }
  const unregister = [
    ctx.webServer.register({
      kind: 'exact',
      path: '/moyu/screenshot',
      handler: async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
        try {
          const args = await readBody(req)
          if (args.operation === 'start') {
            // 入口结构即授权：请求能到达这条同源受认证路由，等于用户点了按钮。
            return sendJson(res, 200, service.startFromUser())
          }
          if (args.operation === 'status') return sendJson(res, 200, service.status(args))
          if (args.operation === 'cancel') return sendJson(res, 200, service.cancel(args))
          if (args.operation === 'save' || args.operation === 'show') {
            const job = requireJob(service._jobs, args.job_id)
            const status = serialize(job)
            if (status.status !== 'completed' || status.resultStatus === 'expired' || !status.result?.fileId) {
              throw new Error('截图结果尚未就绪或已失效')
            }
            const value = args.operation === 'save'
              ? await desktop().call('desktop.saveRegisteredFile', {
                fileId: status.result.fileId,
                name: status.result.name || `screenshot-${Date.now()}.png`
              })
              : await desktop().call('desktop.showItem', { fileId: status.result.fileId })
            return sendJson(res, 200, value)
          }
          if (args.operation === 'read') {
            const job = requireJob(service._jobs, args.job_id)
            const status = serialize(job)
            if (status.status !== 'completed' || status.resultStatus === 'expired' || !status.result?.fileId) {
              throw new Error('截图结果尚未就绪或已失效')
            }
            const resolved = await desktop().call('desktop.resolveFile', { fileId: status.result.fileId })
            const data = await readFile(resolved.path)
            res.writeHead(200, { 'content-type': 'image/png', 'content-length': data.length })
            res.end(data)
            return
          }
          throw new Error('不支持的截图操作')
        } catch (error) {
          return sendJson(res, 400, { error: publicError(error) })
        }
      }
    })
  ]

  ctx.tools.register(defineTool({
    name: 'screenshot_capture',
    description: 'Capture the current screen via an interactive Moyu screenshot. Asynchronous job protocol: "submit" starts capture and immediately returns a jobId (with status: "awaiting_consent" requiring desktop user confirmation, or "processing"); poll "status" with job_id to obtain the resultId when completed; "cancel" aborts.',
    parameters: {
      operation: { type: 'string', enum: ['submit', 'status', 'cancel'], required: true },
      job_id: { type: 'string' }
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          jobId: { type: 'string', required: true },
          activeJobId: { type: 'string' },
          status: { type: 'string', required: true },
          phase: { type: 'string' },
          reason: { type: 'string' },
          resultStatus: { type: 'string' },
          resultId: { type: 'string' },
          width: { type: 'integer' },
          height: { type: 'integer' },
          backend: { type: 'string' },
          error: { type: 'string' }
        }
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }]
    },
    execute: (args, exec) => operate(args, exec)
  }))

  ctx.on('session/created', (session) => {
    assertMoyuToolSurface(ctx, session)
  }, { global: true })

  ctx.effect(() => () => {
    service.dispose()
    unregister.forEach((dispose) => dispose())
  }, 'moyu screenshot host service')
}
