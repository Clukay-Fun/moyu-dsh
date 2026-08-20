// 构建 DSH 运行闭包（v3.0.0 M0b B4 前置）。
//
// 为什么不直接靠 asar / asarUnpack：
//   DSH 的 profile loader 会在 $DSH_HOME/profiles/.../node_modules 建包级 symlink，
//   指向安装闭包。链接若指向 app.asar 内部，外部 profile 的 ESM import 无法回穿 asar。
//   而且 electron-builder 的依赖图不解析 peer / service-definition 边，实测漏掉 19 个
//   运行期真正需要的包（cordis-plugin-group、dsh-invariants、dsh-compaction、dsh-fs …）。
//
// 所以闭包交给 npm 自己解析，整目录作为 extraResources 放到 asar 外的真实文件系统里。
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'build', 'dsh-runtime')
const npmCache = join(root, 'build', '.npm-cache-dsh')

// 与根 package.json 保持同一个精确版本：不使用 dist-tag，也不用 caret。
const DSH_VERSION = '0.1.0-rc.7'

// 唯一产品 profile；不交付上游 standard/code/minimal/cordis。
export const PROFILE_NAME = 'moyu'

// profile 的界面基座；agent-presets 由 cordis.patch.yml 整体禁用，
// 因此不交付上游的 standard/code/minimal/cordis。
const SURFACE_BUNDLE = '@deepseek-ai/dsh-web-app'

const MOYU_PLUGINS = {
  '@moyu/dsh-credentials-desktop': 'dsh-credentials-desktop',
  '@moyu/dsh-plugin-legacy-tools': 'dsh-plugin-legacy-tools'
}

// 运行期必需、但 electron-builder 依赖图到不了的包。打包后必须逐个在场。
const REQUIRED_PACKAGES = [
  '@deepseek-ai/dsh',
  '@deepseek-ai/cordis',
  '@deepseek-ai/cordis-plugin-timer',
  '@deepseek-ai/cordis-plugin-group',
  '@deepseek-ai/cordis-plugin-loader',
  '@deepseek-ai/dsh-invariants',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-session'
]

async function main() {
  const pinnedDependencies = await readPinnedDeepseekDependencies()
  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  await writeFile(
    join(target, 'package.json'),
    `${JSON.stringify({
      name: 'moyu-dsh-runtime',
      private: true,
      version: '0.0.0',
      dependencies: pinnedDependencies
    }, null, 2)}\n`
  )

  console.log(`按根 lockfile 安装 DSH 运行闭包（${Object.keys(pinnedDependencies).length} 个精确包）→ build/dsh-runtime`)
  execFileSync(
    'npm',
    ['install', '--prefix', target, '--omit=dev', '--cache', npmCache],
    { stdio: 'inherit', cwd: root }
  )

  const modules = join(target, 'node_modules')
  const missing = REQUIRED_PACKAGES.filter((name) => !existsSync(join(modules, ...name.split('/'))))
  if (missing.length) {
    throw new Error(`DSH 运行闭包缺少必需包：${missing.join('、')}`)
  }

  const scoped = await readdir(join(modules, '@deepseek-ai')).catch(() => [])
  await assertRuntimePurity(modules, pinnedDependencies)
  console.log(`闭包就绪：@deepseek-ai/* ${scoped.length} 个包，必需包全部在场`)

  await buildProfileTemplate()
}

async function readPinnedDeepseekDependencies() {
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))
  const dependencies = {}
  for (const [path, entry] of Object.entries(lock.packages || {})) {
    const match = /^node_modules\/(\@deepseek-ai\/[^/]+)$/.exec(path)
    if (!match || !entry.version || !supportsCurrentPlatform(entry)) continue
    dependencies[match[1]] = entry.version
  }
  if (dependencies['@deepseek-ai/dsh'] !== DSH_VERSION) {
    throw new Error(`根 lockfile 的 DSH 版本不是 ${DSH_VERSION}`)
  }
  const drift = Object.entries(dependencies)
    .filter(([name, version]) => name.startsWith('@deepseek-ai/dsh') && version !== DSH_VERSION)
  if (drift.length) {
    throw new Error(`根 lockfile 已发生 DSH 版本漂移：${drift.map(([name, version]) => `${name}@${version}`).join('、')}`)
  }
  return Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)))
}

