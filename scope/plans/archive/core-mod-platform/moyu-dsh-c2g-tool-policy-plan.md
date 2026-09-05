# C2-g · 工具面策略（单一工作台修订版）

> ⚠️ **2026-09-03 重大修订：取消 moyu/media 双预设 → 单一工作台。** 第二层（per-preset/policy-surface 可见面、`restrict`、agent.cordis.yml policy 插件、`inheritedAllow/scopedExpected/visibleExpected`、Manifest `presets` 作用域）**全部作废**。C2-g 收缩为**只做第一层：全局注册完整性**——期望工具面 = 核心内置 Tool（含 screenshot_capture / moyu_schedule_* / session-export 等系统功能）+ 已启用 Mod 声明的 Tool；实际全局面须与之精确一致（无未声明、无冲突、启用 Mod 声明的 Tool 必须在场）。g2a 剩余的 per-preset 探测作废。下文 §3.2、§5.2 的 surfaces/policySurface/restrict 内容仅作历史留存，不再实现。
>
> 性质：C2 前置架构修复。隶属 `moyu-dsh-c2-business-strip-plan.md` §8。契约 `moyu-dsh-core-mod-contract.md`（§1.1b 内置系统功能）。背景 [[core-mod-pivot]]。
> 版本 `0.1.0`（对齐 package.json，[[doc-version-convention]]）。
> 状态：**C2-g 完成（2026-09-03，单一工作台）**。g1a/g1b/g2a/g2b/g3/g5/g6 全绿；g4 作废。工具面完整性 = host-ready 全局精确审计（core 内置台账 + 已启用 Mod 声明，无未声明/无冲突/缺声明即拒启动）。下一步回 C2-f 逐个把 image/pdf 迁为 Mod。

## 0. 目标、非目标与停止条件

目标只有一个：**已启用 Mod 的声明、Host 实际加载的全局 Tool、每类 Preset 最终暴露给模型的 Tool 三者保持同源且可证明一致**。

非目标：
- 不迁移 image / pdf / screenshot / media / scheduled-tasks；C2-g 只铺策略地基。
- 不做 Mod 热插拔；启停仍在下一代 Host 生效。
- 不改 DSH 上游，不增加第二套工具注册 API。
- 不用 Client UI、能力说明路由或日志字符串代替 `ToolRuntime.schemas()` 的真实结果。

出现以下任一情况时停止实现、记录原始证据并重新审查计划：
- `restrict({ allow })` 在真实 Preset standing scope 中的行为与 §1 不一致；
- 无法在 Host ready 前可靠执行全局 Tool 审计；
- DSH 实际全局 Tool 含无法归属到核心或已启用 Mod 的项目；
- Preset 内存在 C2-g 无法识别且无法由中央守卫同步拒绝的 scoped Tool。

## 1. 已核实的 DSH 约束

### 1.1 ToolRuntime

- `ctx.tools.register()` 可在全局上下文或 scoped context 注册；scoped Tool 会覆盖同名 global Tool。
- `ctx.tools.restrict({ allow?, deny? })` **只能在 scoped context 调用**。
- restriction 只裁剪继承来的 Tool；**当前 scope 自己注册的 Tool 不受 restriction 影响**。
- `restrict({ allow })` 会拒绝 allow 中不存在于继承层的名称；因此不能把 Preset 本地 Tool 混进 allow。
- `ctx.tools.schemas(scope)` 返回施加 restriction 后的真实可见集合；非 `native` 模式还可能出现保留传输 Tool `run_code`。
- `tools.guard()` 可按 scope 增加执行层拒绝，作为可见面裁剪后的纵深防御。

证据：`node_modules/@deepseek-ai/dsh-tools/lib/index.js` 的 `register`、`restrict`、`view`、`schemas`、`guard` 实现。

### 1.2 Agent Preset

- `agent.cordis.yml` 不是为每个会话重新实例化：DSH 将它挂成 **per-preset standing composition**，同一 Preset 的 Agent 继承该 standing scope。
- standing composition 在 Agent 发布前完成 mount；不可用条目会使 Agent 创建失败。
- scoped `session/created` listener 只接收进入该 scope 的会话；同步抛错会回滚会话发布。
- DSH 的 Preset 复制会复制整个目录，因此复制出的 Preset 会保留策略插件及其 `policySurface` 配置。

