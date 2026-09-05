import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'
// C2-g g5：per-preset 守卫已移除；此处仅为 mock 工具面提供名字集合。
const MOYU_REQUIRED_TOOLS = ['image_convert', 'pdf_process', 'screenshot_capture']

const sandbox = await mkdtemp(join(tmpdir(), 'moyu-pdf-tool-'))
const paths = new Map()

async function makePdf(name, pages) {
  const document = await PDFDocument.create()
  for (let index = 0; index < pages; index += 1) document.addPage([120 + index, 80 + index])
  const path = join(sandbox, name)
  await writeFile(path, await document.save())
  paths.set(name, path)
}
await makePdf('one.pdf', 1)
await makePdf('two.pdf', 2)
const imagePath = join(sandbox, 'mark.png')
await sharp({ create: { width: 32, height: 20, channels: 4, background: '#ff6600' } }).png().toFile(imagePath)
paths.set('mark.png', imagePath)
const contentDocument = await PDFDocument.create()
const contentPage = contentDocument.addPage([240, 160])
const contentFont = await contentDocument.embedFont(StandardFonts.Helvetica)
contentPage.drawText('Moyu PDF text', { x: 20, y: 120, size: 16, font: contentFont })
const contentImage = await contentDocument.embedPng(await readFile(imagePath))
contentPage.drawImage(contentImage, { x: 20, y: 30, width: 64, height: 40 })
const contentPath = join(sandbox, 'content.pdf')
await writeFile(contentPath, await contentDocument.save())
paths.set('content.pdf', contentPath)

const desktopActions = []
globalThis.__moyuDesktop = {
  async call(method, payload) {
    if (method === 'desktop.pickFiles') return { canceled: false, files: [{ fileId: 'one.pdf', name: 'one.pdf' }, { fileId: 'two.pdf', name: 'two.pdf' }] }
    if (method === 'desktop.prepareResult') {
      assert.equal(payload.kind, 'pdf')
      const directory = join(sandbox, payload.resultId)
      await mkdir(directory, { recursive: true })
      paths.set(`result-${payload.resultId}`, directory)
      return { directory: { fileId: `result-${payload.resultId}` } }
    }
    if (method === 'desktop.resolveFile') {
      const path = paths.get(payload.fileId)
      if (!path) throw new Error("Error invoking remote method 'desktop.resolveFile': Error: 文件令牌无效或已失效")
      return { path }
    }
    if (method === 'desktop.registerResult') {
      const directory = paths.get(payload.directoryFileId)
      const fileId = `file-${payload.directoryFileId}`
      paths.set(fileId, join(directory, payload.name))
      return { file: { fileId, name: payload.name } }
    }
    if (method === 'desktop.saveRegisteredFile' || method === 'desktop.saveRegisteredFiles') { desktopActions.push({ method, payload }); return { canceled: false } }
    if (method === 'desktop.showItem') { desktopActions.push({ method, payload }); return { shown: true } }
    throw new Error(`unexpected desktop method: ${method}`)
  }
}

let tool
let route
let sessionCreated
const effects = []
const plugin = await import(process.env.MOYU_PDF_PLUGIN || '../packages/dsh-plugin-pdf/lib/index.mjs')
plugin.apply({
  tools: { register(value) { tool = value; return () => {} }, schemas() { return MOYU_REQUIRED_TOOLS.map((name) => ({ name })) } },
  on(event, handler) { if (event === 'session/created') sessionCreated = handler },
  webServer: { register(value) { route = value; return () => {} } },
  effect(run) { effects.push(run()) }
})
assert.equal(tool.name, 'pdf_process')
// C2-g g5：session/created per-preset 守卫已移除（工具面完整性由 host-ready 全局审计接管）。

const execute = (args) => tool.execute(args, { signal: new AbortController().signal })

