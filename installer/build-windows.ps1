param(
  [string]$StageDir = (Join-Path ([System.IO.Path]::GetTempPath()) ("autoquotes-stage-" + [guid]::NewGuid().ToString('N'))),
  [string]$OutputDir = (Join-Path (Get-Location) 'windows-output'),
  [string]$InnoCompiler = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows -and $PSVersionTable.PSVersion.Major -ge 6) { throw 'Build this installer on Windows.' }
if ($env:OS -ne 'Windows_NT') { throw 'Build this installer on Windows.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stage = [System.IO.Path]::GetFullPath($StageDir)
$output = [System.IO.Path]::GetFullPath($OutputDir)
if (Test-Path -LiteralPath $stage) { throw "Staging directory already exists: $stage" }
if (-not (Test-Path -LiteralPath $InnoCompiler -PathType Leaf)) { throw "Inno Setup compiler not found: $InnoCompiler" }
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$nodeArch = & $nodeExe -p 'process.arch'
if ($LASTEXITCODE -ne 0 -or $nodeArch -ne 'x64') { throw 'Building requires a 64-bit Windows Node.js executable.' }
$nodeMajor = & $nodeExe -p 'Number(process.versions.node.split(".")[0])'
if ($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 20) { throw 'Node.js 20 or newer is required; Node.js 22 is recommended.' }
$nodeLicense = Join-Path (Split-Path $nodeExe -Parent) 'LICENSE'
if (-not (Test-Path -LiteralPath $nodeLicense -PathType Leaf)) { throw 'Node distribution LICENSE was not found beside node.exe.' }

New-Item -ItemType Directory -Path $stage, $output -Force | Out-Null
$app = Join-Path $stage 'app'
$node = Join-Path $stage 'node'
New-Item -ItemType Directory -Path $app, $node, (Join-Path $app 'data') -Force | Out-Null

# Copy only application code and the public catalog. Do not stage a local database,
# user settings, exports, uploaded images, or the developer's node_modules.
Copy-Item -LiteralPath (Join-Path $repo 'dist') -Destination (Join-Path $app 'dist') -Recurse
Copy-Item -LiteralPath (Join-Path $repo 'data\vehicle-catalog.json') -Destination (Join-Path $app 'data\vehicle-catalog.json')
foreach ($file in @('package.json', 'package-lock.json', 'LICENSE', 'README.md', 'WINDOWS.md')) {
  Copy-Item -LiteralPath (Join-Path $repo $file) -Destination (Join-Path $app $file)
}
Copy-Item -LiteralPath $nodeExe -Destination (Join-Path $node 'node.exe')
Copy-Item -LiteralPath $nodeLicense -Destination (Join-Path $node 'LICENSE')
foreach ($file in @('launch.vbs', 'message.vbs', 'launcher.mjs', 'browser-install.mjs', 'browser-progress.vbs')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $stage $file)
}

Push-Location $app
$oldSkipBrowserDownload = $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
try {
  # Reinstall on Windows to get Windows-native better-sqlite3; never copy Linux binaries.
  $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
  & $npm ci --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Installing production dependencies failed.' }
  & $nodeExe -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.close()"
  if ($LASTEXITCODE -ne 0) { throw 'Windows native SQLite addon failed its smoke test.' }
} finally {
  if ($null -eq $oldSkipBrowserDownload) { Remove-Item Env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD -ErrorAction SilentlyContinue }
  else { $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = $oldSkipBrowserDownload }
  Pop-Location
}

& $InnoCompiler "/DStageDir=$stage" "/DOutputDir=$output" (Join-Path $PSScriptRoot 'AutoQuotes-Free.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compilation failed.' }
Write-Host "Windows installer created in: $output"
Write-Host "Runtime data will be stored separately under %LOCALAPPDATA%\AutoQuotes Free."
