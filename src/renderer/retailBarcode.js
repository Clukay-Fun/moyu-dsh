// GS1 零售条码几何引擎（生产合规）
//
// 规范来源：GS1 General Specifications 26.0.0
//   §5.12.3.1 / Table 5-44（一般零售 POS 消费品包装）
//   §5.2.3.1 标称尺寸 · §5.2.3.2 符号高度 · §5.2.3.3 X-dimension
//   §5.2.3.4 静区 · §5.2.5 HRI
//
// 设计要点：
//   1. JsBarcode 只作编码器（取 95 位模块串），不参与任何布局；
//   2. 唯一几何真值以毫米表达，SVG viewBox 即 mm 坐标系；
//   3. 本模块不暴露任何用户可调参数，Factor 固定 100%。
//
// ⚠ 深层导入：jsbarcode 内部路径，非公开稳定 API，版本锁死 3.12.3。
//   文件末尾为 `exports.default = UPC`（CommonJS + __esModule），
//   直接默认导入在 Vite ESM interop 下会拿到命名空间对象，必须解包。
import UPCModule from 'jsbarcode/bin/barcodes/EAN_UPC/UPC.js'

const UPC = UPCModule.default || UPCModule


// GS1 GenSpecs 26.0.0 §5.2.3.1 / Table 5-10：字符 1/2/7/8 的条空补偿。
// 数值为 **X/13**（不写死 0.025mm——那只是 X=0.330mm 时的近似值）。
//   Number Set A   ：1,2 → 条 -X/13、空 +X/13 ； 7,8 → 条 +X/13、空 -X/13
//   Number Set B/C ：符号相反
// 每字符含 2 条 2 空，补偿总和为 0，字符总宽恒为 7X。
// 只作用于编码字符，不动护栏、静区与 HRI。属规范内置补偿，非用户可调 BWR。
const TABLE_5_10_BAR_SIGN = {
  A: { 1: -1, 2: -1, 7: 1, 8: 1 },
  BC: { 1: 1, 2: 1, 7: -1, 8: -1 }
}

// Table 5-44：一般零售 POS。Factor 固定 100%，取标称 X。
const RETAIL_SPECS = {
  'UPC-A': {
    encoder: (value) => new UPC(value, { flat: true }),
    xDimensionMm: 0.33,
    dataModules: 95,
    quietLeftX: 9,
    quietRightX: 9,
    barHeightMm: 22.85,
    guardExtendX: 5,
    // 分段：护栏不补偿；编码字符按 Table 5-10 补偿。
    // 延伸下沿者：三处护栏 + UPC-A 首尾符号字符（§5.2.3.2）。
    segments: (text) => [
      { start: 0, count: 3, kind: 'guard', extended: true },
      ...Array.from({ length: 6 }, (_, k) => ({
        start: 3 + k * 7,
        count: 7,
        kind: 'char',
        digit: text[k],
        numberSet: 'A',
        extended: k === 0
      })),
      { start: 45, count: 5, kind: 'guard', extended: true },
      ...Array.from({ length: 6 }, (_, k) => ({
        start: 50 + k * 7,
        count: 7,
        kind: 'char',
        digit: text[6 + k],
        numberSet: 'BC',
        extended: k === 5
      })),
      { start: 92, count: 3, kind: 'guard', extended: true }
    ],
    hri: {
      gapX: 1, // 数字顶部与普通条底部间隔（规范下限 0.5X，取 1X）
      capHeightMm: 2.75, // 数字**实际**字形高度（非 em size）；≥2mm。22.85 + 0.33 + 2.75 = 25.93mm 总高
      // §5.2.5：首尾数字最大**墨宽** 4X，超出则整体等比缩小；
      // 首位数字右边缘位于左护栏左侧 5X，末位数字左边缘位于右护栏右侧 5X。
      // 自洽：4X(数字) + 5X(间隙) = 9X = 静区宽度，恰好填满。
      outsideMaxInkWidthX: 4,
      outsideEdgeGapX: 5,
      // 中间数字：左侧取符号字符 1–5，右侧取符号字符 0–4（首尾数字在外）
      leftCharIndexes: [1, 2, 3, 4, 5],
      rightCharIndexes: [0, 1, 2, 3, 4]
    }
  }
}

export const RETAIL_TYPES = Object.keys(RETAIL_SPECS)

export function isRetailType(typeName) {
  return Object.hasOwn(RETAIL_SPECS, typeName)
}

/** 取纯条空结构（95 位模块串），不含任何布局信息。 */
export function encodeRetailModules(typeName, value) {
  const spec = RETAIL_SPECS[typeName]
  if (!spec) throw new Error(`${typeName} 不是零售合规码制`)

  const instance = spec.encoder(value)
  if (!instance.valid()) throw new Error('编码内容不符合该码制要求')

  const { data, text } = instance.encode()
  if (data.length !== spec.dataModules) {
    throw new Error(`模块数异常：得到 ${data.length}，应为 ${spec.dataModules}`)
  }

  return { modules: data, text }
}

/** 计算该码制的标准几何（毫米）。 */
export function computeRetailGeometry(typeName) {
  const spec = RETAIL_SPECS[typeName]
  if (!spec) throw new Error(`${typeName} 不是零售合规码制`)

  const x = spec.xDimensionMm
  const totalModules = spec.quietLeftX + spec.dataModules + spec.quietRightX
  const symbolStartMm = spec.quietLeftX * x
  const barBottomMm = spec.barHeightMm
  const guardBottomMm = barBottomMm + spec.guardExtendX * x
  const hriTopMm = barBottomMm + spec.hri.gapX * x
  const hriBaselineMm = hriTopMm + spec.hri.capHeightMm

  return {
    spec,
    x,
    totalModules,
    widthMm: totalModules * x,
    heightMm: hriBaselineMm,
    symbolStartMm,
    barBottomMm,
    guardBottomMm,
    hriBaselineMm
  }
}

