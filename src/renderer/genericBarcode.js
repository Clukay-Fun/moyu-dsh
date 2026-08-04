// 通用条码生成引擎（S4 口径）
//
// ⚠ 与 retailBarcode.js / itf14Barcode.js / gs1128Barcode.js 的**定位根本不同**：
//
//   那三个模块对应 GS1 管辖的码制，GS1 General Specifications 为其规定了
//   完整的成品尺寸（X、静区、条高、放大系数），因此可以声明生产合规。
//
//   本模块覆盖的码制（Code 128 / Code 39 / ITF / Codabar / MSI / Auto）
//   由 ISO/IEC 符号规范定义**编码与符号结构**，但成品尺寸一律委托给
//   各自的**应用规范**（application specification）。脱离应用场景，
//   "Code 128 的生产标准尺寸"这个说法本身不成立。
//
//   所以本模块给出的是**产品默认值**，不是 ISO 唯一正确尺寸，
//   也不冒充任何应用规范。UI 必须明示"不作生产合规承诺"。
//
// 产品默认值来源：本项目 F-007 规范来源矩阵 S4 档，已由项目负责人拍板。
import CODE128Module from 'jsbarcode/bin/barcodes/CODE128/index.js'

const CODE128Bundle = CODE128Module.default || CODE128Module

const MM_PER_INCH = 25.4
export const GENERIC_DPI = 300

/** S4 产品默认值。任何一项都不得对外表述为规范强制值。 */
export const GENERIC_DEFAULTS = {
  tier: 'S4',
  claimsCompliance: false, // 硬性：本档永不声明生产合规
  notice: '产品默认 · 通用生成 · 不作生产合规承诺',
  basis: '本项目 F-007 规范来源矩阵 S4 档产品默认值；ISO 符号规范未规定成品尺寸，由应用规范决定',

  xMm: 0.33,
  quietLeftX: 10,
  quietRightX: 10,

  // 条高 = max(6.35mm, 15% × 符号宽)。百分比基数为**符号宽（不含静区）**。
  barHeightMinMm: 6.35,
  barHeightRatio: 0.15,

  hri: {
    // 产品版式值。2mm 参考了 GS1 对一般 HRI 的 ≥2mm 建议，
    // 但本档码制不受 GS1 管辖，故仅作取值参考，不构成合规依据。
    capHeightMm: 2.0,
    gapMm: 1.0,
    layoutSource: 'product'
  },

  // X 0.330mm @300DPI = 3.898px → 量化 4px（实际 0.3387mm）
  pngModulePx: 4
}

// 本模块当前已接入的码制。后续 Code39 / ITF / Codabar / MSI / Auto 逐个加入。
//
// ⚠ 每个码制必须声明 `model`，几何层据此**分发到不同的宽度模型**，
//   绝不能让新码制默认落进模块网格：
//
//   model: 'module'  —— 元素宽度是 X 的整数倍（Code 128 为 1–4 个模块），
//                       可按模块网格逐位绘制。
//   model: 'element' —— 只有窄/宽两级元素，宽窄比不是整数倍
//                       （Code 39 / ITF / Codabar），必须逐元素累加宽度。
//
//   元素制**只复用"元素序列渲染"这套架构**，宽窄比等参数各码制自己声明，
//   不得沿用 ITF-14 的 2.5:1（那是 GS1 一般流通的规定值，与本档无关）。
const GENERIC_SYMBOLOGIES = {
  Code128: {
    label: 'Code 128',
    model: 'module',
    encode(value) {
      const instance = new CODE128Bundle.CODE128(String(value), {})
      if (!instance.valid()) throw new Error('Code 128 输入无效')
      const { data: binary, text } = instance.encode()
      if (!binary || !binary.length) throw new Error('Code 128 编码结果为空')
      return { binary, text }
    },
    // Code 128 由编码器自动切换 Code Set A/B/C 并追加符号校验字符，
    // 本引擎不干预、也不重新实现该逻辑。
    features: ['Code Set 自动切换', '符号校验字符（编码器内建）']
  }
}

export const GENERIC_MODELS = ['module', 'element']

export function isGenericType(typeName) {
  return Object.hasOwn(GENERIC_SYMBOLOGIES, typeName)
}

export function genericSymbology(typeName) {
  const symbology = GENERIC_SYMBOLOGIES[typeName]
  if (!symbology) throw new Error(`通用引擎未接入码制：${typeName}`)
  return symbology
}

/**
 * 取符号数据。按码制声明的 `model` 分发，返回值是几何、栅格、渲染的唯一数据源。
 *
 * module 模型 → { model:'module', binary, moduleCount }
 * element 模型 → { model:'element', elements: [{ isBar, wide }], ... }
 */
