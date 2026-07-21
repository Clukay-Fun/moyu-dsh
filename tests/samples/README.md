# 验收样本集（v1 harness 输入）

对应 `scope/v1-done.md` §1 的冻结样本，跑 A0–A4 用。

## ai/ — Illustrator 批处理样本

- `6789-3067 NNP.ai` — 真实包装稿，用于任务 A（批量 PDF）与文字转曲（A2）。

> ⚠️ DoD §1 要求 **≥5 个 `.ai`，其中 ≥1 个含文本**。目前仅 1 个，A0 未满足——需再补 ≥4 个真实稿件后 A0 才能打钩。

## barcodes.txt — 条码参照清单

覆盖 5 种类型，含期望校验位真值。接手实测：**5/7 通过**，`ean8` 与 `code128` 当前失败（见提交历史 / findings），是 v1 的修复目标。

## 运行方式

当前为手工执行（起 `python main.py` 按样本逐条跑并对照）。脚本化 harness 排在 `scope/v1-done.md` 的 icebox，下一版再做。
