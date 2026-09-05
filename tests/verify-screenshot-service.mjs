import assert from 'node:assert/strict'
import { Readable } from 'node:stream'

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))
const plugin = await import('../packages/dsh-plugin-screenshot/src/index.mjs')

async function poll(service, jobId, expected, attempts = 20) {
  let value
  for (let index = 0; index < attempts; index += 1) {
    value = service.status({ job_id: jobId })
    if (value.status === expected) return value
    await wait(5)
  }
  assert.equal(value.status, expected)
}

{
  const service = plugin.createScreenshotService({
    capture: async () => ({ canceled: true, reason: 'cancelled_by_consent' }),
    select: async () => { throw new Error('select should not run') }
  })
  const started = service.startFromTool()
  const final = await poll(service, started.jobId, 'cancelled')
  assert.equal(final.reason, 'cancelled_by_consent')
  service.dispose()
}

{
  const service = plugin.createScreenshotService({
    capture: async () => ({ file: { fileId: 'screen', name: 'screen.png' }, width: 400, height: 240, backend: 'fake' }),
    select: async ({ capture }) => ({ file: { fileId: 'crop', name: 'crop.png' }, width: capture.width / 2, height: capture.height / 2 })
  })
  const started = service.startFromTool()
  assert.equal(started.status, 'awaiting_consent')
  const final = await poll(service, started.jobId, 'completed')
  assert.equal(final.resultStatus, 'available')
  assert.deepEqual(final.result, { fileId: 'crop', name: 'crop.png', width: 200, height: 120, backend: 'fake' })
  assert.equal('path' in final.result, false)
  service.dispose()
}

{
  const service = plugin.createScreenshotService({
    capture: async () => ({ file: { fileId: 'screen', name: 'screen.png' }, width: 100, height: 100 }),
    select: async () => ({ canceled: true, reason: 'cancelled_by_user' })
  })
  const started = service.startFromTool()
  const final = await poll(service, started.jobId, 'cancelled')
  assert.equal(final.reason, 'cancelled_by_user')
  service.dispose()
}

{
  let releaseCapture
  const service = plugin.createScreenshotService({
    capture: async () => new Promise((resolve) => { releaseCapture = resolve }),
    select: async () => ({ file: { fileId: 'crop', name: 'crop.png' } })
  })
  const first = service.startFromTool()
  const second = service.startFromTool()
  assert.equal(second.status, 'busy')
  assert.equal(second.activeJobId, first.jobId)
  releaseCapture({ canceled: true, reason: 'cancelled_by_consent' })
  await poll(service, first.jobId, 'cancelled')
  service.dispose()
}

{
  let releaseSelection
  const service = plugin.createScreenshotService({
    capture: async () => ({ file: { fileId: 'screen', name: 'screen.png' } }),
    select: async ({ signal }) => new Promise((resolve, reject) => {
      releaseSelection = resolve
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
  })
  const started = service.startFromTool()
  await wait(5)
  const cancelling = service.cancel({ job_id: started.jobId })
  assert.equal(cancelling.status, 'cancelled')
  assert.equal(cancelling.reason, 'cancelled_by_user')
  releaseSelection({ file: { fileId: 'late', name: 'late.png' } })
  const final = service.status({ job_id: started.jobId })
  assert.equal(final.status, 'cancelled')
  service.dispose()
}

{
  let releaseCapture
  const service = plugin.createScreenshotService({
    stageTimeoutMs: 5,
    capture: async () => new Promise((resolve) => { releaseCapture = resolve }),
    select: async () => ({ file: { fileId: 'crop', name: 'crop.png' } })
  })
  const started = service.startFromTool()
  const final = await poll(service, started.jobId, 'cancelled')
  assert.equal(final.reason, 'cancelled_by_consent')
  releaseCapture({ file: { fileId: 'late-screen', name: 'late.png' } })
  assert.equal(service.status({ job_id: started.jobId }).reason, 'cancelled_by_consent')
  service.dispose()
}

{
  const service = plugin.createScreenshotService({
    resultRetentionMs: 5,
    capture: async () => ({ file: { fileId: 'screen', name: 'screen.png' } }),
    select: async () => ({ file: { fileId: 'crop', name: 'crop.png' } })
  })
  const started = service.startFromTool()
  await poll(service, started.jobId, 'completed')
  await wait(15)
  const expired = service.status({ job_id: started.jobId })
  assert.equal(expired.status, 'completed')
  assert.equal(expired.resultStatus, 'expired')
  assert.equal('result' in expired, false)
  service.dispose()
}

{
  const service = plugin.createScreenshotService({
    capture: async () => { throw new Error("Error invoking remote method 'desktop.requestScreenCapture': Error: /Users/clukay/secret.png failed") },
    select: async () => ({ file: { fileId: 'never', name: 'never.png' } })
  })
  const started = service.startFromTool()
  const failed = await poll(service, started.jobId, 'failed')
  assert.doesNotMatch(failed.error, /invoking remote|\/Users\/clukay/)
  service.dispose()
}

{
  const calls = []
  globalThis.__moyuDesktop = {
    async call(method, payload) {
      calls.push({ method, payload })
      if (method === 'desktop.requestScreenCapture') {
        return { canceled: false, file: { fileId: 'screen', name: 'screen.png' }, width: 320, height: 200, backend: 'fake' }
      }
      if (method === 'desktop.selectScreenshotRegion') {
        assert.equal(payload.capture.file.fileId, 'screen')
        return { canceled: false, file: { fileId: 'crop', name: 'crop.png' }, width: 160, height: 100 }
      }
      throw new Error(`unexpected desktop method ${method}`)
    }
  }
  const service = plugin.createScreenshotService()
  const started = service.startFromTool()
  const final = await poll(service, started.jobId, 'completed')
  assert.deepEqual(calls.map((call) => call.method), ['desktop.requestScreenCapture', 'desktop.selectScreenshotRegion'])
  assert.deepEqual(final.result, { fileId: 'crop', name: 'crop.png', width: 160, height: 100, backend: 'fake' })
  service.dispose()
  delete globalThis.__moyuDesktop
}

{
  let route
  const effects = []
  globalThis.__moyuDesktop = {
    async call(method) {
      assert.equal(method, 'desktop.requestScreenCapture')
      return { canceled: true, reason: 'cancelled_by_consent' }
    }
  }
  plugin.apply({
    tools: { register() { return () => {} }, schemas() { return [{ name: 'image_convert' }, { name: 'pdf_process' }, { name: 'screenshot_capture' }] } },
    on() {},
    webServer: { register(value) { route = value; return () => {} } },
    effect(run) { effects.push(run()) }
  })
  const request = Readable.from([Buffer.from(JSON.stringify({ operation: 'start' }))])
  request.method = 'POST'
  let status
  let body = ''
  await route.handler(request, {
    writeHead(value) { status = value },
    end(value = '') { body += value }
  })
  assert.equal(status, 200)
  const started = JSON.parse(body)
  assert.equal(started.status, 'awaiting_consent')
  for (const dispose of effects) dispose()
  delete globalThis.__moyuDesktop
}

console.log('screenshot Service：确认取消、选区取消、busy、cancel、超时、结果过期、错误清洗与路由通过')
