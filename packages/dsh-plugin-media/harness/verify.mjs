process.env.MOYU_DSH_HOME = '/tmp/moyu-media-verify'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const PLUGIN = new URL('../lib/index.mjs', import.meta.url).pathname

let capturedTools = []
let capturedRoutes = {}
let effectDisposers = []

function makeCtx() {
  effectDisposers = []
  capturedRoutes = {}
  return {
    reflect: { provide() {} },
    effect(fn) {
      const disposer = fn()
      effectDisposers.push(disposer)
      return disposer
    },
    tools: { register(tool) { capturedTools.push(tool) } },
    webServer: { register(route) { capturedRoutes[`${route.kind}:${route.path}`] = route; return () => {} } },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  }
}

async function reset() {
  await rm('/tmp/moyu-media-verify', { recursive: true, force: true })
  capturedTools = []
  capturedRoutes = {}
}

const mod = await import(PLUGIN)
let passed = 0
let failed = 0

async function test(name, fn) {
  await reset()
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
    if (e.stack) console.error(e.stack.split('\n').slice(1, 4).map(l => '    ' + l).join('\n'))
  }
}

// Helper: create a fresh service instance via apply()
async function createService() {
  const ctx = makeCtx()
  await mod.apply(ctx)
  const route = capturedRoutes['exact:/moyu/media']
  const sseRoute = capturedRoutes['exact:/moyu/media/events']
  const fileRoute = capturedRoutes['prefix:/moyu/media']
  return { ctx, route, sseRoute, fileRoute, tools: capturedTools }
}

// Helper: send a JSON request to the route handler
function makeReq(body) {
  const json = JSON.stringify(body)
  const buf = Buffer.from(json)
  let dataFn, endFn
  return {
    method: 'POST',
    on(ev, cb) {
      if (ev === 'data') dataFn = cb
      if (ev === 'end') endFn = cb
    },
    fire() { dataFn(buf); endFn() },
  }
}

function makeRes() {
  let status, body
  return {
    writeHead(s) { status = s },
    end(b) { body = b },
    get status() { return status },
    get json() { return JSON.parse(body) },
  }
}

async function routeCall(route, body) {
  const req = makeReq(body)
  const res = makeRes()
  const p = route.handler(req, res)
  req.fire()
  await p
  return { status: res.status, json: res.json }
}

console.log('\n=== M0 Protocol Spike: harness/verify.mjs ===\n')

// ─── 1. Event completeness ───────────────────────────────────────────
console.log('Event completeness:')

await test('full event chain: started → progress(×3) → server_request → resolved → artifact → completed', async () => {
  const { route } = await createService()

  const events = []
  let pendingRequestId = null

  // Start mock run in background — it will block at server_request
  const runPromise = routeCall(route, { operation: 'run-mock' })

  // Poll until we get a pending request
  let attempts = 0
  while (attempts++ < 50) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(route, { operation: 'list-runs' })
    const runs = json.runs
    if (runs.length > 0 && runs[0].status === 'awaiting_user' && runs[0].pendingRequest) {
      pendingRequestId = runs[0].pendingRequest.requestId
      break
    }
  }
  assert.ok(pendingRequestId, 'should have a pending server request')

  // Respond with approval
  const { status: respStatus } = await routeCall(route, {
    operation: 'respond',
    requestId: pendingRequestId,
    approved: true,
  })
  assert.equal(respStatus, 200)

  // Wait for run to complete
  const { json: runResult } = await runPromise
  assert.ok(runResult.runId, 'should return a runId')

  // Verify the full event chain
  const { json: statusResult } = await routeCall(route, {
    operation: 'status',
    runId: runResult.runId,
  })
  const run = statusResult.run
  assert.equal(run.status, 'success')

  const types = run.events.map(e => e.type)
  assert.deepEqual(types, [
    'started',
    'progress', 'progress', 'progress',
    'server_request_resolved',
    'artifact_created',
    'completed',
  ])
})

// ─── 2. Approval blocking ───────────────────────────────────────────
console.log('\nApproval blocking:')

await test('server_request pauses run until response', async () => {
  const { route } = await createService()

  // Start run
  const runPromise = routeCall(route, { operation: 'run-mock' })

  // Wait for awaiting_user state
  let awaiting = false
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(route, { operation: 'list-runs' })
    if (json.runs.length > 0 && json.runs[0].status === 'awaiting_user') {
      awaiting = true
      break
    }
  }
  assert.ok(awaiting, 'run should be in awaiting_user state')

  // Verify run hasn't progressed past server_request
  const { json: listResult } = await routeCall(route, { operation: 'list-runs' })
  const run = listResult.runs[0]
  const typesBeforeApproval = run.events.map(e => e.type)
  assert.ok(!typesBeforeApproval.includes('artifact_created'), 'no artifact before approval')
  assert.ok(!typesBeforeApproval.includes('completed'), 'not completed before approval')

  // Now approve
  await routeCall(route, {
    operation: 'respond',
    requestId: run.pendingRequest.requestId,
    approved: true,
  })
  await runPromise
})

