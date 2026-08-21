import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  dts: false,
  clean: true,
  external: [/^@deepseek-ai\//],
  outputOptions: { entryFileNames: '[name].mjs' }
})
