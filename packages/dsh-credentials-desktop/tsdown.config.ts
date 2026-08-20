import { defineConfig } from 'tsdown'

// 只有 host 半边：凭据 provider 不贡献 Client UI。
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
