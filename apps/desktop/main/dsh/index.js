// DSH 运行时的编排入口（v3.0.0 M0b B2）。
//
// 当前只做“能起、能验、能停”，不切换主界面：主窗口仍是 legacy renderer。
// 切主界面、引导页与降级页在 B4，桌面桥的真实方法在 B3。
//
// 开关：环境变量 MOYU_DSH=1。未开启时应用行为与 v2.1.0 完全一致。
import { dshHome, serveDesktopBridge, startHostGeneration, stopHost } from './host.js'
import { createDshSession, installHeaderInjection } from './session-policy.js'
import { assertFenceEngaged } from './self-test.js'
import { createBridgeMethods } from './bridge.js'

let current
let generationSeq = 0

export function isDshEnabled() {
  return process.env.MOYU_DSH === '1'
}

/**
 * 起一代 DSH：启动 Host → 等 ready → 装 token 注入 → fence 自检。
 *
 * 自检失败时立即回收本代 Host 并抛出；调用方不得在未通过自检的情况下展示 DSH UI。
 */
export async function startDsh({ onStdout, window } = {}) {
  const generation = ++generationSeq
  // profile 必须显式给定：没有唯一 Moyu profile 就不启动，绝不回落上游 web profile
  // （它会带进被禁止的 shell / 文件 / subagent / 动态插件工具）。
  const profile = process.env.MOYU_DSH_PROFILE
  if (!profile) {
    throw new Error('未配置 Moyu profile（MOYU_DSH_PROFILE），拒绝以上游默认 profile 启动')
  }
  const host = await startHostGeneration(generation, { onStdout, profile })
  try {
    const dshSession = createDshSession(generation)
    const injected = installHeaderInjection(dshSession, host)
    const fence = await assertFenceEngaged(host.url)
    serveDesktopBridge(host, createBridgeMethods({ generation, window }))
    current = { host, session: dshSession, injected, fence, generation }
    return current
  } catch (error) {
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

export { dshHome }
