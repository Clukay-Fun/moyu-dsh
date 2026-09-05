# MOYU DSH 核心底座与 Mod 平台化计划

> 状态：C0–C4 完成。**C4 已于 2026-09-04 收口**：双层解析与崩溃自愈、签名安装、隔离兼容探针、原子切换/回退、内核设置页及 stable/beta 固定通道均已实测通过。C5、C6 暂不启动。战略：可更新 DSH 底座 + 可插拔 Mod。
> 版本：产品版本以 `package.json` 为准，当前 `0.1.0`（版本号规范见 [[doc-version-convention]]）。
> 分支：`experiment/codex-web-ui`。最近更新：2026-09-03。
> 关联：`0.1.0-dsh-native-distribution-plan.md`（原生底座落地，三件套已收口）；自媒体工作台已归档（`archive/media-workspace/`），本计划把它连同图片/PDF/截图业务一并降级为 Mod。

## 0. 战略与边界

### 0.1 转向

核心仓库不再承载图片、PDF、Media 等**具体业务实现**。核心只做“可更新的 DSH 桌面底座”，业务以 **Mod（可安装插件包）** 形态存在：可预装、可卸载、可独立更新。

### 0.2 两种更新必须分开（本计划的立命之本）

| 更新类型 | 更新对象 | 载体 | 通道 |
|----------|----------|------|------|
| **应用更新** | Electron 壳、插件运行时、安全桥、Kernel Manager、安装器、内置 Runtime、核心 UI | 重新安装 `.app`/`.exe`（electron 应用更新器） | stable / beta / development |
| **DSH 内核更新** | DSH Runtime 本身（独立下载并切换经 MOYU 兼容验证的版本） | 用户目录 `kernels/` 双层 Runtime | stable / beta（内核通道） |

**红线**：绝不在用户机器执行 `npm install latest`。DSH 包曾发生版本号与包名变化（当前依赖为单元包 `@deepseek-ai/dsh@0.1.1-rc.2`），直接追 `latest` 会让应用不可控。正确做法是“可更新，但只更新到 **MOYU 验证并发布** 的版本”。

### 0.3 目标产品结构

```text
MOYU DSH
├── Electron 应用壳
├── DSH Kernel Manager          # 内核下载/校验/切换/回滚
├── 内置稳定 DSH Runtime         # 出厂回退版本（Contents/Resources）
├── 插件运行时与市场
├── 桌面安全桥
├── 应用更新器
└── Mods
    ├── 可预装
    ├── 可卸载
    └── 独立更新
```

### 0.4 核心 vs Mod 边界（系统原语 vs 业务功能）

判定基准：**系统级原语留核心，业务功能进 Mod**。例：屏幕采集原语（Electron `desktopCapturer`/权限）留核心；`screenshot_capture` **Tool** 属 Mod。

**暂留核心**：Electron Host · DSH 生命周期 · 凭据安全存储 · 文件令牌 · 桌面窄桥 · 截图等系统级原语 · 插件安装/启停/诊断 · 更新与回滚 · 崩溃恢复 · 日志 · DMG/NSIS 打包。

**最终剥离为 Mod**：Media 工作台 · 图片转换 · PDF · 截图**业务 UI** · 自媒体 Artifact · 业务系统提示词 · 业务 Tool/Skill · 业务定时任务配置。

### 0.5 待冻结决策（C0 输出，冻结前不得动业务代码/不得升级 DSH）

| # | 决策点 | 现状真值 | 取向 / 风险 |
|---|--------|----------|-------------|
| D1 | 产品名 | `productName: MOYU` | 拟改 `MOYU DSH`。**这是 userData 迁移的主要触发因素**：`app.getPath('userData')` 由**应用名**派生，现数据在 `.../MOYU/` 下；改名会挪动 userData 路径 → 必须做兼容迁移（见 §3.3、C3-b），否则用户凭据/设置/会话丢失 |
| D2 | macOS Bundle ID | `com.clukay.moyutools` | 拟 `com.clukay.moyu-dsh`。appId 主要影响 **Bundle 身份、升级识别、LaunchServices 系统关联**（不是 userData 路径的主要来源）；**一旦定下不再改**。与 D1 同批冻结 |
| D3 | Windows App ID | 未固化（NSIS 尚未收口） | 首次即固定、以后永不改（升级覆盖依赖它） |
| D4 | 作者 | `Clukay` ✅ | 保持 |
| D5 | 核心能力清单 / Mod 能力清单 | 见 §0.4 | C0 定稿为契约附录 |
| D6 | 内核目录布局与 current.json 结构 | 内置 `build/dsh-runtime` 存在 | 见 §2 |
| D7 | 兼容契约（Slot/API 探针、迁移要求、SHA-256、签名、壳版本、平台架构） | 无 | 见 §2 更新包清单 |

