// fence 启动自检（v3.0.0 §3.2「fence 必须 fail-closed」）。
//
// fence 靠猴补丁 http.createServer 实现，上游换一种建服务器或挂 upgrade 的写法就会
// 静默失效——端口照常、UI 照常，只是认证没了。所以每次启动都要反向证明它生效：
// 从主进程直接发不带 token 的请求（不经注入了头的分区），必须被 403 拒绝。
//
// 任何一项不是 403 都视为 fence 未生效：不展示窗口，交由调用方进降级页。
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import net from 'node:net'

const PROBE_TIMEOUT_MS = 5_000

function probeHttp(origin) {
  return new Promise((resolve, reject) => {
    const request = http.get(origin, { timeout: PROBE_TIMEOUT_MS }, (response) => {
      response.resume()
      response.once('end', () => resolve(response.statusCode))
    })
    request.once('timeout', () => {
      request.destroy()
      reject(new Error('fence 自检：HTTP 探针超时'))
    })
    request.once('error', reject)
  })
}

function probeUpgrade(origin, path = '/') {
  const target = new URL(origin)
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(target.port), target.hostname)
    let received = ''
    socket.setEncoding('utf8')
    socket.setTimeout(PROBE_TIMEOUT_MS, () => {
      socket.destroy()
      reject(new Error('fence 自检：WebSocket 探针超时'))
    })
    socket.once('connect', () => {
      socket.write([
        `GET ${path} HTTP/1.1`,
        `Host: ${target.host}`,
        `Origin: ${target.origin}`,
        'Connection: Upgrade',
        'Upgrade: websocket',
        'Sec-WebSocket-Version: 13',
        `Sec-WebSocket-Key: ${randomBytes(16).toString('base64')}`,
        '',
        ''
      ].join('\r\n'))
    })
    socket.on('data', (chunk) => {
      received += chunk
      const match = received.match(/^HTTP\/1\.1 (\d+)/)
      if (!match) return
      socket.destroy()
      resolve(Number(match[1]))
    })
    socket.once('error', reject)
  })
}

/**
 * @returns {Promise<{http: number, ws: number}>} 两条链路的实际状态码
 * @throws 任一链路未被拒绝时抛出，调用方必须据此拒绝展示 UI
 */
/** 服务刚 listen 时首个连接可能被重置；只重试连接层错误，状态码一律不重试。 */
async function probeWithRetry(probe, origin, attempts = 8) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await probe(origin)
    } catch (error) {
      if (!/ECONNRESET|ECONNREFUSED|EPIPE|socket hang up/.test(String(error?.message))) throw error
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)))
    }
  }
  throw lastError
}

export async function assertFenceEngaged(origin) {
  const [httpStatus, wsStatus] = await Promise.all([
    probeWithRetry(probeHttp, origin),
    probeWithRetry(probeUpgrade, origin)
  ])
  const failures = []
  if (httpStatus !== 403) failures.push(`HTTP 无 token 请求返回 ${httpStatus}，应为 403`)
  if (wsStatus !== 403) failures.push(`WebSocket 无 token 握手返回 ${wsStatus}，应为 403`)
  if (failures.length) {
    throw new Error(`DSH 认证 fence 未生效：${failures.join('；')}`)
  }
  return { http: httpStatus, ws: wsStatus }
}
