/**
描述: MOYU DSH Mod（可安装插件）基础设施 — C1。
主要功能:
    - Manifest 校验（C1-a）
    - Mod 注册表读写与 install/enable/disable/uninstall 状态机（C1-b）
    - composition 生成：把已启用 Mod 追加进 profile 的 cordis insert 列表（C1-c）
    - 兼容检查：shell / kernel / platform（C1-e）
    - 诊断：列出 Mod 状态与加载兼容结果（C1-h）
设计: 纯逻辑 + fs，不 import electron；路径由调用方（host.js）注入，便于 harness 独立测。
契约: scope/plans/active/moyu-dsh-core-mod-contract.md §2。架构: moyu-dsh-c1-plugin-infra-plan.md（A1/A2/A3）。
*/

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile, rename, readdir, stat, cp } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import YAML from 'yaml'

export const REGISTRY_VERSION = 1
const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
// 允许的核心能力名（Mod 只能声明这些）。与契约 §2.1 requires.core 对齐。
export const CORE_CAPABILITIES = new Set([
  'screen-capture', 'file-token', 'credentials', 'clipboard',
  'host-route', 'client-slot', 'settings', 'scheduler',
])
const KNOWN_PLATFORMS = new Set(['darwin', 'win32', 'linux'])

//#region C1-a Manifest 校验

/**
校验 Mod manifest。返回 { ok, errors, manifest }。
必备: id, version, displayName, author, provides；requires/permissions/platforms 可选但类型受限。
*/
export function validateManifest(raw) {
  const errors = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['manifest 不是对象'], manifest: null }
  const m = raw

  if (typeof m.id !== 'string' || !ID_RE.test(m.id)) errors.push('id 非法（需小写字母/数字/短横线，2-64 位）')
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) errors.push('version 非法（需 semver）')
  if (typeof m.displayName !== 'string' || !m.displayName.trim()) errors.push('displayName 缺失')
  if (typeof m.author !== 'string' || !m.author.trim()) errors.push('author 缺失')

  const requires = m.requires ?? {}
  if (typeof requires !== 'object') errors.push('requires 必须是对象')
  else {
    if (requires.core !== undefined) {
      if (!Array.isArray(requires.core)) errors.push('requires.core 必须是数组')
      else for (const c of requires.core) {
        if (typeof c !== 'string' || !CORE_CAPABILITIES.has(c)) errors.push(`requires.core 含未知能力: ${c}`)
      }
    }
    if (requires.shell !== undefined && typeof requires.shell !== 'string') errors.push('requires.shell 必须是字符串（版本范围）')
    if (requires.kernel !== undefined && typeof requires.kernel !== 'string') errors.push('requires.kernel 必须是字符串（版本范围）')
  }

  const provides = m.provides ?? {}
  if (typeof provides !== 'object') errors.push('provides 必须是对象')
  // provides 至少声明一个 cordis 插件包名，供 composition 注入
  if (!Array.isArray(provides.plugins) || provides.plugins.length === 0) {
    errors.push('provides.plugins 必须是非空数组（cordis 插件条目 { id, name }）')
  } else {
    for (const p of provides.plugins) {
      if (!p || typeof p !== 'object' || typeof p.id !== 'string' || typeof p.name !== 'string') {
        errors.push('provides.plugins 每项需 { id, name }')
        break
      }
    }
  }

  if (m.permissions !== undefined && !Array.isArray(m.permissions)) errors.push('permissions 必须是数组')
  if (m.platforms !== undefined) {
    if (!Array.isArray(m.platforms)) errors.push('platforms 必须是数组')
    else for (const p of m.platforms) {
      if (typeof p !== 'string' || !KNOWN_PLATFORMS.has(p)) errors.push(`platforms 含未知平台: ${p}`)
    }
  }

  return { ok: errors.length === 0, errors, manifest: errors.length === 0 ? m : null }
}

//#endregion

//#region C1-e 兼容检查

