// 会话导出路由验收（v3 范围 · 选项：Host 路由逻辑，无需真实模型）。
//
// 做法：用真实 HTTP 服务器装载 Moyu 会话导出插件注册的 /
// moyu/session-export 处理器，喂入最小会话事件日志 fixture，断言：
//   - POST 成功（200）且 Markdown 含 用户 / 助手 / 工具调用 段落；
//   - 凭据与内部绝对路径被过滤为 [已隐藏] / [内部路径]（不泄漏私密元数据）；
//   - 会话标题被保留；
//   - GET → 405；缺少 / 空 sessionId → 400。
//
// 为什么不需要模型 / 不依赖 app：导出是纯 Host 侧 loopback 路由，输入是
// sessionQuery.readSession 的快照；这里用 fixture 快照驱动真实处理器，
// 验证的是导出变换与敏感字段过滤的真实行为，不是源码字符串匹配。
import { createServer } from 'node:http'
import { apply } from '../packages/dsh-plugin-session-export/src/index.mjs'

let passed = 0
let failed = 0
const assert = (label, condition, detail = '') => {
  console.log(`  ${condition ? '✅' : '❌'} ${label.padEnd(46)} ${String(detail).slice(0, 80)}`)
  condition ? (passed += 1) : (failed += 1)
}

const SESSION_ID = 'sess-fixture-001'
const fixtureEvents = [
  { type: 'user/message', data: { content: [{ type: 'text', text: '这是用户问题 password: topsecret123 见 /Users/alice/keys/id_rsa' }] } },
  { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '助手回答内容' }] } } },
  { type: 'tool/call', data: { name: 'image.convert', args: {} } },
  { type: 'tool/result', data: {} },
]

let captured = null
const ctx = {
  webServer: { register: (spec) => { captured = spec } },
  sessionQuery: {
    readSession: async (id) => {
      if (id !== SESSION_ID) throw new Error('session not found')
      return { session: { title: 'Fixture 会话' }, events: fixtureEvents }
    },
  },
}
await apply(ctx)
if (!captured || captured.path !== '/moyu/session-export') {
  console.error('❌ 导出路由未注册到 /moyu/session-export')
  process.exit(1)
}

const server = createServer((req, res) => captured.handler(req, res))
await new Promise((resolve) => server.listen(0, resolve))
const base = `http://127.0.0.1:${server.address().port}/moyu/session-export`

const ok = await fetch(base, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: SESSION_ID }),
})
const okJson = await ok.json()
assert('POST /moyu/session-export 返回 200', ok.status === 200, String(ok.status))
assert('Markdown 含「用户」段落', okJson.markdown?.includes('## 用户'))
assert('Markdown 含「助手」段落', okJson.markdown?.includes('## 助手'))
assert('Markdown 含「工具调用」段落', okJson.markdown?.includes('工具调用'))
assert('会话标题被保留', okJson.markdown?.includes('Fixture 会话'))
assert('密码被过滤为 [已隐藏]', okJson.markdown?.includes('[已隐藏]') && !okJson.markdown?.includes('topsecret123'))
assert('内部绝对路径被过滤为 [内部路径]', okJson.markdown?.includes('[内部路径]') && !okJson.markdown?.includes('/Users/alice'))

const get = await fetch(base, { method: 'GET' })
assert('GET 返回 405', get.status === 405, String(get.status))

const noId = await fetch(base, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
})
assert('缺少 sessionId 返回 400', noId.status === 400, String(noId.status))

const emptyId = await fetch(base, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: '' }),
})
assert('空 sessionId 返回 400', emptyId.status === 400, String(emptyId.status))

server.close()
console.log(`会话导出路由验收通过 ${passed} 项，失败 ${failed} 项`)
process.exit(failed ? 1 : 0)