export function buildGenericSymbol(typeName, value) {
  const symbology = genericSymbology(typeName)
  if (!GENERIC_MODELS.includes(symbology.model)) {
    throw new Error(`${typeName} 未声明有效的宽度模型（model）`)
  }
  const { binary, text } = symbology.encode(value)

  if (symbology.model === 'element') {
    // 元素制：把二进制 run 还原为窄/宽元素，宽窄比由码制自己声明，
    // 几何层按元素宽度累加，**不经过模块网格**。
    return { model: 'element', ...buildElementRuns(typeName, symbology, binary), text, symbology }
  }

  // 模块制自检：所有 run 必须落在 1–4 模块内，否则说明编码器输出
  // 不是模块网格，本引擎不可继续按 X 整数倍绘制。
  let index = 0
  while (index < binary.length) {
    const bit = binary[index]
    let run = 1
    while (index + run < binary.length && binary[index + run] === bit) run += 1
    if (run < 1 || run > 4) {
      throw new Error(`${typeName} 元素长度异常：${run} 模块（模块制应为 1–4）`)
    }
    index += run
  }

  return { model: 'module', binary, text, moduleCount: binary.length, symbology }
}

/** 元素制：二进制 run → 窄/宽元素序列。narrowRun/wideRun 由码制声明。 */
function buildElementRuns(typeName, symbology, binary) {
  const { narrowRun = 1, wideRun } = symbology
  if (!wideRun) throw new Error(`${typeName} 未声明 wideRun（宽元素的 run 长度）`)
  const elements = []
  let index = 0
  while (index < binary.length) {
    const bit = binary[index]
    let run = 1
    while (index + run < binary.length && binary[index + run] === bit) run += 1
    if (run !== narrowRun && run !== wideRun) {
      throw new Error(`${typeName} 元素长度异常：${run}（应为 ${narrowRun} 或 ${wideRun}）`)
    }
    elements.push({ isBar: bit === '1', wide: run === wideRun })
    index += run
  }
  return { elements, elementCount: elements.length }
}

/** 计算通用几何（毫米）。 */
export function computeGenericGeometry(typeName, value) {
  const defaults = GENERIC_DEFAULTS
  const built = buildGenericSymbol(typeName, value)
  const x = defaults.xMm

  // 符号宽按模型分别计算：模块制 = 模块数 × X；元素制 = 逐元素累加
  const symbolWidthMm =
    built.model === 'element'
      ? built.elements.reduce(
          (sum, el) => sum + (el.wide ? x * built.symbology.wideRatio : x),
          0
        )
      : built.moduleCount * x
  const quietLeftMm = defaults.quietLeftX * x
  const quietRightMm = defaults.quietRightX * x
  const widthMm = quietLeftMm + symbolWidthMm + quietRightMm

  // max(6.35mm, 15% × 符号宽)
  const ratioHeightMm = symbolWidthMm * defaults.barHeightRatio
  const barHeightMm = Math.max(defaults.barHeightMinMm, ratioHeightMm)
  const barHeightDrivenBy = ratioHeightMm > defaults.barHeightMinMm ? 'ratio' : 'minimum'

  const barTopMm = 0
  const barBottomMm = barTopMm + barHeightMm
  const hriTopMm = barBottomMm + defaults.hri.gapMm
  const heightMm = hriTopMm + defaults.hri.capHeightMm

  return {
    defaults,
    symbology: built.symbology,
    typeName,
    model: built.model,
    x,
    binary: built.binary,
    moduleCount: built.moduleCount,
    elements: built.elements ?? null,
    text: built.text,
    symbolWidthMm,
    quietLeftMm,
    quietRightMm,
    symbolStartMm: quietLeftMm,
    barHeightMm,
    ratioHeightMm,
    barHeightDrivenBy,
    barTopMm,
    barBottomMm,
    hriTopMm,
    widthMm,
    heightMm
  }
}

