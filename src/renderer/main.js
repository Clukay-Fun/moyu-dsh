import JsBarcode from 'jsbarcode'

const appLogoUrl = new URL('../../assets/logo_128.png', import.meta.url).href

document.querySelectorAll('[data-app-logo]').forEach((image) => {
  image.src = appLogoUrl
})

const barcodeTypes = {
  'EAN-13': {
    format: 'EAN13',
    icon: '13',
    color: '#e88c32',
    example: '590123412345',
    inputMode: 'numeric',
    maxLength: 13,
    hint: '需要 12 位数字，或带正确校验位的 13 位数字'
  },
  'UPC-A': {
    format: 'UPC',
    icon: 'U',
    color: '#e75551',
    example: '03600029145',
    inputMode: 'numeric',
    maxLength: 12,
    hint: '需要 11 位数字，或带正确校验位的 12 位数字'
  },
  'EAN-8': {
    format: 'EAN8',
    icon: '8',
    color: '#80cbb2',
    example: '9638507',
    inputMode: 'numeric',
    maxLength: 8,
    hint: '需要 7 位数字，或带正确校验位的 8 位数字'
  },
  Code128: {
    format: 'CODE128',
    icon: '128',
    color: '#88a2e8',
    example: 'MOYU-TOOLS-128',
    inputMode: 'text',
    maxLength: 80,
    hint: '支持 ASCII 字母、数字与常用符号'
  },
  Code39: {
    format: 'CODE39',
    icon: '39',
    color: '#8678d9',
    example: 'MOYU-39',
    inputMode: 'text',
    maxLength: 48,
    hint: '支持大写字母、数字、空格及 -.$/+%'
  },
  ITF: {
    format: 'ITF',
    icon: 'ITF',
    color: '#59a6ae',
    example: '12345670',
    inputMode: 'numeric',
    maxLength: 48,
    hint: '需要偶数位纯数字'
  },
  MSI: {
    format: 'MSI',
    icon: 'MSI',
    color: '#9b7fc6',
    example: '1234567',
    inputMode: 'numeric',
    maxLength: 48,
    hint: '仅支持数字'
  },
  Codabar: {
    format: 'codabar',
    icon: 'CB',
    color: '#bd7c65',
    example: 'A123456A',
    inputMode: 'text',
    maxLength: 48,
    hint: '支持数字、-$:/.+，可用 A–D 作为起止符'
  },
  Auto: {
    format: 'auto',
    icon: 'AUTO',
    color: '#737789',
    example: 'AUTO-123456',
    inputMode: 'text',
    maxLength: 80,
    hint: '由 JsBarcode 自动选择可编码的一维格式'
  }
}

const submenuData = {
  pdf: [
    {
      heading: '转换',
      items: [
        ['转 PNG', 'PNG', '#3c9a5e'],
        ['转 JPEG', 'JPG', '#3c9a5e'],
        ['转 TXT', 'TXT', '#707387'],
        ['转 DOCX', 'DOC', '#2b6cb0'],
        ['转 XLSX', 'XLS', '#217346'],
        ['转 PPTX', 'PPT', '#d24726']
      ]
    },
    {
      heading: '编辑',
      items: [
        ['合并 PDF', '合', '#e0554e'],
        ['拆分 PDF', '拆', '#e0554e'],
        ['旋转 PDF', '旋', '#e0554e'],
        ['提取页', '页', '#e0554e']
      ]
    },
    {
      heading: '转成 PDF',
      items: [
        ['图片转 PDF', 'IMG', '#3c9a5e'],
        ['Word 转 PDF', 'W', '#2b6cb0'],
        ['Excel 转 PDF', 'X', '#217346'],
        ['PPT 转 PDF', 'P', '#d24726']
      ]
    }
  ],
  bc: [
    {
      heading: '条码类型',
      items: Object.entries(barcodeTypes).map(([name, type]) => [name, type.icon, type.color])
    }
  ],
  video: [
    {
      heading: '格式工厂',
      items: [
        ['格式转换', 'CONV', '#6978e6'],
        ['压缩', 'ZIP', '#6978e6'],
        ['抽取音频', 'MP3', '#6978e6']
      ]
    }
  ]
}

const defaultSelections = {
  pdf: '转 PNG',
  bc: 'EAN-13',
  video: '格式转换'
}

const moduleLabels = {
  pdf: 'PDF',
  ai: 'Illustrator',
  bc: '条码',
  image: '图片',
  video: '格式工厂',
  more: '设置'
}

