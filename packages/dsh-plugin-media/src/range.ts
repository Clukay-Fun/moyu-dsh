/**
描述: 媒体文件 Range 契约。
主要功能:
    - 解析单段 Range 头（bytes=start-end / bytes=start- / bytes=-suffix）
    - 拒绝 multipart
    - 对照文件大小解析成闭区间，越界标 416
真源消费点：Host `/moyu/media/:fileId` 路由。契约样本来自 M2-a Chromium Spike。
*/

export const MAX_MEDIA_BYTES = 1024 * 1024 * 1024

export type RangeParse =
  | { type: 'absent' }
  | { type: 'multipart' }
  | { type: 'invalid' }
  | { type: 'single'; start: number | null; end: number | null; suffix: number | null }

export type ResolvedRange =
  | { type: 'full' }
  | { type: 'partial'; start: number; end: number }
  | { type: 'unsatisfiable' }
  | { type: 'bad-request' }

/**
解析 Range 请求头。只接受单段 bytes。
*/
export function parseRangeHeader(header: string | undefined): RangeParse {
  if (header === undefined || header.trim() === '') return { type: 'absent' }
  const raw = header.trim()
  if (!raw.toLowerCase().startsWith('bytes=')) return { type: 'invalid' }
  const spec = raw.slice(raw.indexOf('=') + 1).trim()
  if (spec.includes(',')) return { type: 'multipart' }
  if (spec.startsWith('-')) {
    const suffix = Number(spec.slice(1))
    if (!Number.isInteger(suffix) || suffix <= 0) return { type: 'invalid' }
    return { type: 'single', start: null, end: null, suffix }
  }
  const dash = spec.indexOf('-')
  if (dash < 0) return { type: 'invalid' }
  const startPart = spec.slice(0, dash)
  const endPart = spec.slice(dash + 1)
  if (startPart === '') return { type: 'invalid' }
  const start = Number(startPart)
  if (!Number.isInteger(start) || start < 0) return { type: 'invalid' }
  if (endPart === '') return { type: 'single', start, end: null, suffix: null }
  const end = Number(endPart)
  if (!Number.isInteger(end) || end < 0) return { type: 'invalid' }
  return { type: 'single', start, end, suffix: null }
}

/**
把解析结果对照文件大小变成可服务的闭区间。无 Range → full（200）。
有 Range 时只返回 partial / unsatisfiable / bad-request，绝不退回 full。
*/
export function resolveRange(header: string | undefined, size: number): ResolvedRange {
  const parsed = parseRangeHeader(header)
  if (parsed.type === 'absent') return { type: 'full' }
  if (parsed.type === 'multipart' || parsed.type === 'invalid') return { type: 'bad-request' }
  if (!Number.isInteger(size) || size <= 0) return { type: 'unsatisfiable' }

  if (parsed.suffix !== null) {
    const length = Math.min(parsed.suffix, size)
    if (length <= 0) return { type: 'unsatisfiable' }
    return { type: 'partial', start: size - length, end: size - 1 }
  }

  const start = parsed.start ?? 0
  if (start >= size) return { type: 'unsatisfiable' }
  const end = parsed.end === null ? size - 1 : Math.min(parsed.end, size - 1)
  if (end < start) return { type: 'unsatisfiable' }
  return { type: 'partial', start, end }
}
