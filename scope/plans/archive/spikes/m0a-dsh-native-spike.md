# 0.1.0 M0a · DSH 原生发行架构 Spike

> 日期：2026-08-19
> 性质：验证记录，不是产品实现
> 上游：DeepSeek Harness `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca`；所有直接声明的 `@deepseek-ai/dsh-*` 发布包固定为 `0.1.0-rc.7`（框架包 `@deepseek-ai/cordis` 按上游实际版本精确固定为 `4.0.1`）
> 结论：**G4 已通过 A 路径解除阻塞，不需要 patch 上游。M0a 仍未整体签字：真实模型回合调用 `moyu_hello` 因未提供测试凭据而阻塞；Developer ID 签名/公证仍是外部前置。**

> **后续架构更正（2026-08-20）**：本报告记录的是 M0a 当时的原型证据，不是当前生产
> 进程模型。B3.5 真实打包复验发现 `utilityProcess` 内 loopback server 对 Host 自身可达，
> 但对 Electron main 与 Chromium 均 `ECONNREFUSED`。现行方案已改为 Electron 自带运行时
> 配合 `ELECTRON_RUN_AS_NODE=1` 的独立 Node 子进程，控制/桌面桥改为有类型的进程 IPC；
> dev 与打包态均通过 HTTP / WS 403/403。详见主计划 B3.5，不应用本报告 §7.3 的原型结论
> 指导生产实现。

## 1. 门禁总表

| 门禁 | 状态 | 结论 |
| --- | --- | --- |
| G1 Client bundle 格式 | **通过** | 包外用 `tsdown` 可复刻 lazy-CJS bundle；能过 purity gate、进入 boot graph、由 `/plugins` 提供并在沙箱 BrowserWindow 中真实渲染。 |
| G2 独立功能页 / 路由 | **不通过（产品已接受）** | 发布的 Client plugin API 只有声明过的 Slot，没有通用路由注册面。0.1.0 已定为对话优先：Tool + 进度/结果卡片 + `settings.section`；可提上游 PR，但不作为里程碑前置，也不为此维护本地 patch。 |
| G3 credentials provider 可替换 | **通过** | 正式 profile 可禁用 `dsh-credentials-local`，自建 provider 能通过 Models 使用的同一 API 完成 set / describe / unset；未生成 `.credentials.yaml`。 |
| G4 API carrier 选择 | **通过** | 选择 B2：`127.0.0.1:0` + Electron 独立 session。`onBeforeSendHeaders` 实测同时覆盖 HTTP 与真实 DSH WebSocket Upgrade；Host fence 校验 Host、Origin、每 generation 随机 token。无需重建 frontend dist 或 patch `WebApiClient`。 |

## 2. 可运行最小产物

新增（未提交）：

- `packages/dsh-plugin-hello/`：一个双面包，同时提供 Host Service、`moyu_hello` Tool、内存 credentials provider、Client UI。
- `packages/m0a-dsh-spike/`：最小 profile、Electron `utilityProcess` Host、MessagePort 窄桥、复现脚本。

本轮没有修改 `src/`、根版本号、分支或远端，也没有新增 commit 或推送。仓库在本轮开始前已存在本地提交 `8063fb9 docs(architecture): define DSH migration constraints`，因此 `dev` 当时已经领先 `origin/dev` 1 个提交；该既有状态不能写成“仓库没有提交”。没有使用 pnpm/yarn，也没有复制 DSH 整仓进项目。

复现：

```bash
cd /Users/clukay/Program/moyu-tools/packages/m0a-dsh-spike
npm ci
npm run build:hello
npm run prepare:profile
export M0A_DSH_HOME="$PWD/.m0a-home"
npm run verify:compat
npm run verify:bridge
npm run start:electron
```

`prepare:profile` 只调用 npm。上游生成的 profile 目录会自带一份 `pnpm-workspace.yaml`，本 Spike 没有读取或调用它。

## 3. G1 · Client bundle 格式 — 通过

### 3.1 按上游配置复刻

上游规则：

- `/tmp/moyu-m0a-upstream.I8UgO7/upstream-src/packages/client/tsdown.client.ts:27-65`：允许内联的 wire/type 层与平台 externals。
- 同文件 `:170-207`：browser/CJS、`lib/client.js`、platform externals、其余依赖内联。
- 同文件 `:208` 后：purity gate。

