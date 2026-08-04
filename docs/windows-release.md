# Windows x64 构建与交付规范

本文件是摸鱼工具箱 Windows portable EXE 的唯一打包规范。后续执行正式打包时直接按本文操作，不再临时猜测构建方式。

功能频繁迭代期间可以使用 [Windows 源码测试版](windows-source-test.md)，避免每次修改都生成 portable EXE。源码测试版只用于开发验收，不改变本文件的正式发布要求。

## 1. 目标产物

- 文件名：`摸鱼工具箱-v<version>-x64.exe`
- 当前测试版本：`摸鱼工具箱-v2.1.0-beta.1-x64.exe`
- 架构：Windows x64
- 形态：electron-builder `portable` 单文件 EXE
- 交付位置：用户桌面根目录
- 同目录附带 SHA-256 文本文件

不得用旧 EXE 改名冒充新构建，也不得把源码测试版或 `win-unpacked` 目录冒充正式发布包。

## 2. 构建前门禁

构建前必须：

1. 运行 `git status --short --branch`，确认没有遗漏的产品代码。
2. 确认目标提交已经包含本轮全部修复。
3. 运行：

   ```bash
   npm ci
   npm run build
   ```

4. 完成与改动相关的 Electron 冒烟测试。
5. 运行：

   ```bash
   git diff --check
   npm audit --omit=dev
   ```

6. 不把 `scope/`、`tests/`、`release/`、缓存、模型或构建产物加入 Git。

未通过上述门禁时不得生成正式测试包。

## 3. 构建方式选择

### 3.1 有 Windows x64 构建机

这是首选方式。在 Windows PowerShell 中执行：

```powershell
npm ci
npm run build:win
```

`build:win` 会依次：

1. 下载固定版本的 `ffmpeg.exe` 和 `ffprobe.exe`，校验下载文件与解压后二进制 SHA-256。
2. 使用 Windows Python 构建 `moyu-ai-sidecar.exe`。
3. 构建 Electron main、preload 和 renderer。
4. rebuild `winax`、sharp 等 Windows/Electron 原生模块。
5. 生成 Windows x64 portable EXE。

预期产物：

```text
release/摸鱼工具箱-v2.1.0-beta.1-x64.exe
```

### 3.2 当前机器不是 Windows，但用户要求直接提供 EXE

使用已验证的临时 GitHub Windows runner 路线。不得使用 Docker，也不得在 macOS 上伪造 Windows 原生模块。

该路线的原则：

- 临时分支固定叫 `codex/windows-repackage`。
- 临时工作流运行在 `windows-2022`。
- 从当前本地 `dev` 的真实 HEAD 构建，包括尚未推送到 `origin/dev` 的已提交修复。
- 不推送或改写远程 `dev`、`main`。
- Artifact 只作为 Windows runner 到本机桌面的临时传输通道。
- 下载并校验完成后立即删除 Artifact 和临时远程分支。
- 不把临时工作流合并进 `dev` 或 `main`。

## 4. 临时 Windows runner 工作流

临时分支中的 `.github/workflows/windows-repackage.yml` 使用以下结构：

```yaml
name: Windows repackage

on:
  push:
    branches:
      - codex/windows-repackage

jobs:
  package:
    runs-on: windows-2022
    timeout-minutes: 45

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install and rebuild native dependencies
        run: |
          npm ci --ignore-scripts
          npm rebuild electron
          npx electron-builder install-app-deps

      - name: Build Windows resources and Electron bundle
        shell: pwsh
        run: |
          npm run build:tools:win
          npm run build:sidecar:win
          npm run build

      - name: Package and inspect portable executable
        shell: pwsh
        run: |
          npx electron-builder --win portable --x64
          foreach ($asset in @(
            "release/win-unpacked/resources/workers/com-worker.cjs",
            "release/win-unpacked/resources/licenses/OCRB-USER-PROVIDED-NOTICE.txt",
            "release/win-unpacked/resources/THIRD_PARTY_NOTICES.md"
          )) {
            if (-not (Test-Path $asset)) {
              throw "Missing packaged asset: $asset"
            }
          }
          $rendererFiles = npx asar list "release/win-unpacked/resources/app.asar"
          if (-not ($rendererFiles -match "OCR-B-.*\.ttf")) {
            throw "Packaged OCR-B font missing"
          }
          $app = Start-Process "release/win-unpacked/摸鱼工具箱.exe" -PassThru
          Start-Sleep -Seconds 8
          if ($app.HasExited) {
            throw "Packaged app exited during launch smoke"
          }
          Stop-Process -Id $app.Id -Force

      - name: Generate checksum
        shell: pwsh
        run: |
          $portable = Get-ChildItem "release/*-x64.exe" | Select-Object -First 1
          if (-not $portable) {
            throw "Portable executable missing"
          }
          $hash = (Get-FileHash $portable.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
          "$hash  $($portable.Name)" |
            Set-Content "release/SHA256SUMS.txt" -Encoding ascii

      - uses: actions/upload-artifact@v4
        with:
          name: moyu-tools-windows-v2.1.0-beta.1
          path: |
            release/*-x64.exe
            release/SHA256SUMS.txt
          if-no-files-found: error
```

