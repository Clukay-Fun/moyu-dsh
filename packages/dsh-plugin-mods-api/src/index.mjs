/**
描述: MOYU Mods 管理 Host 路由（C3-d2）。
职责: 向 Client 暴露 `/moyu/mods` —— 读已装 Mod（registry + 基础状态），写 enable/disable/uninstall。
     Mod 启停/卸载改的是 userData/mods/registry.json；**下次重启 Host 生效**（C1 A2）。
说明: 自包含读写 registry JSON（从 DSH_HOME 推导 modsHome），不跨进程 import 主进程 mods.js。
     不做安装/兼容重校验（那在启动 applyModsToProfile/审计里）；本路由只管清单展示与启停/卸载。
契约: scope/plans/active/moyu-dsh-core-and-mod-platform-plan.md C3-d。
*/
import { existsSync } from 'node:fs'
import { readFile, writeFile, rm, rename, readdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export const name = 'moyu-mods-api'
export const inject = ['webServer']

function modsHome() {
  return process.env.MOYU_MODS_HOME || join(dirname(process.env.DSH_HOME || ''), 'mods')
}

async function readRegistry(dir) {
  try {
    const parsed = JSON.parse(await readFile(join(dir, 'registry.json'), 'utf8'))
    if (parsed && typeof parsed.mods === 'object') return parsed
  } catch { /* 缺失/损坏 → 空 */ }
  return { version: 1, mods: {} }
}

async function writeRegistry(dir, reg) {
  const file = join(dir, 'registry.json')
  const tmp = `${file}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(reg, null, 2), 'utf8')
  await rename(tmp, file)
}

async function integrityOf(dir, id) {
  const installed = join(dir, id, 'INSTALLED')
  if (!existsSync(installed)) return 'missing'
  try { return (await stat(join(dir, id, 'package'))).isDirectory() ? 'ok' : 'error' } catch { return 'error' }
}

async function listMods() {
  const dir = modsHome()
  const reg = await readRegistry(dir)
  const mods = []
  for (const m of Object.values(reg.mods)) {
    mods.push({
      id: m.id,
      version: m.version,
      displayName: m.displayName || m.id,
      enabled: !!m.enabled,
      permissions: m.permissions || [],
      integrity: await integrityOf(dir, m.id),
    })
  }
  mods.sort((a, b) => a.id.localeCompare(b.id))
  return mods
}

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0
    req.on('data', (c) => { const b = Buffer.from(c); size += b.length; if (size > limit) return reject(new Error('body too large')); chunks.push(b) })
    req.on('end', () => { try { const s = Buffer.concat(chunks).toString('utf8'); resolve(s ? JSON.parse(s) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}
function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value))
}

export function apply(ctx) {
  ctx.webServer.register({
    method: 'POST',
    path: '/moyu/mods',
    async handler(req, res) {
      let body
      try { body = await readBody(req) } catch (e) { return sendJson(res, 400, { error: String(e?.message || e) }) }
      const op = body && body.operation
      const dir = modsHome()
      try {
        if (op === 'list') return sendJson(res, 200, { mods: await listMods() })
        if (op === 'set-enabled') {
          const reg = await readRegistry(dir)
          if (!reg.mods[body.id]) return sendJson(res, 404, { error: 'mod 未安装' })
          reg.mods[body.id].enabled = !!body.enabled
          await writeRegistry(dir, reg)
          return sendJson(res, 200, { ok: true, restartRequired: true, mods: await listMods() })
        }
        if (op === 'uninstall') {
          const reg = await readRegistry(dir)
          delete reg.mods[body.id]
          await writeRegistry(dir, reg)
          await rm(join(dir, body.id), { recursive: true, force: true })
          return sendJson(res, 200, { ok: true, restartRequired: true, mods: await listMods() })
        }
        return sendJson(res, 400, { error: `unknown operation: ${op}` })
      } catch (e) {
        return sendJson(res, 500, { error: String(e?.message || e) })
      }
    },
  })
}
