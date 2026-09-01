/**
描述: MediaArtifact 归一化与校验。
主要功能:
    - 旧 store 的 string[] candidates 读成 { content }
    - 校验 kind / status / 修订链
消费点：Host saveArtifact、load、listArtifacts、artifact-set-status。
*/

import type { ArtifactKind, ArtifactStatus, MediaArtifact, MediaArtifactCandidate } from './types.js'

export const ARTIFACT_KINDS: readonly ArtifactKind[] = [
  'cover',
  'title',
  'tags',
  'script',
  'subtitle',
  'bundle',
]

export const ARTIFACT_STATUSES: readonly ArtifactStatus[] = ['draft', 'kept', 'discarded']

export function isArtifactKind(value: unknown): value is ArtifactKind {
  return typeof value === 'string' && (ARTIFACT_KINDS as readonly string[]).includes(value)
}

export function isArtifactStatus(value: unknown): value is ArtifactStatus {
  return typeof value === 'string' && (ARTIFACT_STATUSES as readonly string[]).includes(value)
}

export function normalizeCandidates(raw: unknown): MediaArtifactCandidate[] {
  if (!Array.isArray(raw)) return []
  const out: MediaArtifactCandidate[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      if (item.length > 0) out.push({ content: item })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.content !== 'string' || record.content.length === 0) continue
    const candidate: MediaArtifactCandidate = { content: record.content }
    if (typeof record.weight === 'number' && Number.isFinite(record.weight)) candidate.weight = record.weight
    if (typeof record.style === 'string') candidate.style = record.style
    if (typeof record.reason === 'string') candidate.reason = record.reason
    out.push(candidate)
  }
  return out
}

export function normalizeArtifact(raw: unknown): MediaArtifact | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (typeof record.artifactId !== 'string' || !record.artifactId) return null
  if (!isArtifactKind(record.kind)) return null
  const status = isArtifactStatus(record.status) ? record.status : 'draft'
  const revision = typeof record.revision === 'number' && record.revision >= 1 ? Math.trunc(record.revision) : 1
  const createdAt = typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)
    ? record.createdAt
    : 0
  const artifact: MediaArtifact = {
    artifactId: record.artifactId,
    revision,
    kind: record.kind,
    candidates: normalizeCandidates(record.candidates),
    status,
    createdAt,
  }
  if (typeof record.parentArtifactId === 'string' && record.parentArtifactId) {
    artifact.parentArtifactId = record.parentArtifactId
  }
  if (typeof record.feedbackSessionId === 'string' && record.feedbackSessionId) {
    artifact.feedbackSessionId = record.feedbackSessionId
  }
  if (typeof record.videoSourceId === 'string' && record.videoSourceId) {
    artifact.videoSourceId = record.videoSourceId
  }
  if (typeof record.videoFileId === 'string' && record.videoFileId) {
    artifact.videoFileId = record.videoFileId
  }
  if (typeof record.platform === 'string' && record.platform) {
    artifact.platform = record.platform
  }
  return artifact
}

export function candidateSummary(artifact: MediaArtifact): string {
  return (artifact.candidates ?? []).map((item) => item.content).join(', ')
}
