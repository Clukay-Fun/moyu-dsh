// 构建门禁：确认 codex-web overlay 已正确应用到 DSH 运行闭包。
//
// 任一检查失败则以非零退出码中止构建，避免悄悄打出官方原始 UI
// （B3/B4 主界面调整是正式 Moyu 主界面的一部分，不是 dev 预览）。
//
// 检查内容：
//   1. 六个被 patch 的上游 client bundle 与 vendor/codex-web-overlay 源逐字节一致
//      （apply 脚本是 copyFile，因此一致 = 已正确应用；不一致 = 应用失败/版本不匹配）。
//   2. workspace bundle 含 B3/B4 关键标记：/moyu/session-export、group.recent、MenuItem（右键菜单）。
//   3. conversation bundle 含 B3 标记：Markdown（复制为 Markdown）。
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const closure = join(root, 'build/dsh-runtime/node_modules/@deepseek-ai')
const overlayDir = join(root, 'vendor/codex-web-overlay')
const PACKAGES = [
  'dsh-client-ui-layout', 'dsh-client-ui-sidebar', 'dsh-client-ui-settings',
  'dsh-client-ui-settings-general', 'dsh-client-ui-workspace', 'dsh-client-ui-conversation',
]
const WORKSPACE_MARKERS = [
  '/moyu/session-export', 'pinnedIds', 'MenuItem', 'if (session.blank) return false;',
  'createProject.title', 'sourcePath === null', 'renameWorkspace(workspace.workspaceId, title)',
]
const CONVERSATION_MARKERS = ['Markdown', 'HeroShell_module_css_default.glow', 'align-self:center', 'width:calc(100% + 136px)']
const LAYOUT_MARKERS = ['requested <= sidebarBase.current / 2', 'actions.collapseSidebar()', '!sidebarCollapsed || sidebarDragging']

// 用户可见品牌门禁：承载品牌的 bundle 必须落地 MOYU 品牌，且所有 overlay bundle
// 不得残留 DSH 原生品牌标记或首次启动的 DSH 0.1 开发者注意事项。
// 不扫描技术包名与第三方许可证。
const BRAND_BUNDLES = ['dsh-client-ui-sidebar', 'dsh-client-ui-conversation', 'dsh-client-ui-settings-general']
const BRAND_REQUIRED = ['MOYU DSH']
const BRAND_FORBIDDEN = [
  'BrandWordmark', 'FishLogo', '探索未至之境',
  'DSH 尚处测试阶段', '欢迎 Harness 开发者反馈', '加入 DSH 插件生态',
]

// S5 图标门禁：
//   1. 六个 bundle 一律不得出现 lucide 运行时 require（图标是构建期内联数据，无运行时依赖）。
//   2. 已迁移 bundle 必须含 MoyuIcon 适配层与统一描边默认值（1.75）。
//   3. 已迁移 bundle 不得再引用被替换掉的 DSH primitives 图标。
//      （未迁移的低频图标不在清单内，属 S5.3 范围。）
const LUCIDE_MIGRATED_REPLACED = {
  'dsh-client-ui-sidebar': ['IconPanelLeftOutline16'],
  'dsh-client-ui-workspace': [
    'IconNewChatOutline16', 'IconChecklistOutline14', 'IconCordisPluginOutline14',
    'IconGlobeOutline14', 'IconPersonalizationOutline16', 'IconSearchOutline16',
    'IconProjectAddOutline16', 'IconPlusOutline16', 'IconTriangleRightFill14',
    'IconFolderClose16', 'IconFolderOpen16', 'IconFolderOpenOutline16',
    'IconEllipsisOutline16', 'IconEditOutline16', 'IconCopyOutline16',
    'IconArchiveOutline20', 'IconBranchOutline16', 'IconTrashOutline16', 'IconCloseFill14',
  ],
  'dsh-client-ui-conversation': [
    'IconChevronDownOutline14', 'IconChevronUpOutline14', 'IconChevronRightOutline14',
    'IconSendOutline14', 'IconPlusOutline16', 'IconEditOutline16', 'IconCopyOutline16',
    'IconBranchOutline16', 'IconTrashOutline16', 'IconCloseOutline16',
    'IconChecklistOutline14', 'IconCheckOutline16',
  ],
}

let failed = 0
const fail = (msg) => { console.error(`  ❌ ${msg}`); failed += 1 }

for (const pkg of PACKAGES) {
  const target = join(closure, pkg, 'lib/client.js')
  const source = join(overlayDir, pkg.replace('dsh-client-', ''), 'client.js')
  let targetText, sourceText
  try { targetText = await readFile(target, 'utf8') } catch { fail(`${pkg} 闭包 bundle 缺失（overlay 未应用？）`); continue }
  try { sourceText = await readFile(source, 'utf8') } catch { fail(`${pkg} overlay 源缺失`); continue }
  if (targetText !== sourceText) fail(`${pkg} 闭包 bundle 与 overlay 源不一致（应用失败或版本不匹配）`)
  if (BRAND_BUNDLES.includes(pkg)) for (const need of BRAND_REQUIRED) if (!sourceText.includes(need)) fail(`${pkg} 缺少 MOYU 品牌标记（${need}）`)
  for (const banned of BRAND_FORBIDDEN) if (sourceText.includes(banned)) fail(`${pkg} 仍含 DSH 品牌/欢迎注意事项：${banned}`)
  if (sourceText.includes('require("lucide-react")')) fail(`${pkg} 出现 lucide 运行时 require（图标必须内联）`)
  const replaced = LUCIDE_MIGRATED_REPLACED[pkg]
  if (replaced) {
    if (!sourceText.includes('function MoyuLucideIcon')) fail(`${pkg} 缺少 MoyuIcon 适配层`)
    if (!sourceText.includes('strokeWidth: props.strokeWidth || 1.75')) fail(`${pkg} 适配层描边默认值不是 1.75`)
    for (const icon of replaced) {
      if (sourceText.includes(`_deepseek_ai_dsh_client_ui_primitives.${icon}`)) fail(`${pkg} 仍在使用被替换的 DSH 图标：${icon}`)
    }
  }
}

const wsText = await readFile(join(closure, 'dsh-client-ui-workspace/lib/client.js'), 'utf8').catch(() => '')
for (const m of WORKSPACE_MARKERS) if (!wsText.includes(m)) fail(`workspace bundle 缺少 B3/B4 标记：${m}`)
const convText = await readFile(join(closure, 'dsh-client-ui-conversation/lib/client.js'), 'utf8').catch(() => '')
for (const m of CONVERSATION_MARKERS) if (!convText.includes(m)) fail(`conversation bundle 缺少 B3 标记：${m}`)
if (convText.includes('hero && (0, react_jsx_runtime.jsx)(HeroGlow')) fail('conversation 光晕仍挂在整张 composer 上，未跟随标题宽度')
const layoutText = await readFile(join(closure, 'dsh-client-ui-layout/lib/client.js'), 'utf8').catch(() => '')
for (const m of LAYOUT_MARKERS) if (!layoutText.includes(m)) fail(`layout bundle 缺少侧栏拖拽吸附标记：${m}`)

if (failed) {
  console.error(`\noverlay 门禁失败：${failed} 项。构建已中止，未产出官方原始 UI 的 DMG。`)
  process.exit(1)
}
console.log('✅ overlay 门禁通过：codex-web 主界面已正确应用到闭包（含 B3/B4 标记与 S5 图标内联检查）。')
