# discord-scripts

Scripts for Discord, served from [script.riyo.me](https://script.riyo.me). Each script comes in two forms: a [`console/`](console) script to paste into DevTools, and a [`powershell/`](powershell) runner that injects it into the desktop client for you.

| Script | What it does |
| --- | --- |
| [`autoquest`](console/autoquest.js) | Enrolls in and completes every active Discord Quest, one at a time |
| [`token`](console/token.js) | Prints your account token |
| [`timestamp`](console/timestamp.js) | Overlay that builds Discord `<t:…>` timestamp codes and copies them |
| [`media`](console/media.js) | Downloads the images and videos on the open page (all / images / videos) |
| [`whoami`](console/whoami.js) | Prints your account and a server/DM/friend inventory (read-only) |
| [`export`](console/export.js) | Saves the open DM/channel as a self-contained, Discord-looking HTML file |

For drafting and formatting messages without running code inside Discord, use the standalone [message helper](https://script.riyo.me/message-helper.html).

## Usage

Every script runs in Discord's DevTools console, in the desktop app or on discord.com.

1. Copy the script. The console source is always at `/d/<name>.js`. Open `https://script.riyo.me/d/autoquest.js` in any browser, press `Ctrl+A`, then `Ctrl+C`. Or copy it from a terminal:

   ```powershell
   irm https://script.riyo.me/d/autoquest.js | scb             # Windows (PowerShell)
   ```
   ```sh
   curl -sL https://script.riyo.me/d/autoquest.js | pbcopy     # macOS
   ```

2. In Discord, press `Ctrl+Shift+I` (`Cmd+Opt+I` on macOS) and open the **Console** tab.
3. Paste and press Enter. If the console asks, type `allow pasting` first.

A one-line loader such as `fetch("https://script.riyo.me/d/autoquest")` does not work in Discord's console. Discord's Content Security Policy blocks requests to hosts outside its allowlist, so the full script has to be pasted.

### From PowerShell (desktop app)

To skip the console entirely, each script has its own one-line runner. It injects the script into the Discord desktop client over the Chrome DevTools Protocol — PowerShell does the fetching, so the CSP never applies. The `.js` files are unchanged; CDP runs them in the same place the console would.

```powershell
irm https://script.riyo.me/d/autoquest | iex     # run autoquest
irm https://script.riyo.me/d/token | iex         # copy your token to the clipboard
```

Keep the `https://` — without it, Windows PowerShell 5.1 fails on the HTTP-to-HTTPS redirect. From Command Prompt, wrap it: `powershell -c "irm https://script.riyo.me/d/autoquest | iex"`.

The runner quits Discord (interrupting any call), relaunches it with `--remote-debugging-port=9222`, and runs the script in the main window. The debug port stays open until Discord is restarted normally; while it is open, any local program can run code in your Discord, so close it when you are done. Requires a Discord build that honours `--remote-debugging-port`; verify with `irm http://127.0.0.1:9222/json/version` after launch.

DevTools is disabled in the desktop app by default. To enable it, add this line to `%APPDATA%\discord\settings.json` (macOS: `~/Library/Application Support/discord/settings.json`), then restart Discord:

```json
"DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING": true
```

## autoquest

Supported task types:

- `WATCH_VIDEO`, `WATCH_VIDEO_ON_MOBILE`
- `PLAY_ON_DESKTOP`: desktop app only. The game is spoofed; nothing is installed.
- `STREAM_ON_DESKTOP`: desktop app only. You must be streaming any window in a voice channel.
- `PLAY_ON_XBOX`, `PLAY_ON_PLAYSTATION`
- `PLAY_ACTIVITY`
- `ACHIEVEMENT_IN_ACTIVITY`

An icon appears in the top-right corner of the window:

- Hover over it to show the queue. Click it to pin the panel open.
- Drag the icon to move it.
- Drag a waiting quest to change its order in the queue.
- **Pause** holds the queue. **Stop** ends the run and removes every patch.

## token

Prints your account token as the console result.

> [!WARNING]
> Your token gives full access to your account. Never share it, and never paste a script someone else sent you into the console.

## Disclaimer

Automating Discord with a user account breaks Discord's Terms of Service. Use these scripts at your own risk.

## Adding a script

Vercel rewrites proxy this repo's `main` branch. `script.riyo.me/d/<name>.js` serves the console source and `script.riyo.me/d/<name>.ps1` the PowerShell runner. The bare `script.riyo.me/d/<name>` runs the script the intended way — the runner for `autoquest`/`token`, the console source otherwise. To publish a script, push `console/<name>.js`; add `powershell/<name>.ps1` (and its bare-URL route in the delivery project's `vercel.json`) for a runner. GitHub's cache can take up to 5 minutes to update.
