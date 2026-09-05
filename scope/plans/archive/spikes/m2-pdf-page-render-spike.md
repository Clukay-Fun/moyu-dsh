# M2 PDF 整页转图双方案 Spike

日期：2026-08-21
结论：**选择 `@napi-rs/canvas` 作为长期 Host 渲染后端；不建设 headless PDF renderer。**

本任务只做选型验证，没有把整页转 PNG/JPEG 接入产品，也没有修改正式依赖版本。
临时探针与隔离安装运行于 `/tmp/moyu-pdf-render-spike`，验证结束后已删除，不在仓库内。

## 1. 相同输入与参数

- 样本：16 页、612×792 pt，包含文字、矢量矩形、半透明圆形与空白边缘；
- SHA-256：`b4f0be104a2a295e1fe2048bad429ddb064afa06a91a05bb5a6086eedd26dfed`；
- 两端均使用 `pdfjs-dist@5.4.624`、scale 2，输出 1224×1584；
- PNG 与 JPEG（quality 0.9/90）均实跑；
- headless 使用 Electron 43.2.0、`sandbox:true`、`contextIsolation:true`、`nodeIntegration:false`。

本次执行命令形状如下；若需复跑，应在新的临时目录重建同一固定探针：

```sh
node /tmp/moyu-pdf-render-spike/napi.mjs
./node_modules/.bin/electron /tmp/moyu-pdf-render-spike/headless.cjs
node /tmp/moyu-pdf-render-spike/compare.mjs
node /tmp/moyu-pdf-render-spike/napi-resilience.mjs
./node_modules/.bin/electron /tmp/moyu-pdf-render-spike/headless-resilience.cjs
```

## 2. 正确性

16 页全部同尺寸。逐像素解码比较：

```text
PNG max mean absolute channel error: 0.835454 / 255
JPEG max mean absolute channel error: 1.323874 / 255
dimensions: 1224x1584
```

两端页角 Alpha 都是 255。PDF 整页按白色纸张渲染，不存在可保留的“页面外透明区”，
因此“透明角”不是两方案的有效胜负判据；两端在该语义上一致。PNG 需要保留 Alpha 通道，
JPEG 明确铺白底。

## 3. 时间与内存

PNG 单格式、16 页连续三轮：

| 方案 | 耗时 | RSS 基线 | RSS 峰值增量 |
| --- | ---: | ---: | ---: |
| napi 0.1.100 | 1477 / 1457 / 1473 ms | 约 123 MiB（首次隔离探针） | 84.8 / 76.8 / 76.7 MiB |
| headless | 1224 / 1232 / 1188 ms | 约 251 MiB（main + renderer） | 110.5 / 110.4 / 110.7 MiB |

用项目实际已安装的 `@napi-rs/canvas@0.1.100` 重跑 PNG+JPEG 双格式，napi 为
1633–1651 ms、RSS 增量 83.5–91.5 MiB；headless 为 2041 ms、RSS 增量约
130.9 MiB。编码组合变化会改变耗时排序，因此不能只凭单轮速度选型。稳定结论是：
headless 的进程基线和峰值内存更高，napi 不需要额外 Chromium renderer。

## 4. 取消、超时与崩溃隔离

- napi：`RenderTask.cancel()` 得到 `RenderingCancelledException`，取消后同一 PDF 可继续渲染；
- napi 驻留 Host 进程内，没有进程内崩溃隔离。原生模块若导致进程级崩溃，会由现有
  DSH Host generation supervisor 恢复，所有在途 Host job 明确失败；
- headless：销毁窗口会拒绝在途任务；`forcefullyCrashRenderer()` 得到 `killed`，Electron
  main 存活，并可新建 renderer 后成功渲染 1224×1584 页面；
- 正式 napi 实现仍须沿用 PDF job 的 AbortSignal 与 120 秒超时，不得做不可取消的同步批处理。

headless 在崩溃隔离上胜出，但该优势不足以抵消新增 renderer 生命周期、通信与内存成本。

## 5. 交付布局与原生模块事实

最初“napi 会新增约 27 MiB 原生模块”的假设不成立：

```text
npm ls @napi-rs/canvas --all
moyu-tools@2.1.0
└─┬ pdfjs-dist@5.4.624
  └── @napi-rs/canvas@0.1.100
```

现有 macOS 包已经同时在 `app.asar.unpacked` 和 `Resources/dsh-runtime` 交付
`skia.darwin-arm64.node`。后者约 26 MiB，并已用打包应用的 Electron Node 运行时实测：

```sh
ELECTRON_RUN_AS_NODE=1 \
  release/mac-arm64/摸鱼工具箱.app/Contents/MacOS/摸鱼工具箱 \
  -e "const c=require(process.cwd()+'/release/mac-arm64/摸鱼工具箱.app/Contents/Resources/dsh-runtime/node_modules/@napi-rs/canvas'); const x=c.createCanvas(8,8); console.log(JSON.stringify({ok:true,width:x.width,height:x.height}))"
```

输出：`{"ok":true,"width":8,"height":8}`。

headless 不是零成本复用。源码态 `file://` 直接加载 pdfjs 模块/worker 未建立可运行入口；按
现有 Vite 方式构建后新增约 404 KiB renderer bundle、1.08 MiB pdf worker 和新的 HTML
entry，随后才能渲染。因此它会命中“新增 renderer entry / worker / 打包路径”门禁。

## 6. 选型与后续约束

选择 `@napi-rs/canvas@0.1.100`：

1. 驻留 `@moyu/dsh-plugin-pdf` Host Service，是长期后端，不是迁移脚手架；
2. 正式依赖必须显式钉 `0.1.100`，不能依赖 pdfjs 的传递可选依赖；
3. 不新增 headless entry、preload、worker、窗口或 Host↔main 渲染协议；
4. PNG 保留 Alpha 通道但整页纸张为不透明白色；JPEG 显式铺白；
5. 分页顺序处理并逐页释放 canvas/page，保留取消、超时和 Host generation 失败语义；
6. 本 Spike 未改正式依赖，整页转图产品实现仍为未完成；
7. 当前包中的 `.node` 仅为 ad-hoc/linker 签名状态，Developer ID/hardened runtime/notary
   仍归 M4 总门禁，不在本 Spike 声称通过。

## 7. 未验证

- 复杂扫描件、字体缺失、注释表单、超大尺寸页面的兼容性；
- 100 页以上文档的长时间峰值；
- Developer ID 签名及公证后的 `.node` 加载；
- Windows x64 ABI 与打包路径。

这些不推翻本次 macOS arm64 架构选型，但必须在对应功能验收或 M4/Windows 阶段补齐。
