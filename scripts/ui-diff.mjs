// 视觉回归对比（V3a 起每模块一次）
//
// 用法：node scripts/ui-diff.mjs <基线目录> <对比目录> [关键字]
//
// ⚠ 只在**同一台机器、同一份环境**下比较像素。macOS 与 Windows 的字体栅格化
//   和渲染器都不同，跨平台直接比像素得到的差异全是噪声，没有意义。
//   本项目已实测：同一份代码连拍两次差异为 0，所以本机内的 diff 可以直接
//   当回归判据。
import { readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const [baseDir, headDir, filter = ''] = process.argv.slice(2)
if (!baseDir || !headDir) {
  console.error('用法：node scripts/ui-diff.mjs <基线目录> <对比目录> [关键字]')
  process.exit(2)
}

/** 缩到 720 宽再比：全分辨率逐像素太慢，而 720 已足够暴露任何肉眼可见的变化。 */
const WIDTH = 720
const THRESHOLD = 12

/**
 * 忽略区域（720 宽坐标系）。
 *
 * ⚠ 「同一份代码连拍两次差异为 0」这个结论下早了——那次只是恰好没跨分钟。
 *   右上角的摸鱼计时器每分钟跳一次，跨分钟拍的两张必然有差异，
 *   而且它离得远，会把差异包围盒撑到整幅图宽，掩盖真正的改动区域。
 */
const IGNORE = [
  { name: '摸鱼计时器', x1: 660, y1: 4, x2: 719, y2: 24 }
]

/** 内容是实时桌面，天然不可比——不是回归。 */
const NOT_COMPARABLE = [/screenshot-覆盖层/]

async function compare(a, b) {
  const [A, B] = await Promise.all([
    sharp(a).greyscale().resize(WIDTH).raw().toBuffer({ resolveWithObject: true }),
    sharp(b).greyscale().resize(WIDTH).raw().toBuffer({ resolveWithObject: true })
  ])
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    return { 尺寸不同: `${A.info.width}×${A.info.height} vs ${B.info.width}×${B.info.height}` }
  }
  const w = A.info.width
  let n = 0, minX = w, minY = A.info.height, maxX = -1, maxY = -1
  for (let y = 0; y < A.info.height; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (IGNORE.some((r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2)) continue
      const i = y * w + x
      if (Math.abs(A.data[i] - B.data[i]) > THRESHOLD) {
        n += 1
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return n ? { 像素: n, 区域: `x${minX}-${maxX} y${minY}-${maxY}`, 画布: `${w}×${A.info.height}` } : null
}

const files = (await readdir(baseDir)).filter((f) => f.endsWith('.png') && f.includes(filter)).sort()
let changed = 0
for (const f of files) {
  const b = join(headDir, f)
  if (!existsSync(b)) { console.log(`  ⚠ ${f.padEnd(30)} 对比目录缺此图`); continue }
  if (NOT_COMPARABLE.some((re) => re.test(f))) {
    console.log(`  ⏭  ${f.padEnd(30)} 内容为实时桌面，不参与像素 diff`)
    continue
  }
  const r = await compare(join(baseDir, f), b)
  if (!r) { console.log(`  ·  ${f.padEnd(30)} 无差异`); continue }
  changed += 1
  console.log(`  ⬛ ${f.padEnd(30)} ${r.尺寸不同 ? '尺寸不同 ' + r.尺寸不同 : `${String(r.像素).padStart(6)} px  ${r.区域}  (${r.画布})`}`)
}
console.log(`\n${files.length} 张里 ${changed} 张有差异`)
