#!/bin/sh
set -eu
runner=$(/usr/bin/curl -fsSL --max-time 30 https://script.riyo.me/d/m/run)
/bin/sh -c "$runner" riyo-scripts media
