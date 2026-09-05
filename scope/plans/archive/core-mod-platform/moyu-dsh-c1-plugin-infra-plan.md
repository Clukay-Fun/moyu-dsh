# C1 · 插件（Mod）基础设施 — 设计与落地

> 性质：里程碑 C1 落地方案，隶属 `moyu-dsh-core-and-mod-platform-plan.md`，契约见 `moyu-dsh-core-mod-contract.md`。
> 状态：**C1 机制完成**（A1/A2/A3 已定；核心逻辑 + host 集成 + 装载链路全部实现并测试通过：verify-mods-registry 15/15、verify-mods-host-integration 6/6，run-acceptance --node 12/12）。唯一剩项：C1-f 权限展示 UI，并入 C3 插件页。可进 C2。

## 进度（2026-09-03）

| 切片 | 状态 | 证据 |
|------|------|------|
| C1-a Manifest 校验 | ✅ | `apps/desktop/main/dsh/mods.js` `validateManifest`；测试 4 项 |
| C1-b 注册表状态机 | ✅ | `readRegistry/writeRegistry/installFromDir/setEnabled/uninstall`（原子写）；测试覆盖 |
| C1-c composition 生成 | ✅ 逻辑 + ✅ host 接线 | `composeInsert`（yaml）；host `applyEnabledMods` 在 ensureProfile 两个 return 前调用，空注册表 no-op，失败隔离 |
| C1-d 本地包安装 | ✅ | `installFromDir`（校验 manifest + 兼容 + SHA-256 INSTALLED） |
| C1-e 兼容检查 | ✅ | `checkCompat`（shell/kernel/platform）；测试 3 项 |
| C1-f 权限展示 | ⬜ 并入 C3 插件页 | manifest.permissions 已存注册表，UI 待 C3 |
| C1-g 卸载无残留 | ✅ 逻辑+单测 | `uninstall` 幂等，删目录+注册表项；测试验证核心仍可 compose |
| C1-h 诊断 | ✅ | `diagnostics`（状态/兼容/完整性 tampered 检测） |
| 集成测试 | ✅ 单元 15/15 | `tests/verify-mods-registry.mjs`，已入 run-acceptance（--node 12/12） |
| Mod 真实装载链路 | ✅ 已验（模块级） | `tests/verify-mods-host-integration.mjs` 6/6：装 demo Mod → compose 注入 patch → **复制**进 profile 闭包 → **linked package 真被 import、apply() 执行、且 peer 依赖从闭包解析成功**（装载硬证据）→ disable/uninstall 重置 patch 重应用（模拟重启）→ demo 消失、核心保留、无残留、空注册表 no-op。`applyModsToProfile` 即 host `ensureProfile` 每次启动调用的同一函数。**注：C2-D1 已把软链改为复制**（peer 依赖 realpath 解析，见 C2 计划） |
> 勘察基准：2026-09-03。版本 `0.1.0`。背景 [[core-mod-pivot]]。

## 1. 勘察结论（现状）

- composition 是静态 `packages/dsh-profile/cordis.patch.yml`（一个 `insert:` 插件列表），构建期由 `build-dsh-runtime` 生成到 `home-template/profiles/moyu/`，首启拷到 `DSH_HOME/profiles/moyu/`，升级时 host `ensureProfile` 再同步 patch + node_modules。
- 现有注释明确：**“profile 是应用拥有的唯一 Moyu composition，不是用户可安装插件的目录。”**（0.1.0 阶段的既定约束）——C1 要引入用户可安装 Mod，即**修订这条约束**（见 A1）。
- 装载是**启动期静态**：cordis 无产品级“运行时从包安装”。上游 `dsh-client-ui-settings-plugins` 只提供“查看 + 禁用”（`disabled: true` 机制），非安装器；`cordis-plugin-include` 有 hot-reload，但作为产品可靠面风险高。
- 签名后 `.app` 的 `Contents/Resources` 只读 → 用户安装的 Mod 必须落**用户目录**（与内核 `kernels/` 同构）。

## 2. C1 架构（待批决策）

