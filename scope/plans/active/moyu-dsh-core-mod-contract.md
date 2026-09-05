# C0 · MOYU DSH 核心—Mod 契约（冻结件）

> 性质：里程碑 C0 交付物，`moyu-dsh-core-and-mod-platform-plan.md` §1 的正本。
> 状态：**C0 全冻结（2026-09-03）**；**2026-09-03 修订**：取消 moyu/media 双预设 → 单一工作台；新增「内置系统功能」分类（见 §1.1b）。命名落地放 C3/C6。
> 单一工作台：不再有 moyu(Chat)/media(Media) 预设与工作台切换；MOYU DSH 是单一工作台。因此 C2-g 去掉 per-preset 可见面（第二层），只保留全局注册完整性（第一层）。
> 冻结基准：代码普查 2026-09-03（`packages/*`、`apps/desktop/main/dsh/*`、`packages/dsh-profile/cordis.patch.yml`）。
> 版本：`0.1.0`（[[doc-version-convention]]）。转向背景见 [[core-mod-pivot]]。

## 1. 能力边界（基于真实代码，非泛写）

### 1.1 留在核心（系统原语 + 平台设施）

| 现有实体 | 位置 | 归类 |
|----------|------|------|
| Electron 主进程 / 窗口 / 权限 / 生命周期 | `apps/desktop/main/index.js` | 壳 |
| DSH Host 启动与生命周期 | `apps/desktop/main/dsh/host.js`、`index.js` | 平台 |
| 桌面窄桥（文件令牌 registry、pickFiles/pickDirectory/saveResult/showItem/resolveFile、clipboard copy） | `apps/desktop/main/dsh/bridge.js` | 系统原语 |
| **屏幕采集原语**（captureScreen / requestScreenCapture / selectScreenshotRegion） | `bridge.js` | 系统原语 |
| **凭据安全存储**（secureStore/secureRetrieve + safeStorage） | `bridge.js`、`secure-store.js`、`@moyu/dsh-credentials-desktop` | 系统原语 |
| caller/capability 校验层 | `apps/desktop/main/caller.js`、`session-policy.js` | 安全 |
| 目录选择器（Host 侧） | `@moyu/dsh-host-directory-picker-native` / `-fixed` | 系统原语 |
| Profile 装配壳 + 守卫框架 | `@moyu/dsh-profile`（`cordis.patch.yml`、`index.mjs`） | 平台（**但业务必备工具清单移出**，见 1.3） |
| 内置 DSH Runtime | `build/dsh-runtime`（`@deepseek-ai/dsh@0.1.1-rc.2` 闭包） | 平台 |

### 1.1b 内置系统功能（应用系统能力，**不做成 Mod**）（2026-09-03 定）

这些是 MOYU DSH 的应用级系统功能，随应用内置、不可作为可卸载 Mod：

| 包 | 系统功能 | 说明 |
|----|----------|------|
| `@moyu/dsh-plugin-scheduled-tasks` | 任务系统（定时/安排任务 + `moyu_schedule_*` Tool + UI） | 应用系统能力，内置 |
| `@moyu/dsh-plugin-screenshot` | 截图系统（`screenshot_capture` Tool + 业务 UI） | 与桥的采集原语配套，内置 |
| `@moyu/dsh-plugin-session-export` | 会话导出 | 内置（**撤销 C2 试点的 Mod 剥离**，改回静态 composition） |

### 1.2 剥离为 Mod（业务功能）

| 包 | 业务 | 采集原语是否留核心 |
|----|------|--------------------|
| `@moyu/dsh-plugin-image` | 图片转换 Tool | — |
| `@moyu/dsh-plugin-pdf` | PDF Tool | — |
| `@moyu/dsh-plugin-media` | 自媒体工作台（已归档；无 media 预设后不重启） | — |

### 1.3 退场（非核心非 Mod）

- `@moyu/dsh-plugin-hello`、`@moyu/m0a-dsh-spike`：demo/spike，出厂 composition 移除，不打成 Mod。
- `dsh-profile` 守卫（单一工作台后无 per-preset）：期望工具面 = **核心内置 Tool**（含 `screenshot_capture`、`moyu_schedule_*`、session-export 等系统功能）+ **已启用 Mod 声明的 Tool**（image/pdf 等）。守卫不再硬编码 `PRESET_REQUIRED_TOOLS` 的 moyu/media 分层；C2-g 只做全局注册完整性校验。

### 1.4 已识别技术债（C2 处理，不在 C0 改）

- 桥里存在图片专用方法 `prepareImageResult` / `registerImageResult` / `prepareResult` / `registerResult`：业务语义漏进通用桥。C2 拆 image Mod 时收回为通用 `prepareResult`/`registerResult`，不保留 image 专用变体。

