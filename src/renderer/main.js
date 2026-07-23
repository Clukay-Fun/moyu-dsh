import JsBarcode from 'jsbarcode'
import { fabric } from 'fabric'

globalThis.fabric = fabric
const eraserBrushReady = import('fabric/src/mixins/eraser_brush.mixin.js')
  .then(() => fabric.EraserBrush)

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
  ['调色与马赛克', '图片', 'image', 'adjust', '亮度 对比度 饱和度 像素化'],
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
  if (button && !button.classList.contains('placeholder-action')) {
    setImageMode(button.dataset.imageMode)
  }
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

const imageEditor = document.querySelector('#image-editor')
const imageDropZone = document.querySelector('#image-drop-zone')
const imageStage = document.querySelector('#image-stage')
const imageEmpty = document.querySelector('#image-empty')
const imageFileInput = document.querySelector('#image-file-input')
const imageFileName = document.querySelector('#image-filename')
const imageDimensions = document.querySelector('#image-dimensions')
const imageStatus = document.querySelector('#image-status')
const imageZoom = document.querySelector('#image-zoom')
const imagePanelTitle = document.querySelector('#image-panel-title')
const imagePanelCopy = document.querySelector('#image-panel-copy')
const imagePanelContent = document.querySelector('#image-panel-content')
const quickSaveImageButton = document.querySelector('#quick-save-image')
const undoImageButton = document.querySelector('#undo-image')
const redoImageButton = document.querySelector('#redo-image')
const imageCanvas = new fabric.Canvas('image-canvas-element', {
  preserveObjectStacking: true,
  selection: true,
  backgroundColor: 'transparent'
})
const imageState = {
  sourceCanvas: null,
  sourceWidth: 0,
  sourceHeight: 0,
  baseImage: null,
  cropRect: null,
  mode: 'crop',
  format: 'png',
  quality: 0.9,
  exporting: false,
  restoring: false,
  brushKind: 'pen',
  brushSize: 8,
  adjustments: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    pixelate: 1
  },
  history: [],
  historyIndex: -1,
  fileName: 'edited-image.png'
}

imageCanvas.setDimensions({ width: 1, height: 1 })
quickSaveImageButton.disabled = true
undoImageButton.disabled = true
redoImageButton.disabled = true

function setImageStatus(message, isError = false) {
  imageStatus.textContent = message
  imageStatus.classList.toggle('error', isError)
}

function updateImageHistoryButtons() {
  undoImageButton.disabled = imageState.historyIndex <= 0 || imageState.restoring
  redoImageButton.disabled =
    imageState.historyIndex < 0 ||
    imageState.historyIndex >= imageState.history.length - 1 ||
    imageState.restoring
}

function captureImageSnapshot() {
  const canvasJson = imageCanvas.toJSON([
    'dataRole',
    'overlayType',
    'erasable',
    'globalCompositeOperation'
  ])

  return {
    sourceCanvas: imageState.sourceCanvas,
    sourceWidth: imageState.sourceWidth,
    sourceHeight: imageState.sourceHeight,
    fileName: imageState.fileName,
    adjustments: { ...imageState.adjustments },
    canvasJson: JSON.parse(JSON.stringify(canvasJson))
  }
}

function commitImageHistory() {
  if (!imageState.sourceCanvas || imageState.restoring) return

  const snapshot = captureImageSnapshot()
  const previous = imageState.history[imageState.historyIndex]
  const unchanged =
    previous?.sourceCanvas === snapshot.sourceCanvas &&
    JSON.stringify(previous.adjustments) === JSON.stringify(snapshot.adjustments) &&
    JSON.stringify(previous.canvasJson) === JSON.stringify(snapshot.canvasJson)

  if (unchanged) return

  imageState.history.splice(imageState.historyIndex + 1)
  imageState.history.push(snapshot)

  if (imageState.history.length > 20) {
    imageState.history.shift()
  }

  imageState.historyIndex = imageState.history.length - 1
  updateImageHistoryButtons()
}

function resetImageHistory() {
  imageState.history = []
  imageState.historyIndex = -1
  updateImageHistoryButtons()
}

function enlivenImageObjects(objects) {
  return new Promise((resolve) => {
    fabric.util.enlivenObjects(objects || [], resolve)
  })
}

