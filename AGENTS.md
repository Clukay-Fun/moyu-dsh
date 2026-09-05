# MOYU DSH — Electron 开发约定

## 项目定位

这是一个 **DSH 原生桌面应用**：DeepSeek Harness 是内核与唯一界面，Electron 是桌面宿主
与安全边界，MOYU 通过原生插件提供产品能力。当前只做 macOS arm64。

**功能范围（v3.0.0 定稿）**：DSH 会话与工作区、安排任务，以及图片转换、PDF、截图三项
内置能力。图片与 PDF 作为 Tool 使用；截图同时提供 composer 输入框按钮
（`conversation.input.left`），结果直接进入对话附件。

DSH Web UI 是唯一主界面，运行在本地 DSH origin 上。DSH Host 使用 Electron 自带运行时以
`ELECTRON_RUN_AS_NODE=1` 启动独立 Node 子进程，只能通过有类型的进程 IPC 窄桥调用白名单
能力，不直接获得通用 Electron IPC。

技术与范围以本机 `scope/README.md`、`scope/plans/README.md` 及当前活动子计划为准。
`scope/plans/` 与 `tests/` 随源码纳入 Git；其他本机证据与临时产物不纳入 Git。

上述范围约束的是 `dev`/`main` 与正式发布路径。实验分支
（如 `experiment/*`）允许探索范围外的功能，但探索期间也要在本机
`scope/plans/active/` 留一份对应计划文档；合并回 `dev` 前必须先补一次范围决策，
不得直接把范围外功能带入主线。

## 工作规则

1. 修改前运行 `git status --short --branch`，保留已有改动。
2. 按 `scope/plans/README.md` 的里程碑顺序开发。每片先完成计划中的 Spike 或验收，再扩展下一片。
3. DSH Web 与原生扩展 UI 使用 DSH 的 Client Plugin 体系，Client 侧 React 固定为
   `^18.2.0`（上游 peer 约束）；现有 Vanilla renderer 只维护迁移期功能，不再扩展成
   第二套应用壳。项目使用 npm 与 npm workspaces，不新增第二套包管理器；Client
   bundle 用 `tsdown` 构建（构建工具，不属于包管理器），产物必须匹配 DSH 的
   `window.__ModuleLoader__` 懒 CJS 工厂契约。
4. 所有应用内 WebContents 必须 `contextIsolation: true`、`nodeIntegration: false`、
   `sandbox: true`。应用内只有两个 WebContents：DSH 主窗口（无 preload）与截图覆盖层
   （`apps/desktop/overlay/`，独立最小 preload）。不得为新功能新增第三个 WebContents，
   除非计划中另有决策。
5. 文件读写、系统能力、原生模块都在主进程或 DSH Host Service；renderer 不直接访问
   Node、文件系统或系统 API。DSH Host 只能通过有类型的窄桌面桥调用 Electron 能力，
   禁止通用 channel 和任意方法转发。桥方法的输入输出走 `fileId` / `resultId` 令牌，
   大二进制不过桥，不向模型暴露绝对路径。
6. 原生运行时与资产必须先做目标平台打包 Spike，且按性质区分：`.node` 原生模块
   （sharp、`@napi-rs/canvas` 的 skia）验证 Electron ABI 与 `asarUnpack`；WASM/Worker/数据资产
   验证打包后的解析路径；独立可执行文件单独规划获取、校验与签名。macOS 交付须验证
   签名、hardened runtime、公证和干净机器启动。不使用外挂 Node runtime。
7. 不保留未实现的可点击控件；未实现能力须明确禁用或标为预览。
8. 不使用 CDN 作为核心运行依赖；运行资源经 npm 或 `assets/` 本地交付。
9. 计划文档与测试代码随源码提交；不提交缓存、构建产物、用户私有素材或凭证。
10. 正式构建只交付唯一 Moyu profile；默认禁止 shell、通用文件工具、subagent、
     运行时动态插件定义与执行（`cordis_define` / `cordis_run` 一类）和任意插件安装。
     DSH 原生的 preset 管理 / plugin inventory / 权限设置入口（agent-presets、ui-agent-preset、
     plugin-inventory、ui-settings-plugins、ui-settings-plugin-inventory、permission、ui-permission）
     已放开，但 surface 仍保持干净：`tool-bash`/`tool-pwsh`/`terminal` 与 `cordis-host-runner`/
     `cordis-client-runner` 保持禁用；每会话守卫（`assertMoyuToolSurface`）以 contains 语义核对
     必备三件套，并拒绝 moyu 默认 preset 下出现 shell 类工具，漂移时拒绝创建会话。
11. DSH 是应用核心时不在用户机器上动态替换；开发主线可持续跟进上游，但每个发布
    构建必须记录确定的 DSH commit/版本、lockfile 和依赖闭包。所有 `@deepseek-ai/*`
    依赖显式钉版本号，禁止依赖 dist-tag（上游多数子包的 `latest` 落后于 `next`，
    包名也会变更）。
