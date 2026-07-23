# FFmpeg Windows binary notice

格式工厂使用独立子进程调用 FFmpeg，不把 FFmpeg 链接进 Electron 或 Node 模块。

## 固定构建

- 二进制来源：`eugeneware/ffmpeg-static` release `b6.1.1`
- 实际上游：FFmpeg `6.1.1-essentials_build-www.gyan.dev`
- 平台：Windows x64
- 许可证：GPL-3.0-or-later
- 构建配置明确包含：`--enable-gpl --enable-version3 --enable-static`，以及 libx264/libx265/libvpx/libmp3lame/libopus 等；完整配置随包见 `tools/ffmpeg/BUILD-INFO.txt`。

| 文件 | SHA-256 |
| --- | --- |
| `ffmpeg.exe` | `04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00` |
| `ffprobe.exe` | `3a7e2dc003dc2cd1472827e4c7c4f056ae1ae0ae7c5bbc580c99b49827351ba4` |
| `ffmpeg-win32-x64.gz` | `8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77` |
| `ffprobe-win32-x64.gz` | `f309e6223ad89d2fe54bccd420a7709b66fd27540674e92309578ed491a43c8d` |

构建脚本还会下载并校验上游 `win32-x64.LICENSE` 与 `win32-x64.README`，随发布包放在 `resources/tools/ffmpeg/`。

## 源码与发布义务

- FFmpeg 官方源码：<https://ffmpeg.org/releases/ffmpeg-6.1.1.tar.xz>
- 二进制发布页：<https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1>
- FFmpeg 许可证说明：<https://ffmpeg.org/legal.html>

如对外分发含这些二进制的安装包，必须同时保留 GPL 许可证、构建信息及对应源码获取方式；不得只分发 EXE 而移除上述材料。
