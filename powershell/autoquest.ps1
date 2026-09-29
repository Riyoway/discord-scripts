# Inject autoquest into the Discord desktop client over the Chrome DevTools Protocol.
# PowerShell does the fetching, so Discord's CSP never applies.
#   irm script.riyo.me/p/autoquest | iex
# Self-contained per script; factor the shared CDP block into a helper if these multiply.
$ErrorActionPreference = "Stop"
$port = 9222
$code = Invoke-RestMethod "https://script.riyo.me/d/autoquest"

# Ensure Discord is running with the debug port open.
function Test-Port { try { Invoke-RestMethod "http://127.0.0.1:$port/json/version" -TimeoutSec 2 | Out-Null; $true } catch { $false } }
if (-not (Test-Port)) {
    Get-Process Discord -EA SilentlyContinue | Stop-Process -Force   # full quit; interrupts calls
    Start-Sleep 2
    & "$env:LOCALAPPDATA\Discord\Update.exe" --processStart Discord.exe --process-start-args "--remote-debugging-port=$port"
    $ok = $false; for ($i = 0; $i -lt 30; $i++) { Start-Sleep 1; if (Test-Port) { $ok = $true; break } }
    if (-not $ok) { throw "Debug port never opened; this Discord build may block --remote-debugging-port." }
}

# Find the discord.com window and inject (runs in the page's main world, same as the console).
$page = $null
for ($i = 0; $i -lt 20 -and -not $page; $i++) {
    Start-Sleep 1
    $page = Invoke-RestMethod "http://127.0.0.1:$port/json" | Where-Object { $_.type -eq 'page' -and $_.url -match 'discord.com' } | Select-Object -First 1
}
if (-not $page) { throw "No Discord window found on the debug port." }

$ws = [Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
$msg = @{ id = 1; method = "Runtime.evaluate"; params = @{ expression = $code; userGesture = $true; awaitPromise = $false } } | ConvertTo-Json -Compress -Depth 5
$b = [Text.Encoding]::UTF8.GetBytes($msg)
$ws.SendAsync([ArraySegment[byte]]::new($b), 'Text', $true, [Threading.CancellationToken]::None).Wait()
$rb = [byte[]]::new(65536)
$r = $ws.ReceiveAsync([ArraySegment[byte]]::new($rb), [Threading.CancellationToken]::None); $r.Wait(); $ws.Dispose()
"autoquest injected."
