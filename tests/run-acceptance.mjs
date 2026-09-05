// 验收执行入口 · **显式清单**，不用通配符
//
// 为什么不用 tests/verify-*.mjs 通配：目录里还留着 4 个已过期的 m*-smoke，
// 它们打的是**已按要求删除**的功能（AI 图像、滚动截图、旧单图模块、
// 条码生成按钮）。通配跑会稳定产出 4 个失败，而失败原因是"功能没了"，
// 不是回归——这种假失败会消耗每一次验收的注意力，久了就没人认真看结果。
//
// 用法：
//   node tests/run-acceptance.mjs          跑全部（含需要真机的）
//   node tests/run-acceptance.mjs --node    只跑纯 Node 显式清单
//   node tests/run-acceptance.mjs --live    只跑自启 Electron 的显式清单
//
// 前置：先 npm install && npm run build（真机 harness 要读 out/main/index.js）
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// v3 范围收敛（2026-08-22）：v3 只保留**图片、PDF、截图**三项纯内置工具，
// 外加 DSH 原生会话创建（白名单漂移回归）。条码、格式工厂、OCR、Illustrator、
// 画布（Fabric）、旧 Vanilla renderer 的 harness 已移出清单——它们测的功能在
// v3 已不存在，跑起来只会稳定产出"功能没了"的假失败。这些条目见下方 OBSOLETE
// 的"移出 v3 范围"分组，有据可查，不是悄悄消失。

/** 纯 Node：不需要启动应用，直接跑，且结果确定（无需真实模型）。 */
const NODE_HARNESSES = [
  'verify-dsh-session-create.mjs',      // DSH 原生：真实 UI origin 创建会话 + 白名单不变量
  'verify-pdf-process-tool.mjs',        // PDF 工具
  'verify-screenshot-capture-tool.mjs', // 截图工具
  'verify-screenshot-consent-entry.mjs',// 截图：consent 入口
  'verify-screenshot-consent-unit.mjs', // 截图：consent 单元
  'verify-screenshot-service.mjs',      // 截图：service 层
  'verify-session-export-route.mjs',    // 会话导出路由（Host 侧，喂 fixture，验脱敏/状态码，无需模型）
  'verify-pinned-session-style.mjs',    // 置顶会话样式、常驻图钉与排序逻辑
  'verify-overlay-applied.mjs',         // Overlay 门禁：bundle 标记 + closure 完整性（B3/B4 主界面）
  // verify-media-preset-session 已退休：media/双预设移除（2026-09-03 单一工作台）
  'verify-mods-registry.mjs',           // C1 Mod 基础设施：manifest 校验/兼容/安装/compose/启停/卸载无残留/诊断
  'verify-mods-host-integration.mjs',   // C1 host 集成：Mod 真实装载链路（compose+复制+peer 解析+可 import）
  'verify-userdata-migrate.mjs'         // C3-b userData 迁移：migrated/幂等/冲突/no-source/可重试/凭据字节一致
  ,'verify-kernel-resolve.mjs'           // C4-a 双层内核选择与崩溃自愈
  ,'verify-kernel-install.mjs'           // C4-b 离线签名/哈希安装门禁
  ,'verify-kernel-manager.mjs'           // C4-c/d/f 探针记录、切换/回退、受限接网源
]

/** 自启 Electron：内部 spawn 应用、连 CDP、跑完自己收拾干净，且无需真实模型。 */
const LIVE_HARNESSES = [
  'verify-image-host-service.mjs',      // 图片：工具面冒烟（spawn 真 app + CDP，验 image_convert 已注册）
  // verify-media-library 已退休：media 插件/工作台移除（2026-09-03 单一工作台）
]

/**
 * 需凭据的人工 GUI 验收：不在默认自动清单。
 * 无头环境（无真实模型 / API Key）会话不会渲染进侧栏，这些 harness 的
 * waitFor 会话行会超时并以明确原因失败。已验证：即使创建 workspace、
 * rename 赋予标题，会话行仍不进入 DOM。故归类为「需凭据人工 GUI」，
 * 由真实模型机器上的用户手动运行：
 *   node tests/run-acceptance.mjs --manual
 */
const MANUAL_HARNESSES = [
  'verify-screenshot-region.mjs',       // 截图：端到端（composer 按钮→overlay 选区→对话草稿插入）
  'verify-session-menu.mjs'            // 会话右键菜单结构（8 项存在 / 分享·新窗口 不存在）
]

/**
 * 已过期，**故意不跑**。
 * 保留记录是为了让"为什么少跑了这几个"有据可查，
 * 而不是让它们悄悄消失在通配符里。
 */
