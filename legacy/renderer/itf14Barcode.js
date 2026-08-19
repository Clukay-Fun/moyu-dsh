// ITF-14 生产几何引擎（GS1 一般流通）
//
// 规范来源：GS1 General Specifications 26.0.0
//   §5.12.3.2 / Table 5-47（symbol specification table 2，一般流通）
//   §5.3.2.2 / §5.3.2.4 / §5.3.2.5 / §4.14（承载框与 HRI）
//
// 与零售三码（EAN/UPC）的**根本差异**：
//   零售码每个元素都是 X 的整数倍，可按二进制模块网格逐位绘制；
//   ITF 只有窄/宽两级元素，且 GS1 目标比为 2.5:1 —— 不是整数倍，
//   因此本模块走**元素级宽度**路径，不经过模块网格。
//
// ⚠ JsBarcode 的二进制串把宽元素编码为 '111'、窄元素为 '1'，隐含 3:1。
//   3:1 属于 GS1 允许上界（2.25–3:1），并非不合规；
//   本模块把 run 还原为元素后按 2.5:1 重新计算宽度，以稳定输出**目标值**。
import ITF14Module from 'jsbarcode/bin/barcodes/ITF/ITF14.js'

const ITF14 = ITF14Module.default || ITF14Module

const MM_PER_INCH = 25.4
export const ITF14_DPI = 300

// Table 5-47：一般流通。数值不写死像素，像素由 DPI 换算。
const BASE = {
  wideRatio: 2.5, // 目标比（允许 2.25–3:1）
  barHeightMm: 31.75, // 最小条高，**不含 HRI、不含承载框**
  quietLeftX: 10,
  quietRightX: 10,
  dataDigits: 14,
  hri: {
    capHeightMm: 3.0, // 物流标签 ≥3mm，固定值
    gapToBearerMm: 1.02 // HRI 顶部与底部承载条下沿的最小间距
  }
}

// 两个**规范预设**（UI 不开放任意框厚/框形/X）
export const ITF14_PRESETS = {
  // 标签 / 数字打印（默认）：仅上下承载条，厚 2X
  label: {
    key: 'label',
    label: '标签 / 数字打印',
    xMm: 0.495,
    bearer: { mode: 'horizontal', thicknessX: 2 },
    pngNarrowPx: 6, // 目标 X 0.495mm @300DPI = 5.846px → 量化 6px
    pngWidePx: 15 // 2.5 × 6，保持精确 2.5:1
  },
  // 印版直印：四边完整框，厚固定 4.83mm；瓦楞纸直印要求 X ≥ 0.635mm
  plate: {
    key: 'plate',
    label: '印版直印',
    xMm: 0.635,
    bearer: { mode: 'frame', thicknessMm: 4.83 },
    pngNarrowPx: 8, // 目标 X 0.635mm @300DPI = 7.5px → 量化 8px
    pngWidePx: 20
  }
}

export const ITF14_DEFAULT_PRESET = 'label'

export function isItf14Type(typeName) {
  return typeName === 'ITF-14'
}

function resolvePreset(presetKey) {
  return ITF14_PRESETS[presetKey] || ITF14_PRESETS[ITF14_DEFAULT_PRESET]
}

/** 取二进制串并还原为元素序列（窄/宽），不使用模块网格。 */
export function buildItf14Elements(value) {
  const instance = new ITF14(String(value), {})
  if (!instance.valid()) throw new Error('ITF-14 需要 13 位数字，或带正确校验位的 14 位数字')

  const { data: binary, text } = instance.encode()
  const elements = []
  let index = 0
  while (index < binary.length) {
    const bit = binary[index]
    let run = 1
    while (index + run < binary.length && binary[index + run] === bit) run += 1
    // JsBarcode 编码保证 run 长度只有 1（窄）或 3（宽），条空严格交替，
    // 因此每个 run 恰为一个元素，不存在跨元素合并。
    if (run !== 1 && run !== 3) {
      throw new Error(`ITF-14 元素长度异常：${run}（应为 1 或 3）`)
    }
    elements.push({ isBar: bit === '1', wide: run === 3 })
    index += run
  }
  return { elements, text }
}

/** 计算 ITF-14 标准几何（毫米）。 */
export function computeItf14Geometry(presetKey = ITF14_DEFAULT_PRESET, value = null) {
  const preset = resolvePreset(presetKey)
  const x = preset.xMm
  const wideMm = x * BASE.wideRatio

  // 符号宽：逐元素累加（不是模块数 × X）
  let symbolWidthMm = 0
  let elements = null
  let text = ''
  if (value != null) {
    const built = buildItf14Elements(value)
    elements = built.elements
    text = built.text
    symbolWidthMm = elements.reduce((sum, el) => sum + (el.wide ? wideMm : x), 0)
  }

  const quietLeftMm = BASE.quietLeftX * x
  const quietRightMm = BASE.quietRightX * x
  const contentWidthMm = quietLeftMm + symbolWidthMm + quietRightMm

  const bearerMm =
    preset.bearer.mode === 'frame'
      ? preset.bearer.thicknessMm
      : preset.bearer.thicknessX * x

  // 印版模式左右框在静区**外侧**，标签模式无左右框
  const sideBearerMm = preset.bearer.mode === 'frame' ? bearerMm : 0
  const totalWidthMm = contentWidthMm + sideBearerMm * 2

  // 垂直：上承载条 → 条空区 → 下承载条 → 间距 → HRI
  const barTopMm = bearerMm
  const barBottomMm = barTopMm + BASE.barHeightMm
  const bottomBearerBottomMm = barBottomMm + bearerMm
  const hriTopMm = bottomBearerBottomMm + BASE.hri.gapToBearerMm
  const totalHeightMm = hriTopMm + BASE.hri.capHeightMm

  return {
    preset,
    base: BASE,
    x,
    wideMm,
    elements,
    text,
    symbolWidthMm,
    quietLeftMm,
    quietRightMm,
    contentWidthMm,
    bearerMm,
    sideBearerMm,
    symbolStartMm: sideBearerMm + quietLeftMm,
    barTopMm,
    barBottomMm,
    bottomBearerBottomMm,
    hriBaselineMm: totalHeightMm,
    widthMm: totalWidthMm,
    heightMm: totalHeightMm
  }
}

