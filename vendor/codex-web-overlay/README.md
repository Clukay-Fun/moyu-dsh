# codex-web-overlay（实验分支专用）

Codex 风格 Web UI 的六个上游 client bundle，构建自 `~/Program/deepseek-harness`
（tag `dsh-v0.1.1-rc.2` + `dsh-codex-web-porting-kit` overlay）。

## 覆盖内容

- Codex 风格侧边栏导航 + 多应用面：conversation / pull-requests / browser / scheduled / plugins
- 根布局 `surface` 槽位替换非聊天页的中央会话栏
- `settingsNavigation` 服务（Plugins 导航打开现有 Settings 壳）
- 会话底部工具面板（Terminal / Browser / Files）
- StatsLine 稳定高度，composer 不跳动

## 已知适配（相对套件原样）

- `ui-settings-general`：内联 `bindSnapshotSelector`（rc.2 未公开导出）、补
  `refreshDocumentIfLoaded` 本地实现、加 `use-sync-external-store@1.2.0` 依赖
- 各包 package.json 以 rc.2 为基线、仅补实际 import 缺失的 peer 依赖
- 类型层面仍有 ~80 处 WIP 错误（源工作区本就未完成构建验证），只保证可打包可运行

## 使用

```bash
node scripts/apply-codex-web-overlay.mjs           # 应用进 build/dsh-runtime 闭包
node scripts/apply-codex-web-overlay.mjs --restore # 还原官方 UI
```

产物不匹配 `0.1.1-rc.2` 闭包时脚本会拒绝执行。首次应用自动备份 `.orig`。

## S5 Lucide 内联图标（lucide-react@1.33.0）

高频界面图标已统一为 Lucide 线框风格。图标数据提取自 `lucide-react@1.33.0`
（ISC License）`dist/esm/icons/*.mjs` 的 `__iconNode` 数组，经
`tools/icons-lucide-1.33.0.json` 手工内联进各 bundle 的 `MoyuLucideIcon`
适配层：默认 16px、strokeWidth 1.75、`currentColor`、`fill="none"`、
`aria-hidden="true"`。**纯构建期内联，无任何 lucide 运行时依赖**；
门禁（tests/verify-overlay-applied.mjs）会拒绝运行时 require。

### 业务功能 → Lucide 图标映射表

| Bundle | 业务功能 | Lucide 图标 |
| --- | --- | --- |
| ui-sidebar | 侧栏展开/收起 | `PanelLeftClose` / `PanelLeftOpen` |
| ui-workspace | surface 新会话 | `SquarePen` |
| ui-workspace | surface 安排任务 | `ListTodo` |
| ui-workspace | surface 插件 | `Blocks` |
| ui-workspace | surface 头部 glyph（PR/Browser/Scheduled/Plugins） | `GitFork` / `Globe` / `ListTodo` / `Blocks` |
| ui-workspace | 筛选和排序（视图选项） | `SlidersHorizontal` |
| ui-workspace | 搜索 / 清除搜索 | `Search` / `X` |
| ui-workspace | 新增工作区（按钮/菜单） | `FolderPlus` / `Plus` |
| ui-workspace | 工作区树折叠箭头 | `ChevronRight` |
| ui-workspace | 文件夹合/开（树与移动子项） | `Folder` / `FolderOpen` |
| ui-workspace | 移动到工作区（父项） | `FolderInput` |
| ui-workspace | 行菜单触发 | `Ellipsis` |
| ui-workspace | 重命名 / 删除工作区 | `Pencil` / `Trash2` |
| ui-workspace | 分叉 / 归档 | `GitFork` / `Archive` |
| ui-workspace | 置顶 / 取消置顶（原手绘 PinIcon） | `Pin` / `PinOff` |
| ui-workspace | 标记未读（原手绘 MailIcon） | `CircleDot` |
| ui-workspace | 复制会话 / 复制 Markdown | `Copy` / `ClipboardCopy` |
| ui-conversation | 发送（原手绘 svg）/ 停止（原手绘 svg） | `ArrowUp` / `Square` |
| ui-conversation | 附件与命令入口（"+"） | `Paperclip` |
| ui-conversation | 下拉/收起箭头 | `ChevronDown` / `ChevronUp` / `ChevronRight` |
| ui-conversation | 消息编辑 / 删除 / 取消编辑 | `Pencil` / `Trash2` / `X` |
| ui-conversation | 复制 / 复制成功态 | `Copy` / `Check` |
| ui-conversation | 队列 steer 发送 | `ArrowUp` |
| ui-conversation | Todo 面板引导 | `ListTodo` |

### 未迁移（保留 DSH primitives，S5.3 视觉冲突时再议）

- ui-conversation：`QueueOutline14`、`ApiOutline14`、`BrowseOutline16`、
  `ThinkOutline14`、`WarningOutline16`、`FolderClose16`、`FolderOpen16`
- ui-settings-general：设置页导航全部（S5.3）
- MOYU Logo/Wordmark、截图按钮自绘取景框（Moyu 自有资产，不用 Lucide）
