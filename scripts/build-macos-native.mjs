import { mkdir, chmod } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'native/macos/screen-capture.swift')
const output = resolve(root, 'build/macos/screen-capture')
const iconSource = resolve(root, 'assets/app-icon.png')
const iconOutput = resolve(root, 'build/macos/app-icon.png')

if (process.platform !== 'darwin') {
  throw new Error('macOS 原生截图 helper 只能在 macOS 上构建')
}

await mkdir(dirname(output), { recursive: true })

await new Promise((resolvePromise, reject) => {
  const child = spawn('xcrun', [
    'swiftc', '-parse-as-library', '-O', source,
    '-o', output,
    '-framework', 'AppKit',
    '-framework', 'CoreGraphics',
    '-framework', 'ScreenCaptureKit'
  ], { stdio: 'inherit' })
  child.once('error', reject)
  child.once('exit', (code) => {
    if (code === 0) resolvePromise()
    else reject(new Error(`swiftc 退出码 ${code}`))
  })
})

await chmod(output, 0o755)
console.log(`macOS 截图 helper：${output}`)

await sharp(iconSource)
  .resize(1024, 1024, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: 'lanczos3'
  })
  .png({ compressionLevel: 9 })
  .toFile(iconOutput)
console.log(`macOS 打包图标：${iconOutput}`)
