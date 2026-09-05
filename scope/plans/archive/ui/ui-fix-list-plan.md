# MOYU 当前界面临时修复清单

> 状态：**已作废/清理**——2026-09-03 取消 moyu/media 双预设 → 单一工作台。F01(模式切换器)/F02(Media 侧栏)已从 overlay **移除**（commit 6152504）；F03/F05(视频库/MOV)随 media 插件归档不再适用；F04(去调试文本)如仍需要另行处理。下方进度仅为历史留存。
> 用途：逐条记录当前版本实测发现的 UI、交互与直接影响界面的功能缺口。
> 边界：本清单独立于主计划（media-workspace 已归档）；不擅自扩大范围。
> 最近更新：2026-09-01。

## 进度快照（2026-09-01 暂停时）

| 条目 | 代码 | 校验状态 | 备注 |
|------|------|---------|------|
| UI-F01 | ✅ 已实现 | ✅ 已 apply overlay + 重启 dev 实测起来 | 侧栏顶 MoyuModeSwitcher，已上线 |
| UI-F02 | ✅ 已改代码 | ⬜ 未 apply overlay / 未重启验证 | overlay + 媒体插件已改，待生效 |
| UI-F03 | ✅ 已改代码 | ◐ media tsc 通过；full verify 未跑完 | Host fs.watch + SSE push + client 订阅 |
| UI-F04 | ◐ 部分实现 | ◐ media tsc 通过；full verify 未跑完 | 见下方分解；深水区未做 |
| UI-F05 | ✅ 已改代码 | ◐ media tsc 通过；full verify 未跑完 | .mov 扫描 + content-type + 编码提示 |

**待办（恢复时先做）**：
1. `npm run apply-codex-web-overlay`（让 F01/F02 的 overlay 改动进 node_modules）→ `verify-overlay-applied` 门禁。
2. 跑完 `npm --prefix packages/dsh-plugin-media run verify`（tsc+tsdown+harness）——被中断，结果未知；**harness 可能需要跟 F02/F04 面板改动同步更新**（视频库从 conversation.view 改成 surface.media-library、CapabilitiesView 取代原始调试文本，旧断言可能失配）。
3. `npm run build:dsh-runtime`（preset 正名 MOYU Chat/Media 进闭包）。
4. 重启 dev 实测 F02–F05。

## 已改文件清单（本轮）

- `vendor/codex-web-overlay/ui-workspace/client.js`：F01 `MoyuModeSwitcher` + `useMoyuMode`/`setMoyuMode`；F02 `SurfaceNavigation` 模式化（Media 加「视频库」一级入口）、`SurfaceView` 渲染 `surface.media-library`。
- `packages/dsh-plugin-media/src/scan.ts`：F05 `VIDEO_EXTENSIONS`（.mp4/.mov）。
- `packages/dsh-plugin-media/src/index.ts`：F05 serveFile content-type 按 .mov→video/quicktime；F03 fs.watch + 防抖 + `media-updated` SSE 推送 + dispose 清理。
- `packages/dsh-plugin-media/src/client.tsx`：F05 缩略图三态（超时兜底/编码不支持提示）；F03 订阅 `media-updated` 刷新；F02 视频库改注册 `surface.media-library`（不再是 conversation.view tab）；F04 `CapabilitiesView`（Host 真值可读 + 内部 ID 折叠）取代原始调试文本。
- `scripts/build-dsh-runtime.mjs`：F04 preset 正名 MOYU Chat / MOYU Media。

## 执行顺序（按依赖）

```
UI-F01 侧边栏品牌模式切换器  ← 基石（F02/F04 依赖“模式”提到壳层）
UI-F02 Media 左侧功能导航
UI-F04 正式 Preset + 设置入口
UI-F03 视频库实时监听（相对独立）
UI-F05 视频库 MOV 支持（独立）
```

## 集成点勘定（overlay 勘察结论）

- 上游**未暴露品牌区/侧栏插槽**（renderSlot 仅 sidebar.footer.action / sidebar.settings / sidebar.workspaces）。
- 侧栏顶部导航是 overlay `vendor/codex-web-overlay/ui-workspace/client.js` 的 `SurfaceNavigation`（已 MOYU 定制：conversation/scheduled/plugins 三项）。
- 由 `WorkspaceBrowser`（同文件）渲染，持有 `surface` / `selectSurface`。
- 会话按 preset 隔离的真源是同文件 `sessionVisible` + `window.__moyuActivePreset`（决策 19）。
- 结论：F01/F02 在 `WorkspaceBrowser` / `SurfaceNavigation` 直接改；模式信号复用 `window.__moyuActivePreset` + `moyu-preset-changed` 事件，不新造来源。

---

## UI-F01 侧边栏品牌模式切换器

- 参考 Codex App，在侧边栏顶部点击 Logo 或品牌名称切换模式。
- 默认 `MOYU Chat`，切换后 `MOYU Media`。
- 切换后侧边栏导航、主内容布局、默认入口、可见能力整体变化（非普通选项卡）。
- 两模式同属一个应用壳；新会话归属当前模式，会话列表按模式隔离。

**验收**：首次启动进入 Chat；品牌区可切到 Media 并同步改布局；切回恢复 Chat，两模式会话不串场。

