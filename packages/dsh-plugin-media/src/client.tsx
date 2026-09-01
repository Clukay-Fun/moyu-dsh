/**
描述: 自媒体工作台 Client 插件。
主要功能:
    - 提供 preset 切换器（moyu / media），写入 __moyuActivePreset 驱动 overlay 过滤
    - MediaSpikePanel 根据 Host capabilities 路由动态显隐 UI 入口
    - M0 协议审批、SSE 推送、事件去重保持不变
会话列表过滤真源是 overlay sessionVisible，本文件不平行实现。
*/

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import React, { useState, useEffect, useCallback, useRef } from 'react'

import type {
  DirectoryView,
  MediaRun,
  RunEvent,
  ServerRequest,
  MediaArtifact,
  SessionCapabilities,
  VideoListItem,
} from './types.js'

import {
  getSessionCapabilities,
  hasCapability,
} from './session-filter.js'

export {
  getSessionCapabilities,
  hasCapability,
}

export type { SessionCapabilities }

export const name = 'moyu-media-client'

export const inject = ['slots', 'sessions'] as const

//#region 事件去重

export function deduplicateEvents(
  incoming: RunEvent[],
  highWater: Map<number, number>,
): { accepted: RunEvent[]; highWater: Map<number, number> } {
  const updated = new Map(highWater)
  const accepted: RunEvent[] = []
  for (const event of incoming) {
    const seen = updated.get(event.generation) ?? 0
    if (event.sequence > seen) {
      accepted.push(event)
      updated.set(event.generation, event.sequence)
    }
  }
  return { accepted, highWater: updated }
}

//#endregion

//#region API 请求

async function apiRequest(
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch('/moyu/media', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(
      ((value as { error?: string }).error) || `request failed: HTTP ${response.status}`,
    )
  return value
}

//#endregion

//#region Preset 切换器

/**
描述: preset 切换器组件，设置 window.__moyuActivePreset 并触发 session 列表刷新。
用处，参数: 无

功能:
    - 渲染 moyu / media 两个切换按钮
    - 点击后设置全局 activePreset，触发 sessions 订阅刷新
    - 提供 session 统计摘要（各 preset 下可见会话数量）
*/
function PresetSwitcher({ sessions }: { sessions: ClientContext['sessions'] }): React.ReactElement {
  const [activePreset, setActivePreset] = useState<string>(
    () => (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__moyuActivePreset as string) || 'moyu'
  )

  // 通过 sessions.list（ObservableSnapshot）读取真实会话数据，仅用于切换器计数。
  // 列表隔离本身由 overlay sessionVisible 完成，这里不平行实现过滤。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = (sessions as any).list
  const [sessionList, setSessionList] = useState<{
    ids: string[]
    byId: Record<string, { agentPreset?: unknown } | undefined>
  }>(() => listRef?.getSnapshot?.() ?? { ids: [], byId: {} })

  useEffect(() => {
    if (!listRef?.subscribe) return
    const unsubscribe = listRef.subscribe(() => {
      setSessionList(listRef.getSnapshot())
    })
    setSessionList(listRef.getSnapshot())
    return unsubscribe
  }, [listRef])

  // 计数跟 overlay sessionVisible 对齐：无 agentPreset 的 legacy 会话计入 moyu。
  let moyuCount = 0
  let mediaCount = 0
  for (const id of sessionList.ids) {
    const raw = sessionList.byId[id]?.agentPreset
    const preset = typeof raw === 'string' ? raw.trim() : ''
    if (preset === 'media') mediaCount++
    else if (preset === 'moyu' || preset === '') moyuCount++
  }

  const switchPreset = useCallback((preset: string) => {
    (window as unknown as Record<string, unknown>).__moyuActivePreset = preset
    setActivePreset(preset)
    // 触发 sessions store 重新 derive
    window.dispatchEvent(new CustomEvent('moyu-preset-changed', { detail: preset }))
  }, [])

  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    borderRadius: 4,
    border: isActive ? '2px solid #4a90d9' : '1px solid #ccc',
    background: isActive ? '#e8f0fe' : 'transparent',
    cursor: 'pointer',
    fontWeight: isActive ? 600 : 400,
    fontSize: 13,
  })

  return React.createElement('div', { style: { marginBottom: 12 } },
    React.createElement('div', { style: { fontSize: 12, color: '#666', marginBottom: 4 } },
      'Preset 切换（会话过滤）',
    ),
    React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 8 } },
      React.createElement('button', {
        onClick: () => switchPreset('moyu'),
        style: buttonStyle(activePreset === 'moyu'),
      }, `Moyu (${moyuCount})`),
      React.createElement('button', {
        onClick: () => switchPreset('media'),
        style: buttonStyle(activePreset === 'media'),
      }, `Media (${mediaCount})`),
    ),
  )
}

