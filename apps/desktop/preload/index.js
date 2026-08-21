import { contextBridge, ipcRenderer } from 'electron'

// 截图覆盖层专用最小 preload（决策 20 后它是唯一使用 preload 的 WebContents）。
// 只暴露覆盖层完成选区交互所需的 IPC，不获得任何其它桌面能力。
contextBridge.exposeInMainWorld(
  'api',
  Object.freeze({
    getScreenshotSession: (sessionId) => ipcRenderer.invoke('screenshot:get-session', sessionId),
    onScreenshotSession: (handler) => {
      const listener = (_event, sessionId) => handler(sessionId)
      ipcRenderer.on('screenshot:begin-session', listener)
      return () => ipcRenderer.removeListener('screenshot:begin-session', listener)
    },
    reportScreenshotReady: (sessionId) => ipcRenderer.invoke('screenshot:overlay-ready', sessionId),
    completeScreenshot: (payload) => ipcRenderer.invoke('screenshot:complete', payload),
    cancelScreenshot: (sessionId) => ipcRenderer.invoke('screenshot:cancel', sessionId),
    saveScreenshot: (payload) => ipcRenderer.invoke('screenshot:save', payload),
    copyScreenshot: (data) => ipcRenderer.invoke('screenshot:copy', data)
  })
)
