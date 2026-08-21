// 唯一 Moyu profile 的产品属性。Tool 白名单的单一来源：
// composition（cordis.patch.yml 的 insert 条目）实际注册的工具集必须与这里一致，
// 三个插件的 session/created 守卫都从本常量校验，漂移即拒绝创建会话。
// 新增/删除 Tool 时先改 composition，再改这里——两处永远一起动。
export const MOYU_TOOL_WHITELIST = Object.freeze([
  'ask_user_question',
  'image_convert',
  'pdf_process',
  'screenshot_capture'
])
