import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { getDocument, ImageKind, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas'
import sharp from 'sharp'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { randomUUID } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { assertMoyuToolSurface } from '@moyu/dsh-profile'

export const name = 'moyu-pdf'
export const inject = ['webServer', 'tools']
const JOB_TIMEOUT_MS = 120_000
const JOB_RETENTION_MS = 10 * 60_000
const OPERATIONS = [
  'merge', 'rotate', 'extract_pages', 'split_pages', 'insert_pages', 'page_numbers',
  'encrypt', 'decrypt', 'watermark_text', 'watermark_image', 'images_to_pdf', 'extract_text', 'extract_images',
  'render_pages',
]

globalThis.DOMMatrix ||= DOMMatrix
globalThis.ImageData ||= ImageData
globalThis.Path2D ||= Path2D

function desktop() {
  if (!globalThis.__moyuDesktop) throw new Error('Moyu 桌面桥尚未就绪')
  return globalThis.__moyuDesktop
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} 必须是非空字符串`)
  return value
}

function requireFileIds(value, operation) {
  if (!Array.isArray(value) || !value.length || value.some((id) => typeof id !== 'string' || !id)) {
    throw new Error('input_file_ids 必须是非空文件令牌数组')
  }
  if (value.length > 64) throw new Error('一次最多处理 64 个 PDF')
  if (operation === 'merge' && value.length < 2) throw new Error('合并至少需要 2 个 PDF')
  if (operation === 'insert_pages' && value.length !== 2) throw new Error('插入页面需要依次选择原 PDF 和待插入 PDF')
  if (['watermark_text', 'watermark_image', 'images_to_pdf'].includes(operation) && value.length > 64) {
    throw new Error('一次最多处理 64 个文件')
  }
  if (!['merge', 'insert_pages', 'watermark_text', 'watermark_image', 'images_to_pdf'].includes(operation) && value.length !== 1) {
    throw new Error('该操作只允许选择 1 个 PDF')
  }
  return value
}

function safeOutputName(value) {
  const name = requireString(value, 'outputName')
  if (basename(name) !== name || /[\\/\0]/.test(name)) throw new Error('输出文件名无效')
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`
}

function safeResultName(value) {
  const name = requireString(value, '结果文件名')
  if (basename(name) !== name || /[\\/\0]/.test(name) || !/\.(?:pdf|png|jpe?g|txt)$/i.test(name)) {
    throw new Error('结果文件名无效')
  }
  return name
}

function publicError(error) {
  if (error?.code === 'TASK_CANCELLED' || error?.name === 'AbortError') return 'PDF 处理已取消'
  return String(error?.message || error || 'PDF 处理失败')
    .replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i, '')
    .replace(/(?:password|口令)\s*[=:]\s*\S+/gi, '口令=[已隐藏]')
    .replace(/(?:file:\/\/)?\/?(?:Users|private|tmp)\/[^\s)]+/g, '[内部路径]')
    .slice(0, 240)
}

function parsePageRange(value, pageCount) {
  const pages = []
  String(value || '').split(',').map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      const step = start <= end ? 1 : -1
      for (let page = start; page !== end + step; page += step) pages.push(page)
    } else if (/^\d+$/.test(part)) pages.push(Number(part))
    else throw new Error('页码格式无效，请使用如 1-3,5')
  })
  const unique = [...new Set(pages)]
  if (!unique.length || unique.some((page) => page < 1 || page > pageCount)) {
    throw new Error(`页码必须在 1–${pageCount} 之间`)
  }
  return unique.map((page) => page - 1)
}

function clamp(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])
}

function watermarkApplies(pageIndex, scope) {
  const page = pageIndex + 1
  return scope === 'all' || (scope === 'odd' && page % 2 === 1) || (scope === 'even' && page % 2 === 0)
}