**改名类决策（D1/D2/D3）不在本轮实施**，只在 C0 定稿，落地放到 C3/C6，并强制配套迁移与升级验证。

### 0.6 剥离顺序（不能直接删）

```
1. 先建立插件安装闭环（C1）
2. 将现有业务包打成可安装 Mod（C2）
3. 验证安装后功能恢复
4. 验证卸载后核心仍可启动
5. 最后才从核心 composition 删除业务插件
```

契约（C0）没完成前删业务代码 → 失去验证插件机制的样板；契约没完成前升级最新 DSH → 把兼容问题和架构拆分混在一起。**两者都禁止提前。**

## 1. 核心—Mod 契约（C0 交付物）

- **能力清单**：核心暴露给 Mod 的原语面（截图采集、文件令牌、凭据、窄桥、Host 生命周期、日志）与 Mod 允许声明的能力（Tool/Skill/Slot/route/settings/定时任务）。
- **Manifest 规范**：Mod 元数据（id、版本、依赖的核心能力、需要的权限、兼容的壳版本与内核版本、平台架构）。
- **兼容契约**：Mod ↔ 壳 ↔ 内核三方版本约束；Slot/API 探针；数据迁移声明。
- **安全契约**：Mod 不得绕过窄桥、不得直接持有绝对路径、凭据只写不回读、`contextIsolation/sandbox` 不破。

## 2. DSH 内核更新（C4）

签名后的 `.app` 运行时不得改 `Contents/Resources`（破签名）。采用双层 Runtime：

```text
应用内（只读、出厂回退）：
  Contents/Resources/dsh-runtime/

用户目录（可切换）：
  Application Support/<userData>/kernels/
  ├── 0.1.1-rc.2/
  ├── 0.1.2/
  └── current.json
```

**启动逻辑**：
1. 读用户目录已激活内核（current.json）
2. 校验版本/完整性/平台/兼容性
3. 启动兼容探针（隔离）
4. 成功 → 用更新内核
5. 失败 → 自动回退应用内置内核
6. **失败内核不得反复阻塞启动**（记录并降级，避免启动死循环）

**更新包必须包含**：精确 DSH 版本 · 完整依赖闭包 · SHA-256 · 签名 · 兼容的 MOYU 壳版本 · 支持平台/架构 · Slot/API 兼容探针 · 数据迁移要求。

**更新流程**：
```
检查更新 → 下载临时目录 → 校验签名+哈希 → 解压到版本目录
→ 启动隔离探针 → 原子切换 current.json → 重启 Host → 健康检查
→ 成功保留 / 失败回滚
```

**内核页面**：当前内核版本 · 可用版本 · 稳定/测试通道 · 更新说明 · 更新并重启 · 回退上一版本 · 恢复应用内置版本。

### 2.1 C4 落地状态（2026-09-03）

- **C4-a ✅**：`kernel.js` 解析内置/用户双层 Runtime，记录 `lastAttempt`，未到 host-ready 的内核下一代自动降级且不反复阻塞。
- **C4-b ✅**：本地三件套 `metadata.json + payload.tgz + metadata.sig` 经 Ed25519、SHA-256、平台/架构/壳兼容、完整性与原子发布门禁安装；绝不运行 npm install。
- **C4-c ✅**：候选内核使用隔离 DSH_HOME 真实启动；到 host-ready 前复用 C2-g Tool 审计。探针只把结果原子写入候选 `manifest.json`，不得改 `current.json`。真实闭包已验证 host-ready + tool-audit，且 current.json 字节不变。
- **C4-d ✅**：只有 `probe.status=passed` 的已安装内核可激活；`current.json` 原子保存 active/previous/activeProbe。回退会交换 active/previous；恢复内置显式写 `active=builtin`，启动解析不得误选仍保留的 previous。
- **C4-e ✅**：`/moyu/kernel` 与设置页已接入状态、本地安装、探针、切换、回退、恢复内置和重启。2026-09-03 通过真实 Electron + CDP 点验，路由返回 200，六项内核控件均可见且可操作。
- **C4-f ✅**：固定 `kernel-stable` / `kernel-beta` GitHub Release 清单；清单分别提供 `metadataUrl` / `signatureUrl` / `payloadUrl`。只允许 GitHub HTTPS 下载及 GitHub Release 实际重定向域名，限制清单/各文件体积与超时，下载暂存必清理；未验签前不解开任何远端归档，三件套下载完成后仍回到 C4-b 重验签名与哈希。stable 已发布 `0.1.1-rc.2-moyu.1`，payload SHA-256 为 `0f0f0309e4ad38d1c3795d2d5905b928453b3ec33b13c5e44bd09bdaf6fa98c2`；beta 已发布空清单。真实线上链路已完成 feed → 下载 → 签名/哈希 → probe → activate → builtin rollback。

