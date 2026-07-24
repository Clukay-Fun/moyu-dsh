# 摸鱼工具箱

面向设计工作流的 Windows x64 Electron 工具箱。

## 当前状态

v2 正在从旧版 Python/pywebview 桌面应用重构为 Electron。唯一正式 UI 是 Electron 渲染层；根目录 [index.html](index.html) 仅保留为视觉蓝本，不作为独立网页产品交付。

目前已经接通：

- 一维条码：9 类码制、单个/批量生成、SVG/PNG/EPS、打印尺寸及一键转入 Illustrator/Photoshop。
- 图片编辑：裁切、旋转翻转、文字水印、涂鸦、调色、像素化，以及 PNG/JPG/WebP/TIFF 导出。
- PDF：转换、合并拆分、旋转提页、水印页码、页面重排、提图、OCR、AES 加解密。
- Office：在已安装 Microsoft Office 的 Windows 上将 Word、Excel、PowerPoint 导出为 PDF。
- Illustrator：批量导出 PDF、250 PPI 最小化 PDF 与文字转曲。
- 截图：区域截图、标注、应用内滚动截图、离线中英 OCR、钉图。
- 格式工厂：视频格式转换/压缩/抽取音频、音频转换，以及图片转换/压缩。
- AI 图像：RMBG-1.4 抠图/批量抠图/证件照，MI-GAN 局部修补，分层 PSD 导出。
- 设置：浅色/深色/跟随系统与自定义强调色。

COM 已采用独立 Electron utility process 隔离，winax 的 Electron ABI、发布包资源与启动已通过 Windows 自动验收；Office/Adobe 的真实文件处理仍需在安装了对应软件的 Windows 机器上做发布前回归。开发范围与验收以本地 `scope/` 子计划为准。

## 技术基线

- Electron + Vite + Vanilla JavaScript
- electron-vite + electron-builder + npm
- renderer：JsBarcode、Fabric.js、pdf-lib、pdf.js、QPDF WebAssembly
- 主进程：受限 IPC、文件系统、Tesseract.js、ag-psd、sharp、FFmpeg 子进程适配层
- Windows COM：winax + Electron utility process；Office/Illustrator/Photoshop 不在 renderer 或主进程内直接执行
- AI sidecar：Python、ONNX Runtime DirectML、Pillow；模型首次使用时下载并校验，不进仓库或安装包

## 开发

```bash
npm install
npm run dev
npm run build
npm run build:win
```

`npm run build` 生成 Electron bundle；`npm run build:win` 会先下载并校验固定版本的 FFmpeg/ffprobe、构建 Windows AI sidecar，再生成 Windows x64 portable EXE。构建 sidecar 需要 Windows Python 3.11；可用 `MOYU_PYTHON` 指定解释器。

AI 模型不会随源码或 EXE 分发。模型版本、哈希与使用边界见 [AI-MODEL-NOTICE.md](licenses/AI-MODEL-NOTICE.md)。当前模型只按自用、学习场景启用。

## 目录

- `index.html`：视觉蓝本。
- `assets/`：logo 等本地资源。
- `src/main/`：Electron 主进程与受限 IPC。
- `src/preload/`：renderer 白名单桥接。
- `src/renderer/`：正式界面与浏览器侧工具能力。
- `sidecar/ai/`：AI 图像任务进程源码与锁定依赖。
- `scripts/`：发布构建脚本。
- `licenses/`：第三方组件、运行库与模型 notices。
- `scope/`：本地路线图和子计划，不纳入 Git。
- `tests/`：本地测试与样本，不纳入 Git。

旧 Python 桌面版本保留在本地 Git 分支 `archive/desktop-v1.2`。