版本号变化时，Artifact 名称和预期 EXE 文件名必须同步更新。

## 5. 临时分支操作

推荐使用独立 worktree，不切换当前开发目录：

```bash
git status --short --branch
git worktree add -b codex/windows-repackage <临时目录> dev
```

在临时 worktree 中加入上述工作流并提交，然后：

```bash
git push -u origin codex/windows-repackage
```

只允许推送临时构建分支。除非用户另有明确要求，不得推送 `dev` 或 `main`。

## 6. Windows 构建验收

工作流必须全部通过：

1. npm 依赖安装。
2. Electron ABI 原生模块 rebuild。
3. FFmpeg/ffprobe 固定资源构建。
4. AI sidecar 构建。
5. Electron bundle。
6. portable EXE。
7. `com-worker.cjs`、许可证、notices 和 OCR-B 字体包内检查。
8. `win-unpacked/摸鱼工具箱.exe` 启动后持续运行至少 8 秒。
9. SHA-256 文件生成。

仅“工作流绿色”不代表 Office/Adobe 真实业务验收完成。Word、Excel、PowerPoint、Illustrator、Photoshop 仍须在安装了相应软件的 Windows 真机上测试。

## 7. 下载与桌面交付

构建成功后：

1. 把 Artifact 下载到临时目录。
2. 解压并确认存在 EXE 与 `SHA256SUMS.txt`。
3. 本地重新计算：

   ```bash
   shasum -a 256 摸鱼工具箱-v2.1.0-beta.1-x64.exe
   ```

4. 本地计算结果必须与 runner 生成的 `SHA256SUMS.txt` 完全一致。
5. 将以下两个文件直接放在桌面根目录：

   ```text
   ~/Desktop/摸鱼工具箱-v2.1.0-beta.1-x64.exe
   ~/Desktop/摸鱼工具箱-v2.1.0-beta.1-x64-SHA256.txt
   ```

6. 最终回复必须报告：
   - 桌面绝对路径；
   - 文件大小；
   - SHA-256；
   - Windows 启动冒烟是否通过；
   - 哪些 Office/Adobe/多显示器能力仍待用户真机验证。

网络较慢时可以对 Artifact 的官方下载地址使用 HTTP Range 分段下载，但合并后的 ZIP 大小和 EXE SHA-256 仍必须通过校验。

## 8. 强制清理

桌面文件确认存在且 SHA-256 一致后，立即执行：

1. 删除该次运行产生的 GitHub Artifact。
2. 删除远程 `codex/windows-repackage` 分支。
3. 删除临时 worktree。
4. 删除本地临时构建分支。
5. 确认远程 Artifact 数量为 0。
6. 确认原始 `dev` 工作区状态未被临时工作流污染。

不得长期把 GitHub Actions Artifact 当作发布存储，也不得遗留临时构建分支。

## 9. 禁止事项

- 不使用 Docker 构建 Windows EXE。
- 不在 Apple Silicon macOS 上声称已经本地编译并验证 winax/Windows sidecar。
- 不复用旧 EXE 代替新源码构建。
- 不跳过 SHA-256 校验。
- 不因打包而把 `dev` 或 `main` 推送到远程。
- 不把模型文件打入 EXE。
- 不把构建成功等同于 Office/Adobe 真实文件处理通过。