const searchFeatures = [
  ['转 PNG', 'PDF', 'pdf', '转 PNG', 'PDF 图片 PNG 导出'],
  ['转 JPEG', 'PDF', 'pdf', '转 JPEG', 'PDF 图片 JPG JPEG 导出'],
  ['转 TXT', 'PDF', 'pdf', '转 TXT', 'PDF 文字 文本 提取'],
  ['转 DOCX', 'PDF', 'pdf', '转 DOCX', 'PDF Word 内容提取'],
  ['转 XLSX', 'PDF', 'pdf', '转 XLSX', 'PDF Excel 表格提取'],
  ['转 PPTX', 'PDF', 'pdf', '转 PPTX', 'PDF PowerPoint 幻灯片'],
  ['合并 PDF', 'PDF', 'pdf', '合并 PDF', '合并 文件'],
  ['拆分 PDF', 'PDF', 'pdf', '拆分 PDF', '拆分 页面'],
  ['旋转 PDF', 'PDF', 'pdf', '旋转 PDF', '旋转 页面'],
  ['提取页', 'PDF', 'pdf', '提取页', 'PDF 页面 提取'],
  ['图片转 PDF', 'PDF', 'pdf', '图片转 PDF', '图片 PDF'],
  ['Word 转 PDF', 'PDF', 'pdf', 'Word 转 PDF', 'Office DOCX'],
  ['Excel 转 PDF', 'PDF', 'pdf', 'Excel 转 PDF', 'Office XLSX'],
  ['PPT 转 PDF', 'PDF', 'pdf', 'PPT 转 PDF', 'Office PPTX'],
  ['导出 PDF', 'Illustrator', 'ai', '', 'AI 批量 导出'],
  ['最小化 PDF', 'Illustrator', 'ai', '', 'AI PDF 最小化'],
  ['文字转曲', 'Illustrator', 'ai', '', 'AI 文字 转曲'],
  ['EAN-13 条码', '条码', 'bc', 'EAN-13', '商品码 一维码'],
  ['UPC-A 条码', '条码', 'bc', 'UPC-A', '商品码 一维码'],
  ['EAN-8 条码', '条码', 'bc', 'EAN-8', '商品码 一维码'],
  ['Code128 条码', '条码', 'bc', 'Code128', '物流 一维码'],
  ['Code39 条码', '条码', 'bc', 'Code39', '工业 一维码'],
  ['ITF 条码', '条码', 'bc', 'ITF', '外箱 一维码'],
  ['MSI 条码', '条码', 'bc', 'MSI', '库存 一维码'],
  ['Codabar 条码', '条码', 'bc', 'Codabar', '库德巴码 一维码'],
  ['自动格式条码', '条码', 'bc', 'Auto', 'Auto CODE128 一维码'],
  ['图片裁切', '图片', 'image', 'crop', '裁剪 编辑'],
  ['文字水印', '图片', 'image', 'watermark', '水印 编辑'],
  ['尺寸与质量', '图片', 'image', 'resize', '调整 大小 质量'],
  ['图片导出', '图片', 'image', 'export', 'PNG JPG WebP TIFF'],
  ['格式转换', '格式工厂', 'video', '格式转换', 'FFmpeg 视频 音频'],
  ['主题与强调色', '设置', 'more', '', '外观 深色 浅色 颜色'],
  ['关于摸鱼工具箱', '设置', 'more', '', '版本 作者']
].map(([name, group, module, action, keywords]) => ({
  name,
  group,
  module,
  action,
  searchable: `${name} ${group} ${keywords}`.toLowerCase()
}))

const state = {
  module: 'pdf',
  selections: { ...defaultSelections },
  activeSearchIndex: 0,
  searchMatches: [],
  barcodeMode: 'single',
  barcodeDpi: 300,
  barcodeBatchItems: []
}

const submenu = document.querySelector('#submenu')
const searchInput = document.querySelector('#feature-search')
const searchResults = document.querySelector('#search-results')
const toast = document.querySelector('#toast')
let toastTimer
let barcodeRenderedValue = ''
let barcodeRenderedType = ''

function renderSubmenu(module) {
  const groups = submenuData[module]

  if (!groups) {
    submenu.classList.remove('show')
    submenu.replaceChildren()
    return
  }

  const fragment = document.createDocumentFragment()

  groups.forEach((group) => {
    const heading = document.createElement('div')
    heading.className = 'submenu-heading'
    heading.textContent = group.heading
    fragment.append(heading)

    group.items.forEach(([name, icon, color]) => {
      const button = document.createElement('button')
      const iconNode = document.createElement('i')

      button.type = 'button'
      button.className = `submenu-item${state.selections[module] === name ? ' on' : ''}`
      button.dataset.module = module
      button.dataset.action = name
      iconNode.textContent = icon
      iconNode.style.background = color
      button.append(iconNode, document.createTextNode(name))
      fragment.append(button)
    })
  })

  if (module === 'video') {
    const soon = document.createElement('div')
    soon.className = 'submenu-soon'
    soon.textContent = '将在 M6 接入'
    fragment.append(soon)
  }

  submenu.replaceChildren(fragment)
  submenu.classList.add('show')
}

