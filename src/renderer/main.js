const pingButton = document.querySelector('#ping-button')
const pingResult = document.querySelector('#ping-result')
const securityStatus = document.querySelector('#security-status')

const rendererIsIsolated =
  typeof globalThis.require === 'undefined' &&
  typeof globalThis.process === 'undefined'

securityStatus.textContent = rendererIsIsolated
  ? 'Renderer 已隔离：require 与 process 均不可用'
  : '隔离检查失败：renderer 暴露了 Node 全局'

pingButton.addEventListener('click', async () => {
  pingButton.disabled = true
  pingResult.textContent = '请求中…'

  try {
    const response = await window.api.ping()
    pingResult.textContent = response === 'pong' ? 'pong · IPC 正常' : `异常响应：${response}`
  } catch (error) {
    pingResult.textContent = `IPC 失败：${error.message}`
  } finally {
    pingButton.disabled = false
  }
})
