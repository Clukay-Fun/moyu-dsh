/**
描述: DSH 内核安装/校验器（C4-b，离线）。
职责: 把一份**已下载到本地**的内核包安全落地到 `<userData>/kernels/<ver>/`。
      离线包三件套：
        - metadata.json  内核元数据（version/dshVersion/platform/arch/shellCompat/sha256）
        - payload.tgz    完整依赖闭包（与 build/dsh-runtime 同形：node_modules/@deepseek-ai/dsh、home-template、.complete.json）
        - metadata.sig   metadata.json 原始字节的 ed25519 签名（MOYU 私钥签发）
      流程：验签 → 平台/架构/壳兼容 → SHA-256 比对 → 解压暂存 → 完整性自检 → 原子发布 → 写 manifest。
红线: 只安装 **MOYU 签名并校验** 的内核；绝不 `npm install`。签名不过 / 哈希不符 / 平台不符 一律拒绝。
非职责: 不下载（C4-f 接网）；不做兼容探针（C4-c）；不切换 current.json（C4-d）。安装只让内核"就位"，是否启用另说。
契约: scope/plans/active/moyu-dsh-core-and-mod-platform-plan.md §2（更新包必须包含…）。
*/
import { createHash, verify as cryptoVerify } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { extract as tarExtract } from 'tar'
import { kernelsDir, satisfiesShell } from './kernel.js'

const RUNTIME_COMPLETE_MARKER = '.complete.json'
const DSH_BIN_REL = join('node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')

function reject(reason) { return { status: 'rejected', reason } }

async function sha256File(file) {
  return new Promise((resolve, reject2) => {
    const hash = createHash('sha256')
    createReadStream(file).on('error', reject2).on('data', (d) => hash.update(d)).on('end', () => resolve(hash.digest('hex')))
  })
}

/** ed25519 验签：data 是 metadata.json 原始字节，sig 为 base64，pubKey 为 PEM。 */
function verifySignature(dataBuf, sigB64, publicKeyPem) {
  try {
    return cryptoVerify(null, dataBuf, publicKeyPem, Buffer.from(sigB64, 'base64'))
  } catch { return false }
}

/**
 * 校验并安装一份本地内核包。
 * @param packageDir  含 metadata.json / payload.tgz / metadata.sig 的目录
 * @param userDataDir 用户数据根
 * @param publicKeyPem MOYU 内核签名公钥（PEM，ed25519）。缺失即拒绝（红线：无签名不装）。
 * @param platform/arch/shellVersion 当前环境（默认取自 process / 由调用方注入 shellVersion）
 * @returns { status:'installed'|'already'|'rejected', version?, reason? }
 */
export async function verifyAndInstallKernel({
  packageDir, userDataDir, publicKeyPem,
  platform = process.platform, arch = process.arch, shellVersion,
  log = () => {},
}) {
  const metaFile = join(packageDir, 'metadata.json')
  const payloadFile = join(packageDir, 'payload.tgz')
  const sigFile = join(packageDir, 'metadata.sig')
  if (!existsSync(metaFile) || !existsSync(payloadFile) || !existsSync(sigFile)) {
    return reject('package-incomplete')
  }

  const metaBuf = await readFile(metaFile)
  let meta
  try { meta = JSON.parse(metaBuf.toString('utf8')) } catch { return reject('metadata-parse') }
  const version = typeof meta.version === 'string' ? meta.version : null
  if (!version || /[\\/]|\.\./.test(version)) return reject('bad-version')

  // 1) 验签（红线：无公钥或签名不过 → 拒绝，绝不安装未经 MOYU 签发的内核）
  if (!publicKeyPem) return reject('no-trust-key')
  const sigB64 = (await readFile(sigFile, 'utf8')).trim()
  if (!verifySignature(metaBuf, sigB64, publicKeyPem)) return reject('bad-signature')

  // 2) 平台/架构/壳兼容
  if (meta.platform && meta.platform !== platform) return reject(`platform-mismatch:${meta.platform}`)
  if (meta.arch && meta.arch !== arch) return reject(`arch-mismatch:${meta.arch}`)
  if (meta.shellCompat && !satisfiesShell(shellVersion, meta.shellCompat)) return reject(`shell-incompat:${meta.shellCompat}`)

  // 3) 已安装（幂等）
  const targetDir = join(kernelsDir(userDataDir), version)
  if (existsSync(join(targetDir, RUNTIME_COMPLETE_MARKER))) { log(`[kernel-install] ${version} 已安装`); return { status: 'already', version } }

  // 4) SHA-256 比对（防篡改/损坏）
  if (typeof meta.sha256 !== 'string') return reject('missing-sha256')
  const actualSha = await sha256File(payloadFile)
  if (actualSha.toLowerCase() !== meta.sha256.toLowerCase()) return reject('sha256-mismatch')

  // 5) 解压到暂存（同级目录，保证与 targetDir 同分区可原子 rename）
  await mkdir(kernelsDir(userDataDir), { recursive: true })
  const staging = join(kernelsDir(userDataDir), `.staging-${version}-${randomUUID()}`)
  await mkdir(staging, { recursive: true })
  try {
    await tarExtract({ file: payloadFile, cwd: staging })
    // 6) 完整性自检：闭包必须含出厂完整标记与 DSH 入口
    if (!existsSync(join(staging, RUNTIME_COMPLETE_MARKER))) { await rm(staging, { recursive: true, force: true }); return reject('payload-incomplete') }
    if (!existsSync(join(staging, DSH_BIN_REL))) { await rm(staging, { recursive: true, force: true }); return reject('payload-no-entry') }

    // 写内核 manifest（供 kernel.js 启动期校验 + UI 展示）
    await writeFile(join(staging, 'manifest.json'), JSON.stringify({
      version,
      dshVersion: meta.dshVersion || version,
      platform: meta.platform || platform,
      arch: meta.arch || arch,
      shellCompat: meta.shellCompat || null,
      sha256: meta.sha256,
      channel: meta.channel || null,
      notes: meta.notes || null,
      installedAt: new Date().toISOString(),
    }, null, 2), 'utf8')

    // 7) 原子发布
    if (existsSync(targetDir)) await rm(targetDir, { recursive: true, force: true })
    await rename(staging, targetDir)
    log(`[kernel-install] 安装完成 ${version}`)
    return { status: 'installed', version }
  } catch (e) {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
    return reject(`extract-failed:${String(e?.message || e).slice(0, 80)}`)
  }
}

export { sha256File }