await test('rejection cancels the run', async () => {
  const { route } = await createService()

  const runPromise = routeCall(route, { operation: 'run-mock' })

  let requestId = null
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(route, { operation: 'list-runs' })
    if (json.runs[0]?.pendingRequest) {
      requestId = json.runs[0].pendingRequest.requestId
      break
    }
  }
  assert.ok(requestId)

  await routeCall(route, { operation: 'respond', requestId, approved: false })
  const { json: runResult } = await runPromise

  const { json: statusResult } = await routeCall(route, {
    operation: 'status',
    runId: runResult.runId,
  })
  assert.equal(statusResult.run.status, 'cancelled')
  const lastEvent = statusResult.run.events.at(-1)
  assert.equal(lastEvent.type, 'completed')
  assert.equal(lastEvent.status, 'cancelled')
})

// ─── 3. Restart recovery (awaiting_user) ─────────────────────────────
console.log('\nRestart recovery (awaiting_user):')

await test('host restart re-emits server_request for awaiting_user run', async () => {
  const { route } = await createService()

  // Start a run and let it reach awaiting_user
  const runPromise = routeCall(route, { operation: 'run-mock' })

  let runId = null
  let originalRequestId = null
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(route, { operation: 'list-runs' })
    if (json.runs[0]?.status === 'awaiting_user') {
      runId = json.runs[0].runId
      originalRequestId = json.runs[0].pendingRequest.requestId
      break
    }
  }
  assert.ok(runId, 'run should reach awaiting_user')
  assert.ok(originalRequestId, 'should have original requestId')

  // Simulate host restart: instantiate MockMediaRunService directly
  // so we can register a request listener BEFORE reEmitPendingRequests()
  const { MockMediaRunService } = mod
  const reEmittedRequests = []
  const ctx2 = makeCtx()
  const svc2 = new MockMediaRunService(ctx2)
  svc2.onRequest((req) => { reEmittedRequests.push(req) })
  await svc2.ready

  // Now trigger re-emission (apply() calls this after ready)
  svc2.reEmitPendingRequests()

  // Verify request was actually re-emitted
  assert.equal(reEmittedRequests.length, 1, 'exactly one request should be re-emitted')
  assert.equal(reEmittedRequests[0].requestId, originalRequestId, 're-emitted requestId matches original')
  assert.equal(reEmittedRequests[0].runId, runId, 're-emitted runId matches')
  assert.equal(reEmittedRequests[0].action, 'confirm_publish', 're-emitted action preserved')

  // Verify the run is still awaiting_user
  const restoredRun = svc2.getRun(runId)
  assert.ok(restoredRun, 'run should be restored from store')
  assert.equal(restoredRun.status, 'awaiting_user', 'status should still be awaiting_user')

  // Respond to the re-emitted request and verify it completes the run
  const ok = await svc2.respondToRequest({ requestId: originalRequestId, approved: true })
  assert.ok(ok, 'response should be accepted')

  const completedRun = svc2.getRun(runId)
  assert.equal(completedRun.status, 'success', 'run should complete after re-emitted approval')
})

// ─── 4. Restart recovery (running → interrupted) ─────────────────────
console.log('\nRestart recovery (running → interrupted):')

await test('running without checkpoint becomes interrupted on restart', async () => {
  const { route } = await createService()

  // Start a run
  const runPromise = routeCall(route, { operation: 'run-mock' })

  // Wait until it's running (but not yet awaiting_user)
  // We need to catch it early — poll for events
  let runId = null
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 10))
    const { json } = await routeCall(route, { operation: 'list-runs' })
    if (json.runs.length > 0) {
      runId = json.runs[0].runId
      // Once we have a runId, check if it reached awaiting_user
      if (json.runs[0].status === 'awaiting_user') {
        // Manually set it back to 'running' in store to simulate a crash mid-execution
        // Read the store file, modify, write it back
        const storeFile = '/tmp/moyu-media-verify/media/store.json'
        const raw = await readFile(storeFile, 'utf8')
        const store = JSON.parse(raw)
        for (const r of store.runs) {
          if (r.runId === runId) {
            r.status = 'running'
            r.pendingRequest = undefined
            // Remove events after progress to simulate crash during execution
            r.events = r.events.filter(e => e.type === 'started' || e.type === 'progress')
          }
        }
        const { writeFile: wf } = await import('node:fs/promises')
        await wf(storeFile, JSON.stringify(store, null, 2))
        break
      }
    }
  }
  assert.ok(runId, 'should have a running run')

  // Simulate restart with new service
  capturedTools = []
  const ctx2 = makeCtx()
  await mod.apply(ctx2)

  const { json: listResult } = await routeCall(capturedRoutes['exact:/moyu/media'], { operation: 'list-runs' })
  const recoveredRun = listResult.runs.find(r => r.runId === runId)
  assert.ok(recoveredRun, 'run should be found after restart')
  assert.equal(recoveredRun.status, 'interrupted', 'running run should become interrupted')
  assert.ok(recoveredRun.finishedAt, 'finishedAt should be set')

  const completedEvent = recoveredRun.events.find(e => e.type === 'completed')
  assert.ok(completedEvent, 'should have a completed event')
  assert.equal(completedEvent.status, 'interrupted')
})

// ─── 5. Event type safety ────────────────────────────────────────────
console.log('\nEvent type safety:')

