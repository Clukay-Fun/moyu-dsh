// DSH Host 的生命周期与窄桥（v3.0.0 §3.1、§3.4）。
//
// 每次启动是一个 generation：独立端口、独立随机 token、独立 origin。
// Host 崩溃重启会换代，旧 token 与旧端口一并作废（M0a 收口已实测）。
import { app, MessageChannelMain, utilityProcess } from 'electron'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { dispatchBridgeCall } from './bridge.js'

const READY_TIMEOUT_MS = 30_000

function workerPath() {
  // 与 com-worker 相同的交付方式：随 extraResources 落到 resources/workers。
  return app.isPackaged
    ? join(process.resourcesPath, 'workers', 'dsh-host-worker.mjs')
    : join(app.getAppPath(), 'resources', 'dsh-host-worker.mjs')
}

/**
 * 由 main 解析 DSH 入口再传给 worker。
 *
 * worker 被 extraResources 放在 Resources/workers 下，它的 require 解析路径**不包含**
 * Resources/app.asar/node_modules；让 worker 自己 require.resolve 在打包产物里必然失败。
 * main 打进 asar，从这里解析才能命中生产依赖。
 */
export function resolveDshEntry() {
  const require = createRequire(import.meta.url)
  try {
    return join(dirname(require.resolve('@deepseek-ai/dsh/package.json')), 'lib', 'bin.js')
  } catch {
    throw new Error('未找到 @deepseek-ai/dsh，请先安装 DSH 运行时')
  }
}

export function dshHome() {
  return process.env.MOYU_DSH_HOME || join(app.getPath('userData'), 'dsh')
}

/**
 * 启动一代 Host，等待 ready。
 *
 * token 只经 postMessage 下发，不进环境变量、命令行、配置文件和日志。
 */
export async function startHostGeneration(generation, { onStdout, profile } = {}) {
  const token = randomBytes(32).toString('base64url')
  const child = utilityProcess.fork(workerPath(), [], {
    // DSH 闭包里的 node-addon-require-builtin 需要它；M0a 已按此组合实测。
    execArgv: ['--expose-internals'],
    env: { ...process.env, MOYU_DSH_HOME: dshHome() },
    stdio: 'pipe',
    serviceName: `Moyu DSH Host ${generation}`
  })

  const evidence = []
  const host = { child, token, generation, url: undefined, evidence }

  child.stdout?.on('data', (chunk) => onStdout?.(String(chunk)))
  child.stderr?.on('data', (chunk) => onStdout?.(String(chunk)))
  child.on('message', (message) => {
    if (message?.type === 'auth-evidence') evidence.push(message.evidence)
  })
  child.postMessage({ type: 'host-auth', generation, token, dshBin: resolveDshEntry(), profile })

  try {
    host.url = await new Promise((resolve, reject) => {
      let reportedError
      let done = false
      const finish = (fn, value) => {
        if (done) return
        done = true
        clearTimeout(timer)
        child.off('message', onMessage)
        fn(value)
      }
      const timer = setTimeout(
        () => finish(reject, new Error('DSH Host 就绪超时')),
        READY_TIMEOUT_MS
      )
      const onMessage = (message) => {
        if (message?.type === 'host-error') {
          reportedError = message.message
          return
        }
        if (message?.type !== 'host-ready') return
        finish(resolve, message.url)
      }
      child.on('message', onMessage)
      child.once('exit', (code) => {
        // worker 自报的原因优先：退出码本身对用户没有意义。
        finish(reject, new Error(`DSH Host 在就绪前退出：${reportedError || `退出码 ${code}`}`))
      })
    })
  } catch (error) {
    // 超时与就绪前失败都必须回收这代 child：此时 startDsh 还没拿到 host，
    // 外层 catch 兜不住，漏掉就是一个游离的 utility process。
    await stopHost(host)
    throw error
  }

  return host
}

/**
 * 在 main 侧提供桌面桥服务。
 *
 * 方向是 Host → main：dialog、clipboard、shell 只存在于主进程，Host 进程没有这些 API。
 * main 不通过这条通道反向调用 Host——Host 的健康状态由进程存活与 ready 决定。
 */
export function serveDesktopBridge(host, methods) {
  const { port1, port2 } = new MessageChannelMain()
  host.child.postMessage({ type: 'desktop-port' }, [port1])

  port2.on('message', async ({ data }) => {
    const reply = await dispatchBridgeCall(methods, data)
    port2.postMessage(reply)
  })
  port2.start()

  host.bridge = {
    subject: methods.subject,
    close() {
      // 令牌随本代一起作废，旧 fileId 不得在新一代里复活。
      methods.registry?.clear()
      port2.close()
    }
  }
  return host.bridge
}

export function stopHost(host) {
  if (!host || host.child.killed) return Promise.resolve()
  host.bridge?.close()
  return new Promise((resolve) => {
    host.child.once('exit', resolve)
    host.child.kill()
  })
}
