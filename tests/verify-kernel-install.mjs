/**
C4-b DSH 内核安装/校验器验收（纯 Node）。
覆盖：正常安装 / 幂等(already) / 无公钥拒绝 / 签名不过拒绝 / 篡改元数据拒绝 /
      SHA-256 不符拒绝 / 平台不符拒绝 / 壳不兼容拒绝 / payload 缺完整标记拒绝 /
      payload 缺 DSH 入口拒绝 / 包不完整拒绝 / 安装后 manifest 可被 kernel.js 选用。
*/
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign as cryptoSign, createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync, createReadStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { create as tarCreate } from 'tar'
import { verifyAndInstallKernel } from '../apps/desktop/main/dsh/kernel-install.js'
import { resolveActiveKernel, kernelsDir } from '../apps/desktop/main/dsh/kernel.js'

let passed = 0, failed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`) }
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const PUB_PEM = publicKey.export({ type: 'spki', format: 'pem' })
const WRONG = generateKeyPairSync('ed25519')
const ENV = { platform: 'darwin', arch: 'arm64', shellVersion: '0.1.0' }

function sha256File(file) {
  return new Promise((res, rej) => { const h = createHash('sha256'); createReadStream(file).on('error', rej).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))) })
}

// 造一份"内核闭包"目录（最小但形似 build/dsh-runtime），tar 成 payload.tgz
async function buildPayload(dir, { withComplete = true, withEntry = true, version = '0.1.2' } = {}) {
  const src = join(dir, 'closure')
  await mkdir(join(src, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
  await mkdir(join(src, 'home-template', 'profiles', 'moyu'), { recursive: true })
  if (withEntry) await writeFile(join(src, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), '// fake bin')
  if (withComplete) await writeFile(join(src, '.complete.json'), JSON.stringify({ version: 1, dshVersion: version }))
  const payload = join(dir, 'payload.tgz')
  await tarCreate({ file: payload, cwd: src, gzip: true }, ['.'])
  return payload
}

// 组装签名包：metadata.json + payload.tgz + metadata.sig
async function buildPackage(dir, metaOverride = {}, { payloadOpts = {}, signWith = privateKey, tamperMeta = false, badSha = false } = {}) {
  await mkdir(dir, { recursive: true })
  const payload = await buildPayload(dir, payloadOpts)
  const sha = await sha256File(payload)
  const meta = { version: '0.1.2', dshVersion: '0.1.2', platform: 'darwin', arch: 'arm64', shellCompat: '>=0.1.0', sha256: badSha ? 'deadbeef' : sha, channel: 'stable', ...metaOverride }
  const metaBuf = Buffer.from(JSON.stringify(meta))
  const sig = cryptoSign(null, metaBuf, signWith).toString('base64')
  // tamperMeta：签名后再改元数据（模拟中途篡改）→ 验签必须失败
  const written = tamperMeta ? Buffer.from(JSON.stringify({ ...meta, notes: 'TAMPERED' })) : metaBuf
  await writeFile(join(dir, 'metadata.json'), written)
  await writeFile(join(dir, 'metadata.sig'), sig)
  return dir
}

console.log('\n=== C4-b 内核安装/校验验收 ===\n')
let TMP
await test('准备临时根', async () => { TMP = await mkdtemp(join(tmpdir(), 'moyu-kinst-')) })

await test('正常安装 → installed，落盘 manifest + 完整标记', async () => {
  const ud = join(TMP, 't1'); const pkg = await buildPackage(join(TMP, 't1-pkg'))
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.equal(r.status, 'installed', JSON.stringify(r))
  const kdir = join(kernelsDir(ud), '0.1.2')
  assert.ok(existsSync(join(kdir, '.complete.json')))
  assert.ok(existsSync(join(kdir, 'manifest.json')))
  assert.ok(existsSync(join(kdir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')))
  const man = JSON.parse(await readFile(join(kdir, 'manifest.json'), 'utf8'))
  assert.equal(man.channel, 'stable')
})

await test('幂等：重复安装同版本 → already', async () => {
  const ud = join(TMP, 't2'); const pkg = await buildPackage(join(TMP, 't2-pkg'))
  await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  const r2 = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.equal(r2.status, 'already')
})

await test('红线：无公钥 → 拒绝', async () => {
  const ud = join(TMP, 't3'); const pkg = await buildPackage(join(TMP, 't3-pkg'))
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: null, ...ENV })
  assert.equal(r.status, 'rejected'); assert.equal(r.reason, 'no-trust-key')
  assert.ok(!existsSync(join(kernelsDir(ud), '0.1.2')), '拒绝不应落盘')
})

await test('签名不过（错误私钥签发）→ 拒绝', async () => {
  const ud = join(TMP, 't4'); const pkg = await buildPackage(join(TMP, 't4-pkg'), {}, { signWith: WRONG.privateKey })
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.equal(r.reason, 'bad-signature')
})

await test('元数据签名后被篡改 → 验签失败拒绝', async () => {
  const ud = join(TMP, 't5'); const pkg = await buildPackage(join(TMP, 't5-pkg'), {}, { tamperMeta: true })
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.equal(r.reason, 'bad-signature')
})

await test('SHA-256 不符（payload 损坏/被换）→ 拒绝', async () => {
  const ud = join(TMP, 't6'); const pkg = await buildPackage(join(TMP, 't6-pkg'), {}, { badSha: true })
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.equal(r.reason, 'sha256-mismatch')
})

await test('平台不符 → 拒绝', async () => {
  const ud = join(TMP, 't7'); const pkg = await buildPackage(join(TMP, 't7-pkg'), { platform: 'win32' })
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.match(r.reason, /platform-mismatch/)
})

await test('壳不兼容 → 拒绝', async () => {
  const ud = join(TMP, 't8'); const pkg = await buildPackage(join(TMP, 't8-pkg'), { shellCompat: '>=9.0.0' })
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.match(r.reason, /shell-incompat/)
})

await test('payload 缺 .complete.json → 拒绝', async () => {
  const ud = join(TMP, 't9'); const pkg = await buildPackage(join(TMP, 't9-pkg'), {}, { payloadOpts: { withComplete: false } })
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.equal(r.reason, 'payload-incomplete')
})

await test('payload 缺 DSH 入口 bin.js → 拒绝', async () => {
  const ud = join(TMP, 't10'); const pkg = await buildPackage(join(TMP, 't10-pkg'), {}, { payloadOpts: { withEntry: false } })
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.equal(r.reason, 'payload-no-entry')
})

await test('包不完整（缺 metadata.sig）→ 拒绝', async () => {
  const ud = join(TMP, 't11'); const pkg = await buildPackage(join(TMP, 't11-pkg'))
  await rm(join(pkg, 'metadata.sig'))
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.equal(r.reason, 'package-incomplete')
})

await test('安装后 kernel.js 能选用（端到端衔接）', async () => {
  const ud = join(TMP, 't12'); const pkg = await buildPackage(join(TMP, 't12-pkg'))
  const r = await verifyAndInstallKernel({ packageDir: pkg, userDataDir: ud, publicKeyPem: PUB_PEM, ...ENV })
  assert.equal(r.status, 'installed')
  // 写 current.json 激活，再让 kernel.js 解析
  await writeFile(join(kernelsDir(ud), 'current.json'), JSON.stringify({ version: 1, active: '0.1.2' }))
  const decision = await resolveActiveKernel({ userDataDir: ud, builtinRoot: '/builtin', builtinVersion: '0.1.1-rc.2', ...ENV })
  assert.equal(decision.source, 'user')
  assert.equal(decision.version, '0.1.2')
})

await test('清理', async () => { await rm(TMP, { recursive: true, force: true }) })

console.log(`\n${failed === 0 ? '✅' : '❌'} 通过 ${passed} / 失败 ${failed}\n`)
process.exit(failed === 0 ? 0 : 1)
