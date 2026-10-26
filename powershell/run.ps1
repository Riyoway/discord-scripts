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
            [pscustomobject]@{ Name=$variant; Key=$keys[$i]; ProcessId=[int]$process.ProcessId; Created=$process.CreationDate; Executable=$process.ExecutablePath; CommandLine=$process.CommandLine; DefaultPort=9222+$i }
        }
        $updater = Join-Path $env:LOCALAPPDATA "$variant/Update.exe"
        if (-not $running.Count -and (Test-Path -LiteralPath $updater)) {
            [pscustomobject]@{ Name=$variant; Key=$keys[$i]; ProcessId=0; Executable=$updater; Updater=$true; DefaultPort=9222+$i }
        }
    }
}
function Get-DiscordListeners {
    if (-not $macOS) {
        # CIM port queries can take seconds per poll; numeric netstat output also works without that module.
        $rows = @(& "$env:SystemRoot\System32\netstat.exe" -ano)
        if ($LASTEXITCODE -ne 0) { throw 'Could not inspect local Discord ports.' }
        foreach ($row in $rows) {
            if ($row -match '^\s*TCP\s+(\S+):(\d+)\s+(?:0\.0\.0\.0|\[::\]):0\s+\S+\s+(\d+)\s*$') {
                [pscustomobject]@{ Address=$Matches[1]; Port=[int]$Matches[2]; ProcessId=[int]$Matches[3] }
            }
        }
        return
    }
    $PSNativeCommandUseErrorActionPreference = $false
    $owner = 0
    foreach ($line in @(& /usr/sbin/lsof -nP -iTCP -sTCP:LISTEN -Fpn)) {
        if ($line -match '^p(\d+)$') { $owner = [int]$Matches[1] }
        elseif ($line -match '^n(127\.0\.0\.1|0\.0\.0\.0|\*|\[::1\]|\[::\]):(\d+)$') {
            [pscustomobject]@{ ProcessId=$owner; Address=$Matches[1]; Port=[int]$Matches[2] }
        }
    }
    if ($LASTEXITCODE -gt 1) { throw 'Could not inspect local Discord ports.' }
}
function Get-DiscordStartupTimeout($MaximumMilliseconds) {
    $remainingSeconds = [Math]::Floor((60000 - $startupWait.Elapsed.TotalMilliseconds) / 1000)
    if ($remainingSeconds -lt 1) { throw "Discord startup timed out (60-second limit). Client: $($selected.Name), PID: $($selected.ProcessId), debug port: $port. Open that client, wait for it to load, and try again." }
    [int][Math]::Min($MaximumMilliseconds, $remainingSeconds * 1000)
}
function Get-DiscordLoopback($Address) {
    if ($Address -in @('[::1]','[::]')) { return '[::1]' }
    if (-not $Address -or $Address -in @('127.0.0.1','0.0.0.0','*')) { return '127.0.0.1' }
}
function Get-DiscordDebugJson($DebugHost, $DebugPort, $Path, $TimeoutMilliseconds) {
    if ($DebugHost -notin @('127.0.0.1','[::1]') -or $DebugPort -lt 1 -or $DebugPort -gt 65535 -or $Path -notin @('/json/version','/json')) { throw 'Invalid local Discord debug endpoint.' }
    if (-not ('Net.Http.HttpClient' -as [type])) { Add-Type -AssemblyName System.Net.Http }
    $handler = New-Object Net.Http.HttpClientHandler
    $handler.UseProxy = $false
    $handler.AllowAutoRedirect = $false
    $http = [Net.Http.HttpClient]::new($handler)
    $http.Timeout = [TimeSpan]::FromMilliseconds($TimeoutMilliseconds)
    try {
        # GetAsync buffers the entire JSON body within the same timeout.
        $response = $http.GetAsync("http://${DebugHost}:$DebugPort$Path").GetAwaiter().GetResult()
        try {
            if ([int]$response.StatusCode -ne 200) { throw 'Unexpected Discord debug response.' }
            $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        } finally { $response.Dispose() }
    } finally { $http.Dispose() }
}
function Test-Port {
    $owners = @(Get-DiscordListeners | Where-Object { $_.Port -eq $port -and (Get-DiscordLoopback $_.Address) })
    if ($selected.ProcessId -notin $owners.ProcessId -and $owners.Count -and ($selected.LaunchedAt -or ($macOS -and -not $selected.ProcessId))) {
        $started = @(Get-DiscordClients | Where-Object {
            if ($_.Name -ne $selected.Name -or $_.ProcessId -notin $owners.ProcessId) { return $false }
            if ($macOS) { return $_.Bundle -eq $selected.Bundle }
            if ($_.ProcessId -in $selected.PreviousProcessIds -or -not $_.Created -or $_.Created.ToUniversalTime() -lt $selected.LaunchedAt) { return $false }
            if ((Get-DiscordProfileKey $_.CommandLine) -ne (Get-DiscordProfileKey $selected.CommandLine)) { return $false }
            $directory = Split-Path $selected.Executable -Parent
            $versioned = (Split-Path $directory -Leaf) -match '^app-\d'
            if ($versioned) { $directory = Split-Path $directory -Parent }
            if ($selected.Updater -or $versioned) { return $_.Executable -and $_.Executable.StartsWith($directory + '\', [StringComparison]::OrdinalIgnoreCase) }
            $_.Executable -eq $selected.Executable
        })
        if ($started.Count -eq 1) { $selected.ProcessId = $started[0].ProcessId }
    }
    if (-not $selected.ProcessId -or $selected.ProcessId -notin $owners.ProcessId) { return $false }
    foreach ($owner in @($owners | Where-Object ProcessId -eq $selected.ProcessId)) {
        $debugHost = Get-DiscordLoopback $owner.Address
        try {
            $version = Get-DiscordDebugJson $debugHost $port '/json/version' (Get-DiscordStartupTimeout 2000)
            if ($version.Browser -and $version.'Protocol-Version') {
                $selected | Add-Member -NotePropertyName DebugHost -NotePropertyValue $debugHost -Force
                $selected | Add-Member -NotePropertyName DebugPort -NotePropertyValue $port -Force
                return $true
            }
        } catch { }
    }
    return $false
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
function Initialize-DiscordCommandLine {
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
}
function Get-DiscordProfileKey($CommandLine) {
    Initialize-DiscordCommandLine
    $profile = [ordered]@{'--user-data-dir'=''; '--profile-directory'=''}
    if ($CommandLine) {
        $values = @([RiyoScriptCommandLine]::Split($CommandLine))
        for ($i=1; $i -lt $values.Count; $i++) {
            if ($values[$i] -match '^(--user-data-dir|--profile-directory)=(.*)$') { $profile[$Matches[1]]=$Matches[2] }
            elseif ($profile.Contains($values[$i]) -and $i+1 -lt $values.Count) { $key=$values[$i]; $i++; $profile[$key]=$values[$i] }
        }
    }
    ConvertTo-Json -InputObject $profile -Compress
}
function Get-DiscordDebugPort($CommandLine) {
    $number = 0
    if ($CommandLine -match '(?:^|\s)"?--remote-debugging-port(?:=|"?\s+"?)(\d+)"?(?=\s|$)' -and [int]::TryParse($Matches[1],[ref]$number) -and $number -le 65535) { return $number }
}
function Get-DiscordLaunchArguments($CommandLine, $DebugPort) {
    Initialize-DiscordCommandLine
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
function Start-DiscordProcess($FilePath, $Arguments, [switch]$Hidden) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $FilePath
    $info.Arguments = $Arguments
    $info.WorkingDirectory = [IO.Path]::GetDirectoryName($FilePath)
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    # Electron otherwise attaches to PowerShell's console and exits when that console closes.
    $info.EnvironmentVariables['ELECTRON_NO_ATTACH_CONSOLE'] = '1'
    if ($Hidden) { $info.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden }
    $process = [Diagnostics.Process]::Start($info)
    try { $process.Id } finally { $process.Dispose() }
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
        $Target | Add-Member -NotePropertyName PreviousProcessIds -NotePropertyValue @(Get-DiscordClients | Select-Object -ExpandProperty ProcessId) -Force
        $Target | Add-Member -NotePropertyName LaunchedAt -NotePropertyValue ([DateTime]::UtcNow) -Force
        $null = Start-DiscordProcess $Target.Executable "--processStart $($Target.Name).exe --process-start-args `"--remote-debugging-port=$DebugPort`"" -Hidden
        return
    }
    if (-not $Target.Executable -or -not $Target.CommandLine) { throw 'Cannot read the selected client executable or arguments. Use a terminal with the same privileges as Discord.' }
    $arguments = Get-DiscordLaunchArguments $Target.CommandLine $DebugPort
    $Target | Add-Member -NotePropertyName PreviousProcessIds -NotePropertyValue @(Get-DiscordClients | Select-Object -ExpandProperty ProcessId) -Force
    $Target | Add-Member -NotePropertyName LaunchedAt -NotePropertyValue ([DateTime]::UtcNow) -Force
    $previous = Get-Process -Id $Target.ProcessId -ErrorAction Stop
    try {
        Stop-Process -Id $Target.ProcessId -Force -ErrorAction Stop
        if (-not $previous.WaitForExit((Get-DiscordStartupTimeout 5000))) { throw 'The selected Discord process did not quit. Close that client and try again.' }
    } finally { $previous.Dispose() }
    $Target.ProcessId = Start-DiscordProcess $Target.Executable $arguments
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
function Get-DiscordSocketUrl($Page, $DebugPort, $DebugHost = '127.0.0.1') {
    $expected = '^ws://(?:127\.0\.0\.1|localhost|\[::1\]):' + $DebugPort + '(/devtools/page/[a-z0-9-]+)$'
    if ($Page.webSocketDebuggerUrl -notmatch $expected) { throw 'Unexpected Discord debug socket URL.' }
    if ($DebugHost -notin @('127.0.0.1','[::1]')) { throw 'Unexpected Discord debug host.' }
    "ws://${DebugHost}:$DebugPort$($Matches[1])"
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
    $declaredPort = Get-DiscordDebugPort $selected.CommandLine
    if ($null -ne $declaredPort) {
        Write-Host 'Remote debugging is already enabled; waiting for its endpoint...' -ForegroundColor Cyan
        if ($declaredPort) { $port = $declaredPort }
    } else {
        $port = $selected.DefaultPort
        while ($port -in $listeners.Port) { $port++ }
        if ($port -gt 65535) { throw 'No available local debug port.' }
        Write-Host "Restarting only $($selected.Name) with remote debugging (its calls will drop)..." -ForegroundColor Cyan
        Start-DiscordClient $selected $port
    }
    if ($declaredPort -eq 0) {
        $null = Wait-Discord { foreach ($listener in @(Get-DiscordListeners | Where-Object ProcessId -eq $selected.ProcessId)) { $port=$listener.Port; if (Test-Port) { return $true } } } 'Waiting for the selected client debug port.'
    } else {
        $null = Wait-Discord { Test-Port } 'Waiting for the selected client debug port.' 30
    }
}
$port = $selected.DebugPort
Write-Host 'Locating the Discord window...' -ForegroundColor Cyan
$page = Wait-Discord {
    try { $pages = @(Get-DiscordDebugJson $selected.DebugHost $port '/json' (Get-DiscordStartupTimeout 3000) | ForEach-Object { $_ } | Where-Object { $_.type -eq 'page' -and $_.url -match '^https://(?:[a-z0-9-]+\.)?discord\.com/(?:channels|quest-home|app)(?:/|$)' }) } catch { return $null }
    $pages
} 'Waiting for the main window. Open Discord and log in if needed.'
$startupWait.Stop()
try { $page = Select-DiscordPage @($page) } finally { $startupWait.Start() }
if (-not $page) { Write-Host 'Cancelled.'; return }
if (-not (Test-Port)) { throw 'The selected Discord client debug port is no longer available.' }
$socket = Get-DiscordSocketUrl $page $port $selected.DebugHost


$ws = [Net.WebSockets.ClientWebSocket]::new()
$ws.Options.Proxy = $null
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

    # The chunk array exists before the app is usable; wait for the mounted app and signed-in user store.
    $rendererReady = @'
(() => {
    if (document.readyState !== 'complete' || !document.body || !document.querySelector('#app-mount')?.childElementCount || typeof webpackChunkdiscord_app === 'undefined') return false;
    let req;
    webpackChunkdiscord_app.push([[Symbol('riyo-ready')], {}, value => {
        if (Object.keys(value.c || {}).length > Object.keys(req?.c || {}).length) req = value;
    }]);
    webpackChunkdiscord_app.pop();
    if (!req?.c) return false;
    return Object.values(req.c).some(module => {
        try {
            const exports = module?.exports;
            return [exports, ...Object.values(exports || {})].some(value => typeof value?.getCurrentUser === 'function' && !!value.getCurrentUser());
        } catch { return false; }
    });
})()
'@
    $null = Wait-Discord { (Invoke-Cdp $rendererReady (Get-DiscordStartupTimeout 3000)).result.result.value -eq $true } 'Waiting for Discord to finish loading.'

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
