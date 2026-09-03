/**
描述: MOYU DSH 应用壳 —— host 侧占位（C3-d）。
职责: 本包的实体在客户端（client.tsx）：注册"Mods 管理 / 内核 / 更新"三个设置分区。
     host 侧不注册任何 Tool 或路由（Mods 路由在 @moyu/dsh-plugin-mods-api），
     因此不影响 C2-g host-audit 工具面。
契约: scope/plans/active/moyu-dsh-core-and-mod-platform-plan.md C3-d。
*/
export const name = 'moyu-shell'

export function apply() {}