/** 极简 semver 范围匹配：支持精确、`>=x.y.z`、`*`/空（任意）。C1 够用，后续可换真 semver 库。 */
function versionSatisfies(version, range) {
  if (!range || range === '*' || range === '') return true
  if (typeof version !== 'string') return false
  const cmp = (a, b) => {
    const pa = a.split('-')[0].split('.').map(Number)
    const pb = b.split('-')[0].split('.').map(Number)
    for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0) }
    return 0
  }
  const m = range.match(/^>=\s*(\d+\.\d+\.\d+.*)$/)
  if (m) return cmp(version, m[1]) >= 0
  return version === range
}

/**
检查 manifest 与当前环境兼容。env: { shellVersion, kernelVersion, platform, arch }。
返回 { ok, reasons }。
*/
export function checkCompat(manifest, env) {
  const reasons = []
  const req = manifest.requires ?? {}
  if (!versionSatisfies(env.shellVersion, req.shell)) reasons.push(`需要壳版本 ${req.shell}，当前 ${env.shellVersion}`)
  if (!versionSatisfies(env.kernelVersion, req.kernel)) reasons.push(`需要内核版本 ${req.kernel}，当前 ${env.kernelVersion}`)
  if (Array.isArray(manifest.platforms) && manifest.platforms.length > 0 && !manifest.platforms.includes(env.platform)) {
    reasons.push(`不支持平台 ${env.platform}（支持 ${manifest.platforms.join(', ')}）`)
  }
  return { ok: reasons.length === 0, reasons }
}

//#endregion

//#region C1-b 注册表

function emptyRegistry() {
  return { version: REGISTRY_VERSION, mods: {} }
}

/** 读注册表；不存在或损坏则返回空注册表（不抛，避免阻塞启动）。 */
export async function readRegistry(modsDir) {
  const file = join(modsDir, 'registry.json')
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || typeof parsed.mods !== 'object') return emptyRegistry()
    return { version: parsed.version ?? REGISTRY_VERSION, mods: parsed.mods }
  } catch {
    return emptyRegistry()
  }
}

