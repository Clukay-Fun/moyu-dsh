// DSH 认证 fence 的回归验证（v3.0.0 §3.2「fence 必须 fail-closed」）。
//
// fence 靠猴补丁 http.createServer 实现，上游换一种建服务器或挂 upgrade 的写法就会
// 静默失效。这个脚本用两台真实服务器做正反探针：
//   ① 装了 fence 的服务器：无 token 的 HTTP 与 WS 必须都被 403 拒绝；
//   ② 绕过补丁的裸服务器：自检必须抛错，证明它检得出 fence 缺席。
//
// 任一方向不符即退出码 1。上游升级后先跑它，不要等发行才发现认证没了。
import http from 'node:http'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { installAuthFence } = await import(join(root, 'resources', 'dsh-auth-fence.mjs'))
const { assertFenceEngaged } = await import(join(root, 'apps', 'desktop', 'main', 'dsh', 'self-test.js'))

const results = {}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
  })
}

// ① 先装 fence 再建服务器，模拟上游 webserver 的一条路由加一个 upgrade 监听。
const fence = installAuthFence({ token: 'token-under-test', generation: 1, report: () => {} })
const fenced = http.createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' })
  response.end('ok')
})
fenced.on('upgrade', (_request, socket) => {
  socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n')
})
const fencedOrigin = await listen(fenced)
fence.setOrigin(fencedOrigin)
try {
  results.fenced = await assertFenceEngaged(fencedOrigin)
  results.fencedPassed = true
} catch (error) {
  results.fencedPassed = false
  results.fencedError = error.message
}

// ② net 层手写的最小服务器，完全绕过 http.createServer 补丁：
// 代表“上游改了建服务器方式，fence 静默失效”的场景。
const naked = net.createServer((socket) => {
  socket.once('data', (chunk) => {
    if (/Upgrade: websocket/i.test(String(chunk))) {
      socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n')
      return
    }
    socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok')
  })
})
const nakedOrigin = await listen(naked)
try {
  await assertFenceEngaged(nakedOrigin)
  results.nakedRejected = false
} catch (error) {
  results.nakedRejected = true
  results.nakedError = error.message
}

fenced.close()
naked.close()

const passed = results.fencedPassed && results.nakedRejected
console.log(JSON.stringify(results, null, 2))
console.log(passed ? 'fence fail-closed 验证通过' : 'fence fail-closed 验证失败')
process.exit(passed ? 0 : 1)