async function restoreImageHistory(index) {
  const snapshot = imageState.history[index]
  if (!snapshot || imageState.restoring) return

  imageState.restoring = true
  updateImageHistoryButtons()
  imageCanvas.isDrawingMode = false
  removeCropSelection()

  try {
    const overlays = await enlivenImageObjects(snapshot.canvasJson.objects)
    imageState.sourceCanvas = snapshot.sourceCanvas
    imageState.sourceWidth = snapshot.sourceWidth
    imageState.sourceHeight = snapshot.sourceHeight
    imageState.fileName = snapshot.fileName
    imageState.adjustments = { ...snapshot.adjustments }
    imageFileName.textContent = snapshot.fileName
    imageState.historyIndex = index
    rebuildImageCanvas(overlays)
    setImageMode(imageState.mode)
    setImageStatus(`已${index < imageState.history.length - 1 ? '撤销或重做' : '恢复'}编辑状态`)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setImageStatus(`历史状态恢复失败：${reason}`, true)
  } finally {
    imageState.restoring = false
    updateImageHistoryButtons()
  }
}

function getImagePreviewSize(width = imageState.sourceWidth, height = imageState.sourceHeight) {
  const maxWidth = Math.max(220, imageDropZone.clientWidth - 48)
  const maxHeight = Math.max(180, imageDropZone.clientHeight - 48)
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  }
}

function removeCropSelection() {
  if (!imageState.cropRect) return
  imageCanvas.remove(imageState.cropRect)
  imageState.cropRect = null
}

function getOverlayObjects() {
  return imageCanvas.getObjects().filter((object) => object.dataRole === 'overlay')
}

function rebuildImageCanvas(overlays = []) {
  if (!imageState.sourceCanvas) return

  const preview = getImagePreviewSize()
  imageCanvas.clear()
  imageCanvas.setDimensions({ width: preview.width, height: preview.height })
  imageState.baseImage = new fabric.Image(imageState.sourceCanvas, {
    left: 0,
    top: 0,
    scaleX: preview.width / imageState.sourceWidth,
    scaleY: preview.height / imageState.sourceHeight,
    selectable: false,
    evented: false,
    hoverCursor: 'default',
    dataRole: 'base',
    erasable: false,
    excludeFromExport: true
  })
  imageCanvas.add(imageState.baseImage)
  applyImageAdjustments(false)
  overlays.forEach((object) => imageCanvas.add(object))
  imageCanvas.sendToBack(imageState.baseImage)
  imageCanvas.requestRenderAll()
  imageStage.classList.add('ready')
  imageEmpty.classList.add('hidden')
  imageZoom.textContent = `${Math.round(preview.scale * 100)}%`
  imageDimensions.textContent = `${imageState.sourceWidth} × ${imageState.sourceHeight} px`
  quickSaveImageButton.disabled = false
}

function createCropSelection() {
  if (!imageState.sourceCanvas) return
  removeCropSelection()
  const width = imageCanvas.getWidth()
  const height = imageCanvas.getHeight()
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6978e6'
  imageState.cropRect = new fabric.Rect({
    left: width * 0.1,
    top: height * 0.1,
    width: width * 0.8,
    height: height * 0.8,
    fill: 'rgba(105, 120, 230, 0.08)',
    stroke: accent,
    strokeWidth: 1.5,
    strokeDashArray: [7, 5],
    cornerColor: '#ffffff',
    cornerStrokeColor: accent,
    transparentCorners: false,
    cornerStyle: 'circle',
    lockRotation: true,
    hasRotatingPoint: false,
    dataRole: 'crop',
    erasable: false,
    excludeFromExport: true
  })
  imageCanvas.add(imageState.cropRect)
  imageCanvas.setActiveObject(imageState.cropRect)
  imageCanvas.requestRenderAll()
}

function ensureImageLoaded() {
  if (imageState.sourceCanvas) return true
  showToast('请先添加图片')
  return false
}

function selectedImageOverlay() {
  const activeObject = imageCanvas.getActiveObject()
  return activeObject?.dataRole === 'overlay' ? activeObject : null
}