Moyu 对应实现：

- `packages/dsh-plugin-hello/tsdown.config.ts:4-11`：externals 与 inline-safe 范围。
- `packages/dsh-plugin-hello/tsdown.config.ts:13-21`：包外复刻的 purity gate。
- `packages/dsh-plugin-hello/tsdown.config.ts:34-46`：browser CJS 与 `window.__ModuleLoader__.load(...)` 包装。

正向构建：

```text
$ npm run build:hello
[CJS] lib/client.js  2.08 kB
[ESM] lib/index.mjs  2.02 kB
Build complete

$ npm run verify:compat
{"dsh":"0.1.0-rc.7","clientExport":"./lib/client.js","packageExport":"./package.json","clientManifest":{"inject":["slots"],"platform":"web"},"reactPeer":"^18.2.0","lazyFactory":true,"inlineStyleTags":false}
```

反向 gate 探针：临时在 Client 入口加入值导入 `@deepseek-ai/dsh-client-locale/client`，构建退出非零，随后已撤销临时修改并重建。

```text
[plugin moyu-dsh-client-purity]
Error: client bundle purity: "@deepseek-ai/dsh-client-locale/client" is not a platform module,
inline-safe wire layer, or generated /remote contribution
```

完整输出：`/tmp/moyu-m0a-upstream.I8UgO7/purity-negative.log`。

### 3.2 Host 扫描、boot graph 与 `/plugins`

上游扫描契约：

- `/tmp/moyu-m0a-upstream.I8UgO7/upstream-src/packages/client/modules/src/index.ts:108-141`：校验 `dsh.client` 并解析 `exports["./client"]`。
- 同文件 `:354-356`：声明了 `dsh.client` 却无 `./client` 时明确失败。
- `packages/client/modules/README.md:11`：哈希进入 boot graph，并由 `/plugins` 提供。

实测 boot graph：

```text
"id":"@moyu/dsh-plugin-hello",
"url":"/plugins/@moyu/dsh-plugin-hello/client.js?rev=3f296240d273",
"inject":["slots"]
```

实测 `/plugins/@moyu/dsh-plugin-hello/client.js` 为 HTTP 200，开头为：

```js
window.__ModuleLoader__.load({ id: "@moyu/dsh-plugin-hello", factory: (require) => {
```

过程中先暴露了一个真实契约：缺少 `exports["./package.json"]` 时 scanner 无法读取 manifest；补上该导出后通过。对应 `packages/dsh-plugin-hello/package.json`。

### 3.3 浏览器真实渲染

使用 Electron BrowserWindow，设置：

```js
{ contextIsolation: true, nodeIntegration: false, sandbox: true }
```

打开设置后 CDP/DOM 实测：

```json
{
  "hello": "Moyu M0a hello client plugin rendered",
  "url": "http://127.0.0.1:54092/"
}
```

完整输出：`/tmp/moyu-m0a-upstream.I8UgO7/final-render-proof.json`。页面正文同时出现设置导航项 `Moyu M0a` 与该组件内容。

## 4. G2 · 独立功能页 / 路由 — 不通过

上游 Slot 面只有 `single | list | keyed | chain`：

- `/tmp/moyu-m0a-upstream.I8UgO7/upstream-src/packages/client/ui-slots/src/index.ts:88-91`。
- 注册入口在同文件 `:787`，只能向已经声明的 Slot 注册。
- settings 声明 `settings.section` 为 list/root：`packages/client/ui-settings/src/client/contract/slots.ts:53`。
- `packages/client/ui-settings/README.md:5` 明确罗列 settings 的页面型 Slot。

全 Client plugin API 与已发布包搜索未发现 router/path 注册服务。当前插件实测能获得一个设置页导航项 `Moyu M0a`，但 URL 仍是根 `/`，不是插件自己的路由。

影响：M1 的“图片转换页面”不能按“插件拥有顶层路由”设计。现有发布包下只有两条可行路径：

1. 挂入已声明的合适 Slot（若产品形态可接受）；
2. 向上游新增功能页/router Slot，再由 Moyu 插件注册。

不能用 `settings.section` 冒充通用业务页。本门禁按“能否获得独立页面/路由”的原判据记为不通过。

