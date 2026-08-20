import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'moyu-legacy-tools'
export const inject = ['webServer']

const LEGACY_MODULES = new Set(['image', 'pdf', 'bc', 'video'])

declare global {
  var __moyuDesktop: {
    call(method: string, payload?: unknown): Promise<unknown>
  } | undefined
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/moyu/open-legacy',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST' })
        res.end('method not allowed')
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        const data = Buffer.from(chunk)
        size += data.length
        if (size > 1024) {
          res.writeHead(413)
          res.end('payload too large')
          return
        }
        chunks.push(data)
      }
      let module: string
      try {
        module = JSON.parse(Buffer.concat(chunks).toString('utf8')).module
      } catch {
        res.writeHead(400)
        res.end('invalid json')
        return
      }
      if (!LEGACY_MODULES.has(module)) {
        res.writeHead(400)
        res.end('unknown module')
        return
      }
      const desktop = globalThis.__moyuDesktop
      if (!desktop) throw new Error('Moyu 桌面桥尚未就绪')
      const result = await desktop.call('desktop.openLegacyExtension', { module })
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(result))
    },
  }), 'moyu legacy tools route')
}