function transformSelectedImageObject(action) {
  const object = selectedImageOverlay()
  if (!object) return false

  if (action === 'rotate') {
    object.rotate((object.angle + 90) % 360)
  } else if (action === 'flip-horizontal') {
    object.set({ flipX: !object.flipX })
  } else if (action === 'flip-vertical') {
    object.set({ flipY: !object.flipY })
  }

  object.setCoords()
  imageCanvas.requestRenderAll()
  commitImageHistory()
  setImageStatus('已变换选中的编辑对象')
  return true
}

function transformWholeImage(action) {
  if (!ensureImageLoaded()) return
  if (transformSelectedImageObject(action)) return

  imageCanvas.isDrawingMode = false
  removeCropSelection()
  const overlays = getOverlayObjects()
  const oldSourceWidth = imageState.sourceWidth
  const oldSourceHeight = imageState.sourceHeight
  const oldPreviewWidth = imageCanvas.getWidth()
  const oldPreviewHeight = imageCanvas.getHeight()
  const oldScale = oldPreviewWidth / oldSourceWidth
  const transformedCanvas = document.createElement('canvas')
  const context = transformedCanvas.getContext('2d')

  if (action === 'rotate') {
    transformedCanvas.width = oldSourceHeight
    transformedCanvas.height = oldSourceWidth
    context.translate(oldSourceHeight, 0)
    context.rotate(Math.PI / 2)
  } else {
    transformedCanvas.width = oldSourceWidth
    transformedCanvas.height = oldSourceHeight

    if (action === 'flip-horizontal') {
      context.translate(oldSourceWidth, 0)
      context.scale(-1, 1)
    } else {
      context.translate(0, oldSourceHeight)
      context.scale(1, -1)
    }
  }

  context.drawImage(imageState.sourceCanvas, 0, 0)
  imageState.sourceCanvas = transformedCanvas
  imageState.sourceWidth = transformedCanvas.width
  imageState.sourceHeight = transformedCanvas.height
  const nextPreview = getImagePreviewSize()
  const nextScale = nextPreview.width / imageState.sourceWidth
  const objectScale = nextScale / oldScale

  overlays.forEach((object) => {
    const center = object.getCenterPoint()
    const sourceX = center.x / oldPreviewWidth * oldSourceWidth
    const sourceY = center.y / oldPreviewHeight * oldSourceHeight
    let nextSourceX = sourceX
    let nextSourceY = sourceY

    if (action === 'rotate') {
      nextSourceX = oldSourceHeight - sourceY
      nextSourceY = sourceX
      object.rotate((object.angle + 90) % 360)
    } else if (action === 'flip-horizontal') {
      nextSourceX = oldSourceWidth - sourceX
      object.set({
        angle: -object.angle,
        flipX: !object.flipX
      })
    } else {
      nextSourceY = oldSourceHeight - sourceY
      object.set({
        angle: -object.angle,
        flipY: !object.flipY
      })
    }

    object.set({
      scaleX: object.scaleX * objectScale,
      scaleY: object.scaleY * objectScale
    })
    object.setPositionByOrigin(
      new fabric.Point(nextSourceX * nextScale, nextSourceY * nextScale),
      'center',
      'center'
    )
    object.setCoords()
  })

  rebuildImageCanvas(overlays)
  commitImageHistory()
  const label = {
    rotate: '顺时针旋转 90°',
    'flip-horizontal': '水平翻转',
    'flip-vertical': '垂直翻转'
  }[action]
  setImageStatus(`${label}完成`)
}

async function configureImageBrush(kind = imageState.brushKind) {
  imageState.brushKind = kind

  if (!imageState.sourceCanvas || imageState.mode !== 'draw') {
    imageCanvas.isDrawingMode = false
    return
  }

  imageCanvas.discardActiveObject()
  imageCanvas.isDrawingMode = true

  if (kind === 'eraser') {
    const EraserBrush = await eraserBrushReady
    imageCanvas.freeDrawingBrush = new EraserBrush(imageCanvas)
    imageCanvas.freeDrawingBrush.width = imageState.brushSize
  } else {
    const brush = new fabric.PencilBrush(imageCanvas)
    brush.width = kind === 'highlight' ? imageState.brushSize * 2 : imageState.brushSize
    brush.color = kind === 'highlight'
      ? 'rgba(255, 218, 72, 0.38)'
      : '#20242f'
    imageCanvas.freeDrawingBrush = brush
  }

  imageCanvas.requestRenderAll()
}

