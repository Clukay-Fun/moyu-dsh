import JsBarcode from 'jsbarcode'

const appLogoUrl = new URL('../../assets/logo_128.png', import.meta.url).href

document.querySelectorAll('[data-app-logo]').forEach((image) => {
  image.src = appLogoUrl
})

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
      items: [
        ['EAN-13', '13', '#e88c32'],
        ['UPC-A', 'U', '#e75551'],
        ['EAN-8', '8', '#80cbb2'],
        ['Code128', '128', '#88a2e8'],
        ['Code39', '39', '#8678d9'],
        ['ITF', 'ITF', '#59a6ae'],
        ['Auto', 'AUTO', '#737789']
      ]
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
  ['自动识别条码', '条码', 'bc', 'Auto', 'Auto UPC EAN'],
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
  searchMatches: []
}

const submenu = document.querySelector('#submenu')
const searchInput = document.querySelector('#feature-search')
const searchResults = document.querySelector('#search-results')
const toast = document.querySelector('#toast')
let toastTimer
let barcodeRenderedValue = ''

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

  if (action && submenuData[module] && (module !== 'bc' || action === 'EAN-13')) {
    state.selections[module] = action
  }

  renderSubmenu(module)

  if (module === 'pdf') {
    updatePdfState(state.selections.pdf)
  } else if (module === 'bc') {
    document.querySelector('#bc-crumb').textContent = state.selections.bc
    if (action && action !== 'EAN-13') {
      showToast(`“${action}”将在 M1b 接入，当前只支持 EAN-13`)
    }
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
  if (module === 'bc' && action !== 'EAN-13') {
    showToast(`“${action}”将在 M1b 接入，当前只支持 EAN-13`)
    return
  }

  state.selections[module] = action
  renderSubmenu(module)

  if (module === 'pdf') {
    updatePdfState(action)
  } else if (module === 'bc') {
    document.querySelector('#bc-crumb').textContent = action
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

function setBarcodeExportEnabled(enabled) {
  saveBarcodeSvgButton.disabled = !enabled
  saveBarcodePngButton.disabled = !enabled
}

function setBarcodeMessage(message, type = '') {
  barcodeMessage.textContent = message
  barcodeMessage.className = `barcode-message${type ? ` ${type}` : ''}`
  barcodeInput.classList.toggle('invalid', type === 'error')
}

function generateBarcode() {
  const value = barcodeInput.value.trim()
  barcodeSvg.replaceChildren()
  barcodeRenderedValue = ''
  setBarcodeExportEnabled(false)

  try {
    JsBarcode(barcodeSvg, value, {
      format: 'EAN13',
      width: 2.4,
      height: 110,
      margin: 18,
      textMargin: 8,
      font: 'Consolas, monospace',
      fontSize: 20,
      lineColor: '#171820',
      background: '#ffffff',
      displayValue: true
    })

    barcodeSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    barcodeRenderedValue = value
    setBarcodeExportEnabled(true)
    setBarcodeMessage('EAN-13 已生成，可保存为 SVG 或 PNG。', 'success')
    return true
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    const friendlyReason = /not a valid input|invalid input/i.test(reason)
      ? 'EAN-13 需要 12 位数字，或带正确校验位的 13 位数字。'
      : reason
    setBarcodeMessage(`无法生成：${friendlyReason}`, 'error')
    showToast('条码内容无效，请输入 12 位数字或带正确校验位的 13 位数字')
    return false
  }
}

function serializeBarcodeSvg() {
  const clone = barcodeSvg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
}

function svgToPngBytes(svgText) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()

    image.addEventListener('load', () => {
      try {
        const width = Math.max(1, Math.ceil(Number.parseFloat(barcodeSvg.getAttribute('width')) || image.naturalWidth))
        const height = Math.max(1, Math.ceil(Number.parseFloat(barcodeSvg.getAttribute('height')) || image.naturalHeight))
        const scale = 2
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        canvas.width = width * scale
        canvas.height = height * scale
        context.scale(scale, scale)
        context.drawImage(image, 0, 0, width, height)
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
  if (!barcodeRenderedValue || barcodeInput.value.trim() !== barcodeRenderedValue) {
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
      name: `EAN13-${barcodeRenderedValue}`,
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

generateBarcodeButton.addEventListener('click', generateBarcode)
barcodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') generateBarcode()
})
barcodeInput.addEventListener('input', () => {
  barcodeRenderedValue = ''
  setBarcodeExportEnabled(false)
  setBarcodeMessage('内容已修改，请重新生成。')
})
saveBarcodeSvgButton.addEventListener('click', () => saveBarcode('svg'))
saveBarcodePngButton.addEventListener('click', () => saveBarcode('png'))

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
generateBarcode()
activateModule('pdf', defaultSelections.pdf)
verifyPreloadBridge()
