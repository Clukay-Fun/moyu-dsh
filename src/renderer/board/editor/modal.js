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
  text: '填好文字后，点击图片上要放置的位置。'
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
    /**
     * 会话世代。每次 open/teardown 都 +1。
     * 所有跨 await 的异步动作在恢复执行时都要比对它——
     * 「等回来时还是不是当初那个会话」不能靠 this.session 是否非空判断，
     * 因为期间完全可能已经关掉又打开了另一张图。
     */
    this.epoch = 0
    /** 提交事务进行中：期间禁止关闭、恢复与任何编辑动作 */
    this.committing = false
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
      if (!this.isOpen || this.committing) return
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
  /**
   * @returns {boolean} 是否真的打开。已打开时返回 false 而不是叠一个新实例——
   *   连续双击或「搜索直达 + 双击」可能几乎同时完成两次图片解码，
   *   若无条件新建，第二次会覆盖 this.canvas 而把第一个实例永久泄漏在
   *   同一个 <canvas> 元素上。
   */
  open(request) {
    if (this.isOpen) {
      this.onStatus('图片编辑器已打开')
      return false
    }
    const { image, assetId, originNodeId = null, origin = 'canvas', tool = null } = request
    this.epoch += 1
    this.committing = false
    this.session = new EditorSession({
      sourceAssetId: assetId,
      sourceSize: { width: image.width, height: image.height },
      originNodeId,
      origin
    })
    this.context = request.context ?? null
    this.activeTool = null
    /** 按需加载原图字节的回调；没有原图可恢复时为 null */
    this.loadOriginal = request.loadOriginal ?? null

    this.root.hidden = false
    this.root.setAttribute('aria-hidden', 'false')
    this.titleEl.textContent = origin === 'capture' ? '标注截图' : '编辑图片'
    this.restoreBtn.hidden = !request.canRestore || !this.loadOriginal

    // 懒创建：只有真正打开编辑器时才多出第二个 fabric 实例
    this.canvas = new FullscreenImageEditorCanvas('image-editor-canvas', {
      fabric: this.fabric,
      onOperation: (name, params) => this.#applyOperation(name, params),
      onDraftChange: () => this.#renderPanel()
    })
    this.canvas.load(image, buildRenderPlan(this.session), this.#stageSize())
    this.#selectTool(tool)
    this.#syncBar()
    return true
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
    this.epoch += 1
    this.committing = false
    this.canvas?.dispose()
    this.canvas = null
    this.session = null
    this.context = null
    this.loadOriginal = null
    this.activeTool = null
    this.panel.replaceChildren()
    this.root.hidden = true
    this.root.setAttribute('aria-hidden', 'true')
  }

  /**
   * 取消：有修改时先确认。场景、资源、主历史一概不动。
   *
   * 提交事务在途时拒绝关闭：那笔写入已经发出去了，拦不住也撤不回，
   * 此时放行会得到「用户以为取消了、画布却已经改了」的状态。
   */
  requestClose() {
    if (this.committing) {
      this.onStatus('正在保存编辑结果，请稍候')
      return false
    }
    if (this.session?.isDirty() && !this.confirmDiscard()) return false
    this.#teardown()
    this.onCancel()
    return true
  }

  dispose() {
    window.removeEventListener('keydown', this.keyHandler, true)
    if (this.isOpen) this.#teardown()
  }

  // ── 操作与历史 ──────────────────────────────────────────

  #applyOperation(tool, params) {
    if (!this.session || this.committing) return
    if (tool === 'crop') {
      params = normalizeCrop(params, this.session.resultSize())
    }
    this.session.apply(tool, params)
    this.#rerender()
  }

  undo() {
    if (this.committing) return
    if (this.session?.undo()) this.#rerender()
  }

  redo() {
    if (this.committing) return
    if (this.session?.redo()) this.#rerender()
  }

  /**
   * 「恢复原图」：真正换回**最初导入/截取的那张图**，而不只是撤销本轮操作。
   *
   * 当前对象可能已经历多轮编辑（原图 → A → B），此时撤销只能回到 B，
   * 回不到原图。所以这里重新载入 originalAssetId 的字节，
   * 并把会话重建到那张图上——操作栈一并清空，因为它描述的是旧源图。
   *
   * 主历史仍只在「完成」时落一条，恢复本身不单独提交。
   */
  async #restoreOriginal() {
    if (!this.session || !this.loadOriginal || this.committing) return
    if (this.session.isDirty() && !this.confirmDiscard()) return
    // 记下发起时的世代与归属对象：解码原图是异步的，期间用户完全可能
    // 关掉编辑器再双击打开另一张图。只判断 this.session 非空会把这张
    // 原图错误地载入到别的对象上。
    const epoch = this.epoch
    const { originNodeId, origin } = this.session
    const loadOriginal = this.loadOriginal
    this.restoreBtn.disabled = true
    try {
      const original = await loadOriginal()
      if (this.epoch !== epoch) return // 已经不是当初那个会话了，丢弃结果
      this.session = new EditorSession({
        sourceAssetId: original.assetId,
        sourceSize: { width: original.image.width, height: original.image.height },
        originNodeId,
        origin
      })
      this.canvas.load(original.image, buildRenderPlan(this.session), this.#stageSize())
      this.#syncBar()
      this.#renderPanel()
      this.restoreBtn.hidden = true // 已经是原图了，没得再恢复
      this.onStatus('已恢复到最初的原图')
    } catch (error) {
      if (this.epoch === epoch) this.onStatus(`恢复原图失败：${error.message}`)
    } finally {
      if (this.epoch === epoch) this.restoreBtn.disabled = false
    }
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
    if (!this.session || this.committing) return
    if (!this.session.isDirty()) { this.requestClose(); return }
    const epoch = this.epoch
    // 事务在途期间锁死整个编辑器：取消、恢复、工具、快捷键全部不响应。
    // 否则用户可以一边"取消"一边让事务写入成功。
    this.committing = true
    this.#setBusy(true)
    try {
      const blob = await this.canvas.toBlob('image/png')
      const size = this.session.resultSize()
      // ⚠ 必须**先**等外部事务（登记资源 → 换节点 → 落历史）全部成功，
      //   才允许 teardown。反过来的话，事务一失败用户的编辑就没了，
      //   而且连重试的机会都没有——操作栈已随会话一起销毁。
      await this.onCommit({ blob, size, context: this.context, session: this.session })
      if (this.epoch !== epoch) return // 理论上不可达（提交期间禁止关闭），防御性保留
      this.committing = false
      this.#teardown()
    } catch (error) {
      if (this.epoch !== epoch) return
      // 保留编辑器与操作栈，用户可以改一下再试，或者取消
      this.committing = false
      this.#setBusy(false)
      this.onStatus(`保存编辑结果失败：${error.message}`)
    }
  }

  /** 提交期间把所有会改变状态的入口禁掉，避免与在途事务打架。 */
  #setBusy(busy) {
    this.root.setAttribute('aria-busy', String(busy))
    for (const el of [this.commitBtn, this.cancelBtn, this.restoreBtn, this.undoBtn, this.redoBtn]) {
      el.disabled = busy
    }
    for (const button of this.rail.querySelectorAll('[data-tool]')) button.disabled = busy
    for (const control of this.panel.querySelectorAll('input, button, select')) control.disabled = busy
    if (!busy) this.#syncBar() // 撤销/重做按钮的可用性交回给真实历史深度
  }
}
