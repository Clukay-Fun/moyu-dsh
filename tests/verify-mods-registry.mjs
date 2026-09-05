/**
C1 Mod 基础设施验收（纯 Node，无 Electron）。
覆盖: manifest 校验、兼容检查、本地安装、composition 生成、启停、卸载无残留、诊断。
*/
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  validateManifest, checkCompat, readRegistry, installFromDir,
  setEnabled, uninstall, composeInsert, diagnostics,
  buildEffectiveToolPolicy, auditGlobalToolSurface, CORE_BUILTIN_TOOLS,
} from '../apps/desktop/main/dsh/mods.js'

let passed = 0, failed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`) }
}

const ENV = { shellVersion: '0.1.0', kernelVersion: '0.1.1-rc.2', platform: 'darwin', arch: 'arm64' }

const GOOD_MANIFEST = {
  id: 'moyu-demo',
  version: '1.0.0',
  displayName: 'Demo Mod',
  author: 'Clukay',
  requires: { core: ['host-route', 'client-slot'], shell: '>=0.1.0', kernel: '*' },
  provides: { plugins: [{ id: 'moyu-demo', name: '@moyu/dsh-plugin-demo' }] },
  permissions: ['file-token'],
  platforms: ['darwin', 'win32'],
}

// 最小可用的 cordis.patch.yml（含 insert 列表 + 既有条目）
const BASE_PATCH = `- id: agent-presets
  config:
    default: moyu
- insert:
    - id: moyu-credentials-desktop
      name: '@moyu/dsh-credentials-desktop'
    - id: moyu-image
      name: '@moyu/dsh-plugin-image'
