import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createHostServiceClient } from '../apps/desktop/main/dsh/service-bridge.js'

class FakeChild extends EventEmitter {
  connected = true
  sent = []
  send(message) {
    this.sent.push(message)
  }
}

const child = new FakeChild()
const client = createHostServiceClient({ child, generation: 7 })

const progress = []
const success = client.call('image.convert', { inputFileId: 'file-1', format: 'png' }, {
  onProgress: (value) => progress.push(value)
})
const first = child.sent.at(-1)
assert.equal(first.type, 'host-service-call')
assert.equal(first.method, 'image.convert')
child.emit('message', { type: 'host-service-progress', id: first.id, progress: { ratio: 0.5 } })
child.emit('message', { type: 'host-service-result', id: first.id, ok: true, value: { resultId: 'r1' } })
assert.deepEqual(await success, { resultId: 'r1' })
assert.deepEqual(progress, [{ ratio: 0.5 }])

assert.throws(() => client.call('desktop.ping', {}), /只允许 image\.\*/)
assert.throws(
  () => client.call('image.convert', { data: Buffer.from('large-binary') }),
  /禁止传输二进制/
)

const abort = new AbortController()
const cancelled = client.call('image.convert', { inputFileId: 'file-cancel' }, { signal: abort.signal })
const cancelCall = child.sent.at(-1)
abort.abort()
await assert.rejects(cancelled, (error) => error.code === 'TASK_CANCELLED')
assert.deepEqual(child.sent.at(-1), { type: 'host-service-cancel', id: cancelCall.id })
child.emit('message', { type: 'host-service-result', id: cancelCall.id, ok: true, value: { late: true } })

const inFlight = client.call('image.convert', { inputFileId: 'file-2' })
child.emit('exit', 1, null)
await assert.rejects(inFlight, (error) => {
  assert.equal(error.code, 'HOST_UNAVAILABLE')
  assert.match(error.message, /进行中的图片任务已失败/)
  return true
})
await assert.rejects(
  client.call('image.convert', { inputFileId: 'file-3' }),
  (error) => error.code === 'HOST_UNAVAILABLE'
)

console.log('M1-a2 service bridge: 方向、progress、二进制门禁、Host 掉线语义均通过')
