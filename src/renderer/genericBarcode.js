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
import CODE39Module from 'jsbarcode/bin/barcodes/CODE39/index.js'
import ITFModule from 'jsbarcode/bin/barcodes/ITF/index.js'
import CodabarModule from 'jsbarcode/bin/barcodes/codabar/index.js'

const CODE128Bundle = CODE128Module.default || CODE128Module
const CODE39 = (CODE39Module.default || CODE39Module).CODE39
// 注意：只取通用 ITF，**不碰同文件导出的 ITF14**——ITF-14 由 itf14Barcode.js
// 按 GS1 规范独立实现，两者不得混用。
const ITF = (ITFModule.default || ITFModule).ITF
const Codabar = (CodabarModule.default || CodabarModule).codabar

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

// ─────────────────────────────────────────────────────────────
// Code 39 产品默认方案（S4）
//
// 三项均为**产品默认值**，不是 ISO/IEC 16388 的唯一正确取值。
export const CODE39_DEFAULTS = {
  wideRatio: 2.5,
  mod43: false, // 校验字符在 Code 39 中是可选项，默认关闭兼容性最好
  fullAscii: false, // 开启后一个字符会展开成多个 Code 39 字符，符号明显变长
  showCheckChar: true, // Mod 43 开启时，HRI 默认显示校验字符便于与实物核对

  // 本产品支持范围，是**产品策略**，不是对 ISO/IEC 16388 的引用。
  // 不做"X 小时下限收紧"那类未经原文核对的推导——既然拿不到规范依据，
  // 就不以规范名义拒绝用户输入，只声明本产品支持到哪里。
  ratioRange: { min: 2.25, max: 3.0 },

  // 唯一真值：UI 选项由本数组生成。
  // 窄 4px 时以下比值均得整数宽像素（9/10/11/12），不产生亚像素漂移。
  selectableRatios: [2.25, 2.5, 2.75, 3.0]
}

/** 标准 43 字符集。注意 $ / + % 在 Full ASCII 模式下另作移位符使用。 */
export const CODE39_STANDARD_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%'

/** AIM Full ASCII 映射：ASCII 0–127 → 一个或两个标准 Code 39 字符。 */
const FULL_ASCII_MAP = (() => {
  const map = new Array(128)
  map[0] = '%U'
  for (let c = 1; c <= 26; c += 1) map[c] = `$${String.fromCharCode(64 + c)}` // SOH–SUB → $A–$Z
  for (let c = 27; c <= 31; c += 1) map[c] = `%${String.fromCharCode(65 + c - 27)}` // ESC–US → %A–%E
  map[32] = ' '
  const p33 = ['/A', '/B', '/C', '/D', '/E', '/F', '/G', '/H', '/I', '/J', '/K', '/L', '-', '.', '/O']
  p33.forEach((v, i) => { map[33 + i] = v }) // ! .. /
  for (let c = 48; c <= 57; c += 1) map[c] = String.fromCharCode(c) // 0–9
  map[58] = '/Z'
  const p59 = ['%F', '%G', '%H', '%I', '%J']
  p59.forEach((v, i) => { map[59 + i] = v }) // ; < = > ?
  map[64] = '%V'
  for (let c = 65; c <= 90; c += 1) map[c] = String.fromCharCode(c) // A–Z
  const p91 = ['%K', '%L', '%M', '%N', '%O']
  p91.forEach((v, i) => { map[91 + i] = v }) // [ \ ] ^ _
  map[96] = '%W'
  for (let c = 97; c <= 122; c += 1) map[c] = `+${String.fromCharCode(c - 32)}` // a–z → +A–+Z
  const p123 = ['%P', '%Q', '%R', '%S', '%T']
  p123.forEach((v, i) => { map[123 + i] = v }) // { | } ~ DEL
  return map
})()

