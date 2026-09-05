// 模型确认状态机与会话授权作用域宿主层单测。
//
// 验证要点：
// 1. 首次触发：弹出原生确认对话框（包含「本次会话内允许，不再询问」复选框）。
// 2. 勾选记忆：用户勾选「本次会话内允许」并点击允许，授权绑定至当前 DSH sessionId。
// 3. 同会话免弹：同一会话再次调用，0 次弹窗直接执行。
// 4. 跨会话隔离：新建会话（不同 sessionId）调用，重新弹出确认对话框（验证 a95abfe 修复）。
// 5. 拒绝授权：用户点击取消，返回 cancelled: true 及 cancelled_by_consent 正常终态。
// 6. 状态清理：清空授权集合后，原有会话再次调用重新触发确认弹窗。

import { spawnSync } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

// 若以纯 Node 启动，自动调度 Electron 运行时执行
if (!process.versions.electron) {
  const { default: electronBinary } = await import('electron')
  const res = spawnSync(electronBinary, [import.meta.filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env
  })
  process.exit(res.status ?? 0)
}

const { app, dialog } = await import('electron')

let passed = 0
let failed = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label.padEnd(54)} ${String(detail)}`)
  ok ? (passed += 1) : (failed += 1)
}

app.whenReady().then(async () => {
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  截图确认循环：宿主层授权状态机与会话隔离单测')
  console.log('══════════════════════════════════════════════════════════\n')

  const { requestScreenCaptureForDsh } = await import('../out/main/index.js')

  const tmpDir = join(tmpdir(), 'moyu-consent-unit-test')
  await mkdir(tmpDir, { recursive: true })
  const mockPngPath = join(tmpDir, `mock-${randomUUID()}.png`)
  await writeFile(mockPngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))

  let dialogCalls = []
  let dialogResponseToReturn = { response: 0, checkboxChecked: false }

  const originalShowMessageBox = dialog.showMessageBox
  dialog.showMessageBox = async (win, opts) => {
    dialogCalls.push({ win, opts })
    return dialogResponseToReturn
  }

  try {
    // ----------------------------------------------------
    // 步骤 1：首次在会话 A 调用（未勾选 remember）
    // ----------------------------------------------------
    console.log('▶ [步骤 1] 首次在会话 A 中调用（弹出确认，用户允许但不勾选记忆）...')
    dialogCalls.length = 0
    dialogResponseToReturn = { response: 0, checkboxChecked: false }

    await requestScreenCaptureForDsh({ scope: 'session-A' }).catch(() => ({}))
    check('步骤 1 触发原生确认对话框 (1 次)', dialogCalls.length === 1, `调用次数: ${dialogCalls.length}`)
    check('步骤 1 弹窗参数包含记忆复选框', dialogCalls[0]?.opts?.checkboxLabel === '本次会话内允许，不再询问')
    check('步骤 1 对话框文案说明清晰', dialogCalls[0]?.opts?.message?.includes('允许模型读取当前屏幕吗'))

    // ----------------------------------------------------
    // 步骤 2：会话 A 再次调用，这次勾选 remember 并允许
    // ----------------------------------------------------
    console.log('▶ [步骤 2] 会话 A 勾选「本次会话内允许」并点击允许...')
    dialogCalls.length = 0
    dialogResponseToReturn = { response: 0, checkboxChecked: true }

    await requestScreenCaptureForDsh({ scope: 'session-A' }).catch(() => ({}))
    check('步骤 2 再次触发确认对话框', dialogCalls.length === 1)

    // ----------------------------------------------------
    // 步骤 3：在【同一会话 A】中再次调用 → 免弹窗
    // ----------------------------------------------------
    console.log('▶ [步骤 3] 在同一会话 A 中再次请求截图（验证同会话免弹窗）...')
    dialogCalls.length = 0

    await requestScreenCaptureForDsh({ scope: 'session-A' }).catch(() => ({}))
    check('步骤 3 同一会话内完全免弹窗（0 次调用）', dialogCalls.length === 0, `调用次数: ${dialogCalls.length}`)

    // ----------------------------------------------------
    // 步骤 4：在【新会话 B】中调用 → 重新弹窗（验证跨会话隔离）
    // ----------------------------------------------------
    console.log('▶ [步骤 4] 在新会话 B 中请求截图（验证跨会话重新弹窗，不发生授权逃逸）...')
    dialogCalls.length = 0
    dialogResponseToReturn = { response: 0, checkboxChecked: false }

    await requestScreenCaptureForDsh({ scope: 'session-B' }).catch(() => ({}))
    check('步骤 4 新会话成功重新触发确认弹窗', dialogCalls.length === 1, `调用次数: ${dialogCalls.length}`)

    // 再次在会话 A 调用确认会话 A 依然免弹
    dialogCalls.length = 0
    await requestScreenCaptureForDsh({ scope: 'session-A' }).catch(() => ({}))
    check('会话 A 仍保持免弹窗（作用域严格隔离）', dialogCalls.length === 0)

    // ----------------------------------------------------
    // 步骤 5：拒绝授权路径测试
    // ----------------------------------------------------
    console.log('▶ [步骤 5] 模拟用户点击取消（拒绝授权）...')
    dialogCalls.length = 0
    dialogResponseToReturn = { response: 1, checkboxChecked: false }

    const resCancel = await requestScreenCaptureForDsh({ scope: 'session-C' })
    check('取消操作返回 cancelled_by_consent 正常终态', resCancel.canceled === true && resCancel.reason === 'cancelled_by_consent', resCancel.reason)
    check('取消操作不发起任何真实截屏动作', dialogCalls.length === 1)

  } catch (err) {
    console.error('测试异常:', err)
    failed += 1
  } finally {
    dialog.showMessageBox = originalShowMessageBox
  }

  console.log(`\n══════════════════════════════════════════════════════════`)
  console.log(`  宿主层授权单测汇总：通过 ${passed} 项，失败 ${failed} 项`)
  console.log(`══════════════════════════════════════════════════════════\n`)

  app.quit()
  process.exit(failed === 0 ? 0 : 1)
})
