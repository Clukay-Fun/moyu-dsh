// DSH Host 侧的认证 fence（v3.0.0 M0a G4 A 路径）。
//
// 上游 webserver 只提供 register / registerUpgrade / registerFallback，没有
// “所有路由之前”的中间件接缝，所以只能在 Host 进程里包住 http.createServer。
// 这个做法的失败形态是 fail-open：上游一旦改用 addListener('upgrade')、once、
// node:https、http2 或不经 http.createServer 建服务器，fence 会静默失效而端口照常可用。
// 因此主进程必须在显示窗口前跑一次启动自检（见 apps/desktop/main/dsh/self-test.js），
// 由“无 token 请求必须 403”反向证明 fence 真的生效。
import http from 'node:http'
import { syncBuiltinESMExports } from 'node:module'
import { timingSafeEqual } from 'node:crypto'

const TOKEN_HEADER = 'x-moyu-session'

function equalSecret(actual, expected) {
  // 头部重复时 Node 会给出数组；非字符串一律拒绝。
  if (typeof actual !== 'string') return false
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function rejectHttp(response) {
  response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
  response.end('forbidden')
}

function rejectUpgrade(socket) {
  socket.end([
    'HTTP/1.1 403 Forbidden',
    'Connection: close',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Length: 9',
    '',
    'forbidden'
  ].join('\r\n'))
}

export function installAuthFence({ token, generation, report }) {
  let expectedOrigin
  let expectedHost
  const originalCreateServer = http.createServer

  const inspect = (request, kind) => {
    const result = {
      generation,
      kind,
      path: request.url ?? '/',
      token: equalSecret(request.headers[TOKEN_HEADER], token),
      origin: request.headers.origin === expectedOrigin,
      host: request.headers.host === expectedHost,
      // origin 未知时一律拒绝：监听已开始但本代 origin 还没确定的窗口期不能放行。
      ready: expectedOrigin !== undefined
    }
    report?.(result)
    return result.ready && result.token && result.origin && result.host
  }

  http.createServer = function createAuthenticatedServer(...args) {
    const listenerIndex = typeof args[0] === 'function' ? 0 : 1
    const requestListener = args[listenerIndex]
    if (typeof requestListener === 'function') {
      args[listenerIndex] = function authenticatedRequest(request, response) {
        if (!inspect(request, 'http')) return rejectHttp(response)
        return requestListener.call(this, request, response)
      }
    }
    const server = originalCreateServer.apply(this, args)
    server.once('listening', () => {
      const address = server.address()
      report?.({ generation, kind: 'server-lifecycle', event: 'listening', address })
      if (!address || typeof address === 'string') return
      const request = http.get({ host: '127.0.0.1', port: address.port, path: '/' }, (response) => {
        response.resume()
        response.once('end', () => report?.({
          generation,
          kind: 'server-lifecycle',
          event: 'self-http',
          status: response.statusCode
        }))
      })
      request.once('error', (error) => report?.({
        generation,
        kind: 'server-lifecycle',
        event: 'self-http-error',
        code: error.code
      }))
    })
    server.once('close', () => report?.({ generation, kind: 'server-lifecycle', event: 'close' }))
    const originalOn = server.on
    server.on = function on(event, listener) {
      if (event !== 'upgrade') return originalOn.call(this, event, listener)
      return originalOn.call(this, event, function authenticatedUpgrade(request, socket, head) {
        if (!inspect(request, 'ws')) return rejectUpgrade(socket)
        return listener.call(this, request, socket, head)
      })
    }
    return server
  }
  syncBuiltinESMExports()

  return {
    setOrigin(origin) {
      const parsed = new URL(origin)
      expectedOrigin = parsed.origin
      expectedHost = parsed.host
    }
  }
}