//#endregion

//#region MediaSpikePanel

function MediaSpikePanel({ sessions }: { sessions: ClientContext['sessions'] }): React.ReactElement {
  const [runs, setRuns] = useState<MediaRun[]>([])
  const [error, setError] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<ServerRequest | null>(null)
  const highWaterRef = useRef<Map<number, number>>(new Map())
  const [processedEvents, setProcessedEvents] = useState<RunEvent[]>([])
  const [artifacts, setArtifacts] = useState<MediaArtifact[]>([])
  const [capabilities, setCapabilities] = useState<SessionCapabilities | null>(null)

  // 获取当前 preset 的 capabilities
  useEffect(() => {
    const fetchCaps = () => {
      const preset = (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__moyuActivePreset as string) || 'moyu'
      apiRequest({ operation: 'capabilities', preset })
        .then(result => setCapabilities((result as { capabilities: SessionCapabilities }).capabilities))
        .catch(() => {})
    }
    fetchCaps()

    const handler = () => fetchCaps()
    window.addEventListener('moyu-preset-changed', handler)
    return () => window.removeEventListener('moyu-preset-changed', handler)
  }, [])

  // SSE connection — replaces polling
  useEffect(() => {
    const es = new EventSource('/moyu/media/events')

    es.addEventListener('notification', (e: MessageEvent) => {
      const event: RunEvent = JSON.parse(e.data)
      const { accepted, highWater: updated } = deduplicateEvents(
        [event],
        highWaterRef.current,
      )
      if (accepted.length === 0) return
      highWaterRef.current = updated

      setProcessedEvents(prev => [...prev, ...accepted])

      for (const ev of accepted) {
        if (ev.type === 'artifact_created') {
          setArtifacts(prev => [...prev, ev.artifact])
        }
        if (ev.type === 'completed' || ev.type === 'started') {
          setPendingRequest(null)
        }
      }

      apiRequest({ operation: 'list-runs' })
        .then(result => setRuns((result as { runs: MediaRun[] }).runs))
        .catch(() => {})
    })

    es.addEventListener('server_request', (e: MessageEvent) => {
      const request: ServerRequest = JSON.parse(e.data)
      setPendingRequest(request)
    })

    es.addEventListener('connected', () => {
      setError(null)
      apiRequest({ operation: 'list-runs' })
        .then(result => setRuns((result as { runs: MediaRun[] }).runs))
        .catch(() => {})
    })

    es.onerror = () => {
      setError('SSE connection lost, reconnecting...')
    }

    return () => { es.close() }
  }, [])

  const handleApproval = useCallback(async (requestId: string, approved: boolean) => {
    setResponding(true)
    try {
      await apiRequest({ operation: 'respond', requestId, approved })
      setPendingRequest(null)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setResponding(false)
    }
  }, [])

  const handleStartMock = useCallback(async () => {
    try {
      await apiRequest({ operation: 'run-mock' })
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }, [])

  const activeRun = runs.find(
    r => r.status === 'running' || r.status === 'awaiting_user',
  )

  // 动态显隐：根据 capabilities 决定哪些 UI 入口可见
  const showMockTask = hasCapability(capabilities ?? undefined, 'tool', 'mock_media_task')
  const showApproval = hasCapability(capabilities ?? undefined, 'approval', 'confirm_publish')

  return React.createElement('div', { style: { padding: 16 } },
    React.createElement('h3', null, 'Media Workspace'),

    // Preset 切换器
    React.createElement(PresetSwitcher, { sessions }),

    // Capabilities 状态展示
    capabilities && React.createElement('div', {
      style: { fontSize: 11, color: '#666', marginBottom: 12, padding: 8, background: '#f5f5f5', borderRadius: 4 },
    },
      React.createElement('div', null,
        React.createElement('strong', null, 'Active Capabilities: '),
        capabilities.tools.join(', '),
      ),
      capabilities.approvalRequired.length > 0 && React.createElement('div', null,
        React.createElement('strong', null, 'Approval: '),
        capabilities.approvalRequired.join(', '),
      ),
      React.createElement('div', null,
        React.createElement('strong', null, 'Sources: '),
        capabilities.fileSourceTypes.join(', '),
      ),
    ),

    error && React.createElement('div', { style: { color: 'red', marginBottom: 8 } }, error),

    // Mock Task 按钮 — 仅在 capabilities 含 mock_media_task 时显示
    showMockTask && !activeRun && React.createElement(
      'button',
      { onClick: handleStartMock },
      'Run Mock Task',
    ),

    // 非 media preset 时不显示 mock task 入口的提示
    !showMockTask && React.createElement('div', {
      style: { fontSize: 12, color: '#999', fontStyle: 'italic', marginBottom: 8 },
    }, '当前 preset 无 media 专有工具（mock_media_task 不可用）'),

    // 审批 UI — 仅在 capabilities 含 confirm_publish 审批项时显示
    showApproval && pendingRequest && React.createElement('div', {
      style: { border: '1px solid #ccc', padding: 12, margin: '8px 0', borderRadius: 4 },
    },
      React.createElement('p', null,
        React.createElement('strong', null, 'Approval Required: '),
        pendingRequest.detail,
      ),
      React.createElement('p', { style: { fontSize: 12, color: '#666' } },
        `Action: ${pendingRequest.action} | TTL: ${pendingRequest.ttlMs}ms`,
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', {
          onClick: () => handleApproval(pendingRequest.requestId, true),
          disabled: responding,
        }, 'Approve'),
        React.createElement('button', {
          onClick: () => handleApproval(pendingRequest.requestId, false),
          disabled: responding,
        }, 'Reject'),
      ),
    ),

    artifacts.length > 0 && React.createElement('div', { style: { marginTop: 12 } },
      React.createElement('h4', null, 'Artifacts'),
      ...artifacts.map(a =>
        React.createElement('div', {
          key: a.artifactId,
          style: { fontSize: 12, color: '#555', marginLeft: 8 },
        },
          `[${a.kind}] ${(a.candidates ?? []).map((c) => c.content).join(', ') || '(no candidates)'} — ${a.status}`,
        ),
      ),
    ),

    runs.length > 0 && React.createElement('div', { style: { marginTop: 12 } },
      React.createElement('h4', null, 'Runs'),
      ...runs.map(run =>
        React.createElement('div', {
          key: run.runId,
          style: { border: '1px solid #eee', padding: 8, marginBottom: 4, borderRadius: 4 },
        },
          React.createElement('div', null,
            React.createElement('strong', null, run.status),
            ` | gen:${run.generation} | events:${run.events.length}`,
          ),
        ),
      ),
    ),

    processedEvents.length > 0 && React.createElement('details', { style: { marginTop: 12 } },
      React.createElement('summary', null, `Event Log (${processedEvents.length} deduplicated)`),
      React.createElement('pre', { style: { fontSize: 11, maxHeight: 200, overflow: 'auto' } },
        processedEvents.map(e =>
          `[gen:${e.generation} seq:${e.sequence}] ${e.type}${e.type === 'progress' ? `: ${e.message}` : ''}`,
        ).join('\n'),
      ),
    ),
  )
}

