/** C4-c/d/f Kernel Manager 纯 Node 验收。 */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  activateKernel, currentFile, kernelRoot, kernelsDir, readKernelState, recordKernelProbe,
  resolveActiveKernel, restoreBuiltinKernel, rollbackKernel,
} from '../apps/desktop/main/dsh/kernel.js'
import { checkKernelFeed, downloadKernelPackage } from '../apps/desktop/main/dsh/kernel-feed.js'

let passed = 0, failed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`) }
}
const ENV = { platform: 'darwin', arch: 'arm64', shellVersion: '0.1.0' }
let TMP

async function install(ud, version) {
  const root = kernelRoot(ud, version)
  await mkdir(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
  await writeFile(join(root, '.complete.json'), JSON.stringify({ dshVersion: version }))
  await writeFile(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), '// test')
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ version, dshVersion: version, platform: 'darwin', arch: 'arm64', shellCompat: '>=0.1.0' }))
}

console.log('\n=== C4-c/d/f Kernel Manager 验收 ===\n')
await test('准备临时根', async () => { TMP = await mkdtemp(join(tmpdir(), 'moyu-kmgr-')) })

await test('探针结果写 manifest，但不创建/修改 current.json', async () => {
  const ud = join(TMP, 'probe'); await install(ud, '0.1.2')
  assert.equal(existsSync(currentFile(ud)), false)
  await recordKernelProbe({ userDataDir: ud, version: '0.1.2', result: { ok: true }, now: 0 })
  assert.equal(existsSync(currentFile(ud)), false)
  const manifest = JSON.parse(await readFile(join(kernelRoot(ud, '0.1.2'), 'manifest.json'), 'utf8'))
  assert.equal(manifest.probe.status, 'passed')
})

await test('未通过探针的内核不能切换', async () => {
  const ud = join(TMP, 'unprobed'); await install(ud, '0.1.2')
  await assert.rejects(() => activateKernel({ userDataDir: ud, version: '0.1.2', ...ENV }), /尚未通过兼容探针/)
  assert.equal(existsSync(currentFile(ud)), false)
})

await test('通过探针后原子切换，previous=builtin 且记录 probe', async () => {
  const ud = join(TMP, 'activate'); await install(ud, '0.1.2')
  await recordKernelProbe({ userDataDir: ud, version: '0.1.2', result: { ok: true } })
  const result = await activateKernel({ userDataDir: ud, version: '0.1.2', ...ENV })
  assert.deepEqual({ active: result.active, previous: result.previous }, { active: '0.1.2', previous: 'builtin' })
  const state = JSON.parse(await readFile(currentFile(ud), 'utf8'))
  assert.equal(state.activeProbe.status, 'passed')
})

await test('恢复内置后 resolve 不会误选 previous 用户内核', async () => {
  const ud = join(TMP, 'builtin'); await install(ud, '0.1.2')
  await recordKernelProbe({ userDataDir: ud, version: '0.1.2', result: { ok: true } })
  await activateKernel({ userDataDir: ud, version: '0.1.2', ...ENV })
  await restoreBuiltinKernel({ userDataDir: ud })
  const decision = await resolveActiveKernel({ userDataDir: ud, builtinRoot: '/builtin', builtinVersion: '0.1.1', ...ENV })
  assert.equal(decision.source, 'builtin')
  assert.equal(decision.reason, 'selected-builtin')
})

await test('回退上一用户内核时交换 active/previous', async () => {
  const ud = join(TMP, 'rollback'); await install(ud, '0.1.2'); await install(ud, '0.1.3')
  await recordKernelProbe({ userDataDir: ud, version: '0.1.2', result: { ok: true } })
  await recordKernelProbe({ userDataDir: ud, version: '0.1.3', result: { ok: true } })
  await activateKernel({ userDataDir: ud, version: '0.1.2', ...ENV })
  await activateKernel({ userDataDir: ud, version: '0.1.3', ...ENV })
  const result = await rollbackKernel({ userDataDir: ud, ...ENV })
  assert.deepEqual({ active: result.active, previous: result.previous }, { active: '0.1.2', previous: '0.1.3' })
})

await test('状态枚举已安装内核及探针结果', async () => {
  const ud = join(TMP, 'list'); await install(ud, '0.1.2')
  await recordKernelProbe({ userDataDir: ud, version: '0.1.2', result: { ok: false, reason: 'audit-failed' } })
  const state = await readKernelState({ userDataDir: ud, builtinVersion: '0.1.1' })
  assert.equal(state.installed.length, 1)
  assert.equal(state.installed[0].probe.status, 'failed')
})

await test('stable feed 只接受固定 GitHub HTTPS 来源', async () => {
  const ok = await checkKernelFeed({ fetchImpl: async () => ({
    ok: true, status: 200, url: 'https://github.com/Clukay-Fun/moyu-dsh/releases/download/kernel-stable/kernel-manifest.json',
    headers: { get: () => null },
    text: async () => JSON.stringify({ releases: [{ version: '0.1.2', metadataUrl: 'https://github.com/Clukay-Fun/moyu-dsh/releases/download/kernel-stable/metadata.json', signatureUrl: 'https://github.com/Clukay-Fun/moyu-dsh/releases/download/kernel-stable/metadata.sig', payloadUrl: 'https://github.com/Clukay-Fun/moyu-dsh/releases/download/kernel-stable/payload.tgz' }] }),
  }) })
  assert.equal(ok.releases[0].version, '0.1.2')
  await assert.rejects(() => checkKernelFeed({ fetchImpl: async () => ({
    ok: true, status: 200, url: 'https://evil.example/manifest.json', headers: { get: () => null }, text: async () => '{"releases":[]}',
  }) }), /不受信任/)
})

await test('无效通道与恶意包地址均拒绝', async () => {
  await assert.rejects(() => checkKernelFeed({ channel: 'development', fetchImpl: async () => {} }), /通道无效/)
  await assert.rejects(() => checkKernelFeed({ fetchImpl: async () => ({
    ok: true, status: 200, url: 'https://github.com/x', headers: { get: () => null },
    text: async () => JSON.stringify({ releases: [{ version: 'x', metadataUrl: 'https://github.com/x/meta', signatureUrl: 'https://github.com/x/sig', payloadUrl: 'http://127.0.0.1/payload' }] }),
  }) }), /不受信任/)
})

await test('远端三件套不预解压，下载后交给安装器并清理暂存', async () => {
  const files = { 'metadata.json': '{}', 'metadata.sig': 'sig', 'payload.tgz': 'payload' }
  let observed
  const result = await downloadKernelPackage({
    release: {
      metadataUrl: 'https://github.com/Clukay-Fun/moyu-dsh/releases/download/kernel-stable/metadata.json',
      signatureUrl: 'https://github.com/Clukay-Fun/moyu-dsh/releases/download/kernel-stable/metadata.sig',
      payloadUrl: 'https://github.com/Clukay-Fun/moyu-dsh/releases/download/kernel-stable/payload.tgz',
    },
    fetchImpl: async (url) => {
      const name = String(url).split('/').pop()
      return new Response(files[name], { status: 200, headers: { 'content-length': String(files[name].length) } })
    },
    install: async (dir) => {
      observed = dir
      assert.equal(existsSync(join(dir, 'metadata.json')), true)
      return { status: 'installed', version: 'x' }
    },
  })
  assert.equal(result.status, 'installed')
  assert.equal(existsSync(observed), false, '下载暂存未清理')
})

await test('清理', async () => { await rm(TMP, { recursive: true, force: true }) })
console.log(`\n${failed === 0 ? '✅' : '❌'} 通过 ${passed} / 失败 ${failed}\n`)
process.exit(failed === 0 ? 0 : 1)
