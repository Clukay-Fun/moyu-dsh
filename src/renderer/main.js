import JsBarcode from 'jsbarcode'
import { fabric } from 'fabric'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { getDocument, GlobalWorkerOptions, ImageKind, OPS } from 'pdfjs-dist'
import { createQpdfRunner } from 'qpdf-run'
import ocrbFontData from '../../assets/fonts/OCR-B.ttf?inline'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import qpdfWorkerUrl from 'qpdf-run/worker?url'
import qpdfJsUrl from 'qpdf-run/qpdf.js?url'
import qpdfWasmUrl from 'qpdf-run/qpdf.wasm?url'

globalThis.fabric = fabric
const eraserBrushReady = import('fabric/src/mixins/eraser_brush.mixin.js')
  .then(() => fabric.EraserBrush)
GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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
        ['转 DOCX', 'DOC', '#2b6cb0', 'M7x'],
        ['转 XLSX', 'XLS', '#217346', 'M7x'],
        ['转 PPTX', 'PPT', '#d24726', 'M7x']
      ]
    },
    {
      heading: '编辑',
      items: [
        ['合并 PDF', '合', '#e0554e'],
        ['逐页拆分', '拆', '#e0554e'],
        ['旋转 PDF', '旋', '#e0554e'],
        ['提取指定页', '页', '#e0554e'],
        ['文字水印', 'WM', '#6978e6'],
        ['图片水印', 'IMG', '#6978e6'],
        ['添加页码', '#', '#6978e6'],
        ['页重排', '⇅', '#6978e6'],
        ['提取图片', 'PIC', '#3c9a5e'],
        ['OCR 转 TXT', 'OCR', '#3c9a5e']
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
    },
    {
      heading: '安全',
      items: [
        ['加密 PDF', '锁', '#6978e6'],
        ['解密 PDF', '开', '#6978e6']
      ]
    }
  ],
  bc: [
    {
      heading: '条码类型',
      items: Object.entries(barcodeTypes).map(([name, type]) => [name, type.icon, type.color])
    }
  ],
  aimg: [
    {
      heading: 'AI 图像',
      items: [
        ['智能抠图', 'BG', '#6978e6'],
        ['批量抠图', 'ALL', '#59a6ae'],
        ['证件照', 'ID', '#e88c32'],
        ['图像修补', 'FIX', '#d35f79']
      ]
    }
  ],
  video: [
    {
      heading: '视频',
      items: [
        ['视频转换', 'VID', '#6978e6'],
        ['视频压缩', 'ZIP', '#e88c32'],
        ['抽取音频', 'MP3', '#59a6ae']
      ]
    },
    {
      heading: '音频',
      items: [
        ['音频转换', 'AUD', '#8678d9']
      ]
    },
    {
      heading: '图片',
      items: [
        ['图片转换', 'IMG', '#3c9a5e'],
        ['图片压缩', 'MIN', '#d35f79']
      ]
    }
  ]
}

const defaultSelections = {
  pdf: '转 PNG',
  bc: 'EAN-13',
  aimg: '智能抠图',
  video: '视频转换'
}

const deferredPdfActions = new Map([
  ['转 DOCX', 'M7x'],
  ['转 XLSX', 'M7x'],
  ['转 PPTX', 'M7x']
])

const moduleLabels = {
  pdf: 'PDF',
  ai: 'Illustrator',
  bc: '条码',
  image: '图片',
  aimg: 'AI 图像',
  screen: '截图',
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
  ['逐页拆分', 'PDF', 'pdf', '逐页拆分', '拆分 PDF 每页 独立文件'],
  ['旋转 PDF', 'PDF', 'pdf', '旋转 PDF', '旋转 页面'],
  ['提取指定页', 'PDF', 'pdf', '提取指定页', 'PDF 页面 提取 页码范围'],
  ['文字水印', 'PDF', 'pdf', '文字水印', 'PDF 水印 文字'],
  ['图片水印', 'PDF', 'pdf', '图片水印', 'PDF 水印 图片'],
  ['添加页码', 'PDF', 'pdf', '添加页码', 'PDF 页眉 页脚'],
  ['页重排', 'PDF', 'pdf', '页重排', 'PDF 拖拽 调序 删除 插入'],
  ['提取图片', 'PDF', 'pdf', '提取图片', 'PDF 内嵌 图片 导出'],
  ['OCR 转 TXT', 'PDF', 'pdf', 'OCR 转 TXT', 'PDF 扫描件 文字识别'],
  ['加密 PDF', 'PDF', 'pdf', '加密 PDF', 'PDF AES 口令 密码'],
  ['解密 PDF', 'PDF', 'pdf', '解密 PDF', 'PDF 移除 口令 密码'],
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
  ['智能抠图', 'AI 图像', 'aimg', '智能抠图', '去背景 透明 PNG RMBG'],
  ['批量抠图', 'AI 图像', 'aimg', '批量抠图', '批处理 去背景'],
  ['证件照', 'AI 图像', 'aimg', '证件照', '换底色 一寸 二寸'],
  ['图像修补', 'AI 图像', 'aimg', '图像修补', '擦除 物体 移除 MI-GAN'],
  ['区域截图', '截图', 'screen', '', '屏幕 截屏 标注'],
  ['截图复制', '截图', 'screen', '', '剪贴板 PNG'],
  ['视频转换', '格式工厂', 'video', '视频转换', 'FFmpeg MP4 MKV WebM'],
  ['视频压缩', '格式工厂', 'video', '视频压缩', 'FFmpeg CRF 体积'],
  ['抽取音频', '格式工厂', 'video', '抽取音频', '视频 MP3 WAV'],
  ['音频转换', '格式工厂', 'video', '音频转换', 'MP3 AAC WAV FLAC'],
  ['图片转换', '格式工厂', 'video', '图片转换', 'sharp JPG PNG WebP AVIF TIFF GIF'],
  ['图片压缩', '格式工厂', 'video', '图片压缩', 'sharp 批量 质量'],
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
  barcodeBatchItems: [],
  pdfFiles: [],
  pdfBusy: false,
  pdfLastOutput: null,
  pdfComResult: null,
  pdfDestination: null,
  pdfNativeInput: null,
  pdfWatermarkFiles: [],
  pdfWatermarkStatuses: [],
  pdfWatermarkImage: null,
  pdfWatermarkPreviewFileIndex: 0,
  pdfWatermarkPreviewPage: 1,
  pdfWatermarkPreviewPageCount: 0,
  pdfPageItems: [],
  pdfPageOrganizerSource: null,
  pdfPageOrganizerSnapshot: []
}

const submenu = document.querySelector('#submenu')
const searchInput = document.querySelector('#feature-search')
const searchResults = document.querySelector('#search-results')
const toast = document.querySelector('#toast')
let toastTimer
let barcodeRenderedValue = ''
let barcodeRenderedType = ''
let qpdfRunnerPromise = null
let pdfWatermarkPreviewToken = 0

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

    group.items.forEach(([name, icon, color, milestone]) => {
      const button = document.createElement('button')
      const iconNode = document.createElement('i')

      button.type = 'button'
      button.className = `submenu-item${state.selections[module] === name ? ' on' : ''}${milestone ? ' placeholder-action' : ''}`
      button.dataset.module = module
      button.dataset.action = name
      if (milestone) {
        button.dataset.milestone = milestone
        button.setAttribute('aria-disabled', 'true')
      }
      iconNode.textContent = icon
      iconNode.style.background = color
      button.append(iconNode, document.createTextNode(name))
      fragment.append(button)
    })
  })

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

  const deferredMilestone = module === 'pdf' ? deferredPdfActions.get(action) : null

  if (action && submenuData[module] && !deferredMilestone) {
    state.selections[module] = action
  }

  renderSubmenu(module)

  if (module === 'pdf') {
    updatePdfState(state.selections.pdf)
    if (deferredMilestone) showToast(`“${action}”将在 ${deferredMilestone} 接入`)
  } else if (module === 'bc') {
    document.querySelector('#bc-crumb').textContent = state.selections.bc
    if (action) selectBarcodeType(action, true)
  } else if (module === 'image' && action) {
    setImageMode(action)
  } else if (module === 'aimg') {
    setAiMode(state.selections.aimg)
  } else if (module === 'video') {
    setFormatAction(state.selections.video)
  }
}