//#endregion

//#region 设置与视频库

function useCapabilities(): SessionCapabilities | null {
  const [capabilities, setCapabilities] = useState<SessionCapabilities | null>(null)
  useEffect(() => {
    const fetchCaps = () => {
      const preset = (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__moyuActivePreset as string) || 'moyu'
      apiRequest({ operation: 'capabilities', preset })
        .then(result => setCapabilities((result as { capabilities: SessionCapabilities }).capabilities))
        .catch(() => {})
    }
    fetchCaps()
    const handler = () => fetchCaps()
    window.addEventListener('moyu-preset-changed', handler)
    return () => window.removeEventListener('moyu-preset-changed', handler)
  }, [])
  return capabilities
}

async function captureThumbnail(fileId: string): Promise<boolean> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = `/moyu/media/${fileId}`
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('video load failed'))
    })
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    video.currentTime = duration > 0 ? duration * 0.1 : 0
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      video.onerror = () => reject(new Error('video seek failed'))
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, video.videoWidth)
    canvas.height = Math.max(1, video.videoHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (!blob) return false
    const response = await fetch(`/moyu/media/${fileId}/thumbnail`, {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg' },
      body: blob,
    })
    return response.ok || response.status === 204
  } catch {
    return false
  } finally {
    video.src = ''
    video.load()
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function MediaSettingsPanel(): React.ReactElement | null {
  const capabilities = useCapabilities()
  const showLibrary = hasCapability(capabilities ?? undefined, 'tool', 'video_scan')
  const [directories, setDirectories] = useState<DirectoryView[]>([])
  const [suffixes, setSuffixes] = useState('.srt, .txt')
  const [threshold, setThreshold] = useState('3')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const result = await apiRequest({ operation: 'settings-get' }) as {
      directories: DirectoryView[]
      subtitleSuffixes: string[]
      inventoryThreshold?: number
    }
    setDirectories(result.directories)
    setSuffixes(result.subtitleSuffixes.join(', '))
    if (typeof result.inventoryThreshold === 'number') setThreshold(String(result.inventoryThreshold))
  }, [])

  useEffect(() => {
    if (!showLibrary) return
    refresh().catch((e) => setError(String((e as Error).message ?? e)))
  }, [showLibrary, refresh])

  if (!showLibrary) return null

  const addDirectory = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest({ operation: 'settings-pick-directory' }) as { canceled?: boolean; directories?: DirectoryView[] }
      if (!result.canceled && result.directories) setDirectories(result.directories)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const removeDirectory = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest({ operation: 'settings-remove-directory', id }) as { directories: DirectoryView[] }
      setDirectories(result.directories)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const saveSuffixes = async () => {
    setBusy(true)
    setError(null)
    try {
      const list = suffixes.split(/[,\s]+/).filter(Boolean)
      const result = await apiRequest({ operation: 'settings-set-suffixes', subtitleSuffixes: list }) as { subtitleSuffixes: string[] }
      setSuffixes(result.subtitleSuffixes.join(', '))
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return React.createElement('div', { style: { marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' } },
    React.createElement('h4', null, '视频库设置'),
    error && React.createElement('div', { style: { color: 'red', marginBottom: 8 } }, error),
    React.createElement('div', { style: { fontSize: 12, color: '#666', marginBottom: 8 } }, '视频目录（只显示名称，路径留在 Host）'),
    ...directories.map((dir) =>
      React.createElement('div', {
        key: dir.id,
        style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 },
      },
        React.createElement('span', null, dir.label),
        React.createElement('button', { disabled: busy, onClick: () => void removeDirectory(dir.id) }, '移除'),
      ),
    ),
    React.createElement('button', { disabled: busy, onClick: () => void addDirectory() }, '添加目录'),
    React.createElement('div', { style: { marginTop: 12, fontSize: 12, color: '#666' } }, '字幕后缀'),
    React.createElement('input', {
      value: suffixes,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSuffixes(e.target.value),
      style: { width: '100%', margin: '4px 0' },
    }),
    React.createElement('button', { disabled: busy, onClick: () => void saveSuffixes() }, '保存后缀'),
    React.createElement('div', { style: { marginTop: 12, fontSize: 12, color: '#666' } }, '库存不足阈值（已完成未发布视频数低于此值时，请用独立会话任务做提醒）'),
    React.createElement('input', {
      type: 'number',
      min: 1,
      max: 99,
      value: threshold,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setThreshold(e.target.value),
      style: { width: 80, margin: '4px 8px 4px 0' },
    }),
    React.createElement('button', {
      disabled: busy,
      onClick: () => {
        void (async () => {
          setBusy(true)
          setError(null)
          try {
            const result = await apiRequest({ operation: 'settings-set-threshold', inventoryThreshold: Number(threshold) }) as { inventoryThreshold: number }
            setThreshold(String(result.inventoryThreshold))
          } catch (e) {
            setError(String((e as Error).message ?? e))
          } finally {
            setBusy(false)
          }
        })()
      },
    }, '保存阈值'),
  )
}

function VideoLibraryView(): React.ReactElement {
  const capabilities = useCapabilities()
  const showLibrary = hasCapability(capabilities ?? undefined, 'tool', 'video_scan')
  const [videos, setVideos] = useState<VideoListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [subtitlePreview, setSubtitlePreview] = useState<string>('')
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  const loadList = useCallback(async (rescan: boolean) => {
    const result = await apiRequest({ operation: rescan ? 'scan' : 'list' }) as { videos: VideoListItem[] }
    setVideos(result.videos)
    return result.videos
  }, [])

  useEffect(() => {
    if (!showLibrary) return
    loadList(true).catch((e) => setError(String((e as Error).message ?? e)))
  }, [showLibrary, loadList])

  useEffect(() => {
    if (!showLibrary) return
    let cancelled = false
    const run = async () => {
      for (const video of videos) {
        if (cancelled) return
        const url = `/moyu/media/${video.fileId}/thumbnail`
        if (video.hasThumbnail) {
          setThumbs((prev) => (prev[video.fileId] ? prev : { ...prev, [video.fileId]: url }))
          continue
        }
        const ok = await captureThumbnail(video.fileId)
        if (cancelled) return
        if (ok) setThumbs((prev) => ({ ...prev, [video.fileId]: `${url}?t=${Date.now()}` }))
      }
    }
    void run()
    return () => { cancelled = true }
  }, [videos, showLibrary])

  if (!showLibrary) {
    return React.createElement('div', {
      'data-moyu-media-library': 'hidden',
      style: { padding: 24, color: '#888' },
    }, '当前工作台无视频库能力')
  }

  const openDetails = async (video: VideoListItem) => {
    setSelected(video.fileId)
    setSubtitlePreview('')
    try {
      const result = await apiRequest({ operation: 'subtitle-text', fileId: video.fileId }) as { files: Array<{ fileName: string; text: string }> }
      setSubtitlePreview(result.files.map((f) => `--- ${f.fileName} ---\n${f.text}`).join('\n\n') || '（无字幕）')
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  return React.createElement('div', {
    'data-moyu-media-library': 'visible',
    style: { padding: 24, height: '100%', overflow: 'auto' },
  },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 } },
      React.createElement('h3', { style: { margin: 0 } }, '视频库'),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', { onClick: () => void loadList(true).catch((e) => setError(String((e as Error).message ?? e))) }, '刷新索引'),
        React.createElement('button', {
          onClick: () => window.dispatchEvent(new CustomEvent('moyu-open-media-settings')),
        }, '打开设置'),
      ),
    ),
    error && React.createElement('div', { style: { color: 'red', marginBottom: 8 } }, error),
    videos.length === 0 && React.createElement('div', { style: { color: '#888' } }, '还没有视频。在设置里添加目录后刷新。'),
    React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 },
    },
      ...videos.map((video) =>
        React.createElement('button', {
          key: video.fileId,
          onClick: () => void openDetails(video),
          style: {
            textAlign: 'left',
            border: selected === video.fileId ? '2px solid #4a90d9' : '1px solid #ddd',
            borderRadius: 8,
            padding: 8,
            background: '#fff',
            cursor: 'pointer',
          },
        },
          thumbs[video.fileId]
            ? React.createElement('img', {
              src: thumbs[video.fileId],
              alt: '',
              style: { width: '100%', height: 100, objectFit: 'cover', borderRadius: 4, background: '#111' },
            })
            : React.createElement('div', {
              style: { height: 100, borderRadius: 4, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#888' },
            }, '生成缩略图…'),
          React.createElement('div', { style: { fontWeight: 600, marginTop: 6, fontSize: 13 } }, video.fileName),
          React.createElement('div', { style: { fontSize: 11, color: '#666' } },
            `${formatDuration(video.durationMs)} · ${formatSize(video.size)}`,
          ),
          video.subtitles.length > 0 && React.createElement('div', { style: { fontSize: 11, color: '#4a90d9' } },
            video.subtitles.map((s) => s.fileName).join(', '),
          ),
        ),
      ),
    ),
    selected && React.createElement('pre', {
      style: { marginTop: 16, fontSize: 12, maxHeight: 240, overflow: 'auto', background: '#f7f7f7', padding: 12, borderRadius: 8 },
    }, subtitlePreview),
  )
}

