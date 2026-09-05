# 自媒体工作台计划

> 🗄️ **已归档（2026-09-01）**：M0–M4 全部终签、代码已提交，本版闭环冻结。
> 后续进入测试修 bug 阶段，不再在本计划上新增里程碑；如需新范围（如库存自动扫描、
> 真实模型对话验证、PDF 补充）另开计划。冻结前正文、判据、结论原样保留。

> 状态：M0–M4 全部终签，本版自媒体工作台闭环。剩余为运行时事项（persona 随下次 build:dsh-runtime 进闭包；真实模型对话遵守待有凭据会话验证）。
> 最近更新：2026-09-01（M4：preset 感知、runMode continuation/standalone、conversation.view 按 __moyuActivePreset 过滤、库存阈值）。
> 依赖：preset 切换与 `scheduled-tasks` 插件已合并到 `dev`（f98a7e6），无阻塞前置。

## 参考边界

本项目参考 Codex 的信息架构、任务模型、权限边界和交互行为；DSH 的公开服务与插件契约
仍是工程实现依据。官方资料未公开的内部机制不得写成"Codex 就是这样实现的"。

## 0. 已确认决策

以下决策来自 2026-08-31 的拷问审查，后续修订不得在没有新证据的情况下重开。

| # | 决策 | 理由 |
|---|------|------|
| 1 | **架构层级为 preset 切换**，`agentPreset = 'media'`，与 `moyu`（默认对话）并列 | 参照 ChatGPT/Codex 的切换关系；DSH 原生 `agent-presets` 已支持多 preset 并存、运行时切换、session 创建时指定 preset |
| 2 | **会话 Client 端按 `agentPreset` 集中过滤**，不改 Host `session.list` API | 会话表已有 `agent_preset` 列；个人使用量级下全量拉取 + Client 索引足够；改 Host schema 会牵动 contract/缓存/分页语义，属于长期 patch |
| 3 | **守卫改造为每 preset 声明必备工具集**（方案 C）| `assertMoyuToolSurface` 当前硬编码三件套；自媒体 preset 有自己的必备工具，不应被迫携带 image/pdf/screenshot |
| 4 | **视频缩略图用 Chromium `<video>` + canvas 截帧**，不引入 FFmpeg | 视频源为 MP4/H.264，Chromium 原生解码；Host Service 挂本地文件路由供 WebContents 加载 |
| 5 | ~~**标签/标题生成做成 Tool**~~（已被决策 18 修正）| 原设计让 Tool 内部调模型，形成嵌套链路。改为模型直接生成 + `media_artifact_save` 持久化 |
| 6 | **发布提醒复用 `scheduled-tasks`**，Client UI 按当前 preset 过滤任务显示（方案 A）| 不新建包，不共享 view；同一个 `conversation.view` 内感知 preset，只显示当前工作台的任务 |
| 7 | **设置项存 DSH settings store**：视频目录路径、字幕文件后缀偏好 | 与 DSH 原生设置体系一致，不另建 store |
| 8 | **视频文件限制 1GB 以内**，字幕格式为 `.srt` / `.txt`，不做字幕编辑 | 控制 Host Service 内存与处理时间 |
| 9 | **包名 `@moyu/dsh-plugin-media`** | 按能力命名，界面上叫"自媒体工作台"；不用 `media-studio`（偏 UI 产品名）或 `creator`（范围过宽） |
| 10 | **media preset 按需加载图片处理与截图，暂不加载 PDF** | preset 锁定后无法切换，"需要时切回 moyu"会割裂上下文；图片处理/截图在内容创作中常用（封面、素材处理），PDF 暂无明确场景 |
| 11 | **采用"项目—会话—产物"三层信息架构** | 参考 Codex Project 模型；media preset 不是"另一个工具页面"，而是媒体项目中的任务执行环境 |
| 12 | **fileId 区分四种来源类型** | 不同生命周期的文件不能混用同一种临时令牌，否则定时任务无法稳定引用品牌素材 |
| 13 | **Skill 与 Tool 分层**：Tool 是原子能力，Skill 是可重复工作流 | 参考 Codex Skill 定位；预留 Skill 层让定时任务可以执行完整工作流而非单个 Tool |
| 14 | **生成结果的数据模型提前支持多版本审阅** | 首轮不做 Canvas UI，但 Artifact 数据结构必须支持版本、多选、保留/淘汰，避免以后被"结果只有一个 fileId"卡住 |
| 15 | **Scheduled 区分 continuation 和 standalone 两种运行方式** | continuation 继续已有会话上下文，standalone 每次独立运行进收件箱；后台身份不继承前台会话临时授权 |
| 16 | **媒体文件路由按令牌能力控制访问，不按 preset 全局开关** | preset 控制能力入口（谁能创建令牌/调用 Tool），fileId 控制具体资源访问，fence 控制应用实例边界 |
| 17 | **媒体运行协议参考 Codex App Server 模型** | 参考 Thread→Turn→Item、请求/响应/通知、started/completed、read/resume、server request 审批；媒体文件与 Artifact 部分为本项目扩展，不照搬 Codex 内部实现 |
| 18 | **标签/标题由对话模型直接生成，Tool 只负责持久化**（修正决策 5） | `video_tag_generate` / `video_title_generate` 改为 `media_artifact_save`（确定性 Tool）；模型生成候选，调用 Tool 写入 MediaArtifact。避免"模型调 Tool 再调模型"的嵌套链路 |
| 19 | **会话列表 preset 过滤真源是 overlay `sessionVisible`**，不在 `session-filter.ts` 平行实现 | 侧栏 `deriveGroups` / `deriveFlat` / `deriveSearchResults` 的唯一门禁是 `vendor/codex-web-overlay/ui-workspace/client.js` 的 `sessionVisible`。无 `agentPreset` 的 legacy 会话在 `moyu` 视图可见，current 会话恒可见。`session-filter.ts` 只保留 `getSessionCapabilities` / `hasCapability`；曾存在的索引/过滤函数与线上语义相悖，已删除，禁止再加第二套 |
| 20 | **视频目录绝对路径只存在 Host `store.json`**，settings.section 只展示 label | Host 扫描必须读本地路径；路径不得下发 Client/模型。DSH `settingsScope` 未接（避免 Client 持有路径）。添加目录走 `desktop.pickDirectory` 令牌，不经 Client 传 path |

