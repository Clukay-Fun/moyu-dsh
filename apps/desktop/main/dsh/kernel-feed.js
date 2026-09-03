import { MOYU_KERNEL_FEEDS } from './kernel-trust.js'
import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MAX_FEED_BYTES = 1024 * 1024
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024 * 1024
const ALLOWED_HOSTS = new Set(['github.com', 'objects.githubusercontent.com', 'github-releases.githubusercontent.com'])

function assertAllowedUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) throw new Error('内核源地址不受信任')
  return url
}

/** C4-f：检查固定通道的远端清单。清单不授予信任，包仍由 C4-b 独立验签。 */
export async function checkKernelFeed({ channel = 'stable', fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const feed = MOYU_KERNEL_FEEDS[channel]
  if (!feed) throw new Error('内核通道无效')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(feed, {
      headers: { accept: 'application/json', 'user-agent': 'MOYU-DSH-Kernel-Manager' },
      signal: controller.signal,
    })
    assertAllowedUrl(response.url || feed)
    if (!response.ok) throw new Error(`内核源暂不可用（HTTP ${response.status}）`)
    const length = Number(response.headers?.get?.('content-length') || 0)
    if (length > MAX_FEED_BYTES) throw new Error('内核清单过大')
    const text = await response.text()
    if (Buffer.byteLength(text) > MAX_FEED_BYTES) throw new Error('内核清单过大')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.releases)) throw new Error('内核清单格式无效')
    const releases = parsed.releases.map((item) => {
      if (!item || typeof item.version !== 'string') throw new Error('内核清单条目无效')
      for (const field of ['metadataUrl', 'signatureUrl', 'payloadUrl']) {
        if (typeof item[field] !== 'string') throw new Error(`内核清单缺少 ${field}`)
        assertAllowedUrl(item[field])
      }
      return {
        version: item.version,
        dshVersion: typeof item.dshVersion === 'string' ? item.dshVersion : item.version,
        notes: typeof item.notes === 'string' ? item.notes : '',
        metadataUrl: item.metadataUrl,
        signatureUrl: item.signatureUrl,
        payloadUrl: item.payloadUrl,
      }
    })
    return { channel, checkedAt: new Date().toISOString(), releases }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('内核源检查超时')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function downloadFile({ url, file, maxBytes, fetchImpl, signal }) {
  assertAllowedUrl(url)
  const response = await fetchImpl(url, { signal, headers: { 'user-agent': 'MOYU-DSH-Kernel-Manager' } })
  assertAllowedUrl(response.url || url)
  if (!response.ok || !response.body) throw new Error(`内核文件下载失败（HTTP ${response.status}）`)
  const length = Number(response.headers?.get?.('content-length') || 0)
  if (length > maxBytes) throw new Error('内核文件超过大小限制')
  let received = 0
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      callback(received > maxBytes ? new Error('内核文件超过大小限制') : null, chunk)
    },
  })
  await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(file, { mode: 0o600 }))
}

/** 下载签名三件套，不预解压任何未验证归档；随后交给 C4-b installer。 */
export async function downloadKernelPackage({ release, install, fetchImpl = fetch, timeoutMs = 10 * 60_000 } = {}) {
  if (typeof install !== 'function') throw new Error('内核安装器不可用')
  if (!release || typeof release !== 'object') throw new Error('内核版本条目无效')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const scratch = await mkdtemp(join(tmpdir(), 'moyu-kernel-download-'))
  try {
    await downloadFile({ url: release.metadataUrl, file: join(scratch, 'metadata.json'), maxBytes: MAX_FEED_BYTES, fetchImpl, signal: controller.signal })
    await downloadFile({ url: release.signatureUrl, file: join(scratch, 'metadata.sig'), maxBytes: 16 * 1024, fetchImpl, signal: controller.signal })
    await downloadFile({ url: release.payloadUrl, file: join(scratch, 'payload.tgz'), maxBytes: MAX_PACKAGE_BYTES, fetchImpl, signal: controller.signal })
    return await install(scratch)
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('内核包下载超时')
    throw error
  } finally {
    clearTimeout(timer)
    await rm(scratch, { recursive: true, force: true })
  }
}
