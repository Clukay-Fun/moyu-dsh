/**
描述: 视频目录扫描与字幕关联。
主要功能:
    - 递归查找 .mp4 / .mov（大小写不敏感，跳过 >1GB）
    - 同名 .srt/.txt 关联
    - sourceId 由 realpath 指纹稳定生成
消费点：Host MediaService.scan。
*/

// UI-F05: 视频库支持的容器扩展名（大小写不敏感）。.mov 与 .mp4 均为 ISO-BMFF/QuickTime，
// mvhd 时长解析与 Range 路由通用；能否直接预览取决于编码，由 Client <video> 反馈。
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov'])

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, realpath, stat } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'

import { MAX_MEDIA_BYTES } from './range.js'
import { readMp4DurationMs } from './duration.js'
import type { PersistedSource, PersistedSubtitle } from './types.js'

export interface ScannedVideo {
  path: string
  size: number
  mtimeMs: number
  durationMs: number | null
  subtitles: PersistedSubtitle[]
}

export function fingerprintPath(resolved: string): string {
  return createHash('sha256').update(resolved).digest('hex').slice(0, 32)
}

export function sourceIdForPath(resolved: string): string {
  return fingerprintPath(resolved)
}

export function matchSubtitleFiles(videoPath: string, suffixes: string[]): PersistedSubtitle[] {
  const dir = dirname(videoPath)
  const stem = basename(videoPath, extname(videoPath))
  const found: PersistedSubtitle[] = []
  const seen = new Set<string>()
  for (const raw of suffixes) {
    const suffix = raw.startsWith('.') ? raw.toLowerCase() : `.${raw.toLowerCase()}`
    if (seen.has(suffix)) continue
    seen.add(suffix)
    const candidate = join(dir, `${stem}${suffix}`)
    if (!existsSync(candidate)) continue
    found.push({ fileName: basename(candidate), suffix })
  }
  return found
}

export async function scanDirectory(
  directory: string,
  suffixes: string[],
): Promise<ScannedVideo[]> {
  const resolved = await realpath(directory)
  const dirStat = await stat(resolved)
  if (!dirStat.isDirectory()) return []
  const results: ScannedVideo[] = []
  await walk(resolved, suffixes, results, 0)
  return results
}

async function walk(
  directory: string,
  suffixes: string[],
  results: ScannedVideo[],
  depth: number,
): Promise<void> {
  if (depth > 12 || results.length >= 500) return
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(full, suffixes, results, depth + 1)
      continue
    }
    if (!entry.isFile()) continue
    if (!VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue
    let info
    try {
      info = await stat(full)
    } catch {
      continue
    }
    if (info.size <= 0 || info.size > MAX_MEDIA_BYTES) continue
    const durationMs = await readMp4DurationMs(full)
    results.push({
      path: full,
      size: info.size,
      mtimeMs: Math.trunc(info.mtimeMs),
      durationMs,
      subtitles: matchSubtitleFiles(full, suffixes),
    })
  }
}

export function toPersistedSource(video: ScannedVideo, sourceType: PersistedSource['sourceType'] = 'project-source'): PersistedSource {
  const pathFingerprint = fingerprintPath(video.path)
  return {
    sourceId: sourceIdForPath(video.path),
    path: video.path,
    pathFingerprint,
    mtimeMs: video.mtimeMs,
    size: video.size,
    durationMs: video.durationMs,
    sourceType,
    subtitles: video.subtitles,
    thumbnailMtimeMs: null,
  }
}