> **2026-08-20 更正**：本节漏查了 `conversation.view`。该 slot 为
> `{ kind: 'list', scope: 'session' }`，注释写明“one list entry per view tab…rendered
> one-at-a-time by the session body via `only: <active id>`”，且 `conversation.session`
> 的注释明确指路“To ADD rather than replace…`conversation.view` for a whole tab”，
> 上游 `ui-trajectory` 即先例。因此**占满会话主体的独立功能视图是可行的**，
> 不可行的只是自有 URL 路由。G2 应记为**部分通过**，M1 的 UI 目标据此恢复为
> 独立功能视图（见主计划 §0 决策 11）。

## 5. G3 · credentials provider 替换 — 通过

上游抽象 seam：

- `/tmp/moyu-m0a-upstream.I8UgO7/upstream-src/packages/credentials/credentials/src/index.ts:54-99`：`CredentialProvider` 的 resolve / describe / set / unset。
- Moyu 实现：`packages/dsh-plugin-hello/src/index.ts:20-42`。
- profile 禁用默认 `credentials` 行，改由 hello 包提供同名 Service：`packages/m0a-dsh-spike/profile/cordis.patch.yml:1-2` 与 hello `src/index.ts:50-52`。

通过 Models 页面实测 set；随后通过 Models 页使用的同一 `/api/credentials.*` 传输完成完整循环：

```text
describe -> configured:false, writable:true
set      -> ok:true
describe -> configured:true, source:"moyu-memory-spike", writable:true
unset    -> ok:true
describe -> configured:false, writable:true
CREDENTIAL_FILE_COUNT 0
```

没有生成 `$DSH_HOME/.credentials.yaml`。因此不需要上游 PR 或本地 patch 才能替换 provider。

边界：本阶段 provider 只存内存，按要求没有实现 safeStorage。正式实现仍属于 M0b。

## 6. G4 · carrier 选择 — 通过（A 路径）

### 6.1 B1（file:// + Electron IPC）被证据否决

发布 frontend 的 `dist/index.html:6-12` 使用 `/manifest.webmanifest`、`/favicon.svg`、`/assets/...` 根绝对路径；直接 `file://` 会解析到文件系统根。

更关键的是发布的 connection Client：

- `/tmp/moyu-m0a-upstream.I8UgO7/upstream-src/packages/client/connection/src/client/index.ts:87-88`：除 fixture 外固定 `new WebApiClient()`。
- `.../web-api-client.ts:13-15`：HTTP 固定走 `globalThis.fetch`。
- 同文件 `:23-42`：下行固定走浏览器 WebSocket。

boot graph 的依赖指向确切包 id `@deepseek-ai/dsh-client-connection`，profile 插入另一个 id 不会替换依赖目标。若不重建 frontend dist，B1 至少需要替换/patch 该 Client 插件并处理资源 URL；“只提供一个平台子类”不够。

### 6.2 B2（loopback HTTP/WS）认证链路已闭环

最终选择 B2。实测策略：

- Host 只绑定 `127.0.0.1:0`；禁止 `0.0.0.0`。
- utility process 在监听成功后通过 parent MessagePort 发 `{type:'host-ready', url, pid}`。
- Host exit 后有界重启时生成新端口、新 token、新 generation，原 BrowserWindow 只加载新 origin；旧端口关闭、旧 token 被新 Host 拒绝。
- 主窗口只允许本次 ready URL；`will-navigate` 与新窗口拒绝其他 origin。
- HTTP 与 WS 均严格校验 `Origin === 本次 origin`、Host 为本次 loopback authority；缺失/错误 Origin 的浏览器写请求拒绝。
- 每 generation 使用 `randomBytes(32)` 生成 256-bit token，只经 Electron main ↔ utility process 的内存消息传递。

上游 webserver 仍不提供认证；见 `/tmp/moyu-m0a-upstream.I8UgO7/upstream-src/packages/host/webserver/README.md:21`。本方案不改上游：

- Electron 独立非持久化 partition 与精确 URL filter：`packages/m0a-dsh-spike/electron/main.mjs:120-133,315-324`；
- HTTP/WS Header 注入：同文件 `:120-133`；Host 实际收到正确头才记为通过；
- Host 在 DSH 导入前安装 HTTP 与 Upgrade fence：`electron/auth-fence.mjs:30-69`；secret 用 `timingSafeEqual` 比较（`:7-12`）；
- token 由 main 生成并只经 utility process 消息传入：`electron/main.mjs:65-80`、`electron/host-worker.mjs:15-26`；
- ready 仍只回传 URL、pid、generation，不回传 token：`host-worker.mjs:41-49`。

