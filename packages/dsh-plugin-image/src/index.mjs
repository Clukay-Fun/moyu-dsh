import sharp from 'sharp'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { basename, join } from 'node:path'

export const name = 'moyu-image'
export const inject = ['webServer', 'tools']
const JOB_TIMEOUT_MS = 120_000
const JOB_RETENTION_MS = 10 * 60_000

function desktop() {
  if (!globalThis.__moyuDesktop) throw new Error('Moyu 桌面桥尚未就绪')
  return globalThis.__moyuDesktop
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} 必须是非空字符串`)
  return value
}

function safeOutputName(value) {
  const name = requireString(value, 'outputName')
  if (basename(name) !== name || /[\\/\0]/.test(name)) throw new Error('输出文件名无效')
  return name
}

function publicError(error) {
  if (error?.code === 'TASK_CANCELLED' || error?.name === 'AbortError') return '图片转换已取消'
  const message = String(error?.message || error || '图片转换失败')
  return message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i, '').slice(0, 240)
}

function requiredJob(jobs, id) {
  const job = jobs.get(requireString(id, 'job_id'))
  if (!job) throw new Error('图片任务不存在或已失效')
  return job
}

function optionalInteger(value, label, minimum, maximum) {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} 必须是 ${minimum}–${maximum} 的整数`)
  }
  return value
}

function outputExtension(action, options, inputPath) {
  const target = String(options.target || '').toLowerCase()
  if (action === 'image-convert') return target === 'jpeg' ? 'jpg' : target
  if (action === 'image-compress') {
    const extension = inputPath.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''
    return extension === 'jpeg' ? 'jpg' : extension
  }
  throw new Error('不支持的图片任务')
}

async function convertImage(inputPath, outputPath, action, options, signal) {
  const target = outputExtension(action, options, inputPath)
  const quality = Math.min(100, Math.max(10, Number(options.quality) || 82))
  const maxWidth = Math.min(12000, Math.max(0, Number(options.maxWidth) || 0))
  let pipeline = sharp(inputPath, { animated: target === 'gif', limitInputPixels: 400_000_000 }).rotate()
  if (maxWidth) pipeline = pipeline.resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true })
  if (target === 'jpg') pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true })
  else if (target === 'png') pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
  else if (target === 'webp') pipeline = pipeline.webp({ quality, effort: 5 })
  else if (target === 'avif') pipeline = pipeline.avif({ quality, effort: 5 })
  else if (target === 'tif' || target === 'tiff') pipeline = pipeline.tiff({ compression: 'lzw', quality })
  else if (target === 'gif') pipeline = pipeline.gif({ effort: 7, colours: Math.max(32, Math.round(quality * 2.56)) })
  else throw new Error('不支持的图片输出格式')
  if (signal.aborted) throw Object.assign(new Error('TASK_CANCELLED'), { code: 'TASK_CANCELLED' })
  try {
    const info = await pipeline.toFile(outputPath)
    if (signal.aborted) throw Object.assign(new Error('TASK_CANCELLED'), { code: 'TASK_CANCELLED' })
    return { width: info.width, height: info.height, format: info.format }
  } catch (error) {
    await rm(outputPath, { force: true }).catch(() => {})
    throw error
  }
}