发布信任：应用内只含 MOYU Ed25519 公钥；私钥不进仓库，当前本机保存在 `~/.config/moyu-dsh/kernel-signing-private.pem`（0600）。公钥 PEM 的 SHA-256 为 `dd136304200a400a494c59cf0808b00d772ef3fb9f060fc82dc0247b0e4ca548`。

## 3. 应用壳名称与 Icon（C3）

### 3.1 命名统一
产品名 `MOYU DSH` · 英文安装名 `MOYU DSH` · 包名前缀 `moyu-dsh` · macOS Bundle ID `com.clukay.moyu-dsh`（D2）· Windows App ID 固定（D3）· 作者 `Clukay`。

### 3.2 品牌资产同步检查清单
macOS `.icns` · Windows `.ico` · Dock/任务栏图标 · 安装器图标 · DMG 背景与卷图标 · 关于页 · 窗口标题 · 菜单栏 · 崩溃页 · 通知来源 · 文件属性 · 卸载程序名 · 用户数据目录 · 日志目录 · GitHub Release 产物名。

#### C3-a 显示层品牌（代码完成，待实机主界面点验）

- 运行时应用名为 `Moyu`；产品标题、DSH 侧边栏/对话页/About 与启动失败页统一为 `MOYU DSH`。
- `assets/app-icon.png` 是唯一受版本管理的 1024×1024 RGBA 图标源；macOS 直接使用该源，Windows ICO 由 `npm run build:icon` 生成。
- 新 Icon 已同步到 Dock/窗口路径与三个 DSH overlay 内嵌品牌图标。
- C3-a 不改 `productName`、`appId` 与 userData；`app.setName('Moyu')` 前后显式锁定原 userData 路径，避免显示改名导致数据分叉。
- 已通过 `npm run verify-overlay-applied` 和 `npm run build`；未触发打包门禁。
- 首次 `npm run dev` 暴露 scheduled-tasks 把 Tool 注册延后到 `svc.ready.then(...)` 的竞态：Host-ready 审计可在存储就绪前读到缺失。已改为 schema 同步注册、execute 内等待 `svc.ready`，重建闭包后实机启动达到 Host-ready，fence 自检 HTTP 403 / WS 403。
- 自动化 UI 工具未获 macOS Accessibility 权限，原生菜单与 About 的像素级点验仍标为未验证；不以代码存在代替可视化结论。

### 3.3 数据目录兼容迁移（关键，随 D1 应用名触发）
现状：数据在 `app.getPath('userData')`（由**应用名**派生，当前 `.../MOYU/`），DSH_HOME=`userData/dsh`，凭据=`userData/dsh-credentials.enc`。改应用名（MOYU → MOYU DSH）会让 OS 计算出**新的 userData 路径**（appId 主要影响 Bundle 身份/升级识别，不是路径主因）。

#### C3-b userData 迁移专项（代码 + 测试完成，未启用）
- `apps/desktop/main/dsh/userdata-migrate.mjs` `migrateUserData({oldDir,newDir})`，纯 fs、可独立测；**C3-c 才在启动早期（建窗口/写日志/读凭据/启 DSH 之前）启用**。
- 语义：旧有数据+新空 → 复制 staging→校验(文件数+逐文件字节)→原子 rename 发布；**保留旧目录**；用 `.moyu-migrated-from.json` 标记实现幂等（already）；新目录有独立数据且无标记 → **conflict 禁合并**；复制失败清 staging、返回 failed、继续用旧目录（原子发布保证新目录不出现半成品，永不进空白环境）；日志只含路径/计数不含凭据内容。
- 测试 `tests/verify-userdata-migrate.mjs` 8/8（migrated/凭据字节一致/幂等/冲突/no-source/可重试残留 staging/旧空不误判）。凭据真解密由 C3-c/C3-e 真机验证。

