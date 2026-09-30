# irm https://script.riyo.me/d/p/timestamp | iex
& ([scriptblock]::Create((Invoke-RestMethod 'https://script.riyo.me/d/p/run' -TimeoutSec 30))) -Name 'timestamp'
