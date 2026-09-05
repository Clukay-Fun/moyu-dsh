# M0a 收口任务书 · DSH loopback carrier 认证

> 性质：架构验证，不是产品实现。
> 前置：M0a G1/G3 已通过；G2 技术门禁不通过但产品接受 Slot/对话优先。
> 执行状态：A 路径与六项复验已通过，G4 已解除阻塞；§5 真实模型回合等待用户提供测试凭据。
> 边界：不改 `src/`，不升版本，不提交、不推送、不建分支；临时证书、token、日志和探针放 scratchpad。

## 1. 目标

在不重建 DSH frontend dist、优先不 patch 上游的前提下，为 B2（loopback HTTP/WS）建立可发行的会话认证链路，并用证据决定最终 carrier 实现。

## 2. A 路径：Electron 网络层注入（优先）

1. 主窗口使用独立、非持久化 session partition。
2. Electron main 每次启动 DSH Host generation 时生成高熵随机 token，仅保存在 main/Host 内存中；不得进入页面、URL、配置文件、恢复文件或普通日志。
3. Host 继续监听 `127.0.0.1:0`，ready 消息携带 origin、generation 与 pid，但不携带 token。
4. 对该 generation 的精确 ready origin 注册 `session.webRequest.onBeforeSendHeaders`，注入专用请求头。
5. Host 在所有 HTTP route 与 WebSocket upgrade 前置 fence 中同时校验：
   - 精确 `Host`；
   - 允许的应用 Origin；
   - 当前 generation 的随机 token。
6. 分别记录普通 HTTP 请求和 WebSocket Upgrade 握手在 Electron 网络栈中实际收到的请求头。不得以 Chromium 行为常识代替实测。

### A 路径通过判据

- HTTP 与 WS 握手都获得正确 token；
- 缺 token、错误 token、错误 Origin、错误 Host 均被拒绝；
- DSH frontend dist 未修改，`WebApiClient` 未替换；
- token 不得出现在页面 JavaScript 可读状态（`window`、DOM、`localStorage`、`sessionStorage`）、URL、磁盘文件或普通日志中；
- token 在 DevTools Network 面板的请求头中可见属于已知且接受的性质：能打开该页面 DevTools 的主体已具备该页面的全部权限，这不构成额外攻击面。认证边界防范的是同机其他进程无凭据直连 loopback。

## 3. B 路径：窄替换（仅当 A 失败）

若且仅若 Electron 无法为 WebSocket Upgrade 注入/保留请求头，才验证本地 connection-client 替换包或上游 PR。改动面限定为：

- connection client 的 `apply` / `WebApiClient` 构造注入点；
- fetch headers；
- WebSocket URL、header 或子协议中的认证承载；
- Host route / upgrade fence。

不得 fork DSH 整仓，不为 G2 页面形态加入本地 patch。报告必须说明 A 失败的原始证据和 B 的长期跟随成本。

## 4. 六项强制复验

无论最终采用 A 或 B，全部通过后 G4 才能从“阻塞”改为“通过”：

1. boot graph 与 `/plugins` 正常，hello Client UI 仍可见；
2. 合法 HTTP API 请求成功，四类非法请求被拒；
3. 合法 WebSocket 建连和消息往返成功，非法握手被拒；
4. Electron 主窗口仅接受精确 DSH origin，导航与新窗口策略不回退；
5. 每次启动 token 不同，旧 token 不可复用；
6. Host 崩溃重启后 generation、端口与 token 全部轮换，旧 renderer/旧连接失效，新 UI 恢复。

每项附命令、原始输出、实现文件与行号。没跑过的标“未验证”，不得标通过。

## 5. 同批补测：真实 Tool 调用

用户提供一个可撤销、限额的模型测试凭据后：

1. 通过替换后的 credentials provider 设置凭据；
2. 创建符合白名单的会话；
3. 发起一个明确要求调用 `moyu_hello` 的真实模型回合；
4. 保存 Tool request、Host Service 执行和最终结果卡片三段证据；
5. unset 凭据并确认无明文文件残留。

没有可用凭据时保持“阻塞”，不能用 Tool 已注册代替真实调用。

## 6. 并行外部项与 M0b 后续

- 立即申请/准备 Developer ID Application 身份与 notarytool 凭据；这不是代码项，但有外部周期。
- M0b 打包 Spike 检查根项目与 DSH 闭包中的 `sharp@0.35.3` 最终是一份还是两份；两份时分别记录体积、ABI、asarUnpack 与签名清单。

## 7. 停止条件与交付

出现与主计划 §0 已确认决策冲突的新证据时停止并报告，不自行改方向。

交付：

- 更新 `m0a-dsh-native-spike.md` 的 G4 状态与证据；
- A/B 路径选择结论和维护成本；
- 六项复验表；
- 真实 Tool 调用证据或明确的凭据阻塞说明；
- 无产品实现、无提交、无推送。