const pdfActionConfig = {
  '转 PNG': { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  '转 JPEG': { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  '转 TXT': { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  '合并 PDF': { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: true, minFiles: 2 },
  逐页拆分: { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  '旋转 PDF': { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  提取指定页: { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  文字水印: { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: true, minFiles: 1 },
  图片水印: { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: true, minFiles: 1 },
  添加页码: { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  页重排: { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  提取图片: { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  'OCR 转 TXT': { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  '加密 PDF': { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  '解密 PDF': { inputLabel: 'PDF', kind: 'pdf', accept: 'application/pdf,.pdf', multiple: false, minFiles: 1 },
  '图片转 PDF': {
    inputLabel: '图片',
    kind: 'image',
    accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',
    multiple: true,
    minFiles: 1
  },
  'Word 转 PDF': {
    inputLabel: 'Word',
    kind: 'office',
    officeKind: 'word',
    accept: '',
    multiple: false,
    minFiles: 1
  },
  'Excel 转 PDF': {
    inputLabel: 'Excel',
    kind: 'office',
    officeKind: 'excel',
    accept: '',
    multiple: false,
    minFiles: 1
  },
  'PPT 转 PDF': {
    inputLabel: 'PowerPoint',
    kind: 'office',
    officeKind: 'powerpoint',
    accept: '',
    multiple: false,
    minFiles: 1
  }
}
const pdfFileInput = document.querySelector('#pdf-file-input')
const pdfAddFilesButton = document.querySelector('#pdf-add-files')
const pdfClearFilesButton = document.querySelector('#pdf-clear-files')
const pdfDropZone = document.querySelector('#pdf-drop-zone')
const pdfWatermarkWorkbench = document.querySelector('#pdf-watermark-workbench')
const pdfWatermarkFileList = document.querySelector('#pdf-watermark-file-list')
const pdfWatermarkPreview = document.querySelector('#pdf-watermark-preview')
const pdfWatermarkPreviewEmpty = document.querySelector('#pdf-watermark-preview-empty')
const pdfWatermarkPreviewLabel = document.querySelector('#pdf-watermark-preview-label')
const pdfFileBody = document.querySelector('#pdf-file-body')
const pdfEmpty = document.querySelector('#pdf-empty')
const pdfOptions = document.querySelector('#pdf-options')
const pdfRunButton = document.querySelector('#run-pdf-action')
const pdfChooseOutputButton = document.querySelector('#choose-pdf-output')
const pdfOutputPath = document.querySelector('#pdf-output-path')
const pdfResultText = document.querySelector('#pdf-result-text')
const pdfResultDot = document.querySelector('#pdf-result-dot')
const pdfOpenOutputButton = document.querySelector('#open-pdf-output')
const pdfPageOrganizer = document.querySelector('#pdf-page-organizer')
const pdfPageGrid = document.querySelector('#pdf-page-grid')
const pdfPageSummary = document.querySelector('#pdf-page-summary')
const pdfInsertPagesInput = document.querySelector('#pdf-insert-pages-input')
let draggedPdfPageId = ''

function currentPdfConfig() {
  return pdfActionConfig[state.selections.pdf]
}

const pdfDirectoryActions = new Set([
  '转 PNG',
  '转 JPEG',
  '逐页拆分',
  '文字水印',
  '图片水印',
  '提取图片'
])

function isPdfWatermarkAction(action = state.selections.pdf) {
  return action === '文字水印' || action === '图片水印'
}

function currentPdfFiles() {
  return isPdfWatermarkAction() ? state.pdfWatermarkFiles : state.pdfFiles
}

function currentPdfOutputSpec() {
  const action = state.selections.pdf
  const source = currentPdfConfig().kind === 'office'
    ? state.pdfNativeInput
    : currentPdfFiles()[0]
  const base = source ? pdfOutputBaseName(source) : 'pdf-output'
  const type = action === '转 PNG' || action === '提取图片'
    ? 'png'
    : action === '转 JPEG'
      ? 'jpeg'
      : ['转 TXT', 'OCR 转 TXT'].includes(action)
        ? 'txt'
        : 'pdf'
  const suffix = {
    '合并 PDF': 'merged',
    '旋转 PDF': `${base}-rotated`,
    提取指定页: `${base}-pages`,
    文字水印: `${base}-watermarked`,
    图片水印: `${base}-watermarked`,
    添加页码: `${base}-numbered`,
    页重排: `${base}-reordered`,
    '图片转 PDF': 'images',
    '加密 PDF': `${base}-encrypted`,
    '解密 PDF': `${base}-decrypted`,
    'Word 转 PDF': base,
    'Excel 转 PDF': base,
    'PPT 转 PDF': base,
    '转 TXT': `${base}-text`,
    'OCR 转 TXT': `${base}-ocr`
  }[action] || base
  return {
    mode: pdfDirectoryActions.has(action) ? 'directory' : 'file',
    type,
    name: suffix
  }
}

function resetPdfDestination() {
  state.pdfDestination = null
  pdfOutputPath.textContent = '尚未选择'
  pdfOutputPath.title = ''
}

function isAcceptedPdfToolFile(file, config = currentPdfConfig()) {
  if (config.kind === 'office') return false
  const name = file.name.toLowerCase()
  if (config.kind === 'pdf') {
    return file.type === 'application/pdf' || name.endsWith('.pdf')
  }
  return (
    ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    /\.(png|jpe?g|webp)$/i.test(name)
  )
}

function renderPdfOptions() {
  const action = state.selections.pdf
  pdfOptions.replaceChildren()

  if (action === '旋转 PDF') {
    pdfOptions.innerHTML = `
      <label>旋转
        <select id="pdf-rotation">
          <option value="90">90°</option>
          <option value="180">180°</option>
          <option value="270">270°</option>
        </select>
      </label>
    `
  } else if (action === '逐页拆分') {
    pdfOptions.innerHTML = '<span class="pdf-option-status" id="pdf-split-estimate">每一页将生成一个独立 PDF 文件</span>'
  } else if (action === '提取指定页') {
    pdfOptions.innerHTML = `
      <label>页码
        <input id="pdf-page-range" type="text" value="1" placeholder="如 1-3,5">
      </label>
      <span class="pdf-option-status">示例 1-3,5：合并导出为一个 4 页 PDF</span>
    `
  } else if (action === '转 JPEG') {
    pdfOptions.innerHTML = `
      <label>质量
        <select id="pdf-jpeg-quality">
          <option value="0.85">85%</option>
          <option value="0.7">70%</option>
          <option value="0.95">95%</option>
        </select>
      </label>
    `
  } else if (action === '添加页码') {
    pdfOptions.innerHTML = `
      <label>位置
        <select id="pdf-page-number-position">
          <option value="footer">页脚</option>
          <option value="header">页眉</option>
        </select>
      </label>
      <label>起始
        <input id="pdf-page-number-start" type="number" min="0" max="99999" value="1">
      </label>
    `
  } else if (action === '页重排') {
    pdfOptions.innerHTML = `
      <button class="gbtn compact" id="pdf-open-page-organizer" type="button">编辑页面顺序</button>
      <span class="pdf-option-status" id="pdf-page-option-status">上传 PDF 后载入页面</span>
    `
    pdfOptions.querySelector('#pdf-open-page-organizer').addEventListener('click', openPdfPageOrganizer)
  } else if (action === '加密 PDF') {
    pdfOptions.innerHTML = `
      <label>打开口令
        <input id="pdf-encrypt-password" type="password" maxlength="127" autocomplete="new-password">
      </label>
      <label>确认口令
        <input id="pdf-encrypt-password-confirm" type="password" maxlength="127" autocomplete="new-password">
      </label>
      <span class="pdf-option-status">AES-256 · R6</span>
    `
  } else if (action === '解密 PDF') {
    pdfOptions.innerHTML = `
      <label>PDF 口令
        <input id="pdf-decrypt-password" type="password" maxlength="127" autocomplete="current-password">
      </label>
      <span class="pdf-option-status">支持 user / owner password</span>
    `
  }
}

function renderPdfFiles() {
  pdfFileBody.replaceChildren()
  const config = currentPdfConfig()
  const displayedFiles = config.kind === 'office'
    ? (state.pdfNativeInput ? [state.pdfNativeInput] : [])
    : currentPdfFiles()
  pdfEmpty.classList.toggle('hidden', displayedFiles.length > 0)

  displayedFiles.forEach((file, index) => {
    const row = document.createElement('div')
    const order = document.createElement('span')
    const name = document.createElement('span')
    const type = document.createElement('span')
    const size = document.createElement('span')
    const remove = document.createElement('button')

    row.className = 'pdf-file-row'
    order.className = 'cell-index'
    name.className = 'cell-name'
    type.className = 'cell-meta'
    size.className = 'cell-status'
    order.textContent = String(index + 1)
    name.textContent = file.name
    name.title = file.name
    type.textContent = config.kind === 'pdf'
      ? 'PDF'
      : config.kind === 'office'
        ? config.inputLabel
        : (file.type.split('/')[1] || '图片').toUpperCase()
    size.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`
    remove.type = 'button'
    remove.className = 'pdf-remove-file'
    remove.dataset.index = String(index)
    remove.setAttribute('aria-label', `移除 ${file.name}`)
    remove.textContent = '×'
    row.append(order, name, type, size, remove)
    pdfFileBody.append(row)
  })

  updatePdfRunState()
  void updatePdfSplitEstimate()
}

async function updatePdfSplitEstimate() {
  const status = document.querySelector('#pdf-split-estimate')
  const file = state.selections.pdf === '逐页拆分' ? state.pdfFiles[0] : null
  if (!status || !file) return
  status.textContent = '正在计算预计文件数…'
  try {
    const source = await readPdfDocument(file)
    if (state.selections.pdf !== '逐页拆分' || state.pdfFiles[0] !== file) return
    status.textContent = `预计生成 ${source.getPageCount()} 个独立 PDF 文件`
  } catch {
    status.textContent = '无法读取页数，请检查 PDF 文件'
  }
}

function renderPdfWatermarkFileList() {
  pdfWatermarkFileList.replaceChildren()
  if (!state.pdfWatermarkFiles.length) {
    const empty = document.createElement('span')
    empty.className = 'pdf-option-status'
    empty.textContent = '尚未添加 PDF'
    pdfWatermarkFileList.append(empty)
    return
  }

  state.pdfWatermarkFiles.forEach((file, index) => {
    const row = document.createElement('div')
    const name = document.createElement('span')
    const status = document.createElement('small')
    const remove = document.createElement('button')
    row.className = 'pdf-watermark-file'
    row.classList.toggle('active', index === state.pdfWatermarkPreviewFileIndex)
    row.dataset.previewIndex = String(index)
    name.textContent = file.name
    name.title = file.name
    const fileStatus = state.pdfWatermarkStatuses[index]
    status.className = fileStatus?.error ? 'error' : ''
    status.textContent = fileStatus?.error || fileStatus?.status || '待处理'
    remove.type = 'button'
    remove.className = 'pdf-remove-file'
    remove.dataset.watermarkIndex = String(index)
    remove.setAttribute('aria-label', `移除 ${file.name}`)
    remove.textContent = '×'
    row.append(name, status, remove)
    pdfWatermarkFileList.append(row)
  })
}

async function loadPdfWatermarkPreviewSource() {
  const file = state.pdfWatermarkFiles[state.pdfWatermarkPreviewFileIndex]
  if (!file) return null
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdfDocument = await loadingTask.promise
  try {
    const pageNumber = Math.max(1, Math.min(pdfDocument.numPages, state.pdfWatermarkPreviewPage))
    const page = await pdfDocument.getPage(pageNumber)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(1.5, 720 / baseViewport.width, 880 / baseViewport.height)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({
      canvas,
      canvasContext: canvas.getContext('2d'),
      viewport
    }).promise
    page.cleanup()
    return {
      canvas,
      pageWidth: baseViewport.width,
      pageHeight: baseViewport.height,
      scale,
      pageNumber,
      pageCount: pdfDocument.numPages
    }
  } finally {
    await pdfDocument.destroy()
  }
}

async function drawPdfWatermarkPreview() {
  const token = ++pdfWatermarkPreviewToken
  const file = state.pdfWatermarkFiles[state.pdfWatermarkPreviewFileIndex]
  const pageStatus = document.querySelector('#pdf-watermark-page-status')
  const previousPage = document.querySelector('#pdf-watermark-previous-page')
  const nextPage = document.querySelector('#pdf-watermark-next-page')
  if (!file || !isPdfWatermarkAction()) {
    pdfWatermarkPreview.width = 0
    pdfWatermarkPreview.height = 0
    pdfWatermarkPreviewEmpty.hidden = false
    pdfWatermarkPreviewLabel.textContent = '添加 PDF 后显示第一页'
    pageStatus.textContent = '第 0 / 0 页'
    previousPage.disabled = true
    nextPage.disabled = true
    return
  }

  pdfWatermarkPreviewEmpty.hidden = false
  pdfWatermarkPreviewEmpty.textContent = '正在生成第一页预览…'
  try {
    const source = await loadPdfWatermarkPreviewSource()
    if (token !== pdfWatermarkPreviewToken || !source) return
    state.pdfWatermarkPreviewPage = source.pageNumber
    state.pdfWatermarkPreviewPageCount = source.pageCount
    pageStatus.textContent = `第 ${source.pageNumber} / ${source.pageCount} 页`
    previousPage.disabled = source.pageNumber <= 1
    nextPage.disabled = source.pageNumber >= source.pageCount
    const settings = getPdfWatermarkSettings()
    const kind = state.selections.pdf === '文字水印' ? 'text' : 'image'
    let converted
    if (kind === 'text') {
      if (!settings.text) throw new Error('请输入水印文字')
      converted = await textWatermarkToPng(settings.text, settings)
    } else {
      if (!state.pdfWatermarkImage) {
        pdfWatermarkPreview.width = source.canvas.width
        pdfWatermarkPreview.height = source.canvas.height
        pdfWatermarkPreview.getContext('2d').drawImage(source.canvas, 0, 0)
        pdfWatermarkPreviewEmpty.hidden = true
        pdfWatermarkPreviewLabel.textContent = `${file.name} · 第 ${source.pageNumber} 页 · 请选择水印图片`
        return
      }
      converted = await imageFileToPng(state.pdfWatermarkImage)
    }
    if (token !== pdfWatermarkPreviewToken) return

    const maxWidth = source.pageWidth * (kind === 'text' ? 0.28 : 0.22)
    const maxHeight = source.pageHeight * 0.11
    const markScale = Math.min(maxWidth / converted.width, maxHeight / converted.height, 1)
    const markWidth = converted.width * markScale
    const markHeight = converted.height * markScale
    const placements = pdfWatermarkPlacements(
      source.pageWidth,
      source.pageHeight,
      markWidth,
      markHeight,
      settings
    )
    const watermarkBlob = new Blob([converted.data], { type: 'image/png' })
    const watermarkBitmap = await createImageBitmap(watermarkBlob)
    if (token !== pdfWatermarkPreviewToken) {
      watermarkBitmap.close()
      return
    }
    pdfWatermarkPreview.width = source.canvas.width
    pdfWatermarkPreview.height = source.canvas.height
    const context = pdfWatermarkPreview.getContext('2d')
    context.drawImage(source.canvas, 0, 0)
    context.globalAlpha = settings.opacity
    placements.forEach((center) => {
      context.save()
      context.translate(center.x * source.scale, (source.pageHeight - center.y) * source.scale)
      context.rotate(-settings.rotation * Math.PI / 180)
      context.drawImage(
        watermarkBitmap,
        -markWidth * source.scale / 2,
        -markHeight * source.scale / 2,
        markWidth * source.scale,
        markHeight * source.scale
      )
      context.restore()
    })
    context.globalAlpha = 1
    watermarkBitmap.close()
    pdfWatermarkPreviewEmpty.hidden = true
    pdfWatermarkPreviewLabel.textContent = `${file.name} · 第 ${source.pageNumber} 页`
  } catch (error) {
    if (token !== pdfWatermarkPreviewToken) return
    pdfWatermarkPreviewEmpty.hidden = false
    pdfWatermarkPreviewEmpty.textContent =
      error instanceof Error ? error.message : '无法生成预览'
    pdfWatermarkPreviewLabel.textContent = file.name
  }
}

function renderPdfWatermarkState() {
  state.pdfWatermarkPreviewFileIndex = Math.max(
    0,
    Math.min(state.pdfWatermarkPreviewFileIndex, state.pdfWatermarkFiles.length - 1)
  )
  const imageMode = state.selections.pdf === '图片水印'
  document.querySelector('#pdf-watermark-text').closest('label').hidden = imageMode
  document.querySelector('#pdf-watermark-font').closest('label').hidden = imageMode
  document.querySelector('#pdf-watermark-font-size').closest('label').hidden = imageMode
  document.querySelector('#pdf-watermark-image-button').hidden = !imageMode
  document.querySelector('#pdf-watermark-image-name').hidden = !imageMode
  document.querySelector('#pdf-watermark-image-name').textContent =
    state.pdfWatermarkImage?.name || '尚未选择图片'
  const customRotation = document.querySelector('#pdf-watermark-rotation').value === 'custom'
  document.querySelector('#pdf-watermark-custom-rotation-wrap').hidden = !customRotation
  renderPdfWatermarkFileList()
  void drawPdfWatermarkPreview()
}

function updatePdfRunState() {
  const config = currentPdfConfig()
  const fileCount = config.kind === 'office'
    ? Number(Boolean(state.pdfNativeInput))
    : currentPdfFiles().length
  const enoughFiles = fileCount >= config.minFiles
  const hasWatermarkImage = state.selections.pdf !== '图片水印' || Boolean(state.pdfWatermarkImage)
  const hasDestination = Boolean(state.pdfDestination)
  pdfRunButton.disabled = state.pdfBusy || !enoughFiles || !hasWatermarkImage || !hasDestination
  pdfRunButton.textContent = state.pdfBusy ? '处理中…' : `开始${state.selections.pdf}`
  pdfClearFilesButton.disabled = state.pdfBusy || fileCount === 0
  pdfAddFilesButton.disabled = state.pdfBusy
  pdfChooseOutputButton.disabled = state.pdfBusy || !enoughFiles
  const organizerButton = document.querySelector('#pdf-open-page-organizer')
  if (organizerButton) organizerButton.disabled = state.pdfBusy || !enoughFiles
  const organizerStatus = document.querySelector('#pdf-page-option-status')
  if (organizerStatus) {
    organizerStatus.textContent = state.pdfPageItems.length
      ? `当前 ${state.pdfPageItems.length} 页`
      : '上传 PDF 后载入页面'
  }
}

function updatePdfState(action) {
  const config = pdfActionConfig[action]
  if (!config) return

  if (config.kind === 'office') {
    state.pdfFiles = []
    if (state.pdfNativeInput?.kind !== config.officeKind) {
      state.pdfNativeInput = null
    }
  } else {
    state.pdfNativeInput = null
    if (!isPdfWatermarkAction(action)) {
      state.pdfFiles = state.pdfFiles.filter((file) => isAcceptedPdfToolFile(file, config))
      if (!config.multiple && state.pdfFiles.length > 1) {
        state.pdfFiles = state.pdfFiles.slice(0, 1)
      }
    }
  }

  pdfFileInput.accept = config.accept
  pdfFileInput.multiple = config.multiple
  pdfDropZone.classList.toggle('native-picker', config.kind === 'office')
  pdfDropZone.hidden = isPdfWatermarkAction(action)
  pdfWatermarkWorkbench.hidden = !isPdfWatermarkAction(action)
  document.querySelector('#pdf-crumb').textContent = action
  document.querySelector('#pdf-hint').textContent =
    config.minFiles > 1
      ? `至少上传 ${config.minFiles} 个 ${config.inputLabel} 文件`
      : `上传 ${config.inputLabel} 文件后执行“${action}”`
  document.querySelector('#pdf-empty-text').textContent = `上传 ${config.inputLabel} 文件`
  pdfAddFilesButton.textContent = `＋ 上传 ${config.inputLabel}`
  state.pdfLastOutput = null
  state.pdfComResult = null
  state.pdfWatermarkImage = null
  state.pdfWatermarkPreviewFileIndex = 0
  state.pdfWatermarkPreviewPage = 1
  state.pdfWatermarkPreviewPageCount = 0
  resetPdfDestination()
  resetPdfPageOrganizer()
  pdfOpenOutputButton.disabled = true
  pdfResultText.textContent = '添加文件后即可处理'
  pdfResultDot.classList.remove('success', 'error', 'busy')
  renderPdfOptions()
  renderPdfFiles()
  renderPdfWatermarkState()
}

function chooseSubmenu(module, action) {
  if (module === 'video') {
    setFormatAction(action)
    return
  }
  state.selections[module] = action
  renderSubmenu(module)

  if (module === 'pdf') {
    updatePdfState(action)
  } else if (module === 'bc') {
    selectBarcodeType(action, true)
  } else if (module === 'aimg') {
    setAiMode(action)
  }
}

document.querySelector('.rail').addEventListener('click', (event) => {
  const button = event.target.closest('.nav-ic')
  if (button) activateModule(button.dataset.module)
})

submenu.addEventListener('click', (event) => {
  const button = event.target.closest('.submenu-item')
  if (button && !button.dataset.milestone) {
    chooseSubmenu(button.dataset.module, button.dataset.action)
  }
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

function setPdfResult(message, status = '') {
  pdfResultText.textContent = message
  pdfResultDot.classList.remove('success', 'error', 'busy')
  if (status) pdfResultDot.classList.add(status)
}

function pdfOutputBaseName(file) {
  return file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_.-]+/gu, '-') || 'pdf-output'
}

function addPdfToolFiles(fileList) {
  const config = currentPdfConfig()
  const accepted = Array.from(fileList || []).filter((file) => isAcceptedPdfToolFile(file, config))

  if (!accepted.length) {
    setPdfResult(`请选择有效的 ${config.inputLabel} 文件`, 'error')
    return
  }

  const oversized = accepted.find((file) => file.size > 150 * 1024 * 1024)
  if (oversized) {
    setPdfResult(`${oversized.name} 超过 150 MB 单文件上限`, 'error')
    return
  }

  const existingFiles = currentPdfFiles()
  const nextFiles = config.multiple
    ? [...existingFiles, ...accepted].slice(0, 100)
    : [accepted[0]]
  const totalBytes = nextFiles.reduce((total, file) => total + file.size, 0)

  if (totalBytes > 300 * 1024 * 1024) {
    setPdfResult('所选文件总大小超过 300 MB', 'error')
    return
  }

  if (isPdfWatermarkAction()) {
    state.pdfWatermarkFiles = nextFiles
    state.pdfWatermarkStatuses = nextFiles.map((_, index) =>
      state.pdfWatermarkStatuses[index] || { status: '待处理', error: '' }
    )
  } else {
    state.pdfFiles = nextFiles
  }
  state.pdfLastOutput = null
  resetPdfDestination()
  resetPdfPageOrganizer()
  pdfOpenOutputButton.disabled = true
  renderPdfFiles()
  renderPdfWatermarkState()
  setPdfResult(`已添加 ${nextFiles.length} 个文件`)
}

async function readPdfDocument(file) {
  try {
    return await PDFDocument.load(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error(`${file.name} 无法读取；加密或损坏的 PDF 暂不支持`)
  }
}

async function getQpdfRunner() {
  if (!qpdfRunnerPromise) {
    qpdfRunnerPromise = createQpdfRunner({
      workerUrl: qpdfWorkerUrl,
      qpdfJsUrl,
      wasmUrl: qpdfWasmUrl,
      timeoutMs: 90000
    }).catch((error) => {
      qpdfRunnerPromise = null
      throw error
    })
  }
  return qpdfRunnerPromise
}

function qpdfErrorMessage(error, operation) {
  const code = error?.code || 'QPDF_UNKNOWN'
  if (code === 'QPDF_INIT_FAILED') {
    return `${operation}失败：QPDF 加密组件未能载入（${code}）`
  }
  if (code === 'QPDF_TIMEOUT') {
    return `${operation}失败：QPDF 处理超时（${code}）`
  }
  if (code === 'QPDF_OUTPUT_MISSING') {
    return `${operation}失败：QPDF 未生成输出文件（${code}）`
  }
  if (code === 'QPDF_EXEC_FAILED') {
    const detail = Array.isArray(error?.stderr) ? error.stderr.at(-1) : ''
    return `${operation}失败：${detail || 'PDF 不受支持或口令不正确'}（${code}）`
  }
  return `${operation}失败：${error instanceof Error ? error.message : String(error)}（${code}）`
}

function validatePdfPassword(password, label) {
  const byteLength = new TextEncoder().encode(password).byteLength
  if (byteLength < 4) throw new Error(`${label}至少需要 4 个 UTF-8 字节`)
  if (byteLength > 127) throw new Error(`${label}不能超过 127 个 UTF-8 字节`)
}

async function encryptPdfFile() {
  const password = document.querySelector('#pdf-encrypt-password')?.value || ''
  const confirmation = document.querySelector('#pdf-encrypt-password-confirm')?.value || ''
  validatePdfPassword(password, '打开口令')
  if (password !== confirmation) throw new Error('两次输入的打开口令不一致')

  let data
  try {
    const runner = await getQpdfRunner()
    const ownerPassword = `${crypto.randomUUID()}-${crypto.randomUUID()}`
    data = await runner.runOne({
      input: new Uint8Array(await state.pdfFiles[0].arrayBuffer()),
      inputName: 'input.pdf',
      outputName: 'encrypted.pdf',
      args: [
        '--encrypt',
        password,
        ownerPassword,
        '256',
        '--',
        'input.pdf',
        'encrypted.pdf'
      ]
    })
  } catch (error) {
    throw new Error(qpdfErrorMessage(error, '加密'))
  }
  const result = await saveSinglePdfToolOutput(
    'pdf',
    `${pdfOutputBaseName(state.pdfFiles[0])}-encrypted`,
    data
  )
  return result.status === 'saved' ? '已使用 AES-256 加密 PDF' : '已取消保存'
}

async function decryptPdfFile() {
  const password = document.querySelector('#pdf-decrypt-password')?.value || ''
  if (!password) throw new Error('请输入 PDF 口令')
  if (new TextEncoder().encode(password).byteLength > 127) {
    throw new Error('PDF 口令不能超过 127 个 UTF-8 字节')
  }

  let data
  try {
    const runner = await getQpdfRunner()
    data = await runner.runOne({
      input: new Uint8Array(await state.pdfFiles[0].arrayBuffer()),
      inputName: 'input.pdf',
      outputName: 'decrypted.pdf',
      args: [
        `--password=${password}`,
        '--decrypt',
        'input.pdf',
        'decrypted.pdf'
      ]
    })
  } catch (error) {
    throw new Error(qpdfErrorMessage(error, '解密'))
  }
  const result = await saveSinglePdfToolOutput(
    'pdf',
    `${pdfOutputBaseName(state.pdfFiles[0])}-decrypted`,
    data
  )
  return result.status === 'saved' ? 'PDF 口令已移除' : '已取消保存'
}

async function saveSinglePdfToolOutput(type, name, data) {
  const result = await window.api.savePdfFile({
    type,
    name,
    data,
    destinationId: state.pdfDestination?.id
  })
  if (result.status === 'saved') {
    state.pdfLastOutput = { path: result.path, directory: false }
    pdfOpenOutputButton.disabled = false
    resetPdfDestination()
  }
  return result
}

async function saveBatchPdfToolOutput(type, files) {
  const result = await window.api.savePdfFiles({
    type,
    files,
    destinationId: state.pdfDestination?.id
  })
  if (result.status === 'saved') {
    state.pdfLastOutput = { path: result.directory, directory: true }
    pdfOpenOutputButton.disabled = false
  }
  return result
}

async function mergePdfFiles() {
  const output = await PDFDocument.create()

  for (const [index, file] of state.pdfFiles.entries()) {
    setPdfResult(`正在合并 ${index + 1} / ${state.pdfFiles.length}`, 'busy')
    const source = await readPdfDocument(file)
    const pages = await output.copyPages(source, source.getPageIndices())
    pages.forEach((page) => output.addPage(page))
  }

  const data = await output.save()
  const result = await saveSinglePdfToolOutput('pdf', 'merged', data)
  return result.status === 'saved' ? `已合并 ${output.getPageCount()} 页 PDF` : '已取消保存'
}

async function splitPdfFile() {
  const source = await readPdfDocument(state.pdfFiles[0])
  const baseName = pdfOutputBaseName(state.pdfFiles[0])
  const files = []

  if (source.getPageCount() > 500) {
    throw new Error('拆分页数超过 500 页上限')
  }

  for (let index = 0; index < source.getPageCount(); index += 1) {
    setPdfResult(`正在拆分 ${index + 1} / ${source.getPageCount()}`, 'busy')
    const output = await PDFDocument.create()
    const [page] = await output.copyPages(source, [index])
    output.addPage(page)
    files.push({
      name: `${baseName}-page-${String(index + 1).padStart(3, '0')}`,
      data: await output.save()
    })
  }

  const result = await saveBatchPdfToolOutput('pdf', files)
  return result.status === 'saved' ? `已拆分并保存 ${files.length} 个 PDF` : '已取消保存'
}

async function rotatePdfFile() {
  const source = await readPdfDocument(state.pdfFiles[0])
  const rotation = Number(document.querySelector('#pdf-rotation')?.value || 90)
  source.getPages().forEach((page) => {
    page.setRotation(degrees((page.getRotation().angle + rotation) % 360))
  })
  const result = await saveSinglePdfToolOutput(
    'pdf',
    `${pdfOutputBaseName(state.pdfFiles[0])}-rotated`,
    await source.save()
  )
  return result.status === 'saved'
    ? `已将 ${source.getPageCount()} 页旋转 ${rotation}°`
    : '已取消保存'
}

function parsePdfPageRange(value, pageCount) {
  const pages = []

  value.split(',').map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/)

    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      const step = start <= end ? 1 : -1
      for (let page = start; page !== end + step; page += step) pages.push(page)
    } else if (/^\d+$/.test(part)) {
      pages.push(Number(part))
    } else {
      throw new Error('页码格式无效，请使用如 1-3,5')
    }
  })

  const unique = [...new Set(pages)]
  if (!unique.length || unique.some((page) => page < 1 || page > pageCount)) {
    throw new Error(`页码必须在 1–${pageCount} 之间`)
  }
  return unique.map((page) => page - 1)
}

async function extractPdfPages() {
  const source = await readPdfDocument(state.pdfFiles[0])
  const pageIndices = parsePdfPageRange(
    document.querySelector('#pdf-page-range')?.value || '',
    source.getPageCount()
  )
  const output = await PDFDocument.create()
  const pages = await output.copyPages(source, pageIndices)
  pages.forEach((page) => output.addPage(page))
  const result = await saveSinglePdfToolOutput(
    'pdf',
    `${pdfOutputBaseName(state.pdfFiles[0])}-pages`,
    await output.save()
  )
  return result.status === 'saved' ? `已提取 ${pages.length} 页` : '已取消保存'
}

async function imageFileToPng(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

  if (bitmap.width * bitmap.height > 80_000_000) {
    bitmap.close()
    throw new Error(`${file.name} 超过 8000 万像素`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await canvasToBlob(canvas, 'image/png')
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(await blob.arrayBuffer())
  }
}

function getPdfWatermarkSettings() {
  const rotationSelect = document.querySelector('#pdf-watermark-rotation')
  const rotation = rotationSelect?.value === 'custom'
    ? Number(document.querySelector('#pdf-watermark-custom-rotation')?.value || 0)
    : Number(rotationSelect?.value || 0)
  return {
    text: document.querySelector('#pdf-watermark-text')?.value.trim() || '',
    font: document.querySelector('#pdf-watermark-font')?.value || 'Microsoft YaHei UI',
    fontSize: Number(document.querySelector('#pdf-watermark-font-size')?.value || 42),
    rotation: Math.max(-180, Math.min(180, rotation)),
    opacity: Math.max(0.05, Math.min(1, Number(document.querySelector('#pdf-watermark-opacity')?.value || 28) / 100)),
    density: Number(document.querySelector('#pdf-watermark-density')?.value || 6),
    vertical: document.querySelector('#pdf-watermark-vertical')?.value || 'center',
    horizontal: document.querySelector('#pdf-watermark-horizontal')?.value || 'center',
    offsetX: Number(document.querySelector('#pdf-watermark-offset-x')?.value || 0),
    offsetY: Number(document.querySelector('#pdf-watermark-offset-y')?.value || 0),
    pages: document.querySelector('#pdf-watermark-pages')?.value || 'all'
  }
}

function pdfWatermarkAppliesToPage(pageIndex, scope) {
  const pageNumber = pageIndex + 1
  return scope === 'all' || (scope === 'odd' && pageNumber % 2 === 1) ||
    (scope === 'even' && pageNumber % 2 === 0)
}

function pdfWatermarkPlacements(pageWidth, pageHeight, markWidth, markHeight, settings) {
  const count = Math.max(1, settings.density)
  const columns = count >= 8 ? 3 : count >= 3 ? 2 : 1
  const rows = Math.ceil(count / columns)
  const marginX = Math.max(markWidth / 2 + 12, pageWidth * 0.08)
  const marginY = Math.max(markHeight / 2 + 12, pageHeight * 0.08)
  const usableWidth = Math.max(0, pageWidth - marginX * 2)
  const usableHeight = Math.max(0, pageHeight - marginY * 2)
  const anchorX = settings.horizontal === 'left'
    ? marginX
    : settings.horizontal === 'right'
      ? pageWidth - marginX
      : pageWidth / 2
  const anchorY = settings.vertical === 'top'
    ? pageHeight - marginY
    : settings.vertical === 'bottom'
      ? marginY
      : pageHeight / 2
  const groupWidth = columns > 1 ? usableWidth : 0
  const groupHeight = rows > 1 ? usableHeight : 0
  const startX = columns > 1 ? pageWidth / 2 - groupWidth / 2 : anchorX
  const startY = rows > 1 ? pageHeight / 2 - groupHeight / 2 : anchorY
  const placements = []

  for (let index = 0; index < count; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const centerX = columns > 1
      ? startX + (groupWidth * column) / (columns - 1)
      : anchorX
    const centerY = rows > 1
      ? startY + (groupHeight * row) / (rows - 1)
      : anchorY
    placements.push({
      x: centerX + settings.offsetX,
      y: centerY + settings.offsetY
    })
  }
  return placements
}

async function textWatermarkToPng(text, settings = getPdfWatermarkSettings()) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const fontSize = settings.fontSize
  context.font = `700 ${fontSize}px "${settings.font}", "PingFang SC", sans-serif`
  const metrics = context.measureText(text)
  canvas.width = Math.ceil(metrics.width + 40)
  canvas.height = Math.ceil(fontSize * 1.5)
  context.font = `700 ${fontSize}px "${settings.font}", "PingFang SC", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#5266d7'
  context.fillText(text, canvas.width / 2, canvas.height / 2)
  const blob = await canvasToBlob(canvas, 'image/png')
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(await blob.arrayBuffer())
  }
}

function pdfWatermarkDrawBox(center, width, height, rotation) {
  const radians = rotation * Math.PI / 180
  return {
    x: center.x - (width * Math.cos(radians) - height * Math.sin(radians)) / 2,
    y: center.y - (width * Math.sin(radians) + height * Math.cos(radians)) / 2
  }
}

async function addPdfWatermarks(kind) {
  const settings = getPdfWatermarkSettings()
  let converted

  if (kind === 'text') {
    if (!settings.text) throw new Error('请输入水印文字')
    converted = await textWatermarkToPng(settings.text, settings)
  } else {
    if (!state.pdfWatermarkImage) throw new Error('请先选择水印图片')
    converted = await imageFileToPng(state.pdfWatermarkImage)
  }

  const files = []
  let watermarkedPages = 0

  for (const [fileIndex, file] of state.pdfWatermarkFiles.entries()) {
    setPdfResult(`正在添加水印 ${fileIndex + 1} / ${state.pdfWatermarkFiles.length}`, 'busy')
    state.pdfWatermarkStatuses[fileIndex] = { status: '处理中', error: '' }
    renderPdfWatermarkFileList()
    try {
      const source = await readPdfDocument(file)
      const watermark = await source.embedPng(converted.data)
      source.getPages().forEach((page, pageIndex) => {
        if (!pdfWatermarkAppliesToPage(pageIndex, settings.pages)) return
        const { width: pageWidth, height: pageHeight } = page.getSize()
        const maxWidth = pageWidth * (kind === 'text' ? 0.28 : 0.22)
        const maxHeight = pageHeight * 0.11
        const scale = Math.min(maxWidth / converted.width, maxHeight / converted.height, 1)
        const width = converted.width * scale
        const height = converted.height * scale
        const placements = pdfWatermarkPlacements(
          pageWidth,
          pageHeight,
          width,
          height,
          settings
        )
        placements.forEach((center) => {
          const box = pdfWatermarkDrawBox(center, width, height, settings.rotation)
          page.drawImage(watermark, {
            x: box.x,
            y: box.y,
            width,
            height,
            opacity: settings.opacity,
            rotate: degrees(settings.rotation)
          })
        })
        watermarkedPages += 1
      })
      files.push({
        name: `${pdfOutputBaseName(file)}-watermarked`,
        data: await source.save(),
        sourceIndex: fileIndex
      })
      state.pdfWatermarkStatuses[fileIndex] = { status: '等待保存', error: '' }
    } catch (error) {
      state.pdfWatermarkStatuses[fileIndex] = {
        status: '失败',
        error: error instanceof Error ? error.message : String(error)
      }
    }
    renderPdfWatermarkFileList()
  }

  if (!files.length) throw new Error('没有可保存的水印结果，请检查文件错误')
  const result = await saveBatchPdfToolOutput(
    'pdf',
    files.map(({ name, data }) => ({ name, data }))
  )
  if (result.status === 'saved') {
    files.forEach(({ sourceIndex }) => {
      state.pdfWatermarkStatuses[sourceIndex] = { status: '完成', error: '' }
    })
    renderPdfWatermarkFileList()
  }
  const failedCount = state.pdfWatermarkStatuses.filter((item) => item?.error).length
  return result.status === 'saved'
    ? `已处理 ${files.length} 个 PDF，共 ${watermarkedPages} 页添加${kind === 'text' ? '文字' : '图片'}水印${failedCount ? `；${failedCount} 个失败` : ''}`
    : '已取消保存'
}

async function addPdfPageNumbers() {
  const source = await readPdfDocument(state.pdfFiles[0])
  const font = await source.embedFont(StandardFonts.Helvetica)
  const position = document.querySelector('#pdf-page-number-position')?.value || 'footer'
  const start = Number(document.querySelector('#pdf-page-number-start')?.value || 1)

  if (!Number.isInteger(start) || start < 0 || start > 99999) {
    throw new Error('起始页码必须是 0–99999 的整数')
  }

  source.getPages().forEach((page, index) => {
    const label = `${start + index} / ${start + source.getPageCount() - 1}`
    const size = 10
    const labelWidth = font.widthOfTextAtSize(label, size)
    const { width, height } = page.getSize()
    page.drawText(label, {
      x: Math.max(16, (width - labelWidth) / 2),
      y: position === 'header' ? height - 20 : 12,
      size,
      font,
      color: rgb(0.32, 0.34, 0.42),
      opacity: 0.82
    })
  })

  const result = await saveSinglePdfToolOutput(
    'pdf',
    `${pdfOutputBaseName(state.pdfFiles[0])}-numbered`,
    await source.save()
  )
  return result.status === 'saved'
    ? `已在${position === 'header' ? '页眉' : '页脚'}添加 ${source.getPageCount()} 个页码`
    : '已取消保存'
}

function resetPdfPageOrganizer() {
  state.pdfPageItems = []
  state.pdfPageOrganizerSource = null
  state.pdfPageOrganizerSnapshot = []
  if (pdfPageGrid) pdfPageGrid.replaceChildren()
  if (pdfPageOrganizer) pdfPageOrganizer.hidden = true
}

function renderPdfPageOrganizer() {
  pdfPageGrid.replaceChildren()
  state.pdfPageItems.forEach((item, index) => {
    const card = document.createElement('article')
    const preview = document.createElement('img')
    const footer = document.createElement('footer')
    const label = document.createElement('span')
    const previous = document.createElement('button')
    const next = document.createElement('button')
    const remove = document.createElement('button')

    card.className = 'pdf-page-card'
    card.classList.toggle('selected', Boolean(item.selected))
    card.draggable = true
    card.dataset.pageId = item.id
    preview.src = item.thumbnail
    preview.alt = `${item.file.name} 第 ${item.pageIndex + 1} 页`
    label.textContent = `${index + 1} · ${item.file.name} / ${item.pageIndex + 1}`
    label.title = label.textContent

    previous.type = 'button'
    previous.dataset.pageCommand = 'previous'
    previous.disabled = index === 0
    previous.setAttribute('aria-label', '向前移动')
    previous.textContent = '←'
    next.type = 'button'
    next.dataset.pageCommand = 'next'
    next.disabled = index === state.pdfPageItems.length - 1
    next.setAttribute('aria-label', '向后移动')
    next.textContent = '→'
    remove.type = 'button'
    remove.className = 'delete'
    remove.dataset.pageCommand = 'delete'
    remove.setAttribute('aria-label', '删除页面')
    remove.textContent = '×'
    footer.append(label, previous, next, remove)
    card.append(preview, footer)
    pdfPageGrid.append(card)
  })

  pdfPageSummary.textContent = state.pdfPageItems.length
    ? `共 ${state.pdfPageItems.length} 页 · 已选择 ${state.pdfPageItems.filter((item) => item.selected).length} 页`
    : '页面已全部删除，可插入其他 PDF'
  updatePdfRunState()
}

async function createPdfPageItems(file) {
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer())
  })
  const pdfDocument = await loadingTask.promise
  const items = []

  try {
    if (state.pdfPageItems.length + pdfDocument.numPages > 200) {
      throw new Error('页重排最多支持 200 页')
    }

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      pdfPageSummary.textContent = `正在载入 ${file.name} · ${pageNumber} / ${pdfDocument.numPages}`
      const page = await pdfDocument.getPage(pageNumber)
      const natural = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(1, 132 / natural.width) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      await page.render({
        canvas,
        canvasContext: canvas.getContext('2d'),
        viewport
      }).promise
      items.push({
        id: crypto.randomUUID(),
        file,
        pageIndex: pageNumber - 1,
        thumbnail: canvas.toDataURL('image/jpeg', 0.72)
      })
      page.cleanup()
    }
  } finally {
    await pdfDocument.destroy()
  }

  return items
}

async function ensurePdfPageOrganizerLoaded() {
  const source = state.pdfFiles[0]
  if (!source) throw new Error('请先上传 PDF')
  if (state.pdfPageOrganizerSource === source && state.pdfPageItems.length) return

  state.pdfPageItems = []
  state.pdfPageOrganizerSource = source
  pdfPageGrid.replaceChildren()
  pdfPageSummary.textContent = '正在读取页面…'
  state.pdfPageItems = await createPdfPageItems(source)
  renderPdfPageOrganizer()
}

async function openPdfPageOrganizer() {
  if (state.pdfBusy || !state.pdfFiles[0]) return
  pdfPageOrganizer.hidden = false
  try {
    await ensurePdfPageOrganizerLoaded()
    state.pdfPageOrganizerSnapshot = state.pdfPageItems.map((item) => ({ ...item, selected: false }))
    document.querySelector('#pdf-page-output-path').textContent =
      state.pdfDestination?.path || '尚未选择'
  } catch (error) {
    pdfPageOrganizer.hidden = true
    setPdfResult(`页面载入失败：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

async function insertPdfPages(fileList) {
  const files = Array.from(fileList || []).filter((file) =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
  if (!files.length) return

  try {
    for (const file of files) {
      if (file.size > 150 * 1024 * 1024) throw new Error(`${file.name} 超过 150 MB`)
      state.pdfPageItems.push(...await createPdfPageItems(file))
    }
    renderPdfPageOrganizer()
  } catch (error) {
    setPdfResult(`插入页面失败：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

function movePdfPage(itemIndex, offset) {
  const targetIndex = itemIndex + offset
  if (itemIndex < 0 || targetIndex < 0 || targetIndex >= state.pdfPageItems.length) return
  const [item] = state.pdfPageItems.splice(itemIndex, 1)
  state.pdfPageItems.splice(targetIndex, 0, item)
  renderPdfPageOrganizer()
}

async function saveReorderedPdf() {
  await ensurePdfPageOrganizerLoaded()
  if (!state.pdfPageItems.length) throw new Error('至少保留一个页面')

  const sourceDocuments = new Map()
  const output = await PDFDocument.create()
  for (const [index, item] of state.pdfPageItems.entries()) {
    setPdfResult(`正在重排 ${index + 1} / ${state.pdfPageItems.length}`, 'busy')
    let source = sourceDocuments.get(item.file)
    if (!source) {
      source = await readPdfDocument(item.file)
      sourceDocuments.set(item.file, source)
    }
    const [page] = await output.copyPages(source, [item.pageIndex])
    output.addPage(page)
  }

  const result = await saveSinglePdfToolOutput(
    'pdf',
    `${pdfOutputBaseName(state.pdfFiles[0])}-reordered`,
    await output.save()
  )
  return result.status === 'saved'
    ? `已按当前顺序保存 ${state.pdfPageItems.length} 页`
    : '已取消保存'
}

async function imagesToPdf() {
  const output = await PDFDocument.create()

  for (const [index, file] of state.pdfFiles.entries()) {
    setPdfResult(`正在处理图片 ${index + 1} / ${state.pdfFiles.length}`, 'busy')
    const converted = await imageFileToPng(file)
    const image = await output.embedPng(converted.data)
    const pageScale = Math.min(1, 14400 / converted.width, 14400 / converted.height)
    const width = converted.width * pageScale
    const height = converted.height * pageScale
    const page = output.addPage([width, height])
    page.drawImage(image, { x: 0, y: 0, width, height })
  }

  const result = await saveSinglePdfToolOutput('pdf', 'images', await output.save())
  return result.status === 'saved'
    ? `已将 ${state.pdfFiles.length} 张图片合成为 PDF`
    : '已取消保存'
}

async function renderPdfPages(type) {
  const file = state.pdfFiles[0]
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer())
  })
  const pdfDocument = await loadingTask.promise
  const files = []
  let totalBytes = 0

  try {
    if (pdfDocument.numPages > 200) {
      throw new Error('逐页导出最多支持 200 页')
    }

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      setPdfResult(`正在渲染 ${pageNumber} / ${pdfDocument.numPages}`, 'busy')
      const page = await pdfDocument.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 2 })
      const outputCanvas = window.document.createElement('canvas')
      outputCanvas.width = Math.ceil(viewport.width)
      outputCanvas.height = Math.ceil(viewport.height)
      const context = outputCanvas.getContext('2d')

      if (type === 'jpeg') {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, outputCanvas.width, outputCanvas.height)
      }

      await page.render({
        canvas: outputCanvas,
        canvasContext: context,
        viewport
      }).promise
      const blob = await canvasToBlob(
        outputCanvas,
        type === 'jpeg' ? 'image/jpeg' : 'image/png',
        type === 'jpeg'
          ? Number(window.document.querySelector('#pdf-jpeg-quality')?.value || 0.85)
          : undefined
      )
      const data = new Uint8Array(await blob.arrayBuffer())
      totalBytes += data.byteLength

      if (totalBytes > 450 * 1024 * 1024) {
        throw new Error('生成结果超过 450 MB，请逐页拆分后重试')
      }

      files.push({
        name: `${pdfOutputBaseName(file)}-page-${String(pageNumber).padStart(3, '0')}`,
        data
      })
      page.cleanup()
    }
  } finally {
    await pdfDocument.destroy()
  }

  const result = await saveBatchPdfToolOutput(type, files)
  const label = type === 'jpeg' ? 'JPEG' : 'PNG'
  return result.status === 'saved' ? `已导出 ${files.length} 张 ${label} 图片` : '已取消保存'
}

async function extractPdfText() {
  const file = state.pdfFiles[0]
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer())
  })
  const pdfDocument = await loadingTask.promise
  const pages = []

  try {
    if (pdfDocument.numPages > 500) throw new Error('文字提取最多支持 500 页')

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      setPdfResult(`正在提取文字 ${pageNumber} / ${pdfDocument.numPages}`, 'busy')
      const page = await pdfDocument.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`)
        .join('')
        .trim()
      pages.push(`--- 第 ${pageNumber} 页 ---\n${text}`)
      page.cleanup()
    }
  } finally {
    await pdfDocument.destroy()
  }

  const text = pages.join('\n\n').trim()
  if (!text.replace(/--- 第 \d+ 页 ---/g, '').trim()) {
    throw new Error('未检测到内嵌文字；扫描件不含文本，本功能不做 OCR')
  }

  const result = await saveSinglePdfToolOutput(
    'txt',
    `${pdfOutputBaseName(file)}-text`,
    new TextEncoder().encode(text)
  )
  return result.status === 'saved' ? `已提取 ${pages.length} 页内嵌文字` : '已取消保存'
}

function pdfImageDataToCanvas(imageData) {
  const canvas = document.createElement('canvas')
  const width = Number(imageData?.width)
  const height = Number(imageData?.height)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('PDF 图片尺寸无效')
  }
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (imageData instanceof ImageData) {
    context.putImageData(imageData, 0, 0)
    return canvas
  }
  if (imageData.bitmap) {
    context.drawImage(imageData.bitmap, 0, 0)
    return canvas
  }

  const source = imageData.data
  if (!(source instanceof Uint8Array || source instanceof Uint8ClampedArray)) {
    throw new Error('PDF 图片像素格式不受支持')
  }
  const output = context.createImageData(width, height)

  if (imageData.kind === ImageKind.RGBA_32BPP) {
    output.data.set(source.subarray(0, output.data.length))
  } else if (imageData.kind === ImageKind.RGB_24BPP) {
    for (let sourceIndex = 0, outputIndex = 0; outputIndex < output.data.length; outputIndex += 4) {
      output.data[outputIndex] = source[sourceIndex++]
      output.data[outputIndex + 1] = source[sourceIndex++]
      output.data[outputIndex + 2] = source[sourceIndex++]
      output.data[outputIndex + 3] = 255
    }
  } else if (imageData.kind === ImageKind.GRAYSCALE_1BPP) {
    const rowBytes = Math.ceil(width / 8)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const bit = source[y * rowBytes + Math.floor(x / 8)] & (128 >> (x % 8))
        const value = bit ? 255 : 0
        const outputIndex = (y * width + x) * 4
        output.data[outputIndex] = value
        output.data[outputIndex + 1] = value
        output.data[outputIndex + 2] = value
        output.data[outputIndex + 3] = 255
      }
    }
  } else {
    throw new Error('PDF 图片颜色格式不受支持')
  }

  context.putImageData(output, 0, 0)
  return canvas
}

function getPdfPageObject(page, objectId) {
  return new Promise((resolve) => page.objs.get(objectId, resolve))
}

async function extractEmbeddedPdfImages() {
  const file = state.pdfFiles[0]
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer())
  })
  const pdfDocument = await loadingTask.promise
  const files = []
  let totalBytes = 0

  try {
    if (pdfDocument.numPages > 500) throw new Error('提取图片最多支持 500 页')

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      setPdfResult(`正在分析图片 ${pageNumber} / ${pdfDocument.numPages}`, 'busy')
      const page = await pdfDocument.getPage(pageNumber)
      const operatorList = await page.getOperatorList()
      const seenObjectIds = new Set()
      let pageImageNumber = 0

      for (let index = 0; index < operatorList.fnArray.length; index += 1) {
        const operation = operatorList.fnArray[index]
        const args = operatorList.argsArray[index]
        let imageData

        if (
          operation === OPS.paintImageXObject ||
          operation === OPS.paintImageXObjectRepeat
        ) {
          const objectId = args?.[0]
          if (!objectId || seenObjectIds.has(objectId)) continue
          seenObjectIds.add(objectId)
          imageData = await getPdfPageObject(page, objectId)
        } else if (operation === OPS.paintInlineImageXObject) {
          imageData = args?.[0]
        } else {
          continue
        }

        if (!imageData || files.length >= 500) continue
        try {
          const canvas = pdfImageDataToCanvas(imageData)
          if (canvas.width < 2 || canvas.height < 2) continue
          const blob = await canvasToBlob(canvas, 'image/png')
          const data = new Uint8Array(await blob.arrayBuffer())
          totalBytes += data.byteLength
          if (totalBytes > 450 * 1024 * 1024) {
            throw new Error('提取结果超过 450 MB，请逐页拆分后重试')
          }
          pageImageNumber += 1
          files.push({
            name: `${pdfOutputBaseName(file)}-page-${String(pageNumber).padStart(3, '0')}-image-${String(pageImageNumber).padStart(3, '0')}`,
            data
          })
        } catch (error) {
          if (error instanceof Error && error.message.includes('450 MB')) throw error
        }
      }
      page.cleanup()
    }
  } finally {
    await pdfDocument.destroy()
  }

  if (!files.length) throw new Error('未检测到可导出的内嵌位图')
  const result = await saveBatchPdfToolOutput('png', files)
  return result.status === 'saved' ? `已提取 ${files.length} 张内嵌图片` : '已取消保存'
}

async function ocrPdfToText() {
  const file = state.pdfFiles[0]
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer())
  })
  const pdfDocument = await loadingTask.promise
  const pages = []

  try {
    if (pdfDocument.numPages > 80) throw new Error('OCR 最多支持 80 页，请拆分后重试')

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      setPdfResult(`正在 OCR 第 ${pageNumber} / ${pdfDocument.numPages} 页`, 'busy')
      const page = await pdfDocument.getPage(pageNumber)
      const natural = page.getViewport({ scale: 1 })
      const scale = Math.min(2.5, 1800 / natural.width)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({
        canvas,
        canvasContext: canvas.getContext('2d'),
        viewport
      }).promise
      const blob = await canvasToBlob(canvas, 'image/png')
      const result = await window.api.recognizeScreenshot(
        new Uint8Array(await blob.arrayBuffer())
      )
      pages.push(`--- 第 ${pageNumber} 页 ---\n${result.text.trim()}`)
      page.cleanup()
    }
  } finally {
    await pdfDocument.destroy()
  }

  const text = pages.join('\n\n').trim()
  if (!text.replace(/--- 第 \d+ 页 ---/g, '').trim()) {
    throw new Error('未识别到文字，请确认扫描页清晰可见')
  }
  const result = await saveSinglePdfToolOutput(
    'txt',
    `${pdfOutputBaseName(file)}-ocr`,
    new TextEncoder().encode(text)
  )
  return result.status === 'saved' ? `OCR 已识别并导出 ${pages.length} 页文字` : '已取消保存'
}

async function runPdfAction() {
  if (state.pdfBusy || pdfRunButton.disabled) return
  state.pdfBusy = true
  state.pdfLastOutput = null
  state.pdfComResult = null
  pdfOpenOutputButton.disabled = true
  updatePdfRunState()
  setPdfResult('正在准备文件…', 'busy')

  try {
    const action = state.selections.pdf
    let message

    if (['Word 转 PDF', 'Excel 转 PDF', 'PPT 转 PDF'].includes(action)) {
      if (!state.pdfNativeInput) throw new Error('请先选择 Office 文件')
      const result = await window.api.convertOfficeToPdf({
        inputId: state.pdfNativeInput.id,
        destinationId: state.pdfDestination?.id
      })
      state.pdfComResult = result.result
      resetPdfDestination()
      pdfOpenOutputButton.disabled = false
      message = `${currentPdfConfig().inputLabel} 已导出为 PDF`
    } else if (action === '转 PNG') message = await renderPdfPages('png')
    else if (action === '转 JPEG') message = await renderPdfPages('jpeg')
    else if (action === '转 TXT') message = await extractPdfText()
    else if (action === '合并 PDF') message = await mergePdfFiles()
    else if (action === '逐页拆分') message = await splitPdfFile()
    else if (action === '旋转 PDF') message = await rotatePdfFile()
    else if (action === '提取指定页') message = await extractPdfPages()
    else if (action === '文字水印') message = await addPdfWatermarks('text')
    else if (action === '图片水印') message = await addPdfWatermarks('image')
    else if (action === '添加页码') message = await addPdfPageNumbers()
    else if (action === '页重排') message = await saveReorderedPdf()
    else if (action === '提取图片') message = await extractEmbeddedPdfImages()
    else if (action === 'OCR 转 TXT') message = await ocrPdfToText()
    else if (action === '加密 PDF') message = await encryptPdfFile()
    else if (action === '解密 PDF') message = await decryptPdfFile()
    else if (action === '图片转 PDF') message = await imagesToPdf()
    else throw new Error('该 PDF 功能尚未接入')

    const hasOutput = Boolean(state.pdfLastOutput || state.pdfComResult)
    setPdfResult(message, hasOutput ? 'success' : '')
    if (hasOutput) showToast(message)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setPdfResult(`处理失败：${reason}`, 'error')
    showToast('PDF 处理失败')
  } finally {
    state.pdfBusy = false
    updatePdfRunState()
  }
}

pdfAddFilesButton.addEventListener('click', async () => {
  const config = currentPdfConfig()
  if (config.kind !== 'office') {
    pdfFileInput.value = ''
    pdfFileInput.click()
    return
  }
  try {
    const input = await window.api.pickOfficeFile(config.officeKind)
    if (!input) return
    state.pdfNativeInput = input
    state.pdfComResult = null
    state.pdfLastOutput = null
    resetPdfDestination()
    pdfOpenOutputButton.disabled = true
    renderPdfFiles()
    setPdfResult(`${input.name} 已添加`)
  } catch (error) {
    setPdfResult(`无法选择文件：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
})
pdfChooseOutputButton.addEventListener('click', async () => {
  if (state.pdfBusy || pdfChooseOutputButton.disabled) return
  try {
    const result = await window.api.choosePdfOutput(currentPdfOutputSpec())
    if (result.status !== 'selected') return
    state.pdfDestination = result
    pdfOutputPath.textContent = result.path
    pdfOutputPath.title = result.path
    updatePdfRunState()
    setPdfResult('输出位置已选择')
  } catch (error) {
    setPdfResult(`无法选择输出位置：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
})
pdfFileInput.addEventListener('change', () => addPdfToolFiles(pdfFileInput.files))
pdfClearFilesButton.addEventListener('click', () => {
  if (isPdfWatermarkAction()) {
    state.pdfWatermarkFiles = []
    state.pdfWatermarkStatuses = []
  } else {
    state.pdfFiles = []
  }
  state.pdfNativeInput = null
  state.pdfComResult = null
  state.pdfLastOutput = null
  state.pdfWatermarkImage = null
  resetPdfDestination()
  resetPdfPageOrganizer()
  pdfOpenOutputButton.disabled = true
  renderPdfFiles()
  renderPdfWatermarkState()
  setPdfResult('添加文件后即可处理')
})
pdfFileBody.addEventListener('click', (event) => {
  const button = event.target.closest('.pdf-remove-file')
  if (!button || state.pdfBusy) return
  if (currentPdfConfig().kind === 'office') {
    state.pdfNativeInput = null
  } else {
    currentPdfFiles().splice(Number(button.dataset.index), 1)
  }
  resetPdfDestination()
  resetPdfPageOrganizer()
  renderPdfFiles()
  renderPdfWatermarkState()
})
pdfWatermarkFileList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-watermark-index]')
  if (state.pdfBusy) return
  if (button) {
    state.pdfWatermarkFiles.splice(Number(button.dataset.watermarkIndex), 1)
    state.pdfWatermarkStatuses.splice(Number(button.dataset.watermarkIndex), 1)
    resetPdfDestination()
    state.pdfWatermarkPreviewPage = 1
    renderPdfFiles()
    renderPdfWatermarkState()
    return
  }
  const row = event.target.closest('[data-preview-index]')
  if (!row) return
  state.pdfWatermarkPreviewFileIndex = Number(row.dataset.previewIndex)
  state.pdfWatermarkPreviewPage = 1
  renderPdfWatermarkState()
})
document.querySelector('#pdf-watermark-image-button').addEventListener('click', () => {
  const input = document.querySelector('#pdf-watermark-image-input')
  input.value = ''
  input.click()
})
document.querySelector('#pdf-watermark-image-input').addEventListener('change', (event) => {
  state.pdfWatermarkImage = event.target.files?.[0] || null
  renderPdfWatermarkState()
  updatePdfRunState()
})
document.querySelector('#pdf-watermark-rotation').addEventListener('change', renderPdfWatermarkState)
document.querySelectorAll(
  '#pdf-watermark-text, #pdf-watermark-font, #pdf-watermark-font-size, ' +
  '#pdf-watermark-custom-rotation, #pdf-watermark-density, #pdf-watermark-vertical, ' +
  '#pdf-watermark-offset-y, #pdf-watermark-horizontal, #pdf-watermark-offset-x, ' +
  '#pdf-watermark-pages'
).forEach((control) => {
  control.addEventListener('input', () => {
    renderPdfWatermarkState()
  })
})
const pdfWatermarkOpacity = document.querySelector('#pdf-watermark-opacity')
const pdfWatermarkOpacityNumber = document.querySelector('#pdf-watermark-opacity-number')
const pdfWatermarkOpacityValue = document.querySelector('#pdf-watermark-opacity-value')
function updatePdfWatermarkOpacity(source) {
  const value = Math.max(5, Math.min(100, Number(source.value) || 28))
  pdfWatermarkOpacity.value = String(value)
  pdfWatermarkOpacityNumber.value = String(value)
  pdfWatermarkOpacityValue.textContent = `${value}%`
  void drawPdfWatermarkPreview()
}
pdfWatermarkOpacity.addEventListener('input', () => updatePdfWatermarkOpacity(pdfWatermarkOpacity))
pdfWatermarkOpacityNumber.addEventListener('input', () => updatePdfWatermarkOpacity(pdfWatermarkOpacityNumber))
document.querySelector('#pdf-watermark-previous-page').addEventListener('click', () => {
  state.pdfWatermarkPreviewPage = Math.max(1, state.pdfWatermarkPreviewPage - 1)
  void drawPdfWatermarkPreview()
})
document.querySelector('#pdf-watermark-next-page').addEventListener('click', () => {
  state.pdfWatermarkPreviewPage = Math.min(
    state.pdfWatermarkPreviewPageCount,
    state.pdfWatermarkPreviewPage + 1
  )
  void drawPdfWatermarkPreview()
})
pdfDropZone.addEventListener('dragover', (event) => {
  event.preventDefault()
  pdfDropZone.classList.add('drag-over')
})
pdfDropZone.addEventListener('dragleave', () => pdfDropZone.classList.remove('drag-over'))
pdfDropZone.addEventListener('drop', (event) => {
  event.preventDefault()
  pdfDropZone.classList.remove('drag-over')
  if (currentPdfConfig().kind === 'office') {
    setPdfResult('Office 文件请使用“上传”按钮选择', 'error')
    return
  }
  addPdfToolFiles(event.dataTransfer.files)
})
pdfRunButton.addEventListener('click', runPdfAction)
pdfOpenOutputButton.addEventListener('click', async () => {
  if (!state.pdfLastOutput && !state.pdfComResult) return
  try {
    if (state.pdfComResult) {
      await window.api.showComResult(state.pdfComResult.id)
    } else {
      await window.api.showPdfOutput(state.pdfLastOutput)
    }
  } catch {
    setPdfResult('无法打开输出位置', 'error')
  }
})

function closePdfPageOrganizer({ restore = false } = {}) {
  if (restore) {
    state.pdfPageItems = state.pdfPageOrganizerSnapshot.map((item) => ({
      ...item,
      selected: false
    }))
    renderPdfPageOrganizer()
  }
  pdfPageOrganizer.hidden = true
  document.querySelector('#pdf-open-page-organizer')?.focus()
}
document.querySelector('#pdf-cancel-page-organizer').addEventListener('click', () => {
  closePdfPageOrganizer({ restore: true })
})
document.querySelector('#pdf-insert-pages').addEventListener('click', () => {
  pdfInsertPagesInput.value = ''
  pdfInsertPagesInput.click()
})
document.querySelector('#pdf-select-all-pages').addEventListener('click', () => {
  const shouldSelect = state.pdfPageItems.some((item) => !item.selected)
  state.pdfPageItems.forEach((item) => {
    item.selected = shouldSelect
  })
  renderPdfPageOrganizer()
})
document.querySelector('#pdf-delete-selected-pages').addEventListener('click', () => {
  const selectedCount = state.pdfPageItems.filter((item) => item.selected).length
  if (!selectedCount) {
    setPdfResult('请先选择要删除的页面', 'error')
    return
  }
  state.pdfPageItems = state.pdfPageItems.filter((item) => !item.selected)
  renderPdfPageOrganizer()
})
document.querySelector('#pdf-reset-pages').addEventListener('click', () => {
  state.pdfPageItems = state.pdfPageOrganizerSnapshot.map((item) => ({
    ...item,
    selected: false
  }))
  renderPdfPageOrganizer()
})
document.querySelector('#pdf-page-choose-output').addEventListener('click', async () => {
  try {
    const result = await window.api.choosePdfOutput(currentPdfOutputSpec())
    if (result.status !== 'selected') return
    state.pdfDestination = result
    pdfOutputPath.textContent = result.path
    pdfOutputPath.title = result.path
    document.querySelector('#pdf-page-output-path').textContent = result.path
    updatePdfRunState()
  } catch (error) {
    setPdfResult(`无法选择输出位置：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
})
document.querySelector('#pdf-save-page-organizer').addEventListener('click', async () => {
  if (state.pdfBusy) return
  if (!state.pdfDestination) {
    setPdfResult('请先选择保存位置', 'error')
    return
  }
  state.pdfBusy = true
  updatePdfRunState()
  setPdfResult('正在保存页面顺序…', 'busy')
  try {
    const message = await saveReorderedPdf()
    setPdfResult(message, state.pdfLastOutput ? 'success' : '')
    if (state.pdfLastOutput) {
      state.pdfPageOrganizerSnapshot = state.pdfPageItems.map((item) => ({
        ...item,
        selected: false
      }))
      closePdfPageOrganizer()
    }
  } catch (error) {
    setPdfResult(`保存失败：${error instanceof Error ? error.message : String(error)}`, 'error')
  } finally {
    state.pdfBusy = false
    updatePdfRunState()
  }
})
pdfInsertPagesInput.addEventListener('change', () => insertPdfPages(pdfInsertPagesInput.files))
pdfPageOrganizer.addEventListener('click', (event) => {
  if (event.target === pdfPageOrganizer) closePdfPageOrganizer({ restore: true })
})
pdfPageGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page-command]')
  const card = event.target.closest('.pdf-page-card')
  if (!card || state.pdfBusy) return
  if (!button) {
    const item = state.pdfPageItems.find((entry) => entry.id === card.dataset.pageId)
    if (item) {
      item.selected = !item.selected
      renderPdfPageOrganizer()
    }
    return
  }
  const index = state.pdfPageItems.findIndex((item) => item.id === card.dataset.pageId)
  if (button.dataset.pageCommand === 'previous') movePdfPage(index, -1)
  else if (button.dataset.pageCommand === 'next') movePdfPage(index, 1)
  else if (button.dataset.pageCommand === 'delete') {
    state.pdfPageItems.splice(index, 1)
    renderPdfPageOrganizer()
  }
})
pdfPageGrid.addEventListener('dragstart', (event) => {
  const card = event.target.closest('.pdf-page-card')
  if (!card) return
  draggedPdfPageId = card.dataset.pageId
  card.classList.add('dragging')
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', draggedPdfPageId)
})
pdfPageGrid.addEventListener('dragover', (event) => {
  const card = event.target.closest('.pdf-page-card')
  if (!card || card.dataset.pageId === draggedPdfPageId) return
  event.preventDefault()
  pdfPageGrid.querySelectorAll('.drag-target').forEach((item) => item.classList.remove('drag-target'))
  card.classList.add('drag-target')
  event.dataTransfer.dropEffect = 'move'
})
pdfPageGrid.addEventListener('drop', (event) => {
  const targetCard = event.target.closest('.pdf-page-card')
  event.preventDefault()
  if (!targetCard || !draggedPdfPageId) return
  const sourceIndex = state.pdfPageItems.findIndex((item) => item.id === draggedPdfPageId)
  let targetIndex = state.pdfPageItems.findIndex((item) => item.id === targetCard.dataset.pageId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return
  const [item] = state.pdfPageItems.splice(sourceIndex, 1)
  if (sourceIndex < targetIndex) targetIndex -= 1
  const placeAfter = event.clientX > targetCard.getBoundingClientRect().left + targetCard.offsetWidth / 2
  state.pdfPageItems.splice(targetIndex + (placeAfter ? 1 : 0), 0, item)
  renderPdfPageOrganizer()
})
pdfPageGrid.addEventListener('dragend', () => {
  draggedPdfPageId = ''
  pdfPageGrid.querySelectorAll('.dragging, .drag-target').forEach((item) => {
    item.classList.remove('dragging', 'drag-target')
  })
})
window.api.onPdfSaveProgress((progress) => {
  if (state.pdfBusy) {
    setPdfResult(`正在保存 ${progress.completed} / ${progress.total}`, 'busy')
  }
})

const screenshotStage = document.querySelector('#screenshot-stage')
const screenshotEmpty = document.querySelector('#screenshot-empty')
const screenshotStatusText = document.querySelector('#screenshot-status-text')
const screenshotStatusDot = document.querySelector('#screenshot-status-dot')
const startScreenshotButton = document.querySelector('#start-screenshot')
const startScrollScreenshotButton = document.querySelector('#start-scroll-screenshot')
const copyScreenshotButton = document.querySelector('#copy-screenshot')
const saveScreenshotButton = document.querySelector('#save-screenshot')
const pinScreenshotButton = document.querySelector('#pin-screenshot')
const ocrScreenshotButton = document.querySelector('#ocr-screenshot')
const ocrOverlay = document.querySelector('#ocr-overlay')
const ocrResult = document.querySelector('#ocr-result')
const ocrProgressFill = document.querySelector('#ocr-progress-fill')
const ocrProgressText = document.querySelector('#ocr-progress-text')
const ocrSummary = document.querySelector('#ocr-summary')
const copyOcrResultButton = document.querySelector('#copy-ocr-result')
const scrollSpikeOverlay = document.querySelector('#scroll-spike-overlay')
const controlledScrollSource = document.querySelector('#controlled-scroll-source')
const controlledScrollList = document.querySelector('#controlled-scroll-list')
const confirmScrollScreenshotButton = document.querySelector('#confirm-scroll-screenshot')
const cancelScrollScreenshotButton = document.querySelector('#cancel-scroll-screenshot')
const screenshotCanvas = new fabric.Canvas('screenshot-canvas-element', {
  preserveObjectStacking: true,
  selection: true
})
const screenshotState = {
  sourceCanvas: null,
  width: 0,
  height: 0,
  baseImage: null,
  busy: false
}

screenshotCanvas.setDimensions({ width: 1, height: 1 })

function setScreenshotStatus(message, status = '') {
  screenshotStatusText.textContent = message
  screenshotStatusDot.classList.remove('success', 'error', 'busy')
  if (status) screenshotStatusDot.classList.add(status)
}

function updateScreenshotControls() {
  const hasImage = Boolean(screenshotState.sourceCanvas)
  document.querySelectorAll('.screenshot-annotation').forEach((button) => {
    button.disabled = !hasImage || screenshotState.busy
  })
  copyScreenshotButton.disabled = !hasImage || screenshotState.busy
  saveScreenshotButton.disabled = !hasImage || screenshotState.busy
  pinScreenshotButton.disabled = !hasImage || screenshotState.busy
  ocrScreenshotButton.disabled = !hasImage || screenshotState.busy
  startScreenshotButton.disabled = screenshotState.busy
  startScrollScreenshotButton.disabled = screenshotState.busy
}

function screenshotPreviewSize() {
  const maxWidth = Math.max(240, screenshotStage.clientWidth - 30)
  const maxHeight = Math.max(200, screenshotStage.clientHeight - 30)
  const scale = Math.min(
    1,
    maxWidth / screenshotState.width,
    maxHeight / screenshotState.height
  )
  return {
    width: Math.max(1, Math.round(screenshotState.width * scale)),
    height: Math.max(1, Math.round(screenshotState.height * scale)),
    scale
  }
}

function rebuildScreenshotCanvas(overlays = []) {
  if (!screenshotState.sourceCanvas) return
  const preview = screenshotPreviewSize()
  screenshotCanvas.clear()
  screenshotCanvas.setDimensions({ width: preview.width, height: preview.height })
  screenshotState.baseImage = new fabric.Image(screenshotState.sourceCanvas, {
    left: 0,
    top: 0,
    scaleX: preview.width / screenshotState.width,
    scaleY: preview.height / screenshotState.height,
    selectable: false,
    evented: false,
    excludeFromExport: true,
    dataRole: 'base'
  })
  screenshotCanvas.add(screenshotState.baseImage)
  overlays.forEach((object) => screenshotCanvas.add(object))
  screenshotCanvas.sendToBack(screenshotState.baseImage)
  screenshotCanvas.requestRenderAll()
  screenshotEmpty.classList.add('hidden')
}

async function loadScreenshotResult(result) {
  const blob = new Blob([result.data], { type: 'image/png' })
  const bitmap = await createImageBitmap(blob)
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = bitmap.width
  sourceCanvas.height = bitmap.height
  sourceCanvas.getContext('2d').drawImage(bitmap, 0, 0)
  bitmap.close()
  screenshotState.sourceCanvas = sourceCanvas
  screenshotState.width = sourceCanvas.width
  screenshotState.height = sourceCanvas.height
  rebuildScreenshotCanvas()
  updateScreenshotControls()
  setScreenshotStatus(`已截取 ${sourceCanvas.width} × ${sourceCanvas.height} px`, 'success')
}

const controlledScrollItems = [
  ['01', '区域截图', '选择屏幕区域并载入标注画布', '#6978e6'],
  ['02', '矩形与箭头', '用醒目的几何标记突出重点', '#7b6bd6'],
  ['03', '画笔标注', '直接在截图上绘制自由线条', '#4da4b0'],
  ['04', '文字说明', '添加可移动、可缩放的文字注释', '#db8f43'],
  ['05', '复制到剪贴板', '生成完整分辨率 PNG 并复制', '#4a9a70'],
  ['06', '保存 PNG', '通过主进程安全选择落盘位置', '#d05f62'],
  ['07', '应用内滚动截图', '精确控制滚动量并逐帧捕获', '#5b79c7'],
  ['08', '长图无缝拼接', '按真实滚动坐标消除重叠内容', '#9a69b8'],
  ['09', '继续标注', '长图载入同一套 Fabric 编辑器', '#3d91a6'],
  ['10', '边界清晰', '第三方窗口滚动截图不在本次承诺内', '#737789']
]

controlledScrollItems.forEach(([index, title, copy, color]) => {
  const item = document.createElement('article')
  item.className = 'controlled-scroll-item'
  item.style.setProperty('--scroll-item-color', color)
  const icon = document.createElement('i')
  icon.textContent = index
  const content = document.createElement('div')
  const heading = document.createElement('b')
  heading.textContent = title
  const description = document.createElement('span')
  description.textContent = copy
  content.append(heading, description)
  item.append(icon, content)
  controlledScrollList.append(item)
})

function nextAnimationFrames(count = 2) {
  return new Promise((resolve) => {
    const step = (remaining) => {
      if (remaining <= 0) resolve()
      else requestAnimationFrame(() => step(remaining - 1))
    }
    step(count)
  })
}

async function decodePngCanvas(data) {
  const blob = new Blob([data], { type: 'image/png' })
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

async function captureControlledScroll() {
  const originalScrollTop = controlledScrollSource.scrollTop
  controlledScrollSource.classList.add('capturing')
  await nextAnimationFrames(2)
  const clientHeight = controlledScrollSource.clientHeight
  const scrollHeight = controlledScrollSource.scrollHeight
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
  const positions = []

  for (let scrollTop = 0; scrollTop < maxScrollTop; scrollTop += clientHeight) {
    positions.push(scrollTop)
  }
  positions.push(maxScrollTop)

  let outputCanvas
  let outputContext
  let pixelScale = 1

  try {
    for (const [index, scrollTop] of [...new Set(positions)].entries()) {
      controlledScrollSource.scrollTop = scrollTop
      await nextAnimationFrames(3)
      const rect = controlledScrollSource.getBoundingClientRect()
      const frame = await window.api.captureScrollFrame({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      })
      const frameCanvas = await decodePngCanvas(frame.data)

      if (!outputCanvas) {
        pixelScale = frameCanvas.width / rect.width
        outputCanvas = document.createElement('canvas')
        outputCanvas.width = frameCanvas.width
        outputCanvas.height = Math.max(1, Math.round(scrollHeight * pixelScale))
        outputContext = outputCanvas.getContext('2d')
      }

      const targetY = Math.round(scrollTop * pixelScale)
      const remainingHeight = outputCanvas.height - targetY
      outputContext.drawImage(
        frameCanvas,
        0,
        0,
        frameCanvas.width,
        Math.min(frameCanvas.height, remainingHeight),
        0,
        targetY,
        frameCanvas.width,
        Math.min(frameCanvas.height, remainingHeight)
      )
      setScreenshotStatus(`正在拼接 ${index + 1} / ${positions.length} 帧…`, 'busy')
    }
  } finally {
    controlledScrollSource.scrollTop = originalScrollTop
    controlledScrollSource.classList.remove('capturing')
  }

  if (!outputCanvas) throw new Error('没有捕获到滚动内容')
  return { canvas: outputCanvas, frameCount: [...new Set(positions)].length }
}

startScrollScreenshotButton.addEventListener('click', () => {
  scrollSpikeOverlay.hidden = false
  controlledScrollSource.scrollTop = 0
  confirmScrollScreenshotButton.focus()
})

cancelScrollScreenshotButton.addEventListener('click', () => {
  scrollSpikeOverlay.hidden = true
  startScrollScreenshotButton.focus()
})

confirmScrollScreenshotButton.addEventListener('click', async () => {
  if (screenshotState.busy) return
  screenshotState.busy = true
  confirmScrollScreenshotButton.disabled = true
  updateScreenshotControls()
  setScreenshotStatus('正在截取应用内长内容…', 'busy')

  try {
    const result = await captureControlledScroll()
    scrollSpikeOverlay.hidden = true
    await loadScreenshotResult({
      data: new Uint8Array(await (await canvasToBlob(result.canvas, 'image/png')).arrayBuffer())
    })
    setScreenshotStatus(
      `应用内长图已拼接 · ${result.frameCount} 帧 · ${result.canvas.width} × ${result.canvas.height} px`,
      'success'
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setScreenshotStatus(`滚动截图失败：${reason}`, 'error')
  } finally {
    screenshotState.busy = false
    confirmScrollScreenshotButton.disabled = false
    updateScreenshotControls()
  }
})

function addScreenshotObject(type) {
  if (!screenshotState.sourceCanvas) return
  screenshotCanvas.isDrawingMode = false
  const centerX = screenshotCanvas.getWidth() / 2
  const centerY = screenshotCanvas.getHeight() / 2
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6978e6'
  let object

  if (type === 'rectangle') {
    object = new fabric.Rect({
      left: centerX,
      top: centerY,
      originX: 'center',
      originY: 'center',
      width: Math.min(180, screenshotCanvas.getWidth() * 0.4),
      height: Math.min(100, screenshotCanvas.getHeight() * 0.3),
      fill: 'transparent',
      stroke: accent,
      strokeWidth: 4
    })
  } else if (type === 'arrow') {
    const line = new fabric.Line([-70, 0, 55, 0], {
      stroke: accent,
      strokeWidth: 5,
      originX: 'center',
      originY: 'center'
    })
    const head = new fabric.Triangle({
      left: 62,
      top: 0,
      width: 18,
      height: 22,
      fill: accent,
      angle: 90,
      originX: 'center',
      originY: 'center'
    })
    object = new fabric.Group([line, head], {
      left: centerX,
      top: centerY,
      originX: 'center',
      originY: 'center'
    })
  } else if (type === 'text') {
    object = new fabric.IText('输入文字', {
      left: centerX,
      top: centerY,
      originX: 'center',
      originY: 'center',
      fill: accent,
      fontFamily: 'Segoe UI, Microsoft YaHei UI, sans-serif',
      fontSize: 28,
      fontWeight: 700
    })
  }

  if (!object) return
  object.set({
    dataRole: 'annotation',
    cornerColor: '#ffffff',
    cornerStrokeColor: accent,
    transparentCorners: false
  })
  screenshotCanvas.add(object)
  screenshotCanvas.setActiveObject(object)
  screenshotCanvas.requestRenderAll()
  setScreenshotStatus(`${{ rectangle: '矩形', arrow: '箭头', text: '文字' }[type]}标注已添加`)
}

function enableScreenshotBrush(button) {
  if (!screenshotState.sourceCanvas) return
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6978e6'
  screenshotCanvas.discardActiveObject()
  screenshotCanvas.isDrawingMode = true
  const brush = new fabric.PencilBrush(screenshotCanvas)
  brush.color = accent
  brush.width = 5
  screenshotCanvas.freeDrawingBrush = brush
  document.querySelectorAll('.screenshot-annotation').forEach((option) => {
    option.classList.toggle('on', option === button)
  })
  setScreenshotStatus('画笔已启用，直接在截图上拖动')
}

async function renderScreenshotPng() {
  if (!screenshotState.sourceCanvas) throw new Error('请先截图')
  screenshotCanvas.isDrawingMode = false
  screenshotCanvas.discardActiveObject()
  screenshotCanvas.requestRenderAll()
  const rendered = document.createElement('canvas')
  rendered.width = screenshotState.width
  rendered.height = screenshotState.height
  const context = rendered.getContext('2d')
  context.drawImage(screenshotState.sourceCanvas, 0, 0)

  if (screenshotState.baseImage) {
    screenshotState.baseImage.visible = false
    screenshotCanvas.requestRenderAll()
  }
  let annotationLayer
  try {
    annotationLayer = screenshotCanvas.toCanvasElement()
  } finally {
    if (screenshotState.baseImage) {
      screenshotState.baseImage.visible = true
      screenshotCanvas.requestRenderAll()
    }
  }
  context.drawImage(annotationLayer, 0, 0, rendered.width, rendered.height)
  const blob = await canvasToBlob(rendered, 'image/png')
  return new Uint8Array(await blob.arrayBuffer())
}

startScreenshotButton.addEventListener('click', async () => {
  if (screenshotState.busy) return
  screenshotState.busy = true
  updateScreenshotControls()
  setScreenshotStatus('正在读取屏幕…', 'busy')

  try {
    await window.api.startScreenshot()
    setScreenshotStatus('请在全屏覆盖层中拖动选择区域', 'busy')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    screenshotState.busy = false
    updateScreenshotControls()
    setScreenshotStatus(`截图失败：${reason}`, 'error')
  }
})

document.querySelectorAll('.screenshot-annotation').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.screenshot-annotation').forEach((option) => {
      option.classList.remove('on')
    })
    if (button.dataset.screenTool === 'brush') enableScreenshotBrush(button)
    else addScreenshotObject(button.dataset.screenTool)
  })
})