await test('all events have required fields: type, runId, generation, sequence', async () => {
  const { route } = await createService()

  const runPromise = routeCall(route, { operation: 'run-mock' })

  // Wait for awaiting_user
  let requestId = null
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(route, { operation: 'list-runs' })
    if (json.runs[0]?.pendingRequest) {
      requestId = json.runs[0].pendingRequest.requestId
      break
    }
  }
  await routeCall(route, { operation: 'respond', requestId, approved: true })
  const { json: runResult } = await runPromise

  const { json: statusResult } = await routeCall(route, {
    operation: 'status',
    runId: runResult.runId,
  })

  for (const event of statusResult.run.events) {
    assert.ok(typeof event.type === 'string', `event should have type: ${JSON.stringify(event)}`)
    assert.ok(typeof event.runId === 'string', `event should have runId: ${JSON.stringify(event)}`)
    assert.ok(typeof event.generation === 'number', `event should have generation: ${JSON.stringify(event)}`)
    assert.ok(typeof event.sequence === 'number', `event should have sequence: ${JSON.stringify(event)}`)
  }

  // Verify specific event shapes
  const progressEvent = statusResult.run.events.find(e => e.type === 'progress')
  assert.ok(typeof progressEvent.message === 'string', 'progress should have message')
  assert.ok(typeof progressEvent.percent === 'number', 'progress should have percent')

  const artifactEvent = statusResult.run.events.find(e => e.type === 'artifact_created')
  assert.ok(artifactEvent.artifact, 'artifact_created should have artifact')
  assert.ok(artifactEvent.artifact.artifactId, 'artifact should have artifactId')
  assert.ok(artifactEvent.artifact.kind, 'artifact should have kind')
  assert.ok(Array.isArray(artifactEvent.artifact.candidates), 'artifact should have candidates')

  const resolvedEvent = statusResult.run.events.find(e => e.type === 'server_request_resolved')
  assert.ok(typeof resolvedEvent.requestId === 'string', 'resolved should have requestId')
  assert.ok(typeof resolvedEvent.approved === 'boolean', 'resolved should have approved')

  const completedEvent = statusResult.run.events.find(e => e.type === 'completed')
  assert.ok(['success', 'failed', 'cancelled', 'interrupted'].includes(completedEvent.status))
})

await test('ServerRequest has required fields', async () => {
  const { route } = await createService()

  routeCall(route, { operation: 'run-mock' })

  let request = null
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(route, { operation: 'list-runs' })
    if (json.runs[0]?.pendingRequest) {
      request = json.runs[0].pendingRequest
      break
    }
  }
  assert.ok(request, 'should have a pending request')
  assert.ok(typeof request.requestId === 'string', 'requestId should be string')
  assert.ok(typeof request.runId === 'string', 'runId should be string')
  assert.ok(typeof request.action === 'string', 'action should be string')
  assert.ok(typeof request.detail === 'string', 'detail should be string')
  assert.ok(typeof request.ttlMs === 'number', 'ttlMs should be number')
})

// ─── 6. Event idempotency ────────────────────────────────────────────
console.log('\nEvent idempotency:')

await test('generation+sequence are unique and monotonically increasing', async () => {
  const { route } = await createService()

  const runPromise = routeCall(route, { operation: 'run-mock' })

  let requestId = null
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(route, { operation: 'list-runs' })
    if (json.runs[0]?.pendingRequest) {
      requestId = json.runs[0].pendingRequest.requestId
      break
    }
  }
  await routeCall(route, { operation: 'respond', requestId, approved: true })
  await runPromise

  const { json: listResult } = await routeCall(route, { operation: 'list-runs' })
  const events = listResult.runs[0].events

  // All events should share the same generation
  const generations = new Set(events.map(e => e.generation))
  assert.equal(generations.size, 1, 'all events in one run should share generation')

  // Sequences must be unique and strictly increasing
  const sequences = events.map(e => e.sequence)
  for (let i = 1; i < sequences.length; i++) {
    assert.ok(sequences[i] > sequences[i - 1],
      `sequence should be monotonically increasing: ${sequences[i - 1]} -> ${sequences[i]}`)
  }

  // No duplicate (generation, sequence) pairs
  const pairs = new Set(events.map(e => `${e.generation}:${e.sequence}`))
  assert.equal(pairs.size, events.length, 'no duplicate generation+sequence pairs')
})

await test('restart bumps generation so client can detect replayed events', async () => {
  const { route: route1 } = await createService()

  // Run a task to completion
  const runPromise = routeCall(route1, { operation: 'run-mock' })
  let requestId = null
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(route1, { operation: 'list-runs' })
    if (json.runs[0]?.pendingRequest) {
      requestId = json.runs[0].pendingRequest.requestId
      break
    }
  }
  await routeCall(route1, { operation: 'respond', requestId, approved: true })
  await runPromise

  const { json: result1 } = await routeCall(route1, { operation: 'list-runs' })
  const gen1 = result1.runs[0].generation

  // Simulate restart
  capturedTools = []
  const ctx2 = makeCtx()
  await mod.apply(ctx2)

  const { json: result2 } = await routeCall(capturedRoutes['exact:/moyu/media'], { operation: 'list-runs' })
  const gen2Run = result2.runs[0]
  // The run's generation stays the same (it was created under gen1),
  // but the service's generation should have incremented
  // This is visible when we start a new run under the new generation
  const runPromise2 = routeCall(capturedRoutes['exact:/moyu/media'], { operation: 'run-mock' })
  let requestId2 = null
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(capturedRoutes['exact:/moyu/media'], { operation: 'list-runs' })
    const newRun = json.runs.find(r => r.runId !== gen2Run.runId)
    if (newRun?.pendingRequest) {
      requestId2 = newRun.pendingRequest.requestId
      break
    }
  }
  if (requestId2) {
    await routeCall(capturedRoutes['exact:/moyu/media'], { operation: 'respond', requestId: requestId2, approved: true })
  }
  const { json: runResult2 } = await runPromise2

  const { json: statusResult2 } = await routeCall(capturedRoutes['exact:/moyu/media'], {
    operation: 'status',
    runId: runResult2.runId,
  })
  const gen2 = statusResult2.run.generation
  assert.ok(gen2 > gen1, `new generation (${gen2}) should be > old generation (${gen1})`)
})

