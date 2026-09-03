/**
描述: DSH 内核解析（C4-a）—— 双层 Runtime 的启动选择层。
职责: 决定本代 Host 用哪一份 DSH 运行闭包：
        - 内置只读回退：应用内 `Contents/Resources/dsh-runtime`（出厂版，永远可用）
        - 用户目录可切换：`<userData>/kernels/<ver>/` + `current.json`（经 MOYU 校验安装）
      校验激活内核（存在/完整标记/平台架构/壳兼容），并守护"失败内核不得反复阻塞启动"：
      上一代启动过某内核却从未确认健康（崩溃/卡死在 host-ready 前）→ 本代判其可疑，
      标记失败并降级到上一版或内置。
非职责: 不下载、不解压、不校验 SHA/签名（那是 C4-b 安装器）；不做兼容探针（C4-c）。
       本层只在"已安装内核"里做启动期选择与自愈降级。
契约: scope/plans/active/moyu-dsh-core-and-mod-platform-plan.md §2；D6 内核目录布局 / current.json。
*/
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const BUILTIN = 'builtin'
const CURRENT_VERSION = 1
const RUNTIME_COMPLETE_MARKER = '.complete.json'
const KERNEL_MANIFEST = 'manifest.json'

export function kernelsDir(userDataDir) {
  return join(userDataDir, 'kernels')
}
function currentFile(userDataDir) {
  return join(kernelsDir(userDataDir), 'current.json')
}
function kernelRoot(userDataDir, version) {
  return join(kernelsDir(userDataDir), version)
}

function emptyCurrent() {
  return { version: CURRENT_VERSION, active: null, previous: null, lastAttempt: null, healthy: [], failed: {} }
}

async function readCurrent(userDataDir) {
  try {
    const parsed = JSON.parse(await readFile(currentFile(userDataDir), 'utf8'))
    if (parsed && typeof parsed === 'object') {
      return {
        version: CURRENT_VERSION,
        active: typeof parsed.active === 'string' ? parsed.active : null,
        previous: typeof parsed.previous === 'string' ? parsed.previous : null,
        lastAttempt: parsed.lastAttempt && typeof parsed.lastAttempt.version === 'string' ? parsed.lastAttempt : null,
        healthy: Array.isArray(parsed.healthy) ? parsed.healthy.filter((v) => typeof v === 'string') : [],
        failed: parsed.failed && typeof parsed.failed === 'object' ? parsed.failed : {},
      }
    }
  } catch { /* 缺失/损坏 → 视为无激活内核，走内置 */ }
  return emptyCurrent()
}

