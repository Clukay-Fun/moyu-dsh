// 统一画布 · 标尺刻度、参考线与吸附（U3 / 规格 3.3）
//
// 纯计算，不依赖 DOM 与 fabric，可在 Node 侧直接测试。
//
// 全部辅助元素（标尺、网格、参考线、对齐线）都画在**视口层**，
// 不进场景、不进内容包围盒、不参与导出。本模块只负责算，不负责画。

import { nodeBounds } from './scene.js'

export const RULER = {
  /** 标尺栏尺寸（屏幕像素，恒定，不随画布缩放） */
  sizeX: 20,
  sizeY: 18,
  /** 主刻度屏幕间距的目标区间 */
  minMajorSpacing: 60,
  maxMajorSpacing: 100,
  /** 每个主刻度划分的小刻度数 */
  minorPerMajor: 5
}

export const GRID = {
  /** 网格间距固定为世界坐标 10px */
  step: 10
}

export const SNAP = {
  /** 吸附命中阈值（屏幕像素），换算到世界坐标后使用 */
  thresholdPx: 6
}

/**
 * 自适应主刻度步长。
 *
 * 在 1 / 2 / 5 × 10ⁿ 里挑一个，使其屏幕间距落在 60–100px；
 * 若没有恰好落入区间的，取最接近区间的那个（保证永远有结果）。
 */
export function majorStep(zoom, options = RULER) {
  if (!Number.isFinite(zoom) || zoom <= 0) throw new Error('缩放比例无效')
  const target = (options.minMajorSpacing + options.maxMajorSpacing) / 2
  // 理想世界步长
  const ideal = target / zoom
  const exponent = Math.floor(Math.log10(ideal))
  const candidates = []
  for (const e of [exponent - 1, exponent, exponent + 1]) {
    for (const m of [1, 2, 5]) candidates.push(m * 10 ** e)
  }
  // 优先取屏幕间距落在区间内的最小步长
  const inRange = candidates
    .filter((step) => {
      const spacing = step * zoom
      return spacing >= options.minMajorSpacing && spacing <= options.maxMajorSpacing
    })
    .sort((a, b) => a - b)
  if (inRange.length) return inRange[0]
  // 1/2/5 序列相邻候选的比值最大 2.5×，而 60–100 只有 1.67× 的窗口，
  // 因此必然存在覆盖不到的缩放值（如 zoom=0.25）。
  // 兜底**偏稀疏**：取满足 spacing ≥ 下限的最小步长。
  // 宁可刻度稀一点，也不能密到标签互相重叠。
  const notTooDense = candidates
    .filter((step) => step * zoom >= options.minMajorSpacing)
    .sort((a, b) => a - b)
  if (notTooDense.length) return notTooDense[0]
  // 极端缩放下连最大候选都不够宽，取最大的
  return Math.max(...candidates)
}

/**
 * 生成一条标尺的刻度。
 * @param {'x'|'y'} axis
 * @param {{x:number,y:number,width:number,height:number}} viewport 当前视口的世界矩形
 * @param {number} zoom
 */
export function rulerTicks(axis, viewport, zoom) {
  const step = majorStep(zoom)
  const minor = step / RULER.minorPerMajor
  const start = axis === 'x' ? viewport.x : viewport.y
  const length = axis === 'x' ? viewport.width : viewport.height
  const end = start + length

  const firstMinor = Math.ceil(start / minor) * minor
  const ticks = []
  // 用整数计数推进，避免浮点累加漂移导致刻度错位
  const count = Math.floor((end - firstMinor) / minor) + 1
  for (let i = 0; i < count; i += 1) {
    const world = firstMinor + i * minor
    // 主刻度判定同样走整数比，不用取模浮点
    const ratio = world / step
    const isMajor = Math.abs(ratio - Math.round(ratio)) < 1e-9
    ticks.push({
      world,
      screen: (world - start) * zoom,
      major: isMajor,
      label: isMajor ? formatTickLabel(world) : null
    })
  }
  return { step, minor, ticks }
}

/** 刻度文字：整数直接显示，允许负数；小步长时保留必要小数。 */
export function formatTickLabel(world) {
  const rounded = Math.round(world)
  if (Math.abs(world - rounded) < 1e-9) return String(rounded)
  return String(Number(world.toFixed(2)))
}

// ── 参考线 ──────────────────────────────────────────────────

let guideCounter = 0
export function resetGuideIds() { guideCounter = 0 }

/**
 * 参考线只有两种：水平（记 y）与垂直（记 x）。
 * 位置存**世界坐标**，这样缩放平移后仍钉在同一处。
 */
export function createGuide(orientation, position) {
  if (orientation !== 'horizontal' && orientation !== 'vertical') {
    throw new Error(`未知参考线方向：${orientation}`)
  }
  if (!Number.isFinite(position)) throw new Error('参考线位置必须为有限数')
  guideCounter += 1
  return { id: `g_${guideCounter.toString(36)}`, orientation, position }
}