证据：`node_modules/@deepseek-ai/dsh-agent-presets/lib/index.js` 的 `mountPreset()` 与 `AgentPresets.mount()` 注释和实现；`dsh-session` 的同步 `session/created` 回滚边界。

**术语修正**：后文称“Preset standing scope 策略”，不再笼统称“每 Agent 实例策略”。

## 2. 纠正与真实结构债

- `moyu tool whitelist drift` 字符串只在 `dsh-plugin-hello`（M0a Spike）。生产插件 image/pdf/screenshot 调用的 `assertMoyuToolSurface()` 只做必备子集检查 + shell denylist + 未知 Preset 拒绝，无精确白名单相等检查。
- 三个业务插件重复注册同一类 `session/created` 守卫，且与 Media 自己的 restriction 争用事件时序。
- Profile 硬编码业务必备 Tool；Manifest 之前不声明 Tool；测试又把静态 composition 当 Tool 真源。
- `applyModsToProfile()` 当前先把所有 enabled Mod 写进 patch，再逐个复制包且允许单个失败；这会产生“composition 声称加载、包实际没落地、策略却按 registry 计算”的三方不一致。
- `@moyu/dsh-profile` 当前没有作为可被打包后 Preset bare import 解析的运行包交付；只改 `agent.cordis.yml` 会在干净安装失败。
- 当前 `tool-ask-user` 同时出现在 Host insert 与两个 Preset 模板中，存在 global/scoped 同名来源；在定义策略基线前必须先实测并消歧。

## 3. 两层模型

### 3.1 第一层：全局注册完整性

```text
globalExpected = transitionalCoreGlobalTools
               ∪ Σ(activeMods.provides.tools.name)
```

`activeMods` 不是 `registry.mods.filter(enabled)`，而是同一次启动中完成以下检查并成功落入 profile 的集合：

```text
enabled
→ manifest 可读且 validateManifest 通过
→ registry 与 manifest 的 id/version/plugins 一致
→ shell/kernel/platform 兼容
→ INSTALLED 完整性通过
→ package 原子复制成功
→ 无 plugin id / package name / tool name 冲突
```

全局审计在所有 root composition Mod 条目加载完成后、Host ready 前执行：

```text
actualGlobal = ctx.tools.schemas().map(name)
actualGlobal === globalExpected
```

- 实际出现未归属 Tool：拒绝本代 Host ready。
- active Mod 声明的 Tool 未注册：拒绝本代 Host ready。
- 两个 active Mod 声明同名 Tool：composition 前拒绝，不允许后加载覆盖。
- 与核心静态插件的 plugin id、package name 或 Tool name 冲突：composition 前拒绝。
- disabled / uninstalled / incompatible / staging 失败的 Mod 不属于 activeMods，也不进入策略快照。

`transitionalCoreGlobalTools` 是 C2 迁移期所有权台账，不是新的业务白名单：g2a 根据真实 Host 探针冻结初值；每迁走一个业务插件，必须在同一提交中从该台账移除并由 Mod Manifest 接管。C2 完成时它只允许剩余的真正核心 global Tool。

### 3.2 第二层：Policy Surface 可见面

不能把“最终可见全集”直接传给 `restrict`。每个 `policySurface` 必须拆成：

```text
inheritedAllow[surface] = 允许从 Host/global 层继承的 Tool
scopedExpected[surface] = 该 Preset standing composition 自己注册的 Tool
visibleExpected[surface] = inheritedAllow ∪ scopedExpected
```

Preset standing scope 组装时：

```js
ctx.tools.restrict({ allow: inheritedAllow[policySurface] })
ctx.tools.guard((exec) => visibleExpected[policySurface].includes(exec.name)
  ? undefined
  : `tool ${exec.name} is not available on policy surface ${policySurface}`)
```

会话发布边界由同一个 scoped policy 插件同步断言：

