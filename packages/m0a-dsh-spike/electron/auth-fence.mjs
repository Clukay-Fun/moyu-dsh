import http from 'node:http'
import { syncBuiltinESMExports } from 'node:module'
import { timingSafeEqual } from 'node:crypto'

const TOKEN_HEADER = 'x-moyu-session'

function equalSecret(actual, expected) {
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
    'forbidden',
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
      ready: expectedOrigin !== undefined,
    }
    report(result)
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
    },
  }
}