function activateModule(module, action = '') {
  state.module = module

  document.querySelectorAll('.nav-ic').forEach((button) => {
    const isActive = button.dataset.module === module
    button.classList.toggle('active', isActive)
    button.setAttribute('aria-current', isActive ? 'page' : 'false')
  })

  document.querySelectorAll('.page').forEach((page) => {
    page.classList.toggle('active', page.id === `page-${module}`)
  })

  if (action && submenuData[module]) {
    state.selections[module] = action
  }

  renderSubmenu(module)

  if (module === 'pdf') {
    updatePdfState(state.selections.pdf)
  } else if (module === 'bc') {
    document.querySelector('#bc-crumb').textContent = state.selections.bc
    if (action) selectBarcodeType(action, true)
  } else if (module === 'image' && action) {
    setImageMode(action)
  }
}

function getPdfInputType(action) {
  if (action.startsWith('图片')) return '图片'
  if (action.startsWith('Word')) return 'Word'
  if (action.startsWith('Excel')) return 'Excel'
  if (action.startsWith('PPT')) return 'PPT'
  return 'PDF'
}

function updatePdfState(action) {
  const inputType = getPdfInputType(action)
  document.querySelector('#pdf-crumb').textContent = action
  document.querySelector('#pdf-hint').textContent = `上传 ${inputType} 文件后执行“${action}”`
  document.querySelector('#pdf-empty-text').textContent = `上传 ${inputType} 文件`
  document.querySelector('#page-pdf .toolbar .gbtn').textContent = `＋ 上传 ${inputType}`
}

function chooseSubmenu(module, action) {
  state.selections[module] = action
  renderSubmenu(module)

  if (module === 'pdf') {
    updatePdfState(action)
  } else if (module === 'bc') {
    selectBarcodeType(action, true)
  } else if (module === 'video') {
    showToast(`“${action}”将在 M6 接入`)
  }
}

function setImageMode(mode) {
  const copy = {
    crop: ['裁切', '裁切原图后再叠加编辑对象。', 'M2a'],
    watermark: ['文字水印', '在画布中添加和调整文字水印。', 'M2a'],
    resize: ['尺寸与质量', '调整输出尺寸和图像质量。', 'M2c'],
    export: ['导出', '导出 PNG、JPG、WebP 或 TIFF。', 'M2c']
  }
  const selected = copy[mode] || copy.crop

  document.querySelector('#image-editor').dataset.mode = mode
  document.querySelector('#image-crumb').textContent = selected[0]
  document.querySelector('#image-panel-title').textContent = selected[0]
  document.querySelector('#image-panel-copy').textContent = selected[1]
  document.querySelector('#image-side-button')?.remove()
  document.querySelectorAll('.image-tool').forEach((button) => {
    button.classList.toggle('on', button.dataset.imageMode === mode)
  })

  showToast(`“${selected[0]}”界面已切换，真实能力将在 ${selected[2]} 接入`)
}

document.querySelector('.rail').addEventListener('click', (event) => {
  const button = event.target.closest('.nav-ic')
  if (button) activateModule(button.dataset.module)
})

submenu.addEventListener('click', (event) => {
  const button = event.target.closest('.submenu-item')
  if (button) chooseSubmenu(button.dataset.module, button.dataset.action)
})

document.querySelector('.image-tools').addEventListener('click', (event) => {
  const button = event.target.closest('.image-tool')
  if (button) setImageMode(button.dataset.imageMode)
})

function showToast(message) {
  window.clearTimeout(toastTimer)
  toast.textContent = message
  toast.classList.add('show')
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600)
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.placeholder-action')
  if (!button) return

  const name = button.textContent.trim()
  showToast(`“${name}”将在 ${button.dataset.milestone} 接入`)
})

const barcodeInput = document.querySelector('#barcode-value')
const barcodeSvg = document.querySelector('#barcode-svg')
const barcodeMessage = document.querySelector('#barcode-message')
const generateBarcodeButton = document.querySelector('#generate-barcode')
const saveBarcodeSvgButton = document.querySelector('#save-barcode-svg')
const saveBarcodePngButton = document.querySelector('#save-barcode-png')
const barcodeSingleTab = document.querySelector('#barcode-single-tab')
const barcodeBatchTab = document.querySelector('#barcode-batch-tab')
const barcodeSinglePane = document.querySelector('#barcode-single-pane')
const barcodeBatchPane = document.querySelector('#barcode-batch-pane')
const barcodeBatchInput = document.querySelector('#barcode-batch-value')
const barcodeBatchList = document.querySelector('#barcode-batch-list')
const barcodeBatchSummary = document.querySelector('#barcode-batch-summary')
const generateBarcodeBatchButton = document.querySelector('#generate-barcode-batch')
const saveBarcodeBatchSvgButton = document.querySelector('#save-barcode-batch-svg')
const saveBarcodeBatchPngButton = document.querySelector('#save-barcode-batch-png')
const barcodeWidthInput = document.querySelector('#barcode-width-mm')
const barcodeHeightInput = document.querySelector('#barcode-height-mm')
const barcodePixelSize = document.querySelector('#barcode-pixel-size')

