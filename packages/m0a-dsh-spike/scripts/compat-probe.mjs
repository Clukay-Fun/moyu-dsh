import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const hello = JSON.parse(await readFile(resolve(root, '../dsh-plugin-hello/package.json'), 'utf8'))
const spike = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const bundle = await readFile(resolve(root, '../dsh-plugin-hello/lib/client.js'), 'utf8')

assert.equal(spike.dependencies['@deepseek-ai/dsh'], '0.1.0-rc.7')
assert.equal(hello.dependencies['@deepseek-ai/dsh-credentials'], '0.1.0-rc.7')
assert.equal(hello.dependencies['@deepseek-ai/dsh-tools'], '0.1.0-rc.7')
assert.equal(hello.devDependencies['@deepseek-ai/dsh-client-runtime'], '0.1.0-rc.7')
assert.equal(hello.devDependencies['@deepseek-ai/dsh-client-ui-slots'], '0.1.0-rc.7')
assert.equal(hello.peerDependencies.react, '^18.2.0')
assert.equal(hello.exports['./client'], './lib/client.js')
assert.equal(hello.exports['./package.json'], './package.json')
assert.deepEqual(hello.dsh.client, { inject: ['slots'], platform: 'web' })
assert.match(bundle, /^window\.__ModuleLoader__\.load\(\{ id: "@moyu\/dsh-plugin-hello", factory: \(require\) =>/)
assert.doesNotMatch(bundle, /<style|\sstyle=/i)

process.stdout.write(`${JSON.stringify({
  dsh: spike.dependencies['@deepseek-ai/dsh'],
  clientExport: hello.exports['./client'],
  packageExport: hello.exports['./package.json'],
  clientManifest: hello.dsh.client,
  reactPeer: hello.peerDependencies.react,
  lazyFactory: true,
  inlineStyleTags: false,
})}\n`)
