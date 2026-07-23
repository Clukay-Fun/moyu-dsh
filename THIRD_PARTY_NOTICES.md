# Third-party notices

摸鱼工具箱包含以下第三方组件。对应许可证全文随应用一起发布在 `licenses/` 目录。

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