function setBarcodeExportEnabled(enabled) {
  saveBarcodeSvgButton.disabled = !enabled
  saveBarcodePngButton.disabled = !enabled
}

function setBarcodeBatchExportEnabled(enabled) {
  saveBarcodeBatchSvgButton.disabled = !enabled
  saveBarcodeBatchPngButton.disabled = !enabled
}

function setBarcodeMessage(message, type = '') {
  barcodeMessage.textContent = message
  barcodeMessage.className = `barcode-message${type ? ` ${type}` : ''}`
  barcodeInput.classList.toggle('invalid', type === 'error')
}

function getBarcodeType() {
  return barcodeTypes[state.selections.bc] || barcodeTypes['EAN-13']
}

function renderBarcodeSvg(svgElement, value, typeName = state.selections.bc) {
  const type = barcodeTypes[typeName]
  if (!type) throw new Error('不支持的条码类型')

  const options = {
    width: 2.4,
    height: 110,
    margin: 18,
    textMargin: 8,
    font: 'Consolas, monospace',
    fontSize: 20,
    lineColor: '#171820',
    background: '#ffffff',
    displayValue: true
  }
  if (type.format !== 'auto') options.format = type.format

  svgElement.replaceChildren()
  JsBarcode(svgElement, value, options)
  svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
}

function friendlyBarcodeError(typeName) {
  const type = barcodeTypes[typeName]
  return `${typeName} 输入无效：${type?.hint || '请检查长度与字符'}。`
}

function generateBarcode() {
  const value = barcodeInput.value.trim()
  barcodeSvg.replaceChildren()
  barcodeRenderedValue = ''
  barcodeRenderedType = ''
  setBarcodeExportEnabled(false)

  try {
    renderBarcodeSvg(barcodeSvg, value)
    barcodeRenderedValue = value
    barcodeRenderedType = state.selections.bc
    setBarcodeExportEnabled(true)
    setBarcodeMessage(`${state.selections.bc} 已生成，可保存为 SVG 或 PNG。`, 'success')
    return true
  } catch {
    const message = friendlyBarcodeError(state.selections.bc)
    setBarcodeMessage(message, 'error')
    showToast(message)
    return false
  }
}

function getPrintSettings() {
  const widthMm = Number(barcodeWidthInput.value)
  const heightMm = Number(barcodeHeightInput.value)

  if (
    !Number.isFinite(widthMm) ||
    !Number.isFinite(heightMm) ||
    widthMm < 10 ||
    widthMm > 300 ||
    heightMm < 10 ||
    heightMm > 300
  ) {
    throw new Error('打印宽高必须在 10–300 mm 之间')
  }

  const widthPx = Math.round(widthMm / 25.4 * state.barcodeDpi)
  const heightPx = Math.round(heightMm / 25.4 * state.barcodeDpi)

  if (widthPx * heightPx > 40_000_000) {
    throw new Error('当前尺寸与 DPI 组合超过 4000 万像素，请降低尺寸或 DPI')
  }

  return {
    widthMm,
    heightMm,
    widthPx,
    heightPx,
    dpi: state.barcodeDpi
  }
}

function updateBarcodePixelSize() {
  try {
    const settings = getPrintSettings()
    barcodePixelSize.textContent = `${settings.widthPx} × ${settings.heightPx} px`
    barcodePixelSize.classList.remove('error')
  } catch (error) {
    barcodePixelSize.textContent = error.message
    barcodePixelSize.classList.add('error')
  }
}

function serializeBarcodeSvg(svgElement = barcodeSvg) {
  const settings = getPrintSettings()
  const clone = svgElement.cloneNode(true)
  clone.removeAttribute('id')
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', `${settings.widthMm}mm`)
  clone.setAttribute('height', `${settings.heightMm}mm`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
}

function svgToPngBytes(svgText, settings = getPrintSettings()) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()

    image.addEventListener('load', () => {
      try {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        canvas.width = settings.widthPx
        canvas.height = settings.heightPx
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, settings.widthPx, settings.heightPx)
        context.drawImage(image, 0, 0, settings.widthPx, settings.heightPx)
        URL.revokeObjectURL(objectUrl)

        canvas.toBlob(async (pngBlob) => {
          if (!pngBlob) {
            reject(new Error('PNG 编码失败'))
            return
          }

          resolve(new Uint8Array(await pngBlob.arrayBuffer()))
        }, 'image/png')
      } catch (error) {
        URL.revokeObjectURL(objectUrl)
        reject(error)
      }
    }, { once: true })

    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('SVG 预览无法转换为 PNG'))
    }, { once: true })

    image.src = objectUrl
  })
}

