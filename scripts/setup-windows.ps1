$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

try {
    $node = Get-Command node.exe -ErrorAction Stop
    $npm = Get-Command npm.cmd -ErrorAction Stop
    $npx = Get-Command npx.cmd -ErrorAction Stop
    $version = & $node.Source --version
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 20) {
        throw 'Node.js 20 or later is required; Node.js 22 is recommended.'
    }

    Write-Host 'Installing project dependencies...'
    & $npm.Source ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

    Write-Host 'Installing Playwright Chromium for PDF generation and parts features...'
    & $npx.Source playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw 'Playwright Chromium installation failed.' }

    Write-Host 'Building AutoQuotes Free...'
    & $npm.Source run build
    if ($LASTEXITCODE -ne 0) { throw 'Application build failed.' }

    Write-Host 'Setup complete. Run scripts\launch-windows.cmd to start the application.'
    Write-Host 'The database is created on first launch; existing records are not cleared.'
} catch {
    Write-Error "Setup failed: $($_.Exception.Message)"
    exit 1
}