/** 原子写注册表。 */
export async function writeRegistry(modsDir, registry) {
  await mkdir(modsDir, { recursive: true })
  const file = join(modsDir, 'registry.json')
  const tmp = `${file}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(registry, null, 2), 'utf8')
  await rename(tmp, file)
}

async function sha256Dir(dir) {
  // 对 package/ 下所有文件做稳定哈希（路径排序 + 内容），作完整性标记。
  const hash = createHash('sha256')
  const walk = async (d, rel) => {
    let entries
    try { entries = await readdir(d, { withFileTypes: true }) } catch { return }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entries) {
      const full = join(d, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) await walk(full, r)
      else if (e.isFile()) { hash.update(r); hash.update(await readFile(full)) }
    }
  }
  await walk(dir, '')
  return hash.digest('hex')
}

/**
C1-d 从本地包目录安装 Mod 到 modsDir/<id>/。
srcPackageDir 内需含 manifest.json 与 package/。返回 { ok, id, error }。
*/
export async function installFromDir(modsDir, srcPackageDir, env) {
  let manifestRaw
  try {
    manifestRaw = JSON.parse(await readFile(join(srcPackageDir, 'manifest.json'), 'utf8'))
  } catch (e) {
    return { ok: false, error: `读取 manifest 失败: ${e.message}` }
  }
  const v = validateManifest(manifestRaw)
  if (!v.ok) return { ok: false, error: `manifest 非法: ${v.errors.join('; ')}` }
  const manifest = v.manifest
  if (env) {
    const c = checkCompat(manifest, env)
    if (!c.ok) return { ok: false, error: `不兼容: ${c.reasons.join('; ')}` }
  }
  if (!existsSync(join(srcPackageDir, 'package'))) return { ok: false, error: '缺少 package/ 目录' }

  const dest = join(modsDir, manifest.id)
  await rm(dest, { recursive: true, force: true })
  await mkdir(dest, { recursive: true })
  const { cp } = await import('node:fs/promises')
  await cp(join(srcPackageDir, 'manifest.json'), join(dest, 'manifest.json'))
  await cp(join(srcPackageDir, 'package'), join(dest, 'package'), { recursive: true })
  const sha256 = await sha256Dir(join(dest, 'package'))
  await writeFile(join(dest, 'INSTALLED'), sha256, 'utf8')

  const registry = await readRegistry(modsDir)
  registry.mods[manifest.id] = {
    id: manifest.id,
    version: manifest.version,
    displayName: manifest.displayName,
    enabled: true, // 安装默认启用（A2：重启生效）
    installedAt: Date.now(),
    sha256,
    plugins: manifest.provides.plugins,
    permissions: manifest.permissions ?? [],
  }
  await writeRegistry(modsDir, registry)
  return { ok: true, id: manifest.id }
}

export async function setEnabled(modsDir, id, enabled) {
  const registry = await readRegistry(modsDir)
  if (!registry.mods[id]) return { ok: false, error: `未安装: ${id}` }
  registry.mods[id].enabled = !!enabled
  await writeRegistry(modsDir, registry)
  return { ok: true, id, enabled: !!enabled }
}

/** C1-g 卸载：删 mods/<id> + 注册表项。幂等。 */
export async function uninstall(modsDir, id) {
  const registry = await readRegistry(modsDir)
  delete registry.mods[id]
  await writeRegistry(modsDir, registry)
  await rm(join(modsDir, id), { recursive: true, force: true })
  return { ok: true, id }
}

/**
C2-b 出厂预装 Mod 播种：把 preinstalledDir 下的 Mod 复制进 modsDir 并注册（默认启用）。
- 用 `.seeded.json` 按 id→version 记账：同版本只播种一次，尊重用户此后 disable/uninstall（不复活）。
- 新版本（app 升级带来更高 Mod 版本）会重新播种（视为更新）。
返回 { seeded: [id], skipped: [...] }。
*/
export async function seedPreinstalledMods({ preinstalledDir, modsDir, env }) {
  const result = { seeded: [], skipped: [] }
  if (!existsSync(preinstalledDir)) return result
  await mkdir(modsDir, { recursive: true })
  const seededFile = join(modsDir, '.seeded.json')
  let seeded = {}
  try { seeded = JSON.parse(await readFile(seededFile, 'utf8')) } catch { seeded = {} }

  let entries = []
  try { entries = await readdir(preinstalledDir, { withFileTypes: true }) } catch { return result }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const srcMod = join(preinstalledDir, e.name)
    let manifest
    try { manifest = JSON.parse(await readFile(join(srcMod, 'manifest.json'), 'utf8')) } catch { continue }
    if (seeded[manifest.id] === manifest.version) { result.skipped.push(manifest.id); continue }
    const r = await installFromDir(modsDir, srcMod, env)
    if (r.ok) { seeded[manifest.id] = manifest.version; result.seeded.push(manifest.id) }
    else result.skipped.push(`${manifest.id}: ${r.error}`)
  }
  const tmp = `${seededFile}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(seeded, null, 2))
  await rename(tmp, seededFile)
  return result
}

//#endregion

//#region C1-c composition 生成

/**
把已启用 Mod 追加进 profile 的 cordis insert 列表。
- 解析 patchYaml（YAML 文档数组）
- 找到 `insert` 条目，向其数组追加已启用 Mod 的 provides.plugins（去重：同 id 不重复）
- core/业务原有条目原样保留（C1 不动静态 patch 里的既有插件）
返回新 patch 文本。
*/
export function composeInsert(patchYaml, registry) {
  const doc = YAML.parse(patchYaml)
  if (!Array.isArray(doc)) throw new Error('cordis.patch.yml 顶层不是数组')
  const insertNode = doc.find((n) => n && typeof n === 'object' && Array.isArray(n.insert))
  if (!insertNode) throw new Error('cordis.patch.yml 缺少 insert 列表')

  const existingIds = new Set(insertNode.insert.map((e) => e && e.id).filter(Boolean))
  const enabled = Object.values(registry.mods).filter((m) => m.enabled)
  for (const mod of enabled) {
    for (const plugin of mod.plugins ?? []) {
      if (existingIds.has(plugin.id)) continue
      insertNode.insert.push({ id: plugin.id, name: plugin.name })
      existingIds.add(plugin.id)
    }
  }
  return YAML.stringify(doc)
}

