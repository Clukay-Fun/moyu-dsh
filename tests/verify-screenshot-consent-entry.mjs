// 确认策略入口结构回归（§13.2 不变量）。
//
// 不变量：模型路径（startFromTool）只走带确认的 desktop.requestScreenCapture；
// 人工路径（startFromUser）走免确认的 desktop.captureScreen；Tool 路径在任何
// 情况下都不得触达 captureScreen。用注入假 capture 完成，不真截屏。
import assert from 'node:assert/strict'
import { createScreenshotService } from '../packages/dsh-plugin-screenshot/src/index.mjs'

let passed = 0
let failed = 0
const check = (label, condition, detail = '') => {
  console.log(`  ${condition ? '✅' : '❌'} ${label.padEnd(46)} ${String(detail)}`)
  condition ? (passed += 1) : (failed += 1)
}

const calls = []
globalThis.__moyuDesktop = {
  call: async (method, payload) => {
    calls.push(payload ? `${method}:${JSON.stringify(payload)}` : method)
    if (!method.includes('Select')) {
      return {
        canceled: false,
        file: { fileId: `cap-${calls.length}`, name: 'capture.png' },
        width: 10, height: 10, backend: 'test',
        displayBounds: { x: 0, y: 0, width: 10, height: 10 }
      }
    }
    return { canceled: false, file: { fileId: 'result', name: 'result.png' }, width: 4, height: 4 }
  }
}

const select = async () => ({ canceled: false, file: { fileId: 'result', name: 'result.png' }, width: 4, height: 4 })
const timers = { setTimeout: (fn) => setTimeout(fn, 30), clearTimeout }
const service = createScreenshotService({ select, timers })

async function runJob(label, starter) {
  calls.length = 0
  const job = starter()
  assert.ok(job.jobId, `${label} 应返回 jobId`)
  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20))
    if (['completed', 'cancelled', 'failed'].includes(service.status({ job_id: job.jobId }).status)) break
  }
  const final = service.status({ job_id: job.jobId })
  check(`${label} 任务完成`, final.status === 'completed', final.status + (final.error ? ` ${final.error}` : ''))
  return final
}

const userFinal = await runJob('人工路径 startFromUser', () => service.startFromUser())
check('人工路径调用 desktop.captureScreen（免确认）', calls[0]?.startsWith('desktop.captureScreen'), calls.join(','))
check('人工路径不触发确认方法', !calls.includes('desktop.requestScreenCapture'), calls.join(','))

const toolFinal = await runJob('模型路径 startFromTool', () => service.startFromTool())
check('模型路径调用 desktop.requestScreenCapture（确认）', calls[0]?.startsWith('desktop.requestScreenCapture'), calls.join(','))
check('模型路径全程未触达免确认采集', !calls.includes('desktop.captureScreen'), calls.join(','))
check('模型路径全程未把会话 id 泄进采集结果', !JSON.stringify(calls).includes('result'), '')
check('两条路径结果都产出 resultId', Boolean(userFinal.result?.fileId && toolFinal.result?.fileId))

// 授权作用域：startFromTool 携带 DSH 会话 id，「本次会话内允许」按它记账
calls.length = 0
const scoped = service.startFromTool({ scope: 'session-ABC' })
for (let i = 0; i < 100; i++) {
  await new Promise((resolve) => setTimeout(resolve, 20))
  if (['completed', 'cancelled', 'failed'].includes(service.status({ job_id: scoped.jobId }).status)) break
}
const captureCall = calls.find((entry) => entry.startsWith('desktop.requestScreenCapture'))
check('模型路径透传会话 id 作为授权作用域', Boolean(captureCall?.includes('"scope":"session-ABC"')), captureCall || calls.join(','))

// busy：并发第二个请求被拒，且不产生任何新采集调用
calls.length = 0
const first = service.startFromTool()
const second = service.startFromUser()
check('并发请求返回 busy', second.status === 'busy' && second.activeJobId === first.jobId, JSON.stringify(second))
check('busy 拒绝不发起新采集', calls.filter((m) => m.includes('Capture')).length === 1, calls.join(','))
service.cancel({ job_id: first.jobId })

console.log(`截图确认入口回归通过 ${passed} 项，失败 ${failed} 项`)
process.exit(failed ? 1 : 0)
