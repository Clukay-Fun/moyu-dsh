import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.mjs' }, outDir: 'lib', format: 'esm', platform: 'node',
  dts: false, clean: true, external: [/^@deepseek-ai\//, 'sharp'],
  outputOptions: { entryFileNames: '[name].mjs' },
})
