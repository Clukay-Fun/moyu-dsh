// DSH 窗口的会话与导航策略（v3.0.0 §3.2 A 路径、§3.3）。
import { net, session } from 'electron'

const TOKEN_HEADER = 'X-Moyu-Session'

/** 每代 Host 用一个独立、非持久化的分区，避免 token 注入波及其他窗口。 */
export function createDshSession(generation) {
  return session.fromPartition(`moyu-dsh-${generation}`, { cache: false })
}

/**
 * 只对本代 Host 的精确 authority 注入 token。
 *
 * 作用域必须精确到 host:port：注入范围一旦放宽到整个分区，模型回复里的一张远程图片
 * 就会把 token 带给外部主机。
 */
export function installHeaderInjection(dshSession, host) {
  const parsed = new URL(host.url)
  const filter = { urls: [`http://${parsed.host}/*`, `ws://${parsed.host}/*`] }
  const observed = []
  dshSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    observed.push({ url: details.url, resourceType: details.resourceType })
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        Origin: parsed.origin,
        [TOKEN_HEADER]: host.token
      }
    })
  })
  return observed
}

/**
 * 用 Chromium 网络栈验证打包态的 loopback fence。
 *
 * 实际 DSH UI 走 Chromium session，因此发行门禁必须验证同一条网络路径。
 * HTTP 直接读取 403；WS 的 WHATWG API 不暴露握手状态码，所以同时
 * 要求 Host fence 上报一条无 token 的 ws evidence，二者缺一不可。
 */
export async function assertChromiumFenceEngaged(host) {
  const probeSession = session.fromPartition(`moyu-dsh-probe-${host.generation}`, { cache: false })
  const response = await probeSession.fetch(host.url)
  await response.arrayBuffer()

  const wsUrl = host.url.replace(/^http:/, 'ws:')
  const socket = new net.WebSocket(wsUrl)
  await waitForEvidence(host, 'ws')
  socket.close()

  const wsEvidence = [...host.evidence].reverse().find((entry) => entry?.kind === 'ws')
  const failures = []
  if (response.status !== 403) failures.push(`HTTP 无 token 请求返回 ${response.status}，应为 403`)
  if (!wsEvidence || wsEvidence.token || wsEvidence.ready !== true) {
    failures.push('WebSocket 无 token 握手未被 Host fence 明确拒绝')
  }
  if (failures.length) throw new Error(`DSH 认证 fence 未生效：${failures.join('；')}`)
  return { http: response.status, ws: 403 }
}

async function waitForEvidence(host, kind, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (host.evidence.some((entry) => entry?.kind === kind)) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`fence 自检：${kind} 探针未到达 Host`)
}

/**
 * 主窗口只允许停留在本代 DSH origin。
 *
 * 外链、新窗口、下载与权限请求的完整接管在 B4 与窗口创建处合并，这里只装
 * 导航面的两条最小策略，便于在切换主界面之前单独验证。
 */
export function installNavigationPolicy(win, { allowedOrigin, onExternal } = {}) {
  const state = { allowedOrigin, blockedNavigations: 0, deniedWindows: 0 }

  win.webContents.on('will-navigate', (event, target) => {
    if (state.allowedOrigin && safeOrigin(target) === state.allowedOrigin) return
    state.blockedNavigations += 1
    event.preventDefault()
    onExternal?.(target)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    state.deniedWindows += 1
    onExternal?.(url)
    return { action: 'deny' }
  })

  return state
}

/** DSH 主窗口不使用浏览器默认下载，也不向页面授予任何 Electron 权限。 */
export function installSessionPolicy(dshSession) {
  const state = { deniedDownloads: 0, deniedPermissions: 0 }
  dshSession.on('will-download', (event, item) => {
    state.deniedDownloads += 1
    event.preventDefault()
    item.cancel()
  })
  dshSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    state.deniedPermissions += 1
    callback(false)
  })
  dshSession.setPermissionCheckHandler(() => false)
  return state
}

function safeOrigin(value) {
  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}
