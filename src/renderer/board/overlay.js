// 统一画布 · 辅助层绘制（U3）
//
// 只负责画：标尺、网格、参考线、对齐线。
// 全部画在**视口层**——不进 fabric 场景、不进内容包围盒、不参与导出。
// 所有计算来自 guides.js，本模块不重算几何。

import { rulerTicks, gridLines, RULER, GRID } from './guides.js'

/** 屏幕尺寸恒定的辅助层。DPR 变化时重建后备缓冲。 */
export class BoardOverlay {
  constructor({ overlayCanvas, rulerX, rulerY }) {
    this.overlay = overlayCanvas
    this.rulerX = rulerX
    this.rulerY = rulerY
    // 标尺内部各放一张 canvas，避免用大量 DOM 节点画刻度
    this.rulerXCanvas = document.createElement('canvas')
    this.rulerYCanvas = document.createElement('canvas')
    this.rulerX.append(this.rulerXCanvas)
    this.rulerY.append(this.rulerYCanvas)
    this.theme = { line: 'rgba(65, 68, 90, 0.16)', major: 'rgba(65, 68, 90, 0.42)', text: '#9da0b3', grid: 'rgba(65, 68, 90, 0.07)' }
  }

  setTheme(dark) {
    this.theme = dark
      ? { line: 'rgba(255,255,255,0.12)', major: 'rgba(255,255,255,0.32)', text: '#777b91', grid: 'rgba(255,255,255,0.06)' }
      : { line: 'rgba(65, 68, 90, 0.16)', major: 'rgba(65, 68, 90, 0.42)', text: '#9da0b3', grid: 'rgba(65, 68, 90, 0.07)' }
  }

  #fit(canvas, cssWidth, cssHeight) {
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(cssWidth * dpr))
    const h = Math.max(1, Math.round(cssHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)
    return ctx
  }

  /**
   * 重绘全部辅助元素。
   * @param {object} state
   *   viewport 世界矩形 · zoom · guides · alignLines · showGrid · stageSize
   */
  render({ viewport, zoom, guides = [], alignLines = [], showGrid = false, stage }) {
    if (!stage || stage.width < 2 || stage.height < 2) return
    this.#renderRulers(viewport, zoom, stage)
    this.#renderOverlay(viewport, zoom, guides, alignLines, showGrid, stage)
  }

  #renderRulers(viewport, zoom, stage) {
    const toScreenX = (world) => (world - viewport.x) * zoom
    const toScreenY = (world) => (world - viewport.y) * zoom

    // 顶部标尺
    const xw = Math.max(1, stage.width - RULER.sizeX)
    const cx = this.#fit(this.rulerXCanvas, xw, RULER.sizeY)
    cx.font = '9px system-ui, sans-serif'
    cx.textBaseline = 'top'
    const xt = rulerTicks('x', viewport, zoom)
    for (const tick of xt.ticks) {
      const sx = Math.round(toScreenX(tick.world) - RULER.sizeX) + 0.5
      if (sx < 0 || sx > xw) continue
      cx.strokeStyle = tick.major ? this.theme.major : this.theme.line
      cx.beginPath()
      cx.moveTo(sx, tick.major ? 4 : 11)
      cx.lineTo(sx, RULER.sizeY)
      cx.stroke()
      if (tick.major) {
        cx.fillStyle = this.theme.text
        cx.fillText(tick.label, sx + 2, 1)
      }
    }

    // 左侧标尺：文字竖排，仍保持屏幕尺寸
    const yh = Math.max(1, stage.height - RULER.sizeY)
    const cy = this.#fit(this.rulerYCanvas, RULER.sizeX, yh)
    cy.font = '9px system-ui, sans-serif'
    cy.textBaseline = 'top'
    const yt = rulerTicks('y', viewport, zoom)
    for (const tick of yt.ticks) {
      const sy = Math.round(toScreenY(tick.world) - RULER.sizeY) + 0.5
      if (sy < 0 || sy > yh) continue
      cy.strokeStyle = tick.major ? this.theme.major : this.theme.line
      cy.beginPath()
      cy.moveTo(tick.major ? 4 : 11, sy)
      cy.lineTo(RULER.sizeX, sy)
      cy.stroke()
      if (tick.major) {
        cy.save()
        cy.translate(1, sy + 2)
        cy.rotate(-Math.PI / 2)
        cy.fillStyle = this.theme.text
        cy.textAlign = 'right'
        cy.fillText(tick.label, 0, 0)
        cy.restore()
      }
    }
  }

  #renderOverlay(viewport, zoom, guides, alignLines, showGrid, stage) {
    const ctx = this.#fit(this.overlay, stage.width, stage.height)
    const toScreenX = (world) => (world - viewport.x) * zoom
    const toScreenY = (world) => (world - viewport.y) * zoom

    // 网格：缩放过小时线会糊成一片，低于 4px 间距就不画
    if (showGrid && GRID.step * zoom >= 4) {
      const { xs, ys } = gridLines(viewport)
      // ⚠ 用 grid 而不是 line：line 同时在画标尺刻度，调淡它会把刻度一起调没。
      //   网格要比棋盘格和参考线都淡，三者叠在一起时才分得清谁是谁。
      ctx.strokeStyle = this.theme.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const x of xs) {
        const sx = Math.round(toScreenX(x)) + 0.5
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, stage.height)
      }
      for (const y of ys) {
        const sy = Math.round(toScreenY(y)) + 0.5
        ctx.moveTo(0, sy)
        ctx.lineTo(stage.width, sy)
      }
      ctx.stroke()
    }

    // 参考线：常驻，青色
    ctx.strokeStyle = 'rgba(0, 170, 200, 0.85)'
    ctx.lineWidth = 1
    for (const guide of guides) {
      ctx.beginPath()
      if (guide.orientation === 'vertical') {
        const sx = Math.round(toScreenX(guide.position)) + 0.5
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, stage.height)
      } else {
        const sy = Math.round(toScreenY(guide.position)) + 0.5
        ctx.moveTo(0, sy)
        ctx.lineTo(stage.width, sy)
      }
      ctx.stroke()
    }

    // 对齐线：仅拖动期间出现，洋红虚线
    if (alignLines.length) {
      ctx.save()
      ctx.strokeStyle = 'rgba(232, 60, 140, 0.9)'
      ctx.setLineDash([4, 3])
      for (const line of alignLines) {
        ctx.beginPath()
        if (line.orientation === 'vertical') {
          const sx = Math.round(toScreenX(line.position)) + 0.5
          ctx.moveTo(sx, 0)
          ctx.lineTo(sx, stage.height)
        } else {
          const sy = Math.round(toScreenY(line.position)) + 0.5
          ctx.moveTo(0, sy)
          ctx.lineTo(stage.width, sy)
        }
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  /** 标尺上的屏幕坐标 → 世界坐标（用于从标尺拖出参考线）。 */
  static screenToWorld(axis, screenPos, viewport, zoom) {
    return axis === 'x'
      ? viewport.x + (screenPos - RULER.sizeX) / zoom
      : viewport.y + (screenPos - RULER.sizeY) / zoom
  }

  dispose() {
    this.rulerXCanvas.remove()
    this.rulerYCanvas.remove()
  }
}
