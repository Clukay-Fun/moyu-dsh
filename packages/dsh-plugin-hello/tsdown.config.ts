import { defineConfig } from 'tsdown'
import type { Plugin } from 'rolldown'

const clientExternals = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form', '@deepseek-ai/dsh-client-runtime/client',
]

const inlineSafe = /^@deepseek-ai\/dsh-(host-apiproxy|session|llm|tools|brand)(\/|$)/

function purityGate(): Plugin {
  return {
    name: 'moyu-dsh-client-purity',
    resolveId(source) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (clientExternals.includes(source) || inlineSafe.test(source) || /\/remote(?:\/|$)/.test(source)) return null
      throw new Error(`client bundle purity: "${source}" is not a platform module, inline-safe wire layer, or generated /remote contribution`)
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
    plugins: [purityGate()],
    outputOptions: { entryFileNames: '[name].js' },
    banner: { js: 'window.__ModuleLoader__.load({ id: "@moyu/dsh-plugin-hello", factory: (require) => { var module = { exports: {} }; var exports = module.exports;' },
    footer: { js: 'return module.exports; } });' },
  },
])
