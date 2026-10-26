# Offline client routing tests. No real Discord process, restart, socket, or account access.
$ErrorActionPreference = 'Stop'
function Assert($condition, $message) { if (-not $condition) { throw $message } }
$root = Split-Path $PSScriptRoot -Parent
$source = Get-Content "$root/powershell/run.ps1" -Raw
$ast = [Management.Automation.Language.Parser]::ParseInput($source,[ref]$null,[ref]$null)
foreach ($name in 'Select-DiscordClient','Get-DiscordClients','Get-DiscordLoopback','Test-Port','Test-DiscordRunning','Wait-Discord','Initialize-DiscordCommandLine','Get-DiscordProfileKey','Get-DiscordDebugPort','Get-DiscordLaunchArguments','Start-DiscordClient','Select-DiscordPage','Get-DiscordSocketUrl') {
    $node = $ast.Find({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name },$true)
    . ([scriptblock]::Create($node.Extent.Text))
}
function Get-DiscordStartupTimeout($MaximumMilliseconds) { $MaximumMilliseconds }
function Write-Host { }
$stable = [pscustomobject]@{Name='Discord';Key='stable';ProcessId=101;Executable='C:\Discord\Discord.exe';CommandLine='"C:\Discord\Discord.exe" "--user-data-dir=C:\Profiles\A B" --remote-debugging-port=9222';DefaultPort=9222}
$canary = [pscustomobject]@{Name='DiscordCanary';Key='canary';ProcessId=202;Executable='C:\Canary\DiscordCanary.exe';CommandLine='"C:\Canary\DiscordCanary.exe"';DefaultPort=9224}
$other = [pscustomobject]@{Name='Discord';Key='stable';ProcessId=105;Executable='C:\Discord\Discord.exe';CommandLine='"C:\Discord\Discord.exe" "--user-data-dir=C:\Profiles\Other"';DefaultPort=9222}
$stopped = [pscustomobject]@{Name='DiscordPTB';Key='ptb';ProcessId=0;Executable='C:\PTB\Update.exe';DefaultPort=9223}
& {
    $script:answers = [Collections.Generic.Queue[string]]::new()
    foreach ($value in 'bad','0','2') { $script:answers.Enqueue($value) }
    function Read-Host { $script:answers.Dequeue() }
    $choice = Select-DiscordClient @($stable,$canary,$stopped) $null
    Assert ($choice.ProcessId -eq 202) 'Running clients must be selectable without offering stopped clients by default'
    Assert ((Select-DiscordClient @($stable,$canary) 'canary').ProcessId -eq 202) 'Client aliases must work'
    Assert ((Select-DiscordClient @($stable,$other) '105').ProcessId -eq 105) 'PID must distinguish profiles of the same flavor'
    Assert ((Select-DiscordClient @($stable,$canary,$stopped) 'ptb').ProcessId -eq 0) 'Explicitly selected stopped clients must remain available'
    $script:answers.Enqueue('')
    Assert ($null -eq (Select-DiscordClient @($stable,$canary) $null)) 'Blank must cancel client selection'
    $failed=$false
    try { $null=Select-DiscordClient @($stable,$canary) 'missing' } catch { $failed=$true }
    Assert $failed 'Unknown clients must not fall back to another account'
}
& {
    $macOS=$false
    function Get-CimInstance($ClassName,$Filter,$ErrorAction) {
        Assert ($ClassName -eq 'Win32_Process' -and $Filter.Contains('DiscordCanary.exe')) 'Discover the supported executables'
        foreach ($item in $stable,$canary,$other) { [pscustomobject]@{Name=$item.Name+'.exe';ProcessId=$item.ProcessId;ExecutablePath=$item.Executable;CommandLine=$item.CommandLine} }
        [pscustomobject]@{Name='Discord.exe';ProcessId=106;CommandLine='"Discord.exe" --type=renderer'}
        [pscustomobject]@{Name='Discord.exe';ProcessId=107;CommandLine='"Discord.exe" "--type=utility"'}
    }
    function Test-Path { $false }
    $clients=@(Get-DiscordClients)
    Assert ($clients.Count -eq 3) 'Chromium helper processes must not appear as independent clients'
    Assert (@($clients | Where-Object Name -eq 'Discord').Count -eq 2) 'Same-flavor instances must remain separate'
}
& {
    $selected=$canary
    $port=9222
    function Get-DiscordListeners { [pscustomobject]@{ProcessId=101;Port=9222}; [pscustomobject]@{ProcessId=202;Port=9444} }
    function Get-DiscordDebugJson($DebugHost,$DebugPort,$Path,$TimeoutMilliseconds) {
        Assert ($DebugHost -eq '127.0.0.1' -and $DebugPort -eq 9444 -and $Path -eq '/json/version') 'Never request the other client debug endpoint'
        @{Browser='Chrome';'Protocol-Version'='1.3'}
    }
    Assert (-not (Test-Port)) 'A valid debug port belonging to another process must not be reused'
    $port=9444
    Assert (Test-Port) 'The selected client custom debug port must be reusable'
}
& {
    $command='"C:\Program Files\Discord\Discord.exe" "--user-data-dir=C:\Profile A" "--label=one\"two" "--path=C:\tail\\" --remote-debugging-port 9222'
    $arguments=Get-DiscordLaunchArguments $command 9444
    $values=@([RiyoScriptCommandLine]::Split('"discord.exe" '+$arguments))
    Assert ($values[1] -eq '--user-data-dir=C:\Profile A') 'Preserve the selected profile directory with spaces'
    Assert ($values[2] -eq '--label=one"two') 'Preserve embedded quotes'
    Assert ($values[3] -eq '--path=C:\tail\') 'Preserve trailing backslashes'
    Assert ($values[4] -eq '--remote-debugging-port=9444' -and $values.Count -eq 5) 'Replace the previous debug port exactly once'
    Assert ((Get-DiscordProfileKey '"discord.exe" --user-data-dir "C:\Profile A" --profile-directory "Profile 2"') -eq (Get-DiscordProfileKey '"discord.exe" "--profile-directory=Profile 2" "--user-data-dir=C:\Profile A"')) 'Match profiles regardless of argument order, quoting, or equals signs'
    foreach ($flag in '--remote-debugging-port=9444','"--remote-debugging-port=9444"','--remote-debugging-port 9444','"--remote-debugging-port" "9444"') {
        Assert ((Get-DiscordDebugPort ('"discord.exe" '+$flag)) -eq 9444) 'Recognize an existing debug flag before deciding to restart'
    }
    Assert ((Get-DiscordDebugPort 'discord.exe --remote-debugging-port=0') -eq 0) 'Port zero means an automatically assigned debug port'
    Assert ($null -eq (Get-DiscordDebugPort 'discord.exe --remote-debugging-port=999999999999999999999')) 'Ignore invalid port numbers without overflowing'
}
& {
    $macOS=$false
    $selected=$stable.PSObject.Copy()
    $selected | Add-Member NoteProperty LaunchedAt ([DateTime]::UtcNow.AddSeconds(-2))
    $selected | Add-Member NoteProperty PreviousProcessIds @(101,105,202)
    $selected.ProcessId=303
    $port=9444
    $replacement=[pscustomobject]@{Name='Discord';ProcessId=404;Executable=$stable.Executable;Created=[DateTime]::UtcNow;CommandLine='"C:\Discord\Discord.exe" "--user-data-dir=C:\Profiles\A B" --remote-debugging-port=9444'}
    function Get-DiscordListeners { [pscustomobject]@{Address='[::1]';ProcessId=404;Port=9444} }
    function Get-DiscordClients { $replacement }
    function Get-DiscordDebugJson($DebugHost,$DebugPort) {
        Assert ($DebugHost -eq '[::1]' -and $DebugPort -eq 9444) 'Use the address family actually owned by the selected replacement'
        @{Browser='Chrome';'Protocol-Version'='1.3'}
    }
    Assert (Test-Port) 'Follow a new main PID after the launched process relaunches itself'
    Assert ($selected.ProcessId -eq 404 -and $selected.DebugHost -eq '[::1]') 'Retain the confirmed PID and IPv6 address'
    $selected.ProcessId=303
    $replacement.CommandLine='"C:\Discord\Discord.exe" "--user-data-dir=C:\Profiles\Other"'
    Assert (-not (Test-Port)) 'Never rebind the selection to another profile'
    $replacement.CommandLine=$stable.CommandLine
    $replacement.ProcessId=105
    function Get-DiscordListeners { [pscustomobject]@{Address='127.0.0.1';ProcessId=105;Port=9444} }
    Assert (-not (Test-Port)) 'Never adopt another instance that was already running before launch'
    $replacement.ProcessId=404
    $replacement.Created=$selected.LaunchedAt.AddSeconds(-1)
    function Get-DiscordListeners { [pscustomobject]@{Address='127.0.0.1';ProcessId=404;Port=9444} }
    Assert (-not (Test-Port)) 'Reject older processes even if the PID snapshot missed them'
    $replacement.Created=[DateTime]::UtcNow
    function Get-DiscordListeners { [pscustomobject]@{Address='[::1]';ProcessId=404;Port=9444} }
    $selected.Executable='C:\ProgramData\User\DiscordPTB\app-1.0.1224\Discord.exe'
    $replacement.Executable='C:\ProgramData\User\DiscordPTB\app-1.0.1229\Discord.exe'
    Assert (Test-Port) 'Follow an automatic version update within the same custom installation'
    $selected.ProcessId=303
    $replacement.Executable='C:\OtherInstall\app-1.0.1229\Discord.exe'
    Assert (-not (Test-Port)) 'Do not cross into a different installation while following an update'
}
& {
    $macOS=$false
    $target=$stable.PSObject.Copy()
    $script:killed=@(); $script:started=$null
    function Stop-Process($Id,[switch]$Force,$ErrorAction) {
        Assert ($null -ne $target.LaunchedAt -and 101 -in $target.PreviousProcessIds) 'Record the restart boundary before the old process can spawn an updater'
        $script:killed += $Id
    }
    function Get-DiscordClients { $stable; $canary }
    function Get-Process($Id,$ErrorAction) {
        $process=New-Object PSObject
        $process | Add-Member ScriptMethod WaitForExit { param($timeout) Assert ($timeout -le 5000) 'Bound the old-process wait'; $script:exited=$true; $true }
        $process | Add-Member ScriptMethod Dispose { }
        $process
    }
    function Start-DiscordProcess($FilePath,$Arguments,[switch]$Hidden) { Assert $script:exited 'Do not relaunch before the old process has exited'; $script:started=@($FilePath,$Arguments,$Hidden.IsPresent); 303 }
    Start-DiscordClient $target 9444
    Assert ($script:killed.Count -eq 1 -and $script:killed[0] -eq 101) 'Restart only the selected PID, never all processes with that name'
    Assert ($script:started[0] -eq $stable.Executable -and $target.ProcessId -eq 303) 'Track the newly launched client'
    Assert ($script:started[1].Contains('--user-data-dir=C:\Profiles\A B')) 'Keep the selected profile on restart'
    Assert (-not $script:started[2]) 'Keep the Discord app window visible'
    $target=[pscustomobject]@{Name='DiscordPTB';Executable='C:\PTB\Update.exe';Updater=$true;ProcessId=0}
    Start-DiscordClient $target 9223
    Assert ($script:killed.Count -eq 1) 'Starting an installed client must not stop another client'
    Assert ($script:started[0] -eq $target.Executable -and $script:started[2]) 'Detach the updater too, keeping its helper window hidden'
    Assert ($script:started[1] -eq '--processStart DiscordPTB.exe --process-start-args "--remote-debugging-port=9223"') 'Preserve updater forwarding of the selected debug port'
}
& {
    $macOS=$true
    $target=[pscustomobject]@{Name='Discord Canary';ProcessId=202;Instances=1;Executable='/Applications/Discord Canary.app/Contents/MacOS/Discord';Bundle='/Applications/Discord Canary.app'}
    $script:killed=@();$script:opened=$null
    function Mock-Kill { $script:killed += $args[1]; $global:LASTEXITCODE=0 }
    function Mock-Open { $script:opened=@($args); $global:LASTEXITCODE=0 }
    function Mock-Ps { $global:LASTEXITCODE=0; '/Applications/Discord Canary.app/Contents/MacOS/Discord' }
    function Get-MacDiscordPids { @() }
    $start=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Start-DiscordClient'},$true).Extent.Text
    . ([scriptblock]::Create($start.Replace('/bin/kill','Mock-Kill').Replace('/usr/bin/open','Mock-Open').Replace('/bin/ps','Mock-Ps')))
    Start-DiscordClient $target 9224
    Assert ($script:killed.Count -eq 1 -and $script:killed[0] -eq 202) 'macOS must quit only the selected app instance'
    Assert ($script:opened[-1] -eq '--remote-debugging-port=9224' -and $script:opened[2] -eq $target.Bundle) 'macOS must launch the selected bundle on its own port'
    $target.Instances=2
    $failed=$false
    try { Start-DiscordClient $target 9225 } catch { $failed=$true }
    Assert $failed 'Do not relaunch a shared bundle into an ambiguous profile'
}
& {
    $first=[pscustomobject]@{title='Main';url='https://discord.com/channels/@me';webSocketDebuggerUrl='ws://127.0.0.1:9444/devtools/page/AAA'}
    $second=[pscustomobject]@{title='Other window';url='https://discord.com/channels/123';webSocketDebuggerUrl='ws://127.0.0.1:9444/devtools/page/BBB'}
    function Read-Host { '2' }
    Assert ((Select-DiscordPage @($first,$second)).title -eq 'Other window') 'Multiple renderer windows must be explicitly selected'
    Assert ((Get-DiscordSocketUrl $second 9444) -eq $second.webSocketDebuggerUrl) 'Allow the selected local socket'
    Assert ((Get-DiscordSocketUrl ([pscustomobject]@{webSocketDebuggerUrl='ws://localhost:9444/devtools/page/BBB'}) 9444 '[::1]') -eq 'ws://[::1]:9444/devtools/page/BBB') 'Normalize local CDP advertisements to the verified listener address'
    foreach ($url in 'ws://127.0.0.1:9222/devtools/page/AAA','ws://evil.test:9444/devtools/page/AAA','ws://127.0.0.1:9444@evil.test/devtools/page/AAA') {
        $failed=$false
        try { $null=Get-DiscordSocketUrl ([pscustomobject]@{webSocketDebuggerUrl=$url}) 9444 } catch { $failed=$true }
        Assert $failed 'Do not inject through another client port or remote socket'
    }
}
& {
    $macOS=$false
    $Client='ptb'
    $target=[pscustomobject]@{Name='DiscordPTB';Key='ptb';ProcessId=202;CommandLine='"C:\ProgramData\User\DiscordPTB.exe" --remote-debugging-port=9223';DefaultPort=9223}
    $script:polls=0
    function Get-DiscordClients { $target }
    function Get-DiscordListeners {
        $script:polls++
        if ($script:polls -ge 3) { [pscustomobject]@{ProcessId=202;Port=9223;Address='[::1]'} }
        [pscustomobject]@{ProcessId=101;Port=9222;Address='127.0.0.1'}
    }
    function Start-DiscordClient { throw 'Already enabled debugging must be awaited, never restarted' }
    function Test-DiscordRunning { $true }
    function Start-Sleep { }
    function Get-DiscordDebugJson($DebugHost,$DebugPort,$Path,$TimeoutMilliseconds) {
        Assert ($DebugHost -eq '[::1]' -and $DebugPort -eq 9223) 'Do not fall back to another running client while the selected port starts'
        if ($Path -eq '/json/version') { return @{Browser='Chrome';'Protocol-Version'='1.3'} }
        [pscustomobject]@{type='page';title='PTB';url='https://ptb.discord.com/channels/@me';webSocketDebuggerUrl='ws://localhost:9223/devtools/page/PTB'}
    }
    $start=$source.LastIndexOf('$selected = Select-DiscordClient')
    $end=$source.IndexOf('$ws = [Net.WebSockets.ClientWebSocket]')
    . ([scriptblock]::Create($source.Substring($start,$end-$start)))
    Assert ($script:polls -ge 3 -and $socket -eq 'ws://[::1]:9223/devtools/page/PTB') 'The first run must wait through delayed port startup and select the correct IPv6 window'
    $target.CommandLine='discord.exe --remote-debugging-port=0'
    $script:polls=0
    . ([scriptblock]::Create($source.Substring($start,$end-$start)))
    Assert ($port -eq 9223) 'Auto-assigned port discovery must survive probe scope and remain available for injection'
}
& {
    $macOS=$false
    $Client='canary'
    function Get-DiscordClients { $stable; $canary }
    function Get-DiscordListeners { [pscustomobject]@{ProcessId=101;Port=9222}; [pscustomobject]@{ProcessId=202;Port=9444} }
    function Start-DiscordClient { throw 'Do not restart a client with its own working debug port' }
    function Get-DiscordDebugJson($DebugHost,$DebugPort,$Path,$TimeoutMilliseconds) {
        Assert ($DebugHost -eq '127.0.0.1' -and $DebugPort -eq 9444) 'The complete discovery flow must stay on the selected client port'
        if ($Path -eq '/json/version') { return @{Browser='Chrome';'Protocol-Version'='1.3'} }
        foreach ($id in 'AAA','BBB') { [pscustomobject]@{type='page';title=$id;url='https://discord.com/channels/@me';webSocketDebuggerUrl="ws://127.0.0.1:9444/devtools/page/$id"} }
    }
    function Read-Host { Assert (-not $startupWait.IsRunning) 'Pause the startup deadline during window selection'; '2' }
    $start=$source.LastIndexOf('$selected = Select-DiscordClient')
    $end=$source.IndexOf('$ws = [Net.WebSockets.ClientWebSocket]')
    . ([scriptblock]::Create($source.Substring($start,$end-$start)))
    Assert ($socket -eq 'ws://127.0.0.1:9444/devtools/page/BBB') 'Choose both the requested client and renderer before injection'
}
& {
    function Invoke-RestMethod { 'param($Name,$Client) [pscustomobject]@{Name=$Name;Client=$Client}' }
    foreach ($entry in (Get-Content "$root/scripts.json" -Raw | ConvertFrom-Json)) {
        $wrapper=[scriptblock]::Create((Get-Content "$root/powershell/$($entry.name).ps1" -Raw))
        $result=& $wrapper -Client canary
        Assert ($result.Client -eq 'canary' -and $result.Name -eq $entry.name) 'Every named script must forward the selected client'
        $result=Invoke-Expression (Get-Content "$root/powershell/$($entry.name).ps1" -Raw)
        Assert ($result.Name -eq $entry.name) 'The original irm | iex command must still work'
    }
}
Microsoft.PowerShell.Utility\Write-Host 'PASS: multiple flavors/profiles, PID and window choices, port ownership, targeted restarts, argument preservation, and all script wrappers.'