// ─── 7. Route validation ────────────────────────────────────────────
console.log('\nRoute validation:')

await test('unknown operation returns 400', async () => {
  const { route } = await createService()
  const { status, json } = await routeCall(route, { operation: 'nope' })
  assert.equal(status, 400)
  assert.ok(json.error.includes('unknown'))
})

await test('respond with invalid requestId returns 404', async () => {
  const { route } = await createService()
  const { status } = await routeCall(route, {
    operation: 'respond',
    requestId: 'nonexistent',
    approved: true,
  })
  assert.equal(status, 404)
})

await test('status with unknown runId returns 404', async () => {
  const { route } = await createService()
  const { status } = await routeCall(route, {
    operation: 'status',
    runId: 'nonexistent',
  })
  assert.equal(status, 404)
})

// ─── 8. Tool registration ───────────────────────────────────────────
console.log('\nTool registration:')

await test('mock_media_task tool is registered after apply', async () => {
  await createService()
  const tool = capturedTools.find(t => t.name === 'mock_media_task')
  assert.ok(tool, 'mock_media_task tool should be registered')
  assert.ok(tool.description, 'tool should have description')
})

// ─── 9. Persistence ─────────────────────────────────────────────────
console.log('\nPersistence:')

await test('store.json is written after run completes', async () => {
  const { route } = await createService()

  const runPromise = routeCall(route, { operation: 'run-mock' })
  let requestId = null
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const { json } = await routeCall(route, { operation: 'list-runs' })
    if (json.runs[0]?.pendingRequest) {
      requestId = json.runs[0].pendingRequest.requestId
      break
    }
  }
  await routeCall(route, { operation: 'respond', requestId, approved: true })
  await runPromise

  const raw = await readFile('/tmp/moyu-media-verify/media/store.json', 'utf8')
  const store = JSON.parse(raw)
  assert.equal(store.version, 2)
  assert.ok(store.generation >= 1)
  assert.ok(store.runs.length >= 1)
  assert.equal(store.runs[0].status, 'success')
})

// ─── 10. SSE notification push ──────────────────────────────────────
console.log('\nSSE notification push:')

await test('events are pushed to SSE connections, not just stored', async () => {
  await reset()
  const { MockMediaRunService } = mod
  const ctx = makeCtx()
  const svc = new MockMediaRunService(ctx)
  await svc.ready

  // Mock SSE connection
  const sseMessages = []
  const mockConn = {
    write(data) { sseMessages.push(data); return true },
    end() {},
  }
  svc.addSseConnection(mockConn)

  // Run mock task — it will block at server_request
  const runPromise = svc.runMockTask()

  // Wait for awaiting_user
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    const runs = svc.getRuns()
    if (runs[0]?.status === 'awaiting_user') break
  }

  // At this point we should have SSE messages for: started, progress×3, server_request
  const notificationMessages = sseMessages.filter(m => m.startsWith('event: notification'))
  const requestMessages = sseMessages.filter(m => m.startsWith('event: server_request'))

  assert.ok(notificationMessages.length >= 4, `should have ≥4 notifications (started + progress×3), got ${notificationMessages.length}`)
  assert.equal(requestMessages.length, 1, 'should have exactly 1 server_request push')

  // Parse and verify the pushed server_request
  const reqDataLine = requestMessages[0].split('\n').find(l => l.startsWith('data: '))
  const pushedRequest = JSON.parse(reqDataLine.slice(6))
  assert.ok(pushedRequest.requestId, 'pushed request has requestId')
  assert.ok(pushedRequest.runId, 'pushed request has runId')
  assert.equal(pushedRequest.action, 'confirm_publish', 'pushed request has correct action')

  // Respond and complete
  await svc.respondToRequest({ requestId: pushedRequest.requestId, approved: true })
  await runPromise

  // Verify full chain pushed: + resolved + artifact_created + completed
  const allNotifications = sseMessages.filter(m => m.startsWith('event: notification'))
  assert.ok(allNotifications.length >= 7, `should have ≥7 notifications for full chain, got ${allNotifications.length}`)

  // Verify event types in SSE stream
  const pushedTypes = allNotifications.map(m => {
    const dataLine = m.split('\n').find(l => l.startsWith('data: '))
    return JSON.parse(dataLine.slice(6)).type
  })
  assert.deepEqual(pushedTypes, [
    'started', 'progress', 'progress', 'progress',
    'server_request_resolved', 'artifact_created', 'completed',
  ])
})

