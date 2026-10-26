# Real process/console check, using a harmless PowerShell child instead of Discord.
$ErrorActionPreference = 'Stop'
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function Wait-Until($Probe, $Message) {
    for ($i=0; $i -lt 100; $i++) { if (& $Probe) { return }; Start-Sleep -Milliseconds 100 }
    throw $Message
}
$root = Split-Path $PSScriptRoot -Parent
$ast = [Management.Automation.Language.Parser]::ParseFile("$root/powershell/run.ps1",[ref]$null,[ref]$null)
$launch = $ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Start-DiscordProcess'},$true).Extent.Text
$directory = Join-Path ([IO.Path]::GetTempPath()) ('riyo-detach-' + [guid]::NewGuid().ToString('N'))
$null = [IO.Directory]::CreateDirectory($directory)
$parentFile = Join-Path $directory 'parent.ps1'
$parentReady = Join-Path $directory 'parent.json'
$childReady = Join-Path $directory 'child.json'
$heartbeat = Join-Path $directory 'heartbeat.txt'
$errorFile = Join-Path $directory 'error.txt'
$exe = (Get-Process -Id $PID).Path
$parent = $null; $childId = 0
if (-not ('RiyoConsoleTest' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RiyoConsoleTest {
    [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
    [DllImport("kernel32.dll")] public static extern uint GetConsoleProcessList(uint[] list, uint size);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, uint message, IntPtr w, IntPtr l);
}
'@
}
try {
    $childCode = @'
[pscustomobject]@{Id=$PID;NoAttach=$env:ELECTRON_NO_ATTACH_CONSOLE;Directory=[Environment]::CurrentDirectory} | ConvertTo-Json | Set-Content -LiteralPath '__READY__'
for ($i=0; $i -lt 300; $i++) { [IO.File]::WriteAllText('__HEARTBEAT__',[string]$i); Start-Sleep -Milliseconds 100 }
'@
    $childCode = $childCode.Replace('__READY__',$childReady.Replace("'","''")).Replace('__HEARTBEAT__',$heartbeat.Replace("'","''"))
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childCode))
    $parentCode = $launch + "`n" + @'
$ErrorActionPreference='Stop'
trap { $_ | Out-String | Set-Content -LiteralPath '__ERROR__'; exit 1 }
$env:ELECTRON_NO_ATTACH_CONSOLE='parent-value'
$childId=Start-DiscordProcess '__EXE__' '-NoProfile -NonInteractive -EncodedCommand __CODE__'
Add-Type 'using System; using System.Runtime.InteropServices; public static class ConsoleParent { [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow(); [DllImport("kernel32.dll")] public static extern uint GetConsoleProcessList(uint[] list, uint size); }'
$members=New-Object UInt32[] 64
$count=[ConsoleParent]::GetConsoleProcessList($members,$members.Length)
[pscustomobject]@{ChildId=$childId;Window=[ConsoleParent]::GetConsoleWindow().ToInt64();Members=$members;Count=$count;Environment=$env:ELECTRON_NO_ATTACH_CONSOLE} | ConvertTo-Json | Set-Content -LiteralPath '__READY__'
Start-Sleep -Seconds 30
'@
    $parentCode = $parentCode.Replace('__EXE__',$exe.Replace("'","''")).Replace('__CODE__',$encoded).Replace('__READY__',$parentReady.Replace("'","''")).Replace('__ERROR__',$errorFile.Replace("'","''"))
    Set-Content -LiteralPath $parentFile -Value $parentCode -Encoding UTF8
    $parent = Start-Process -FilePath $exe -ArgumentList "-NoProfile -NonInteractive -File `"$parentFile`"" -WindowStyle Hidden -PassThru
    Wait-Until {
        if (Test-Path -LiteralPath $errorFile) { throw (Get-Content -LiteralPath $errorFile -Raw) }
        (Test-Path -LiteralPath $parentReady) -and (Test-Path -LiteralPath $childReady) -and (Test-Path -LiteralPath $heartbeat)
    } 'The test processes did not initialize'
    $state=Get-Content -LiteralPath $parentReady -Raw | ConvertFrom-Json
    $childId=[int]$state.ChildId
    $child=Get-Content -LiteralPath $childReady -Raw | ConvertFrom-Json
    Assert ($child.NoAttach -eq '1') 'Only the launched child must receive the Electron no-attach setting'
    Assert ($state.Environment -eq 'parent-value') 'Do not change the caller environment'
    Assert ($child.Directory -eq (Split-Path $exe -Parent)) 'Use the executable directory, regardless of the terminal directory'
    Assert ($state.Window -ne 0 -and $state.Count -gt 0) 'The test parent must have a real console to close'
    Assert ($childId -notin $state.Members) 'The child must not share the parent console'
    Assert ([RiyoConsoleTest]::PostMessage([IntPtr]$state.Window,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)) 'Close the parent console window'
    Wait-Until { $parent.Refresh(); $parent.HasExited } 'Closing the console did not terminate its PowerShell process'
    $before=Get-Content -LiteralPath $heartbeat -Raw
    Wait-Until { (Get-Content -LiteralPath $heartbeat -Raw) -ne $before } 'The child stopped after its parent console closed'
    Assert ($null -ne (Get-Process -Id $childId -ErrorAction SilentlyContinue)) 'The detached child must survive terminal closure'
    Write-Host 'PASS: real console closed; child survived and continued running; Electron setting stayed child-only.'
} finally {
    if (-not $childId -and (Test-Path -LiteralPath $parentReady)) { $childId=[int](Get-Content -LiteralPath $parentReady -Raw | ConvertFrom-Json).ChildId }
    if (-not $childId -and (Test-Path -LiteralPath $childReady)) { $childId=[int](Get-Content -LiteralPath $childReady -Raw | ConvertFrom-Json).Id }
    if ($childId) { Stop-Process -Id $childId -Force -ErrorAction SilentlyContinue }
    if ($parent) { if (-not $parent.HasExited) { Stop-Process -Id $parent.Id -Force -ErrorAction SilentlyContinue }; $parent.Dispose() }
    foreach ($file in $parentFile,$parentReady,$childReady,$heartbeat,$errorFile) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force } }
    Remove-Item -LiteralPath $directory
}
