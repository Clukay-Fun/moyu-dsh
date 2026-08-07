// 全屏图片编辑器 · 会话模型（U4 / 规格 5）
//
// 纯逻辑，不依赖 DOM 与 fabric，可在 Node 侧直接测试。
//
// 关键设计：**来源无关**。
//   双击画布图片、截图即时标注，走的是同一个 EditorSession，
//   同一套工具定义、同一套提交语义。不复制第二份编辑器。
//
// 提交语义（规格 5.2）：
//   · 编辑器内部有独立撤销/重做，可连续叠加操作；
//   · 「完成」生成新资源并替换对象，主画布**只增加一条**历史；
//   · 「取消」丢弃本轮修改，场景、资源仓库、主历史**逐字段不变**。

/** 工具集。截图入口与双击入口共用这一份，不得各自维护。 */
export const EDITOR_TOOLS = [
  'crop', 'adjust', 'mosaic', 'doodle', 'rect', 'arrow', 'text'
]

/**
 * 编辑器里的**动作**（S4）。
 *
 * ⚠ 与 EDITOR_TOOLS 是两类东西，不要合并：
 * · 工具是**模式**——点了会进入待操作状态，有 aria-pressed，产生操作、进撤销栈；
 * · 动作是**一次性执行**——点了立刻做完，无按下态，**不进撤销栈**，也不改像素。
 *
 * 合并成一张表的话，"7 个工具都必须有按下态和操作提示"这类断言会立刻变成
 * 假命题，而它们正是保证工具可用性的那几条。
 */
export const EDITOR_ACTIONS = ['restore', 'ocr']

/**
 * 调色参数。
 * ⚠ 这 8 项是 U6 之前旧图片模块就有的能力，
 *   U4 迁移**不得缩减**成亮度/对比度/饱和度三项。
 */
export const ADJUSTMENT_KEYS = [
  'brightness', 'exposure', 'contrast', 'shadows', 'saturation', 'warmth', 'tint', 'clarity'
]

export const ADJUSTMENT_DEFAULTS = Object.freeze(
  Object.fromEntries(ADJUSTMENT_KEYS.map((k) => [k, 0]))
)

/** 单次编辑的历史上限，与主画布一致。 */
export const EDITOR_HISTORY_LIMIT = 50

let opCounter = 0
export function resetEditorIds() { opCounter = 0 }

/** 构造一个操作。geometry 类操作的参数在此校验，避免脏数据进历史。 */
export function createOperation(tool, params = {}) {
  if (!EDITOR_TOOLS.includes(tool)) throw new Error(`未知编辑工具：${tool}`)
  opCounter += 1
  const op = { id: `op_${opCounter.toString(36)}`, tool, params: { ...params } }

  if (tool === 'crop') {
    for (const key of ['x', 'y', 'width', 'height']) {
      if (!Number.isFinite(op.params[key])) throw new Error(`裁切参数 ${key} 非有限数`)
    }
    if (op.params.width <= 0 || op.params.height <= 0) throw new Error('裁切尺寸必须为正')
  }
  if (tool === 'adjust') {
    for (const key of Object.keys(op.params)) {
      if (!ADJUSTMENT_KEYS.includes(key)) throw new Error(`未知调色参数：${key}`)
      if (!Number.isFinite(op.params[key])) throw new Error(`调色参数 ${key} 非有限数`)
    }
  }
  if (tool === 'mosaic' && !(op.params.blockSize > 0)) {
    throw new Error('马赛克块大小必须为正')
  }
  return op
}

/**
 * 编辑会话。
 *
 * @param {object} init
 *   sourceAssetId 打开时的资源 id（即对象当前 assetId）
 *   sourceSize    { width, height } 源像素尺寸
 *   originNodeId  来自画布时的对象 id；截图入口为 null
 */
export class EditorSession {
  constructor({ sourceAssetId, sourceSize, originNodeId = null, origin = 'canvas' }) {
    if (!sourceAssetId) throw new Error('编辑会话缺少源资源')
    if (!(sourceSize?.width > 0) || !(sourceSize?.height > 0)) {
      throw new Error('编辑会话源尺寸无效')
    }
    this.sourceAssetId = sourceAssetId
    this.sourceSize = { ...sourceSize }
    this.originNodeId = originNodeId
    /** 'canvas'（双击）或 'capture'（截图即时标注）——只影响入口，不影响工具行为 */
    this.origin = origin
    /** 已提交的操作栈 */
    this.stack = []
    /** 指针：stack 中当前生效到第几步（-1 表示原始状态） */
    this.index = -1
    this.activeTool = null
  }

