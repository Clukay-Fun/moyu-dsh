# 计划与验收资料

本目录随源码纳入 Git，用于保存 MOYU DSH 当前执行计划与历史归档。

2026-09-05 阶段冻结：先发布当前 macOS arm64 测试包，后续按实际使用反馈恢复开发；C5/C6 暂不推进。历史计划保留原始上下文，不代表本次发布承诺。

## 目录

- `active/`：当前仍需执行或复核的计划。
- `archive/<bucket>/`：已完成、被替代或仅供追溯的历史计划，按主题分桶。

## 当前活动项（active/）

- [`moyu-dsh-core-and-mod-platform-plan.md`](active/moyu-dsh-core-and-mod-platform-plan.md)：**主计划**——收缩为“可更新的 DSH 桌面底座 + 可插拔 Mod”，区分应用更新与 DSH 内核更新。进度：**C0–C4 已完成**（C0 边界冻结 → C1 插件基础设施 → C2 业务剥离 → C3 应用壳/身份/打包 → C4 内核管理器）。下一步 C5 应用更新、C6 安装器。
- [`moyu-dsh-core-mod-contract.md`](active/moyu-dsh-core-mod-contract.md)：C0 交付物（**已冻结**，长期参考）——核心/Mod 能力边界、Manifest/兼容/安全契约、两层更新模型、命名 D1–D7。
- [`experiment-codex-web-ui-ui-unification-plan.md`](active/experiment-codex-web-ui-ui-unification-plan.md)：Codex 风格 UI 与调度任务主界面统一（**进行中**）。

## 归档（archive/）

- `core-mod-platform/`：主计划已完成的里程碑子计划——C1 插件基础设施、C2 业务剥离、C2-g 工具面策略。进度已并入主计划与 git 记录。
- `spikes/`：DSH 原生架构 Spike 与决策记录——m0a 原生发行 Spike、m0a carrier 认证收口、m2 PDF 整页渲染选型。
- `0.1.0/`：`0.1.0-dsh-native-distribution-plan.md` 原生底座落地计划（被主计划取代的基础）。
- `ui/`：`ui-fix-list-plan.md` 实测界面临时修复清单（随“暂停 Media UI 扩展”搁置）。
- `media-workspace/`：自媒体工作台（media preset 扩展）M0–M4，2026-09-01 闭环冻结；单一工作台转向后 media 插件/预设已从 composition 移除。

## 命名规则

- 全部小写 kebab-case。
- 计划：`<topic>-plan.md` 或 `<version>-<topic>-plan.md`。
- 验收清单：`<version>-<platform>-acceptance.md`。
- 里程碑/Spike：`m<n>-<topic>.md` 或 `<topic>-spike.md`。
- 带日期的机器结果：`YYYY-MM-DD-<topic>.json`。

计划完成后移入对应 `archive/<bucket>/`，保留正文、判据与结论，不在原目录留第二份。
