# AI sidecar notices

Windows AI sidecar 由 `sidecar/ai/requirements-win.txt` 中锁定的依赖构建。发布前需随安装包保留本文件及各上游许可证。

| 组件 | 版本 | 用途 | 许可证 |
| --- | --- | --- | --- |
| NumPy | 2.2.6 | 图像张量处理 | BSD-3-Clause（含 wheel 内第三方 notices） |
| ONNX Runtime DirectML | 1.24.4 | Windows 本地模型推理 | MIT（含 Microsoft third-party notices） |
| Pillow | 11.3.0 | 图片读取、缩放与输出 | HPND |
| PyInstaller | 6.21.0 | 构建单文件 sidecar | GPL-2.0-or-later with Bootloader Exception |

模型许可不属于上述运行库许可，另见 `AI-MODEL-NOTICE.md`。
