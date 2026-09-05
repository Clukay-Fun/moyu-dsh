// DSH 会话创建端到端探针 + C2-g 全局工具面审计闸门回归网。
//
// 背景（C2-g g5 后）：per-preset per-session 守卫已移除。工具面完整性改由 host-ready
// 全局精确审计接管——worker 在 `dsh web:` 就绪时同步跑 __moyuToolAudit，漂移/缺失即发
// host-error 拒绝启动本代 Host。因此 session.create 能成功，本身即证明审计闸门放行；
// 若全局工具面漂移，Host 根本不会 ready，session.create 会失败。
// 本 harness 用真实 Host + 真实 UI origin（token 由 Electron 网络层注入）走一次 session.create。
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 9400 + Math.floor(Math.random() * 500)
let passed = 0
let failed = 0
const assert = (label, condition, detail = '') => {
  console.log(`  ${condition ? '✅' : '❌'} ${label.padEnd(40)} ${String(detail)}`)
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

const userDir = await mkdtemp(join(tmpdir(), 'moyu-dsh-session-'))
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
    async () => (await pages()).find((candidate) => /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(candidate.url)),
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
      body: JSON.stringify({ type: 'client-request', rpcId: 'harness-1', method: 'session.create', payload: {} })
    }).then((r) => r.json())`
  })
  ws.close()
  const value = evaluation.result?.result?.value
  assert('session.create 经真实 UI origin 成功', value?.result?.ok === true && typeof value?.result?.value?.sessionId === 'string',
    JSON.stringify(value?.result?.error?.message || value?.result?.value || '').slice(0, 120))
  assert('Host 输出无 C2-g 全局工具面审计失败（就绪闸门放行）', !hostOutput.includes('C2-g 全局工具面审计失败') && !hostOutput.includes('工具面审计缺失'))

  console.log(`DSH 会话创建通过 ${passed} 项，失败 ${failed} 项`)
  await cleanup()
  process.exit(failed ? 1 : 0)
} catch (error) {
  console.error(error?.stack || error)
  const auditLine = hostOutput.split('\n').find((line) => line.includes('C2-g') || line.includes('工具面审计'))
  if (auditLine) console.error(auditLine)
  await cleanup()
  process.exit(1)
}
