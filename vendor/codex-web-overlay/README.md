# codex-web-overlay（实验分支专用）

Codex 风格 Web UI 的六个上游 client bundle，构建自 `~/Program/deepseek-harness`
（tag `dsh-v0.1.1-rc.2` + `dsh-codex-web-porting-kit` overlay）。

## 覆盖内容

- Codex 风格侧边栏导航 + 多应用面：conversation / pull-requests / browser / scheduled / plugins
- 根布局 `surface` 槽位替换非聊天页的中央会话栏
- `settingsNavigation` 服务（Plugins 导航打开现有 Settings 壳）
- 会话底部工具面板（Terminal / Browser / Files）
- StatsLine 稳定高度，composer 不跳动

## 已知适配（相对套件原样）

- `ui-settings-general`：内联 `bindSnapshotSelector`（rc.2 未公开导出）、补
  `refreshDocumentIfLoaded` 本地实现、加 `use-sync-external-store@1.2.0` 依赖
- 各包 package.json 以 rc.2 为基线、仅补实际 import 缺失的 peer 依赖
- 类型层面仍有 ~80 处 WIP 错误（源工作区本就未完成构建验证），只保证可打包可运行

## 使用

```bash
node scripts/apply-codex-web-overlay.mjs           # 应用进 build/dsh-runtime 闭包
node scripts/apply-codex-web-overlay.mjs --restore # 还原官方 UI
```

产物不匹配 `0.1.1-rc.2` 闭包时脚本会拒绝执行。首次应用自动备份 `.orig`。
