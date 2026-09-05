import assert from 'node:assert/strict'
// C2-g g5：per-preset 守卫已移除；此处仅为 mock 工具面提供名字集合。
const MOYU_REQUIRED_TOOLS = ['image_convert', 'pdf_process', 'screenshot_capture']

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))
const plugin = await import('../packages/dsh-plugin-screenshot/src/index.mjs')

let tool
let sessionCreated
const effects = []

plugin.apply({
  tools: {
    register(value) { tool = value; return () => {} },
    schemas() { return MOYU_REQUIRED_TOOLS.map((name) => ({ name })) }
  },
  on(event, handler) { if (event === 'session/created') sessionCreated = handler },
  webServer: { register() { return () => {} } },
  effect(run) { effects.push(run()) }
})

assert.equal(tool.name, 'screenshot_capture')
assert.deepEqual(tool.parameters.properties.operation.enum, ['submit', 'status', 'cancel'])
assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ['job_id', 'operation'])
assert.deepEqual(tool.parameters.required, ['operation'])
assert.equal(JSON.stringify(tool.parameters).includes('pin'), false)
// C2-g g5：session/created per-preset 守卫已移除（工具面完整性由 host-ready 全局审计接管）。

// 模型路径（Tool.execute）异步契约：submit 立即返回 jobId 与初始状态，
// 模型通过 status 轮询终态并支持 cancel（§13.4）。
{
  const calls = []
  globalThis.__moyuDesktop = {
    async call(method, payload) {
      calls.push({ method, payload })
      if (method === 'desktop.requestScreenCapture') {
        return { canceled: false, file: { fileId: 'screen-file', name: 'screen.png' }, width: 640, height: 360, backend: 'fake' }
      }
      if (method === 'desktop.selectScreenshotRegion') {
        assert.equal(payload.capture.file.fileId, 'screen-file')
        return { canceled: false, file: { fileId: 'crop-file', name: 'crop.png' }, width: 320, height: 180 }
      }
      throw new Error(`unexpected desktop method: ${method}`)
    }
  }
  const submitted = await tool.execute({ operation: 'submit' }, {})
  assert.equal(submitted.status, 'awaiting_consent')
  assert.equal(typeof submitted.jobId, 'string')
  assert.equal('fileId' in submitted, false)
  assert.equal('path' in submitted, false)

  // 轮询直至终态
  let status
  for (let i = 0; i < 20; i++) {
    await wait(20)
    status = await tool.execute({ operation: 'status', job_id: submitted.jobId }, {})
    if (status.status === 'completed') break
  }
  assert.equal(status.status, 'completed')
  assert.equal(status.resultId, 'crop-file')
  assert.equal(status.width, 320)
  assert.equal(status.height, 180)
  assert.equal(status.backend, 'fake')
  assert.equal('fileId' in status, false)
  assert.equal('path' in status, false)
  assert.equal('pinId' in status, false)
  assert.equal('pin' in status, false)
  assert.deepEqual(calls.map((call) => call.method), ['desktop.requestScreenCapture', 'desktop.selectScreenshotRegion'])
}

{
  globalThis.__moyuDesktop = {
    async call(method) {
      assert.equal(method, 'desktop.requestScreenCapture')
      return { canceled: true, reason: 'cancelled_by_consent' }
    }
  }
  const submitted = await tool.execute({ operation: 'submit' }, {})
  assert.equal(submitted.status, 'awaiting_consent')
  let status
  for (let i = 0; i < 20; i++) {
    await wait(20)
    status = await tool.execute({ operation: 'status', job_id: submitted.jobId }, {})
    if (status.status === 'cancelled') break
  }
  assert.equal(status.status, 'cancelled')
  assert.equal(status.reason, 'cancelled_by_consent')
  assert.equal('error' in status, false)
}

{
  globalThis.__moyuDesktop = {
    async call(method) {
      if (method === 'desktop.requestScreenCapture') return { canceled: false, file: { fileId: 'screen', name: 'screen.png' }, width: 100, height: 60 }
      if (method === 'desktop.selectScreenshotRegion') return { canceled: true, reason: 'cancelled_by_user' }
      throw new Error(`unexpected desktop method: ${method}`)
    }
  }
  const submitted = await tool.execute({ operation: 'submit' }, {})
  let status
  for (let i = 0; i < 20; i++) {
    await wait(20)
    status = await tool.execute({ operation: 'status', job_id: submitted.jobId }, {})
    if (status.status === 'cancelled') break
  }
  assert.equal(status.status, 'cancelled')
  assert.equal(status.reason, 'cancelled_by_user')
  assert.equal('error' in status, false)
}

// 回归（§13.2）：模型路径（Tool.execute）绝不得走免确认的 desktop.captureScreen——
// 那是无确认的人工按钮路径专用，模型调用必须由 requestScreenCapture 先弹确认。
{
  const seen = []
  globalThis.__moyuDesktop = {
    async call(method) {
      seen.push(method)
      if (method === 'desktop.captureScreen') throw new Error('REGRESSION: Tool 路径调用了免确认的 captureScreen')
      if (method === 'desktop.requestScreenCapture') return { canceled: false, file: { fileId: 'r-s', name: 's.png' }, width: 10, height: 10 }
      if (method === 'desktop.selectScreenshotRegion') return { canceled: false, file: { fileId: 'r-c', name: 'c.png' }, width: 10, height: 10 }
      throw new Error(`unexpected desktop method: ${method}`)
    }
  }
  const submitted = await tool.execute({ operation: 'submit' }, {})
  let status
  for (let i = 0; i < 20; i++) {
    await wait(20)
    status = await tool.execute({ operation: 'status', job_id: submitted.jobId }, {})
    if (status.status === 'completed') break
  }
  assert.equal(status.status, 'completed')
  assert.equal(seen.includes('desktop.captureScreen'), false, 'Tool 路径不得调用免确认的 captureScreen')
}

{
  let release
  globalThis.__moyuDesktop = {
    async call(method) {
      if (method === 'desktop.requestScreenCapture') {
        return new Promise((resolve) => { release = resolve })
      }
      throw new Error(`unexpected desktop method: ${method}`)
    }
  }
  // 先发起一个任务，在确认期间发起第二个应返回 busy
  const first = await tool.execute({ operation: 'submit' }, {})
  assert.equal(first.status, 'awaiting_consent')
  const second = await tool.execute({ operation: 'submit' }, {})
  assert.equal(second.status, 'busy')
  assert.equal(second.activeJobId, first.jobId)
  release({ canceled: true, reason: 'cancelled_by_consent' })
}

await assert.rejects(() => tool.execute({ operation: 'status' }, {}), /job_id/)
await assert.rejects(() => tool.execute({ operation: 'bogus' }, {}), /operation/)

for (const dispose of effects) dispose()
delete globalThis.__moyuDesktop

console.log('screenshot_capture Tool：极简 schema、异步 submit/status/cancel 契约、busy 与无 pin 暴露通过')
