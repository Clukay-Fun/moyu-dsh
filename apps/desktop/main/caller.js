// 显式调用主体与能力表（v3.0.0 §6.1）。
//
// 当前只有两类真实主体：legacy WebContents 与 DSH Host generation。不存在实际调用链的
// renderer/job 不提前建模；等对应执行器出现时再加入。
const webContentsCallers = new WeakMap()

export function registerLegacyCaller(win, capabilities = ['legacy.ipc']) {
  const webContents = win.webContents
  const caller = Object.freeze({
    id: `legacy:${webContents.id}`,
    kind: 'legacy',
    capabilities: new Set(capabilities)
  })
  webContentsCallers.set(webContents, caller)
  win.once('closed', () => webContentsCallers.delete(webContents))
  return caller
}

export function requireWebContentsCaller(webContents, capability) {
  const caller = webContentsCallers.get(webContents)
  if (!caller || !caller.capabilities.has(capability)) {
    throw new Error(`此操作只允许从受信的 Moyu 工具窗口发起（缺少 ${capability} 能力）`)
  }
  return caller
}

export function dshCaller(generation) {
  if (!Number.isSafeInteger(generation) || generation < 1) throw new Error('DSH generation 无效')
  return Object.freeze({ id: `dsh:${generation}`, kind: 'dsh', generation })
}