async function writeCurrent(userDataDir, state) {
  const dir = kernelsDir(userDataDir)
  await mkdir(dir, { recursive: true })
  const file = currentFile(userDataDir)
  const tmp = `${file}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify({ ...state, version: CURRENT_VERSION }, null, 2), 'utf8')
  await rename(tmp, file)
}

/** 读某内核目录的 manifest（C4-b 安装时写入）。缺失/损坏 → null。 */
async function readManifest(userDataDir, version) {
  try {
    const parsed = JSON.parse(await readFile(join(kernelRoot(userDataDir, version), KERNEL_MANIFEST), 'utf8'))
    if (parsed && typeof parsed === 'object') return parsed
  } catch { /* fallthrough */ }
  return null
}

/**
 * 校验一份已安装内核是否可启动。返回 { ok, reason }。
 * 只做启动期校验：完整标记 + 平台/架构 + 壳兼容；不重算 SHA（安装时已校，见 C4-b）。
 */
function validateInstalledKernel({ root, manifest, platform, arch, shellVersion }) {
  if (!existsSync(root)) return { ok: false, reason: 'missing-dir' }
  if (!existsSync(join(root, RUNTIME_COMPLETE_MARKER))) return { ok: false, reason: 'incomplete' }
  if (!manifest) return { ok: false, reason: 'missing-manifest' }
  if (manifest.platform && manifest.platform !== platform) return { ok: false, reason: `platform-mismatch:${manifest.platform}` }
  if (manifest.arch && manifest.arch !== arch) return { ok: false, reason: `arch-mismatch:${manifest.arch}` }
  if (manifest.shellCompat && !satisfiesShell(shellVersion, manifest.shellCompat)) {
    return { ok: false, reason: `shell-incompat:${manifest.shellCompat}` }
  }
  return { ok: true, reason: 'ok' }
}

/**
 * 极简壳兼容判断：manifest.shellCompat 形如 ">=0.1.0" 或 "0.1.x" 或精确 "0.1.0"。
 * 仅支持 >= 与精确匹配与末段 x 通配，避免引入 semver 依赖；不满足语法则保守放行。
 */
export function satisfiesShell(shellVersion, range) {
  if (!range || typeof range !== 'string') return true
  const shell = parseVer(shellVersion)
  if (!shell) return true
  const trimmed = range.trim()
  if (trimmed.startsWith('>=')) {
    const min = parseVer(trimmed.slice(2).trim())
    return min ? cmpVer(shell, min) >= 0 : true
  }
  if (trimmed.includes('x')) {
    const [maj, min] = trimmed.split('.')
    return String(shell[0]) === maj && (min === 'x' || String(shell[1]) === min)
  }
  const exact = parseVer(trimmed)
  return exact ? cmpVer(shell, exact) === 0 : true
}
function parseVer(v) {
  if (typeof v !== 'string') return null
  const core = v.split('-')[0]
  const parts = core.split('.').map((n) => Number.parseInt(n, 10))
  if (parts.length < 1 || parts.some((n) => Number.isNaN(n))) return null
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}
function cmpVer(a, b) {
  for (let i = 0; i < 3; i += 1) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1 }
  return 0
}

function builtinDecision(builtinRoot, builtinVersion, reason) {
  return { root: builtinRoot, version: builtinVersion, source: BUILTIN, reason }
}

/**
 * 解析本代要启动的内核。返回 { root, version, source:'builtin'|'user', reason }。
 * 自愈：需要降级/标记失败时**会写 current.json**（幂等，temp 目录可测）。
 *
 * @param userDataDir  用户数据根（app.getPath('userData')）
 * @param builtinRoot  内置内核根（Contents/Resources/dsh-runtime 或 dev build/dsh-runtime）
 * @param builtinVersion 内置内核版本（来自 .complete.json dshVersion）
 * @param platform/arch/shellVersion  当前运行环境；now 便于测试
 * @param log  可选日志（只记路径/版本/原因，不含敏感内容）
 */
export async function resolveActiveKernel({ userDataDir, builtinRoot, builtinVersion, platform = process.platform, arch = process.arch, shellVersion, now = Date.now(), log = () => {} }) {
  const state = await readCurrent(userDataDir)
  let mutated = false

  // 上一代启动过某内核却从未确认健康 → 判其可疑，标记失败（崩溃/卡死自愈）。
  if (state.lastAttempt && state.lastAttempt.version && !state.healthy.includes(state.lastAttempt.version)) {
    const bad = state.lastAttempt.version
    state.failed[bad] = { reason: 'unhealthy-previous-boot', at: now }
    if (state.active === bad) { state.previous = state.active; state.active = null }
    state.lastAttempt = null
    mutated = true
    log(`[kernel] 上一代内核 ${bad} 未确认健康，标记失败并降级`)
  }

  // 依次尝试 active → previous，跳过已失败者；都不行 → 内置。
  for (const candidate of [state.active, state.previous]) {
    if (!candidate || candidate === BUILTIN) continue
    if (state.failed[candidate]) { log(`[kernel] 跳过已失败内核 ${candidate}`); continue }
    const root = kernelRoot(userDataDir, candidate)
    const manifest = await readManifest(userDataDir, candidate)
    const check = validateInstalledKernel({ root, manifest, platform, arch, shellVersion })
    if (!check.ok) {
      state.failed[candidate] = { reason: check.reason, at: now }
      if (state.active === candidate) state.active = null
      mutated = true
      log(`[kernel] 内核 ${candidate} 校验失败(${check.reason})，标记失败`)
      continue
    }
    // 选定：记录本次启动尝试（host-ready 后由 markKernelHealthy 确认）。
    state.active = candidate
    state.lastAttempt = { version: candidate, at: now }
    await writeCurrent(userDataDir, state)
    log(`[kernel] 启动用户内核 ${candidate}`)
    // version 是状态键（目录名，供 current.json/健康确认用）；dshVersion 供展示。
    return { root, version: candidate, dshVersion: manifest.dshVersion || candidate, source: 'user', reason: 'active' }
  }

  if (mutated) await writeCurrent(userDataDir, state)
  return builtinDecision(builtinRoot, builtinVersion, 'fallback-builtin')
}

/** host-ready 后调用：确认某内核本次启动健康，清 lastAttempt，避免下次被判可疑。 */
export async function markKernelHealthy({ userDataDir, version, log = () => {} }) {
  if (!version || version === BUILTIN) return
  const state = await readCurrent(userDataDir)
  if (!state.healthy.includes(version)) state.healthy.push(version)
  if (state.lastAttempt && state.lastAttempt.version === version) state.lastAttempt = null
  delete state.failed[version]
  await writeCurrent(userDataDir, state)
  log(`[kernel] 内核 ${version} 确认健康`)
}

/** 供 UI/诊断读取当前内核状态。纯读，不改盘。 */
export async function readKernelState({ userDataDir, builtinVersion }) {
  const state = await readCurrent(userDataDir)
  return {
    builtinVersion,
    active: state.active,
    previous: state.previous,
    healthy: state.healthy,
    failed: state.failed,
  }
}
