// DSH 原生应用外壳（v3.0.0 决策 20）。
//
// 应用只有一个界面：DSH。本文件只负责桌面宿主职责——窗口、Host 生命周期接线、
// 导航/下载/权限策略、启动失败降级页，以及 screenshot_capture 采集链路的
// 系统能力半边（ScreenCaptureKit 抓屏 + 选区覆盖层）。
// 业务能力全部驻留 DSH Host 的 Moyu 插件；renderer 不获得任何 Node API。
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
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { currentDsh, logStartup, startDsh, stopDsh } from './dsh/index.js'
import { installNavigationPolicy, installSessionPolicy } from './dsh/session-policy.js'

let mainWindow = null

function resolveWindowIcon() {
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, 'icon.ico'),
        join(process.resourcesPath, 'app-icon.png')
      ]
    : [
        join(__dirname, '../../build/icon.ico'),
        join(__dirname, '../../assets/app-icon.png')
      ]
  for (const candidate of candidates) {
    if (process.platform !== 'win32' && candidate.endsWith('.ico')) continue
    if (!existsSync(candidate)) continue
    const image = nativeImage.createFromPath(candidate)
    if (!image.isEmpty()) return image
  }
  return undefined
}

/**
 * 创建主窗口。dsh 存在时加载 DSH origin（唯一正式界面）；为 undefined 时只用于
 * 启动失败降级页——无 preload 的本地只读窗口，不是第二套应用入口。
 */
function createWindow({ url, session, policyOrigin } = {}) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    show: false,
    icon: resolveWindowIcon(),
    webPreferences: {
      ...(session ? { session } : {}),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (policyOrigin) {
    installNavigationPolicy(mainWindow, {
      allowedOrigin: policyOrigin,
      onExternal: (value) => {
        try {
          const url = new URL(value)
          if (url.protocol === 'https:' || url.protocol === 'http:') void shell.openExternal(url.href)
        } catch {}
      }
    })
    installSessionPolicy(session)
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = null
    destroyScreenshotOverlay()
  })

  if (url) void mainWindow.loadURL(url)
  return mainWindow
}

function showDshFallback(error) {
  // 现有 DSH WebContents 绑定了严格 origin 策略，会正确拒绝 data: 降级页；因此失败时
  // 必须重建一个无 preload 的本地只读窗口，不能临时放宽正式主窗口的导航边界。
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
  const reason = String(error?.message || error || '未知错误').replace(/[<>&]/g, '')
  const html = `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="light dark">
    <title>应用启动失败</title><style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px system-ui;background:#f4f5f8;color:#20222a}
    main{width:min(560px,calc(100vw - 64px));padding:32px;border:1px solid #d9dce5;border-radius:18px;background:#fff;box-shadow:0 18px 60px #10182818}
    h1{font-size:22px;margin:0 0 12px}p{line-height:1.65;color:#555b6b}code{display:block;padding:12px;border-radius:10px;background:#f2f3f6;word-break:break-word}
    </style><main><h1>DSH 暂时无法启动</h1><p>应用已安全停止本次 Host，不会显示未认证页面。请退出后重新打开；诊断记录保存在用户数据目录。</p><code>${reason}</code></main>`
  const win = createWindow({})
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  win.show()
}