export function moveGuide(guides, id, position) {
  const guide = guides.find((g) => g.id === id)
  if (!guide) throw new Error(`参考线不存在：${id}`)
  if (!Number.isFinite(position)) throw new Error('参考线位置必须为有限数')
  guide.position = position
  return guide
}

export function removeGuide(guides, id) {
  const at = guides.findIndex((g) => g.id === id)
  if (at < 0) throw new Error(`参考线不存在：${id}`)
  return guides.splice(at, 1)[0]
}

/**
 * 拖回标尺即删除。
 * 判据用**屏幕坐标**：拖到标尺栏之内就算拖回。
 */
export function shouldDropGuide(orientation, screenPosition) {
  return orientation === 'horizontal'
    ? screenPosition <= RULER.sizeY
    : screenPosition <= RULER.sizeX
}

export function validateGuides(guides) {
  if (!Array.isArray(guides)) throw new Error('参考线数据必须是数组')
  const ids = new Set()
  for (const guide of guides) {
    if (ids.has(guide.id)) throw new Error(`参考线 id 重复：${guide.id}`)
    ids.add(guide.id)
    if (guide.orientation !== 'horizontal' && guide.orientation !== 'vertical') {
      throw new Error(`参考线 ${guide.id} 方向无效：${guide.orientation}`)
    }
    if (!Number.isFinite(guide.position)) {
      throw new Error(`参考线 ${guide.id} 位置非有限数`)
    }
  }
  return guides
}

// ── 吸附 ────────────────────────────────────────────────────

/**
 * 对象的六个对齐参考值：左/中/右、上/中/下。
 * 用旋转感知包围盒，保证旋转对象也按视觉边界对齐。
 */
export function alignmentEdges(node) {
  const box = nodeBounds(node)
  return {
    x: [box.x, box.x + box.width / 2, box.x + box.width],
    y: [box.y, box.y + box.height / 2, box.y + box.height]
  }
}

/**
 * 计算一次拖动的吸附结果。
 *
 * 阈值以**屏幕像素**定义，再换算到世界坐标——这样在任何缩放级别下，
 * 手感一致，且同一世界坐标处的吸附点不会因缩放而漂移。
 *
 * @returns {{dx:number, dy:number, lines:Array}} 需要施加的位移与对齐线
 */
export function computeSnap({
  movingBounds,
  others = [],
  guides = [],
  zoom = 1,
  snapObjects = true,
  snapGrid = false,
  gridStep = GRID.step,
  thresholdPx = SNAP.thresholdPx
}) {
  const threshold = thresholdPx / zoom
  const moving = {
    x: [movingBounds.x, movingBounds.x + movingBounds.width / 2, movingBounds.x + movingBounds.width],
    y: [movingBounds.y, movingBounds.y + movingBounds.height / 2, movingBounds.y + movingBounds.height]
  }

  const candidates = { x: [], y: [] }
  if (snapObjects) {
    for (const node of others) {
      const edges = alignmentEdges(node)
      candidates.x.push(...edges.x)
      candidates.y.push(...edges.y)
    }
    for (const guide of guides) {
      if (guide.orientation === 'vertical') candidates.x.push(guide.position)
      else candidates.y.push(guide.position)
    }
  }

  const pick = (axis) => {
    let best = null
    for (const [index, value] of moving[axis].entries()) {
      for (const target of candidates[axis]) {
        const delta = target - value
        if (Math.abs(delta) > threshold) continue
        if (!best || Math.abs(delta) < Math.abs(best.delta)) {
          best = { delta, target, edgeIndex: index }
        }
      }
      if (snapGrid) {
        const snapped = Math.round(value / gridStep) * gridStep
        const delta = snapped - value
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, target: snapped, edgeIndex: index, grid: true }
        }
      }
    }
    return best
  }

  const bestX = pick('x')
  const bestY = pick('y')
  const lines = []
  if (bestX) lines.push({ orientation: 'vertical', position: bestX.target, grid: Boolean(bestX.grid) })
  if (bestY) lines.push({ orientation: 'horizontal', position: bestY.target, grid: Boolean(bestY.grid) })

  return { dx: bestX ? bestX.delta : 0, dy: bestY ? bestY.delta : 0, lines }
}

// ── 网格 ────────────────────────────────────────────────────

/** 当前视口内的网格线世界坐标。缩放很小时不必画满，交由调用方决定是否绘制。 */
export function gridLines(viewport, step = GRID.step) {
  const xs = []
  const ys = []
  const firstX = Math.ceil(viewport.x / step) * step
  const firstY = Math.ceil(viewport.y / step) * step
  for (let x = firstX; x <= viewport.x + viewport.width; x += step) xs.push(x)
  for (let y = firstY; y <= viewport.y + viewport.height; y += step) ys.push(y)
  return { xs, ys }
}
