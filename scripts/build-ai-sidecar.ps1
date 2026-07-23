$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VenvPath = Join-Path $ProjectRoot "build/ai-sidecar-venv"
$OutputPath = Join-Path $ProjectRoot "build/sidecars"
$WorkPath = Join-Path $ProjectRoot "build/ai-sidecar"
$WorkerPath = Join-Path $ProjectRoot "sidecar/ai/worker.py"
$RequirementsPath = Join-Path $ProjectRoot "sidecar/ai/requirements-win.txt"
$PythonCommand = if ($env:MOYU_PYTHON) { $env:MOYU_PYTHON } else { "python" }

if (-not (Test-Path (Join-Path $VenvPath "Scripts/python.exe"))) {
  & $PythonCommand -m venv $VenvPath
}

$Python = Join-Path $VenvPath "Scripts/python.exe"
& $Python -m pip install --disable-pip-version-check -r $RequirementsPath

New-Item -ItemType Directory -Force $OutputPath | Out-Null
& $Python -m PyInstaller `
  --clean `
  --noconfirm `
  --onefile `
  --name moyu-ai-sidecar `
  --distpath $OutputPath `
  --workpath $WorkPath `
  --specpath $WorkPath `
  --collect-all onnxruntime `
  $WorkerPath

Write-Host "AI sidecar ready: $(Join-Path $OutputPath 'moyu-ai-sidecar.exe')"
