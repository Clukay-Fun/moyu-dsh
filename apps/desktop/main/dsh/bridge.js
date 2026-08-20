// 窄桌面桥（v3.0.0 §3.4）。
//
// DSH Host 只能调用这里显式登记的方法：没有通用 channel，没有任意 Electron API 转发，
// 没有任意路径读写。每个方法都有参数校验、明确的调用主体和清洗过的错误。
//
// 调用主体固定为 `dsh:<generation>`：Host 进程只经这一条进程 IPC 窄桥进来，
// 不与 renderer / legacy / job 共用身份（§6.1）。
import { BrowserWindow, clipboard, dialog, nativeImage, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { stat, writeFile } from 'node:fs/promises'
import { describeCredential, getCredential, setCredential, unsetCredential } from './secure-store.js'

const MAX_PICK = 64

function requireString(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`${label} 必须是非空字符串`)
  return value
}

/**
 * 文件令牌表。
 *
 * 绝对路径只留在主进程：Host 拿到的是 fileId，后续操作只能作用在已授权的令牌上。
 * 令牌绑定 generation，随该代 Host 一起作废——换代后旧 id 一律无效（§4.1、§6.1）。
 */
function createFileRegistry(subject) {
  const files = new Map()
  return {
    async register(path) {
      const fileId = randomUUID()
      const info = await stat(path).catch(() => undefined)
      files.set(fileId, { path, subject })
      return { fileId, name: basename(path), size: info?.size }
    },
    resolve(fileId) {
      const entry = files.get(fileId)
      if (!entry) throw new Error('文件令牌无效或已失效')
      return entry.path
    },
    clear() {
      files.clear()
    }
  }
}

/**
 * 建立方法表。
 *
 * @param {object} context
 * @param {number} context.generation 当前 Host 代次，用于组成调用主体
 * @param {() => BrowserWindow|undefined} context.window 对话框的父窗口
 */
export function createBridgeMethods({ generation, window }) {
  const subject = `dsh:${generation}`
  const parent = () => window?.() ?? BrowserWindow.getFocusedWindow() ?? undefined
  const registry = createFileRegistry(subject)

  return {
    registry,

    async 'desktop.ping'() {
      return 'desktop.pong'
    },

    async 'desktop.pickFiles'(payload = {}) {
      const filters = Array.isArray(payload.filters) ? payload.filters.slice(0, 8) : undefined
      const result = await dialog.showOpenDialog(parent(), {
        properties: payload.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
        filters
      })
      if (result.canceled) return { canceled: true, files: [] }
      const picked = result.filePaths.slice(0, MAX_PICK)
      return { canceled: false, files: await Promise.all(picked.map((path) => registry.register(path))) }
    },

    async 'desktop.pickDirectory'() {
      const result = await dialog.showOpenDialog(parent(), { properties: ['openDirectory'] })
      if (result.canceled) return { canceled: true, directory: undefined }
      return { canceled: false, directory: await registry.register(result.filePaths[0]) }
    },

    async 'desktop.saveResult'(payload = {}) {
      const suggestedName = requireString(payload.name, 'name')
      const data = payload.data
      if (!(data instanceof Uint8Array)) throw new Error('data 必须是二进制内容')
      const result = await dialog.showSaveDialog(parent(), { defaultPath: suggestedName })
      if (result.canceled || !result.filePath) return { canceled: true }
      await writeFile(result.filePath, Buffer.from(data))
      return { canceled: false, file: await registry.register(result.filePath) }
    },

    async 'desktop.showItem'(payload = {}) {
      // 只接受本代已授权的令牌：不接受 Host 提供的任意路径。
      shell.showItemInFolder(registry.resolve(requireString(payload.fileId, 'fileId')))
      return { shown: true }
    },

    async 'desktop.openLegacyExtension'(payload = {}) {
      // 只接受白名单模块名：不接受任意 URL、任意文件路径或任意窗口参数。
      const { openLegacyModule } = await import('../index.js')
      return openLegacyModule(requireString(payload.module, 'module'))
    },

    async 'desktop.copy'(payload = {}) {
      if (typeof payload.text === 'string') {
        clipboard.writeText(payload.text)
        return { copied: 'text' }
      }
      if (payload.image instanceof Uint8Array) {
        const image = nativeImage.createFromBuffer(Buffer.from(payload.image))
        if (image.isEmpty()) throw new Error('图像内容无法解析')
        clipboard.writeImage(image)
        return { copied: 'image' }
      }
      throw new Error('copy 需要 text 或 image')
    },

    async 'desktop.secureStore'(payload = {}) {
      return setCredential(requireString(payload.key, 'key'), requireString(payload.value, 'value'))
    },

    async 'desktop.secureRetrieve'(payload = {}) {
      // 只有 Host 的 credentials provider 会调用它；值不进日志、不进结果卡片。
      return { value: await getCredential(requireString(payload.key, 'key')) }
    },

    async 'desktop.secureDescribe'(payload = {}) {
      return describeCredential(requireString(payload.key, 'key'))
    },

    async 'desktop.secureDelete'(payload = {}) {
      return unsetCredential(requireString(payload.key, 'key'))
    },

    get subject() {
      return subject
    }
  }
}

/**
 * 把 Host 送来的 RPC 派发到方法表。
 *
 * 错误一律清洗成 message + code：不回传栈、不回传内部路径。
 */
export async function dispatchBridgeCall(methods, message) {
  const handler = methods[message?.method]
  if (typeof handler !== 'function') {
    return { id: message?.id, ok: false, error: `未登记的桌面桥方法：${message?.method}`, code: 'UNKNOWN_METHOD' }
  }
  try {
    return { id: message.id, ok: true, value: await handler(message.payload) }
  } catch (error) {
    return {
      id: message.id,
      ok: false,
      error: error?.message || '桌面桥调用失败',
      code: error?.code || 'BRIDGE_ERROR'
    }
  }
}