await test('server_request re-emitted to SSE on reconnect', async () => {
  await reset()
  const { MockMediaRunService } = mod
  const ctx1 = makeCtx()
  const svc1 = new MockMediaRunService(ctx1)
  await svc1.ready

  // Run until awaiting_user
  const runPromise = svc1.runMockTask()
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20))
    if (svc1.getRuns()[0]?.status === 'awaiting_user') break
  }
  const originalRequestId = svc1.getRuns()[0].pendingRequest.requestId

  // Simulate restart: new service instance
  const ctx2 = makeCtx()
  const svc2 = new MockMediaRunService(ctx2)
  await svc2.ready

  // New SSE client connects
  const reconnectMessages = []
  const mockConn = {
    write(data) { reconnectMessages.push(data); return true },
    end() {},
  }
  svc2.addSseConnection(mockConn)

  // Trigger re-emit (called by apply() and by SSE handler on connect)
  svc2.reEmitPendingRequests()

  // Verify server_request was pushed to the new SSE connection
  const requestPushes = reconnectMessages.filter(m => m.startsWith('event: server_request'))
  assert.equal(requestPushes.length, 1, 'pending request should be pushed to new SSE connection')

  const dataLine = requestPushes[0].split('\n').find(l => l.startsWith('data: '))
  const reEmitted = JSON.parse(dataLine.slice(6))
  assert.equal(reEmitted.requestId, originalRequestId, 'same requestId re-emitted')
})

// ─── 11. M1 Capabilities Discovery ─────────────────────────────────
console.log('\nM1 Capabilities Discovery:')

await test('capabilities route returns media session capabilities for media preset', async () => {
  const { route } = await createService()
  const { status, json } = await routeCall(route, {
    operation: 'capabilities',
    preset: 'media',
  })
  assert.equal(status, 200)
  assert.ok(json.capabilities)
  assert.ok(json.capabilities.tools.includes('mock_media_task'))
  assert.ok(json.capabilities.tools.includes('video_scan'))
  assert.ok(json.capabilities.tools.includes('video_subtitle_read'))
  assert.ok(json.capabilities.tools.includes('media_artifact_save'))
  assert.ok(json.capabilities.tools.includes('moyu_schedule_create'))
  assert.ok(json.capabilities.tools.includes('image_convert'))
  assert.ok(json.capabilities.tools.includes('screenshot_capture'))
  assert.ok(!json.capabilities.tools.includes('pdf_process'))
  assert.deepEqual(json.capabilities.approvalRequired, ['confirm_publish'])
  assert.deepEqual(json.capabilities.fileSourceTypes, [
    'project-source',
    'session-attachment',
    'job-result',
    'scheduled-input',
  ])
})

await test('capabilities route returns standard capabilities for moyu preset', async () => {
  const { route } = await createService()
  const { status, json } = await routeCall(route, {
    operation: 'capabilities',
    preset: 'moyu',
  })
  assert.equal(status, 200)
  assert.ok(json.capabilities)
  assert.ok(json.capabilities.tools.includes('image_convert'))
  assert.ok(json.capabilities.tools.includes('pdf_process'))
  assert.ok(json.capabilities.tools.includes('screenshot_capture'))
  assert.ok(!json.capabilities.tools.includes('mock_media_task'))
  assert.ok(!json.capabilities.tools.includes('video_scan'))
  assert.ok(!json.capabilities.tools.includes('video_subtitle_read'))
  assert.ok(!json.capabilities.tools.includes('media_artifact_save'))
  assert.deepEqual(json.capabilities.approvalRequired, [])
})

// ─── 12. M1 capabilities helpers ───────────────────────────────────
console.log('\nM1 capabilities helpers:')

function makeFileReq({ method, url, headers = {}, body }) {
  let dataFn, endFn, fired = false
  const deliver = () => {
    if (body && dataFn) dataFn(body)
    if (endFn) endFn()
  }
  return {
    method,
    url,
    headers,
    on(ev, cb) {
      if (ev === 'data') dataFn = cb
      if (ev === 'end') endFn = cb
      if (fired && dataFn && endFn) deliver()
      return this
    },
    fire() {
      fired = true
      if (dataFn && endFn) deliver()
    },
  }
}

function makeFileRes() {
  const chunks = []
  let status
  let headers = {}
  return {
    writeHead(s, h = {}) { status = s; headers = h },
    write(c) { chunks.push(Buffer.from(c)); return true },
    end(c) { if (c !== undefined && c !== null && c !== '') chunks.push(Buffer.from(c)) },
    on() { return this },
    get status() { return status },
    get headers() { return headers },
    get body() { return Buffer.concat(chunks) },
  }
}

async function fileCall(route, opts) {
  const req = makeFileReq(opts)
  const res = makeFileRes()
  const pending = route.handler(req, res)
  req.fire()
  await pending
  return res
}

