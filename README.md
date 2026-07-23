# 摸鱼工具箱

面向设计工作流的 Windows x64 Electron 工具箱。

## 当前状态

v2 正在从旧版 Python/pywebview 桌面应用重构为 Electron。M0a 最小安全外壳已经建立；唯一正式 UI 是 Electron 渲染层。根目录 [index.html](index.html) 仅保留为视觉蓝本，后续迁入 Vite renderer，不作为独立网页产品交付。

首发路线：

1. M0a：Electron 最小壳、受限 preload IPC、Windows x64 打包启动验证。
2. M0b：迁移视觉蓝本、功能搜索与摸鱼计时器。
3. M1a：EAN-13 条码预览与 SVG/PNG 保存。

后续范围包含 Illustrator COM、图片编辑、PDF、截图、格式转换与 AI 图片能力；每一项均按本地 `scope/` 子计划的 Spike 和验收条件推进。

## 技术基线

- Electron + Vite + Vanilla JavaScript
- electron-vite + electron-builder + npm
- renderer：JsBarcode、Fabric.js、pdf-lib、pdf.js
- 主进程：受限 IPC、文件系统、sharp、winax；必要时 Python sidecar

## 开发

```bash
npm install
npm run dev
npm run build
npm run build:win
```

`npm run build` 生成 Electron bundle；`npm run build:win` 生成 Windows x64 portable EXE。Windows 启动与 COM/原生模块能力必须在 Windows 上验证。

## 目录

- `index.html`：视觉蓝本。
- `assets/`：logo 等本地资源。
- `scope/`：本地路线图和子计划，不纳入 Git。
- `tests/`：本地测试与样本，不纳入 Git。

旧 Python 桌面版本保留在本地 Git 分支 `archive/desktop-v1.2`。
