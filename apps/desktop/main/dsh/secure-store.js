// 凭据密文存储（v3.0.0 §5.2）。
//
// safeStorage 只提供加解密，密钥由系统托管（macOS 走 Keychain）——**密文与元数据仍由
// 我们自己保存**。上游默认实现把 Key 明文写进 $DSH_HOME/.credentials.yaml，正式产品不接受。
//
// 落盘约定：
//   位置   userData 下的专用文件，不放进 DSH_HOME，避免与上游实现混淆
//   权限   0600
//   写入   临时文件 + rename 原子替换，不就地覆盖
//   删除   unset 真正删除条目，不留残留密文
//   迁移   检测到旧 .credentials.yaml 时导入并删除原文件，只记一行不含明文的日志
//   解密失败 视为“未配置”，交由调用方进引导页，不静默吞掉也不回落明文层
//   不可用 isEncryptionAvailable() 为 false 时拒绝保存，绝不降级存明文
import { app, safeStorage } from 'electron'
import { randomBytes } from 'node:crypto'
import { chmod, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const FILE_VERSION = 1

export class CredentialsUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.code = 'CREDENTIALS_UNAVAILABLE'
  }
}

export class CredentialsDecryptError extends Error {
  constructor(message) {
    super(message)
    this.code = 'CREDENTIALS_DECRYPT_FAILED'
  }
}

export function storePath() {
  return join(app.getPath('userData'), 'dsh-credentials.enc')
}

function assertEncryptionAvailable() {
  if (safeStorage.isEncryptionAvailable()) return
  throw new CredentialsUnavailableError(
    '系统加密不可用，拒绝保存凭据：绝不以明文降级存储。请检查系统钥匙串是否可用。'
  )
}

async function readEnvelope() {
  let raw
  try {
    raw = await readFile(storePath(), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return { version: FILE_VERSION, entries: {} }
    throw error
  }

  let envelope
  try {
    envelope = JSON.parse(raw)
  } catch {
    throw new CredentialsDecryptError('凭据文件已损坏，无法解析。')
  }
  if (!envelope?.payload) return { version: FILE_VERSION, entries: {} }

  assertEncryptionAvailable()
  try {
    const plain = safeStorage.decryptString(Buffer.from(envelope.payload, 'base64'))
    return { version: envelope.version ?? FILE_VERSION, entries: JSON.parse(plain) }
  } catch {
    // 常见于换机、钥匙串条目被删或系统重装：不能当成“没配过”静默继续，
    // 也不能崩掉——交给调用方提示重新录入。
    throw new CredentialsDecryptError('凭据解密失败，可能来自其他机器或钥匙串条目已失效，请重新录入。')
  }
}

async function writeEnvelope(entries) {
  assertEncryptionAvailable()
  const payload = safeStorage.encryptString(JSON.stringify(entries)).toString('base64')
  const body = JSON.stringify({ version: FILE_VERSION, updatedAt: new Date().toISOString(), payload })
  const target = storePath()
  const temporary = `${target}.${randomBytes(6).toString('hex')}.tmp`
  // 先以 0600 建临时文件再 rename：就地覆盖会在中途崩溃时留下截断的密文。
  await writeFile(temporary, body, { encoding: 'utf8', mode: 0o600 })
  await chmod(temporary, 0o600)
  await rename(temporary, target)
  await chmod(target, 0o600)
}

export async function describeCredential(key) {
  const { entries } = await readEnvelope()
  return { key, configured: Object.hasOwn(entries, key), writable: safeStorage.isEncryptionAvailable() }
}

export async function setCredential(key, value) {
  if (typeof key !== 'string' || !key) throw new Error('凭据名无效')
  if (typeof value !== 'string' || !value) throw new Error('凭据值无效')
  const { entries } = await readEnvelope()
  entries[key] = value
  await writeEnvelope(entries)
  return { key, configured: true }
}

export async function getCredential(key) {
  const { entries } = await readEnvelope()
  return Object.hasOwn(entries, key) ? entries[key] : undefined
}

export async function unsetCredential(key) {
  const { entries } = await readEnvelope()
  if (!Object.hasOwn(entries, key)) return { key, configured: false }
  delete entries[key]
  if (Object.keys(entries).length === 0) {
    // 最后一条被删掉时直接移除文件，不留一份“空但存在”的密文。
    await rm(storePath(), { force: true })
    return { key, configured: false }
  }
  await writeEnvelope(entries)
  return { key, configured: false }
}

/**
 * 迁移上游明文 YAML。
 *
 * 只接受平铺的 `KEY: value`：看不懂的结构宁可保留原文件并报告，也不能删掉用户凭据。
 * 成功导入后删除原文件，日志只记条数，不记键值。
 */
export async function migratePlaintextYaml(yamlPath) {
  let raw
  try {
    raw = await readFile(yamlPath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return { migrated: 0, removed: false, reason: 'absent' }
    throw error
  }

  const imported = {}
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim()
    if (!text || text.startsWith('#')) continue
    const match = text.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/)
    if (!match) {
      return { migrated: 0, removed: false, reason: 'unsupported-shape' }
    }
    const value = match[2].trim().replace(/^['"]|['"]$/g, '')
    if (!value) return { migrated: 0, removed: false, reason: 'unsupported-shape' }
    imported[match[1]] = value
  }
  if (Object.keys(imported).length === 0) return { migrated: 0, removed: false, reason: 'empty' }

  const { entries } = await readEnvelope()
  for (const [key, value] of Object.entries(imported)) {
    if (!Object.hasOwn(entries, key)) entries[key] = value
  }
  await writeEnvelope(entries)
  await unlink(yamlPath)
  console.log(`[dsh] 已迁移 ${Object.keys(imported).length} 条明文凭据并删除原文件`)
  return { migrated: Object.keys(imported).length, removed: true, reason: 'ok' }
}
