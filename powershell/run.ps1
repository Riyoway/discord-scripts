# Shared Discord desktop injector. Called by the named runners.
param(
    [Parameter(Mandatory = $true)][ValidateSet('autoquest', 'token', 'timestamp', 'media', 'whoami', 'export', 'snowflake', 'search', 'badge-gametime')][string]$Name,
    [string]$Client
)
$ErrorActionPreference = "Stop"
$macOS = $PSVersionTable.PSEdition -eq 'Core' -and $IsMacOS
if (-not $macOS -and $env:OS -ne 'Windows_NT') { throw 'This runner supports Windows and macOS (PowerShell 7).' }
function Confirm-ScriptRun($scriptName) {
    $directory = if ($macOS) { Join-Path $HOME 'Library/Application Support/Riyo Scripts/consent' }
        else { Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Riyo Scripts/consent' }
    $file = Join-Path $directory "$scriptName.txt"
    try { if ((Get-Content -LiteralPath $file -Raw -ErrorAction Stop).Trim() -eq 'yes') { return $true } } catch { }
    Write-Host "`nRiyo Scripts - $scriptName"
    Write-Host 'Use this script at your own risk. You are responsible for any consequences, including issues affecting your account or data.'
    while ($true) {
        $choice = ([string](Read-Host 'Run this script? [Yes/No] (default: No)')).Trim()
        if ($choice -match '^(no|n)?$') { return $false }
        if ($choice -match '^(yes|y)$') { break }
        Write-Host 'Please enter Yes or No.'
    }
    try {
        [void](New-Item -ItemType Directory -Path $directory -Force)
        Set-Content -LiteralPath $file -Value 'yes' -Encoding ASCII
    } catch { Write-Host 'Could not remember your choice; you will be asked again next time.' }
    return $true
}
if (-not (Confirm-ScriptRun $Name)) { Write-Host 'Cancelled.'; return }
$selected = $null
Write-Host "Fetching $Name..." -ForegroundColor Cyan
$code = Invoke-RestMethod "https://script.riyo.me/d/c/$Name" -TimeoutSec 30
$approval = "const riyoScriptApproved='$Name';"
$expr = "(function(){${approval}`n$code`n})()"
if ($Name -eq 'token') { $expr = "(function(){${approval}return (`n$($code.Trim().TrimEnd(';'))`n);})()" }
if ($Name -eq 'whoami') {
    # Return console tables to PowerShell without changing the client's console.
    $expr = "(function(){${approval}const tables=[];const console={log(){},table(v){tables.push(v)},error(...v){throw new Error(v.join(' '))}};`n$code`nreturn tables;})()"
}
if ($Name -eq 'snowflake') {
    $inputId = Read-Host 'Discord ID or message link (blank to cancel)'
    if ([string]::IsNullOrWhiteSpace($inputId)) { return }
    $inputJson = ConvertTo-Json -InputObject $inputId -Compress
    # Electron does not support window.prompt; collect input here and return the result.
    $expr = "(function(){${approval}let result;const prompt=(message,value)=>value===undefined?${inputJson}:(result=value);const alert=message=>{throw new Error(message)};`n$code`nreturn result;})()"
}
# Ensure the desktop client is running with its own debug port.
function Select-DiscordClient($Items, $Requested) {
    $choices = @($Items)
    if ($Requested) {
        $choices = @($choices | Where-Object { $_.Name -eq $Requested -or $_.Key -eq $Requested -or ($_.ProcessId -and [string]$_.ProcessId -eq $Requested) })
        if (-not $choices.Count) { throw "Discord client '$Requested' was not found." }
    } else {
        $running = @($choices | Where-Object { $_.ProcessId })
        if ($running.Count) { $choices = $running }
    }
    if (-not $choices.Count) { throw 'No Discord desktop client found.' }
    if ($choices.Count -eq 1) { return $choices[0] }
    Write-Host "`nChoose the Discord client to use:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $choices.Count; $i++) {
        $state = if ($choices[$i].ProcessId) { "PID $($choices[$i].ProcessId)" } else { 'not running' }
        Write-Host ("{0}. {1} ({2}) - {3}" -f ($i + 1), $choices[$i].Name, $state, $choices[$i].Executable)
    }
    while ($true) {
        $answer = Read-Host 'Pick a number (blank to cancel)'
        if ([string]::IsNullOrWhiteSpace($answer)) { return $null }
        $number = 0
        if ([int]::TryParse($answer, [ref]$number) -and $number -ge 1 -and $number -le $choices.Count) { return $choices[$number - 1] }
        Write-Host 'Choose one of the listed numbers.'
    }
}
function Get-MacDiscordPids($Executable) {
    $PSNativeCommandUseErrorActionPreference = $false
    $ids = @(& /usr/bin/pgrep -f "^$([regex]::Escape($Executable))([[:space:]]|$)")
    if ($LASTEXITCODE -gt 1) { throw 'Could not inspect running Discord applications.' }
    @($ids | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
}
function Get-DiscordClients {
    $variants = @('Discord', 'DiscordPTB', 'DiscordCanary', 'DiscordDevelopment')
    $keys = @('stable', 'ptb', 'canary', 'development')
    if ($macOS) {
        foreach ($directory in '/Applications', (Join-Path $HOME 'Applications')) {
            for ($i = 0; $i -lt $variants.Count; $i++) {
                $label = @('Discord', 'Discord PTB', 'Discord Canary', 'Discord Development')[$i]
                $bundle = Join-Path $directory "$label.app"
                $plist = Join-Path $bundle 'Contents/Info.plist'
                if (-not (Test-Path -LiteralPath $plist)) { continue }
                $binary = & /usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' $plist
                if ($LASTEXITCODE -ne 0 -or -not $binary -or $binary -match '[/\\]') { throw "Invalid Discord application bundle: $bundle" }
                $executable = Join-Path $bundle "Contents/MacOS/$binary"
                if (-not (Test-Path -LiteralPath $executable)) { continue }
                $ids = @(Get-MacDiscordPids $executable)
                $instances = if ($ids.Count) { $ids } else { @(0) }
                foreach ($instance in $instances) {
                    [pscustomobject]@{ Name=$label; Key=$keys[$i]; ProcessId=$instance; Executable=$executable; Bundle=$bundle; Instances=$ids.Count; DefaultPort=9222+$i }
                }
            }
        }
        return
    }
    $filter = ($variants | ForEach-Object { "Name='$_.exe'" }) -join ' OR '
    $processes = @(Get-CimInstance Win32_Process -Filter $filter -ErrorAction Stop | Where-Object { $_.CommandLine -notmatch '(?:^|\s)"?--type(?:=|\s)' })
    for ($i = 0; $i -lt $variants.Count; $i++) {
        $variant = $variants[$i]
        $running = @($processes | Where-Object { $_.Name -eq "$variant.exe" })
        foreach ($process in $running) {
            [pscustomobject]@{ Name=$variant; Key=$keys[$i]; ProcessId=[int]$process.ProcessId; Executable=$process.ExecutablePath; CommandLine=$process.CommandLine; DefaultPort=9222+$i }
        }
        $updater = Join-Path $env:LOCALAPPDATA "$variant/Update.exe"
        if (-not $running.Count -and (Test-Path -LiteralPath $updater)) {
            [pscustomobject]@{ Name=$variant; Key=$keys[$i]; ProcessId=0; Executable=$updater; Updater=$true; DefaultPort=9222+$i }
        }
    }
}
function Get-DiscordListeners {
    if (-not $macOS) {
        Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalAddress -in @('127.0.0.1','0.0.0.0') } | ForEach-Object {
            [pscustomobject]@{ ProcessId=[int]$_.OwningProcess; Port=[int]$_.LocalPort }
        }
        return
    }
    $PSNativeCommandUseErrorActionPreference = $false
    $owner = 0
    foreach ($line in @(& /usr/sbin/lsof -nP -iTCP -sTCP:LISTEN -Fpn)) {
        if ($line -match '^p(\d+)$') { $owner = [int]$Matches[1] }
        elseif ($line -match '^n(?:127\.0\.0\.1|0\.0\.0\.0|\*):(\d+)$') {
            [pscustomobject]@{ ProcessId=$owner; Port=[int]$Matches[1] }
        }
    }
    if ($LASTEXITCODE -gt 1) { throw 'Could not inspect local Discord ports.' }
}
function Get-DiscordStartupTimeout($MaximumMilliseconds) {
    $remainingSeconds = [Math]::Floor((60000 - $startupWait.Elapsed.TotalMilliseconds) / 1000)
    if ($remainingSeconds -lt 1) { throw 'Discord startup timed out (60-second limit). Open Discord, wait for it to load, and try again.' }
    [int][Math]::Min($MaximumMilliseconds, $remainingSeconds * 1000)
}
function Test-Port {
    $owners = @(Get-DiscordListeners | Where-Object { $_.Port -eq $port })
    if (-not $selected.ProcessId -and $owners.Count) {
        $started = @(Get-DiscordClients | Where-Object {
            if ($_.Name -ne $selected.Name -or $_.ProcessId -notin $owners.ProcessId) { return $false }
            if ($macOS) { return $_.Bundle -eq $selected.Bundle }
            if ($selected.Updater) { return $_.Executable -and $_.Executable.StartsWith((Split-Path $selected.Executable -Parent) + '\', [StringComparison]::OrdinalIgnoreCase) }
            $_.Executable -eq $selected.Executable
        })
        if ($started.Count -eq 1) { $selected.ProcessId = $started[0].ProcessId }
    }
    if (-not $selected.ProcessId -or $selected.ProcessId -notin $owners.ProcessId) { return $false }
    try {
        $version = Invoke-RestMethod "http://127.0.0.1:$port/json/version" -TimeoutSec ((Get-DiscordStartupTimeout 2000) / 1000)
        return [bool]($version.Browser -and $version.'Protocol-Version')
    } catch { return $false }
}
function Test-DiscordRunning {
    if (-not $selected.ProcessId) { return [bool]@(Get-DiscordClients | Where-Object { $_.Name -eq $selected.Name -and $_.ProcessId }).Count }
    if ($macOS) { return $selected.ProcessId -in @(Get-MacDiscordPids $selected.Executable) }
    return [bool](Get-Process -Id $selected.ProcessId -ErrorAction SilentlyContinue)
}
function Wait-Discord($Probe, $Message, $StartupAttempts = 0) {
    for ($attempt = 0; ; $attempt++) {
        $null = Get-DiscordStartupTimeout 1000
        $result = & $Probe $attempt
        $null = Get-DiscordStartupTimeout 1000
        if ($result) { return $result }
        if (-not (Test-DiscordRunning) -and $attempt -ge $StartupAttempts) { throw "$Message Discord is no longer running. Open Discord and try again." }
        if ($attempt % 15 -eq 0) { Write-Host "$Message Waiting for $($selected.Name) (Ctrl+C to cancel)..." -ForegroundColor DarkGray }
        Start-Sleep -Seconds 1
    }
}
function Get-DiscordLaunchArguments($CommandLine, $DebugPort) {
    if (-not ('RiyoScriptCommandLine' -as [type])) {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RiyoScriptCommandLine {
    [DllImport("shell32.dll", SetLastError=true)] static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string command, out int count);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
    public static string[] Split(string command) {
        int count; IntPtr memory = CommandLineToArgvW(command, out count);
        if (memory == IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
        try {
            string[] result = new string[count];
            for (int i=0; i<count; i++) result[i] = Marshal.PtrToStringUni(Marshal.ReadIntPtr(memory, i * IntPtr.Size));
            return result;
        } finally { LocalFree(memory); }
    }
}
'@
    }
    $values = @([RiyoScriptCommandLine]::Split($CommandLine))
    $kept = @()
    for ($i = 1; $i -lt $values.Count; $i++) {
        if ($values[$i] -eq '--remote-debugging-port') { $i++; continue }
        if ($values[$i] -match '^--remote-debugging-(?:port=|pipe$)') { continue }
        $kept += $values[$i]
    }
    $kept += "--remote-debugging-port=$DebugPort"
    ($kept | ForEach-Object { '"' + [regex]::Replace([regex]::Replace($_, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"' }) -join ' '
}
function Start-DiscordClient($Target, $DebugPort) {
    $null = Get-DiscordStartupTimeout 1000
    if ($macOS) {
        if ($Target.Instances -gt 1) { throw 'This app has multiple instances. Start the intended instance with its own --remote-debugging-port before injecting.' }
        $PSNativeCommandUseErrorActionPreference = $false
        if ($Target.ProcessId) {
            $command = & /bin/ps -ww -p $Target.ProcessId -o command=
            if ($LASTEXITCODE -ne 0 -or -not $command) { throw 'Could not inspect the selected client arguments.' }
            if ($command -match '(?:^|\s)"?--(?:user-data-dir|profile-directory)(?:=|\s)') { throw 'Start this custom profile with its own --remote-debugging-port before injecting.' }
            & /bin/kill -TERM $Target.ProcessId
            if ($LASTEXITCODE -ne 0) { throw 'Could not quit the selected Discord client.' }
            for ($i=0; $i -lt 20 -and $Target.ProcessId -in @(Get-MacDiscordPids $Target.Executable); $i++) { $null=Get-DiscordStartupTimeout 1000; Start-Sleep -Milliseconds 500 }
            if ($Target.ProcessId -in @(Get-MacDiscordPids $Target.Executable)) { throw 'The selected Discord client did not quit.' }
        }
        $Target.ProcessId = 0
        & /usr/bin/open -n -a $Target.Bundle --args "--remote-debugging-port=$DebugPort"
        if ($LASTEXITCODE -ne 0) { throw 'Could not launch the selected Discord client.' }
        return
    }
    if ($Target.Updater) {
        $null = Start-Process -FilePath $Target.Executable -ArgumentList "--processStart $($Target.Name).exe --process-start-args `"--remote-debugging-port=$DebugPort`"" -PassThru -WindowStyle Hidden
        return
    }
    if (-not $Target.Executable -or -not $Target.CommandLine) { throw 'Cannot read the selected client executable or arguments. Use a terminal with the same privileges as Discord.' }
    $arguments = Get-DiscordLaunchArguments $Target.CommandLine $DebugPort
    Stop-Process -Id $Target.ProcessId -Force -ErrorAction Stop
    $Target.ProcessId = (Start-Process -FilePath $Target.Executable -ArgumentList $arguments -PassThru).Id
}
function Select-DiscordPage($Pages) {
    $items = @($Pages)
    if ($items.Count -eq 1) { return $items[0] }
    Write-Host "`nChoose the Discord window:" -ForegroundColor Cyan
    for ($i=0; $i -lt $items.Count; $i++) { Write-Host ("{0}. {1} - {2}" -f ($i+1), $items[$i].title, $items[$i].url) }
    while ($true) {
        $answer = Read-Host 'Pick a number (blank to cancel)'
        if ([string]::IsNullOrWhiteSpace($answer)) { return $null }
        $number = 0
        if ([int]::TryParse($answer,[ref]$number) -and $number -ge 1 -and $number -le $items.Count) { return $items[$number-1] }
        Write-Host 'Choose one of the listed numbers.'
    }
}
function Get-DiscordSocketUrl($Page, $DebugPort) {
    $expected = '^ws://127\.0\.0\.1:' + $DebugPort + '/devtools/page/[a-z0-9-]+$'
    if ($Page.webSocketDebuggerUrl -notmatch $expected) { throw 'Unexpected Discord debug socket URL.' }
    $Page.webSocketDebuggerUrl
}

$selected = Select-DiscordClient @(Get-DiscordClients) $Client
if (-not $selected) { Write-Host 'Cancelled.'; return }
$state = if ($selected.ProcessId) { " (PID $($selected.ProcessId))" } else { '' }
Write-Host "Using $($selected.Name)$state." -ForegroundColor Cyan
$startupWait = [Diagnostics.Stopwatch]::StartNew()
$listeners = @(Get-DiscordListeners)
$found = $false
foreach ($candidatePort in @($listeners | Where-Object { $_.ProcessId -eq $selected.ProcessId } | Select-Object -ExpandProperty Port -Unique)) {
    $port = $candidatePort
    if (Test-Port) { $found=$true; break }
}
if (-not $found) {
    $port = $selected.DefaultPort
    while ($port -in $listeners.Port) { $port++ }
    if ($port -gt 65535) { throw 'No available local debug port.' }
    Write-Host "Restarting only $($selected.Name) with remote debugging (its calls will drop)..." -ForegroundColor Cyan
    Start-DiscordClient $selected $port
    $null = Wait-Discord { Test-Port } 'Waiting for the selected client debug port.' 30
}
Write-Host 'Locating the Discord window...' -ForegroundColor Cyan
$page = Wait-Discord {
    try { $pages = @(Invoke-RestMethod "http://127.0.0.1:$port/json" -TimeoutSec ((Get-DiscordStartupTimeout 3000)/1000) | ForEach-Object { $_ } | Where-Object { $_.type -eq 'page' -and $_.url -match '^https://(?:[a-z0-9-]+\.)?discord\.com/(?:channels|quest-home|app)(?:/|$)' }) } catch { return $null }
    $pages
} 'Waiting for the main window. Open Discord and log in if needed.'
$startupWait.Stop()
try { $page = Select-DiscordPage @($page) } finally { $startupWait.Start() }
if (-not $page) { Write-Host 'Cancelled.'; return }
if (-not (Test-Port)) { throw 'The selected Discord client debug port is no longer available.' }
$socket = Get-DiscordSocketUrl $page $port


$ws = [Net.WebSockets.ClientWebSocket]::new()
try {
    $connectCancellation = [Threading.CancellationTokenSource]::new((Get-DiscordStartupTimeout 5000))
    try { [void]$ws.ConnectAsync([Uri]$socket, $connectCancellation.Token).GetAwaiter().GetResult() }
    finally { $connectCancellation.Dispose() }
    $cdpSequence = [ref]0
    function Invoke-Cdp($e, $timeoutMs = 8000) {
        $id = ++$cdpSequence.Value
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
    $null = Wait-Discord { (Invoke-Cdp "typeof webpackChunkdiscord_app" (Get-DiscordStartupTimeout 3000)).result.result.value -eq 'object' } 'Waiting for Discord to finish loading.'

    if (-not (Test-Port)) { throw 'The selected Discord client debug port is no longer available.' }
    Write-Host "Injecting..." -ForegroundColor Cyan
    $reply = Invoke-Cdp $expr
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
