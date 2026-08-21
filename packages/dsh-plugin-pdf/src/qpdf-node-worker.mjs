import { parentPort, workerData } from 'node:worker_threads'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const qpdfPath = fileURLToPath(workerData.qpdfUrl)
const wasmPath = fileURLToPath(workerData.wasmUrl)
const stdout = []
const stderr = []
let readyResolve
let readyReject
const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject })
const moduleValue = {
  noInitialRun: true,
  print: (value) => stdout.push(String(value)),
  printErr: (value) => stderr.push(String(value)),
  locateFile: (name) => name.endsWith('.wasm') ? wasmPath : name,
  onRuntimeInitialized: () => readyResolve(),
  onAbort: (reason) => readyReject(new Error(String(reason))),
}
const context = vm.createContext({
  Module: moduleValue,
  module: { exports: moduleValue },
  exports: {},
  require: createRequire(qpdfPath),
  __dirname: dirname(qpdfPath),
  __filename: qpdfPath,
  process,
  Buffer,
  URL,
  TextDecoder,
  TextEncoder,
  WebAssembly,
  crypto: globalThis.crypto,
  console,
  setTimeout,
  clearTimeout,
})

vm.runInContext(readFileSync(qpdfPath, 'utf8'), context, { filename: qpdfPath })

function cleanup(names) {
  for (const name of names) {
    try { if (context.FS.analyzePath(name).exists) context.FS.unlink(name) } catch {}
  }
}

parentPort.once('message', async ({ input, args, inputName = 'input.pdf', outputName = 'output.pdf' }) => {
  try {
    await ready
    stdout.length = 0
    stderr.length = 0
    cleanup([inputName, outputName])
    context.FS.createDataFile('/', inputName, new Uint8Array(input), true, false)
    const exitCode = Number(context.callMain(args)) || 0
    if (![0, 3].includes(exitCode)) {
      throw Object.assign(new Error(stderr.at(-1) || `qpdf exited with status ${exitCode}`), { code: 'QPDF_EXEC_FAILED' })
    }
    if (!context.FS.analyzePath(outputName).exists) {
      throw Object.assign(new Error('qpdf 未生成输出文件'), { code: 'QPDF_OUTPUT_MISSING' })
    }
    const output = Uint8Array.from(context.FS.readFile(outputName))
    cleanup([inputName, outputName])
    parentPort.postMessage({ ok: true, output, exitCode }, [output.buffer])
  } catch (error) {
    parentPort.postMessage({ ok: false, code: error?.code || 'QPDF_EXEC_FAILED', message: error?.message || String(error) })
  }
})
