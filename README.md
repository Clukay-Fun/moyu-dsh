# MOYU DSH

MOYU 是一款基于 DeepSeek Harness（DSH）开发的智能桌面工作台。DSH Web UI 是唯一主界面，Electron 负责桌面宿主、安全边界和原生能力桥接。

## 当前能力

- DSH 会话、工作区、插件与设置
- 安排任务：创建、编辑、启停、立即运行、运行历史和未读通知
- 图片转换、PDF 与截图三项内置能力
- macOS arm64 本地开发与交付

Renderer 保持 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。文件读写和系统能力位于 Electron 主进程或 DSH Host Service，Web UI 只通过受控接口访问。

## 开发

```bash
npm install
npm run dev
npm run build
```

常用验证：

```bash
npm run verify:dsh-fence
npm run verify:dsh-bridge
npm run verify-overlay-applied
```

开发范围与验收以本地 `scope/` 中的当前计划为准。`scope/` 不纳入 Git。

## 目录

- `apps/desktop/`：Electron 主进程、截图覆盖层及桌面桥接
- `packages/`：DSH Host、Client、Tool 与 Profile 插件
- `vendor/codex-web-overlay/`：DSH Web UI 覆盖层维护真值
- `scripts/`：运行闭包、品牌覆盖、构建与验证脚本
- `docs/`：随源码维护的开发与发布文档
- `licenses/`：第三方许可证与 notices
- `scope/`：本地路线图、验收材料和视觉基线，不纳入 Git
