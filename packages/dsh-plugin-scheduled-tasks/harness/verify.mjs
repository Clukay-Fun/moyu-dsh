process.env.MOYU_DSH_HOME = '/tmp/moyu-schedule-verify'
import { rm, readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const PLUGIN = new URL('../lib/index.mjs', import.meta.url).pathname

const captured = []
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
const storeD = JSON.parse(await readFile('/tmp/moyu-schedule-verify/scheduled-tasks/store.json', 'utf8'))
assert.equal(storeD.runs[tD.id][0].status, 'failed', 'dispose marks active run interrupted')
assert.equal(storeD.runs[tD.id][0].errorCode, 'interrupted')
blockIdle = false
resolveIdle && resolveIdle()
await d.catch(() => {})
console.log('PASS: SCHEDULE-02 dispose - in-flight run marked interrupted')

console.log('\nALL CHECKS PASSED (SCHEDULE-01 + SCHEDULE-02)')
process.exit(0)
