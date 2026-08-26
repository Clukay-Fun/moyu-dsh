process.env.MOYU_DSH_HOME = '/tmp/moyu-schedule-verify'
import { rm, readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const PLUGIN = new URL('../lib/index.mjs', import.meta.url).pathname

const captured = []
let capturedRoute = null
const calls = { create: [], followup: [], dispose: [] }
let shouldFailNext = false
let blockIdle = false
let resolveIdle = null
let effectDisposer = null

function mockAgent(sessionId) {
  const listeners = {}
  return {
    id: sessionId,
    ctx: {
      on(event, cb) {
        ;(listeners[event] ||= []).push(cb)
        return () => {
          listeners[event] = (listeners[event] || []).filter((f) => f !== cb)
        }
      },
    },
    followup(msg) {
      calls.followup.push(msg)
      if (shouldFailNext && listeners['agent/error']) {
        for (const cb of listeners['agent/error']) cb({ error: new Error('boom') })
      }
    },
    whenIdle() {
      if (blockIdle) return new Promise((r) => { resolveIdle = r })
      return Promise.resolve()
    },
  }
}

function makeCtx() {
  return {
    reflect: { provide() {} },
    effect(fn) {
      effectDisposer = fn()
      return effectDisposer
    },
    agents: {
      create(options) {
        calls.create.push(options)
        return Promise.resolve({
          agent: mockAgent(options.sessionId),
          dispose() {
            calls.dispose.push(options.sessionId)
            return Promise.resolve()
          },
        })
      },
    },
    sessions: { create() {}, list() { return [] }, get() { return null }, fork() {} },
    tools: { register(tool) { captured.push(tool) } },
    webServer: { register(route) { capturedRoute = route; return () => {} } },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  }
}

const mockCtx = makeCtx()

function reset() {
  return rm('/tmp/moyu-schedule-verify', { recursive: true, force: true }).then(() => {
    captured.length = 0
    calls.create.length = 0
    calls.followup.length = 0
    calls.dispose.length = 0
    shouldFailNext = false
    blockIdle = false
    resolveIdle = null
  })
}

const mod = await import(PLUGIN)
await reset()

await mod.apply(mockCtx)
const runNow = captured.find((t) => t.name === 'moyu_schedule_run_now')
const createTool = captured.find((t) => t.name === 'moyu_schedule_create')
assert.ok(runNow && createTool, 'both tools registered after load')
console.log('PASS: tools registered after load (race fixed)')

const r1 = await runNow.execute({ title: 't1', prompt: 'hi', cwd: '/tmp' })
assert.equal(calls.create.length, 1)
const createArg = calls.create[0]
assert.ok(createArg.sessionId, 'create called with sessionId option')
assert.equal(createArg.meta.agentPreset, 'moyu', 'create called with meta.agentPreset')
assert.equal(createArg.meta.cwd, '/tmp', 'create called with meta.cwd')
assert.equal(calls.followup[0].content[0].text, 'hi')
assert.equal(calls.dispose.length, 1, 'handle disposed after run (explicit release)')
assert.equal(r1.status, 'succeeded', 'no error -> succeeded (reliable)')
const store1 = JSON.parse(await readFile('/tmp/moyu-schedule-verify/scheduled-tasks/store.json', 'utf8'))
assert.equal(store1.tasks.length, 1)
assert.equal(store1.runs[r1.taskId].length, 1, 'runs persisted')
assert.equal(store1.runs[r1.taskId][0].sessionId, r1.sessionId, 'run.sessionId persisted')
assert.equal(store1.runs[r1.taskId][0].status, 'succeeded')
console.log('PASS: run_now -> create(options)->handle, followup, dispose, status=succeeded, runs persisted')

shouldFailNext = true
calls.create.length = 0
calls.followup.length = 0
calls.dispose.length = 0
const r2 = await runNow.execute({ title: 't2', prompt: 'fail', cwd: '/tmp' })
assert.equal(r2.status, 'failed', 'agent/error -> failed (reliable)')
assert.equal(calls.dispose.length, 1, 'handle still disposed on failure')
const store2 = JSON.parse(await readFile('/tmp/moyu-schedule-verify/scheduled-tasks/store.json', 'utf8'))
assert.equal(store2.runs[r2.taskId][0].status, 'failed', 'failure persisted')
console.log('PASS: agent/error -> status=failed, persisted (success/failure semantics fixed)')

await assert.rejects(
  () => runNow.execute({ title: 'bad', prompt: 'x', cwd: '/no/such/dir/xyz' }),
  /cwd is not accessible/,
  'non-existent cwd rejected',
)
console.log('PASS: invalid cwd rejected (validateCwd)')

calls.create.length = 0
calls.followup.length = 0
const farFuture = Date.now() + 2_200_000_000
const r3 = await createTool.execute({ title: 'later', prompt: 'deferred', cwd: '/tmp', runAt: farFuture })
await new Promise((res) => setTimeout(res, 300))
assert.equal(calls.create.length, 0, 'far-future task did NOT fire within 300ms (segmented wait)')
const store3 = JSON.parse(await readFile('/tmp/moyu-schedule-verify/scheduled-tasks/store.json', 'utf8'))
assert.ok(store3.tasks.find((t) => t.id === r3.taskId && t.nextRunAt === farFuture), 'task kept with future nextRunAt')
console.log('PASS: far-future timer segmented (no premature execution)')

const near = Date.now() + 40
const r4 = await createTool.execute({ title: 'soon', prompt: 'soon', cwd: '/tmp', runAt: near })
await new Promise((res) => setTimeout(res, 250))
assert.equal(calls.create.length, 1, 'near-future timer fired')
console.log('PASS: near-future timer fired -> session created')

calls.create.length = 0
const mod2 = await import(PLUGIN + '?reload=1')
const svc2captured = []
const mockCtx2 = makeCtx()
await mod2.apply(mockCtx2)
const store4 = JSON.parse(await readFile('/tmp/moyu-schedule-verify/scheduled-tasks/store.json', 'utf8'))
assert.ok(store4.runs[r1.taskId] && store4.runs[r2.taskId], 'runs survive restart (persisted in store.json)')
assert.equal(Object.keys(store4.runs).length, 3, 'all runs (success+fail+later) present after restart')
console.log('PASS: tasks + runs survive restart (persistence fixed)')

await assert.rejects(
  () => createTool.execute({ title: 'past', prompt: 'x', cwd: '/tmp', runAt: Date.now() - 1000 }),
  /future timestamp/,
  'past runAt rejected',
)
console.log('PASS: runAt must be future')

// ---- SCHEDULE-02 ----
const { ScheduledTasksService } = mod

// (1) idempotency: same task cannot run twice concurrently
const svc = new ScheduledTasksService(mockCtx)
await svc.ready
const tIdem = await svc.createTask({ title: 'idem', prompt: 'p', cwd: '/tmp' })
blockIdle = true
const a = svc.runTaskNow(tIdem.id)
await assert.rejects(svc.runTaskNow(tIdem.id), /already running/, 'concurrent same-task run rejected')
blockIdle = false
resolveIdle && resolveIdle()
await a
console.log('PASS: SCHEDULE-02 idempotency - same task cannot run twice concurrently')

// (2) recovery: stale running run reconciled to interrupted after reload
await mkdir('/tmp/moyu-schedule-verify2/scheduled-tasks', { recursive: true })
await writeFile(
  '/tmp/moyu-schedule-verify2/scheduled-tasks/store.json',
  JSON.stringify({
    tasks: [{ id: 't-rec', title: 'r', prompt: 'p', cwd: '/tmp', enabled: false, nextRunAt: null, lastRunAt: null, createdAt: 1, updatedAt: 1 }],
    runs: { 't-rec': [{ id: 'r-rec', taskId: 't-rec', scheduledFor: 1, startedAt: 1, finishedAt: null, status: 'running', sessionId: null, unread: true }] },
  }),
)
process.env.MOYU_DSH_HOME = '/tmp/moyu-schedule-verify2'
const modR = await import(PLUGIN + '?rec=1')
const svcR = new modR.ScheduledTasksService(makeCtx())
await svcR.ready
const storeR = JSON.parse(await readFile('/tmp/moyu-schedule-verify2/scheduled-tasks/store.json', 'utf8'))
assert.equal(storeR.runs['t-rec'][0].status, 'failed', 'running run reconciled to failed')
assert.equal(storeR.runs['t-rec'][0].errorCode, 'interrupted', 'interrupted errorCode set')
process.env.MOYU_DSH_HOME = '/tmp/moyu-schedule-verify'
console.log('PASS: SCHEDULE-02 recovery - stale running run marked interrupted')

// (3) dispose interruption: in-flight run marked interrupted on unload
const svcD = new ScheduledTasksService(mockCtx)
await svcD.ready
const tD = await svcD.createTask({ title: 'disp', prompt: 'p', cwd: '/tmp' })
blockIdle = true
const d = svcD.runTaskNow(tD.id)
// let runTaskNow register the run (it yields at `await this.ready` first)
await new Promise((r) => setTimeout(r, 20))
await svcD.dispose()
const storeD1 = JSON.parse(await readFile('/tmp/moyu-schedule-verify/scheduled-tasks/store.json', 'utf8'))
assert.equal(storeD1.runs[tD.id][0].status, 'failed', 'dispose marks active run interrupted')
assert.equal(storeD1.runs[tD.id][0].errorCode, 'interrupted')
// Let the original (blocked) run fully finish, then verify the FINAL persisted
// state is NOT overwritten to succeeded by runTaskNow's terminal transition.
blockIdle = false
resolveIdle && resolveIdle()
await d.catch(() => {})
const storeD2 = JSON.parse(await readFile('/tmp/moyu-schedule-verify/scheduled-tasks/store.json', 'utf8'))
assert.equal(storeD2.runs[tD.id][0].status, 'failed', 'final state not overwritten to succeeded after dispose')
assert.equal(storeD2.runs[tD.id][0].errorCode, 'interrupted')
console.log('PASS: SCHEDULE-02 dispose - in-flight run marked interrupted, not overwritten')

// (4) validation failure must converge: run marked failed + persisted, guard released.
// createTask() itself validates cwd, so craft a task with an inaccessible cwd
// directly into the store, then drive runTaskNow into the failure path.
const verifyV = '/tmp/moyu-schedule-verify-v'
await mkdir(verifyV + '/scheduled-tasks', { recursive: true })
await writeFile(
  verifyV + '/scheduled-tasks/store.json',
  JSON.stringify({
    tasks: [{ id: 't-bad', title: 'bad', prompt: 'p', cwd: '/no-such-dir-9f3a2c', enabled: false, nextRunAt: null, lastRunAt: null, createdAt: 1, updatedAt: 1 }],
    runs: {},
  }),
)
process.env.MOYU_DSH_HOME = verifyV
const svcV = new ScheduledTasksService(mockCtx)
await svcV.ready
await assert.rejects(
  svcV.runTaskNow('t-bad'),
  /not accessible|ENOENT|no such file|not exist/i,
  'runTaskNow rejects on invalid cwd',
)
const storeV = JSON.parse(await readFile(verifyV + '/scheduled-tasks/store.json', 'utf8'))
assert.equal(storeV.runs['t-bad'][0].status, 'failed', 'invalid cwd marks run failed + persisted')
assert.equal(storeV.runs['t-bad'][0].errorCode, 'validation', 'validation errorCode set')
// re-run must NOT be blocked by a stale activeRuns entry
await assert.rejects(
  svcV.runTaskNow('t-bad'),
  /not accessible|ENOENT|no such file|not exist/i,
  're-run not blocked (activeRuns cleared), still rejects on cwd',
)
console.log('PASS: SCHEDULE-02 validation failure converges (no stuck running)')

console.log('\nALL CHECKS PASSED (SCHEDULE-01 + SCHEDULE-02)')

// ---- SCHEDULE-03: Host query route (A' pattern) ----
const verifyRoute = '/tmp/moyu-schedule-verify-route'
await mkdir(verifyRoute + '/scheduled-tasks', { recursive: true })
await writeFile(
  verifyRoute + '/scheduled-tasks/store.json',
  JSON.stringify({
    tasks: [{ id: 't1', title: 'route-task', prompt: 'secret-prompt', cwd: '/Users/clukay/secret', enabled: true, nextRunAt: null, lastRunAt: 7, createdAt: 1, updatedAt: 1 }],
    runs: { t1: [{ id: 'r1', taskId: 't1', scheduledFor: 1, startedAt: 1, finishedAt: 2, status: 'succeeded', sessionId: 'sess-1', unread: false }] },
  }),
)
process.env.MOYU_DSH_HOME = verifyRoute
capturedRoute = null
await mod.apply(makeCtx())
assert.ok(capturedRoute, 'route registered via ctx.webServer.register')
assert.equal(capturedRoute.path, '/moyu/scheduled-tasks')
assert.equal(capturedRoute.kind, 'exact')

const handler = capturedRoute.handler
function makeReq(body, method = 'POST') {
  const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
  return { method, on(ev, cb) { if (ev === 'data') cb(buf); else if (ev === 'end') cb() } }
}
function makeRes() {
  const r = { statusCode: 0, headers: null, body: '' }
  r.writeHead = (s, h) => { r.statusCode = s; r.headers = h; return r }
  r.end = (b) => { r.body = b; return r }
  return r
}

let res = makeRes()
await handler(makeReq({ operation: 'list' }, 'GET'), res)
assert.equal(res.statusCode, 405, 'non-POST rejected with 405')
res = makeRes()
await handler(makeReq({ operation: 'delete' }), res)
assert.equal(res.statusCode, 400, 'invalid operation rejected with 400')
res = makeRes()
await handler(makeReq('x'.repeat(20000)), res)
assert.equal(res.statusCode, 400, 'oversized body rejected')
res = makeRes()
await handler(makeReq({ operation: 'runs', taskId: 'nope' }), res)
assert.equal(res.statusCode, 404, 'unknown taskId rejected with 404')
res = makeRes()
await handler(makeReq({ operation: 'runs', taskId: '' }), res)
assert.equal(res.statusCode, 400, 'empty taskId rejected with 400')
res = makeRes()
await handler(makeReq({ operation: 'list' }), res)
assert.equal(res.statusCode, 200, 'list ok')
const list = JSON.parse(res.body)
assert.equal(list.tasks.length, 1, 'list returns one task')
assert.equal(list.tasks[0].workspaceId, 'secret', 'workspaceId projected as basename(cwd), not cwd')
assert.equal('cwd' in list.tasks[0], false, 'cwd not leaked in DTO')
assert.equal('prompt' in list.tasks[0], false, 'prompt not leaked in DTO')
assert.equal(list.tasks[0].lastRunStatus, 'succeeded', 'lastRunStatus present')
res = makeRes()
await handler(makeReq({ operation: 'runs', taskId: 't1' }), res)
assert.equal(res.statusCode, 200, 'runs ok')
const runsBody = JSON.parse(res.body)
assert.equal(runsBody.runs.length, 1, 'runs returns one run')
assert.equal(runsBody.runs[0].sessionId, 'sess-1', 'sessionId present for click-to-open')
assert.equal('errorCode' in runsBody.runs[0], false, 'no errorCode on succeeded run')
console.log('PASS: SCHEDULE-03 Host query route (A\' pattern) - list/runs + rejection + safe DTO')

// ---- SCHEDULE-03b: write operations ----
const verifyB = '/tmp/moyu-schedule-verify-03b'
await mkdir(verifyB + '/scheduled-tasks', { recursive: true })
await writeFile(
  verifyB + '/scheduled-tasks/store.json',
  JSON.stringify({
    tasks: [{ id: 't-b', title: 'b-task', prompt: 'p', cwd: '/tmp', enabled: false, nextRunAt: null, lastRunAt: null, createdAt: 1, updatedAt: 1 }],
    runs: { 't-b': [] },
  }),
)
process.env.MOYU_DSH_HOME = verifyB
let routeB = null
const wsMock = {
  get: (id) => (id === 'ws-1' ? { id: 'ws-1', title: 'WS One', path: '/tmp', status: async () => 'ok' } : undefined),
  list: () => [{ id: 'ws-1', title: 'WS One', path: '/tmp', status: async () => 'ok' }],
  resolveByPath: async () => undefined,
}
const ctxB = {
  reflect: { provide() {} },
  agents: {
    create: async () => ({
      agent: { ctx: { on: () => () => {} }, followup() {}, whenIdle: async () => {} },
      dispose: async () => {},
    }),
  },
  sessions: { create() {}, list() { return [] }, get() { return null }, fork() {} },
  tools: { register() {} },
  webServer: { register: (r) => { routeB = r; return () => {} } },
  workspaceRegistry: wsMock,
  effect: (fn) => { fn(); return () => {} },
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}
await mod.apply(ctxB)
assert.ok(routeB, '03b route registered')
const hB = routeB.handler
const callB = async (body, method = 'POST') => {
  const r = makeRes()
  await hB(makeReq(body, method), r)
  return r
}

let rb = await callB({ operation: 'workspaces' })
assert.equal(rb.statusCode, 200, 'workspaces ok')
assert.deepEqual(JSON.parse(rb.body).workspaces, [{ id: 'ws-1', title: 'WS One' }], 'workspaces listed (no paths)')

rb = await callB({ operation: 'create', title: 'new', prompt: 'x', workspaceId: 'ws-1', runAt: Date.now() + 60000 })
assert.equal(rb.statusCode, 200, 'create ok')
const newId = JSON.parse(rb.body).taskId
assert.ok(newId, 'taskId returned')

rb = await callB({ operation: 'create', title: 'n', prompt: 'x', workspaceId: 'nope' })
assert.equal(rb.statusCode, 404, 'unknown workspace -> 404')
assert.equal(JSON.parse(rb.body).error, 'workspace_not_found')

rb = await callB({ operation: 'create', title: '', prompt: 'x', workspaceId: 'ws-1' })
assert.equal(rb.statusCode, 400, 'empty title rejected')
assert.equal(JSON.parse(rb.body).error, 'invalid_input')

rb = await callB({ operation: 'create', title: 'long', prompt: 'x'.repeat(20001), workspaceId: 'ws-1' })
assert.equal(rb.statusCode, 400, 'oversized prompt rejected')
assert.equal(JSON.parse(rb.body).error, 'invalid_input')

rb = await callB({ operation: 'run', taskId: newId })
assert.equal(rb.statusCode, 202, 'run returns 202 (non-blocking)')
assert.equal(JSON.parse(rb.body).status, 'running', 'run starts in running state')

rb = await callB({ operation: 'detail', taskId: newId })
assert.equal(rb.statusCode, 200, 'detail ok')
const detail = JSON.parse(rb.body).detail
assert.equal(detail.prompt, 'x', 'detail includes prompt')
assert.equal('cwd' in detail, false, 'detail does not leak cwd')

rb = await callB({ operation: 'update', taskId: newId, title: 'renamed' })
assert.equal(rb.statusCode, 200, 'update ok')

rb = await callB({ operation: 'set-enabled', taskId: newId, enabled: true })
assert.equal(rb.statusCode, 400, 'resume completed task (nextRunAt null) rejected')
assert.equal(JSON.parse(rb.body).error, 'invalid_state')

rb = await callB({ operation: 'delete', taskId: 't-b' })
assert.equal(rb.statusCode, 200, 'delete ok')

rb = await callB({ operation: 'delete', taskId: 'ghost' })
assert.equal(rb.statusCode, 404, 'delete unknown -> 404')

rb = await callB({ operation: 'mark-run-read', runId: 'ghost' })
assert.equal(rb.statusCode, 404, 'mark-run-read unknown -> 404')

const rCreate = await callB({ operation: 'create', title: 'run2', prompt: 'x', workspaceId: 'ws-1' })
const rid = JSON.parse(rCreate.body).taskId
const [ra, rb2] = await Promise.all([callB({ operation: 'run', taskId: rid }), callB({ operation: 'run', taskId: rid })])
assert.deepEqual([ra.statusCode, rb2.statusCode].sort(), [202, 409], 'concurrent run -> one 202 + one 409 task_running')
console.log('PASS: SCHEDULE-03b write operations (CRUD, workspace, 202 run, 409, validation)')

console.log('\nALL CHECKS PASSED (SCHEDULE-01 + SCHEDULE-02 + SCHEDULE-03 route + SCHEDULE-03b writes)')
process.exit(0)