**状态**：✅ 已实现并实测起来。侧栏顶 `MoyuModeSwitcher`（● MOYU Chat / ● MOYU Media），写 `window.__moyuActivePreset` + 广播 `moyu-preset-changed`，会话隔离由 `sessionVisible` 消费；切换联动默认入口（配合 F02）。已 apply overlay + 门禁通过 + 重启 dev。

## UI-F02 MOYU Media 左侧功能导航

- “视频库”不是会话顶部“对话/轨迹”同级选项卡。
- 切到 Media 后显示 Media 专用左侧导航，视频库为一级入口。
- 点击视频库用完整主内容区；切回 Chat 恢复 Chat 导航。
- 视频库状态独立于会话，保持筛选、滚动、选择。

**验收**：Media 左侧可直接进视频库，会话顶部不再出现“视频库”。

**状态**：✅ 已改代码，⬜ 未 apply/重启验证。做法：`SurfaceNavigation` 按 `useMoyuMode()` 分模式渲染——Media 加「视频库」一级入口（id `media-library`）；`SurfaceView` 新增 `surface==="media-library"` → `renderSlot("surface.media-library")`；媒体插件把视频库从 `conversation.view` 改注册为 `surface.media-library`。ui-layout 对非 conversation surface 走 `renderSlot("surface",{surface})`、`setSurface` 无白名单，可行性已验证。**恢复须 apply overlay + 重启。**

## UI-F03 视频库实时识别与自动更新

- Host 监听已配置目录内视频与同名字幕的新增/删除/重命名/更新。
- 变化合并与防抖，避免复制大文件时反复扫描或读半成品。
- 优先增量更新，Client 收主动通知，不轮询、不直接访问文件系统。
- 自动更新时保持筛选/排序/滚动/选择；目录不可访问明确提示。
- 手动刷新仅作监听失效/外接盘重连兜底。

**验收**：目录内容变化后无需手动刷新，视频库在合理延迟内稳定更新。

**状态**：✅ 已改代码，◐ media tsc 通过 / full verify 未跑完。做法：Host 对每个已配置目录 `fs.watch({recursive:true})`（macOS 支持），事件 800ms 防抖 + 合并（重扫期间再来的事件排队一次），重扫后 `sseBroadcast('media-updated')`；Client 视频库订阅该事件 → 拉最新列表，selected 以 fileId 保留、原地更新。增删目录后重建 watcher，dispose 清理。**未做**：目录不可访问的明确 UI 提示（当前仅 Host warn 日志）。

## UI-F04 正式制作模式 Preset 及其设置入口

- 系统提示词已存在；缺口是尚未把提示词、Tool、Skill 装配成正式 Preset。
- 正式制作 `MOYU Chat` 与 `MOYU Media` Preset。
- 设置中分别展示各 Preset 真实生效的提示词/Tool/Skill/来源/状态/授权要求。
- 内置安全提示与用户可编辑层分离；修改需说明对当前会话还是新会话生效。
- 删除默认界面 `Active Capabilities / Approval / Sources` 原始调试文本，内部 ID 仅放高级信息。
- 设置显示必须来自 Host 真值，与模式切换、会话 preset、真实工具面一致。

**验收**：两个正式 Preset 均能正确装配提示词/Tool/Skill，设置页可查看真实生效组合。

**状态**：◐ 部分实现。
**已做**：
- 删除默认界面「Active Capabilities / Approval / Sources」原始调试文本，改为 `CapabilitiesView`——Host 真值（getSessionCapabilities）的人类可读呈现（工具/需要确认/文件来源/技能，带中文标签），内部 ID 收进「高级信息」折叠。
- preset 正名 MOYU Chat / MOYU Media（build-dsh-runtime 的 preset.yml）。
**未做（深水区，与既定架构冲突，需另行决策）**：
- 每 preset 的提示词/Tool/Skill **深度装配**：当前插件由 Profile 全局装载（media-workspace 决策 M1-1），preset 模板只声明最小组件；要做“每 preset 独立装配”需重开该决策。
- 设置页展示**系统提示词正文**：需新增 Host preset-introspection 路由返回生效提示词（persona 正文在 media-prompt.ts / agent-instructions，但无对外 introspection 接口）。
- 「修改对当前会话还是新会话生效」的编辑层：未做。

## UI-F05 视频库支持 MOV

- 扫描器识别大小写 `.mov`，接入现有 sourceId、fileId、目录监听。
- 读取时长/分辨率/编码元数据，生成缩略图并支持同名字幕。
- 可解码 MOV 可预览与 seek，Range 行为与其它视频一致。
- ProRes/HEVC 等不能直接播放的编码显示明确提示，预留代理预览或转码入口。
- 只增扩展名但不能读取/预览/处理不算完成。

**验收**：分别用可直接播放与需降级处理的 MOV 实测；两者均能入库且不白屏、无限加载或卡死。

**状态**：✅ 已改代码，◐ media tsc 通过 / full verify 未跑完。做法：`scan.ts` `VIDEO_EXTENSIONS`（.mp4/.mov 大小写不敏感），复用现有 sourceId/fileId/时长(mvhd)/字幕/监听；`serveFile` 按 .mov→`video/quicktime`；缩略图三态——`captureThumbnail` 加 15s 超时兜底，ProRes/HEVC 等不可解码或挂死时返回 `undecodable`，视频库显示「⚠ 编码不受支持，无法直接预览」而非无限转圈。**待**：用真实可播/需降级 MOV 各一实测（含 ProRes）。
