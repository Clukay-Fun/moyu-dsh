import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import { spritePlugin } from './scripts/icons/sprite-plugin.mjs'

// v3.0.0 决策 20：纯 DSH 原生应用。主窗口直接加载 DSH origin（无 preload），
// 唯一保留的 WebContents 构建产物是截图覆盖层（screenshot.html + 它的最小 preload），
// 它是 screenshot_capture 采集链路的选区交互面。
export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve(__dirname, 'apps/desktop/main/index.js')
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: resolve(__dirname, 'apps/desktop/preload/index.js')
      },
      rollupOptions: {
        output: {
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    // 截图覆盖层：screenshot_capture 采集链路的选区交互面（唯一保留的 WebContents 页面）。
    root: resolve(__dirname, 'apps/desktop/overlay'),
    // 图标 sprite 在构建期注入 HTML 入口；覆盖层工具栏的 <use href="#ic-*"> 依赖它。
    plugins: [spritePlugin(__dirname)],
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: {
          screenshot: resolve(__dirname, 'apps/desktop/overlay/screenshot.html')
        }
      }
    }
  }
})
