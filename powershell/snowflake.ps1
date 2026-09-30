# irm https://script.riyo.me/d/p/snowflake | iex
& ([scriptblock]::Create((Invoke-RestMethod 'https://script.riyo.me/d/p/run' -TimeoutSec 30))) -Name 'snowflake'
