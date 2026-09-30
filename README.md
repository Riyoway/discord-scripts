# discord-scripts

Scripts for Discord, served from the [script library](https://script.riyo.me/library?=discord). Browse, read, and copy the source there. All scripts have a [`console/`](console) version to paste into DevTools; some have a [`powershell/`](powershell) runner that injects the script into the desktop client.

| Script | What it does |
| --- | --- |
| [`autoquest`](console/autoquest.js) | Enrolls in and completes every active Discord Quest, one at a time |
| [`token`](console/token.js) | Prints your account token |
| [`timestamp`](console/timestamp.js) | Overlay that builds Discord `<t:…>` timestamp codes and copies them |
| [`media`](console/media.js) | Fetches images and videos in the background with progress and Stop, then saves one ZIP |
| [`whoami`](console/whoami.js) | Prints your account and a server/DM/friend inventory (read-only) |
| [`export`](console/export.js) | Saves the open DM/channel as a self-contained, Discord-looking HTML file |
| [`snowflake`](console/snowflake.js) | Decodes an ID or message link into its creation time and a Discord timestamp |

`snowflake` uses the timestamp bits and epoch documented in [Discord's Snowflake reference](https://docs.discord.com/developers/reference#snowflakes).

For drafting and formatting messages without running code inside Discord, use the standalone [message helper](https://script.riyo.me/message-helper.html).

## Usage

Every script runs in Discord's DevTools console, in the desktop app or on discord.com.

1. Copy the script. The console form of every script is at `/d/c/<name>`. Open `https://script.riyo.me/d/c/autoquest` in any browser, press `Ctrl+A`, then `Ctrl+C`. Or copy it from a terminal:

   ```powershell
   irm https://script.riyo.me/d/c/autoquest | scb             # Windows (PowerShell)
   ```
   ```sh
   curl -sL https://script.riyo.me/d/c/autoquest | pbcopy     # macOS
   ```

2. In Discord, press `Ctrl+Shift+I` (`Cmd+Opt+I` on macOS) and open the **Console** tab.
3. Paste and press Enter. If the console asks, type `allow pasting` first.

A one-line loader such as `fetch("https://script.riyo.me/d/c/autoquest")` does not work in Discord's console. Discord's Content Security Policy blocks requests to hosts outside its allowlist, so the full script has to be pasted.

### From PowerShell (desktop app)

To skip the console entirely, supported scripts have one-line runners. They inject the script into the Discord desktop client over the Chrome DevTools Protocol — PowerShell does the fetching, so the CSP never applies. The `.js` files are unchanged; CDP runs them in the same place the console would.

```powershell
irm https://script.riyo.me/p/menu | iex             # interactive picker (category, then browse / copy / run)
irm https://script.riyo.me/d/p/autoquest | iex      # run autoquest
irm https://script.riyo.me/d/p/token | iex          # copy your token to the clipboard
```

Keep the `https://` — without it, Windows PowerShell 5.1 fails on the HTTP-to-HTTPS redirect. From Command Prompt, wrap it: `powershell -c "irm https://script.riyo.me/d/p/autoquest | iex"`.

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

## media

Choose **Download all**, **Images**, or **Videos** to fetch the media in the background. The panel displays file progress and received bytes. **Stop**, closing the panel, or running the script again aborts the active request and stops the queue. When fetching finishes, click **Save ZIP** to save all successful files in one archive. Nothing is saved automatically and no tabs are opened for failed requests.

Blocked or unavailable URLs are skipped and counted in the result. The ZIP is held in memory until saved; batches are limited to 512 MiB. Choose a smaller batch if you reach the limit.

## token

Prints your account token as the console result.

> [!WARNING]
> Your token gives full access to your account. Never share it, and never paste a script someone else sent you into the console.

## Disclaimer

Automating Discord with a user account breaks Discord's Terms of Service. Use these scripts at your own risk.

## Adding a script

Vercel rewrites proxy this repo's `main` branch: `script.riyo.me/d/c/<name>` serves `console/<name>.js` (copy-paste), `script.riyo.me/d/p/<name>` serves `powershell/<name>.ps1` (run with `| iex`), and `/p/menu` serves the shared picker. To publish a script, push its source file, then add an entry to `scripts.json` with `category`, `name`, `desc`, and `source`; add `runner` when a PowerShell runner exists. The library page and menu read that manifest. GitHub's cache can take up to 5 minutes to update.
