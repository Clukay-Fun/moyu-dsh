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
  isTextNode,
  removeNodes,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  sceneBounds,
  snapshotScene
} from './scene.js'
import { BoardCanvas } from './canvas.js'

/** 单张图片上限，与主进程截图上限口径一致。 */
const MAX_IMAGE_BYTES = 100 * 1024 * 1024

export class BoardController {
  constructor({ fabric, onStatus }) {
    this.fabric = fabric
    this.onStatus = onStatus || (() => {})
    this.scene = createScene()
    this.store = new AssetStore()
    this.selection = []
    this.ready = false
  }

  mount(dom) {
    this.dom = dom
    this.canvas = new BoardCanvas('board-canvas-element', {
      fabric: this.fabric,
      onChange: () => this.#afterChange(),
      onSelection: (ids) => {
        this.selection = ids
        this.#syncControls()
      }
    })
    this.canvas.attach(this.scene, this.store)
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

    // Delete / Backspace 删除选中，但在文本编辑态下不拦截
    this.keyHandler = (event) => {
      if (!this.isVisible()) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
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
    this.#afterChange()
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

  async #afterChange() {
    await this.canvas.render()
    this.#syncControls()
    this.#syncStatus()
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
    // 层级操作一次只作用于一个节点，多选时不提供（避免相对顺序歧义）
    for (const button of [this.dom.front, this.dom.forward, this.dom.backward, this.dom.back]) {
      button.disabled = !single
    }
  }

  #syncStatus() {
    if (!this.dom) return
    const count = this.scene.nodes.length
    this.dom.empty.hidden = count > 0
    const bounds = sceneBounds(this.scene)
    this.dom.statusText.textContent = count
      ? `${count} 个对象 · 内容范围 ${Math.round(bounds.width)} × ${Math.round(bounds.height)} px`
      : '画布为空'
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
    removeNodes(this.scene, this.store, [...this.selection])
    this.selection = []
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
      getHistory: () => (this.history ? this.history.stats() : { undo: 0, redo: 0 })
    })
  }
}
