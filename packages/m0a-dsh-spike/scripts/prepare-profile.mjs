import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const home = resolve(root, '.m0a-home')
const profile = join(home, 'profiles', 'web')
await mkdir(profile, { recursive: true })
process.env.DSH_HOME = home
execFileSync(join(root, 'node_modules', '.bin', 'dsh'), ['--profile', 'web', '--dump-default-config'], { env: process.env, stdio: 'ignore' })
const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
manifest.dependencies['@moyu/dsh-plugin-hello'] = `file:${resolve(root, '../dsh-plugin-hello')}`
await writeFile(join(profile, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await cp(join(root, 'profile', 'cordis.patch.yml'), join(profile, 'cordis.patch.yml'))
execFileSync('npm', ['install'], { cwd: profile, stdio: 'inherit', env: process.env })
process.stdout.write(`export M0A_DSH_HOME=${JSON.stringify(home)}\n`)
