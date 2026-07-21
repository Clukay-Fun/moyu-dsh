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

### Changed

- `api.py`：`pythoncom`/`win32com` 改为可选导入（`HAS_WIN32`），非 Windows 平台可正常启动。

### Fixed

- 非 Windows 平台因顶层导入 `win32com` 导致应用无法启动的问题。

### Removed

## [0.1.0] - 2026-07-20

### Added

- Illustrator 批处理：批量导出 PDF、批量文字转曲。
- 条码生成器：UPC-A / EAN-13 / EAN-8 / Code128 / Code39，导出 SVG/位图/EPS，可送入 Illustrator / Photoshop。
- 基于 pywebview 的桌面 UI，支持主题切换；`run.bat` 启动器。