## 0.1 信息架构：项目—会话—产物

```text
Media Project
├── Sources（项目级）：品牌规范、Logo、字体、长期素材
│   └── 跨 media 会话持久可用
├── Sessions（会话级）：一条视频、一次选题、一篇推文各自独立
│   └── 会话附件只属于当前会话
└── Artifacts（产物级）：脚本、封面、视频、字幕、发布包及版本
    └── 支持多版本、多选、保留/淘汰
```

`media preset` 不是"另一个工具页面"，而是媒体项目中的任务执行环境。

**v1 项目模型**：M1–M4 只支持一个隐式的默认 MediaProject（不持久化 projectId，
不做多项目管理 UI）。所有 media Session 和 project-source 类资源归属于这个隐式项目。
Session 通过 `agentPreset = 'media'` 隐式关联项目，sourceId 通过设置面板配置的
目录路径隐式归属。如果后续需要多项目支持，需要补充 `projectId` 字段并建立
projectId → sourceId → sessionId 的显式关联。

## 0.2 fileId 来源分类

| 类型 | 生命周期 | 场景 |
|------|----------|------|
| `project-source` | 跨 media 会话持久可用 | 品牌规范、Logo、字体、长期素材 |
| `session-attachment` | 只属于当前会话 | 对话中上传的临时文件 |
| `job-result` | 属于一次执行结果，有保留期 | Tool/Skill 产出的封面、标签文件 |
| `scheduled-input` | 后台任务显式引用的稳定输入 | 定时任务需要的品牌素材、模板 |

fileId 令牌必须携带来源类型，Host 根据类型决定过期策略和访问权限。

**持久化分离**：跨重启持久化的是资源标识（`sourceId` + 路径指纹 + mtime），
不是访问令牌。每次 Host 启动根据 sourceId 重新签发短期 fileId，避免长期 bearer
令牌扩大泄露窗口。`scheduled-input` 保存 sourceId 或显式委托记录，
不保存永久访问令牌。详见 §2.1。

## 0.3 工作流分层：Skill → Tool → 权限 → Artifact

```text
工作流 → Skill（可重复流程） → 原子 Tool → 权限/确认 → Artifact（带版本）
```

| 层级 | 示例 |
|------|------|
| Tool（原子能力） | 截帧、裁切、生成封面、读取媒体信息、标签生成、标题生成 |
| Skill（可重复工作流） | 短视频生产、公众号配图、小红书发布包、播客切片 |
| Scheduled Task | 定时执行某个 Skill |
| Preset | 决定本会话可见的 Tool、Skill 和提示结构 |

本计划 M1–M3 先做 Tool 层，Skill 层在 Tool 验证通过后再封装（不在本计划范围内，
但 Tool 的输入输出设计必须考虑 Skill 编排的需要）。

## 0.4 Codex App Server 实现映射

本项目参考 Codex 已公开的线程、任务、事件、审批和列表协议，用于设计媒体运行时的消息流。
以下映射仅描述协议层面的对应关系；DSH 的工程实现依据仍是自身 Host/Client 契约。
媒体文件管理与 Artifact 部分完全为本项目扩展。

### 0.4.1 核心对象映射

| Codex App Server | DSH 媒体运行时 | 说明 |
|-------------------|----------------|------|
| Thread | Session（`agentPreset = 'media'`） | 一条视频 / 一次选题的完整对话上下文 |
| Turn | Run（一次 Tool/Skill 执行） | 用户发起 → 模型执行 → 返回结果的一轮 |
| Item | Event（执行过程中的单个事件） | message / tool_call / tool_result / artifact_created / approval_request |

Thread 对应 Session 而非 Project。一个 media Project 下有多个 Session/Thread。

### 0.4.2 请求 / 响应 / 通知协议

三种消息类型，用于 Host ↔ Client 之间的通信：

| 类型 | 方向 | 语义 | DSH 实现 |
|------|------|------|----------|
| **request** | 双向 | 期望对端回复，带 requestId | Host query / Client command |
| **response** | 双向 | 对 request 的回复，携带同一 requestId | Host query 回调 / Client command 回调 |
| **notification** | 双向 | 单向通知，不期望回复 | Host event emit / Client event emit |

所有 Tool/Skill 执行均通过 request-response 驱动。
状态变更（进度、审批请求、完成）通过 notification 广播。

### 0.4.3 Job / Artifact 生命周期

```text
started → progress(0..n) → [server_request ⇄ server_response → resolved] → artifact_created(0..n) → completed
                                                                                                      └→ failed / cancelled / interrupted
```

- **started** / **completed**：括住一次 Run 的执行边界，M0 Spike 必须验证这对事件
- **artifact_created**：每个 MediaArtifact 输出时发出（notification），Client 实时更新结果面板
- **server_request**：Host 向 Client 发起的 request（带 requestId），Run 暂停等待响应
- **server_response**：Client 对 server_request 的 response（同一 requestId）
- **server_request_resolved**：审批完成后 Host 发出的 notification，确认 Run 继续或取消

审批通过 request-response 协议处理，不在 RunEvent 通知流内——防止事件重放时
把 response 再次执行。RunEvent 只记录单向 notification。

对应的 TypeScript 类型：

```ts
// 单向通知事件——可安全重放
type RunEvent =
  | { type: 'started'; runId: string; generation: number; sequence: number }
  | { type: 'progress'; runId: string; message: string; percent?: number; generation: number; sequence: number }
  | { type: 'artifact_created'; runId: string; artifact: MediaArtifact; generation: number; sequence: number }
  | { type: 'server_request_resolved'; runId: string; requestId: string; approved: boolean; generation: number; sequence: number }
  | { type: 'completed'; runId: string; status: 'success' | 'failed' | 'cancelled' | 'interrupted'; summary?: string; generation: number; sequence: number }

// 审批协议——request-response，不进入 RunEvent 流
interface ServerRequest {
  requestId: string
  runId: string
  action: string
  detail: string
  ttlMs: number  // 超时后 Run 进入 awaiting_user
}

interface ServerResponse {
  requestId: string
  approved: boolean
}
```