/**
把已启用 Mod 应用到一个 profile 目录（compose patch + 复制 package 进 node_modules）。
纯路径参数，供 host 与 harness 共用。返回 { linked: [{id,name}], skipped: [...] }。
- 空注册表：no-op（返回空），不改 patch。
- 失败隔离：单个 Mod 复制失败记入 skipped，不抛。

为何是复制而非软链：cordis-plugin-loader 从插件“所在目录”按 realpath 向上解析 peer
依赖（cordis / dsh-host-webserver 等）。软链的 realpath 指回 mods/<id>/，解析不到 profile
闭包里的 peer 依赖；复制进 profile/node_modules 后，向上解析即命中闭包。Mod 若自带
非闭包依赖，则打包时放进自己的 package/node_modules（就近解析优先）。
*/
export async function applyModsToProfile({ modsDir, profileDir }) {
  const registry = await readRegistry(modsDir)
  const enabled = Object.values(registry.mods).filter((m) => m.enabled)
  const result = { linked: [], skipped: [] }
  if (enabled.length === 0) return result

  const patchPath = join(profileDir, 'cordis.patch.yml')
  const patch = await readFile(patchPath, 'utf8')
  await writeFile(patchPath, composeInsert(patch, registry))

  for (const mod of enabled) {
    for (const plugin of mod.plugins ?? []) {
      try {
        const pkgSrc = join(modsDir, mod.id, 'package')
        if (!existsSync(pkgSrc)) { result.skipped.push({ id: mod.id, name: plugin.name, reason: 'package 缺失' }); continue }
        const dest = join(profileDir, 'node_modules', ...plugin.name.split('/'))
        await rm(dest, { recursive: true, force: true })
        await mkdir(join(dest, '..'), { recursive: true })
        await cp(pkgSrc, dest, { recursive: true, dereference: true })
        result.linked.push({ id: mod.id, name: plugin.name })
      } catch (e) {
        result.skipped.push({ id: mod.id, name: plugin.name, reason: e.message })
      }
    }
  }
  return result
}

//#endregion

//#region C1-h 诊断

/**
列出已装 Mod 的状态 + 兼容结果 + 完整性。env 用于兼容判定。
返回 [{ id, version, enabled, compatible, reasons, integrity }]。
*/
export async function diagnostics(modsDir, env) {
  const registry = await readRegistry(modsDir)
  const out = []
  for (const mod of Object.values(registry.mods)) {
    let integrity = 'unknown'
    const installedFile = join(modsDir, mod.id, 'INSTALLED')
    if (existsSync(installedFile)) {
      try {
        const recorded = (await readFile(installedFile, 'utf8')).trim()
        const actual = await sha256Dir(join(modsDir, mod.id, 'package'))
        integrity = recorded === actual ? 'ok' : 'tampered'
      } catch { integrity = 'error' }
    } else {
      integrity = 'missing'
    }
    // 兼容性用注册表里存的 plugins 无法完整判定 shell/kernel（需 manifest），
    // 这里读回 manifest 做判定；读不到则标 unknown。
    let compatible = true
    let reasons = []
    try {
      const manifest = JSON.parse(await readFile(join(modsDir, mod.id, 'manifest.json'), 'utf8'))
      const c = checkCompat(manifest, env)
      compatible = c.ok
      reasons = c.reasons
    } catch {
      compatible = false
      reasons = ['manifest 读取失败']
    }
    out.push({ id: mod.id, version: mod.version, enabled: !!mod.enabled, compatible, reasons, integrity })
  }
  return out
}

//#endregion
