/**
C4-a DSH 内核解析验收（纯 Node）。
覆盖：无内核走内置 / 选定用户内核 / 平台架构不符拒绝 / 壳不兼容拒绝 /
      崩溃自愈（上一代未确认健康→降级）/ 健康确认后不再被判可疑 /
      失败内核不反复阻塞（跳过并回退）/ 损坏 current.json 安全走内置 / previous 回退。
*/
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  resolveActiveKernel, markKernelHealthy, readKernelState, satisfiesShell, kernelsDir, BUILTIN,
} from '../apps/desktop/main/dsh/kernel.js'

let passed = 0, failed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`) }
}

const BUILTIN_ROOT = '/app/Resources/dsh-runtime'
const BUILTIN_VERSION = '0.1.1-rc.2'
const ENV = { platform: 'darwin', arch: 'arm64', shellVersion: '0.1.0' }

async function installKernel(userDataDir, version, manifest = {}) {
  const root = join(kernelsDir(userDataDir), version)
  await mkdir(root, { recursive: true })
  await writeFile(join(root, '.complete.json'), JSON.stringify({ version: 1, dshVersion: version }))
  await writeFile(join(root, 'manifest.json'), JSON.stringify({
    version, dshVersion: version, platform: 'darwin', arch: 'arm64', shellCompat: '>=0.1.0', ...manifest,
  }))
  return root
}
async function writeCurrent(userDataDir, obj) {
  await mkdir(kernelsDir(userDataDir), { recursive: true })
  await writeFile(join(kernelsDir(userDataDir), 'current.json'), JSON.stringify({ version: 1, ...obj }))
}
async function readCurrent(userDataDir) {
  return JSON.parse(await readFile(join(kernelsDir(userDataDir), 'current.json'), 'utf8'))
}
const base = (userDataDir, extra = {}) => ({ userDataDir, builtinRoot: BUILTIN_ROOT, builtinVersion: BUILTIN_VERSION, ...ENV, now: 1000, ...extra })

console.log('\n=== C4-a 内核解析验收 ===\n')
let TMP
await test('准备临时根', async () => { TMP = await mkdtemp(join(tmpdir(), 'moyu-kernel-')) })

await test('无 kernels/ → 走内置', async () => {
  const ud = join(TMP, 't1'); await mkdir(ud, { recursive: true })
  const r = await resolveActiveKernel(base(ud))
  assert.equal(r.source, BUILTIN)
  assert.equal(r.root, BUILTIN_ROOT)
  assert.equal(r.version, BUILTIN_VERSION)
})

await test('损坏 current.json → 安全走内置', async () => {
  const ud = join(TMP, 't2'); await mkdir(kernelsDir(ud), { recursive: true })
  await writeFile(join(kernelsDir(ud), 'current.json'), '{ not json')
  const r = await resolveActiveKernel(base(ud))
  assert.equal(r.source, BUILTIN)
})

await test('已安装并激活 → 选定用户内核，写 lastAttempt', async () => {
  const ud = join(TMP, 't3')
  const root = await installKernel(ud, '0.1.2')
  await writeCurrent(ud, { active: '0.1.2' })
  const r = await resolveActiveKernel(base(ud))
  assert.equal(r.source, 'user')
  assert.equal(r.root, root)
  const cur = await readCurrent(ud)
  assert.equal(cur.lastAttempt.version, '0.1.2', '应记录启动尝试')
})

await test('平台不符 → 拒绝并标记失败，回退内置', async () => {
  const ud = join(TMP, 't4')
  await installKernel(ud, '0.1.2', { platform: 'win32' })
  await writeCurrent(ud, { active: '0.1.2' })
  const r = await resolveActiveKernel(base(ud))
  assert.equal(r.source, BUILTIN)
  const cur = await readCurrent(ud)
  assert.ok(cur.failed['0.1.2'], '应标记失败')
  assert.match(cur.failed['0.1.2'].reason, /platform/)
})

await test('壳不兼容 → 拒绝，回退内置', async () => {
  const ud = join(TMP, 't5')
  await installKernel(ud, '0.1.2', { shellCompat: '>=9.0.0' })
  await writeCurrent(ud, { active: '0.1.2' })
  const r = await resolveActiveKernel(base(ud))
  assert.equal(r.source, BUILTIN)
  const cur = await readCurrent(ud)
  assert.match(cur.failed['0.1.2'].reason, /shell-incompat/)
})

await test('崩溃自愈: 上一代启动未确认健康 → 标记失败并降级内置', async () => {
  const ud = join(TMP, 't6')
  await installKernel(ud, '0.1.2')
  // 模拟上一代：active=0.1.2, lastAttempt=0.1.2, 但从未进 healthy（崩溃在 host-ready 前）
  await writeCurrent(ud, { active: '0.1.2', lastAttempt: { version: '0.1.2', at: 500 }, healthy: [] })
  const r = await resolveActiveKernel(base(ud))
  assert.equal(r.source, BUILTIN, '可疑内核应降级')
  const cur = await readCurrent(ud)
  assert.equal(cur.failed['0.1.2'].reason, 'unhealthy-previous-boot')
})

await test('健康确认后再启动 → 不被判可疑，正常选用', async () => {
  const ud = join(TMP, 't7')
  await installKernel(ud, '0.1.2')
  await writeCurrent(ud, { active: '0.1.2' })
  // 第一代：选用并记录 lastAttempt
  await resolveActiveKernel(base(ud))
  // host-ready：确认健康
  await markKernelHealthy({ userDataDir: ud, version: '0.1.2' })
  // 第二代启动：应仍选用（healthy 里有它，lastAttempt 已清）
  const r2 = await resolveActiveKernel(base(ud, { now: 2000 }))
  assert.equal(r2.source, 'user')
  assert.equal(r2.version, '0.1.2')
})

await test('失败内核不反复阻塞: 有 previous 时降级到 previous', async () => {
  const ud = join(TMP, 't8')
  await installKernel(ud, '0.1.3') // 坏：平台不符
  await rm(join(kernelsDir(ud), '0.1.3', 'manifest.json'))
  await writeFile(join(kernelsDir(ud), '0.1.3', 'manifest.json'), JSON.stringify({ version: '0.1.3', platform: 'win32', arch: 'arm64' }))
  const prevRoot = await installKernel(ud, '0.1.2') // 好
  await markKernelHealthy({ userDataDir: ud, version: '0.1.2' }) // previous 曾健康
  await writeCurrent(ud, { active: '0.1.3', previous: '0.1.2', healthy: ['0.1.2'] })
  const r = await resolveActiveKernel(base(ud))
  assert.equal(r.source, 'user')
  assert.equal(r.root, prevRoot, '应降级到 previous 好内核')
  const cur = await readCurrent(ud)
  assert.ok(cur.failed['0.1.3'], '坏内核标记失败')
})

await test('缺完整标记 (.complete.json) → 视为未完成安装，拒绝', async () => {
  const ud = join(TMP, 't9')
  const root = join(kernelsDir(ud), '0.1.2'); await mkdir(root, { recursive: true })
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ version: '0.1.2', platform: 'darwin', arch: 'arm64' }))
  await writeCurrent(ud, { active: '0.1.2' })
  const r = await resolveActiveKernel(base(ud))
  assert.equal(r.source, BUILTIN)
  const cur = await readCurrent(ud)
  assert.equal(cur.failed['0.1.2'].reason, 'incomplete')
})

await test('readKernelState 汇报当前状态', async () => {
  const ud = join(TMP, 't10')
  await installKernel(ud, '0.1.2')
  await writeCurrent(ud, { active: '0.1.2', healthy: ['0.1.2'] })
  const st = await readKernelState({ userDataDir: ud, builtinVersion: BUILTIN_VERSION })
  assert.equal(st.active, '0.1.2')
  assert.equal(st.builtinVersion, BUILTIN_VERSION)
})

await test('satisfiesShell: >= / x 通配 / 精确 / 非法保守放行', () => {
  assert.equal(satisfiesShell('0.1.0', '>=0.1.0'), true)
  assert.equal(satisfiesShell('0.0.9', '>=0.1.0'), false)
  assert.equal(satisfiesShell('0.1.5', '0.1.x'), true)
  assert.equal(satisfiesShell('0.2.0', '0.1.x'), false)
  assert.equal(satisfiesShell('0.1.0', '0.1.0'), true)
  assert.equal(satisfiesShell('0.1.0', 'garbage'), true)
})

await test('清理', async () => { await rm(TMP, { recursive: true, force: true }) })

console.log(`\n${failed === 0 ? '✅' : '❌'} 通过 ${passed} / 失败 ${failed}\n`)
process.exit(failed === 0 ? 0 : 1)
