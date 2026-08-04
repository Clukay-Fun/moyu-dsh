import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain,
  net,
  nativeImage,
  screen,
  shell,
  utilityProcess
} from 'electron'
import { writePsdBuffer } from 'ag-psd'
import { createWorker, OEM } from 'tesseract.js'
import sharp from 'sharp'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, extname, join } from 'node:path'

const require = createRequire(import.meta.url)

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
  },
  tiff: {
    extension: 'tiff',
    filterName: 'TIFF 图片'
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
const pinnedScreenshotSessions = new Map()
const aiInputSessions = new Map()
const aiResultSessions = new Map()
const aiModelDownloads = new Map()
const formatInputSessions = new Map()
const formatResultSessions = new Map()
const formatTasks = new Map()
const illustratorInputSessions = new Map()
const officeInputSessions = new Map()
const pdfOutputSessions = new Map()
const comResultSessions = new Map()
const activeIllustratorTasks = new Map()
const comPendingRequests = new Map()
let ocrWorkerPromise = null
let ocrProgressTarget = null
let ocrBusy = false
let mainWindow = null
let comWorker = null
let comWorkerStderr = ''

const AI_MODELS = {
  rmbg: {
    name: 'RMBG-1.4',
    fileName: 'rmbg-1.4.onnx',
    size: 176153355,
    sha256: '8cafcf770b06757c4eaced21b1a88e57fd2b66de01b8045f35f01535ba742e0f',
    url: 'https://huggingface.co/briaai/RMBG-1.4/resolve/2ceba5a5efaec153162aedea169f76caf9b46cf8/onnx/model.onnx?download=true',
    license: 'BRIA RMBG-1.4 · 仅限非商业使用'
  },
  migan: {
    name: 'MI-GAN Pipeline v2',
    fileName: 'migan-pipeline-v2.onnx',
    size: 28079181,
    sha256: '6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b',
    url: 'https://huggingface.co/andraniksargsyan/migan/resolve/1538c135034b8cfe7a8472f34d09c8a5a45b17a7/migan_pipeline_v2.onnx?download=true',
    license: '模型文件无独立许可 · 仅限当前自用学习'
  }
}

const AI_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const AI_MAX_FILE_BYTES = 50 * 1024 * 1024
const AI_MAX_FILES = 100
const AI_COMMAND_TIMEOUT_MS = 10 * 60 * 1000
const AI_MODEL_DOWNLOAD_ATTEMPTS = 3
const AI_MODEL_DOWNLOAD_IDLE_TIMEOUT_MS = 90 * 1000
let aiSidecar = null
let aiSidecarBuffer = ''
let aiSidecarStarting = null
const aiSidecarPending = new Map()

const FORMAT_EXTENSIONS = {
  video: new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v']),
  audio: new Set(['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.opus', '.wma']),
  image: new Set(['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.gif', '.avif'])
}
const FORMAT_MAX_FILES = 100
const FORMAT_MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024
const FORMAT_PROCESS_TIMEOUT_MS = 2 * 60 * 60 * 1000
const FORMAT_ACTIONS = new Map([
  ['视频转换', 'video-convert'],
  ['视频压缩', 'video-compress'],
  ['抽取音频', 'extract-audio'],
  ['音频转换', 'audio-convert'],
  ['图片转换', 'image-convert'],
  ['图片压缩', 'image-compress']
])

const OCR_MODELS = [
  {
    code: 'eng',
    source: join(
      dirname(require.resolve('@tesseract.js-data/eng/package.json')),
      '4.0.0',
      'eng.traineddata.gz'
    )
  },
  {
    code: 'chi_sim',
    source: join(
      dirname(require.resolve('@tesseract.js-data/chi_sim/package.json')),
      '4.0.0',
      'chi_sim.traineddata.gz'
    )
  }
]

// 零售合规条码 PNG 的物理分辨率（pHYs）。canvas.toBlob() 不写 pHYs，
// Photoshop/Illustrator 会按 72/96 DPI 解释，物理尺寸就错了。
// 单个保存 / 批量保存 / 转入 Photoshop 三条落盘链路统一经过本函数；
// 剪贴板直接写入 SVG 矢量数据，不经过 PNG，因此不涉及 DPI 元数据。
const BARCODE_PNG_DPI = 300

// 仅在渲染层显式声明 density 时写入（零售合规码），通用六码不受影响。
// 写入失败必须抛错：若静默降级，保存会报成功但文件仍是 96 DPI，
// 与"PNG 元数据 density=300"的验收标准直接冲突。
async function withBarcodePngDensity(data, fileType, density) {
  if (fileType?.extension !== 'png' || !density) return data

  const value = Number(density)
  if (!Number.isFinite(value) || value <= 0 || value > 4800) {
    throw new Error(`条码 PNG 分辨率无效：${density}`)
  }

  try {
    return await sharp(data).withMetadata({ density: value }).png().toBuffer()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`条码 PNG 写入 ${value} DPI 元数据失败：${reason}`)
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

function normalizeOcrText(text) {
  return String(text || '')
    .replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '$1')
    .trim()
}

function assertMainWindowSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('此操作只允许从主窗口发起')
  }
}

function comWorkerPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'workers', 'com-worker.cjs')
    : join(app.getAppPath(), 'resources', 'com-worker.cjs')
}

function winaxModulePath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'winax')
    : join(app.getAppPath(), 'node_modules', 'winax')
}

function rejectComRequests(error) {
  for (const pending of comPendingRequests.values()) {
    clearTimeout(pending.timer)
    pending.reject(error)
  }
  comPendingRequests.clear()
}

function ensureComWorker() {
  if (process.platform !== 'win32') {
    throw new Error('Office 与 Adobe 联动仅支持 Windows')
  }
  if (comWorker) return comWorker

  const child = utilityProcess.fork(comWorkerPath(), [], {
    env: {
      ...process.env,
      MOYU_WINAX_MODULE: winaxModulePath()
    },
    stdio: 'pipe',
    serviceName: 'moyu-tools-com'
  })
  comWorker = child
  comWorkerStderr = ''
  child.stderr?.on('data', (chunk) => {
    comWorkerStderr = `${comWorkerStderr}${chunk}`.slice(-4000)
  })
  child.on('message', (message) => {
    const pending = comPendingRequests.get(message?.id)
    if (!pending) return
    if (message.type === 'progress') {
      if (!pending.sender.isDestroyed()) {
        pending.sender.send(pending.progressChannel, {
          completed: message.completed,
          total: message.total,
          name: message.name,
          message: message.message
        })
      }
      return
    }
    if (message.type !== 'result') return
    clearTimeout(pending.timer)
    comPendingRequests.delete(message.id)
    if (message.ok) pending.resolve(message.result)
    else if (message.error === 'TASK_CANCELLED') pending.reject(new Error('TASK_CANCELLED'))
    else pending.reject(new Error(message.error || 'COM 任务执行失败'))
  })
  child.once('exit', (code) => {
    if (comWorker !== child) return
    comWorker = null
    const detail = comWorkerStderr.trim()
    rejectComRequests(new Error(
      `COM 任务进程已退出（${code ?? '未知'}）${detail ? `：${detail}` : ''}`
    ))
  })
  child.once('error', (error) => {
    if (comWorker === child) comWorker = null
    rejectComRequests(error)
  })
  return child
}

function runComCommand(event, command, payload, options = {}) {
  if (comPendingRequests.size) {
    throw new Error('已有 Office 或 Adobe 任务正在执行，请等待当前任务完成')
  }
  const worker = ensureComWorker()
  const id = options.id || randomUUID()
  const timeoutMs = options.timeoutMs || 3 * 60 * 1000

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!comPendingRequests.delete(id)) return
      reject(new Error('COM 任务执行超时，请关闭软件中的弹窗后重试'))
      if (comWorker === worker) {
        comWorker = null
        worker.kill()
        rejectComRequests(new Error('COM 任务进程已因超时重启，请重试'))
      }
    }, timeoutMs)
    comPendingRequests.set(id, {
      sender: event.sender,
      progressChannel: options.progressChannel || 'com:progress',
      resolve,
      reject,
      timer
    })
    worker.postMessage({
      type: 'request',
      id,
      command,
      payload
    })
  })
}

function cancelComCommand(id) {
  if (comWorker && comPendingRequests.has(id)) {
    comWorker.postMessage({ type: 'cancel', id })
    return true
  }
  return false
}

async function availableOutputPath(directory, baseName, extension) {
  const safeBase = sanitizeFileBaseName(baseName, 'output')
  for (let occurrence = 1; occurrence <= 999; occurrence += 1) {
    const suffix = occurrence === 1 ? '' : `-${occurrence}`
    const candidate = join(directory, `${safeBase}${suffix}.${extension}`)
    const exists = await stat(candidate).then(() => true).catch(() => false)
    if (!exists) return candidate
  }
  throw new Error('输出目录中同名文件过多，请先整理后重试')
}

async function assertOutputFile(filePath, label) {
  const info = await stat(filePath).catch(() => null)
  if (!info?.isFile() || info.size < 1) {
    throw new Error(`${label} 未生成输出文件`)
  }
  return info
}

