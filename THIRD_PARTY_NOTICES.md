# Third-party notices

MOYU DSH 包含以下第三方组件。对应许可证全文随应用一起发布在 `licenses/` 目录。

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

## sharp 0.35.3 / libvips

- 用途：图片格式转换、缩放和压缩。
- sharp 许可证：Apache License 2.0。
- macOS 原生包与 libvips 许可证：Apache-2.0 AND LGPL-3.0-or-later。
- 固定版本、npm integrity、动态链接边界和源码获取方式：`licenses/SHARP-NOTICE.md`
- Apache License 2.0 全文：`licenses/QPDF-Apache-2.0.txt`

## lucide-static 1.30.0

图标资源。**仅作构建期依赖**：构建时从中抽取映射表里用到的图标，
生成内联 SVG sprite；图标库本身不进入运行时产物，也不随安装包分发。

许可证：ISC

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## lucide-react 1.33.0（图标数据内联）

- 用途：MOYU Web UI 高频界面图标的线框图形来源。仅构建期从其 dist 提取
  `__iconNode` SVG 路径数据手工内联进 vendor/codex-web-overlay 的 client bundle；
  不安装为依赖，不进入运行时闭包，不随安装包分发 npm 包本体。
- 来源：https://github.com/lucide-icons/lucide/tree/main/packages/lucide-react
- 许可证：ISC

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
