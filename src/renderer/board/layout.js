// 统一画布 · 新对象默认排版（U2 / 规格 3.1）
//
// 纯函数，不依赖 DOM 与 fabric，可在 Node 侧直接测试。
//
// 关键约束：**排版必须是确定性的**。
// 每次加入事务开始时只读一次视口并冻结为 layoutViewport，事务中不得因
// 逐张渲染、滚动或异步解码重新取值——否则同一批图片在不同时序下会落到
// 不同位置，用户看到的结果不可复现，也无法写断言。

import { nodeBounds, boundsIntersect } from './scene.js'

/** 规格 3.1 冻结的排版常量。 */
export const LAYOUT = {
  gap: 24,
  /** 图片默认显示尺寸的最大边（世界坐标像素） */
  maxSide: 360,
  /** 可视世界宽度不足时的兜底最小宽度 */
  minFallbackWidth: 120
}

/**
 * 计算一张图片的默认显示尺寸。
 * 保持原比例；最大边固定 360；可视宽度不足时再等比缩到
 * max(120, layoutViewport.width - 48)。
 */
export function defaultImageSize(sourceWidth, sourceHeight, layoutViewport) {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
    throw new Error('图片原始尺寸无效')
  }
  const longest = Math.max(sourceWidth, sourceHeight)
  let scale = Math.min(1, LAYOUT.maxSide / longest)
  let width = sourceWidth * scale
  let height = sourceHeight * scale

  const usable = Math.max(
    LAYOUT.minFallbackWidth,
    (layoutViewport?.width ?? Infinity) - LAYOUT.gap * 2
  )
  if (width > usable) {
    const shrink = usable / width
    width *= shrink
    height *= shrink
  }
  return { width, height }
}

/**
 * 排版游标。
 *
 * 起点 (left+24, top+24)，右边界 right-24；从左到右，每张后 +24。
 * 当 cursorX + width > rightBoundary 且当前行已有对象时换行，
 * 换行落到 previousRowBottom + 24，行高取该行显示高度最大值。
 */
export class LayoutCursor {
  /**
   * @param {object|null} [centerOn] 传入首个元素的尺寸时，第一行从**视口中心**
   *   起排而不是左上角；后续换行仍按原规则向下推进。
   */
  constructor(layoutViewport, centerOn = null) {
    if (!layoutViewport || !Number.isFinite(layoutViewport.x) || !Number.isFinite(layoutViewport.y)) {
      throw new Error('layoutViewport 无效')
    }
    this.viewport = layoutViewport
    this.left = centerOn && centerOn.width > 0
      ? layoutViewport.x + Math.max(LAYOUT.gap, (layoutViewport.width - centerOn.width) / 2)
      : layoutViewport.x + LAYOUT.gap
    this.rightBoundary = layoutViewport.x + layoutViewport.width - LAYOUT.gap
    this.x = this.left
    this.rowTop = centerOn && centerOn.height > 0
      ? layoutViewport.y + Math.max(LAYOUT.gap, (layoutViewport.height - centerOn.height) / 2)
      : layoutViewport.y + LAYOUT.gap
    this.rowHeight = 0
    this.rowCount = 0
  }

  /** 为给定尺寸取下一个候选位置（不做避让，避让由 placeNodes 负责）。 */
  next(width, height) {
    if (this.x + width > this.rightBoundary && this.rowCount > 0) {
      this.newLine()
    }
    const spot = { x: this.x, y: this.rowTop }
    this.x += width + LAYOUT.gap
    this.rowHeight = Math.max(this.rowHeight, height)
    this.rowCount += 1
    return spot
  }

  newLine() {
    this.rowTop = this.rowTop + this.rowHeight + LAYOUT.gap
    this.x = this.left
    this.rowHeight = 0
    this.rowCount = 0
  }
}

/**
 * 为一批新对象求位置，避开事务开始前的已有对象与本批已放对象。
 *
 * @param {Array<{width:number,height:number,rotation?:number}>} incoming 待放置对象的显示尺寸
 * @param {Array<object>} existing 事务开始前场景中的节点（不会被移动）
 * @param {{x:number,y:number,width:number,height:number}} layoutViewport 冻结的可视世界矩形
 * @returns {Array<{x:number,y:number}>} 与 incoming 等长的坐标
 */
/**
 * @param {object} [options]
 *   anchor 'top-left'（批量导入，从左上角起排）| 'center'（截图/单张，落在视口中心附近）
 *
 * 截图必须用 center：从左上角起排时，画布未平移的情况下第一张会落在世界
 * 坐标 (24,24)——看起来就像"固定丢在原点"，而用户当时在看别处。
 */
export function placeNodes(incoming, existing, layoutViewport, options = {}) {
  const { anchor = 'top-left' } = options
  const cursor = new LayoutCursor(layoutViewport, anchor === 'center' ? incoming[0] : null)
  // 已有对象一律不动；本批已放的也要参与避让
  const occupied = existing.map((node) => nodeBounds(node))
  const placed = []

  for (const item of incoming) {
    const { width, height } = item
    let spot = cursor.next(width, height)
    let guard = 0
    // 与任何已占区域相交就继续按同一游标规则右移/换行
    while (
      occupied.some((box) =>
        boundsIntersect(
          nodeBounds({ x: spot.x, y: spot.y, width, height, rotation: item.rotation || 0, type: 'image' }),
          box
        )
      )
    ) {
      guard += 1
      if (guard > 2000) {
        // 极端情况下不无限找位；直接接受当前位置，用户可自行拖开
        break
      }
      spot = cursor.next(width, height)
    }
    const box = nodeBounds({
      x: spot.x, y: spot.y, width, height, rotation: item.rotation || 0, type: 'image'
    })
    occupied.push(box)
    placed.push(spot)
  }
  return placed
}

/**
 * 连续粘贴的错开位置。
 * 鼠标在画布内时以鼠标世界坐标为基准逐次偏移；不在画布内则落到视口中心。
 */
export function pastePosition({ pointer, layoutViewport, size, sequence = 0 }) {
  const offset = (sequence % 8) * LAYOUT.gap
  if (pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
    return { x: pointer.x + offset, y: pointer.y + offset }
  }
  return {
    x: layoutViewport.x + layoutViewport.width / 2 - size.width / 2 + offset,
    y: layoutViewport.y + layoutViewport.height / 2 - size.height / 2 + offset
  }
}