async function routeRequest(value) {
  const chunks = [Buffer.from(JSON.stringify(value))]
  let status
  let body = ''
  await route.handler({ method: 'POST', async *[Symbol.asyncIterator]() { yield* chunks } }, {
    writeHead(value) { status = value },
    end(value) { body = String(value || '') },
  })
  return { status, value: JSON.parse(body) }
}

async function complete(args) {
  const submitted = await execute({ operation: 'submit', ...args })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await execute({ operation: 'status', job_id: submitted.jobId })
    if (value.status !== 'running') return { submitted, value }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('PDF job timeout in test')
}

await assert.rejects(() => execute({ operation: 'submit', pdf_operation: 'merge', input_file_ids: ['one.pdf'] }), /至少需要 2/)
await assert.rejects(() => execute({ operation: 'submit', pdf_operation: 'unknown', input_file_ids: ['one.pdf'] }), /must be one of/)

const merged = await complete({ pdf_operation: 'merge', input_file_ids: ['one.pdf', 'two.pdf'], output_name: 'merged.pdf' })
assert.equal(merged.value.status, 'completed')
assert.equal(merged.value.pageCount, 3)
assert.equal('path' in merged.value, false)
const mergedPath = join(sandbox, merged.submitted.jobId, 'merged.pdf')
assert.ok((await stat(mergedPath)).size > 500)
assert.equal((await PDFDocument.load(await readFile(mergedPath))).getPageCount(), 3)

const rotated = await complete({ pdf_operation: 'rotate', input_file_ids: ['two.pdf'], options: { rotation: 90 } })
assert.equal(rotated.value.pageCount, 2)
const extracted = await complete({ pdf_operation: 'extract_pages', input_file_ids: ['two.pdf'], options: { pages: '2' } })
assert.equal(extracted.value.pageCount, 1)
const numbered = await complete({ pdf_operation: 'page_numbers', input_file_ids: ['two.pdf'], options: { start: 5, position: 'header' } })
assert.equal(numbered.value.pageCount, 2)

const split = await complete({ pdf_operation: 'split_pages', input_file_ids: ['two.pdf'], output_name: 'parts.pdf' })
assert.equal(split.value.pageCount, 2)
assert.equal(split.value.fileCount, 2)
assert.equal((await PDFDocument.load(await readFile(join(sandbox, split.submitted.jobId, 'parts-page-1.pdf')))).getPageCount(), 1)
assert.equal((await PDFDocument.load(await readFile(join(sandbox, split.submitted.jobId, 'parts-page-2.pdf')))).getPageCount(), 1)
assert.equal((await routeRequest({ operation: 'save', job_id: split.submitted.jobId })).status, 200)
assert.equal(desktopActions.at(-1).method, 'desktop.saveRegisteredFiles')
assert.equal(desktopActions.at(-1).payload.files.length, 2)

const inserted = await complete({ pdf_operation: 'insert_pages', input_file_ids: ['two.pdf', 'one.pdf'], options: { after_page: 1 } })
assert.equal(inserted.value.pageCount, 3)
assert.equal(inserted.value.fileCount, 1)
await assert.rejects(() => execute({ operation: 'submit', pdf_operation: 'insert_pages', input_file_ids: ['one.pdf'] }), /需要依次选择/)

const encrypted = await complete({ pdf_operation: 'encrypt', input_file_ids: ['two.pdf'], output_name: 'locked.pdf', options: { password: 'test-secret' } })
assert.equal(encrypted.value.status, 'completed')
const encryptedPath = join(sandbox, encrypted.submitted.jobId, 'locked.pdf')
assert.match((await readFile(encryptedPath)).toString('latin1'), /\/Encrypt\b/)
const encryptedToken = `encrypted-${encrypted.submitted.jobId}`
paths.set(encryptedToken, encryptedPath)
const decrypted = await complete({ pdf_operation: 'decrypt', input_file_ids: [encryptedToken], output_name: 'unlocked.pdf', options: { password: 'test-secret' } })
assert.equal(decrypted.value.status, 'completed')
assert.equal((await PDFDocument.load(await readFile(join(sandbox, decrypted.submitted.jobId, 'unlocked.pdf')))).getPageCount(), 2)
const wrongPassword = await complete({ pdf_operation: 'decrypt', input_file_ids: [encryptedToken], options: { password: 'wrong-secret' } })
assert.equal(wrongPassword.value.status, 'failed')
assert.doesNotMatch(wrongPassword.value.error, /wrong-secret|\/Users\/|stack/i)

