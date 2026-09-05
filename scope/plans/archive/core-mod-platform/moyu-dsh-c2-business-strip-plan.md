# C2 · 业务剥离为 Mod — 设计与落地（试点先行）

> 性质：里程碑 C2 落地方案，隶属 `moyu-dsh-core-and-mod-platform-plan.md`，契约 `moyu-dsh-core-mod-contract.md`，机制 `moyu-dsh-c1-plugin-infra-plan.md`。
> 状态：设计 + 关键决策已定；试点 session-export 待管线整合。版本 `0.1.0`。背景 [[core-mod-pivot]]。

## 1. 试点选择

`@moyu/dsh-plugin-session-export`：零 npm 依赖、Host-only、单文件 `lib/index.mjs`、peerDeps 全是 DSH 闭包已有包（cordis / dsh-host-webserver / dsh-session-query）。最自包含 → 首个试点，跑通完整装卸闭环再批量搬 image/pdf/screenshot/media/scheduled-tasks。

## 2. 关键决策：Mod 用“复制”进 profile 闭包，不用软链（C2-D1）

C1 初版用软链，但 C2 试点普查暴露真实缺口并已修复：
- cordis-plugin-loader 按 **realpath** 从插件所在目录向上解析 peer 依赖。软链的 realpath 指回 `mods/<id>/`，**解析不到 profile 闭包里的 peer 依赖**（cordis / dsh-host-webserver…）。
- 已改 `applyModsToProfile`：把 Mod 的 `package/` **复制**进 `profile/node_modules/<包名>`。复制后插件真实位置在 profile 闭包内，向上解析即命中 peer 依赖。
- Mod 若带**非闭包依赖**（如 pdf 的 `pdf-lib`），打包时放进自己的 `package/node_modules/`（就近解析优先）。
- 证据：`tests/verify-mods-host-integration.mjs` 新增 peer 依赖解析用例——demo 插件 import 只存在于 profile 闭包的 peer 模块，复制模式解析成功（软链会失败）。6/6 通过。

## 3. Mod 打包格式

```text
<mod-id>/
├── manifest.json     # 契约 §2.1
└── package/          # 插件包：package.json（name=@moyu/...）+ lib/ [+ node_modules/ 若有非闭包依赖]
```

manifest（session-export 示例）：
```json
{
  "id": "moyu-session-export",
  "version": "0.0.0",
  "displayName": "会话导出",
  "author": "Clukay",
  "requires": { "core": ["host-route"], "shell": ">=0.1.0", "kernel": "*" },
  "provides": { "plugins": [{ "id": "moyu-session-export", "name": "@moyu/dsh-plugin-session-export" }] },
  "permissions": [],
  "platforms": ["darwin", "win32"]
}
```

## 4. 任务切片

- **C2-a 打包脚本** `scripts/pack-mod.mjs`：输入一个 `packages/dsh-plugin-*`，产出 `<mod-id>/{manifest.json, package/}`（含就近依赖闭包，若声明）。manifest 从包元数据 + 约定生成或读包内 `mod.manifest.json`。
- **C2-b 预装 Mod 出厂**：`build-dsh-runtime` 把试点 Mod 产物放进 `build/dsh-runtime/preinstalled-mods/<id>/`；host 首启把 `Contents/Resources/.../preinstalled-mods/*` 复制进 `userData/mods/` 并注册（enabled=true，可卸载）。已装则不覆盖用户状态。
- **C2-c 从静态 composition 移除试点**：`cordis.patch.yml` 删 `moyu-session-export`，`build-dsh-runtime` 的 `MOYU_PLUGINS` 删该项 → 它只经 Mod 层加载。**注意保留其 peer 依赖在闭包**（cordis / dsh-host-webserver / dsh-session-query 是 DSH 运行时依赖，本就在闭包，不随插件删）。
- **C2-d 装回验证**：预装 Mod enabled → 启动 → 会话导出路由可用（复用 `verify-session-export-route.mjs`）。
- **C2-e 卸载验证**：disable/uninstall → 重启 → 导出功能消失、**核心与其余插件正常启动**（无残留、不报错）。
- **C2-f 批量搬迁**：试点闭环通过后，image / pdf（带 pdf-lib）/ screenshot（带 client bundle）/ media / scheduled-tasks 依次转 Mod；各自处理依赖闭包与 client 打包。