### A1（决策）composition 从“静态 patch”改为“核心 + Mod 注册表生成”
Host 启动前，由 MOYU 主进程**生成** profile 的 `insert:` 列表 = **内置核心插件**（credentials-desktop / directory-picker / profile 框架）+ **注册表中已启用的 Mod**。
- 保留 core 部分为 app 独占、只读、随应用更新；Mod 部分来自用户目录注册表。
- 修订 0.1.0 那条“profile 非用户插件目录”约束为：**core composition 仍 app 独占；Mod 以受控注册表注入，不手改 profile 目录**。

### A2（决策）启停/装卸语义 = 注册表变更 + Host 重启（C1 不做热插拔）
- install / enable / disable / uninstall 都只改注册表与用户目录文件，**下次 Host 重启生效**（确定性、可回滚、崩溃面小）。
- 热插拔（cordis-plugin-include hot-reload）**推迟**，不作为 C1 目标；C1 先把“可靠装卸 + 重启生效”做扎实。

### A3（决策）Mod 物理布局
```text
Application Support/<userData>/mods/
├── <mod-id>/
│   ├── manifest.json          # §2.1 契约字段
│   ├── package/               # 插件包（含 lib、node_modules 闭包或声明依赖）
│   └── INSTALLED              # 完整性标记（校验通过才算装好）
└── registry.json              # { installed[], enabled[], versions, 校验状态 }
```
- 预装 Mod：出厂随应用带在 `Contents/Resources/preinstalled-mods/`，首启复制进用户目录注册（可卸载）。

## 3. C1 任务切片

- **C1-a Manifest 规范 + 校验器**：落地契约 §2.1 字段；加载器校验 id/version/requires/permissions/platforms；非法拒绝。
- **C1-b Mod 注册表**：`registry.json` 读写（原子写）；install/enable/disable/uninstall 状态机；幂等。
- **C1-c composition 生成**：core + enabled Mods → 生成 `cordis.patch.yml` 的 insert 列表（替换纯静态拷贝路径）；core 恒在、Mod 按注册表。
- **C1-d 本地包安装**：从本地 Mod 包目录/压缩包安装到 `mods/<id>/`，校验完整性（SHA-256）写 INSTALLED。
- **C1-e 兼容检查**：安装/启用前校验 manifest 的 requires.shell / requires.kernel / platforms；不满足拒绝并说明。
- **C1-f 权限展示**：安装时列出 Mod 声明的 permissions（供人工确认）。
- **C1-g 卸载无残留验证**：uninstall 删 `mods/<id>/` + 注册表项；**验证核心不带该 Mod 仍能启动**（自动化 + 真机）。
- **C1-h 诊断**：列出已装 Mod、状态、兼容结果、加载错误；失败 Mod 不阻塞整体启动。

## 4. 验收判据（C1）

| 验收项 | 判据 |
|--------|------|
| Manifest 校验 | 合法通过、非法（缺字段/版本非法/平台不符）拒绝并说明 |
| 安装闭环 | 本地包 install → 出现在注册表 + mods/ → 重启后功能出现 |
| 启停 | disable 后重启功能消失、enable 后重启恢复；注册表幂等 |
| 卸载无残留 | uninstall 后 mods/<id> 与注册表项清空；核心不带它仍正常启动（证据） |
| 兼容检查 | 壳/内核/平台不匹配的 Mod 被拒绝启用 |
| core 恒在 | 任何 Mod 状态下，核心 composition（credentials/桥/directory-picker）始终装载 |
| 失败隔离 | 单个 Mod 加载失败只跳过它并记录，不阻塞 Host 启动 |
| 无回归 | 现有 Host/Client harness、run-acceptance 全绿 |

## 5. 不做（C1 边界）
- 不做热插拔（A2）；不做远程 Mod 市场下载（后续里程碑）；不改 DSH 内核（那是 C4）；不改 productName/appId（C3）；C1 阶段业务插件仍以现有方式在场，**先跑通装卸机制，C2 再把业务真正搬进 Mod 层**。

## 6. 待确认
A1（composition 生成模型）、A2（重启生效、暂不热插拔）、A3（Mod 用户目录布局）——确认后按 C1-a→C1-h 开码。
