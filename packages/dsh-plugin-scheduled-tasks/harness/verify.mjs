process.env.MOYU_DSH_HOME = '/tmp/moyu-schedule-verify'
import { rm, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const PLUGIN = new URL('../lib/index.mjs', import.meta.url).pathname

const captured = []
const calls = { create: [], followup: [], dispose: [] }
let shouldFailNext = false

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
      return Promise.resolve()
    },
  }
}

const mockCtx = {
  reflect: { provide() {} },
  effect() {
    return () => {}
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

function reset() {
  return rm('/tmp/moyu-schedule-verify', { recursive: true, force: true }).then(() => {
    captured.length = 0
    calls.create.length = 0
    calls.followup.length = 0
    calls.dispose.length = 0
    shouldFailNext = false
  })
}

const mod = await import(PLUGIN)
await reset()

await mod.apply(mockCtx)
const runNow = captured.find((t) => t.name === 'moyu_schedule_run_now')
const createTool = captured.find((t) => t.name === 'moyu_schedule_create')
assert.ok(runNow && createTool, 'both tools registered after load')
console.log('PASS: tools registered after load (race fixed)')

// real AgentRegistry.create contract: options object -> Promise<AgentHandle>
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

// failure via agent/error (real event on agent.ctx)
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

// invalid cwd rejected
await assert.rejects(
  () => runNow.execute({ title: 'bad', prompt: 'x', cwd: '/no/such/dir/xyz' }),
  /cwd is not accessible/,
  'non-existent cwd rejected',
)
console.log('PASS: invalid cwd rejected (validateCwd)')

// segmented timer: far-future must NOT fire immediately
calls.create.length = 0
calls.followup.length = 0
const farFuture = Date.now() + 2_200_000_000
const r3 = await createTool.execute({ title: 'later', prompt: 'deferred', cwd: '/tmp', runAt: farFuture })
await new Promise((res) => setTimeout(res, 300))
assert.equal(calls.create.length, 0, 'far-future task did NOT fire within 300ms (segmented wait)')
const store3 = JSON.parse(await readFile('/tmp/moyu-schedule-verify/scheduled-tasks/store.json', 'utf8'))
assert.ok(store3.tasks.find((t) => t.id === r3.taskId && t.nextRunAt === farFuture), 'task kept with future nextRunAt')
console.log('PASS: far-future timer segmented (no premature execution)')

// near-future timer fires
const near = Date.now() + 40
const r4 = await createTool.execute({ title: 'soon', prompt: 'soon', cwd: '/tmp', runAt: near })
await new Promise((res) => setTimeout(res, 250))
assert.equal(calls.create.length, 1, 'near-future timer fired')
console.log('PASS: near-future timer fired -> session created')

// restart survivability
calls.create.length = 0
const mod2 = await import(PLUGIN + '?reload=1')
const svc2captured = []
const mockCtx2 = { ...mockCtx, effect() { return () => {} }, tools: { register(t) { svc2captured.push(t) } } }
await mod2.apply(mockCtx2)
const store4 = JSON.parse(await readFile('/tmp/moyu-schedule-verify/scheduled-tasks/store.json', 'utf8'))
assert.ok(store4.runs[r1.taskId] && store4.runs[r2.taskId], 'runs survive restart (persisted in store.json)')
assert.equal(Object.keys(store4.runs).length, 3, 'all runs (success+fail+later) present after restart')
console.log('PASS: tasks + runs survive restart (persistence fixed)')

// runAt must be future
await assert.rejects(
  () => createTool.execute({ title: 'past', prompt: 'x', cwd: '/tmp', runAt: Date.now() - 1000 }),
  /future timestamp/,
  'past runAt rejected',
)
console.log('PASS: runAt must be future')

console.log('\nALL SCHEDULE-01 FIX HARNESS CHECKS PASSED (real DSH API contract mocked)')
process.exit(0)