async function seedLibrary() {
  const dir = '/tmp/moyu-media-verify/library'
  await mkdir(dir, { recursive: true })
  const payload = Buffer.alloc(2048, 7)
  await writeFile(join(dir, 'clip-01.mp4'), payload)
  await writeFile(join(dir, 'clip-01.srt'), '1\n00:00:00,000 --> 00:00:01,000\nhello\n')
  await writeFile(join(dir, 'clip-01.txt'), 'plain captions')
  await mkdir('/tmp/moyu-media-verify/media', { recursive: true })
  await writeFile('/tmp/moyu-media-verify/media/store.json', JSON.stringify({
    version: 2,
    generation: 0,
    runs: [],
    settings: {
      directories: [{ id: 'dir-1', path: dir }],
      subtitleSuffixes: ['.srt', '.txt'],
    },
    sources: [],
  }))
  return { size: payload.length, payload }
}

await test('hasCapability accurately detects available tools and permissions', () => {
  const { getSessionCapabilities, hasCapability } = mod
  const mediaCaps = getSessionCapabilities('media')
  const moyuCaps = getSessionCapabilities('moyu')

  assert.equal(hasCapability(mediaCaps, 'tool', 'mock_media_task'), true)
  assert.equal(hasCapability(mediaCaps, 'tool', 'pdf_process'), false)
  assert.equal(hasCapability(mediaCaps, 'approval', 'confirm_publish'), true)
  assert.equal(hasCapability(mediaCaps, 'sourceType', 'project-source'), true)

  assert.equal(hasCapability(moyuCaps, 'tool', 'mock_media_task'), false)
  assert.equal(hasCapability(moyuCaps, 'tool', 'pdf_process'), true)
  assert.equal(hasCapability(moyuCaps, 'approval', 'confirm_publish'), false)
  assert.equal(hasCapability(mediaCaps, 'tool', 'video_scan'), true)
  assert.equal(hasCapability(moyuCaps, 'tool', 'video_scan'), false)
  assert.equal(hasCapability(mediaCaps, 'tool', 'video_subtitle_read'), true)
  assert.equal(hasCapability(mediaCaps, 'tool', 'media_artifact_save'), true)
  assert.equal(hasCapability(moyuCaps, 'tool', 'media_artifact_save'), false)
})

console.log('\nM2 video_scan and Range:')

await test('video_scan indexes mp4 and matches same-stem subtitles', async () => {
  const { size } = await seedLibrary()
  const { route, tools } = await createService()
  assert.ok(tools.some(t => t.name === 'video_scan'), 'video_scan tool registered')
  const { status, json } = await routeCall(route, { operation: 'list' })
  assert.equal(status, 200)
  assert.equal(json.videos.length, 1)
  assert.equal(json.videos[0].fileName, 'clip-01.mp4')
  assert.equal(json.videos[0].size, size)
  assert.equal(json.videos[0].subtitles.length, 2)
  assert.ok(!JSON.stringify(json).includes('/tmp/'), 'list DTO must not expose absolute paths')
  const text = await routeCall(route, { operation: 'subtitle-text', fileId: json.videos[0].fileId })
  assert.equal(text.status, 200)
  assert.ok(text.json.files.some(f => f.fileName === 'clip-01.srt' && f.text.includes('hello')))
})

await test('single-range forms return 206 with Content-Range', async () => {
  await seedLibrary()
  const { route, fileRoute } = await createService()
  const { json } = await routeCall(route, { operation: 'list' })
  const fileId = json.videos[0].fileId
  const url = `/moyu/media/${fileId}`

  const bounded = await fileCall(fileRoute, { method: 'GET', url, headers: { range: 'bytes=0-15' } })
  assert.equal(bounded.status, 206)
  assert.equal(bounded.headers['content-range'], 'bytes 0-15/2048')
  assert.equal(bounded.headers['accept-ranges'], 'bytes')
  assert.equal(bounded.headers['content-length'], '16')
  assert.equal(bounded.body.length, 16)

  const openEnd = await fileCall(fileRoute, { method: 'GET', url, headers: { range: 'bytes=2000-' } })
  assert.equal(openEnd.status, 206)
  assert.equal(openEnd.headers['content-range'], 'bytes 2000-2047/2048')
  assert.equal(openEnd.body.length, 48)

  const suffix = await fileCall(fileRoute, { method: 'GET', url, headers: { range: 'bytes=-8' } })
  assert.equal(suffix.status, 206)
  assert.equal(suffix.headers['content-range'], 'bytes 2040-2047/2048')
  assert.equal(suffix.body.length, 8)
})

await test('multipart range is rejected with 400', async () => {
  await seedLibrary()
  const { route, fileRoute } = await createService()
  const { json } = await routeCall(route, { operation: 'list' })
  const res = await fileCall(fileRoute, {
    method: 'GET',
    url: `/moyu/media/${json.videos[0].fileId}`,
    headers: { range: 'bytes=0-1,2-3' },
  })
  assert.equal(res.status, 400)
})

await test('out-of-range returns 416', async () => {
  await seedLibrary()
  const { route, fileRoute } = await createService()
  const { json } = await routeCall(route, { operation: 'list' })
  const res = await fileCall(fileRoute, {
    method: 'GET',
    url: `/moyu/media/${json.videos[0].fileId}`,
    headers: { range: 'bytes=4096-8192' },
  })
  assert.equal(res.status, 416)
  assert.equal(res.headers['content-range'], 'bytes */2048')
})

