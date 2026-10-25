# irm https://script.riyo.me/d/p/badge-gametime | iex
param([string]$Client)
& ([scriptblock]::Create((Invoke-RestMethod 'https://script.riyo.me/d/p/run' -TimeoutSec 30))) -Name 'badge-gametime' @PSBoundParameters
