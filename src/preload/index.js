import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld(
  'api',
  Object.freeze({
    ping: () => ipcRenderer.invoke('ping'),
    saveBarcodeFile: (payload) => ipcRenderer.invoke('barcode:save-file', payload)
  })
)
