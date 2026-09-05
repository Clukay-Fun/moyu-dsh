// 会话右键菜单结构验收（需凭据的人工 GUI 验收 · 不在默认自动清单）。
//
// ⚠️ 本 harness 需要真实模型 / API Key：无头环境会话不会渲染进侧栏
// （已验证 —— 即使创建 workspace、rename 赋予标题，会话行也不出现在 DOM），
// 因此 waitFor 会话行超时将以明确原因失败。请在有真实模型的机器上手动运行：
//   node tests/verify-session-menu.mjs
//
// 行为断言（真实 UI，非源码字符串匹配）：
//   右键会话行 → 浮层菜单应包含：置顶、重命名、未读、归档、移动工作区、
//   复制会话、复制 Markdown、分叉；且不应包含：分享、新窗口。
import { spawn } from 'node:child_process'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocket } from 'ws'

const PORT = 9500 + Math.floor(Math.random() * 400)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let passed = 0
let failed = 0
const assert = (label, condition, detail = '') => {
  console.log(`  ${condition ? '✅' : '❌'} ${label.padEnd(44)} ${String(detail).slice(0, 80)}`)
  condition ? (passed += 1) : (failed += 1)
}
const userDir = await mkdtemp(join(tmpdir(), 'moyu-menu-'))
const wsDir = await mkdtemp(join(tmpdir(), 'moyu-menu-ws-'))
await mkdir(join(wsDir, 'sub'), { recursive: true })
const { default: electronBinary } = await import('electron')
const app = spawn(electronBinary, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, process.cwd()], {
  stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MOYU_DSH_HOME: join(userDir, 'dsh') }
})
const cleanup = async () => { app.kill('SIGKILL'); await rm(userDir, { recursive: true, force: true }).catch(() => {}); await rm(wsDir, { recursive: true, force: true }).catch(() => {}) }
process.on('exit', () => app.kill('SIGKILL'))
const pages = () => fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => [])
async function waitFor(p, l, t = 60000) { const s = Date.now(); while (Date.now() - s < t) { const v = await p(); if (v) return v; await sleep(200) } throw new Error('等待超时：' + l) }

try {
  const page = await waitFor(async () => (await pages()).find((c) => /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(c.url)), 'DSH 主窗口')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }) })
  let nextId = 1
  const pending = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params) => new Promise((res) => { const id = nextId++; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = (expr) => send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: expr }).then((m) => m.result?.result?.value)
  await send('Runtime.enable')
  await ev(`(async () => { const b=[...document.querySelectorAll('button')].find(x=>/稍后配置|以后再说|稍后/.test(x.textContent||'')); if(b) b.click(); return !!b })()`)
  await sleep(800)
  const rpc = (method, payload) => ev(`fetch('/api/${method}', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ type:'client-request', rpcId:'m-'+Math.random().toString(36).slice(2), method:'${method}', payload: ${JSON.stringify(payload)} }) }).then(r=>r.json()).then(j=>j.result)`)
  const wa = await rpc('workspace.create', { path: wsDir })
  const sid = (await rpc('session.create', { workspaceId: wa?.value?.workspaceId }))?.value?.sessionId
  await rpc('session.rename', { sessionId: sid, title: '菜单测试会话' })
  await sleep(1500)

  const rowSel = `(() => { const items=[...document.querySelectorAll('[role=treeitem]')].filter(x=>!x.querySelector('[role=treeitem]')); return items.find(x=>(x.textContent||'').includes('菜单测试会话')) || null })()`
  let row = null
  try { row = await waitFor(async () => ev(`!!(${rowSel})`), '会话行渲染（需真实模型）', 40000) } catch { /* fall through */ }
  if (!row) {
    console.error('❌ 会话行未渲染：无头环境无模型时会话不进入侧栏。本 harness 需在配置真实模型的机器上手动运行。')
    await cleanup(); process.exit(1)
  }
  await ev(`(() => { const items=[...document.querySelectorAll('[role=treeitem]')].filter(x=>!x.querySelector('[role=treeitem]')); const row=items.find(x=>(x.textContent||'').includes('菜单测试会话')); const r=row.getBoundingClientRect(); row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.x+5,clientY:r.y+5})); })()`)
  const items = await waitFor(async () => ev(`(() => { const m=document.querySelector('[role=menu]'); if(!m) return null; return [...m.querySelectorAll('[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio]')].map(x=>(x.textContent||'').trim()); })()`), '右键菜单出现', 10000)
  if (!items) { console.error('❌ 右键菜单未出现'); await cleanup(); process.exit(1) }
  const joined = items.join(' | ')
  console.log('   菜单项：', joined)
  for (const label of ['置顶', '重命名', '未读', '归档', '移动工作区', '复制会话', 'Markdown', '分叉']) {
    assert(`菜单含「${label}」`, items.some((t) => t.includes(label)), joined)
  }
  for (const label of ['分享', '新窗口']) {
    assert(`菜单不含「${label}」`, !items.some((t) => t.includes(label)), joined)
  }
  console.log(`会话菜单结构验收通过 ${passed} 项，失败 ${failed} 项`)
  await cleanup()
  process.exit(failed ? 1 : 0)
} catch (error) {
  console.error(error?.stack || error)
  await cleanup()
  process.exit(1)
}
