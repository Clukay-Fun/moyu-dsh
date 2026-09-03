/**
dsh-profile 验收（C2-g g5 后）。
原 assertMoyuToolSurface / readPresetId / PRESET_REQUIRED_TOOLS 守卫已随单一工作台移除，
工具面完整性改由 host-ready 全局审计接管（见 apps/desktop/main/dsh/mods.js 的
buildEffectiveToolPolicy/auditGlobalToolSurface，测试在 tests/verify-mods-registry.mjs；
真机审计闸门在 tests/verify-dsh-session-create.mjs 覆盖）。
本 harness 只断言 profile 入口已不再导出旧守卫函数，防止回流。
*/
import assert from 'node:assert/strict'

const mod = await import('../index.mjs')
let passed = 0

const gone = ['assertMoyuToolSurface', 'readPresetId', 'PRESET_REQUIRED_TOOLS', 'MOYU_TOOL_WHITELIST', 'MOYU_SHELL_CLASS_TOOLS']
for (const name of gone) {
  assert.equal(mod[name], undefined, `旧守卫 ${name} 应已移除（改由 host-ready 全局审计接管）`)
  passed++
  console.log(`  ✓ profile 不再导出旧守卫 ${name}`)
}

console.log(`\n=== Results: ${passed} passed, 0 failed ===`)