function watermarkPlacements(pageWidth, pageHeight, markWidth, markHeight, options) {
  const count = Math.round(clamp(options.density, 1, 12, 1))
  const columns = count >= 8 ? 3 : count >= 3 ? 2 : 1
  const rows = Math.ceil(count / columns)
  const marginX = Math.max(markWidth / 2 + 12, pageWidth * 0.08)
  const marginY = Math.max(markHeight / 2 + 12, pageHeight * 0.08)
  const usableWidth = Math.max(0, pageWidth - marginX * 2)
  const usableHeight = Math.max(0, pageHeight - marginY * 2)
  const anchorX = options.horizontal === 'left' ? marginX : options.horizontal === 'right' ? pageWidth - marginX : pageWidth / 2
  const anchorY = options.vertical === 'top' ? pageHeight - marginY : options.vertical === 'bottom' ? marginY : pageHeight / 2
  const startX = columns > 1 ? marginX : anchorX
  const startY = rows > 1 ? marginY : anchorY
  return Array.from({ length: count }, (_, index) => ({
    x: (columns > 1 ? startX + (usableWidth * (index % columns)) / (columns - 1) : anchorX) + clamp(options.offset_x, -10000, 10000, 0),
    y: (rows > 1 ? startY + (usableHeight * Math.floor(index / columns)) / (rows - 1) : anchorY) + clamp(options.offset_y, -10000, 10000, 0),
  }))
}

async function watermarkPng(operation, options) {
  if (operation === 'watermark_image') {
    const path = requireString(options.watermark_path, 'watermark_path')
    const data = await sharp(path).rotate().png().toBuffer()
    const metadata = await sharp(data).metadata()
    return { data, width: metadata.width, height: metadata.height }
  }
  const text = requireString(String(options.text || '').trim(), '水印文字')
  const fontSize = Math.round(clamp(options.font_size, 8, 240, 42))
  const width = Math.min(2400, Math.max(80, Math.ceil(Buffer.byteLength(text, 'utf8') * fontSize * 0.62 + 40)))
  const height = Math.ceil(fontSize * 1.6)
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${fontSize}" fill="#5266d7">${escapeXml(text)}</text></svg>`
  return { data: await sharp(Buffer.from(svg)).png().toBuffer(), width, height }
}

function getPageObject(page, objectId) {
  return new Promise((resolve) => page.objs.get(objectId, resolve))
}

async function pdfImageToPng(image) {
  const width = Number(image?.width)
  const height = Number(image?.height)
  const data = image?.data
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || !ArrayBuffer.isView(data)) {
    throw new Error('PDF 图片像素格式不受支持')
  }
  if (image.kind === ImageKind.RGBA_32BPP) {
    return await sharp(Buffer.from(data.buffer, data.byteOffset, width * height * 4), { raw: { width, height, channels: 4 } }).png().toBuffer()
  }
  if (image.kind === ImageKind.RGB_24BPP) {
    return await sharp(Buffer.from(data.buffer, data.byteOffset, width * height * 3), { raw: { width, height, channels: 3 } }).png().toBuffer()
  }
  if (image.kind === ImageKind.GRAYSCALE_1BPP) {
    const pixels = Buffer.alloc(width * height)
    const rowBytes = Math.ceil(width / 8)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) pixels[y * width + x] = data[y * rowBytes + Math.floor(x / 8)] & (128 >> (x % 8)) ? 255 : 0
    }
    return await sharp(pixels, { raw: { width, height, channels: 1 } }).png().toBuffer()
  }
  throw new Error('PDF 图片颜色格式不受支持')
}

