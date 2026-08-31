// Client-side contract test for SCHEDULE-03: load the built __ModuleLoader__
// factory with a mocked Client Context and assert the "open session" click
// wiring calls ctx.sessions.open(sessionId) (no silent swallow, sessions injected).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

let moduleSpec = null
globalThis.window = { __ModuleLoader__: { load: (spec) => { moduleSpec = spec } } }

const require = createRequire(import.meta.url)
const rootReact = require(require.resolve('react', { paths: [require.resolve('react-test-renderer')] }))
const myRequire = (id) => {
  if (id === 'react') return { default: rootReact, ...rootReact }
  throw new Error('unexpected client require: ' + id)
}

await import('../lib/client.js')
assert.ok(moduleSpec && typeof moduleSpec.factory === 'function', 'client bundle registered via window.__ModuleLoader__.load')

const mod = moduleSpec.factory(myRequire)
assert.equal(mod.name, 'moyu-scheduled-tasks-client', 'client plugin name')
assert.deepEqual(mod.inject, ['slots', 'sessions'], 'client source inject must include sessions')

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
assert.deepEqual(pkg.dsh.client.inject, ['slots', 'sessions'], 'manifest dsh.client.inject must match source (no split contract)')

let compFactory = null
let injectedSlot = null
const openSpy = []
const mockCtx = {
  slots: {
    inject: (key, cb) => {
      injectedSlot = key
      cb()
    },
    register: (spec, comp) => {
      compFactory = comp
      return () => {}
    },
  },
  sessions: { open: (id) => { openSpy.push(id) } },
}
mod.apply(mockCtx)
assert.equal(injectedSlot, 'surface.scheduled', 'scheduled page registered in the sidebar surface')
assert.ok(typeof compFactory === 'function', 'surface.scheduled component registered')

const element = compFactory()
const openSession = element.props.openSession
assert.equal(typeof openSession, 'function', 'panel wired with openSession handler')

openSession('sess-xyz')
assert.deepEqual(openSpy, ['sess-xyz'], 'click handler calls ctx.sessions.open(sessionId)')

// sessions.open throwing must propagate (caught by the panel to surface, not swallowed)
openSpy.length = 0
let threw = null
mockCtx.sessions.open = () => {
  throw new Error('session not in list')
}
try {
  openSession('sess-gone')
} catch (e) {
  threw = e
}
assert.ok(threw && threw.message === 'session not in list', 'open() error is NOT swallowed (propagates for panel to show)')

// restore a recording session open for the write-flow section below
mockCtx.sessions.open = (id) => {
  openSpy.push(id)
}

console.log('PASS: SCHEDULE-03 client open-session wiring (sessions injected, no silent swallow, manifest matches source)')

// ---- SCHEDULE-03b: client write-flow via react-test-renderer ----
const TestRenderer = (await import('react-test-renderer')).default

let calls = []
let listTasks = [
  { id: 't1', title: 'Task One', enabled: true, schedule: { kind: 'daily', pattern: 'daily', timeOfDay: '09:00', timeZone: 'Asia/Shanghai' }, nextRunAt: 123, lastRunAt: null, lastRunStatus: null, unreadCount: 0, running: false },
]
let failList = false
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body)
  calls.push(body)
  const ok = (v) => ({ ok: true, status: 200, json: async () => v })
  if (body.operation === 'list') {
    if (failList) return { ok: false, status: 500, json: async () => ({ error: 'boom' }) }
    return ok({ tasks: listTasks })
  }
  if (body.operation === 'workspaces') return ok({ workspaces: [{ id: 'ws-1', title: 'WS One' }] })
  if (body.operation === 'run') return { ok: true, status: 202, json: async () => ({ runId: 'r1', taskId: body.taskId, status: 'running' }) }
  if (body.operation === 'delete') return ok({})
  if (body.operation === 'create') return ok({ taskId: 't-new' })
  if (body.operation === 'update') return ok({})
  if (body.operation === 'set-enabled') return ok({})
  if (body.operation === 'detail') return ok({ detail: { title: 'Task One', prompt: 'do x', workspaceId: 'ws-1', enabled: true } })
  if (body.operation === 'runs') return ok({ runs: [{ runId: 'r1', taskId: body.taskId, status: 'succeeded', startedAt: 1, finishedAt: 2, sessionId: 's1', unread: false }] })
  if (body.operation === 'mark-run-read') return ok({})
  return ok({})
}

const flush = () => new Promise((r) => setTimeout(r, 5))
function findByText(node, text) {
  if (node == null) return false
  if (typeof node === 'string') return node === text
  if (Array.isArray(node)) return node.some((c) => findByText(c, text))
  if (node.children) return findByText(node.children, text)
  return false
}
function buttonByLabel(root, label) {
  const btns = root.findAll((n) => n.type === 'button')
  return btns.find((b) => (b.children || []).join('').includes(label))
}

const renderer = TestRenderer.create(element)
await TestRenderer.act(async () => {
  await flush()
})
const root = renderer.root
assert.ok(calls.some((c) => c.operation === 'list'), 'panel fetched list on mount')
assert.ok(calls.some((c) => c.operation === 'workspaces'), 'panel fetched workspaces on mount')

assert.ok(buttonByLabel(root, '立即运行'), 'run button present for task')
calls.length = 0
await TestRenderer.act(async () => {
  buttonByLabel(root, '立即运行').props.onClick()
  await flush()
})
assert.ok(calls.some((c) => c.operation === 'run' && c.taskId === 't1'), 'run click posts run op')

