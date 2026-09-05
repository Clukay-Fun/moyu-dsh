// 图片工具面冒烟（v3 范围 · 选项 A：工具层，不动 app）。
//
// 运行：经 run-acceptance --live 间接跑（spawn 真 app + CDP 驱动 renderer）。
//
// 为什么不是“真的转一张图”：
//   image.inspect / image.convert 只在 electron-main 内可调，renderer 没有
//   CDP/桥通道；DSH 工具又运行在 agent loop 里（不是 session.create 那种
//   一次性 RPC），密闭 harness 无法驱动。所以这里退一步，验证“image_convert
//   已注册进会话工具面”——复用 app 自带的不变量：
//     三个 Moyu 插件在 session/created 核对必备三件套（含 image_convert），
//     缺失即拒绝创建并打 “moyu tool whitelist drift”。
//   因此 session.create 成功且无 drift 标记 == image_convert 在工具面内。
//   （真正的转换成功/格式/失败判据待桥方法或 agent-loop 驱动后补回。）
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 9500 + Math.floor(Math.random() * 400)
let passed = 0
let failed = 0
const assert = (label, condition, detail = '') => {
  console.log(`  ${condition ? '✅' : '❌'} ${label.padEnd(44)} ${String(detail).slice(0, 80)}`)
  condition ? (passed += 1) : (failed += 1)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function pages() {
  return fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => [])
}
async function waitFor(predicate, label, timeoutMs = 90000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await predicate()
    if (value) return value
    await sleep(200)
  }
  throw new Error(`等待超时：${label}`)
}

const userDir = await mkdtemp(join(tmpdir(), 'moyu-image-surface-'))
const { default: electronBinary } = await import('electron')
const app = spawn(electronBinary, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, process.cwd()], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, MOYU_DSH_HOME: join(userDir, 'dsh') }
})
let hostOutput = ''
app.stdout.on('data', (chunk) => {
  hostOutput += String(chunk)
  process.stdout.write(chunk)
})
app.stderr.on('data', (chunk) => {
  hostOutput += String(chunk)
  process.stderr.write(chunk)
})
const cleanup = async () => {
  app.kill('SIGKILL')
  await rm(userDir, { recursive: true, force: true }).catch(() => {})
}
process.on('exit', () => app.kill('SIGKILL'))

try {
  const page = await waitFor(
    async () => (await pages()).find((c) => /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(c.url)),
    'DSH 主窗口'
  )
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let nextId = 1
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  })
  const send = (method, params) => new Promise((resolve) => {
    const id = nextId++
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })

  await send('Runtime.enable')
  const evaluation = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `fetch('/api/session.create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'img-surface-1', method: 'session.create', payload: {} })
    }).then((r) => r.json())`
  })
  ws.close()
  const value = evaluation.result?.result?.value
  assert(
    'session.create 成功（image_convert 已注册进工具面）',
    value?.result?.ok === true && typeof value?.result?.value?.sessionId === 'string',
    JSON.stringify(value?.result?.error?.message || value?.result?.value || '').slice(0, 120)
  )
  assert(
    'Host 无 tool 白名单漂移（image_convert 为必备）',
    !hostOutput.includes('moyu tool whitelist drift')
  )

  console.log(`图片工具面冒烟通过 ${passed} 项，失败 ${failed} 项`)
  await cleanup()
  process.exit(failed ? 1 : 0)
} catch (error) {
  console.error(error?.stack || error)
  if (hostOutput.includes('moyu tool whitelist drift')) {
    console.error(hostOutput.split('\n').find((line) => line.includes('[moyu]')))
  }
  await cleanup()
  process.exit(1)
}
