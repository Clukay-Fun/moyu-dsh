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

    this.canvas.on('object:modified', (event) => this.#writeBack(event))
    this.canvas.on('selection:created', () => this.#emitSelection())
    this.canvas.on('selection:updated', () => this.#emitSelection())
    this.canvas.on('selection:cleared', () => this.#emitSelection())
    // 文本编辑结束：把内容与排版后的真实尺寸一并写回场景图
    this.canvas.on('text:editing:exited', (event) => this.#writeBackText(event?.target))
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

  /** 交互结果写回场景图。fabric 用 left/top/scale，场景图用 x/y/width/height。 */
  #writeBack(event) {
    if (!this.scene || this.suspendSync) return
    const targets = event?.target?.type === 'activeSelection'
      ? event.target.getObjects()
      : [event?.target].filter(Boolean)

    for (const object of targets) {
      const nodeId = object.boardNodeId
      if (!nodeId) continue
      // 多选时 fabric 的子对象坐标是相对于选区的，必须换算成画布绝对坐标
      const matrix = object.calcTransformMatrix()
      const point = new this.fabric.Point(-object.width / 2, -object.height / 2)
      const absolute = this.fabric.util.transformPoint(point, matrix)
      setNodePosition(this.scene, nodeId, absolute.x, absolute.y)

      const width = object.width * object.scaleX * (event?.target?.scaleX ?? 1)
      const height = object.height * object.scaleY * (event?.target?.scaleY ?? 1)
      if (width > 0 && height > 0) {
        // 文本节点用 setNodeMetrics（量测口径），图片用 resizeNode（缩放口径）
        if (isTextNode(this.scene.nodes.find((n) => n.id === nodeId))) {
          setNodeMetrics(this.scene, nodeId, { width, height })
        } else {
          resizeNode(this.scene, nodeId, { width, height })
        }
      }
    }
    this.onChange('transform')
    // 写回后按场景图重画一次，确保 fabric 与真值一致（消除累积误差）
    this.render()
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
    this.onChange('text')
    this.render()
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
      object.boardNodeId = node.id
      this.objects.set(node.id, object)
      this.canvas.add(object)
    }

    // 还原选中态
    const restore = [...this.objects.values()].filter((o) => selected.has(o.boardNodeId))
    if (restore.length === 1) {
      this.canvas.setActiveObject(restore[0])
    } else if (restore.length > 1) {
      this.canvas.setActiveObject(new this.fabric.ActiveSelection(restore, { canvas: this.canvas }))
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
            image.set({
              left: node.x,
              top: node.y,
              originX: 'left',
              originY: 'top',
              scaleX: node.width / (asset?.width || image.width || 1),
              scaleY: node.height / (asset?.height || image.height || 1),
              angle: node.rotation || 0,
              // S1 只做等比缩放：关掉四条边的中点手柄，只留角柄
              lockUniScaling: true
            })
            image.setControlsVisibility({ ml: false, mr: false, mt: false, mb: false })
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
      const object = new this.fabric.Textbox(node.text, {
        left: node.x,
        top: node.y,
        width: node.width,
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
        editable: true,
        // 文本框只允许横向拉宽，高度随换行自动增长
        lockScalingY: true
      })
      object.setControlsVisibility({ mt: false, mb: false, tl: false, tr: false, bl: false, br: false })
      return Promise.resolve(object)
    }

    return Promise.resolve(null)
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
      this.canvas.setActiveObject(new this.fabric.ActiveSelection(objects, { canvas: this.canvas }))
    }
    this.canvas.requestRenderAll()
  }

  resize(width, height) {
    this.canvas.setDimensions({ width, height })
    this.canvas.requestRenderAll()
  }

  dispose() {
    for (const url of this.assetUrls.values()) URL.revokeObjectURL(url)
    this.assetUrls.clear()
    this.objects.clear()
    this.canvas.dispose()
  }
}
