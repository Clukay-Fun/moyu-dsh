# 摸鱼工具箱 — Electron 开发约定

## 项目定位

这是一个基于 DeepSeek Harness（DSH）的 Electron 桌面发行版。v3.0.0 起先在
macOS arm64 上把 DSH 建设为应用本体，原有工具作为 DSH 扩展；Windows x64 能力
与交付流程继续保留、后续适配。

DSH Web UI 是正式主界面，运行在本地 DSH origin 上。现有 Vanilla renderer 仅作为
迁移期 legacy 扩展，逐片迁移为 DSH Client Plugin。DSH Host 使用 Electron 自带运行时以
`ELECTRON_RUN_AS_NODE=1` 启动独立 Node 子进程，只能通过有类型的进程 IPC 窄桥调用白名单能力，不直接获得通用
Electron IPC。

技术与范围以本机 `scope/README.md`、`scope/plans/README.md` 及当前活动子计划为准。
`scope/` 是本地开发依据，不纳入 Git。

## 工作规则

1. 修改前运行 `git status --short --branch`，保留已有改动。
2. 按 `scope/plans/README.md` 的里程碑顺序开发。每片先完成计划中的 Spike 或验收，再扩展下一片。
3. DSH Web 与原生扩展 UI 使用 DSH 的 Client Plugin 体系，Client 侧 React 固定为
   `^18.2.0`（上游 peer 约束）；现有 Vanilla renderer 只维护迁移期功能，不再扩展成
   第二套应用壳。项目使用 npm 与 npm workspaces，不新增第二套包管理器；Client
   bundle 用 `tsdown` 构建（构建工具，不属于包管理器），产物必须匹配 DSH 的
   `window.__ModuleLoader__` 懒 CJS 工厂契约。
4. 所有应用内 WebContents 必须 `contextIsolation: true`、`nodeIntegration: false`、
   `sandbox: true`。legacy UI 与 headless job 必须使用各自独立的最小 preload，禁止
   复用主 UI preload 或获得通用桌面 IPC。
5. 文件读写、系统能力、COM、原生模块都在主进程、DSH Host Service 或独立任务
   进程；renderer 不直接访问 Node、文件系统或系统 API。DSH Host 只能通过有类型的
   窄桌面桥调用 Electron 能力，禁止通用 channel 和任意方法转发。
6. 原生运行时与资产必须先做目标平台打包 Spike，且按性质区分：`.node` 原生模块
   （sharp、winax）验证 Electron ABI 与 `asarUnpack`；WASM/Worker/数据资产
   （tesseract.js 及其语言包、gs1encoder）验证打包后的解析路径；独立可执行文件
   （FFmpeg）单独规划获取、校验与签名。macOS 交付须验证签名、hardened runtime、
   公证和干净机器启动。不使用外挂 Node runtime。
7. 不保留未实现的可点击控件；未实现能力须明确禁用或标为预览。
8. 不使用 CDN 作为核心运行依赖；运行资源经 npm 或 `assets/` 本地交付。
9. 不提交缓存、构建产物、用户私有素材、凭证、本地计划文档或测试代码。
10. 正式构建只交付唯一 Moyu profile；默认禁止 shell、通用文件工具、subagent、
    preset 切换、运行时动态插件定义与执行（`cordis_define` / `cordis_run` 一类）和任意
    插件安装。构建期及每次会话创建时核对完整 Tool 白名单，漂移时拒绝创建会话。
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
  文件以签名、公证后的 macOS 包实测为准；`winax`/COM 与 Windows 专属路径以 Windows
  打包产物实测为准，Mac 阶段不得声称其已验证。

未能执行的验证必须在交付中说明原因与残余风险。

## Windows 打包与交付

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
