$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerFile = Join-Path $ProjectRoot 'dist\main.js'
$Address = 'http://127.0.0.1:3000'
$listener = $null
$server = $null

try {
    $node = Get-Command node.exe -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $ServerFile -PathType Leaf)) {
        throw 'The application is not built. Run scripts\setup-windows.cmd first.'
    }
    # Do not open an unrelated service if another process is using the port.
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 3000)
    try { $listener.Start() } catch { throw 'Port 3000 is in use. Stop the other application before launching AutoQuotes Free.' }
    $listener.Stop()
    $listener = $null

    $logDirectory = Join-Path $env:LOCALAPPDATA 'AutoQuotesFree\logs'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $logPrefix = [guid]::NewGuid().ToString('N')
    $stdout = Join-Path $logDirectory "$logPrefix.log"
    $stderr = Join-Path $logDirectory "$logPrefix.err.log"
    $oldHost = $env:HOST
    $oldPort = $env:PORT
    $oldShutdown = $env:AUTO_SHUTDOWN
    try {
        $env:HOST = '127.0.0.1'
        $env:PORT = '3000'
        $env:AUTO_SHUTDOWN = '1'
        $server = Start-Process -FilePath $node.Source -ArgumentList ('"' + $ServerFile + '"') `
            -WorkingDirectory $ProjectRoot -RedirectStandardOutput $stdout -RedirectStandardError $stderr `
            -WindowStyle Hidden -PassThru
    } finally {
        $env:HOST = $oldHost
        $env:PORT = $oldPort
        $env:AUTO_SHUTDOWN = $oldShutdown
    }

    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        $server.Refresh()
        if ($server.HasExited) { throw "The server stopped early. Check $stderr and $stdout." }
        try {
            $response = Invoke-WebRequest -Uri "$Address/api/health" -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw "The server did not become ready. Check $stderr and $stdout." }
    Start-Process $Address
    Write-Host "AutoQuotes Free is ready at $Address. It will stop when the app tab closes."
} catch {
    if ($null -ne $listener) { $listener.Stop() }
    if ($null -ne $server -and -not $ready) {
        try { if (-not $server.HasExited) { $server.Kill() } } catch { }
    }
    Write-Error "Launch failed: $($_.Exception.Message)"
    exit 1
}
