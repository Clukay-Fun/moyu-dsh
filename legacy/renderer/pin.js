import { installTooltips } from './tooltip.js'

installTooltips()

const pinId = new URLSearchParams(location.search).get('pin')
const frame = document.querySelector('#pin-frame')
const image = document.querySelector('#pin-image')
const status = document.querySelector('#pin-status')
let imageUrl = ''
let scale = 1
let opacity = 1
let statusTimer

function showStatus(message) {
  status.textContent = message
  status.classList.add('show')
  window.clearTimeout(statusTimer)
  statusTimer = window.setTimeout(() => status.classList.remove('show'), 1200)
}

async function resize(nextScale) {
  scale = Math.min(3, Math.max(0.2, nextScale))
  const result = await window.api.resizePinnedScreenshot({ pinId, scale })
  showStatus(`${Math.round(result.scale * 100)}%`)
}

async function changeOpacity(nextOpacity) {
  opacity = Math.min(1, Math.max(0.3, nextOpacity))
  const result = await window.api.setPinnedScreenshotOpacity({ pinId, opacity })
  opacity = result.opacity
  showStatus(`透明度 ${Math.round(opacity * 100)}%`)
}

async function copyImage() {
  const result = await window.api.copyPinnedScreenshot(pinId)
  showStatus(`已复制 ${result.size.width} × ${result.size.height}`)
}

document.querySelector('#pin-zoom-in').addEventListener('click', () => resize(scale + 0.1))
document.querySelector('#pin-zoom-out').addEventListener('click', () => resize(scale - 0.1))
document.querySelector('#pin-opacity-up').addEventListener('click', () => changeOpacity(opacity + 0.1))
document.querySelector('#pin-opacity-down').addEventListener('click', () => changeOpacity(opacity - 0.1))
document.querySelector('#pin-copy').addEventListener('click', copyImage)
document.querySelector('#pin-close').addEventListener('click', () => window.api.closePinnedScreenshot(pinId))

window.addEventListener('wheel', (event) => {
  event.preventDefault()
  resize(scale + (event.deltaY < 0 ? 0.1 : -0.1))
}, { passive: false })

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    window.api.closePinnedScreenshot(pinId)
  } else if (event.key === '+' || event.key === '=') {
    resize(scale + 0.1)
  } else if (event.key === '-') {
    resize(scale - 0.1)
  } else if (event.key === '[') {
    changeOpacity(opacity - 0.1)
  } else if (event.key === ']') {
    changeOpacity(opacity + 0.1)
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
    copyImage()
  }
})

window.addEventListener('beforeunload', () => {
  if (imageUrl) URL.revokeObjectURL(imageUrl)
})

async function initialize() {
  if (!pinId) throw new Error('缺少钉图会话')
  const result = await window.api.getPinnedScreenshot(pinId)
  scale = Math.min(
    1,
    window.innerWidth / result.originalSize.width,
    window.innerHeight / result.originalSize.height
  )
  opacity = result.opacity
  imageUrl = URL.createObjectURL(new Blob([result.data], { type: 'image/png' }))
  image.src = imageUrl
  await image.decode()
  frame.classList.add('ready')
}

initialize().catch((error) => {
  document.querySelector('#pin-loading').textContent =
    `钉图载入失败：${error instanceof Error ? error.message : String(error)}`
})