/** 解析并校验 Code 39 选项；窄宽比超出**本产品支持范围**时抛错。 */
export function resolveCode39Options(options) {
  const d = CODE39_DEFAULTS
  // 显式传 null（调用链上"无选项"的表示法）也要落到默认值，
  // 不能依赖形参默认值——那只对 undefined 生效。
  const input = options || {}
  const wideRatio = Number(input.wideRatio ?? d.wideRatio)
  if (!Number.isFinite(wideRatio) || wideRatio < d.ratioRange.min || wideRatio > d.ratioRange.max) {
    throw new Error(
      `Code 39 窄宽比 ${input.wideRatio} 超出本产品支持范围 ` +
        `${d.ratioRange.min}–${d.ratioRange.max}`
    )
  }
  return {
    wideRatio,
    mod43: Boolean(input.mod43 ?? d.mod43),
    fullAscii: Boolean(input.fullAscii ?? d.fullAscii),
    showCheckChar: Boolean(input.showCheckChar ?? d.showCheckChar)
  }
}

/** 标准字符集校验：**绝不静默转换**，小写与越界字符各给可执行提示。 */
function assertStandardCharset(value) {
  const text = String(value)
  if (!text.length) throw new Error('Code 39 输入不能为空')
  for (const char of text) {
    if (CODE39_STANDARD_CHARSET.includes(char)) continue
    if (char >= 'a' && char <= 'z') {
      throw new Error(`Code 39 标准字符集不含小写字母「${char}」，请开启 Full ASCII 扩展`)
    }
    throw new Error(
      `Code 39 标准字符集不含「${char}」，请开启 Full ASCII 扩展（标准集：0-9 A-Z 空格 - . $ / + %）`
    )
  }
  return text
}

/** Full ASCII 展开：一个输入字符 → 一或两个标准 Code 39 字符。 */
export function toCode39FullAscii(value) {
  const text = String(value)
  if (!text.length) throw new Error('Code 39 输入不能为空')
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code > 127) throw new Error(`Full ASCII 仅支持 ASCII 字符，「${char}」超出范围`)
    out += FULL_ASCII_MAP[code]
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// 通用 ITF（Interleaved 2 of 5）产品默认方案（S4）
//
// ⚠ 与 ITF-14 的关系：ITF-14 是 GS1 管辖的**特定应用**（固定 14 位、
//   承载框、规定 X 与条高），由 itf14Barcode.js 按 GS1 GenSpecs 实现。
//   本条目是**通用 ITF**，位数不固定、无承载框、不受 GS1 管辖。
//   下面的 2.5 是 ITF 自己的产品默认值，与 ITF-14 的规范值同数不同源。
export const ITF_DEFAULTS = {
  wideRatio: 2.5, // ITF 产品默认值（不引用 ITF-14 参数）
  // 通用 ITF 固定不生成承载条/外框：需要承载框与固定 14 位的场景应使用 ITF-14。
  bearer: false,
  // 通用 ITF 不自动追加校验位，严格编码用户输入。
  // 将来若需要校验位，必须作为显式选项独立实现，不得在此隐式开启。
  checkDigit: false
}

/** ITF 输入校验：非空、纯数字、偶数位。**绝不静默补零**。 */
function assertItfInput(value) {
  const text = String(value)
  if (!text.length) throw new Error('ITF 输入不能为空')
  if (!/^[0-9]+$/.test(text)) {
    throw new Error('ITF 只接受数字，请移除非数字字符')
  }
  if (text.length % 2 !== 0) {
    // 补零会改变扫码结果，必须由用户自己决定
    throw new Error('ITF 只接受偶数位数字，请自行确认是否需要在前方补 0')
  }
  return text
}

// ─────────────────────────────────────────────────────────────
// Codabar 产品默认方案（S4）
export const CODABAR_DEFAULTS = {
  wideRatio: 2.5, // Codabar 自己的产品默认值
  start: 'A',
  stop: 'B',
  showStartStop: false, // HRI 默认只显示正文
  // 本版**不提供**校验位：Codabar 的 Mod 16 是可选且未标准化的。
  // 将来若需要，必须作为显式选项单独实现，不得改变现有默认输出。
  checkDigit: false,

  // 起止符唯一真值。别名仅用于 UI 标注，编码与参数报告一律用 A–D。
  startStopChars: [
    { value: 'A', alias: 'T' },
    { value: 'B', alias: 'N' },
    { value: 'C', alias: '*' },
    { value: 'D', alias: 'E' }
  ],
  // 正文字符集：不含 A–D（那是起止符，写进正文会产生歧义）
  payloadCharset: '0123456789-$:./+'
}

