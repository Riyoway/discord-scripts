# Shared Discord desktop injector. Called by the named runners.
param([Parameter(Mandatory = $true)][ValidateSet('autoquest', 'token', 'timestamp', 'media', 'whoami', 'export', 'snowflake')][string]$Name)
$ErrorActionPreference = "Stop"
$port = 9222
Write-Host "Fetching $Name..." -ForegroundColor Cyan
$code = Invoke-RestMethod "https://script.riyo.me/d/c/$Name" -TimeoutSec 30
$expr = "(function(){`n$code`n})()"
if ($Name -eq 'token') { $expr = $code }
if ($Name -eq 'whoami') {
    # Return console tables to PowerShell without changing the client's console.
    $expr = "(function(){const tables=[];const console={log(){},table(v){tables.push(v)},error(...v){throw new Error(v.join(' '))}};`n$code`nreturn tables;})()"
}
if ($Name -eq 'snowflake') {
    $inputId = Read-Host 'Discord ID or message link (blank to cancel)'
    if ([string]::IsNullOrWhiteSpace($inputId)) { return }
    $inputJson = ConvertTo-Json -InputObject $inputId -Compress
    # Electron does not support window.prompt; collect input here and return the result.
    $expr = "(function(){let result;const prompt=(message,value)=>value===undefined?${inputJson}:(result=value);const alert=message=>{throw new Error(message)};`n$code`nreturn result;})()"
}
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
    try { $pages = Invoke-RestMethod "http://127.0.0.1:$port/json" -TimeoutSec 3 | Where-Object { $_.type -eq 'page' -and $_.url -match '^https://(?:[a-z0-9-]+\.)?discord\.com/' } } catch { continue }
    $page = ($pages | Where-Object { $_.url -match '/channels|/app' } | Select-Object -First 1)
    if (-not $page) { $page = $pages | Select-Object -First 1 }
}
if (-not $page) { throw "No Discord window found on the debug port. Open the main window and log in first." }

$ws = [Net.WebSockets.ClientWebSocket]::new()
try {
    $connectCancellation = [Threading.CancellationTokenSource]::new(5000)
    try { $ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $connectCancellation.Token).GetAwaiter().GetResult() }
    finally { $connectCancellation.Dispose() }
    function Invoke-Cdp($id, $e, $timeoutMs = 8000) {
        $cts = [Threading.CancellationTokenSource]::new($timeoutMs)
        try {
            $msg = @{ id = $id; method = "Runtime.evaluate"; params = @{ expression = $e; userGesture = $true; awaitPromise = $false; returnByValue = $true } } | ConvertTo-Json -Compress -Depth 5
            $b = [Text.Encoding]::UTF8.GetBytes($msg)
            $ws.SendAsync([ArraySegment[byte]]::new($b), 'Text', $true, $cts.Token).Wait()
            while ($true) {
                $buffer = [IO.MemoryStream]::new()
                try {
                    do {
                        $seg = [ArraySegment[byte]]::new([byte[]]::new(16384))
                        $r = $ws.ReceiveAsync($seg, $cts.Token); $r.Wait()
                        if ($r.Result.MessageType -eq 'Close') { throw 'Discord closed the debug socket.' }
                        $buffer.Write($seg.Array, 0, $r.Result.Count)
                    } while (-not $r.Result.EndOfMessage)
                    $o = [Text.Encoding]::UTF8.GetString($buffer.ToArray()) | ConvertFrom-Json
                } finally { $buffer.Dispose() }
                if ($o.id -eq $id) { return $o }
            }
        } catch { return $null } finally { $cts.Dispose() }
    }

    # The renderer may still be booting; wait for its webpack registry before injecting.
    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
        if ((Invoke-Cdp $i "typeof webpackChunkdiscord_app" 3000).result.result.value -eq 'object') { $ready = $true; break }
        Start-Sleep 1
    }
    if (-not $ready) { throw "Discord did not finish loading. Log in and try again." }

    Write-Host "Injecting..." -ForegroundColor Cyan
    $reply = Invoke-Cdp 100 $expr
} finally { $ws.Dispose() }
if (-not $reply) { throw "Timed out waiting for Discord to run the script." }
if ($reply.result.exceptionDetails) {
    $ex = $reply.result.exceptionDetails
    throw "$Name threw inside Discord: $(if ($ex.exception.description) { $ex.exception.description } else { $ex.text })"
}
if ($reply.error) { throw "Discord debug protocol failed: $($reply.error.message)" }
$value = $reply.result.result.value
switch ($Name) {
    'token' {
        if (-not $value) { throw "No token returned. Are you logged in to the desktop app?" }
        Set-Clipboard -Value $value
        Write-Host 'Token copied to clipboard.' -ForegroundColor Green
    }
    'whoami' {
        if (-not $value) { throw "No account inventory returned." }
        $value[0] | Format-List
        $value[1] | Format-Table name, id, owner -AutoSize
    }
    'snowflake' {
        if ($value) {
            Set-Clipboard -Value $value
            Write-Host "Timestamp copied to clipboard: $value" -ForegroundColor Green
        }
    }
    default { Write-Host "$Name injected. Use its panel in Discord." -ForegroundColor Green }
}
