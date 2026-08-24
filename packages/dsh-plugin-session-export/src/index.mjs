// Moyu 会话导出：Host 侧 loopback 路由，复用 DSH 内核 sessionQuery 读取完整
// 事件日志并折叠为 Markdown。改动局限在 Moyu Host 插件，不污染 DSH 公共契约。
export const name = 'moyu-session-export'
export const inject = ['webServer', 'sessionQuery']

// 过滤凭据与内部绝对路径，避免私密元数据进入剪贴板。
function sanitize(text) {
  if (!text) return ''
  return String(text)
    .replace(
      /(?:password|passwd|口令|token|secret|api[_-]?key|access[_-]?key|private[_-]?key|authorization)\s*[:=]\s*\S+/gi,
      '[已隐藏]',
    )
    .replace(
      /(?:file:\/\/)?(?:\/Users|\/private|\/tmp|\/home|\/var\/folders|\/Volumes|C:\\)\S+/g,
      '[内部路径]',
    )
}

// 仅取可读文本块；工具调用块折叠（不展开参数/结果正文）。
function blockText(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .map((block) => (block?.type === 'text' ? block.text || '' : ''))
    .filter(Boolean)
    .join('\n')
    .slice(0, 20000)
}

function eventMarkdown(event) {
  const type = event?.type
  const data = event?.data
  if (!type || !data) return ''
  switch (type) {
    case 'user/message':
      return `## 用户\n\n${sanitize(blockText(data.content))}`
    case 'assistant/message':
      return `## 助手\n\n${sanitize(blockText(data.message?.content))}`
    case 'tool/call':
      return `### 工具调用：${data.name || 'unknown'}\n\n_参数已省略_`
    case 'tool/result':
      return data.error
        ? `### 工具结果：失败（${data.error.name || 'error'}）`
        : '### 工具结果：完成'
    default:
      return ''
  }
}

async function exportSession(ctx, sessionId) {
  const snap = await ctx.sessionQuery.readSession(sessionId)
  const lines = ['# 会话导出', '']
  const title = snap.session?.title
  if (title) lines.push(`**标题**：${sanitize(title)}`, '')
  for (const event of snap.events) {
    const md = eventMarkdown(event)
    if (md) lines.push(md, '')
  }
  return lines.join('\n').trim() + '\n'
}

export async function apply(ctx) {
  ctx.webServer.register({
    kind: 'exact',
    path: '/moyu/session-export',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'method not allowed' }))
        return
      }
      let raw = ''
      try {
        for await (const chunk of req) {
          raw += chunk
          if (raw.length > 1_000_000) {
            res.writeHead(413)
            res.end()
            return
          }
        }
        const sessionId = JSON.parse(raw || '{}').sessionId
        if (typeof sessionId !== 'string' || !sessionId) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: 'sessionId 必填' }))
          return
        }
        const markdown = await exportSession(ctx, sessionId)
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ markdown }))
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: String(err?.message || err) }))
      }
    },
  })
}