### 0.4.4 列表过滤门禁

列表 API 的过滤必须在分页之前执行（filter → sort → paginate），而不是取完一页再 filter：

```text
session.list → filter(agentPreset = 'media') → sort(updatedAt desc) → paginate(cursor, limit)
media.list   → filter(sourceType, status)     → sort(mtime desc)    → paginate(cursor, limit)
```

当前个人使用量级下 Client 全量拉取可行（决策 2），但数据结构和 API 签名必须支持
服务端过滤的扩展路径。

### 0.4.5 read 与 resume 的区别

| 操作 | 语义 | 场景 |
|------|------|------|
| **read** | 从持久化数据重建状态，不恢复执行 | Host 重启后加载 Session/Run/Artifact 历史 |
| **resume** | 恢复到活跃执行状态，重连事件流 | Client 重连、从 `awaiting_user` 继续、网络断线恢复 |

Scheduled Task 的 `continuation` 模式本质上是 resume（回到原 Session 继续执行）；
`standalone` 模式是 read（读取配置） + 新建 Session + 执行。

Host 重启后的恢复流程：
1. read：从 `store.json` 重建所有 Session/Task 的持久状态，递增 `generation`
2. 按状态分类处理：

| 重启前状态 | 恢复策略 | 理由 |
|-----------|----------|------|
| `awaiting_user` | resume：重新发出 `server_request`，Client 恢复审批面板 | 安全，等待用户输入无副作用 |
| `running` + 有检查点 | resume：从检查点恢复，发出 `started`（带新 generation） | 检查点保证幂等性 |
| `running` + 无检查点 | 终结为 `interrupted`，允许用户手动重试 | 非幂等任务不可盲目重新执行 |
| `completed` / `failed` / `cancelled` | read only，不恢复执行 | 终态，仅重建历史 |

3. 所有重放事件携带新 `generation` + 递增 `sequence`，Client 据此去重

### 0.4.6 通知驱动的状态变更

Session 状态变更通过 notification 推送，Client 不轮询：

| 通知类型 | 触发条件 | Client 响应 |
|----------|----------|-------------|
| `session.status_changed` | Run 开始/结束/失败 | 更新会话列表状态指示器 |
| `run.progress` | Tool 执行进度 | 更新进度条/消息 |
| `run.approval_needed` | 需要用户确认操作 | 弹出审批面板 |
| `run.artifact_ready` | 产物生成完成 | 更新结果面板，提供预览 |
| `scheduled.task_fired` | 定时任务触发 | 更新任务列表状态 |

### 0.4.7 server request 审批

当 Tool/Skill 执行涉及需用户确认的操作时，Host 向 Client 发起 server request
（参考 Codex App Server 的 server request 审批模型）：

```text
Host → request(server_request, requestId=R1) → Client 展示审批面板
                                                Client → response(server_response, requestId=R1) → Host
Host → notification(server_request_resolved, requestId=R1, approved) → Client 更新 UI
```

关键约束：
- server_request 是 **request**（§0.4.2），不是 notification——Host 暂停执行等待 response
- server_response 是 Client 的 **response**，不进入 RunEvent 通知流
- server_request_resolved 是 **notification**，进入 RunEvent 流，可安全重放
- Host 重启后对 `awaiting_user` 的 Run 重新发出 server_request（重放安全）

审批场景：
- 定时任务首次执行前的确认
- 标签/标题生成后的批量操作确认
- 涉及文件写入或外部发布的操作

超时策略：server_request 携带 `ttlMs`，超时后 Run 进入 `awaiting_user` 状态，
不自动通过。用户可通过 UI 手动响应恢复执行。

### 0.4.8 Goal 与 Job 分离

| 概念 | 定义 | DSH 对应 |
|------|------|----------|
| **Goal** | 用户意图的高层描述 | 用户消息 + Skill 选择 |
| **Job** | 系统拆解出的具体执行计划 | Run（一次或多次 Tool 调用的编排） |

一个 Goal 可以产生多个 Job。例如用户说"整理这周的视频并生成标签"：
- Job 1: `video_scan`（扫描目录）
- Job 2: 对每个新视频调用 `video_subtitle_read` + 模型生成标签候选 + `media_artifact_save`
- Job 3: 汇总结果，输出报告

Goal 级别的状态跟踪不在 M1–M4 范围内（当前一个用户消息 = 一个 Goal = 一个 Run），
但 Run 的数据结构必须预留 `goalId` 字段，以便后续支持多 Job 编排。

### 0.4.9 Skill 作为结构化输入

Skill 不是"更高级的 Tool"，而是结构化的用户输入——它配置一次 Run 的上下文：

```ts
interface SkillInput {
  skillId: string         // 如 'short-video-production'
  parameters: Record<string, unknown>  // Skill 特定参数
  toolOverrides?: string[]  // 本次执行允许的额外 Tool
}
```

Skill 的执行流程：
1. 用户选择 Skill（或对话中触发）
2. Skill 模板展开为系统提示词片段 + 参数约束
3. 模型在 Skill 上下文中执行，调用所需 Tool
4. 结果写入 MediaArtifact

这与 Tool 的区别：Tool 是模型可调用的原子函数，Skill 是用户可选择的执行模板。

### 0.4.10 运行时能力发现

Session 创建时，Host 根据 preset 声明向 Client 通告可用能力：

```ts
interface SessionCapabilities {
  tools: string[]           // 可用 Tool 列表
  skills: string[]          // 可用 Skill 列表
  fileSourceTypes: string[] // 支持的 fileId 来源类型
  approvalRequired: string[] // 需要审批的操作列表
}
```

Client 根据 capabilities 动态调整 UI：
- 没有 `video_scan` → 不显示视频列表入口
- 没有 `scheduled_task_*` → 不显示定时任务面板
- `approvalRequired` 为空 → 不准备审批 UI

