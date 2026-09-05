// electron-builder afterPack：把 DSH 运行闭包拷进 .app。
//
// 不能用 extraResources：electron-builder 会硬性剔除其中的 node_modules（filter 也覆盖不了），
// 结果只拷进 package.json，运行期报“运行闭包缺失”。
import { cp, rm } from 'node:fs/promises'
import { join } from 'node:path'

export default async function afterPack(context) {
  const source = join(context.packager.projectDir, 'build', 'dsh-runtime')
  const appName = context.packager.appInfo.productFilename
  const target = join(context.appOutDir, `${appName}.app`, 'Contents', 'Resources', 'dsh-runtime')
  await rm(target, { recursive: true, force: true })
  // 保留 npm .bin 的相对链接，避免 cp 将其改为指向开发机的绝对路径。
  await cp(source, target, { recursive: true, dereference: false, verbatimSymlinks: true })
  console.log(`  • copied dsh-runtime closure  target=${target}`)
}
