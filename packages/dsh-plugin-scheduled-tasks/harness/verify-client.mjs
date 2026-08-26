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
const reactMod = require('react')
const myRequire = (id) => {
  if (id === 'react') return { default: reactMod, ...reactMod }
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
const openSpy = []
const mockCtx = {
  slots: {
    inject: (key, cb) => {
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
assert.ok(typeof compFactory === 'function', 'conversation.view component registered')

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

console.log('PASS: SCHEDULE-03 client open-session wiring (sessions injected, no silent swallow, manifest matches source)')
process.exit(0)
