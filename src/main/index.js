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

const IMAGE_FILE_TYPES = {
  png: {
    extension: 'png',
    filterName: 'PNG 图片'
  },
  jpeg: {
    extension: 'jpg',
    filterName: 'JPEG 图片'
  },
  webp: {
    extension: 'webp',
    filterName: 'WebP 图片'
  }
}

function normalizeBarcodeData(type, rawData) {
  const fileType = BARCODE_FILE_TYPES[type]

  if (!fileType || !['string', 'object'].includes(typeof rawData)) {
    throw new Error('不支持的条码文件数据')
  }

  const data = rawData instanceof Uint8Array
    ? Buffer.from(rawData)
    : rawData

  if (
    (type === 'svg' && typeof data !== 'string') ||
    (type === 'png' && !Buffer.isBuffer(data))
  ) {
    throw new Error('条码文件格式与数据不匹配')
  }

  return { data, fileType }
}

function sanitizeFileBaseName(name, fallback = 'file') {
  return String(name || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 80) || fallback
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
  const { data, fileType } = normalizeBarcodeData(payload?.type, payload?.data)

  if (Buffer.byteLength(data) > 20 * 1024 * 1024) {
    throw new Error('条码文件超过 20 MB，已拒绝保存')
  }

  const safeBaseName = sanitizeFileBaseName(payload.name, 'barcode')
  const defaultPath = `${safeBaseName}.${fileType.extension}`
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

ipcMain.handle('barcode:save-files', async (event, payload) => {
  if (!Array.isArray(payload?.files) || payload.files.length === 0 || payload.files.length > 500) {
    throw new Error('批量条码数量必须在 1–500 之间')
  }

  const normalizedFiles = payload.files.map((file) => {
    const normalized = normalizeBarcodeData(payload.type, file?.data)
    return {
      ...normalized,
      name: sanitizeFileBaseName(file?.name, 'barcode')
    }
  })
  const totalBytes = normalizedFiles.reduce((total, file) => total + Buffer.byteLength(file.data), 0)

  if (totalBytes > 100 * 1024 * 1024) {
    throw new Error('批量条码总大小超过 100 MB，已拒绝保存')
  }

  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: '选择批量条码保存文件夹',
    properties: ['openDirectory', 'createDirectory', 'promptToCreate']
  })

  if (result.canceled || !result.filePaths[0]) {
    return { status: 'cancelled', saved: 0 }
  }

  const directory = result.filePaths[0]
  const usedNames = new Map()

  for (const [index, file] of normalizedFiles.entries()) {
    const nameKey = file.name.toLocaleLowerCase('en-US')
    const occurrence = (usedNames.get(nameKey) || 0) + 1
    usedNames.set(nameKey, occurrence)
    const uniqueName = occurrence === 1 ? file.name : `${file.name}-${occurrence}`
    const filePath = join(directory, `${uniqueName}.${file.fileType.extension}`)
    await writeFile(filePath, file.data, file.fileType.encoding || undefined)
    event.sender.send('barcode:save-progress', {
      completed: index + 1,
      total: normalizedFiles.length,
      name: uniqueName
    })
  }

  return {
    status: 'saved',
    saved: normalizedFiles.length,
    directory
  }
})

ipcMain.handle('image:save-file', async (event, payload) => {
  const fileType = IMAGE_FILE_TYPES[payload?.type]
  const data = payload?.data instanceof Uint8Array
    ? Buffer.from(payload.data)
    : null

  if (!fileType || !data) {
    throw new Error('不支持的图片文件数据')
  }

  if (data.byteLength > 100 * 1024 * 1024) {
    throw new Error('图片文件超过 100 MB，已拒绝保存')
  }

  const safeBaseName = sanitizeFileBaseName(payload.name, 'edited-image')
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showSaveDialog(ownerWindow, {
    title: `保存 ${fileType.filterName}`,
    defaultPath: `${safeBaseName}.${fileType.extension}`,
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

  await writeFile(result.filePath, data)
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
