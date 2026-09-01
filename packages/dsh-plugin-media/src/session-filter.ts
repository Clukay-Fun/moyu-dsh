/**
描述: 自媒体工作台会话过滤与能力发现模块。
主要功能:
    - 按 agentPreset（moyu / media / other）建立会话集中索引
    - 提供纯函数会话列表快照投影与 selector
    - 搜索结果按 preset 会话集合求交集
    - 运行时 SessionCapabilities 能力通告与解析
*/

import type { SessionCapabilities } from './types.js'

//#region 类型定义

export interface SessionSummaryLike {
  id: string
  agentPreset?: string
  blank?: boolean
  origin?: string
  updatedAt?: number
  displayTitle?: string
  [key: string]: unknown
}

export interface SessionListSnapshotLike {
  byId: Record<string, SessionSummaryLike>
  ids: string[]
  current?: string
  phase?: string
  [key: string]: unknown
}

export interface PresetSessionIndex {
  byPreset: Map<string, Set<string>>
  other: Set<string>
  all: Set<string>
}

//#endregion

//#region 会话集中索引与过滤

/**
构建按 agentPreset 划分的集中会话索引。
用处，参数:
    - list: 会话列表快照 (包含 byId, ids)

功能:
    - 遍历所有会话，按 agentPreset 归类到 Map 中；
    - 无 agentPreset 或未知格式的旧会话统一归入 other 集合，不猜测归属。
*/
export function buildPresetSessionIndex(list: SessionListSnapshotLike): PresetSessionIndex {
  const byPreset = new Map<string, Set<string>>()
  const other = new Set<string>()
  const all = new Set<string>()

  if (!list || !Array.isArray(list.ids) || !list.byId) {
    return { byPreset, other, all }
  }

  for (const id of list.ids) {
    all.add(id)
    const summary = list.byId[id]
    if (!summary) continue
    const preset = summary.agentPreset
    if (typeof preset === 'string' && preset.trim().length > 0) {
      const key = preset.trim()
      let set = byPreset.get(key)
      if (!set) {
        set = new Set<string>()
        byPreset.set(key, set)
      }
      set.add(id)
    } else {
      other.add(id)
    }
  }

  return { byPreset, other, all }
}

/**
依据当前 activePreset 过滤 session list 快照，生成对应视图。
用处，参数:
    - list: 原始会话列表快照
    - activePreset: 当前激活的预设标识（如 'moyu' | 'media' | 'other'），未指定则返回全量

功能:
    - 依据集中索引筛选出符合 preset 的 ids 和 byId；
    - 不修改底层真实数据，仅产生只读视图快照。
*/
export function filterSessionListByPreset<T extends SessionListSnapshotLike>(
  list: T,
  activePreset?: string
): T {
  if (!activePreset) return list
  const index = buildPresetSessionIndex(list)
  let allowedIds: Set<string>
  if (activePreset === 'other') {
    allowedIds = index.other
  } else {
    allowedIds = index.byPreset.get(activePreset) ?? new Set<string>()
  }

  const nextIds = list.ids.filter((id) => allowedIds.has(id))
  const nextById: Record<string, SessionSummaryLike> = {}
  for (const id of nextIds) {
    if (list.byId[id]) {
      nextById[id] = list.byId[id]
    }
  }

  return {
    ...list,
    ids: nextIds,
    byId: nextById,
  }
}

/**
搜索结果过滤：将搜索结果与当前 preset 的会话 ID 集取交集。
用处，参数:
    - items: 搜索结果列表（每个 item 包含 id 或 sessionId）
    - allowedIds: 当前 preset 允许的会话 ID 集合

功能:
    - 过滤排除不在当前 preset 范围内的搜索匹配项。
*/
export function filterSearchResultsByPreset<T extends { id?: string; sessionId?: string }>(
  items: T[],
  allowedIds: Set<string>
): T[] {
  if (!Array.isArray(items) || !allowedIds) return []
  return items.filter((item) => {
    const id = item.id || item.sessionId
    return id ? allowedIds.has(id) : false
  })
}

/**
创建针对特定 preset 的缓存 selector 函数。
用处，参数:
    - preset: 目标 preset 名称

功能:
    - 返回可复用的 selector，避免在 React render 循环中重复计算。
*/
export function createPresetSessionSelector(preset?: string) {
  let lastList: SessionListSnapshotLike | null = null
  let lastResult: SessionListSnapshotLike | null = null

  return (list: SessionListSnapshotLike): SessionListSnapshotLike => {
    if (list === lastList && lastResult) {
      return lastResult
    }
    lastList = list
    lastResult = filterSessionListByPreset(list, preset)
    return lastResult
  }
}

//#endregion

//#region 运行时能力发现

/**
根据 preset 返回其支持的 SessionCapabilities。
用处，参数:
    - preset: 预设名称 ('media' | 'moyu' 等)

功能:
    - 通告当前 preset 在场的 tools, skills, fileSourceTypes 以及 approvalRequired 列表。
*/
export function getSessionCapabilities(preset?: string): SessionCapabilities {
  if (preset === 'media') {
    return {
      tools: ['mock_media_task', 'image_convert', 'screenshot_capture'],
      skills: [],
      fileSourceTypes: ['project-source', 'session-attachment', 'job-result', 'scheduled-input'],
      approvalRequired: ['confirm_publish'],
    }
  }
  // 默认 / moyu preset
  return {
    tools: ['image_convert', 'pdf_process', 'screenshot_capture'],
    skills: [],
    fileSourceTypes: ['session-attachment'],
    approvalRequired: [],
  }
}

/**
检查某项 capability 是否在 capabilities 中就绪。
用处，参数:
    - caps: SessionCapabilities 对象
    - kind: 'tool' | 'skill' | 'sourceType' | 'approval'
    - name: 目标名称

功能:
    - 判定特定能力是否存在，供 Client 端动态控制 UI 显隐。
*/
export function hasCapability(
  caps: SessionCapabilities | undefined,
  kind: 'tool' | 'skill' | 'sourceType' | 'approval',
  name: string
): boolean {
  if (!caps) return false
  switch (kind) {
    case 'tool':
      return caps.tools.includes(name)
    case 'skill':
      return caps.skills.includes(name)
    case 'sourceType':
      return caps.fileSourceTypes.includes(name)
    case 'approval':
      return caps.approvalRequired.includes(name)
    default:
      return false
  }
}

//#endregion
