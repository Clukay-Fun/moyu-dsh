# 摸鱼工具箱

面向设计工作流的 Windows x64 Electron 工具箱。

## 当前状态

2.1.0 是个人内部学习版本。唯一正式 UI 是 Electron 渲染层。

目前已经接通：

- 一维条码：11 个入口（EAN-13、UPC-A、ITF-14、GS1-128、EAN-8、Code 128、Code 39、ITF、MSI、Codabar、Auto），支持单个/批量生成、SVG/PNG/EPS、打印尺寸及 Adobe 联动。
- 图片与画布：截图/导入/粘贴图片、对象编排、文本框、裁切、旋转翻转、涂鸦、调色、像素化，以及 PNG/JPG/WebP/TIFF 导出。
- PDF：转换、合并拆分、旋转提页、水印页码、页面重排、提图、OCR、AES 加解密。
- Office：在已安装 Microsoft Office 的 Windows 上将 Word、Excel、PowerPoint 导出为 PDF。
- Illustrator：批量导出 PDF、250 PPI 最小化 PDF 与文字转曲。
- 截图：区域截图、标注、离线中英 OCR、钉图。
- 格式工厂：视频格式转换/压缩/抽取音频、音频转换，以及图片转换/压缩。
- 设置：浅色/深色/跟随系统与自定义强调色。

COM 已采用独立 Electron utility process 隔离，winax 的 Electron ABI、发布包资源与启动已通过 Windows 自动验收；Office/Adobe 的真实文件处理仍需在安装了对应软件的 Windows 机器上做发布前回归。开发范围与验收以本地 `scope/` 子计划为准。

## 技术基线

- Electron + Vite + Vanilla JavaScript
- electron-vite + electron-builder + npm
- renderer：JsBarcode、Fabric.js、pdf-lib、pdf.js、QPDF WebAssembly
- 主进程：受限 IPC、文件系统、Tesseract.js、ag-psd、sharp、FFmpeg 子进程适配层
- Windows COM：winax + Electron utility process；Office/Illustrator/Photoshop 不在 renderer 或主进程内直接执行

## 开发

```bash
npm install
npm run dev
npm run build
npm run build:win
```

日常开发使用 `npm install` 和 `npm run dev`；可复现验证使用 `npm ci` 和 `npm run build`。`npm run build:win` 会下载并校验固定版本的 FFmpeg/ffprobe，再生成 Windows x64 portable EXE。

完整的 Windows 本机构建、临时 Windows runner、启动冒烟、SHA-256 校验、桌面交付和远程清理流程见 [Windows x64 构建与交付规范](docs/windows-release.md)。非 Windows 主机需要提供 EXE 时按该规范使用临时 Windows runner，不使用 Docker，也不长期保留 Artifact。

## 目录

- `assets/`：logo 等本地资源。
- `apps/desktop/main/`：Electron 主进程与受限 IPC。
- `apps/desktop/preload/`：renderer 白名单桥接。
- `legacy/renderer/`：迁移期 Vanilla 界面与浏览器侧工具能力，逐片迁为 DSH Client Plugin。
- `packages/`：Moyu 的 DSH 插件与架构 Spike 产物。
- `scripts/`：发布构建脚本。
- `docs/`：随源码维护的当前开发与发布文档。
- `licenses/`：第三方组件与运行库的许可证和 notices。
- `scope/`：本地路线图和子计划，不纳入 Git。
- `tests/`：本地测试与样本，不纳入 Git。

旧 Python 桌面版本保留在本地 Git 分支 `archive/desktop-v1.2`。
