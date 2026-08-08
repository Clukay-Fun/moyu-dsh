import { installTooltips } from './tooltip.js'

installTooltips()

const canvas = document.querySelector('#capture-canvas')
const context = canvas.getContext('2d')
const sizeLabel = document.querySelector('#selection-size')
const toolbar = document.querySelector('#capture-toolbar')
const tip = document.querySelector('#capture-tip')
const sessionId = new URLSearchParams(window.location.search).get('session')
let image
let selection
let origin
let dragging = false
let editing = false
let tool = 'rectangle'
let draft = null
const annotations = []

function normalizedSelection(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

function selectionContains(point) {
  return selection &&
    point.x >= selection.x && point.x <= selection.x + selection.width &&
    point.y >= selection.y && point.y <= selection.y + selection.height
}

function drawArrow(target, item) {
  const angle = Math.atan2(item.y2 - item.y1, item.x2 - item.x1)
  target.beginPath()
  target.moveTo(item.x1, item.y1)
  target.lineTo(item.x2, item.y2)
  target.stroke()
  target.beginPath()
  target.moveTo(item.x2, item.y2)
  target.lineTo(item.x2 - 13 * Math.cos(angle - Math.PI / 6), item.y2 - 13 * Math.sin(angle - Math.PI / 6))
  target.moveTo(item.x2, item.y2)
  target.lineTo(item.x2 - 13 * Math.cos(angle + Math.PI / 6), item.y2 - 13 * Math.sin(angle + Math.PI / 6))
  target.stroke()
}

function drawMosaic(target, item) {
  const rect = normalizedSelection(
    { x: item.x1, y: item.y1 },
    { x: item.x2, y: item.y2 }
  )
  if (rect.width < 2 || rect.height < 2) return
  const block = 10
  const scaleX = image.width / canvas.width
  const scaleY = image.height / canvas.height
  const source = document.createElement('canvas')
  source.width = Math.max(1, Math.ceil(rect.width / block))
  source.height = Math.max(1, Math.ceil(rect.height / block))
  source.getContext('2d').drawImage(
    image,
    rect.x * scaleX,
    rect.y * scaleY,
    rect.width * scaleX,
    rect.height * scaleY,
    0,
    0,
    source.width,
    source.height
  )
  target.save()
  target.imageSmoothingEnabled = false
  target.drawImage(source, rect.x, rect.y, rect.width, rect.height)
  target.restore()
}

function drawAnnotation(target, item) {
  target.save()
  target.strokeStyle = '#ff4f57'
  target.fillStyle = '#ff4f57'
  target.lineWidth = 3
  target.lineCap = 'round'
  target.lineJoin = 'round'
  if (item.tool === 'rectangle') {
    const rect = normalizedSelection({ x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 })
    target.strokeRect(rect.x, rect.y, rect.width, rect.height)
  } else if (item.tool === 'ellipse') {
    target.beginPath()
    target.ellipse(
      (item.x1 + item.x2) / 2,
      (item.y1 + item.y2) / 2,
      Math.abs(item.x2 - item.x1) / 2,
      Math.abs(item.y2 - item.y1) / 2,
      0,
      0,
      Math.PI * 2
    )
    target.stroke()
  } else if (item.tool === 'line') {
    target.beginPath()
    target.moveTo(item.x1, item.y1)
    target.lineTo(item.x2, item.y2)
    target.stroke()
  } else if (item.tool === 'arrow') {
    drawArrow(target, item)
  } else if (item.tool === 'brush') {
    target.beginPath()
    item.points.forEach((point, index) => {
      if (index === 0) target.moveTo(point.x, point.y)
      else target.lineTo(point.x, point.y)
    })
    target.stroke()
  } else if (item.tool === 'text') {
    target.font = '600 20px "Segoe UI", "Microsoft YaHei UI", sans-serif'
    target.fillText(item.text, item.x1, item.y1)
  } else if (item.tool === 'mosaic') {
    drawMosaic(target, item)
  }
  target.restore()
}

function render() {
  if (!image) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(15, 18, 25, 0.48)'
  context.fillRect(0, 0, canvas.width, canvas.height)
  if (!selection || selection.width < 1 || selection.height < 1) return
  context.save()
  context.beginPath()
  context.rect(selection.x, selection.y, selection.width, selection.height)
  context.clip()
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  annotations.forEach((item) => drawAnnotation(context, item))
  if (draft) drawAnnotation(context, draft)
  context.restore()
  context.strokeStyle = '#fff'
  context.lineWidth = 1
  context.setLineDash([5, 4])
  context.strokeRect(selection.x + 0.5, selection.y + 0.5, selection.width - 1, selection.height - 1)
}

function positionControls() {
  if (!selection) return
  const width = toolbar.offsetWidth || 520
  toolbar.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, selection.x + selection.width - width))}px`
  toolbar.style.top = `${Math.min(window.innerHeight - 54, selection.y + selection.height + 8)}px`
  sizeLabel.style.left = `${Math.min(window.innerWidth - 100, selection.x + 6)}px`
  sizeLabel.style.top = `${Math.max(8, selection.y - 27)}px`
  sizeLabel.textContent = `${Math.round(selection.width)} × ${Math.round(selection.height)}`
}

function finalCanvas() {
  const scaleX = image.width / canvas.width
  const scaleY = image.height / canvas.height
  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.round(selection.width * scaleX))
  output.height = Math.max(1, Math.round(selection.height * scaleY))
  const outputContext = output.getContext('2d')
  outputContext.scale(scaleX, scaleY)
  outputContext.translate(-selection.x, -selection.y)
  outputContext.drawImage(image, 0, 0, canvas.width, canvas.height)
  annotations.forEach((item) => drawAnnotation(outputContext, item))
  return output
}

function canvasPngBytes(output) {
  return new Promise((resolve, reject) => {
    output.toBlob(async (blob) => {
      if (!blob) return reject(new Error('截图编码失败'))
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  })
}

async function completeSelection() {
  if (!editing || !selection) return
  tip.textContent = '正在生成截图…'
  const data = await canvasPngBytes(finalCanvas())
  await window.api.completeScreenshot({ sessionId, data })
}

function cancelSelection() {
  window.api.cancelScreenshot(sessionId)
}

canvas.addEventListener('pointerdown', (event) => {
  const point = { x: event.clientX, y: event.clientY }
  if (!editing) {
    origin = point
    selection = { x: point.x, y: point.y, width: 0, height: 0 }
    dragging = true
    toolbar.hidden = true
    sizeLabel.hidden = false
  } else if (selectionContains(point)) {
    origin = point
    dragging = true
    draft = tool === 'brush'
      ? { tool, points: [point] }
      : { tool, x1: point.x, y1: point.y, x2: point.x, y2: point.y }
  }
  canvas.setPointerCapture(event.pointerId)
  render()
})

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return
  const point = { x: event.clientX, y: event.clientY }
  if (!editing) {
    selection = normalizedSelection(origin, point)
    positionControls()
  } else if (draft?.tool === 'brush') {
    draft.points.push(point)
  } else if (draft) {
    draft.x2 = point.x
    draft.y2 = point.y
  }
  render()
})

canvas.addEventListener('pointerup', (event) => {
  if (!dragging) return
  dragging = false
  canvas.releasePointerCapture(event.pointerId)
  if (!editing) {
    editing = Boolean(selection && selection.width >= 5 && selection.height >= 5)
    toolbar.hidden = !editing
    sizeLabel.hidden = !editing
    tip.textContent = editing ? '选择标注工具，或直接完成截图' : '拖动选择截图区域 · Esc 取消'
    positionControls()
  } else if (draft) {
    if (draft.tool === 'text') {
      const text = window.prompt('输入标注文字')
      if (text?.trim()) {
        draft.text = text.trim()
        annotations.push(draft)
      }
    } else {
      annotations.push(draft)
    }
    draft = null
  }
  render()
})

toolbar.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tool]')
  if (!button) return
  tool = button.dataset.tool
  toolbar.querySelectorAll('[data-tool]').forEach((option) => option.classList.toggle('on', option === button))
})
document.querySelector('#confirm-capture').addEventListener('click', () => completeSelection().catch(cancelSelection))
document.querySelector('#cancel-capture').addEventListener('click', cancelSelection)
document.querySelector('#save-capture').addEventListener('click', async () => {
  const data = await canvasPngBytes(finalCanvas())
  await window.api.saveScreenshot({ name: `screenshot-${Date.now()}`, data })
})
document.querySelector('#pin-capture').addEventListener('click', async () => {
  const data = await canvasPngBytes(finalCanvas())
  await window.api.pinScreenshot(data)
  tip.textContent = '截图已钉住'
})
document.querySelector('#ocr-capture').addEventListener('click', async () => {
  tip.textContent = '正在提取文字…'
  const data = await canvasPngBytes(finalCanvas())
  const result = await window.api.recognizeScreenshot(data)
  if (!result.text?.trim()) {
    tip.textContent = '未识别到文字'
    return
  }
  await window.api.copyScreenshotText(result.text)
  tip.textContent = '文字已提取并复制到剪贴板'
})
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') cancelSelection()
  if (event.key === 'Enter' && editing) completeSelection().catch(cancelSelection)
})
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  render()
})

async function initialize() {
  const session = await window.api.getScreenshotSession(sessionId)
  image = await createImageBitmap(new Blob([session.data], { type: 'image/png' }))
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  render()
}

initialize().catch(cancelSelection)
