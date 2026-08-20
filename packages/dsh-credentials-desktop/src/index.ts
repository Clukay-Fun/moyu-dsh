// Moyu 的凭据 provider：密文由 Electron main 经 safeStorage 保管（v3.0.0 §5）。
//
// 上游默认实现把 Key 明文写进 $DSH_HOME/.credentials.yaml，正式产品不接受。
// 本插件不自己碰磁盘，全部经窄桌面桥回主进程：Host 进程里既没有明文落盘，
// 也没有加密密钥。
import type { Context } from '@deepseek-ai/cordis'
import { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { CredentialInfo, CredentialRef, ResolvedCredential } from '@deepseek-ai/dsh-credentials'

export const name = 'moyu-credentials-desktop'

const SOURCE = 'moyu-desktop-keychain'

interface DesktopBridge {
  call(method: string, payload?: unknown): Promise<any>
}

function bridge(): DesktopBridge {
  const desktop = (globalThis as any).__moyuDesktop as DesktopBridge | undefined
  if (!desktop) throw new Error('桌面桥不可用：凭据只能经主进程读写')
  return desktop
}

export class MoyuDesktopCredentials extends CredentialProvider {
  async resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    const info = await bridge().call('desktop.secureRetrieve', { key: String(ref) })
    return info?.value === undefined ? undefined : { value: info.value, source: SOURCE }
  }

  async describe(ref: CredentialRef): Promise<CredentialInfo> {
    const info = await bridge().call('desktop.secureDescribe', { key: String(ref) })
    return {
      configured: Boolean(info?.configured),
      source: info?.configured ? SOURCE : undefined,
      writable: Boolean(info?.writable)
    }
  }

  async set(ref: CredentialRef, value: string): Promise<void> {
    if (value.length === 0) throw new Error('不接受空凭据')
    await bridge().call('desktop.secureStore', { key: String(ref), value })
    this.notifyUpdated(ref)
  }

  async unset(ref: CredentialRef): Promise<void> {
    await bridge().call('desktop.secureDelete', { key: String(ref) })
    this.notifyUpdated(ref)
  }
}

export function apply(ctx: Context): void {
  new MoyuDesktopCredentials(ctx)
}
