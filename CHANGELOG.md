# Changelog

## 2.1.0 — 个人内部学习版

### Added

- M0a Electron + Vite + Vanilla 最小安全外壳。
- `sandbox:true`、上下文隔离、关闭 Node 集成的 preload 白名单 IPC。
- Windows x64 portable 打包配置。
- JsBarcode 单个与批量一维条码、SVG/PNG/EPS 导出及 Adobe 联动。
- Fabric.js 统一图片画布、可编辑工程文件与 PNG/JPG/WebP/TIFF 导出。
- PDF 转换、编辑、OCR、AES 加解密与图片转 PDF。
- 区域截图、截图标注、离线 OCR 与钉图。
- FFmpeg/sharp 格式工厂。
- winax utility process：Illustrator 批处理与 Office 转 PDF。
- 浅色/深色主题、自定义强调色、本地图标体系与统一交互样式。
- 图片、Illustrator 与格式工厂的文件拖入入口。

### Changed

- 项目目标切换为 Windows x64 Electron 桌面工具箱。
- 正式 UI 迁移到 Electron renderer；旧根目录视觉蓝本现已移除。
- 开发主线改为 `dev`。
- 后续兼容修复使用 2.1.x，小功能版本从 2.2.0 开始。

### Removed

- 当前分支不再维护 pywebview/Python 桌面运行与 PyInstaller 打包路径。
- 不再维护独立浏览器产品路线。
- 移除未成熟的 AI 图像模块、应用内滚动截图和旧单图编辑页。
- 移除 Windows 源码测试版 CMD 入口，统一使用正式 Electron 开发与构建命令。

旧 Python 桌面版本保留在本地 Git 分支 `archive/desktop-v1.2`。