const OBSOLETE = [
  ['m8-ai-image-smoke.mjs', 'AI 图像功能已按要求删除（含模型）'],
  ['m5b-screenshot-scroll-smoke.mjs', '滚动截图已删除，只剩区域截图一种'],
  ['m2a-image-smoke.mjs', '旧单图模块已被统一画布取代（U6），含旧图片水印'],
  ['m1a-barcode-smoke.mjs', '单条码改为输入即时生成，"生成"按钮已移除'],
  // —— 以下因 v3 范围收敛（2026-08-22）移出清单：功能不在 v3，非回归 ——
  ['verify-auto-geometry.mjs', '条码/Auto 策略已移出 v3 范围'],
  ['verify-board-edges.mjs (+9 board-*)', '画布（Fabric）已移出 v3 范围'],
  ['verify-codabar-geometry.mjs (+8 码制 geometry)', '条码已移出 v3 范围'],
  ['verify-illustrator-ungrouped.mjs', 'Illustrator 联动已移出 v3 范围'],
  ['verify-wiring.mjs', '旧 Vanilla renderer 接线体检已移出 v3 范围'],
  ['verify-capture-shortcut.mjs', '旧 Vanilla renderer 已删除，harness 读取的 legacy/renderer/main.js 不存在'],
  ['verify-text-toolbar.mjs / editor-reopen / icon-sprite', '旧 Vanilla renderer UI 已移出 v3 范围'],
  ['verify-session-recent.mjs', '产品决策 P1：取消独立最近分组']
]

const mode = process.argv[2] || '--all'
const groups = []
if (mode === '--all' || mode === '--node') groups.push(['纯 Node', NODE_HARNESSES])
if (mode === '--all' || mode === '--live') groups.push(['真机（自启 Electron）', LIVE_HARNESSES])
if (mode === '--manual') groups.push(['需凭据人工 GUI', MANUAL_HARNESSES])
if (!groups.length) {
  console.error('用法：node tests/run-acceptance.mjs [--all|--node|--live|--manual]')
  process.exit(2)
}

if (groups.some(([, list]) => list === LIVE_HARNESSES) && !existsSync('out/main/index.js')) {
  console.error('❌ 缺少 out/main/index.js，真机 harness 无法运行。请先 npm run build')
  process.exit(2)
}

let failed = 0
let ran = 0
const failures = []

for (const [label, list] of groups) {
  console.log(`\n${'═'.repeat(58)}\n  ${label} · ${list.length} 个\n${'═'.repeat(58)}`)
  for (const name of list) {
    const path = `tests/${name}`
    if (!existsSync(path)) {
      console.log(`  ⚠ ${name.padEnd(36)} 文件缺失`)
      failures.push(`${name}（文件缺失）`)
      failed += 1
      continue
    }
    const started = Date.now()
    const result = spawnSync(process.execPath, [path], { encoding: 'utf8' })
    const seconds = ((Date.now() - started) / 1000).toFixed(1)
    ran += 1
    // 末行形如「通过 N 项，失败 M 项」，直接取来当摘要
    const summary = (result.stdout || '').trim().split('\n').filter(Boolean).pop() || ''
    if (result.status === 0) {
      console.log(`  ✅ ${name.padEnd(36)} ${summary.slice(0, 24).padEnd(26)} ${seconds}s`)
    } else {
      console.log(`  ❌ ${name.padEnd(36)} ${summary.slice(0, 24).padEnd(26)} ${seconds}s`)
      failures.push(name)
      failed += 1
      // 失败要能直接看到原因，不必再手动重跑一遍
      const detail = (result.stdout || '').split('\n').filter((l) => l.includes('❌')).slice(0, 6)
      for (const line of detail) console.log(`       ${line.trim()}`)
      if (result.stderr?.trim()) console.log(`       stderr: ${result.stderr.trim().split('\n')[0]}`)
    }
  }
}

console.log(`\n${'─'.repeat(58)}\n  已跳过 ${OBSOLETE.length} 个过期 harness（对应已删除的功能，非回归）：`)
for (const [name, why] of OBSOLETE) console.log(`    · ${name.padEnd(34)} ${why}`)

if (mode !== '--manual') {
  console.log(`\n${'─'.repeat(58)}\n  需凭据人工 GUI（默认跳过，不在自动清单；用 --manual 在有真实模型的机器上跑）：`)
  for (const name of MANUAL_HARNESSES) console.log(`    · ${name.padEnd(34)} 需真实模型 / API Key`)
}

console.log(`\n${'═'.repeat(58)}`)
const manualNote = mode === '--manual' ? '' : `，跳过 ${MANUAL_HARNESSES.length} 个需凭据人工项`
console.log(`  执行 ${ran} 个，失败 ${failed} 个${failures.length ? '：' + failures.join('、') : ''}${manualNote}`)
process.exit(failed === 0 ? 0 : 1)
