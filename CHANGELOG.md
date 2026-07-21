# Changelog

所有重要变更都记录在这里。

版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)：

- `MAJOR`：有破坏性变更，不再保持兼容。
- `MINOR`：增加向下兼容的新功能。
- `PATCH`：修复向下兼容的问题。

## [Unreleased]

### Added

- macOS 调试启动器 `run.sh`（自动建 venv、装可用依赖、跳过 pywin32）。
- 项目文档规范：`README.md`、`AGENTS.md`、`CLAUDE.md`、`scope/v1-done.md`、`.github/` 模板。
- 本地 Git 版本控制（无远程）。
- 条码引擎单元测试 `tests/test_barcode_engine.py`（14 项）与验收样本集 `tests/samples/`。

### Changed

- `api.py`：`pythoncom`/`win32com` 改为可选导入（`HAS_WIN32`），非 Windows 平台可正常启动。
- 「打开文件位置」改为跨平台实现（Windows `explorer` / macOS `open -R` / Linux `xdg-open`），不再固定调用 Windows 命令。
- EAN/UPC 输入完整长度时会校验末位校验位，错误则拒绝。
- Code128 拒绝空输入与非可打印 ASCII 字符，返回明确错误而非崩溃。

### Fixed

- **EAN-8 生成必崩**：8 位码错误复用 UPC-A 12 位文字排版导致 `IndexError`；改为专用 4+4 版式。
- **Code128 无法生成**：符号表缺停止符（`_CODE128[106]` 越界），且 Start B/C 图案错误导致条码不可扫；已补齐并修正。
- **路径穿越风险**：条码内容（Code39/128 允许 `/`、`\`、`..`）直接拼入桌面/临时文件路径；统一经 `_safe_filename` 清洗。
- 非 Windows 平台因顶层导入 `win32com` 导致应用无法启动的问题。

### Removed

## [0.1.0] - 2026-07-20

### Added

- Illustrator 批处理：批量导出 PDF、批量文字转曲。
- 条码生成器：UPC-A / EAN-13 / EAN-8 / Code128 / Code39，导出 SVG/位图/EPS，可送入 Illustrator / Photoshop。
- 基于 pywebview 的桌面 UI，支持主题切换；`run.bat` 启动器。
