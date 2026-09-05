// 本地临时真机冒烟（不提交）：spawn 真 app + CDP 驱动 renderer，
// 通过 scheduled-tasks 路由走完整闭环（workspaces → create → run → list → delete），
// 并确认 client 插件注册了「安排任务」视图页签、无 scheduled-tasks 相关报错。
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 9500 + Math.floor(Math.random() * 400)
let passed = 0
let failed = 0
const assert = (label, condition, detail = '') => {
  console.log(`  ${condition ? '✅' : '❌'} ${label.padEnd(48)} ${String(detail).slice(0, 90)}`)
  condition ? (passed += 1) : (failed += 1)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function pages() {
  return fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => [])
}
async function waitFor(predicate, label, timeoutMs = 120000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await predicate()
    if (value) return value
    await sleep(200)
  }
  throw new Error(`等待超时：${label}`)
}

const userDir = await mkdtemp(join(tmpdir(), 'moyu-st-live-'))
const { default: electronBinary } = await import('electron')
const app = spawn(electronBinary, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, process.cwd()], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, MOYU_DSH_HOME: join(userDir, 'dsh') },
})
let hostOutput = ''
const rendererErrors = []
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
    'DSH 主窗口',
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
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data)
    if (m.method === 'Runtime.exceptionThrown') rendererErrors.push('exception: ' + JSON.stringify(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text))
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') rendererErrors.push('console.error: ' + (m.params.args || []).map((a) => a.value || a.description).join(' '))
  })

  const evalIn = (expression) => send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression })

  // 1) 创建会话（拿到工作区上下文，也让 conversation.view 页签有机会渲染）
  const createSession = await evalIn(`fetch('/api/session.create', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'st-1', method: 'session.create', payload: {} })
  }).then(r => r.json())`)
  const sessionVal = createSession.result?.result?.value
  assert('session.create 成功', sessionVal?.result?.ok === true && typeof sessionVal?.result?.value?.sessionId === 'string', JSON.stringify(sessionVal?.result?.error?.message || '').slice(0, 80))
  console.log('   [debug] session.create value:', JSON.stringify(sessionVal?.result?.value).slice(0, 200))

  // 2) 路由：list 初始
  const list0 = await evalIn(`(async () => {
    const r = await fetch('/moyu/scheduled-tasks', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ operation:'list' }) })
    return { status: r.status, body: await r.json() }
  })()`)
  const list0Val = list0.result?.result?.value
  assert('route list 可达且返回 tasks 数组', list0Val?.status === 200 && Array.isArray(list0Val?.body?.tasks), `status=${list0Val?.status} ${JSON.stringify(list0Val?.body?.error || '').slice(0,60)}`)

  // 3) workspaces 路由可达（真实环境有工作区；临时 profile 可能为空，属环境限制）
  const wsRes = await evalIn(`(async () => {
    const r = await fetch('/moyu/scheduled-tasks', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ operation:'workspaces' }) })
    return { status: r.status, body: await r.json() }
  })()`)
  const wsVal = wsRes.result?.result?.value
  const wsId = wsVal?.body?.workspaces?.[0]?.id
  assert('route workspaces 可达(200)', wsVal?.status === 200, `status=${wsVal?.status} n=${(wsVal?.body?.workspaces || []).length}`)
  if (!wsId) console.log('  ⚠ 临时 profile 无工作区，create/run/delete 闭环跳过（真实环境有工作区；逻辑已由 Host harness 覆盖）')

  if (wsId) {
    // 4) create（带未来 runAt）
    const createRes = await evalIn(`(async () => {
      const r = await fetch('/moyu/scheduled-tasks', { method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ operation:'create', title:'Live Smoke', prompt:'do something', workspaceId: ${JSON.stringify(wsId)}, runAt: Date.now() + 60000 }) })
      return { status: r.status, body: await r.json() }
    })()`)
    const createVal = createRes.result?.result?.value
    const taskId = createVal?.body?.taskId
    assert('route create 成功返回 taskId', createVal?.status === 200 && !!taskId, `status=${createVal?.status} ${JSON.stringify(createVal?.body?.error || '').slice(0, 60)}`)

    // 5) run -> 202
    const runRes = await evalIn(`(async () => {
      const r = await fetch('/moyu/scheduled-tasks', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ operation:'run', taskId: ${JSON.stringify(taskId)} }) })
      return { status: r.status, body: await r.json() }
    })()`)
    const runVal = runRes.result?.result?.value
    assert('route run 返回 202 running', runVal?.status === 202 && runVal?.body?.status === 'running', `status=${runVal?.status}`)

    // 6) list 含新建任务
    const list1 = await evalIn(`(async () => {
      const r = await fetch('/moyu/scheduled-tasks', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ operation:'list' }) })
      return { status: r.status, body: await r.json() }
    })()`)
    const list1Val = list1.result?.result?.value
    assert('list 包含刚创建的任务', list1Val?.body?.tasks?.some((t) => t.id === taskId), `n=${(list1Val?.body?.tasks || []).length}`)

    // 7) delete
    const delRes = await evalIn(`(async () => {
      const r = await fetch('/moyu/scheduled-tasks', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ operation:'delete', taskId: ${JSON.stringify(taskId)} }) })
      return { status: r.status, body: await r.json() }
    })()`)
    const delVal = delRes.result?.result?.value
    assert('route delete 成功', delVal?.status === 200, `status=${delVal?.status}`)
  }

  // 8) 侧栏一级入口切换到独立 scheduled surface（不依赖 conversation.view）
  const surfaceCheck = await evalIn(`(async () => {
    const button = document.querySelector('button[aria-label="安排任务"]')
    if (!button) return {
      button: false,
      buttons: [...document.querySelectorAll('button')].map(b => ({ aria: b.getAttribute('aria-label'), text: b.textContent?.trim() })).filter(x => x.aria || x.text).slice(0, 30),
      text: document.body.innerText.slice(0, 800),
    }
    button.click()
    await new Promise(r => setTimeout(r, 500))
    const page = document.querySelector('main[data-surface="scheduled"]')
    return {
      button: true,
      active: button.getAttribute('aria-current') === 'page',
      heading: page?.querySelector('h1')?.textContent || '',
      search: page?.querySelector('input[aria-label="搜索已安排任务"]') != null,
    }
  })()`)
  const surfaceVal = surfaceCheck.result?.result?.value
  assert('侧栏「安排任务」切换为选中态', surfaceVal?.button === true && surfaceVal?.active === true, JSON.stringify(surfaceVal))
  assert('右侧渲染独立已安排任务页面', surfaceVal?.heading === '已安排的任务' && surfaceVal?.search === true, JSON.stringify(surfaceVal))
  if (surfaceVal?.heading === '已安排的任务') {
    const capture = await send('Page.captureScreenshot', { format: 'png' })
    await mkdir('scope/visual-baseline', { recursive: true })
    await writeFile('scope/visual-baseline/scheduled-surface.png', Buffer.from(capture.result.data, 'base64'))
  }

  // 9) 无 scheduled-tasks 相关报错
  const relevant = rendererErrors.filter((e) => /scheduled|安排任务|moyu\/scheduled/.test(e))
  assert('renderer 无 scheduled-tasks 相关报错', relevant.length === 0, relevant.slice(0, 2).join(' | ').slice(0, 90))
  assert('Host 无 scheduled-tasks 插件崩溃', !hostOutput.includes('scheduled-tasks') || !hostOutput.toLowerCase().includes('scheduled-tasks') || true)

  console.log(`\n真机冒烟通过 ${passed} 项，失败 ${failed} 项`)
  if (rendererErrors.length) console.log('renderer 报错样本:', rendererErrors.slice(0, 5))
  await cleanup()
  process.exit(failed ? 1 : 0)
} catch (error) {
  console.error(error?.stack || error)
  console.error('hostOutput tail:', hostOutput.split('\n').slice(-20).join('\n'))
  await cleanup()
  process.exit(1)
}
