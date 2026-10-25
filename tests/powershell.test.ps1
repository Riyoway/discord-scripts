# Offline check: pwsh -File tests/powershell.test.ps1 (also supports Windows PowerShell).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
function Assert($condition, $message) { if (-not $condition) { throw $message } }
foreach ($file in Get-ChildItem "$root/powershell/*.ps1") {
    $parseErrors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$null, [ref]$parseErrors)
    Assert (-not $parseErrors) "PowerShell parse failure: $($file.Name): $parseErrors"
}
$manifest = @(Get-Content "$root/scripts.json" -Raw | ConvertFrom-Json | ForEach-Object { $_ })
$raw = Get-Content "$root/scripts.json" -Raw
$menuList = Get-Content "$root/powershell/menu.ps1" | Where-Object { $_ -match '^\$scripts = ' }
. ([scriptblock]::Create($menuList))
Assert ($scripts.Count -eq $manifest.Count) 'Menu must enumerate the manifest in PowerShell 5.1 and 7'
$shared = Get-Content "$root/powershell/run.ps1" -Raw
$runnerAst = [Management.Automation.Language.Parser]::ParseInput($shared, [ref]$null, [ref]$null)
& {
    $macOS = $false
    $script:approvals = @{}
    $script:answers = [Collections.Generic.Queue[string]]::new()
    function Get-Content($LiteralPath, [switch]$Raw, $ErrorAction) {
        if (-not $script:approvals.ContainsKey($LiteralPath)) { throw 'Not approved' }
        $script:approvals[$LiteralPath]
    }
    function New-Item($ItemType, $Path, [switch]$Force) { }
    function Set-Content($LiteralPath, $Value, $Encoding) { $script:approvals[$LiteralPath] = $Value }
    function Read-Host($Prompt) { $script:answers.Dequeue() }
    $confirm = $runnerAst.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Confirm-ScriptRun' }, $true)
    . ([scriptblock]::Create($confirm.Extent.Text))
    $script:answers.Enqueue('invalid'); $script:answers.Enqueue('No')
    Assert (-not (Confirm-ScriptRun 'token')) 'Invalid input must retry; No must cancel'
    Assert ($script:approvals.Count -eq 0) 'No must not be remembered'
    $script:answers.Enqueue('YES')
    Assert (Confirm-ScriptRun 'token') 'Yes must approve the script'
    Assert (Confirm-ScriptRun 'token') 'An approved script must not ask again'
    $script:answers.Enqueue('')
    Assert (-not (Confirm-ScriptRun 'media')) 'Approval must be per script; blank must cancel'
    function Invoke-RestMethod { throw 'A cancelled script must not fetch source or reach Discord' }
    $script:answers.Enqueue('No')
    & ([scriptblock]::Create($shared)) -Name 'search'
}
# Client discovery and targeted restarts are covered by powershell-clients.test.ps1.
$prefixSource = $shared.Substring(0, $shared.IndexOf('# Ensure the desktop'))
# Skip only the terminal consent call while checking approved injection expressions.
$prefixSource = $prefixSource.Replace("if (-not (Confirm-ScriptRun `$Name)) { Write-Host 'Cancelled.'; return }", '')
$prefix = [scriptblock]::Create($prefixSource + "`nreturn `$expr")
# These mocks apply only to this check. No Discord process, network, or clipboard is touched.
function Invoke-RestMethod($Uri, $TimeoutSec) {
    $scriptName = $Uri.Split('/')[-1]
    Get-Content "$root/console/$scriptName.js" -Raw
}
function Read-Host($Prompt) { '175928847299117063' }
$tempJs = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName() + '.cjs')
try {
    foreach ($entry in $manifest) {
        Assert ($entry.runner -eq "/d/p/$($entry.name)") "Missing runner for $($entry.name)"
        $wrapper = Get-Content "$root/powershell/$($entry.name).ps1" -Raw
        Assert ($wrapper.Contains('/d/p/run') -and $wrapper.Contains("-Name '$($entry.name)'")) "Wrong wrapper for $($entry.name)"
        $expression = & $prefix -Name $entry.name
        [IO.File]::WriteAllText($tempJs, $expression, [Text.UTF8Encoding]::new($false))
        & node --check $tempJs
        Assert ($LASTEXITCODE -eq 0) "Invalid injected JavaScript for $($entry.name)"
        if ($entry.name -eq 'whoami') {
            $check = @'
const assert=require('node:assert/strict');const vm=require('node:vm');
const store={getCurrentUser:()=>({id:'175928847299117063',username:'Offline user'}),getGuilds:()=>({one:{name:'Server',id:'1'}}),getSortedPrivateChannels:()=>[],getFriendIDs:()=>[]};
const context={webpackChunkdiscord_app:{push:()=>({c:{one:{exports:store}}}),pop(){}}};
const tables=vm.runInNewContext(EXPRESSION,context);
assert.equal(tables[0].username,'Offline user');assert.equal(tables[0].servers,1);assert.equal(tables[1][0].name,'Server');assert.equal(context.console,undefined);
'@
            $check = $check.Replace('EXPRESSION', (ConvertTo-Json -InputObject $expression -Compress))
            [IO.File]::WriteAllText($tempJs, $check, [Text.UTF8Encoding]::new($false))
            & node $tempJs
            Assert ($LASTEXITCODE -eq 0) 'Whoami runner did not return its account/server tables'
        }
        if ($entry.name -eq 'snowflake') {
            $check = "const assert=require('node:assert/strict');const vm=require('node:vm');const result=vm.runInNewContext(" + (ConvertTo-Json -InputObject $expression -Compress) + ",{console:{log(){}}});assert.equal(result,'<t:1462015105:F>');"
            [IO.File]::WriteAllText($tempJs, $check, [Text.UTF8Encoding]::new($false))
            & node $tempJs
            Assert ($LASTEXITCODE -eq 0) 'Snowflake runner did not return its timestamp'
        }
    }
    $allowedNames = $runnerAst.ParamBlock.Parameters[0].Attributes | Where-Object { $_.TypeName.Name -eq 'ValidateSet' } | ForEach-Object { $_.PositionalArguments.Value }
    Assert ((($allowedNames | Sort-Object) -join ',') -eq (($manifest.name | Sort-Object) -join ',')) 'Runner must accept exactly the scripts in the manifest'
    Write-Host 'PASS: runner registration, PowerShell/JavaScript syntax, whoami tables, and terminal snowflake input/output.'
} finally { if (Test-Path -LiteralPath $tempJs) { Remove-Item -LiteralPath $tempJs } }
