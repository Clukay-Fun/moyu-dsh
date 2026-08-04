// 从 assets/app-icon.png 生成 Windows 多尺寸 ICO。
//
// 唯一源：assets/app-icon.png（项目内文件，不依赖桌面路径）。
// 产物：  build/icon.ico —— electron-builder 的 win.icon 指向它。
//
// 尺寸：16 / 20 / 24 / 32 / 40 / 48 / 64 / 128 / 256
//   · 20 与 40 覆盖 Windows 125% 等 DPI 缩放档位；
//   · 256 使用 PNG 压缩（ICO 允许内嵌 PNG，可显著减小体积）；
//   · 其余使用 ICO 内 BMP（BITMAPINFOHEADER + 32bpp BGRA + AND 掩码）。
//
// 运行：node scripts/generate-icon.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(root, 'assets/app-icon.png')
const OUTPUT = resolve(root, 'build/icon.ico')
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const PNG_COMPRESSED = new Set([256])

/** 32bpp BGRA 的 DIB：BITMAPINFOHEADER + XOR 位图（自下而上）+ AND 掩码。 */
function buildDib(rgba, size) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0) // biSize
  header.writeInt32LE(size, 4) // biWidth
  header.writeInt32LE(size * 2, 8) // biHeight：XOR + AND 两段，故为两倍
  header.writeUInt16LE(1, 12) // biPlanes
  header.writeUInt16LE(32, 14) // biBitCount
  header.writeUInt32LE(0, 16) // biCompression = BI_RGB

  // XOR：RGBA → BGRA，且行序自下而上
  const xor = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    const srcRow = (size - 1 - y) * size * 4
    const dstRow = y * size * 4
    for (let x = 0; x < size; x += 1) {
      const s = srcRow + x * 4
      const d = dstRow + x * 4
      xor[d] = rgba[s + 2] // B
      xor[d + 1] = rgba[s + 1] // G
      xor[d + 2] = rgba[s] // R
      xor[d + 3] = rgba[s + 3] // A
    }
  }

  // AND 掩码：32bpp 图标的透明度由 alpha 通道决定，掩码全 0（不遮挡）。
  // 每行按 4 字节对齐。
  const maskRowBytes = Math.ceil(size / 32) * 4
  const mask = Buffer.alloc(maskRowBytes * size, 0)

  header.writeUInt32LE(xor.length + mask.length, 20) // biSizeImage
  return Buffer.concat([header, xor, mask])
}

async function main() {
  const source = await readFile(SOURCE)
  const meta = await sharp(source).metadata()
  const sha = createHash('sha256').update(source).digest('hex')
  console.log(`源：assets/app-icon.png  ${meta.width}×${meta.height}  alpha=${meta.hasAlpha}`)
  console.log(`    SHA-256 ${sha}`)
  if (meta.width !== 256 || meta.height !== 256) {
    throw new Error(`源图应为 256×256，实际 ${meta.width}×${meta.height}`)
  }
  if (!meta.hasAlpha) throw new Error('源图缺少透明通道')

  const entries = []
  for (const size of SIZES) {
    // 统一从原图缩放，不做逐级链式缩放，避免多次重采样累积损失
    const pipeline = sharp(source).resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3'
    })
    const payload = PNG_COMPRESSED.has(size)
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
      : buildDib(await pipeline.raw().toBuffer(), size)
    entries.push({ size, payload, png: PNG_COMPRESSED.has(size) })
  }

  // ICONDIR(6) + ICONDIRENTRY(16) × N
  const dir = Buffer.alloc(6)
  dir.writeUInt16LE(0, 0) // reserved
  dir.writeUInt16LE(1, 2) // type = 1（图标）
  dir.writeUInt16LE(entries.length, 4)

  let offset = 6 + entries.length * 16
  const table = []
  for (const entry of entries) {
    const row = Buffer.alloc(16)
    row.writeUInt8(entry.size === 256 ? 0 : entry.size, 0) // 256 记为 0
    row.writeUInt8(entry.size === 256 ? 0 : entry.size, 1)
    row.writeUInt8(0, 2) // 调色板数：真彩色为 0
    row.writeUInt8(0, 3) // reserved
    row.writeUInt16LE(1, 4) // planes
    row.writeUInt16LE(32, 6) // bitCount
    row.writeUInt32LE(entry.payload.length, 8)
    row.writeUInt32LE(offset, 12)
    table.push(row)
    offset += entry.payload.length
  }

  const ico = Buffer.concat([dir, ...table, ...entries.map((e) => e.payload)])
  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, ico)

  console.log(`\n产物：build/icon.ico  ${ico.length} 字节  ${entries.length} 个尺寸`)
  for (const entry of entries) {
    console.log(`    ${String(entry.size).padStart(3)}×${String(entry.size).padEnd(3)} ${entry.png ? 'PNG' : 'BMP'}  ${entry.payload.length} 字节`)
  }
  console.log(`    SHA-256 ${createHash('sha256').update(ico).digest('hex')}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