async function saveBarcode(type) {
  if (
    !barcodeRenderedValue ||
    barcodeInput.value.trim() !== barcodeRenderedValue ||
    barcodeRenderedType !== state.selections.bc
  ) {
    setBarcodeMessage('内容已改变，请先重新生成条码。', 'error')
    return
  }

  const button = type === 'svg' ? saveBarcodeSvgButton : saveBarcodePngButton
  const originalLabel = button.textContent
  button.disabled = true
  button.textContent = '正在保存…'

  try {
    const svgText = serializeBarcodeSvg()
    const data = type === 'svg' ? svgText : await svgToPngBytes(svgText)
    const result = await window.api.saveBarcodeFile({
      type,
      name: `${state.selections.bc}-${barcodeRenderedValue}`,
      data
    })

    if (result.status === 'saved') {
      setBarcodeMessage(`${type.toUpperCase()} 已保存。`, 'success')
      showToast(`${type.toUpperCase()} 条码已保存`)
    } else {
      setBarcodeMessage('已取消保存。')
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setBarcodeMessage(`保存失败：${reason}`, 'error')
    showToast('条码保存失败，请检查目标位置是否可写')
  } finally {
    button.textContent = originalLabel
    setBarcodeExportEnabled(true)
  }
}

function selectBarcodeType(typeName, replaceValue = false) {
  const type = barcodeTypes[typeName]
  if (!type) return

  state.selections.bc = typeName
  document.querySelector('#bc-crumb').textContent = typeName
  barcodeInput.inputMode = type.inputMode
  barcodeInput.maxLength = type.maxLength
  barcodeInput.placeholder = type.hint

  if (replaceValue) {
    barcodeInput.value = type.example
  }

  barcodeRenderedValue = ''
  barcodeRenderedType = ''
  state.barcodeBatchItems = []
  barcodeBatchList.replaceChildren()
  barcodeBatchSummary.textContent = '条码类型已改变，请重新批量生成。'
  setBarcodeBatchExportEnabled(false)
  generateBarcode()
}

function setBarcodeMode(mode) {
  state.barcodeMode = mode
  const isSingle = mode === 'single'
  barcodeSingleTab.classList.toggle('on', isSingle)
  barcodeBatchTab.classList.toggle('on', !isSingle)
  barcodeSingleTab.setAttribute('aria-selected', String(isSingle))
  barcodeBatchTab.setAttribute('aria-selected', String(!isSingle))
  barcodeSinglePane.classList.toggle('active', isSingle)
  barcodeBatchPane.classList.toggle('active', !isSingle)
}

function parseBatchValues(rawValue) {
  return rawValue
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return ''

      if (trimmed.startsWith('"')) {
        const quoted = trimmed.match(/^"((?:[^"]|"")*)"/)
        if (quoted) return quoted[1].replace(/""/g, '"').trim()
      }

      return trimmed.split(/[\t,;]/, 1)[0].trim()
    })
    .filter(Boolean)
}

function createBatchCard(item, index) {
  const card = document.createElement('article')
  const footer = document.createElement('footer')
  const value = document.createElement('span')
  const status = document.createElement('span')

  card.className = `batch-item${item.valid ? '' : ' error'}`
  value.textContent = item.value
  value.title = item.value
  status.textContent = item.valid ? `#${index + 1}` : '错误'

  if (item.valid) {
    card.append(item.svg.cloneNode(true))
  } else {
    const error = document.createElement('div')
    error.className = 'batch-error'
    error.textContent = item.error
    card.append(error)
  }

  footer.append(value, status)
  card.append(footer)
  return card
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

async function generateBarcodeBatch() {
  const values = parseBatchValues(barcodeBatchInput.value)

  if (values.length === 0) {
    barcodeBatchSummary.textContent = '请先输入至少一个编码。'
    return
  }

  if (values.length > 500) {
    barcodeBatchSummary.textContent = `共 ${values.length} 条，超过 500 条上限。`
    showToast('单次最多生成 500 个条码')
    return
  }

  state.barcodeBatchItems = []
  barcodeBatchList.replaceChildren()
  setBarcodeBatchExportEnabled(false)
  generateBarcodeBatchButton.disabled = true
  generateBarcodeBatchButton.textContent = '正在生成…'
  const fragment = document.createDocumentFragment()
  let validCount = 0

  for (const [index, value] of values.entries()) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    let item

    try {
      renderBarcodeSvg(svg, value)
      item = {
        value,
        type: state.selections.bc,
        valid: true,
        svg
      }
      validCount += 1
    } catch {
      item = {
        value,
        type: state.selections.bc,
        valid: false,
        error: friendlyBarcodeError(state.selections.bc)
      }
    }

    state.barcodeBatchItems.push(item)
    fragment.append(createBatchCard(item, index))

    if ((index + 1) % 20 === 0) {
      barcodeBatchList.append(fragment)
      await nextFrame()
    }
  }

  barcodeBatchList.append(fragment)
  const invalidCount = values.length - validCount
  barcodeBatchSummary.textContent = `已生成 ${validCount} 条${invalidCount ? `，${invalidCount} 条输入无效` : ''}。`
  setBarcodeBatchExportEnabled(validCount > 0)
  generateBarcodeBatchButton.disabled = false
  generateBarcodeBatchButton.textContent = '批量生成'
}