`webRequest` 对 WebSocket 的覆盖不是推测。真实 DSH 页面打开 `/api/events.mux` 与 `/api/events.host` 后：Electron 侧观察到 `resourceType:"webSocket"`，Host fence 记录 token/origin/host 三项均为 true，CDP 收到 HTTP 101。随后通过内存 credentials provider 执行临时 `M0A_FRAME_PROBE` set → unset，CDP 收到 2 个真实 WS 下行帧；临时值已经 unset，不是模型凭据。

复现命令：

```bash
cd /Users/clukay/Program/moyu-tools/packages/m0a-dsh-spike
M0A_DSH_HOME="$PWD/.m0a-home" npm run verify:auth
```

断言化原始输出（完整日志 `/tmp/moyu-m0a-auth-final/auth-asserted.log`）：

```json
{"path":"A","upstreamPatched":false,"httpInjected":true,"wsInjected":true,"hostAcceptedHttp":true,"hostAcceptedWs":true,"wsHandshake101":true,"wsFramesReceived":2,"validHttpStatus":200,"invalidHttp":{"missingToken":403,"wrongToken":403,"wrongOrigin":403,"wrongHost":403},"invalidWs":403,"helloRendered":true,"pageStateContainsToken":false,"tokenOnDisk":false,"navigationPolicy":{"blockedNavigations":1,"deniedWindows":1,"stayedLocal":true},"generationRotated":true,"oldTokenStatus":403,"oldOriginClosed":true,"secondGenerationLoaded":true}
```

同一探针连续三次得到同样判据结果，端口分别轮换；最后一次由 `assert` 钉死所有字段，任一不符退出非零。

### 6.3 六项复验

| 项 | 状态 | 实测证据 |
| --- | --- | --- |
| boot graph、`/plugins`、hello UI | **通过** | `build:hello` + `verify:compat` 通过；两代 Host 页面都显示 `Moyu M0a hello client plugin rendered` |
| HTTP 与四类非法请求 | **通过** | Electron session 合法请求 200；缺 token、错 token、错 Origin、错 Host 均 403 |
| WebSocket 与非法握手 | **通过** | 两条真实 DSH WS 均经注入，CDP 101 且收到 2 帧；宿主外无 token Upgrade 为 403 |
| 主窗口 origin 策略 | **通过** | 外部 `will-navigate` 1 次被阻止、`window.open` 1 次被拒，页面保持本次 loopback origin |
| token 隔离与轮换 | **通过** | 两代 token 不同；页面 JS 状态与 `$DSH_HOME` 非依赖文件扫描均无 token；旧 token 对新 Host 为 403 |
| Host 重启 generation | **通过** | 旧端口关闭；新端口、新 token、新 generation；同一 BrowserWindow 加载新 UI，hello 再次可见 |

B 路径未执行，因为 A 已满足硬判据。维护成本不是零：本地 fence 依赖 DSH webserver 继续经 Node `http.createServer` 创建服务器；上游若改用其他 server seam，兼容探针会在页面首个请求即 403/超时并阻止升级。它不修改上游包、不替换 Client bundle，长期跟随面小于 connection-client patch。

DevTools Network 面板可看见注入头是接受的调试性质。token 未进入 `window` primitive 状态、DOM、local/sessionStorage、URL、磁盘或普通日志；安全边界是阻止同机其他进程无凭据直连 loopback。

## 7. M0a 其余清单

### 7.1 hello 包形态

| 项 | 状态 | 证据 |
| --- | --- | --- |
| Host Service | 通过 | `packages/dsh-plugin-hello/src/index.ts:10-18` |
| Tool 注册 | 通过 | 同文件 `:53-66` 注册 `moyu_hello` |
| Client UI | 通过 | `src/client.tsx:8-26`；真实页面可见 |
| 对话中真实调用 Tool | **阻塞** | 当前正式 profile 没有可用模型凭据/测试 LLM adapter，未跑一次模型回合。仅证明 Tool 注册和 session 创建成功，不能写“对话调用通过”。 |

`session.create` 实测返回：

```json
{"ok":true,"value":{"sessionId":"session-ce82895e-2ef7-4568-813e-6b742545f030"}}
```