function supportsCurrentPlatform(entry) {
  return matchesConstraint(entry.os, process.platform) && matchesConstraint(entry.cpu, process.arch)
}

function matchesConstraint(values, current) {
  if (!Array.isArray(values) || values.length === 0) return true
  if (values.includes(`!${current}`)) return false
  const allowed = values.filter((value) => !value.startsWith('!'))
  return allowed.length === 0 || allowed.includes(current)
}

async function assertRuntimePurity(modules, pinnedDependencies) {
  const mismatches = []
  for (const [name, expected] of Object.entries(pinnedDependencies)) {
    const manifestPath = join(modules, ...name.split('/'), 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (manifest.version !== expected) mismatches.push(`${name}: expected ${expected}, found ${manifest.version}`)
  }

  const nestedDrift = []
  await walkPackageManifests(modules, async (manifestPath) => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (manifest.name?.startsWith('@deepseek-ai/dsh') && manifest.version !== DSH_VERSION) {
      nestedDrift.push(`${manifest.name}@${manifest.version} (${manifestPath})`)
    }
  })

  if (mismatches.length || nestedDrift.length) {
    throw new Error(`DSH 运行闭包纯度检查失败：${[...mismatches, ...nestedDrift].join('、')}`)
  }
  console.log(`版本纯度通过：所有 @deepseek-ai/dsh* 均为 ${DSH_VERSION}`)
}

async function walkPackageManifests(directory, visit) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const child = join(directory, entry.name)
    if (entry.name.startsWith('@')) {
      await walkPackageManifests(child, visit)
      continue
    }
    const manifest = join(child, 'package.json')
    if (existsSync(manifest)) await visit(manifest)
    const nested = join(child, 'node_modules')
    if (existsSync(nested)) await walkPackageManifests(nested, visit)
  }
}

/**
 * 在构建期把唯一 Moyu profile 生成好，随闭包一起交付。
 *
 * 运行期不得在用户机器上跑 npm：既要联网，也和 §9「不在用户机器上动态替换核心」冲突。
 * 这里生成的是模板，首次启动时整目录复制到 userData 下的 DSH_HOME。
 */
async function buildProfileTemplate() {
  const home = join(target, 'home-template')
  const profileDir = join(home, 'profiles', PROFILE_NAME)
  await rm(home, { recursive: true, force: true })
  await mkdir(profileDir, { recursive: true })

  const manifestPath = join(profileDir, 'package.json')
  const manifest = {
    name: 'dsh-profile-moyu',
    private: true,
    dependencies: {
      [SURFACE_BUNDLE]: DSH_VERSION,
      ...Object.fromEntries(Object.keys(MOYU_PLUGINS).map((name) => [name, '0.0.0']))
    },
    dsh: {
      profile: {
        bundles: ['@deepseek-ai/dsh-base', SURFACE_BUNDLE]
      }
    }
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await cp(join(root, 'packages', 'dsh-profile', 'cordis.patch.yml'), join(profileDir, 'cordis.patch.yml'))

  // profile 不再运行包管理器：上游包全部由同一份精确 runtime 闭包提供，避免 registry
  // 发布新 RC 后 profile 与 Host 悄悄混装。Moyu 私有插件以实体形式放进两个解析位置。
  for (const [name, dir] of Object.entries(MOYU_PLUGINS)) {
    const source = join(root, 'packages', dir)
    execFileSync('npm', ['run', 'bundle'], { cwd: source, stdio: 'inherit' })
    const filter = (path) => !path.includes('node_modules') && !path.includes('/src')
    // 两处都要有实体：
    //  · profile 目录——pnpm 装的是指向开发目录的 symlink，打包后失效；
    //  · 闭包 node_modules——cordis-plugin-loader 从**自己所在目录**向上解析插件包，
    //    不会去看 DSH_HOME 下的 profile 目录。
    for (const base of [profileDir, target]) {
      const dest = join(base, 'node_modules', ...name.split('/'))
      await rm(dest, { recursive: true, force: true })
      await cp(source, dest, { recursive: true, dereference: true, filter })
    }
  }

  const patch = await readFile(join(profileDir, 'cordis.patch.yml'), 'utf8')
  const disabled = patch.match(/disabled: true/g)?.length ?? 0
  console.log(`profile 模板就绪：${PROFILE_NAME}，禁用 ${disabled} 个上游插件条目`)
}

await main()
