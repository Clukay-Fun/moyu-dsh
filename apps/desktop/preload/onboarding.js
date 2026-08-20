// 引导页专用的最小 preload（v3.0.0 §3.3、AGENTS.md 规则 4）。
//
// 与主 UI preload 完全隔离：只暴露三个动作，不给任何 Node、文件系统或通用 IPC。
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld(
  'moyuOnboarding',
  Object.freeze({
    openLegacy: () => ipcRenderer.invoke('onboarding:open-legacy'),
    continueToDsh: () => ipcRenderer.invoke('onboarding:continue')
  })
)