## 2. 核心—Mod 契约

### 2.1 Mod Manifest（必备字段）
- `id`（稳定、全局唯一）、`version`（semver）、`displayName`、`author`
- `requires.core`：依赖的核心能力清单（如 `screen-capture`、`file-token`、`credentials`、`clipboard`、`host-route`、`client-slot`、`settings`、`scheduler`）
- `requires.shell`：兼容的 MOYU 壳版本范围
- `requires.kernel`：兼容的 DSH 内核版本范围
- `provides`：声明的 Tool / Skill / Slot / route / settings / 定时任务
- `permissions`：需要的权限（供安装时展示）
- `platforms`：支持的平台/架构

### 2.2 兼容契约
- 三方版本约束：Mod ↔ 壳 ↔ 内核，安装/启用前校验；不满足则拒绝启用并说明。
- Slot/API 探针：Mod 依赖的 Slot/route 在当前内核存在才放行。
- 数据迁移声明：Mod 升级若需迁移，manifest 显式声明，装载前执行、可回滚。

### 2.3 安全契约（不可破）
- Mod 只经桌面窄桥访问系统能力，不得自建 Node 权限 / 第二份状态。
- 不向模型/Client 暴露绝对路径；文件走 fileId 令牌（现有 registry）。
- 凭据只写不回读（safeStorage seam）。
- renderer 保持 `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true`。
- 后台/定时运行是新身份，不继承前台会话临时授权。

## 3. 两层更新模型（冻结）

见主计划 §2/§4。冻结要点：
- **应用更新** ≠ **DSH 内核更新**，UI 分开显示、各自通道（stable/beta/development）。
- 内核双层：内置只读回退（`Contents/Resources/dsh-runtime`）+ 用户目录可切换（`Application Support/<userData>/kernels/<ver>/` + `current.json`）。
- 只切 **MOYU 验证发布** 的内核；绝不 `npm install latest`。
- 更新包必带：精确 DSH 版本 · 依赖闭包 · SHA-256 · 签名 · 兼容壳版本 · 平台架构 · Slot/API 探针 · 迁移要求。
- 失败内核自动回退内置版本，且不得反复阻塞启动。

## 4. 决策定论（D1–D7）

| # | 决策 | 状态 | 结论 / 待确认 |
|---|------|------|---------------|
| D4 | 作者 | ✅ 冻结 | `Clukay` |
| D5 | 核心/Mod 能力清单 | ✅ 冻结 | 见 §1 |
| D6 | 内核目录布局 / current.json | ✅ 冻结 | `kernels/<ver>/` + `current.json`（active 版本、SHA、壳兼容、探针结果、回退指针） |
| D7 | 兼容/安全契约 | ✅ 冻结 | 见 §2 |
| D1 | 产品名 | ✅ 冻结 | `MOYU DSH`（现 `MOYU`；落地 C3，配套 userData 迁移） |
| D2 | macOS appId | ✅ 冻结 | `com.clukay.moyu-dsh`（现 `com.clukay.moyutools`；落地 C3） |
| D3 | Windows App ID | ✅ 冻结 | `com.clukay.moyu-dsh`，一次固定永不改（落地 C6 NSIS） |

### 4.1 命名决策的关键事实与建议（需用户拍板，因“一旦定下不再改”）
- 现状：`productName: MOYU`、`appId: com.clukay.moyutools`（旧名 moyutools 残留）。
- `app.getPath('userData')` 由 productName 派生 → 现用户数据（凭据 `dsh-credentials.enc`、DSH_HOME、会话、设置）在 `.../MOYU/` 下。改 productName 或 appId 都会让 OS 算出**新 userData 路径**。
- 关键判断输入：**本应用目前是否已对外分发？** 0.1.0 主计划记为“本地自用”。若尚未分发 → **现在是锁定终名的最佳时机**（改名成本仅一次本机数据迁移）；一旦对外分发再改 appId 会破坏升级连续性。
- 建议（若仍处本地自用、未对外分发）：
  - D1 → `MOYU DSH`
  - D2 → `com.clukay.moyu-dsh`
  - D3 → `com.clukay.moyu-dsh`（Windows 固定）
  - 配套：C3 落地时做一次幂等 userData 迁移（旧 `.../MOYU/` → 新路径），迁移失败不覆盖旧数据。
- 若已对外分发：保留现 appId，仅改 productName 需评估，或维持现状加显示名映射。

### 4.2 决定（2026-09-03）
应用尚未对外分发（本地自用），故锁定终名：**D1 `MOYU DSH` · D2/D3 `com.clukay.moyu-dsh`**。落地放 C3（productName/appId + userData 迁移）与 C6（Windows App ID）。本契约转**全冻结，C0 完成，进 C1**。