```text
ctx.tools.schemas() 的名称集合 === visibleExpected[policySurface]
```

这样同时保证：
- `pdf_process` 只在 `moyu` 可见；Media Tool 只在 `media` 可见；
- Mod 启用不等于自动进入所有 Surface；
- Preset 内偷偷注册的 scoped Tool 即使不受 restriction 影响，也会被最终精确断言拒绝；
- 执行层 guard 与可见面使用同一份策略，不由业务插件各写一套。

### 3.3 Preset id 与 policySurface 分离

Manifest 的 `presets` 字段在 C2-g v1 中解释为 **policy surface id**，当前只允许 `moyu`、`media`，不是任意 Preset 目录名。

```yaml
- id: moyu-tool-policy
  name: '@moyu/dsh-profile'
  config:
    mode: preset
    policySurface: moyu
```

复制 `moyu` 得到的用户 Preset 即使目录名改变，仍继承 `policySurface: moyu`；复制 Media 同理。中央守卫以已挂载的策略配置为权限真源，不用 session header 的目录名重新猜权限面。

完全不含 `moyu-tool-policy` 的外部手写 Preset 不在 C2-g 支持范围；正式产品只允许从受信模板复制。若未来开放任意 Preset composition 导入，必须另做 Host 级“每个 Agent 必须携带 policy marker”的门禁，不能默认为安全。

## 4. Manifest v1 Tool 契约

```json
{
  "provides": {
    "plugins": [{ "id": "moyu-image", "name": "@moyu/dsh-plugin-image" }],
    "tools": [{ "name": "image_convert", "presets": ["moyu", "media"], "required": true }]
  }
}
```

映射：

```text
moyu-image       image_convert                                      → moyu, media
moyu-pdf         pdf_process                                        → moyu
moyu-screenshot  screenshot_capture                                 → moyu, media
moyu-media       video_scan / video_subtitle_read / media_artifact_save → media
moyu-scheduled   moyu_schedule_create / moyu_schedule_run_now       → media
session-export   provides.tools = []
```

v1 约束：
- Tool name 必须满足 DSH Tool 命名规则，拒绝保留名 `run_code`。
- `presets` 只能取已知 `policySurface`，数组非空、去重。
- 同一 Manifest 内 Tool name 不得重复。
- `required` 在 v1 必须为 `true`（省略等价于 `true`）；**暂不支持 `false`**。否则快照生成时尚不知道条件 Tool 是否会注册，而 `restrict` 又会拒绝未知 allow 名，无法保持静态精确策略。条件 Tool 另开契约后再支持。
- Manifest 文件是声明正本；registry 只保存安装/启停状态。启动时读取并重新校验已安装 Manifest，不把 registry 中的旧字段当能力真源。

## 5. 启动快照与同源装配

### 5.1 快照位置与 schema

Main 在本代 Host 启动前生成 `mods/effective-tool-policy.json`，通过非秘密环境变量 `MOYU_TOOL_POLICY_PATH` 把**绝对路径**传给 DSH 子进程。Profile 插件不得自行根据 `DSH_HOME` 猜 sibling 路径。

建议 schema（字段与数组稳定排序）：

```json
{
  "schemaVersion": 1,
  "registryVersion": 1,
  "registryDigest": "sha256:...",
  "activeMods": [{ "id": "moyu-image", "version": "0.0.0", "sha256": "..." }],
  "globalExpected": ["..."],
  "owners": { "image_convert": "mod:moyu-image" },
  "surfaces": {
    "moyu": {
      "inheritedAllow": ["..."],
      "scopedExpected": ["ask_user_question"],
      "visibleExpected": ["..."]
    },
    "media": { "inheritedAllow": ["..."], "scopedExpected": ["ask_user_question"], "visibleExpected": ["..."] }
  }
}
```

- 不新增虚构的 registry revision；当前 registry 没有该字段。用 canonical registry + active manifest 摘要形成 `registryDigest`。
- 临时文件写完、`fsync`、rename 后才发布；插件加载时校验 schema、集合唯一性、digest 格式并在内存中深冻结。
- 同一 Host generation 只读一次；运行中启停 Mod 不 watcher、不热更新。