function safeBarcodeFileName(typeName, value, index) {
  const compactValue = value.replace(/[^a-z0-9_.-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 54)
  return `${String(index + 1).padStart(3, '0')}-${typeName}-${compactValue || 'barcode'}`
}

async function saveBarcodeBatch(type) {
  const validItems = state.barcodeBatchItems.filter((item) => item.valid)
  if (!validItems.length) {
    barcodeBatchSummary.textContent = '没有可保存的有效条码。'
    return
  }

  const button = type === 'svg' ? saveBarcodeBatchSvgButton : saveBarcodeBatchPngButton
  const originalLabel = button.textContent
  const settings = getPrintSettings()
  setBarcodeBatchExportEnabled(false)
  generateBarcodeBatchButton.disabled = true
  button.textContent = '正在准备…'
  const files = []

  try {
    for (const [index, item] of validItems.entries()) {
      const svgText = serializeBarcodeSvg(item.svg)
      files.push({
        name: safeBarcodeFileName(item.type, item.value, index),
        data: type === 'svg' ? svgText : await svgToPngBytes(svgText, settings)
      })
      barcodeBatchSummary.textContent = `正在准备 ${index + 1} / ${validItems.length}…`
      if ((index + 1) % 10 === 0) await nextFrame()
    }

    const stopProgress = window.api.onBarcodeSaveProgress((progress) => {
      barcodeBatchSummary.textContent = `正在保存 ${progress.completed} / ${progress.total} · ${progress.name}`
    })

    try {
      const result = await window.api.saveBarcodeFiles({ type, files })
      if (result.status === 'saved') {
        barcodeBatchSummary.textContent = `已保存 ${result.saved} 个 ${type.toUpperCase()} 文件。`
        showToast(`批量条码已保存：${result.saved} 个文件`)
      } else {
        barcodeBatchSummary.textContent = '已取消批量保存。'
      }
    } finally {
      stopProgress()
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    barcodeBatchSummary.textContent = `批量保存失败：${reason}`
    showToast('批量条码保存失败')
  } finally {
    button.textContent = originalLabel
    generateBarcodeBatchButton.disabled = false
    setBarcodeBatchExportEnabled(validItems.length > 0)
  }
}

generateBarcodeButton.addEventListener('click', generateBarcode)
barcodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') generateBarcode()
})
barcodeInput.addEventListener('input', () => {
  barcodeRenderedValue = ''
  barcodeRenderedType = ''
  setBarcodeExportEnabled(false)
  setBarcodeMessage('内容已修改，请重新生成。')
})
saveBarcodeSvgButton.addEventListener('click', () => saveBarcode('svg'))
saveBarcodePngButton.addEventListener('click', () => saveBarcode('png'))
barcodeSingleTab.addEventListener('click', () => setBarcodeMode('single'))
barcodeBatchTab.addEventListener('click', () => setBarcodeMode('batch'))
generateBarcodeBatchButton.addEventListener('click', generateBarcodeBatch)
saveBarcodeBatchSvgButton.addEventListener('click', () => saveBarcodeBatch('svg'))
saveBarcodeBatchPngButton.addEventListener('click', () => saveBarcodeBatch('png'))
barcodeBatchInput.addEventListener('input', () => {
  state.barcodeBatchItems = []
  barcodeBatchList.replaceChildren()
  barcodeBatchSummary.textContent = '内容已修改，请重新批量生成。'
  setBarcodeBatchExportEnabled(false)
})
document.querySelector('#barcode-dpi').addEventListener('click', (event) => {
  const button = event.target.closest('[data-dpi]')
  if (!button) return

  state.barcodeDpi = Number(button.dataset.dpi)
  document.querySelectorAll('#barcode-dpi button').forEach((option) => {
    option.classList.toggle('on', option === button)
  })
  updateBarcodePixelSize()
})
;[barcodeWidthInput, barcodeHeightInput].forEach((input) => {
  input.addEventListener('input', updateBarcodePixelSize)
  input.addEventListener('change', () => {
    const value = Number(input.value)
    input.value = String(Math.min(300, Math.max(10, Number.isFinite(value) ? value : 10)))
    updateBarcodePixelSize()
  })
})

