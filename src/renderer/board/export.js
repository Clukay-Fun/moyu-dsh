// 汇总画布 · 导出 PNG / JPG（U6 / 规格 8.2）
//
// 本模块的**计算部分不依赖 DOM**，可在 Node 侧直接测试；
// 实际栅格化在浏览器侧完成。
//
// U6 收敛：只出 PNG 与 JPG，不出 PDF；范围只有"全部内容"与"选中对象"，
// 不提供当前视口；不提供用户倍率。少一个旋钮就少一类错误配置，
// 而这三项在实际使用里都没有明确用途。

import { sceneBounds, unionBounds } from './scene.js'

/**
 * Chromium canvas 上限。
 *
 * ⚠ 这两个数字是在本项目 Electron 里**二分实测**得到的，不是凭记忆写的：
 *   最大边长 65535；宽 4096 时最大高 65535；最大正方形 16384×16384。
 *   → 面积上限 16384² = 268,435,456 px²
 * 若将来 Chromium 放宽限制，应重测后再改这里。
 */
export const CANVAS_LIMITS = {
  maxSide: 65535,
  maxArea: 16384 * 16384
}

export const EXPORT_RANGES = ['content', 'selection']
export const EXPORT_FORMATS = ['png', 'jpg']

/**
 * 选中对象的包围盒。
 * 走 unionBounds → nodeBounds，与 sceneBounds、适应窗口、吸附同一口径，
 * 旋转对象不会被裁掉（规格 8.3）。
 */
export function selectionBounds(scene, ids) {
  const set = new Set(ids)
  const picked = scene.nodes.filter((node) => set.has(node.id))
  if (!picked.length) return { x: 0, y: 0, width: 0, height: 0, empty: true }
  return unionBounds(picked)
}

/**
 * 计算导出范围的包围盒。边距为 0——所见即所得，不额外留白（规格 8.2）。
 * @param {'content'|'selection'} range
 */
export function exportBounds(scene, range, { selection = [] } = {}) {
  if (!EXPORT_RANGES.includes(range)) throw new Error(`未知导出范围：${range}`)
  if (range === 'selection') return selectionBounds(scene, selection)
  return sceneBounds(scene)
}

/**
 * 规划导出。
 *
 * ⚠ 超限时**不自动降级**（规格 8.2）。
 *   旧实现直接改写 appliedScale 再继续栅格化，用户拿到的是一张悄悄
 *   缩小过的图，而他并不知道。现在改为返回 needsConfirmation + 原始
 *   尺寸 + 限制原因 + 建议比例，由 UI 问过用户之后，才带着
 *   `confirmedScale` 进第二阶段规划。
 *
 * @param {object} bounds 导出范围
 * @param {object} [options]
 *   confirmedScale 用户确认后的比例；未确认时不传
 */
export function planExport(bounds, options = {}, limits = CANVAS_LIMITS) {
  const { confirmedScale = null } = options
  if (bounds.empty || bounds.width <= 0 || bounds.height <= 0) {
    throw new Error('导出范围为空，请先添加内容或选中对象')
  }

  // 三个约束各自给出允许的最大比例，取最小者
  const byWidth = limits.maxSide / bounds.width
  const byHeight = limits.maxSide / bounds.height
  const byArea = Math.sqrt(limits.maxArea / (bounds.width * bounds.height))
  const maxScale = Math.min(byWidth, byHeight, byArea)

  const originalWidth = Math.max(1, Math.round(bounds.width))
  const originalHeight = Math.max(1, Math.round(bounds.height))

  if (confirmedScale === null && maxScale < 1) {
    // 第一阶段：只报告，不渲染，不改写任何比例
    return {
      status: 'needsConfirmation',
      bounds,
      originalWidth,
      originalHeight,
      suggestedScale: maxScale,
      reason: maxScale === byArea ? '超过画布最大像素面积' : '超过画布最大边长',
      limits
    }
  }

  const scale = confirmedScale === null ? 1 : confirmedScale
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('导出比例无效')
  if (scale > maxScale) {
    throw new Error(`导出比例 ${scale} 超过可用上限 ${maxScale.toFixed(4)}`)
  }

  // 向下取整到整数像素，保证不越界
  const pixelWidth = Math.max(1, Math.floor(bounds.width * scale))
  const pixelHeight = Math.max(1, Math.floor(bounds.height * scale))
  if (pixelWidth > limits.maxSide || pixelHeight > limits.maxSide ||
      pixelWidth * pixelHeight > limits.maxArea) {
    throw new Error('导出尺寸计算越界')
  }

  return {
    status: 'ready',
    bounds,
    originalWidth,
    originalHeight,
    appliedScale: scale,
    scaled: scale !== 1,
    pixelWidth,
    pixelHeight,
    megaPixels: Number(((pixelWidth * pixelHeight) / 1e6).toFixed(2))
  }
}

/**
 * 导出时的底色。
 *
 * PNG 透明背景保留透明；JPG 不支持 alpha，透明背景自动铺白，
 * 否则解码端会把未定义的 alpha 渲成黑块（规格 8.2）。
 * @returns {string|null} null 表示不填充（保留透明）
 */
export function exportFillColor(background, format) {
  if (!EXPORT_FORMATS.includes(format)) throw new Error(`未知导出格式：${format}`)
  const transparent = !background || background.type === 'transparent'
  if (!transparent) return background.color
  return format === 'jpg' ? '#ffffff' : null
}

/** MIME 类型。 */
export function exportMime(format) {
  if (!EXPORT_FORMATS.includes(format)) throw new Error(`未知导出格式：${format}`)
  return format === 'png' ? 'image/png' : 'image/jpeg'
}

/**
 * 导出格式 → 主进程 `image:save-file` 的 `type`。
 *
 * ⚠ 两边命名**故意不同**：用户可见的是 `jpg`（扩展名），
 * 主进程 `IMAGE_FILE_TYPES` 的键是 `jpeg`（格式名）。
 * 直接把 `'jpg'` 传过去会被判成「不支持的图片文件数据」，
 * 而 png 两边同名，所以只测 png 永远发现不了。必须经此转换。
 */
export function exportFileType(format) {
  if (!EXPORT_FORMATS.includes(format)) throw new Error(`未知导出格式：${format}`)
  return format === 'png' ? 'png' : 'jpeg'
}

/**
 * 默认文件名（规格 8.2）。
 * 已保存工程用工程名；未保存用 `画布-YYYYMMDD-HHmmss`；选中导出加 `-选中`。
 */
export function exportFileName({ projectPath = null, range = 'content', at = new Date() } = {}) {
  let base
  if (projectPath) {
    base = projectPath.split(/[\\/]/).pop().replace(/\.moyuboard$/i, '')
  } else {
    const pad = (n) => String(n).padStart(2, '0')
    base = `画布-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
      `-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
  }
  return range === 'selection' ? `${base}-选中` : base
}

/** 供 UI 展示的一句话摘要。缩小过时必须显示**实际比例**。 */
export function describePlan(plan) {
  if (plan.status === 'needsConfirmation') {
    return `${plan.originalWidth} × ${plan.originalHeight} px ${plan.reason}，` +
      `可等比缩小到 ${(plan.suggestedScale * 100).toFixed(1)}%`
  }
  const size = `${plan.pixelWidth} × ${plan.pixelHeight} px（${plan.megaPixels} 百万像素）`
  if (!plan.scaled) return size
  return `${size} · 原始 ${plan.originalWidth} × ${plan.originalHeight} px，` +
    `已按 ${(plan.appliedScale * 100).toFixed(1)}% 缩小`
}
