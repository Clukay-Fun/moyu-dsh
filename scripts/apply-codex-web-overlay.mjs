// 将 vendor/codex-web-overlay/ 里的六个上游 client bundle 应用到 DSH 运行闭包。
// 用法：
//   node scripts/apply-codex-web-overlay.mjs           # 应用（首次自动备份 .orig）
//   node scripts/apply-codex-web-overlay.mjs --restore # 还原全部备份
// 前置：npm run build:dsh-runtime 已在 0.1.1-rc.2 上重建闭包。
import { copyFile, readFile, writeFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const closure = join(root, 'build/dsh-runtime/node_modules/@deepseek-ai')
const overlayDir = join(root, 'vendor/codex-web-overlay')
const PACKAGES = [
  'dsh-client-ui-layout', 'dsh-client-ui-sidebar', 'dsh-client-ui-settings',
  'dsh-client-ui-settings-general', 'dsh-client-ui-workspace', 'dsh-client-ui-conversation',
]
const EXPECTED_VERSION = '0.1.1-rc.2'
const restore = process.argv.includes('--restore')

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

let applied = 0
for (const pkg of PACKAGES) {
  // dev 模式下 host.js 经 require.resolve 命中仓库根 node_modules；
  // 打包态走 Resources/dsh-runtime（即 build/dsh-runtime 同构闭包）。两处都补。
  const targets = [
    join(root, 'node_modules/@deepseek-ai', pkg, 'lib/client.js'),
    join(closure, pkg, 'lib/client.js'),
  ]
  const sourcePath = join(overlayDir, pkg.replace('dsh-client-', ''), 'client.js')
  for (const target of targets) {
    if (!await exists(target)) continue
    const backup = `${target}.orig`
    if (restore) {
      if (await exists(backup)) {
        await copyFile(backup, target)
        console.log(`还原 ${target.replace(root + '/', '')}`)
      }
      continue
    }
    const manifest = JSON.parse(await readFile(join(dirname(target), '../package.json'), 'utf8'))
    if (manifest.version !== EXPECTED_VERSION) {
      throw new Error(`${pkg} 版本是 ${manifest.version}，需要 ${EXPECTED_VERSION}`)
    }
    if (!await exists(backup)) await copyFile(target, backup)
    await copyFile(sourcePath, target)
    applied += 1
    console.log(`应用 ${target.replace(root + '/', '')}（备份 .orig）`)
  }
}

if (restore) console.log('还原完成。重启应用即回到官方 UI。')
else console.log(`\n已应用 ${applied}/${PACKAGES.length} 个 bundle。重启应用生效。`)
