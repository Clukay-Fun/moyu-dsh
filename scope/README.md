# 本地开发资料

此目录保存开发计划、验收材料、原型和本机证据。自 2026-09-05 起，`plans/` 随源码纳入 Git；原型、截图及其他本机证据继续忽略。

- `plans/`：当前计划与验收清单；完成项按版本归档，规则见 `plans/README.md`。
- `prototypes/`：仍可能继续使用的交互原型。
- `visual-baseline/`：当前视觉回归基线，也是 `scripts/capture-ui-baseline.mjs` 的默认输出目录。
- `archive/`：已经完成或被替代的历史材料，仅供追溯。

新生成的临时截图、Spike 输出和旧版验收记录应归入 `archive/`，不要放回项目根目录或 `release/`。
