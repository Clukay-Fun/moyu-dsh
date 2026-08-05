// 汇总画布 · fabric 绑定层（F-009）
//
// 职责边界：
//   scene.js 是**真值**；本模块只做两件事——
//     ① 把场景图画成 fabric 对象；
//     ② 把用户交互（拖动/缩放/选中）写回场景图。
//   任何几何计算都不在这里做第二遍，避免两处真值漂移。

import {
  nodesByZ,
  setNodePosition,
  resizeNode,
  setNodeText,
  setNodeMetrics,
  isTextNode,
  isNodeLocked,
  setNodeRotation,
  setNodeScale,
  nodeDisplaySize,
  edgePathPoints,
  NODE_TYPES
} from './scene.js'

export class BoardCanvas {
  /**
   * @param {string} elementId canvas 元素 id
   * @param {{ fabric: object, onChange: (reason: string) => void, onSelection: (ids: string[]) => void }} options
   */
  constructor(elementId, { fabric, onChange, onSelection }) {
    this.fabric = fabric
    this.onChange = onChange || (() => {})
    this.onSelection = onSelection || (() => {})
    this.scene = null
    this.store = null
    /** assetId → objectURL，卸载时统一回收，避免内存泄漏 */
    this.assetUrls = new Map()
    /** nodeId → fabric 对象 */
    this.objects = new Map()
    this.suspendSync = false

    this.canvas = new fabric.Canvas(elementId, {
      backgroundColor: '#ffffff',
      preserveObjectStacking: true, // 选中不改变 z 序：z 序只由场景图决定
      selection: true
    })

    this.canvas.on('object:modified', (event) => {
      this.#writeBack(event)
      this.onObjectMoved?.()
    })
    // 拖动过程中实时吸附：把 fabric 的临时位置换算成世界包围盒交给上层。
    //
    // ⚠ 必须用**变换后的四角**，不能用 left/top + 未旋转的 width×height。
    //   后者对旋转对象给出的是错的框（45° 时差得最明显），
    //   与场景侧旋转感知的 nodeBounds() 口径也对不上，
    //   于是对齐线画在一处、实际吸附到另一处。
    this.canvas.on('object:moving', (event) => {
      const object = event.target
      if (!object?.boardNodeId || !this.onObjectMoving) return
      object.setCoords()
      const rect = object.getBoundingRect(true, true)
      const snap = this.onObjectMoving(object.boardNodeId, {
        x: rect.left, y: rect.top, width: rect.width, height: rect.height
      })
      if (snap && (snap.dx || snap.dy)) {
        object.set({ left: object.left + snap.dx, top: object.top + snap.dy })
        object.setCoords()
      }
    })
    // 双击图片进全屏编辑器（U4 / 规格 5.1）。
    // 文本对象的双击归 fabric 自己（进入行内编辑），这里只接图片。
    this.canvas.on('mouse:dblclick', (event) => {
      const object = event.target
      if (!object?.boardNodeId || object.boardNodeType !== 'image') return
      this.onImageDoubleClick?.(object.boardNodeId)
    })
    this.canvas.on('selection:created', () => this.#emitSelection())
    this.canvas.on('selection:updated', () => this.#emitSelection())
    this.canvas.on('selection:cleared', () => this.#emitSelection())
    // 文本编辑结束：把内容与排版后的真实尺寸一并写回场景图
    this.canvas.on('text:editing:exited', (event) => this.#writeBackText(event?.target))
    this.canvas.on('mouse:wheel', (opt) => {
      const event = opt.e
      event.preventDefault()
      event.stopPropagation()
      this.onWheelZoom?.(event.deltaY, { x: event.offsetX, y: event.offsetY })
    })
    // 中键或按住空格拖拽平移
    this.spaceDown = false
    this.panning = null
    document.addEventListener('keydown', (e) => { if (e.code === 'Space') this.spaceDown = true })
    document.addEventListener('keyup', (e) => { if (e.code === 'Space') this.spaceDown = false })
    this.canvas.on('mouse:down', (opt) => {
      if (opt.e.button === 1 || this.spaceDown) {
        this.panning = { x: opt.e.clientX, y: opt.e.clientY }
        this.canvas.selection = false
      }
    })
    this.canvas.on('mouse:move', (opt) => {
      if (!this.panning) return
      this.pan(opt.e.clientX - this.panning.x, opt.e.clientY - this.panning.y)
      this.panning = { x: opt.e.clientX, y: opt.e.clientY }
    })
    this.canvas.on('mouse:up', () => {
      this.panning = null
      this.canvas.selection = true
    })
  }

  attach(scene, store) {
    this.scene = scene
    this.store = store
  }

  #emitSelection() {
    this.onSelection(this.getSelectedIds())
  }

  getSelectedIds() {
    const active = this.canvas.getActiveObjects?.() || []
    return active.map((object) => object.boardNodeId).filter(Boolean)
  }

  /**
   * 把对象改成**绕中心旋转**，与场景模型对齐。
   *
   * 所有 #createObject 出来的对象都要过这一道；创建时写的
   * originX/originY: 'left'/'top' 只是摆放用的中间态。
   *
   * fabric 绕 originX/originY 指定的点旋转。若保留 left/top 原点，
   * 对象在画面上绕**左上角**转，而 nodeBounds()、导出包围盒、吸附
   * 全都按**绕中心**算——两套几何一分叉，45° 对象能差出半条对角线
   * （200×200 时是 141px）。于是对齐线画在一处、对象吸附到另一处。
   *
   * 尺寸取渲染后的实际值而非 node.width/height：文本框的高度由 fabric
   * 排版决定，创建时 node.height 可能还是上一次的值。
   */
  #useCenterOrigin(object, node) {
    const width = object.width * (object.scaleX || 1)
    const height = object.height * (object.scaleY || 1)
    object.set({
      originX: 'center',
      originY: 'center',
      left: node.x + width / 2,
      top: node.y + height / 2,
      angle: node.rotation || 0
    })
    object.setCoords()
  }

  /** 交互结果写回场景图。fabric 用 left/top/scale，场景图用 x/y/width/height。 */
  #writeBack(event) {
    if (!this.scene || this.suspendSync) return
    const targets = event?.target?.type === 'activeSelection'
      ? event.target.getObjects()
      : [event?.target].filter(Boolean)

    for (const object of targets) {
      const nodeId = object.boardNodeId
      if (!nodeId) continue
      const sceneNode = this.scene.nodes.find((n) => n.id === nodeId)
      // 锁定对象在多选变换中自动跳过（规格 3.2）
      if (isNodeLocked(sceneNode)) continue
      const width = object.width * object.scaleX * (event?.target?.scaleX ?? 1)
      const height = object.height * object.scaleY * (event?.target?.scaleY ?? 1)

      // 多选时 fabric 的子对象坐标是相对于选区的，必须换算成画布绝对坐标。
      // 对象原点已是中心，所以矩阵的平移分量就是绝对中心。
      const matrix = object.calcTransformMatrix()
      const center = this.fabric.util.transformPoint(new this.fabric.Point(0, 0), matrix)
      // node.x/y 存的是**未旋转**框的左上角，由中心反推
      setNodePosition(this.scene, nodeId, center.x - width / 2, center.y - height / 2)

      // 旋转角度写回（多选时 fabric 的子对象 angle 是相对选区的）
      const angle = (object.angle || 0) + (event?.target?.type === 'activeSelection' ? (event.target.angle || 0) : 0)
      if (Number.isFinite(angle)) setNodeRotation(this.scene, nodeId, angle)

      if (width > 0 && height > 0) {
        if (isTextNode(sceneNode)) {
          // 文本框：缩放只改 scale，不动基础字号与基础宽高（规格 4）
          const scale = width / (sceneNode.width || 1)
          if (Number.isFinite(scale) && scale > 0) setNodeScale(this.scene, nodeId, scale)
        } else {
          resizeNode(this.scene, nodeId, { width, height })
        }
      }
    }
    // 只通知，不在这里再画一次。
    // onChange 会走到 controller 的 #afterChange，那里已经 await canvas.render()；
    // 若此处再直接 render，图片是异步加载的，两次渲染会交错，
    // 可能出现闪烁、选中态错乱或旧渲染覆盖新渲染。
    this.onChange('transform')
  }

  #writeBackText(object) {
    if (!this.scene || !object?.boardNodeId || this.suspendSync) return
    setNodeText(this.scene, object.boardNodeId, object.text ?? '')
    // 文本真实宽高只有排版后才知道，必须回填，否则包围盒、连接线锚点、
    // 导出尺寸都会用估算值。
    setNodeMetrics(this.scene, object.boardNodeId, {
      width: object.width * (object.scaleX || 1),
      height: object.height * (object.scaleY || 1)
    })
    // 同 #writeBack：渲染统一由 #afterChange 负责，此处不再直接 render
    this.onChange('text')
  }