## 5. 验收判据

| 项 | 判据 |
|----|------|
| 打包 | pack-mod 产出合法 manifest + 可加载 package |
| 预装 | 首启复制预装 Mod 进 userData/mods 并注册；重启不覆盖用户状态 |
| composition 移除 | 静态 patch/MOYU_PLUGINS 不再含试点；peer 依赖仍在闭包 |
| 装回功能恢复 | 试点 Mod enabled → 对应功能（会话导出路由）可用 |
| 卸载核心仍启动 | uninstall → 功能消失、核心+其余插件正常启动、无残留 |
| 无回归 | 现有 Host/Client harness、run-acceptance 全绿 |

## 6. 不做（C2 边界）
- 不做远程市场下载（后续）；不做热插拔（A2）；不改内核（C4）；不改 productName/appId（C3）。
- 批量搬迁按依赖复杂度递增，逐个验证闭环，不一次全搬。

## 7. 进度
- ✅ C2-D1 复制 vs 软链决策 + peer 依赖解析证明（`applyModsToProfile` 已改复制；`verify-mods-host-integration` 6/6）。
- ✅ **C2 试点 session-export 全链路完成**：
  - C2-a `scripts/pack-mod.mjs`（读包内 `mod.json` + package.json → 校验后产出 manifest + package）
  - C2-b 预装：`build-dsh-runtime` 产出 `build/dsh-runtime/preinstalled-mods/moyu-session-export`；host `ensurePreinstalledMods`→`seedPreinstalledMods`（`.seeded.json` 按 id+版本记账，尊重用户卸载不复活）
  - C2-c 从静态 composition 移除：`cordis.patch.yml` 与 `MOYU_PLUGINS` 均已删 session-export（生成 patch 真实条目 0；闭包 @moyu 已无该插件；peer 依赖 host-webserver/session-query 仍在）
  - C2-d/e 验证：`tests/verify-mod-pilot-session-export.mjs` 6/6（打包→播种→compose→复制进闭包可 import→幂等→卸载不复活→核心仍可 compose）；`verify-session-export-route` 仍 10/10 无回归
  - run-acceptance --node 13/13、overlay 门禁通过（build:dsh-runtime 后已重跑 apply-overlay + brand patch）
- ⬜ C2-f 批量搬迁：**受阻，见 §8**。image/pdf 迁移已尝试并回滚——它们卷入硬编码必备清单、重复 contains 守卫与不同源的 per-preset restriction，需先做 C2-g 解耦。session-export 因不注册 Tool 而干净。

## 8. 阻塞发现（2026-09-03）：白名单/守卫与静态 composition 耦合（C2-g 前置）

试点 image/pdf 迁移暴露真实耦合，两个失败（`verify-dsh-session-create`、`verify-media-preset-session`）后已回滚：

1. **守卫 `PRESET_REQUIRED_TOOLS` 硬编码业务 Tool**（`packages/dsh-profile/index.mjs`）：
   `moyu: [image_convert, pdf_process, screenshot_capture]`、`media: [image_convert, screenshot_capture, video_*, …]`。业务 Tool 变 Mod 后若未加载，建会话被 fail-closed 拒。契约 §1.3 早已要求“业务必备工具清单随 Mod 走，核心守卫只留框架”。
2. **重复的 contains 守卫与 per-preset restriction 不同源**：image/pdf/screenshot 各自在 `session/created` 调同一个必备子集守卫，Media 又单独用 `restrict({ deny })` 裁剪工具面；这些 listener 依赖注册顺序，且都不以 Mod Manifest 为真源。纠正：`moyu tool whitelist drift` 的精确相等检查只存在于 hello Spike，生产插件当前没有精确白名单检查。