let recoveringDsh = false
async function bootDshWindow({ recovery = false } = {}) {
  try {
    const running = currentDsh()
    if (running && !recovery) {
      if (!mainWindow || mainWindow.isDestroyed()) createWindow({
        url: running.host.url,
        session: running.session,
        policyOrigin: new URL(running.host.url).origin
      })
      return
    }
    const dsh = await startDsh({
      onStdout: (line) => {
        process.stdout.write(line)
        if (line.includes('[moyu]')) void logStartup(line.trim())
      },
      window: () => mainWindow,
      onExit: (detail) => {
        void logStartup(`DSH Host 异常退出：generation ${detail.generation}，code ${detail.code ?? '-'}，signal ${detail.signal ?? '-'}`)
        if (recoveringDsh) return
        recoveringDsh = true
        void bootDshWindow({ recovery: true }).finally(() => { recoveringDsh = false })
      }
    })
    // 每代 Host 使用独立 session partition；崩溃换代时必须重建 WebContents，不能把
    // 新 origin 装进仍持有旧 token 注入器的页面。
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
    createWindow({
      url: dsh.host.url,
      session: dsh.session,
      policyOrigin: new URL(dsh.host.url).origin
    })
    await logStartup(`DSH Host 就绪：${dsh.host.url}（generation ${dsh.generation}，fence 自检 HTTP ${dsh.fence.http} / WS ${dsh.fence.ws}${recovery ? '，崩溃恢复' : ''}）`)
  } catch (error) {
    await logStartup(`DSH Host 启动失败：${error?.message || error}`)
    showDshFallback(error)
  }
}

// ── screenshot_capture 采集链路（系统能力半边）────────────────────
//
// 会话状态机与 Tool 驻留 DSH Host 插件；这里只提供确认框、抓屏与选区覆盖层。
// 图像数据一律走临时文件令牌回桥，不进 IPC 大 Buffer。

const screenshotSessions = new Map()
let reusableScreenshotOverlay = null
let screenshotOverlayReadyPromise = null

/** 亮度低于此值的画面视为黑帧。留一点余量以容忍深色壁纸的极端情况。 */
const BLANK_CAPTURE_THRESHOLD = 8

/** 黑帧重试前给屏幕采集器一帧恢复时间；不改变任何应用窗口状态。 */
const CAPTURE_RETRY_DELAY_MS = 140

/** 带超时的外部进程执行（swiftc 编译侧车 / ScreenCaptureKit 抓屏共用）。 */
function runHelperProcess(command, args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('辅助进程执行超时'))
    }, timeoutMs)
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2 * 1024 * 1024)
    })
    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(stderr.slice(-4000) || `进程退出码 ${code}`))
    })
  })
}

function isBlankCapture(image) {
  if (!image || image.isEmpty()) return true
  const size = image.getSize()
  if (!size.width || !size.height) return true
  // 缩到很小再逐像素看，避免对全屏位图做全量扫描
  const small = image.resize({ width: 24, height: 16, quality: 'good' })
  const buf = small.toBitmap()
  if (!buf || !buf.length) return true
  let max = 0
  for (let i = 0; i < buf.length; i += 4) {
    max = Math.max(max, buf[i], buf[i + 1], buf[i + 2])
    if (max > BLANK_CAPTURE_THRESHOLD) return false
  }
  return true
}

let screenCaptureKitBinaryPromise = null

async function ensureScreenCaptureKitBinary() {
  if (screenCaptureKitBinaryPromise) return screenCaptureKitBinaryPromise
  screenCaptureKitBinaryPromise = (async () => {
    if (app.isPackaged) {
      const packagedBinary = join(process.resourcesPath, 'native', 'macos', 'screen-capture')
      if (!existsSync(packagedBinary)) throw new Error('安装包缺少 macOS ScreenCaptureKit helper')
      return packagedBinary
    }
    const sourceCandidates = [
      join(app.getAppPath(), 'native', 'macos', 'screen-capture.swift'),
      join(__dirname, '..', '..', 'native', 'macos', 'screen-capture.swift')
    ]
    const source = sourceCandidates.find((candidate) => existsSync(candidate))
    if (!source) throw new Error('缺少 macOS ScreenCaptureKit 侧车源码')
    const directory = join(app.getPath('temp'), 'moyu-tools-native')
    const binary = join(directory, 'screen-capture')
    await mkdir(directory, { recursive: true })
    const sourceStat = await stat(source)
    const binaryStat = await stat(binary).catch(() => null)
    if (!binaryStat || binaryStat.mtimeMs < sourceStat.mtimeMs) {
      await runHelperProcess('xcrun', [
        'swiftc', '-parse-as-library', '-O', source,
        '-o', binary,
        '-framework', 'AppKit',
        '-framework', 'CoreGraphics',
        '-framework', 'ScreenCaptureKit'
      ])
    }
    return binary
  })().catch((error) => {
    screenCaptureKitBinaryPromise = null
    throw error
  })
  return screenCaptureKitBinaryPromise
}