copyScreenshotButton.addEventListener('click', async () => {
  try {
    screenshotState.busy = true
    updateScreenshotControls()
    const result = await window.api.copyScreenshot(await renderScreenshotPng())
    setScreenshotStatus(`已复制 ${result.size.width} × ${result.size.height} px 到剪贴板`, 'success')
    showToast('截图已复制')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setScreenshotStatus(`复制失败：${reason}`, 'error')
  } finally {
    screenshotState.busy = false
    updateScreenshotControls()
  }
})

saveScreenshotButton.addEventListener('click', async () => {
  try {
    screenshotState.busy = true
    updateScreenshotControls()
    const result = await window.api.saveScreenshot({
      name: `screenshot-${Date.now()}`,
      data: await renderScreenshotPng()
    })
    setScreenshotStatus(
      result.status === 'saved' ? '截图 PNG 已保存' : '已取消保存',
      result.status === 'saved' ? 'success' : ''
    )
    if (result.status === 'saved') showToast('截图已保存')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setScreenshotStatus(`保存失败：${reason}`, 'error')
  } finally {
    screenshotState.busy = false
    updateScreenshotControls()
  }
})

pinScreenshotButton.addEventListener('click', async () => {
  try {
    screenshotState.busy = true
    updateScreenshotControls()
    const result = await window.api.pinScreenshot(await renderScreenshotPng())
    setScreenshotStatus(
      `截图已钉住 · ${result.width} × ${result.height} px 浮窗`,
      'success'
    )
    showToast('截图已钉住')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setScreenshotStatus(`钉住失败：${reason}`, 'error')
  } finally {
    screenshotState.busy = false
    updateScreenshotControls()
  }
})

