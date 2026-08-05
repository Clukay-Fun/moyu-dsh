// 全屏图片编辑器 · 模态控制器（U4）
//
// 把三层缝在一起：
//   EditorSession（真值/历史） · pipeline（像素） · FullscreenImageEditorCanvas（交互）
//
// 两个入口共用本控制器：
//   · 画布双击图片      open({ origin: 'canvas', ... })
//   · 截图后即时标注     open({ origin: 'capture', ... })
// 除了「完成」时把结果交给谁不同，工具行为完全一致。

import {
  EditorSession,
  ADJUSTMENT_KEYS,
  EDITOR_TOOLS
} from './session.js'
import { buildRenderPlan, normalizeCrop } from './pipeline.js'
import { FullscreenImageEditorCanvas } from './canvas.js'

const ADJUSTMENT_LABELS = {
  brightness: '亮度',
  exposure: '曝光',
  contrast: '对比度',
  shadows: '阴影',
  saturation: '饱和度',
  warmth: '色温',
  tint: '色调',
  clarity: '清晰度'
}

const SWATCHES = ['#e83c8c', '#f5a524', '#22c55e', '#6978e6', '#111827', '#ffffff']

const TOOL_HINTS = {
  crop: '在图片上拖出要保留的区域，然后点「应用裁切」。',
  adjust: '拖动滑块调整。多次调整以最后一次为准，可撤销。',
  mosaic: '拖出要打码的区域。',
  doodle: '按住拖动自由涂画。',
  rect: '拖出一个矩形框。',
  arrow: '从起点拖到终点画箭头。',
  text: '填好文字后，点击图片上要放置的位置。',
  watermark: '填好文字后点「添加水印」，可平铺整张图。'
}

export class ImageEditorModal {
  /**
   * @param {object} deps
   *   fabric · onCommit(blob, resultSize, session) · onCancel() · onStatus(msg)
   *   confirmDiscard() → boolean  放弃修改前的确认
   */
  constructor({ fabric, onCommit, onCancel, onStatus, confirmDiscard }) {
    this.fabric = fabric
    this.onCommit = onCommit || (() => {})
    this.onCancel = onCancel || (() => {})
    this.onStatus = onStatus || (() => {})
    this.confirmDiscard = confirmDiscard || (() => true)

    this.root = document.getElementById('image-editor')
    this.stage = document.getElementById('img-editor-stage')
    this.rail = document.getElementById('img-editor-rail')
    this.panel = document.getElementById('img-editor-options')
    this.hint = document.getElementById('img-editor-hint')
    this.sizeLabel = document.getElementById('img-editor-size')
    this.titleEl = document.getElementById('img-editor-title')
    this.undoBtn = document.getElementById('img-editor-undo')
    this.redoBtn = document.getElementById('img-editor-redo')
    this.restoreBtn = document.getElementById('img-editor-restore')
    this.cancelBtn = document.getElementById('img-editor-cancel')
    this.commitBtn = document.getElementById('img-editor-commit')

    this.session = null
    this.canvas = null
    this.context = null
    /** 画笔/形状的共享样式，切工具不重置——用户挑好的颜色应该留着 */
    this.style = { color: SWATCHES[0], lineWidth: 3 }

    this.#bind()
  }

  get isOpen() { return Boolean(this.session) }

