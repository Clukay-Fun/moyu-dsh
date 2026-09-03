// DSH Host 的生命周期与窄桥（v3.0.0 §3.1、§3.4）。
//
// 每次启动是一个 generation：独立端口、独立随机 token、独立 origin。
// Host 崩溃重启会换代，旧 token 与旧端口一并作废（M0a 收口已实测）。
import { app } from 'electron'
import { fork as forkChild } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { cp, mkdir, rm, mkdtemp, writeFile, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { dispatchBridgeCall } from './bridge.js'
import { createHostServiceClient } from './service-bridge.js'
import { applyModsToProfile, seedPreinstalledMods, resolveActiveModManifests, buildEffectiveToolPolicy } from './mods.js'
import { resolveActiveKernel, markKernelHealthy, kernelRoot, readManifest, recordKernelProbe, validateInstalledKernel } from './kernel.js'
import { writeFile as writeFileAsync, readFile as readFileAsync } from 'node:fs/promises'

const READY_TIMEOUT_MS = 30_000
const RUNTIME_COMPLETE_MARKER = '.complete.json'

// 内置只读回退内核（出厂版，永远可用）。C4：用户目录可切换内核经 kernel.js 解析。
function builtinRuntimeRoot() {
  return app.isPackaged
    ? join(process.resourcesPath, 'dsh-runtime')
    : join(app.getAppPath(), 'build', 'dsh-runtime')
}

export function builtinVersion() {
  try {
    return JSON.parse(readFileSync(join(builtinRuntimeRoot(), RUNTIME_COMPLETE_MARKER), 'utf8')).dshVersion || null
  } catch { return null }
}

// 本代激活内核（C4-a）。首次解析后缓存，供 runtimeRoot()/resolveDshEntry() 同步读。
let activeKernel = null
export async function ensureActiveKernel() {
  if (activeKernel) return activeKernel
  activeKernel = await resolveActiveKernel({
    userDataDir: app.getPath('userData'),
    builtinRoot: builtinRuntimeRoot(),
    builtinVersion: builtinVersion(),
    shellVersion: app.getVersion(),
    log: (m) => console.error(m),
  })
  return activeKernel
}

/** current.json 切换后让下一代 Host 重新解析；只由受控 Kernel Manager 调用。 */
export function resetActiveKernel() {
  activeKernel = null
}

// 解析后同步读取本代内核根；未解析时保守回内置。
function runtimeRoot() {
  return activeKernel?.root || builtinRuntimeRoot()
}

function assertRuntimeComplete(root) {
  const marker = join(root, RUNTIME_COMPLETE_MARKER)
  if (!existsSync(marker)) {
    throw new Error(`DSH 运行闭包未完成：缺少 ${marker}（build:dsh-runtime 可能被中断）`)
  }
}

function workerPath() {
  if (app.isPackaged) return join(process.resourcesPath, 'workers', 'dsh-host-worker.mjs')
  const appWorker = join(app.getAppPath(), 'resources', 'dsh-host-worker.mjs')
  return existsSync(appWorker) ? appWorker : join(process.cwd(), 'resources', 'dsh-host-worker.mjs')
}

/**
 * 由 main 解析 DSH 入口再传给 worker。
 *
 * worker 被 extraResources 放在 Resources/workers 下，它的 require 解析路径**不包含**
 * Resources/app.asar/node_modules；让 worker 自己 require.resolve 在打包产物里必然失败。
 * main 打进 asar，从这里解析才能命中生产依赖。
 */
export function resolveDshEntry() {
  // C4-a：激活的是用户目录内核时，从内核闭包解析入口（打包与 dev 一致）。
  if (activeKernel?.source === 'user') {
    const root = runtimeRoot()
    assertRuntimeComplete(root)
    const entry = join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    if (!existsSync(entry)) {
      throw new Error(`DSH 用户内核闭包缺失：${entry}`)
    }
    return entry
  }
  // 打包后走 asar 外的独立运行闭包：DSH 的 profile loader 会建指向安装闭包的
  // 包级 symlink，链接指进 app.asar 时外部 profile 的 ESM import 无法回穿。
  if (app.isPackaged) {
    const root = runtimeRoot()
    assertRuntimeComplete(root)
    const entry = join(
      root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'
    )
    if (!existsSync(entry)) {
      throw new Error(`DSH 运行闭包缺失：${entry}（构建时未执行 build:dsh-runtime？）`)
    }
    return entry
  }
  const require = createRequire(import.meta.url)
  try {
    return join(dirname(require.resolve('@deepseek-ai/dsh/package.json')), 'lib', 'bin.js')
  } catch {
    throw new Error('未找到 @deepseek-ai/dsh，请先安装 DSH 运行时')
  }
}

export function dshHome() {
  return process.env.MOYU_DSH_HOME || join(app.getPath('userData'), 'dsh')
}

/**
 * 首次启动时把构建期生成的 profile 模板铺到 DSH_HOME。
 *
 * 运行期不跑 npm/pnpm：既要联网，也和 §9「不在用户机器上动态替换核心」冲突。
 * 已存在则原样保留，不覆盖用户的会话与设置。
 */
/** 用户可安装 Mod 目录（A3）。与内核 kernels/ 同级，位于 userData 下、可写；测试可用 MOYU_MODS_HOME 覆盖。 */
export function modsHome() {
  return process.env.MOYU_MODS_HOME || join(app.getPath('userData'), 'mods')
}

/** C2-g 第一层：工具面策略启动快照路径（绝对路径经 MOYU_TOOL_POLICY_PATH 传给 Host）。 */
export function toolPolicyPath() {
  return join(modsHome(), 'effective-tool-policy.json')
}

/**
 * C2-g 第一层：Host 启动前生成不可变工具面策略快照。
 * 从同一份 registry 解析 active Mod（校验/兼容/完整性），与核心内置台账汇聚出 globalExpected。
 * 冲突（同名 Tool / Mod 声明与核心台账冲突）=安全不变量损坏，抛错阻止启动。
 */
async function writeToolPolicy(env) {
  const modsDir = modsHome()
  const { active, skipped } = await resolveActiveModManifests(modsDir, env)
  for (const s of skipped) console.log(`[moyu-mods] 策略快照跳过 ${s.id}: ${s.reason}`)
  const policy = buildEffectiveToolPolicy(active) // 冲突时抛错 → 阻止启动
  await mkdir(modsDir, { recursive: true })
  await writeFileAsync(toolPolicyPath(), `${JSON.stringify(policy, null, 2)}\n`, 'utf8')
  return policy
}

/** C2-b：把出厂预装 Mod 播种到 userData/mods（首个版本一次），尊重用户后续状态。失败不阻塞启动。 */
async function ensurePreinstalledMods() {
  try {
    const preinstalledDir = join(runtimeRoot(), 'preinstalled-mods')
    const res = await seedPreinstalledMods({ preinstalledDir, modsDir: modsHome() })
    if (res.seeded.length) console.log('[moyu-mods] 预装 Mod 已播种：', res.seeded.join(', '))
  } catch (e) {
    console.error('[moyu-mods] 预装 Mod 播种失败（不阻塞启动）：', e?.message ?? e)
  }
}

/**
 * C1/C2：把已启用 Mod 注入 profile composition（compose patch + 复制 package 进闭包）。
 * 空注册表 → no-op（启动行为与今日一致）；单 Mod 失败只跳过并告警，不阻塞启动。
 */
async function applyEnabledMods(profileDir) {
  try {
    const result = await applyModsToProfile({ modsDir: modsHome(), profileDir })
    for (const s of result.skipped) console.error(`[moyu-mods] 跳过 ${s.id}/${s.name}: ${s.reason}`)
  } catch (e) {
    console.error('[moyu-mods] 应用 Mod 失败，回退纯核心 composition：', e?.message ?? e)
  }
}

export async function ensureProfile(profileName) {
  // C4-a：在任何 runtimeRoot() 消费者之前解析本代激活内核（含失败自愈降级）。
  await ensureActiveKernel()
  const home = dshHome()
  const profileDir = join(home, 'profiles', profileName)
  const root = runtimeRoot()
  assertRuntimeComplete(root)
  const template = join(root, 'home-template')
  const source = join(template, 'profiles', profileName)
  if (!existsSync(source)) {
    throw new Error(`profile 模板缺失：${source}（构建时未执行 build:dsh-runtime？）`)
  }
  await mkdir(join(home, 'profiles'), { recursive: true })

  // C2-b：先播种出厂预装 Mod（写 userData/mods + 注册表），再由 applyEnabledMods 注入 composition
  await ensurePreinstalledMods()

  // 同步内置 agent-presets 模板到 DSH_HOME/.agent-presets（干净安装与升级均必须同步）
  const sourcePresets = join(template, '.agent-presets')
  const targetPresets = join(home, '.agent-presets')
  if (existsSync(sourcePresets)) {
    await mkdir(targetPresets, { recursive: true })
    await cp(sourcePresets, targetPresets, { recursive: true, dereference: false })
  }

  if (!existsSync(profileDir)) {
    await cp(source, profileDir, { recursive: true, dereference: false })
    await applyEnabledMods(profileDir)
    await writeToolPolicy()
    return profileDir
  }

  // profile 是应用拥有的唯一 Moyu composition，不是用户可安装插件的目录。升级时同步
  // 受控 manifest、patch 与 node_modules 模板，保留同一 DSH_HOME 下的会话、设置与其他用户
  // 数据。否则首次安装后新增插件/依赖永远进不了旧 profile，表现为“新包已交付但功能不存在”。
  await Promise.all([
    cp(join(source, 'package.json'), join(profileDir, 'package.json')),
    cp(join(source, 'cordis.patch.yml'), join(profileDir, 'cordis.patch.yml'))
  ])
  const sourceModules = join(source, 'node_modules')
  const installedModules = join(profileDir, 'node_modules')
  await rm(installedModules, { recursive: true, force: true })
  await cp(sourceModules, installedModules, { recursive: true, dereference: false })

  await applyEnabledMods(profileDir)
  await writeToolPolicy()
  return profileDir
}

/**
 * 启动一代 Host，等待 ready。
 *
 * token 只经进程 IPC 下发，不进环境变量、命令行、配置文件和日志。
 */
export async function startHostGeneration(generation, {
  onStdout, profile, dshBin: dshBinOverride, home: homeOverride,
  policyPath: policyPathOverride, confirmHealthy = true,
} = {}) {
  const token = randomBytes(32).toString('base64url')
  // 入口解析必须发生在 fork 前；否则解析失败时 child 已创建、外层又拿不到 host，
  // 会留下一个永远等 host-auth 的 utility process。
  const dshBin = dshBinOverride || resolveDshEntry()
  const hostHome = homeOverride || dshHome()
  // 使用 Electron 自带的 Node 运行时，不依赖用户机器上的外挂 Node。utilityProcess
  // 在打包产物中创建的 Chromium 服务进程无法被应用网络栈访问，B3.5 已实测否决。
  const child = forkChild(workerPath(), [], {
    execPath: process.execPath,
    // DSH 闭包里的 node-addon-require-builtin 需要它；M0a 已按此组合实测。
    execArgv: ['--expose-internals'],
    // 模型路径的截图确认由主进程的原生对话框（desktop.requestScreenCapture，
    // 带「本次会话内允许」复选框）单独负责。DSH 自带的审批层（permission /
    // ui-permission）由用户在设置里自行选择策略（含 full access），不在主进程钉死。
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: hostHome, MOYU_DSH_HOME: hostHome, MOYU_TOOL_POLICY_PATH: policyPathOverride || toolPolicyPath() },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    serialization: 'advanced'
  })

  const evidence = []
  const host = { child, token, generation, url: undefined, evidence }

  child.stdout?.on('data', (chunk) => onStdout?.(String(chunk)))
  child.stderr?.on('data', (chunk) => onStdout?.(String(chunk)))
  child.on('message', (message) => {
    if (message?.type === 'auth-evidence') evidence.push(message.evidence)
  })
  child.send({ type: 'host-auth', generation, token, dshBin, profile })

  try {
    host.url = await new Promise((resolve, reject) => {
      let reportedError
      let done = false
      const finish = (fn, value) => {
        if (done) return
        done = true
        clearTimeout(timer)
        child.off('message', onMessage)
        fn(value)
      }
      const timer = setTimeout(
        () => finish(reject, new Error('DSH Host 就绪超时')),
        READY_TIMEOUT_MS
      )
      const onMessage = (message) => {
        if (message?.type === 'host-error') {
          reportedError = message.message
          return
        }
        if (message?.type !== 'host-ready') return
        // C4-a：本代 Host 抵达 host-ready → 若跑的是用户内核，确认其健康，
        // 清除 lastAttempt，避免下代把它误判为"上一代崩溃"而降级。
        if (confirmHealthy && activeKernel?.source === 'user') {
          markKernelHealthy({ userDataDir: app.getPath('userData'), version: activeKernel.version, log: (m) => console.error(m) })
            .catch((e) => console.error('[kernel] 健康确认失败：', e?.message ?? e))
        }
        finish(resolve, message.url)
      }
      child.on('message', onMessage)
      child.once('exit', (code) => {
        // worker 自报的原因优先：退出码本身对用户没有意义。
        finish(reject, new Error(`DSH Host 在就绪前退出：${reportedError || `退出码 ${code}`}`))
      })
    })
  } catch (error) {
    // 超时与就绪前失败都必须回收这代 child：此时 startDsh 还没拿到 host，
    // 外层 catch 兜不住，漏掉就是一个游离的 utility process。
    await stopHost(host)
    throw error
  }

  return host
}

