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
import { applyBoardControls } from './controls.js'

/**
 * 锁定对象的选中框：灰色虚线。
 *
 * 只改**选中框**，不动对象本身——不降透明度、不加蒙层。锁定是"这个东西
 * 现在动不了"，不是"这个东西被禁用了"，把内容做灰会让人以为导出也会变。
 * 选中框属于 fabric 的控制器层，本来就不进导出（renderRegion 用的是
 * StaticCanvas，没有交互层）。
 */
function applyLockedOutline(object, locked) {
  if (locked) {
    object.borderColor = 'rgba(120, 124, 140, 0.9)'
    object.borderDashArray = [5, 4]
    object.borderScaleFactor = 1.5
  } else {
    object.borderColor = '#6978e6'
    object.borderDashArray = null
    object.borderScaleFactor = 1.5
  }
  return object
}

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
    // 用 sceneAabb() 而非 getBoundingRect()，理由见该方法注释。
    this.canvas.on('object:moving', (event) => {
      const object = event.target
      if (!object?.boardNodeId || !this.onObjectMoving) return
      const snap = this.onObjectMoving(object.boardNodeId, this.sceneAabb(object))
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
    this.setBackground(scene.background)
  }

  /**
   * 画布背景。透明时 fabric 背景置空，由 CSS 棋盘格透出来——
   * 棋盘格只是"透明"的视觉表示，绝不能进 fabric 场景，
   * 否则会被导出栅格化进 PNG（规格 7.1）。
   */
  setBackground(background) {
    const transparent = !background || background.type === 'transparent'
    this.canvas.backgroundColor = transparent ? '' : background.color
    this.canvas.requestRenderAll()
  }

  #emitSelection() {
    this.onSelection(this.getSelectedIds())
  }

  getSelectedIds() {
    const active = this.canvas.getActiveObjects?.() || []
    return active.map((object) => object.boardNodeId).filter(Boolean)
  }

  /**
   * 求对象的世界包围盒，口径与场景侧 nodeBounds() **完全一致**。
   *
   * 不能用 fabric 的 getBoundingRect()：它把**描边**算进包围盒。
   * 45° 旋转时误差是 strokeWidth×(|cos|+|sin|)/2——边框 10px 就有
   * 7.07px，已经超过 6px 吸附阈值，带边框的文本框会吸附到错位置，
   * 或者该吸附时吸不上。padding、控制点同理。
   *
   * 这里按场景的同一套公式算（中心 + 未描边宽高 + 旋转），
   * 两套口径从构造上就不可能分叉。
   * 走 calcTransformMatrix 而非手算三角函数，是为了让多选嵌套
   * （子对象坐标相对选区）也自动正确。
   */
  sceneAabb(object) {
    object.setCoords()
    const width = object.width * (object.scaleX || 1)
    const height = object.height * (object.scaleY || 1)
    const matrix = object.calcTransformMatrix()
    const xs = []
    const ys = []
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const point = this.fabric.util.transformPoint(
        new this.fabric.Point(dx * width / 2, dy * height / 2), matrix
      )
      xs.push(point.x)
      ys.push(point.y)
    }
    const left = Math.min(...xs)
    const top = Math.min(...ys)
    return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
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
    const isMultiSelect = event?.target?.type === 'activeSelection'
    const targets = isMultiSelect
      ? event.target.getObjects()
      : [event?.target].filter(Boolean)
    // ⚠ 只有多选时才存在"选区缩放"这一层。
    //   单对象时 event.target 就是 object 本身，再乘一次等于把缩放算两遍
    //   （视觉 150% 会写成 225%）。
    const groupScaleX = isMultiSelect ? (event.target.scaleX ?? 1) : 1
    const groupScaleY = isMultiSelect ? (event.target.scaleY ?? 1) : 1

    for (const object of targets) {
      const nodeId = object.boardNodeId
      if (!nodeId) continue
      const sceneNode = this.scene.nodes.find((n) => n.id === nodeId)
      // 锁定对象在多选变换中自动跳过（规格 3.2）
      if (isNodeLocked(sceneNode)) continue
      const width = object.width * (object.scaleX || 1) * groupScaleX
      const height = object.height * (object.scaleY || 1) * groupScaleY

      // 多选时 fabric 的子对象坐标是相对于选区的，必须换算成画布绝对坐标。
      // 对象原点已是中心，所以矩阵的平移分量就是绝对中心。
      const matrix = object.calcTransformMatrix()
      const center = this.fabric.util.transformPoint(new this.fabric.Point(0, 0), matrix)
      // node.x/y 存的是**未旋转**框的左上角，由中心反推
      setNodePosition(this.scene, nodeId, center.x - width / 2, center.y - height / 2)

      // 旋转角度写回（多选时 fabric 的子对象 angle 是相对选区的）
      const angle = (object.angle || 0) + (isMultiSelect ? (event.target.angle || 0) : 0)
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

  /** 只把文本内容与排版尺寸落进场景，不发 onChange。渲染前退出编辑时用。 */
  #applyTextMetrics(object) {
    if (!this.scene || !object?.boardNodeId) return
    setNodeText(this.scene, object.boardNodeId, object.text ?? '')
    setNodeMetrics(this.scene, object.boardNodeId, {
      width: object.width,
      height: object.height
    })
  }

  #writeBackText(object) {
    if (!this.scene || !object?.boardNodeId || this.suspendSync) return
    setNodeText(this.scene, object.boardNodeId, object.text ?? '')
    // 文本真实宽高只有排版后才知道，必须回填，否则包围盒、连接线锚点、
    // 导出尺寸都会用估算值。
    //
    // ⚠ 写**基础**宽高，不乘 scale。node.width 的语义是未缩放的基础宽度，
    //   缩放单独存在 node.scaleX（规格 4）。若这里写 width*scaleX，下次渲染
    //   会用 width: node.width 再叠一次 scaleX，缩放被乘两遍。
    setNodeMetrics(this.scene, object.boardNodeId, {
      width: object.width,
      height: object.height
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
    // ⚠ 有对象正在行内编辑时，必须**先正常退出编辑再重建**。
    //
    //   直接 clear() 会把正在编辑的 Textbox 连同编辑状态一起销毁，之后
    //   fabric 的 exitEditing 拿不到 canvas 就抛错，对象也变成孤儿
    //   ——表现就是"编辑一次之后再也选不中、改不动、双击不进编辑"。
    //
    //   也不能简单跳过这次渲染：那样锁定、撤销这类状态变更会静默不生效，
    //   直到下一次渲染才补上（实测锁定后仍能双击进编辑就是这么来的）。
    //
    //   退出编辑用 suspendSync 挡住事件回写，改为在这里直接落库，
    //   避免 onChange → #afterChange → render() 递归。
    const editing = this.canvas.getActiveObject()
    if (editing?.isEditing) {
      this.suspendSync = true
      editing.exitEditing()
      this.suspendSync = false
      this.#applyTextMetrics(editing)
    }
    this.suspendSync = true
    const selected = new Set(this.getSelectedIds())
    this.canvas.discardActiveObject()
    this.canvas.clear()
    this.setBackground(this.scene.background)
    this.objects.clear()
    this.#releaseUnusedUrls()

    for (const node of nodesByZ(this.scene)) {
      const object = await this.#createObject(node)
      if (!object) continue
      // 视觉小、命中大的控制点（S3）。必须在对象加入画布前套上。
      applyBoardControls(object)
      // ⚠ 必须在 applyBoardControls **之后**：它会重置 borderColor，
      //   先设锁定虚线会被覆盖回主题色。
      applyLockedOutline(object, isNodeLocked(node))
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
              tl: !locked, tr: !locked, bl: !locked, br: !locked,
              ml: !locked, mr: !locked, mt: !locked, mb: !locked,
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
        // 图片分支有这两项，文本框此前漏了——锁定后仍能拉伸
        lockScalingX: lockedText,
        lockScalingY: lockedText,
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
   *
   * @param {object} options
   *   fillColor  底色；null 表示保留透明（PNG 用）
   *   mime       输出类型
   */
  async renderRegion(bounds, scale, { fillColor = null, mime = 'image/png' } = {}) {
    const staticCanvas = new this.fabric.StaticCanvas(null, {
      width: Math.floor(bounds.width * scale),
      height: Math.floor(bounds.height * scale),
      // 空字符串 = 不绘制背景，导出即为透明；不能写 '#ffffff'，
      // 那样"透明背景"的工程会被无声地铺成白底
      backgroundColor: fillColor || '',
      // ⚠ 必须关掉 Retina 缩放。fabric 默认按 devicePixelRatio 放大后备缓冲，
      //   于是同一份工程在 2x 屏上导出的像素是 1x 屏的两倍，而 planExport
      //   的上限是按 1x 算的——在 2x 屏上按上限规划的导出实际会申请 4 倍面积。
      //   导出结果必须只由工程决定，与用户显示器无关。
      enableRetinaScaling: false
    })
    staticCanvas.setViewportTransform([scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale])

    const { nodesByZ } = await import('./scene.js')
    for (const node of nodesByZ(this.scene)) {
      const object = await this.#createObject(node)
      if (!object) continue
      // ⚠ 必须与屏幕渲染同样转成中心原点，否则导出时旋转对象绕左上角转，
      //   导出结果和用户看到的画面对不上。
      this.#useCenterOrigin(object, node)
      staticCanvas.add(object)
    }
    for (const edge of this.scene.edges) {
      const object = this.#createEdgeObject(edge)
      if (object) staticCanvas.add(object)
    }
    staticCanvas.renderAll()
    const element = staticCanvas.getElement()
    // JPG 不传 quality：用底层编码器默认值，不写死（规格 8.2）
    const blob = await new Promise((resolve) => element.toBlob(resolve, mime))
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
