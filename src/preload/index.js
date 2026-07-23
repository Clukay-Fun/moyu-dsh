import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld(
  'api',
  Object.freeze({
    ping: () => ipcRenderer.invoke('ping'),
    saveBarcodeFile: (payload) => ipcRenderer.invoke('barcode:save-file', payload),
    saveBarcodeFiles: (payload) => ipcRenderer.invoke('barcode:save-files', payload),
    saveImageFile: (payload) => ipcRenderer.invoke('image:save-file', payload),
    savePdfFile: (payload) => ipcRenderer.invoke('pdf:save-file', payload),
    savePdfFiles: (payload) => ipcRenderer.invoke('pdf:save-files', payload),
    showPdfOutput: (path) => ipcRenderer.invoke('pdf:show-item', path),
    startScreenshot: () => ipcRenderer.invoke('screenshot:start'),
    captureScrollFrame: (rect) => ipcRenderer.invoke('screenshot:capture-scroll-frame', rect),
    getScreenshotSession: (sessionId) => ipcRenderer.invoke('screenshot:get-session', sessionId),
    completeScreenshot: (payload) => ipcRenderer.invoke('screenshot:complete', payload),
    cancelScreenshot: (sessionId) => ipcRenderer.invoke('screenshot:cancel', sessionId),
    saveScreenshot: (payload) => ipcRenderer.invoke('screenshot:save', payload),
    copyScreenshot: (data) => ipcRenderer.invoke('screenshot:copy', data),
    onBarcodeSaveProgress: (callback) => {
      const listener = (_event, progress) => callback(progress)
      ipcRenderer.on('barcode:save-progress', listener)
      return () => ipcRenderer.removeListener('barcode:save-progress', listener)
    },
    onPdfSaveProgress: (callback) => {
      const listener = (_event, progress) => callback(progress)
      ipcRenderer.on('pdf:save-progress', listener)
      return () => ipcRenderer.removeListener('pdf:save-progress', listener)
    },
    onScreenshotCaptured: (callback) => {
      const listener = (_event, result) => callback(result)
      ipcRenderer.on('screenshot:captured', listener)
      return () => ipcRenderer.removeListener('screenshot:captured', listener)
    },
    onScreenshotCancelled: (callback) => {
      const listener = () => callback()
      ipcRenderer.on('screenshot:cancelled', listener)
      return () => ipcRenderer.removeListener('screenshot:cancelled', listener)
    }
  })
)
