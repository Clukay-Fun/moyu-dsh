// electron-vite 通过 electron/path.txt 定位可执行文件。开发期间临时切到独立
// Moyu.app，进程退出后恢复，避免影响 electron-builder 使用原始 Electron.app。

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const electronVite = join(root, 'node_modules/electron-vite/bin/electron-vite.js')

if (process.platform !== 'darwin') {
  const child = spawn(process.execPath, [electronVite, 'dev'], { stdio: 'inherit' })
  process.exitCode = await new Promise((resolveExit) => child.once('exit', (code) => resolveExit(code ?? 1)))
} else {
  await import('./prepare-macos-dev-brand.mjs')
  const pathFile = join(root, 'node_modules/electron/path.txt')
  const original = await readFile(pathFile, 'utf8')
  await writeFile(pathFile, 'Moyu.app/Contents/MacOS/Electron')
  const child = spawn(process.execPath, [electronVite, 'dev'], { stdio: 'inherit' })
  const forward = (signal) => child.kill(signal)
  process.once('SIGINT', forward)
  process.once('SIGTERM', forward)
  try {
    process.exitCode = await new Promise((resolveExit) => child.once('exit', (code) => resolveExit(code ?? 1)))
  } finally {
    process.removeListener('SIGINT', forward)
    process.removeListener('SIGTERM', forward)
    await writeFile(pathFile, original)
  }
}
