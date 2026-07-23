import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain,
  nativeImage,
  screen,
  shell
} from 'electron'
import { randomUUID } from 'node:crypto'
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

const PDF_OUTPUT_TYPES = {
  pdf: {
    extension: 'pdf',
    filterName: 'PDF 文档'
  },
  png: {
    extension: 'png',
    filterName: 'PNG 图片'
  },
  jpeg: {
    extension: 'jpg',
    filterName: 'JPEG 图片'
  },
  txt: {
    extension: 'txt',
    filterName: '文本文件'
  }
}

const screenshotSessions = new Map()
let mainWindow = null

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
  mainWindow = new BrowserWindow({
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
  mainWindow.on('closed', () => {
    mainWindow = null
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

ipcMain.handle('pdf:save-file', async (event, payload) => {
  const fileType = PDF_OUTPUT_TYPES[payload?.type]
  const data = payload?.data instanceof Uint8Array
    ? Buffer.from(payload.data)
    : null

  if (!fileType || !data) {
    throw new Error('不支持的 PDF 工具输出数据')
  }

  if (data.byteLength > 500 * 1024 * 1024) {
    throw new Error('输出文件超过 500 MB，已拒绝保存')
  }

  const safeBaseName = sanitizeFileBaseName(payload.name, 'pdf-output')
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

ipcMain.handle('pdf:save-files', async (event, payload) => {
  const fileType = PDF_OUTPUT_TYPES[payload?.type]

  if (
    !fileType ||
    !Array.isArray(payload?.files) ||
    payload.files.length === 0 ||
    payload.files.length > 500
  ) {
    throw new Error('PDF 批量输出数量必须在 1–500 之间')
  }

  const normalizedFiles = payload.files.map((file) => {
    if (!(file?.data instanceof Uint8Array)) {
      throw new Error('PDF 批量输出包含无效文件数据')
    }

    return {
      name: sanitizeFileBaseName(file.name, 'pdf-output'),
      data: Buffer.from(file.data)
    }
  })
  const totalBytes = normalizedFiles.reduce((total, file) => total + file.data.byteLength, 0)

  if (totalBytes > 500 * 1024 * 1024) {
    throw new Error('PDF 批量输出总大小超过 500 MB，已拒绝保存')
  }

  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: '选择 PDF 工具输出文件夹',
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
    await writeFile(join(directory, `${uniqueName}.${fileType.extension}`), file.data)
    event.sender.send('pdf:save-progress', {
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

ipcMain.handle('pdf:show-item', async (_event, payload) => {
  if (typeof payload?.path !== 'string' || !payload.path.trim()) {
    throw new Error('没有可打开的输出位置')
  }
  if (payload.directory) {
    const error = await shell.openPath(payload.path)
    if (error) throw new Error(error)
  } else {
    shell.showItemInFolder(payload.path)
  }
  return { status: 'shown' }
})

ipcMain.handle('screenshot:start', async (event) => {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const physicalWidth = Math.max(1, Math.round(display.bounds.width * display.scaleFactor))
  const physicalHeight = Math.max(1, Math.round(display.bounds.height * display.scaleFactor))
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: physicalWidth,
      height: physicalHeight
    },
    fetchWindowIcons: false
  })
  const source =
    sources.find((candidate) => String(candidate.display_id) === String(display.id)) ||
    sources[0]

  if (!source || source.thumbnail.isEmpty()) {
    throw new Error('无法读取屏幕画面，请检查系统录屏权限')
  }

  const sessionId = randomUUID()
  const data = source.thumbnail.toPNG()
  const overlay = new BrowserWindow({
    ...display.bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    resizable: false,
    movable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  const session = {
    data,
    displayBounds: display.bounds,
    imageSize: source.thumbnail.getSize(),
    owner: event.sender,
    overlay
  }
  screenshotSessions.set(sessionId, session)
  overlay.once('ready-to-show', () => {
    overlay.show()
    overlay.focus()
  })
  overlay.on('closed', () => {
    const activeSession = screenshotSessions.get(sessionId)
    if (activeSession?.overlay === overlay) {
      screenshotSessions.delete(sessionId)
      activeSession.owner.send('screenshot:cancelled')
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    const overlayUrl = new URL('screenshot.html', process.env.ELECTRON_RENDERER_URL)
    overlayUrl.searchParams.set('session', sessionId)
    await overlay.loadURL(overlayUrl.toString())
  } else {
    await overlay.loadFile(join(__dirname, '../renderer/screenshot.html'), {
      query: { session: sessionId }
    })
  }

  return { status: 'started', sessionId }
})

ipcMain.handle('screenshot:capture-scroll-frame', async (event, rect) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('滚动截图只允许截取本应用主窗口')
  }

  const bounds = mainWindow.getContentBounds()
  const normalized = {
    x: Math.round(Number(rect?.x)),
    y: Math.round(Number(rect?.y)),
    width: Math.round(Number(rect?.width)),
    height: Math.round(Number(rect?.height))
  }
  const isValid =
    Object.values(normalized).every(Number.isFinite) &&
    normalized.x >= 0 &&
    normalized.y >= 0 &&
    normalized.width >= 40 &&
    normalized.height >= 40 &&
    normalized.x + normalized.width <= bounds.width &&
    normalized.y + normalized.height <= bounds.height

  if (!isValid) {
    throw new Error('滚动截图区域无效或超出应用窗口')
  }

  const frame = await event.sender.capturePage(normalized)
  if (frame.isEmpty()) throw new Error('无法截取应用内滚动区域')
  return {
    data: new Uint8Array(frame.toPNG()),
    size: frame.getSize()
  }
})

ipcMain.handle('screenshot:get-session', (_event, sessionId) => {
  const session = screenshotSessions.get(sessionId)
  if (!session) throw new Error('截图会话已失效')
  return {
    data: new Uint8Array(session.data),
    imageSize: session.imageSize,
    displayBounds: session.displayBounds
  }
})

ipcMain.handle('screenshot:complete', (_event, payload) => {
  const session = screenshotSessions.get(payload?.sessionId)
  if (!session) throw new Error('截图会话已失效')
  const rect = payload.rect || {}
  const scaleX = session.imageSize.width / session.displayBounds.width
  const scaleY = session.imageSize.height / session.displayBounds.height
  const x = Math.max(0, Math.min(session.imageSize.width - 1, Math.round(Number(rect.x) * scaleX)))
  const y = Math.max(0, Math.min(session.imageSize.height - 1, Math.round(Number(rect.y) * scaleY)))
  const width = Math.max(
    1,
    Math.min(session.imageSize.width - x, Math.round(Number(rect.width) * scaleX))
  )
  const height = Math.max(
    1,
    Math.min(session.imageSize.height - y, Math.round(Number(rect.height) * scaleY))
  )
  const cropped = nativeImage.createFromBuffer(session.data).crop({ x, y, width, height })
  const data = cropped.toPNG()
  screenshotSessions.delete(payload.sessionId)
  session.overlay.close()
  session.owner.send('screenshot:captured', {
    data: new Uint8Array(data),
    width,
    height
  })
  return { status: 'captured', width, height }
})

ipcMain.handle('screenshot:cancel', (_event, sessionId) => {
  const session = screenshotSessions.get(sessionId)
  if (session) {
    screenshotSessions.delete(sessionId)
    session.overlay.close()
    session.owner.send('screenshot:cancelled')
  }
  return { status: 'cancelled' }
})

ipcMain.handle('screenshot:save', async (event, payload) => {
  const data = payload?.data instanceof Uint8Array ? Buffer.from(payload.data) : null
  if (!data || data.byteLength > 100 * 1024 * 1024) {
    throw new Error('截图数据无效或超过 100 MB')
  }
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showSaveDialog(ownerWindow, {
    title: '保存截图',
    defaultPath: `${sanitizeFileBaseName(payload.name, 'screenshot')}.png`,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  })
  if (result.canceled || !result.filePath) return { status: 'cancelled' }
  await writeFile(result.filePath, data)
  return { status: 'saved', path: result.filePath }
})

ipcMain.handle('screenshot:copy', (_event, data) => {
  if (!(data instanceof Uint8Array) || data.byteLength > 100 * 1024 * 1024) {
    throw new Error('截图数据无效或超过 100 MB')
  }
  const image = nativeImage.createFromBuffer(Buffer.from(data))
  if (image.isEmpty()) throw new Error('无法解析截图数据')
  clipboard.writeImage(image)
  return { status: 'copied', size: image.getSize() }
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