/**
 * 逐段生成条矩形。字符段按 Table 5-10 补偿条空宽度；
 * 补偿只改元素边缘，字符总宽恒为 7X，故段边界始终对齐整数模块。
 * 坐标保留小数，不做逐段取整（栅格化时再由整体等比缩放处理）。
 */
export function buildBars(spec, modules, text, x, symbolStartMm, barBottomMm, guardBottomMm) {
  const bars = []

  for (const segment of spec.segments(text)) {
    let cursor = symbolStartMm + segment.start * x
    const sign =
      segment.kind === 'char' ? TABLE_5_10_BAR_SIGN[segment.numberSet]?.[segment.digit] ?? 0 : 0
    const barDelta = (sign * x) / 13
    const spaceDelta = -barDelta
    const slice = modules.slice(segment.start, segment.start + segment.count)

    let index = 0
    while (index < slice.length) {
      const bit = slice[index]
      let run = 1
      while (index + run < slice.length && slice[index + run] === bit) run += 1

      const isBar = bit === '1'
      const width = run * x + (isBar ? barDelta : spaceDelta)
      if (isBar) {
        bars.push({
          x: cursor,
          width,
          height: segment.extended ? guardBottomMm : barBottomMm
        })
      }
      cursor += width
      index += run
    }
  }

  return bars
}

/**
 * 按标准几何填充 SVG 元素。
 * 文本以 <text> 写入（含 font-size，单位与 viewBox 一致即 mm），
 * 由调用方的 outlineBarcodeText() 统一转为路径。
 */
export function renderRetailBarcode(svgElement, typeName, value) {
  const { modules, text } = encodeRetailModules(typeName, value)
  const geometry = computeRetailGeometry(typeName)
  const { spec, x, widthMm, heightMm, symbolStartMm, barBottomMm, guardBottomMm, hriBaselineMm } =
    geometry

  const svgNs = 'http://www.w3.org/2000/svg'
  svgElement.replaceChildren()
  svgElement.setAttribute('xmlns', svgNs)
  svgElement.setAttribute('width', `${widthMm}mm`)
  svgElement.setAttribute('height', `${heightMm}mm`)
  svgElement.setAttribute('viewBox', `0 0 ${widthMm} ${heightMm}`)

  const background = document.createElementNS(svgNs, 'rect')
  background.setAttribute('x', '0')
  background.setAttribute('y', '0')
  background.setAttribute('width', String(widthMm))
  background.setAttribute('height', String(heightMm))
  background.setAttribute('fill', '#ffffff')
  svgElement.append(background)

  // 条：逐段生成（含 Table 5-10 补偿）
  for (const bar of buildBars(spec, modules, text, x, symbolStartMm, barBottomMm, guardBottomMm)) {
    const rect = document.createElementNS(svgNs, 'rect')
    rect.setAttribute('x', String(bar.x))
    rect.setAttribute('y', '0')
    rect.setAttribute('width', String(bar.width))
    rect.setAttribute('height', String(bar.height))
    rect.setAttribute('fill', '#000000')
    svgElement.append(rect)
  }

  // HRI
  const digits = [...text]
  const addDigit = (content, xMm, edge) => {
    const node = document.createElementNS(svgNs, 'text')
    node.setAttribute('x', String(xMm))
    node.setAttribute('y', String(hriBaselineMm))
    node.setAttribute('text-anchor', 'middle')
    // 写入目标**字形高度**而非 em size：opentype 的 fontSize 是 em，
    // OCR-B 数字高度仅约 0.573em，直接用 2.75 会得到 1.58mm（不合规）。
    // 由 outlineBarcodeText() 按字体 metrics 反算 em。
    node.setAttribute('data-cap-height', String(spec.hri.capHeightMm))
    node.setAttribute('fill', '#000000')
    // 全部按可见墨迹边缘定位：中间数字居中，首尾数字按左/右边缘锚定。
    node.setAttribute('data-anchor-edge', edge || 'center')
    if (edge) {
      node.setAttribute('data-max-ink-width', String(spec.hri.outsideMaxInkWidthX * x))
    }
    node.textContent = content
    svgElement.append(node)
  }

  const charCenterMm = (charIndex, dataStartModule) =>
    symbolStartMm + (dataStartModule + charIndex * 7 + 3.5) * x

  // 首位：右边缘位于左护栏左侧 5X
  addDigit(digits[0], symbolStartMm - spec.hri.outsideEdgeGapX * x, 'right')

  // 左半 5 位（符号字符 1–5，数据区起始模块 3）
  spec.hri.leftCharIndexes.forEach((charIndex, offset) => {
    addDigit(digits[offset + 1], charCenterMm(charIndex, 3))
  })

  // 右半 5 位（符号字符 0–4，数据区起始模块 50）
  spec.hri.rightCharIndexes.forEach((charIndex, offset) => {
    addDigit(digits[offset + 6], charCenterMm(charIndex, 50))
  })

  // 末位：左边缘位于右护栏右侧 5X
  addDigit(
    digits[digits.length - 1],
    symbolStartMm + spec.dataModules * x + spec.hri.outsideEdgeGapX * x,
    'left'
  )

  return geometry
}
