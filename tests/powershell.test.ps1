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
$macBranch = $runnerAst.Find({ param($node) $node -is [Management.Automation.Language.IfStatementAst] -and $node.Clauses[0].Item1.Extent.Text -eq '$macOS' }, $true).Clauses[0].Item2.Extent.Text
& {
    $port = 9222
    $script:quit = $false
    $script:launch = $null
    function Test-Path($LiteralPath) { $LiteralPath.Replace('\','/').EndsWith('/Applications/Discord Canary.app/Contents/Info.plist') -or $LiteralPath.Replace('\','/').EndsWith('/Applications/Discord Canary.app/Contents/MacOS/Discord') }
    function Mock-Plist { $global:LASTEXITCODE = 0; 'Discord' }
    function Mock-Pgrep { Assert ($args[-1].EndsWith('([[:space:]]|$)')) 'macOS pgrep must use POSIX whitespace'; if ($script:quit) { $global:LASTEXITCODE = 1 } else { $global:LASTEXITCODE = 0; '123' } }
    function Mock-Kill { Assert ($args[0] -eq '-TERM' -and $args[1] -eq 123) 'Must quit only the selected macOS app'; $script:quit = $true; $global:LASTEXITCODE = 0 }
    function Mock-Open { $script:launch = @($args); $global:LASTEXITCODE = 0 }
    $mockBranch = $macBranch.Replace('/usr/libexec/PlistBuddy','Mock-Plist').Replace('/usr/bin/pgrep','Mock-Pgrep').Replace('/bin/kill','Mock-Kill').Replace('/usr/bin/open','Mock-Open')
    . ([scriptblock]::Create($mockBranch.Substring(1, $mockBranch.Length - 2)))
    Assert $script:quit 'macOS must wait for the selected app to quit'
    Assert ($script:launch[0] -eq '-n' -and $script:launch[1] -eq '-a' -and $script:launch[2] -eq $app.Bundle) 'Must launch the selected bundle with separate native arguments'
    Assert ($script:launch[3] -eq '--args' -and $script:launch[4] -eq '--remote-debugging-port=9222') 'macOS launch must pass the debug port'
}
$prefix = [scriptblock]::Create($shared.Substring(0, $shared.IndexOf('# Ensure the desktop')) + "`nreturn `$expr")
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
    Assert ($manifest.Count -eq 8) 'Expected all eight Discord scripts'
    Write-Host 'PASS: runner registration, PowerShell/JavaScript syntax, whoami tables, and terminal snowflake input/output.'
} finally { if (Test-Path -LiteralPath $tempJs) { Remove-Item -LiteralPath $tempJs } }
