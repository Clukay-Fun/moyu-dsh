/**
描述: Moyu profile 包入口。
说明（C2-g g5，2026-09-03 单一工作台）：
    原 per-preset per-session 工具面守卫（assertMoyuToolSurface / PRESET_REQUIRED_TOOLS /
    readPresetId / MOYU_TOOL_WHITELIST / shell denylist）已移除。取消 moyu/media 双预设后，
    工具面完整性改由 **host-ready 全局精确审计** 接管：
      - Main 启动生成 effective-tool-policy 快照（核心内置台账 + 已启用 Mod 声明）；
      - `@moyu/dsh-plugin-tool-audit`（root composition 最后一项）挂 __moyuToolAudit；
      - worker 在 `dsh web:` 就绪闸门同步审计 root-global，漂移/缺失即拒绝启动本代 Host。
    全局精确审计比旧的「必备子集 + shell denylist」更强：任何不在 globalExpected 的 Tool
    （含 shell 类）都会被拒。故本文件不再导出守卫函数。
    profile 的 composition 正本是 `cordis.patch.yml`。
*/

export {}
