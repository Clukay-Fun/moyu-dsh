import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

let moduleSpec = null
globalThis.window = { __ModuleLoader__: { load: (spec) => { moduleSpec = spec } } }

const require = createRequire(import.meta.url)
const rootReact = require(require.resolve('react', { paths: [require.resolve('react')] }))
const myRequire = (id) => {
  if (id === 'react') return { default: rootReact, ...rootReact }
  if (id === 'react/jsx-runtime') return require('react/jsx-runtime')
  throw new Error('unexpected client require: ' + id)
}

await import('../lib/client.js')
assert.ok(moduleSpec && typeof moduleSpec.factory === 'function', 'client bundle registered via __ModuleLoader__.load')

const mod = moduleSpec.factory(myRequire)

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.error(`  ✗ ${name}`)
    console.error(`    ${e.message}`)
  }
}

// ─── 1. Plugin contract ──────────────────────────────────────────────
console.log('\nClient plugin contract:')

test('plugin name', () => {
  assert.equal(mod.name, 'moyu-media-client')
})

test('inject declares slots', () => {
  assert.deepEqual([...mod.inject], ['slots'])
})

test('manifest dsh.client.inject matches source', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.deepEqual(pkg.dsh.client.inject, ['slots'])
})

test('apply registers the upstream settings.section slot', () => {
  let injectedSlot = null
  let registeredSpec = null
  let compFactory = null
  const availableSlots = new Set(['settings.section'])
  const mockCtx = {
    slots: {
      inject: (key, cb) => {
        injectedSlot = key
        if (availableSlots.has(key)) cb()
      },
      register: (spec, comp) => {
        registeredSpec = spec
        compFactory = comp
        return () => {}
      },
    },
  }
  mod.apply(mockCtx)
  assert.equal(injectedSlot, 'settings.section')
  assert.equal(registeredSpec.name, 'settings.section')
  assert.equal(registeredSpec.id, 'moyu-media-spike')
  assert.ok(typeof compFactory === 'function')
  const element = rootReact.createElement(compFactory)
  assert.ok(element)
  assert.equal(typeof element.type, 'function', 'settings section registers a React component')
})

test('slot harness does not execute providers for unknown slots', () => {
  let registered = false
  const mockCtx = {
    slots: {
      inject: () => {},
      register: () => { registered = true; return () => {} },
    },
  }
  mod.apply(mockCtx)
  assert.equal(registered, false, 'missing slot must not be fabricated by the harness')
})

// ─── 2. deduplicateEvents ────────────────────────────────────────────
console.log('\nEvent deduplication:')

const { deduplicateEvents } = mod
assert.ok(typeof deduplicateEvents === 'function', 'deduplicateEvents is exported')

test('accepts new events with fresh highWater', () => {
  const events = [
    { type: 'started', runId: 'r1', generation: 1, sequence: 1 },
    { type: 'progress', runId: 'r1', message: 'step 1', generation: 1, sequence: 2 },
  ]
  const { accepted, highWater } = deduplicateEvents(events, new Map())
  assert.equal(accepted.length, 2)
  assert.equal(highWater.get(1), 2)
})

test('rejects events already seen (same generation+sequence)', () => {
  const initial = new Map([[1, 3]])
  const events = [
    { type: 'progress', runId: 'r1', message: 'old', generation: 1, sequence: 2 },
    { type: 'progress', runId: 'r1', message: 'seen', generation: 1, sequence: 3 },
    { type: 'completed', runId: 'r1', status: 'success', generation: 1, sequence: 4 },
  ]
  const { accepted, highWater } = deduplicateEvents(events, initial)
  assert.equal(accepted.length, 1, 'only seq:4 should pass')
  assert.equal(accepted[0].sequence, 4)
  assert.equal(highWater.get(1), 4)
})

test('handles multiple generations independently', () => {
  const initial = new Map([[1, 5]])
  const events = [
    { type: 'started', runId: 'r2', generation: 2, sequence: 1 },
    { type: 'progress', runId: 'r1', message: 'replay', generation: 1, sequence: 3 },
    { type: 'progress', runId: 'r2', message: 'new', generation: 2, sequence: 2 },
  ]
  const { accepted, highWater } = deduplicateEvents(events, initial)
  assert.equal(accepted.length, 2, 'gen:2 seq:1 and seq:2 pass, gen:1 seq:3 rejected')
  assert.deepEqual(accepted.map(e => e.sequence), [1, 2])
  assert.equal(highWater.get(1), 5, 'gen:1 highWater unchanged')
  assert.equal(highWater.get(2), 2, 'gen:2 highWater updated')
})

test('empty input returns empty accepted', () => {
  const { accepted } = deduplicateEvents([], new Map([[1, 10]]))
  assert.equal(accepted.length, 0)
})

test('duplicate events in same batch are deduplicated', () => {
  const events = [
    { type: 'started', runId: 'r1', generation: 1, sequence: 1 },
    { type: 'started', runId: 'r1', generation: 1, sequence: 1 },
  ]
  const { accepted } = deduplicateEvents(events, new Map())
  assert.equal(accepted.length, 1, 'second duplicate rejected within same call')
})

// ─── 4. M1 Session Filtering and Capabilities Client Exports ────────
console.log('\nM1 Client Session Filter Exports:')

test('client exports buildPresetSessionIndex and filter functions', () => {
  assert.equal(typeof mod.buildPresetSessionIndex, 'function')
  assert.equal(typeof mod.filterSessionListByPreset, 'function')
  assert.equal(typeof mod.filterSearchResultsByPreset, 'function')
  assert.equal(typeof mod.createPresetSessionSelector, 'function')
  assert.equal(typeof mod.getSessionCapabilities, 'function')
  assert.equal(typeof mod.hasCapability, 'function')
})

test('client filterSessionListByPreset isolates sessions by preset', () => {
  const list = {
    ids: ['a1', 'm1'],
    byId: {
      a1: { id: 'a1', agentPreset: 'moyu' },
      m1: { id: 'm1', agentPreset: 'media' },
    },
  }
  const filtered = mod.filterSessionListByPreset(list, 'media')
  assert.deepEqual(filtered.ids, ['m1'])
  assert.deepEqual(Object.keys(filtered.byId), ['m1'])
})

// ─── Summary ─────────────────────────────────────────────────────────
console.log(`\n=== Client Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