### 5.2 两阶段应用，禁止“半 composition”

`applyModsToProfile()` 调整为：

1. **Resolve/Stage**：从同一 registry 读取得到候选，读 Manifest、校验兼容/完整性/冲突；每个包复制到临时目录后原子换入。得到唯一 `activeMods`。
2. **Compose/Publish**：只用该内存 `activeMods` 同时生成 patch 与 effective policy；全局审计条目固定排在所有 active Mod 条目之后；两份文件均成功后才允许 fork Host。

错误分级：
- 单 Mod 的缺包、复制失败、不兼容：该 Mod 从 activeMods 排除，记录诊断，核心可继续。
- Tool/plugin/package 所有权冲突、策略 schema/digest 错误、patch/policy 发布失败：安全不变量损坏，拒绝启动本代 Host，不得由 broad catch 静默回退“纯核心”。

这要求移除当前 `applyEnabledMods()` 对安全错误的一把抓 catch；允许降级的 Mod staging 失败应在 `applyModsToProfile()` 内转成结构化诊断，安全策略失败必须向上抛。

## 6. 两个运行形态

### 6.1 Host 全局审计器

`@moyu/dsh-profile` 以 `mode: host-audit` 作为 root composition 的**最后一行**加载，读取同一快照并对 `ctx.tools.schemas()` 做全局精确断言。`composeInsert()` 不得再对重复 plugin id 静默跳过；先判冲突，再按顺序输出：核心条目 → active Mod 条目 → host-audit。

审计器 apply/await 失败必须阻止 Host ready。不得把审计放到首个 `session/created` 才懒执行。

### 6.2 Preset standing scope 策略

`@moyu/dsh-profile` 以 `mode: preset, policySurface: ...` 注入 `moyu`、`media` 的 `agent.cordis.yml`。它负责：
- 读取并缓存快照；
- 对 `inheritedAllow` 调用 `restrict`；
- 安装同 scope 的执行层 guard；
- 安装同步 `session/created` 最终精确断言。

业务插件移除 `assertMoyuToolSurface()` 调用；Media 自己的 `tools.restrict({deny})` 与对应 `session/created` listener 同时移除，避免第二套策略。

### 6.3 打包与解析

`@moyu/dsh-profile` 必须进入 profile manifest，并像其他 Moyu 运行包一样复制到：
- `build/dsh-runtime/home-template/profiles/moyu/node_modules/@moyu/dsh-profile`
- `build/dsh-runtime/node_modules/@moyu/dsh-profile`

新增干净 `DSH_HOME` 集成验证：两个 Preset 的 bare import 都能解析该包。这里只变更运行闭包和 Preset 模板，按仓库门禁需执行一次 `build:dsh-runtime` 与打包前等价闭包验证；C2-g 日常切片不反复打 DMG，最终与下一次必需打包门禁合并。

## 7. g2a 基线探针（实现前硬门禁）

### 7.1 路径选择结论

不采用独立 in-process DSH 重建：调查证明它需要依赖 `profile-boot-*.js` 的 minified 内部别名，或自行复刻未公开的 `composeProfile`；而且仍会 boot 整个 Web composition。该路径脆弱且不能保证与产品启动链完全等价。

也不向产品 Host 加临时调试 route。g2a 固定使用：**真实 Electron → 真实 Host 启动链 + scratchpad-only 探针插件 + 临时 profile/runtime 副本**。

- 探针插件放 `scratchpad`，以绝对路径临时追加为 root composition 最后一项；必要时临时追加为两个 Preset composition 的首/末项。
- 只修改临时 `MOYU_DSH_HOME` 与生成闭包的副本，不修改 `apps/`、`packages/`、正式模板或正式路由。
- 探针在 Host 进程内读取真实 `ctx.tools.schemas()`，将 NDJSON 证据写到 scratchpad；不通过浏览器暴露 introspection API。
- 通过真实 `/api/session.create` 分别触发 `moyu`、`media` standing mount；进程退出后删除临时 profile、探针与日志。
- 如果绝对路径探针条目无法随真实 loader 加载，记录原始错误并停下；届时才允许退到带编译期开关、默认物理不可达的临时 Host 钩子，且同一轮必须删除并用 `rg` 证明无残留。