function renderSearchResults(query) {
  const normalized = query.trim().toLowerCase()
  state.searchMatches = normalized
    ? searchFeatures.filter((feature) => feature.searchable.includes(normalized)).slice(0, 12)
    : searchFeatures.slice(0, 8)
  state.activeSearchIndex = 0

  if (!state.searchMatches.length) {
    const empty = document.createElement('div')
    empty.className = 'search-empty'
    empty.textContent = '没有匹配的功能'
    searchResults.replaceChildren(empty)
  } else {
    const fragment = document.createDocumentFragment()
    let previousGroup = ''

    state.searchMatches.forEach((feature, index) => {
      if (feature.group !== previousGroup) {
        const heading = document.createElement('div')
        heading.className = 'search-group'
        heading.textContent = feature.group
        fragment.append(heading)
        previousGroup = feature.group
      }

      const button = document.createElement('button')
      const icon = document.createElement('i')
      const name = document.createElement('span')
      const group = document.createElement('small')

      button.type = 'button'
      button.className = `search-result${index === state.activeSearchIndex ? ' active' : ''}`
      button.dataset.index = String(index)
      button.setAttribute('role', 'option')
      icon.textContent = moduleLabels[feature.module].slice(0, 3)
      name.textContent = feature.name
      group.textContent = feature.group
      button.append(icon, name, group)
      fragment.append(button)
    })

    searchResults.replaceChildren(fragment)
  }

  searchResults.classList.add('open')
  searchInput.setAttribute('aria-expanded', 'true')
}

function closeSearch() {
  searchResults.classList.remove('open')
  searchInput.setAttribute('aria-expanded', 'false')
}

function runSearchResult(index) {
  const feature = state.searchMatches[index]
  if (!feature) return

  activateModule(feature.module, feature.action)
  searchInput.value = ''
  closeSearch()

  if (['ai', 'video'].includes(feature.module)) {
    showToast(`已定位“${feature.name}”，功能将在对应里程碑接入`)
  }
}

function refreshActiveSearchResult() {
  searchResults.querySelectorAll('.search-result').forEach((button, index) => {
    button.classList.toggle('active', index === state.activeSearchIndex)
  })
}

searchInput.addEventListener('focus', () => renderSearchResults(searchInput.value))
searchInput.addEventListener('input', () => renderSearchResults(searchInput.value))
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    state.activeSearchIndex = Math.min(state.activeSearchIndex + 1, state.searchMatches.length - 1)
    refreshActiveSearchResult()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    state.activeSearchIndex = Math.max(state.activeSearchIndex - 1, 0)
    refreshActiveSearchResult()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    runSearchResult(state.activeSearchIndex)
  } else if (event.key === 'Escape') {
    closeSearch()
    searchInput.blur()
  }
})

searchResults.addEventListener('click', (event) => {
  const button = event.target.closest('.search-result')
  if (button) runSearchResult(Number(button.dataset.index))
})

document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.search-wrap')) closeSearch()
})

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    searchInput.focus()
    searchInput.select()
  }
})

const timerStartedAt = Date.now()
const mochiTime = document.querySelector('#mochi-time')

function updateMochiTimer() {
  const elapsedSeconds = Math.floor((Date.now() - timerStartedAt) / 1000)
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')
  const seconds = String(elapsedSeconds % 60).padStart(2, '0')
  mochiTime.textContent = `${minutes}:${seconds}`
}

updateMochiTimer()
window.setInterval(updateMochiTimer, 1000)

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(theme) {
  const resolved = theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme
  document.body.dataset.theme = resolved
  document.body.dataset.themePreference = theme
  localStorage.setItem('theme', theme)
}

document.querySelectorAll('input[name="theme"]').forEach((input) => {
  input.addEventListener('change', () => applyTheme(input.value))
})

systemTheme.addEventListener('change', () => {
  if (document.body.dataset.themePreference === 'system') applyTheme('system')
})

const savedTheme = localStorage.getItem('theme') || 'system'
const savedThemeInput = document.querySelector(`input[name="theme"][value="${savedTheme}"]`)
if (savedThemeInput) savedThemeInput.checked = true
applyTheme(savedTheme)

const colorState = { h: 0, s: 0, l: 0, r: 105, g: 120, b: 230 }
const colorWheel = document.querySelector('#color-wheel')
const colorMarker = document.querySelector('#wheel-marker')
const colorContext = colorWheel.getContext('2d')

function drawColorWheel() {
  const outerRadius = 90
  const innerRadius = 50

  for (let angle = 0; angle < 360; angle += 1) {
    const start = (angle - 1) * Math.PI / 180
    const end = (angle + 1) * Math.PI / 180

    for (let radius = innerRadius; radius <= outerRadius; radius += 2) {
      const saturation = (radius - innerRadius) / (outerRadius - innerRadius)
      colorContext.fillStyle = `hsl(${angle} ${Math.round(saturation * 100)}% 55%)`
      colorContext.beginPath()
      colorContext.arc(100, 100, radius, start, end)
      colorContext.lineTo(100, 100)
      colorContext.fill()
    }
  }
}

