import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import { spritePlugin } from './scripts/icons/sprite-plugin.mjs'

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          inlineDynamicImports: true
        }
      }
    }
  },
  renderer: {
    // 图标 sprite 在构建期注入三个 HTML 入口（V1）。
    // 开发与生产走同一个插件，产物一致；CSP 不允许 CDN，也不允许内联样式，
    // 所以只能是纯结构的 <svg><symbol>。
    plugins: [spritePlugin(__dirname)],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          pin: resolve(__dirname, 'src/renderer/pin.html'),
          screenshot: resolve(__dirname, 'src/renderer/screenshot.html')
        }
      }
    }
  }
})