/** macOS 原生抓屏：保留屏幕上的全部应用。 */
async function captureDisplayScreenCaptureKit(display, physicalWidth, physicalHeight) {
  const binary = await ensureScreenCaptureKitBinary()
  const directory = join(app.getPath('temp'), 'moyu-tools-native')
  const output = join(directory, `capture-${randomUUID()}.png`)
  try {
    await runHelperProcess(binary, [
      output,
      String(display.id),
      String(physicalWidth),
      String(physicalHeight)
    ], { timeoutMs: 30000 })
    const data = await readFile(output)
    const thumbnail = nativeImage.createFromBuffer(data)
    if (thumbnail.isEmpty()) throw new Error('ScreenCaptureKit 返回了无效图像')
    // data 已经是 Swift 侧车编码好的 PNG；原样返回，避免主进程再做一次 toPNG()。
    return { thumbnail, data, backend: 'ScreenCaptureKit' }
  } finally {
    await unlink(output).catch(() => {})
  }
}

async function captureCurrentDisplay() {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const physicalWidth = Math.max(1, Math.round(display.bounds.width * display.scaleFactor))
  const physicalHeight = Math.max(1, Math.round(display.bounds.height * display.scaleFactor))
  const grabElectron = async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physicalWidth, height: physicalHeight },
      fetchWindowIcons: false
    })
    const source = sources.find((c) => String(c.display_id) === String(display.id)) || sources[0]
    return source ? { thumbnail: source.thumbnail, backend: 'desktopCapturer' } : null
  }
  const grab = async () => {
    // macOS 不回退到 desktopCapturer：原生路径负责稳定地保留当前屏幕内容，
    // 并避免 Electron 在 Stage Manager 下产生错误的显示器边界映射。
    if (process.platform === 'darwin') {
      return captureDisplayScreenCaptureKit(display, physicalWidth, physicalHeight)
    }
    return grabElectron()
  }

  let source = await grab()
  // 抓到黑帧多半是合成器还没画完，再等一拍重抓一次。
  // 只重试一次：真没权限时不该让用户干等。
  if (source && isBlankCapture(source.thumbnail)) {
    await new Promise((resolve) => setTimeout(resolve, CAPTURE_RETRY_DELAY_MS))
    source = await grab()
  }

  if (!source || source.thumbnail.isEmpty()) {
    throw new Error('无法读取屏幕画面，请检查系统录屏权限')
  }
  if (isBlankCapture(source.thumbnail)) {
    throw new Error('屏幕画面尚未就绪，请重试')
  }

  const data = source.data || source.thumbnail.toPNG()
  return {
    data,
    displayBounds: display.bounds,
    imageSize: source.thumbnail.getSize(),
    backend: source.backend
  }
}

export async function requestScreenCaptureForDsh(options = {}) {
  const parentWindow = options.parentWindow && !options.parentWindow.isDestroyed()
    ? options.parentWindow
    : mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : undefined
  const result = await dialog.showMessageBox(parentWindow, {
    type: 'question',
    buttons: ['允许截图', '取消'],
    defaultId: 1,
    cancelId: 1,
    message: '允许读取当前屏幕吗？',
    detail: '截图会读取当前屏幕画面。本次操作不会被记住，下次请求截图时仍会再次确认。'
  })
  if (result.response !== 0) {
    return { canceled: true, reason: 'cancelled_by_consent' }
  }
  const capture = await captureCurrentDisplay()
  const filePath = await writeTemporaryScreenshotPng(capture.data)
  return {
    canceled: false,
    path: filePath,
    width: capture.imageSize.width,
    height: capture.imageSize.height,
    backend: capture.backend,
    displayBounds: capture.displayBounds
  }
}

