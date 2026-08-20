// 迁移期 main → DSH Host 窄服务桥（v3.0.0 §3.4、M1-a2）。
//
// 只允许 image.*：这是 legacy 图片工具迁移到 Host Service 时的临时脚手架，
// 不是通用 RPC。最后一个 legacy 图片入口删除时，本文件与对应 worker 协议一并删除。
const SERVICE_TIMEOUT_MS = 120_000

function requireImageMethod(method) {
  if (typeof method !== 'string' || !/^image\.[a-z][a-z0-9-]*$/.test(method)) {
    throw new Error('DSH Host 服务桥只允许 image.* 白名单方法')
  }
  return method
}

function rejectBinary(value, seen = new Set()) {
  if (value == null || typeof value !== 'object') return
  if (Buffer.isBuffer(value) || value instanceof Uint8Array || value instanceof ArrayBuffer) {
    throw new Error('image.* 服务桥禁止传输二进制；请改用 fileId')
  }
  if (seen.has(value)) return
  seen.add(value)
  for (const nested of Object.values(value)) rejectBinary(nested, seen)
}

export function createHostServiceClient(host) {
  let callSeq = 0
  let closed = false
  const pending = new Map()

  const rejectPending = (message) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.signal?.removeEventListener('abort', entry.onAbort)
      entry.reject(Object.assign(new Error(message), { code: 'HOST_UNAVAILABLE' }))
    }
    pending.clear()
  }

  const settle = (id) => {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    clearTimeout(entry.timer)
    entry.signal?.removeEventListener('abort', entry.onAbort)
    return entry
  }

  const onMessage = (message) => {
    if (message?.type === 'host-service-progress') {
      pending.get(message.id)?.onProgress?.(message.progress)
      return
    }
    if (message?.type !== 'host-service-result') return
    const entry = settle(message.id)
    if (!entry) return
    if (message.ok) entry.resolve(message.value)
    else entry.reject(Object.assign(new Error(message.error || 'DSH Host 服务调用失败'), {
      code: message.code || 'HOST_SERVICE_FAILED'
    }))
  }

  const onExit = () => {
    closed = true
    rejectPending('DSH Host 已退出，进行中的图片任务已失败，请重试')
  }

  host.child.on('message', onMessage)
  host.child.once('exit', onExit)

  return {
    call(method, payload, { onProgress, signal, timeoutMs = SERVICE_TIMEOUT_MS } = {}) {
      requireImageMethod(method)
      rejectBinary(payload)
      if (closed || !host.child.connected) {
        return Promise.reject(Object.assign(new Error('DSH Host 当前不可用，请稍后重试'), {
          code: 'HOST_UNAVAILABLE'
        }))
      }
      const id = `${host.generation}:${++callSeq}`
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          const entry = settle(id)
          if (!entry) return
          if (host.child.connected) host.child.send({ type: 'host-service-cancel', id })
          reject(Object.assign(new Error('TASK_CANCELLED'), { code: 'TASK_CANCELLED' }))
        }
        const timer = setTimeout(() => {
          const entry = settle(id)
          if (!entry) return
          reject(Object.assign(new Error(`DSH Host 服务调用超时：${method}`), {
            code: 'HOST_SERVICE_TIMEOUT'
          }))
        }, timeoutMs)
        pending.set(id, { resolve, reject, timer, onProgress, signal, onAbort })
        signal?.addEventListener('abort', onAbort, { once: true })
        if (signal?.aborted) return onAbort()
        host.child.send({ type: 'host-service-call', id, method, payload })
      })
    },

    close() {
      if (closed) return
      closed = true
      host.child.off('message', onMessage)
      host.child.off('exit', onExit)
      rejectPending('DSH Host 服务桥已关闭，进行中的图片任务已失败，请重试')
    }
  }
}
