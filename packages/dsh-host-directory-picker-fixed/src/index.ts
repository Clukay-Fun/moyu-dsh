// DSH 要求 directoryPicker service 存在，但 Moyu 不允许 Host 自己 spawn
// osascript/zenity 等外部选择器，也不向用户开放任意 agent 工作目录。
// 本 provider 只发布并复用应用拥有的 $DSH_HOME/workspace。
import type { Context } from '@deepseek-ai/cordis'
import { DirectoryPicker } from '@deepseek-ai/dsh-host-directory-picker'
import type {} from '@deepseek-ai/dsh-workspace'
import { mkdir, realpath } from 'node:fs/promises'
import { join } from 'node:path'

export const name = 'moyu-directory-picker-fixed'
export const inject = ['workspaceRegistry']

function fixedWorkspacePath(): string {
  const home = process.env.DSH_HOME
  if (!home) throw new Error('DSH_HOME 未设置，拒绝创建固定 workspace')
  return join(home, 'workspace')
}

class FixedDirectoryPicker extends DirectoryPicker {
  readonly #path = fixedWorkspacePath()
  readonly #capability = {
    kind: 'native' as const,
    pick: async (): Promise<string> => {
      await mkdir(this.#path, { recursive: true })
      return this.#path
    }
  }

  capability() {
    return this.#capability
  }
}

export async function apply(ctx: Context): Promise<void> {
  new FixedDirectoryPicker(ctx)

  const path = fixedWorkspacePath()
  await mkdir(path, { recursive: true })
  const canonical = await realpath(path)
  const existing = ctx.workspaceRegistry.list()
  if (existing.some((workspace) => workspace.path !== canonical)) {
    throw new Error('检测到旧版非沙箱 workspace；为避免静默访问任意目录，需先人工迁移开发会话')
  }
  await ctx.workspaceRegistry.create(canonical, 'Moyu')
}
