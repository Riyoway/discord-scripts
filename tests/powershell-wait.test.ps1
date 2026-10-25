# Offline checks: pwsh -NoProfile -File tests/powershell-wait.test.ps1
$ErrorActionPreference = 'Stop'
function Assert($condition, $message) { if (-not $condition) { throw $message } }
$root = Split-Path $PSScriptRoot -Parent
$source = Get-Content "$root/powershell/run.ps1" -Raw
$ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$null, [ref]$null)
foreach ($name in 'Test-DiscordRunning', 'Wait-Discord') {
    $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    . ([scriptblock]::Create($definition.Extent.Text))
}

& {
    $macOS = $false
    $flavor = $null
    function Get-Process([string[]]$Name, $ErrorAction) {
        Assert ($Name -contains 'DiscordCanary') 'Reused debug ports must detect every supported Discord flavor'
        [pscustomobject]@{ Id = 123 }
    }
    Assert (Test-DiscordRunning) 'A running Discord flavor must be detected'
}
& {
    $macOS = $false
    $flavor = 'DiscordPTB'
    function Get-Process([string[]]$Name, $ErrorAction) {
        Assert (@($Name).Count -eq 1 -and $Name[0] -eq 'DiscordPTB') 'A launched runner must monitor its selected flavor'
    }
    Assert (-not (Test-DiscordRunning)) 'Other Discord flavors must not hide the selected app exiting'
}

& {
    function Test-DiscordRunning { $true }
    function Write-Host { }
    function Start-Sleep { }
    foreach ($stage in 'debug port', 'window', 'renderer') {
        $value = Wait-Discord { param($attempt) if ($attempt -ge 120) { 'ready' } } "Waiting for $stage."
        Assert ($value -eq 'ready') "$stage must survive startup beyond the previous fixed limits"
    }
}
& {
    $script:windowChecks = 0
    function Write-Host { }
    function Test-DiscordRunning { $true }
    function Start-Sleep { }
    function Invoke-RestMethod {
        $script:windowChecks++
        if ($script:windowChecks -eq 10) { throw 'Temporary startup connection failure' }
        if ($script:windowChecks -lt 80) { return [pscustomobject]@{ type = 'page'; url = 'https://discord.com/login' } }
        [pscustomobject]@{ type = 'page'; url = 'https://discord.com/channels/@me' }
    }
    $windowWait = $ast.Find({ param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$page' -and $node.Right.Extent.Text.StartsWith('Wait-Discord') }, $true)
    . ([scriptblock]::Create($windowWait.Extent.Text))
    Assert ($page.url -eq 'https://discord.com/channels/@me') 'A slowly loading logged-in window must eventually be selected'
    Assert ($script:windowChecks -eq 80) 'Window detection must tolerate a long login/load and transient connection failures'
}
& {
    $script:sleeps = 0
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
Write-Host 'PASS: slow port/window/renderer startup, process exit, flavor selection, and updater grace without real waits or Discord access.'