12. 凭据不得明文落盘。正式 profile 只装 Moyu 自建的 credentials provider，经窄桌面桥
    调用 Electron `safeStorage`；不交付上游默认的明文 YAML 实现。
13. 主窗口只允许应用自带的 DSH origin。导航、新窗口、下载、权限请求和文件/目录选择
    统一由主进程接管，不使用 DSH 自带的选择器与浏览器默认下载。
14. 区分两条通信链路：Electron main ↔ DSH Host 走有类型的子进程 IPC，免端口与认证；
    DSH UI ↔ DSH Host 是独立链路，若采用 loopback HTTP/WS，必须自行解决端口分配、
    就绪信号、崩溃恢复、Origin 校验与客户端凭证——上游 webserver 明确不提供 TLS、
    认证与 origin 策略。

## 验证

- DSH M0a：上游发布包已核验为足够，M0a 只验证自建 Client bundle 能否通过 DSH
  bundle purity gate，以及原生 Host/Client 插件、唯一 profile、每会话 Tool 白名单、
  独立 Node 子进程窄桥、进程清理、包体与 macOS 签名/公证；通过后才进入插件迁移。
- 基础应用：`npm run dev` IPC 冒烟；正式平台产物双击启动验证。
- Renderer 改动：检查控制台、导航、主题、菜单与涉及的点击路径。
- IPC/主进程：验证成功、取消和失败提示；renderer 不获得额外 Node API。
- 原生资产：按目标平台验证。macOS 的 `.node`、WASM/Worker/数据资产与辅助可执行
  文件以 macOS 打包产物实测为准（本地自用，不做 Apple 签名与公证，见计划决策 19）。
  Windows 适配整体推迟到 v3.1，Mac 阶段不得声称 Windows 路径已验证。

未能执行的验证必须在交付中说明原因与残余风险。

## 验证分层

打包是最贵的验证手段，不是默认动作。

- 日常改动：相关 harness + 静态检查 + `npm run build`。
- 里程碑收口：`tests/run-acceptance.mjs` 显式清单中的全部当前有效 harness，并确认新增功能的
  专项 harness 已纳入清单；记录实际执行数量，不用固定数字当完成定义。自启 Electron 的真机
  harness 是唯一覆盖 GUI 端到端的部分，不能只跑 Node 那部分。
  跑之前先 `pkill -9 -f "Electron.app/Contents/MacOS/Electron"`——真机 harness 会残留实例
  并互抢调试端口，表现为随机假失败甚至新实例 `SIGABRT`；先按残留排查，不要先怀疑产品代码。
- 只有涉及打包布局 / `asar` / `extraResources` / `afterPack`、原生模块增减、签名与公证、
  运行闭包（`@deepseek-ai/*` 版本或 `build-dsh-runtime.mjs`）变化、或新增打包后需解析路径的
  资源（WASM、语言包、worker、外挂可执行文件）时，才构建 DMG。
- 网络中断、工具链故障等与产品代码无关的环境问题不构成重新打包的理由；失败先定位。

## macOS 打包与交付

- `npm run build:mac`（内含 `build:dsh-runtime`）产出 DMG。**本地自用，不做 Apple 签名与
  公证**（计划决策 19）：保留 ad-hoc 签名与 hardened runtime 参数，不申请 Developer ID。
- 打包是最贵的验证手段，触发条件见「验证分层」；不要为普通功能切片重复打包。
- DSH 运行闭包交付在 asar 外（`Contents/Resources/dsh-runtime`），由
  `scripts/build-dsh-runtime.mjs` 生成、`scripts/after-pack-dsh-runtime.mjs` 拷入。
  **不要改用 `extraResources`**——electron-builder 会硬性剔除其中的 `node_modules`。
- 新增插件依赖时，必须同步：profile manifest 声明、构建期复制、`ensureProfile` 升级路径。
  三者漏一个，干净安装或旧安装升级就会失败（已发生过一次）。

## Windows 打包与交付（v3.1 再启用，当前不适用）

> Windows 适配整体推迟到 v3.1。以下流程保留备查，v3.0.0 阶段不执行。

- 唯一正式流程见 [`docs/windows-release.md`](docs/windows-release.md)，打包前必须完整读取。
- 有 Windows x64 环境时执行 `npm ci` 和 `npm run build:win`。
- 当前机器不是 Windows、但用户要求直接提供 EXE 时，使用临时 `codex/windows-repackage` 分支和 `windows-2022` runner；不得使用 Docker。
- 临时 Artifact 只用于传输，下载并完成 SHA-256 校验后必须立即删除 Artifact、远程临时分支、worktree 和本地临时分支。
- 不得推送 `dev` 或 `main` 来完成临时打包，除非用户明确要求。
- 最终 EXE 与 SHA-256 文件直接放到用户桌面根目录，不交付空目录或旧包改名文件。

## Git

- 开发主线：`dev`；`main` 保留为稳定基线。
- 提交前运行 `git diff --check`、`git diff --stat` 与 `git status --short --branch`。
- 使用约定式提交，例如 `feat(shell): ...`、`feat(barcode): ...`。
- 不推送远程，除非用户明确要求。
