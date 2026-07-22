# 摸鱼工具箱

> 面向包装设计师的桌面小工具箱：批量把 Adobe Illustrator 文件导出 PDF、批量文字转曲、生成标准条码/二维码，并处理常见图片与 PDF。

## 特性

- **Illustrator 批处理**：整个文件夹的 `.ai` 一键批量导出 PDF、批量文字转曲（outline）。
- **条码生成器**：支持 UPC-A、EAN-13、EAN-8、Code128、Code39、二维码；预览和 SVG/EPS 均由同一 Python 引擎生成，可直接进 Illustrator / Photoshop。
- **图片工具**：裁剪、文字水印、尺寸与质量控制；可导出 PNG / JPG / WebP / BMP / TIFF / ICO / TGA。透明 PNG 转 JPG 时自动铺白底。
- **PDF 工具**：PDF 转 PNG/JPEG/TXT、合并、拆分、旋转、提取页、图片转 PDF，以及内容提取式的 PDF 转 DOCX/XLSX/PPTX。
- **桌面原生体验**：基于 pywebview 的单窗口应用，支持浅色/深色主题，可打包为免安装 EXE。

## 安装

前置依赖：Python 3.9+（Windows 上使用 AI/PS 联动功能需已安装对应 Adobe 软件）。

Windows：

```bat
pip install -r requirements.txt
```

macOS（仅用于调试 UI 与条码功能，AI/PS 联动不可用）：

```bash
./run.sh
```

## 快速开始

Windows 推荐双击 `启动.vbs`（无终端窗口；自动检测 Python、补装依赖并启动）。
`启动.bat` 保留作排错入口；或手动：

```bash
python main.py
```

启动后出现「摸鱼工具箱」窗口，在左侧切换 Illustrator、条码、图片与 PDF 页面。

## 用法

- **批量导出 PDF**：选择包含 `.ai` 文件的文件夹 → 开始，进度与日志实时显示，产物默认写到源文件同目录。
- **批量文字转曲**：选择文件夹后对每个 `.ai` 执行 outline，覆盖或另存视设置而定。
- **生成条码**：选择条码类型、输入编码 → 预览 → 导出 SVG/位图/EPS 到桌面，或点击「在 Illustrator/Photoshop 打开」。
- **编辑图片**：添加图片 → 可选居中裁剪、文字水印、目标尺寸与质量 → 选择格式导出到桌面。
- **处理 PDF**：选择 PDF 后执行转图、转文字、合并/拆分/旋转/提页；PDF 转 Office 仅提取内容，不保证复杂版式。选择 Office 文件可转 PDF。

## 配置（可选）

- `settings.json`：界面主题（`light`/`dark`/`system`）与主题色（accent RGB）。首次运行自动生成。

## 平台说明

- AI/PS 联动通过 Windows COM（`pywin32`）驱动，**仅 Windows 可用**。
- Office 转 PDF 同样只支持 Windows，且需安装对应的 Microsoft Word、Excel 或 PowerPoint；缺失时会显示明确提示。
- macOS 上 `pywin32` 不安装，联动功能会返回明确的「仅 Windows 可用」提示；UI、条码生成、前端逻辑均可正常调试。

## 开发

- 开发约定见 `AGENTS.md`
- 当前版本范围与完成线见 `scope/v1.1-done.md`
- Git 工作流 / 提交规范 / issue 规范见 `AGENTS.md §9`
- 发布规范、Semver 和 CHANGELOG 见 `AGENTS.md §9.4`

## 许可证

私有项目（未指定开源许可证）。
