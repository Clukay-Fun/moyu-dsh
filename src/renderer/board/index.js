// 汇总画布 · UI 控制器（F-009）
//
// 把 scene.js（真值）与 canvas.js（绘制/交互）接到具体的 DOM 控件上。

import {
  createScene,
  AssetStore,
  registerAsset,
  addImageNode,
  addTextNode,
  addTextBoxNode,
  setNodeStyle,
  setEdgeStyle,
  removeEdge,
  addEdge,
  edgesOfNode,
  isTextNode,
  missingAssets,
  compactAssetStore,
  validateScene,
  removeNodes,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  sceneBounds,
  snapshotScene
} from './scene.js'
import { BoardCanvas } from './canvas.js'
import { BoardHistory } from './history.js'
import { packBoard, unpackBoard } from './container.js'

/** 单张图片上限，与主进程截图上限口径一致。 */
const MAX_IMAGE_BYTES = 100 * 1024 * 1024

export class BoardController {
  static ZOOM_MIN = 0.1
  static ZOOM_MAX = 4

  constructor({ fabric, onStatus }) {
    this.fabric = fabric
    this.onStatus = onStatus || (() => {})
    this.scene = createScene()
    this.store = new AssetStore()
    this.selection = []
    /** 连接模式：等待用户点第二个节点 */
    this.connectFrom = null
    /** 当前选中的连接线 id */
    this.selectedEdge = null
    this.history = new BoardHistory(this.scene)
    /** 视口：缩放与平移 */
    this.zoom = 1
    /** 当前项目文件路径；null 表示尚未保存过 */
    this.filePath = null
    /** 自上次保存以来是否有改动 */
    this.dirty = false
    this.ready = false
  }

