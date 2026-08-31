# Changelog

## 0.1.0 — DSH 原生桌面应用

### Changed

- 应用底座从 Electron + Vanilla renderer 切换为 DeepSeek Harness（DSH）原生桌面应用。
- 功能范围收缩为图片转换、PDF、截图三项内置能力，加 DSH 会话与工作区、安排任务。
- 图片与 PDF 作为纯 Tool，删除全部 Client UI 与设置项。
- 截图改为 composer 输入框按钮（`conversation.input.left`），结果直接进入对话附件。
- 只做 macOS arm64，Windows 适配推迟到 v3.1。

### Added

- DSH Host 独立 Node 子进程，有类型的进程 IPC 窄桥。
- `@moyu/dsh-credentials-desktop`：经窄桌面桥调用 Electron `safeStorage` 的凭据密文存储。
- `@moyu/dsh-plugin-scheduled-tasks`：安排任务插件（周期调度、持久化、恢复、通知）。
- Codex 风格工作区 UI、MOYU 品牌统一。

### Removed

- 条码、格式工厂（FFmpeg）、OCR、Illustrator/Office COM 联动、Fabric 画布、PDF organizer、钉图。
- 摸鱼工具箱 legacy renderer 与全部 Windows COM 代码。
- 与旧工具箱的全部连接，legacy 实现另存为仓库外只读参考。
