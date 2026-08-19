// GS1-128 · AI 语法校验（GS1 官方 Syntax Engine）
//
// 依赖：gs1encoder@1.4.1（Apache-2.0，JS + WebAssembly）
//   · 使用包内嵌固定 AI 表，**不在运行时下载 Dictionary**；
//   · 浏览器/Electron renderer 环境应省略文件路径参数，由内嵌表工作。
//
// FNC1 映射约定（Spike 已闭环验证）：
//   dataStr 开头的 '^' **不传给 JsBarcode**（由 ean128:true 自行添加首个 FNC1）；
//   中间的 '^' 转成 String.fromCharCode(207)。
export const GS1_128_FNC1 = String.fromCharCode(207)

let enginePromise = null

/** 懒加载并全局初始化一次（WASM 实例复用）。 */
export async function getGs1Encoder() {
  if (!enginePromise) {
    enginePromise = import('gs1encoder').then(({ GS1encoder }) => GS1encoder.create())
  }
  return enginePromise
}

/** 校验 AI 数据串，返回规范化数据与 HRI；失败抛出带定位信息的错误。 */
export async function validateGs1128(aiDataStr) {
  const encoder = await getGs1Encoder()
  const { GS1encoder } = await import('gs1encoder')
  encoder.sym = GS1encoder.symbology.GS1_128_CCA
  try {
    encoder.aiDataStr = aiDataStr
  } catch (error) {
    const detail = encoder.errMarkup || encoder.errMsg || String(error)
    throw new Error(`GS1-128 AI 语法错误：${detail}`)
  }
  return { dataStr: encoder.dataStr, hri: encoder.hri }
}

/** 规范化数据串 → JsBarcode 输入（首个 FNC1 交给 ean128，中间 FNC1 用 207）。 */
export function toJsBarcodeInput(dataStr) {
  const body = dataStr.startsWith('^') ? dataStr.slice(1) : dataStr
  return body.split('^').join(GS1_128_FNC1)
}

/**
 * 异步准备：AI 语法校验 → 模块串。
 * 返回值是后续所有同步几何/渲染的**唯一数据源**，
 * 保证预览、PNG、批量、剪贴板、Photoshop、Illustrator 六类消费者同源。
 */
export async function prepareGs1128(aiDataStr) {
  const { dataStr, hri } = await validateGs1128(aiDataStr)
  const { binary, moduleCount, jsInput } = await buildGs1128Modules(dataStr)
  return { dataStr, hri, binary, moduleCount, jsInput }
}

// ─────────────────────────────────────────────────────────────
// 生产几何（GS1 一般流通）
//
// 规范来源：GS1 General Specifications 26.0.0
//   §5.12.3.2 / Table 5-47（symbol specification table 2，一般流通）
//
// 与 ITF-14 的**根本差异**：ITF 只有窄/宽两级元素且比值 2.5:1（非整数倍），
// 必须走元素级路径；Code 128 每个元素都是 1–4 个模块，**是 X 的整数倍**，
// 因此 GS1-128 与零售三码一样走**模块网格**路径。
const MM_PER_INCH = 25.4
export const GS1_128_DPI = 300

export const GS1_128_SPEC = {
  source: 'GS1 GenSpecs 26.0.0 · §5.12.3.2 · Table 5-47（一般流通）· §5.4.4.3（符号上限）',
  xNominalMm: 0.495, // 目标 X
  xMinMm: 0.495,
  xMaxMm: 1.016,
  quietLeftX: 10,
  quietRightX: 10,
  barHeightMm: 31.75, // 最小条高，不含 HRI

  // §5.4.4.3 规定了**两个互相独立**的符号上限，必须分别检查：
  //   ① 物理长度 165.10mm（6.5 in），**含左右静区**；
  //   ② 数据字符数 48 个。
  maxSymbolLengthMm: 165.1,
  maxLengthIncludesQuietZones: true, // 已核定：含静区
  maxDataCharacters: 48,
  // 数据字符计数口径：包含 AI 与**中间分隔 FNC1**；
  // 不含起始符、开头 FNC1、符号校验符、停止符。
  // 即 dataStr 去掉开头 '^' 后的字符数（中间每个 '^' 记 1 个）。

  hri: {
    // 字高有规范依据：GS1 一般 HRI 建议 ≥2mm；GS1 物流标签要求 ≥3mm。
    // 取 3mm 同时满足两者。
    capHeightMm: 3.0,
    capHeightSource: 'GS1 一般 HRI ≥2mm 建议；GS1 物流标签 ≥3mm 要求',
    // 以下两项**仍属产品版式值**，规范未固定。
    gapMm: 1.02,
    lineGapMm: 1.0,
    layoutSource: 'product'
  },
  pngModulePx: 6 // X 0.495mm @300DPI = 5.846px → 量化 6px（与 ITF-14 标签预设同源）
}

