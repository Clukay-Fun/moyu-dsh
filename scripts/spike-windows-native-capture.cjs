/**
 * Windows 原生区域截图 · 可行性 Spike（F-13）
 *
 * 为什么要先做 Spike 而不是直接改主流程：
 *   当前方案是「抓整屏位图 → 自建透明窗口框选」。它在 Windows 多显示器 /
 *   每屏不同 DPI 下会出现任务栏重影与未覆盖区域，根因有两条——
 *     ① 覆盖层用 `...display.bounds` 建，**只覆盖光标所在那一块屏**；
 *     ② `display.bounds` 是 DIP，抓取用的是物理像素，每屏 DPI 不同时对不上。
 *   继续补坐标很可能反复出错，所以先验证「改走系统原生截图」这条路能不能通。
 *
 * 本 Spike 只回答四个问题，不改任何产品代码：
 *   1. 能不能拉起 Windows 原生区域截图界面（ms-screenclip:）
 *   2. 结果能不能可靠地从剪贴板取回
 *   3. **取消**能不能被确定地判定（不能靠"等超时"，那会让取消延迟数十秒）
 *   4. 结束后能不能恢复并聚焦应用
 *
 * 用法（目标 Windows 机器，仓库根目录）：
 *     npx electron scripts/spike-windows-native-capture.cjs
 *
 * 会按提示做三轮：正常截图、中途取消、多显示器。全程只读剪贴板，不写文件。
 */
const { app, clipboard, screen, shell, BrowserWindow } = require('electron')
const { execFile } = require('node:child_process')

const log = (...a) => console.log(...a)
const item = (k, v) => log(`  ${String(k).padEnd(28)} ${v}`)
const section = (t) => log(`\n── ${t} ${'─'.repeat(Math.max(0, 44 - t.length))}`)

/** Win10 是 ScreenClippingHost，Win11 换成了 SnippingTool，两个都盯。 */
const SNIP_PROCESSES = ['ScreenClippingHost.exe', 'SnippingTool.exe', 'ScreenSketch.exe']

function tasklist() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8' }, (err, stdout) => {
      resolve(err ? '' : stdout)
    })
  })
}

async function snipRunning() {
  const out = await tasklist()
  return SNIP_PROCESSES.filter((name) => out.toLowerCase().includes(name.toLowerCase()))
}

/** 剪贴板图像指纹。空剪贴板返回 null，便于区分"本来就没有"和"没变化"。 */
function clipboardFingerprint() {
  const image = clipboard.readImage()
  if (image.isEmpty()) return null
  const png = image.toPNG()
  // 长度 + 首尾字节足以区分不同截图，不必算完整哈希
  return `${png.length}:${png.subarray(0, 16).toString('hex')}:${png.subarray(-16).toString('hex')}`
}

function ask(question) {
  return new Promise((resolve) => {
    process.stdout.write(`\n${question}`)
    process.stdin.resume()
    process.stdin.once('data', (d) => { process.stdin.pause(); resolve(String(d).trim()) })
  })
}

/**
 * 跑一轮原生截图。
 *
 * 取消判定的关键：**盯截图进程是否退出**，而不是干等超时。
 * 只靠超时的话，用户按 Esc 取消后还要再等几十秒程序才反应过来。
 */
async function runOnce({ timeoutMs = 120000 } = {}) {
  const before = clipboardFingerprint()
  const started = Date.now()

  await shell.openExternal('ms-screenclip:')

  // 先等截图界面真的起来，最多 5 秒——起不来说明这条路在这台机器上不通
  let appeared = []
  for (let i = 0; i < 50 && !appeared.length; i += 1) {
    await new Promise((r) => setTimeout(r, 100))
    appeared = await snipRunning()
  }
  if (!appeared.length) {
    return { verdict: 'no-ui', detail: '未检测到原生截图进程（可能被系统策略禁用或版本不支持）' }
  }

  let sawProcess = true
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 200))
    const now = clipboardFingerprint()
    if (now && now !== before) {
      const image = clipboard.readImage()
      const size = image.getSize()
      return {
        verdict: 'captured',
        elapsed: Date.now() - started,
        size,
        processes: appeared
      }
    }
    const alive = await snipRunning()
    if (!alive.length) {
      // 进程没了但剪贴板没变 → 用户取消。再宽限一拍，剪贴板写入可能略滞后。
      if (sawProcess) { sawProcess = false; continue }
      const late = clipboardFingerprint()
      if (late && late !== before) {
        return { verdict: 'captured', elapsed: Date.now() - started, size: clipboard.readImage().getSize(), processes: appeared, note: '剪贴板写入晚于进程退出' }
      }
      return { verdict: 'cancelled', elapsed: Date.now() - started, processes: appeared }
    }
    sawProcess = true
  }
  return { verdict: 'timeout', elapsed: Date.now() - started }
}

