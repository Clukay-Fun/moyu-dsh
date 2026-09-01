/**
描述: dsh-profile 守卫单元与集成测试 harness。
主要功能:
    - 验证 assertMoyuToolSurface 多 preset 工具面检验
    - 验证 media preset 必备工具集（image_convert, screenshot_capture）
    - 验证 moyu preset 必备工具集（image_convert, pdf_process, screenshot_capture）
    - 验证未知 preset fail-closed 拦截
    - 验证 shell 类工具禁用拦截
*/

import { assertMoyuToolSurface, readPresetId, PRESET_REQUIRED_TOOLS } from '../index.mjs'

//#region 测试辅助工具

let passed = 0
let failed = 0

function assert(label, condition, detail = '') {
  const symbol = condition ? '✓' : '✗'
  console.log(`  ${symbol} ${label} ${detail ? `(${detail})` : ''}`)
  if (condition) {
    passed += 1
  } else {
    failed += 1
  }
}

function createMockCtx(toolNames) {
  return {
    tools: {
      schemas: () => (toolNames ? toolNames.map((name) => ({ name })) : null)
    }
  }
}

function createMockSession(presetId, toolNames) {
  return {
    header: presetId ? { agentPreset: presetId } : undefined,
    tools: toolNames
      ? {
          schemas: () => toolNames.map((name) => ({ name }))
        }
      : undefined
  }
}

//#endregion

//#region 测试用例执行

console.log('\n=== M1-a dsh-profile Guard Verification ===\n')

// 1. readPresetId 解析
console.log('Preset ID Resolution:')
assert('readPresetId defaults to moyu when empty', readPresetId(null) === 'moyu')
assert('readPresetId reads from header', readPresetId({ header: { agentPreset: 'media' } }) === 'media')
assert('readPresetId reads from events', readPresetId({ events: [{ type: 'agent-preset/selected', data: { agentPreset: 'custom' } }] }) === 'custom')
assert('readPresetId reads from agent', readPresetId({ agent: { preset: 'media' } }) === 'media')

// 2. Moyu Preset 守卫校验
console.log('\nMoyu Preset Guard:')
{
  const validTools = ['image_convert', 'pdf_process', 'screenshot_capture', 'ask_user_question']
  let ok = false
  try {
    ok = assertMoyuToolSurface(createMockCtx(validTools), createMockSession('moyu'))
  } catch (e) {
    ok = false
  }
  assert('moyu preset with all required tools succeeds', ok === true)
}

{
  const missingTools = ['image_convert', 'screenshot_capture'] // missing pdf_process
  let rejected = false
  try {
    assertMoyuToolSurface(createMockCtx(missingTools), createMockSession('moyu'))
  } catch (e) {
    rejected = e.message.includes('必备工具缺失')
  }
  assert('moyu preset missing pdf_process is rejected', rejected === true)
}

{
  const withShellTools = ['image_convert', 'pdf_process', 'screenshot_capture', 'bash']
  let rejected = false
  try {
    assertMoyuToolSurface(createMockCtx(withShellTools), createMockSession('moyu'))
  } catch (e) {
    rejected = e.message.includes('shell 类工具')
  }
  assert('moyu preset with bash tool is rejected', rejected === true)
}

// 3. Media Preset 守卫校验
console.log('\nMedia Preset Guard:')
{
  // Media preset in M1 only requires image_convert and screenshot_capture (no pdf_process)
  const validMediaTools = ['image_convert', 'screenshot_capture', 'ask_user_question', 'mock_media_task']
  let ok = false
  try {
    ok = assertMoyuToolSurface(createMockCtx(validMediaTools), createMockSession('media'))
  } catch (e) {
    ok = false
  }
  assert('media preset with required M1 tools succeeds (without pdf_process)', ok === true)
}

{
  const missingMediaTools = ['image_convert'] // missing screenshot_capture
  let rejected = false
  try {
    assertMoyuToolSurface(createMockCtx(missingMediaTools), createMockSession('media'))
  } catch (e) {
    rejected = e.message.includes('必备工具缺失')
  }
  assert('media preset missing screenshot_capture is rejected', rejected === true)
}

{
  const mediaWithShell = ['image_convert', 'screenshot_capture', 'terminal']
  let rejected = false
  try {
    assertMoyuToolSurface(createMockCtx(mediaWithShell), createMockSession('media'))
  } catch (e) {
    rejected = e.message.includes('shell 类工具')
  }
  assert('media preset with terminal tool is rejected', rejected === true)
}

// 4. 未知 Preset fail-closed 校验
console.log('\nUnknown Preset Guard (fail-closed):')
{
  const anyTools = ['image_convert', 'pdf_process', 'screenshot_capture']
  let rejected = false
  try {
    assertMoyuToolSurface(createMockCtx(anyTools), createMockSession('unknown_custom_preset'))
  } catch (e) {
    rejected = e.message.includes('未知 preset')
  }
  assert('unknown preset is rejected fail-closed', rejected === true)
}

// 5. 无法读取工具面 fail-closed
console.log('\nUnreadable Tool Surface Guard:')
{
  let rejected = false
  try {
    assertMoyuToolSurface({ tools: null }, createMockSession('moyu'))
  } catch (e) {
    rejected = e.message.includes('fail-closed')
  }
  assert('unresolvable tool surface is rejected fail-closed', rejected === true)
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed ? 1 : 0)

//#endregion