  mount(dom) {
    this.dom = dom
    this.canvas = new BoardCanvas('board-canvas-element', {
      fabric: this.fabric,
      onChange: () => this.#afterChange(),
      onSelection: (ids) => {
        this.selection = ids
        if (this.connectFrom && ids.length === 1 && ids[0] !== this.connectFrom) {
          this.#completeConnection(ids[0])
          return
        }
        // 选中节点时，若该节点有边，默认选中第一条以便调样式
        const related = ids.length === 1 ? edgesOfNode(this.scene, ids[0]) : []
        this.selectedEdge = related.length ? related[0].id : null
        this.#syncControls()
      }
    })
    this.canvas.attach(this.scene, this.store)
    this.canvas.onWheelZoom = (deltaY, point) => {
      this.zoomBy(deltaY > 0 ? 1 / 1.1 : 1.1, point)
    }
    this.ready = true

    dom.addFile.addEventListener('click', () => dom.fileInput.click())
    dom.fileInput.addEventListener('change', () => this.#onFilesPicked())
    dom.deleteButton.addEventListener('click', () => this.deleteSelected())
    dom.front.addEventListener('click', () => this.#applyLayer(bringToFront))
    dom.forward.addEventListener('click', () => this.#applyLayer(bringForward))
    dom.backward.addEventListener('click', () => this.#applyLayer(sendBackward))
    dom.back.addEventListener('click', () => this.#applyLayer(sendToBack))
    dom.addText.addEventListener('click', () => this.addText('text'))
    dom.addTextBox.addEventListener('click', () => this.addText('textbox'))
    dom.fontSize.addEventListener('change', () =>
      this.#applyTextStyle({ fontSize: Number(dom.fontSize.value) }))
    dom.fontColor.addEventListener('change', () =>
      this.#applyTextStyle({ fill: dom.fontColor.value }))
    dom.fontBold.addEventListener('click', () => {
      const on = dom.fontBold.getAttribute('aria-pressed') === 'true'
      this.#applyTextStyle({ fontWeight: on ? 'normal' : 'bold' })
    })
    dom.textAlign.addEventListener('change', () =>
      this.#applyTextStyle({ textAlign: dom.textAlign.value }))
    dom.connect.addEventListener('click', () => this.toggleConnectMode())
    dom.edgeShape.addEventListener('change', () =>
      this.#applyEdgeStyle({ shape: dom.edgeShape.value }))
    dom.edgeArrow.addEventListener('change', () =>
      this.#applyEdgeStyle({ arrow: dom.edgeArrow.value }))
    dom.edgeWidth.addEventListener('change', () =>
      this.#applyEdgeStyle({ strokeWidth: Number(dom.edgeWidth.value) }))
    dom.edgeColor.addEventListener('change', () =>
      this.#applyEdgeStyle({ stroke: dom.edgeColor.value }))
    dom.edgeDelete.addEventListener('click', () => this.deleteSelectedEdge())
    dom.undo.addEventListener('click', () => this.undo())
    dom.redo.addEventListener('click', () => this.redo())
    dom.zoomIn.addEventListener('click', () => this.zoomBy(1.25))
    dom.zoomOut.addEventListener('click', () => this.zoomBy(1 / 1.25))
    dom.zoomFit.addEventListener('click', () => this.fitToContent())
    dom.zoomReset.addEventListener('click', () => this.resetZoom())
    dom.save.addEventListener('click', () => this.save(false))
    dom.saveAs.addEventListener('click', () => this.save(true))
    dom.open.addEventListener('click', () => this.open())

    // Delete / Backspace 删除选中，但在文本编辑态下不拦截
    this.keyHandler = (event) => {
      if (!this.isVisible()) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? this.redo() : this.undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        this.redo()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!this.selection.length) return
        event.preventDefault()
        this.deleteSelected()
      }
    }
    document.addEventListener('keydown', this.keyHandler)

    this.resizeObserver = new ResizeObserver(() => this.fit())
    this.resizeObserver.observe(dom.stage)
    this.fit()
    // 首次渲染不记历史：空画布是基线本身，记一步会让启动时"撤销"就可用
    this.#afterChange(false)
  }

  isVisible() {
    return Boolean(this.dom?.pane && !this.dom.pane.hidden && this.dom.pane.classList.contains('active'))
  }

  fit() {
    if (!this.ready || !this.dom) return
    const rect = this.dom.stage.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    this.canvas.resize(Math.round(rect.width), Math.round(rect.height))
  }

  /**
   * 场景变更统一出口。
   * commit=true 时记录一步历史；撤销/重做自身还原场景时传 false，
   * 否则会把还原动作又压进栈里。
   */
  async #afterChange(commit = true) {
    if (commit) {
      this.history.push(this.scene)
      this.dirty = true
    }
    await this.canvas.render()
    this.#syncControls()
    this.#syncStatus()
  }

  undo() {
    const scene = this.history.undo()
    if (!scene) return false
    this.#restore(scene)
    return true
  }

  redo() {
    const scene = this.history.redo()
    if (!scene) return false
    this.#restore(scene)
    return true
  }

  #restore(scene) {
    // 逐字段替换而非换引用：canvas 持有的是同一个 scene 对象
    this.scene.version = scene.version
    this.scene.nodes = scene.nodes
    this.scene.edges = scene.edges
    this.scene.assets = scene.assets
    // 二进制留在仓库里（removeNode 不删字节），撤销删除时图片才能回来
    const missing = missingAssets(this.scene, this.store)
    if (missing.length) {
      this.onStatus({ error: `撤销后有 ${missing.length} 个图片资源缺失` })
    }
    this.selection = []
    this.selectedEdge = null
    this.#afterChange(false)
  }

  // ── 视口缩放与平移 ──────────────────────────────────────
  setZoom(next, center = null) {
    const clamped = Math.min(BoardController.ZOOM_MAX, Math.max(BoardController.ZOOM_MIN, next))
    this.zoom = clamped
    this.canvas.setZoom(clamped, center)
    this.#syncStatus()
    return clamped
  }

  zoomBy(factor, center = null) {
    return this.setZoom(this.zoom * factor, center)
  }

  resetZoom() {
    this.canvas.resetViewport()
    return this.setZoom(1)
  }

  /** 适应窗口：把内容包围盒缩放平移到视口内。 */
  fitToContent() {
    const bounds = sceneBounds(this.scene)
    if (bounds.empty) return this.resetZoom()
    const view = this.canvas.viewSize()
    const padding = 40
    const scale = Math.min(
      (view.width - padding * 2) / bounds.width,
      (view.height - padding * 2) / bounds.height
    )
    const clamped = Math.min(BoardController.ZOOM_MAX, Math.max(BoardController.ZOOM_MIN, scale))
    this.zoom = clamped
    this.canvas.setViewport(clamped, {
      x: (view.width - bounds.width * clamped) / 2 - bounds.x * clamped,
      y: (view.height - bounds.height * clamped) / 2 - bounds.y * clamped
    })
    this.#syncStatus()
    return clamped
  }

  /** 当前选中的文本节点（多选时取全部文本节点）。 */
  #selectedTextNodes() {
    return this.selection
      .map((id) => this.scene.nodes.find((n) => n.id === id))
      .filter((node) => isTextNode(node))
  }

  #applyTextStyle(patch) {
    const nodes = this.#selectedTextNodes()
    if (!nodes.length) return
    for (const node of nodes) setNodeStyle(this.scene, node.id, patch)
    this.#afterChange()
  }

  toggleConnectMode() {
    if (this.connectFrom) {
      this.connectFrom = null
    } else {
      if (this.selection.length !== 1) return
      this.connectFrom = this.selection[0]
    }
    this.#syncControls()
  }

  #completeConnection(toNodeId) {
    const fromNodeId = this.connectFrom
    this.connectFrom = null
    try {
      // 锚点按两节点相对位置自动选取，用户可事后改形状/箭头
      const from = this.scene.nodes.find((n) => n.id === fromNodeId)
      const to = this.scene.nodes.find((n) => n.id === toNodeId)
      const horizontal = Math.abs((to.x + to.width / 2) - (from.x + from.width / 2))
      const vertical = Math.abs((to.y + to.height / 2) - (from.y + from.height / 2))
      let fromAnchor = 'right'
      let toAnchor = 'left'
      if (vertical > horizontal) {
        fromAnchor = to.y > from.y ? 'bottom' : 'top'
        toAnchor = to.y > from.y ? 'top' : 'bottom'
      } else {
        fromAnchor = to.x > from.x ? 'right' : 'left'
        toAnchor = to.x > from.x ? 'left' : 'right'
      }
      const edge = addEdge(this.scene, { fromNodeId, toNodeId, fromAnchor, toAnchor })
      this.selectedEdge = edge.id
      this.#afterChange()
    } catch (error) {
      this.onStatus({ error: error.message })
      this.#syncControls()
    }
  }

  #applyEdgeStyle(patch) {
    if (!this.selectedEdge) return
    setEdgeStyle(this.scene, this.selectedEdge, patch)
    this.#afterChange()
  }

  deleteSelectedEdge() {
    if (!this.selectedEdge) return
    removeEdge(this.scene, this.selectedEdge)
    this.selectedEdge = null
    this.#afterChange()
  }

  #syncControls() {
    if (!this.dom) return
    const has = this.selection.length > 0
    const single = this.selection.length === 1
    this.dom.deleteButton.disabled = !has
    // 文本样式栏只在选中文本节点时出现，避免出现改不动的控件
    const textNodes = this.#selectedTextNodes()
    this.dom.textStyle.hidden = textNodes.length === 0
    if (textNodes.length) {
      const first = textNodes[0]
      this.dom.fontSize.value = String(first.style.fontSize)
      this.dom.fontColor.value = first.style.fill
      this.dom.fontBold.setAttribute('aria-pressed', String(first.style.fontWeight === 'bold'))
      this.dom.textAlign.value = first.style.textAlign
    }

    // 连接按钮：选中恰好一个节点时可用；连接中显示按下态
    this.dom.connect.disabled = !single && !this.connectFrom
    this.dom.connect.setAttribute('aria-pressed', String(Boolean(this.connectFrom)))
    this.dom.connect.textContent = this.connectFrom ? '点击目标…' : '连接'
    this.dom.pane.classList.toggle('board-connecting', Boolean(this.connectFrom))

    const edge = this.selectedEdge
      ? this.scene.edges.find((e) => e.id === this.selectedEdge)
      : null
    this.dom.edgeStyle.hidden = !edge
    if (edge) {
      this.dom.edgeShape.value = edge.style.shape
      this.dom.edgeArrow.value = edge.style.arrow
      this.dom.edgeWidth.value = String(edge.style.strokeWidth)
      this.dom.edgeColor.value = edge.style.stroke
    }
    // 层级操作一次只作用于一个节点，多选时不提供（避免相对顺序歧义）
    for (const button of [this.dom.front, this.dom.forward, this.dom.backward, this.dom.back]) {
      button.disabled = !single
    }
  }

  #syncStatus() {
    if (!this.dom) return
    this.dom.undo.disabled = !this.history.canUndo()
    this.dom.redo.disabled = !this.history.canRedo()
    this.dom.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`
    const count = this.scene.nodes.length
    this.dom.empty.hidden = count > 0
    const bounds = sceneBounds(this.scene)
    this.dom.undo.disabled = !this.history.canUndo()
    this.dom.redo.disabled = !this.history.canRedo()
    this.dom.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`
    const edges = this.scene.edges.length
    const fileLabel = this.filePath
      ? `${this.filePath.split(/[\\/]/).pop()}${this.dirty ? ' *' : ''}`
      : this.dirty ? '未保存 *' : ''
    this.dom.statusText.textContent = count
      ? `${count} 个对象${edges ? ` · ${edges} 条连线` : ''} · 内容范围 ${Math.round(bounds.width)} × ${Math.round(bounds.height)} px${fileLabel ? ` · ${fileLabel}` : ''}`
      : `画布为空${fileLabel ? ` · ${fileLabel}` : ''}`
    this.dom.statusDot.className = `result-dot${count ? ' ok' : ''}`
    this.onStatus({ count })
  }

  #applyLayer(operation) {
    if (this.selection.length !== 1) return
    operation(this.scene, this.selection[0])
    this.#afterChange()
  }

  deleteSelected() {
    if (!this.selection.length) return
    removeNodes(this.scene, [...this.selection])
    this.selection = []
    // 删节点会级联删边，被选中的边可能已不存在
    if (this.selectedEdge && !this.scene.edges.some((e) => e.id === this.selectedEdge)) {
      this.selectedEdge = null
    }
    this.#afterChange()
  }

  /** 读取图片字节 → 量出原始尺寸 → 登记资源 → 建节点。 */
  async addImage(bytes, mime = 'image/png') {
    if (!(bytes instanceof Uint8Array)) throw new Error('图片数据无效')
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`单张图片超过 ${MAX_IMAGE_BYTES / 1024 / 1024} MB`)
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
    try {
      const size = await new Promise((resolve, reject) => {
        const probe = new Image()
        probe.addEventListener('load', () =>
          resolve({ width: probe.naturalWidth, height: probe.naturalHeight }))
        probe.addEventListener('error', () => reject(new Error('图片无法解码')))
        probe.src = url
      })
      if (!size.width || !size.height) throw new Error('图片尺寸无效')

      const assetId = registerAsset(this.scene, this.store, {
        data: bytes,
        mime,
        width: size.width,
        height: size.height
      })
      // 新节点按内容右侧顺延摆放，避免叠在一起
      const bounds = sceneBounds(this.scene)
      const placeX = bounds.empty ? 40 : bounds.x + bounds.width + 24
      const placeY = bounds.empty ? 40 : bounds.y
      // 超大图先按最长边 720px 落位，用户可再放大
      const scale = Math.min(1, 720 / Math.max(size.width, size.height))
      const node = addImageNode(this.scene, {
        assetId,
        x: placeX,
        y: placeY,
        width: size.width * scale,
        height: size.height * scale
      })
      await this.#afterChange()
      return node
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  /** 在内容右侧插入文本节点。 */
  addText(kind) {
    const bounds = sceneBounds(this.scene)
    const x = bounds.empty ? 40 : bounds.x + bounds.width + 24
    const y = bounds.empty ? 40 : bounds.y
    const node = kind === 'textbox'
      ? addTextBoxNode(this.scene, { x, y })
      : addTextNode(this.scene, { x, y })
    this.#afterChange().then(() => {
      this.selection = [node.id]
      this.canvas.selectNodes([node.id])
      this.#syncControls()
    })
    return node
  }

