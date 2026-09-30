# irm https://script.riyo.me/d/p/autoquest | iex
& ([scriptblock]::Create((Invoke-RestMethod 'https://script.riyo.me/d/p/run' -TimeoutSec 30))) -Name 'autoquest'