这避免了 Client 硬编码 preset 与 UI 的映射关系。

### 0.4.11 边界声明：不是 Codex 实现

以上映射参考 Codex 已公开的协议设计，用于指导 DSH 媒体运行时的架构决策。
以下方面完全是本项目的独立设计，不得描述为"Codex 就是这样做的"：

- fileId 令牌体系与四种来源分类
- MediaArtifact 数据模型（revision / candidates / status）
- Range 文件路由与 Chromium 截帧方案
- preset 守卫与 `assertMoyuToolSurface` 改造
- DSH Host Service 的 IPC 桥与 fence 边界
- 定时任务的 continuation / standalone 运行模式（灵感来自 read/resume 区分，实现完全不同）

## 0.5 Artifact 数据模型（预留）

首轮不做审阅 UI，但数据结构必须支持以下字段：

```ts
interface MediaArtifact {
  artifactId: string
  revision: number
  parentArtifactId?: string   // 修订来源
  kind: 'cover' | 'title' | 'tags' | 'script' | 'subtitle' | 'bundle'
  candidates?: MediaArtifactCandidate[]   // 结构化候选（content + weight/style/reason）；旧 string[] 读取归一为 { content }
  status: 'draft' | 'kept' | 'discarded'
  feedbackSessionId?: string  // 针对某一版本的修改指令所在会话
  videoFileId?: string
  platform?: string
  createdAt: number
}
// 每个候选：{ content: string; weight?: number; style?: string; reason?: string }
```

M3 的模型生成标签/标题候选后，调用 `media_artifact_save` Tool 写入此结构
（见决策 18），而不是只返回一段聊天文字。

## 0.6 Scheduled Task 运行模型

```text
draft → queued → running → awaiting_user → completed
                   │          └──────────→ cancelled / failed
                   └──────────────────────→ interrupted（Host 重启，无检查点）
```

两种运行方式：

| 模式 | 行为 | 场景 |
|------|------|------|
| `continuation` | 回到原会话，使用已有上下文 | 继续当前选题/运营会话 |
| `standalone` | 每次生成新会话，进入 Scheduled 收件箱 | 每日选题、定时报表 |

每次运行必须有独立 runId、状态、日志和结果 Artifact。
支持 Run now、暂停、取消、失败重试。
后台身份不继承前台会话临时授权。

## 0.7 工作流 → 必需 Tool 矩阵

确定 media preset 的工具依赖，用实际任务而非直觉决定：

| 工作流 | 必需 Tool | 来源 |
|--------|-----------|------|
| 浏览/检索本地视频 | `video_scan` | `dsh-plugin-media`（新建） |
| 读取字幕内容 | `video_subtitle_read` | `dsh-plugin-media`（新建）—— 供模型读取字幕作为生成上下文 |
| 持久化标签/标题/产物 | `media_artifact_save` | `dsh-plugin-media`（新建）—— 确定性写入 Tool，不调模型 |
| 处理封面/素材图片 | `image_convert` | `dsh-plugin-image`（已有） |
| 截取屏幕素材 | `screenshot_capture` | `dsh-plugin-screenshot`（已有） |
| 设置发布提醒 | `scheduled_task_*` | `dsh-plugin-scheduled-tasks`（已有） |
| PDF 相关 | `pdf_process` | 暂不加载，无明确创作场景 |

**media preset 守卫清单随里程碑演进**（解决空壳插件无法通过守卫的问题）：

| 里程碑 | media 必备工具集 |
|--------|-----------------|
| M1 | `image_convert`、`screenshot_capture`（仅复用已有工具） |
| M2 | + `video_scan` |
| M3 | + `video_subtitle_read`、`media_artifact_save`（决策 18） |
| M4 | + `scheduled_task_*` |

每个 Tool 实现并通过 harness 验证后才加入必备集。M1 阶段 `dsh-plugin-media` 为空壳，
不声明任何 Tool，守卫只检查 `image_convert` + `screenshot_capture`。

## 0.8 进度树

```text
自媒体工作台
├── M0 协议 Spike（隔离测试，不依赖 media preset）✅ 完成
│   ├── M0-a RunEvent + ServerRequest 类型定义 .. ✅ types.ts 定义完成
│   ├── M0-b 假任务端到端 ...................... ✅ Host 16/16 + Client 11/11 harness 通过
│   ├── M0-c Host 重启重建 ..................... ✅ SSE 推送 + onRequest 重发验证 + running→interrupted
│   ├── 修复 R1：竞态/Client空壳/重发假阳/根JSON/lockfile ✅ 审查 P0×3 + P1×2 闭合
│   └── 修复 R2：Client 轮询→SSE通知协议 + dedup 实测 ✅ 审查 P0×1 + P1×1 闭合
│
├── M1 preset 空壳 + 基础设施 .................. ✅ 终签（真隔离/真显隐/真 e2e + 孤岛已清）
│   ├── M1-a 守卫改造 ......................... ✅ PRESET_REQUIRED_TOOLS 按 preset 校验 + 未知 fail-closed，profile 12/12
│   ├── M1-b media preset 模板 ................. ✅ preset.yml + agent.cordis.yml（插件由 Profile 全局装载，模板暂与 moyu 同构）
│   ├── M1-c 会话过滤（前置门禁） ............. ✅ overlay sessionVisible 接 __moyuActivePreset，真过滤 deriveGroups/Flat/Search；e2e 10/10
│   ├── M1-d Spike：preset 切换端到端 ......... ✅ Electron dev server 真起 Host，session.create/未知拦截/list/切换/显隐 10/10
│   ├── M1-e 能力发现 ......................... ✅ Host capabilities 路由；panel 用 hasCapability 真控 MockTask/审批 UI 显隐
│   └── M1-P1 清理孤岛（终签前置） ........... ✅ 已删 4 个过滤函数及 harness 假覆盖；真源注释写在 sessionVisible；决策 19
│
├── M2 视频文件管理 ............................ ✅ 功能达标（Chromium Range 样本 bytes=0-；e2e 12/12）
│   ├── M2-a Spike：Range 文件路由 ............ ✅ 真实 <video> 加载+seek+canvas；Host 记录 Range="bytes=0-"
│   ├── M2-b video_scan Host Service ........... ✅ scan/list + sourceId 持久 / fileId 按 generation 重签
│   ├── M2-c 本地文件路由（Range） ............ ✅ /moyu/media/:fileId 单段 206、multipart 400、越界 416、HEAD、不退化
│   ├── M2-d 缩略图生成 ....................... ✅ Client seek 10% 抓帧 POST 缓存，mtime 变则失效
│   ├── M2-e 视频列表 Client UI ............... ✅ conversation.view，hasCapability(video_scan) 真显隐
│   ├── M2-f 字幕关联 ......................... ✅ 同名 .srt/.txt 自动匹配，subtitle-text 供预览
│   └── M2-g 设置面板 ......................... ✅ settings.section：目录 label + 后缀；路径只留 Host store.json
│
├── M3 标签与标题生成 .......................... ✅ 功能达标（确定性 Tool，无嵌套调模型）
│   ├── M3-a video_subtitle_read Tool .......... ✅ 字幕文本 + basename label；无字幕空结果；无效 token 404
│   ├── M3-b media_artifact_save Tool .......... ✅ draft 持久化 + artifact_created；修订链；kept/discarded
│   └── M3-c media preset 系统提示词调优 ....... ✅ dsh-persona 写入 media preset；instructions 路由同源正文
│
└── M4 发布提醒 ................................ ✅ 功能达标（复用 scheduled-tasks，无新 Host Service）
    ├── M4-a scheduled-tasks preset 感知 ....... ✅ 创建记 agentPreset；缺省 moyu；run 用 task.preset；continuation/standalone
    ├── M4-b Client UI preset 过滤 ............. ✅ conversation.view / surface.scheduled 按 window.__moyuActivePreset 过滤
    └── M4-c 视频库存提醒 ..................... ✅ 对话引导 + inventoryThreshold 存 media settings；默认 standalone
```

