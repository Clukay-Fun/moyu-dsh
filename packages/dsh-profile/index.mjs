/**
描述: Moyu profile 的产品属性与多 Preset 会话级工具面守卫。
主要功能:
    - 按 preset（moyu / media）校验必备工具集
    - 未知 preset 严格 fail-closed
    - 检查并禁止默认 preset 下出现 shell 类工具
*/

//#region 常量与配置定义

export const PRESET_REQUIRED_TOOLS = Object.freeze({
  moyu: Object.freeze(['image_convert', 'pdf_process', 'screenshot_capture']),
  media: Object.freeze(['image_convert', 'screenshot_capture', 'video_scan'])
})

export const MOYU_REQUIRED_TOOLS = PRESET_REQUIRED_TOOLS.moyu

// 兼容别名
export const MOYU_TOOL_WHITELIST = Object.freeze([
  'ask_user_question',
  'image_convert',
  'pdf_process',
  'screenshot_capture'
])

// 默认（moyu / media）preset 下不得出现在 agent 工具面的 shell 类工具
export const MOYU_SHELL_CLASS_TOOLS = Object.freeze([
  'bash',
  'pwsh',
  'terminal',
  'str_replace_editor'
])

//#endregion

//#region 工具面解析与守卫校验

/**
从 session 结构中提取实际生效的 preset id；未指定时默认作为 'moyu' 处理。
用处，参数:
    - session: 当前会话对象或快照

功能:
    - 依次解析 session 事件流、header、agent 配置提取 preset id
*/
export function readPresetId(session) {
  if (!session) return 'moyu'
  // 1. 从 session 事件流中查找最新的 preset 选择事件
  if (Array.isArray(session.events)) {
    for (let i = session.events.length - 1; i >= 0; i--) {
      const ev = session.events[i]
      if (ev?.type === 'agent-preset/selected' && typeof ev.data?.agentPreset === 'string') {
        return ev.data.agentPreset
      }
    }
  }
  // 2. 从 session.header 中读取
  if (typeof session.header?.agentPreset === 'string') {
    return session.header.agentPreset
  }
  // 3. 从 agent 对象中读取
  const agent = session.agent
  if (agent) {
    const id = agent.preset?.id ?? agent.preset ?? agent.config?.presetId ?? agent.setup?.meta?.agentPreset ?? agent.meta?.agentPreset
    if (typeof id === 'string') return id
  }
  // 4. 无法明确解析时，按默认 'moyu' 收紧
  return 'moyu'
}

/**
从 session / agent / ctx 中解析当前会话真实可见的工具名称清单。
用处，参数:
    - ctx: Cordis 上下文
    - session: 会话对象

功能:
    - 读取 agent 局部 scope tools、session tools 或 ctx tools 中的 schema 工具名列表
*/
function resolveToolNames(ctx, session) {
  // 1. 优先读取 session 绑定的 agent 局部 scope tools
  const agentTools = session?.agent?.ctx?.get?.('tools') ?? session?.agent?.tools
  if (agentTools && typeof agentTools.schemas === 'function') {
    const schemas = agentTools.schemas()
    if (Array.isArray(schemas)) return schemas.map((s) => s.name)
  }
  // 2. 其次读取 session 挂载的 tools
  if (session?.tools && typeof session.tools.schemas === 'function') {
    const schemas = session.tools.schemas()
    if (Array.isArray(schemas)) return schemas.map((s) => s.name)
  }
  // 3. 再次读取上下文注册 tools
  if (ctx?.tools && typeof ctx.tools.schemas === 'function') {
    const schemas = ctx.tools.schemas()
    if (Array.isArray(schemas)) return schemas.map((s) => s.name)
  }
  return null
}

/**
会话创建守卫：读取当前 session 的真实工具面。
用处，参数:
    - ctx: Cordis 上下文
    - session: 会话对象

功能:
    - 按 preset（moyu / media）检查必备工具集是否存在（contains 语义）；
    - 未知 preset 严格 fail-closed 抛错拒绝创建；
    - 检查并严禁出现 shell 类工具；
    - 无法可靠读取工具面时 fail-closed 抛错拒绝创建。
*/
export function assertMoyuToolSurface(ctx, session) {
  const actual = resolveToolNames(ctx, session)
  if (!actual || !Array.isArray(actual)) {
    const error = new Error('无法可靠读取当前会话的实际工具面，拒绝创建会话 (fail-closed)')
    process.stderr.write(`[moyu] ${error.message}\n`)
    throw error
  }

  const preset = readPresetId(session)
  if (!preset || typeof preset !== 'string' || !Object.prototype.hasOwnProperty.call(PRESET_REQUIRED_TOOLS, preset)) {
    const error = new Error(`未知 preset [${preset}]，拒绝创建会话 (fail-closed)`)
    process.stderr.write(`[moyu] ${error.message}\n`)
    throw error
  }

  const required = PRESET_REQUIRED_TOOLS[preset]
  const missing = required.filter((name) => !actual.includes(name))
  if (missing.length) {
    const error = new Error(
      `preset [${preset}] 必备工具缺失：工具面实际注册 [${actual.slice().sort().join(', ')}]，`
      + `必备清单 [${required.join(', ')}]，缺失 [${missing.join(', ')}]`
    )
    process.stderr.write(`[moyu] ${error.message}\n`)
    throw error
  }

  if (preset === 'moyu' || preset === 'media') {
    const shellTools = MOYU_SHELL_CLASS_TOOLS.filter((name) => actual.includes(name))
    if (shellTools.length) {
      const error = new Error(
        `preset [${preset}] 下出现 shell 类工具：[${shellTools.join(', ')}]；`
        + `默认 surface 必须保持纯内置安全能力，严禁出现 shell 工具`
      )
      process.stderr.write(`[moyu] ${error.message}\n`)
      throw error
    }
  }

  return true
}

//#endregion
