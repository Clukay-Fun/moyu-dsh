import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { CredentialInfo, CredentialRef, ResolvedCredential } from '@deepseek-ai/dsh-credentials'

export const name = 'moyu-hello'
export const inject = ['tools', 'sessions']

export class MoyuHelloService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'moyuHello')
  }

  ping(): string {
    return 'hello from @moyu/dsh-plugin-hello'
  }
}

export class MoyuMemoryCredentials extends CredentialProvider {
  private readonly values = new Map<CredentialRef, string>()

  async resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    const value = this.values.get(ref)
    return value === undefined ? undefined : { value, source: 'moyu-memory-spike' }
  }

  async describe(ref: CredentialRef): Promise<CredentialInfo> {
    return { configured: this.values.has(ref), source: this.values.has(ref) ? 'moyu-memory-spike' : undefined, writable: true }
  }

  async set(ref: CredentialRef, value: string): Promise<void> {
    if (value.length === 0) throw new Error('empty credentials are not accepted')
    this.values.set(ref, value)
    this.notifyUpdated(ref)
  }

  async unset(ref: CredentialRef): Promise<void> {
    this.values.delete(ref)
    this.notifyUpdated(ref)
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    moyuHello: MoyuHelloService
  }
}

export function apply(ctx: Context): void {
  new MoyuMemoryCredentials(ctx)
  new MoyuHelloService(ctx)
  ctx.tools.register(defineTool({
    name: 'moyu_hello',
    description: 'Return the M0a hello-plugin proof string.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { message: { type: 'string', required: true } },
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    execute: async () => ({ message: ctx.moyuHello.ping() }),
  }))
  ctx.on('session/created', () => {
    const actual = ctx.tools.schemas().map(schema => schema.name).sort()
    const expected = ['moyu_hello']
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`moyu tool whitelist drift: expected ${expected.join(',')}; got ${actual.join(',')}`)
    }
  }, { global: true })
}