/**
 * 创建截图覆盖窗口。
 *
 * 继续使用已验证的 BrowserWindow 组合；electron-screenshots 的 panel/toolbar +
 * kiosk 参数在 Electron 43/macOS 上会阻断覆盖层显示，不能照搬。
 */
function createScreenshotOverlay(display) {
  const overlay = new BrowserWindow({
    ...display.bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    // macOS Stage Manager 会把普通窗口强制钳进可用工作区（左侧舞台栏 + 顶部菜单栏），
    // 导致截图覆盖层只盖住屏幕的一部分，看起来像叠了两张画面。
    enableLargerThanScreen: process.platform === 'darwin',
    resizable: false,
    movable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 截图壳常驻隐藏时 Chromium 默认暂停 rAF；关闭节流后才能在显示前
      // 完成位图解码与两帧绘制，避免“数据已到但窗口迟迟不出现”。
      backgroundThrottling: false
    }
  })
  overlay.setAlwaysOnTop(true, 'screen-saver')
  if (process.platform === 'darwin') {
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  overlay.setBounds(display.bounds, false)
  return overlay
}

function hideScreenshotOverlay(overlay) {
  if (!overlay || overlay.isDestroyed()) return
  overlay.hide()
}

function destroyScreenshotOverlay() {
  if (reusableScreenshotOverlay && !reusableScreenshotOverlay.isDestroyed()) {
    reusableScreenshotOverlay.destroy()
  }
  reusableScreenshotOverlay = null
  screenshotOverlayReadyPromise = null
}

async function writeTemporaryScreenshotPng(data) {
  const directory = join(app.getPath('temp'), 'moyu-screen-results')
  await mkdir(directory, { recursive: true })
  const filePath = join(directory, `${randomUUID()}.png`)
  await writeFile(filePath, data)
  return filePath
}

function notifyScreenshotCancelled(session, reason = 'cancelled_by_user') {
  session?.resolveSelection?.({ canceled: true, reason })
}

function notifyScreenshotCaptured(session, result) {
  if (session?.resolveSelection) {
    session.resolveSelection({
      canceled: false,
      path: result.path,
      width: result.width,
      height: result.height,
      backend: result.backend
    })
  }
}

async function startScreenshotOverlaySession(source, options = {}) {
  const sessionId = randomUUID()
  const display = screen.getDisplayMatching(source.displayBounds)
  const overlay = await ensureScreenshotOverlay(display)
  const session = {
    data: source.data,
    displayBounds: source.displayBounds,
    imageSize: source.imageSize,
    backend: source.backend,
    resolveSelection: options.resolveSelection,
    overlay
  }
  screenshotSessions.set(sessionId, session)
  // begin-session 是复用 overlay 的显式重置边界：renderer 收到新 session 后必须
  // 清空上一轮选区/标注/工具状态，再报告 ready。
  overlay.webContents.send('screenshot:begin-session', { sessionId, reset: true })
  return { status: 'started', sessionId }
}

/**
 * 截图窗口只创建和加载一次，后续截图仅替换会话数据并重新显示。
 * 这是参考 electron-screenshots singleWindow 思路的本项目实现，不引入其 React UI。
 */
