import { app } from 'electron'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const s = await mkdtemp(join(tmpdir(),'t-'))
app.setPath('userData', s)
await app.whenReady()
console.log('READY-OK-1')
app.exit(0)