/** 解析 Codabar 选项；起止符必须是 A–D。 */
export function resolveCodabarOptions(options) {
  const d = CODABAR_DEFAULTS
  const input = options || {}
  const valid = d.startStopChars.map((c) => c.value)
  const start = String(input.start ?? d.start).toUpperCase()
  const stop = String(input.stop ?? d.stop).toUpperCase()
  for (const [name, char] of [['起始符', start], ['终止符', stop]]) {
    if (!valid.includes(char)) {
      throw new Error(`Codabar ${name}必须是 ${valid.join(' / ')} 之一，收到「${char}」`)
    }
  }
  return {
    start,
    stop,
    showStartStop: Boolean(input.showStartStop ?? d.showStartStop),
    wideRatio: d.wideRatio
  }
}

/** Codabar 正文校验：只接受 0-9 - $ : . + /，**A–D 必须走起止符选项**。 */
function assertCodabarPayload(value) {
  const text = String(value)
  if (!text.length) throw new Error('Codabar 正文不能为空')
  for (const char of text) {
    if (CODABAR_DEFAULTS.payloadCharset.includes(char)) continue
    const upper = char.toUpperCase()
    if (['A', 'B', 'C', 'D'].includes(upper)) {
      throw new Error(
        `Codabar 正文不能包含起止符「${char}」，请用"起始符/终止符"选项设置`
      )
    }
    throw new Error(
      `Codabar 正文不支持「${char}」（可用：0-9 - $ : . + /）`
    )
  }
  return text
}

