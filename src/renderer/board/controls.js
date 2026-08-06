// 汇总画布 · 自定义控制点（S3）
//
// 目标：**视觉小、命中大**。
//
// fabric 默认用同一个 cornerSize 既画又判，想把命中区做到 20px 就得把手柄
// 画成 20px 方块——在 360px 宽的图上非常笨重。而 fabric.Control 其实把两者
// 分开了：sizeX/sizeY 决定鼠标命中框，touchSizeX/touchSizeY 决定触控命中框，
// render() 决定画成什么样。只要自带 render，就能画 11px 而判 20px。
//
// 尺寸单位是**屏幕像素**：fabric 在计算 corner 坐标时把 size 加在已经过
// viewportTransform 的点上，所以画布缩放到 50% 或 200% 时命中区不变。
// 这一点由 CDP 在 50/100/200% 三档实测，不靠推断。

/** 手柄画多大（屏幕像素） */
export const CONTROL_VISUAL = 11
/** 鼠标命中区（屏幕像素） */
export const CONTROL_HIT = 20
/** 触控命中区（屏幕像素）。手指比鼠标钝，需要更大。 */
export const CONTROL_TOUCH = 28

const FILL = '#ffffff'
const STROKE = '#6978e6'
const STROKE_WIDTH = 1.5

/** 缩放手柄：白底圆角方块 + 主题色描边。 */
function renderScaleHandle(ctx, left, top, _styleOverride, fabricObject) {
  const size = CONTROL_VISUAL
  const half = size / 2
  const radius = 3
  ctx.save()
  ctx.translate(left, top)
  // 手柄不跟随对象旋转，始终正着画，方向感更稳
  ctx.rotate(0)
  ctx.beginPath()
  ctx.moveTo(-half + radius, -half)
  ctx.lineTo(half - radius, -half)
  ctx.quadraticCurveTo(half, -half, half, -half + radius)
  ctx.lineTo(half, half - radius)
  ctx.quadraticCurveTo(half, half, half - radius, half)
  ctx.lineTo(-half + radius, half)
  ctx.quadraticCurveTo(-half, half, -half, half - radius)
  ctx.lineTo(-half, -half + radius)
  ctx.quadraticCurveTo(-half, -half, -half + radius, -half)
  ctx.closePath()
  ctx.fillStyle = FILL
  ctx.fill()
  ctx.lineWidth = STROKE_WIDTH
  ctx.strokeStyle = fabricObject?.cornerStrokeColor || STROKE
  ctx.stroke()
  ctx.restore()
}

/** 旋转手柄：圆形，与缩放手柄区分开，避免误抓。 */
function renderRotateHandle(ctx, left, top, _styleOverride, fabricObject) {
  const radius = CONTROL_VISUAL / 2 + 1
  ctx.save()
  ctx.beginPath()
  ctx.arc(left, top, radius, 0, Math.PI * 2)
  ctx.fillStyle = FILL
  ctx.fill()
  ctx.lineWidth = STROKE_WIDTH
  ctx.strokeStyle = fabricObject?.cornerStrokeColor || STROKE
  ctx.stroke()
  // 中心点提示这是旋转柄
  ctx.beginPath()
  ctx.arc(left, top, 1.8, 0, Math.PI * 2)
  ctx.fillStyle = STROKE
  ctx.fill()
  ctx.restore()
}

/**
 * 给一个 fabric 对象套上自定义控制点。
 *
 * 逐个 clone 而不是改 fabric.Object.prototype.controls：那张表是原型共享的，
 * 就地改会波及全屏编辑器里的 fabric 实例，也让"谁改了控制点"变得难查。
 */
export function applyBoardControls(object) {
  if (!object?.controls) return object
  const next = {}
  for (const [key, control] of Object.entries(object.controls)) {
    const clone = Object.assign(
      Object.create(Object.getPrototypeOf(control)),
      control,
      {
        sizeX: CONTROL_HIT,
        sizeY: CONTROL_HIT,
        touchSizeX: CONTROL_TOUCH,
        touchSizeY: CONTROL_TOUCH,
        render: key === 'mtr' ? renderRotateHandle : renderScaleHandle
      }
    )
    next[key] = clone
  }
  object.controls = next
  // cornerSize 仍会影响个别内部计算，设成命中尺寸保持一致；
  // 实际画多大完全由上面的 render 决定，不受它影响。
  object.cornerSize = CONTROL_HIT
  object.touchCornerSize = CONTROL_TOUCH
  object.transparentCorners = false
  object.cornerColor = FILL
  object.cornerStrokeColor = STROKE
  object.borderColor = STROKE
  object.borderScaleFactor = 1.5
  return object
}

/** 供测试与诊断读取的期望值。 */
export const CONTROL_SIZES = Object.freeze({
  visual: CONTROL_VISUAL,
  mouse: CONTROL_HIT,
  touch: CONTROL_TOUCH
})
