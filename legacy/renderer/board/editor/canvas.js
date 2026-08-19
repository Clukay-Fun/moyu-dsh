// 全屏图片编辑器 · fabric 绑定层（U4）
//
// 职责边界与 BoardCanvas 一致：只做「交互 → 源图像素坐标的操作」的翻译，
// 不持有真值。真值在 EditorSession，像素在 pipeline。
//
// 生命周期：模态打开时懒创建，关闭时必须 dispose()。
// 全局 fabric 实例数因此是 1（画布）→ 2（编辑中）→ 1（关闭后）。

import { renderPlanToContext } from './pipeline.js'

/** 拖拽小于这个像素数视为误触，不产生操作。 */
const MIN_DRAG_PX = 3

export class FullscreenImageEditorCanvas {
  /**
   * @param {string} elementId  <canvas> 的 id
   * @param {object} deps  fabric · onOperation(tool, params) · onDraftChange()
   */
  constructor(elementId, { fabric, onOperation, onDraftChange, onBlocked }) {
    this.fabric = fabric
    this.onOperation = onOperation || (() => {})
    this.onDraftChange = onDraftChange || (() => {})
    this.onBlocked = onBlocked || (() => {})

    this.canvas = new fabric.Canvas(elementId, {
      selection: false,
      preserveObjectStacking: true,
      renderOnAddRemove: false
    })

    /** 源图（HTMLImageElement / ImageBitmap），像素坐标以它为准 */
    this.source = null
    this.sourceSize = { width: 1, height: 1 }
    /** 显示缩放：显示坐标 ÷ scale = 源像素坐标 */
    this.scale = 1
    this.tool = null
    this.toolOptions = {}

    /** 正在拖的草稿图形；抬手时转成操作并移除 */
    this.draft = null
    this.dragStart = null
    this.doodlePoints = null

    // 用一张离屏画布跑渲染管线，结果作为 fabric 背景
    this.buffer = document.createElement('canvas')
    this.bufferCtx = this.buffer.getContext('2d', { willReadFrequently: true })

    this.#bind()
  }

  // ── 载入与渲染 ──────────────────────────────────────────

  /**
   * 载入源图并按可用区域计算显示尺寸。
   * @param {object} stageSize 可用的 CSS 像素区域
   */
  load(sourceImage, plan, stageSize) {
    this.source = sourceImage
    this.sourceSize = { ...plan.sourceSize }
    this.render(plan, stageSize)
  }

  /** 按当前计划重绘。裁切会改变结果尺寸，所以每次都重算显示缩放。 */
  render(plan, stageSize) {
    if (!this.source) return
    renderPlanToContext(this.bufferCtx, plan, this.source)

    const { width: rw, height: rh } = plan.resultSize
    // 只缩小不放大：小图放大会糊，用户看到的应是真实像素
    const fit = Math.min(stageSize.width / rw, stageSize.height / rh, 1)
    this.scale = fit
    const displayW = Math.max(1, Math.round(rw * fit))
    const displayH = Math.max(1, Math.round(rh * fit))
    this.canvas.setDimensions({ width: displayW, height: displayH })

    // 结果尺寸变了（裁切后），源像素坐标的参照系也随之变成裁切后的图
    this.resultSize = { width: rw, height: rh }

    const bg = new this.fabric.Image(this.buffer, {
      left: 0,
      top: 0,
      scaleX: displayW / rw,
      scaleY: displayH / rh,
      selectable: false,
      evented: false
    })
    this.canvas.setBackgroundImage(bg, () => this.canvas.requestRenderAll())
    this.canvas.requestRenderAll()
  }

  setTool(tool, options = {}) {
    this.tool = tool
    this.toolOptions = { ...options }
    this.#clearDraft()
    this.canvas.defaultCursor = tool ? 'crosshair' : 'default'
    this.canvas.requestRenderAll()
  }

  setToolOptions(options) {
    this.toolOptions = { ...this.toolOptions, ...options }
  }

  /** 有未确认的草稿（如已框选待确认的裁切区）时为 true。 */
  hasDraft() { return Boolean(this.draft) }

  /** 确认当前草稿（裁切专用：框选后需要点「应用裁切」）。 */
  commitDraft() {
    if (!this.draft || this.tool !== 'crop') return null
    const rect = this.#draftRectInSource()
    this.#clearDraft()
    return rect
  }

  cancelDraft() {
    this.#clearDraft()
    this.onDraftChange()
  }

  // ── 交互 ────────────────────────────────────────────────