图例：✅ 完成并验证 · ◐ 部分完成（子项已签但整项未闭合）· ⬜ 未开始 · ❌ 阻塞/未通过

## 0.9 M0 协议 Spike

目标：用假任务跑通完整的运行协议链路，验证 §0.4 映射在 DSH Host/Client 架构下可行。
M0 不做任何业务功能，只验证协议骨架。M0 通过后 M1 才开工。

**隔离策略**：M0 不创建真正的 media preset/Session，使用独立的测试 composition
（harness 脚本 + 硬编码的 `mock-spike` preset）。能力发现（§0.4.10）依赖真实
preset，推迟到 M1-e 在 media preset 创建后验证。

### 0.9.1 RunEvent + ServerRequest 类型定义（M0-a）

在 `packages/dsh-plugin-media/src/types.ts` 中定义：
- §0.4.3 的 `RunEvent` 联合类型（不含 approval_response，审批走 server request）
- §0.4.7 的 `ServerRequest` / `ServerResponse` 类型
- §0.4.10 的 `SessionCapabilities` 接口

这是后续所有里程碑的基础类型。

### 0.9.2 假任务端到端（M0-b）

实现一个硬编码的 `mock_media_task` Tool，不做真实业务，只走通事件链：

```text
Client 发起 → Host 发出 started notification
           → Host 发出 progress notification（模拟 3 次进度更新）
           → Host 发出 server_request（request，带 requestId，模拟需要用户确认）
           → Client 返回 server_response（response，同一 requestId）
           → Host 发出 server_request_resolved notification
           → Host 发出 artifact_created notification（写入一个假 MediaArtifact）
           → Host 发出 completed notification
```

Client 侧需要：
- 监听全部事件类型，console 输出事件流日志
- 收到 `server_request` 时展示最简审批 UI（确认/取消按钮）
- 收到 `artifact_created` 时记录产物
- M0 面板临时挂载到上游真实 `settings.section` Slot；不得为 Spike 虚构只在
  mock harness 中存在的自定义 surface。M1 建立正式 media 入口后再移除该临时面板。

### 0.9.3 Host 重启重建（M0-c）

验证 read/resume 分离（§0.4.5）：

1. 假任务执行到 `server_request` 阶段时手动重启 Host
2. Host 重启后 read：从 `store.json` 恢复 Run 状态为 `awaiting_user`
3. `running` 状态的 Run：检查是否有检查点（checkpoint），有则 resume，无则终结为
   `interrupted` 并允许用户手动重试（不自动重新执行，防止非幂等任务重复）
4. `awaiting_user` 状态的 Run：Client 重连后 Host 重新发出 `server_request`，
   Client 恢复审批面板
5. 用户批准后继续执行到 `completed`

**事件标记要求**：每个事件必须携带 `generation`（Host 实例代）和 `sequence`（事件序号），
Client 据此判断是否为重启后的重放事件，避免重复处理。

### M0 验收判据

| 验收项 | 判据 |
|--------|------|
| 事件完整性 | started → progress(3次) → server_request → server_response → server_request_resolved → artifact_created → completed 全链路走通 |
| 审批阻塞 | server_request 发出后 Run 暂停，等用户 response 后才继续 |
| 重启恢复（awaiting_user） | Host 重启后状态正确恢复，Client 重连后审批面板重现 |
| 重启恢复（running 无检查点） | Run 终结为 interrupted，不自动重新执行 |
| 事件类型安全 | 所有事件通过 RunEvent 类型约束，不合法事件编译期报错 |
| 事件幂等 | Client 收到带相同 generation+sequence 的事件时去重 |

## 1. M1 preset 空壳 + 基础设施

目标：验证多 preset 并存、切换、会话隔离的完整链路。本阶段不加任何自媒体业务功能。

**前置**：M0 协议 Spike 通过后开工。M0 验证的 RunEvent、SessionCapabilities 和
read/resume 机制是 M1–M4 所有运行时行为的基础。

**前置门禁**：M1-c 会话过滤作为 M2–M4 的前置条件，必须在 M1-d Spike 中验证通过。
所有后续里程碑的 Client UI 都依赖 preset/session 过滤机制正常工作。