### 7.2 实测结论（2026-09-03，B′ 探针，已还原、rg 无残留）

探针实现说明：cordis loader 有 internal loader 时所有 `name` 走 `internal.import`，绝对路径不确定；故把探针**复制进临时 `build/dsh-runtime/home-template` 的 profile 与两个 preset 目录**，以相对 `./__g2a_probe.mjs` 追加为各 composition 末项（相对 baseUrl 加载，可靠）。真实 Electron 启动 + 真实 `session.create({agentPreset})`。NDJSON 未落盘（Host worker 的 env 由 host.js 显式构造、未转发 `MOYU_PROBE_OUT`），证据取自 Host stdout。探针结束 rebuild/还原，`rg` 确认 `apps/ packages/ scripts/ build/` 无 `g2a-probe/__g2a_probe/MOYU_PROBE_OUT` 残留。

**关键实测（`ctx.tools.schemas()` 真实可见名）**：

| scope | count | 可见 Tool |
|-------|-------|-----------|
| root（Host 全局 ctx，t50ms 稳定） | 4 | `ask_user_question, image_convert, pdf_process, screenshot_capture` |
| preset-moyu standing scope | 9 | 上述 4 + `video_scan, video_subtitle_read, media_artifact_save, moyu_schedule_create, moyu_schedule_run_now` |
| preset-media standing scope | 9 | **与 moyu 完全相同** |

**结论（部分推翻原模型假设，需在 g2b 前反映到设计）**：
1. **当前完全没有 per-preset 工具面区分**：moyu 与 media standing scope 的可见集**逐字相同**（9 个）。moyu 现在就能看到 `video_scan / media_artifact_save / moyu_schedule_*` 等 media 专有 Tool。计划假设的“Media 已在做 per-agent 限制”在 **standing scope 层不成立**（Media 的 `restrict({deny})` 若存在，只可能在更深的 per-session/agent-instance scope，本探针未触达）。
2. **root 全局 schemas ≠ agent 可见全集**：media/scheduled 插件虽在 root insert 且调 `ctx.tools.register()`，其 5 个 Tool **不出现在 root `schemas()`（4）**，只出现在 agent/preset scope（9）。即 Tool 可见性是 scope 相关的，`transitionalCoreGlobalTools` 台账应以 **agent-scope 全集（9）** 为基线，而非 root 的 4。
3. `ask_user_question` 在 root 与 preset 都在；来源含 root insert 的 `tool-ask-user` 与两个 preset 模板的 `tool-ask-user`（计划 §2.6 标记的重复已被实测证实）。
4. **未见 `run_code`**（native 模式，无保留传输 Tool）。

**对设计的影响（g2b 前必须消化）**：
- `scopedExpected` / `inheritedAllow` 的划分要基于“agent scope 继承的全集（9）”这一真实层，不是 root 的 4。
- 第二层不是“给已有的 per-preset 面加约束”，而是**从零建立** per-preset 差异：moyu 需 restrict 掉 media 专有 Tool，media 需 restrict 掉 moyu 专有（如 `pdf_process`，若 pdf 只属 moyu）。
- 仍待补测（g2a 收尾项）：per-session/agent-instance scope 下 Media 现有 restrict 到底有没有生效、`restrict` 在 standing scope 的前/后行为、`session/created` 同步 veto 回滚。这三项建议在 g2b 设计定稿前用同一探针补一轮。

### 7.2 采集项

用当前未改造 Host 记录：
- root `ctx.tools.schemas()` 的实际名称与 mode；
- `moyu`、`media` standing scope 在 restriction 前/后的实际名称；
- `ask_user_question` 当前到底来自 global、scoped 还是同名 shadow；
- 是否存在 `run_code` 或其它保留传输 Tool；
- session 创建时 scoped listener 能否同步 veto 并回滚；
- policy row 位于 Preset composition 首/末时，restriction 与最终 schemas 是否一致。

