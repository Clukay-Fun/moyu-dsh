import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.mjs', 'qpdf-node-worker': 'src/qpdf-node-worker.mjs' }, outDir: 'lib', format: 'esm', platform: 'node',
  dts: false, clean: true, external: [/^@deepseek-ai\//, '@napi-rs/canvas', 'pdf-lib', 'pdfjs-dist/legacy/build/pdf.mjs', 'sharp'],
  outputOptions: { entryFileNames: '[name].mjs' },
})