function ArtifactPanel(): React.ReactElement | null {
  const capabilities = useCapabilities()
  const show = hasCapability(capabilities ?? undefined, 'tool', 'media_artifact_save')
  const [artifacts, setArtifacts] = useState<MediaArtifact[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const result = await apiRequest({ operation: 'list-artifacts' }) as { artifacts: MediaArtifact[] }
    setArtifacts(result.artifacts)
  }, [])

  useEffect(() => {
    if (!show) return
    refresh().catch((e) => setError(String((e as Error).message ?? e)))
    const es = new EventSource('/moyu/media/events')
    es.addEventListener('notification', (e: MessageEvent) => {
      const event = JSON.parse(e.data) as RunEvent
      if (event.type === 'artifact_created') {
        setArtifacts((prev) => {
          if (prev.some((item) => item.artifactId === event.artifact.artifactId)) return prev
          return [...prev, event.artifact]
        })
      }
    })
    return () => { es.close() }
  }, [show, refresh])

  if (!show) {
    return React.createElement('div', { 'data-moyu-artifact-panel': 'hidden' })
  }

  const setStatus = async (artifactId: string, status: 'kept' | 'discarded') => {
    setError(null)
    try {
      const result = await apiRequest({ operation: 'artifact-set-status', artifactId, status }) as { artifact: MediaArtifact }
      setArtifacts((prev) => prev.map((item) => item.artifactId === artifactId ? result.artifact : item))
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  return React.createElement('div', {
    'data-moyu-artifact-panel': 'visible',
    style: { marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' },
  },
    React.createElement('h4', null, '产物'),
    error && React.createElement('div', { style: { color: 'red' } }, error),
    artifacts.length === 0 && React.createElement('div', { style: { fontSize: 12, color: '#888' } }, '还没有产物。模型调用 media_artifact_save 后会出现在这里。'),
    ...artifacts.map((artifact) =>
      React.createElement('div', {
        key: artifact.artifactId,
        'data-artifact-id': artifact.artifactId,
        'data-artifact-status': artifact.status,
        style: { border: '1px solid #eee', borderRadius: 6, padding: 8, marginBottom: 8, fontSize: 12 },
      },
        React.createElement('div', null,
          React.createElement('strong', null, artifact.kind),
          ` · r${artifact.revision} · ${artifact.status}`,
        ),
        React.createElement('div', { style: { color: '#555', margin: '4px 0' } },
          (artifact.candidates ?? []).map((c) => c.content).join(' / ') || '(no candidates)',
        ),
        artifact.status === 'draft' && React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', { onClick: () => void setStatus(artifact.artifactId, 'kept') }, '保留'),
          React.createElement('button', { onClick: () => void setStatus(artifact.artifactId, 'discarded') }, '淘汰'),
        ),
      ),
    ),
  )
}

function MediaSettingsRoot({ sessions }: { sessions: ClientContext['sessions'] }): React.ReactElement {
  return React.createElement('div', null,
    React.createElement(MediaSpikePanel, { sessions }),
    React.createElement(MediaSettingsPanel),
    React.createElement(ArtifactPanel),
  )
}

//#endregion

//#region Plugin 注册

export function apply(ctx: ClientContext): void {
  // 初始化默认 preset 过滤
  if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>).__moyuActivePreset) {
    (window as unknown as Record<string, unknown>).__moyuActivePreset = 'moyu'
  }

  ctx.slots.inject('settings.section' as never, () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'moyu-media-spike',
        order: 90,
        label: () => 'Media Workspace',
      } as never,
      (() => React.createElement(MediaSettingsRoot, { sessions: ctx.sessions })) as never,
    ),
  )

  ctx.slots.inject('conversation.view' as never, () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'moyu-media-library',
        order: 40,
        label: () => '视频库',
      } as never,
      VideoLibraryView as never,
    ),
  )
}

//#endregion
