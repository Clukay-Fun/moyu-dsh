// Illustrator COM 连接诊断（F-14）
//
// 目的：查清「为什么连不上 Illustrator」，而不是继续显示
//      「请确认 Adobe 软件已安装」这种笼统提示——软件装了不等于
//      Illustrator.Application 这个 ProgID 已正确注册。
//
// 用法（目标 Windows 机器，仓库根目录）：
//     node scripts/diagnose-illustrator-com.mjs
//     node scripts/diagnose-illustrator-com.mjs --launch   # 允许真的启动 Illustrator
//
// 为什么用 Node 而不是 PowerShell：这台开发机（macOS）装不了 PowerShell，
// 写出来的 PS1 无法做任何校验；而 Node 的解析逻辑可以在 mac 上用固定样本
// 测过再交付。更重要的是，只有 Node 能测到**应用真正用的那条 winax 路径**。
import { execFileSync } from 'node:child_process'
import { openSync, readSync, closeSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const LAUNCH = process.argv.includes('--launch')
const line = (k, v) => console.log(`  ${String(k).padEnd(30)} ${v}`)
const section = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 46 - t.length))}`)

if (process.platform !== 'win32') {
  console.error('本脚本只在 Windows 上有意义（当前平台：' + process.platform + '）')
  process.exit(2)
}

/** 跑 reg query，失败返回 null 而不是抛错——键不存在是常见且有意义的结果。 */
export function regQuery(path, extra = []) {
  try {
    return execFileSync('reg', ['query', path, ...extra], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { return null }
}

/** 从 reg query 输出里取默认值（REG_SZ 的 `(默认)` / `(Default)` 行）。 */
export function parseDefaultValue(output) {
  if (!output) return null
  for (const raw of output.split(/\r?\n/)) {
    const m = raw.match(/^\s*\((?:默认|Default)\)\s+REG_\w+\s+(.*)$/)
    if (m) return m[1].trim()
  }
  return null
}

/** 从子键列表里挑出符合前缀的 ProgID。 */
export function parseSubKeys(output, prefix) {
  if (!output) return []
  return output.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('HKEY_'))
    .map((l) => l.split('\\').pop())
    .filter((name) => name && name.startsWith(prefix))
}

/** 从命令行里剥出可执行文件路径：带引号取引号内，否则截到第一个参数前。 */
export function extractExePath(command) {
  if (!command) return null
  const quoted = command.match(/^"([^"]+)"/)
  if (quoted) return quoted[1]
  const cut = command.search(/\s+[-/]/)
  return (cut > 0 ? command.slice(0, cut) : command).trim()
}

/** 读 PE 头判断 exe 位数。位数不匹配是 COM 连不上最常见、也最容易漏的原因。 */
export function exeBitness(path) {
  if (!path || !existsSync(path)) return '文件不存在'
  let fd
  try {
    fd = openSync(path, 'r')
    const head = Buffer.alloc(4)
    readSync(fd, head, 0, 4, 0x3c)
    const peOffset = head.readUInt32LE(0)
    const machineBuf = Buffer.alloc(2)
    readSync(fd, machineBuf, 0, 2, peOffset + 4)
    const machine = machineBuf.readUInt16LE(0)
    return { 0x8664: 'x64', 0x014c: 'x86', 0xaa64: 'ARM64' }[machine] || `未知(0x${machine.toString(16)})`
  } catch (e) {
    return `读取失败：${e.message}`
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

/** ProgID → CLSID → 服务器 exe → 位数 */
function resolveProgId(progId) {
  const base = `HKCR\\${progId}`
  if (!regQuery(base)) return null
  const clsid = parseDefaultValue(regQuery(`${base}\\CLSID`))
  const curVer = parseDefaultValue(regQuery(`${base}\\CurVer`))
  let kind = null; let server = null
  if (clsid) {
    for (const k of ['LocalServer32', 'InprocServer32']) {
      const raw = parseDefaultValue(regQuery(`HKCR\\CLSID\\${clsid}\\${k}`))
      if (raw) { kind = k; server = extractExePath(raw); break }
    }
  }
  return { progId, clsid, curVer, kind, server, bits: server ? exeBitness(server) : null }
}

// ── 环境 ────────────────────────────────────────────────────
section('环境')
line('Node 版本', process.version)
line('Node 位数', process.arch)
line('系统架构', process.env.PROCESSOR_ARCHITECTURE || '(未知)')
console.log('  注意：应用打的是 x64。若下方服务器 exe 是 x86，位数不匹配本身就会让连接失败。')

// ── 通用 ProgID ─────────────────────────────────────────────
section('通用 ProgID：Illustrator.Application')
const generic = resolveProgId('Illustrator.Application')
if (!generic) {
  line('结果', '❌ 未注册 —— 这就是当前连不上的直接原因')
} else {
  line('CLSID', generic.clsid || '（无）')
  line('CurVer 指向', generic.curVer || '（无 CurVer）')
  line('服务器类型', generic.kind || '❌ 未找到 LocalServer32/InprocServer32')
  line('服务器路径', generic.server || '—')
  line('服务器位数', generic.bits || '—')
}

// ── 版本化 ProgID ───────────────────────────────────────────
section('版本化 ProgID：Illustrator.Application.NN')
const versioned = parseSubKeys(regQuery('HKCR', ['/f', 'Illustrator.Application', '/k']), 'Illustrator.Application.')
if (!versioned.length) {
  line('结果', '未发现版本化 ProgID')
} else {
  for (const v of versioned) {
    const r = resolveProgId(v)
    line(v, r ? `CLSID=${r.clsid} ${r.kind}=${r.server?.split('\\').pop()} 位数=${r.bits}` : '解析失败')
  }
}

// ── 注册位置 ────────────────────────────────────────────────
section('注册位置（三处可能同时存在，取值不同）')
for (const [name, path] of [
  ['HKLM 机器级', 'HKLM\\Software\\Classes\\Illustrator.Application'],
  ['HKCU 用户级', 'HKCU\\Software\\Classes\\Illustrator.Application'],
  ['WOW6432Node（32 位视图）', 'HKLM\\Software\\Classes\\WOW6432Node\\Illustrator.Application']
]) {
  line(name, regQuery(path) ? '存在' : '不存在')
}

// ── 已安装版本 ──────────────────────────────────────────────
section('已安装的 Illustrator')
let found = 0
for (const root of [
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
]) {
  const out = regQuery(root, ['/s', '/f', 'Illustrator', '/d'])
  if (!out) continue
  for (const m of out.matchAll(/DisplayName\s+REG_SZ\s+(.*Illustrator.*)/g)) {
    line('卸载表条目', m[1].trim()); found += 1
  }
}
if (!found) line('卸载表', '未找到 Illustrator 条目')

// ── 运行状态 ────────────────────────────────────────────────
section('运行状态')
let running = false
try {
  const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Illustrator.exe'], { encoding: 'utf8' })
  running = /Illustrator\.exe/i.test(out)
} catch { /* tasklist 不可用时按未运行处理 */ }
line('Illustrator 进程', running ? '✅ 正在运行' : '未运行')
if (!running) {
  console.log('  提示：手动启动 Illustrator 后再跑一次，能区分「连不上已运行实例」与「根本没注册」。')
}

// ── winax 实测：应用真正用的那条路 ──────────────────────────
section('winax 连接测试（与应用同一条路径）')
let winax = null
try {
  const require = createRequire(import.meta.url)
  winax = require('winax')
  line('winax 模块', '✅ 已加载')
} catch (e) {
  line('winax 模块', `❌ 加载失败：${e.message}`)
  console.log('  winax 是可选依赖，未装或未编译时 COM 功能整体不可用。')
}
if (winax) {
  const ladder = ['Illustrator.Application', ...versioned]
  for (const id of ladder) {
    // activate: true = 优先连已运行实例，不另起进程
    try {
      const app = new winax.Object(id, { activate: true })
      line(`连接 ${id}`, `✅ 成功  版本=${app.Version ?? '(读不到)'}`)
      break
    } catch (e) {
      line(`连接 ${id}`, `❌ ${String(e.message).split('\n')[0]}`)
    }
  }
  if (LAUNCH) {
    for (const id of ['Illustrator.Application', ...versioned]) {
      try {
        const app = new winax.Object(id, { activate: false })
        line(`启动 ${id}`, `✅ 成功  版本=${app.Version ?? '(读不到)'}`)
        break
      } catch (e) {
        line(`启动 ${id}`, `❌ ${String(e.message).split('\n')[0]}`)
      }
    }
  } else {
    console.log('  （未加 --launch，跳过「启动新实例」测试）')
  }
}

section('把完整输出回贴')
console.log('  实现将按这四点决定，不靠猜：')
console.log('    1. 通用 ProgID 是否注册     → 决定要不要做版本化回退')
console.log('    2. 服务器 exe 位数 vs x64   → 决定是否位数不匹配')
console.log('    3. 注册在 HKLM 还是 HKCU    → 决定是否需要提示「用同一用户身份运行」')
console.log('    4. 已运行实例能否连上       → 决定「先启动 Illustrator」是否可作兜底')