app.whenReady().then(async () => {
  if (process.platform !== 'win32') {
    log(`本 Spike 只在 Windows 上有意义（当前平台：${process.platform}）`)
    app.exit(2)
    return
  }

  section('显示器拓扑')
  log('  当前方案只覆盖"光标所在那一块屏"，多屏必然漏。原生方案由系统自己覆盖全部。')
  for (const d of screen.getAllDisplays()) {
    const b = d.bounds
    item(`显示器 ${d.id}`,
      `bounds=(${b.x},${b.y}) ${b.width}×${b.height}  缩放=${d.scaleFactor}×  ` +
      `${d.id === screen.getPrimaryDisplay().id ? '主屏' : ''}` +
      `${b.x < 0 || b.y < 0 ? '  ⚠ 负坐标' : ''}`)
  }
  const scales = new Set(screen.getAllDisplays().map((d) => d.scaleFactor))
  item('是否混合 DPI', scales.size > 1 ? `是（${[...scales].join(' / ')}）—— 当前方案的重灾区` : '否')

  // 隐藏一个真实窗口，验证"结束后能否恢复并聚焦"
  const probe = new BrowserWindow({ width: 480, height: 320, title: 'Spike 探针窗口' })
  await probe.loadURL('data:text/html,<h2 style="font:16px sans-serif">Spike 探针窗口</h2>')

  const rounds = [
    ['第 1 轮 · 正常截图', '请框选任意区域并完成。按回车开始…'],
    ['第 2 轮 · 中途取消', '截图界面出现后请按 Esc 取消。按回车开始…'],
    ['第 3 轮 · 跨显示器', '请在**非主屏**上框选。只有一块屏可跳过（直接输 skip）。按回车开始…']
  ]
  const results = []
  for (const [name, prompt] of rounds) {
    section(name)
    const answer = await ask(`  ${prompt} `)
    if (answer.toLowerCase() === 'skip') { results.push([name, { verdict: 'skipped' }]); continue }

    probe.hide()
    await new Promise((r) => setTimeout(r, 200))
    const result = await runOnce()
    // 无论成功失败都要还原——这条正是要验证的判据之一
    probe.show()
    probe.focus()
    await new Promise((r) => setTimeout(r, 300))

    item('判定', result.verdict)
    if (result.size) item('图像尺寸', `${result.size.width}×${result.size.height}`)
    if (result.elapsed !== undefined) item('耗时', `${result.elapsed} ms`)
    if (result.processes) item('截图进程', result.processes.join(', '))
    if (result.note) item('备注', result.note)
    item('探针窗口已恢复', probe.isVisible() ? '✅ 是' : '❌ 否')
    item('探针窗口已聚焦', probe.isFocused() ? '✅ 是' : '❌ 否（Windows 有前台锁定策略，需在实现里处理）')
    results.push([name, result])
  }

  section('结论')
  const verdicts = Object.fromEntries(results.map(([n, r]) => [n, r.verdict]))
  const captured = results.some(([, r]) => r.verdict === 'captured')
  const cancelled = results.some(([, r]) => r.verdict === 'cancelled')
  item('能拉起原生界面', results.some(([, r]) => r.verdict !== 'no-ui') ? '✅' : '❌')
  item('结果可从剪贴板取回', captured ? '✅' : '❌ / 未测到')
  item('取消可被确定判定', cancelled ? '✅（靠进程退出，不是等超时）' : '未测到')
  log('\n  逐轮：' + JSON.stringify(verdicts, null, 2).replace(/\n/g, '\n  '))
  log('\n  把以上完整输出回贴。三条都为 ✅ 才值得把主流程切到原生路径；')
  log('  否则回退到修覆盖层——但修的方向是"覆盖所有显示器 + 物理像素对齐"，')
  log('  不是加延时。')

  probe.destroy()
  app.exit(0)
})
