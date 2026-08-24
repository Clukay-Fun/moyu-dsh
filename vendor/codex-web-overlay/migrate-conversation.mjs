// S5 一次性迁移脚本：ui-conversation vendor bundle → Lucide 内联图标
import { readFileSync, writeFileSync } from 'node:fs'

const icons = JSON.parse(readFileSync(new URL('./tools/icons-lucide-1.33.0.json', import.meta.url), 'utf8'))
const f = 'vendor/codex-web-overlay/ui-conversation/client.js'
let t = readFileSync(f, 'utf8')
const assert = (c, m) => { if (!c) throw new Error('ASSERT FAIL: ' + m) }
const P = '_deepseek_ai_dsh_client_ui_primitives.'

// ---------- A. Composer 主按钮：手绘 svg 三元 → Lucide Square / ArrowUp ----------
{
  const startMarker = 'children: primaryStops ?'
  const start = t.indexOf(startMarker)
  assert(start >= 0, 'primary ternary')
  // 调用形如 (0, react_jsx_runtime.jsx)("svg", {...})：真正的参数括号在 ".jsx)" 之后
  function callEnd(from) {
    // from points at '(' of the jsx argument list
    let depth = 0, inStr = null, esc = false
    for (let i = from; i < t.length; i++) {
      const c = t[i]
      if (esc) { esc = false; continue }
      if (inStr) {
        if (c === '\\') esc = true
        else if (c === inStr) inStr = null
        continue
      }
      if (c === '"' || c === "'") { inStr = c; continue }
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) return i
      }
    }
    throw new Error('unbalanced at ' + from)
  }
  function argParen(afterIdx) {
    const head = t.indexOf('(0, react_jsx_runtime.jsx)', afterIdx)
    assert(head >= 0, 'jsx call after ' + afterIdx)
    const closeHead = t.indexOf(')', head)
    return t.indexOf('(', closeHead)
  }
  const p1 = argParen(start)
  const e1 = callEnd(p1)
  const sep = t.indexOf(' : ', e1)
  assert(sep >= 0 && sep < e1 + 20, 'ternary separator near ' + e1)
  const p2 = argParen(sep)
  const e2 = callEnd(p2)
  const replacement =
    'children: primaryStops ? (0, react_jsx_runtime.jsx)(moyuSquare, { size: 16 }) : (0, react_jsx_runtime.jsx)(moyuArrowUp, { size: 16 })'
  t = t.slice(0, start) + replacement + t.slice(e2 + 1)
}

// ---------- B. 机械全局替换 ----------
const repl = {
  IconChevronDownOutline14: ['moyuChevronDown', 7],
  IconChevronUpOutline14: ['moyuChevronUp', 2],
  IconChevronRightOutline14: ['moyuChevronRight', 1],
  IconSendOutline14: ['moyuArrowUp', 1], // 队列 steer 行的发送动作
  IconPlusOutline16: ['moyuPaperclip', 1], // 输入区 "+"：附件/命令入口
  IconEditOutline16: ['moyuPencil', 1],
  IconCopyOutline16: ['moyuCopy', 1],
  IconBranchOutline16: ['moyuGitFork', 1],
  IconTrashOutline16: ['moyuTrash2', 1],
  IconCloseOutline16: ['moyuX', 1],
  IconChecklistOutline14: ['moyuListTodo', 1], // TodoPanel 引导图标
}
for (const orig of Object.keys(repl).sort((a, b) => b.length - a.length)) {
  const [name, count] = repl[orig]
  const needle = P + orig
  let c = 0
  while (t.includes(needle)) { t = t.replace(needle, name); c++ }
  assert(c === count, `${orig} expected ${count} got ${c}`)
}
// 复制成功态对勾 → Lucide Check
{
  let n = 0
  const needle = P + 'IconCheckOutline16'
  while (t.includes(needle)) { t = t.replace(needle, 'moyuCheck'); n++ }
  assert(n === 2, 'Check occurrences ' + n)
}

// ---------- C. 注入适配层 ----------
const NEED = ['ArrowUp','Square','Paperclip','ChevronDown','ChevronUp','ChevronRight','Pencil','Copy','Check','GitFork','Trash2','X','ListTodo']
const data = {}
for (const n of NEED) { assert(icons[n], 'icon ' + n); data[n] = icons[n] }
const anchor = t.match(/let \w+ = require\("[^"]+"\);/)[0]
const adapter = [
  '',
  '\t\t// === MoyuIcon：Lucide 内联图标适配层 ===',
  '\t\t// 图标数据提取自 lucide-react@1.33.0（ISC License）dist/esm/icons 的 __iconNode，构建期手工内联。',
  '\t\t// 纯构建期内联：无任何 lucide 运行时 require。默认 16px / strokeWidth 1.75 / aria-hidden。',
  '\t\tconst MOYU_LUCIDE = ' + JSON.stringify(data) + ';',
  '\t\tfunction MoyuLucideIcon(props) {',
  '\t\t\tconst size = props.size || 16;',
  '\t\t\treturn react_jsx_runtime.jsx("svg", {',
  '\t\t\t\txmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24",',
  '\t\t\t\tfill: "none", stroke: "currentColor", strokeWidth: props.strokeWidth || 1.75,',
  '\t\t\t\tstrokeLinecap: "round", strokeLinejoin: "round",',
  '\t\t\t\tclassName: props.className, style: props.style,',
  '\t\t\t\t"aria-hidden": "true", focusable: "false",',
  '\t\t\t\tchildren: props.node.map((entry, index) => react_jsx_runtime.jsx(entry[0], entry[1], index))',
  '\t\t\t});',
  '\t\t}',
]
for (const n of NEED) adapter.push('\t\tconst moyu' + n + ' = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.' + n + ' }, props));')
t = t.replace(anchor, anchor + '\n' + adapter.join('\n'))

writeFileSync(f, t)
console.log('OK | primitives Icon refs left:', (t.match(new RegExp(P.replace(/\//g, '\\/') + 'Icon', 'g')) || []).length)
console.log('lucide runtime require present:', t.includes('require("lucide-react")'))