  #bind() {
    this.canvas.on('mouse:down', (event) => this.#onDown(event))
    this.canvas.on('mouse:move', (event) => this.#onMove(event))
    this.canvas.on('mouse:up', () => this.#onUp())
  }

  /** 显示坐标 → 结果图像素坐标，并钳进图内。 */
  #toSource(point) {
    const x = point.x / this.scale
    const y = point.y / this.scale
    return {
      x: Math.max(0, Math.min(this.resultSize.width, x)),
      y: Math.max(0, Math.min(this.resultSize.height, y))
    }
  }

  #onDown(event) {
    if (!this.tool || this.tool === 'adjust') return
    const pointer = this.canvas.getPointer(event.e)

    // 文字是点击落点，不需要拖拽
    if (this.tool === 'text') {
      const at = this.#toSource(pointer)
      const text = this.toolOptions.text
      // 没填文字就点画布：给可执行提示，而不是静默什么都不发生
      if (!text) { this.onBlocked?.('text'); return }
      this.onOperation('text', { ...this.toolOptions, x: at.x, y: at.y })
      return
    }

    this.#clearDraft()
    this.dragStart = pointer

    const color = this.toolOptions.color || '#e83c8c'
    const lineWidth = this.toolOptions.lineWidth || 3

    if (this.tool === 'doodle') {
      this.doodlePoints = [pointer]
      this.draft = new this.fabric.Polyline([{ x: pointer.x, y: pointer.y }], {
        stroke: color,
        strokeWidth: lineWidth * this.scale,
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: false,
        evented: false,
        objectCaching: false
      })
    } else if (this.tool === 'arrow') {
      this.draft = new this.fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        stroke: color,
        strokeWidth: lineWidth * this.scale,
        strokeLineCap: 'round',
        selectable: false,
        evented: false
      })
    } else {
      // rect / mosaic / crop 都是矩形框选，只是确认后语义不同
      const isCrop = this.tool === 'crop'
      this.draft = new this.fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: isCrop ? 'rgba(105, 120, 230, 0.14)' : 'transparent',
        stroke: isCrop ? '#6978e6' : color,
        strokeWidth: isCrop ? 1 : lineWidth * this.scale,
        strokeDashArray: isCrop ? [4, 3] : null,
        selectable: false,
        evented: false
      })
    }

    this.canvas.add(this.draft)
    this.canvas.requestRenderAll()
  }

  #onMove(event) {
    if (!this.draft || !this.dragStart) return
    const pointer = this.canvas.getPointer(event.e)

    if (this.tool === 'doodle') {
      this.doodlePoints.push(pointer)
      this.draft.set({ points: this.doodlePoints.map((p) => ({ x: p.x, y: p.y })) })
      // Polyline 缓存了包围盒，逐点追加时必须让它重算，否则画到框外就被裁掉
      this.draft.setCoords()
      this.draft.dirty = true
    } else if (this.tool === 'arrow') {
      this.draft.set({ x2: pointer.x, y2: pointer.y })
    } else {
      this.draft.set({
        left: Math.min(this.dragStart.x, pointer.x),
        top: Math.min(this.dragStart.y, pointer.y),
        width: Math.abs(pointer.x - this.dragStart.x),
        height: Math.abs(pointer.y - this.dragStart.y)
      })
    }
    this.canvas.requestRenderAll()
  }

  #onUp() {
    if (!this.draft || !this.dragStart) return

    if (this.tool === 'crop') {
      // 裁切不立即生效：留着草稿等用户按「应用裁切」
      const rect = this.#draftRectInSource()
      if (!rect || rect.width < MIN_DRAG_PX || rect.height < MIN_DRAG_PX) {
        this.#clearDraft()
      }
      this.dragStart = null
      this.onDraftChange()
      return
    }

    const tool = this.tool
    const opts = { ...this.toolOptions }
    let params = null

    if (tool === 'doodle') {
      const points = this.doodlePoints.map((p) => this.#toSource(p))
      if (points.length >= 2) params = { ...opts, points }
    } else if (tool === 'arrow') {
      const a = this.#toSource({ x: this.draft.x1, y: this.draft.y1 })
      const b = this.#toSource({ x: this.draft.x2, y: this.draft.y2 })
      if (Math.hypot(b.x - a.x, b.y - a.y) >= MIN_DRAG_PX) {
        params = { ...opts, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
      }
    } else {
      const rect = this.#draftRectInSource()
      if (rect && rect.width >= MIN_DRAG_PX && rect.height >= MIN_DRAG_PX) {
        params = tool === 'mosaic'
          ? { blockSize: opts.blockSize || 12, region: rect }
          : { ...opts, ...rect }
      }
    }

    this.#clearDraft()
    this.dragStart = null
    if (params) this.onOperation(tool, params)
  }

  #draftRectInSource() {
    if (!this.draft) return null
    const a = this.#toSource({ x: this.draft.left, y: this.draft.top })
    const b = this.#toSource({
      x: this.draft.left + this.draft.width,
      y: this.draft.top + this.draft.height
    })
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }
  }

  #clearDraft() {
    if (this.draft) {
      this.canvas.remove(this.draft)
      this.draft = null
    }
    this.doodlePoints = null
    this.canvas.requestRenderAll()
  }

  /** 导出最终像素。取自渲染管线的离屏缓冲，与预览是同一份结果。 */
  toBlob(type = 'image/png', quality) {
    return new Promise((resolve, reject) => {
      this.buffer.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('图片导出失败'))),
        type,
        quality
      )
    })
  }

  dispose() {
    this.#clearDraft()
    this.canvas.off()
    this.canvas.dispose()
    this.canvas = null
    this.source = null
    this.buffer.width = 0
    this.buffer.height = 0
  }
}
