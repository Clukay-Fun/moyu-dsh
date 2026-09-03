/**
描述: C2-g 第一层 host-audit 插件（单一工作台）。
职责: 只挂一个窄审计闭包到 globalThis.__moyuToolAudit——读策略快照 + ctx.tools.schemas()
      精确比对 root-global 工具面。由 worker 在 `dsh web:` 就绪闸门（Loader 已 settle、
      Tool 已注册完）同步调用；不猜 cordis 生命周期、不用定时器/轮询。
契约: scope/plans/active/moyu-dsh-c2g-tool-policy-plan.md（g3）。策略快照见 effective-tool-policy.json。
装载: root composition 最后一项。
*/
import { readFileSync } from 'node:fs'

export const name = 'moyu-tool-audit'
export const inject = ['tools']

export function apply(ctx) {
  globalThis.__moyuToolAudit = () => {
    const path = process.env.MOYU_TOOL_POLICY_PATH
    if (!path) return { ok: false, reason: 'MOYU_TOOL_POLICY_PATH 未设置' }
    let policy
    try {
      policy = JSON.parse(readFileSync(path, 'utf8'))
    } catch (e) {
      return { ok: false, reason: `策略快照读取失败: ${e?.message || e}` }
    }
    if (!policy || !Array.isArray(policy.globalExpected)) {
      return { ok: false, reason: '策略快照损坏（缺 globalExpected）' }
    }
    let actual
    try {
      actual = ctx.tools.schemas().map((s) => s && s.name).filter(Boolean)
    } catch (e) {
      return { ok: false, reason: `读取 ctx.tools.schemas() 失败: ${e?.message || e}` }
    }
    const expected = new Set(policy.globalExpected)
    const actualSet = new Set(actual)
    const undeclared = actual.filter((n) => !expected.has(n)).sort()
    const missing = policy.globalExpected.filter((n) => !actualSet.has(n)).sort()
    return { ok: undeclared.length === 0 && missing.length === 0, undeclared, missing }
  }
}