function rgbToHsl(red, green, blue) {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2

  if (max === min) {
    colorState.h = 0
    colorState.s = 0
  } else {
    const delta = max - min
    colorState.s = Math.round((lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)) * 100)
    colorState.h = Math.round((
      max === r
        ? (g - b) / delta + (g < b ? 6 : 0)
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4
    ) * 60)
  }

  colorState.l = Math.round(lightness * 100)
}

function hslToRgb(hue, saturation, lightness) {
  const s = saturation / 100
  const l = lightness / 100
  const amplitude = s * Math.min(l, 1 - l)
  const channel = (offset) => {
    const k = (offset + hue / 30) % 12
    return l - amplitude * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }

  colorState.r = Math.round(channel(0) * 255)
  colorState.g = Math.round(channel(8) * 255)
  colorState.b = Math.round(channel(4) * 255)
}

function colorHex() {
  return `#${[colorState.r, colorState.g, colorState.b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

function applyAccent() {
  const rootStyle = document.documentElement.style
  rootStyle.setProperty('--accent-r', colorState.r)
  rootStyle.setProperty('--accent-g', colorState.g)
  rootStyle.setProperty('--accent-b', colorState.b)
  localStorage.setItem('accent', colorHex())
}

function updateColorControls() {
  ;['r', 'g', 'b'].forEach((channel) => {
    document.querySelector(`#color-${channel}`).value = colorState[channel]
    document.querySelector(`#color-${channel}-value`).textContent = colorState[channel]
  })
  document.querySelector('#color-hex').value = colorHex()
  document.querySelector('#color-swatch').style.background = colorHex()

  const angle = colorState.h * Math.PI / 180
  const distance = 48 + (colorState.s / 100) * 44
  colorMarker.style.left = `${100 + Math.cos(angle) * distance}px`
  colorMarker.style.top = `${100 + Math.sin(angle) * distance}px`
}

function setAccentFromRgbInputs() {
  colorState.r = Number(document.querySelector('#color-r').value)
  colorState.g = Number(document.querySelector('#color-g').value)
  colorState.b = Number(document.querySelector('#color-b').value)
  rgbToHsl(colorState.r, colorState.g, colorState.b)
  updateColorControls()
  applyAccent()
}

document.querySelectorAll('.slider-row input').forEach((input) => {
  input.addEventListener('input', setAccentFromRgbInputs)
})

document.querySelector('#color-hex').addEventListener('change', (event) => {
  const value = event.target.value.trim()
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    updateColorControls()
    return
  }

  colorState.r = Number.parseInt(value.slice(1, 3), 16)
  colorState.g = Number.parseInt(value.slice(3, 5), 16)
  colorState.b = Number.parseInt(value.slice(5, 7), 16)
  rgbToHsl(colorState.r, colorState.g, colorState.b)
  updateColorControls()
  applyAccent()
})

document.querySelector('#reset-accent').addEventListener('click', () => {
  Object.assign(colorState, { r: 105, g: 120, b: 230 })
  rgbToHsl(colorState.r, colorState.g, colorState.b)
  updateColorControls()
  applyAccent()
})

let colorDragging = false

function pickWheelColor(event) {
  const rect = colorWheel.getBoundingClientRect()
  const x = event.clientX - rect.left - 100
  const y = event.clientY - rect.top - 100
  const distance = Math.hypot(x, y)

  if (distance < 48 || distance > 92) return

  colorState.h = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360)
  colorState.s = Math.round(Math.min(1, Math.max(0, (distance - 48) / 44)) * 100)
  colorState.l = 55
  hslToRgb(colorState.h, colorState.s, colorState.l)
  updateColorControls()
  applyAccent()
}

colorWheel.addEventListener('pointerdown', (event) => {
  colorDragging = true
  colorWheel.setPointerCapture(event.pointerId)
  pickWheelColor(event)
})
colorWheel.addEventListener('pointermove', (event) => {
  if (colorDragging) pickWheelColor(event)
})
colorWheel.addEventListener('pointerup', () => {
  colorDragging = false
})

async function verifyPreloadBridge() {
  try {
    document.body.dataset.ipc = await window.api.ping()
  } catch {
    document.body.dataset.ipc = 'error'
  }
}

const savedAccent = localStorage.getItem('accent')
if (/^#[0-9a-f]{6}$/i.test(savedAccent || '')) {
  colorState.r = Number.parseInt(savedAccent.slice(1, 3), 16)
  colorState.g = Number.parseInt(savedAccent.slice(3, 5), 16)
  colorState.b = Number.parseInt(savedAccent.slice(5, 7), 16)
}

drawColorWheel()
rgbToHsl(colorState.r, colorState.g, colorState.b)
updateColorControls()
applyAccent()
updateBarcodePixelSize()
setBarcodeMode('single')
generateBarcode()
activateModule('pdf', defaultSelections.pdf)
verifyPreloadBridge()
