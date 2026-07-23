const canvas = document.querySelector('#capture-canvas')
const context = canvas.getContext('2d')
const sizeLabel = document.querySelector('#selection-size')
const actions = document.querySelector('#capture-actions')
const tip = document.querySelector('#capture-tip')
const sessionId = new URLSearchParams(window.location.search).get('session')
let image
let origin = null
let selection = null
let dragging = false

function normalizedSelection(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
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
  context.restore()
  context.strokeStyle = '#ffffff'
  context.lineWidth = 1
  context.setLineDash([5, 4])
  context.strokeRect(
    selection.x + 0.5,
    selection.y + 0.5,
    selection.width - 1,
    selection.height - 1
  )
}

function positionControls() {
  if (!selection) return
  const left = Math.min(window.innerWidth - 190, Math.max(8, selection.x + selection.width - 180))
  const top = Math.min(window.innerHeight - 52, selection.y + selection.height + 8)
  actions.style.left = `${left}px`
  actions.style.top = `${top}px`
  sizeLabel.style.left = `${Math.min(window.innerWidth - 90, selection.x + 6)}px`
  sizeLabel.style.top = `${Math.max(8, selection.y - 27)}px`
  sizeLabel.textContent = `${Math.round(selection.width)} × ${Math.round(selection.height)}`
}

async function completeSelection() {
  if (!selection || selection.width < 5 || selection.height < 5) return
  actions.hidden = true
  sizeLabel.hidden = true
  tip.textContent = '正在生成截图…'
  await window.api.completeScreenshot({
    sessionId,
    rect: selection
  })
}

function cancelSelection() {
  window.api.cancelScreenshot(sessionId)
}

canvas.addEventListener('pointerdown', (event) => {
  origin = { x: event.clientX, y: event.clientY }
  selection = { x: origin.x, y: origin.y, width: 0, height: 0 }
  dragging = true
  actions.hidden = true
  sizeLabel.hidden = false
  canvas.setPointerCapture(event.pointerId)
  render()
})

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return
  selection = normalizedSelection(origin, { x: event.clientX, y: event.clientY })
  positionControls()
  render()
})

canvas.addEventListener('pointerup', (event) => {
  if (!dragging) return
  dragging = false
  canvas.releasePointerCapture(event.pointerId)
  actions.hidden = !selection || selection.width < 5 || selection.height < 5
  sizeLabel.hidden = actions.hidden
  positionControls()
  render()
})

document.querySelector('#confirm-capture').addEventListener('click', completeSelection)
document.querySelector('#cancel-capture').addEventListener('click', cancelSelection)
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') cancelSelection()
  if (event.key === 'Enter') completeSelection()
})
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  render()
})

async function initialize() {
  const session = await window.api.getScreenshotSession(sessionId)
  const blob = new Blob([session.data], { type: 'image/png' })
  image = await createImageBitmap(blob)
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  render()
}

initialize().catch(() => cancelSelection())