function applyImageAdjustments(render = true) {
  if (!imageState.baseImage) return

  const filters = []
  const { brightness, contrast, saturation, pixelate } = imageState.adjustments

  if (brightness !== 0) {
    filters.push(new fabric.Image.filters.Brightness({ brightness: brightness / 100 }))
  }
  if (contrast !== 0) {
    filters.push(new fabric.Image.filters.Contrast({ contrast: contrast / 100 }))
  }
  if (saturation !== 0) {
    filters.push(new fabric.Image.filters.Saturation({ saturation: saturation / 100 }))
  }
  if (pixelate > 1) {
    filters.push(new fabric.Image.filters.Pixelate({ blocksize: pixelate }))
  }

  imageState.baseImage.filters = filters
  imageState.baseImage.applyFilters()
  imageState.baseImage.dirty = true
  if (render) imageCanvas.requestRenderAll()
}

function renderImagePanel() {
  imagePanelContent.replaceChildren()

  if (imageState.mode === 'crop') {
    imagePanelTitle.textContent = '裁切'
    imagePanelCopy.textContent = '拖动并缩放选框，再裁切原图。'
    imagePanelContent.innerHTML = `
      <div class="image-panel">
        <div class="panel-actions">
          <button class="gbtn" id="reset-image-crop" type="button">重置选框</button>
          <button class="primary" id="apply-image-crop" type="button">应用裁切</button>
        </div>
      </div>
    `
    imagePanelContent.querySelector('#reset-image-crop').addEventListener('click', () => {
      if (ensureImageLoaded()) createCropSelection()
    })
    imagePanelContent.querySelector('#apply-image-crop').addEventListener('click', applyImageCrop)
  } else if (imageState.mode === 'transform') {
    imagePanelTitle.textContent = '旋转与翻转'
    imagePanelCopy.textContent = '选中水印或笔迹时只变换对象；未选中时变换整张图片。'
    imagePanelContent.innerHTML = `
      <div class="image-panel">
        <div class="panel-actions">
          <button class="gbtn wide" id="rotate-image" type="button">顺时针旋转 90°</button>
          <button class="gbtn" id="flip-image-horizontal" type="button">水平翻转</button>
          <button class="gbtn" id="flip-image-vertical" type="button">垂直翻转</button>
        </div>
      </div>
    `
    imagePanelContent.querySelector('#rotate-image').addEventListener('click', () => transformWholeImage('rotate'))
    imagePanelContent.querySelector('#flip-image-horizontal').addEventListener('click', () => transformWholeImage('flip-horizontal'))
    imagePanelContent.querySelector('#flip-image-vertical').addEventListener('click', () => transformWholeImage('flip-vertical'))
  } else if (imageState.mode === 'watermark') {
    imagePanelTitle.textContent = '文字水印'
    imagePanelCopy.textContent = '添加后可在画布中拖动、缩放和旋转。'
    imagePanelContent.innerHTML = `
      <div class="image-panel">
        <label>文字<input id="watermark-text" type="text" value="摸鱼工具箱" maxlength="80"></label>
        <label class="inline-value"><span>字号</span><output id="watermark-size-value">36</output></label>
        <input id="watermark-size" type="range" min="12" max="120" value="36">
        <label>颜色<input id="watermark-color" type="color" value="#ffffff"></label>
        <label class="inline-value"><span>透明度</span><output id="watermark-opacity-value">70%</output></label>
        <input id="watermark-opacity" type="range" min="10" max="100" value="70">
        <button class="primary" id="add-watermark" type="button">添加文字水印</button>
      </div>
    `
    const textInput = imagePanelContent.querySelector('#watermark-text')
    const sizeInput = imagePanelContent.querySelector('#watermark-size')
    const colorInput = imagePanelContent.querySelector('#watermark-color')
    const opacityInput = imagePanelContent.querySelector('#watermark-opacity')

    function updateSelectedWatermark() {
      const activeObject = imageCanvas.getActiveObject()
      if (activeObject?.dataRole !== 'overlay' || activeObject?.overlayType !== 'watermark') return
      activeObject.set({
        text: textInput.value || '水印',
        fontSize: Number(sizeInput.value),
        fill: colorInput.value,
        opacity: Number(opacityInput.value) / 100
      })
      activeObject.setCoords()
      imageCanvas.requestRenderAll()
    }

    sizeInput.addEventListener('input', () => {
      imagePanelContent.querySelector('#watermark-size-value').textContent = sizeInput.value
      updateSelectedWatermark()
    })
    opacityInput.addEventListener('input', () => {
      imagePanelContent.querySelector('#watermark-opacity-value').textContent = `${opacityInput.value}%`
      updateSelectedWatermark()
    })
    textInput.addEventListener('input', updateSelectedWatermark)
    textInput.addEventListener('change', commitImageHistory)
    sizeInput.addEventListener('change', commitImageHistory)
    colorInput.addEventListener('input', updateSelectedWatermark)
    colorInput.addEventListener('change', commitImageHistory)
    opacityInput.addEventListener('change', commitImageHistory)
    imagePanelContent.querySelector('#add-watermark').addEventListener('click', () => {
      if (!ensureImageLoaded()) return
      const watermark = new fabric.IText(textInput.value || '水印', {
        left: imageCanvas.getWidth() / 2,
        top: imageCanvas.getHeight() / 2,
        originX: 'center',
        originY: 'center',
        fontFamily: 'Segoe UI, Microsoft YaHei UI, sans-serif',
        fontSize: Number(sizeInput.value),
        fill: colorInput.value,
        opacity: Number(opacityInput.value) / 100,
        padding: 5,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#6978e6',
        transparentCorners: false,
        dataRole: 'overlay',
        overlayType: 'watermark',
        erasable: true
      })
      imageCanvas.add(watermark)
      imageCanvas.setActiveObject(watermark)
      imageCanvas.requestRenderAll()
      commitImageHistory()
      setImageStatus('文字水印已添加，可直接拖动调整')
    })
  } else if (imageState.mode === 'draw') {
    imagePanelTitle.textContent = '涂鸦'
    imagePanelCopy.textContent = '黑笔与荧光笔绘制编辑层；橡皮擦只擦编辑对象，不擦底图。'
    imagePanelContent.innerHTML = `
      <div class="image-panel">
        <div class="brush-choice" id="image-brush-choice">
          <button type="button" data-brush="pen">黑笔</button>
          <button type="button" data-brush="highlight">荧光笔</button>
          <button type="button" data-brush="eraser">橡皮擦</button>
        </div>
        <label class="inline-value"><span>画笔大小</span><output id="image-brush-size-value">${imageState.brushSize}</output></label>
        <input id="image-brush-size" type="range" min="2" max="60" value="${imageState.brushSize}">
      </div>
    `
    const brushChoice = imagePanelContent.querySelector('#image-brush-choice')
    const brushSize = imagePanelContent.querySelector('#image-brush-size')
    brushChoice.querySelectorAll('[data-brush]').forEach((button) => {
      button.classList.toggle('on', button.dataset.brush === imageState.brushKind)
    })
    brushChoice.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-brush]')
      if (!button) return
      brushChoice.querySelectorAll('[data-brush]').forEach((option) => {
        option.classList.toggle('on', option === button)
      })

      try {
        await configureImageBrush(button.dataset.brush)
        setImageStatus(`${button.textContent}已启用`)
      } catch {
        setImageStatus('橡皮擦组件载入失败', true)
      }
    })
    brushSize.addEventListener('input', () => {
      imageState.brushSize = Number(brushSize.value)
      imagePanelContent.querySelector('#image-brush-size-value').textContent = brushSize.value
      configureImageBrush()
    })
  } else if (imageState.mode === 'adjust') {
    imagePanelTitle.textContent = '调色与马赛克'
    imagePanelCopy.textContent = '基础调色实时预览；块度大于 1 时启用整图马赛克。'
    const controls = [
      ['brightness', '亮度', -100, 100],
      ['contrast', '对比度', -100, 100],
      ['saturation', '饱和度', -100, 100],
      ['pixelate', '马赛克块度', 1, 40]
    ]
    imagePanelContent.innerHTML = `
      <div class="image-panel">
        ${controls.map(([name, label, min, max]) => `
          <label class="inline-value"><span>${label}</span><output id="image-${name}-value">${imageState.adjustments[name]}</output></label>
          <input id="image-${name}" data-adjustment="${name}" type="range" min="${min}" max="${max}" value="${imageState.adjustments[name]}">
        `).join('')}
        <button class="gbtn" id="reset-image-adjustments" type="button">重置调整</button>
      </div>
    `
    imagePanelContent.querySelectorAll('[data-adjustment]').forEach((input) => {
      input.addEventListener('input', () => {
        imageState.adjustments[input.dataset.adjustment] = Number(input.value)
        imagePanelContent.querySelector(`#image-${input.dataset.adjustment}-value`).textContent = input.value
        applyImageAdjustments()
      })
      input.addEventListener('change', () => {
        commitImageHistory()
        setImageStatus('图片调整已更新')
      })
    })
    imagePanelContent.querySelector('#reset-image-adjustments').addEventListener('click', () => {
      Object.assign(imageState.adjustments, {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        pixelate: 1
      })
      applyImageAdjustments()
      renderImagePanel()
      commitImageHistory()
      setImageStatus('图片调整已重置')
    })
  } else {
    imagePanelTitle.textContent = '导出'
    imagePanelCopy.textContent = 'PNG 保留透明；JPG 自动铺白底。'
    imagePanelContent.innerHTML = `
      <div class="image-panel">
        <div class="format-choice" id="image-format-choice">
          <button class="on" type="button" data-format="png">PNG</button>
          <button type="button" data-format="jpeg">JPG</button>
          <button type="button" data-format="webp">WebP</button>
        </div>
        <label class="inline-value"><span>质量</span><output id="image-quality-value">90%</output></label>
        <input id="image-quality" type="range" min="30" max="100" value="90">
        <button class="primary" id="export-image" type="button">导出 PNG</button>
      </div>
    `
    const qualityInput = imagePanelContent.querySelector('#image-quality')
    const exportButton = imagePanelContent.querySelector('#export-image')
    imagePanelContent.querySelector('#image-format-choice').addEventListener('click', (event) => {
      const button = event.target.closest('[data-format]')
      if (!button) return
      imageState.format = button.dataset.format
      imagePanelContent.querySelectorAll('[data-format]').forEach((option) => {
        option.classList.toggle('on', option === button)
      })
      exportButton.textContent = `导出 ${imageState.format === 'jpeg' ? 'JPG' : imageState.format.toUpperCase()}`
    })
    qualityInput.addEventListener('input', () => {
      imageState.quality = Number(qualityInput.value) / 100
      imagePanelContent.querySelector('#image-quality-value').textContent = `${qualityInput.value}%`
    })
    exportButton.addEventListener('click', () => exportEditedImage(imageState.format, exportButton))
  }
}