### 1.1 守卫改造（M1-a）

当前 `packages/dsh-profile/index.mjs` 中 `assertMoyuToolSurface` 硬编码三件套
（`image_convert`、`pdf_process`、`screenshot_capture`）为全局必备。改造为：

```js
const PRESET_REQUIRED_TOOLS = {
  moyu: ['image_convert', 'pdf_process', 'screenshot_capture'],
  // media 守卫清单随里程碑演进，见 §0.7
  // M1 阶段只检查复用的已有工具；每个新 Tool 实现并通过 harness 后加入
  media: ['image_convert', 'screenshot_capture'],
}
```

- `moyu` preset（或未指定 preset）：保持三件套检查 + shell 禁止
- `media` preset：M1 只检查 `image_convert` + `screenshot_capture`；
  M2 加入 `video_scan`，M3 加入生成/保存 Tool，逐步收紧
- 未知 preset：拒绝创建会话（fail-closed）
- 守卫清单的变更必须与对应 Tool 的 harness 验证同步提交

### 1.2 media preset 模板（M1-b）

在 `build-dsh-runtime.mjs` 中新增 media preset 生成：

```yaml
# $DSH_HOME/.agent-presets/media/preset.yml
name: 自媒体
description: 自媒体内容创作工作台
```

`agent.cordis.yml` 声明自媒体所需的插件组合：

- 基础组件：`agent-instructions`、`tool-ask-user`
- 复用组件：`dsh-plugin-image`、`dsh-plugin-screenshot`、`dsh-plugin-scheduled-tasks`
- 新增组件：`dsh-plugin-media`（M1 阶段声明但插件内容为空壳，M2 填充）

系统提示词单独文件管理，M1 阶段放简单占位，M3 正式调优。

### 1.3 会话过滤（M1-c，前置门禁）

会话列表 preset 过滤的**唯一真源**是 overlay
`vendor/codex-web-overlay/ui-workspace/client.js` 的 `sessionVisible`
（决策 19）。`deriveGroups` / `deriveFlat` / `deriveSearchResults` 都走这一门禁。

```text
Host session.list（返回全量摘要，含 agentPreset 字段）
        ↓
overlay sessionVisible（读 window.__moyuActivePreset）
        ↓
moyu 列表 / media 列表
```

- Client 插件只写 `window.__moyuActivePreset` 并派发 `moyu-preset-changed`，不平行实现列表过滤
- current 会话恒可见，避免丢导航上下文
- 旧会话无 `agentPreset`（或空白）时归入 **moyu 视图可见**，不单开 "other" 视图
- 搜索结果同样经 `sessionVisible` 过滤，不另写交集函数
- `session-filter.ts` 不承载会话索引；只保留 `getSessionCapabilities` / `hasCapability`

### 1.4 Spike 验收（M1-d）

| 验收项 | 判据 |
|--------|------|
| preset 切换 | 点击切换 media/moyu，UI 正确响应 |
| 会话隔离 | media 会话不出现在 moyu 列表，反之亦然 |
| 会话创建 | 新建会话自动关联当前 preset |
| preset 锁定 | 发送第一条消息后 preset 不可更改 |
| 守卫 | media 会话缺少 `image_convert` 或 `screenshot_capture` 时拒绝创建（M1 阶段清单） |
| 守卫 | moyu 会话缺少三件套时拒绝创建 |
| 能力发现（M1-e） | media Session 拿到完整 capabilities（含已实现 Tool），moyu Session 不含 media 能力 |

### 1.5 能力发现（M1-e）

验证 §0.4.10 的运行时能力通告（从 M0 移入，此时 media preset 已存在）：

1. 创建 media Session 时，Host 返回 `SessionCapabilities`（tools 含 M1 阶段已实现的工具）
2. Client 根据 capabilities 动态显示/隐藏 UI 入口
3. 创建 moyu Session 时，capabilities 不含 media 能力，media UI 入口不显示
4. 验证 capabilities 随里程碑演进：M2 加入 `video_scan` 后，media Session 的
   capabilities.tools 自动包含新工具，Client 动态显示视频列表入口

## 2. M2 视频文件管理

目标：用户在设置中配置视频目录后，自媒体工作台展示视频缩略图列表，
自动关联同目录的字幕文件。

### 2.0 Spike：Range 文件路由（M2-a，前置）

在实现完整视频管理前，先验证 Range 文件路由 + `<video>` 播放 + seek + canvas 截帧
的可行性。最小验证清单：

- Host webServer 挂测试路由，提供一个本地 MP4 文件
- `<video>` 能加载并播放
- seek 到任意时间点后 canvas 能抓帧
- 验证 sandbox:true 的 WebContents 下上述流程正常

**Range 路由最低契约**：

| 要求 | 说明 |
|------|------|
| fileId 映射 | URL 不暴露绝对路径 |
| 单段 Range | 接受三种单段形式（Chromium `<video>` 实际使用）：`bytes=start-end`、`bytes=start-`（无 end）、`bytes=-suffix` |
| 拒绝 multipart | 多段 Range 返回 400，不实现 `multipart/byteranges` |
| 206 响应 | `Accept-Ranges: bytes` + `Content-Range` + `Content-Length` |
| 416 越界 | Range 越界返回 `416 Range Not Satisfiable` |
| HEAD 支持 | 返回文件大小，不传输 body |
| 令牌校验 | 每次请求校验 fileId 有效性、来源类型、归属、是否已索引 |
| 句柄清理 | 流中断时关闭文件句柄 |
| 不退化 | 不把带 Range 的请求退化成整文件 200 |

**Spike 前置步骤**：用 `<video>` 加载测试文件并 seek，在 Host 侧记录 Chromium
实际发出的 Range 请求头，据此冻结契约。不预先猜测请求形式。

**M2-a 冻结样本（2026-09-01，sandbox WebContents，2s H.264 320x240 MP4，加载后 seek 10%）**：

```text
[moyu-media][range] method=GET path=/moyu/media/<fileId> range="bytes=0-"
```

