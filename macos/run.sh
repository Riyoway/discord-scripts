#!/bin/sh
# Download the native macOS runner before executing it.
set -eu
if [ "$(uname -s)" != Darwin ]; then
    printf '%s\n' 'This command requires macOS.' >&2
    exit 1
fi
work=$(mktemp -d "${TMPDIR:-/tmp}/riyo-scripts.XXXXXX")
trap 'rm -f "$work/client.js"; rmdir "$work"' EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
/usr/bin/curl -fsSL --max-time 30 https://script.riyo.me/d/m/client -o "$work/client.js"
/usr/bin/osascript -l JavaScript "$work/client.js" "$@"
