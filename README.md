# 摸鱼工具箱

> 面向包装设计师的桌面小工具箱：批量把 Adobe Illustrator 文件导出 PDF、批量文字转曲，以及生成可直接进 AI/PS 的标准条码。

## 特性

- **Illustrator 批处理**：整个文件夹的 `.ai` 一键批量导出 PDF、批量文字转曲（outline）。
- **条码生成器**：支持 UPC-A、EAN-13、EAN-8、Code128、Code39；可导出 SVG / 位图 / EPS，或直接在 Illustrator / Photoshop 中打开。
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

Windows 双击 `启动.bat` 即可（自动检测 Python、补装依赖并启动）；或手动：

```bash
python main.py
```

启动后出现「摸鱼工具箱」窗口，在顶部切换「Illustrator 工具」与「条码生成器」两个页面。

## 用法

- **批量导出 PDF**：选择包含 `.ai` 文件的文件夹 → 开始，进度与日志实时显示，产物默认写到源文件同目录。
- **批量文字转曲**：选择文件夹后对每个 `.ai` 执行 outline，覆盖或另存视设置而定。
- **生成条码**：选择条码类型、输入编码 → 预览 → 导出 SVG/位图/EPS 到桌面，或点击「在 Illustrator/Photoshop 打开」。

## 配置（可选）

- `settings.json`：界面主题（`light`/`dark`/`system`）与主题色（accent RGB）。首次运行自动生成。

## 平台说明

- AI/PS 联动通过 Windows COM（`pywin32`）驱动，**仅 Windows 可用**。
- macOS 上 `pywin32` 不安装，联动功能会返回明确的「仅 Windows 可用」提示；UI、条码生成、前端逻辑均可正常调试。

## 开发

- 开发约定见 `AGENTS.md`
- 当前版本范围与完成线见 `scope/v1-done.md`
- Git 工作流 / 提交规范 / issue 规范见 `AGENTS.md §9`
- 发布规范、Semver 和 CHANGELOG 见 `AGENTS.md §9.4`

## 许可证

私有项目（未指定开源许可证）。
