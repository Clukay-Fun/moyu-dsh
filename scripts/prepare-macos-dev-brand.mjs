// macOS 开发态由 node_modules/electron/dist/Electron.app 启动。
// app.dock.setIcon() 只能更新 Dock，Stage Manager 与退出动画仍读取 Bundle 元数据，
// 因此启动前将这份项目私有 Electron.app 标记为 Moyu，并写入同源 ICNS。

import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

if (process.platform !== 'darwin') process.exit(0)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'assets/app-icon.png')
const electronApp = join(root, 'node_modules/electron/dist/Electron.app')
const contents = join(electronApp, 'Contents')
const resources = join(contents, 'Resources')
const plist = join(contents, 'Info.plist')
const output = join(resources, 'moyu.icns')
const digest = createHash('sha256').update(await readFile(source)).digest('hex')
const marker = join(resources, `.moyu-dev-brand-${digest}`)

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} 执行失败（${result.status ?? 'unknown'}）`)
}

try {
  await readFile(marker)
  process.exit(0)
} catch {}

const temp = await mkdtemp(join(tmpdir(), 'moyu-icon-'))
const iconset = join(temp, 'moyu.iconset')
await mkdir(iconset)

try {
  for (const [name, size] of [
    ['icon_16x16.png', 16], ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32], ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128], ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256], ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512], ['icon_512x512@2x.png', 1024]
  ]) {
    run('sips', ['-z', String(size), String(size), source, '--out', join(iconset, name)])
  }
  run('iconutil', ['-c', 'icns', iconset, '-o', output])

  const plistBuddy = '/usr/libexec/PlistBuddy'
  for (const [key, value] of [
    ['CFBundleName', 'Moyu'],
    ['CFBundleDisplayName', 'Moyu'],
    ['CFBundleIdentifier', 'com.clukay.moyu-dsh.dev'],
    ['CFBundleIconFile', 'moyu.icns']
  ]) {
    const set = spawnSync(plistBuddy, ['-c', `Set :${key} ${value}`, plist])
    if (set.status !== 0) run(plistBuddy, ['-c', `Add :${key} string ${value}`, plist])
  }

  await copyFile(source, join(resources, 'app-icon.png'))
  await writeFile(marker, `${digest}\n`)
  // 修改已签名的 Electron.app 后重新做本地 ad-hoc 签名，否则 macOS 可能拒绝启动。
  run('codesign', ['--force', '--deep', '--sign', '-', electronApp])
  console.log('macOS 开发壳品牌已同步：Moyu / com.clukay.moyu-dsh.dev / moyu.icns')
} finally {
  await rm(temp, { recursive: true, force: true })
}