function registerComResult(ownerId, filePath) {
  const id = randomUUID()
  comResultSessions.set(id, {
    id,
    ownerId,
    path: filePath,
    name: basename(filePath)
  })
  return { id, name: basename(filePath) }
}

function getPdfOutputSession(event, sessionId, mode) {
  const session = pdfOutputSessions.get(sessionId)
  if (!session || session.ownerId !== event.sender.id || session.mode !== mode) {
    throw new Error('PDF 输出位置会话不存在、已失效或类型不匹配')
  }
  return session
}

function illustratorSession(event, inputId) {
  const input = illustratorInputSessions.get(inputId)
  if (!input || input.ownerId !== event.sender.id) {
    throw new Error('Illustrator 文件会话不存在或无权访问')
  }
  return input
}

async function registerIllustratorInput(filePath, ownerId) {
  if (extname(filePath).toLowerCase() !== '.ai') {
    throw new Error(`${basename(filePath)} 不是 Illustrator 文件`)
  }
  const info = await stat(filePath)
  if (!info.isFile() || info.size > 2 * 1024 * 1024 * 1024) {
    throw new Error(`${basename(filePath)} 不是文件或超过 2 GB`)
  }
  const id = randomUUID()
  const input = {
    id,
    ownerId,
    path: filePath,
    name: basename(filePath),
    size: info.size
  }
  illustratorInputSessions.set(id, input)
  return { id, name: input.name, size: input.size }
}

async function collectIllustratorFolder(directory, ownerId, output = []) {
  if (output.length >= 500) return output
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (output.length >= 500) break
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectIllustratorFolder(entryPath, ownerId, output)
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.ai') {
      output.push(await registerIllustratorInput(entryPath, ownerId))
    }
  }
  return output
}

function officeKindConfig(kind) {
  const configs = {
    word: {
      label: 'Word',
      extensions: ['doc', 'docx', 'docm', 'rtf']
    },
    excel: {
      label: 'Excel',
      extensions: ['xls', 'xlsx', 'xlsm', 'xlsb']
    },
    powerpoint: {
      label: 'PowerPoint',
      extensions: ['ppt', 'pptx', 'pptm']
    }
  }
  const config = configs[kind]
  if (!config) throw new Error('不支持的 Office 文件类型')
  return config
}

function getAiModelDirectory() {
  return join(app.getPath('userData'), 'models', 'ai')
}

function getAiResultDirectory() {
  return join(app.getPath('userData'), 'ai-results')
}

function getFormatResultDirectory() {
  return join(app.getPath('userData'), 'format-results')
}

function getFormatToolPath(tool) {
  const override = tool === 'ffmpeg'
    ? process.env.MOYU_FFMPEG_PATH
    : process.env.MOYU_FFPROBE_PATH
  if (!app.isPackaged && override) return override
  if (process.platform !== 'win32') {
    throw new Error('音视频格式工厂当前只随 Windows 发布包提供')
  }
  const fileName = `${tool}.exe`
  return app.isPackaged
    ? join(process.resourcesPath, 'tools', 'ffmpeg', fileName)
    : join(app.getAppPath(), 'build', 'ffmpeg', fileName)
}

function normalizeFormatKind(value) {
  if (!Object.hasOwn(FORMAT_EXTENSIONS, value)) throw new Error('不支持的格式工厂输入类型')
  return value
}

function getFormatInput(event, inputId) {
  const input = formatInputSessions.get(inputId)
  if (!input || input.ownerId !== event.sender.id) {
    throw new Error('格式工厂文件会话不存在或无权访问')
  }
  return input
}

function getFormatResult(event, resultId) {
  const result = formatResultSessions.get(resultId)
  if (!result || result.ownerId !== event.sender.id) {
    throw new Error('格式工厂结果会话不存在或无权访问')
  }
  return result
}

async function registerFormatInput(filePath, ownerId, kind) {
  const extension = extname(filePath).toLowerCase()
  if (!FORMAT_EXTENSIONS[kind].has(extension)) {
    throw new Error(`${basename(filePath)} 不是受支持的${kind === 'video' ? '视频' : kind === 'audio' ? '音频' : '图片'}文件`)
  }
  const info = await stat(filePath)
  if (!info.isFile() || info.size > FORMAT_MAX_FILE_BYTES) {
    throw new Error(`${basename(filePath)} 不是文件或超过 4 GB`)
  }

  const id = randomUUID()
  let dimensions = null
  let previewData = null
  if (kind === 'image') {
    const metadata = await sharp(filePath, { animated: true }).metadata()
    dimensions = {
      width: metadata.width || 0,
      height: metadata.height || 0
    }
    previewData = new Uint8Array(
      await sharp(filePath, { animated: true })
        .resize({ width: 320, height: 240, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
    )
  }

  const input = {
    id,
    ownerId,
    path: filePath,
    name: basename(filePath),
    size: info.size,
    kind,
    extension,
    dimensions
  }
  formatInputSessions.set(id, input)
  return {
    id,
    name: input.name,
    size: input.size,
    kind,
    dimensions,
    previewData
  }
}

function sanitizeProcessError(error, paths = []) {
  let message = error instanceof Error ? error.message : String(error)
  paths.filter(Boolean).forEach((filePath) => {
    message = message.replaceAll(filePath, basename(filePath))
  })
  const normalized = message.toLowerCase()
  if (normalized.includes('no space left on device') || normalized.includes('disk full')) {
    return '磁盘空间不足，请清理输出磁盘后重试'
  }
  if (normalized.includes('permission denied') || normalized.includes('read-only file system')) {
    return '没有写入权限，请更换输出位置'
  }
  if (normalized.includes('invalid data found') || normalized.includes('moov atom not found') ||
      normalized.includes('error while decoding')) {
    return '输入文件已损坏或编码格式无法读取'
  }
  if (normalized.includes('unknown encoder') || normalized.includes('encoder not found')) {
    return '发布包缺少所需编码器，请重新安装完整版本'
  }
  if (normalized.includes('does not contain any stream') || normalized.includes('matches no streams') ||
      normalized.includes('output file does not contain any stream')) {
    return '输入文件没有可用的音轨'
  }
  if (normalized.includes('timed out') || normalized.includes('执行超时')) {
    return '转换超时，请检查文件是否损坏或尝试较小文件'
  }
  return message.slice(-2000)
}

function runFormatProcess(command, args, options = {}) {
  const {
    timeoutMs = FORMAT_PROCESS_TIMEOUT_MS,
    task,
    onStderr
  } = options
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    if (task) task.process = child

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('格式转换任务执行超时'))
    }, timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-2 * 1024 * 1024)
    })
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2 * 1024 * 1024)
      onStderr?.(chunk)
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
      if (task) task.process = null
      if (task?.cancelled) {
        reject(new Error('TASK_CANCELLED'))
      } else if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(stderr.slice(-4000) || `进程退出码 ${code}`))
      }
    })
  })
}

async function probeFormatMedia(input) {
  const result = await runFormatProcess(
    getFormatToolPath('ffprobe'),
    [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      input.path
    ],
    { timeoutMs: 3000 }
  )
  const data = JSON.parse(result.stdout)
  const video = data.streams?.find((stream) => stream.codec_type === 'video')
  const audio = data.streams?.find((stream) => stream.codec_type === 'audio')
  return {
    duration: Number(data.format?.duration) || 0,
    bitrate: Number(data.format?.bit_rate) || 0,
    width: Number(video?.width) || 0,
    height: Number(video?.height) || 0,
    videoCodec: video?.codec_name || '',
    audioCodec: audio?.codec_name || '',
    sampleRate: Number(audio?.sample_rate) || 0
  }
}