/**
 * 数据字符计数（§5.4.4.3 口径）。
 * 含 AI 与中间分隔 FNC1；不含起始符、开头 FNC1、校验符、停止符。
 */
export function gs1128DataCharCount(dataStr) {
  if (!dataStr) return 0
  return (dataStr.startsWith('^') ? dataStr.slice(1) : dataStr).length
}

export function isGs1128Type(typeName) {
  return typeName === 'GS1-128'
}

/** 取 Code 128 二进制模块串（ean128:true 负责首个 FNC1 与 Start C 等）。 */
export async function buildGs1128Modules(dataStr) {
  const CODE128Module = await import('jsbarcode/bin/barcodes/CODE128/index.js')
  const mod = CODE128Module.default || CODE128Module
  const CODE128 = mod.CODE128
  const input = toJsBarcodeInput(dataStr)
  const instance = new CODE128(input, { ean128: true })
  if (!instance.valid()) throw new Error('GS1-128 无法编码该数据串')
  const { data: binary } = instance.encode()
  if (!binary || !binary.length) throw new Error('GS1-128 编码结果为空')
  return { binary, moduleCount: binary.length, jsInput: input }
}

/**
 * 计算 GS1-128 标准几何（毫米）。
 * @param {{dataStr: string, hri: string[], binary: string}} validated 已通过 Syntax Engine 校验的结果
 */
export function computeGs1128Geometry(validated) {
  const spec = GS1_128_SPEC
  const x = spec.xNominalMm
  const binary = validated?.binary || ''
  const moduleCount = binary.length

  const symbolWidthMm = moduleCount * x
  const quietLeftMm = spec.quietLeftX * x
  const quietRightMm = spec.quietRightX * x
  const widthMm = quietLeftMm + symbolWidthMm + quietRightMm

  // 上限①：物理长度（含静区）
  const measuredLengthMm = spec.maxLengthIncludesQuietZones ? widthMm : symbolWidthMm
  const overLength = moduleCount > 0 && measuredLengthMm > spec.maxSymbolLengthMm + 1e-9

  // 上限②：数据字符数。与长度上限**各自独立判定**，不互相short-circuit。
  const dataCharCount = gs1128DataCharCount(validated?.dataStr)
  const overCharacters = dataCharCount > spec.maxDataCharacters

  // HRI：**直接使用 Syntax Engine 返回的行**，不自行解析括号 AI。
  const hriLines = Array.isArray(validated?.hri) ? validated.hri.slice() : []
  const hriBlockMm = hriLines.length
    ? hriLines.length * spec.hri.capHeightMm + (hriLines.length - 1) * spec.hri.lineGapMm
    : 0

  const barTopMm = 0
  const barBottomMm = barTopMm + spec.barHeightMm
  const hriTopMm = barBottomMm + (hriLines.length ? spec.hri.gapMm : 0)
  const heightMm = hriTopMm + hriBlockMm

  return {
    spec,
    x,
    binary,
    moduleCount,
    dataStr: validated?.dataStr || '',
    hriLines,
    symbolWidthMm,
    quietLeftMm,
    quietRightMm,
    symbolStartMm: quietLeftMm,
    measuredLengthMm,
    overLength,
    dataCharCount,
    overCharacters,
    barTopMm,
    barBottomMm,
    hriTopMm,
    widthMm,
    heightMm
  }
}