async function ensureScreenshotOverlay(display) {
  if (reusableScreenshotOverlay && !reusableScreenshotOverlay.isDestroyed()) {
    reusableScreenshotOverlay.setBounds(display.bounds, false)
    return reusableScreenshotOverlay
  }
  if (screenshotOverlayReadyPromise) return screenshotOverlayReadyPromise

  screenshotOverlayReadyPromise = (async () => {
    const overlay = createScreenshotOverlay(display)
    reusableScreenshotOverlay = overlay
    overlay.on('closed', () => {
      if (reusableScreenshotOverlay === overlay) reusableScreenshotOverlay = null
      screenshotOverlayReadyPromise = null
      for (const [sessionId, session] of screenshotSessions) {
        if (session.overlay !== overlay) continue
        screenshotSessions.delete(sessionId)
        notifyScreenshotCancelled(session)
      }
    })
    if (process.env.ELECTRON_RENDERER_URL) {
      await overlay.loadURL(new URL('screenshot.html', process.env.ELECTRON_RENDERER_URL).toString())
    } else {
      await overlay.loadFile(join(__dirname, '../renderer/screenshot.html'))
    }
    return overlay
  })().catch((error) => {
    reusableScreenshotOverlay = null
    screenshotOverlayReadyPromise = null
    throw error
  })
  return screenshotOverlayReadyPromise
}

// ready-to-show 只说明 HTML 已载入，不代表冻结截图已经解码并画进 canvas。
// 覆盖层必须等 renderer 报告首帧绘制完成后再一次性显示，否则用户会先看到
// 底下的实时桌面、再看到冻结帧，视觉上就像叠了两张画面。
ipcMain.handle('screenshot:overlay-ready', (event, sessionId) => {
  const session = screenshotSessions.get(sessionId)
  if (!session || event.sender !== session.overlay.webContents) {
    throw new Error('截图覆盖层会话无效')
  }
  if (!session.overlay.isDestroyed() && !session.overlay.isVisible()) {
    session.overlay.show()
    session.overlay.focus()
  }
  return { status: 'ready' }
})

ipcMain.handle('screenshot:get-session', (event, sessionId) => {
  const session = screenshotSessions.get(sessionId)
  if (!session || event.sender !== session.overlay.webContents) {
    throw new Error('截图会话已失效或无权访问')
  }
  return {
    data: new Uint8Array(session.data),
    imageSize: session.imageSize,
    displayBounds: session.displayBounds,
    backend: session.backend
  }
})

ipcMain.handle('screenshot:complete', async (event, payload) => {
  const session = screenshotSessions.get(payload?.sessionId)
  if (!session || event.sender !== session.overlay.webContents) {
    throw new Error('截图会话已失效或无权访问')
  }
  let data
  let width
  let height
  if (payload?.data instanceof Uint8Array) {
    if (payload.data.byteLength > 100 * 1024 * 1024) throw new Error('截图数据超过 100 MB')
    const finalImage = nativeImage.createFromBuffer(Buffer.from(payload.data))
    if (finalImage.isEmpty()) throw new Error('最终截图数据无效')
    data = finalImage.toPNG()
    ;({ width, height } = finalImage.getSize())
  } else {
    const rect = payload.rect || {}
    const scaleX = session.imageSize.width / session.displayBounds.width
    const scaleY = session.imageSize.height / session.displayBounds.height
    const x = Math.max(0, Math.min(session.imageSize.width - 1, Math.round(Number(rect.x) * scaleX)))
    const y = Math.max(0, Math.min(session.imageSize.height - 1, Math.round(Number(rect.y) * scaleY)))
    width = Math.max(
      1,
      Math.min(session.imageSize.width - x, Math.round(Number(rect.width) * scaleX))
    )
    height = Math.max(
      1,
      Math.min(session.imageSize.height - y, Math.round(Number(rect.height) * scaleY))
    )
    data = nativeImage.createFromBuffer(session.data).crop({ x, y, width, height }).toPNG()
  }
  const path = session.resolveSelection ? await writeTemporaryScreenshotPng(data) : undefined
  screenshotSessions.delete(payload.sessionId)
  hideScreenshotOverlay(session.overlay)
  notifyScreenshotCaptured(session, { data, path, width, height, backend: session.backend })
  return { status: 'captured', width, height }
})

ipcMain.handle('screenshot:cancel', (event, sessionId) => {
  const session = screenshotSessions.get(sessionId)
  if (session && event.sender !== session.overlay.webContents) {
    throw new Error('截图会话无权访问')
  }
  if (session) {
    screenshotSessions.delete(sessionId)
    hideScreenshotOverlay(session.overlay)
    notifyScreenshotCancelled(session)
  }
  return { status: 'cancelled' }
})

