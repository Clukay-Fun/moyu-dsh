export interface MediaArtifact {
  artifactId: string
  revision: number
  parentArtifactId?: string
  kind: 'cover' | 'title' | 'tags' | 'script' | 'subtitle' | 'bundle'
  candidates?: string[]
  status: 'draft' | 'kept' | 'discarded'
  feedbackSessionId?: string
}

export type RunStatus = 'running' | 'awaiting_user' | 'success' | 'failed' | 'cancelled' | 'interrupted'

export type RunEvent =
  | { type: 'started'; runId: string; generation: number; sequence: number }
  | { type: 'progress'; runId: string; message: string; percent?: number; generation: number; sequence: number }
  | { type: 'artifact_created'; runId: string; artifact: MediaArtifact; generation: number; sequence: number }
  | { type: 'server_request_resolved'; runId: string; requestId: string; approved: boolean; generation: number; sequence: number }
  | { type: 'completed'; runId: string; status: 'success' | 'failed' | 'cancelled' | 'interrupted'; summary?: string; generation: number; sequence: number }

export interface ServerRequest {
  requestId: string
  runId: string
  action: string
  detail: string
  ttlMs: number
}

export interface ServerResponse {
  requestId: string
  approved: boolean
}

export interface SessionCapabilities {
  tools: string[]
  skills: string[]
  fileSourceTypes: string[]
  approvalRequired: string[]
}

export interface MediaRun {
  runId: string
  status: RunStatus
  generation: number
  events: RunEvent[]
  pendingRequest?: ServerRequest
  artifacts: MediaArtifact[]
  createdAt: number
  finishedAt?: number
  checkpoint?: unknown
}

export type FileSourceType =
  | 'project-source'
  | 'session-attachment'
  | 'job-result'
  | 'scheduled-input'

export interface MediaDirectory {
  id: string
  path: string
}

export interface MediaSettings {
  directories: MediaDirectory[]
  subtitleSuffixes: string[]
}

export interface PersistedSubtitle {
  fileName: string
  suffix: string
}

export interface PersistedSource {
  sourceId: string
  path: string
  pathFingerprint: string
  mtimeMs: number
  size: number
  durationMs: number | null
  sourceType: FileSourceType
  subtitles: PersistedSubtitle[]
  thumbnailMtimeMs: number | null
}

export interface MediaStore {
  version: number
  generation: number
  runs: MediaRun[]
  settings: MediaSettings
  sources: PersistedSource[]
}

export interface VideoListItem {
  sourceId: string
  fileId: string
  fileName: string
  size: number
  mtimeMs: number
  durationMs: number | null
  subtitles: PersistedSubtitle[]
  hasThumbnail: boolean
}

export interface DirectoryView {
  id: string
  label: string
}