function setImageMode(mode) {
  imageState.mode = mode
  imageCanvas.isDrawingMode = false
  imageEditor.dataset.mode = mode
  document.querySelector('#image-crumb').textContent = {
    crop: '裁切',
    transform: '旋转与翻转',
    watermark: '文字水印',
    draw: '涂鸦',
    adjust: '调色与马赛克',
    export: '导出'
  }[mode] || '图片编辑'
  document.querySelectorAll('.image-tool').forEach((button) => {
    button.classList.toggle('on', button.dataset.imageMode === mode)
  })

  if (mode === 'crop') {
    if (imageState.sourceCanvas) createCropSelection()
  } else {
    removeCropSelection()
    imageCanvas.discardActiveObject()
    imageCanvas.requestRenderAll()
  }
  renderImagePanel()
  if (mode === 'draw') {
    configureImageBrush().catch(() => {
      setImageStatus('涂鸦组件载入失败', true)
    })
  }
}

async function loadImageFile(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    setImageStatus('仅支持 PNG、JPG 与 WebP 图片', true)
    showToast('图片格式不受支持')
    return
  }

  if (file.size > 50 * 1024 * 1024) {
    setImageStatus('图片超过 50 MB，已拒绝载入', true)
    return
  }

  setImageStatus('正在载入图片…')

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    if (bitmap.width * bitmap.height > 80_000_000) {
      bitmap.close()
      throw new Error('图片超过 8000 万像素')
    }

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = bitmap.width
    sourceCanvas.height = bitmap.height
    sourceCanvas.getContext('2d').drawImage(bitmap, 0, 0)
    bitmap.close()
    Object.assign(imageState.adjustments, {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      pixelate: 1
    })
    imageState.sourceCanvas = sourceCanvas
    imageState.sourceWidth = sourceCanvas.width
    imageState.sourceHeight = sourceCanvas.height
    imageState.fileName = file.name || 'pasted-image.png'
    imageFileName.textContent = imageState.fileName
    rebuildImageCanvas()
    setImageMode('crop')
    resetImageHistory()
    commitImageHistory()
    setImageStatus('图片已载入；支持拖拽、缩放选框')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setImageStatus(`图片载入失败：${reason}`, true)
    showToast('图片载入失败')
  }
}

