// 唯一 Moyu profile 的产品属性与会话级工具面守卫。
//
// Moyu 必备工具清单：三个内置能力（image_convert、pdf_process、screenshot_capture）
// 必须始终在工具面中在场，否则拒绝创建会话。
// 守卫从当前会话的 Agent Scope / 上下文中读取真实工具面，无法获取时严格 fail-closed。
// 默认 moyu preset 下严禁出现任何 shell 类工具。

export const MOYU_REQUIRED_TOOLS = Object.freeze([
  'image_convert',
  'pdf_process',
  'screenshot_capture'
])

// 兼容别名
export const MOYU_TOOL_WHITELIST = Object.freeze([
  'ask_user_question',
  'image_convert',
  'pdf_process',
  'screenshot_capture'
])

// 默认（moyu）preset 下不得出现在 agent 工具面的 shell 类工具
export const MOYU_SHELL_CLASS_TOOLS = Object.freeze([
  'bash',
  'pwsh',
  'terminal',
  'str_replace_editor'
])

/** 从 session 结构中提取实际生效的 preset id；未指定时默认作为 'moyu' 处理。 */
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

/** 从 session / agent / ctx 中解析当前会话真实可见的工具名称清单。 */
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
 * 会话创建守卫：读取当前 session 的真实工具面。
 * - 必备工具必须都在（contains 语义，允许用户切换到的其它 preset 引入额外工具）；
 * - 默认 moyu preset 下严禁出现 shell 类工具；
 * - 拿不到有效工具面时必须 fail-closed 抛错拒绝创建。
 */
export function assertMoyuToolSurface(ctx, session) {
  const actual = resolveToolNames(ctx, session)
  if (!actual || !Array.isArray(actual)) {
    const error = new Error('无法可靠读取当前会话的实际工具面，拒绝创建会话 (fail-closed)')
    process.stderr.write(`[moyu] ${error.message}\n`)
    throw error
  }

  const missing = MOYU_REQUIRED_TOOLS.filter((name) => !actual.includes(name))
  if (missing.length) {
    const error = new Error(
      `moyu 必备工具缺失：工具面实际注册 [${actual.slice().sort().join(', ')}]，`
      + `必备清单 [${MOYU_REQUIRED_TOOLS.join(', ')}]，缺失 [${missing.join(', ')}]`
      + `（cordis.patch.yml 与 @moyu/dsh-profile 必须同时包含必备三件套）`
    )
    process.stderr.write(`[moyu] ${error.message}\n`)
    throw error
  }

  const preset = readPresetId(session)
  if (preset === 'moyu' || !preset) {
    const shellTools = MOYU_SHELL_CLASS_TOOLS.filter((name) => actual.includes(name))
    if (shellTools.length) {
      const error = new Error(
        `moyu 默认 preset 下出现 shell 类工具：[${shellTools.join(', ')}]；`
        + `shell 能力只能由用户主动切换到的其它 agent preset 引入，moyu 默认 surface 必须保持纯内置三件套`
      )
      process.stderr.write(`[moyu] ${error.message}\n`)
      throw error
    }
  }

  return true
}