**C2-g 解耦（迁移 image/pdf/screenshot/media 前必做，独立提交）**

权威设计见 **`moyu-dsh-c2g-tool-policy-plan.md`**（用户 2026-09-03 规范，DSH `restrict`/`schemas` API 已核实）。要点：
- **两层模型**：第一层在 Host ready 前核对全局注册完整性；第二层由 Preset standing scope 分开处理继承层 `inheritedAllow` 与最终 `visibleExpected`（restriction 只裁剪继承 Tool，最终 `schemas()` 再做精确相等）。
- **Manifest 补** `provides.tools:[{name,presets,required}]`（带 preset 作用域）。
- **启动快照** `mods/effective-tool-policy.json`（Host compose 时按同一 registry 快照生成，守卫唯一真源，不每会话读 registry）。
- **Preset standing scope policy 插件**（`@moyu/dsh-profile` 导出，注入各 preset `agent.cordis.yml`）取代插件各自 `session/created` 竞争；restriction 只接收继承层 allow，最终可见面另做精确断言；业务插件不再调 `assertMoyuToolSurface`。
- 纠正：`whitelist drift` 只在 hello（Spike）；生产插件只做必备子集检查。
- 提交信息：`refactor(mods): derive tool surface from enabled manifests`（可拆多提交）。

session-export 不涉及以上任一，故已成功迁移，作为“无白名单耦合”类 Mod 的样板。

**结论**：C2-f 拆两类——(a) 无白名单耦合（如 session-export，可直接迁）；(b) 白名单/守卫耦合（image/pdf/screenshot/media，须先 C2-g）。scheduled-tasks 另有多 @deepseek peer 依赖，作 peer 解析真实检验，放 C2-g 之后。

## 9. C2-g 后的逐个迁移（禁止一次性批量）

进度（单一工作台后：screenshot/scheduled-tasks/session-export = 内置系统功能不迁；media 已归档移除）：
- ✅ **image**（commit 598fcd5）：迁为预装 Mod。PREINSTALLED_MODS + 移出静态 composition/MOYU_PLUGINS + CORE_BUILTIN_TOOLS 移除 image_convert（移交 mod.json）。真机 verify-image-host-service 2/2、全局审计放行、full acceptance 12/12。
- ✅ **pdf**（commit 51de71a）：迁为预装 Mod（同 image 流程；pdf-lib/pdfjs-dist/@napi-rs/canvas 在闭包，复制策略解析成功）。真机审计放行即证 pdf_process 经 mod 注册；verify-pdf-process-tool 功能通过；full acceptance 12/12。

**C2-f 完成、C2 整体完成**：核心 composition 不再含具体业务 Tool 插件（image/pdf 已 Mod 化）；screenshot/scheduled-tasks/session-export 为内置系统功能；media 已归档。工具面完整性由 host-ready 全局审计守护。下一步 C3（应用壳 + 命名落地 + userData 迁移）。

原顺序 image → pdf → screenshot → media → scheduled-tasks 中，后三者已定为内置/归档，故 C2-f 实际只迁 image、pdf。每个 Mod 独立走完并**单独提交**：
```text
manifest → 打包 → 安装 → 从静态 composition 移除 → 新会话能力检查 → 实际 Tool 调用
→ 禁用 → 卸载 → 核心仍可启动 → 重新安装恢复 → 单独提交
```
特殊验证：
- **screenshot**：系统采集原语（`desktop.captureScreen` 等）**仍留核心**；只有 `screenshot_capture` Tool 与业务 UI 随 Mod 卸载。
- **media**：自定义侧栏须属 Mod contribution；卸载后不得残留被禁用的官方侧栏入口。
- **scheduled-tasks**：最后处理——同时涉及 Host、Client、Preset、会话恢复、多 peer 依赖，是 C2-D1 复制策略对真实 peer 依赖的最终检验。

全部迁完 → C2 整体签字 → C3 应用壳。
