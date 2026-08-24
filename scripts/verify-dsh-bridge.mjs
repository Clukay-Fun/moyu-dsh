// 桌面桥与凭据密文存储的验证（v3.0.0 M0b B3）。
//
// 必须在 Electron 里跑：safeStorage 依赖 app ready 与系统钥匙串。
// 用法：npm run verify:dsh-bridge
//
// 覆盖 §5.2 落盘表里可自动验证的部分：set/describe/unset 循环、密文不含明文、
// 0600 权限、原子写入不留临时文件、删除不留残留、明文 YAML 迁移并删源、
// 看不懂的 YAML 结构拒绝删除、解密失败被识别为 CREDENTIALS_DECRYPT_FAILED。
// 文件对话框、Finder、剪贴板需要人工交互，不在此脚本内。
import { app } from 'electron'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const results = {}

async function main() {
  // 用临时 userData，避免碰到真实用户数据。
  const sandbox = await mkdtemp(join(tmpdir(), 'moyu-dsh-verify-'))
  app.setPath('userData', sandbox)
  await app.whenReady()

  const store = await import('../apps/desktop/main/dsh/secure-store.js')
  const { createBridgeMethods, dispatchBridgeCall } = await import('../apps/desktop/main/dsh/bridge.js')

  results.encryptionAvailable = (await import('electron')).safeStorage.isEncryptionAvailable()
  assert.equal(results.encryptionAvailable, true, 'safeStorage 不可用，无法验证密文路径')

  const secret = 'sk-verify-ONLY-not-a-real-key-8f3a1c'

  // ① set / describe / get / unset 循环
  assert.equal((await store.describeCredential('DEEPSEEK_API_KEY')).configured, false)
  await store.setCredential('DEEPSEEK_API_KEY', secret)
  assert.equal((await store.describeCredential('DEEPSEEK_API_KEY')).configured, true)
  assert.equal(await store.getCredential('DEEPSEEK_API_KEY'), secret)
  results.roundTrip = true

  // ①b 引导页分流依据：hasAnyCredential 必须与实际状态一致
  results.hasCredentialWhenSet = await store.hasAnyCredential()
  assert.equal(results.hasCredentialWhenSet, true)

  // ② 磁盘上不得出现明文；密文文件权限 0600
  const file = store.storePath()
  const raw = await readFile(file)
  results.plaintextOnDisk = raw.includes(Buffer.from(secret))
  assert.equal(results.plaintextOnDisk, false, '密文文件里出现了明文')
  results.mode = ((await stat(file)).mode & 0o777).toString(8)
  assert.equal(results.mode, '600')

  // ③ 原子写入不留临时文件
  await store.setCredential('SECOND_KEY', 'another-value')
  results.strayTempFiles = (await readdir(sandbox)).filter((name) => name.endsWith('.tmp'))
  assert.deepEqual(results.strayTempFiles, [])

  // ④ unset 真删除；删完最后一条时文件本身消失
  await store.unsetCredential('SECOND_KEY')
  assert.equal((await store.describeCredential('SECOND_KEY')).configured, false)
  await store.unsetCredential('DEEPSEEK_API_KEY')
  results.fileRemovedWhenEmpty = !(await stat(file).catch(() => null))
  assert.equal(results.fileRemovedWhenEmpty, true)
  results.hasCredentialWhenEmpty = await store.hasAnyCredential()
  assert.equal(results.hasCredentialWhenEmpty, false)

  // ⑤ 明文 YAML 迁移：导入后原文件必须消失，且新库里读得到
  const yamlPath = join(sandbox, '.credentials.yaml')
  await writeFile(yamlPath, `# upstream plaintext\nDEEPSEEK_API_KEY: ${secret}\nOTHER_KEY: "quoted-value"\n`)
  results.migration = await store.migratePlaintextYaml(yamlPath)
  assert.equal(results.migration.migrated, 2)
  assert.equal(results.migration.removed, true)
  assert.equal(await store.getCredential('DEEPSEEK_API_KEY'), secret)
  assert.equal(await store.getCredential('OTHER_KEY'), 'quoted-value')
  results.yamlRemoved = !(await stat(yamlPath).catch(() => null))
  assert.equal(results.yamlRemoved, true)

  // ⑥ 看不懂的 YAML 结构：宁可保留原文件也不能删掉用户凭据
  const nestedPath = join(sandbox, 'nested.yaml')
  await writeFile(nestedPath, 'providers:\n  deepseek:\n    key: abc\n')
  results.unsupportedShape = await store.migratePlaintextYaml(nestedPath)
  assert.equal(results.unsupportedShape.removed, false)
  assert.equal(results.unsupportedShape.reason, 'unsupported-shape')
  assert.ok(await stat(nestedPath).catch(() => null), '看不懂的凭据文件被删了')

  // ⑦ 解密失败必须被识别，而不是当成“没配过”
  await writeFile(store.storePath(), JSON.stringify({ version: 1, payload: 'bm90LWEtY2lwaGVy' }))
  results.decryptFailure = await store
    .describeCredential('DEEPSEEK_API_KEY')
    .then(() => 'no-error')
    .catch((error) => error.code)
  assert.equal(results.decryptFailure, 'CREDENTIALS_DECRYPT_FAILED')

  // ⑧ 桥的派发：未登记方法被拒、参数校验生效、错误被清洗成 message + code
  const methods = createBridgeMethods({ generation: 1, window: () => undefined })
  results.ping = await dispatchBridgeCall(methods, { id: 1, method: 'desktop.ping' })
  assert.equal(results.ping.value, 'desktop.pong')

  results.unknownMethod = await dispatchBridgeCall(methods, { id: 2, method: 'ipc.invoke' })
  assert.equal(results.unknownMethod.ok, false)
  assert.equal(results.unknownMethod.code, 'UNKNOWN_METHOD')
  assert.equal(typeof methods['desktop.requestScreenCapture'], 'function')
  assert.equal(typeof methods['desktop.selectScreenshotRegion'], 'function')
  results.rawCaptureRejected = await dispatchBridgeCall(methods, { id: 20, method: 'desktop.unregisteredCapture' })
  assert.equal(results.rawCaptureRejected.ok, false)
  assert.equal(results.rawCaptureRejected.code, 'UNKNOWN_METHOD')

  results.badArgs = await dispatchBridgeCall(methods, { id: 3, method: 'desktop.showItem', payload: {} })
  assert.equal(results.badArgs.ok, false)
  assert.ok(!('stack' in results.badArgs), '错误未清洗，回传了栈')

  // ⑨ 文件令牌：Host 拿不到绝对路径；未授权令牌被拒
  const token = await methods.registry.register(store.storePath())
  results.fileToken = token
  assert.ok(token.fileId && token.name, '令牌缺少 fileId/name')
  assert.ok(!('path' in token), '令牌泄漏了绝对路径')
  results.forgedToken = await dispatchBridgeCall(methods, {
    id: 4,
    method: 'desktop.showItem',
    payload: { fileId: 'not-a-real-token' }
  })
  assert.equal(results.forgedToken.ok, false)
  methods.registry.clear()
  results.tokenAfterClear = await dispatchBridgeCall(methods, {
    id: 5,
    method: 'desktop.showItem',
    payload: { fileId: token.fileId }
  })
  assert.equal(results.tokenAfterClear.ok, false, '换代后旧令牌仍可用')

  console.log(JSON.stringify(results, null, 2))
  console.log('桌面桥与凭据存储验证通过')
  app.exit(0)
}

main().catch((error) => {
  console.error('验证失败：', error?.message || error)
  console.error(JSON.stringify(results, null, 2))
  app.exit(1)
})