`

async function makeSrc(base, manifest) {
  const src = join(base, 'src-demo')
  await mkdir(join(src, 'package', 'lib'), { recursive: true })
  await writeFile(join(src, 'manifest.json'), JSON.stringify(manifest))
  await writeFile(join(src, 'package', 'lib', 'index.mjs'), 'export const name = "demo"\n')
  return src
}

console.log('\n=== C1 Mod 基础设施验收 ===\n')

console.log('Manifest 校验:')
await test('合法 manifest 通过', () => {
  const r = validateManifest(GOOD_MANIFEST)
  assert.ok(r.ok, r.errors.join('; '))
})
await test('缺 provides.plugins 拒绝', () => {
  const r = validateManifest({ ...GOOD_MANIFEST, provides: {} })
  assert.ok(!r.ok)
  assert.ok(r.errors.some((e) => e.includes('provides.plugins')))
})
await test('非法 id / version 拒绝', () => {
  assert.ok(!validateManifest({ ...GOOD_MANIFEST, id: 'Bad ID' }).ok)
  assert.ok(!validateManifest({ ...GOOD_MANIFEST, version: 'x.y' }).ok)
})
await test('未知 core 能力拒绝', () => {
  const r = validateManifest({ ...GOOD_MANIFEST, requires: { core: ['root-shell'] } })
  assert.ok(!r.ok)
})
await test('C2-g: provides.tools 合法（带 preset 作用域）通过', () => {
  const r = validateManifest({ ...GOOD_MANIFEST, provides: {
    plugins: GOOD_MANIFEST.provides.plugins,
    tools: [{ name: 'image_convert', presets: ['moyu', 'media'], required: true }],
  } })
  assert.ok(r.ok, r.errors.join('; '))
})
await test('C2-g: provides.tools 缺 presets 拒绝', () => {
  const r = validateManifest({ ...GOOD_MANIFEST, provides: {
    plugins: GOOD_MANIFEST.provides.plugins,
    tools: [{ name: 'image_convert' }],
  } })
  assert.ok(!r.ok)
  assert.ok(r.errors.some((e) => e.includes('presets')))
})
await test('C2-g: provides.tools 空数组允许（无 Tool 的 Mod）', () => {
  const r = validateManifest({ ...GOOD_MANIFEST, provides: {
    plugins: GOOD_MANIFEST.provides.plugins, tools: [],
  } })
  assert.ok(r.ok, r.errors.join('; '))
})

const toolsManifest = (tools) => ({ ...GOOD_MANIFEST, provides: { plugins: GOOD_MANIFEST.provides.plugins, tools } })
await test('C2-g1b: 保留名 run_code 拒绝', () => {
  assert.ok(!validateManifest(toolsManifest([{ name: 'run_code', presets: ['moyu'] }])).ok)
})
await test('C2-g1b: 非法 Tool 名拒绝', () => {
  assert.ok(!validateManifest(toolsManifest([{ name: 'Image-Convert', presets: ['moyu'] }])).ok)
})
await test('C2-g1b: 未知 policy surface 拒绝', () => {
  const r = validateManifest(toolsManifest([{ name: 'x_tool', presets: ['chatgpt'] }]))
  assert.ok(!r.ok && r.errors.some((e) => e.includes('policy surface')))
})
await test('C2-g1b: 同 Manifest 重复 Tool 名拒绝', () => {
  const r = validateManifest(toolsManifest([{ name: 'x_tool', presets: ['moyu'] }, { name: 'x_tool', presets: ['media'] }]))
  assert.ok(!r.ok && r.errors.some((e) => e.includes('重复 Tool')))
})
await test('C2-g1b: presets 内重复拒绝', () => {
  const r = validateManifest(toolsManifest([{ name: 'x_tool', presets: ['moyu', 'moyu'] }]))
  assert.ok(!r.ok)
})
await test('C2-g1b: required:false v1 拒绝', () => {
  const r = validateManifest(toolsManifest([{ name: 'x_tool', presets: ['moyu'], required: false }]))
  assert.ok(!r.ok && r.errors.some((e) => e.includes('required')))
})
await test('C2-g1b: required 省略等价 true（允许）', () => {
  assert.ok(validateManifest(toolsManifest([{ name: 'x_tool', presets: ['moyu'] }])).ok)
})
await test('C2-g1b: 真实 mod.json（image/pdf）仍合法', async () => {
  const { readFile } = await import('node:fs/promises')
  const ROOT = new URL('..', import.meta.url).pathname
  // session-export 已改回内置系统功能（单一工作台），无 mod.json；image/pdf 仍为 Mod。
  for (const dir of ['dsh-plugin-image', 'dsh-plugin-pdf']) {
    const mj = JSON.parse(await readFile(join(ROOT, 'packages', dir, 'mod.json'), 'utf8'))
    const r = validateManifest({ ...mj, version: '0.0.0' })
    assert.ok(r.ok, `${dir}: ${r.errors.join('; ')}`)
  }
})

console.log('\n兼容检查:')
await test('shell/kernel/platform 满足则兼容', () => {
  assert.ok(checkCompat(GOOD_MANIFEST, ENV).ok)
})
await test('shell 版本不足拒绝', () => {
  const c = checkCompat({ ...GOOD_MANIFEST, requires: { shell: '>=9.0.0' } }, ENV)
  assert.ok(!c.ok && c.reasons.length > 0)
})
await test('平台不支持拒绝', () => {
  const c = checkCompat({ ...GOOD_MANIFEST, platforms: ['win32'] }, ENV)
  assert.ok(!c.ok)
})

console.log('\n安装 / 启停 / 卸载:')
let TMP
await test('安装闭环: install → 注册表 + 文件 + INSTALLED', async () => {
  TMP = await mkdtemp(join(tmpdir(), 'moyu-mods-'))
  const modsDir = join(TMP, 'mods')
  const src = await makeSrc(TMP, GOOD_MANIFEST)
  const r = await installFromDir(modsDir, src, ENV)
  assert.ok(r.ok, r.error)
  assert.equal(r.id, 'moyu-demo')
  const reg = await readRegistry(modsDir)
  assert.ok(reg.mods['moyu-demo'])
  assert.equal(reg.mods['moyu-demo'].enabled, true)
  assert.ok(existsSync(join(modsDir, 'moyu-demo', 'INSTALLED')))
  assert.ok(existsSync(join(modsDir, 'moyu-demo', 'package', 'lib', 'index.mjs')))
})

await test('不兼容的包安装被拒绝', async () => {
  const modsDir = join(TMP, 'mods')
  const src = await makeSrc(TMP, { ...GOOD_MANIFEST, id: 'moyu-bad', platforms: ['win32'] })
  const r = await installFromDir(modsDir, src, ENV)
  assert.ok(!r.ok)
  assert.ok(/不兼容/.test(r.error))
})

console.log('\ncomposition 生成:')
await test('已启用 Mod 追加进 insert，既有条目保留', async () => {
  const modsDir = join(TMP, 'mods')
  const reg = await readRegistry(modsDir)
  const out = composeInsert(BASE_PATCH, reg)
  assert.ok(out.includes('@moyu/dsh-plugin-demo'), '应含 Mod 插件')
  assert.ok(out.includes('@moyu/dsh-credentials-desktop'), '核心应保留')
  assert.ok(out.includes('@moyu/dsh-plugin-image'), '既有业务应保留')
})
await test('disable 后不再进 composition', async () => {
  const modsDir = join(TMP, 'mods')
  await setEnabled(modsDir, 'moyu-demo', false)
  const reg = await readRegistry(modsDir)
  const out = composeInsert(BASE_PATCH, reg)
  assert.ok(!out.includes('@moyu/dsh-plugin-demo'), 'disable 后不应出现')
  assert.ok(out.includes('@moyu/dsh-credentials-desktop'), '核心仍在')
})
await test('enable 恢复；compose 幂等不重复', async () => {
  const modsDir = join(TMP, 'mods')
  await setEnabled(modsDir, 'moyu-demo', true)
  const reg = await readRegistry(modsDir)
  const out = composeInsert(BASE_PATCH, reg)
  const count = (out.match(/@moyu\/dsh-plugin-demo/g) || []).length
  assert.equal(count, 1, '不应重复注入')
})

console.log('\n卸载无残留 + 诊断:')
await test('诊断报告状态与完整性', async () => {
  const modsDir = join(TMP, 'mods')
  const diag = await diagnostics(modsDir, ENV)
  const demo = diag.find((d) => d.id === 'moyu-demo')
  assert.ok(demo)
  assert.equal(demo.integrity, 'ok')
  assert.equal(demo.compatible, true)
})
await test('卸载后 mods/<id> 与注册表项清空；核心 composition 仍完整', async () => {
  const modsDir = join(TMP, 'mods')
  await uninstall(modsDir, 'moyu-demo')
  const reg = await readRegistry(modsDir)
  assert.ok(!reg.mods['moyu-demo'], '注册表项应删除')
  assert.ok(!existsSync(join(modsDir, 'moyu-demo')), '目录应删除')
  // 核心不带该 Mod 仍能生成合法 composition
  const out = composeInsert(BASE_PATCH, reg)
  assert.ok(out.includes('@moyu/dsh-credentials-desktop'), '核心仍可 compose')
  assert.ok(!out.includes('@moyu/dsh-plugin-demo'))
})
await test('卸载幂等（再卸不报错）', async () => {
  const modsDir = join(TMP, 'mods')
  const r = await uninstall(modsDir, 'moyu-demo')
  assert.ok(r.ok)
})

console.log('\nC2-g 第一层：策略生成 + 全局审计:')
await test('g2b: 纯核心（无 Mod）→ globalExpected=核心内置、owner 全 core', () => {
  const p = buildEffectiveToolPolicy([])
  assert.deepEqual(p.globalExpected, [...CORE_BUILTIN_TOOLS].sort())
  assert.ok(p.globalExpected.every((n) => p.owners[n] === 'core'))
  assert.equal(p.activeMods.length, 0)
})
await test('g2b: 迁移未完成——Mod 声明的 Tool 仍在核心台账 → 冲突抛错', () => {
  // screenshot_capture 是内置系统功能，始终在 CORE_BUILTIN_TOOLS；某 Mod 若声明它 → 必须报错
  assert.throws(() => buildEffectiveToolPolicy([
    { id: 'some-mod', version: '0.0.0', provides: { tools: [{ name: 'screenshot_capture' }] } },
  ]), /核心内置台账冲突/)
})
await test('g2b: 迁移完成——核心台账去掉后，Mod 接管 Tool，owner=mod', () => {
  const core = CORE_BUILTIN_TOOLS.filter((n) => n !== 'image_convert')
  const p = buildEffectiveToolPolicy([
    { id: 'moyu-image', version: '0.0.0', provides: { tools: [{ name: 'image_convert' }] } },
  ], core)
  assert.equal(p.owners['image_convert'], 'mod:moyu-image')
  assert.ok(p.globalExpected.includes('image_convert'))
})
await test('g2b: 两个 Mod 声明同名 Tool → 冲突抛错', () => {
  const core = CORE_BUILTIN_TOOLS.filter((n) => n !== 'image_convert')
  assert.throws(() => buildEffectiveToolPolicy([
    { id: 'mod-a', version: '1.0.0', provides: { tools: [{ name: 'image_convert' }] } },
    { id: 'mod-b', version: '1.0.0', provides: { tools: [{ name: 'image_convert' }] } },
  ], core), /被多个 Mod 声明/)
})
await test('g2b: 全局审计——实际==期望则 ok', () => {
  const p = buildEffectiveToolPolicy([])
  const r = auditGlobalToolSurface([...CORE_BUILTIN_TOOLS], p)
  assert.ok(r.ok, JSON.stringify(r))
})
await test('g2b: 全局审计——多出未声明 Tool → 漂移(not ok)', () => {
  const p = buildEffectiveToolPolicy([])
  const r = auditGlobalToolSurface([...CORE_BUILTIN_TOOLS, 'sneaky_tool'], p)
  assert.ok(!r.ok && r.undeclared.includes('sneaky_tool'))
})
await test('g2b: 全局审计——缺声明 Tool → fail(not ok)', () => {
  const p = buildEffectiveToolPolicy([])
  const r = auditGlobalToolSurface(CORE_BUILTIN_TOOLS.filter((n) => n !== 'screenshot_capture'), p)
  assert.ok(!r.ok && r.missing.includes('screenshot_capture'))
})

if (TMP) await rm(TMP, { recursive: true, force: true })

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed === 0 ? 0 : 1)
