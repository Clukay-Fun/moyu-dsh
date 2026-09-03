// DSH 运行时的编排入口（v3.0.0 M0b B2）。
//
// DSH 是 v3 的正式主界面；MOYU_DSH=0 仅保留给迁移期 legacy 回归。
import { builtinVersion, dshHome, ensureProfile, probeInstalledKernel, serveDesktopBridge, serveHostServices, startHostGeneration, stopHost } from './host.js'
import { assertChromiumFenceEngaged, createDshSession, installHeaderInjection } from './session-policy.js'
import { createBridgeMethods } from './bridge.js'
import { app } from 'electron'
import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'

// 打包后的 GUI 应用拿不到 stdout，启动失败在包里等于无声。
// 落盘一行带时间戳的记录：既是 B4 降级页的信息来源，也是唯一的现场诊断手段。
// 只记结构化原因，不记 token、凭据和请求内容。
async function logStartup(line) {
  const stamped = `${new Date().toISOString()} ${line}\n`
  process.stdout.write(stamped)
  await appendFile(join(app.getPath('userData'), 'dsh-startup.log'), stamped).catch(() => {})
}
export { logStartup }

let current
let generationSeq = 0

export function isDshEnabled() {
  return process.env.MOYU_DSH !== '0'
}

/**
 * 起一代 DSH：启动 Host → 等 ready → 装 token 注入 → fence 自检。
 *
 * 自检失败时立即回收本代 Host 并抛出；调用方不得在未通过自检的情况下展示 DSH UI。
 */
export async function startDsh({ onStdout, window, onExit } = {}) {
  const generation = ++generationSeq
  // profile 必须显式给定：没有唯一 Moyu profile 就不启动，绝不回落上游 web profile
  // （它会带进被禁止的 shell / 文件 / subagent / 动态插件工具）。
  const profile = process.env.MOYU_DSH_PROFILE || 'moyu'
  await ensureProfile(profile)
  const host = await startHostGeneration(generation, { onStdout, profile })
  try {
    const dshSession = createDshSession(generation)
    const fence = await assertChromiumFenceEngaged(host)
    const injected = installHeaderInjection(dshSession, host)
    serveDesktopBridge(host, createBridgeMethods({ generation, window, kernelManager: { builtinVersion, probeInstalledKernel } }))
    serveHostServices(host)
    current = { host, session: dshSession, injected, fence, generation }
    host.child.once('exit', (code, signal) => {
      if (current?.host !== host) return
      current = undefined
      onExit?.({ generation, code, signal })
    })
    return current
  } catch (error) {
    const lifecycle = host.evidence
      .filter((entry) => entry?.kind === 'server-lifecycle')
      .map((entry) => {
        if (entry.event === 'listening') return `listening ${entry.address?.address}:${entry.address?.port}`
        if (entry.event === 'self-http') return `self-http ${entry.status}`
        if (entry.event === 'self-http-error') return `self-http-error ${entry.code}`
        return entry.event
      })
    if (lifecycle.length) error.message = `${error.message}（Host server: ${lifecycle.join(' → ')}）`
    await stopHost(host)
    throw error
  }
}

export async function stopDsh() {
  if (!current) return
  const { host } = current
  current = undefined
  await stopHost(host)
}

export function currentDsh() {
  return current
}

export function callDshImageService(method, payload, options) {
  if (!current?.host?.services) {
    return Promise.reject(Object.assign(new Error('DSH Host 当前不可用，请稍后重试'), {
      code: 'HOST_UNAVAILABLE'
    }))
  }
  return current.host.services.call(method, payload, options)
}

export function authorizeDshFile(path) {
  if (!current?.host?.bridge) {
    return Promise.reject(Object.assign(new Error('DSH Host 当前不可用，请稍后重试'), {
      code: 'HOST_UNAVAILABLE'
    }))
  }
  return current.host.bridge.registerFile(path)
}

export { dshHome }
