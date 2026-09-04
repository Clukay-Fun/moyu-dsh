/**
 * 生成 MOYU DSH 内核发布三件套：metadata.json / metadata.sig / payload.tgz。
 * 私钥只从显式环境变量或 ~/.config/moyu-dsh 读取，绝不复制进仓库或输出目录。
 */
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { create as tarCreate } from 'tar'
import { MOYU_KERNEL_PUBLIC_KEY } from '../apps/desktop/main/dsh/kernel-trust.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const runtime = join(root, 'build', 'dsh-runtime')
const output = resolve(process.argv[2] || join(root, 'scratchpad', 'kernel-release'))
const privateKeyPath = process.env.MOYU_KERNEL_PRIVATE_KEY || join(homedir(), '.config', 'moyu-dsh', 'kernel-signing-private.pem')

function sha256File(file) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    createReadStream(file).on('error', reject).on('data', (chunk) => hash.update(chunk)).on('end', () => resolveHash(hash.digest('hex')))
  })
}

const marker = JSON.parse(await readFile(join(runtime, '.complete.json'), 'utf8'))
const dshVersion = marker.dshVersion
if (!dshVersion) throw new Error('运行闭包缺少 dshVersion')
const version = process.env.MOYU_KERNEL_VERSION || `${dshVersion}-moyu.1`
const privateKey = createPrivateKey(await readFile(privateKeyPath))
const derivedPublic = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).trim()
if (derivedPublic !== MOYU_KERNEL_PUBLIC_KEY.trim()) throw new Error('签名私钥与应用内置 MOYU 公钥不匹配')

await mkdir(output, { recursive: true })
const payloadFile = join(output, 'payload.tgz')
await tarCreate({ file: payloadFile, cwd: runtime, gzip: true, portable: true }, ['.'])
const metadata = {
  version,
  dshVersion,
  platform: 'darwin',
  arch: 'arm64',
  shellCompat: '>=0.1.0',
  sha256: await sha256File(payloadFile),
  channel: process.env.MOYU_KERNEL_CHANNEL || 'stable',
  notes: process.env.MOYU_KERNEL_NOTES || `MOYU 验证内核，DSH ${dshVersion}`,
}
const metadataBytes = Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`)
await writeFile(join(output, 'metadata.json'), metadataBytes, { mode: 0o644 })
await writeFile(join(output, 'metadata.sig'), `${sign(null, metadataBytes, privateKey).toString('base64')}\n`, { mode: 0o644 })
console.log(JSON.stringify({ output, ...metadata }, null, 2))
