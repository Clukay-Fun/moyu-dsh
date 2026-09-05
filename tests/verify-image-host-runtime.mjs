import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const sandbox = await mkdtemp(join(tmpdir(), 'moyu-image-runtime-'))
const inputPath = join(sandbox, 'input.png')
const outputDirectory = join(sandbox, 'output')
await mkdir(outputDirectory)
await sharp({ create: { width: 640, height: 360, channels: 4, background: '#3578e5' } })
  .png().toFile(inputPath)

const paths = new Map([
  ['input-1', inputPath],
  ['output-1', outputDirectory]
])
const handlers = new Map()
globalThis.__moyuDesktop = {
  async call(method, payload) {
    assert.equal(method, 'desktop.resolveFile')
    const path = paths.get(payload.fileId)
    if (!path) throw new Error('文件令牌无效或已失效')
    return { path }
  }
}
globalThis.__moyuHostServices = {
  register(method, handler) {
    handlers.set(method, handler)
    return () => handlers.delete(method)
  }
}

const plugin = await import('../build/dsh-runtime/node_modules/@moyu/dsh-plugin-image/lib/index.mjs')
const effects = []
const tools = []
plugin.apply({
  effect(run) {
    effects.push(run())
  },
  tools: { register(value) { tools.push(value); return () => {} }, schemas() { return tools } },
  on() {},
  webServer: { register() { return () => {} } }
})

const inspect = handlers.get('image.inspect')
const convert = handlers.get('image.convert')
assert.equal(typeof inspect, 'function')
assert.equal(typeof convert, 'function')

const inspected = await inspect({
  inputFileId: 'input-1',
  previewDirectoryFileId: 'output-1',
  previewName: 'preview.png'
})
assert.deepEqual([inspected.width, inspected.height], [640, 360])
assert.ok((await stat(join(outputDirectory, 'preview.png'))).size > 100)

const progress = []
const converted = await convert({
  inputFileId: 'input-1',
  outputDirectoryFileId: 'output-1',
  outputName: 'converted.webp',
  action: 'image-convert',
  options: { target: 'webp', quality: 70, maxWidth: 320 }
}, { signal: new AbortController().signal, progress: (value) => progress.push(value.ratio) })
assert.deepEqual([converted.width, converted.height, converted.format], [320, 180, 'webp'])
assert.deepEqual(progress, [0, 1])
assert.ok((await readFile(join(outputDirectory, 'converted.webp'))).byteLength > 100)

await assert.rejects(
  convert({
    inputFileId: 'input-1', outputDirectoryFileId: 'output-1', outputName: 'bad.xyz',
    action: 'image-convert', options: { target: 'xyz' }
  }, { signal: new AbortController().signal, progress() {} }),
  /不支持的图片输出格式/
)

const abort = new AbortController()
abort.abort()
await assert.rejects(
  convert({
    inputFileId: 'input-1', outputDirectoryFileId: 'output-1', outputName: 'cancelled.png',
    action: 'image-convert', options: { target: 'png' }
  }, { signal: abort.signal, progress() {} }),
  (error) => error.code === 'TASK_CANCELLED'
)

paths.delete('input-1')
await assert.rejects(
  inspect({ inputFileId: 'input-1', previewDirectoryFileId: 'output-1', previewName: 'stale.png' }),
  /文件令牌无效或已失效/
)
paths.set('input-2', inputPath)
const retried = await convert({
  inputFileId: 'input-2', outputDirectoryFileId: 'output-1', outputName: 'retry.png',
  action: 'image-compress', options: { quality: 80, maxWidth: 160 }
}, { signal: new AbortController().signal, progress() {} })
assert.deepEqual([retried.width, retried.height], [160, 90])

console.log(JSON.stringify({ inspected, converted, progress, retry: retried }, null, 2))
console.log('runtime 内 Image Host Service：成功、失败、取消、换令牌重试均通过')
