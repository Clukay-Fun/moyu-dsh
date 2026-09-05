/**
C1 host 集成验收：Mod 真实装载链路（compose + 软链 + 可 import 加载）。
不启 Electron，直接验 applyModsToProfile 的load-bearing 行为——它就是 host.js
ensureProfile 每次启动调用的同一函数。

关键前提（与生产一致）：ensureProfile 每次启动会先把纯净 cordis.patch.yml 从模板
拷回 profileDir，再 applyModsToProfile。因此 composeInsert 是“在纯净 patch 上追加”，
本测试在每次 apply 前把 patch 重置为 BASE 来还原这一行为。
*/
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { installFromDir, setEnabled, uninstall, applyModsToProfile } from '../apps/desktop/main/dsh/mods.js'

let passed = 0, failed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`) }
}

const ENV = { shellVersion: '0.1.0', kernelVersion: '0.1.1-rc.2', platform: process.platform, arch: process.arch }

const BASE_PATCH = `- id: agent-presets
  config:
    default: moyu
- insert:
    - id: moyu-credentials-desktop
      name: '@moyu/dsh-credentials-desktop'
    - id: moyu-image
      name: '@moyu/dsh-plugin-image'
`

const MANIFEST = {
  id: 'moyu-demo',
  version: '1.0.0',
  displayName: 'Demo Mod',
  author: 'Clukay',
  requires: { core: ['host-route'], shell: '>=0.1.0', kernel: '*' },
  provides: { plugins: [{ id: 'moyu-demo', name: '@moyu/dsh-plugin-demo' }] },
  platforms: [process.platform],
}

let TMP, modsDir, profileDir
const patchPath = () => join(profileDir, 'cordis.patch.yml')
async function resetPatch() { await writeFile(patchPath(), BASE_PATCH, 'utf8') }

console.log('\n=== C1 host 集成：Mod 真实装载链路 ===\n')

await test('准备：装 demo Mod（含可加载 package）+ 空 profile', async () => {
  TMP = await mkdtemp(join(tmpdir(), 'moyu-mods-int-'))
  modsDir = join(TMP, 'mods')
  profileDir = join(TMP, 'profile')
  await mkdir(join(profileDir, 'node_modules'), { recursive: true })
  await resetPatch()

  // 模拟 profile 闭包里的 peer 依赖（只存在于 profile/node_modules，不在 Mod 包内）。
  // 复制模式下 Mod 真实位置在 profile/node_modules，向上解析能命中它；软链模式会解析失败。
  const peerDir = join(profileDir, 'node_modules', '@moyu-peer', 'demo-dep')
  await mkdir(peerDir, { recursive: true })
  await writeFile(join(peerDir, 'package.json'), JSON.stringify({ name: '@moyu-peer/demo-dep', version: '1.0.0', type: 'module', main: 'index.mjs' }))
  await writeFile(join(peerDir, 'index.mjs'), 'export const PEER_OK = "peer-resolved"\n')

  // demo Mod 源：manifest + 真实 cordis 插件包，插件 import 上述 peer 依赖
  const src = join(TMP, 'src')
  await mkdir(join(src, 'package', 'lib'), { recursive: true })
  await writeFile(join(src, 'manifest.json'), JSON.stringify(MANIFEST))
  await writeFile(join(src, 'package', 'package.json'), JSON.stringify({
    name: '@moyu/dsh-plugin-demo', version: '1.0.0', type: 'module', main: 'lib/index.mjs',
  }))
  await writeFile(join(src, 'package', 'lib', 'index.mjs'),
    'import { PEER_OK } from "@moyu-peer/demo-dep"\n'
    + 'export const name = "moyu-demo"\n'
    + 'export function apply(ctx) { ctx.__moyuDemoLoaded = PEER_OK }\n')

  const r = await installFromDir(modsDir, src, ENV)
  assert.ok(r.ok, r.error)
})

await test('应用后：patch 注入 demo + 核心/业务保留', async () => {
  await resetPatch()
  const res = await applyModsToProfile({ modsDir, profileDir })
  assert.equal(res.skipped.length, 0, JSON.stringify(res.skipped))
  assert.equal(res.linked.length, 1)
  const { readFile } = await import('node:fs/promises')
  const patch = await readFile(patchPath(), 'utf8')
  assert.ok(patch.includes('@moyu/dsh-plugin-demo'), 'patch 应含 demo')
  assert.ok(patch.includes('@moyu/dsh-plugin-demo'.length && '@moyu/dsh-plugin-demo'))
  assert.ok(patch.includes('@moyu/dsh-plugin-image'), '业务保留')
  assert.ok(patch.includes('@moyu/dsh-credentials-desktop'), '核心保留')
})

await test('package 落入 profile 闭包、可 import、且 peer 依赖解析成功（真实装载证据）', async () => {
  const dest = join(profileDir, 'node_modules', '@moyu', 'dsh-plugin-demo')
  assert.ok(existsSync(dest), 'Mod 包应存在于 profile/node_modules')
  const mod = await import(pathToFileURL(join(dest, 'lib', 'index.mjs')).href)
  assert.equal(mod.name, 'moyu-demo', 'linked package 应可加载并暴露 name')
  const ctx = {}
  mod.apply(ctx)
  // apply 依赖 import 的 peer 模块——能拿到 peer 值即证明 peer 依赖从 profile 闭包解析成功
  assert.equal(ctx.__moyuDemoLoaded, 'peer-resolved', 'peer 依赖应从 profile 闭包解析（复制模式）')
})

await test('disable 后重置 patch 重应用：demo 消失、核心仍在（模拟重启）', async () => {
  await setEnabled(modsDir, 'moyu-demo', false)
  await resetPatch()
  const res = await applyModsToProfile({ modsDir, profileDir })
  assert.equal(res.linked.length, 0)
  const { readFile } = await import('node:fs/promises')
  const patch = await readFile(patchPath(), 'utf8')
  assert.ok(!patch.includes('@moyu/dsh-plugin-demo'), 'disable 后 patch 不含 demo')
  assert.ok(patch.includes('@moyu/dsh-credentials-desktop'), '核心仍在')
})

await test('卸载后重置 patch 重应用：核心可正常 compose（无残留、能启动）', async () => {
  await uninstall(modsDir, 'moyu-demo')
  assert.ok(!existsSync(join(modsDir, 'moyu-demo')), 'mod 目录应删除')
  await resetPatch()
  const res = await applyModsToProfile({ modsDir, profileDir })
  assert.equal(res.linked.length, 0)
  assert.equal(res.skipped.length, 0)
  const { readFile } = await import('node:fs/promises')
  const patch = await readFile(patchPath(), 'utf8')
  assert.ok(patch.includes('@moyu/dsh-credentials-desktop'), '核心不带 Mod 仍可 compose（可启动）')
})

await test('空注册表：applyModsToProfile 是 no-op（不改 patch）', async () => {
  await resetPatch()
  const res = await applyModsToProfile({ modsDir, profileDir })
  assert.equal(res.linked.length, 0)
  const { readFile } = await import('node:fs/promises')
  const patch = await readFile(patchPath(), 'utf8')
  assert.equal(patch, BASE_PATCH, 'no-op 应保持 patch 原样')
})

if (TMP) await rm(TMP, { recursive: true, force: true })
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed === 0 ? 0 : 1)
