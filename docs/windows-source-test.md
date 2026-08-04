# Windows 源码测试版

本流程用于功能频繁迭代期间的 Windows 真机测试。它直接运行 Electron 开发模式，不生成约 256 MB 的 portable EXE。

源码测试版只用于开发验收，不替代正式发布包。正式发布、资源路径和原生模块打包仍按 [Windows x64 构建与交付规范](windows-release.md) 执行。

## 环境要求

- Windows 10/11 x64。
- Node.js 22 x64（包含 npm）。
- Python 3.11 x64，用于首次构建 AI sidecar。
- 测试 Office/Adobe 联动时，安装对应的 Microsoft Office、Illustrator 或 Photoshop。

Git 不是首次启动的必要条件。若测试文件夹包含 `.git/`，可以用 Git 核对 commit，并在对应提交已推送后使用 `git pull --ff-only` 更新。

## 第一次安装

解压源码测试文件夹后，双击：

```text
首次安装.cmd
```

脚本依次执行：

1. 检查 Node.js 主版本至少为 22。
2. `npm ci` 安装锁定依赖，并清除可能导致 Electron 跳过下载的 `ELECTRON_SKIP_BINARY_DOWNLOAD`。
3. 检查 `node_modules/electron/path.txt` 与 `dist/electron.exe`；缺少时显式执行 Electron 安装脚本，仍缺少则停止并报错。
4. `npx electron-builder install-app-deps` 重建 winax、sharp 等 Electron 原生依赖。
5. 下载并校验固定版本 FFmpeg/ffprobe。
6. 使用 Python 3.11 构建 `moyu-ai-sidecar.exe`。
7. 运行一次生产 bundle 构建，确认 main、preload、renderer 可以编译。

首次安装时间取决于 npm、FFmpeg 和 Python 依赖下载速度。AI 模型不会在这一步下载；模型仍在第一次使用对应 AI 功能时下载并校验。

若 Python 3.11 不在默认命令中，可以先在 CMD 设置：

```cmd
set MOYU_PYTHON=C:\Python311\python.exe
```

然后在同一窗口运行：

```cmd
首次安装.cmd
```

## 日常启动

双击：

```text
启动测试版.cmd
```

脚本运行 `npm run dev` 并打开 Electron 软件窗口。测试期间 CMD 窗口必须保持打开；关闭 CMD 或按 `Ctrl+C` 会停止应用。

普通 renderer、条码、PDF 和样式修改不需要重新生成 EXE。修改源码后重启 `启动测试版.cmd` 即可验证。

若启动时提示 `Electron uninstall`，说明 Electron 的 npm 包存在，但 Windows 可执行文件没有下载完整。重新运行最新版 `首次安装.cmd`；脚本会直接检查 `path.txt` 和 `dist/electron.exe`，不会再把这种残缺安装误判为可启动状态。

## 更新源码

若当前测试提交已经推送到配置的远端分支：

```cmd
git status --short --branch
git pull --ff-only
```

如果 `package-lock.json`、Electron 版本、原生依赖或 `sidecar/ai/requirements-win.txt` 有变化，应重新运行 `首次安装.cmd`。只有普通 `src/`、CSS 或静态资源变化时，直接重新启动即可。

没有 Git 时，也可以用新版源码覆盖旧文件夹。不要覆盖或删除 `node_modules/` 与 `build/`，除非准备重新运行首次安装。

## 测试身份

测试前记录：

```cmd
git rev-parse HEAD
node -p "require('./package.json').version"
```

当前 Windows 验收清单位于本地 `scope/plans/v2-test/v2.1.0-windows-acceptance.md`，该目录按项目约定不纳入 Git，也不随源码测试包交付；需要时单独复制给测试机。

## 边界

- 源码测试版会显示 CMD，这是正常行为。
- 它不能证明 portable EXE 的图标、资源路径、无终端启动和自解压行为正确。
- 最终正式发布前仍必须运行 `npm run build:win` 并验证 portable EXE。
- Office/Adobe COM 只以安装了对应软件的 Windows 真机结果为准。