  async #onFilesPicked() {
    const files = [...(this.dom.fileInput.files || [])]
    this.dom.fileInput.value = ''
    for (const file of files) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        await this.addImage(bytes, file.type || 'image/png')
      } catch (error) {
        this.onStatus({ error: `${file.name}：${error.message}` })
      }
    }
  }

  // ── 项目文件 ────────────────────────────────────────────
  /**
   * 保存。
   * ⚠ 保存前会 compactAssetStore 回收未引用二进制——
   * 这会让"撤销已删除的图片"不再可行，故只在此处调用。
   */
  async save(asNew = false) {
    try {
      compactAssetStore(this.scene, this.store)
      const bytes = packBoard(this.scene, this.store)
      const result = await window.api.saveBoard({
        data: bytes,
        name: this.#suggestedName(),
        path: this.filePath,
        overwrite: Boolean(this.filePath) && !asNew
      })
      if (result.status !== 'saved') return false
      this.filePath = result.path
      this.dirty = false
      // compact 会使更早的删除无法撤销，历史栈从当前状态重新开始
      this.history.reset(this.scene)
      this.#syncControls()
      this.#syncStatus()
      this.onStatus({ saved: result.path, bytes: result.bytes })
      return true
    } catch (error) {
      this.onStatus({ error: error instanceof Error ? error.message : '保存失败' })
      return false
    }
  }

  async open() {
    if (this.dirty && !window.confirm('当前画布有未保存的改动，打开新文件会丢弃它们。继续？')) {
      return false
    }
    try {
      const result = await window.api.openBoard()
      if (result.status !== 'opened') return false
      const { scene, assets } = unpackBoard(new Uint8Array(result.data))
      validateScene(scene)
      // 整体替换：先清空仓库再灌入，避免旧文件的资源残留
      this.store.bytes.clear()
      for (const [assetId, bytes] of assets) this.store.put(assetId, bytes)
      this.scene.version = scene.version
      this.scene.nodes = scene.nodes
      this.scene.edges = scene.edges
      this.scene.assets = scene.assets
      this.selection = []
      this.selectedEdge = null
      this.filePath = result.path
      this.dirty = false
      this.history.reset(this.scene)
      await this.#afterChange(false)
      this.resetZoom()
      this.onStatus({ opened: result.path })
      return true
    } catch (error) {
      this.onStatus({ error: error instanceof Error ? error.message : '打开失败' })
      return false
    }
  }

  #suggestedName() {
    if (this.filePath) {
      return this.filePath.split(/[\\/]/).pop().replace(/\.moyuboard$/i, '')
    }
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `画布-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  }

  hasUnsavedChanges() {
    return this.dirty
  }

  /** 只读场景快照，供状态展示与后续切片（保存/导出）使用。 */
  getSceneSnapshot() {
    return snapshotScene(this.scene)
  }

  /**
   * 只读检视接口。**不提供任何修改状态的方法**——
   * 用于自动化验收与线上排障，不构成对外可编程 API。
   */
  inspector() {
    return Object.freeze({
      getScene: () => this.getSceneSnapshot(),
      getSelection: () => [...this.selection],
      getHistory: () => (this.history ? this.history.stats() : { undo: 0, redo: 0 }),
      getFileState: () => ({ path: this.filePath, dirty: this.dirty })
    })
  }
}
