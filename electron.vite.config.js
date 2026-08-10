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
    // gs1encoder 的 Emscripten 模块通过 import.meta.url 相对加载同目录 WASM。
    // 开发期若被预构建到 node_modules/.vite/deps，WASM 不会随之复制，
    // 请求会落到 Vite 的 HTML fallback；保留原包路径即可让相对 URL 正常工作。
    optimizeDeps: {
      exclude: ['gs1encoder']
    },
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