  #assetUrl(assetId) {
    if (this.assetUrls.has(assetId)) return this.assetUrls.get(assetId)
    const bytes = this.store?.get(assetId)
    if (!bytes) throw new Error(`资源二进制缺失：${assetId}`)
    const meta = this.scene.assets[assetId]
    const url = URL.createObjectURL(new Blob([bytes], { type: meta?.mime || 'image/png' }))
    this.assetUrls.set(assetId, url)
    return url
  }

  #releaseUnusedUrls() {
    for (const [assetId, url] of this.assetUrls) {
      if (!this.scene.assets[assetId]) {
        URL.revokeObjectURL(url)
        this.assetUrls.delete(assetId)
      }
    }
  }

  /** 按场景图重建全部 fabric 对象。节点规模为几十量级，全量重建足够。 */
  async render() {
    if (!this.scene) return
    this.suspendSync = true
    const selected = new Set(this.getSelectedIds())
    this.canvas.discardActiveObject()
    this.canvas.clear()
    this.canvas.backgroundColor = '#ffffff'
    this.objects.clear()
    this.#releaseUnusedUrls()

    for (const node of nodesByZ(this.scene)) {
      const object = await this.#createObject(node)
      if (!object) continue
      this.#useCenterOrigin(object, node)
      object.boardNodeId = node.id
      object.boardNodeType = node.type
      this.objects.set(node.id, object)
      this.canvas.add(object)
    }

    // 连接线画在所有节点之上，保证跨节点时不被遮住；本身不可选中不可拖动，
    // 位置完全由两端节点决定（选中/删除通过端点节点或专用按钮完成）。
    this.edgeObjects = []
    for (const edge of this.scene.edges) {
      const object = this.#createEdgeObject(edge)
      if (!object) continue
      object.boardEdgeId = edge.id
      this.edgeObjects.push(object)
      this.canvas.add(object)
    }

    // 还原选中态
    const restore = [...this.objects.values()].filter((o) => selected.has(o.boardNodeId))
    if (restore.length === 1) {
      this.canvas.setActiveObject(restore[0])
    } else if (restore.length > 1) {
      const selection = new this.fabric.ActiveSelection(restore, { canvas: this.canvas })
      // 规格 2.1：多选只允许整体移动与等比缩放，不允许整体旋转
      selection.set({ lockRotation: true, lockUniScaling: true })
      selection.setControlsVisibility({ mtr: false })
      this.canvas.setActiveObject(selection)
    }

    this.canvas.requestRenderAll()
    this.suspendSync = false
    // 量测只回填数据，不再触发重画，避免与 render 互相递归
    this.measureTextNodes()
  }

  #createObject(node) {
    if (node.type === NODE_TYPES.IMAGE) {
      return new Promise((resolve) => {
        this.fabric.Image.fromURL(
          this.#assetUrl(node.assetId),
          (image) => {
            if (!image) return resolve(null)
            const asset = this.scene.assets[node.assetId]
            const locked = isNodeLocked(node)
            image.set({
              left: node.x,
              top: node.y,
              originX: 'left',
              originY: 'top',
              scaleX: node.width / (asset?.width || image.width || 1),
              scaleY: node.height / (asset?.height || image.height || 1),
              angle: node.rotation || 0,
              // 规格 2.1：单选图片提供 8 个缩放点 + 正上方旋转柄
              lockUniScaling: false,
              hasControls: !locked,
              lockMovementX: locked,
              lockMovementY: locked,
              lockRotation: locked,
              lockScalingX: locked,
              lockScalingY: locked,
              selectable: true,
              hoverCursor: locked ? 'not-allowed' : 'move'
            })
            image.setControlsVisibility({
              tl: true, tr: true, bl: true, br: true,
              ml: true, mr: true, mt: true, mb: true,
              mtr: !locked
            })
            resolve(image)
          },
          { crossOrigin: 'anonymous' }
        )
      })
    }

    if (node.type === NODE_TYPES.TEXT) {
      const object = new this.fabric.IText(node.text, {
        left: node.x,
        top: node.y,
        originX: 'left',
        originY: 'top',
        angle: node.rotation || 0,
        fontSize: node.style.fontSize,
        fill: node.style.fill,
        fontWeight: node.style.fontWeight,
        textAlign: node.style.textAlign,
        fontFamily: node.style.fontFamily,
        // 纯文字：无边框、无底色
        backgroundColor: '',
        editable: true
      })
      return Promise.resolve(object)
    }

    if (node.type === NODE_TYPES.TEXTBOX) {
      const lockedText = isNodeLocked(node)
      const object = new this.fabric.Textbox(node.text, {
        left: node.x,
        top: node.y,
        width: node.width,
        scaleX: node.scaleX ?? 1,
        scaleY: node.scaleY ?? 1,
        hasControls: !lockedText,
        lockMovementX: lockedText,
        lockMovementY: lockedText,
        lockRotation: lockedText,
        originX: 'left',
        originY: 'top',
        angle: node.rotation || 0,
        fontSize: node.style.fontSize,
        fill: node.style.fill,
        fontWeight: node.style.fontWeight,
        textAlign: node.style.textAlign,
        fontFamily: node.style.fontFamily,
        backgroundColor: node.style.backgroundColor,
        stroke: node.style.borderColor,
        strokeWidth: node.style.borderWidth,
        // fabric.Textbox 无内边距概念，用 padding 属性做视觉留白
        padding: node.style.padding,
        editable: !lockedText,
        // 角点等比缩放整个文本框（规格 4）；边中点保留横向拉宽
        lockUniScaling: false
      })
      object.setControlsVisibility({
        tl: !lockedText, tr: !lockedText, bl: !lockedText, br: !lockedText,
        ml: !lockedText, mr: !lockedText, mt: false, mb: false,
        mtr: !lockedText
      })
      return Promise.resolve(object)
    }

    return Promise.resolve(null)
  }

  /** 连接线对象：折线用 Polyline，直线用 Line；箭头为独立三角形，组合成 Group。 */
  #createEdgeObject(edge) {
    const points = edgePathPoints(this.scene, edge)
    const { stroke, strokeWidth, arrow } = edge.style
    const parts = []
    parts.push(new this.fabric.Polyline(points, {
      fill: '',
      stroke,
      strokeWidth,
      strokeLineJoin: 'round',
      objectCaching: false
    }))

    const arrowAt = (tip, prev) => {
      const angle = (Math.atan2(tip.y - prev.y, tip.x - prev.x) * 180) / Math.PI
      const size = Math.max(8, strokeWidth * 4)
      return new this.fabric.Triangle({
        left: tip.x,
        top: tip.y,
        originX: 'center',
        originY: 'center',
        width: size,
        height: size,
        fill: stroke,
        // fabric 三角形默认朝上，转成沿线方向
        angle: angle + 90
      })
    }
    if (arrow === 'end' || arrow === 'both') {
      parts.push(arrowAt(points.at(-1), points.at(-2)))
    }
    if (arrow === 'both') {
      parts.push(arrowAt(points[0], points[1]))
    }

    const group = new this.fabric.Group(parts, {
      selectable: false,
      evented: false,
      hoverCursor: 'default'
    })
    return group
  }

  /** 排版后量测：文本对象加入画布后其 width/height 才是真值，需回填场景图。 */
  measureTextNodes() {
    if (!this.scene) return false
    let changed = false
    for (const node of this.scene.nodes) {
      if (!isTextNode(node)) continue
      const object = this.objects.get(node.id)
      if (!object) continue
      const width = object.width * (object.scaleX || 1)
      const height = object.height * (object.scaleY || 1)
      if (Math.abs(node.width - width) > 0.01 || Math.abs(node.height - height) > 0.01) {
        setNodeMetrics(this.scene, node.id, { width, height })
        changed = true
      }
    }
    return changed
  }

  selectNodes(ids) {
    const objects = ids.map((id) => this.objects.get(id)).filter(Boolean)
    this.canvas.discardActiveObject()
    if (objects.length === 1) {
      this.canvas.setActiveObject(objects[0])
    } else if (objects.length > 1) {
      const selection = new this.fabric.ActiveSelection(objects, { canvas: this.canvas })
      selection.set({ lockRotation: true, lockUniScaling: true })
      selection.setControlsVisibility({ mtr: false })
      this.canvas.setActiveObject(selection)
    }
    this.canvas.requestRenderAll()
  }

  viewSize() {
    return { width: this.canvas.getWidth(), height: this.canvas.getHeight() }
  }

  /** 以某点为中心缩放；不传中心则以视口中心缩放。 */
  setZoom(zoom, center = null) {
    const point = center
      ? new this.fabric.Point(center.x, center.y)
      : new this.fabric.Point(this.canvas.getWidth() / 2, this.canvas.getHeight() / 2)
    this.canvas.zoomToPoint(point, zoom)
    this.canvas.requestRenderAll()
  }

  setViewport(zoom, offset) {
    this.canvas.setViewportTransform([zoom, 0, 0, zoom, offset.x, offset.y])
    this.canvas.requestRenderAll()
  }

  resetViewport() {
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    this.canvas.requestRenderAll()
  }

  pan(dx, dy) {
    this.canvas.relativePan(new this.fabric.Point(dx, dy))
    this.onViewportChanged?.()
  }

  resize(width, height) {
    this.canvas.setDimensions({ width, height })
    this.canvas.requestRenderAll()
  }

  /**
   * 离屏栅格化指定区域。
   * 用 StaticCanvas 重建一份，避免动到用户正在编辑的画布视口。
   */
  async renderRegion(bounds, scale) {
    const staticCanvas = new this.fabric.StaticCanvas(null, {
      width: Math.floor(bounds.width * scale),
      height: Math.floor(bounds.height * scale),
      backgroundColor: '#ffffff'
    })
    staticCanvas.setViewportTransform([scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale])

    const { nodesByZ } = await import('./scene.js')
    for (const node of nodesByZ(this.scene)) {
      const object = await this.#createObject(node)
      if (object) staticCanvas.add(object)
    }
    for (const edge of this.scene.edges) {
      const object = this.#createEdgeObject(edge)
      if (object) staticCanvas.add(object)
    }
    staticCanvas.renderAll()
    const element = staticCanvas.getElement()
    const blob = await new Promise((resolve) => element.toBlob(resolve, 'image/png'))
    const bytes = new Uint8Array(await blob.arrayBuffer())
    staticCanvas.dispose()
    return { bytes, width: element.width, height: element.height }
  }

  /** 世界坐标矩形 → 画布屏幕坐标矩形（用于让 DOM 工具栏跟随对象）。 */
  toScreenRect(box) {
    const vt = this.canvas.viewportTransform
    const zoom = vt[0] || 1
    return {
      x: box.x * zoom + vt[4],
      y: box.y * zoom + vt[5],
      width: box.width * zoom,
      height: box.height * zoom
    }
  }

  /** 当前视口在场景坐标系中的矩形。 */
  viewportRect() {
    const vt = this.canvas.viewportTransform
    const zoom = vt[0] || 1
    return {
      x: -vt[4] / zoom,
      y: -vt[5] / zoom,
      width: this.canvas.getWidth() / zoom,
      height: this.canvas.getHeight() / zoom
    }
  }

  dispose() {
    for (const url of this.assetUrls.values()) URL.revokeObjectURL(url)
    this.assetUrls.clear()
    this.objects.clear()
    this.canvas.dispose()
  }
}
