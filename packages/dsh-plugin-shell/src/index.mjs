/**
描述: MOYU DSH 应用壳 —— host 侧占位（C3-d）。
职责: 注册应用壳设置分区，并通过 `/moyu/kernel` 把 Client 的内核管理请求收敛到
     Electron 窄桥。Host 不直接写 current.json、不执行下载包，也不注册 Tool。
契约: scope/plans/active/moyu-dsh-core-and-mod-platform-plan.md C3-d。
*/
export const name = 'moyu-shell'
export const inject = ['webServer']

function desktop() {
  if (!globalThis.__moyuDesktop) throw new Error('MOYU 桌面桥尚未就绪')
  return globalThis.__moyuDesktop
}

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) return reject(new Error('请求内容过大'))
      chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

const OPERATIONS = Object.freeze({
  status: 'desktop.kernel.status',
  'install-local': 'desktop.kernel.installLocal',
  probe: 'desktop.kernel.probe',
  activate: 'desktop.kernel.activate',
  rollback: 'desktop.kernel.rollback',
  'restore-builtin': 'desktop.kernel.restoreBuiltin',
  'check-feed': 'desktop.kernel.checkFeed',
  'download-install': 'desktop.kernel.downloadInstall',
  'restart-app': 'desktop.kernel.restartApp',
})

export function apply(ctx) {
  return ctx.webServer.register({
    method: 'POST',
    path: '/moyu/kernel',
    async handler(req, res) {
      try {
        const body = await readBody(req)
        const method = OPERATIONS[body.operation]
        if (!method) return sendJson(res, 400, { error: '不支持的内核操作' })
        const timeoutMs = body.operation === 'probe' ? 60_000 : body.operation === 'download-install' ? 10 * 60_000 : 30_000
        return sendJson(res, 200, await desktop().call(method, body, { timeoutMs }))
      } catch (error) {
        return sendJson(res, 400, { error: String(error?.message || error).slice(0, 300) })
      }
    },
  })
}