## 4. 应用更新（C5）

与内核更新**分开显示**。负责：Electron 壳 · 安全桥 · 插件运行时 · Kernel Manager · 安装器 · 内置 Runtime · 核心 UI。

通道：`stable` / `beta` / `development`。

首版至少支持：启动后低频检查 · 手动检查 · 显示版本与更新说明 · 后台下载 · 下载进度 · 校验更新包 · 安装并重启 · 下载失败重试 · 忽略当前版本 · **不强制自动安装**。

初期更新源用 **GitHub Releases**，不急于自建更新服务器。更新器必须校验签名（§5/§6）。

## 5. DMG 收口（C6·macOS）

Universal 或分别 arm64/x64 · Developer ID Application 签名 · Hardened Runtime · 全部 `.node`/Worker/可执行文件进签名清单 · `notarytool` 公证 · Staple · 安装后 Gatekeeper 验证 · 升级安装保留用户数据 · 卸载说明 · 更新器签名校验 · 规范化文件名。

命名（版本取 package.json，当前 0.1.0）：
```text
moyu-dsh-0.1.0-macos-arm64.dmg
moyu-dsh-0.1.0-macos-x64.dmg
moyu-dsh-0.1.0-macos-universal.dmg   # 若提供 Universal
```

## 6. NSIS 收口（C6·Windows）

x64 安装包 · 固定 App ID（D3）· 升级覆盖安装 · 保留用户数据与插件 · 可选安装目录 · 开始菜单快捷方式 · 桌面快捷方式选项 · 卸载程序 · 卸载时询问是否删用户数据 · 安装中检测应用运行 · 更新后自动重启 · 150%/200% 缩放 · Defender/SmartScreen · Authenticode 签名 · Host 与子进程退出无残留。

命名：
```text
moyu-dsh-0.1.0-windows-x64-setup.exe
moyu-dsh-0.1.0-windows-x64-portable.exe   # 便携版可选，但不得代替正式安装验证
```

## 7. 里程碑

```text
C0 边界冻结 ........... 核心/ Mod 能力清单、两层更新模型、兼容与安全契约（§0.5/§1）
C1 插件基础设施 ....... Manifest、安装/启用/禁用/卸载、权限展示、兼容检查、本地包安装、卸载无残留
C2 业务剥离 ........... 图片/PDF/Media/业务截图 转 Mod；核心 composition 移除业务插件；按需装回验证
C3 应用壳 ............. 🟡 C3-a 品牌显示 ✅ + C3-b 迁移模块 ✅ + C3-c 身份切换/启用迁移 ✅（真机验证：迁移运行/凭据字节一致/旧目录保留/迁移后 Host-ready）；C3-d 壳页面、C3-e 收口待做
C4 DSH Kernel Manager . ✅ a–f 完成；设置页与线上 stable/beta 通道已实测（§2.1）
C5 应用更新 ........... Release 检查/下载/安装重启/stable-beta 通道/失败恢复（§4）
C6 安装器收口 ......... DMG 签名公证（§5）+ NSIS Windows 签名（§6）+ 升级/卸载/数据保留验证
```

执行顺序：`C0 → C1 → C2`，业务插件能真正装/卸后，再做 C3 壳、C4 内核管理、C5 更新器、C6 安装包。

## 8. 当前最先做什么

**第一步不是删业务代码，也不是升级 DSH，而是冻结“核心—Mod 契约”（C0）。**

C0 交付：§0.4 能力边界定稿、§0.5 决策 D1–D7 定论（尤其 D1/D2/D3 命名与迁移口径）、§1 契约文档、§2 两层更新模型契约。C0 冻结后才进 C1（插件安装闭环），再进 C2（业务打 Mod + 按需装回验证），最后才从 composition 删业务。

## 9. 不做清单（本计划期间）

- 不追 DSH `latest`；只切 MOYU 验证发布的内核版本。
- 契约（C0）未冻结前：不删业务代码、不升级 DSH、不改 productName/appId。
- 不在运行时修改签名后的 `Contents/Resources`。
- 不新增 Media/业务功能（Media 已归档冻结）。
- 不因改名而跳过用户数据迁移与升级安装验证。
