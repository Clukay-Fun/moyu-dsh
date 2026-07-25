# Third-party notices

摸鱼工具箱包含以下第三方组件。对应许可证全文随应用一起发布在 `licenses/` 目录。

## OCR-B Regular

- 用途：条码人眼可读数字的默认字体；随渲染层一起交付，不依赖用户系统安装字体。
- 来源：`jaycee723/ocr-b` commit `fedeba81519770109925b5bec70e940be5948d8f`，`dist/OCR-B.ttf`。
- 许可证：SIL Open Font License 1.1。
- 文件 SHA-256：`367d876cca948ecd4900851f6e85687cbb6e71de9d0d2f36348edec5655526af`。
- 许可证文件：`licenses/OCR-B-OFL-1.1.txt`。

## opentype.js

- 用途：将随包 OCR-B 字体的人眼可读字符转换为 SVG 路径，避免 Adobe 联动时发生字体替换。
- 版本：2.0.0。
- 许可证：MIT。
- 许可证文件：`licenses/opentype.js-MIT.txt`。

## qpdf-run 0.2.1

- 用途：在 Electron 渲染进程的 Web Worker 中运行 QPDF WebAssembly，为 PDF 提供加密与解密能力。
- 许可证：MIT
- Copyright (c) 2026 CrabPDF contributors
- npm integrity：`sha512-X4ZknJPl7av/o+VEX3XafWyzfOUm9qSoa+JqXS+hGSNVI1Wxk60bKhmLvvX/8gp7pCzbp3KW0zY8aLBjL5EkYQ==`
- 许可证文件：`licenses/qpdf-run-MIT.txt`

## QPDF 11.10.0

- 用途：由 `qpdf-run` 打包为 JavaScript/WebAssembly，执行 PDF AES-256 加密与解密。
- 许可证：Apache License 2.0
- Copyright (c) 2005-2021 Jay Berkenbilt, 2022-2025 Jay Berkenbilt and Manfred Holger
- `qpdf.wasm` SHA-256：`86cba3db67ce3add2dd4b3533dd0614dade0b4e98b14a229bfda90306c053dd3`
- `qpdf.js` SHA-256：`35df3cad3919f370dd86970e1ea3fc8bd57f744be23a50a773f17abcbf1d9ffc`
- 许可证文件：`licenses/QPDF-Apache-2.0.txt`
- 上游 NOTICE：`licenses/QPDF-NOTICE.md`

## ag-psd 31.0.2

- 用途：在 Electron 主进程中把原图与 AI 处理结果写入分层 PSD。
- 许可证：MIT
- Copyright (c) 2016 Agamnentzar
- npm integrity：`sha512-5s5PvqbomPIIJ9YjL6robz55rT4RYPiQkww4brisyZEb5jzlHB1EKh47IJg7gIFj0RUrD0cMgdntM907qaZjXA==`
- 许可证文件：`licenses/ag-psd-MIT.txt`

## Windows AI sidecar

- 用途：通过 Python + ONNX Runtime DirectML 执行 RMBG-1.4 抠图和 MI-GAN 图像修补；无可用 DirectML 设备时回退 CPU。
- 运行库与构建工具：NumPy 2.2.6、ONNX Runtime DirectML 1.24.4、Pillow 11.3.0、PyInstaller 6.21.0。
- 运行库许可证登记：`licenses/AI-SIDECAR-NOTICE.md`
- 模型版本、哈希和使用边界：`licenses/AI-MODEL-NOTICE.md`
- 模型不会提交到仓库或打入安装包，由用户首次使用时下载并进行 SHA-256 校验。

## FFmpeg / ffprobe 6.1.1

- 用途：格式工厂通过独立、隐藏窗口的子进程执行音频与视频探测、转换和压缩。
- 来源：`eugeneware/ffmpeg-static` release `b6.1.1`，实际 Windows 构建来自 gyan.dev essentials。
- 实际许可证：GPL-3.0-or-later；构建启用了 `--enable-gpl --enable-version3 --enable-static`。
- 版本、二进制哈希、源码获取与发布义务：`licenses/FFMPEG-NOTICE.md`
- 上游许可证与完整构建配置随二进制放在发布包 `resources/tools/ffmpeg/`。

## sharp 0.35.3 / libvips

- 用途：格式工厂读取图片元数据并执行批量格式转换、缩放和压缩。
- sharp 许可证：Apache License 2.0。
- Windows 原生包与 libvips 许可证：Apache-2.0 AND LGPL-3.0-or-later。
- 固定版本、npm integrity、动态链接边界和源码获取方式：`licenses/SHARP-NOTICE.md`
- Apache License 2.0 全文：`licenses/QPDF-Apache-2.0.txt`

## winax 3.6.9

- 用途：在独立 Electron utility process 中调用 Windows COM，联动 Microsoft Office、Adobe Illustrator 与 Adobe Photoshop。
- 许可证：MIT
- Copyright (c) 2023 Yuri Dursin
- npm integrity：`sha512-R+6yTIk8pnIf50P4z8unG3yfRP0DCYzq7v8J04tool1OR4UkoXKEGfAj+cq6IPPhnVQHz7+m7isg+yU38T727w==`
- 许可证文件：`licenses/winax-MIT.txt`
