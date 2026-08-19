// DSH Host 运行在 Electron utilityProcess 里（v3.0.0 §3.1 决策 2）。
//
// 这里不是应用主进程：它只负责装 fence、启动 DSH、把 ready 与桌面桥消息回传给
// main。所有桌面能力都通过 MessagePort 窄桥回到 main，不在本进程直接调 Electron API。
import { installAuthFence } from './dsh-auth-fence.mjs'

const home = process.env.MOYU_DSH_HOME
if (!home) throw new Error('MOYU_DSH_HOME 未设置')
process.env.DSH_HOME = home

const parentPort = process.parentPort
if (!parentPort) throw new Error('utilityProcess parentPort 不可用')

// token 只经 postMessage 送达，不进环境变量、命令行和磁盘。
const auth = await new Promise((resolve) => {
  parentPort.on('message', function onAuth(event) {
    if (event.data?.type !== 'host-auth') return
    parentPort.off('message', onAuth)
    resolve(event.data)
  })
})

const fence = installAuthFence({
  token: auth.token,
  generation: auth.generation,
  report: (evidence) => parentPort.postMessage({ type: 'auth-evidence', evidence })
})

parentPort.on('message', (event) => {
  if (event.data?.type === 'host-origin') {
    fence.setOrigin(event.data.origin)
    return
  }
  if (event.data?.type !== 'desktop-port') return
  const port = event.ports?.[0]
  if (!port) return
  // 方向是 Host → main：dialog / clipboard / shell 只在主进程里。
  // 这里只做请求编号与超时，能力实现全部在 apps/desktop/main/dsh/bridge.js。
  const pending = new Map()
  let rpcId = 0
  port.on('message', ({ data }) => {
    const entry = pending.get(data?.id)
    if (!entry) return
    pending.delete(data.id)
    clearTimeout(entry.timer)
    if (data.ok) entry.resolve(data.value)
    else entry.reject(Object.assign(new Error(data.error), { code: data.code }))
  })
  port.start()

  globalThis.__moyuDesktop = {
    call(method, payload, { timeoutMs = 30_000 } = {}) {
      const id = ++rpcId
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`桌面桥调用超时：${method}`))
        }, timeoutMs)
        pending.set(id, { resolve, reject, timer })
        port.postMessage({ id, method, payload })
      })
    }
  }
  parentPort.postMessage({ type: 'bridge-ready', generation: auth.generation })
})

// DSH 用 stdout 播报监听地址；这是当前唯一的就绪来源，转成结构化 ready 消息，
// 主进程不解析 stdout（计划 §12 回填 4）。
const originalLog = console.log.bind(console)
console.log = (...args) => {
  originalLog(...args)
  const match = args.map(String).join(' ').match(/^dsh web: (http:\/\/127\.0\.0\.1:\d+)/)
  if (!match) return
  fence.setOrigin(match[1])
  parentPort.postMessage({
    type: 'host-ready',
    url: match[1],
    pid: process.pid,
    generation: auth.generation
  })
}

// 启动失败必须带着可读原因回到 main：utilityProcess 里的未捕获异常只会留下
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
  parentPort.postMessage({
    type: 'host-error',
    generation: auth.generation,
    message: error?.message || String(error)
  })
  process.exit(1)
}
