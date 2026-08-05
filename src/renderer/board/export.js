// 汇总画布 · 导出 PNG / PDF（F-009 S6）
//
// 本模块的**计算部分不依赖 DOM**，可在 Node 侧直接测试；
// 实际栅格化与 PDF 组装在浏览器侧完成。

import { sceneBounds } from './scene.js'

/**
 * Chromium canvas 上限。
 *
 * ⚠ 这两个数字是在本项目 Electron 里**二分实测**得到的，不是凭记忆写的：
 *   最大边长 65535；宽 4096 时最大高 65535；最大正方形 16384×16384。
 *   → 面积上限 16384² = 268,435,456 px²
 * 实测脚本见提交说明；若将来 Chromium 放宽限制，应重测后再改这里。
 */
export const CANVAS_LIMITS = {
  maxSide: 65535,
  maxArea: 16384 * 16384
}

/** A4 尺寸（pt，1pt = 1/72 in） */
export const A4 = { width: 595.28, height: 841.89 }

export const EXPORT_RANGES = ['content', 'viewport', 'selection']
export const PDF_MODES = ['fit-single', 'a4-landscape', 'a4-portrait']

/** 选中对象的包围盒。 */
export function selectionBounds(scene, ids) {
  const set = new Set(ids)
  const picked = scene.nodes.filter((node) => set.has(node.id))
  if (!picked.length) return { x: 0, y: 0, width: 0, height: 0, empty: true }
  return sceneBounds({ ...scene, nodes: picked })
}

/**
 * 计算导出范围的包围盒。
 * @param {'content'|'viewport'|'selection'} range
 */
export function exportBounds(scene, range, { selection = [], viewport = null } = {}) {
  if (range === 'selection') return selectionBounds(scene, selection)
  if (range === 'viewport') {
    if (!viewport) throw new Error('导出当前视口需要提供视口矩形')
    return { ...viewport, empty: viewport.width <= 0 || viewport.height <= 0 }
  }
  return sceneBounds(scene)
}

/**
 * 规划导出尺寸。
 *
 * 超过 Chromium 上限时**自动降级倍率**而不是抛错——
 * 用户要的是拿到图，不是拿到一条报错。降级会如实报告在 UI 上。
 */
export function planExport(bounds, scale = 1, limits = CANVAS_LIMITS) {
  if (bounds.empty || bounds.width <= 0 || bounds.height <= 0) {
    throw new Error('导出范围为空，请先添加内容或选中对象')
  }
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('导出倍率无效')

  // 三个约束各自给出允许的最大倍率，取最小者
  const byWidth = limits.maxSide / bounds.width
  const byHeight = limits.maxSide / bounds.height
  const byArea = Math.sqrt(limits.maxArea / (bounds.width * bounds.height))
  const maxScale = Math.min(byWidth, byHeight, byArea)

  let appliedScale = scale
  let degraded = false
  let reason = ''
  if (scale > maxScale) {
    appliedScale = maxScale
    degraded = true
    if (maxScale === byArea) reason = '超过画布最大像素面积'
    else reason = '超过画布最大边长'
  }

  // 向下取整到整数像素，保证不越界
  const pixelWidth = Math.max(1, Math.floor(bounds.width * appliedScale))
  const pixelHeight = Math.max(1, Math.floor(bounds.height * appliedScale))
  if (pixelWidth > limits.maxSide || pixelHeight > limits.maxSide ||
      pixelWidth * pixelHeight > limits.maxArea) {
    throw new Error('导出尺寸计算越界，请降低倍率')
  }

  return {
    bounds,
    requestedScale: scale,
    appliedScale,
    degraded,
    reason,
    maxScale,
    pixelWidth,
    pixelHeight,
    megaPixels: Number(((pixelWidth * pixelHeight) / 1e6).toFixed(2))
  }
}

/**
 * 规划 PDF 页面。
 * fit-single：整张画布一页，页面尺寸 = 内容尺寸（pt）。
 * a4-*：按 A4 切分，返回每页在源图上的裁切矩形。
 */
export function planPdfPages(pixelWidth, pixelHeight, mode = 'fit-single') {
  if (!PDF_MODES.includes(mode)) throw new Error(`未知 PDF 模式：${mode}`)
  if (pixelWidth <= 0 || pixelHeight <= 0) throw new Error('PDF 尺寸无效')

  if (mode === 'fit-single') {
    return {
      mode,
      pageWidth: pixelWidth,
      pageHeight: pixelHeight,
      columns: 1,
      rows: 1,
      pages: [{ index: 0, sx: 0, sy: 0, sw: pixelWidth, sh: pixelHeight, dx: 0, dy: 0 }]
    }
  }

  const landscape = mode === 'a4-landscape'
  const pageWidth = landscape ? A4.height : A4.width
  const pageHeight = landscape ? A4.width : A4.height
  // 按页面宽度等比缩放整张图，再纵向切页
  const scale = pageWidth / pixelWidth
  const scaledHeight = pixelHeight * scale
  const rows = Math.max(1, Math.ceil(scaledHeight / pageHeight))

  // 用**累积边界求差**切页，而不是各自取整。
  // 若 sy 独立 round、sh 独立 ceil，累积后会出现 1px 重叠或缝隙。
  const boundary = (i) => Math.round((i * pixelHeight) / rows)
  const pages = []
  for (let row = 0; row < rows; row += 1) {
    const sy = boundary(row)
    const sh = boundary(row + 1) - sy
    pages.push({
      index: row,
      sx: 0,
      sy,
      sw: pixelWidth,
      sh,
      dx: 0,
      dy: 0,
      drawWidth: pageWidth,
      drawHeight: sh * scale
    })
  }
  return { mode, pageWidth, pageHeight, columns: 1, rows, scale, pages }
}

/** 供 UI 展示的一句话摘要。 */
export function describePlan(plan) {
  const size = `${plan.pixelWidth} × ${plan.pixelHeight} px（${plan.megaPixels} 百万像素）`
  if (!plan.degraded) return `${size} · ${plan.requestedScale}x`
  return `${size} · 倍率已从 ${plan.requestedScale}x 降为 ${plan.appliedScale.toFixed(2)}x（${plan.reason}）`
}