  #bind() {
    this.rail.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tool]')
      if (button) this.#selectTool(button.dataset.tool)
    })
    this.undoBtn.addEventListener('click', () => this.undo())
    this.redoBtn.addEventListener('click', () => this.redo())
    this.restoreBtn.addEventListener('click', () => this.#restoreOriginal())
    this.cancelBtn.addEventListener('click', () => this.requestClose())
    this.commitBtn.addEventListener('click', () => this.commit())

    // 编辑器打开时，快捷键先归模态；不能让底层画布同时响应
    this.keyHandler = (event) => {
      if (!this.isOpen) return
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault()
        event.stopPropagation()
        event.shiftKey ? this.redo() : this.undo()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        // Esc 先退出当前工具，再次按下才提示放弃（规格 5.2）
        if (this.canvas?.hasDraft()) { this.canvas.cancelDraft(); return }
        if (this.activeTool) { this.#selectTool(null); return }
        this.requestClose()
      }
    }
    // 捕获阶段绑定，确保早于画布的全局快捷键
    window.addEventListener('keydown', this.keyHandler, true)
  }

  // ── 打开 / 关闭 ─────────────────────────────────────────

  /**
   * @param {object} request
   *   image        HTMLImageElement / ImageBitmap
   *   assetId      源资源 id
   *   originNodeId 画布对象 id（截图入口为 null）
   *   origin       'canvas' | 'capture'
   *   tool         打开时直接激活的工具
   *   canRestore   是否可恢复原图
   *   context      调用方自带的上下文，原样回传给 onCommit
   */
  open(request) {
    const { image, assetId, originNodeId = null, origin = 'canvas', tool = null } = request
    this.session = new EditorSession({
      sourceAssetId: assetId,
      sourceSize: { width: image.width, height: image.height },
      originNodeId,
      origin
    })
    this.context = request.context ?? null
    this.activeTool = null

    this.root.hidden = false
    this.root.setAttribute('aria-hidden', 'false')
    this.titleEl.textContent = origin === 'capture' ? '标注截图' : '编辑图片'
    this.restoreBtn.hidden = !request.canRestore

    // 懒创建：只有真正打开编辑器时才多出第二个 fabric 实例
    this.canvas = new FullscreenImageEditorCanvas('image-editor-canvas', {
      fabric: this.fabric,
      onOperation: (name, params) => this.#applyOperation(name, params),
      onDraftChange: () => this.#renderPanel()
    })
    this.canvas.load(image, buildRenderPlan(this.session), this.#stageSize())
    this.#selectTool(tool)
    this.#syncBar()
  }

  #stageSize() {
    const rect = this.stage.getBoundingClientRect()
    // padding 20px ×2，留出投影空间
    return {
      width: Math.max(64, rect.width - 40),
      height: Math.max(64, rect.height - 40)
    }
  }

  /** 关闭并释放 fabric 实例。不改变任何外部状态——那是调用方的事。 */
  #teardown() {
    this.canvas?.dispose()
    this.canvas = null
    this.session = null
    this.context = null
    this.activeTool = null
    this.panel.replaceChildren()
    this.root.hidden = true
    this.root.setAttribute('aria-hidden', 'true')
  }

  /** 取消：有修改时先确认。场景、资源、主历史一概不动。 */
  requestClose() {
    if (this.session?.isDirty() && !this.confirmDiscard()) return
    this.#teardown()
    this.onCancel()
  }

  dispose() {
    window.removeEventListener('keydown', this.keyHandler, true)
    if (this.isOpen) this.#teardown()
  }

  // ── 操作与历史 ──────────────────────────────────────────

  #applyOperation(tool, params) {
    if (!this.session) return
    if (tool === 'crop') {
      params = normalizeCrop(params, this.session.resultSize())
    }
    this.session.apply(tool, params)
    this.#rerender()
  }

  undo() {
    if (this.session?.undo()) this.#rerender()
  }

  redo() {
    if (this.session?.redo()) this.#rerender()
  }

  /** 「恢复原图」= 清空本轮全部编辑；对象层面的原图恢复由调用方处理。 */
  #restoreOriginal() {
    if (!this.session) return
    while (this.session.undo()) { /* 退到未编辑状态 */ }
    this.#rerender()
    this.onStatus('已回到未编辑状态')
  }

  #rerender() {
    this.canvas.render(buildRenderPlan(this.session), this.#stageSize())
    this.#syncBar()
    this.#renderPanel()
  }

  #syncBar() {
    const stats = this.session.stats()
    this.undoBtn.disabled = stats.undo === 0
    this.redoBtn.disabled = stats.redo === 0
    const size = this.session.resultSize()
    this.sizeLabel.textContent = `${Math.round(size.width)} × ${Math.round(size.height)} px`
  }

  // ── 工具与参数面板 ──────────────────────────────────────

  #selectTool(tool) {
    if (tool && !EDITOR_TOOLS.includes(tool)) tool = null
    this.activeTool = tool
    for (const button of this.rail.querySelectorAll('[data-tool]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool))
    }
    // 调色不是画布上的拖拽工具，交互层不接管指针
    this.canvas.setTool(tool === 'adjust' ? null : tool, this.style)
    this.hint.textContent = tool ? TOOL_HINTS[tool] : '从左侧选择一个工具'
    this.#renderPanel()
  }

  #renderPanel() {
    const tool = this.activeTool
    this.panel.replaceChildren()
    if (!tool) return

    if (tool === 'adjust') { this.#renderAdjustPanel(); return }
    if (tool === 'crop') { this.#renderCropPanel(); return }
    if (tool === 'mosaic') { this.#renderMosaicPanel(); return }
    if (tool === 'watermark') { this.#renderWatermarkPanel(); return }
    if (tool === 'text') { this.#renderTextPanel(); return }
    this.#renderStrokePanel()
  }

  /** 8 项调色滑块。⚠ 由 ADJUSTMENT_KEYS 生成，不得在此写死子集。 */
  #renderAdjustPanel() {
    const current = this.session.effectiveAdjustments()
    const pending = { ...current }
    const frag = document.createDocumentFragment()

    for (const key of ADJUSTMENT_KEYS) {
      const row = document.createElement('div')
      row.className = 'img-editor-field'
      const label = document.createElement('label')
      label.className = 'inline-value'
      const name = document.createElement('span')
      name.textContent = ADJUSTMENT_LABELS[key]
      const output = document.createElement('output')
      output.textContent = String(current[key])
      label.append(name, output)

      const slider = document.createElement('input')
      slider.type = 'range'
      slider.min = '-100'
      slider.max = '100'
      slider.value = String(current[key])
      slider.dataset.adjust = key

      // 拖动中只更新读数，抬手才落一步历史——
      // 否则拖一次滑块会塞进几十条撤销记录。
      slider.addEventListener('input', () => {
        pending[key] = Number(slider.value)
        output.textContent = slider.value
      })
      slider.addEventListener('change', () => {
        this.#applyOperation('adjust', { ...pending })
      })

      row.append(label, slider)
      frag.append(row)
    }

    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'gbtn'
    reset.textContent = '重置调色'
    reset.addEventListener('click', () => {
      this.#applyOperation('adjust', Object.fromEntries(ADJUSTMENT_KEYS.map((k) => [k, 0])))
    })
    frag.append(reset)
    this.panel.append(frag)
  }

  #renderCropPanel() {
    const apply = document.createElement('button')
    apply.type = 'button'
    apply.className = 'primary-btn'
    apply.textContent = '应用裁切'
    apply.disabled = !this.canvas.hasDraft()
    apply.addEventListener('click', () => {
      const rect = this.canvas.commitDraft()
      if (rect) this.#applyOperation('crop', rect)
      else this.onStatus('请先在图片上框选要保留的区域')
    })
    this.panel.append(apply)
  }

  #renderMosaicPanel() {
    this.panel.append(this.#slider('块大小', 'blockSize', this.style.blockSize || 12, 4, 40))
  }

  #renderStrokePanel() {
    this.panel.append(this.#swatches(), this.#slider('线宽', 'lineWidth', this.style.lineWidth, 1, 20))
  }

  #renderTextPanel() {
    const frag = document.createDocumentFragment()
    frag.append(
      this.#textField('文字内容', 'text', ''),
      this.#swatches(),
      this.#slider('字号', 'fontSize', this.style.fontSize || 24, 8, 160)
    )
    this.panel.append(frag)
  }

  #renderWatermarkPanel() {
    const frag = document.createDocumentFragment()
    frag.append(
      this.#textField('水印文字', 'text', this.style.text || ''),
      this.#swatches(),
      this.#slider('字号', 'fontSize', this.style.fontSize || 28, 8, 160),
      this.#slider('不透明度 %', 'opacityPercent', this.style.opacityPercent || 25, 5, 100)
    )

    const tile = document.createElement('label')
    tile.className = 'inline-value'
    const tileBox = document.createElement('input')
    tileBox.type = 'checkbox'
    tileBox.checked = this.style.repeat !== false
    tileBox.addEventListener('change', () => { this.style.repeat = tileBox.checked })
    const tileText = document.createElement('span')
    tileText.textContent = '平铺整张图'
    tile.append(tileText, tileBox)

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'primary-btn'
    add.textContent = '添加水印'
    add.addEventListener('click', () => {
      if (!this.style.text) { this.onStatus('请先填写水印文字'); return }
      const size = this.session.resultSize()
      this.#applyOperation('watermark', {
        text: this.style.text,
        color: this.style.color,
        fontSize: this.style.fontSize || 28,
        opacity: (this.style.opacityPercent || 25) / 100,
        repeat: this.style.repeat !== false,
        x: size.width * 0.06,
        y: size.height * 0.9
      })
    })

    frag.append(tile, add)
    this.panel.append(frag)
  }

  // ── 小控件 ──────────────────────────────────────────────

  #slider(label, key, value, min, max) {
    const row = document.createElement('div')
    row.className = 'img-editor-field'
    const head = document.createElement('label')
    head.className = 'inline-value'
    const name = document.createElement('span')
    name.textContent = label
    const output = document.createElement('output')
    output.textContent = String(value)
    head.append(name, output)

    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.value = String(value)
    input.addEventListener('input', () => {
      this.style[key] = Number(input.value)
      output.textContent = input.value
      this.canvas.setToolOptions(this.style)
    })
    row.append(head, input)
    return row
  }

  #textField(label, key, value) {
    const row = document.createElement('div')
    row.className = 'img-editor-field'
    const name = document.createElement('span')
    name.textContent = label
    const input = document.createElement('input')
    input.type = 'text'
    input.value = value
    input.addEventListener('input', () => {
      this.style[key] = input.value
      this.canvas.setToolOptions(this.style)
    })
    row.append(name, input)
    return row
  }

  #swatches() {
    const row = document.createElement('div')
    row.className = 'img-editor-field'
    const name = document.createElement('span')
    name.textContent = '颜色'
    const list = document.createElement('div')
    list.className = 'img-editor-swatches'

    for (const color of SWATCHES) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'img-editor-swatch'
      button.style.background = color
      button.setAttribute('aria-label', color)
      button.setAttribute('aria-pressed', String(this.style.color === color))
      button.addEventListener('click', () => {
        this.style.color = color
        this.canvas.setToolOptions(this.style)
        for (const other of list.children) {
          other.setAttribute('aria-pressed', String(other === button))
        }
      })
      list.append(button)
    }
    row.append(name, list)
    return row
  }

  // ── 完成 ────────────────────────────────────────────────

  /**
   * 完成：导出像素后交给调用方，由调用方登记资源、更新对象、推**一条**主历史。
   * 本控制器不直接改场景——那样会绕过历史事务。
   */
  async commit() {
    if (!this.session) return
    if (!this.session.isDirty()) { this.requestClose(); return }
    this.commitBtn.disabled = true
    try {
      const blob = await this.canvas.toBlob('image/png')
      const size = this.session.resultSize()
      const payload = { blob, size, context: this.context, session: this.session }
      this.#teardown()
      await this.onCommit(payload)
    } catch (error) {
      this.onStatus(`保存编辑结果失败：${error.message}`)
    } finally {
      this.commitBtn.disabled = false
    }
  }
}
