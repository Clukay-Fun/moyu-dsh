import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BARCODE_FILE_TYPES = {
  svg: {
    extension: 'svg',
    filterName: 'SVG 矢量图',
    encoding: 'utf8'
  },
  png: {
    extension: 'png',
    filterName: 'PNG 图片',
    encoding: null
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('ping', () => 'pong')

ipcMain.handle('barcode:save-file', async (event, payload) => {
  const fileType = BARCODE_FILE_TYPES[payload?.type]

  if (!fileType || !['string', 'object'].includes(typeof payload?.data)) {
    throw new Error('不支持的条码文件数据')
  }

  const data = payload.data instanceof Uint8Array
    ? Buffer.from(payload.data)
    : payload.data

  if (
    (payload.type === 'svg' && typeof data !== 'string') ||
    (payload.type === 'png' && !Buffer.isBuffer(data))
  ) {
    throw new Error('条码文件格式与数据不匹配')
  }

  if (Buffer.byteLength(data) > 20 * 1024 * 1024) {
    throw new Error('条码文件超过 20 MB，已拒绝保存')
  }

  const safeBaseName = String(payload.name || 'barcode')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .slice(0, 80)
  const defaultPath = `${safeBaseName || 'barcode'}.${fileType.extension}`
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showSaveDialog(ownerWindow, {
    title: `保存 ${fileType.extension.toUpperCase()} 条码`,
    defaultPath,
    filters: [
      {
        name: fileType.filterName,
        extensions: [fileType.extension]
      }
    ]
  })

  if (result.canceled || !result.filePath) {
    return { status: 'cancelled' }
  }

  await writeFile(result.filePath, data, fileType.encoding || undefined)
  return { status: 'saved', path: result.filePath }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