产出放 `scratchpad`，计划只记录命令、结论和必要摘要，不提交探针。若 `tool-ask-user` 确认重复，C2-g 同一提交中只保留一个明确来源，并同步 `scopedExpected`；不得让同名 shadow 成为策略成立的隐含前提。

## 8. 实现分片（固定顺序）

- **g1a ✅ Manifest 基础声明**：`provides.tools:[{name,presets,required}]`；session-export/image/pdf 已写。
- **g1b Manifest 收紧**：Tool 命名、保留名、已知 surface、重复项、`required:false` 拒绝；补 scheduled 的准确命名约定（Manifest 可在迁移片创建）。
- **g2a 基线探针**：完成 §7，冻结 transitional core/global/scoped 台账。
- **g2b ActiveModSet + effective policy**：两阶段 resolve/stage；deterministic snapshot；plugin/tool/package 冲突；结构化诊断。
- **g3 Host 全局审计**：审计器最后加载，Host ready 前精确比较；安全错误不得被 fallback catch 吞掉。
- **g4 Preset policy 插件**：`inheritedAllow` restriction + scoped guard + 同步最终断言；注入两个 `agent.cordis.yml`；交付 `@moyu/dsh-profile` 运行包。
- **g5 删除旧策略**：移除 Profile 硬编码业务清单、image/pdf/screenshot 重复守卫、Media deny restriction；不改 Tool 业务实现。
- **g6 测试重做与收口**：按 §9 执行；全部通过后才继续 image→pdf→screenshot→media→scheduled-tasks 逐片迁移。

提交建议（不要求一次大提交）：

```text
test(policy): pin DSH scoped tool semantics
feat(mods): derive effective tool policy from active manifests
refactor(profile): enforce preset tool surfaces from policy snapshot
test(policy): verify exact global and preset tool surfaces
```

任何中间提交都必须保持已有 Host 可启动；若某步必须跨提交破坏，应合并为同一提交，不留红色中间态。

## 9. 验收矩阵

### 9.1 纯 Node / 单元

- Manifest：非法名、`run_code`、未知 surface、重复 Tool、重复 preset、`required:false` 全拒绝。
- ActiveModSet：disabled/uninstalled/incompatible/tampered/missing package 不进入；单 Mod staging 失败隔离。
- 冲突：Mod↔Mod、Mod↔core 的 plugin id / package name / Tool name 均拒绝。
- Snapshot：稳定排序、同输入同 digest、原子发布、损坏/旧 schema fail-closed。
- 全局审计：精确相等通过；多一个、少一个均失败。
- Preset policy：`restrict` 只收到 inheritedAllow；moyu/media 精确集合；多出 scoped Tool、缺 scoped Tool、未知 surface 均失败。
- 执行层：隐藏 Tool 即使被直接 dispatch 也被 guard 拒绝。

### 9.2 DSH 真实装配（不可用 mock schemas 代替）

- 用真实 Electron → Host 启动链的专项 harness 读取 `agent.ctx.tools.schemas()`；g2a 的一次性 scratchpad 探针只负责冻结基线，g6 应将稳定的策略断言纳入正式 harness，不得长期依赖 minified DSH 内部导出：
  - `moyu` 精确等于快照 `visibleExpected.moyu`；
  - `media` 精确等于快照 `visibleExpected.media`；
  - `moyu` 不含 Media/scheduled Tool；`media` 不含 `pdf_process`；
  - copied-moyu 仍落 `policySurface:moyu`，copied-media 同理。
- 创建会话时策略差异/额外 scoped Tool 会同步回滚，不留下 session。
- 启用 Mod 但 Tool 未注册 → Host ready 前失败；Mod 注册未声明 Tool → Host ready 前失败。
- 禁用/卸载 Mod → 重启 → 该 Tool 从 global 和对应 Surface 同时消失，核心会话仍能创建；重新启用恢复。
- 干净 `DSH_HOME` 和既有 profile 升级两条路径都能解析 `@moyu/dsh-profile` 与策略文件。

