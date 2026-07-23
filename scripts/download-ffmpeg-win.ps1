$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$CachePath = Join-Path $ProjectRoot "build/ffmpeg-cache/b6.1.1"
$OutputPath = Join-Path $ProjectRoot "build/ffmpeg"
$ReleaseUrl = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1"

$Assets = @(
  @{
    Name = "ffmpeg-win32-x64.gz"
    Sha256 = "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77"
    Output = "ffmpeg.exe"
    OutputSha256 = "04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00"
    Gzip = $true
  },
  @{
    Name = "ffprobe-win32-x64.gz"
    Sha256 = "f309e6223ad89d2fe54bccd420a7709b66fd27540674e92309578ed491a43c8d"
    Output = "ffprobe.exe"
    OutputSha256 = "3a7e2dc003dc2cd1472827e4c7c4f056ae1ae0ae7c5bbc580c99b49827351ba4"
    Gzip = $true
  },
  @{
    Name = "win32-x64.LICENSE"
    Sha256 = "8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903"
    Output = "FFMPEG-LICENSE.txt"
    OutputSha256 = "8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903"
    Gzip = $false
  },
  @{
    Name = "win32-x64.README"
    Sha256 = "a636a7183c58006351acbaf35303c0ed85c6e1320fd4e80de453ba6157de6311"
    Output = "FFMPEG-BUILD-README.txt"
    OutputSha256 = "a636a7183c58006351acbaf35303c0ed85c6e1320fd4e80de453ba6157de6311"
    Gzip = $false
  }
)

New-Item -ItemType Directory -Force $CachePath, $OutputPath | Out-Null

foreach ($Asset in $Assets) {
  $ArchivePath = Join-Path $CachePath $Asset.Name
  if (
    -not (Test-Path $ArchivePath) -or
    (Get-FileHash $ArchivePath -Algorithm SHA256).Hash.ToLower() -ne $Asset.Sha256
  ) {
    if (Test-Path $ArchivePath) { Remove-Item $ArchivePath -Force }
    & curl.exe -L --fail --retry 3 "$ReleaseUrl/$($Asset.Name)" -o $ArchivePath
  }

  $ActualHash = (Get-FileHash $ArchivePath -Algorithm SHA256).Hash.ToLower()
  if ($ActualHash -ne $Asset.Sha256) {
    throw "FFmpeg asset hash mismatch: $($Asset.Name)"
  }

  $DestinationPath = Join-Path $OutputPath $Asset.Output
  if ($Asset.Gzip) {
    $InputStream = [System.IO.File]::OpenRead($ArchivePath)
    $GzipStream = [System.IO.Compression.GZipStream]::new(
      $InputStream,
      [System.IO.Compression.CompressionMode]::Decompress
    )
    $OutputStream = [System.IO.File]::Create($DestinationPath)
    try {
      $GzipStream.CopyTo($OutputStream)
    } finally {
      $OutputStream.Dispose()
      $GzipStream.Dispose()
      $InputStream.Dispose()
    }
  } else {
    Copy-Item $ArchivePath $DestinationPath -Force
  }

  $OutputHash = (Get-FileHash $DestinationPath -Algorithm SHA256).Hash.ToLower()
  if ($OutputHash -ne $Asset.OutputSha256) {
    throw "FFmpeg output hash mismatch: $($Asset.Output)"
  }
}

$Ffmpeg = Join-Path $OutputPath "ffmpeg.exe"
$Ffprobe = Join-Path $OutputPath "ffprobe.exe"
$FfmpegVersion = (& $Ffmpeg -version | Select-Object -First 4) -join "`n"
$FfprobeVersion = (& $Ffprobe -version | Select-Object -First 4) -join "`n"
$Info = @"
Source: eugeneware/ffmpeg-static release b6.1.1
Upstream FFmpeg: 6.1.1
License: GPL-3.0-or-later (actual Windows build; see FFMPEG-LICENSE.txt)
ffmpeg.exe SHA-256: 04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00
ffprobe.exe SHA-256: 3a7e2dc003dc2cd1472827e4c7c4f056ae1ae0ae7c5bbc580c99b49827351ba4

$FfmpegVersion

$FfprobeVersion
"@
Set-Content (Join-Path $OutputPath "BUILD-INFO.txt") $Info -Encoding UTF8
Write-Host $Info
