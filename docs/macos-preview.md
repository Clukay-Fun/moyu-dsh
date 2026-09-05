# MOYU DSH macOS 阶段测试版

本次冻结当前功能与 UI，不推进 C5 应用更新和 C6 安装器扩展。

- 应用版本：0.1.0；发布标签：`app-v0.1.0-preview.20260906`。
- 平台：macOS Apple Silicon（arm64），不支持本次未验证的 Intel Mac / Windows。
- 内核：`@deepseek-ai/dsh@0.1.1-rc.2`，按 lockfile 构建随包运行闭包。
- 包含当前会话/工作区 UI、安排任务、Mod 基础设施与 C4 内核管理器。
- `tests/`、`scope/plans/` 随源码提交；历史截图、凭据、用户数据与构建产物不入 Git。

## 构建

```sh
npm ci
npm run build:mac
```

产物为 `release/moyu-dsh-0.1.0-macos-arm64.dmg`。使用 ad-hoc 签名，不含 Developer ID 签名或 Apple 公证；其他机器可能遇到 Gatekeeper 拦截。不要关闭系统全局安全保护。

## 验证范围

- `node tests/run-acceptance.mjs --node`：15 项通过。
- `node tests/run-acceptance.mjs --live`：1 项通过。
- `npm run verify --workspace @moyu/dsh-plugin-scheduled-tasks`：通过。
- 打包 `.app`：`codesign --verify --deep --strict` 通过；DMG 校验通过。
- 打包 `.app` 在隔离 userData 下 Host 就绪、创建会话成功、无工具面漂移。首次探针停在系统钥匙串访问等待；自动探针使用 `--use-mock-keychain` 重试通过，不代表真实钥匙串授权/迁移已重新验收。此参数仅用于探针，产品默认启动不携带。
- 修复了运行闭包复制时 npm 相对符号链接被转成开发机绝对路径的问题，保持相对链接交付。
- 需真实模型凭据的两个人工 GUI 项未执行；不声称全功能人工验收或干净机器验证完成。

本版用于阶段留档与试用，后续按反馈继续开发。