### 9.3 现有测试改造

- `verify-dsh-session-create`：删除错误的“三插件完整白名单”历史描述；保留真实 UI origin 会话创建，并增加策略 digest/Host audit 成功证据。
- `verify-media-preset-session`：不再以 `/moyu/media capabilities` 或 Client 模拟过滤证明 Tool 隔离；Tool 隔离改由真实 `agent.ctx.tools.schemas()` harness 证明。
- image/pdf/screenshot 业务 harness：只测本插件注册与执行，不再 import Profile 白名单常量、伪造 `session/created`。
- profile harness：改为 snapshot schema、global audit、Preset restriction/guard/final assertion 测试。
- 新增专项必须进入 `tests/run-acceptance.mjs` 显式清单；日常跑相关 harness + `npm run build`，收口跑完整当前清单。

## 10. 完成定义

- 策略快照、composition 与成功 staging 的 activeMods 来自同一个内存对象。
- Host ready 前全局 Tool 精确一致；会话发布前 Surface Tool 精确一致。
- 每个 Tool 在快照中恰有一个 owner；每个 Surface 的允许关系只来自 Manifest/核心台账。
- 业务插件不再各自维护白名单、denylist 或会话创建守卫。
- Mod 禁用/卸载不会因旧核心必备清单而阻塞会话，也不会把其 Tool 留在其他 Preset。
- g6 全部验证有原始输出；没跑过的不标通过。

一句话定稿：

> Main 从同一 registry 与 Manifest 快照得到成功 staging 的 ActiveModSet，并同时生成 composition 与不可变策略；Host root 在 ready 前审计全局注册全集；Preset standing scope 只裁剪继承 Tool，并对最终真实可见面和执行面做同步精确守卫。

## 11. 进度

- ✅ DSH `register` / `restrict` / `guard` / `schemas` 与 Preset standing mount 语义已读源码核实。
- ✅ g1a：Manifest `provides.tools` 基础校验；session-export（[]）/image/pdf 声明；`verify-mods-registry` 18/18。
- ✅ g1b：Manifest 收紧——Tool 命名规则、保留名 `run_code`、已知 policy surface（moyu/media）、重复 Tool 名/重复 preset、v1 拒绝 `required:false`（省略=true）；`KNOWN_POLICY_SURFACES` 导出；真实 mod.json 仍合法；`verify-mods-registry` 26/26。
- ✅ g2a：B′ 探针基线（§7.2）。单一工作台修订后 per-preset 探测作废；**media 移除后重测确认**：root global = 4（`ask_user_question/image_convert/pdf_process/screenshot_capture`，与 `CORE_BUILTIN_TOOLS` 逐字一致）、moyu preset = 6（+`moyu_schedule_*`，agent-scoped 故不入全局台账）、无 `run_code`。台账经真实 Host 验证正确。
- ✅ g2b：第一层核心逻辑 + 快照生成，全部真机验证。
  - `buildEffectiveToolPolicy`（核心台账 + active Mod 声明 → globalExpected/owners；冲突检测）+ `auditGlobalToolSurface`（未声明→漂移、缺声明→fail）+ `CORE_BUILTIN_TOOLS`（root-global 4，探针校准）。`verify-mods-registry` 33/33。
  - `resolveActiveModManifests`（读已启用 Mod manifest 正本，校验/兼容/完整性过滤）+ `writeToolPolicy`（Host 启动写 `effective-tool-policy.json`，经 `MOYU_TOOL_POLICY_PATH` 传子进程；冲突抛错阻止启动）。**真机验证**：boot 后快照写出，globalExpected=4 核心 Tool、owners 全 core。
  - 提交：c139230（逻辑）、85a4551（快照接线）。