Chromium 对本 fixture 只发出 open-end 单段 `bytes=0-`（整段从 0 读到 EOF）。三种单段形式均实现并经 harness 覆盖；multipart 拒绝。后续实现必须继续对带 Range 的请求返回 206，不得退化成 200。

Spike 通过后再进入 M2-b 正式实现。

### 2.1 video_scan Host Service（M2-b）

新建 `packages/dsh-plugin-media/`（npm workspace），Host 侧实现：

- `media.scan`：扫描用户配置的目录，递归查找 `.mp4` 文件
- `media.list`：返回已索引视频的元数据列表（文件名、大小、修改时间、时长、fileId 令牌）
- `media.subtitles`：按文件名匹配同目录下的 `.srt` / `.txt` 文件
- 索引持久化到 `store.json`（与 scheduled-tasks 同模式）
- 文件变更检测：启动时重新扫描，或提供手动刷新操作

**资源标识与令牌分离**：
- **sourceId**（持久）：稳定的资源标识，持久化到 `store.json`，跨 Host 重启有效。
  绑定文件路径指纹 + mtime，用于重新签发 fileId
- **fileId**（短期）：每次 Host 启动时根据 sourceId 重新签发的访问令牌，
  绑定 Host generation，不跨重启有效。映射到本地绝对路径，不向 Client/模型暴露路径
- 每个 fileId 携带来源类型（见 §0.2），Host 根据类型决定令牌有效期
- `project-source`：sourceId 持久，每次启动重签 fileId（校验 mtime 未变）
- `session-attachment` / `job-result`：sourceId + fileId 均绑定 Host 实例
- `scheduled-input`：持久化 sourceId 或显式委托记录，Host 启动时重签 fileId
- 跨会话访问：同一 media preset 的不同会话可引用同一 sourceId 签发的 fileId
  （按令牌能力，不按 preset 开关）

不在 Host 层做视频解码或转码，保持轻量。

### 2.2 本地文件路由（M2-c）

Host webServer 注册路由 `/moyu/media/:fileId`，按 M2-a Spike 验证的 Range 契约实现。

**访问控制模型**（决策 16）：

```text
preset 控制能力入口（谁能创建令牌、调用 media Tool）
fileId 控制具体资源访问（令牌携带来源类型、主体、有效期、允许操作）
fence 控制应用实例边界（Electron/Host 校验）
```

- 路由消费端凭令牌能力访问，不按 preset 全局开放或关闭
- 定时任务、结果预览和其他合法 preset 可通过显式委托的 `scheduled-input` 令牌访问
- 无效、过期、跨主体访问统一返回不可枚举结果（404，不泄露文件是否存在）

大文件注意事项：
- 视频限制 1GB 以内（决策 8），但仍需流式传输，不可整文件读入内存
- `createReadStream` + `start`/`end` 选项实现 Range
- 并发请求（多个 `<video>` 同时加载）需要正确管理文件句柄

### 2.3 缩略图生成（M2-d）

在 Client 端实现，不依赖 FFmpeg：

1. Client UI 创建隐藏的 `<video>` 元素，`src` 指向 `/moyu/media/:fileId`
2. `loadeddata` 事件后 seek 到视频时长的 10% 位置
3. `seeked` 事件后用 `<canvas>` 抓帧，转为 Blob
4. 通过 `POST /moyu/media/:fileId/thumbnail` 上传到 Host 缓存
5. 下次加载通过 `GET /moyu/media/:fileId/thumbnail` 取缓存

**缓存失效策略**：文件路径 + mtime 作为缓存 key，Host 重新扫描时
比对 mtime，变化则标记缩略图失效，Client 下次请求时重新生成。

限制：只支持 Chromium 能解码的格式（MP4/H.264 已确认覆盖）。

### 2.4 视频列表 Client UI（M2-e）

注册 `conversation.view`，展示：

- 缩略图网格布局，每项显示：缩略图、文件名、时长、文件大小
- 关联的字幕文件名（如有）
- 点击视频可展开详情（元数据、字幕内容预览）
- 顶部操作栏：刷新索引、打开设置

### 2.5 字幕关联（M2-f）

自动匹配规则：同目录下与视频文件同名（去掉扩展名后）的 `.srt` / `.txt` 文件。
例如 `video-01.mp4` 自动关联 `video-01.srt` 和 `video-01.txt`。

Host Service 读取字幕文件内容，供标签/标题生成 Tool 使用。

### 2.6 设置面板（M2-g）

注册 `settings.section`，配置项：

- 视频目录路径（支持多个，点击"添加"按钮通过文件对话框选择）
- 字幕文件后缀偏好（默认 `.srt, .txt`，可编辑）
- 存储在 DSH settings store

## 3. M3 标签与标题生成

目标：模型根据字幕或用户文案直接生成标签和标题候选（不嵌套调模型），
然后调用确定性 Tool 持久化为 MediaArtifact（§0.5）。

### 3.1 video_subtitle_read Tool（M3-a）

读取指定视频关联的字幕文件内容，供模型作为生成上下文。

输入参数：
- `videoFileId`（必需）：指定视频的 fileId

输出：字幕文本内容（纯文本）+ `files[{ label, fileName }]`（basename 级 label，**不含绝对路径**，决策 20）。
如果视频无关联字幕，返回空结果（不报错）。无效 / 跨主体 fileId → 不可枚举错误（not found）。

### 3.2 media_artifact_save Tool（M3-b）

确定性的持久化 Tool，不调用模型。模型生成候选后调用此 Tool 写入 MediaArtifact。

输入参数：
- `kind`（必需）：`'tags'` | `'title'` | `'cover'` | `'script'` | `'subtitle'` | `'bundle'`
- `candidates`（必需）：候选列表，每项包含内容和元信息（权重/风格/推荐理由）
- `videoFileId`（可选）：关联的视频
- `parentArtifactId`（可选）：修订来源
- `platform`（可选）：目标平台（B站、YouTube、抖音等）

输出：`MediaArtifact`，初始 `status: 'draft'`，用户可标记 `kept` / `discarded`。
同时发出 `artifact_created` 事件。