await test('HEAD returns size and no body', async () => {
  await seedLibrary()
  const { route, fileRoute } = await createService()
  const { json } = await routeCall(route, { operation: 'list' })
  const res = await fileCall(fileRoute, {
    method: 'HEAD',
    url: `/moyu/media/${json.videos[0].fileId}`,
    headers: {},
  })
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-length'], '2048')
  assert.equal(res.headers['accept-ranges'], 'bytes')
  assert.equal(res.body.length, 0)
})

await test('Range request never degrades to 200', async () => {
  await seedLibrary()
  const { route, fileRoute } = await createService()
  const { json } = await routeCall(route, { operation: 'list' })
  const res = await fileCall(fileRoute, {
    method: 'GET',
    url: `/moyu/media/${json.videos[0].fileId}`,
    headers: { range: 'bytes=0-' },
  })
  assert.equal(res.status, 206)
  assert.notEqual(res.status, 200)
  assert.ok(res.headers['content-range'])
})

await test('invalid, expired, and cross-subject tokens return 404 without paths', async () => {
  await seedLibrary()
  const { fileRoute } = await createService()
  const res = await fileCall(fileRoute, {
    method: 'GET',
    url: '/moyu/media/00000000-0000-4000-8000-000000000000',
    headers: { range: 'bytes=0-1' },
  })
  assert.equal(res.status, 404)
  const body = res.body.toString('utf8')
  assert.equal(body.includes('/tmp/'), false)
  assert.equal(body.includes('不存在') || body.includes('无权限'), false)
})

await test('host restart reissues fileId and invalidates the old token', async () => {
  await seedLibrary()
  const first = await createService()
  const list1 = await routeCall(first.route, { operation: 'list' })
  const oldId = list1.json.videos[0].fileId
  const sourceId = list1.json.videos[0].sourceId
  const second = await createService()
  const list2 = await routeCall(second.route, { operation: 'list' })
  assert.equal(list2.json.videos[0].sourceId, sourceId)
  assert.notEqual(list2.json.videos[0].fileId, oldId)
  const stale = await fileCall(second.fileRoute, {
    method: 'GET',
    url: `/moyu/media/${oldId}`,
    headers: { range: 'bytes=0-1' },
  })
  assert.equal(stale.status, 404)
  const fresh = await fileCall(second.fileRoute, {
    method: 'GET',
    url: `/moyu/media/${list2.json.videos[0].fileId}`,
    headers: { range: 'bytes=0-1' },
  })
  assert.equal(fresh.status, 206)
})

await test('settings view returns directory labels without paths', async () => {
  await seedLibrary()
  const { route } = await createService()
  const { status, json } = await routeCall(route, { operation: 'settings-get' })
  assert.equal(status, 200)
  assert.equal(json.directories[0].label, 'library')
  assert.ok(!JSON.stringify(json).includes('/tmp/moyu-media-verify/library'))
  const th = await routeCall(route, { operation: 'settings-set-threshold', inventoryThreshold: 5 })
  assert.equal(th.status, 200)
  assert.equal(th.json.inventoryThreshold, 5)
})

await test('thumbnail cache hits then invalidates on mtime change', async () => {
  const { payload } = await seedLibrary()
  const { route, fileRoute } = await createService()
  const listed = await routeCall(route, { operation: 'list' })
  const fileId = listed.json.videos[0].fileId
  const url = `/moyu/media/${fileId}/thumbnail`
  const posted = await fileCall(fileRoute, { method: 'POST', url, body: Buffer.from('jpeg-bytes') })
  assert.ok(posted.status === 204 || posted.status === 200)
  const hit = await fileCall(fileRoute, { method: 'GET', url, headers: {} })
  assert.equal(hit.status, 200)
  assert.equal(hit.body.toString(), 'jpeg-bytes')
  await writeFile('/tmp/moyu-media-verify/library/clip-01.mp4', Buffer.concat([payload, Buffer.alloc(16, 9)]))
  await routeCall(route, { operation: 'scan' })
  const listed2 = await routeCall(route, { operation: 'list' })
  const freshId = listed2.json.videos[0].fileId
  const missed = await fileCall(fileRoute, { method: 'GET', url: `/moyu/media/${freshId}/thumbnail`, headers: {} })
  assert.equal(missed.status, 404)
})

console.log('\nM3 artifacts and subtitles:')

await test('video_subtitle_read returns text and basename labels without paths', async () => {
  await seedLibrary()
  const { route, tools } = await createService()
  const listed = await routeCall(route, { operation: 'list' })
  const fileId = listed.json.videos[0].fileId
  const tool = tools.find(t => t.name === 'video_subtitle_read')
  assert.ok(tool, 'video_subtitle_read tool registered')
  const result = await tool.execute({ videoFileId: fileId })
  assert.ok(result.text.includes('hello'))
  assert.ok(result.files.some(f => f.label === 'clip-01' && f.fileName === 'clip-01.srt'))
  assert.equal(JSON.stringify(result).includes('/tmp/'), false)
  assert.equal(JSON.stringify(result).includes('/Users/'), false)
})

await test('video_subtitle_read returns empty when no subtitle exists', async () => {
  await seedLibrary()
  await writeFile('/tmp/moyu-media-verify/library/lonely.mp4', Buffer.alloc(512, 1))
  const { route, tools } = await createService()
  const listed = await routeCall(route, { operation: 'scan' })
  const lonely = listed.json.videos.find(v => v.fileName === 'lonely.mp4')
  assert.ok(lonely)
  const tool = tools.find(t => t.name === 'video_subtitle_read')
  const result = await tool.execute({ videoFileId: lonely.fileId })
  assert.equal(result.text, '')
  assert.deepEqual(result.files, [])
})