/**
 * C4-c：在隔离 DSH_HOME 中真实启动候选内核，host-ready 前仍执行现有 Tool 审计。
 * 不使用产品 DSH_HOME、不启动桌面桥、不读取或修改 current.json。
 */
export async function probeInstalledKernel({ userDataDir = app.getPath('userData'), version, onStdout } = {}) {
  const manifest = await readManifest(userDataDir, version)
  const root = kernelRoot(userDataDir, version)
  const check = validateInstalledKernel({
    root, manifest, platform: process.platform, arch: process.arch, shellVersion: app.getVersion(),
  })
  if (!check.ok) {
    const probe = await recordKernelProbe({ userDataDir, version, result: { ok: false, reason: check.reason } })
    return { ok: false, probe }
  }

  const probeRoot = await mkdtemp(join(tmpdir(), 'moyu-kernel-probe-'))
  let host
  try {
    const home = join(probeRoot, 'dsh')
    const template = join(root, 'home-template')
    await mkdir(join(home, 'profiles'), { recursive: true })
    // 候选闭包只读；探针的会话/数据库仍落隔离 home，profile 与 preset 只读链接到候选模板。
    await symlink(join(template, 'profiles', 'moyu'), join(home, 'profiles', 'moyu'), 'dir')
    if (existsSync(join(template, '.agent-presets'))) {
      await symlink(join(template, '.agent-presets'), join(home, '.agent-presets'), 'dir')
    }
    const policyPath = join(probeRoot, 'effective-tool-policy.json')
    await writeFile(policyPath, `${JSON.stringify(buildEffectiveToolPolicy([]), null, 2)}\n`, 'utf8')
    host = await startHostGeneration(Date.now(), {
      onStdout, profile: 'moyu',
      dshBin: join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
      home, policyPath, confirmHealthy: false,
    })
    const probe = await recordKernelProbe({ userDataDir, version, result: { ok: true } })
    return { ok: true, probe }
  } catch (error) {
    const reason = String(error?.message || error).slice(0, 240)
    const probe = await recordKernelProbe({ userDataDir, version, result: { ok: false, reason } })
    return { ok: false, probe }
  } finally {
    await stopHost(host).catch(() => {})
    await rm(probeRoot, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * 建立迁移期 main → Host image.* 调用方向。
 * progress 由调用方提供的回调继续推到对应 legacy WebContents；Host 退出会拒绝全部在途调用。
 */
export function serveHostServices(host) {
  host.services = createHostServiceClient(host)
  return host.services
}

/**
 * 在 main 侧提供桌面桥服务。
 *
 * 方向是 Host → main：dialog、clipboard、shell 只存在于主进程，Host 进程没有这些 API。
 * main 不通过这条通道反向调用 Host——Host 的健康状态由进程存活与 ready 决定。
 */
export function serveDesktopBridge(host, methods) {
  const onMessage = async (message) => {
    if (message?.type !== 'desktop-call') return
    const reply = await dispatchBridgeCall(methods, message)
    if (host.child.connected) host.child.send({ type: 'desktop-result', ...reply })
  }
  host.child.on('message', onMessage)
  host.child.send({ type: 'desktop-bridge-ready', generation: host.generation })

  host.bridge = {
    subject: methods.subject,
    registerFile(path) {
      return methods.registry.register(path)
    },
    close() {
      // 令牌随本代一起作废，旧 fileId 不得在新一代里复活。
      methods.registry?.clear()
      host.child.off('message', onMessage)
    }
  }
  return host.bridge
}

const STOP_TIMEOUT_MS = 5_000

export function stopHost(host) {
  if (!host || host.child.pid === undefined || host.child.exitCode !== null || host.child.signalCode !== null) {
    host?.services?.close()
    host?.bridge?.close()
    return Promise.resolve()
  }
  host.services?.close()
  host.bridge?.close()
  return new Promise((resolve) => {
    const child = host.child
    const pid = child.pid
    let graceTimer
    let reapTimer
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(graceTimer)
      clearTimeout(reapTimer)
      child.off('exit', finish)
      resolve()
    }
    const forceKill = () => {
      try {
        process.kill(pid, 'SIGKILL')
      } catch (error) {
        if (error?.code === 'ESRCH') return finish()
      }
      // SIGKILL 后正常会收到 exit；再给一个有界兜底，避免关闭链路永久等待。
      reapTimer = setTimeout(finish, 1_000)
    }
    child.once('exit', finish)
    graceTimer = setTimeout(forceKill, STOP_TIMEOUT_MS)
    if (!child.kill('SIGTERM')) forceKill()
  })
}
