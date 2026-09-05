// v3 截图端到端验收（composer 按钮 → overlay 选区 → 对话草稿插入）。
//
// 运行：经 run-acceptance --live 间接跑（spawn 真 app + CDP 驱动 renderer/overlay）。
//
// 链路（全部 Moyu 自有代码，已在 client.tsx / index.mjs / main/index.js / overlay 验证）：
//   1. 点 composer 上的 [data-testid="moyu-screenshot"] 按钮
//      → client.tsx 调同源受认证路由 POST /moyu/screenshot {operation:'start'}
//      → host startFromUser() → desktop.captureScreen（开 overlay）+ selectScreenshotRegion
//   2. overlay（screenshot.html）出现，用户在 #capture-canvas 上拖出选区，点 #confirm-capture
//      → window.api.completeScreenshot → host 裁剪落盘、注册 fileId、job completed
//   3. client.tsx 轮询到 completed → 读 PNG → conversation.createDraftImages + addImages
//      → 写 window.__moyuScreenshotLastResult（截图作为附件插入输入框）
// 断言点：window 钩子存在且 fileId / width / height / draftIds 合法 == 整条链路通。
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'

const PORT = 9500 + Math.floor(Math.random() * 400)
let passed = 0
let failed = 0
const assert = (label, condition, detail = '') => {
  console.log(`  ${condition ? '✅' : '❌'} ${label.padEnd(46)} ${String(detail).slice(0, 80)}`)
  condition ? (passed += 1) : (failed += 1)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function targets() {
  return fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => [])
}
async function waitFor(predicate, label, timeoutMs = 60000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await predicate()
    if (value) return value
    await sleep(200)
  }
  throw new Error(`等待超时：${label}`)
}

function attach(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const pending = new Map()
    let nextId = 1
    const handlers = []
    ws.addEventListener('open', () => resolve(api()))
    ws.addEventListener('error', reject)
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message)
        pending.delete(message.id)
      }
      handlers.forEach((h) => h(message))
    })
    function api() {
      const send = (method, params) => new Promise((resolve) => {
        const id = nextId++
        pending.set(id, resolve)
        ws.send(JSON.stringify({ id, method, params }))
      })
      return {
        send,
        enable: async () => { await send('Runtime.enable'); await send('Input.enable') },
        evaluate: (expression) => send('Runtime.evaluate', {
          awaitPromise: true, returnByValue: true, expression
        }).then((m) => m.result?.result?.value),
        mouse: (type, x, y) => send('Input.dispatchMouseEvent', {
          type, x, y, button: 'left', pointerType: 'mouse', clickCount: type === 'mousePressed' ? 1 : 0
        }),
        close: () => ws.close()
      }
    }
  })
}

const userDir = await mkdtemp(join(tmpdir(), 'moyu-screenshot-e2e-'))
const { default: electronBinary } = await import('electron')
const app = spawn(electronBinary, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, process.cwd()], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, MOYU_DSH_HOME: join(userDir, 'dsh') }
})
let hostOutput = ''
app.stdout.on('data', (chunk) => { hostOutput += String(chunk); process.stdout.write(chunk) })
app.stderr.on('data', (chunk) => { hostOutput += String(chunk); process.stderr.write(chunk) })
const cleanup = async () => {
  app.kill('SIGKILL')
  await rm(userDir, { recursive: true, force: true }).catch(() => {})
}
process.on('exit', () => app.kill('SIGKILL'))

try {
  const mainTarget = await waitFor(
    async () => (await targets()).find((c) => /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(c.url)),
    'DSH 主窗口'
  )
  const main = await attach(mainTarget.webSocketDebuggerUrl)
  await main.enable()

  const created = await main.evaluate(`fetch('/api/session.create', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'shot-e2e-1', method: 'session.create', payload: {} })
  }).then((r) => r.json())`)
  assert('session.create 成功（截图 Tool 面就绪）',
    created?.result?.ok === true && typeof created?.result?.value?.sessionId === 'string',
    JSON.stringify(created?.result?.error?.message || created?.result?.value || '').slice(0, 100))

  // 等 composer 截图按钮渲染（conversation.input.left 槽位）
  await waitFor(
    async () => main.evaluate(`!!document.querySelector('[data-testid="moyu-screenshot"]')`),
    'composer 截图按钮出现',
    20000
  ).catch(() => {})
  const hasButton = await main.evaluate(`!!document.querySelector('[data-testid="moyu-screenshot"]')`)
  assert('composer 截图按钮存在（data-testid=moyu-screenshot）', hasButton)

  const baseline = Date.now()
  // 点真实按钮 → 触发完整人工采集链路
  await main.evaluate(`document.querySelector('[data-testid="moyu-screenshot"]').click()`)

  // overlay（screenshot.html）出现
  const overlayTarget = await waitFor(
    async () => (await targets()).find((c) => c.url.includes('screenshot.html')),
    '截图 overlay 窗口出现',
    25000
  )
  const overlay = await attach(overlayTarget.webSocketDebuggerUrl)
  await overlay.enable()

  // 等 overlay 加载冻结帧（#capture-canvas 已就绪）
  await waitFor(
    async () => overlay.evaluate(`!!document.querySelector('#capture-canvas')`),
    'overlay 冻结帧就绪',
    15000
  ).catch(() => {})
  await sleep(400)

  // 在 canvas 上用原生 PointerEvent 拖出选区（>=5x5 才有效；这里 400x250）
  const hasSelection = await overlay.evaluate(`(() => {
    const canvas = document.querySelector('#capture-canvas')
    const fire = (type, x, y, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: 'mouse', button: 0, buttons,
      clientX: x, clientY: y, bubbles: true, cancelable: true
    }))
    fire('pointerdown', 200, 200, 1)
    fire('pointermove', 400, 320, 1)
    fire('pointermove', 600, 450, 1)
    fire('pointerup', 600, 450, 0)
    const t = document.querySelector('#selection-size')
    return t ? (t.textContent || '').trim() : ''
  })()`)
  assert('overlay 选区已生成（selection-size 有值）', /\d+\s*[×x]\s*\d+/.test(hasSelection), hasSelection)

  // 确认截图
  await overlay.evaluate(`document.querySelector('#confirm-capture').click()`)
  overlay.close()

  // 等 client 把结果插入对话草稿并写钩子
  const result = await waitFor(
    async () => main.evaluate(`window.__moyuScreenshotLastResult || null`),
    'client 把截图作为附件插入输入框',
    30000
  )
  assert('window.__moyuScreenshotLastResult 已写入', result != null)
  assert('结果含 fileId', typeof result?.fileId === 'string' && result.fileId.length > 0, result?.fileId)
  assert('结果尺寸合法 width>0 && height>0',
    Number(result?.width) > 0 && Number(result?.height) > 0, `${result?.width}x${result?.height}`)
  assert('草稿已插入输入框（draftIds>=1）', Array.isArray(result?.draftIds) && result.draftIds.length >= 1,
    JSON.stringify(result?.draftIds))
  assert('钩子在点击后写入（at>baseline）', Number(result?.at) > baseline, new Date(result?.at || 0).toISOString())

  console.log(`v3 截图端到端验收通过 ${passed} 项，失败 ${failed} 项`)
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
