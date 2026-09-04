// 生成独立的 macOS 开发 Bundle。仅 app.dock.setIcon 或修改 Electron.app 的 plist，
// 无法覆盖 Stage Manager、退出动画和 LaunchServices 使用的 Bundle 路径身份。

import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

if (process.platform !== 'darwin') process.exit(0)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceIcon = join(root, 'assets/app-icon.png')
const electronRoot = join(root, 'node_modules/electron')
const sourceApp = join(electronRoot, 'dist/Electron.app')
const devApp = join(electronRoot, 'dist/Moyu.app')
const resources = join(devApp, 'Contents/Resources')
const plist = join(devApp, 'Contents/Info.plist')
const outputIcon = join(resources, 'moyu.icns')
const fingerprint = createHash('sha256')
  .update(await readFile(sourceIcon))
  .update(await readFile(join(electronRoot, 'package.json')))
  .update('bundle-schema-v2')
  .digest('hex')
const marker = join(resources, `.moyu-dev-brand-${fingerprint}`)

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} 执行失败（${result.status ?? 'unknown'}）`)
}

let prepared = false
try {
  await readFile(marker)
  prepared = spawnSync('codesign', ['--verify', '--deep', '--strict', devApp]).status === 0
} catch {}

if (!prepared) {
  await rm(devApp, { recursive: true, force: true })
  run('ditto', [sourceApp, devApp])

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
  ]) run('sips', ['-z', String(size), String(size), sourceIcon, '--out', join(iconset, name)])

  run('iconutil', ['-c', 'icns', iconset, '-o', outputIcon])
  await copyFile(sourceIcon, join(resources, 'app-icon.png'))

  const plistBuddy = '/usr/libexec/PlistBuddy'
  for (const [key, value] of [
    ['CFBundleExecutable', 'Electron'],
    ['CFBundleName', 'Moyu'],
    ['CFBundleDisplayName', 'Moyu'],
    ['CFBundleIdentifier', 'com.clukay.moyu-dsh.dev'],
    ['CFBundleIconFile', 'moyu.icns']
  ]) {
    const set = spawnSync(plistBuddy, ['-c', `Set :${key} ${value}`, plist])
    if (set.status !== 0) run(plistBuddy, ['-c', `Add :${key} string ${value}`, plist])
  }

  await writeFile(marker, `${fingerprint}\n`)
  run('codesign', ['--force', '--deep', '--sign', '-', devApp])
  console.log('macOS 开发 Bundle 已生成：Moyu.app / Electron / com.clukay.moyu-dsh.dev')
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}
