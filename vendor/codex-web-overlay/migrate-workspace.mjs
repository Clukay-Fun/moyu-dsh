// S5 一次性迁移脚本：ui-workspace vendor bundle → Lucide 内联图标
import { readFileSync, writeFileSync } from 'node:fs'

const icons = JSON.parse(readFileSync(new URL('./tools/icons-lucide-1.33.0.json', import.meta.url), 'utf8'))
const f = 'vendor/codex-web-overlay/ui-workspace/client.js'
let t = readFileSync(f, 'utf8')
const assert = (c, m) => { if (!c) throw new Error('ASSERT FAIL: ' + m) }
const P = '_deepseek_ai_dsh_client_ui_primitives.'

// ---------- A. 语义重写 ----------
// A1. IconFolderOpenOutline16 ×3：move 子项×2 → Folder；父项“移动到工作区” → FolderInput
{
  const needle = P + 'IconFolderOpenOutline16'
  const positions = []
  let i = -1
  while ((i = t.indexOf(needle, i + 1)) >= 0) positions.push(i)
  assert(positions.length === 3, 'FolderOpenOutline16 count ' + positions.length)
  for (let k = positions.length - 1; k >= 0; k--) {
    const pos = positions[k]
    const before = t.slice(Math.max(0, pos - 200), pos)
    let name
    if (before.includes('moveToWorkspace.none') || before.includes('ws.label')) name = 'moyuFolder'
    else if (before.includes('moveToWorkspace.title')) name = 'moyuFolderInput'
    else throw new Error('unknown FolderOpenOutline16 context @' + pos + ': ' + JSON.stringify(before.slice(-80)))
    t = t.slice(0, pos) + name + t.slice(pos + needle.length)
  }
}

// A2. copy-markdown 条目 → ClipboardCopy（其余 Copy 保持）
{
  const n0 = (t.match(/id: "copy-markdown",/g) || []).length
  assert(n0 === 1, 'copy-markdown entries in file ' + n0)
  const re = /(id: "copy-markdown",\s*\n\s*label: t\("copy\.markdown"\),\s*\n\s*icon: \(0, react_jsx_runtime\.jsx\)\()_deepseek_ai_dsh_client_ui_primitives\.IconCopyOutline16(, \{\}\))/g
  let n = 0
  t = t.replace(re, (_m, a, b) => { n++; return a + 'moyuClipboardCopy' + b })
  assert(n === 1, 'copy-markdown replaced ' + n)
}

// A3. SurfaceNavigation 三项导航图标按规范 18px
{
  let n = 0
  const re = /(icon: \(0, react_jsx_runtime\.jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.Icon(?:NewChatOutline16|ChecklistOutline14|CordisPluginOutline14), )\{\}\)/g
  t = t.replace(re, (_m, a) => { n++; return a + '{ size: 18 }' })
  assert(n === 3, 'nav items sized ' + n)
}

// A4. 手绘 PinIcon → Lucide Pin/PinOff（off 属性切换）；调用点传入状态
{
  // 调用点 ×2（菜单条目 + 行内按钮）传 pinned 状态
  let n = 0
  t = t.replace(/\(PinIcon, \{\}\)/g, () => { n++; return '(PinIcon, { off: pinned })' })
  assert(n === 2, 'PinIcon call sites ' + n)
}
{
  const start = t.indexOf('function PinIcon({ size = 16 }) {')
  assert(start >= 0, 'PinIcon def')
  const end = t.indexOf('\n\t\t}', start)
  const oldBody = t.slice(start, end + 5)
  const newBody = [
    'function PinIcon(props) {',
    '\t\t\treturn (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: props && props.off ? MOYU_LUCIDE.PinOff : MOYU_LUCIDE.Pin }, props));',
    '\t\t}',
  ].join('\n\t\t')
  t = t.replace(oldBody, newBody)
}
// A5. 手绘 MailIcon（标记未读）→ Lucide CircleDot
{
  const start = t.indexOf('function MailIcon({ size = 16 }) {')
  assert(start >= 0, 'MailIcon def')
  const end = t.indexOf('\n\t\t}', start)
  const oldBody = t.slice(start, end + 5)
  const newBody = [
    'function MailIcon(props) {',
    '\t\t\treturn (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.CircleDot }, props));',
    '\t\t}',
  ].join('\n\t\t')
  t = t.replace(oldBody, newBody)
}

// ---------- B. 机械全局替换（长名优先） ----------
const repl = {
  IconNewChatOutline16: ['moyuSquarePen', 1],
  IconChecklistOutline14: ['moyuListTodo', 2],
  IconCordisPluginOutline14: ['moyuBlocks', 2],
  IconGlobeOutline14: ['moyuGlobe', 1],
  IconPersonalizationOutline16: ['moyuSlidersHorizontal', 1],
  IconSearchOutline16: ['moyuSearch', 2],
  IconProjectAddOutline16: ['moyuFolderPlus', 1],
  IconPlusOutline16: ['moyuPlus', 2],
  IconTriangleRightFill14: ['moyuChevronRight', 1],
  IconFolderClose16: ['moyuFolder', 2],
  IconFolderOpen16: ['moyuFolderOpen', 1],
  IconEllipsisOutline16: ['moyuEllipsis', 1],
  IconEditOutline16: ['moyuPencil', 2],
  IconCopyOutline16: ['moyuCopy', 2], // A2 已转换 copy-markdown，剩 copy-session + 父项
  IconArchiveOutline20: ['moyuArchive', 2],
  IconBranchOutline16: ['moyuGitFork', 2],
  IconTrashOutline16: ['moyuTrash2', 1],
  IconCloseFill14: ['moyuX', 1],
}
for (const orig of Object.keys(repl).sort((a, b) => b.length - a.length)) {
  const [name, count] = repl[orig]
  const needle = P + orig
  let c = 0
  while (t.includes(needle)) { t = t.replace(needle, name); c++ }
  assert(c === count, `${orig} expected ${count} got ${c}`)
}

// ---------- C. 注入适配层（第一个 require 之后） ----------
const NEED = ['SquarePen','ListTodo','Blocks','GitFork','Globe','SlidersHorizontal','Search','X','FolderPlus','Plus','ChevronRight','Folder','FolderOpen','FolderInput','Ellipsis','Pencil','Copy','Archive','Trash2','ClipboardCopy','Pin','PinOff','CircleDot']
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
