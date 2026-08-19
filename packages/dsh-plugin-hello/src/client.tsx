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

export function apply(ctx: ClientContext): void {
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
