# Read your Discord token via the desktop client's Chrome DevTools Protocol.
#   irm https://script.riyo.me/p/token | iex
# Self-contained per script; factor the shared CDP block into a helper if these multiply.
$ErrorActionPreference = "Stop"
$port = 9222
Write-Host "Fetching token reader..." -ForegroundColor Cyan
$code = Invoke-RestMethod "https://script.riyo.me/d/token"   # expression ends in ",w.t" so evaluate returns the token

# Ensure the desktop client is running with the debug port open.
function Test-Port { try { Invoke-RestMethod "http://127.0.0.1:$port/json/version" -TimeoutSec 2 | Out-Null; $true } catch { $false } }
if (-not (Test-Port)) {
    # Works with any flavor: folder name == process name == "<name>.exe".
    $installed = "Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment" | Where-Object { Test-Path "$env:LOCALAPPDATA\$_\Update.exe" }
    if (-not $installed) { throw "No Discord desktop app found (looked for Discord, PTB, Canary, Development)." }
    $flavor = ($installed | Where-Object { Get-Process $_ -EA SilentlyContinue } | Select-Object -First 1)
    if (-not $flavor) { $flavor = $installed | Select-Object -First 1 }
    Write-Host "Restarting $flavor with remote debugging enabled (any call will drop)..." -ForegroundColor Cyan
    Get-Process $flavor -EA SilentlyContinue | Stop-Process -Force
    Start-Sleep 2
    & "$env:LOCALAPPDATA\$flavor\Update.exe" --processStart "$flavor.exe" --process-start-args "--remote-debugging-port=$port"
    $ok = $false; for ($i = 0; $i -lt 30; $i++) { Start-Sleep 1; if (Test-Port) { $ok = $true; break } }
    if (-not $ok) { throw "Debug port never opened; this Discord build may block --remote-debugging-port." }
}

# Find the main Discord window (each /json call is capped so a stuck port can't hang us).
Write-Host "Locating the Discord window..." -ForegroundColor Cyan
$page = $null
for ($i = 0; $i -lt 20 -and -not $page; $i++) {
    Start-Sleep 1
    try { $pages = Invoke-RestMethod "http://127.0.0.1:$port/json" -TimeoutSec 3 | Where-Object { $_.type -eq 'page' -and $_.url -match 'discord.com' } } catch { continue }
    $page = ($pages | Where-Object { $_.url -match '/channels|/app' } | Select-Object -First 1)
    if (-not $page) { $page = $pages | Select-Object -First 1 }
}
if (-not $page) { throw "No Discord window found on the debug port. Open the main window and log in first." }

$ws = [Net.WebSockets.ClientWebSocket]::new()
if (-not $ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait(5000)) { throw "Timed out connecting to the Discord debug socket." }
function Invoke-Cdp($id, $e, $timeoutMs = 8000) {
    $cts = [Threading.CancellationTokenSource]::new($timeoutMs)
    try {
        $msg = @{ id = $id; method = "Runtime.evaluate"; params = @{ expression = $e; returnByValue = $true } } | ConvertTo-Json -Compress -Depth 5
        $b = [Text.Encoding]::UTF8.GetBytes($msg)
        $ws.SendAsync([ArraySegment[byte]]::new($b), 'Text', $true, $cts.Token).Wait()
        while ($true) {
            $sb = [Text.StringBuilder]::new()
            do {
                $seg = [ArraySegment[byte]]::new([byte[]]::new(16384))
                $r = $ws.ReceiveAsync($seg, $cts.Token); $r.Wait()
                [void]$sb.Append([Text.Encoding]::UTF8.GetString($seg.Array, 0, $r.Result.Count))
            } while (-not $r.Result.EndOfMessage)
            $o = $sb.ToString() | ConvertFrom-Json
            if ($o.id -eq $id) { return $o }
        }
    } catch { return $null } finally { $cts.Dispose() }
}

# The renderer may still be booting; wait for its webpack registry before reading.
for ($i = 0; $i -lt 20; $i++) {
    if ((Invoke-Cdp $i "typeof webpackChunkdiscord_app" 3000).result.result.value -eq 'object') { break }
    Start-Sleep 1
}

$reply = Invoke-Cdp 100 $code
$ws.Dispose()
if (-not $reply) { throw "Timed out waiting for Discord to respond." }
if ($reply.result.exceptionDetails) {
    $ex = $reply.result.exceptionDetails
    throw "token read threw inside Discord: $(if ($ex.exception.description) { $ex.exception.description } else { $ex.text })"
}
$token = $reply.result.result.value
if (-not $token) { throw "No token returned. Are you logged in to the desktop app?" }
Set-Clipboard -Value $token   # kept off the terminal so it isn't left in scrollback/history
$mask = if ($token.Length -gt 12) { $token.Substring(0, 6) + "..." + $token.Substring($token.Length - 4) } else { "****" }
Write-Host "Token copied to clipboard ($mask)." -ForegroundColor Green