function applyImageCrop() {
  if (!ensureImageLoaded() || !imageState.cropRect) return
  const canvasWidth = imageCanvas.getWidth()
  const canvasHeight = imageCanvas.getHeight()
  const left = Math.max(0, Math.min(canvasWidth - 1, imageState.cropRect.left))
  const top = Math.max(0, Math.min(canvasHeight - 1, imageState.cropRect.top))
  const selectionWidth = imageState.cropRect.width * Math.abs(imageState.cropRect.scaleX)
  const selectionHeight = imageState.cropRect.height * Math.abs(imageState.cropRect.scaleY)
  const width = Math.max(1, Math.min(canvasWidth - left, selectionWidth))
  const height = Math.max(1, Math.min(canvasHeight - top, selectionHeight))

  if (width < 12 || height < 12) {
    setImageStatus('裁切选区太小', true)
    return
  }

  const sourceX = Math.round(left / canvasWidth * imageState.sourceWidth)
  const sourceY = Math.round(top / canvasHeight * imageState.sourceHeight)
  const sourceWidth = Math.max(1, Math.round(width / canvasWidth * imageState.sourceWidth))
  const sourceHeight = Math.max(1, Math.round(height / canvasHeight * imageState.sourceHeight))
  const croppedCanvas = document.createElement('canvas')
  croppedCanvas.width = sourceWidth
  croppedCanvas.height = sourceHeight
  croppedCanvas.getContext('2d').drawImage(
    imageState.sourceCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  )

  const overlays = getOverlayObjects()
  imageCanvas.remove(imageState.cropRect)
  imageState.cropRect = null
  imageState.sourceCanvas = croppedCanvas
  imageState.sourceWidth = sourceWidth
  imageState.sourceHeight = sourceHeight
  const nextPreview = getImagePreviewSize()
  const scaleX = nextPreview.width / width
  const scaleY = nextPreview.height / height

  overlays.forEach((object) => {
    object.set({
      left: (object.left - left) * scaleX,
      top: (object.top - top) * scaleY,
      scaleX: object.scaleX * scaleX,
      scaleY: object.scaleY * scaleY
    })
    object.setCoords()
  })

  rebuildImageCanvas(overlays)
  createCropSelection()
  commitImageHistory()
  setImageStatus(`裁切完成：${sourceWidth} × ${sourceHeight} px`)
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片编码失败'))
    }, type, quality)
  })
}

