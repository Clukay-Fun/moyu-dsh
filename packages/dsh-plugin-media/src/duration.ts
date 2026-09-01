/**
描述: 从 MP4 容器读时长，不解码视频。
主要功能:
    - 走 box 跳过 mdat，定位 moov/mvhd
    - 支持 mvhd version 0/1
消费点：video_scan 建索引时填写 durationMs。
*/

import { open } from 'node:fs/promises'

function readU32(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset)
}

function readU64(buf: Buffer, offset: number): number {
  const high = buf.readUInt32BE(offset)
  const low = buf.readUInt32BE(offset + 4)
  return high * 0x100000000 + low
}

/**
读取 MP4 时长（毫秒）。解析失败返回 null，不抛。
*/
export async function readMp4DurationMs(filePath: string): Promise<number | null> {
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(filePath, 'r')
    const stat = await handle.stat()
    const duration = await findMvhdDuration(handle, 0, stat.size)
    return duration
  } catch {
    return null
  } finally {
    await handle?.close().catch(() => {})
  }
}

async function findMvhdDuration(
  handle: Awaited<ReturnType<typeof open>>,
  start: number,
  end: number,
): Promise<number | null> {
  let offset = start
  while (offset + 8 <= end) {
    const header = Buffer.alloc(16)
    const { bytesRead } = await handle.read(header, 0, 16, offset)
    if (bytesRead < 8) return null
    let size = readU32(header, 0)
    const type = header.subarray(4, 8).toString('ascii')
    let headerLen = 8
    if (size === 1) {
      if (bytesRead < 16) return null
      size = readU64(header, 8)
      headerLen = 16
    } else if (size === 0) {
      size = end - offset
    }
    if (size < headerLen) return null
    const payloadStart = offset + headerLen
    const payloadEnd = offset + size
    if (payloadEnd > end) return null

    if (type === 'moov') {
      const nested = await findMvhdDuration(handle, payloadStart, payloadEnd)
      if (nested !== null) return nested
    } else if (type === 'mvhd') {
      return decodeMvhd(handle, payloadStart, payloadEnd)
    }

    offset = payloadEnd
  }
  return null
}

async function decodeMvhd(
  handle: Awaited<ReturnType<typeof open>>,
  start: number,
  end: number,
): Promise<number | null> {
  const length = Math.min(end - start, 32)
  if (length < 20) return null
  const buf = Buffer.alloc(length)
  await handle.read(buf, 0, length, start)
  const version = buf[0]
  if (version === 1) {
    if (length < 32) return null
    const timescale = readU32(buf, 20)
    const duration = readU64(buf, 24)
    if (!timescale) return null
    return Math.round((duration / timescale) * 1000)
  }
  const timescale = readU32(buf, 12)
  const duration = readU32(buf, 16)
  if (!timescale) return null
  return Math.round((duration / timescale) * 1000)
}
