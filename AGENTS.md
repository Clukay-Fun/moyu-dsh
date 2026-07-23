# 摸鱼工具箱 — Electron v2 开发约定

## 项目定位

这是一个 Windows x64 Electron 桌面工具箱。Electron 渲染层是唯一正式 UI；根目录 `index.html` 只是视觉蓝本，后续迁入 Vite renderer，不作为独立网页产品维护。

技术与范围以本机 `scope/v2-done.md` 及其 `scope/plans/` 子计划为准。`scope/` 是本地开发依据，不纳入 Git。

## 工作规则

1. 修改前运行 `git status --short --branch`，保留已有改动。
2. 按里程碑顺序开发；当前第一片为 M0a。每片先完成计划中的 Spike 或验收，再扩展下一片。
3. 使用 Electron + Vite + Vanilla、electron-vite、electron-builder 和 npm；不引入 React/Vue 或第二套包管理器。
4. renderer 必须 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`；所有桌面能力仅经 preload 白名单 IPC 暴露。
5. 文件读写、系统能力、COM、原生模块都在主进程或独立任务进程；renderer 不直接访问 Node、文件系统或系统 API。
6. Windows 专属能力先做 Windows x64 打包 Spike。`winax`、sharp 等原生模块必须验证 Electron ABI rebuild 与 `asarUnpack`。
7. 不保留未实现的可点击控件；未实现能力须明确禁用或标为预览。
8. 不使用 CDN 作为核心运行依赖；运行资源经 npm 或 `assets/` 本地交付。
9. 不提交缓存、构建产物、用户私有素材、凭证、本地计划文档或测试代码。

## 验证

- M0a：`npm run dev` IPC 冒烟；Windows x64 打包后双击启动验证。
- Renderer 改动：检查控制台、导航、主题、菜单与涉及的点击路径。
- IPC/主进程：验证成功、取消和失败提示；renderer 不获得额外 Node API。
- 原生模块/COM：只以 Windows 打包产物实测为准。

未能执行的验证必须在交付中说明原因与残余风险。

## Git

- 开发主线：`dev`；`main` 保留为稳定基线。
- 提交前运行 `git diff --check`、`git diff --stat` 与 `git status --short --branch`。
- 使用约定式提交，例如 `feat(shell): ...`、`feat(barcode): ...`。
- 不推送远程，除非用户明确要求。