/** PNG 栅格化：模块按整数像素量化，绝对毫米量向上取整。 */
export function genericRasterSize(typeName, value) {
  const geo = computeGenericGeometry(typeName, value)
  const defaults = geo.defaults
  const modulePx = defaults.pngModulePx
  const pxPerMm = GENERIC_DPI / MM_PER_INCH
  const ceilPx = (mm) => Math.ceil(mm * pxPerMm - 1e-9)
  const actualXMm = (modulePx * MM_PER_INCH) / GENERIC_DPI

  const quietPx = defaults.quietLeftX * modulePx
  // 符号像素宽按模型分发。元素制若直接用 moduleCount 会得到 NaN，
  // 故此处显式分支，新码制接入时无法漏掉。
  let symbolPx
  if (geo.model === 'element') {
    const widePx = geo.symbology.pngWidePx ?? modulePx * geo.symbology.wideRatio
    if (!Number.isInteger(widePx)) {
      throw new Error(
        `${typeName} 宽元素像素宽 ${widePx} 非整数，需在码制上声明 pngWidePx`
      )
    }
    symbolPx = geo.elements.reduce((sum, el) => sum + (el.wide ? widePx : modulePx), 0)
  } else {
    symbolPx = geo.moduleCount * modulePx
  }
  // 条高按**量化后**的实际符号宽重新计算，避免 SVG 与 PNG 的 15% 基数不一致
  const actualSymbolWidthMm = (symbolPx * MM_PER_INCH) / GENERIC_DPI
  const barHeightPx = ceilPx(
    Math.max(defaults.barHeightMinMm, actualSymbolWidthMm * defaults.barHeightRatio)
  )
  const hriGapPx = ceilPx(defaults.hri.gapMm)
  const hriCapPx = ceilPx(defaults.hri.capHeightMm)

  const pixelWidth = symbolPx + quietPx * 2
  const pixelHeight = barHeightPx + hriGapPx + hriCapPx

  return {
    dpi: GENERIC_DPI,
    model: geo.model,
    modulePx,
    narrowPx: modulePx,
    widePx: geo.model === 'element'
      ? (geo.symbology.pngWidePx ?? modulePx * geo.symbology.wideRatio)
      : null,
    actualXMm,
    nominalXMm: defaults.xMm,
    pixelWidth,
    pixelHeight,
    actualWidthMm: (pixelWidth * MM_PER_INCH) / GENERIC_DPI,
    nominalWidthMm: geo.widthMm,
    actualSymbolWidthMm,
    barHeightPx,
    barHeightActualMm: (barHeightPx * MM_PER_INCH) / GENERIC_DPI,
    hriGapPx,
    hriCapPx
  }
}

/** 按通用几何填充 SVG（HRI 以 <text> 写入，由 outlineBarcodeText 转路径）。 */
export function renderGenericBarcode(svgElement, typeName, value) {
  const geo = computeGenericGeometry(typeName, value)
  const ns = 'http://www.w3.org/2000/svg'

  svgElement.replaceChildren()
  svgElement.setAttribute('xmlns', ns)
  svgElement.setAttribute('width', `${geo.widthMm}mm`)
  svgElement.setAttribute('height', `${geo.heightMm}mm`)
  svgElement.setAttribute('viewBox', `0 0 ${geo.widthMm} ${geo.heightMm}`)

  const rect = (rx, ry, rw, rh, fill = '#000000') => {
    const node = document.createElementNS(ns, 'rect')
    node.setAttribute('x', String(rx))
    node.setAttribute('y', String(ry))
    node.setAttribute('width', String(rw))
    node.setAttribute('height', String(rh))
    node.setAttribute('fill', fill)
    svgElement.append(node)
  }

  rect(0, 0, geo.widthMm, geo.heightMm, '#ffffff')

  if (geo.model === 'element') {
    // 元素制：逐元素累加宽度（窄 = X，宽 = wideRatio × X）
    let cursor = geo.symbolStartMm
    for (const element of geo.elements) {
      const width = element.wide ? geo.x * geo.symbology.wideRatio : geo.x
      if (element.isBar) rect(cursor, geo.barTopMm, width, geo.barHeightMm)
      cursor += width
    }
    appendHri(svgElement, ns, geo)
    return geo
  }

  // 模块网格：连续 '1' 合并为一条，避免相邻矩形接缝
  let index = 0
  while (index < geo.binary.length) {
    if (geo.binary[index] === '1') {
      let run = 1
      while (index + run < geo.binary.length && geo.binary[index + run] === '1') run += 1
      rect(geo.symbolStartMm + index * geo.x, geo.barTopMm, run * geo.x, geo.barHeightMm)
      index += run
    } else {
      index += 1
    }
  }

  appendHri(svgElement, ns, geo)
  return geo
}

/** HRI：下方居中（版式为产品实现值），两种模型共用。 */
function appendHri(svgElement, ns, geo) {
  const hri = document.createElementNS(ns, 'text')
  hri.setAttribute('x', String(geo.widthMm / 2))
  hri.setAttribute('y', String(geo.heightMm))
  hri.setAttribute('text-anchor', 'middle')
  hri.setAttribute('data-cap-height', String(geo.defaults.hri.capHeightMm))
  hri.setAttribute('data-anchor-edge', 'center')
  hri.setAttribute('fill', '#000000')
  hri.textContent = geo.text
  svgElement.append(hri)
}
