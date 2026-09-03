/**
C2-a · 把一个 packages/dsh-plugin-* 打包成可安装 Mod。
用法: node scripts/pack-mod.mjs <plugin-dir> <out-dir>
产出: <out-dir>/<mod-id>/{ manifest.json, package/ }
    - manifest.json: 由包内 mod.json + package.json.version 生成，并经校验
    - package/: 复制包的 shippable 文件（package.json + lib/ + 可选 node_modules 就近依赖闭包）
说明: peer 依赖（cordis/dsh-* 等）不打进 Mod，由 profile 闭包提供（见 C2-D1 复制策略）；
      仅 Mod 自带的非闭包依赖（如 pdf-lib）才需随 package/node_modules 一起打包。
*/
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateManifest } from '../apps/desktop/main/dsh/mods.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function packMod(pluginDir, outDir) {
  const pkgJson = JSON.parse(await readFile(join(pluginDir, 'package.json'), 'utf8'))
  const modJsonPath = join(pluginDir, 'mod.json')
  if (!existsSync(modJsonPath)) throw new Error(`缺少 mod.json: ${modJsonPath}（业务包需声明 Mod 清单）`)
  const modJson = JSON.parse(await readFile(modJsonPath, 'utf8'))

  const manifest = {
    id: modJson.id,
    version: pkgJson.version || '0.0.0',
    displayName: modJson.displayName,
    author: modJson.author || 'Clukay',
    requires: modJson.requires ?? {},
    provides: modJson.provides,
    permissions: modJson.permissions ?? [],
    platforms: modJson.platforms,
  }
  const v = validateManifest(manifest)
  if (!v.ok) throw new Error(`manifest 非法: ${v.errors.join('; ')}`)

  const modDir = join(outDir, manifest.id)
  await rm(modDir, { recursive: true, force: true })
  await mkdir(join(modDir, 'package'), { recursive: true })

  // package/：package.json + lib（+ node_modules 若存在就近依赖）
  await cp(join(pluginDir, 'package.json'), join(modDir, 'package', 'package.json'))
  if (existsSync(join(pluginDir, 'lib'))) {
    await cp(join(pluginDir, 'lib'), join(modDir, 'package', 'lib'), { recursive: true, dereference: true })
  } else {
    throw new Error(`${pluginDir} 缺少 lib/（先构建/bundle 插件）`)
  }
  if (existsSync(join(pluginDir, 'node_modules'))) {
    await cp(join(pluginDir, 'node_modules'), join(modDir, 'package', 'node_modules'), { recursive: true, dereference: true })
  }

  await writeFile(join(modDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return { id: manifest.id, modDir }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [pluginArg, outArg] = process.argv.slice(2)
  if (!pluginArg || !outArg) {
    console.error('用法: node scripts/pack-mod.mjs <plugin-dir> <out-dir>')
    process.exit(2)
  }
  packMod(resolve(pluginArg), resolve(outArg))
    .then((r) => console.log(`已打包 Mod: ${r.id} → ${r.modDir}`))
    .catch((e) => { console.error('打包失败:', e.message); process.exit(1) })
}

export { packMod }
