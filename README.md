# discord-scripts

Scripts for Discord, served from the [script library](https://script.riyo.me/library?=discord). Browse, read, and copy the source there. All scripts have a [`console/`](console) version to paste into DevTools and a [`powershell/`](powershell) runner for the desktop client.

| Script | What it does |
| --- | --- |
| [`autoquest`](console/autoquest.js) | Processes supported Discord Quests in a queue with confirmed progress, Pause, and Stop |
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

Every script has a one-line runner using the shared `powershell/run.ps1` injector. It runs the script in the Discord desktop client over the Chrome DevTools Protocol — PowerShell does the fetching, so Discord's CSP does not block loading the source. Network requests made by the injected script still follow the client's CSP.

```powershell
irm https://script.riyo.me/p/menu | iex             # interactive picker (category, then browse / copy / run)
irm https://script.riyo.me/d/p/autoquest | iex      # run autoquest
irm https://script.riyo.me/d/p/token | iex          # copy your token to the clipboard
irm https://script.riyo.me/d/p/timestamp | iex      # open the timestamp panel
irm https://script.riyo.me/d/p/media | iex          # open the media downloader
irm https://script.riyo.me/d/p/whoami | iex         # print account and server inventory here
irm https://script.riyo.me/d/p/export | iex         # open the channel export panel
irm https://script.riyo.me/d/p/snowflake | iex      # enter an ID here and copy its timestamp
```

Keep the `https://` — without it, Windows PowerShell 5.1 fails on the HTTP-to-HTTPS redirect. From Command Prompt, wrap it: `powershell -c "irm https://script.riyo.me/d/p/autoquest | iex"`.

Offline runner check: `powershell -File tests/powershell.test.ps1`. This checks registration, syntax, and terminal input/output without launching Discord.

The runner quits Discord (interrupting any call), relaunches it with `--remote-debugging-port=9222`, and runs the script in the main window. The debug port stays open until Discord is restarted normally; while it is open, any local program can run code in your Discord, so close it when you are done. Requires a Discord build that honours `--remote-debugging-port`; verify with `irm http://127.0.0.1:9222/json/version` after launch.

DevTools is disabled in the desktop app by default. To enable it, add this line to `%APPDATA%\discord\settings.json` (macOS: `~/Library/Application Support/discord/settings.json`), then restart Discord:

```json
"DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING": true
```

## autoquest

Supported task types:

- `WATCH_VIDEO`, `WATCH_VIDEO_ON_MOBILE`
- `PLAY_ON_DESKTOP`: uses the desktop client's game store when available; otherwise sends application heartbeats. Server eligibility still applies. Nothing is installed.
- `STREAM_ON_DESKTOP`: desktop app only. You must be streaming any window in a voice channel.
- `PLAY_ON_XBOX`, `PLAY_ON_PLAYSTATION`
- `PLAY_ACTIVITY`
- `ACHIEVEMENT_IN_ACTIVITY`

An icon appears in the top-right corner of the window:

- Hover over it to show the queue. Click it to pin the panel open.
- Drag the icon to move it.
- Drag a waiting quest to change its order in the queue.
- **Pause** holds the queue and restores any game/stream patches until resumed.
- **Stop** cancels waiting immediately, restores this run's patches, and prevents further progress requests. An already-sent internal Discord request cannot be recalled.
- Running the script again stops the previous run first. Reload Discord once if an older version is already running.

The queue refreshes Discord's quest list, skips previews and inactive quests, and uses separate enrollment locations for video on mobile and desktop tasks. Completion is shown only after Discord confirms it; otherwise the result is **Pending confirmation**. Claim rewards manually in Discord.

Rate limits respect Discord's retry delay, with at most three retries. Game/activity tasks fail after three minutes without progress (time spent paused is excluded). CAPTCHA requirements are shown for manual resolution. Activity achievements depend on Discord's authorization and browser CSP/CORS permissions; failed or stopped runs remove newly created authorizations when possible, preserving existing grants.

The protocol and state handling were compared with the local `discord-quest-auto-complete-bot` project. Its account runner, token handling, and CAPTCHA providers are not part of this script.

Run the offline regression check with `node tests/autoquest.test.cjs`. It uses a simulated Discord client and makes no account or network requests.

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