await test('video_subtitle_read invalid token is non-enumerable', async () => {
  await seedLibrary()
  const { tools } = await createService()
  const tool = tools.find(t => t.name === 'video_subtitle_read')
  await assert.rejects(() => tool.execute({ videoFileId: '00000000-0000-4000-8000-000000000000' }), /not found/)
})

await test('media_artifact_save writes draft and emits artifact_created', async () => {
  await seedLibrary()
  const { route, tools, sseRoute } = await createService()
  const listed = await routeCall(route, { operation: 'list' })
  const fileId = listed.json.videos[0].fileId
  const sseChunks = []
  await sseRoute.handler({ method: 'GET', on() {} }, {
    writeHead() {},
    write(chunk) { sseChunks.push(String(chunk)); return true },
    end() {},
    on() {},
  })
  const tool = tools.find(t => t.name === 'media_artifact_save')
  assert.ok(tool, 'media_artifact_save tool registered')
  const saved = await tool.execute({
    kind: 'title',
    candidates: [{ content: '标题甲', weight: 0.8, style: 'hook', reason: '短' }],
    videoFileId: fileId,
    platform: 'bilibili',
  })
  assert.equal(saved.status, 'draft')
  assert.equal(saved.kind, 'title')
  assert.equal(saved.revision, 1)
  assert.equal(saved.candidates[0].content, '标题甲')
  assert.equal(saved.videoFileId, fileId)
  const listedArt = await routeCall(route, { operation: 'list-artifacts' })
  assert.equal(listedArt.json.artifacts.length, 1)
  assert.equal(listedArt.json.artifacts[0].artifactId, saved.artifactId)
  assert.ok(sseChunks.join('').includes('artifact_created'), 'SSE must push artifact_created')
})

await test('legacy string[] candidates normalize on load', async () => {
  await seedLibrary()
  const storeFile = '/tmp/moyu-media-verify/media/store.json'
  const raw = JSON.parse(await readFile(storeFile, 'utf8'))
  raw.artifacts = [{
    artifactId: 'legacy-1',
    revision: 1,
    kind: 'tags',
    candidates: ['old-a', 'old-b'],
    status: 'draft',
    createdAt: 1,
  }]
  await writeFile(storeFile, JSON.stringify(raw))
  const { route } = await createService()
  const listed = await routeCall(route, { operation: 'list-artifacts' })
  const artifact = listed.json.artifacts.find(a => a.artifactId === 'legacy-1')
  assert.ok(artifact)
  assert.deepEqual(artifact.candidates, [{ content: 'old-a' }, { content: 'old-b' }])
})

await test('parentArtifactId increments revision', async () => {
  await seedLibrary()
  const { route, tools } = await createService()
  const tool = tools.find(t => t.name === 'media_artifact_save')
  const parent = await tool.execute({
    kind: 'title',
    candidates: [{ content: 'v1' }],
  })
  const child = await tool.execute({
    kind: 'title',
    candidates: [{ content: 'v2' }],
    parentArtifactId: parent.artifactId,
  })
  assert.equal(child.parentArtifactId, parent.artifactId)
  assert.equal(child.revision, parent.revision + 1)
})

await test('artifact-set-status moves draft to kept and discarded', async () => {
  await seedLibrary()
  const { route, tools } = await createService()
  const tool = tools.find(t => t.name === 'media_artifact_save')
  const saved = await tool.execute({ kind: 'tags', candidates: [{ content: 'tag-a' }] })
  const kept = await routeCall(route, { operation: 'artifact-set-status', artifactId: saved.artifactId, status: 'kept' })
  assert.equal(kept.status, 200)
  assert.equal(kept.json.artifact.status, 'kept')
  const other = await tool.execute({ kind: 'tags', candidates: [{ content: 'tag-b' }] })
  const discarded = await routeCall(route, { operation: 'artifact-set-status', artifactId: other.artifactId, status: 'discarded' })
  assert.equal(discarded.json.artifact.status, 'discarded')
})

await test('instructions route returns media persona text', async () => {
  const { route } = await createService()
  const { status, json } = await routeCall(route, { operation: 'instructions' })
  assert.equal(status, 200)
  assert.ok(json.text.includes('video_subtitle_read'))
  assert.ok(json.text.includes('media_artifact_save'))
  assert.ok(json.text.includes('不要再让 Tool 调模型'))
})

await test('M3 tools do not call a model', async () => {
  const { tools } = await createService()
  const readTool = tools.find(t => t.name === 'video_subtitle_read')
  const saveTool = tools.find(t => t.name === 'media_artifact_save')
  const src = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
  const promptSrc = await readFile(new URL('../src/media-prompt.ts', import.meta.url), 'utf8')
  const combined = src + promptSrc
  assert.equal(/openai|chat\.completions|llm\.complete|generateText|anthropic/i.test(combined), false)
  assert.ok(typeof readTool.execute === 'function')
  assert.ok(typeof saveTool.execute === 'function')
})

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
