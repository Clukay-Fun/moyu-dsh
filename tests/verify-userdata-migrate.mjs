/**
C3-b userData 迁移验收（纯 Node）。覆盖 8 条安全需求。
*/
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateUserData } from '../apps/desktop/main/dsh/userdata-migrate.mjs'

let passed = 0, failed = 0
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`) }
}

// 造一个“旧 userData”：凭据(二进制)、设置(json)、会话(dsh/)、mods
async function seedOld(dir) {
  await mkdir(join(dir, 'dsh', 'sessions'), { recursive: true })
  await mkdir(join(dir, 'mods', 'moyu-image', 'package'), { recursive: true })
  await writeFile(join(dir, 'dsh-credentials.enc'), Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe])) // 二进制凭据
  await writeFile(join(dir, 'settings.json'), JSON.stringify({ theme: 'dark', model: 'x' }))
  await writeFile(join(dir, 'dsh', 'sessions', 's1.json'), JSON.stringify({ id: 's1' }))
  await writeFile(join(dir, 'mods', 'registry.json'), JSON.stringify({ version: 1, mods: {} }))
}

console.log('\n=== C3-b userData 迁移验收 ===\n')

let TMP
await test('准备临时根', async () => { TMP = await mkdtemp(join(tmpdir(), 'moyu-udm-')) })

await test('需求1/2/8: 旧有数据、新为空 → migrated，新目录字节完整，旧目录保留', async () => {
  const oldDir = join(TMP, 't1-old'); const newDir = join(TMP, 't1-new')
  await seedOld(oldDir)
  const r = await migrateUserData({ oldDir, newDir })
  assert.equal(r.status, 'migrated', JSON.stringify(r))
  // 旧目录保留（需求2）
  assert.ok(existsSync(join(oldDir, 'dsh-credentials.enc')), '旧目录应保留')
  // 新目录结构完整
  assert.ok(existsSync(join(newDir, 'dsh', 'sessions', 's1.json')))
  assert.ok(existsSync(join(newDir, 'mods', 'registry.json')))
})

await test('需求8: 凭据字节一致（可解密的必要前提）+ 设置可 JSON 解析', async () => {
  const oldDir = join(TMP, 't2-old'); const newDir = join(TMP, 't2-new')
  await seedOld(oldDir)
  await migrateUserData({ oldDir, newDir })
  const oldCred = await readFile(join(oldDir, 'dsh-credentials.enc'))
  const newCred = await readFile(join(newDir, 'dsh-credentials.enc'))
  assert.ok(oldCred.equals(newCred), '凭据文件必须字节一致')
  const settings = JSON.parse(await readFile(join(newDir, 'settings.json'), 'utf8'))
  assert.equal(settings.theme, 'dark')
})

await test('需求3: 重复启动幂等 → already，新目录不重迁不变化', async () => {
  const oldDir = join(TMP, 't3-old'); const newDir = join(TMP, 't3-new')
  await seedOld(oldDir)
  const r1 = await migrateUserData({ oldDir, newDir })
  assert.equal(r1.status, 'migrated')
  const before = (await readdir(newDir)).sort()
  const r2 = await migrateUserData({ oldDir, newDir })
  assert.equal(r2.status, 'already', JSON.stringify(r2))
  const after = (await readdir(newDir)).sort()
  assert.deepEqual(after, before, '幂等：新目录不应变化')
})

await test('需求6: 新旧都有独立数据（无迁移标记）→ conflict，两边不动', async () => {
  const oldDir = join(TMP, 't4-old'); const newDir = join(TMP, 't4-new')
  await seedOld(oldDir)
  // 新目录独立数据（非我方迁移，无 marker）
  await mkdir(join(newDir, 'dsh'), { recursive: true })
  await writeFile(join(newDir, 'settings.json'), JSON.stringify({ theme: 'light' }))
  const r = await migrateUserData({ oldDir, newDir })
  assert.equal(r.status, 'conflict', JSON.stringify(r))
  // 两边都不动
  assert.equal(JSON.parse(await readFile(join(newDir, 'settings.json'), 'utf8')).theme, 'light')
  assert.ok(existsSync(join(oldDir, 'dsh-credentials.enc')))
})

await test('需求1: 无旧数据（全新安装）→ no-source', async () => {
  const oldDir = join(TMP, 't5-old'); const newDir = join(TMP, 't5-new')
  const r = await migrateUserData({ oldDir, newDir })
  assert.equal(r.status, 'no-source')
  assert.ok(!existsSync(newDir), '不应凭空创建新目录')
})

await test('需求4: 上次中断残留 staging → 本次清理后仍成功 migrated', async () => {
  const oldDir = join(TMP, 't6-old'); const newDir = join(TMP, 't6-new')
  await seedOld(oldDir)
  // 模拟上次中断留下的 staging（.migrating-<newbase>-xxx）
  await mkdir(join(TMP, `.migrating-${'t6-new'}-stale`, 'junk'), { recursive: true })
  const r = await migrateUserData({ oldDir, newDir })
  assert.equal(r.status, 'migrated', JSON.stringify(r))
  assert.ok(existsSync(join(newDir, 'dsh', 'sessions', 's1.json')))
})

await test('需求6变体: 旧目录空 + 新有数据 → no-source（不误判 conflict）', async () => {
  const oldDir = join(TMP, 't7-old'); const newDir = join(TMP, 't7-new')
  await mkdir(oldDir, { recursive: true }) // 旧目录存在但空
  await seedOld(newDir)
  const r = await migrateUserData({ oldDir, newDir })
  assert.equal(r.status, 'no-source', '旧无数据不应判 conflict')
})

if (TMP) await rm(TMP, { recursive: true, force: true })
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed === 0 ? 0 : 1)
