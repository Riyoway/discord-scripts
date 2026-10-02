# discord-scripts

Scripts for Discord, served from the [script library](https://script.riyo.me/library?=discord). Browse, read, and copy the source there. All scripts have a [`console/`](console) version to paste into DevTools, a [`powershell/`](powershell) runner for Windows, and a shared native [`macos/`](macos) runner.

| Script | What it does |
| --- | --- |
| [`autoquest`](console/autoquest.js) | Processes supported Discord Quests in a queue with confirmed progress, Pause, and Stop |
| [`token`](console/token.js) | Prints your account token |
| [`timestamp`](console/timestamp.js) | Overlay that builds Discord `<t:…>` timestamp codes and copies them |
| [`media`](console/media.js) | Fetches images and videos in the background with progress and Stop, then saves one ZIP |
| [`whoami`](console/whoami.js) | Prints your account and a server/DM/friend inventory (read-only) |
| [`export`](console/export.js) | Saves the open DM/channel as a self-contained, Discord-looking HTML file |
| [`snowflake`](console/snowflake.js) | Decodes an ID or message link into its creation time and a Discord timestamp |
| [`search`](console/search.js) | Searches current-channel messages with keywords or RegExp; exports TXT/JSON |

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

### Windows PowerShell

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
irm https://script.riyo.me/d/p/search | iex         # open the channel message finder
```

Keep the `https://` — without it, Windows PowerShell 5.1 fails on the HTTP-to-HTTPS redirect. From Command Prompt, wrap it: `powershell -c "irm https://script.riyo.me/d/p/autoquest | iex"`.

### macOS Terminal

No additional installation is required on macOS 10.15 or later. The runner uses the built-in shell, `curl`, and JavaScript for Automation (`osascript`):

```sh
curl -fsSL https://script.riyo.me/m/menu | sh
curl -fsSL https://script.riyo.me/d/m/autoquest | sh
```

Replace `autoquest` with any script name from the table. All eight scripts use the shared native injector. The menu supports running a script, copying its source, or copying its terminal command. The library includes **macOS command** copy buttons. Tokens go directly to the clipboard without being printed; `whoami` returns JSON in Terminal, and `snowflake` reads an ID from Terminal and copies its timestamp.

The macOS runner finds Stable, PTB, Canary or Development in `/Applications` or `~/Applications`, reads the bundle's executable name, and selects a running installation when possible. If a debug endpoint already exists, it reuses it. Otherwise it quits only the selected app, waits for it to exit, and launches the bundle executable directly with a local debugging port. It waits up to 30 seconds for the port and distinguishes a running app without a debug port from a process that exited. If startup fails, it asks macOS to reopen Discord normally before reporting the error. Log in to Discord before running a script.

The injector uses Apple's [URLSession WebSocket API](https://developer.apple.com/documentation/foundation/urlsessionwebsockettask). Its callbacks run on the [session's main delegate queue](https://developer.apple.com/documentation/foundation/urlsession/delegatequeue). No browser window, UI automation, or Accessibility permission is needed. Source fetching happens outside Discord's CSP.

macOS launch, networking, and clipboard behavior have not been verified on a physical Mac. An offline logic check is available with `node tests/macos.test.cjs`; it does not launch Discord or access an account. It cannot validate Apple's runtime bridge.

Offline runner check: `powershell -File tests/powershell.test.ps1`. This checks registration, syntax, and terminal input/output without launching Discord.

The runner reuses an existing debugging endpoint when available; otherwise it quits Discord (interrupting any call), relaunches it with `--remote-debugging-port=9222`, and runs the script in the main window. The debug port stays open until Discord is restarted normally; while it is open, any local program can run code in your Discord, so close it when you are done. Requires a Discord build that honours `--remote-debugging-port`; verify with `irm http://127.0.0.1:9222/json/version` after launch.

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

Set **Channel** to a channel ID, channel/message link, or `<#channel ID>` mention. Leave it blank to use the current channel. The downloader scans message history for image/video attachments and embeds, without opening the target channel. **Max messages** defaults to 1,000; use 0 for all history. **Stop** also cancels history scanning. Only channels accessible to your account can be read.

Blocked or unavailable URLs are skipped and counted in the result. The ZIP is held in memory until saved; batches are limited to 512 MiB. Choose a smaller batch if you reach the limit.

Archive entries retain filenames from response headers or URLs, with a numeric prefix to avoid collisions. Missing or mismatched media extensions are corrected using the response type or common file signatures. Unidentified files without an extension use `.bin`.

## search

Set **Channel** to a channel ID, channel/message link, or `<#channel ID>` mention, then press **Find**. Leave it blank to use the current channel. The target does not need to be open. Literal keyword matching ignores case; **RegExp** uses a case-sensitive regular expression. **All messages** scans history in pages of 100. Disable it to fetch the latest 1–100 messages, or set **Limit** to 0 to search that channel's local cache (which may be empty if it has never been opened). The target channel is fixed for each run.

**Cancel**, closing the panel, and rerunning the script stop further requests and remove drag listeners. Rate limits respect the retry delay, with at most three retries. The panel displays up to 200 matches; exports include all matches scanned before completion or cancellation. **TXT** exports unique URLs, falling back to message text when none exist. **JSON** exports message IDs, timestamps, authors, and content. Searches only read channels accessible to your account.

## token

Prints your account token as the console result.

> [!WARNING]
> Your token gives full access to your account. Never share it, and never paste a script someone else sent you into the console.

## Disclaimer

Automating Discord with a user account breaks Discord's Terms of Service. Use these scripts at your own risk.

## Adding a script

Overlay scripts share the black glass theme and inline SVG icons in `ui/theme.js`. After editing it, run `node scripts/sync-ui.cjs` to embed the updated assets in AutoQuest, Media, Search, Timestamp, Export, and Snowflake. Each published console script remains standalone and loads no UI assets from external hosts. Use `node scripts/sync-ui.cjs --check` to detect stale copies. Snowflake uses the panel in DevTools and retains terminal input/output in desktop runners.

Search and Media also embed `ui/channels.js`, sharing channel input parsing, module lookup, cancellable request waits, and bounded rate-limit retries. Sync after editing this file too.

For client compatibility work, consult [Discord Client Internals](https://github.com/Riyoway/discord-client-internals) (private repository). Its offline `index.html` documents store/HTTP lookup fingerprints with captured build numbers and hashes. Run its collector on the affected build before changing module selectors; a lookup snapshot alone is not an end-to-end script test.

Vercel rewrites proxy this repo's `main` branch: `/d/c/<name>` serves `console/<name>.js`, `/d/p/<name>` serves `powershell/<name>.ps1`, and `/p/menu` serves the PowerShell picker. `/d/m/<name>` serves `macos/<name>.sh`; these wrappers call the shared loader at `/d/m/run`. `/m/menu` also serves that loader, which downloads `macos/run.js` from `/d/m/client`. To publish a script, push its source file and named runners, then add an entry to `scripts.json` with `category`, `name`, `desc`, and `source`; add `runner` when a desktop runner exists. Discord entries automatically appear in the macOS picker. The library page and menus read that manifest. GitHub's cache can take up to 5 minutes to update.
