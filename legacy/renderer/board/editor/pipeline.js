// 全屏图片编辑器 · 像素管线（U4）
//
// 唯一的工具实现。双击画布图片与截图即时标注都调用这里，
// 保证同一工具在两个入口产出**逐像素一致**的结果。
//
// 调色核心 applyAdjustmentPixels 是纯函数（只依赖 ImageData 的数据数组），
// 可在 Node 侧用普通 Uint8ClampedArray 直接测。

import { ADJUSTMENT_KEYS, ADJUSTMENT_DEFAULTS } from './session.js'

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/**
 * 8 项调色，就地修改像素数组。
 *
 * ⚠ 这是旧图片模块 applyImageAdjustmentPixels 的**逐行移植**，
 *   系数、通道权重、色调分支全部保持原值。
 *
 * 为什么必须原样搬而不是重写一套：调色是用户已经在用的能力，
 * 换算法会让"同样拉到 +30 暖色"出来的画面和以前不一样。
 * U4 是把编辑器统一到一处，不是趁机改视觉。
 */
export function applyAdjustmentPixels(data, width, height, adjustments = {}) {
  const a = { ...ADJUSTMENT_DEFAULTS, ...adjustments }
  for (const key of Object.keys(adjustments)) {
    if (!ADJUSTMENT_KEYS.includes(key)) throw new Error(`未知调色参数：${key}`)
  }
  // 全部为 0 时直接返回，避免无谓的逐像素运算
  if (ADJUSTMENT_KEYS.every((k) => a[k] === 0)) return data

  // 清晰度是 unsharp mask，需要未经调色的原始缓冲做邻域参考
  const original = a.clarity ? new Uint8ClampedArray(data) : null
  const brightnessOffset = a.brightness / 100 * 64
  const exposureFactor = 2 ** (a.exposure / 100)
  const contrastValue = a.contrast / 100 * 180
  const contrastFactor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue))
  const saturationFactor = 1 + a.saturation / 100
  const warmth = a.warmth / 100 * 42
  const tint = a.tint / 100

  for (let i = 0; i < data.length; i += 4) {
    let red = (data[i] + brightnessOffset) * exposureFactor
    let green = (data[i + 1] + brightnessOffset) * exposureFactor
    let blue = (data[i + 2] + brightnessOffset) * exposureFactor

    // 阴影：权重按亮度平方衰减，只抬暗部
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
    const shadowWeight = (1 - Math.min(1, luminance / 255)) ** 2
    const shadowOffset = a.shadows / 100 * 72 * shadowWeight
    red += shadowOffset
    green += shadowOffset
    blue += shadowOffset

    red = contrastFactor * (red - 128) + 128
    green = contrastFactor * (green - 128) + 128
    blue = contrastFactor * (blue - 128) + 128

    // 饱和度绕亮度展开，同时叠加色温（红蓝反向、绿微调）
    const gray = red * 0.2126 + green * 0.7152 + blue * 0.0722
    red = gray + (red - gray) * saturationFactor + warmth
    green = gray + (green - gray) * saturationFactor + Math.abs(warmth) * 0.08
    blue = gray + (blue - gray) * saturationFactor - warmth

    // 色调：正值向暖白提亮，负值整体压暗——两侧不对称，保持原实现
    if (tint > 0) {
      red += (255 - red) * tint * 0.38
      green += (245 - green) * tint * 0.38
      blue += (236 - blue) * tint * 0.38
    } else if (tint < 0) {
      const amount = -tint * 0.3
      red *= 1 - amount
      green *= 1 - amount
      blue *= 1 - amount
    }

    data[i] = clamp(red, 0, 255)
    data[i + 1] = clamp(green, 0, 255)
    data[i + 2] = clamp(blue, 0, 255)
  }

  // 清晰度：四邻域 unsharp mask，边缘一圈不处理
  if (original && width > 2 && height > 2) {
    const clarity = a.clarity / 100 * 0.5
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4
        for (let channel = 0; channel < 3; channel += 1) {
          const center = original[i + channel]
          const neighbor =
            (original[i - 4 + channel] + original[i + 4 + channel] +
              original[i - width * 4 + channel] + original[i + width * 4 + channel]) / 4
          data[i + channel] = clamp(data[i + channel] + (center - neighbor) * clarity, 0, 255)
        }
      }
    }
  }
  return data
}

/**
 * 马赛克：把指定区域按 blockSize 像素化。
 * 区域缺省为整图。就地修改。
 */
