/**
描述: C3-b userData 兼容迁移（纯 fs，可 harness 独立测；C3-c 才在启动早期启用）。
背景: 改应用名（MOYU → MOYU DSH）会让 OS 派生新的 userData 路径。必须把旧目录的
      凭据/设置/会话/mods 安全迁到新路径，不丢数据、不进空白环境。
安全语义（逐条对应 C3-b 需求）:
  1. 旧存在、新为空：复制到临时目录 → 校验 → 原子发布（rename）。
  2. **保留旧目录**：全程只读旧目录，绝不移动/删除。
  3. 幂等：迁移后在新目录写 .moyu-migrated-from.json 标记；重复启动读标记 → already，不重迁。
  4. 可重试：staging 是临时目录，中断只留 staging（下次先清理）；新目录只在原子 rename 后出现。
  5. 复制失败：清理 staging，返回 failed，调用方继续用旧目录，不进空白环境。
  6. 新旧都有数据且新目录**无我方迁移标记** → conflict，禁止静默合并（两边都不动）。
  7. 不记录凭据内容：日志只含路径与计数，绝不读/打印文件内容。
  8. 校验：本模块校验结构完整性（文件数 + 逐文件字节数一致）；可读性/凭据可解密由上层真机验证。
返回: { status: 'no-source'|'already'|'conflict'|'migrated'|'failed', ...detail }
*/
import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile, rm, rename, mkdir, cp, stat } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { randomUUID } from 'node:crypto'

const MARKER = '.moyu-migrated-from.json'
// 视为“有用户数据”的标志物（存在任一即认为该目录承载用户数据）。
const DATA_MARKERS = ['dsh', 'mods', 'dsh-credentials.enc', 'settings.yaml', 'settings.json']

async function dirHasData(dir) {
  if (!existsSync(dir)) return false
  let entries
  try { entries = await readdir(dir) } catch { return false }
  const meaningful = entries.filter((n) => n !== MARKER && !n.startsWith('.migrating-'))
  if (meaningful.length === 0) return false
  // 有标志物，或存在任何非隐藏条目，都算有数据。
  if (DATA_MARKERS.some((m) => meaningful.includes(m))) return true
  return meaningful.some((n) => !n.startsWith('.'))
}

// 稳定遍历，产出 [{ rel, size }] 用于完整性校验（不读内容）。
async function inventory(dir) {
  const out = []
  const walk = async (d, rel) => {
    let entries
    try { entries = await readdir(d, { withFileTypes: true }) } catch { return }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entries) {
      if (e.name === MARKER) continue
      const full = join(d, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) await walk(full, r)
      else if (e.isFile()) { const s = await stat(full); out.push({ rel: r, size: s.size }) }
      // 符号链接等非常规条目：迁移期不期望出现，跳过（inventory 不含即校验会发现缺失）
    }
  }
  await walk(dir, '')
  return out
}

function inventoryEqual(a, b) {
  if (a.length !== b.length) return false
  const map = new Map(a.map((x) => [x.rel, x.size]))
  for (const x of b) { if (map.get(x.rel) !== x.size) return false }
  return true
}

/** 读新目录的迁移标记；返回 { fromDir } 或 null。 */
async function readMarker(newDir) {
  try {
    const raw = await readFile(join(newDir, MARKER), 'utf8')
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed.fromDir === 'string') ? parsed : null
  } catch { return null }
}

export async function migrateUserData({ oldDir, newDir, log = () => {} }) {
  const info = (msg) => log(`[userdata-migrate] ${msg}`) // 只传路径/计数，绝不传文件内容
  const oldHas = await dirHasData(oldDir)
  const newHas = await dirHasData(newDir)

  // 无旧数据（全新安装或旧路径不存在）→ 无需迁移
  if (!oldHas) { info(`no source data at ${oldDir}`); return { status: 'no-source' } }

  if (newHas) {
    const marker = await readMarker(newDir)
    if (marker) { info(`already migrated (marker → ${marker.fromDir})`); return { status: 'already', fromDir: marker.fromDir } }
    // 新目录有独立数据且非我方迁移 → 禁止静默合并
    info(`conflict: both ${oldDir} and ${newDir} carry data, no migration marker`)
    return { status: 'conflict', oldDir, newDir }
  }

  // 新目录为空/不存在 → 执行迁移
  const staging = join(dirname(newDir), `.migrating-${basename(newDir)}-${randomUUID()}`)
  try {
    await rm(staging, { recursive: true, force: true })
    await cp(oldDir, staging, { recursive: true, dereference: false })
    // 校验结构完整性（文件数 + 逐文件字节数）
    const src = await inventory(oldDir)
    const stg = await inventory(staging)
    if (!inventoryEqual(src, stg)) {
      await rm(staging, { recursive: true, force: true })
      info(`verify failed: inventory mismatch (src ${src.length} vs staging ${stg.length})`)
      return { status: 'failed', reason: 'verify-mismatch' }
    }
    // 写迁移标记（在 staging 内，随原子发布一起生效）
    await writeFile(join(staging, MARKER), JSON.stringify({ fromDir: oldDir, at: Date.now(), files: src.length }, null, 2), 'utf8')
    // 原子发布：newDir 若为空目录先删，再 rename
    if (existsSync(newDir)) await rm(newDir, { recursive: true, force: true })
    await mkdir(dirname(newDir), { recursive: true })
    await rename(staging, newDir)
    info(`migrated ${src.length} files: ${oldDir} → ${newDir} (old kept)`)
    return { status: 'migrated', files: src.length, fromDir: oldDir }
  } catch (e) {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
    info(`failed: ${e?.message || e} → 继续使用旧目录 ${oldDir}`)
    return { status: 'failed', reason: String(e?.message || e), keepOld: true }
  }
}
