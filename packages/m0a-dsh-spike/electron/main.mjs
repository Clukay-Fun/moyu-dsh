import { app, BrowserWindow, MessageChannelMain, session, utilityProcess } from 'electron'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const workerPath = fileURLToPath(new URL('./host-worker.mjs', import.meta.url))
const dshHome = process.env.M0A_DSH_HOME
const authProbe = process.env.M0A_AUTH_PROBE === '1'
if (!dshHome) throw new Error('run npm run prepare:profile, then export the printed M0A_DSH_HOME')

const waitFor = async (test, label, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await test()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`timeout waiting for ${label}`)
}

function request(origin, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(origin, { headers }, (response) => {
      response.resume()
      response.once('end', () => resolve(response.statusCode))
    })
    req.once('error', reject)
  })
}

function upgrade(origin, path, headers = {}) {
  const target = new URL(origin)
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(target.port), target.hostname)
    let response = ''
    socket.setEncoding('utf8')
    socket.once('connect', () => socket.write([
      `GET ${path} HTTP/1.1`,
      `Host: ${headers.Host ?? target.host}`,
      `Origin: ${headers.Origin ?? target.origin}`,
      'Connection: Upgrade',
      'Upgrade: websocket',
      'Sec-WebSocket-Version: 13',
      `Sec-WebSocket-Key: ${randomBytes(16).toString('base64')}`,
      ...(headers['X-Moyu-Session'] ? [`X-Moyu-Session: ${headers['X-Moyu-Session']}`] : []),
      '',
      '',
    ].join('\r\n')))
    socket.on('data', chunk => {
      response += chunk
      const match = response.match(/^HTTP\/1\.1 (\d+)/)
      if (match) {
        socket.destroy()
        resolve(Number(match[1]))
      }
    })
    socket.once('error', reject)
    socket.setTimeout(5000, () => { socket.destroy(); reject(new Error('upgrade timeout')) })
  })
}

function startHost(generation) {
  const token = randomBytes(32).toString('base64url')
  const child = utilityProcess.fork(workerPath, [], {
    execArgv: ['--expose-internals'],
    env: { ...process.env, M0A_DSH_HOME: dshHome },
    stdio: 'pipe',
    serviceName: `Moyu DSH Host M0a ${generation}`,
  })
  child.stdout?.pipe(process.stdout)
  child.stderr?.pipe(process.stderr)
  child.postMessage({ type: 'host-auth', generation, token })
  const evidence = []
  child.on('message', message => {
    if (message.type === 'auth-evidence') evidence.push(message.evidence)
  })
  return { child, token, generation, evidence }
}

function connectBridge(host) {
  const { port1, port2 } = new MessageChannelMain()
  host.child.postMessage({ type: 'desktop-port' }, [port1])
  let rpcId = 0
  const pending = new Map()
  port2.on('message', ({ data }) => {
    const resolve = pending.get(data?.id)
    if (resolve) { pending.delete(data.id); resolve(data) }
  })
  port2.start()
  return () => new Promise((resolve) => {
    const id = ++rpcId
    pending.set(id, resolve)
    port2.postMessage({ id, method: 'desktop.ping' })
  })
}

function ready(host) {
  return new Promise((resolve, reject) => {
    host.child.on('message', message => {
      if (message.type !== 'host-ready') return
      host.url = message.url
      resolve(message)
    })
    host.child.once('exit', code => reject(new Error(`Host exited before ready: ${code}`)))
  })
}

function stopHost(host) {
  if (host.child.killed) return Promise.resolve()
  return new Promise(resolve => {
    host.child.once('exit', resolve)
    host.child.kill()
  })
}

function installHeaderInjection(partitionSession, host) {
  const parsed = new URL(host.url)
  const filter = { urls: [`http://${parsed.host}/*`, `ws://${parsed.host}/*`] }
  const observed = []
  partitionSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const requestHeaders = {
      ...details.requestHeaders,
      Origin: parsed.origin,
      'X-Moyu-Session': host.token,
    }
    observed.push({ url: details.url, resourceType: details.resourceType })
    callback({ requestHeaders })
  })
  return observed
}

async function diskContainsSecret(root, secret) {
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name === 'node_modules' || entry.name === '.git') continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (await visit(path)) return true
      } else if (entry.isFile()) {
        const data = await readFile(path)
        if (data.includes(Buffer.from(secret))) return true
      }
    }
    return false
  }
  return visit(root)
}