export function applyMosaicPixels(data, width, height, { blockSize = 12, region } = {}) {
  const size = Math.max(1, Math.round(blockSize))
  const x0 = Math.max(0, Math.floor(region?.x ?? 0))
  const y0 = Math.max(0, Math.floor(region?.y ?? 0))
  const x1 = Math.min(width, Math.ceil(region ? region.x + region.width : width))
  const y1 = Math.min(height, Math.ceil(region ? region.y + region.height : height))

  for (let by = y0; by < y1; by += size) {
    for (let bx = x0; bx < x1; bx += size) {
      let r = 0; let g = 0; let b = 0; let n = 0
      const mx = Math.min(bx + size, x1)
      const my = Math.min(by + size, y1)
      for (let y = by; y < my; y += 1) {
        for (let x = bx; x < mx; x += 1) {
          const i = (y * width + x) * 4
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1
        }
      }
      if (!n) continue
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n)
      for (let y = by; y < my; y += 1) {
        for (let x = bx; x < mx; x += 1) {
          const i = (y * width + x) * 4
          data[i] = r; data[i + 1] = g; data[i + 2] = b
        }
      }
    }
  }
  return data
}

/**
 * 裁切区域归一化：钳到源图范围内，保证宽高为正整数。
 * 纯计算，供 UI 与管线共用。
 */
export function normalizeCrop(rect, sourceSize) {
  const x = clamp(Math.round(rect.x), 0, sourceSize.width - 1)
  const y = clamp(Math.round(rect.y), 0, sourceSize.height - 1)
  const width = clamp(Math.round(rect.width), 1, sourceSize.width - x)
  const height = clamp(Math.round(rect.height), 1, sourceSize.height - y)
  return { x, y, width, height }
}

/**
 * 把一组操作折叠成渲染计划。
 *
 * 分成三段是为了保证顺序稳定：
 *   ① 几何（裁切）→ ② 像素（调色、马赛克）→ ③ 覆盖物（涂鸦/标注）
 * 否则先画箭头再裁切，箭头会被裁掉一半，而用户预期是"在最终画面上标注"。
 */
export function buildRenderPlan(session) {
  const ops = session.operations()
  const crops = ops.filter((op) => op.tool === 'crop')
  const pixel = ops.filter((op) => op.tool === 'mosaic')
  const overlays = ops.filter((op) =>
    ['doodle', 'rect', 'arrow', 'text'].includes(op.tool))

  return {
    crops,
    adjustments: session.effectiveAdjustments(),
    pixel,
    overlays,
    sourceSize: { ...session.sourceSize },
    resultSize: session.resultSize()
  }
}

/**
 * 在给定的 2D 上下文上执行渲染计划。
 * 浏览器侧调用；Node 侧只测 buildRenderPlan 与像素函数。
 */
export function renderPlanToContext(ctx, plan, sourceImage) {
  const { crops, adjustments, pixel, overlays, resultSize } = plan

  // ① 几何：多次裁切逐级套用，最终只需按累计区域画一次
  let sx = 0
  let sy = 0
  let sw = plan.sourceSize.width
  let sh = plan.sourceSize.height
  for (const crop of crops) {
    sx += crop.params.x
    sy += crop.params.y
    sw = crop.params.width
    sh = crop.params.height
  }
  ctx.canvas.width = resultSize.width
  ctx.canvas.height = resultSize.height
  ctx.clearRect(0, 0, resultSize.width, resultSize.height)
  ctx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, resultSize.width, resultSize.height)

  // ② 像素
  const needPixel = pixel.length ||
    Object.entries(adjustments).some(([, v]) => v !== 0)
  if (needPixel) {
    const imageData = ctx.getImageData(0, 0, resultSize.width, resultSize.height)
    applyAdjustmentPixels(imageData.data, resultSize.width, resultSize.height, adjustments)
    for (const op of pixel) {
      applyMosaicPixels(imageData.data, resultSize.width, resultSize.height, op.params)
    }
    ctx.putImageData(imageData, 0, 0)
  }

  // ③ 覆盖物
  for (const op of overlays) drawOverlay(ctx, op)
  return ctx.canvas
}

/** 覆盖类工具的绘制。截图与双击共用，保证像素一致。 */
export function drawOverlay(ctx, op) {
  const p = op.params
  ctx.save()
  ctx.strokeStyle = p.color || '#e83c8c'
  ctx.fillStyle = p.color || '#e83c8c'
  ctx.lineWidth = p.lineWidth || 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (op.tool) {
    case 'rect':
      ctx.strokeRect(p.x, p.y, p.width, p.height)
      break
    case 'arrow': {
      const { x1, y1, x2, y2 } = p
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const head = Math.max(8, (p.lineWidth || 3) * 3.5)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7))
      ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7))
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'doodle': {
      const points = p.points || []
      if (points.length < 2) break
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
      ctx.stroke()
      break
    }
    case 'text': {
      ctx.font = `${p.fontWeight || 'normal'} ${p.fontSize || 24}px ${p.fontFamily || 'system-ui, sans-serif'}`
      ctx.textBaseline = 'top'
      ctx.fillText(p.text || '', p.x || 0, p.y || 0)
      break
    }
    default:
      break
  }
  ctx.restore()
}
