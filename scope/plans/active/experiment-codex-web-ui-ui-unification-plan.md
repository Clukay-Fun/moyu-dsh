# experiment/codex-web-ui · MOYU 0.1.0 主界面统一与开发态收口计划

> 状态：进行中（UI-01～UI-06 一次性执行，开发态验收，不生成 DMG）。
> 分支：`experiment/codex-web-ui`。最近更新：2026-08-26。
> 关联：调度任务插件（SCHEDULE-01~05 已完成，功能与验收纳入本计划；原独立计划已清理）。

## 0. 范围与冻结

将 Codex 风格 UI 与 `scheduled-tasks` 正式纳入 **0.1.0**。冻结调度功能，不再增加新能力。

保留功能面：新会话、工作区、会话管理、安排任务、插件、设置、图片/PDF Tool、截图入口。

**停止线（明确不做）**：RRULE、原生桌面通知、自动重试/指数退避、多设备同步、历史分页、
自由表达式周期、截图 Flow 重做、其它新功能。这些进入后续需求池，不影响现版本使用。

## 1. 实施切片

- **UI-01 计划与基线冻结**：本计划纳入 0.1.0，删除“实验/待推送”等过时描述；建立浅/深、宽/窄、
  侧栏两态视觉基线（见 `scripts/capture-ui-baseline.mjs`）。
- **UI-02 品牌与全局视觉系统**：所有用户可见位置统一 MOYU；统一描述
  “MOYU 是一款基于 DeepSeek Harness 开发的智能桌面工作台。”；删除 DSH 欢迎注意事项、预览版、
  FishLogo、BrandWordmark 与用户可见 DeepSeek Harness 残留（技术包名/协议/许可证不改）；
  统一字体/颜色/间距/圆角/边框/阴影/焦点环/禁用态；补齐 Lucide 内联映射；动效仅状态反馈，
  禁 `transition: all`，支持 reduced-motion。
- **UI-03 应用壳与侧栏**：单一“新会话”入口；展开=图标+文字，收起=图标+tooltip；展开/收起始终
  可控、窄宽不丢按钮；导航顺序固定 新会话→安排任务→插件；工作区搜索/视图/新增覆盖选择/取消/
  重复/无权限/重启预选；会话归属当前工作区，无“置顶/最近”分组；hover 显示置顶/归档；右键菜单
  含置顶/重命名/标记未读/归档/移动工作区/分享/复制/复制 Markdown/新窗口打开；删重复省略号入口；
  置顶/归档/未读跨重启一致。
- **UI-04 新会话与 Composer**：修复 Hero Logo/字标/标语重叠缺失与响应式错位；工作区选择/输入/
  模型选择/发送层级清晰，长模型名与窄窗口不挤压输入；截图按钮统一 MOYU 取景框；空白会话连点不
  生成重复空白；当前空白会话选中态正确；附件/发送/停止/编辑/复制/删除/错误反馈的 hover/active/
  focus/disabled 齐备。
- **UI-05 安排任务与其余可见页面**：安排任务沿用全局系统；周期字段仅适用规则显示；时区/下次运行/
  失败原因/未读/运行中清晰；长文本窄窗不破版；设置/插件/关于/凭据引导/无数据/加载/403/Host 不可用
  统一品牌与组件；未实现能力不保留可点击入口，不能执行的操作明确禁用并说明。
- **UI-06 集中查错与修复**：完成界面后系统 sweep；主路径（首次启动→配置→新增工作区→新会话→
  发送→截图→置顶/归档/复制→安排任务 CRUD→运行历史→设置）与状态矩阵（浅/深、宽/窄、侧栏两态、
  空/长数据、加载/成功/取消/失败、重启恢复）；修控制台错误、静默失败、重复入口、不可逆状态、
  遮挡、溢出、焦点丢失、错误品牌文案。只修影响使用或一致性的问题。

## 2. 接口与兼容约束

- `scheduled-tasks` 的 Host 路由、`ScheduleSpec`、v2 存储、运行状态机冻结，UI 重构不改语义。
- Client 仍只经 `POST /moyu/scheduled-tasks` 访问 Host；不新增 Electron IPC / Node 权限 / 第二份状态。
- Overlay 以 `vendor/codex-web-overlay` 为维护真值，经 `apply-codex-web-overlay.mjs` 与
  `patch-upstream-brand.mjs` 进入运行闭包。
- renderer 保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
- 现有用户数据/工作区/会话/置顶/归档/未读/任务存储必须兼容，无迁移丢失。
- 每片独立约定式提交；本地 harness 与视觉证据不提交。

## 3. 验证与完成标准

- 每片：相关类型检查、bundle 构建、overlay 应用、门禁；最终 `npm run build`。
- 最终：完整 Node + live acceptance，复跑 scheduled-tasks Host/Client harness。
- Electron 开发态真机验证主要点击路径，控制台无新增错误，Host 路由无异常 4xx/5xx。
- 六个 overlay bundle 扫描品牌残留、运行时 Lucide require、死入口、旧文案。
- 视觉验收覆盖浅/深、宽/窄、侧栏两态与关键弹窗/菜单。
- `git diff --check` 干净；工作树除约定不提交的 harness 外无遗漏。
- 本轮不执行 `build:mac`/DMG/签名/公证/升级安装；保留到发布收口。
- 完成判据：主要功能稳定可用、无阻塞 bug、无重复入口、无明显错位或品牌残留，此后停止 UI 扩展。
