const parentPort = process.parentPort
const winax = require(process.env.MOYU_WINAX_MODULE)
const cancelledTasks = new Set()

function post(message) {
  parentPort.postMessage(message)
}

function progress(id, completed, total, name, message) {
  post({
    type: 'progress',
    id,
    completed,
    total,
    name,
    message
  })
}

function release(...objects) {
  const available = objects.filter(Boolean)
  if (available.length) {
    try {
      winax.release(...available)
    } catch {
      // COM cleanup is best-effort after Close/Quit.
    }
  }
}

function assertWindows() {
  if (process.platform !== 'win32') {
    throw new Error('COM 联动仅支持 Windows')
  }
}

function extendScriptString(value) {
  return JSON.stringify(String(value))
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function illustratorScript(inputPath, outputPath, action) {
  const input = extendScriptString(inputPath)
  const output = extendScriptString(outputPath)
  const operation = action === 'outline'
    ? `
      var outlineFailures = 0;
      for (var index = document.textFrames.length - 1; index >= 0; index -= 1) {
        try {
          document.textFrames[index].createOutline();
        } catch (outlineError) {
          outlineFailures += 1;
        }
      }
      if (outlineFailures > 0) {
        throw new Error(outlineFailures + " 个文本对象无法转曲，请检查锁定对象或缺失字体");
      }
      var options = new IllustratorSaveOptions();
      options.pdfCompatible = true;
      document.saveAs(new File(${output}), options);
    `
    : `
      var options = new PDFSaveOptions();
      options.preserveEditability = ${action === 'minimal-pdf' ? 'false' : 'true'};
      options.generateThumbnails = false;
      options.optimization = true;
      ${action === 'minimal-pdf' ? `
      options.compressArt = true;
      options.colorDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE;
      options.colorDownsampling = 250;
      options.colorDownsamplingImageThreshold = 250;
      options.grayscaleDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE;
      options.grayscaleDownsampling = 250;
      options.grayscaleDownsamplingImageThreshold = 250;
      options.monochromeDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE;
      options.monochromeDownsampling = 250;
      options.monochromeDownsamplingImageThreshold = 250;
      options.colorCompression = CompressionQuality.JPEGMINIMUM;
      options.grayscaleCompression = CompressionQuality.JPEGMINIMUM;
      ` : ''}
      document.saveAs(new File(${output}), options);
    `

  return `
    var sourceFile = new File(${input});
    var previousInteractionLevel = app.userInteractionLevel;
    var document = null;
    try {
      app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
      document = app.open(sourceFile);
      ${operation}
    } finally {
      if (document) document.close(SaveOptions.DONOTSAVECHANGES);
      app.userInteractionLevel = previousInteractionLevel;
    }
  `
}

function illustratorSvgScript(inputPath, outputPath) {
  const input = extendScriptString(inputPath)
  if (!outputPath) {
    return `
      var previousInteractionLevel = app.userInteractionLevel;
      try {
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
        app.open(new File(${input}));
      } finally {
        app.userInteractionLevel = previousInteractionLevel;
      }
    `
  }
  const output = extendScriptString(outputPath)
  return `
    var previousInteractionLevel = app.userInteractionLevel;
    var document = null;
    try {
      app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
      document = app.open(new File(${input}));
      var options = new EPSSaveOptions();
      document.saveAs(new File(${output}), options);
    } finally {
      if (document) document.close(SaveOptions.DONOTSAVECHANGES);
      app.userInteractionLevel = previousInteractionLevel;
    }
  `
}

function createComObject(progId, activateExisting = false) {
  try {
    return new winax.Object(progId, { activate: activateExisting })
  } catch (error) {
    const wrapped = new Error(`无法启动 ${progId}，请确认对应软件已安装`)
    wrapped.cause = error
    throw wrapped
  }
}

function disableOfficeMacros(application) {
  try {
    application.AutomationSecurity = 3
  } catch {
    // Older Office versions may not expose the shared automation security property.
  }
}

function runOfficeToPdf(payload) {
  const { kind, inputPath, outputPath } = payload
  let application
  let document

  try {
    if (kind === 'word') {
      application = createComObject('Word.Application')
      application.Visible = false
      application.DisplayAlerts = 0
      disableOfficeMacros(application)
      document = application.Documents.Open(inputPath, false, true)
      document.ExportAsFixedFormat(outputPath, 17)
    } else if (kind === 'excel') {
      application = createComObject('Excel.Application')
      application.Visible = false
      application.DisplayAlerts = false
      disableOfficeMacros(application)
      document = application.Workbooks.Open(inputPath, 0, true)
      document.ExportAsFixedFormat(0, outputPath)
    } else if (kind === 'powerpoint') {
      application = createComObject('PowerPoint.Application')
      disableOfficeMacros(application)
      document = application.Presentations.Open(inputPath, true, false, false)
      document.SaveAs(outputPath, 32)
    } else {
      throw new Error('不支持的 Office 文件类型')
    }
  } finally {
    if (document) {
      try {
        document.Close(false)
      } catch {
        try {
          document.Close()
        } catch {
          // Continue to application cleanup.
        }
      }
    }
    if (application) {
      try {
        application.Quit()
      } catch {
        // Release the COM proxy even if the application already closed.
      }
    }
    release(document, application)
  }

  return { outputPath }
}

async function runIllustratorBatch(id, payload) {
  const application = createComObject('Illustrator.Application', true)
  const files = payload.files || []
  const outputs = []

  try {
    for (const [index, file] of files.entries()) {
      if (cancelledTasks.has(id)) {
        const error = new Error('TASK_CANCELLED')
        error.code = 'TASK_CANCELLED'
        throw error
      }
      progress(id, index, files.length, file.name, `正在处理 ${file.name}`)
      application.DoJavaScript(illustratorScript(file.inputPath, file.outputPath, payload.action))
      outputs.push({ inputPath: file.inputPath, outputPath: file.outputPath, name: file.name })
      progress(id, index + 1, files.length, file.name, `${file.name} 已完成`)
      await new Promise((resolve) => setImmediate(resolve))
    }
  } finally {
    cancelledTasks.delete(id)
    release(application)
  }
  return { outputs }
}

function runIllustratorSvg(payload) {
  const application = createComObject('Illustrator.Application', true)
  try {
    application.DoJavaScript(illustratorSvgScript(payload.inputPath, payload.outputPath))
    application.Visible = true
  } finally {
    release(application)
  }
  return { outputPath: payload.outputPath || null }
}

function runPhotoshopOpen(payload) {
  const application = createComObject('Photoshop.Application', true)
  try {
    application.Open(payload.inputPath)
    application.Visible = true
  } finally {
    release(application)
  }
  return { opened: true }
}

async function execute(id, command, payload) {
  assertWindows()
  if (command === 'probe') {
    const shell = createComObject('WScript.Shell')
    try {
      return {
        winax: require(`${process.env.MOYU_WINAX_MODULE}/package.json`).version,
        windowsDirectory: String(shell.ExpandEnvironmentStrings('%WINDIR%')),
        processType: process.type
      }
    } finally {
      release(shell)
    }
  }
  if (command === 'office-to-pdf') return runOfficeToPdf(payload)
  if (command === 'illustrator-batch') return runIllustratorBatch(id, payload)
  if (command === 'illustrator-svg') return runIllustratorSvg(payload)
  if (command === 'photoshop-open') return runPhotoshopOpen(payload)
  throw new Error(`不支持的 COM 命令：${command}`)
}

parentPort.on('message', async (event) => {
  const message = event?.data ?? event
  if (message?.type === 'cancel' && message.id) {
    cancelledTasks.add(message.id)
    return
  }
  if (message?.type !== 'request' || !message.id) return

  try {
    const result = await execute(message.id, message.command, message.payload || {})
    post({ type: 'result', id: message.id, ok: true, result })
  } catch (error) {
    post({
      type: 'result',
      id: message.id,
      ok: false,
      error: error?.code === 'TASK_CANCELLED'
        ? 'TASK_CANCELLED'
        : String(error?.message || error)
    })
  }
})

parentPort.start?.()
