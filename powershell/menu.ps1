# menu — browse, copy, and run scripts from PowerShell on Windows or macOS.
#   irm https://script.riyo.me/p/menu | iex
$ErrorActionPreference = "Stop"
$BASE = "https://script.riyo.me"

# One source of truth for the list, grouped by category.
$raw = (Invoke-WebRequest "$BASE/d/list" -UseBasicParsing).Content
$scripts = @($raw | ConvertFrom-Json | ForEach-Object { $_ })
if (-not $scripts.Count) { Write-Host "Could not load the script list."; return }
$categories = @($scripts | Group-Object { if ($_.category) { $_.category } else { "Discord" } })

function Resolve-ScriptUrl($path) { if ($path -match '^https?://') { $path } else { "$BASE$path" } }
function Copy-Source($script) { Set-Clipboard -Value (Invoke-RestMethod (Resolve-ScriptUrl $script.source)) }

function Select-Item($items, $title, $category = $false) {
    if ([Console]::IsInputRedirected) {
        for ($i = 0; $i -lt $items.Count; $i++) {
            if ($category) { "{0,2}. {1,-11} {2} scripts" -f ($i + 1), $items[$i].Name, $items[$i].Count }
            else { "{0,2}. {1,-11} {2}" -f ($i + 1), $items[$i].name, $items[$i].desc }
        }
        $idx = [int](Read-Host "`nPick a number") - 1
        if ($idx -ge 0 -and $idx -lt $items.Count) { return $items[$idx] }
        return $null
    }

    $sel = 0
    $status = if ($category) { "Up/Down move   Enter open   Q quit" } else { "Up/Down move   Enter run-or-copy   C copy source   P copy command   Q quit" }
    [Console]::CursorVisible = $false
    try {
    while ($true) {
        Clear-Host
        Write-Host "`n  $title" -ForegroundColor Cyan
        Write-Host "  $status`n" -ForegroundColor DarkGray
        for ($i = 0; $i -lt $items.Count; $i++) {
            if ($category) { $line = "  {0,-14} {1} scripts" -f $items[$i].Name, $items[$i].Count }
            else {
                $s = $items[$i]
                $tag = if ($s.runner) { "run" } else { "   " }
                $line = "  {0,-11} {1}  {2}" -f $s.name, $tag, $s.desc
            }
            if ($i -eq $sel) { Write-Host $line -ForegroundColor Black -BackgroundColor Cyan }
            else { Write-Host $line }
        }
        $key = [Console]::ReadKey($true).Key.ToString()
        if ($category) {
            switch ($key) {
                "UpArrow"   { $sel = ($sel - 1 + $items.Count) % $items.Count }
                "K"         { $sel = ($sel - 1 + $items.Count) % $items.Count }
                "DownArrow" { $sel = ($sel + 1) % $items.Count }
                "J"         { $sel = ($sel + 1) % $items.Count }
                "Enter"     { return $items[$sel] }
                "Q"         { return $null }
                "Escape"    { return $null }
            }
            continue
        }
        switch ($key) {
            "UpArrow"   { $sel = ($sel - 1 + $items.Count) % $items.Count }
            "K"         { $sel = ($sel - 1 + $items.Count) % $items.Count }
            "DownArrow" { $sel = ($sel + 1) % $items.Count }
            "J"         { $sel = ($sel + 1) % $items.Count }
            "C"         { Copy-Source $items[$sel]; $status = "Copied source for '$($items[$sel].name)'" }
            "P" {
                $s = $items[$sel]
                $cmd = if ($s.runner) { "irm $(Resolve-ScriptUrl $s.runner) | iex" } else { "irm $(Resolve-ScriptUrl $s.source) | scb" }
                if ($PSVersionTable.PSEdition -eq 'Core' -and $IsMacOS) { $cmd = "pwsh -NoProfile -Command '" + $cmd.Replace("'", "'`"'`"'") + "'" }
                Set-Clipboard -Value $cmd; $status = "Copied command: $cmd"
            }
            "Enter" {
                return $items[$sel]
            }
            "Q"      { return $null }
            "Escape" { return $null }
        }
    }
} finally { [Console]::CursorVisible = $true }
}

$category = Select-Item $categories "Script categories" $true
if (-not $category) { Write-Host "Cancelled."; return }
$categoryScripts = @($category.Group)
$selected = Select-Item $categoryScripts "$($category.Name) scripts"
if (-not $selected) { Write-Host "Cancelled."; return }
if ([Console]::IsInputRedirected) {
    if (-not $selected.runner -or (Read-Host "[r]un or [c]opy source? (r/c)") -ne "r") {
        Copy-Source $selected
        Write-Host "Copied source for '$($selected.name)' to the clipboard." -ForegroundColor Green
        return
    }
}
else { Clear-Host }
if ($selected.runner) { iex (Invoke-RestMethod (Resolve-ScriptUrl $selected.runner)) }
else { Copy-Source $selected; Write-Host "Copied source for '$($selected.name)' to the clipboard." -ForegroundColor Green }