function parseFfmpegTime(value) {
  const match = String(value).match(/(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!match) return 0
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

function buildFfmpegArgs(action, input, outputPath, options) {
  const target = String(options?.target || '').toLowerCase()
  const quality = Math.min(35, Math.max(18, Number(options?.quality) || 23))
  const bitrate = Math.min(320, Math.max(64, Number(options?.audioBitrate) || 192))
  const sampleRate = [32000, 44100, 48000].includes(Number(options?.sampleRate))
    ? Number(options.sampleRate)
    : 44100
  const maxWidth = Math.min(3840, Math.max(0, Number(options?.maxWidth) || 0))
  const scaleArgs = maxWidth ? ['-vf', `scale='min(${maxWidth},iw)':-2`] : []

  if (action === 'video-convert') {
    if (!['mp4', 'mkv', 'webm'].includes(target)) throw new Error('不支持的视频输出格式')
    return target === 'webm'
      ? ['-y', '-i', input.path, ...scaleArgs, '-c:v', 'libvpx-vp9', '-crf', String(quality), '-b:v', '0', '-c:a', 'libopus', outputPath]
      : ['-y', '-i', input.path, ...scaleArgs, '-c:v', 'libx264', '-crf', String(quality), '-preset', 'medium', '-c:a', 'aac', '-b:a', `${bitrate}k`, outputPath]
  }
  if (action === 'video-compress') {
    return ['-y', '-i', input.path, ...scaleArgs, '-c:v', 'libx264', '-crf', String(quality), '-preset', 'medium', '-c:a', 'aac', '-b:a', `${bitrate}k`, '-movflags', '+faststart', outputPath]
  }
  if (action === 'extract-audio' || action === 'audio-convert') {
    const prefix = ['-y', '-i', input.path, '-vn', '-ar', String(sampleRate)]
    if (target === 'mp3') return [...prefix, '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`, outputPath]
    if (target === 'aac' || target === 'm4a') return [...prefix, '-c:a', 'aac', '-b:a', `${bitrate}k`, outputPath]
    if (target === 'wav') return [...prefix, '-c:a', 'pcm_s16le', outputPath]
    if (target === 'flac') return [...prefix, '-c:a', 'flac', outputPath]
    throw new Error('不支持的音频输出格式')
  }
  throw new Error('不支持的 FFmpeg 任务')
}

function formatOutputExtension(action, options, input) {
  const target = String(options?.target || '').toLowerCase()
  if (action === 'video-compress') return 'mp4'
  if (['video-convert', 'extract-audio', 'audio-convert', 'image-convert'].includes(action)) {
    return target === 'jpeg' ? 'jpg' : target
  }
  if (action === 'image-compress') {
    return input.extension === '.jpeg' ? 'jpg' : input.extension.slice(1)
  }
  throw new Error('无法确定输出格式')
}

async function processFormatImage(action, input, outputPath, options) {
  const target = formatOutputExtension(action, options, input)
  const quality = Math.min(100, Math.max(10, Number(options?.quality) || 82))
  const maxWidth = Math.min(12000, Math.max(0, Number(options?.maxWidth) || 0))
  let pipeline = sharp(input.path, { animated: target === 'gif', limitInputPixels: 400_000_000 })
    .rotate()
  if (maxWidth) {
    pipeline = pipeline.resize({
      width: maxWidth,
      fit: 'inside',
      withoutEnlargement: true
    })
  }
  if (target === 'jpg') pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true })
  else if (target === 'png') pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
  else if (target === 'webp') pipeline = pipeline.webp({ quality, effort: 5 })
  else if (target === 'avif') pipeline = pipeline.avif({ quality, effort: 5 })
  else if (target === 'tif' || target === 'tiff') pipeline = pipeline.tiff({ compression: 'lzw', quality })
  else if (target === 'gif') pipeline = pipeline.gif({ effort: 7, colours: Math.max(32, Math.round(quality * 2.56)) })
  else throw new Error('不支持的图片输出格式')
  const info = await pipeline.toFile(outputPath)
  return { width: info.width, height: info.height, format: info.format }
}

async function registerFormatResult(event, outputPath, input, metadata = null) {
  const info = await stat(outputPath)
  const id = randomUUID()
  const result = {
    id,
    ownerId: event.sender.id,
    path: outputPath,
    name: basename(outputPath),
    size: info.size,
    inputId: input.id,
    inputName: input.name,
    metadata
  }
  formatResultSessions.set(id, result)
  return {
    id,
    inputId: input.id,
    inputName: input.name,
    name: result.name,
    size: result.size,
    metadata
  }
}

function getAiSidecarLaunch() {
  if (process.platform === 'win32') {
    const executable = app.isPackaged
      ? join(process.resourcesPath, 'sidecars', 'moyu-ai-sidecar.exe')
      : join(app.getAppPath(), 'build', 'sidecars', 'moyu-ai-sidecar.exe')
    return { command: executable, args: [] }
  }

  if (!app.isPackaged) {
    return {
      command: process.env.MOYU_AI_PYTHON || 'python3',
      args: [join(app.getAppPath(), 'sidecar', 'ai', 'worker.py')]
    }
  }

  throw new Error('AI 图像 sidecar 当前仅随 Windows 发布包提供')
}

async function hashFile(filePath) {
  const digest = createHash('sha256')
  const handle = await open(filePath, 'r')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    let position = 0
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
      if (!bytesRead) break
      digest.update(buffer.subarray(0, bytesRead))
      position += bytesRead
    }
  } finally {
    await handle.close()
  }
  return digest.digest('hex')
}

async function inspectAiModel(key, verifyHash = false) {
  const model = AI_MODELS[key]
  if (!model) throw new Error(`未知 AI 模型：${key}`)
  const filePath = join(getAiModelDirectory(), model.fileName)
  const info = await stat(filePath).catch(() => null)
  if (!info || info.size !== model.size) {
    return { ready: false, filePath, model }
  }
  if (verifyHash && (await hashFile(filePath)) !== model.sha256) {
    await unlink(filePath).catch(() => {})
    return { ready: false, filePath, model }
  }
  return { ready: true, filePath, model }
}

function sendAiModelProgress(sender, payload) {
  if (!sender.isDestroyed()) sender.send('ai:model-progress', payload)
}