async function exportEditedImage(format = 'png', triggerButton = null) {
  if (!ensureImageLoaded() || imageState.exporting) return
  imageState.exporting = true
  const cropVisible = imageState.cropRect?.visible
  if (imageState.cropRect) imageState.cropRect.visible = false
  imageCanvas.discardActiveObject()
  imageCanvas.requestRenderAll()
  quickSaveImageButton.disabled = true
  if (triggerButton) triggerButton.disabled = true
  setImageStatus('正在生成导出图片…')

  try {
    const multiplier = imageState.sourceWidth / imageCanvas.getWidth()
    const rendered = imageCanvas.toCanvasElement(multiplier)
    const output = document.createElement('canvas')
    output.width = imageState.sourceWidth
    output.height = imageState.sourceHeight
    const context = output.getContext('2d')

    if (format === 'jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, output.width, output.height)
    }
    context.drawImage(rendered, 0, 0, output.width, output.height)

    const mimeType = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp'
    }[format]
    const blob = await canvasToBlob(output, mimeType, imageState.quality)
    const data = new Uint8Array(await blob.arrayBuffer())
    const baseName = imageState.fileName.replace(/\.[^.]+$/, '') || 'edited-image'
    const result = await window.api.saveImageFile({
      type: format,
      name: `${baseName}-edited`,
      data
    })

    if (result.status === 'saved') {
      const label = format === 'jpeg' ? 'JPG' : format.toUpperCase()
      setImageStatus(`${label} 已保存 · ${(data.byteLength / 1024).toFixed(1)} KB`)
      showToast(`${label} 图片已保存`)
    } else {
      setImageStatus('已取消导出')
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setImageStatus(`导出失败：${reason}`, true)
    showToast('图片导出失败')
  } finally {
    if (imageState.cropRect) imageState.cropRect.visible = cropVisible
    imageCanvas.requestRenderAll()
    quickSaveImageButton.disabled = false
    if (triggerButton) triggerButton.disabled = false
    imageState.exporting = false
  }
}

