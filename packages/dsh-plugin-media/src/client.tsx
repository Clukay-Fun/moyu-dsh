import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import React, { useState, useEffect, useCallback, useRef } from 'react'

import type {
  MediaRun,
  RunEvent,
  ServerRequest,
  MediaArtifact,
  SessionCapabilities,
} from './types.js'

import {
  getSessionCapabilities,
  hasCapability,
  buildPresetSessionIndex,
  filterSessionListByPreset,
  filterSearchResultsByPreset,
  createPresetSessionSelector,
} from './session-filter.js'

export {
  getSessionCapabilities,
  hasCapability,
  buildPresetSessionIndex,
  filterSessionListByPreset,
  filterSearchResultsByPreset,
  createPresetSessionSelector,
}

export type { SessionCapabilities }

export const name = 'moyu-media-client'

export const inject = ['slots'] as const

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

function MediaSpikePanel(): React.ReactElement {
  const [runs, setRuns] = useState<MediaRun[]>([])
  const [error, setError] = useState<string | null>(null)
  const [responding, setResponding] = useState(false)
  const [pendingRequest, setPendingRequest] = useState<ServerRequest | null>(null)
  const highWaterRef = useRef<Map<number, number>>(new Map())
  const [processedEvents, setProcessedEvents] = useState<RunEvent[]>([])
  const [artifacts, setArtifacts] = useState<MediaArtifact[]>([])

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

      // Refresh runs for status display
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
      // Fetch current state on connect
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

  return React.createElement('div', { style: { padding: 16 } },
    React.createElement('h3', null, 'Media Protocol Spike (M0)'),

    error && React.createElement('div', { style: { color: 'red', marginBottom: 8 } }, error),

    !activeRun && React.createElement(
      'button',
      { onClick: handleStartMock },
      'Run Mock Task',
    ),

    pendingRequest && React.createElement('div', {
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
          `[${a.kind}] ${a.candidates?.join(', ') ?? '(no candidates)'} — ${a.status}`,
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

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.section' as never, () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'moyu-media-spike',
        order: 90,
        label: () => 'Media Protocol Spike',
      } as never,
      MediaSpikePanel as never,
    ),
  )
}
