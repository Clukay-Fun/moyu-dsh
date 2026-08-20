import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import React from 'react'

export const name = 'moyu-hello-client'
export const inject = ['slots']

function HelloPanel(): React.ReactElement {
  return React.createElement('section', {
    id: 'moyu-m0a-hello',
    style: { padding: 16, border: '2px solid #4f6bed', borderRadius: 12, margin: 12 },
  }, 'Moyu M0a hello client plugin rendered')
}

/** G2 实测：占满会话主体的独立功能视图（tab 切换，一次渲染一个）。 */
function HelloView(): React.ReactElement {
  return React.createElement('section', {
    id: 'moyu-g2-view',
    style: { padding: 24, height: '100%', overflow: 'auto' },
  }, 'Moyu G2 conversation.view tab rendered')
}

export function apply(ctx: ClientContext): void {
  // G2：验证第三方插件能否拿到整页视图 tab（上游 ui-trajectory 是同一种注册）。
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'moyu-g2',
    order: 50,
    label: () => 'Moyu G2',
  } as never, HelloView as never))
  ctx.slots.inject('settings.onboarding', () => ctx.slots.register({
    name: 'settings.onboarding',
    id: 'moyu-m0a-proof',
    order: 100,
  } as never, HelloPanel as never))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'moyu-m0a',
    order: 5,
    label: () => 'Moyu M0a',
  } as never, HelloPanel as never))
}
