# Changelog

## Unreleased — v2 Electron 重构

### Added

- M0a Electron + Vite + Vanilla 最小安全外壳。
- `sandbox:true`、上下文隔离、关闭 Node 集成的 preload 白名单 IPC。
- Windows x64 portable 打包配置。
- JsBarcode 单个与批量一维条码、SVG/PNG/EPS 导出及 Adobe 联动。
- Fabric.js 图片编辑与 PNG/JPG/WebP/TIFF 导出。
- PDF 转换、编辑、OCR、AES 加解密与图片转 PDF。
- 区域截图、应用内滚动截图、离线 OCR 与钉图。
- FFmpeg/sharp 格式工厂与本地 AI 图像 sidecar。
- winax utility process：Illustrator 批处理与 Office 转 PDF。

### Changed

- 项目目标切换为 Windows x64 Electron 桌面工具箱。
- 正式 UI 迁移目标改为 Electron renderer；根目录 `index.html` 仅作为视觉蓝本。
- 开发主线改为 `dev`。

### Removed

- 当前分支不再维护 pywebview/Python 桌面运行与 PyInstaller 打包路径。
- 不再维护独立浏览器产品路线。

旧 Python 桌面版本保留在本地 Git 分支 `archive/desktop-v1.2`。