calls.length = 0
await TestRenderer.act(async () => {
  buttonByLabel(root, '删除').props.onClick()
  await flush()
})
const delBtns = root.findAll((n) => n.type === 'button' && (n.children || []).join('') === '删除')
assert.ok(delBtns.length >= 2, 'delete confirm modal shown')
await TestRenderer.act(async () => {
  delBtns[delBtns.length - 1].props.onClick()
  await flush()
})
assert.ok(calls.some((c) => c.operation === 'delete' && c.taskId === 't1'), 'delete confirm posts delete op')

calls.length = 0
await TestRenderer.act(async () => {
  buttonByLabel(root, '创建').props.onClick()
  await flush()
})
assert.ok(findByText(renderer.toJSON(), '新建任务'), 'editor modal opened')
const setTitle = (v) => root.findAll((n) => n.type === 'input').find((i) => i.props.maxLength === 80).props.onChange({ target: { value: v } })
const setPrompt = (v) => root.findAll((n) => n.type === 'textarea')[0].props.onChange({ target: { value: v } })
const setWorkspace = (v) => root.findAll((n) => n.type === 'select')[0].props.onChange({ target: { value: v } })
const setRunAt = (v) => root.findAll((n) => n.type === 'input').find((i) => i.props.type === 'datetime-local').props.onChange({ target: { value: v } })
await TestRenderer.act(async () => {
  setTitle('My New Task')
  await flush()
  setPrompt('prompt content')
  await flush()
  setWorkspace('ws-1')
  await flush()
  setRunAt('2099-01-01T10:00')
  await flush()
})
await TestRenderer.act(async () => {
  const saveBtn = buttonByLabel(root, '保存')
  if (!saveBtn) throw new Error('no save button found')
  saveBtn.props.onClick()
  await flush()
})
const createCall = calls.find((c) => c.operation === 'create')
assert.ok(createCall, 'create posts create op')
assert.equal(createCall.title, 'My New Task', 'create DTO title')
assert.equal(createCall.prompt, 'prompt content', 'create DTO prompt')
assert.equal(createCall.workspaceId, 'ws-1', 'create DTO workspaceId (no cwd)')
assert.equal(createCall.enabled, true, 'create DTO enabled')
assert.ok(typeof createCall.runAt === 'number' && createCall.runAt > Date.now(), 'create DTO runAt is future ms')

// SCHEDULE-04b: recurrence UI posts a `schedule` object (not runAt)
calls.length = 0
await TestRenderer.act(async () => {
  buttonByLabel(root, '创建').props.onClick()
  await flush()
})
const setRecurrence = (v) => root.findAll((n) => n.type === 'select')[1].props.onChange({ target: { value: v } })
const setTime = (v) => root.findAll((n) => n.type === 'input').find((i) => i.props.type === 'time').props.onChange({ target: { value: v } })
await TestRenderer.act(async () => {
  setTitle('Recurring Task')
  await flush()
  setPrompt('p')
  await flush()
  setWorkspace('ws-1')
  await flush()
  setRecurrence('daily')
  await flush()
  setTime('08:30')
  await flush()
})
await TestRenderer.act(async () => {
  buttonByLabel(root, '保存').props.onClick()
  await flush()
})
const recCall = calls.find((c) => c.operation === 'create' && c.title === 'Recurring Task')
assert.ok(recCall, 'recurring create posts create op')
assert.ok(recCall.schedule && recCall.schedule.kind === 'recurring', 'recurring create posts schedule object')
assert.equal(recCall.schedule.pattern, 'daily', 'recurring pattern daily')
assert.equal(recCall.schedule.timeOfDay, '08:30', 'recurring timeOfDay posted')
assert.ok(typeof recCall.schedule.timeZone === 'string' && recCall.schedule.timeZone.length > 0, 'recurring timeZone posted')
assert.ok(!('runAt' in recCall), 'recurring create does NOT post runAt')

calls.length = 0
await TestRenderer.act(async () => {
  buttonByLabel(root, '创建').props.onClick()
  await flush()
})
await TestRenderer.act(async () => {
  setTitle('')
  await flush()
})
await TestRenderer.act(async () => {
  buttonByLabel(root, '保存').props.onClick()
  await flush()
})
assert.ok(calls.every((c) => c.operation !== 'create'), 'empty title does not post create')
assert.ok(findByText(renderer.toJSON(), '请填写任务名称'), 'validation error shown')

openSpy.length = 0
await TestRenderer.act(async () => {
  buttonByLabel(root, '运行历史').props.onClick()
  await flush()
})
const openBtn = buttonByLabel(root, '打开对话')
assert.ok(openBtn, 'open-session button present for run')
if (openBtn) {
  await TestRenderer.act(async () => {
    openBtn.props.onClick()
    await flush()
  })
  assert.ok(openSpy.includes('s1'), 'open-session click posts sessionId to sessions.open')
}

const allText = JSON.stringify(renderer.toJSON())
assert.ok(allText.includes('重复'), 'recurrence control (重复) present (SCHEDULE-04b implemented)')
assert.ok(allText.includes('每天 09:00'), 'recurring schedule described in list row (SCHEDULE-04b)')

renderer.unmount()
failList = true
const renderer2 = TestRenderer.create(element)
await TestRenderer.act(async () => {
  await flush()
})
assert.ok(findByText(renderer2.toJSON(), 'boom') || findByText(renderer2.toJSON(), '请求失败'), 'list failure surfaces error')
failList = false

console.log('PASS: SCHEDULE-03b client write-flow (list+run+delete-confirm+create DTO+validation+open-session+no-unimplemented-controls+error)')
process.exit(0)
