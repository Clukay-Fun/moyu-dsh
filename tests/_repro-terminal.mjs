import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const PORT = 9600 + Math.floor(Math.random() * 300)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function targets() {
  return fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => [])
}
const userDir = await mkdtemp(join(tmpdir(), 'term-repro-'))
const { default: electronBinary } = await import('electron')
const app = spawn(electronBinary, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, process.cwd()], {
  stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MOYU_DSH_HOME: join(userDir, 'dsh') },
})
let hostLog = ''
app.stderr.on('data', (c) => { hostLog += c })
process.on('exit', () => app.kill('SIGKILL'))
try {
  let page
  for (let i = 0; i < 150 && !page; i++) { page = (await targets()).find((c) => /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(c.url)); if (!page) await sleep(400) }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  let id = 0; const pending = new Map(); const consoleMsgs = []
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') consoleMsgs.push('EXC: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300))
    if (m.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(m.params.type)) consoleMsgs.push(m.params.type + ': ' + m.params.args.map(a=>a.value||a.description||'').join(' ').slice(0, 200))
  })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expression) => (await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression })).result?.result?.value
  await send('Runtime.enable')
  await sleep(5000)
  // 建会话
  await evaluate(`fetch('/api/session.create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'r1',method:'session.create',payload:{}})}).then(r=>r.json())`)
  await sleep(3000)
  // 找到右上角终端按钮并点击
  const clicked = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button')]
    const b = btns.find(x => (x.textContent||'').trim() === '终端' || x.getAttribute('aria-label')==='终端')
    if (!b) return { found: false, labels: btns.slice(0,20).map(x=>x.textContent.trim()||x.getAttribute('aria-label')).filter(Boolean) }
    b.click(); return { found: true }
  })()`)
  console.log('click:', JSON.stringify(clicked))
  await sleep(1500)
  // 冻结检测：3 秒内 evaluate 能否返回
  const frozen = await Promise.race([
    evaluate(`1+1`).then(v => ({ frozen: false, v })),
    sleep(3000).then(() => ({ frozen: true })),
  ])
  console.log('freeze check:', JSON.stringify(frozen))
  console.log('console:', consoleMsgs.slice(0, 6))
  // 再点一次能否关闭（回得去吗）
  if (!frozen.frozen) {
    const back = await evaluate(`(() => {
      const btns = [...document.querySelectorAll('button')]
      const b = btns.find(x => (x.textContent||'').trim() === '终端')
      b?.click()
      return !!b
    })()`)
    await sleep(800)
    const panelGone = await evaluate(`!document.querySelector('[data-bottom-panel]')`)
    console.log('toggle back:', { back, panelGone })
  }
  ws.close()
} catch (e) { console.error('FAIL:', e.message) } finally { app.kill('SIGKILL'); await rm(userDir, { recursive: true, force: true }).catch(() => {}) }
