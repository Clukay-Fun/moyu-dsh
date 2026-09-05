import assert from 'node:assert/strict'
import { mkdtemp, mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import sharp from 'sharp'
// C2-g g5：per-preset 守卫已移除；此处仅为 mock 工具面提供名字集合。
const MOYU_TOOL_WHITELIST = ['ask_user_question', 'image_convert', 'pdf_process', 'screenshot_capture']

const sandbox = await mkdtemp(join(tmpdir(), 'moyu-image-tool-'))
const inputPath = join(sandbox, 'input.png')
await sharp({ create: { width: 320, height: 180, channels: 4, background: '#3578e5' } }).png().toFile(inputPath)

const paths = new Map([['input-ok', inputPath]])
let holdPreparedResult = false
let releasePreparedResult
const desktopActions = []
globalThis.__moyuDesktop = {
  async call(method, payload) {
    if (method === 'desktop.pickFiles') return { canceled: false, files: [{ fileId: 'input-ok', name: 'input.png', size: 123 }] }
    if (method === 'desktop.prepareImageResult') {
      if (holdPreparedResult) await new Promise((resolve) => { releasePreparedResult = resolve })
      const directory = join(sandbox, payload.resultId)
      await mkdir(directory, { recursive: true })
      paths.set(`result-${payload.resultId}`, directory)
      return { directory: { fileId: `result-${payload.resultId}` } }
    }
    if (method === 'desktop.resolveFile') {
      const path = paths.get(payload.fileId)
      if (!path) throw new Error("Error invoking remote method 'desktop.resolveFile': Error: 文件令牌无效或已失效")
      return { path }
    }
    if (method === 'desktop.registerImageResult') {
      const directory = paths.get(payload.directoryFileId)
      if (!directory) throw new Error('文件令牌无效或已失效')
      const fileId = `file-${payload.directoryFileId}`
      paths.set(fileId, join(directory, payload.name))
      return { file: { fileId, name: payload.name } }
    }
    if (method === 'desktop.saveRegisteredFile') {
      desktopActions.push({ method, payload })
      return { canceled: false, file: { fileId: 'saved', name: payload.name } }
    }
    if (method === 'desktop.showItem') {
      desktopActions.push({ method, payload })
      return { shown: true }
    }
    throw new Error(`unexpected desktop method: ${method}`)
  }
}
globalThis.__moyuHostServices = { register() { return () => {} } }

let tool
let sessionCreated
let route
const effects = []
const plugin = await import('../packages/dsh-plugin-image/lib/index.mjs')
plugin.apply({
  tools: { register(value) { tool = value; return () => {} }, schemas() { return [tool, ...MOYU_TOOL_WHITELIST.filter((name) => name !== tool.name).map((name) => ({ name }))] } },
  on(event, handler) { if (event === 'session/created') sessionCreated = handler },
  webServer: { register(value) { route = value; return () => {} } },
  effect(run) { effects.push(run()) }
})
assert.equal(tool.name, 'image_convert')
// C2-g g5：session/created per-preset 守卫已移除（工具面完整性由 host-ready 全局审计接管）。

async function post(payload) {
  const req = Readable.from([Buffer.from(JSON.stringify(payload))])
  req.method = 'POST'
  let status
  let body = ''
  const res = { writeHead(value) { status = value }, end(value = '') { body += value } }
  await route.handler(req, res)
  return { status, value: JSON.parse(body) }
}

const picked = await post({ operation: 'pick' })
assert.equal(picked.status, 200)
assert.equal(picked.value.files[0].fileId, 'input-ok')
assert.equal('path' in picked.value.files[0], false)

const execute = (args) => tool.execute(args, { signal: new AbortController().signal })
await assert.rejects(() => execute({ operation: 'submit', target: 'png' }), /input_file_id/)
await assert.rejects(() => execute({ operation: 'unknown' }), /operation/)

const submitted = await execute({ operation: 'submit', input_file_id: 'input-ok', target: 'webp', quality: 70 })
assert.equal(submitted.status, 'running')
let completed
for (let attempt = 0; attempt < 100; attempt += 1) {
  completed = await execute({ operation: 'status', job_id: submitted.jobId })
  if (completed.status !== 'running') break
  await new Promise((resolve) => setTimeout(resolve, 20))
}
assert.equal(completed.status, 'completed')
assert.equal(completed.resultId, submitted.jobId)
assert.deepEqual([completed.width, completed.height, completed.format], [320, 180, 'webp'])
assert.equal('path' in completed, false)
assert.ok((await stat(join(sandbox, submitted.jobId, 'converted.webp'))).size > 100)
assert.equal((await post({ operation: 'save', job_id: submitted.jobId })).value.canceled, false)
assert.equal((await post({ operation: 'show', job_id: submitted.jobId })).value.shown, true)
assert.equal(desktopActions[0].payload.fileId.startsWith('file-result-'), true)

const failed = await execute({ operation: 'submit', input_file_id: 'missing', target: 'png' })
let failure
for (let attempt = 0; attempt < 20; attempt += 1) {
  failure = await execute({ operation: 'status', job_id: failed.jobId })
  if (failure.status !== 'running') break
  await new Promise((resolve) => setTimeout(resolve, 5))
}
assert.equal(failure.status, 'failed')
assert.equal(failure.error, '文件令牌无效或已失效')
assert.doesNotMatch(failure.error, /invoking remote|desktop\.resolveFile/i)

const cancelled = await execute({ operation: 'submit', input_file_id: 'missing', target: 'png' })
const cancelling = await execute({ operation: 'cancel', job_id: cancelled.jobId })
assert.ok(['cancelling', 'failed', 'cancelled'].includes(cancelling.status))
let cancelledFinal
for (let attempt = 0; attempt < 20; attempt += 1) {
  cancelledFinal = await execute({ operation: 'status', job_id: cancelled.jobId })
  if (!['running', 'cancelling'].includes(cancelledFinal.status)) break
  await new Promise((resolve) => setTimeout(resolve, 5))
}
assert.equal(cancelledFinal.status, 'cancelled')

holdPreparedResult = true
const nativeSetTimeout = globalThis.setTimeout
let fireTimeout
globalThis.setTimeout = (callback, delay, ...rest) => {
  if (delay === 120_000) {
    fireTimeout = callback
    return { unref() {} }
  }
  return nativeSetTimeout(callback, delay, ...rest)
}
const timed = await execute({ operation: 'submit', input_file_id: 'input-ok', target: 'png' })
globalThis.setTimeout = nativeSetTimeout
assert.equal(typeof fireTimeout, 'function')
fireTimeout()
releasePreparedResult()
let timedFinal
for (let attempt = 0; attempt < 20; attempt += 1) {
  timedFinal = await execute({ operation: 'status', job_id: timed.jobId })
  if (timedFinal.status !== 'running') break
  await new Promise((resolve) => setTimeout(resolve, 5))
}
assert.equal(timedFinal.status, 'cancelled')
assert.equal(timedFinal.error, '图片转换超时')

for (const dispose of effects) dispose()
console.log(JSON.stringify({ submitted, completed, failure, cancelling, timedFinal }, null, 2))
console.log('image_convert Tool：参数、提交、状态、resultId、错误清洗、取消与超时通过')
