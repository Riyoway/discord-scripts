# menu — a TUI to browse, copy, and run the Discord scripts from PowerShell.
#   irm https://script.riyo.me/d/p/menu | iex
$ErrorActionPreference = "Stop"
$BASE = "https://script.riyo.me"

# One source of truth for the list (also used by the web index page).
$raw = (Invoke-WebRequest "$BASE/d/list" -UseBasicParsing).Content
$scripts = @($raw | ConvertFrom-Json)
$n = $scripts.Count
if (-not $n) { Write-Host "Could not load the script list."; return }

function Copy-Console($name) { Set-Clipboard -Value (Invoke-RestMethod "$BASE/d/c/$name") }

# Fallback when input is redirected (arrow keys need a real console): numbered prompt.
if ([Console]::IsInputRedirected) {
    for ($i = 0; $i -lt $n; $i++) { "{0,2}. {1,-11} {2}" -f ($i + 1), $scripts[$i].name, $scripts[$i].desc }
    $idx = [int](Read-Host "`nPick a number") - 1
    if ($idx -lt 0 -or $idx -ge $n) { Write-Host "Cancelled."; return }
    $s = $scripts[$idx]
    if ($s.run -and (Read-Host "[r]un or [c]opy console? (r/c)") -eq "r") { iex (Invoke-RestMethod "$BASE/d/p/$($s.name)"); return }
    Copy-Console $s.name; Write-Host "Copied '$($s.name)' console script to the clipboard." -ForegroundColor Green
    return
}

$sel = 0
$status = "Up/Down move   Enter run-or-copy   C copy console   P copy command   Q quit"
[Console]::CursorVisible = $false
try {
    while ($true) {
        Clear-Host
        Write-Host "`n  Discord scripts" -ForegroundColor Cyan
        Write-Host "  $status`n" -ForegroundColor DarkGray
        for ($i = 0; $i -lt $n; $i++) {
            $s = $scripts[$i]
            $tag = if ($s.run) { "run" } else { "   " }
            $line = "  {0,-11} {1}  {2}" -f $s.name, $tag, $s.desc
            if ($i -eq $sel) { Write-Host $line -ForegroundColor Black -BackgroundColor Cyan }
            else { Write-Host $line }
        }
        switch ([Console]::ReadKey($true).Key.ToString()) {
            "UpArrow"   { $sel = ($sel - 1 + $n) % $n }
            "K"         { $sel = ($sel - 1 + $n) % $n }
            "DownArrow" { $sel = ($sel + 1) % $n }
            "J"         { $sel = ($sel + 1) % $n }
            "C"         { Copy-Console $scripts[$sel].name; $status = "Copied '$($scripts[$sel].name)' console script - paste into DevTools" }
            "P" {
                $s = $scripts[$sel]
                $cmd = if ($s.run) { "irm $BASE/d/p/$($s.name) | iex" } else { "irm $BASE/d/c/$($s.name) | scb" }
                Set-Clipboard -Value $cmd; $status = "Copied command: $cmd"
            }
            "Enter" {
                $s = $scripts[$sel]
                [Console]::CursorVisible = $true; Clear-Host
                if ($s.run) { iex (Invoke-RestMethod "$BASE/d/p/$($s.name)") }
                else { Copy-Console $s.name; Write-Host "Copied '$($s.name)' console script to the clipboard. Paste it into Discord's DevTools console." -ForegroundColor Green }
                return
            }
            "Q"      { return }
            "Escape" { return }
        }
    }
} finally { [Console]::CursorVisible = $true }