**设计理由**（决策 18）：`video_tag_generate` / `video_title_generate` 如果内部
再调模型，形成"模型调 Tool，Tool 调模型"的嵌套链路，控制流和错误处理复杂度倍增。
更自然的设计是：对话模型在系统提示词引导下直接生成候选，再调用确定性的
`media_artifact_save` 写入结构化结果。

### 3.3 系统提示词调优（M3-c）

media preset 的系统提示词在此阶段正式定稿，内容：
- 角色定位：自媒体内容助手
- 能力边界：标签/标题生成、视频库管理建议、发布节奏规划
- 生成流程引导：先调 `video_subtitle_read` 获取上下文 → 直接生成候选 →
  调 `media_artifact_save` 持久化
- Artifact 输出规范：所有生成结果必须通过 `media_artifact_save` 写入，
  支持多版本迭代
- 不做：视频剪辑、转码、直接发布到平台

## 4. M4 发布提醒

目标：复用 `scheduled-tasks` 插件，在自媒体工作台提供发布提醒和库存监控。

### 4.1 preset 感知 + 运行模型（M4-a）

`scheduled-tasks` 插件改造：
- 任务创建时自动记录当前 `agentPreset`
- 存储层 `store.json` 中每个任务新增 `preset` 和 `runMode` 字段
- `runMode: 'continuation'`：回到原会话继续执行
- `runMode: 'standalone'`：每次生成新会话，进入 Scheduled 收件箱
- 每次运行有独立 runId、状态（draft → queued → running → awaiting_user → completed / cancelled / failed）、日志和结果 Artifact
- 支持 Run now、暂停、取消、失败重试
- 已有任务无 `preset` 字段时视为 `moyu`（向后兼容）
- 后台身份不继承前台会话临时授权

### 4.2 Client UI preset 过滤（M4-b）

`scheduled-tasks` 的 `conversation.view` 增加过滤逻辑：
- 读取当前活跃的 `agentPreset`
- 只显示 `task.preset === currentPreset` 的任务
- moyu 工作台看 moyu 的任务，media 工作台看 media 的任务

任务卡至少展示：
- 目标与输入摘要
- 当前阶段和进度
- 暂停、取消、重试操作
- 等待用户选择时的明确状态（`awaiting_user`）
- 最终 Artifact 链接

### 4.3 视频库存提醒（M4-c）

自媒体场景特有的提醒类型：
- "待发布提醒"：用户标记某视频为"待发布"，设置发布日期，到期提醒
- "库存不足"：当已完成未发布的视频数量低于阈值时提醒（阈值在设置中配置）

这些本质上是 scheduled-tasks 的特定业务用法，通过对话引导用户创建，
不需要额外的 Host Service。建议默认 `runMode: 'standalone'`（每次独立报告）。

## 5. 包结构

```text
packages/
├── dsh-plugin-media/              ← 新建
│   ├── src/index.ts               ← Host: video_scan, media.list, 文件路由, 缩略图缓存, Artifact 存储
│   ├── src/client.tsx             ← Client: 视频列表 view, 设置面板, 缩略图生成
│   ├── src/types.ts               ← MediaArtifact, FileSource 等共享类型
│   ├── harness/verify.mjs         ← Host 合约测试
│   └── harness/verify-client.mjs  ← Client 合约测试
├── dsh-plugin-scheduled-tasks/    ← 已有，M4 改造加 preset 感知 + 运行模型
└── dsh-profile/                   ← 已有，M1 改造守卫
```

主 `package.json` workspaces 新增 `packages/dsh-plugin-media`。
`build-dsh-runtime.mjs` 新增 media preset 模板生成 + media 插件依赖拷贝。

## 6. 不做清单

以下功能不在本计划范围内，不得在开发过程中引入：

- FFmpeg 或任何视频转码/压缩能力
- 字幕编辑或字幕生成（语音转文字）
- 视频剪辑或画面编辑
- 直接发布到第三方平台（B站/YouTube/抖音 API）
- 多设备同步、云端调度
- 非 MP4/H.264 格式支持
- Canvas 式审阅 UI（数据模型预留，UI 不在本计划）
- Skill 封装层（Tool 设计需考虑 Skill 编排，但 Skill 本身不在本计划）
- RRULE 自由表达式（scheduled-tasks 沿用固定模式周期）

## 7. 验收要求

除各里程碑自身的功能验收外，以下场景必须在 M2 完成后回归：

| 场景 | 验收判据 |
|------|----------|
| 大文件（接近 1GB） | Range 路由正常流式传输，不 OOM |
| seek 截帧 | `<video>` seek 到任意位置后 canvas 抓帧成功 |
| 令牌轮换 | Host 重启后旧 fileId 全部失效（含 project-source），sourceId 不变，重签后新 fileId 可用 |
| 跨会话访问 | 同一 media preset 的不同会话可引用同一 sourceId 签发的 fileId |
| 令牌能力隔离 | 令牌只允许声明的操作（读取/截帧），拒绝未授权操作 |
| 无效令牌 | 过期、伪造、跨主体的 fileId 统一返回 404（不泄露文件存在性） |
| Host 换代 | DSH 上游版本更新后 Range 路由、fileId 映射、session 过滤不回退 |

## 8. 开放问题

以下问题不阻塞 M1 开工，但需要在对应里程碑前定论：

1. ~~media preset 是否加载图片/截图~~（已决定：加载，见决策 10）。PDF 是否在后续版本补充，
   根据实际使用体验决定。

2. 视频列表是否需要分组/标签/筛选？M2 先做平铺列表，后续根据视频量决定。

3. 缩略图缓存失效策略：文件路径 + mtime 作为缓存 key，mtime 变化即重新生成（M2 方案）。
   是否需要更精细的策略（如内容哈希），根据实际使用体验决定。

4. ~~`/moyu/media/:fileId` 路由是否对所有 preset 开放~~（已决定：按令牌能力控制，不按 preset 开关，见决策 16）。

5. `project-source` 类文件的管理界面放在哪里？候选：settings.section 的子页面 /
   conversation.view 的"项目素材"tab / 独立的项目管理视图。M2 阶段先不做界面，
   品牌素材通过设置面板的目录配置自动纳入。
