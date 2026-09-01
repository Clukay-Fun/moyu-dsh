/**
描述: 自媒体工作台运行时能力发现。
主要功能:
    - 按 preset 通告 SessionCapabilities
    - 供 Host 路由与 Client 面板判断某项能力是否在场
会话列表 preset 过滤不在本文件。真源是 overlay
`vendor/codex-web-overlay/ui-workspace/client.js` 的 sessionVisible。
*/

import type { SessionCapabilities } from './types.js'

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
      tools: ['video_scan', 'video_subtitle_read', 'media_artifact_save', 'moyu_schedule_create', 'moyu_schedule_run_now', 'image_convert', 'screenshot_capture'],
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