export function apply(ctx) {
  const services = globalThis.__moyuHostServices
  if (!services) throw new Error('Moyu Host Service 桥尚未就绪')
  const jobs = new Map()
  const inspectService = async (payload) => {
    const input = await desktop().call('desktop.resolveFile', { fileId: requireString(payload.inputFileId, 'inputFileId') })
    const previewDirectory = await desktop().call('desktop.resolveFile', { fileId: requireString(payload.previewDirectoryFileId, 'previewDirectoryFileId') })
    const previewName = safeOutputName(payload.previewName)
    const metadata = await sharp(input.path, { animated: true }).metadata()
    await sharp(input.path, { animated: true })
      .resize({ width: 320, height: 240, fit: 'inside', withoutEnlargement: true })
      .png()
      .toFile(join(previewDirectory.path, previewName))
    return { width: metadata.width || 0, height: metadata.height || 0, previewName }
  }
  const convertService = async (payload, { signal, progress }) => {
    const input = await desktop().call('desktop.resolveFile', { fileId: requireString(payload.inputFileId, 'inputFileId') })
    const outputDirectory = await desktop().call('desktop.resolveFile', { fileId: requireString(payload.outputDirectoryFileId, 'outputDirectoryFileId') })
    const outputName = safeOutputName(payload.outputName)
    progress({ ratio: 0 })
    const metadata = await convertImage(
      input.path, join(outputDirectory.path, outputName), requireString(payload.action, 'action'),
      payload.options || {}, signal
    )
    progress({ ratio: 1 })
    return { ...metadata, outputName }
  }
  const unregister = [
    services.register('image.inspect', inspectService),
    services.register('image.convert', convertService)
  ]

  const operate = async (args) => {
    if (args.operation === 'status') {
      const job = requiredJob(jobs, args.job_id)
      return { jobId: job.id, status: job.status, progress: job.progress, ...job.result, ...(job.error ? { error: job.error } : {}) }
    }
    if (args.operation === 'cancel') {
      const job = requiredJob(jobs, args.job_id)
      if (job.status === 'running') job.controller.abort(new Error('TASK_CANCELLED'))
      return { jobId: job.id, status: job.status === 'running' ? 'cancelling' : job.status, progress: job.progress }
    }
    const inputFileId = requireString(args.input_file_id, 'input_file_id')
    const target = requireString(args.target, 'target')
    const quality = optionalInteger(args.quality, 'quality', 10, 100)
    const maxWidth = optionalInteger(args.max_width, 'max_width', 0, 12000)
    const id = randomUUID()
    const controller = new AbortController()
    const job = { id, status: 'running', progress: 0, controller }
    jobs.set(id, job)
    job.timeout = setTimeout(() => controller.abort(new Error('图片转换超时')), JOB_TIMEOUT_MS)
    job.timeout.unref?.()
    void (async () => {
      try {
        const prepared = await desktop().call('desktop.prepareImageResult', { resultId: id })
        const preparedDirectory = await desktop().call('desktop.resolveFile', { fileId: prepared.directory.fileId })
        job.resultDirectoryPath = preparedDirectory.path
        const outputName = `converted.${target === 'jpeg' ? 'jpg' : target}`
        const metadata = await convertService({
          inputFileId,
          outputDirectoryFileId: prepared.directory.fileId,
          outputName,
          action: 'image-convert',
          options: { target, quality, maxWidth }
        }, { signal: controller.signal, progress: ({ ratio }) => { job.progress = ratio } })
        const registered = await desktop().call('desktop.registerImageResult', {
          directoryFileId: prepared.directory.fileId, name: outputName
        })
        job.progress = 1
        job.status = 'completed'
        job.fileId = registered.file.fileId
        job.outputName = outputName
        job.result = { resultId: id, width: metadata.width, height: metadata.height, format: metadata.format }
      } catch (error) {
        job.status = controller.signal.aborted ? 'cancelled' : 'failed'
        job.error = controller.signal.reason?.message === '图片转换超时' ? '图片转换超时' : publicError(error)
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
      if (size > 4096) throw new Error('请求内容过大')
      chunks.push(data)
    }
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
  }
  const sendJson = (res, status, value) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(value))
  }
  unregister.push(ctx.webServer.register({
    kind: 'exact', path: '/moyu/image', handler: async (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
      try {
        const args = await readBody(req)
        if (args.operation === 'pick') {
          return sendJson(res, 200, await desktop().call('desktop.pickFiles', {
            multiple: false,
            filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tif', 'tiff', 'gif'] }]
          }))
        }
        if (args.operation === 'save' || args.operation === 'show') {
          const job = requiredJob(jobs, args.job_id)
          if (job.status !== 'completed' || !job.fileId) throw new Error('转换结果尚未就绪或已失效')
          const value = args.operation === 'save'
            ? await desktop().call('desktop.saveRegisteredFile', { fileId: job.fileId, name: job.outputName })
            : await desktop().call('desktop.showItem', { fileId: job.fileId })
          return sendJson(res, 200, value)
        }
        return sendJson(res, 200, await operate(args))
      } catch (error) {
        return sendJson(res, 400, { error: publicError(error) })
      }
    }
  }))

  ctx.tools.register(defineTool({
    name: 'image_convert',
    description: 'Submit, inspect, or cancel one Moyu image conversion job. Submit returns a job id; poll status until it returns a result id.',
    parameters: {
      operation: { type: 'string', enum: ['submit', 'status', 'cancel'], required: true },
      job_id: { type: 'string' },
      input_file_id: { type: 'string' },
      target: { type: 'string', enum: ['png', 'jpg', 'webp', 'avif', 'tiff', 'gif'] },
      quality: { type: 'integer' },
      max_width: { type: 'integer' }
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          jobId: { type: 'string', required: true },
          status: { type: 'string', required: true },
          progress: { type: 'number', required: true },
          resultId: { type: 'string' },
          width: { type: 'integer' }, height: { type: 'integer' }, format: { type: 'string' },
          error: { type: 'string' }
        }
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }]
    },
    execute: operate
  }))

  ctx.on('session/created', () => {
    const actual = ctx.tools.schemas().map((schema) => schema.name).sort()
    const expected = ['image_convert', 'pdf_process', 'screenshot_capture']
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`moyu tool whitelist drift: expected ${expected.join(',')}; got ${actual.join(',')}`)
    }
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
  }, 'moyu image host services and jobs')
}