- ✅ g3（worker ready 闸门，2026-09-03 完成并真机验证）：
  - `@moyu/dsh-plugin-tool-audit`（新 loadable 包，root composition 最后一项）apply 时挂 `globalThis.__moyuToolAudit`；worker 在 `dsh web:` 命中后、发 host-ready 前同步调用，漂移/缺失/审计缺失/策略损坏 → host-error + exit(1)。
  - **审计当场立功**：首次运行以错误台账（4）被审计拒绝（`undeclared=[moyu_schedule_*]`）——**校正了 g2a t50ms 探针的误判**：ready 闸门时点 root 已含全部 6 个，`moyu_schedule_*` 是 root-global 而非 agent-scoped。台账改 `CORE_BUILTIN_TOOLS`=6、`CORE_SCOPED_TOOLS`=[]（无 agent-scoped-only，第二层审计与全局等价）。
- 修正后审计通过 → host-ready → session.create 2/2；run-acceptance --node 11/11。这是审计能拒绝漂移（负向）与放行正确态（正向）的双向证据。
- **C3 启动复验发现并修复竞态（2026-09-03）**：`scheduled-tasks` 原先在 `svc.ready.then(...)` 中注册 `moyu_schedule_*`，存储初始化稍慢时，worker 在 Host-ready 闸门同步审计会看到两项 missing。现改为 Tool schema 在 `apply()` 同步注册，execute 内显式等待 `svc.ready`；新增「`apply()` 返回前 schema 已可见」回归断言。重建闭包后实机 Host-ready 通过，fence 仍为 HTTP 403 / WS 403，没有用延时或重试放宽审计。
- ~~g3 原（cordis 生命周期猜测）~~ 已弃：
  - 依据：worker 收到 `dsh web:` 才发 host-ready（`resources/dsh-host-worker.mjs:150`）；上游在 Loader settled 后才打印该日志（`dsh-web-app:194`）；`boot()` 已保证 Loader settle + 所有 entry active（`dsh-app-boot:1167`）。故 `dsh web:` 是现成可靠闸门。
  - **host-audit 插件**（新 loadable 包，root composition 最后一项）只做一件事：apply 时把审计闭包挂到 `globalThis.__moyuToolAudit`（闭包读快照 + `ctx.tools.schemas()` 比对 root-global）。
  - **worker 改造**：`dsh web:` 命中后、发 host-ready 前，**同步**调 `globalThis.__moyuToolAudit()`；审计函数缺失/策略损坏/多 Tool/少 Tool → 发 `host-error` 并 `exit(1)`，不发 ready。**不用定时器/延迟/轮询**。
  - **双层审计（单一工作台，非多 Preset）**：① Host ready 前审 root-global（本 g3）；② 会话发布前审最终可见面 `finalVisibleExpected = globalExpected + CORE_SCOPED_TOOLS`（否则 g5 删旧守卫后 agent-scoped 漂移无人管）——②并入 g5。快照已含 `coreScopedTools` / `finalVisibleExpected`。
- ✅ g5（2026-09-03）：移除 image/pdf/screenshot 的 `session/created` + `assertMoyuToolSurface` 调用与 import；`dsh-profile/index.mjs` 清空守卫（PRESET_REQUIRED_TOOLS/readPresetId/MOYU_TOOL_WHITELIST/shell denylist 全删），改由 host-ready 全局审计接管（比旧「必备子集+shell denylist」更强）；profile harness 改为「断言旧守卫已不导出」；pdf/screenshot 工具 harness 去掉守卫段保留工具测试。run-acceptance --node 11/11（含真机 session-create 放行）。**第二层最终可见面审计**：因 g3 实测 `CORE_SCOPED_TOOLS=[]`（无 agent-scoped-only），暂无内容可查，保留结构备用、未加会话发布审计。
- ✅ g6（2026-09-03）：测试收口。清理所有测试对已删守卫的 import（image-convert/pdf/screenshot harness → 本地常量）；`verify-dsh-session-create` 头注与断言改为 C2-g 就绪闸门口径（session.create 成功即证审计放行）；policy/audit 单元断言已在 `verify-mods-registry`（33/33，在 acceptance）。run-acceptance --node 11/11。改动均在 gitignore 的 tests/，无需提交。
- **C2-g 完成**（单一工作台）：g1a/g1b/g2a/g2b/g3/g5/g6 全绿；g4（per-preset policy 插件）单一工作台作废。工具面完整性由 host-ready 全局精确审计接管。
