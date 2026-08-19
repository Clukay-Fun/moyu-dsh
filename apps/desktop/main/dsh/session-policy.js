// DSH 窗口的会话与导航策略（v3.0.0 §3.2 A 路径、§3.3）。
import { session } from 'electron'

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

function safeOrigin(value) {
  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}