const ocrProgressLabels = {
  'loading tesseract core': '载入 OCR 核心',
  'initializing tesseract': '初始化 OCR 核心',
  'loading language traineddata': '载入中英文模型',
  'initializing api': '初始化识别引擎',
  'recognizing text': '正在识别文字'
}

ocrScreenshotButton.addEventListener('click', async () => {
  if (screenshotState.busy) return
  screenshotState.busy = true
  updateScreenshotControls()
  ocrOverlay.hidden = false
  ocrResult.value = ''
  ocrResult.disabled = true
  copyOcrResultButton.disabled = true
  ocrProgressFill.style.width = '2%'
  ocrProgressText.textContent = '准备本地识别模型…'
  ocrSummary.textContent = '首次识别需要初始化本地模型。'
  setScreenshotStatus('正在执行本地 OCR…', 'busy')

  try {
    const result = await window.api.recognizeScreenshot(await renderScreenshotPng())
    ocrResult.value = result.text
    ocrResult.disabled = false
    copyOcrResultButton.disabled = !result.text
    ocrProgressFill.style.width = '100%'
    ocrProgressText.textContent = '识别完成'
    ocrSummary.textContent = result.text
      ? `识别完成 · 置信度 ${Math.round(result.confidence)}% · 可编辑后复制`
      : '未识别到文字，请尝试更清晰或更大的截图。'
    setScreenshotStatus(
      result.text ? 'OCR 识别完成' : 'OCR 未识别到文字',
      result.text ? 'success' : ''
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    ocrResult.disabled = false
    ocrResult.value = ''
    ocrProgressText.textContent = '识别失败'
    ocrSummary.textContent = reason
    setScreenshotStatus(`OCR 失败：${reason}`, 'error')
  } finally {
    screenshotState.busy = false
    updateScreenshotControls()
  }
})

document.querySelector('#close-ocr').addEventListener('click', () => {
  ocrOverlay.hidden = true
  ocrScreenshotButton.focus()
})

copyOcrResultButton.addEventListener('click', async () => {
  const text = ocrResult.value.trim()
  if (!text) return
  try {
    await window.api.copyScreenshotText(text)
    ocrSummary.textContent = `已复制 ${text.length} 个字符`
    showToast('OCR 文字已复制')
  } catch (error) {
    ocrSummary.textContent = `复制失败：${error instanceof Error ? error.message : String(error)}`
  }
})

window.api.onScreenshotOcrProgress((progress) => {
  if (state.pdfBusy && state.selections.pdf === 'OCR 转 TXT') {
    const label = ocrProgressLabels[progress.status] || progress.status || '正在识别'
    setPdfResult(`PDF OCR · ${label} ${Math.round((Number(progress.progress) || 0) * 100)}%`, 'busy')
  }
  if (!screenshotState.busy || ocrOverlay.hidden) return
  const value = Math.min(0.98, Math.max(0.02, Number(progress.progress) || 0))
  ocrProgressFill.style.width = `${Math.round(value * 100)}%`
  ocrProgressText.textContent =
    ocrProgressLabels[progress.status] || progress.status || '正在识别…'
})

window.api.onScreenshotCaptured((result) => {
  screenshotState.busy = false
  loadScreenshotResult(result).catch((error) => {
    const reason = error instanceof Error ? error.message : String(error)
    setScreenshotStatus(`截图载入失败：${reason}`, 'error')
  }).finally(updateScreenshotControls)
})
window.api.onScreenshotCancelled(() => {
  screenshotState.busy = false
  updateScreenshotControls()
  setScreenshotStatus('已取消截图')
})

screenshotCanvas.on('path:created', (event) => {
  if (event.path) event.path.set({ dataRole: 'annotation' })
})

let screenshotResizeTimer
window.addEventListener('resize', () => {
  window.clearTimeout(screenshotResizeTimer)
  screenshotResizeTimer = window.setTimeout(() => {
    if (!screenshotState.sourceCanvas) return
    const oldWidth = screenshotCanvas.getWidth()
    const oldHeight = screenshotCanvas.getHeight()
    const overlays = screenshotCanvas.getObjects().filter((object) => object.dataRole === 'annotation')
    const next = screenshotPreviewSize()
    const scaleX = next.width / oldWidth
    const scaleY = next.height / oldHeight
    overlays.forEach((object) => {
      object.set({
        left: object.left * scaleX,
        top: object.top * scaleY,
        scaleX: object.scaleX * scaleX,
        scaleY: object.scaleY * scaleY
      })
      object.setCoords()
    })
    rebuildScreenshotCanvas(overlays)
  }, 160)
})

window.addEventListener('beforeunload', () => {
  qpdfRunnerPromise?.then((runner) => runner.destroy()).catch(() => {})
})

const illustratorState = {
  inputs: [],
  statuses: new Map(),
  busy: false,
  outputs: []
}
const illustratorFileBody = document.querySelector('#illustrator-file-body')
const illustratorEmpty = document.querySelector('#illustrator-empty')
const illustratorAddFilesButton = document.querySelector('#illustrator-add-files')
const illustratorAddFolderButton = document.querySelector('#illustrator-add-folder')
const illustratorClearButton = document.querySelector('#illustrator-clear')
const illustratorStopButton = document.querySelector('#illustrator-stop')
const illustratorSameDirectory = document.querySelector('#illustrator-same-directory')
const illustratorProgressFill = document.querySelector('#illustrator-progress-fill')
const illustratorProgressText = document.querySelector('#illustrator-progress-text')
const illustratorLog = document.querySelector('#illustrator-log')
const illustratorOpenOutputButton = document.querySelector('#illustrator-open-output')
const illustratorRunButtons = Array.from(document.querySelectorAll('.illustrator-run'))

function illustratorFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function appendIllustratorLog(message) {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const lines = `${illustratorLog.textContent}\n[${timestamp}] ${message}`.trim().split('\n').slice(-120)
  illustratorLog.textContent = lines.join('\n')
  illustratorLog.scrollTop = illustratorLog.scrollHeight
}

function renderIllustratorFiles() {
  illustratorFileBody.replaceChildren()
  illustratorEmpty.classList.toggle('hidden', illustratorState.inputs.length > 0)

  illustratorState.inputs.forEach((file, index) => {
    const row = document.createElement('div')
    const order = document.createElement('span')
    const name = document.createElement('span')
    const size = document.createElement('span')
    const status = document.createElement('span')
    const remove = document.createElement('button')
    const currentStatus = illustratorState.statuses.get(file.id) || '等待'

    row.className = 'pdf-file-row illustrator-file-row'
    order.className = 'cell-index'
    name.className = 'cell-name'
    size.className = 'cell-meta'
    status.className = `cell-status illustrator-status ${currentStatus === '完成' ? 'success' : currentStatus === '处理中' ? 'busy' : currentStatus === '失败' ? 'error' : ''}`
    order.textContent = String(index + 1)
    name.textContent = file.name
    name.title = file.name
    size.textContent = illustratorFileSize(file.size)
    status.textContent = currentStatus
    remove.type = 'button'
    remove.className = 'pdf-remove-file illustrator-remove-file'
    remove.dataset.id = file.id
    remove.disabled = illustratorState.busy
    remove.setAttribute('aria-label', `移除 ${file.name}`)
    remove.textContent = '×'
    row.append(order, name, size, status, remove)
    illustratorFileBody.append(row)
  })

  const hasFiles = illustratorState.inputs.length > 0
  illustratorAddFilesButton.disabled = illustratorState.busy
  illustratorAddFolderButton.disabled = illustratorState.busy
  illustratorClearButton.disabled = illustratorState.busy || !hasFiles
  illustratorSameDirectory.disabled = illustratorState.busy
  illustratorRunButtons.forEach((button) => {
    button.disabled = illustratorState.busy || !hasFiles
  })
  illustratorStopButton.disabled = !illustratorState.busy
}

async function addIllustratorInputs(picker) {
  if (illustratorState.busy) return
  try {
    const files = await picker()
    if (!files.length) return
    const known = new Set(illustratorState.inputs.map((file) => `${file.name}\0${file.size}`))
    const skippedIds = []
    const added = files.filter((file) => {
      const key = `${file.name}\0${file.size}`
      if (known.has(key)) {
        skippedIds.push(file.id)
        return false
      }
      known.add(key)
      return true
    })
    if (skippedIds.length) await window.api.removeIllustratorInputs(skippedIds)
    illustratorState.inputs.push(...added)
    added.forEach((file) => illustratorState.statuses.set(file.id, '等待'))
    illustratorState.outputs = []
    illustratorOpenOutputButton.disabled = true
    renderIllustratorFiles()
    appendIllustratorLog(`已添加 ${added.length} 个文件，共 ${illustratorState.inputs.length} 个。`)
  } catch (error) {
    appendIllustratorLog(`添加失败：${error instanceof Error ? error.message : String(error)}`)
    showToast('无法添加 Illustrator 文件')
  }
}

async function runIllustratorAction(action, triggerButton) {
  if (illustratorState.busy || !illustratorState.inputs.length) return
  illustratorState.busy = true
  illustratorState.outputs = []
  illustratorOpenOutputButton.disabled = true
  illustratorState.inputs.forEach((file) => illustratorState.statuses.set(file.id, '等待'))
  illustratorProgressFill.style.width = '0%'
  illustratorProgressText.textContent = '正在启动 Illustrator…'
  renderIllustratorFiles()
  const originalLabel = triggerButton.textContent
  triggerButton.textContent = '处理中…'
  appendIllustratorLog(`开始${originalLabel}，共 ${illustratorState.inputs.length} 个文件。`)

  try {
    const result = await window.api.runIllustratorTask({
      action,
      inputIds: illustratorState.inputs.map((file) => file.id),
      sameDirectory: illustratorSameDirectory.checked
    })
    if (result.status === 'completed') {
      illustratorState.inputs.forEach((file) => illustratorState.statuses.set(file.id, '完成'))
      illustratorState.outputs = result.outputs
      illustratorProgressFill.style.width = '100%'
      illustratorProgressText.textContent = `已完成 ${result.outputs.length} / ${illustratorState.inputs.length}`
      illustratorOpenOutputButton.disabled = result.outputs.length === 0
      appendIllustratorLog(`${originalLabel}完成，已生成 ${result.outputs.length} 个文件。`)
      showToast(`${originalLabel}完成`)
    } else {
      illustratorProgressText.textContent = '任务已取消'
      appendIllustratorLog('任务已取消；当前 COM 操作完成后停止。')
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    illustratorState.inputs.forEach((file) => {
      if (illustratorState.statuses.get(file.id) === '处理中') {
        illustratorState.statuses.set(file.id, '失败')
      }
    })
    illustratorProgressText.textContent = '任务失败'
    appendIllustratorLog(`任务失败：${reason}`)
    showToast('Illustrator 任务失败')
  } finally {
    illustratorState.busy = false
    triggerButton.textContent = originalLabel
    renderIllustratorFiles()
  }
}

illustratorAddFilesButton.addEventListener('click', () => addIllustratorInputs(window.api.pickIllustratorFiles))
illustratorAddFolderButton.addEventListener('click', () => addIllustratorInputs(window.api.pickIllustratorFolder))
illustratorClearButton.addEventListener('click', async () => {
  if (illustratorState.busy) return
  const ids = illustratorState.inputs.map((file) => file.id)
  await window.api.removeIllustratorInputs(ids)
  illustratorState.inputs = []
  illustratorState.statuses.clear()
  illustratorState.outputs = []
  illustratorProgressFill.style.width = '0%'
  illustratorProgressText.textContent = '等待任务'
  illustratorOpenOutputButton.disabled = true
  illustratorLog.textContent = '等待添加 Illustrator 文件。'
  renderIllustratorFiles()
})
illustratorFileBody.addEventListener('click', async (event) => {
  const button = event.target.closest('.illustrator-remove-file')
  if (!button || illustratorState.busy) return
  await window.api.removeIllustratorInputs([button.dataset.id])
  illustratorState.inputs = illustratorState.inputs.filter((file) => file.id !== button.dataset.id)
  illustratorState.statuses.delete(button.dataset.id)
  renderIllustratorFiles()
})
illustratorRunButtons.forEach((button) => {
  button.addEventListener('click', () => runIllustratorAction(button.dataset.illustratorAction, button))
})
illustratorStopButton.addEventListener('click', async () => {
  const result = await window.api.cancelIllustratorTask()
  if (result.status === 'cancelling') {
    illustratorStopButton.disabled = true
    illustratorProgressText.textContent = '正在停止…'
    appendIllustratorLog('已请求停止，将在当前文件处理结束后生效。')
  }
})
illustratorOpenOutputButton.addEventListener('click', async () => {
  if (illustratorState.outputs[0]) {
    await window.api.showComResult(illustratorState.outputs[0].id)
  }
})
window.api.onIllustratorProgress((progress) => {
  if (!illustratorState.busy) return
  const total = Math.max(1, Number(progress.total) || illustratorState.inputs.length || 1)
  const completed = Math.max(0, Math.min(total, Number(progress.completed) || 0))
  illustratorState.inputs.forEach((file, index) => {
    if (index < completed) illustratorState.statuses.set(file.id, '完成')
    else if (index === completed && completed < total) illustratorState.statuses.set(file.id, '处理中')
  })
  illustratorProgressFill.style.width = `${completed / total * 100}%`
  illustratorProgressText.textContent = progress.message || `处理中 ${completed} / ${total}`
  if (progress.message) appendIllustratorLog(progress.message)
  renderIllustratorFiles()
})
renderIllustratorFiles()

const barcodeInput = document.querySelector('#barcode-value')
const barcodeSvg = document.querySelector('#barcode-svg')
const barcodeMessage = document.querySelector('#barcode-message')
const generateBarcodeButton = document.querySelector('#generate-barcode')
const saveBarcodeSvgButton = document.querySelector('#save-barcode-svg')
const saveBarcodePngButton = document.querySelector('#save-barcode-png')
const saveBarcodeEpsButton = document.querySelector('#save-barcode-eps')
const openBarcodeIllustratorButton = document.querySelector('#open-barcode-illustrator')
const openBarcodePhotoshopButton = document.querySelector('#open-barcode-photoshop')
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
  saveBarcodeEpsButton.disabled = !enabled
  openBarcodeIllustratorButton.disabled = !enabled
  openBarcodePhotoshopButton.disabled = !enabled
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
    font: 'Moyu OCR-B, OCRB, "OCR-B", "OCR B Std", Consolas, monospace',
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
  const fontStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  fontStyle.textContent = `@font-face{font-family:"Moyu OCR-B";src:url(${ocrbFontData}) format("truetype");}`
  clone.prepend(fontStyle)
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

function hasCurrentBarcode() {
  return Boolean(
    barcodeRenderedValue &&
    barcodeInput.value.trim() === barcodeRenderedValue &&
    barcodeRenderedType === state.selections.bc
  )
}

async function runBarcodeCom(action, button) {
  if (!hasCurrentBarcode()) {
    setBarcodeMessage('内容已改变，请先重新生成条码。', 'error')
    return
  }
  const originalLabel = button.textContent
  setBarcodeExportEnabled(false)
  button.textContent = '处理中…'

  try {
    const svgText = serializeBarcodeSvg()
    let result
    if (action === 'eps') {
      result = await window.api.exportBarcodeEps({
        name: `${state.selections.bc}-${barcodeRenderedValue}`,
        data: svgText
      })
    } else if (action === 'illustrator') {
      result = await window.api.openBarcodeInIllustrator({ data: svgText })
    } else {
      const png = await svgToPngBytes(svgText)
      result = await window.api.openBarcodeInPhotoshop({ data: png })
    }

    if (result.status === 'cancelled') {
      setBarcodeMessage('已取消操作。')
    } else {
      const label = action === 'eps' ? 'EPS 已保存' : action === 'illustrator' ? '已转入 Illustrator' : '已转入 Photoshop'
      setBarcodeMessage(`${label}。`, 'success')
      showToast(label)
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    setBarcodeMessage(`联动失败：${reason}`, 'error')
    showToast('请确认 Adobe 软件已安装')
  } finally {
    button.textContent = originalLabel
    setBarcodeExportEnabled(hasCurrentBarcode())
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
saveBarcodeEpsButton.addEventListener('click', () => runBarcodeCom('eps', saveBarcodeEpsButton))
openBarcodeIllustratorButton.addEventListener('click', () => runBarcodeCom('illustrator', openBarcodeIllustratorButton))
openBarcodePhotoshopButton.addEventListener('click', () => runBarcodeCom('photoshop', openBarcodePhotoshopButton))
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

const aiInputList = document.querySelector('#ai-input-list')
const aiInputEmpty = document.querySelector('#ai-input-empty')
const aiInputCount = document.querySelector('#ai-input-count')
const aiPreviewImage = document.querySelector('#ai-preview-image')
const aiPreviewEmpty = document.querySelector('#ai-preview-empty')
const aiPreviewMeta = document.querySelector('#ai-preview-meta')
const aiSourceTab = document.querySelector('#ai-preview-source-tab')
const aiResultTab = document.querySelector('#ai-preview-result-tab')
const aiRuntimeState = document.querySelector('#ai-runtime-state')
const aiModelStatus = document.querySelector('#ai-model-status')
const aiProgressFill = document.querySelector('#ai-progress-fill')
const aiTaskStatus = document.querySelector('#ai-task-status')
const aiRunButton = document.querySelector('#ai-run-task')
const aiSaveButton = document.querySelector('#ai-save-results')
const aiPickFolderButton = document.querySelector('#ai-pick-folder')
const aiIdOptions = document.querySelector('#ai-id-options')
const aiIdPreset = document.querySelector('#ai-id-preset')
const aiIdColor = document.querySelector('#ai-id-color')
const aiIdColorText = document.querySelector('#ai-id-color-text')
const aiRepairOptions = document.querySelector('#ai-repair-options')
const aiBrushSize = document.querySelector('#ai-brush-size')
const aiMaskCanvas = document.querySelector('#ai-mask-canvas')
const aiMaskContext = aiMaskCanvas.getContext('2d')
const aiExportPsdButton = document.querySelector('#ai-export-psd')
const aiState = {
  inputs: [],
  results: [],
  selectedInputId: '',
  previewKind: 'source',
  busy: false,
  runtimeReady: false,
  maskDrawn: false,
  maskDrawing: false
}

function aiModeConfig() {
  const action = state.selections.aimg
  if (action === '批量抠图') {
    return {
      mode: 'batch',
      mark: 'ALL',
      title: '批量抠图',
      copy: '顺序处理最多 100 张图片，并批量保存透明 PNG。',
      runLabel: '开始批量抠图'
    }
  }
  if (action === '证件照') {
    return {
      mode: 'id-photo',
      mark: 'ID',
      title: '证件照',
      copy: '识别人物主体并按指定尺寸与背景色生成证件照。',
      runLabel: '生成证件照'
    }
  }
  if (action === '图像修补') {
    return {
      mode: 'inpaint',
      mark: 'FIX',
      title: '图像修补',
      copy: '涂抹不需要的物体或瑕疵，由 MI-GAN 在本机补全背景。',
      runLabel: '开始修补'
    }
  }
  return {
    mode: 'remove',
    mark: 'BG',
    title: '智能抠图',
    copy: '自动识别主体并导出透明 PNG。',
    runLabel: '开始智能抠图'
  }
}

function formatAiBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function aiBlobUrl(data) {
  return URL.createObjectURL(new Blob([data], { type: 'image/png' }))
}

function revokeAiItems(items) {
  items.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
}

function selectedAiInput() {
  return aiState.inputs.find((input) => input.id === aiState.selectedInputId) || aiState.inputs[0]
}

function selectedAiResult() {
  const selected = selectedAiInput()
  return selected
    ? aiState.results.find((result) => result.inputId === selected.id)
    : aiState.results[0]
}

function setAiPreview(kind = aiState.previewKind) {
  const source = selectedAiInput()
  const result = selectedAiResult()
  const canShowResult = Boolean(result)
  aiState.previewKind = kind === 'result' && canShowResult ? 'result' : 'source'
  aiSourceTab.classList.toggle('on', aiState.previewKind === 'source')
  aiResultTab.classList.toggle('on', aiState.previewKind === 'result')
  aiResultTab.disabled = !canShowResult
  const item = aiState.previewKind === 'result' ? result : source

  if (!item) {
    aiPreviewImage.hidden = true
    aiPreviewImage.removeAttribute('src')
    aiPreviewEmpty.hidden = false
    aiPreviewMeta.textContent = '尚未选择图片'
    aiMaskCanvas.hidden = true
    return
  }
  aiPreviewEmpty.hidden = true
  aiPreviewImage.hidden = false
  aiPreviewImage.src = item.previewUrl
  aiPreviewMeta.textContent = `${item.name} · ${item.width} × ${item.height} · ${formatAiBytes(item.size)}`
  const showMask = aiModeConfig().mode === 'inpaint' && aiState.previewKind === 'source'
  aiMaskCanvas.hidden = !showMask
  if (showMask) requestAnimationFrame(layoutAiMaskCanvas)
}

function renderAiInputs() {
  aiInputList.replaceChildren()
  aiInputCount.textContent = `${aiState.inputs.length} / 100`
  aiInputEmpty.hidden = aiState.inputs.length > 0
  const fragment = document.createDocumentFragment()
  aiState.inputs.forEach((input) => {
    const button = document.createElement('button')
    const image = document.createElement('img')
    const copy = document.createElement('span')
    const name = document.createElement('b')
    const meta = document.createElement('small')
    const stateMark = document.createElement('span')
    const hasResult = aiState.results.some((result) => result.inputId === input.id)
    button.type = 'button'
    button.className = `ai-input-item${input.id === aiState.selectedInputId ? ' on' : ''}`
    button.dataset.inputId = input.id
    image.src = input.previewUrl
    image.alt = ''
    name.textContent = input.name
    meta.textContent = `${input.width} × ${input.height} · ${formatAiBytes(input.size)}`
    stateMark.className = 'ai-item-state'
    stateMark.textContent = hasResult ? '✓' : ''
    copy.append(name, meta)
    button.append(image, copy, stateMark)
    fragment.append(button)
  })
  aiInputList.append(fragment)
  updateAiControls()
  setAiPreview()
}

function updateAiControls() {
  const config = aiModeConfig()
  const requiredCount = config.mode === 'batch'
    ? aiState.inputs.length
    : selectedAiInput() ? 1 : 0
  aiRunButton.disabled = aiState.busy || requiredCount === 0
  aiSaveButton.disabled = aiState.busy || aiState.results.length === 0
  aiExportPsdButton.disabled =
    aiState.busy || !selectedAiResult() || config.mode === 'id-photo'
  aiPickFolderButton.hidden = config.mode !== 'batch'
}

function setAiMode(action) {
  if (!['智能抠图', '批量抠图', '证件照', '图像修补'].includes(action)) return
  state.selections.aimg = action
  document.querySelector('#aimg-crumb').textContent = action
  const config = aiModeConfig()
  document.querySelector('#ai-mode-mark').textContent = config.mark
  document.querySelector('#ai-mode-title').textContent = config.title
  document.querySelector('#ai-mode-copy').textContent = config.copy
  aiRunButton.textContent = config.runLabel
  aiIdOptions.hidden = config.mode !== 'id-photo'
  aiRepairOptions.hidden = config.mode !== 'inpaint'
  document.querySelector('#ai-model-name').textContent =
    config.mode === 'inpaint' ? 'MI-GAN Pipeline v2' : 'RMBG-1.4'
  document.querySelector('#ai-license-note').textContent =
    config.mode === 'inpaint'
      ? '仅限当前自用学习 · MI-GAN 模型文件无独立许可声明。首次使用时下载，不随安装包分发。'
      : '仅限自用学习 · RMBG-1.4 非商业许可。模型首次使用时下载，不随安装包分发。'
  aiState.previewKind = 'source'
  resetAiMask()
  aiTaskStatus.textContent = aiState.inputs.length ? '准备就绪' : '添加图片后可开始'
  renderSubmenu('aimg')
  updateAiControls()
  loadAiRuntimeStatus()
}

function addAiInputs(files, replace = false) {
  if (!files.length) return
  if (replace) {
    window.api.removeAiInputs(aiState.inputs.map((item) => item.id)).catch(() => {})
    revokeAiItems(aiState.inputs)
    revokeAiItems(aiState.results)
    aiState.inputs = []
    aiState.results = []
  }
  const knownIds = new Set(aiState.inputs.map((item) => item.id))
  const uniqueFiles = files.filter((file) => !knownIds.has(file.id))
  const available = Math.max(0, 100 - aiState.inputs.length)
  const acceptedFiles = uniqueFiles.slice(0, available)
  const rejectedFiles = uniqueFiles.slice(available)
  if (rejectedFiles.length) {
    window.api.removeAiInputs(rejectedFiles.map((file) => file.id)).catch(() => {})
  }
  const prepared = acceptedFiles
    .map((file) => ({ ...file, previewUrl: aiBlobUrl(file.previewData) }))
  aiState.inputs.push(...prepared)
  aiState.selectedInputId = prepared[0]?.id || aiState.selectedInputId || aiState.inputs[0]?.id || ''
  aiState.previewKind = 'source'
  resetAiMask()
  aiTaskStatus.textContent = `已添加 ${aiState.inputs.length} 张图片`
  renderAiInputs()
}

async function pickAiImages() {
  const config = aiModeConfig()
  try {
    const result = await window.api.pickAiImages({ multiple: config.mode === 'batch' })
    if (result.status !== 'selected') return
    addAiInputs(result.files, config.mode !== 'batch')
    if (result.errors.length) showToast(`${result.errors.length} 个文件未能加入`)
  } catch (error) {
    showToast(`添加图片失败：${error.message}`)
  }
}

async function pickAiFolder() {
  try {
    const result = await window.api.pickAiFolder()
    if (result.status !== 'selected') return
    addAiInputs(result.files, true)
    if (result.truncated) showToast('文件夹图片超过 100 张，已取前 100 张')
    else if (result.errors.length) showToast(`${result.errors.length} 个文件未能加入`)
  } catch (error) {
    showToast(`读取文件夹失败：${error.message}`)
  }
}

async function clearAiInputs() {
  const ids = aiState.inputs.map((item) => item.id)
  if (ids.length) await window.api.removeAiInputs(ids).catch(() => {})
  revokeAiItems(aiState.inputs)
  revokeAiItems(aiState.results)
  aiState.inputs = []
  aiState.results = []
  aiState.selectedInputId = ''
  aiState.previewKind = 'source'
  resetAiMask()
  aiTaskStatus.textContent = '添加图片后可开始'
  renderAiInputs()
}

async function runAiTask() {
  const config = aiModeConfig()
  const selected = selectedAiInput()
  const inputIds = config.mode === 'batch'
    ? aiState.inputs.map((input) => input.id)
    : selected ? [selected.id] : []
  if (!inputIds.length || aiState.busy) return
  aiState.busy = true
  aiRunButton.textContent = '处理中…'
  aiTaskStatus.textContent = '正在准备本地模型…'
  aiProgressFill.style.width = '3%'
  updateAiControls()

  const [width, height] = aiIdPreset.value.split('x').map(Number)
  try {
    let mask
    if (config.mode === 'inpaint') {
      if (!aiState.maskDrawn) throw new Error('请先在原图上涂抹需要修补的区域')
      const blob = await new Promise((resolve, reject) => {
        aiMaskCanvas.toBlob((result) => {
          if (result) resolve(result)
          else reject(new Error('无法生成修补遮罩'))
        }, 'image/png')
      })
      mask = new Uint8Array(await blob.arrayBuffer())
    }
    const response = await window.api.runAiTask({
      mode: config.mode,
      inputIds,
      width,
      height,
      background: aiIdColor.value,
      mask
    })
    revokeAiItems(aiState.results)
    aiState.results = response.results.map((result) => ({
      ...result,
      previewUrl: aiBlobUrl(result.previewData)
    }))
    aiState.previewKind = 'result'
    aiProgressFill.style.width = '100%'
    aiTaskStatus.textContent = response.errors.length
      ? `完成 ${response.results.length} 张，失败 ${response.errors.length} 张`
      : `已完成 ${response.results.length} 张图片`
    renderAiInputs()
    showToast(config.mode === 'batch' ? '批量抠图完成' : `${config.title}完成`)
  } catch (error) {
    aiTaskStatus.textContent = `处理失败：${error.message}`
    aiProgressFill.style.width = '0'
    showToast('AI 图像处理失败')
  } finally {
    aiState.busy = false
    aiRunButton.textContent = config.runLabel
    updateAiControls()
  }
}

async function saveAiResults() {
  if (!aiState.results.length) return
  aiSaveButton.disabled = true
  try {
    const response = await window.api.saveAiResults(aiState.results.map((result) => result.id))
    if (response.status === 'saved') {
      aiTaskStatus.textContent = `已保存 ${response.saved} 个结果`
      showToast('AI 图像结果已保存')
    }
  } catch (error) {
    showToast(`保存失败：${error.message}`)
  } finally {
    aiSaveButton.disabled = aiState.results.length === 0
  }
}

async function exportAiPsd() {
  const result = selectedAiResult()
  if (!result) return
  aiExportPsdButton.disabled = true
  try {
    const response = await window.api.exportAiPsd(result.id)
    if (response.status === 'saved') {
      aiTaskStatus.textContent = `分层 PSD 已保存 · ${formatAiBytes(response.bytes)}`
      showToast('分层 PSD 已保存')
    }
  } catch (error) {
    showToast(`PSD 导出失败：${error.message}`)
  } finally {
    aiExportPsdButton.disabled = !selectedAiResult()
  }
}

function layoutAiMaskCanvas() {
  if (aiMaskCanvas.hidden || !aiPreviewImage.naturalWidth || !aiPreviewImage.naturalHeight) return
  const stage = aiPreviewImage.parentElement
  const availableWidth = Math.max(1, stage.clientWidth - 36)
  const availableHeight = Math.max(1, stage.clientHeight - 36)
  const scale = Math.min(
    availableWidth / aiPreviewImage.naturalWidth,
    availableHeight / aiPreviewImage.naturalHeight
  )
  const displayWidth = Math.max(1, Math.round(aiPreviewImage.naturalWidth * scale))
  const displayHeight = Math.max(1, Math.round(aiPreviewImage.naturalHeight * scale))
  const previous = aiState.maskDrawn && aiMaskCanvas.width
    ? aiMaskContext.getImageData(0, 0, aiMaskCanvas.width, aiMaskCanvas.height)
    : null
  const previousCanvas = previous ? document.createElement('canvas') : null
  if (previousCanvas) {
    previousCanvas.width = previous.width
    previousCanvas.height = previous.height
    previousCanvas.getContext('2d').putImageData(previous, 0, 0)
  }
  aiMaskCanvas.width = aiPreviewImage.naturalWidth
  aiMaskCanvas.height = aiPreviewImage.naturalHeight
  aiMaskCanvas.style.width = `${displayWidth}px`
  aiMaskCanvas.style.height = `${displayHeight}px`
  aiMaskCanvas.style.left = `${Math.round((stage.clientWidth - displayWidth) / 2)}px`
  aiMaskCanvas.style.top = `${Math.round((stage.clientHeight - displayHeight) / 2)}px`
  if (previousCanvas) {
    aiMaskContext.drawImage(previousCanvas, 0, 0, aiMaskCanvas.width, aiMaskCanvas.height)
  }
}

function resetAiMask() {
  aiState.maskDrawn = false
  aiState.maskDrawing = false
  aiMaskContext.clearRect(0, 0, aiMaskCanvas.width, aiMaskCanvas.height)
}

function aiMaskPoint(event) {
  const rect = aiMaskCanvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * aiMaskCanvas.width / rect.width,
    y: (event.clientY - rect.top) * aiMaskCanvas.height / rect.height
  }
}

function drawAiMask(event, begin = false) {
  const point = aiMaskPoint(event)
  const widthScale = aiMaskCanvas.width / Math.max(1, aiMaskCanvas.getBoundingClientRect().width)
  aiMaskContext.lineCap = 'round'
  aiMaskContext.lineJoin = 'round'
  aiMaskContext.strokeStyle = '#ffffff'
  aiMaskContext.lineWidth = Number(aiBrushSize.value) * widthScale
  if (begin) {
    aiMaskContext.beginPath()
    aiMaskContext.moveTo(point.x, point.y)
    aiMaskContext.lineTo(point.x + 0.01, point.y + 0.01)
  } else {
    aiMaskContext.lineTo(point.x, point.y)
  }
  aiMaskContext.stroke()
  aiState.maskDrawn = true
}

async function loadAiRuntimeStatus() {
  try {
    const status = await window.api.getAiStatus()
    aiState.runtimeReady = status.sidecarReady
    aiRuntimeState.classList.toggle('ready', status.sidecarReady)
    aiRuntimeState.classList.toggle('error', !status.sidecarReady)
    aiRuntimeState.lastChild.textContent = status.sidecarReady ? 'AI 运行环境就绪' : status.sidecarMessage
    const model = aiModeConfig().mode === 'inpaint' ? status.models.migan : status.models.rmbg
    aiModelStatus.textContent = model.ready
      ? '模型已下载并可用'
      : `首次使用时下载 ${Math.round(model.size / 1024 / 1024)} MB`
    aiProgressFill.style.width = model.ready ? '100%' : '0'
  } catch (error) {
    aiRuntimeState.classList.add('error')
    aiRuntimeState.lastChild.textContent = `环境检查失败：${error.message}`
  }
}

document.querySelector('#ai-pick-images').addEventListener('click', pickAiImages)
aiPickFolderButton.addEventListener('click', pickAiFolder)
document.querySelector('#ai-clear-inputs').addEventListener('click', clearAiInputs)
aiRunButton.addEventListener('click', runAiTask)
aiSaveButton.addEventListener('click', saveAiResults)
aiExportPsdButton.addEventListener('click', exportAiPsd)
aiInputList.addEventListener('click', (event) => {
  const item = event.target.closest('.ai-input-item')
  if (!item) return
  aiState.selectedInputId = item.dataset.inputId
  aiState.previewKind = selectedAiResult() ? 'result' : 'source'
  resetAiMask()
  renderAiInputs()
})
aiSourceTab.addEventListener('click', () => setAiPreview('source'))
aiResultTab.addEventListener('click', () => setAiPreview('result'))
aiIdColor.addEventListener('input', () => {
  aiIdColorText.value = aiIdColor.value.toUpperCase()
})
aiIdColorText.addEventListener('change', () => {
  if (/^#[0-9a-f]{6}$/i.test(aiIdColorText.value.trim())) {
    aiIdColor.value = aiIdColorText.value.trim()
    aiIdColorText.value = aiIdColor.value.toUpperCase()
  } else {
    aiIdColorText.value = aiIdColor.value.toUpperCase()
  }
})
aiBrushSize.addEventListener('input', () => {
  document.querySelector('#ai-brush-size-value').textContent = `${aiBrushSize.value} px`
})
document.querySelector('#ai-clear-mask').addEventListener('click', resetAiMask)
aiPreviewImage.addEventListener('load', layoutAiMaskCanvas)
window.addEventListener('resize', layoutAiMaskCanvas)
aiMaskCanvas.addEventListener('pointerdown', (event) => {
  aiState.maskDrawing = true
  aiMaskCanvas.setPointerCapture(event.pointerId)
  drawAiMask(event, true)
})
aiMaskCanvas.addEventListener('pointermove', (event) => {
  if (aiState.maskDrawing) drawAiMask(event)
})
aiMaskCanvas.addEventListener('pointerup', () => {
  aiState.maskDrawing = false
})
aiMaskCanvas.addEventListener('pointercancel', () => {
  aiState.maskDrawing = false
})
window.api.onAiModelProgress((progress) => {
  if (progress.status === 'downloading') {
    aiModelStatus.textContent = `${progress.name} · ${Math.round(progress.progress * 100)}%`
    aiProgressFill.style.width = `${Math.max(2, progress.progress * 100)}%`
  } else if (progress.status === 'retrying') {
    aiModelStatus.textContent = progress.message || `${progress.name} 正在重试下载`
    aiProgressFill.style.width = '2%'
  } else if (progress.status === 'ready') {
    aiModelStatus.textContent = `${progress.name} 已下载并校验`
    aiProgressFill.style.width = '100%'
  } else if (progress.status === 'error') {
    aiModelStatus.textContent = progress.message
    aiProgressFill.style.width = '0'
  }
})
window.api.onAiTaskProgress((progress) => {
  if (progress.status === 'running') {
    aiTaskStatus.textContent = `正在处理 ${progress.completed} / ${progress.total}${progress.name ? ` · ${progress.name}` : ''}`
  } else if (progress.status === 'saving') {
    aiTaskStatus.textContent = `正在保存 ${progress.completed} / ${progress.total}`
  }
})

const formatActionConfigs = {
  视频转换: {
    kind: 'video',
    mark: 'VID',
    copy: '转换为 MP4、MKV 或 WebM。',
    runLabel: '开始视频转换',
    targets: [['mp4', 'MP4 · H.264'], ['mkv', 'MKV · H.264'], ['webm', 'WebM · VP9']]
  },
  视频压缩: {
    kind: 'video',
    mark: 'ZIP',
    copy: '使用 H.264 CRF 档位缩小视频体积。',
    runLabel: '开始压缩视频'
  },
  抽取音频: {
    kind: 'video',
    mark: 'MP3',
    copy: '从视频中导出 MP3、AAC、WAV 或 FLAC。',
    runLabel: '开始抽取音频',
    targets: [['mp3', 'MP3'], ['m4a', 'AAC / M4A'], ['wav', 'WAV'], ['flac', 'FLAC']]
  },
  音频转换: {
    kind: 'audio',
    mark: 'AUD',
    copy: '在常用音频格式之间批量转换。',
    runLabel: '开始音频转换',
    targets: [['mp3', 'MP3'], ['m4a', 'AAC / M4A'], ['wav', 'WAV'], ['flac', 'FLAC']]
  },
  图片转换: {
    kind: 'image',
    mark: 'IMG',
    copy: '由 sharp 批量输出常用图片格式。',
    runLabel: '开始图片转换',
    targets: [['webp', 'WebP'], ['jpeg', 'JPEG'], ['png', 'PNG'], ['avif', 'AVIF'], ['tiff', 'TIFF'], ['gif', 'GIF']]
  },
  图片压缩: {
    kind: 'image',
    mark: 'MIN',
    copy: '保持原格式，按质量与最大宽度批量压缩。',
    runLabel: '开始图片压缩'
  }
}

const formatFileList = document.querySelector('#format-file-list')
const formatEmpty = document.querySelector('#format-empty')
const formatOptions = document.querySelector('#format-options')
const formatRunButton = document.querySelector('#format-run-task')
const formatCancelButton = document.querySelector('#format-cancel-task')
const formatSaveButton = document.querySelector('#format-save-results')
const formatProgressFill = document.querySelector('#format-progress-fill')
const formatStatusText = document.querySelector('#format-status-text')
const formatRuntimeState = document.querySelector('#format-runtime-state')
const formatState = {
  inputs: [],
  results: [],
  progressByInput: new Map(),
  errorsByInput: new Map(),
  busy: false,
  saving: false,
  taskId: '',
  ffmpegReady: false,
  sharpReady: false
}

function formatConfig() {
  return formatActionConfigs[state.selections.video] || formatActionConfigs.视频转换
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function renderFormatFiles() {
  formatFileList.replaceChildren()
  formatEmpty.hidden = formatState.inputs.length > 0
  const resultInputIds = new Set(formatState.results.map((result) => result.inputId))
  const fragment = document.createDocumentFragment()
  formatState.inputs.forEach((input, index) => {
    const row = document.createElement('article')
    const indexNode = document.createElement('span')
    const nameNode = document.createElement('span')
    const name = document.createElement('b')
    const detail = document.createElement('small')
    const size = document.createElement('span')
    const status = document.createElement('span')
    const remove = document.createElement('button')
    const error = formatState.errorsByInput.get(input.id)
    const progress = formatState.progressByInput.get(input.id)
    row.className = 'format-file-item'
    indexNode.className = 'format-index'
    nameNode.className = 'format-name'
    size.className = 'format-size'
    status.className = 'format-file-status'
    remove.className = 'format-remove'
    remove.type = 'button'
    remove.dataset.inputId = input.id
    remove.setAttribute('aria-label', `移除 ${input.name}`)
    remove.textContent = '×'
    remove.disabled = formatState.busy
    indexNode.textContent = String(index + 1)
    name.textContent = input.name
    const inputDetail = input.dimensions?.width
      ? `${input.dimensions.width} × ${input.dimensions.height}`
      : (input.name.split('.').at(-1) || input.kind).toUpperCase()
    detail.textContent = error || inputDetail
    detail.title = error || ''
    size.textContent = formatSize(input.size)
    if (error) {
      status.textContent = '导出失败'
      status.classList.add('error')
      status.title = error
    } else if (resultInputIds.has(input.id)) {
      status.textContent = '已导出'
      status.classList.add('success')
    } else if (Number.isFinite(progress)) {
      status.textContent = `转换中 ${Math.round(progress * 100)}%`
      status.classList.add('busy')
    } else {
      status.textContent = '等待处理'
    }
    nameNode.append(name, detail)
    row.append(indexNode, nameNode, size, status, remove)
    fragment.append(row)
  })
  formatFileList.append(fragment)
  updateFormatControls()
}

function updateFormatControls() {
  const config = formatConfig()
  const engineReady = config.kind === 'image' ? formatState.sharpReady : formatState.ffmpegReady
  formatRunButton.disabled = formatState.busy || !formatState.inputs.length || !engineReady
  formatSaveButton.disabled = formatState.busy || !formatState.results.length
  document.querySelector('#format-pick-files').disabled = formatState.busy
  document.querySelector('#format-pick-folder').disabled = formatState.busy
  document.querySelector('#format-clear-inputs').disabled = formatState.busy
}

function renderFormatOptions() {
  const config = formatConfig()
  const isImage = config.kind === 'image'
  const qualityLabel = isImage ? '质量' : 'CRF（越低越清晰）'
  const qualityValue = isImage ? 82 : state.selections.video === '视频压缩' ? 28 : 23
  const qualityMin = isImage ? 10 : 18
  const qualityMax = isImage ? 100 : 35
  const target = config.targets
    ? `
      <label>输出格式
        <select id="format-target">
          ${config.targets.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
        </select>
      </label>
    `
    : ''
  const audioOptions = ['视频转换', '视频压缩', '抽取音频', '音频转换'].includes(state.selections.video)
    ? `
      <label>音频码率 <b id="format-bitrate-value">192 kbps</b>
        <input id="format-audio-bitrate" type="range" min="64" max="320" step="32" value="192" />
      </label>
      <label>采样率
        <select id="format-sample-rate">
          <option value="44100">44.1 kHz</option>
          <option value="48000">48 kHz</option>
          <option value="32000">32 kHz</option>
        </select>
      </label>
    `
    : ''
  formatOptions.innerHTML = `
    ${target}
    <label>${qualityLabel} <b id="format-quality-value">${qualityValue}</b>
      <input id="format-quality" type="range" min="${qualityMin}" max="${qualityMax}" value="${qualityValue}" />
    </label>
    <label>最大宽度
      <select id="format-max-width">
        <option value="0">保持原尺寸</option>
        <option value="3840">3840 px</option>
        <option value="1920">1920 px</option>
        <option value="1280">1280 px</option>
        <option value="720">720 px</option>
      </select>
    </label>
    ${audioOptions}
  `
  const quality = formatOptions.querySelector('#format-quality')
  quality.addEventListener('input', () => {
    formatOptions.querySelector('#format-quality-value').textContent = quality.value
  })
  const bitrate = formatOptions.querySelector('#format-audio-bitrate')
  bitrate?.addEventListener('input', () => {
    formatOptions.querySelector('#format-bitrate-value').textContent = `${bitrate.value} kbps`
  })
}

function setFormatAction(action) {
  if (!formatActionConfigs[action]) return
  const previousKind = formatConfig().kind
  state.selections.video = action
  const config = formatConfig()
  document.querySelector('#format-crumb').textContent = action
  document.querySelector('#format-action-title').textContent = action
  document.querySelector('#format-action-mark').textContent = config.mark
  document.querySelector('#format-action-copy').textContent = config.copy
  document.querySelector('#format-empty-title').textContent =
    `添加${config.kind === 'video' ? '视频' : config.kind === 'audio' ? '音频' : '图片'}文件`
  document.querySelector('#format-pick-files').textContent =
    `＋ 添加${config.kind === 'video' ? '视频' : config.kind === 'audio' ? '音频' : '图片'}`
  formatRunButton.textContent = config.runLabel
  if (previousKind !== config.kind && formatState.inputs.length) clearFormatInputs()
  formatState.results = []
  formatState.progressByInput.clear()
  formatState.errorsByInput.clear()
  formatProgressFill.style.width = '0'
  formatStatusText.textContent = formatState.inputs.length ? '准备就绪' : '添加文件后可开始'
  renderFormatOptions()
  renderSubmenu('video')
  renderFormatFiles()
  loadFormatRuntimeStatus()
}

function addFormatInputs(files, replace = false) {
  if (replace) {
    window.api.removeFormatInputs(formatState.inputs.map((input) => input.id)).catch(() => {})
    formatState.inputs = []
  }
  const knownIds = new Set(formatState.inputs.map((input) => input.id))
  const unique = files.filter((file) => !knownIds.has(file.id))
  const available = Math.max(0, 100 - formatState.inputs.length)
  const accepted = unique.slice(0, available)
  const rejected = unique.slice(available)
  if (rejected.length) {
    window.api.removeFormatInputs(rejected.map((file) => file.id)).catch(() => {})
  }
  formatState.inputs.push(...accepted)
  formatState.results = []
  formatState.progressByInput.clear()
  formatState.errorsByInput.clear()
  formatStatusText.textContent = `已添加 ${formatState.inputs.length} 个文件`
  formatProgressFill.style.width = '0'
  renderFormatFiles()
}

async function pickFormatFiles() {
  try {
    const result = await window.api.pickFormatFiles({ kind: formatConfig().kind })
    if (result.status !== 'selected') return
    addFormatInputs(result.files)
    if (result.errors.length) showToast(`${result.errors.length} 个文件未能加入`)
  } catch (error) {
    showToast(`添加文件失败：${error.message}`)
  }
}

async function pickFormatFolder() {
  try {
    const result = await window.api.pickFormatFolder({ kind: formatConfig().kind })
    if (result.status !== 'selected') return
    addFormatInputs(result.files, true)
    if (result.truncated) showToast('文件超过 100 个，已取前 100 个')
    else if (result.errors.length) showToast(`${result.errors.length} 个文件未能加入`)
  } catch (error) {
    showToast(`读取文件夹失败：${error.message}`)
  }
}

async function clearFormatInputs() {
  const ids = formatState.inputs.map((input) => input.id)
  formatState.inputs = []
  formatState.results = []
  formatState.progressByInput.clear()
  formatState.errorsByInput.clear()
  formatState.taskId = ''
  formatProgressFill.style.width = '0'
  formatStatusText.textContent = '添加文件后可开始'
  renderFormatFiles()
  if (ids.length) await window.api.removeFormatInputs(ids).catch(() => {})
}

function currentFormatOptions() {
  return {
    target: formatOptions.querySelector('#format-target')?.value || '',
    quality: Number(formatOptions.querySelector('#format-quality')?.value),
    maxWidth: Number(formatOptions.querySelector('#format-max-width')?.value),
    audioBitrate: Number(formatOptions.querySelector('#format-audio-bitrate')?.value || 192),
    sampleRate: Number(formatOptions.querySelector('#format-sample-rate')?.value || 44100)
  }
}

async function runFormatTask() {
  if (formatState.busy || !formatState.inputs.length) return
  formatState.busy = true
  formatState.results = []
  formatState.progressByInput.clear()
  formatState.errorsByInput.clear()
  formatState.taskId = crypto.randomUUID()
  formatRunButton.textContent = '处理中…'
  formatCancelButton.hidden = false
  formatStatusText.textContent = '正在准备任务…'
  updateFormatControls()
  try {
    const response = await window.api.runFormatTask({
      taskId: formatState.taskId,
      action: state.selections.video,
      inputIds: formatState.inputs.map((input) => input.id),
      options: currentFormatOptions()
    })
    if (response.status === 'cancelled') {
      formatStatusText.textContent = '任务已取消'
      showToast('格式转换任务已取消')
    } else {
      formatState.results = response.results
      response.errors.forEach((error) => {
        formatState.errorsByInput.set(error.inputId, error.message)
      })
      formatProgressFill.style.width = '100%'
      formatStatusText.textContent = response.errors.length
        ? `完成 ${response.results.length} 个，失败 ${response.errors.length} 个`
        : `已完成 ${response.results.length} 个文件`
      showToast('格式转换任务完成')
    }
  } catch (error) {
    formatStatusText.textContent = `处理失败：${error.message}`
    showToast('格式转换失败')
  } finally {
    formatState.busy = false
    formatState.taskId = ''
    formatRunButton.textContent = formatConfig().runLabel
    formatCancelButton.hidden = true
    renderFormatFiles()
  }
}

async function cancelFormatTask() {
  if (!formatState.taskId) return
  formatCancelButton.disabled = true
  formatStatusText.textContent = '正在取消任务…'
  try {
    await window.api.cancelFormatTask(formatState.taskId)
  } finally {
    formatCancelButton.disabled = false
  }
}

async function saveFormatResults() {
  if (!formatState.results.length || formatState.saving) return
  formatState.saving = true
  formatSaveButton.disabled = true
  try {
    const response = await window.api.saveFormatResults(formatState.results.map((result) => result.id))
    if (response.status === 'saved') {
      formatStatusText.textContent = `已保存 ${response.saved} 个结果`
      showToast('格式转换结果已保存')
    }
  } catch (error) {
    showToast(`保存失败：${error.message}`)
  } finally {
    formatState.saving = false
    formatSaveButton.disabled = formatState.results.length === 0
  }
}

async function loadFormatRuntimeStatus() {
  try {
    const status = await window.api.getFormatStatus()
    formatState.ffmpegReady = status.ffmpegReady
    formatState.sharpReady = Boolean(status.sharp?.sharp)
    const ready = formatConfig().kind === 'image' ? formatState.sharpReady : formatState.ffmpegReady
    formatRuntimeState.classList.toggle('ready', ready)
    formatRuntimeState.classList.toggle('error', !ready)
    formatRuntimeState.lastChild.textContent = ready
      ? formatConfig().kind === 'image' ? `sharp ${status.sharp.sharp}` : 'FFmpeg 6.1.1 就绪'
      : formatConfig().kind === 'image' ? 'sharp 未能加载' : status.ffmpegMessage
    document.querySelector('#format-engine-name').textContent =
      formatConfig().kind === 'image' ? `sharp ${status.sharp?.sharp || ''}` : 'FFmpeg 6.1.1'
    document.querySelector('#format-engine-status').textContent =
      ready ? '本地引擎可用' : '当前环境不可用'
    updateFormatControls()
  } catch (error) {
    formatRuntimeState.classList.add('error')
    formatRuntimeState.lastChild.textContent = `引擎检查失败：${error.message}`
  }
}

document.querySelector('#format-pick-files').addEventListener('click', pickFormatFiles)
document.querySelector('#format-pick-folder').addEventListener('click', pickFormatFolder)
document.querySelector('#format-clear-inputs').addEventListener('click', clearFormatInputs)
formatFileList.addEventListener('click', async (event) => {
  const button = event.target.closest('.format-remove')
  if (!button || formatState.busy) return
  const inputId = button.dataset.inputId
  formatState.inputs = formatState.inputs.filter((input) => input.id !== inputId)
  formatState.results = formatState.results.filter((result) => result.inputId !== inputId)
  formatState.progressByInput.delete(inputId)
  formatState.errorsByInput.delete(inputId)
  renderFormatFiles()
  await window.api.removeFormatInputs([inputId]).catch(() => {})
})
formatRunButton.addEventListener('click', runFormatTask)
formatCancelButton.addEventListener('click', cancelFormatTask)
formatSaveButton.addEventListener('click', saveFormatResults)
window.api.onFormatProgress((progress) => {
  if (progress.status === 'running' && progress.taskId === formatState.taskId) {
    const overall = (progress.completed + (progress.fileProgress || 0)) / Math.max(1, progress.total)
    if (progress.inputId) {
      formatState.progressByInput.set(progress.inputId, Math.min(1, progress.fileProgress || 0))
      renderFormatFiles()
    }
    formatProgressFill.style.width = `${Math.min(100, overall * 100)}%`
    formatStatusText.textContent = `正在处理 ${Math.min(progress.completed + 1, progress.total)} / ${progress.total}${progress.name ? ` · ${progress.name}` : ''}`
  } else if (progress.status === 'saving' && formatState.saving) {
    formatStatusText.textContent = `正在保存 ${progress.completed} / ${progress.total}`
  }
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
          <button type="button" data-format="tiff">TIFF</button>
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

    const encodedFormat = format === 'tiff' ? 'png' : format
    const mimeType = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp'
    }[encodedFormat]
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
  if (normalized) {
    state.searchMatches = searchFeatures
      .filter((feature) => feature.searchable.includes(normalized))
      .sort((left, right) => {
        const score = (feature) => {
          const name = feature.name.toLowerCase()
          const group = feature.group.toLowerCase()
          if (name.startsWith(normalized)) return 0
          if (name.includes(normalized)) return 1
          if (group.includes(normalized)) return 2
          return 3
        }
        return score(left) - score(right)
      })
      .slice(0, 24)
  } else {
    const seenGroups = new Set()
    state.searchMatches = searchFeatures.filter((feature) => {
      if (seenGroups.has(feature.group)) return false
      seenGroups.add(feature.group)
      return true
    })
  }
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
setAiMode('智能抠图')
setFormatAction('视频转换')
activateModule('pdf', defaultSelections.pdf)
verifyPreloadBridge()
