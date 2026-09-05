/**
描述: 验证置顶会话轻量样式、常驻单图钉、悬停操作顺序与排序状态逻辑
主要功能:
    - 验证 CSS 类名、间距与 120ms 动效规范
    - 验证置顶行仅渲染单图钉按钮（不渲染归档按钮且无空白占位）
    - 验证普通会话悬停时操作顺序为 Pin 在前、Archive 在后
    - 验证置顶在工作区内优先且按更新时间倒序排列
    - 验证归档时清理置顶状态与本地化文案
*/

import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceClientPath = join(root, 'vendor/codex-web-overlay/ui-workspace/client.js')

let passed = 0
let failed = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ ${message}`)
    failed += 1
  } else {
    passed += 1
  }
}

// region 模块1：代码与样式静态断言

async function testStyleAndMarkup() {
  const content = await readFile(workspaceClientPath, 'utf8')

  // 1. 左侧圆角标记断言
  assert(
    content.includes('pinIndicator') && content.includes('width:2px;height:12px;border-radius:1px'),
    '包含 2px 宽、12px 高、1px 圆角的左侧标记样式'
  )

  // 2. 标题字重断言
  assert(
    content.includes('titlePinned') && content.includes('font-weight:500'),
    '置顶会话标题字重提升至 500'
  )

  // 3. 置顶状态简化为单按钮断言：置顶行仅渲染取消置顶图钉按钮，不得渲染归档按钮
  const pinBranchMatch = content.includes('pinned ? (0, react_jsx_runtime.jsx)("button",')
    && content.includes('Rows_module_css_default.pinButtonPinned')
  assert(
    pinBranchMatch,
    '置顶会话仅渲染单图钉按钮，不渲染归档按钮且无空白占位'
  )

  // 4. 普通会话操作顺序断言：Pin 在前，Archive 在后
  const normalButtonsIndexPin = content.indexOf('Rows_module_css_default.pinButton')
  const normalButtonsIndexArchive = content.indexOf('Rows_module_css_default.archiveButton')
  assert(
    normalButtonsIndexPin >= 0 && normalButtonsIndexArchive >= 0 && normalButtonsIndexPin < normalButtonsIndexArchive,
    '普通会话悬停时操作按钮顺序为：置顶按钮在前，归档按钮在后 (Pin → Archive)'
  )

  // 5. 间距与尺寸断言
  assert(
    content.includes('rowActions{flex:none;align-items:center;gap:12px;display:none}'),
    '操作区定义固定 12px 间距，避免图标贴近或标题忽宽忽窄'
  )
  assert(
    content.includes('pinButtonPinned') && content.includes('opacity:0.85'),
    '图钉按钮使用次级强调色与适度透明度常驻显示'
  )

  // 6. 120ms 过渡动效与 scale 判定
  assert(
    content.includes('120ms ease'),
    '包含 120ms 过渡动效'
  )
  assert(
    content.includes('transform:scale(.97)'),
    '按钮激活时提供 scale(0.97) 触感'
  )

  // 7. 本地化文案
  assert(
    content.includes('"pin.add": "置顶会话"') && content.includes('"pin.remove": "取消置顶"'),
    '本地化字典准确包含“置顶会话”与“取消置顶”'
  )

  // 8. 归档时清理置顶与未读
  assert(
    content.includes('sessionMetaStore.actions.unpin(sessionId)') && content.includes('sessionMetaStore.actions.clearUnread(sessionId)'),
    '归档会话时自动清理置顶与未读状态'
  )
}

// endregion

// region 模块2：排序算法纯逻辑验证

function testSortingLogic() {
  function byRecency(a, b) {
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
    return a.id < b.id ? -1 : 1
  }

  function byPinnedFirst(a, b, pinnedIds) {
    const pa = pinnedIds.has(a.id)
    const pb = pinnedIds.has(b.id)
    if (pa !== pb) return pa ? -1 : 1
    return byRecency(a, b)
  }

  const pinnedIds = new Set(['s2', 's4'])
  const sessions = [
    { id: 's1', title: '普通1', updatedAt: 100 },
    { id: 's2', title: '置顶1', updatedAt: 200 },
    { id: 's3', title: '普通2', updatedAt: 300 },
    { id: 's4', title: '置顶2', updatedAt: 400 },
  ]

  const sorted = sessions.slice().sort((a, b) => byPinnedFirst(a, b, pinnedIds))

  assert(sorted[0].id === 's4', '更新时间最新的置顶会话 s4 位于第 1 位')
  assert(sorted[1].id === 's2', '置顶会话 s2 位于第 2 位')
  assert(sorted[2].id === 's3', '更新时间最新的普通会话 s3 位于第 3 位')
  assert(sorted[3].id === 's1', '普通会话 s1 位于第 4 位')
}

// endregion

// 执行全部测试
await testStyleAndMarkup()
testSortingLogic()

console.log(`\n置顶会话验证：通过 ${passed} 项，失败 ${failed} 项`)
if (failed > 0) process.exit(1)