/** PNG 栅格化口径：模块按整数像素量化，绝对毫米量向上取整。 */
export function gs1128RasterSize(validated) {
  const geo = computeGs1128Geometry(validated)
  const spec = geo.spec
  const modulePx = spec.pngModulePx
  const pxPerMm = GS1_128_DPI / MM_PER_INCH
  const ceilPx = (mm) => Math.ceil(mm * pxPerMm - 1e-9)
  const actualXMm = (modulePx * MM_PER_INCH) / GS1_128_DPI

  const quietPx = spec.quietLeftX * modulePx
  const symbolPx = geo.moduleCount * modulePx
  const barHeightPx = ceilPx(spec.barHeightMm)
  const hriGapPx = geo.hriLines.length ? ceilPx(spec.hri.gapMm) : 0
  const hriCapPx = ceilPx(spec.hri.capHeightMm)
  const lineGapPx = ceilPx(spec.hri.lineGapMm)
  const hriBlockPx = geo.hriLines.length
    ? geo.hriLines.length * hriCapPx + (geo.hriLines.length - 1) * lineGapPx
    : 0

  const pixelWidth = symbolPx + quietPx * 2
  const pixelHeight = barHeightPx + hriGapPx + hriBlockPx

  return {
    dpi: GS1_128_DPI,
    modulePx,
    actualXMm,
    nominalXMm: spec.xNominalMm,
    pixelWidth,
    pixelHeight,
    actualWidthMm: (pixelWidth * MM_PER_INCH) / GS1_128_DPI,
    nominalWidthMm: geo.widthMm,
    barHeightPx,
    barHeightActualMm: (barHeightPx * MM_PER_INCH) / GS1_128_DPI,
    hriGapPx,
    overLength: geo.overLength,
    overCharacters: geo.overCharacters
  }
}

/** 按标准几何填充 SVG（文本以 <text> 写入，由 outlineBarcodeText 转路径）。 */
export function renderGs1128(svgElement, validated) {
  const geo = computeGs1128Geometry(validated)
  // 字符上限**先于**长度上限报错：49 个数据字符在数学上必然 ≥321 模块
  // （49 为奇数，Code C 无法全配对，至少 26 个符号字符）= 168.79mm > 165.10mm，
  // 两者必同时触发；此时"字符数超限"是更可执行的提示。
  if (geo.overCharacters) {
    throw new Error(
      `GS1-128 数据字符 ${geo.dataCharCount} 个，超过上限 ${geo.spec.maxDataCharacters} 个，请拆分数据`
    )
  }
  if (geo.overLength) {
    throw new Error(
      `GS1-128 符号长度 ${geo.measuredLengthMm.toFixed(2)} mm 超过上限 ${geo.spec.maxSymbolLengthMm} mm（含静区），请拆分数据`
    )
  }
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

  // 模块网格：连续 '1' 合并为一条，避免相邻矩形接缝
  let index = 0
  while (index < geo.binary.length) {
    if (geo.binary[index] === '1') {
      let run = 1
      while (index + run < geo.binary.length && geo.binary[index + run] === '1') run += 1
      rect(geo.symbolStartMm + index * geo.x, geo.barTopMm, run * geo.x, geo.spec.barHeightMm)
      index += run
    } else {
      index += 1
    }
  }

  // HRI：逐行使用 Syntax Engine 返回的内容，一行一个 AI 单元，永不溢出符号宽度
  geo.hriLines.forEach((line, lineIndex) => {
    const baseline =
      geo.hriTopMm +
      (lineIndex + 1) * geo.spec.hri.capHeightMm +
      lineIndex * geo.spec.hri.lineGapMm
    const node = document.createElementNS(ns, 'text')
    node.setAttribute('x', String(geo.widthMm / 2))
    node.setAttribute('y', String(baseline))
    node.setAttribute('text-anchor', 'middle')
    node.setAttribute('data-cap-height', String(geo.spec.hri.capHeightMm))
    node.setAttribute('data-anchor-edge', 'center')
    node.setAttribute('fill', '#000000')
    node.textContent = line
    svgElement.append(node)
  })

  return geo
}
