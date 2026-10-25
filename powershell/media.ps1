# irm https://script.riyo.me/d/p/media | iex
param([string]$Client)
& ([scriptblock]::Create((Invoke-RestMethod 'https://script.riyo.me/d/p/run' -TimeoutSec 30))) -Name 'media' @PSBoundParameters
