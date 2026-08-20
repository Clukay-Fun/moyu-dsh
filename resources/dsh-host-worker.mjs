// DSH Host 运行在 Electron 自带 Node 运行时的独立子进程里。
//
// 这里不是应用主进程：它只负责装 fence、启动 DSH、把 ready 与桌面桥消息回传给
// main。所有桌面能力都通过进程 IPC 窄桥回到 main，不在本进程直接调 Electron API。
import { installAuthFence } from './dsh-auth-fence.mjs'

const home = process.env.MOYU_DSH_HOME
if (!home) throw new Error('MOYU_DSH_HOME 未设置')
process.env.DSH_HOME = home

if (typeof process.send !== 'function') throw new Error('DSH Host IPC 通道不可用')
const send = (message) => process.send?.(message)

function describeStartupError(error, depth = 0) {
  if (depth > 4) return '[错误链过深]'
  const lines = [error?.stack || error?.message || String(error)]
  if (error?.cause) lines.push(`cause: ${describeStartupError(error.cause, depth + 1)}`)
  if (Array.isArray(error?.errors)) {
    error.errors.forEach((entry, index) => {
      lines.push(`aggregate[${index}]: ${describeStartupError(entry, depth + 1)}`)
    })
  }
  return lines.join('\n').slice(0, 12_000)
}

// token 只经进程 IPC 送达，不进环境变量、命令行和磁盘。
const auth = await new Promise((resolve) => {
  process.on('message', function onAuth(message) {
    if (message?.type !== 'host-auth') return
    process.off('message', onAuth)
    resolve(message)
  })
})

const fence = installAuthFence({
  token: auth.token,
  generation: auth.generation,
  report: (evidence) => send({ type: 'auth-evidence', evidence })
})

const pending = new Map()
let rpcId = 0

// main → Host 的迁移期 image.* 服务表。业务插件只登记明确方法；不接受任意方法转发。
const hostServices = new Map()
const activeHostCalls = new Map()
globalThis.__moyuHostServices = Object.freeze({
  register(method, handler) {
    if (typeof method !== 'string' || !/^image\.[a-z][a-z0-9-]*$/.test(method)) {
      throw new Error('Host Service 只允许登记 image.* 方法')
    }
    if (typeof handler !== 'function') throw new Error(`Host Service ${method} 必须是函数`)
    if (hostServices.has(method)) throw new Error(`Host Service 已登记：${method}`)
    hostServices.set(method, handler)
    return () => hostServices.delete(method)
  }
})

process.on('message', (message) => {
  if (message?.type === 'host-service-cancel') {
    activeHostCalls.get(message.id)?.abort()
    return
  }
  if (message?.type === 'host-service-call') {
    const handler = hostServices.get(message.method)
    if (!handler) {
      send({
        type: 'host-service-result',
        id: message.id,
        ok: false,
        code: 'UNKNOWN_HOST_SERVICE',
        error: `未登记的 Host Service：${message.method}`
      })
      return
    }
    const controller = new AbortController()
    activeHostCalls.set(message.id, controller)
    void Promise.resolve(handler(message.payload, {
      signal: controller.signal,
      progress: (progress) => {
        if (!controller.signal.aborted) {
          send({ type: 'host-service-progress', id: message.id, progress })
        }
      }
    })).then(
      (value) => send({ type: 'host-service-result', id: message.id, ok: true, value }),
      (error) => send({
        type: 'host-service-result',
        id: message.id,
        ok: false,
        code: error?.code || 'HOST_SERVICE_FAILED',
        error: error?.message || 'Host Service 执行失败'
      })
    ).finally(() => activeHostCalls.delete(message.id))
    return
  }
  if (message?.type === 'host-origin') {
    fence.setOrigin(message.origin)
    return
  }
  if (message?.type === 'desktop-result') {
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    clearTimeout(entry.timer)
    if (message.ok) entry.resolve(message.value)
    else entry.reject(Object.assign(new Error(message.error), { code: message.code }))
    return
  }
  if (message?.type !== 'desktop-bridge-ready') return

  globalThis.__moyuDesktop = {
    call(method, payload, { timeoutMs = 30_000 } = {}) {
      const id = ++rpcId
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`桌面桥调用超时：${method}`))
        }, timeoutMs)
        pending.set(id, { resolve, reject, timer })
        send({ type: 'desktop-call', id, method, payload })
      })
    }
  }
  send({ type: 'bridge-ready', generation: auth.generation })
})

// DSH 用 stdout 播报监听地址；这是当前唯一的就绪来源，转成结构化 ready 消息，
// 主进程不解析 stdout（计划 §12 回填 4）。
const originalLog = console.log.bind(console)
console.log = (...args) => {
  originalLog(...args)
  const match = args.map(String).join(' ').match(/^dsh web: (http:\/\/127\.0\.0\.1:\d+)/)
  if (!match) return
  fence.setOrigin(match[1])
  send({
    type: 'host-ready',
    url: match[1],
    pid: process.pid,
    generation: auth.generation
  })
}

// 启动失败必须带着可读原因回到 main：子进程里的未捕获异常只会留下
// 退出码，降级页拿不到任何能告诉用户的东西。
try {
  // 入口由 main 解析后传入：worker 在打包产物里解析不到 app.asar 内的依赖。
  if (!auth.dshBin) throw new Error('未收到 DSH 入口路径')
  // profile 必须显式给定：绝不回落到上游 web profile，那会带进计划禁止的
  // shell / 文件 / subagent / 动态插件工具（§4 唯一 Moyu profile）。
  if (!auth.profile) throw new Error('未指定 Moyu profile，拒绝以上游默认 profile 启动')
  // 只绑 loopback，端口交给 OS 指派（上游只接受 127.0.0.1 或 0.0.0.0，后者禁止）。
  process.argv = [process.execPath, auth.dshBin, '--profile', auth.profile, '--port', '0']
  await import(auth.dshBin)
} catch (error) {
  send({
    type: 'host-error',
    generation: auth.generation,
    message: describeStartupError(error)
  })
  process.exit(1)
}
