import { defineConfig } from 'tsdown'
import type { Plugin } from 'rolldown'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-runtime/client',
]

function clientPurityGate(): Plugin {
  return {
    name: 'moyu-scheduled-tasks-client-purity',
    resolveId(source) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (clientExternals.includes(source)) return null
      throw new Error(`client bundle purity: "${source}" is not an approved client external`)
    },
  }
}

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    dts: true,
    clean: true,
    external: [/^@deepseek-ai\//],
  },
  {
    entry: { client: 'src/client.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    external: clientExternals,
    noExternal: [/.*/],
    plugins: [clientPurityGate()],
    outputOptions: { entryFileNames: '[name].js' },
    banner: {
      js: 'window.__ModuleLoader__.load({ id: "@moyu/dsh-plugin-scheduled-tasks", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
    },
    footer: { js: 'return module.exports; } });' },
  },
])