const textWatermark = await complete({
  pdf_operation: 'watermark_text', input_file_ids: ['one.pdf', 'two.pdf'],
  options: { text: 'Moyu', opacity: 0.3, density: 2, rotation: -30, pages: 'all' },
})
assert.equal(textWatermark.value.pageCount, 3)
assert.equal(textWatermark.value.fileCount, 2)
const imageWatermark = await complete({
  pdf_operation: 'watermark_image', input_file_ids: ['one.pdf'],
  options: { watermark_file_id: 'mark.png', opacity: 0.4, density: 1, pages: 'all' },
})
assert.equal(imageWatermark.value.pageCount, 1)
const imagePdf = await complete({ pdf_operation: 'images_to_pdf', input_file_ids: ['mark.png', 'mark.png'] })
assert.equal(imagePdf.value.pageCount, 2)
assert.equal((await PDFDocument.load(await readFile(join(sandbox, imagePdf.submitted.jobId, 'images_to_pdf.pdf')))).getPageCount(), 2)
const textExtract = await complete({ pdf_operation: 'extract_text', input_file_ids: ['content.pdf'] })
assert.equal(textExtract.value.pageCount, 1)
assert.match(await readFile(join(sandbox, textExtract.submitted.jobId, 'content-text.txt'), 'utf8'), /Moyu PDF text/)
const imageExtract = await complete({ pdf_operation: 'extract_images', input_file_ids: ['content.pdf'] })
assert.equal(imageExtract.value.status, 'completed')
assert.ok(imageExtract.value.fileCount >= 1)
assert.ok((await stat(join(sandbox, imageExtract.submitted.jobId, 'content-page-001-image-001.png'))).size > 50)
const renderedPng = await complete({ pdf_operation: 'render_pages', input_file_ids: ['two.pdf'], options: { format: 'png', scale: 2 } })
assert.equal(renderedPng.value.status, 'completed')
assert.equal(renderedPng.value.pageCount, 2)
assert.equal(renderedPng.value.fileCount, 2)
const renderedPngMeta = await sharp(join(sandbox, renderedPng.submitted.jobId, 'two-page-001.png')).metadata()
assert.deepEqual([renderedPngMeta.width, renderedPngMeta.height], [240, 160])
const renderedJpeg = await complete({ pdf_operation: 'render_pages', input_file_ids: ['two.pdf'], options: { format: 'jpeg', pages: '2', scale: 1, quality: 80 } })
assert.equal(renderedJpeg.value.status, 'completed')
assert.equal(renderedJpeg.value.pageCount, 1)
assert.equal(renderedJpeg.value.fileCount, 1)
assert.deepEqual([...((await readFile(join(sandbox, renderedJpeg.submitted.jobId, 'two-page-002.jpg'))).subarray(0, 3))], [0xff, 0xd8, 0xff])

const failed = await complete({ pdf_operation: 'rotate', input_file_ids: ['missing'], options: { rotation: 90 } })
assert.equal(failed.value.status, 'failed')
assert.equal(failed.value.error, '文件令牌无效或已失效')
assert.doesNotMatch(failed.value.error, /invoking remote|desktop\.resolveFile|\/Users\//i)

for (const dispose of effects) dispose()
console.log('pdf_process：页面操作、加密解密、水印、图片转 PDF、整页转图、文字与内嵌图片提取通过')
