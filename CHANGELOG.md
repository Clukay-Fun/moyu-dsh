# Changelog

## Unreleased — v2 Electron 重构

### Added

- M0a Electron + Vite + Vanilla 最小安全外壳。
- `sandbox:true`、上下文隔离、关闭 Node 集成的 preload 白名单 IPC。
- Windows x64 portable 打包配置。

### Changed

- 项目目标切换为 Windows x64 Electron 桌面工具箱。
- 正式 UI 迁移目标改为 Electron renderer；根目录 `index.html` 仅作为视觉蓝本。
- 开发主线改为 `dev`。

### Removed

- 当前分支不再维护 pywebview/Python 桌面运行与 PyInstaller 打包路径。
- 不再维护独立浏览器产品路线。

旧 Python 桌面版本保留在本地 Git 分支 `archive/desktop-v1.2`。