function isOverlaySender(event) {
  return [...screenshotSessions.values()].some((session) =>
    !session.overlay.isDestroyed() && event.sender === session.overlay.webContents)
}

ipcMain.handle('screenshot:save', async (event, payload) => {
  if (!isOverlaySender(event)) {
    throw new Error('只有当前截图覆盖层可以保存截图')
  }
  const data = payload?.data instanceof Uint8Array ? Buffer.from(payload.data) : null
  if (!data || data.byteLength > 100 * 1024 * 1024) {
    throw new Error('截图数据无效或超过 100 MB')
  }
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showSaveDialog(ownerWindow, {
    title: '保存截图',
    defaultPath: `screenshot-${Date.now()}.png`,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  })
  if (result.canceled || !result.filePath) return { status: 'cancelled' }
  await writeFile(result.filePath, data)
  return { status: 'saved', path: result.filePath }
})

ipcMain.handle('screenshot:copy', (event, data) => {
  if (!isOverlaySender(event)) {
    throw new Error('只有当前截图覆盖层可以复制截图')
  }
  if (!(data instanceof Uint8Array) || data.byteLength > 100 * 1024 * 1024) {
    throw new Error('截图数据无效或超过 100 MB')
  }
  const image = nativeImage.createFromBuffer(Buffer.from(data))
  if (image.isEmpty()) throw new Error('无法解析截图数据')
  clipboard.writeImage(image)
  return { status: 'copied', size: image.getSize() }
})

export async function selectScreenshotRegionForDsh(payload = {}) {
  const capture = payload.capture || {}
  const path = payload.path || capture.path
  if (typeof path !== 'string' || !path) throw new Error('截图选区缺少冻结图路径')
  const data = await readFile(path)
  const image = nativeImage.createFromBuffer(data)
  if (image.isEmpty()) throw new Error('冻结截图数据无效')
  const imageSize = {
    width: Number(capture.width) || image.getSize().width,
    height: Number(capture.height) || image.getSize().height
  }
  const displayBounds = capture.displayBounds || {
    x: 0,
    y: 0,
    width: Math.max(1, Math.round(imageSize.width / (screen.getPrimaryDisplay().scaleFactor || 1))),
    height: Math.max(1, Math.round(imageSize.height / (screen.getPrimaryDisplay().scaleFactor || 1)))
  }
  return new Promise((resolve) => {
    void startScreenshotOverlaySession({
      data,
      displayBounds,
      imageSize,
      backend: capture.backend
    }, { resolveSelection: resolve }).catch((error) => {
      resolve({ canceled: true, reason: error?.message || 'cancelled_by_user' })
    })
  })
}

// ── 应用生命周期 ────────────────────────────────────────────────

app.whenReady().then(async () => {
  // macOS 首次截图若在点击后才编译 ScreenCaptureKit 侧车，会额外等待约一秒。
  // 启动后后台预热；失败时 promise 会自行复位，真正截图仍会重试并给出明确错误。
  if (process.platform === 'darwin') {
    void ensureScreenCaptureKitBinary().catch((error) => {
      console.warn('ScreenCaptureKit 侧车预热失败：', error?.message || error)
    })
  }
  // BrowserWindow.icon 不控制 macOS Dock；开发模式显式使用项目图标。
  if (process.platform === 'darwin') {
    const dockIcon = resolveWindowIcon()
    if (dockIcon && !dockIcon.isEmpty()) app.dock.setIcon(dockIcon)
  }
  await bootDshWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void bootDshWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  destroyScreenshotOverlay()
  for (const [sessionId, session] of screenshotSessions) {
    screenshotSessions.delete(sessionId)
    notifyScreenshotCancelled(session)
  }
  void stopDsh().catch(() => {})
})
