# 验收样本集（v1 harness 输入）

对应 `scope/v1-done.md` §1 的冻结样本，跑 A0–A4 用。

v1.1 追加的图片、PDF 与 Office 样本用于其 A4–A8 验收；不会替代 v1 的
Illustrator 样本要求。

## ai/ — Illustrator 批处理样本

- `6789-3067 NNP.ai` — 真实包装稿，用于任务 A（批量 PDF）与文字转曲（A2）。

> ⚠️ DoD §1 要求 **≥5 个 `.ai`，其中 ≥1 个含文本**。目前仅 1 个，A0 未满足——需再补 ≥4 个真实稿件后 A0 才能打钩。

## barcodes.txt — 条码参照清单

覆盖 5 种类型，含期望校验位真值。接手实测：**5/7 通过**，`ean8` 与 `code128` 当前失败（见提交历史 / findings），是 v1 的修复目标。

## img/ — 图片样本

- `transparent.png`：带透明通道，用于验证 PNG 转 JPG 自动铺白底。
- `large-photo.jpg`：Pillow 项目的 Hopper 测试照片，用于大图裁剪、水印、尺寸与质量验收。
- `small-image.jpg`：小尺寸照片，用于全部 7 种导出格式回归。

## pdf/ — PDF 样本

- `multi-page.pdf`：两页 PDF，用于逐页转图、拆分、旋转和提页。
- `table.pdf`：带规整表格，用于 PDF 转 XLSX。

## office/ — Office 转 PDF 样本

- `sample.docx`、`sample.xlsx`、`sample.pptx`：分别验证 Word、Excel、PowerPoint COM 转 PDF。

> Office 样本的真实转换验收只能在安装对应 Microsoft Office 的 Windows 上完成。

## 运行方式

当前为手工执行（起 `python main.py` 按样本逐条跑并对照）。脚本化 harness 排在 `scope/v1-done.md` 的 icebox，下一版再做。
