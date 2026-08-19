import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { installAuthFence } from './auth-fence.mjs'

const require = createRequire(import.meta.url)
const dshPackage = require.resolve('@deepseek-ai/dsh/package.json')
const dshBin = join(dirname(dshPackage), 'lib', 'bin.js')
const home = process.env.M0A_DSH_HOME
if (!home) throw new Error('M0A_DSH_HOME is required')
process.env.DSH_HOME = home

const parentPort = process.parentPort
if (!parentPort) throw new Error('utilityProcess parentPort is unavailable')

const auth = await new Promise((resolve) => {
  parentPort.on('message', function onAuth(event) {
    if (event.data?.type !== 'host-auth') return
    parentPort.off('message', onAuth)
    resolve(event.data)
  })
})
const fence = installAuthFence({
  token: auth.token,
  generation: auth.generation,
  report: (evidence) => parentPort.postMessage({ type: 'auth-evidence', evidence }),
})

parentPort.on('message', (event) => {
  if (event.data?.type === 'host-origin') {
    fence.setOrigin(event.data.origin)
    return
  }
  const port = event.ports?.[0]
  if (!port) return
  port.on('message', ({ data }) => {
    if (data?.method === 'desktop.ping') port.postMessage({ id: data.id, ok: true, value: 'desktop.pong' })
  })
  port.start()
})

const originalLog = console.log.bind(console)
console.log = (...args) => {
  originalLog(...args)
  const line = args.map(String).join(' ')
  const match = line.match(/^dsh web: (http:\/\/127\.0\.0\.1:\d+)/)
  if (match) {
    fence.setOrigin(match[1])
    parentPort.postMessage({ type: 'host-ready', url: match[1], pid: process.pid, generation: auth.generation })
  }
}

process.argv = [process.execPath, dshBin, '--profile', 'web', '--port', '0']
await import(dshBin)
