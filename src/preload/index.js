import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld(
  'api',
  Object.freeze({
    ping: () => ipcRenderer.invoke('ping'),
    saveBarcodeFile: (payload) => ipcRenderer.invoke('barcode:save-file', payload),
    saveBarcodeFiles: (payload) => ipcRenderer.invoke('barcode:save-files', payload),
    saveImageFile: (payload) => ipcRenderer.invoke('image:save-file', payload),
    getAiStatus: () => ipcRenderer.invoke('ai:get-status'),
    pickAiImages: (payload) => ipcRenderer.invoke('ai:pick-images', payload),
    pickAiFolder: () => ipcRenderer.invoke('ai:pick-folder'),
    removeAiInputs: (inputIds) => ipcRenderer.invoke('ai:remove-inputs', inputIds),
    runAiTask: (payload) => ipcRenderer.invoke('ai:run', payload),
    saveAiResults: (resultIds) => ipcRenderer.invoke('ai:save-results', resultIds),
    exportAiPsd: (resultId) => ipcRenderer.invoke('ai:export-psd', resultId),
    getFormatStatus: () => ipcRenderer.invoke('format:get-status'),
    pickFormatFiles: (payload) => ipcRenderer.invoke('format:pick-files', payload),
    pickFormatFolder: (payload) => ipcRenderer.invoke('format:pick-folder', payload),
    removeFormatInputs: (inputIds) => ipcRenderer.invoke('format:remove-inputs', inputIds),
    runFormatTask: (payload) => ipcRenderer.invoke('format:run', payload),
    cancelFormatTask: (taskId) => ipcRenderer.invoke('format:cancel', taskId),
    saveFormatResults: (resultIds) => ipcRenderer.invoke('format:save-results', resultIds),
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
    recognizeScreenshot: (data) => ipcRenderer.invoke('screenshot:ocr', data),
    copyScreenshotText: (text) => ipcRenderer.invoke('screenshot:copy-text', text),
    pinScreenshot: (data) => ipcRenderer.invoke('screenshot:pin', data),
    getPinnedScreenshot: (pinId) => ipcRenderer.invoke('screenshot:pin-get', pinId),
    resizePinnedScreenshot: (payload) => ipcRenderer.invoke('screenshot:pin-resize', payload),
    setPinnedScreenshotOpacity: (payload) => ipcRenderer.invoke('screenshot:pin-opacity', payload),
    copyPinnedScreenshot: (pinId) => ipcRenderer.invoke('screenshot:pin-copy', pinId),
    closePinnedScreenshot: (pinId) => ipcRenderer.invoke('screenshot:pin-close', pinId),
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
    onAiModelProgress: (callback) => {
      const listener = (_event, progress) => callback(progress)
      ipcRenderer.on('ai:model-progress', listener)
      return () => ipcRenderer.removeListener('ai:model-progress', listener)
    },
    onAiTaskProgress: (callback) => {
      const listener = (_event, progress) => callback(progress)
      ipcRenderer.on('ai:task-progress', listener)
      return () => ipcRenderer.removeListener('ai:task-progress', listener)
    },
    onFormatProgress: (callback) => {
      const listener = (_event, progress) => callback(progress)
      ipcRenderer.on('format:progress', listener)
      return () => ipcRenderer.removeListener('format:progress', listener)
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
    },
    onScreenshotOcrProgress: (callback) => {
      const listener = (_event, progress) => callback(progress)
      ipcRenderer.on('screenshot:ocr-progress', listener)
      return () => ipcRenderer.removeListener('screenshot:ocr-progress', listener)
    }
  })
)