async function extractPdfContent(path, operation, signal, progress) {
  const task = getDocument({ data: new Uint8Array(await readFile(path)), useSystemFonts: true })
  const document = await task.promise
  const outputs = []
  try {
    if (operation === 'extract_text') {
      if (document.numPages > 500) throw new Error('文字提取最多支持 500 页')
      const pages = []
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        checkCancelled(signal)
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        const text = content.items.map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`).join('').trim()
        pages.push(`--- 第 ${pageNumber} 页 ---\n${text}`)
        page.cleanup()
        progress({ ratio: pageNumber / document.numPages })
      }
      const text = pages.join('\n\n').trim()
      if (!text.replace(/--- 第 \d+ 页 ---/g, '').trim()) throw new Error('未检测到内嵌文字；扫描件不含文本，本功能不做 OCR')
      outputs.push({ name: `${basename(path, '.pdf')}-text.txt`, data: Buffer.from(text), pageCount: document.numPages })
    } else {
      if (document.numPages > 500) throw new Error('提取图片最多支持 500 页')
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        checkCancelled(signal)
        const page = await document.getPage(pageNumber)
        const operators = await page.getOperatorList()
        const seen = new Set()
        let imageNumber = 0
        for (let index = 0; index < operators.fnArray.length && outputs.length < 500; index += 1) {
          const operationCode = operators.fnArray[index]
          const args = operators.argsArray[index]
          let image
          if (operationCode === OPS.paintImageXObject || operationCode === OPS.paintImageXObjectRepeat) {
            const objectId = args?.[0]
            if (!objectId || seen.has(objectId)) continue
            seen.add(objectId)
            image = await getPageObject(page, objectId)
          } else if (operationCode === OPS.paintInlineImageXObject) image = args?.[0]
          else continue
          try {
            const data = await pdfImageToPng(image)
            imageNumber += 1
            outputs.push({
              name: `${basename(path, '.pdf')}-page-${String(pageNumber).padStart(3, '0')}-image-${String(imageNumber).padStart(3, '0')}.png`,
              data,
              pageCount: 1,
            })
          } catch {}
        }
        page.cleanup()
        progress({ ratio: pageNumber / document.numPages })
      }
      if (!outputs.length) throw new Error('未检测到可导出的内嵌位图')
    }
    return { outputs, pageCount: document.numPages }
  } finally {
    await document.destroy()
  }
}

async function renderPdfPages(path, options, signal, progress) {
  const format = options.format === 'jpeg' || options.format === 'jpg' ? 'jpeg' : options.format === 'png' || !options.format ? 'png' : null
  if (!format) throw new Error('整页转图格式只支持 png 或 jpeg')
  const scale = clamp(options.scale, 0.25, 4, 2)
  const quality = Math.round(clamp(options.quality, 1, 100, 92))
  const task = getDocument({ data: new Uint8Array(await readFile(path)), useSystemFonts: true })
  const document = await task.promise
  const outputs = []
  try {
    if (document.numPages > 500) throw new Error('整页转图最多支持 500 页')
    const pageIndices = options.pages ? parsePageRange(options.pages, document.numPages) : Array.from({ length: document.numPages }, (_, index) => index)
    for (const [index, pageIndex] of pageIndices.entries()) {
      checkCancelled(signal)
      const page = await document.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale })
      const width = Math.ceil(viewport.width)
      const height = Math.ceil(viewport.height)
      if (width * height > 80_000_000) throw new Error(`第 ${pageIndex + 1} 页尺寸超过 8000 万像素，请降低缩放倍数`)
      const canvas = createCanvas(width, height)
      const context = canvas.getContext('2d')
      const renderTask = page.render({ canvasContext: context, viewport })
      const onAbort = () => renderTask.cancel()
      signal.addEventListener('abort', onAbort, { once: true })
      try { await renderTask.promise }
      catch (error) {
        if (signal.aborted || error?.name === 'RenderingCancelledException') throw Object.assign(new Error('TASK_CANCELLED'), { code: 'TASK_CANCELLED' })
        throw error
      } finally {
        signal.removeEventListener('abort', onAbort)
      }
      const data = await canvas.encode(format === 'png' ? 'png' : 'jpeg', format === 'jpeg' ? quality : undefined)
      outputs.push({
        name: `${basename(path, '.pdf')}-page-${String(pageIndex + 1).padStart(3, '0')}.${format === 'png' ? 'png' : 'jpg'}`,
        data,
        pageCount: 1,
      })
      page.cleanup()
      progress({ ratio: (index + 1) / pageIndices.length })
    }
    return { outputs, pageCount: pageIndices.length }
  } finally {
    await document.destroy()
  }
}

function checkCancelled(signal) {
  if (signal.aborted) throw Object.assign(new Error('TASK_CANCELLED'), { code: 'TASK_CANCELLED' })
}

function validatePassword(value, label, { allowEmpty = false } = {}) {
  const password = typeof value === 'string' ? value : ''
  const length = Buffer.byteLength(password, 'utf8')
  if (!allowEmpty && length < 4) throw new Error(`${label}至少需要 4 个 UTF-8 字节`)
  if (length > 127) throw new Error(`${label}不能超过 127 个 UTF-8 字节`)
  return password
}

async function runQpdf(input, args, signal) {
  checkCancelled(signal)
  const worker = new Worker(new URL('./qpdf-node-worker.mjs', import.meta.url), {
    workerData: {
      qpdfUrl: import.meta.resolve('qpdf-run/qpdf.js'),
      wasmUrl: import.meta.resolve('qpdf-run/qpdf.wasm'),
    },
  })
  return await new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      void worker.terminate()
      callback(value)
    }
    const onAbort = () => finish(reject, Object.assign(new Error('TASK_CANCELLED'), { code: 'TASK_CANCELLED' }))
    signal.addEventListener('abort', onAbort, { once: true })
    worker.once('error', (error) => finish(reject, error))
    worker.once('message', (message) => {
      if (message.ok) finish(resolve, new Uint8Array(message.output))
      else finish(reject, Object.assign(new Error(message.message || 'QPDF 处理失败'), { code: message.code }))
    })
    const bytes = new Uint8Array(input)
    worker.postMessage({ input: bytes, args }, [bytes.buffer])
  })
}

async function loadPdf(path) {
  try { return await PDFDocument.load(await readFile(path)) }
  catch { throw new Error(`${basename(path)} 无法读取；加密或损坏的 PDF 暂不支持此操作`) }
}

async function processPdf(paths, operation, options, signal, progress) {
  checkCancelled(signal)
  let output
  if (operation === 'extract_text' || operation === 'extract_images') {
    return await extractPdfContent(paths[0], operation, signal, progress)
  } else if (operation === 'render_pages') {
    return await renderPdfPages(paths[0], options, signal, progress)
  } else if (operation === 'images_to_pdf') {
    output = await PDFDocument.create()
    for (const [index, path] of paths.entries()) {
      checkCancelled(signal)
      const pipeline = sharp(path).rotate().png()
      const data = await pipeline.toBuffer()
      const metadata = await sharp(data).metadata()
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > 80_000_000) {
        throw new Error(`${basename(path)} 尺寸无效或超过 8000 万像素`)
      }
      const image = await output.embedPng(data)
      const scale = Math.min(1, 14400 / metadata.width, 14400 / metadata.height)
      const width = metadata.width * scale
      const height = metadata.height * scale
      const page = output.addPage([width, height])
      page.drawImage(image, { x: 0, y: 0, width, height })
      progress({ ratio: (index + 1) / paths.length })
    }
  } else if (operation === 'watermark_text' || operation === 'watermark_image') {
    const mark = await watermarkPng(operation, options)
    const outputs = []
    for (const [fileIndex, path] of paths.entries()) {
      checkCancelled(signal)
      const source = await loadPdf(path)
      const embedded = await source.embedPng(mark.data)
      source.getPages().forEach((page, pageIndex) => {
        if (!watermarkApplies(pageIndex, options.pages || 'all')) return
        const pageSize = page.getSize()
        const scale = Math.min(pageSize.width * (operation === 'watermark_text' ? 0.28 : 0.22) / mark.width, pageSize.height * 0.11 / mark.height, 1)
        const width = mark.width * scale
        const height = mark.height * scale
        const rotation = clamp(options.rotation, -180, 180, 0)
        const radians = rotation * Math.PI / 180
        for (const center of watermarkPlacements(pageSize.width, pageSize.height, width, height, options)) {
          page.drawImage(embedded, {
            x: center.x - (width * Math.cos(radians) - height * Math.sin(radians)) / 2,
            y: center.y - (width * Math.sin(radians) + height * Math.cos(radians)) / 2,
            width,
            height,
            opacity: clamp(options.opacity, 0.05, 1, 0.28),
            rotate: degrees(rotation),
          })
        }
      })
      outputs.push({ data: await source.save(), pageCount: source.getPageCount(), name: `${basename(path, '.pdf')}-watermarked.pdf` })
      progress({ ratio: (fileIndex + 1) / paths.length })
    }
    return { outputs, pageCount: outputs.reduce((sum, item) => sum + item.pageCount, 0) }
  } else if (operation === 'encrypt' || operation === 'decrypt') {
    const input = new Uint8Array(await readFile(paths[0]))
    const password = validatePassword(options.password, operation === 'encrypt' ? '打开口令' : 'PDF 口令', { allowEmpty: operation === 'decrypt' })
    if (operation === 'decrypt' && !password) throw new Error('请输入 PDF 口令')
    const args = operation === 'encrypt'
      ? ['--encrypt', password, `${randomUUID()}-${randomUUID()}`, '256', '--', 'input.pdf', 'output.pdf']
      : [`--password=${password}`, '--decrypt', 'input.pdf', 'output.pdf']
    let pageCount
    if (operation === 'encrypt') pageCount = (await loadPdf(paths[0])).getPageCount()
    const data = await runQpdf(input, args, signal)
    progress({ ratio: 1 })
    if (operation === 'decrypt') pageCount = (await PDFDocument.load(data)).getPageCount()
    return { data, pageCount }
  } else if (operation === 'merge') {
    output = await PDFDocument.create()
    for (const [index, path] of paths.entries()) {
      checkCancelled(signal)
      const source = await loadPdf(path)
      const pages = await output.copyPages(source, source.getPageIndices())
      pages.forEach((page) => output.addPage(page))
      progress({ ratio: (index + 1) / paths.length })
    }
  } else if (operation === 'insert_pages') {
    const base = await loadPdf(paths[0])
    const inserted = await loadPdf(paths[1])
    const afterPage = Number(options.after_page ?? base.getPageCount())
    if (!Number.isInteger(afterPage) || afterPage < 0 || afterPage > base.getPageCount()) {
      throw new Error(`插入位置必须是 0–${base.getPageCount()} 的整数`)
    }
    output = await PDFDocument.create()
    const before = await output.copyPages(base, base.getPageIndices().slice(0, afterPage))
    const middle = await output.copyPages(inserted, inserted.getPageIndices())
    const after = await output.copyPages(base, base.getPageIndices().slice(afterPage))
    ;[...before, ...middle, ...after].forEach((page) => output.addPage(page))
    progress({ ratio: 1 })
  } else {
    const source = await loadPdf(paths[0])
    if (operation === 'rotate') {
      const rotation = Number(options.rotation ?? 90)
      if (![90, 180, 270].includes(rotation)) throw new Error('旋转角度只支持 90、180、270')
      source.getPages().forEach((page) => page.setRotation(degrees((page.getRotation().angle + rotation) % 360)))
      output = source
    } else if (operation === 'extract_pages') {
      const indices = parsePageRange(options.pages, source.getPageCount())
      output = await PDFDocument.create()
      const pages = await output.copyPages(source, indices)
      pages.forEach((page) => output.addPage(page))
    } else if (operation === 'split_pages') {
      const outputs = []
      for (const [index] of source.getPages().entries()) {
        checkCancelled(signal)
        const document = await PDFDocument.create()
        const [page] = await document.copyPages(source, [index])
        document.addPage(page)
        outputs.push({ data: await document.save(), pageCount: 1, pageNumber: index + 1 })
        progress({ ratio: (index + 1) / source.getPageCount() })
      }
      return { outputs, pageCount: source.getPageCount() }
    } else if (operation === 'page_numbers') {
      const start = Number(options.start ?? 1)
      const position = options.position || 'footer'
      if (!Number.isInteger(start) || start < 0 || start > 99999) throw new Error('起始页码必须是 0–99999 的整数')
      if (!['header', 'footer'].includes(position)) throw new Error('页码位置无效')
      const font = await source.embedFont(StandardFonts.Helvetica)
      source.getPages().forEach((page, index) => {
        const label = `${start + index} / ${start + source.getPageCount() - 1}`
        const size = 10
        const width = font.widthOfTextAtSize(label, size)
        const pageSize = page.getSize()
        page.drawText(label, {
          x: Math.max(16, (pageSize.width - width) / 2),
          y: position === 'header' ? pageSize.height - 20 : 12,
          size, font, color: rgb(0.32, 0.34, 0.42), opacity: 0.82
        })
      })
      output = source
    } else throw new Error('不支持的 PDF 操作')
    progress({ ratio: 1 })
  }
  checkCancelled(signal)
  return { data: await output.save(), pageCount: output.getPageCount() }
}

export function apply(ctx) {
  const jobs = new Map()

  const requiredJob = (id) => {
    const job = jobs.get(requireString(id, 'job_id'))
    if (!job) throw new Error('PDF 任务不存在或已失效')
    return job
  }

  const operate = async (args) => {
    if (args.operation === 'status') {
      const job = requiredJob(args.job_id)
      return { jobId: job.id, status: job.status, progress: job.progress, ...job.result, ...(job.error ? { error: job.error } : {}) }
    }
    if (args.operation === 'cancel') {
      const job = requiredJob(args.job_id)
      if (job.status === 'running') job.controller.abort(new Error('TASK_CANCELLED'))
      return { jobId: job.id, status: job.status === 'running' ? 'cancelling' : job.status, progress: job.progress }
    }
    const pdfOperation = requireString(args.pdf_operation, 'pdf_operation')
    if (!OPERATIONS.includes(pdfOperation)) throw new Error('不支持的 PDF 操作')
    const inputFileIds = requireFileIds(args.input_file_ids, pdfOperation)
    const id = randomUUID()
    const controller = new AbortController()
    const job = { id, status: 'running', progress: 0, controller }
    jobs.set(id, job)
    job.timeout = setTimeout(() => controller.abort(new Error('PDF 处理超时')), JOB_TIMEOUT_MS)
    job.timeout.unref?.()
    void (async () => {
      try {
        const prepared = await desktop().call('desktop.prepareResult', { resultId: id, kind: 'pdf' })
        const directory = await desktop().call('desktop.resolveFile', { fileId: prepared.directory.fileId })
        job.resultDirectoryPath = directory.path
        const paths = []
        for (const fileId of inputFileIds) paths.push((await desktop().call('desktop.resolveFile', { fileId })).path)
        const options = { ...(args.options || {}) }
        if (pdfOperation === 'watermark_image') {
          options.watermark_path = (await desktop().call('desktop.resolveFile', {
            fileId: requireString(options.watermark_file_id, 'watermark_file_id'),
          })).path
        }
        const outputName = safeOutputName(args.output_name || `${pdfOperation}.pdf`)
        const result = await processPdf(paths, pdfOperation, options, controller.signal, ({ ratio }) => { job.progress = ratio })
        const files = []
        if (result.outputs) {
          const stem = outputName.replace(/\.pdf$/i, '')
          const digits = String(result.outputs.length).length
          for (const [index, item] of result.outputs.entries()) {
            const name = item.name
              ? safeResultName(item.name)
              : `${stem}-page-${String(item.pageNumber || index + 1).padStart(digits, '0')}.pdf`
            await writeFile(join(directory.path, name), item.data)
            const registered = await desktop().call('desktop.registerResult', { directoryFileId: prepared.directory.fileId, name })
            files.push({ fileId: registered.file.fileId, name })
          }
        } else {
          await writeFile(join(directory.path, outputName), result.data)
          const registered = await desktop().call('desktop.registerResult', { directoryFileId: prepared.directory.fileId, name: outputName })
          files.push({ fileId: registered.file.fileId, name: outputName })
        }
        job.status = 'completed'
        job.progress = 1
        job.files = files
        job.result = { resultId: id, pageCount: result.pageCount, fileCount: files.length, pdfOperation }
      } catch (error) {
        job.status = controller.signal.aborted ? 'cancelled' : 'failed'
        job.error = controller.signal.reason?.message === 'PDF 处理超时' ? 'PDF 处理超时' : publicError(error)
      } finally {
        clearTimeout(job.timeout)
        job.expiry = setTimeout(() => {
          jobs.delete(id)
          if (job.resultDirectoryPath) void rm(job.resultDirectoryPath, { recursive: true, force: true }).catch(() => {})
        }, JOB_RETENTION_MS)
        job.expiry.unref?.()
      }
    })()
    return { jobId: id, status: 'running', progress: 0 }
  }

  const readBody = async (req) => {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      const data = Buffer.from(chunk)
      size += data.length
      if (size > 16_384) throw new Error('请求内容过大')
      chunks.push(data)
    }
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
  }
  const sendJson = (res, status, value) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(value))
  }
  const unregister = [ctx.webServer.register({
    kind: 'exact', path: '/moyu/pdf', handler: async (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
      try {
        const args = await readBody(req)
        if (args.operation === 'pick') {
          const image = args.kind === 'image'
          return sendJson(res, 200, await desktop().call('desktop.pickFiles', {
            multiple: Boolean(args.multiple),
            filters: image
              ? [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff'] }]
              : [{ name: 'PDF', extensions: ['pdf'] }]
          }))
        }
        if (args.operation === 'save' || args.operation === 'show') {
          const job = requiredJob(args.job_id)
          if (job.status !== 'completed' || !job.files?.length) throw new Error('PDF 结果尚未就绪或已失效')
          const value = args.operation === 'save'
            ? job.files.length === 1
              ? await desktop().call('desktop.saveRegisteredFile', job.files[0])
              : await desktop().call('desktop.saveRegisteredFiles', { files: job.files })
            : await desktop().call('desktop.showItem', { fileId: job.files[0].fileId })
          return sendJson(res, 200, value)
        }
        return sendJson(res, 200, await operate(args))
      } catch (error) { return sendJson(res, 400, { error: publicError(error) }) }
    }
  })]

  ctx.tools.register(defineTool({
    name: 'pdf_process',
    description: 'Submit, inspect, or cancel a Moyu PDF job for page operations, watermarking, image-to-PDF, full-page image rendering, encryption, or decryption.',
    parameters: {
      operation: { type: 'string', enum: ['submit', 'status', 'cancel'], required: true },
      job_id: { type: 'string' },
      pdf_operation: { type: 'string', enum: OPERATIONS },
      input_file_ids: { type: 'array', items: { type: 'string' } },
      output_name: { type: 'string' },
      options: { type: 'object', additionalProperties: false, properties: {
        rotation: { type: 'integer' }, pages: { type: 'string' }, after_page: { type: 'integer' }, password: { type: 'string' },
        start: { type: 'integer' }, position: { type: 'string', enum: ['header', 'footer'] },
        text: { type: 'string' }, font_size: { type: 'integer' }, opacity: { type: 'number' }, density: { type: 'integer' },
        horizontal: { type: 'string', enum: ['left', 'center', 'right'] }, vertical: { type: 'string', enum: ['top', 'center', 'bottom'] },
        offset_x: { type: 'number' }, offset_y: { type: 'number' }, watermark_file_id: { type: 'string' },
        format: { type: 'string', enum: ['png', 'jpeg'] }, scale: { type: 'number' }, quality: { type: 'integer' }
      } }
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        jobId: { type: 'string', required: true }, status: { type: 'string', required: true },
        progress: { type: 'number', required: true }, resultId: { type: 'string' },
        pageCount: { type: 'integer' }, fileCount: { type: 'integer' }, pdfOperation: { type: 'string' }, error: { type: 'string' }
      } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }]
    },
    execute: operate
  }))

  ctx.on('session/created', (session) => {
    assertMoyuToolSurface(ctx, session)
  }, { global: true })

  ctx.effect(() => () => {
    for (const job of jobs.values()) {
      clearTimeout(job.timeout)
      clearTimeout(job.expiry)
      if (job.status === 'running') job.controller.abort(new Error('Host 正在退出'))
      if (job.resultDirectoryPath) void rm(job.resultDirectoryPath, { recursive: true, force: true }).catch(() => {})
    }
    jobs.clear()
    unregister.forEach((dispose) => dispose())
  }, 'moyu pdf jobs')
}