/**
 * PNG 栅格化口径。
 * X 派生量（窄/宽/静区/标签承载条）按 narrowPx 量化；
 * **绝对毫米量**（条高、印版框厚、HRI 间距）按 300 DPI 独立量化，
 * 最小值一律**向上取整**，确保物理尺寸不低于规范值。
 */
export function itf14RasterSize(presetKey = ITF14_DEFAULT_PRESET, value = null) {
  const geo = computeItf14Geometry(presetKey, value)
  const { preset } = geo
  const narrowPx = preset.pngNarrowPx
  const widePx = preset.pngWidePx
  const actualXMm = (narrowPx * MM_PER_INCH) / ITF14_DPI
  const pxPerMm = ITF14_DPI / MM_PER_INCH

  const ceilPx = (mm) => Math.ceil(mm * pxPerMm - 1e-9)

  const quietPx = BASE.quietLeftX * narrowPx
  const symbolPx = geo.elements
    ? geo.elements.reduce((sum, el) => sum + (el.wide ? widePx : narrowPx), 0)
    : 0
  const barHeightPx = ceilPx(BASE.barHeightMm)
  const bearerPx =
    preset.bearer.mode === 'frame'
      ? ceilPx(preset.bearer.thicknessMm) // 4.83mm → 58px（不可取 57）
      : preset.bearer.thicknessX * narrowPx
  const sideBearerPx = preset.bearer.mode === 'frame' ? bearerPx : 0
  const hriGapPx = ceilPx(BASE.hri.gapToBearerMm) // 1.02mm → 13px（不可取 12）
  const hriCapPx = ceilPx(BASE.hri.capHeightMm)

  const pixelWidth = symbolPx + quietPx * 2 + sideBearerPx * 2
  const pixelHeight = bearerPx * 2 + barHeightPx + hriGapPx + hriCapPx

  return {
    dpi: ITF14_DPI,
    narrowPx,
    widePx,
    ratio: widePx / narrowPx,
    actualXMm,
    nominalXMm: preset.xMm,
    pixelWidth,
    pixelHeight,
    actualWidthMm: (pixelWidth * MM_PER_INCH) / ITF14_DPI,
    nominalWidthMm: geo.widthMm,
    bearerPx,
    bearerActualMm: (bearerPx * MM_PER_INCH) / ITF14_DPI,
    hriGapPx,
    hriGapActualMm: (hriGapPx * MM_PER_INCH) / ITF14_DPI
  }
}

/** 按标准几何填充 SVG（文本仍以 <text> 写入，由 outlineBarcodeText 转路径）。 */
export function renderItf14(svgElement, value, presetKey = ITF14_DEFAULT_PRESET) {
  const geo = computeItf14Geometry(presetKey, value)
  const { preset, x, wideMm, elements, text } = geo
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

  // 承载框：上下贴住条空区；印版模式另加左右框（位于静区外侧，不侵入静区）
  rect(0, geo.barTopMm - geo.bearerMm, geo.widthMm, geo.bearerMm)
  rect(0, geo.barBottomMm, geo.widthMm, geo.bearerMm)
  if (preset.bearer.mode === 'frame') {
    const frameHeight = geo.bearerMm * 2 + geo.base.barHeightMm
    rect(0, 0, geo.sideBearerMm, frameHeight)
    rect(geo.widthMm - geo.sideBearerMm, 0, geo.sideBearerMm, frameHeight)
  }

  // 条：逐元素累加，窄 = X、宽 = 2.5X
  let cursor = geo.symbolStartMm
  for (const element of elements) {
    const width = element.wide ? wideMm : x
    if (element.isBar) rect(cursor, geo.barTopMm, width, geo.base.barHeightMm)
    cursor += width
  }

  // HRI：14 位完整、不换行、下方居中（居中为产品版式，非规范强制坐标）
  const hri = document.createElementNS(ns, 'text')
  hri.setAttribute('x', String(geo.widthMm / 2))
  hri.setAttribute('y', String(geo.hriBaselineMm))
  hri.setAttribute('text-anchor', 'middle')
  hri.setAttribute('data-cap-height', String(geo.base.hri.capHeightMm))
  hri.setAttribute('data-anchor-edge', 'center')
  hri.setAttribute('fill', '#000000')
  hri.textContent = text
  svgElement.append(hri)

  return geo
}