async function downloadAiModel(key, sender) {
  const existing = await inspectAiModel(key, true)
  if (existing.ready) return existing.filePath
  if (aiModelDownloads.has(key)) return aiModelDownloads.get(key)

  const task = (async () => {
    const { model, filePath } = existing
    const temporaryPath = `${filePath}.download`
    await mkdir(getAiModelDirectory(), { recursive: true })
    await unlink(temporaryPath).catch(() => {})
    sendAiModelProgress(sender, {
      key,
      name: model.name,
      status: 'downloading',
      received: 0,
      total: model.size,
      progress: 0
    })

    let lastError = null
    let received = 0
    for (let attempt = 1; attempt <= AI_MODEL_DOWNLOAD_ATTEMPTS; attempt += 1) {
      const controller = new AbortController()
      let idleTimeout = null
      const resetIdleTimeout = () => {
        clearTimeout(idleTimeout)
        idleTimeout = setTimeout(() => controller.abort(), AI_MODEL_DOWNLOAD_IDLE_TIMEOUT_MS)
      }
      try {
        // Chromium's network stack follows Windows proxy settings. Node's built-in fetch does not.
        resetIdleTimeout()
        const response = await net.fetch(model.url, {
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'MoyuTools/2.0 model-downloader' }
        })
        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`)
        }

        const handle = await open(temporaryPath, 'w')
        const reader = response.body.getReader()
        const digest = createHash('sha256')
        received = 0
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            resetIdleTimeout()
            const chunk = Buffer.from(value)
            await handle.write(chunk)
            digest.update(chunk)
            received += chunk.length
            sendAiModelProgress(sender, {
              key,
              name: model.name,
              status: 'downloading',
              received,
              total: model.size,
              progress: Math.min(1, received / model.size)
            })
          }
        } finally {
          await handle.close()
        }

        if (received !== model.size || digest.digest('hex') !== model.sha256) {
          throw new Error(`文件校验失败（${received} / ${model.size} 字节）`)
        }
        lastError = null
        break
      } catch (error) {
        lastError = error
        await unlink(temporaryPath).catch(() => {})
        if (attempt < AI_MODEL_DOWNLOAD_ATTEMPTS) {
          sendAiModelProgress(sender, {
            key,
            name: model.name,
            status: 'retrying',
            message: `下载失败，正在重试（${attempt} / ${AI_MODEL_DOWNLOAD_ATTEMPTS}）`
          })
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
        }
      } finally {
        clearTimeout(idleTimeout)
      }
    }

    if (lastError) {
      const detail = lastError.name === 'AbortError'
        ? `连接连续 ${AI_MODEL_DOWNLOAD_IDLE_TIMEOUT_MS / 1000} 秒未收到数据`
        : String(lastError.message || lastError)
      throw new Error(`${model.name} 下载失败，已重试 ${AI_MODEL_DOWNLOAD_ATTEMPTS} 次：${detail}。请检查网络或 Windows 系统代理后重试`)
    }
    await rename(temporaryPath, filePath)
    sendAiModelProgress(sender, {
      key,
      name: model.name,
      status: 'ready',
      received,
      total: model.size,
      progress: 1
    })
    return filePath
  })()
    .catch((error) => {
      sendAiModelProgress(sender, {
        key,
        name: AI_MODELS[key].name,
        status: 'error',
        message: error.message
      })
      throw error
    })
    .finally(() => {
      aiModelDownloads.delete(key)
    })

  aiModelDownloads.set(key, task)
  return task
}

function rejectAiSidecarPending(error) {
  aiSidecarPending.forEach(({ reject, timer }) => {
    clearTimeout(timer)
    reject(error)
  })
  aiSidecarPending.clear()
}

function handleAiSidecarLine(line) {
  let response
  try {
    response = JSON.parse(line)
  } catch {
    return
  }
  const pending = aiSidecarPending.get(response.id)
  if (!pending) return
  clearTimeout(pending.timer)
  aiSidecarPending.delete(response.id)
  if (response.ok) pending.resolve(response.result)
  else pending.reject(new Error(response.error || 'AI sidecar 执行失败'))
}

async function ensureAiSidecar() {
  if (aiSidecar && !aiSidecar.killed && aiSidecar.exitCode === null) return aiSidecar
  if (aiSidecarStarting) return aiSidecarStarting

  aiSidecarStarting = new Promise((resolve, reject) => {
    let launch
    try {
      launch = getAiSidecarLaunch()
    } catch (error) {
      reject(error)
      return
    }
    const child = spawn(launch.command, launch.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    })
    let settled = false
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      aiSidecarBuffer += chunk
      const lines = aiSidecarBuffer.split(/\r?\n/)
      aiSidecarBuffer = lines.pop() || ''
      lines.filter(Boolean).forEach(handleAiSidecarLine)
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4000)
    })
    child.once('spawn', () => {
      settled = true
      aiSidecar = child
      resolve(child)
    })
    child.once('error', (error) => {
      if (!settled) reject(new Error(`无法启动 AI sidecar：${error.message}`))
    })
    child.once('exit', (code) => {
      const wasActive = aiSidecar === child
      if (wasActive) aiSidecar = null
      if (!settled) {
        reject(new Error(`AI sidecar 启动失败（${code ?? 'unknown'}）：${stderr.trim()}`))
      }
      rejectAiSidecarPending(
        new Error(`AI sidecar 已退出（${code ?? 'unknown'}）${stderr.trim() ? `：${stderr.trim()}` : ''}`)
      )
    })
  }).finally(() => {
    aiSidecarStarting = null
  })
  return aiSidecarStarting
}

async function callAiSidecar(command) {
  const child = await ensureAiSidecar()
  const id = randomUUID()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      aiSidecarPending.delete(id)
      reject(new Error('AI 任务执行超时'))
    }, AI_COMMAND_TIMEOUT_MS)
    aiSidecarPending.set(id, { resolve, reject, timer })
    child.stdin.write(`${JSON.stringify({ ...command, id })}\n`, (error) => {
      if (!error) return
      clearTimeout(timer)
      aiSidecarPending.delete(id)
      reject(error)
    })
  })
}

function aiPreviewFromPath(filePath, maxSide = 1200) {
  const image = nativeImage.createFromPath(filePath)
  if (image.isEmpty()) throw new Error(`无法读取图片：${basename(filePath)}`)
  const size = image.getSize()
  const scale = Math.min(1, maxSide / Math.max(size.width, size.height))
  const preview = scale < 1
    ? image.resize({
        width: Math.max(1, Math.round(size.width * scale)),
        height: Math.max(1, Math.round(size.height * scale)),
        quality: 'good'
      })
    : image
  return {
    width: size.width,
    height: size.height,
    previewData: new Uint8Array(preview.toPNG())
  }
}

async function psdImageDataFromPath(filePath) {
  const data = await readFile(filePath)
  const image = nativeImage.createFromBuffer(data)
  if (image.isEmpty()) throw new Error(`无法解析 PSD 图层图片：${basename(filePath)}`)
  const { width, height } = image.getSize()
  const bitmap = image.toBitmap()
  const rgba = new Uint8ClampedArray(bitmap.length)

  for (let index = 0; index < bitmap.length; index += 4) {
    const alpha = bitmap[index + 3]
    const multiplier = alpha > 0 && alpha < 255 ? 255 / alpha : 1
    rgba[index] = Math.min(255, Math.round(bitmap[index + 2] * multiplier))
    rgba[index + 1] = Math.min(255, Math.round(bitmap[index + 1] * multiplier))
    rgba[index + 2] = Math.min(255, Math.round(bitmap[index] * multiplier))
    rgba[index + 3] = alpha
  }

  return { width, height, data: rgba }
}

async function registerAiInput(filePath, ownerId) {
  const info = await stat(filePath)
  if (!info.isFile() || info.size > AI_MAX_FILE_BYTES) {
    throw new Error(`${basename(filePath)} 不是文件或超过 50 MB`)
  }
  const extension = extname(filePath).toLowerCase()
  if (!AI_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`${basename(filePath)} 不是受支持的 PNG/JPG/WebP 图片`)
  }
  const preview = aiPreviewFromPath(filePath)
  const id = randomUUID()
  aiInputSessions.set(id, {
    id,
    ownerId,
    path: filePath,
    name: basename(filePath),
    size: info.size,
    width: preview.width,
    height: preview.height
  })
  return {
    id,
    name: basename(filePath),
    size: info.size,
    width: preview.width,
    height: preview.height,
    previewData: preview.previewData
  }
}

function getAiInput(event, inputId) {
  const input = aiInputSessions.get(inputId)
  if (!input || input.ownerId !== event.sender.id) throw new Error('AI 图片会话不存在或无权访问')
  return input
}

function getAiResult(event, resultId) {
  const result = aiResultSessions.get(resultId)
  if (!result || result.ownerId !== event.sender.id) throw new Error('AI 结果会话不存在或无权访问')
  return result
}

async function registerAiResult(event, outputPath, input, metadata) {
  const preview = aiPreviewFromPath(outputPath)
  const info = await stat(outputPath)
  const id = randomUUID()
  const result = {
    id,
    ownerId: event.sender.id,
    path: outputPath,
    inputPath: input.path,
    inputName: input.name,
    name: basename(outputPath),
    size: info.size,
    width: preview.width,
    height: preview.height,
    metadata
  }
  aiResultSessions.set(id, result)
  return {
    id,
    inputId: input.id,
    inputName: input.name,
    name: result.name,
    size: result.size,
    width: result.width,
    height: result.height,
    previewData: preview.previewData,
    metadata
  }
}

async function copyFileIfChanged(source, destination) {
  const [sourceInfo, destinationInfo] = await Promise.all([
    stat(source),
    stat(destination).catch(() => null)
  ])
  if (!destinationInfo || destinationInfo.size !== sourceInfo.size) {
    await copyFile(source, destination)
  }
}

async function ensureOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const languageDirectory = join(app.getPath('userData'), 'ocr-data')
      await mkdir(languageDirectory, { recursive: true })
      await Promise.all(
        OCR_MODELS.map((model) =>
          copyFileIfChanged(model.source, join(languageDirectory, `${model.code}.traineddata.gz`))
        )
      )
      return createWorker(
        OCR_MODELS.map((model) => model.code),
        OEM.LSTM_ONLY,
        {
          langPath: languageDirectory,
          gzip: true,
          cacheMethod: 'none',
          logger: (message) => {
            if (ocrProgressTarget && !ocrProgressTarget.isDestroyed()) {
              ocrProgressTarget.send('screenshot:ocr-progress', {
                status: message.status,
                progress: Number.isFinite(message.progress) ? message.progress : 0
              })
            }
          }
        }
      )
    })().catch((error) => {
      ocrWorkerPromise = null
      throw error
    })
  }
  return ocrWorkerPromise
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
    pinnedScreenshotSessions.forEach((session) => session.window.close())
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('ping', () => 'pong')

ipcMain.handle('com:probe', async (event) => {
  assertMainWindowSender(event)
  return runComCommand(event, 'probe', {})
})

ipcMain.handle('illustrator:pick-files', async (event) => {
  assertMainWindowSender(event)
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: '选择 Illustrator 文件',
    filters: [{ name: 'Adobe Illustrator', extensions: ['ai'] }],
    properties: ['openFile', 'multiSelections']
  })
  if (result.canceled) return []
  const files = []
  for (const filePath of result.filePaths.slice(0, 500)) {
    files.push(await registerIllustratorInput(filePath, event.sender.id))
  }
  return files
})

ipcMain.handle('illustrator:pick-folder', async (event) => {
  assertMainWindowSender(event)
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: '选择 Illustrator 文件夹',
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return []
  return collectIllustratorFolder(result.filePaths[0], event.sender.id)
})

ipcMain.handle('illustrator:remove-inputs', (event, inputIds) => {
  assertMainWindowSender(event)
  const ids = Array.isArray(inputIds) ? inputIds : []
  for (const id of ids) {
    const input = illustratorInputSessions.get(id)
    if (input?.ownerId === event.sender.id) illustratorInputSessions.delete(id)
  }
  return { status: 'removed' }
})

ipcMain.handle('illustrator:run', async (event, payload) => {
  assertMainWindowSender(event)
  const ids = Array.isArray(payload?.inputIds) ? payload.inputIds : []
  if (!ids.length || ids.length > 500) {
    throw new Error('请选择 1–500 个 Illustrator 文件')
  }
  const action = ['standard-pdf', 'minimal-pdf', 'outline'].includes(payload?.action)
    ? payload.action
    : null
  if (!action) throw new Error('不支持的 Illustrator 任务')
  if (activeIllustratorTasks.has(event.sender.id)) {
    throw new Error('已有 Illustrator 任务正在执行')
  }

  const inputs = ids.map((id) => illustratorSession(event, id))
  let outputDirectory = null
  if (!payload.sameDirectory) {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender)
    const selection = await dialog.showOpenDialog(ownerWindow, {
      title: '选择 Illustrator 输出文件夹',
      properties: ['openDirectory', 'createDirectory', 'promptToCreate']
    })
    if (selection.canceled || !selection.filePaths[0]) return { status: 'cancelled', outputs: [] }
    outputDirectory = selection.filePaths[0]
  }

  const files = []
  for (const input of inputs) {
    const sourceBase = basename(input.path, extname(input.path))
    const directory = outputDirectory || dirname(input.path)
    const extension = action === 'outline' ? 'ai' : 'pdf'
    const outputBase = action === 'outline'
      ? `${sourceBase}-OL`
      : action === 'minimal-pdf'
        ? `${sourceBase}-min`
        : sourceBase
    files.push({
      inputPath: input.path,
      outputPath: await availableOutputPath(directory, outputBase, extension),
      name: input.name
    })
  }

  const taskId = randomUUID()
  activeIllustratorTasks.set(event.sender.id, taskId)
  try {
    const result = await runComCommand(
      event,
      'illustrator-batch',
      { action, files },
      {
        id: taskId,
        timeoutMs: 2 * 60 * 60 * 1000,
        progressChannel: 'illustrator:progress'
      }
    )
    for (const output of result.outputs) {
      await assertOutputFile(output.outputPath, output.name)
    }
    const outputs = result.outputs.map((output) => registerComResult(event.sender.id, output.outputPath))
    return { status: 'completed', outputs }
  } catch (error) {
    if (error.message === 'TASK_CANCELLED') return { status: 'cancelled', outputs: [] }
    throw error
  } finally {
    activeIllustratorTasks.delete(event.sender.id)
  }
})

ipcMain.handle('illustrator:cancel', (event) => {
  assertMainWindowSender(event)
  const taskId = activeIllustratorTasks.get(event.sender.id)
  return { status: taskId && cancelComCommand(taskId) ? 'cancelling' : 'idle' }
})

ipcMain.handle('office:pick-file', async (event, kind) => {
  assertMainWindowSender(event)
  const config = officeKindConfig(kind)
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: `选择 ${config.label} 文件`,
    filters: [{ name: `${config.label} 文档`, extensions: config.extensions }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  const info = await stat(filePath)
  if (!info.isFile() || info.size > 2 * 1024 * 1024 * 1024) {
    throw new Error('Office 文件无效或超过 2 GB')
  }
  const id = randomUUID()
  officeInputSessions.set(id, {
    id,
    ownerId: event.sender.id,
    kind,
    path: filePath,
    name: basename(filePath),
    size: info.size
  })
  return { id, name: basename(filePath), size: info.size, kind }
})

ipcMain.handle('office:to-pdf', async (event, payload) => {
  assertMainWindowSender(event)
  const inputId = payload?.inputId
  const input = officeInputSessions.get(inputId)
  if (!input || input.ownerId !== event.sender.id) {
    throw new Error('Office 文件会话不存在或无权访问')
  }
  const destination = getPdfOutputSession(event, payload?.destinationId, 'file')
  const outputPath = destination.path
  await runComCommand(event, 'office-to-pdf', {
    kind: input.kind,
    inputPath: input.path,
    outputPath
  }, { timeoutMs: 20 * 60 * 1000 })
  await assertOutputFile(outputPath, `${officeKindConfig(input.kind).label} 转 PDF`)
  return {
    status: 'completed',
    result: registerComResult(event.sender.id, outputPath)
  }
})

ipcMain.handle('com:show-result', async (event, resultId) => {
  assertMainWindowSender(event)
  const result = comResultSessions.get(resultId)
  if (!result || result.ownerId !== event.sender.id) {
    throw new Error('输出文件会话不存在或无权访问')
  }
  shell.showItemInFolder(result.path)
  return { status: 'shown' }
})

// Spike / 正式链路：把条码 SVG 交给 Illustrator，递归解组后（可选）执行 app.copy()。
// mode='inspect' 只返回结构统计；mode='copy' 额外全选并复制到 Illustrator 原生剪贴板。
// ⚠ 仅 Windows + 已安装 Illustrator 可用；"复制后未编组"只对 Illustrator 承诺。
ipcMain.handle('barcode:illustrator-ungrouped-copy', async (event, payload) => {
  assertMainWindowSender(event)
  const normalized = normalizeBarcodeData('svg', payload?.data)
  if (Buffer.byteLength(normalized.data) > 20 * 1024 * 1024) {
    throw new Error('条码 SVG 超过 20 MB')
  }
  const temporaryDirectory = join(app.getPath('temp'), 'moyu-tools-com')
  await mkdir(temporaryDirectory, { recursive: true })
  const inputPath = join(temporaryDirectory, `${randomUUID()}.svg`)
  await writeFile(inputPath, normalized.data, 'utf8')
  try {
    const mode = ['copy', 'roundtrip'].includes(payload?.mode) ? payload.mode : 'inspect'
    const result = await runComCommand(
      event,
      'illustrator-ungrouped-copy',
      { inputPath, mode },
      { timeoutMs: 10 * 60 * 1000 }
    )
    // 失败语义：worker 在 report.error 或空报告时已抛错，
    // runComCommand 会 reject，本 IPC 直接以 Promise 抛错传出，不再包 status:'error'。
    const fields = result?.fields || {}
    // 判据：inspect 看 beforeGroups；roundtrip 以**粘贴后** pastedGroups 为准。
    const ungrouped =
      mode === 'roundtrip' ? Number(fields.pastedGroups) === 0 : Number(fields.beforeGroups) === 0
    return { status: 'ok', mode, ungrouped, fields, report: result.report }
  } finally {
    await unlink(inputPath).catch(() => {})
  }
})

ipcMain.handle('barcode:export-eps', async (event, payload) => {
  assertMainWindowSender(event)
  const normalized = normalizeBarcodeData('svg', payload?.data)
  if (Buffer.byteLength(normalized.data) > 20 * 1024 * 1024) {
    throw new Error('条码 SVG 超过 20 MB')
  }
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const selection = await dialog.showSaveDialog(ownerWindow, {
    title: '保存 EPS 条码',
    defaultPath: `${sanitizeFileBaseName(payload?.name, 'barcode')}.eps`,
    filters: [{ name: 'EPS 矢量图', extensions: ['eps'] }]
  })
  if (selection.canceled || !selection.filePath) return { status: 'cancelled' }
  const temporaryDirectory = join(app.getPath('temp'), 'moyu-tools-com')
  await mkdir(temporaryDirectory, { recursive: true })
  const inputPath = join(temporaryDirectory, `${randomUUID()}.svg`)
  await writeFile(inputPath, normalized.data, 'utf8')
  try {
    await runComCommand(event, 'illustrator-svg', {
      inputPath,
      outputPath: selection.filePath
    }, { timeoutMs: 10 * 60 * 1000 })
    await assertOutputFile(selection.filePath, 'EPS 条码')
    return {
      status: 'saved',
      result: registerComResult(event.sender.id, selection.filePath)
    }
  } finally {
    await unlink(inputPath).catch(() => {})
  }
})

ipcMain.handle('barcode:open-illustrator', async (event, payload) => {
  assertMainWindowSender(event)
  const normalized = normalizeBarcodeData('svg', payload?.data)
  const temporaryDirectory = join(app.getPath('temp'), 'moyu-tools-com')
  await mkdir(temporaryDirectory, { recursive: true })
  const inputPath = join(temporaryDirectory, `${randomUUID()}.svg`)
  await writeFile(inputPath, normalized.data, 'utf8')
  try {
    await runComCommand(event, 'illustrator-svg', { inputPath }, { timeoutMs: 10 * 60 * 1000 })
    return { status: 'opened' }
  } finally {
    await unlink(inputPath).catch(() => {})
  }
})

ipcMain.handle('barcode:open-photoshop', async (event, payload) => {
  assertMainWindowSender(event)
  const normalized = normalizeBarcodeData('png', payload?.data)
  const temporaryDirectory = join(app.getPath('temp'), 'moyu-tools-com')
  await mkdir(temporaryDirectory, { recursive: true })
  const inputPath = join(temporaryDirectory, `${randomUUID()}.png`)
  await writeFile(inputPath, await withBarcodePngDensity(normalized.data, normalized.fileType, payload?.density))
  try {
    await runComCommand(event, 'photoshop-open', { inputPath }, { timeoutMs: 10 * 60 * 1000 })
    return { status: 'opened' }
  } finally {
    await unlink(inputPath).catch(() => {})
  }
})

ipcMain.handle('barcode:copy-vector', (event, data) => {
  assertMainWindowSender(event)
  const normalized = normalizeBarcodeData('svg', data)
  const buffer = Buffer.from(normalized.data, 'utf8')
  if (buffer.byteLength > 20 * 1024 * 1024) {
    throw new Error('条码 SVG 超过 20 MB，已拒绝复制')
  }

  const format = process.platform === 'darwin' ? 'public.svg-image' : 'image/svg+xml'
  clipboard.writeBuffer(format, buffer)
  const copied = clipboard.readBuffer(format)
  if (!copied.equals(buffer)) throw new Error('条码 SVG 写入剪贴板失败')

  return { status: 'copied', format, bytes: buffer.byteLength }
})

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

  await writeFile(result.filePath, await withBarcodePngDensity(data, fileType, payload?.density), fileType.encoding || undefined)
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
    await writeFile(filePath, await withBarcodePngDensity(file.data, file.fileType, payload?.density), file.fileType.encoding || undefined)
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

  const outputData = payload.type === 'tiff'
    ? await sharp(data, { limitInputPixels: 400_000_000 })
      .tiff({ compression: 'lzw', quality: 92 })
      .toBuffer()
    : data
  await writeFile(result.filePath, outputData)
  return { status: 'saved', path: result.filePath }
})

ipcMain.handle('ai:get-status', async (event) => {
  assertMainWindowSender(event)
  const models = {}
  for (const [key, model] of Object.entries(AI_MODELS)) {
    const state = await inspectAiModel(key)
    models[key] = {
      name: model.name,
      ready: state.ready,
      size: model.size,
      license: model.license
    }
  }

  let sidecarReady = false
  let sidecarMessage = ''
  try {
    const launch = getAiSidecarLaunch()
    if (process.platform === 'win32') {
      sidecarReady = Boolean(await stat(launch.command).catch(() => null))
      if (!sidecarReady) sidecarMessage = '请先构建 Windows AI sidecar'
    } else {
      sidecarReady = !app.isPackaged
      sidecarMessage = '非 Windows 开发环境需安装 sidecar Python 依赖'
    }
  } catch (error) {
    sidecarMessage = error.message
  }

  return {
    sidecarReady,
    sidecarMessage,
    models,
    platform: process.platform
  }
})

ipcMain.handle('ai:pick-images', async (event, payload) => {
  assertMainWindowSender(event)
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: '选择 AI 图像处理文件',
    properties: ['openFile', ...(payload?.multiple === false ? [] : ['multiSelections'])],
    filters: [
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
    ]
  })
  if (result.canceled) return { status: 'cancelled', files: [] }
  if (result.filePaths.length > AI_MAX_FILES) throw new Error(`一次最多选择 ${AI_MAX_FILES} 张图片`)

  const files = []
  const errors = []
  for (const filePath of result.filePaths) {
    try {
      files.push(await registerAiInput(filePath, event.sender.id))
    } catch (error) {
      errors.push(error.message)
    }
  }
  return { status: 'selected', files, errors }
})

ipcMain.handle('ai:pick-folder', async (event) => {
  assertMainWindowSender(event)
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: '选择批量图片文件夹',
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return { status: 'cancelled', files: [] }

  const directory = result.filePaths[0]
  const entries = await readdir(directory, { withFileTypes: true })
  const candidates = entries
    .filter((entry) => entry.isFile() && AI_IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .slice(0, AI_MAX_FILES)
  const files = []
  const errors = []
  for (const entry of candidates) {
    try {
      files.push(await registerAiInput(join(directory, entry.name), event.sender.id))
    } catch (error) {
      errors.push(error.message)
    }
  }
  return {
    status: 'selected',
    files,
    errors,
    truncated: candidates.length === AI_MAX_FILES && entries.length > AI_MAX_FILES
  }
})

ipcMain.handle('ai:remove-inputs', (event, inputIds) => {
  assertMainWindowSender(event)
  const ids = Array.isArray(inputIds) ? inputIds : []
  ids.forEach((id) => {
    const input = aiInputSessions.get(id)
    if (input?.ownerId === event.sender.id) aiInputSessions.delete(id)
  })
  return { status: 'removed', count: ids.length }
})

ipcMain.handle('ai:run', async (event, payload) => {
  assertMainWindowSender(event)
  const mode = payload?.mode
  if (!['remove', 'batch', 'id-photo', 'inpaint'].includes(mode)) {
    throw new Error('不支持的 AI 图像任务')
  }

  const requestedIds = Array.isArray(payload?.inputIds) ? payload.inputIds : []
  if (!requestedIds.length || requestedIds.length > AI_MAX_FILES) {
    throw new Error(`AI 任务图片数量必须在 1–${AI_MAX_FILES} 之间`)
  }
  if (['id-photo', 'inpaint'].includes(mode) && requestedIds.length !== 1) {
    throw new Error('证件照与图像修补任务一次只处理一张图片')
  }

  const inputs = requestedIds.map((id) => getAiInput(event, id))
  const modelPath = await downloadAiModel(mode === 'inpaint' ? 'migan' : 'rmbg', event.sender)
  const taskDirectory = join(getAiResultDirectory(), randomUUID())
  await mkdir(taskDirectory, { recursive: true })
  let maskPath = ''
  if (mode === 'inpaint') {
    const maskData = payload?.mask instanceof Uint8Array ? Buffer.from(payload.mask) : null
    if (!maskData || maskData.byteLength > 20 * 1024 * 1024) {
      throw new Error('请先在原图上涂抹需要修补的区域')
    }
    const maskImage = nativeImage.createFromBuffer(maskData)
    if (maskImage.isEmpty()) throw new Error('无法解析修补遮罩')
    maskPath = join(taskDirectory, 'repair-mask.png')
    await writeFile(maskPath, maskData)
  }
  const results = []
  const errors = []

  for (const [index, input] of inputs.entries()) {
    const outputBase = sanitizeFileBaseName(
      basename(input.name, extname(input.name)),
      `image-${index + 1}`
    )
    const outputPath = join(
      taskDirectory,
      `${outputBase}-${mode === 'id-photo' ? 'id-photo' : 'cutout'}.png`
    )
    event.sender.send('ai:task-progress', {
      status: 'running',
      completed: index,
      total: inputs.length,
      name: input.name
    })

    try {
      const command = mode === 'id-photo'
        ? {
            action: 'id_photo',
            input: input.path,
            output: outputPath,
            model: modelPath,
            width: Math.min(4000, Math.max(64, Number(payload?.width) || 295)),
            height: Math.min(4000, Math.max(64, Number(payload?.height) || 413)),
            background: /^#[0-9a-f]{6}$/i.test(payload?.background)
              ? payload.background
              : '#438edb'
          }
        : mode === 'inpaint'
          ? {
              action: 'inpaint',
              input: input.path,
              output: outputPath.replace('-cutout.png', '-repaired.png'),
              model: modelPath,
              mask: maskPath
            }
        : {
            action: 'remove_bg',
            input: input.path,
            output: outputPath,
            model: modelPath
          }
      const metadata = await callAiSidecar(command)
      results.push(await registerAiResult(event, command.output, input, metadata))
    } catch (error) {
      errors.push({ inputId: input.id, name: input.name, message: error.message })
      if (mode !== 'batch') throw error
    }

    event.sender.send('ai:task-progress', {
      status: 'running',
      completed: index + 1,
      total: inputs.length,
      name: input.name
    })
  }

  event.sender.send('ai:task-progress', {
    status: 'complete',
    completed: inputs.length,
    total: inputs.length
  })
  return { status: 'complete', results, errors }
})

ipcMain.handle('ai:save-results', async (event, resultIds) => {
  assertMainWindowSender(event)
  const ids = Array.isArray(resultIds) ? resultIds : []
  if (!ids.length || ids.length > AI_MAX_FILES) throw new Error('没有可保存的 AI 处理结果')
  const results = ids.map((id) => getAiResult(event, id))
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)

  if (results.length === 1) {
    const result = results[0]
    const selection = await dialog.showSaveDialog(ownerWindow, {
      title: '保存 AI 图像结果',
      defaultPath: result.name,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }]
    })
    if (selection.canceled || !selection.filePath) return { status: 'cancelled', saved: 0 }
    await copyFile(result.path, selection.filePath)
    return { status: 'saved', saved: 1, path: selection.filePath }
  }

  const selection = await dialog.showOpenDialog(ownerWindow, {
    title: '选择 AI 结果保存文件夹',
    properties: ['openDirectory', 'createDirectory', 'promptToCreate']
  })
  if (selection.canceled || !selection.filePaths[0]) return { status: 'cancelled', saved: 0 }

  const directory = selection.filePaths[0]
  const usedNames = new Map()
  for (const [index, result] of results.entries()) {
    const key = result.name.toLocaleLowerCase('en-US')
    const occurrence = (usedNames.get(key) || 0) + 1
    usedNames.set(key, occurrence)
    const extension = extname(result.name)
    const base = basename(result.name, extension)
    const uniqueName = occurrence === 1 ? result.name : `${base}-${occurrence}${extension}`
    await copyFile(result.path, join(directory, uniqueName))
    event.sender.send('ai:task-progress', {
      status: 'saving',
      completed: index + 1,
      total: results.length,
      name: uniqueName
    })
  }
  return { status: 'saved', saved: results.length, directory }
})

ipcMain.handle('ai:export-psd', async (event, resultId) => {
  assertMainWindowSender(event)
  const result = getAiResult(event, resultId)
  const [original, processed] = await Promise.all([
    psdImageDataFromPath(result.inputPath),
    psdImageDataFromPath(result.path)
  ])
  if (original.width !== processed.width || original.height !== processed.height) {
    throw new Error('原图与处理结果尺寸不同，无法导出同尺寸分层 PSD')
  }

  const psd = {
    width: original.width,
    height: original.height,
    children: [
      {
        name: '处理结果',
        left: 0,
        top: 0,
        right: processed.width,
        bottom: processed.height,
        imageData: processed
      },
      {
        name: '原图（隐藏）',
        hidden: true,
        left: 0,
        top: 0,
        right: original.width,
        bottom: original.height,
        imageData: original
      }
    ]
  }
  const data = Buffer.from(writePsdBuffer(psd))
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const defaultName = `${sanitizeFileBaseName(
    basename(result.inputName, extname(result.inputName)),
    'ai-image'
  )}-layers.psd`
  const selection = await dialog.showSaveDialog(ownerWindow, {
    title: '导出分层 PSD',
    defaultPath: defaultName,
    filters: [{ name: 'Adobe Photoshop 文档', extensions: ['psd'] }]
  })
  if (selection.canceled || !selection.filePath) return { status: 'cancelled' }
  await writeFile(selection.filePath, data)
  return { status: 'saved', path: selection.filePath, bytes: data.byteLength }
})

ipcMain.handle('format:get-status', async (event) => {
  assertMainWindowSender(event)
  let ffmpegReady = false
  let ffmpegMessage = ''
  let ffmpegVersion = ''
  let missingEncoders = []
  try {
    const [ffmpegPath, ffprobePath] = [
      getFormatToolPath('ffmpeg'),
      getFormatToolPath('ffprobe')
    ]
    const [ffmpegInfo, ffprobeInfo] = await Promise.all([
      stat(ffmpegPath).catch(() => null),
      stat(ffprobePath).catch(() => null)
    ])
    ffmpegReady = Boolean(ffmpegInfo?.isFile() && ffprobeInfo?.isFile())
    if (!ffmpegReady) {
      ffmpegMessage = '请先执行 npm run build:tools:win'
    } else {
      const [versionResult, encodersResult] = await Promise.all([
        runFormatProcess(ffmpegPath, ['-version'], { timeoutMs: 5000 }),
        runFormatProcess(ffmpegPath, ['-hide_banner', '-encoders'], { timeoutMs: 8000 })
      ])
      ffmpegVersion = versionResult.stdout.split(/\r?\n/, 1)[0].trim()
      const requiredEncoders = ['libx264', 'libvpx-vp9', 'libopus', 'libmp3lame']
      missingEncoders = requiredEncoders.filter((encoder) =>
        !encodersResult.stdout.includes(encoder)
      )
      if (missingEncoders.length) {
        ffmpegReady = false
        ffmpegMessage = `FFmpeg 缺少编码器：${missingEncoders.join('、')}`
      }
    }
  } catch (error) {
    ffmpegMessage = error.message
  }
  return {
    ffmpegReady,
    ffmpegMessage,
    ffmpegVersion,
    missingEncoders,
    sharp: sharp.versions,
    platform: process.platform
  }
})

ipcMain.handle('format:pick-files', async (event, payload) => {
  assertMainWindowSender(event)
  const kind = normalizeFormatKind(payload?.kind)
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const extensions = [...FORMAT_EXTENSIONS[kind]].map((extension) => extension.slice(1))
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: `选择${kind === 'video' ? '视频' : kind === 'audio' ? '音频' : '图片'}文件`,
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '支持的文件', extensions }]
  })
  if (result.canceled) return { status: 'cancelled', files: [] }
  if (result.filePaths.length > FORMAT_MAX_FILES) {
    throw new Error(`一次最多选择 ${FORMAT_MAX_FILES} 个文件`)
  }
  const files = []
  const errors = []
  for (const filePath of result.filePaths) {
    try {
      files.push(await registerFormatInput(filePath, event.sender.id, kind))
    } catch (error) {
      errors.push(error.message)
    }
  }
  return { status: 'selected', files, errors }
})

ipcMain.handle('format:pick-folder', async (event, payload) => {
  assertMainWindowSender(event)
  const kind = normalizeFormatKind(payload?.kind)
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: '选择批量转换文件夹',
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return { status: 'cancelled', files: [] }
  const directory = result.filePaths[0]
  const entries = await readdir(directory, { withFileTypes: true })
  const candidates = entries
    .filter((entry) => entry.isFile() && FORMAT_EXTENSIONS[kind].has(extname(entry.name).toLowerCase()))
    .slice(0, FORMAT_MAX_FILES)
  const files = []
  const errors = []
  for (const entry of candidates) {
    try {
      files.push(await registerFormatInput(join(directory, entry.name), event.sender.id, kind))
    } catch (error) {
      errors.push(error.message)
    }
  }
  return {
    status: 'selected',
    files,
    errors,
    truncated: candidates.length === FORMAT_MAX_FILES
  }
})

ipcMain.handle('format:remove-inputs', (event, inputIds) => {
  assertMainWindowSender(event)
  const ids = Array.isArray(inputIds) ? inputIds : []
  let removed = 0
  ids.forEach((id) => {
    const input = formatInputSessions.get(id)
    if (input?.ownerId === event.sender.id) {
      formatInputSessions.delete(id)
      removed += 1
    }
  })
  return { status: 'removed', count: removed }
})

ipcMain.handle('format:run', async (event, payload) => {
  assertMainWindowSender(event)
  const action = FORMAT_ACTIONS.get(payload?.action)
  if (!action) throw new Error('不支持的格式工厂任务')
  const inputIds = Array.isArray(payload?.inputIds) ? payload.inputIds : []
  if (!inputIds.length || inputIds.length > FORMAT_MAX_FILES) {
    throw new Error(`任务文件数量必须在 1–${FORMAT_MAX_FILES} 之间`)
  }
  const inputs = inputIds.map((id) => getFormatInput(event, id))
  const expectedKind = action.startsWith('video') || action === 'extract-audio'
    ? 'video'
    : action.startsWith('audio')
      ? 'audio'
      : 'image'
  if (inputs.some((input) => input.kind !== expectedKind)) {
    throw new Error('任务中包含与当前功能不匹配的文件')
  }

  const taskId = typeof payload?.taskId === 'string' && payload.taskId.length <= 80
    ? payload.taskId
    : randomUUID()
  if (formatTasks.has(taskId)) throw new Error('已有同名格式转换任务正在执行')
  const task = {
    id: taskId,
    ownerId: event.sender.id,
    cancelled: false,
    process: null
  }
  formatTasks.set(taskId, task)
  const outputDirectory = join(getFormatResultDirectory(), randomUUID())
  await mkdir(outputDirectory, { recursive: true })
  const results = []
  const errors = []

  try {
    for (const [index, input] of inputs.entries()) {
      if (task.cancelled) return { status: 'cancelled', taskId, results, errors }
      const extension = formatOutputExtension(action, payload?.options, input)
      const base = sanitizeFileBaseName(basename(input.name, extname(input.name)), `file-${index + 1}`)
      const suffix = action.includes('compress') ? 'compressed' : extension
      const outputPath = join(outputDirectory, `${base}-${suffix}.${extension}`)
      event.sender.send('format:progress', {
        taskId,
        status: 'running',
        inputId: input.id,
        completed: index,
        total: inputs.length,
        fileProgress: 0,
        name: input.name
      })

      try {
        let metadata
        if (input.kind === 'image') {
          metadata = await processFormatImage(action, input, outputPath, payload?.options)
          event.sender.send('format:progress', {
            taskId,
            status: 'running',
            inputId: input.id,
            completed: index,
            total: inputs.length,
            fileProgress: 1,
            name: input.name
          })
        } else {
          const sourceMetadata = await probeFormatMedia(input)
          if (action === 'extract-audio' && !sourceMetadata.audioCodec) {
            throw new Error('输入文件没有可用的音轨')
          }
          let stderrBuffer = ''
          const args = buildFfmpegArgs(action, input, outputPath, payload?.options)
          await runFormatProcess(getFormatToolPath('ffmpeg'), args, {
            task,
            onStderr: (chunk) => {
              stderrBuffer = `${stderrBuffer}${chunk}`.slice(-2000)
              const matches = [...stderrBuffer.matchAll(/time=(\d+:\d+:\d+(?:\.\d+)?)/g)]
              const seconds = matches.length ? parseFfmpegTime(matches.at(-1)[1]) : 0
              const fileProgress = sourceMetadata.duration
                ? Math.min(0.99, seconds / sourceMetadata.duration)
                : 0
              event.sender.send('format:progress', {
                taskId,
                status: 'running',
                inputId: input.id,
                completed: index,
                total: inputs.length,
                fileProgress,
                name: input.name
              })
            }
          })
          metadata = await probeFormatMedia({ path: outputPath })
        }
        results.push(await registerFormatResult(event, outputPath, input, metadata))
      } catch (error) {
        if (error.message === 'TASK_CANCELLED') {
          return { status: 'cancelled', taskId, results, errors }
        }
        errors.push({
          inputId: input.id,
          name: input.name,
          message: sanitizeProcessError(error, [input.path, outputPath])
        })
      }

      event.sender.send('format:progress', {
        taskId,
        status: 'running',
        inputId: input.id,
        completed: index + 1,
        total: inputs.length,
        fileProgress: 1,
        name: input.name
      })
    }
    event.sender.send('format:progress', {
      taskId,
      status: 'complete',
      completed: inputs.length,
      total: inputs.length,
      fileProgress: 1
    })
    return { status: 'complete', taskId, results, errors }
  } finally {
    formatTasks.delete(taskId)
  }
})

ipcMain.handle('format:cancel', (event, taskId) => {
  assertMainWindowSender(event)
  const task = formatTasks.get(taskId)
  if (!task || task.ownerId !== event.sender.id) return { status: 'not-running' }
  task.cancelled = true
  if (task.process && !task.process.killed) task.process.kill()
  return { status: 'cancelling' }
})

ipcMain.handle('format:save-results', async (event, resultIds) => {
  assertMainWindowSender(event)
  const ids = Array.isArray(resultIds) ? resultIds : []
  if (!ids.length || ids.length > FORMAT_MAX_FILES) throw new Error('没有可保存的转换结果')
  const results = ids.map((id) => getFormatResult(event, id))
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)

  if (results.length === 1) {
    const result = results[0]
    const extension = extname(result.name).slice(1)
    const selection = await dialog.showSaveDialog(ownerWindow, {
      title: '保存格式转换结果',
      defaultPath: result.name,
      filters: [{ name: `${extension.toUpperCase()} 文件`, extensions: [extension] }]
    })
    if (selection.canceled || !selection.filePath) return { status: 'cancelled', saved: 0 }
    await copyFile(result.path, selection.filePath)
    return { status: 'saved', saved: 1, path: selection.filePath }
  }

  const selection = await dialog.showOpenDialog(ownerWindow, {
    title: '选择格式转换结果保存文件夹',
    properties: ['openDirectory', 'createDirectory', 'promptToCreate']
  })
  if (selection.canceled || !selection.filePaths[0]) return { status: 'cancelled', saved: 0 }
  const directory = selection.filePaths[0]
  const usedNames = new Map()
  for (const [index, result] of results.entries()) {
    const key = result.name.toLocaleLowerCase('en-US')
    const occurrence = (usedNames.get(key) || 0) + 1
    usedNames.set(key, occurrence)
    const extension = extname(result.name)
    const base = basename(result.name, extension)
    const uniqueName = occurrence === 1 ? result.name : `${base}-${occurrence}${extension}`
    await copyFile(result.path, join(directory, uniqueName))
    event.sender.send('format:progress', {
      status: 'saving',
      completed: index + 1,
      total: results.length,
      name: uniqueName
    })
  }
  return { status: 'saved', saved: results.length, directory }
})

ipcMain.handle('pdf:choose-output', async (event, payload) => {
  assertMainWindowSender(event)
  const mode = payload?.mode === 'directory' ? 'directory' : 'file'
  const ownerWindow = BrowserWindow.fromWebContents(event.sender)
  let outputPath

  if (mode === 'directory') {
    const result = await dialog.showOpenDialog(ownerWindow, {
      title: '选择 PDF 工具输出文件夹',
      properties: ['openDirectory', 'createDirectory', 'promptToCreate']
    })
    if (result.canceled || !result.filePaths[0]) return { status: 'cancelled' }
    outputPath = result.filePaths[0]
  } else {
    const fileType = PDF_OUTPUT_TYPES[payload?.type]
    if (!fileType) throw new Error('不支持的 PDF 输出类型')
    const safeBaseName = sanitizeFileBaseName(payload?.name, 'pdf-output')
    const result = await dialog.showSaveDialog(ownerWindow, {
      title: `选择 ${fileType.filterName} 输出位置`,
      defaultPath: `${safeBaseName}.${fileType.extension}`,
      filters: [{ name: fileType.filterName, extensions: [fileType.extension] }]
    })
    if (result.canceled || !result.filePath) return { status: 'cancelled' }
    outputPath = result.filePath
  }

  const id = randomUUID()
  pdfOutputSessions.set(id, {
    id,
    ownerId: event.sender.id,
    mode,
    path: outputPath
  })
  return { status: 'selected', id, mode, path: outputPath }
})

ipcMain.handle('pdf:save-file', async (event, payload) => {
  assertMainWindowSender(event)
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

  const destination = getPdfOutputSession(event, payload?.destinationId, 'file')
  await writeFile(destination.path, data)
  return { status: 'saved', path: destination.path }
})

ipcMain.handle('pdf:save-files', async (event, payload) => {
  assertMainWindowSender(event)
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

  const destination = getPdfOutputSession(event, payload?.destinationId, 'directory')
  const directory = destination.path
  const usedNames = new Map()

  for (const [index, file] of normalizedFiles.entries()) {
    const nameKey = file.name.toLocaleLowerCase('en-US')
    const occurrence = (usedNames.get(nameKey) || 0) + 1
    usedNames.set(nameKey, occurrence)
    const uniqueName = occurrence === 1 ? file.name : `${file.name}-${occurrence}`
    const outputPath = await availableOutputPath(directory, uniqueName, fileType.extension)
    await writeFile(outputPath, file.data)
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

ipcMain.handle('screenshot:ocr', async (event, data) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('只有主窗口可以执行截图 OCR')
  }
  if (ocrBusy) throw new Error('已有 OCR 任务正在执行')
  if (!(data instanceof Uint8Array) || data.byteLength > 100 * 1024 * 1024) {
    throw new Error('OCR 图片数据无效或超过 100 MB')
  }

  const image = nativeImage.createFromBuffer(Buffer.from(data))
  if (image.isEmpty()) throw new Error('无法解析 OCR 图片')
  ocrBusy = true
  ocrProgressTarget = event.sender

  try {
    const worker = await ensureOcrWorker()
    const result = await worker.recognize(Buffer.from(data))
    return {
      status: 'recognized',
      text: normalizeOcrText(result.data.text),
      confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : 0
    }
  } finally {
    ocrBusy = false
    ocrProgressTarget = null
  }
})

ipcMain.handle('screenshot:copy-text', (event, text) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('只有主窗口可以复制 OCR 文字')
  }
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 2 * 1024 * 1024) {
    throw new Error('OCR 文本无效或超过 2 MB')
  }
  clipboard.writeText(text)
  return { status: 'copied', length: text.length }
})

function getPinnedScreenshotSession(event, pinId) {
  const session = pinnedScreenshotSessions.get(pinId)
  if (!session || event.sender !== session.window.webContents) {
    throw new Error('钉图会话不存在或无权访问')
  }
  return session
}

ipcMain.handle('screenshot:pin', async (event, data) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('只有主窗口可以创建钉图')
  }
  if (!(data instanceof Uint8Array) || data.byteLength > 100 * 1024 * 1024) {
    throw new Error('钉图数据无效或超过 100 MB')
  }

  const buffer = Buffer.from(data)
  const image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) throw new Error('无法解析钉图数据')
  const originalSize = image.getSize()
  const scale = Math.min(1, 520 / originalSize.width, 420 / originalSize.height)
  const width = Math.max(160, Math.round(originalSize.width * scale))
  const height = Math.max(120, Math.round(originalSize.height * scale))
  const pinId = randomUUID()
  const pinWindow = new BrowserWindow({
    width,
    height,
    minWidth: 120,
    minHeight: 90,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  pinnedScreenshotSessions.set(pinId, {
    data: buffer,
    image,
    originalSize,
    window: pinWindow
  })
  pinWindow.once('ready-to-show', () => pinWindow.show())
  pinWindow.on('closed', () => pinnedScreenshotSessions.delete(pinId))

  if (process.env.ELECTRON_RENDERER_URL) {
    const pinUrl = new URL('pin.html', process.env.ELECTRON_RENDERER_URL)
    pinUrl.searchParams.set('pin', pinId)
    await pinWindow.loadURL(pinUrl.toString())
  } else {
    await pinWindow.loadFile(join(__dirname, '../renderer/pin.html'), {
      query: { pin: pinId }
    })
  }

  return { status: 'pinned', pinId, width, height }
})

ipcMain.handle('screenshot:pin-get', (event, pinId) => {
  const session = getPinnedScreenshotSession(event, pinId)
  return {
    data: new Uint8Array(session.data),
    originalSize: session.originalSize,
    opacity: session.window.getOpacity()
  }
})

ipcMain.handle('screenshot:pin-resize', (event, payload) => {
  const session = getPinnedScreenshotSession(event, payload?.pinId)
  const scale = Math.min(3, Math.max(0.2, Number(payload?.scale)))
  if (!Number.isFinite(scale)) throw new Error('钉图缩放比例无效')
  const width = Math.max(120, Math.round(session.originalSize.width * scale))
  const height = Math.max(90, Math.round(session.originalSize.height * scale))
  session.window.setSize(width, height, true)
  return { status: 'resized', width, height, scale }
})

ipcMain.handle('screenshot:pin-opacity', (event, payload) => {
  const session = getPinnedScreenshotSession(event, payload?.pinId)
  const opacity = Math.min(1, Math.max(0.3, Number(payload?.opacity)))
  if (!Number.isFinite(opacity)) throw new Error('钉图透明度无效')
  session.window.setOpacity(opacity)
  return { status: 'updated', opacity }
})

ipcMain.handle('screenshot:pin-copy', (event, pinId) => {
  const session = getPinnedScreenshotSession(event, pinId)
  clipboard.writeImage(session.image)
  return { status: 'copied', size: session.originalSize }
})

ipcMain.handle('screenshot:pin-close', (event, pinId) => {
  const session = getPinnedScreenshotSession(event, pinId)
  session.window.close()
  return { status: 'closed' }
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

app.on('before-quit', () => {
  ocrWorkerPromise?.then((worker) => worker.terminate()).catch(() => {})
  if (comWorker) {
    comWorker.kill()
    comWorker = null
  }
  if (aiSidecar && !aiSidecar.killed) {
    aiSidecar.stdin.write(`${JSON.stringify({ id: randomUUID(), action: 'shutdown' })}\n`)
    setTimeout(() => {
      if (aiSidecar && !aiSidecar.killed) aiSidecar.kill()
    }, 1000).unref()
  }
})