function installNavigationPolicy(win) {
  const state = { allowedOrigin: undefined, blockedNavigations: 0, deniedWindows: 0 }
  win.webContents.on('will-navigate', (event, target) => {
    if (state.allowedOrigin && new URL(target).origin === state.allowedOrigin) return
    state.blockedNavigations += 1
    event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(() => {
    state.deniedWindows += 1
    return { action: 'deny' }
  })
  return state
}

async function runGeneration(win, partitionSession, generation) {
  const host = startHost(generation)
  const info = await ready(host)
  win.navigation.allowedOrigin = new URL(host.url).origin
  const ping = connectBridge(host)
  const injected = installHeaderInjection(partitionSession, host)
  const bridge = await ping()
  process.stdout.write(`M0A_BRIDGE ${JSON.stringify({ pid: info.pid, generation, bridge })}\n`)
  await win.loadURL(host.url)
  await waitFor(() => win.webContents.executeJavaScript(
    `[...document.querySelectorAll('button')].some(item => item.innerText.includes('稍后配置'))`,
  ), 'onboarding controls')
  await win.webContents.executeJavaScript(`{
    const button = [...document.querySelectorAll('button')].find(item => item.innerText.includes('稍后配置'))
    if (button) button.click()
  }`)
  await win.webContents.executeJavaScript(`{
    const button = [...document.querySelectorAll('button')].find(item => (item.getAttribute('aria-label') || '').includes('打开侧边栏'))
    if (button) button.click()
  }`)
  const hello = await waitFor(async () => {
    const text = await win.webContents.executeJavaScript('document.body.innerText')
    return text.includes('Moyu M0a hello client plugin rendered') && text
  }, 'hello plugin render')
  const pageState = await win.webContents.executeJavaScript(`JSON.stringify({
    url: location.href,
    html: document.documentElement.outerHTML,
    local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])),
    globals: Object.fromEntries(Object.getOwnPropertyNames(window).flatMap(key => {
      try { return typeof window[key] === 'string' ? [[key, window[key]]] : [] } catch { return [] }
    })),
  })`)
  await waitFor(() => host.evidence.some(item => item.kind === 'http' && item.token), 'authenticated HTTP evidence')
  await waitFor(() => host.evidence.some(item => item.kind === 'ws' && item.token), 'authenticated WS evidence')
  return { host, injected, hello: hello.includes('Moyu M0a hello client plugin rendered'), pageState }
}

async function runAuthProbe(win, partitionSession) {
  const first = await runGeneration(win, partitionSession, 1)
  win.webContents.debugger.attach('1.3')
  win.webContents.debugger.on('message', (_event, method, params) => {
    if (method === 'Network.webSocketHandshakeResponseReceived') {
      win.networkProof.handshakes.push({ url: params.response.url, status: params.response.status })
    } else if (method === 'Network.webSocketFrameReceived') {
      win.networkProof.framesReceived += 1
    }
  })
  await win.webContents.debugger.sendCommand('Network.enable')
  const reloaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve))
  win.webContents.reload()
  await reloaded
  await waitFor(() => win.networkProof.handshakes.some(item => item.status === 101), 'WebSocket 101 handshake')
  const credentialProbe = await win.webContents.executeJavaScript(`(async () => {
    const call = async (method, payload) => {
      const rpcId = crypto.randomUUID()
      const response = await fetch('/api/' + method, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
      })
      return { status: response.status, body: await response.json() }
    }
    const set = await call('credentials.set', { ref: 'M0A_FRAME_PROBE', value: 'ephemeral-not-a-model-key' })
    const unset = await call('credentials.unset', { ref: 'M0A_FRAME_PROBE' })
    return { set: set.status, unset: unset.status }
  })()`)
  if (credentialProbe.set !== 200 || credentialProbe.unset !== 200) throw new Error('credential event probe failed')
  await waitFor(() => win.networkProof.framesReceived > 0, 'WebSocket frame')
  const origin = first.host.url
  const validHeaders = { Origin: origin, Host: new URL(origin).host, 'X-Moyu-Session': first.host.token }
  const validHttpStatus = (await partitionSession.fetch(origin)).status
  const invalidHttp = {
    missingToken: await request(origin, { Origin: origin }),
    wrongToken: await request(origin, { ...validHeaders, 'X-Moyu-Session': 'wrong' }),
    wrongOrigin: await request(origin, { ...validHeaders, Origin: 'http://127.0.0.1:1' }),
    wrongHost: await request(origin, { ...validHeaders, Host: '127.0.0.1:1' }),
  }
  const invalidWs = await upgrade(origin, '/api/events.host')
  await win.webContents.executeJavaScript(`window.open('https://example.com/')`)
  await win.webContents.executeJavaScript(`location.href = 'https://example.com/'`).catch(() => {})
  await waitFor(() => win.navigation.blockedNavigations > 0 && win.navigation.deniedWindows > 0, 'navigation policy evidence')
  const navigationStayedLocal = win.webContents.getURL().startsWith(origin)
  const firstTokenOnDisk = await diskContainsSecret(dshHome, first.host.token)
  const firstToken = first.host.token
  const firstUrl = first.host.url
  await stopHost(first.host)

  const second = await runGeneration(win, partitionSession, 2)
  const secondOrigin = second.host.url
  const oldTokenStatus = await request(secondOrigin, {
    Origin: secondOrigin,
    Host: new URL(secondOrigin).host,
    'X-Moyu-Session': firstToken,
  })
  let oldOriginClosed = false
  try { await request(firstUrl) } catch { oldOriginClosed = true }
  const secondTokenOnDisk = await diskContainsSecret(dshHome, second.host.token)

  const proof = {
    path: 'A',
    upstreamPatched: false,
    httpInjected: first.injected.some(item => item.url.startsWith('http:')),
    wsInjected: first.injected.some(item => item.url.startsWith('ws:')),
    hostAcceptedHttp: first.host.evidence.some(item => item.kind === 'http' && item.token && item.origin && item.host),
    hostAcceptedWs: first.host.evidence.some(item => item.kind === 'ws' && item.token && item.origin && item.host),
    wsHandshake101: win.networkProof.handshakes.some(item => item.status === 101),
    wsFramesReceived: win.networkProof.framesReceived,
    validHttpStatus,
    invalidHttp,
    invalidWs,
    helloRendered: first.hello && second.hello,
    pageStateContainsToken: first.pageState.includes(firstToken) || second.pageState.includes(second.host.token),
    tokenOnDisk: firstTokenOnDisk || secondTokenOnDisk,
    navigationPolicy: {
      blockedNavigations: win.navigation.blockedNavigations,
      deniedWindows: win.navigation.deniedWindows,
      stayedLocal: navigationStayedLocal,
    },
    generationRotated: first.host.token !== second.host.token && firstUrl !== second.host.url,
    oldTokenStatus,
    oldOriginClosed,
    secondGenerationLoaded: win.webContents.getURL().startsWith(secondOrigin),
  }
  assert.equal(proof.upstreamPatched, false)
  assert.equal(proof.httpInjected, true)
  assert.equal(proof.wsInjected, true)
  assert.equal(proof.hostAcceptedHttp, true)
  assert.equal(proof.hostAcceptedWs, true)
  assert.equal(proof.wsHandshake101, true)
  assert.ok(proof.wsFramesReceived > 0)
  assert.equal(proof.validHttpStatus, 200)
  assert.deepEqual(proof.invalidHttp, { missingToken: 403, wrongToken: 403, wrongOrigin: 403, wrongHost: 403 })
  assert.equal(proof.invalidWs, 403)
  assert.equal(proof.helloRendered, true)
  assert.equal(proof.pageStateContainsToken, false)
  assert.equal(proof.tokenOnDisk, false)
  assert.ok(proof.navigationPolicy.blockedNavigations > 0)
  assert.ok(proof.navigationPolicy.deniedWindows > 0)
  assert.equal(proof.navigationPolicy.stayedLocal, true)
  assert.equal(proof.generationRotated, true)
  assert.equal(proof.oldTokenStatus, 403)
  assert.equal(proof.oldOriginClosed, true)
  assert.equal(proof.secondGenerationLoaded, true)
  process.stdout.write(`M0A_AUTH_PROOF ${JSON.stringify(proof)}\n`)
  await stopHost(second.host)
}

app.whenReady().then(async () => {
  const partitionSession = session.fromPartition(`m0a-auth-${randomUUID()}`, { cache: false })
  const win = new BrowserWindow({
    show: !authProbe && process.env.M0A_AUTOTEST !== '1',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      session: partitionSession,
    },
  })
  win.navigation = installNavigationPolicy(win)
  win.networkProof = { handshakes: [], framesReceived: 0 }
  if (authProbe) {
    await runAuthProbe(win, partitionSession)
    win.webContents.debugger.detach()
    win.destroy()
    app.quit()
    return
  }

  const active = await runGeneration(win, partitionSession, 1)
  process.stdout.write(`M0A_WINDOW ${JSON.stringify({ url: win.webContents.getURL(), direct: true })}\n`)
  if (process.env.M0A_AUTOTEST === '1') {
    await stopHost(active.host)
    process.stdout.write(`M0A_CRASH_ISOLATION ${JSON.stringify({ electronAlive: true, hostPid: active.host.child.pid, hostExited: true })}\n`)
    win.destroy()
    app.quit()
  } else {
    app.on('before-quit', () => { if (!active.host.child.killed) active.host.child.kill() })
  }
}).catch(error => { console.error(error); app.exit(1) })