每会话 hook 会读取 `ctx.tools.schemas()`，与 `['moyu_hello']` 精确比较，漂移即抛错拒绝创建：`src/index.ts:67-73`。上述 session 创建成功同时证明当前工具全集恰为白名单。

负向实测把测试副本的 expected 临时改为空数组，创建固定 id 后得到：

```text
session.create -> ok:false
message: moyu tool whitelist drift: expected ; got moyu_hello
session.list   -> items:[]
```

证明不是“创建后只报警”：同步 listener 的 throw 会回滚 store entry。临时改动随后已撤销、重新构建并再次跑过 bridge/compat。

### 7.2 唯一 Moyu profile

`packages/m0a-dsh-spike/profile/cordis.patch.yml` 禁用了：

- 本地明文 credentials；
- bash/pwsh、terminal 相关执行面、jobs、通用文件工具、web、code runtime；
- skill、subagent 工具/派生、workflow、goal/todo/editor；
- plugin inventory、Cordis 动态 runner/UI；
- preset 管理及对应 UI。

最终 boot graph 搜索只有 `@moyu/dsh-plugin-hello`，没有 `dsh-cordis-client-runner`、`ui-cordis`、`ui-settings-plugins`、`ui-agent-preset`。曾遗漏 `cordis-client-runner`，浏览器产生 404；补禁用后控制台该错误消失。这证明仅隐藏 UI 不足够，Host/Client 两面都需禁用。

核心 `subagent` Service 仍安装并激活，因为当前 `apiProxy` 依赖该 seam；所有 spawn/fork/tool/UI 均禁用，用户不可调用。若正式 profile 要连 seam 也删除，需要上游允许 apiProxy 域按需裁剪。

### 7.3 utilityProcess、MessagePort 与生命周期（历史原型，已被 B3.5 取代）

实现：`packages/m0a-dsh-spike/electron/main.mjs`、`host-worker.mjs`。

```text
dsh web: http://127.0.0.1:53885
M0A_BRIDGE {"pid":5530,"bridge":{"id":1,"ok":true,"value":"desktop.pong"}}
M0A_WINDOW {"url":"http://127.0.0.1:53885/","direct":true}
M0A_CRASH_ISOLATION {"electronAlive":true,"hostPid":5530,"hostExited":true,"exit":{"code":0}}
```

结论：

- Host 是 Electron `utilityProcess`，不是外挂 Node runtime。
- `desktop.ping` 只经 MessagePort 窄桥。
- 主窗口直接 `loadURL` DSH origin，没有 WebContentsView。
- kill Host 后 Electron 主进程仍活；正常退出后 `ps` 无 M0a Host、Node、PTY、shell 残留。
- stdio 当前用 pipe 转发到 Electron stdout/stderr；正式日志落盘尚未实现。

### 7.4 原生模块闭包

安装闭包：20 个 `.node` 文件，包括多平台 extract-zip、sharp、koffi、node-addon-require-builtin、node-pty 预编译件。清单：`/tmp/moyu-m0a-upstream.I8UgO7/installed-node-final.txt`。

运行时用 `vmmap <utility-pid>` 实测只加载 1 个：

```text
@img/sharp-darwin-arm64/lib/sharp-darwin-arm64-0.35.3.node
```

清单：`/tmp/moyu-m0a-upstream.I8UgO7/runtime-node-final.txt`。

结论：禁用 terminal 确实使 node-pty/koffi 未加载，但“运行加载闭包预期为零”不成立；Web profile 的附件/图像链提前加载了 sharp。该发现不改变进程架构，但 M0b 签名清单必须包含 sharp。

### 7.5 版本、依赖与体积

```text
@deepseek-ai/dsh 0.1.0-rc.7
distinct name@version: 682
@deepseek-ai/* entries: 199
node_modules unpacked: 629,748 KiB
Electron.app included: about 276 MiB
gzip closure proxy: 176 MiB
```

`@deepseek-ai/dsh` 元包会安装禁用的工具实现；禁用只改变运行图，不缩小安装闭包。根据 176 MiB gzip 代理与 DMG 额外元数据，**预计 arm64 DMG 约 180–230 MiB**；这是估算，未生成真实 DMG，不能当最终包体结论。

### 7.6 codesign / hardened runtime / notarytool

