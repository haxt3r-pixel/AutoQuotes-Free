param([Parameter(Mandatory=$true)][string]$NodeExe, [Parameter(Mandatory=$true)][string]$AppDir)
$ErrorActionPreference = 'Stop'
Write-Host 'AutoQuotes Free - first-time browser setup'
Write-Host 'Downloading the browser needed for PDFs and parts search. Internet access is required.'
Write-Host 'Please keep this window open until the download finishes.'
& $NodeExe (Join-Path $AppDir 'node_modules\playwright\cli.js') install chromium
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Browser setup complete. AutoQuotes Free will open shortly.'
