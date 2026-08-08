// SVG sprite 构建插件（V1）
//
// 交付方式受 CSP 硬约束：`default-src 'self'` 不能连任何 CDN；
// `style-src 'self'` 连内联 <style> 和 style= 属性都禁。
// 所以 sprite 必须是**纯结构**的 <svg><symbol>，内联进每个 HTML 入口，
// 图标样式全部走外部 CSS。
//
// 三个 HTML 入口都要注入：index / screenshot / pin——
// 后两个是用户可见的独立窗口，不注入就会成为视觉孤岛。
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ICON_MAP } from './map.mjs'

/** Lucide 的原始 SVG 里这些属性必须去掉，否则会盖过 CSS 的 token 控制。 */
const STRIP_ATTRS = ['class', 'xmlns', 'width', 'height', 'stroke-width']

function buildSprite(root) {
  const dir = join(root, 'node_modules', 'lucide-static', 'icons')
  const symbols = []
  const missing = []
  // ⚠ 按键名排序，保证**确定性**：同样的输入必须产出逐字节相同的 sprite，
  //   否则每次构建 diff 都在变，也没法用哈希校验产物。
  for (const name of Object.keys(ICON_MAP).sort()) {
    const file = join(dir, `${ICON_MAP[name]}.svg`)
    if (!existsSync(file)) { missing.push(`${name} → ${ICON_MAP[name]}`); continue }
    let svg = readFileSync(file, 'utf8')
    svg = svg.replace(/<!--[\s\S]*?-->/g, '')            // 去掉许可证注释，声明统一放 NOTICES
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim()
    const viewBox = (svg.match(/viewBox="([^"]+)"/) || [, '0 0 24 24'])[1]
    symbols.push(
      `<symbol id="ic-${name}" viewBox="${viewBox}" fill="none" ` +
      `stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">` +
      inner.replace(/\s+/g, ' ') +
      `</symbol>`
    )
  }
  if (missing.length) {
    throw new Error(`图标映射里有 Lucide 中不存在的名字：\n  ${missing.join('\n  ')}`)
  }
  // aria-hidden + 零尺寸：sprite 本身不可见、不参与布局、不被读屏念出来
  return `<svg id="icon-sprite" aria-hidden="true" style-free ` +
    `width="0" height="0" focusable="false">${symbols.join('')}</svg>`
}

/** 产物安全自检。CSP 违规要在构建期炸，不能等打包后在运行时才发现。 */
function assertSafe(sprite) {
  const banned = [
    [/<style/i, '<style> 会被 style-src 拦掉'],
    [/\sstyle=/i, 'style= 属性会被 style-src 拦掉'],
    [/<script/i, '脚本节点'],
    [/https?:\/\//i, '外部 URL'],
    [/xlink:href/i, '过时的 xlink:href']
  ]
  for (const [re, why] of banned) {
    if (re.test(sprite)) throw new Error(`sprite 含禁用内容：${why}`)
  }
  const ids = [...sprite.matchAll(/id="(ic-[^"]+)"/g)].map((m) => m[1])
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i)
  if (dupes.length) throw new Error(`symbol id 重复：${[...new Set(dupes)].join(', ')}`)
  if (!/stroke="currentColor"/.test(sprite)) throw new Error('图标未使用 currentColor')
  return ids.length
}

export function spritePlugin(root = process.cwd()) {
  return {
    name: 'moyu-icon-sprite',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const sprite = buildSprite(root).replace(' style-free', '')
        assertSafe(sprite)
        // 注入到 <body> 最前：<use> 只能引用**文档内已存在**的 symbol，
        // 放在末尾的话，首屏渲染那一瞬间图标是空的。
        return html.replace(/<body([^>]*)>/, `<body$1>\n    ${sprite}`)
      }
    }
  }
}

/** 供构建脚本与测试直接调用。 */
export function generateSprite(root = process.cwd()) {
  const sprite = buildSprite(root).replace(' style-free', '')
  const count = assertSafe(sprite)
  return { sprite, count }
}