  /** 追加一步。若指针不在末尾（撤销后又操作），丢弃 redo 分支。 */
  apply(tool, params) {
    const op = createOperation(tool, params)
    if (this.index < this.stack.length - 1) {
      this.stack.length = this.index + 1
    }
    this.stack.push(op)
    while (this.stack.length > EDITOR_HISTORY_LIMIT) this.stack.shift()
    this.index = this.stack.length - 1
    return op
  }

  canUndo() { return this.index >= 0 }
  canRedo() { return this.index < this.stack.length - 1 }

  undo() {
    if (!this.canUndo()) return false
    this.index -= 1
    return true
  }

  redo() {
    if (!this.canRedo()) return false
    this.index += 1
    return true
  }

  /** 当前生效的操作序列。渲染管线按此顺序叠加。 */
  operations() {
    return this.stack.slice(0, this.index + 1).map((op) => ({ ...op, params: { ...op.params } }))
  }

  /** 是否有未提交的修改。用于 Esc 时判断要不要提示。 */
  isDirty() { return this.index >= 0 }

  stats() {
    return {
      applied: this.index + 1,
      undo: this.index + 1,
      redo: this.stack.length - 1 - this.index,
      size: this.stack.length,
      limit: EDITOR_HISTORY_LIMIT
    }
  }

  /** 累计的调色参数：多次调色以最后一次为准，未设的项保持默认。 */
  effectiveAdjustments() {
    const result = { ...ADJUSTMENT_DEFAULTS }
    for (const op of this.operations()) {
      if (op.tool !== 'adjust') continue
      for (const [key, value] of Object.entries(op.params)) result[key] = value
    }
    return result
  }

  /** 依次应用裁切后的最终像素尺寸。 */
  resultSize() {
    let size = { ...this.sourceSize }
    for (const op of this.operations()) {
      if (op.tool !== 'crop') continue
      size = { width: op.params.width, height: op.params.height }
    }
    return size
  }
}

// ── 提交与取消 ──────────────────────────────────────────────

/**
 * 计算「完成」后对象应有的几何。
 *
 * 规格 5.2：保持对象**中心点**与**显示宽度**，按新图片比例调整高度，不拉伸。
 * 这样用户看到的是"同一个位置的同一张图，只是内容变了"，而不是跳位或变形。
 */
export function commitGeometry(node, newSize) {
  if (!(newSize?.width > 0) || !(newSize?.height > 0)) throw new Error('新尺寸无效')
  const centerX = node.x + node.width / 2
  const centerY = node.y + node.height / 2
  const width = node.width
  const height = width * (newSize.height / newSize.width)
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height
  }
}

/**
 * 若变化后对象**完全**离开视口，求使其至少部分可见的**最小**平移。
 * 只要还有一点点重叠就不动——不能因为编辑一下就把用户的视口拽走。
 */
export function minimalPanToReveal(box, viewport) {
  const overlapX = box.x < viewport.x + viewport.width && box.x + box.width > viewport.x
  const overlapY = box.y < viewport.y + viewport.height && box.y + box.height > viewport.y
  if (overlapX && overlapY) return { dx: 0, dy: 0 }

  let dx = 0
  let dy = 0
  if (!overlapX) {
    dx = box.x >= viewport.x + viewport.width
      ? box.x - (viewport.x + viewport.width) + 1
      : box.x + box.width - viewport.x - 1
  }
  if (!overlapY) {
    dy = box.y >= viewport.y + viewport.height
      ? box.y - (viewport.y + viewport.height) + 1
      : box.y + box.height - viewport.y - 1
  }
  return { dx, dy }
}

/**
 * 「恢复原图」的几何：同样保持中心与显示宽度。
 * 与 commitGeometry 走同一公式，避免两处口径漂移。
 */
export function restoreGeometry(node, originalSize) {
  return commitGeometry(node, originalSize)
}

/**
 * 计算成功保存后应回收的中间资源。
 *
 * 规格 5.3：按**当前场景 + 原图引用 + 历史引用**统一回收。
 * 三者缺一不可——只看当前场景会把撤销要用的资源删掉，
 * 只看历史会把原图删掉。
 */
export function collectLiveAssets({ scene, historySnapshots = [] }) {
  const live = new Set()
  const visit = (nodes) => {
    for (const node of nodes || []) {
      if (node.assetId) live.add(node.assetId)
      if (node.originalAssetId) live.add(node.originalAssetId)
    }
  }
  visit(scene?.nodes)
  for (const snap of historySnapshots) visit(snap?.nodes)
  return live
}
