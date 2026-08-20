import { cp, mkdir, rm } from 'node:fs/promises'

await rm(new URL('./lib', import.meta.url), { recursive: true, force: true })
await mkdir(new URL('./lib', import.meta.url), { recursive: true })
await cp(new URL('./src/index.mjs', import.meta.url), new URL('./lib/index.mjs', import.meta.url))
