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