本机 ad-hoc hardened runtime 探针：

```text
codesign --force --options runtime --timestamp=none --sign - <probe>
valid on disk
flags=0x10002(adhoc,runtime)
Runtime Version=26.5.0
```

`notarytool 1.1.2 (41)` 可用，但：

```text
security find-identity -v -p codesigning
0 valid identities found

xcrun notarytool history --keychain-profile moyu-m0a-does-not-exist
No Keychain password item found
```

结论：工具链与 hardened runtime 参数可行；Developer ID 签名和真实公证因本机无身份/凭据而**阻塞，未验证通过**。

## 8. 上游接口清单与兼容探针

| 依赖接口 | 兼容探针 |
| --- | --- |
| `dsh.client` manifest | package manifest 精确断言 `{inject:['slots'], platform:'web'}` |
| `exports['./client']` / `./package.json` | `verify:compat` 检查并由 Host scanner 实跑 |
| lazy CJS factory | bundle 首行正则校验 + 浏览器真实加载 |
| React peer | 精确断言 `^18.2.0`，实际 dev runtime 固定 `18.2.0` |
| Client purity | 正向构建 + 非白名单值导入负向失败 |
| CredentialProvider | describe/set/unset API 完整循环 |
| boot graph 与 `/plugins` | index graph 与 HTTP 200 实测 |
| DSH 版本 | 两个顶层 manifest 的直接 `@deepseek-ai/dsh-*` 声明全部显式 `0.1.0-rc.7`；lockfile 将上游包自身携带的 `^0.1.0-rc.7` 传递声明解析并锁定到 rc.7。Moyu 不使用 dist-tag/caret。 |

入口：`npm run verify:compat`；脚本：`packages/m0a-dsh-spike/scripts/compat-probe.mjs`。

## 9. 计划 §12 回填

1. **purity gate 规则**：平台模块与 React 等共享运行时必须 external；`dsh-(host-apiproxy|session|llm|tools|brand)` wire/type 层、vendored pure library 与生成的 `/remote` 可内联；其他 `@deepseek-ai/*` 值依赖拒绝。包外可复刻，G1 已证明。
2. **正式产品不继承环境变量凭据层**：正式 provider 只读 safeStorage 对应密文存储，避免启动器环境静默覆盖 UI 状态。开发便利只能放在独立开发 profile，不能进入唯一 Moyu 正式 profile。本 Spike 的 provider 没有 env fallback。
3. **tesseract.js 独立 Node 子进程 + asar**：本 M0a 未运行，保持未决，进入首个 OCR/图片包装片前做独立资产解析 Spike；不得标通过。
4. **Host stdio / 日志 / ready**：M0a 原型使用 `pipe` + parent MessagePort；B3.5 现行实现
   使用独立 Node 子进程 IPC 的结构化 `{type:'host-ready',url,pid}`，Electron main 将启动
   结果追加到 `userData/dsh-startup.log`。原型结论已被打包证据取代。
5. **gs1encoder Emscripten 相对路径**：本 M0a 未运行，保持未决，条码 Host Service 迁移前独立验证 DSH 独立 Node 子进程 + asarUnpack 路径；不得标通过。
6. **Windows 时点**：维持计划决策，macOS M0b/M1 与首个原生插件通过后再触发 Windows 适配；COM/Illustrator/Office 延后批次只在 Windows 打包产物验收，不用 Mac 结论代替。

## 10. 最终判断与下一步

M0a 不能整体签字：

- G2 证明 M1 的“独立图片页面”目标与当前发布 API 不相容；产品已决定接受现有 Slot/对话优先形态。page/router 扩展点可向上游提 PR，但不作为前置，也不占用本地 patch 预算。
- G4 已通过 A 路径：Electron 网络层注入覆盖 HTTP 与真实 DSH WS 握手，六项复验全部通过，不需要 connection-client patch。
- “对话中调用 Tool”仍因没有可用模型测试凭据而阻塞；Tool 注册不能替代真实模型回合。
- Developer ID 签名/公证、Tesseract 与 gs1encoder 资产路径仍未跑，不得标通过。

后续状态：项目已进入 M0b，B3.5 运行闭包与 B4 主壳已完成；真实模型回合仍需可撤销、
限额的测试凭据，Developer ID 签名/公证仍是外部前置。当前实施与剩余项以主计划为准。
