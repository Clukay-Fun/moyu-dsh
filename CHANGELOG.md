# Changelog

## Unreleased — v2 Electron 重构

### Changed

- 项目目标切换为 Windows x64 Electron 桌面工具箱。
- 正式 UI 迁移目标改为 Electron renderer；根目录 `index.html` 仅作为视觉蓝本。
- 开发主线改为 `dev`。

### Removed

- 当前分支不再维护 pywebview/Python 桌面运行与 PyInstaller 打包路径。
- 不再维护独立浏览器产品路线。

### Planned

- M0a 建立 Electron + Vite + Vanilla 最小壳及 Windows x64 打包验证。

旧 Python 桌面版本保留在本地 Git 分支 `archive/desktop-v1.2`。
