# sharp / libvips notice

MOYU DSH 使用以下固定版本的图片处理组件：

## sharp 0.35.3

- 项目：https://github.com/lovell/sharp
- 许可证：Apache-2.0
- npm 包：`sharp@0.35.3`
- npm integrity：`sha512-ej0zVHuZGHCiABXcNxeYhpRnPNPAcvbG8RMdBAhDAxLKkCRVSpK3Iyu7qbqw3JMzoj0REeM6f3tJLtVwl0023Q==`
- 许可证全文：`QPDF-Apache-2.0.txt`（同一份 Apache License 2.0 通用文本）

## macOS arm64 原生包

- npm 包：`@img/sharp-darwin-arm64@0.35.3`
- 许可证：Apache-2.0 AND LGPL-3.0-or-later

MOYU DSH 不修改 sharp 或 libvips，只通过公开 API 动态调用，并通过 electron-builder 的
`asarUnpack` 将原生文件原样随应用分发。

libvips 采用 LGPL-3.0-or-later：

- 项目与对应源码：https://github.com/libvips/libvips
- 许可证全文：https://www.gnu.org/licenses/lgpl-3.0.html
- sharp 预编译依赖说明：https://sharp.pixelplumbing.com/install/

发布包必须保留本 notice、`THIRD_PARTY_NOTICES.md` 及其链接的许可证信息。