// 本模块当前已接入的码制。后续 MSI / Auto 逐个加入。
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
  },

  Code39: {
    label: 'Code 39',
    // 元素制：只有窄/宽两级，宽窄比可调且非整数倍 → 逐元素累加宽度。
    // JsBarcode 的二进制把宽元素写成 '111'（隐含 3:1），本引擎把 run 还原成
    // 元素后按**本码制自己声明的** wideRatio 重算宽度。
    // 架构与 ITF-14 相同，但 2.5 是 Code 39 的产品默认值，与 ITF-14 的规范值无关。
    model: 'element',
    narrowRun: 1,
    wideRun: 3,
    wideRatio: CODE39_DEFAULTS.wideRatio,
    optionsKey: 'code39',
    encode(value, options) {
      const opts = resolveCode39Options(options)
      // 先按所选字符集校验/展开，**不把原值直接丢给编码器**——
      // JsBarcode 会把小写静默转成大写，那会让实物与用户输入不一致。
      const encodedValue = opts.fullAscii
        ? toCode39FullAscii(value)
        : assertStandardCharset(value)
      const instance = new CODE39(encodedValue, { mod43: opts.mod43 })
      if (!instance.valid()) throw new Error('Code 39 输入无效')
      const { data: binary, text: encoderText } = instance.encode()
      if (!binary || !binary.length) throw new Error('Code 39 编码结果为空')
      // mod43 时编码器把校验字符追加在 text 末尾
      const checkChar = opts.mod43 ? encoderText.slice(-1) : null
      // HRI 显示**用户原始数据**（不显示起止符 *，不显示 Full ASCII 展开结果）；
      // 校验字符默认显示，便于实物与编码内容核对。
      const hriText = String(value) + (opts.mod43 && opts.showCheckChar ? checkChar : '')
      return { binary, text: hriText, checkChar, encodedValue, resolved: opts, wideRatio: opts.wideRatio }
    },
    features: ['标准 43 字符集', 'Mod 43 可选', 'Full ASCII 可选']
  },

  ITF: {
    label: 'ITF（Interleaved 2 of 5）',
    model: 'element',
    narrowRun: 1,
    wideRun: 3,
    wideRatio: ITF_DEFAULTS.wideRatio,
    encode(value) {
      // 先自校验：JsBarcode 的 valid() 虽然也拒奇数位，但错误信息不可执行，
      // 且不保证将来不改行为。位数/字符判据由本模块自己把关。
      const text = assertItfInput(value)
      const instance = new ITF(text, {})
      if (!instance.valid()) throw new Error('ITF 输入无效')
      const { data: binary, text: encoderText } = instance.encode()
      if (!binary || !binary.length) throw new Error('ITF 编码结果为空')
      // 兜底：编码器若擅自补零或加校验位，此处必须炸出来而不是静默出图
      if (encoderText !== text) {
        throw new Error(`ITF 编码结果与输入不一致（${encoderText} ≠ ${text}）`)
      }
      return { binary, text, wideRatio: ITF_DEFAULTS.wideRatio }
    },
    features: ['偶数位数字', '不补零', '不追加校验位', '无承载条']
  },

  Codabar: {
    label: 'Codabar',
    model: 'element',
    narrowRun: 1,
    // ⚠ 此编码器的二进制用 run=2 表示宽元素（不是 Code39/ITF 的 3）。
    //   这只是二进制表示，绘制宽度仍按本码制声明的 wideRatio。
    wideRun: 2,
    wideRatio: CODABAR_DEFAULTS.wideRatio,
    encode(value, options) {
      const opts = resolveCodabarOptions(options)
      // 裸正文会被 JsBarcode 静默补成 A…A，因此**必须由产品显式拼接**，
      // 不把正文直接交给编码器。
      const payload = assertCodabarPayload(value)
      const composed = `${opts.start}${payload}${opts.stop}`
      const instance = new Codabar(composed, {})
      if (!instance.valid()) throw new Error('Codabar 输入无效')
      const { data: binary, text: encoderText } = instance.encode()
      if (!binary || !binary.length) throw new Error('Codabar 编码结果为空')
      // 编码器的 text 会剥掉起止符，只剩正文；据此确认正文未被改动。
      if (encoderText !== payload) {
        throw new Error(`Codabar 正文被编码器改动（${encoderText} ≠ ${payload}）`)
      }
      // HRI：默认只显示正文；开启后显示完整规范字符（A–D，不用别名）
      const hriText = opts.showStartStop ? composed : payload
      return {
        binary,
        text: hriText,
        payload,
        composed,
        resolved: opts,
        wideRatio: opts.wideRatio
      }
    },
    features: ['起止符可选 A–D', '不附加校验字符', '无承载条']
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
export function buildGenericSymbol(typeName, value, options = null) {
  const symbology = genericSymbology(typeName)
  if (!GENERIC_MODELS.includes(symbology.model)) {
    throw new Error(`${typeName} 未声明有效的宽度模型（model）`)
  }
  const encoded = symbology.encode(value, options)
  const { binary, text } = encoded

  if (symbology.model === 'element') {
    // 元素制：把二进制 run 还原为窄/宽元素，宽窄比由码制自己声明，
    // 几何层按元素宽度累加，**不经过模块网格**。
    return {
      model: 'element',
      binary,
      ...buildElementRuns(typeName, symbology, binary),
      text,
      symbology,
      // 实际生效的宽窄比来自**解析后的选项**，不是码制上的默认值，
      // 否则用户改了比例，几何仍按默认值算。
      wideRatio: encoded.wideRatio ?? symbology.wideRatio,
      resolved: encoded.resolved ?? null,
      checkChar: encoded.checkChar ?? null,
      encodedValue: encoded.encodedValue ?? null,
      payload: encoded.payload ?? null,
      composed: encoded.composed ?? null
    }
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

  return { model: 'module', binary, text, moduleCount: binary.length, symbology, resolved: encoded.resolved ?? null }
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
export function computeGenericGeometry(typeName, value, options = null) {
  const defaults = GENERIC_DEFAULTS
  const built = buildGenericSymbol(typeName, value, options)
  const x = defaults.xMm

  // 符号宽按模型分别计算：模块制 = 模块数 × X；元素制 = 逐元素累加
  const symbolWidthMm =
    built.model === 'element'
      ? built.elements.reduce((sum, el) => sum + (el.wide ? x * built.wideRatio : x), 0)
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
    wideRatio: built.wideRatio ?? null,
    resolved: built.resolved ?? null,
    checkChar: built.checkChar ?? null,
    encodedValue: built.encodedValue ?? null,
    payload: built.payload ?? null,
    composed: built.composed ?? null,
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
export function genericRasterSize(typeName, value, options = null) {
  const geo = computeGenericGeometry(typeName, value, options)
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
    const widePx = geo.symbology.pngWidePx ?? modulePx * geo.wideRatio
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
      ? (geo.symbology.pngWidePx ?? modulePx * geo.wideRatio)
      : null,
    wideRatio: geo.wideRatio,
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
export function renderGenericBarcode(svgElement, typeName, value, options = null) {
  const geo = computeGenericGeometry(typeName, value, options)
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
      const width = element.wide ? geo.x * geo.wideRatio : geo.x
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