function clearImageEditor() {
  imageCanvas.clear()
  imageCanvas.setDimensions({ width: 1, height: 1 })
  Object.assign(imageState, {
    sourceCanvas: null,
    sourceWidth: 0,
    sourceHeight: 0,
    baseImage: null,
    cropRect: null,
    exporting: false,
    fileName: 'edited-image.png'
  })
  imageCanvas.isDrawingMode = false
  Object.assign(imageState.adjustments, {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    pixelate: 1
  })
  resetImageHistory()
  imageStage.classList.remove('ready')
  imageEmpty.classList.remove('hidden')
  imageFileName.textContent = '尚未添加图片'
  imageDimensions.textContent = '尚未载入图片'
  setImageStatus('支持拖拽与剪贴板粘贴')
  quickSaveImageButton.disabled = true
}

function openImagePicker() {
  imageFileInput.value = ''
  imageFileInput.click()
}

document.querySelector('#open-image').addEventListener('click', openImagePicker)
document.querySelector('#open-image-empty').addEventListener('click', openImagePicker)
document.querySelector('#clear-image').addEventListener('click', clearImageEditor)
undoImageButton.addEventListener('click', () => {
  if (imageState.historyIndex > 0) restoreImageHistory(imageState.historyIndex - 1)
})
redoImageButton.addEventListener('click', () => {
  if (imageState.historyIndex < imageState.history.length - 1) {
    restoreImageHistory(imageState.historyIndex + 1)
  }
})
quickSaveImageButton.addEventListener('click', () => exportEditedImage('png', quickSaveImageButton))
imageFileInput.addEventListener('change', () => loadImageFile(imageFileInput.files[0]))
imageDropZone.addEventListener('dragover', (event) => {
  event.preventDefault()
  imageDropZone.classList.add('drag-over')
})
imageDropZone.addEventListener('dragleave', () => imageDropZone.classList.remove('drag-over'))
imageDropZone.addEventListener('drop', (event) => {
  event.preventDefault()
  imageDropZone.classList.remove('drag-over')
  const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'))
  loadImageFile(file)
})
window.addEventListener('paste', (event) => {
  if (state.module !== 'image') return
  const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith('image/'))
  if (file) loadImageFile(file)
})

imageCanvas.on('object:modified', (event) => {
  if (event.target?.dataRole === 'overlay') commitImageHistory()
})
imageCanvas.on('path:created', (event) => {
  if (!event.path || imageState.brushKind === 'eraser') return
  event.path.set({
    dataRole: 'overlay',
    overlayType: imageState.brushKind,
    erasable: true
  })
  event.path.setCoords()
  commitImageHistory()
})
imageCanvas.on('erasing:end', () => {
  window.setTimeout(commitImageHistory, 0)
})

let imageResizeTimer
window.addEventListener('resize', () => {
  window.clearTimeout(imageResizeTimer)
  imageResizeTimer = window.setTimeout(() => {
    if (!imageState.sourceCanvas) return
    const oldWidth = imageCanvas.getWidth()
    const oldHeight = imageCanvas.getHeight()
    const overlays = getOverlayObjects()
    const nextPreview = getImagePreviewSize()
    const scaleX = nextPreview.width / oldWidth
    const scaleY = nextPreview.height / oldHeight

    overlays.forEach((object) => {
      object.set({
        left: object.left * scaleX,
        top: object.top * scaleY,
        scaleX: object.scaleX * scaleX,
        scaleY: object.scaleY * scaleY
      })
      object.setCoords()
    })
    rebuildImageCanvas(overlays)
    if (imageState.mode === 'crop') createCropSelection()
  }, 160)
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
setImageMode('crop')
activateModule('pdf', defaultSelections.pdf)
verifyPreloadBridge()
