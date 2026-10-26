# Offline checks: pwsh -NoProfile -File tests/powershell-wait.test.ps1
$ErrorActionPreference = 'Stop'
function Assert($condition, $message) { if (-not $condition) { throw $message } }
$root = Split-Path $PSScriptRoot -Parent
$source = Get-Content "$root/powershell/run.ps1" -Raw
$ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$null, [ref]$null)
$startupWait = [pscustomobject]@{ Elapsed = [pscustomobject]@{ TotalMilliseconds = 0 } }
foreach ($name in 'Get-DiscordStartupTimeout', 'Test-DiscordRunning', 'Wait-Discord') {
    $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    . ([scriptblock]::Create($definition.Extent.Text))
}

& {
    $macOS = $false
    $selected = [pscustomobject]@{ ProcessId=123; Name='DiscordCanary' }
    function Get-Process($Id, $ErrorAction) {
        Assert ($Id -eq 123) 'Wait must monitor the selected process'
        [pscustomobject]@{ Id = 123 }
    }
    Assert (Test-DiscordRunning) 'A running Discord flavor must be detected'
}
& {
    $macOS = $false
    $selected = [pscustomobject]@{ ProcessId=456; Name='DiscordPTB' }
    function Get-Process($Id, $ErrorAction) {
        Assert ($Id -eq 456) 'Another running client must not hide the selected client exiting'
    }
    Assert (-not (Test-DiscordRunning)) 'Other Discord flavors must not hide the selected app exiting'
}

& {
    function Test-DiscordRunning { $true }
    function Write-Host { }
    function Start-Sleep { $startupWait.Elapsed.TotalMilliseconds += 1000 }
    foreach ($stage in 'debug port', 'window', 'renderer') {
        $startupWait.Elapsed.TotalMilliseconds = 0
        $value = Wait-Discord { param($attempt) if ($attempt -ge 40) { 'ready' } } "Waiting for $stage."
        Assert ($value -eq 'ready') "$stage must survive startup beyond the previous fixed limits"
    }
}
& {
    $script:windowChecks = 0
    $startupWait.Elapsed.TotalMilliseconds = 0
    function Write-Host { }
    function Test-DiscordRunning { $true }
    function Start-Sleep { $startupWait.Elapsed.TotalMilliseconds += 1000 }
    function Get-DiscordDebugJson {
        $script:windowChecks++
        if ($script:windowChecks -eq 10) { throw 'Temporary startup connection failure' }
        if ($script:windowChecks -lt 40) { return [pscustomobject]@{ type = 'page'; url = 'https://discord.com/login' } }
        [pscustomobject]@{ type = 'page'; url = 'https://discord.com/channels/@me' }
    }
    $windowWait = $ast.Find({ param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$page' -and $node.Right.Extent.Text.StartsWith('Wait-Discord') }, $true)
    . ([scriptblock]::Create($windowWait.Extent.Text))
    Assert ($page.url -eq 'https://discord.com/channels/@me') 'A slowly loading logged-in window must eventually be selected'
    Assert ($script:windowChecks -eq 40) 'Window detection must tolerate a long login/load and transient connection failures'
}
& {
    $startupWait.Elapsed.TotalMilliseconds = 0
    function Write-Host { }
    function Start-Sleep { $startupWait.Elapsed.TotalMilliseconds += 1000 }
    function Test-DiscordRunning { $true }
    $null = Wait-Discord { param($attempt) $attempt -ge 40 } 'Waiting for the window.'
    $failed = $false
    try { $null = Wait-Discord { $false } 'Waiting for the renderer.' }
    catch { $failed = $_.Exception.Message -match '60-second limit' }
    Assert $failed 'Window and renderer waits must share one startup deadline'
    Assert ($startupWait.Elapsed.TotalMilliseconds -le 60000) 'A running Discord process must not extend the one-minute limit'
}
& {
    $startupWait.Elapsed.TotalMilliseconds = 58000
    Assert ((Get-DiscordStartupTimeout 5000) -eq 2000) 'Network and socket timeouts must fit the remaining startup budget'
    function Write-Host { }
    function Start-Sleep { throw 'Must not sleep after a probe exhausts the deadline' }
    function Test-DiscordRunning { $true }
    $failed = $false
    try { $null = Wait-Discord { $startupWait.Elapsed.TotalMilliseconds += (Get-DiscordStartupTimeout 3000); $false } 'Waiting for the port.' }
    catch { $failed = $_.Exception.Message -match '60-second limit' }
    Assert $failed 'Slow requests must count towards the one-minute limit'
}
& {
    $script:sleeps = 0
    $startupWait.Elapsed.TotalMilliseconds = 0
    function Write-Host { }
    function Start-Sleep { $script:sleeps++ }
    function Test-DiscordRunning { $script:sleeps -lt 3 }
    $failed = $false
    try { $null = Wait-Discord { $null } 'Waiting for the main window.' }
    catch { $failed = $_.Exception.Message -match 'no longer running' }
    Assert $failed 'Wait must end when Discord exits'
    Assert ($script:sleeps -eq 3) 'A closed Discord process must not cause an endless wait'
}
& {
    function Write-Host { }
    function Start-Sleep { }
    function Test-DiscordRunning { $false }
    $ready = Wait-Discord { param($attempt) $attempt -ge 2 } 'Waiting for startup.' 30
    Assert $ready 'Allow the updater time to spawn Discord'
    $failed = $false
    try { $null = Wait-Discord { $false } 'Waiting for startup.' 3 }
    catch { $failed = $_.Exception.Message -match 'no longer running' }
    Assert $failed 'Startup grace must not hide a failed launch forever'
}
Write-Host 'PASS: slow startup, shared one-minute deadline, bounded requests, process exit, flavor selection, and updater grace without Discord access.'
