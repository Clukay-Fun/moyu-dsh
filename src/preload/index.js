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
    onBarcodeSaveProgress: (callback) => {
      const listener = (_event, progress) => callback(progress)
      ipcRenderer.on('barcode:save-progress', listener)
      return () => ipcRenderer.removeListener('barcode:save-progress', listener)
    },
    onPdfSaveProgress: (callback) => {
      const listener = (_event, progress) => callback(progress)
      ipcRenderer.on('pdf:save-progress', listener)
      return () => ipcRenderer.removeListener('pdf:save-progress', listener)
    }
  })
)
