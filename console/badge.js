// Badge — game time, game variety, stream hours, and HypeSquad, one panel.
(async () => {
    // BEGIN SHARED UI
    // Embedded by scripts/sync-ui.cjs so every console script works without remote UI assets.
    const riyoIcon = name => {
        const paths = {
            close: '<path d="m18 6-12 12M6 6l12 12"/>',
            download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
            image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
            video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/>',
            search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
            clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
            quest: '<path d="m14.5 17.5 3 3L21 17l-3-3M13 19l6-6M3 3l3 .5L18 15l-3 3L3.5 6Zm.5 17.5L7 17l-3-3L1 17M5 19l6-6M14 6l4.5-2.5L21 3l-.5 3L18 10"/>',
            pause: '<path d="M9 4H5v16h4zM19 4h-4v16h4z"/>',
            play: '<path d="m7 4 14 8-14 8Z"/>',
            stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
            copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
            pin: '<path d="m16 3 5 5-4 1-4 4-1 4-5-5 4-1 4-4ZM9 15l-6 6"/>'
        };
        return `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.copy}</svg>`;
    };
    const riyoTheme = `<style>
    .riyo-ui{--riyo-surface:rgba(0,0,0,.76);--riyo-line:rgba(255,255,255,.14);--riyo-text:#f5f5f5;--riyo-muted:#b3b3b3;--riyo-danger:#ff9090;color-scheme:dark;font:13px/1.5 'gg sans',system-ui,sans-serif;color:var(--riyo-text)}
    .riyo-panel,.riyo-ui .autoquest-panel{box-sizing:border-box;width:360px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 96px);padding:18px;background:var(--riyo-surface);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);border:1px solid var(--riyo-line);border-radius:18px;box-shadow:0 16px 56px #0007,inset 0 1px 0 #ffffff08;overflow:auto}
    .riyo-panel{position:fixed;top:72px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:14px}
    .riyo-ui *{box-sizing:border-box;scrollbar-width:none}.riyo-ui ::-webkit-scrollbar,.riyo-ui::-webkit-scrollbar{display:none}
    .riyo-ui .riyo-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--riyo-line);flex-shrink:0}
    .riyo-ui .riyo-title{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:650;letter-spacing:-.2px;margin:0;color:var(--riyo-text)}
    .riyo-ui svg{display:inline-block;flex-shrink:0;vertical-align:middle;pointer-events:none}
    .riyo-ui button{font:inherit;font-weight:550;display:inline-flex;justify-content:center;align-items:center;gap:8px;min-height:36px;padding:8px 12px;border:1px solid var(--riyo-line);border-radius:10px;background:rgba(255,255,255,.065);color:var(--riyo-text);cursor:pointer;transition:background .15s,border-color .15s}
    .riyo-ui button:hover{background:rgba(255,255,255,.13);border-color:#ffffff40}.riyo-ui button:active{background:#ffffff20}.riyo-ui button:disabled{opacity:.4;cursor:default}
    .riyo-ui .riyo-primary{background:#f5f5f5;color:#111;border-color:#f5f5f5}.riyo-ui .riyo-primary:hover{background:#dedede;border-color:#dedede}
    .riyo-ui .riyo-danger{background:#ff909010;color:var(--riyo-danger);border-color:#ff909040}.riyo-ui .riyo-danger:hover{background:#ff909024}
    .riyo-ui .riyo-close{width:32px;min-height:32px;padding:6px;background:transparent;flex-shrink:0;border-color:transparent}
    .riyo-ui input{font:inherit;color:var(--riyo-text);min-width:0;border:1px solid var(--riyo-line);border-radius:10px;background:#ffffff06;padding:9px 11px}
    .riyo-ui input:not([type=checkbox]){width:100%;min-height:38px}.riyo-ui input::placeholder{color:#969696}.riyo-ui input[type=checkbox]{accent-color:#fff;width:15px;height:15px;margin:0}
    .riyo-ui :focus-visible{outline:2px solid #fff;outline-offset:3px}
    .riyo-ui .riyo-muted,.riyo-ui .riyo-status{font-size:12px;color:var(--riyo-muted);overflow-wrap:anywhere}.riyo-ui .riyo-status{padding:11px 12px;border:1px solid #ffffff0c;border-radius:10px;background:#ffffff04}
    .riyo-ui .riyo-row{display:flex;gap:8px;align-items:center}.riyo-ui .riyo-row>button{flex:1}.riyo-ui .riyo-options{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.riyo-ui label{font-size:12px;color:var(--riyo-muted)}
    .riyo-ui .riyo-label{display:flex;flex-direction:column;gap:7px}.riyo-ui .riyo-check{display:flex;align-items:center;gap:7px}
    .riyo-ui progress{appearance:none;display:block;width:100%;height:6px;border:0;border-radius:99px;overflow:hidden;background:#ffffff14;flex-shrink:0}
    .riyo-ui progress::-webkit-progress-bar{background:#ffffff14;border-radius:99px}.riyo-ui progress::-webkit-progress-value{background:#eee;border-radius:99px;transition:width .2s}.riyo-ui progress::-moz-progress-bar{background:#eee;border-radius:99px}
    .riyo-ui [hidden]{display:none!important}
    .riyo-ui .riyo-badge{font-size:11px;font-weight:550;padding:3px 8px;border:1px solid var(--riyo-line);border-radius:99px;white-space:nowrap}
    .riyo-ui .autoquest-panel{position:absolute;top:52px;right:0;display:none;opacity:0;transition:opacity .15s;pointer-events:auto}
    .riyo-ui .autoquest-icon{width:40px;height:40px;padding:0;border-radius:12px;background:var(--riyo-surface);backdrop-filter:blur(28px);box-shadow:0 4px 20px #0005}
    .riyo-ui .autoquest-icon[aria-pressed=true]{background:#f5f5f5;color:#111}.riyo-ui .autoquest-queue{max-height:320px;overflow:auto;margin-top:14px}
    .riyo-ui .autoquest-item{padding:12px;margin-bottom:8px;border:1px solid #ffffff0d;background:#ffffff04;border-radius:12px}.riyo-ui .autoquest-item[data-current=true]{border-color:#ffffff40;background:#ffffff09}.riyo-ui .autoquest-item[data-done=true]{opacity:.55}
    .riyo-ui .autoquest-item.drag-over{outline:1px dashed #eee;background:#ffffff14}.riyo-ui .riyo-quest-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.riyo-ui .riyo-quest-meta{display:flex;justify-content:space-between;gap:10px;margin-top:5px;font-size:12px;color:var(--riyo-muted);pointer-events:none}
    .riyo-ui .riyo-progress{height:6px;background:#ffffff14;border-radius:99px;margin-top:10px;overflow:hidden}.riyo-ui .riyo-progress>div{height:100%;background:#eee;border-radius:99px;transition:width .3s}.riyo-ui .riyo-footer{display:flex;gap:8px;padding-top:14px;margin-top:6px;border-top:1px solid var(--riyo-line)}.riyo-ui .riyo-footer>button:first-child{flex:1}
    .riyo-ui #search-results-list{overflow:auto;min-height:0}.riyo-ui #search-results-list article{padding:12px;border:1px solid #ffffff14;border-radius:12px;margin-bottom:8px;overflow-wrap:anywhere}.riyo-ui #search-results-list p{margin:6px 0 0;white-space:pre-wrap}.riyo-ui #search-results-list mark{background:#eee;color:#111;border-radius:3px}
    .riyo-ui .ts-row{width:100%;justify-content:space-between;text-align:left}.riyo-ui #ts-list{display:flex;flex-direction:column;gap:6px}.riyo-ui .ts-code{font:12px ui-monospace,monospace}.riyo-ui .ts-format{color:var(--riyo-muted);font-size:11px}
    @media(max-width:480px){.riyo-panel{right:12px;max-width:calc(100vw - 24px);padding:16px}.riyo-ui .autoquest-panel{max-width:calc(100vw - 32px);padding:16px}.riyo-ui button{min-height:40px}}
    @media(prefers-reduced-motion:reduce){.riyo-ui *{transition:none!important;animation:none!important}}
    </style>`;
    // A native dialog also works in Electron, where window.confirm is unsupported.
    const riyoRunScript = (name, run) => {
        const key = 'riyo-scripts:consent:' + name;
        const remember = () => {
            try { localStorage.setItem(key, 'yes'); } catch { /* Ask again if storage is unavailable. */ }
        };
        if (typeof riyoScriptApproved !== 'undefined' && riyoScriptApproved === name) {
            remember();
            return run();
        }
        let accepted = false;
        try { accepted = localStorage.getItem(key) === 'yes'; } catch { /* Show the warning. */ }
        if (accepted) return run();
        return new Promise((resolve, reject) => {
            const previousFocus = document.activeElement;
            const dialog = document.createElement('dialog');
            const titleId = 'riyo-consent-' + name;
            dialog.className = 'riyo-ui riyo-panel riyo-consent';
            dialog.setAttribute('aria-labelledby', titleId);
            dialog.setAttribute('aria-describedby', titleId + '-message');
            dialog.innerHTML = `${riyoTheme}
                <style>.riyo-consent{top:50%;left:50%;right:auto;margin:0;transform:translate(-50%,-50%)}.riyo-consent:not([open]){display:none}.riyo-consent::backdrop{background:#0009;backdrop-filter:blur(8px)}.riyo-consent p{margin:0}.riyo-consent form{margin:0}</style>
                <header class="riyo-header"><strong class="riyo-title" id="${titleId}">Run ${name}?</strong></header>
                <p id="${titleId}-message">Use this script at your own risk. You are responsible for any consequences, including issues affecting your account or data.</p>
                <form method="dialog" class="riyo-row">
                    <button type="submit" value="no" autofocus>No</button>
                    <button type="submit" value="yes" class="riyo-primary">Yes</button>
                </form>`;
            dialog.onclose = () => {
                const accepted = dialog.returnValue === 'yes';
                dialog.remove();
                previousFocus?.focus?.();
                if (!accepted) { resolve(undefined); return; }
                remember();
                try { resolve(run()); } catch (error) { reject(error); }
            };
            document.body.appendChild(dialog);
            try { dialog.showModal(); } catch (error) { dialog.remove(); reject(error); }
        });
    };
    // END SHARED UI

    return riyoRunScript("badge", async () => {
        const OLD_ID = "riyo-badge-panel";
        const previous = document.getElementById(OLD_ID);
        if (previous) {
            previous.__stop?.();
            previous.remove();
            return;
        }

        const LOCK = "__badgeNaturalPresence";
        const MIN_CHANGE_MS = 23 * 60 * 1000;
        const MAX_CHANGE_MS = 38 * 60 * 1000;
        const RECENT_HISTORY_SIZE = 100;
        const GAMES_URL = "https://cdn.discordapp.com/detectables/games.json";
        const LS_GUILD = "riyo-scripts:badge:guild";
        const LS_CHANNEL = "riyo-scripts:badge:channel";
        const HOUSES = { 1: "Bravery", 2: "Brilliance", 3: "Balance" };

        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const shuffle = input => {
            const a = [...input];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };
        const clampNumber = (value, min, max, fallback) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        };
        const clampInt = (value, min, max, fallback) => {
            const n = Math.floor(Number(value));
            if (!Number.isFinite(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        };
        const getName = game => game?.name || game?.names?.default || game?.display_name || `Game ${game?.id ?? "unknown"}`;
        const platform = /Linux/i.test(navigator.userAgent) ? "linux" : "win32";
        const executableFor = game => {
            const executables = Array.isArray(game?.executables) ? game.executables : [];
            return executables.find(exe => exe?.os === platform && exe.name)
                || executables.find(exe => exe?.os === "win32" && exe.name);
        };
        const lsGet = key => { try { return localStorage.getItem(key) || ""; } catch { return ""; } };
        const lsSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } };

        // ---- natural presence (adapted rotation: real client, real telemetry) ----
        function createPresence(games, config, onChange, onStop, onError) {
            if (window[LOCK]?.stop) throw new Error("Another presence session is running.");
            let req = window.Vencord?.Webpack?.wreq;
            if (!req?.c && typeof webpackChunkdiscord_app !== "undefined") {
                webpackChunkdiscord_app.push([[Symbol("badge")], {}, incoming => {
                    if (Object.keys(incoming?.c || {}).length > Object.keys(req?.c || {}).length) req = incoming;
                }]);
                webpackChunkdiscord_app.pop();
            }
            if (!req?.c) throw new Error("Discord webpack registry not found. Use the Discord desktop app.");
            const exports = Object.values(req.c).flatMap(module => {
                try {
                    const value = module?.exports;
                    return value ? [value, value.default, ...(typeof value === "object" ? Object.values(value) : [])] : [];
                } catch { return []; }
            }).filter(Boolean);
            const store = exports.find(value => {
                try {
                    return value.getName?.() === "RunningGameStore"
                        || Object.getPrototypeOf(value)?.constructor?.displayName === "RunningGameStore";
                } catch { return false; }
            });
            const dispatcher = exports.find(value => typeof value.dispatch === "function" && typeof value.subscribe === "function" && value._subscriptions);
            if (!store || !dispatcher || typeof store.getRunningGames !== "function" || typeof store.getGameForPID !== "function") {
                throw new Error("Discord desktop RunningGameStore/Dispatcher not found.");
            }
            const keys = ["getRunningGames", "getGameForPID", "getVisibleGame", "getVisibleRunningGames", "getCandidateGames"];
            const originals = new Map(keys.filter(key => typeof store[key] === "function").map(key => [key, {
                fn: store[key], descriptor: Object.getOwnPropertyDescriptor(store, key)
            }]));
            const patches = new Map();
            let pid = 45000 + Math.floor(Math.random() * 10000);
            const usedPids = new Set((store.getRunningGames() || []).map(game => game?.pid));
            while (usedPids.has(pid)) pid++;
            const realGames = () => (originals.get("getRunningGames").fn.call(store) || []).filter(game => game?.pid !== pid);
            const history = [];
            const shown = new Set();
            const deadline = Date.now() + config.totalHours * 3600000;
            let current = null, index = -1, timer = null, active = true, controller;
            const patch = (key, fn) => {
                patches.set(key, fn);
                store[key] = fn;
                if (store[key] !== fn) throw new Error(`Could not patch RunningGameStore.${key}.`);
            };
            const remove = game => {
                if (!game) return;
                dispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", added: [], removed: [game], games: realGames() });
                dispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", socketId: null, pid, activity: null });
            };
            const stop = (message = "Stopped.") => {
                if (!active) return;
                active = false;
                clearTimeout(timer);
                const previous = current;
                current = null;
                for (const [key, fn] of patches) {
                    if (store[key] !== fn) continue;
                    const { descriptor } = originals.get(key);
                    if (descriptor) Object.defineProperty(store, key, descriptor);
                    else delete store[key];
                }
                try { remove(previous); }
                catch (error) { console.error("[badge] Cleanup notification failed:", error); }
                finally {
                    if (window[LOCK] === controller) delete window[LOCK];
                    onStop(message);
                }
            };
            const next = () => {
                if (!active) return;
                clearTimeout(timer);
                if (Date.now() >= deadline) { stop("Session finished: time limit reached."); return; }
                try {
                    const blocked = new Set(history);
                    blocked.add(index);
                    let candidates = games.map((_, i) => i).filter(i => !blocked.has(i));
                    if (!candidates.length) {
                        history.length = 0;
                        candidates = games.map((_, i) => i).filter(i => i !== index);
                    }
                    index = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : 0;
                    history.push(index);
                    while (history.length > Math.min(RECENT_HISTORY_SIZE, Math.max(0, games.length - 1))) history.shift();
                    const previous = current;
                    current = null;
                    remove(previous);
                    const game = games[index];
                    const slug = getName(game).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || String(game.id);
                    const executable = executableFor(game).name.replaceAll("\\", "/").split("/").pop();
                    current = {
                        id: String(game.id), name: getName(game), pid, pidPath: [pid], processName: executable,
                        start: Date.now(), exeName: executable, exePath: `/synthetic/games/${slug}/${executable}`,
                        cmdLine: `/synthetic/games/${slug}/${executable}`, executables: [{ os: platform, name: executable, is_launcher: false }],
                        windowHandle: 0, fullscreenType: 0, overlay: false, sandboxed: false, hidden: false, isLauncher: false
                    };
                    dispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", added: [current], removed: [], games: store.getRunningGames() });
                    dispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", socketId: null, pid, activity: {
                        name: current.name, type: 0, details: null, state: null, timestamps: { start: current.start }, assets: null
                    } });
                    shown.add(current.id);
                    let delay = MIN_CHANGE_MS + Math.floor(Math.random() * (MAX_CHANGE_MS - MIN_CHANGE_MS + 1));
                    if (config.wobble) delay *= 0.97 + Math.random() * 0.06;
                    delay = Math.min(deadline - Date.now(), Math.min(MAX_CHANGE_MS, Math.max(MIN_CHANGE_MS, Math.round(delay))));
                    onChange(current, shown.size, Date.now() + delay);
                    timer = setTimeout(next, delay);
                } catch (error) {
                    stop("Stopped after an activity error.");
                    onError(error);
                }
            };
            controller = { stop, next, games, history };
            try {
                patch("getRunningGames", () => current ? [...realGames(), current] : realGames());
                patch("getGameForPID", value => value === pid && current ? current : originals.get("getGameForPID").fn.call(store, value));
                if (originals.has("getVisibleGame")) patch("getVisibleGame", () => current || originals.get("getVisibleGame").fn.call(store));
                for (const key of ["getVisibleRunningGames", "getCandidateGames"]) {
                    if (originals.has(key)) patch(key, () => {
                        const real = (originals.get(key).fn.call(store) || []).filter(game => game?.pid !== pid);
                        return current ? [...real, current] : real;
                    });
                }
                window[LOCK] = controller;
                next();
                return active ? controller : null;
            } catch (error) {
                stop("Could not start game presence.");
                throw error;
            }
        }

        // ---- instant spoof (fabricated /science, backdated, minutes not days) ----
        const instant = { sp: "", analyticsToken: "", uid: "", stopFlag: false };
        const readToken = () => {
            let raw = null;
            try { raw = localStorage.getItem("token"); } catch { return ""; }
            if (!raw) return "";
            try { raw = JSON.parse(raw); } catch { /* use raw */ }
            return String(raw).replace(/^"|"$/g, "").replace(/^'|'$/g, "");
        };
        const ensureAuth = status => new Promise((resolve, reject) => {
            const token = readToken();
            if (!token) { reject(new Error("No account token in this session.")); return; }
            if (instant.sp && instant.analyticsToken) { resolve(token); return; }
            status("Waiting for x-super-properties: switch channel once…");
            const f = window.fetch;
            window.fetch = function (u, o) {
                try {
                    const sp = o && o.headers && o.headers["x-super-properties"];
                    if (sp) { window.fetch = f; instant.sp = sp; go(); }
                } catch { /* ignore */ }
                return f.apply(this, arguments);
            };
            const go = async () => {
                try {
                    status("Fetching analytics token…");
                    const res = await f("/api/v9/users/@me?with_analytics_token=true", {
                        headers: { authorization: token, "x-super-properties": instant.sp }
                    });
                    if (!res.ok) throw new Error("users/@me rejected: HTTP " + res.status);
                    const me = await res.json();
                    if (!me.analytics_token) throw new Error("No analytics_token in response.");
                    instant.analyticsToken = me.analytics_token;
                    instant.uid = me.id;
                    resolve(token);
                } catch (error) { reject(error); }
            };
        });
        const postScience = (token, events) => fetch("/api/v9/science", {
            method: "POST",
            headers: { authorization: token, "content-type": "application/json", "x-super-properties": instant.sp },
            body: JSON.stringify({ token: instant.analyticsToken, events })
        });
        const buildGameEvents = (games, dur, hb, sig, seq) => {
            const evs = [];
            for (const g of games) {
                const sid = crypto.randomUUID(), t = Date.now(), s = t - dur;
                const base = { client_heartbeat_session_id: hb, launch_signature: sig, client_app_state: "focused" };
                evs.push({ type: "running_game_heartbeat", properties: { ...base,
                    client_track_timestamp: s, event_sequence_number: seq.n++,
                    game_id: g.id, game_name: g.name, game_metadata: null,
                    game_executable: g.exe, game_detection_enabled: true,
                    initial_heartbeat: true, final_heartbeat: false,
                    game_session_id: sid, duration_tracked_ms: 0,
                    rtc_connection_id: null, media_session_id: null, client_send_timestamp: s } });
                evs.push({ type: "launch_game", properties: { ...base,
                    client_track_timestamp: s, event_sequence_number: seq.n++,
                    game: g.name, game_id: g.id, verified: true, elevated: false,
                    is_launcher: false, game_platform: "desktop",
                    detection_method: "verified_game",
                    is_overlay_enabled: false, is_overlay_game_enabled: true,
                    is_overlay_game_source: "OOP_DEFAULT_DATABASE",
                    fullscreenType: "UNKNOWN", hardware_display_count: 1,
                    overlay_method: "Disabled", activity_status_enabled: true,
                    activity_status_shared_guilds: [], current_user_status: "online",
                    game_detection_enabled: true, executable_path: g.exe,
                    voice_channel_id: null, voice_channel_type: null,
                    voice_channel_bitrate: null, voice_channel_guild_id: null,
                    hidden_by_distributor: false, game_metadata: null,
                    client_performance_cpu: null, client_performance_memory: null,
                    cpu_core_count: null, accessibility_features: 0,
                    rendered_locale: "en-US", client_rtc_state: null, client_send_timestamp: s } });
                evs.push({ type: "running_game_heartbeat", properties: { ...base,
                    client_track_timestamp: t, event_sequence_number: seq.n++,
                    game_id: g.id, game_name: g.name, game_metadata: null,
                    game_executable: g.exe, game_detection_enabled: true,
                    initial_heartbeat: false, final_heartbeat: true,
                    game_session_id: sid, duration_tracked_ms: dur,
                    rtc_connection_id: null, media_session_id: null, client_send_timestamp: t } });
            }
            return evs;
        };
        const buildStreamEvents = (guildId, channelId, dur, hb, sig, seq) => {
            const t = Date.now(), s = t - dur, secs = Math.floor(dur / 1000), ratio = dur / 70000;
            const rtc = crypto.randomUUID(), mid = crypto.randomUUID(), par = crypto.randomUUID();
            const base = ts => ({
                client_heartbeat_session_id: hb, launch_signature: sig,
                client_performance_cpu: 9.9, client_performance_memory: 1832152,
                cpu_core_count: 16, accessibility_features: 34078976,
                rendered_locale: "en-US", client_rtc_state: "RTC_CONNECTED",
                client_app_state: "focused", client_viewport_width: 475,
                client_viewport_height: 711, client_send_timestamp: ts });
            return [
                { type: "media_session_joined", properties: { ...base(s),
                    client_track_timestamp: s, event_sequence_number: seq.n++,
                    guild_id: guildId, channel_id: channelId, channel_type: 2,
                    rtc_connection_id: rtc, context: "stream",
                    voice_backend_version: "0.22.2", rtc_backend_version: "1.7.1",
                    media_session_id: mid, parent_media_session_id: par } },
                { type: "video_stream_started", properties: { ...base(s),
                    client_track_timestamp: s, event_sequence_number: seq.n++,
                    channel_id: channelId, rtc_connection_id: rtc,
                    media_session_id: mid, parent_media_session_id: par,
                    sender_user_id: instant.uid, context: "stream", guild_id: guildId,
                    stream_region: "japan", stream_source_type: "window", guild_region: "c-nrt",
                    participant_type: "streamer", video_layout: "theatre",
                    client_event_source: "APP",
                    voice_backend_version: "0.22.2", rtc_worker_backend_version: "1.7.1",
                    video_input_resolution: 1440, video_input_frame_rate: 60,
                    soundshare_session: `4${String(s).slice(-4)}.${Math.floor(s / 1000)}`,
                    share_game_name: null, share_game_id: null,
                    quality_preset: 1, connection_type: "unknown",
                    effective_connection_speed: "4g", duration_go_live_modal: 1344,
                    source_location_stack: ["rtc panel", "go live modal v2"] } },
                { type: "voice_disconnect", properties: { ...base(t),
                    client_track_timestamp: t, event_sequence_number: seq.n++,
                    guild_id: guildId, channel_id: channelId, channel_type: 2,
                    rtc_connection_id: rtc, context: "stream",
                    voice_backend_version: "0.22.2", rtc_worker_backend_version: "1.7.1",
                    hostname: "c-nrt12-96fd5c69.discord.media", port: 19315,
                    protocol: "udp", reconnect: false, reason: "Force Close",
                    duration: dur, packets_sent: Math.floor(3453 * ratio),
                    packets_sent_lost: 0, packets_received: 0, packets_received_lost: 0,
                    bytes_sent: Math.floor(93231 * ratio), bytes_received: 0,
                    channel_bitrate: 64000, connect_count: 1,
                    duration_listening_ms: 0, duration_speaking_ms: dur,
                    duration_participation_ms: dur, duration_connected_ms: dur,
                    duration_muted_ms: dur, duration_deafened_ms: 0,
                    duration_listening: 0, duration_speaking: secs,
                    duration_participation: secs, duration_connected: secs,
                    duration_connection_type_unknown: secs,
                    duration_effective_connection_speed_4g: secs,
                    media_session_id: mid, parent_media_session_id: par,
                    participant_type: "streamer", audio_input_mode: "VOICE_ACTIVITY",
                    encryption_mode: "aead_aes256_gcm_rtpsize" } },
                { type: "screenshare_finished", properties: { ...base(t),
                    client_track_timestamp: t, event_sequence_number: seq.n++,
                    hybrid_graphics_capture_frames: Math.floor(4188 * ratio),
                    hybrid_capture_method_switches: 2,
                    total_frames: Math.floor(4188 * ratio),
                    total_frames_unique: Math.floor(1166 * ratio),
                    desktop_capturer_type: "screen",
                    media_session_id: mid, rtc_connection_id: rtc,
                    context: "stream", activity: 30.0,
                    soundshare_session: `4${String(s).slice(-4)}.${Math.floor(s / 1000)}`,
                    picker_type_used: "internal", duration: null,
                    discord_is_elevated: false, target_window_elevated: false } }
            ];
        };

        // ---- hypesquad (real membership API, not spoofed) ----
        const findApi = () => {
            if (typeof webpackChunkdiscord_app === "undefined") throw new Error("Discord webpack not found.");
            const wreq = webpackChunkdiscord_app.push([[Symbol("badge-hype")], {}, r => r]);
            webpackChunkdiscord_app.pop();
            for (const [, func] of Object.entries(wreq.m)) {
                let code = "";
                try { code = func.toString(); } catch { continue; }
                if (["HTTPUtils", ".get", ".post"].every(c => code.includes(c))) {
                    const mod = wreq(func?.__webpackModuleId ?? Object.keys(wreq.m).find(id => { try { return wreq.m[id].toString() === code; } catch { return false; } }));
                    const api = Object.values(mod || {}).find(e => e?.get);
                    if (api?.post) return api;
                }
            }
            const fallback = Object.values(wreq.m)
                .map(id => { try { return wreq(id); } catch { return null; } })
                .flatMap(m => (m ? [m, m.default, ...(typeof m === "object" ? Object.values(m) : [])] : []))
                .find(e => e?.get && e?.post);
            if (!fallback) throw new Error("API module not found.");
            return fallback;
        };

        // ---- panel ----
        const panel = document.createElement("div");
        panel.id = OLD_ID;
        panel.className = "riyo-ui riyo-panel";
        panel.innerHTML = `
            ${riyoTheme}
            <header class="riyo-header">
                <strong class="riyo-title">${riyoIcon("clock")} Badge</strong>
                <button type="button" class="riyo-close" id="bd-close" aria-label="Close">${riyoIcon("close")}</button>
            </header>
            <div class="riyo-status">
                <b>Game Time</b> · Instant ✓ / Natural ✓ — hours played.<br>
                <b>Game Variety</b> · Instant ✓ (distinct titles) / Natural ✓ (rotates 23–38 min).<br>
                <b>Streaming</b> · Instant only (fabricated session).<br>
                <b>HypeSquad</b> · real join/leave below.<br>
                Instant = minutes, backdated timestamps. Natural = real time, real telemetry (desktop only).
            </div>
            <div class="riyo-options">
                <label class="riyo-check"><input type="radio" name="bd-mode" id="bd-mode-instant" checked> Instant</label>
                <label class="riyo-check"><input type="radio" name="bd-mode" id="bd-mode-natural"> Natural</label>
            </div>
            <div id="bd-box-instant">
                <label class="riyo-label">Hours per game<input id="bd-hours" type="number" min="0" step="0.5" value="1"></label>
                <label class="riyo-label">Max games (0 = all)<input id="bd-maxgames" type="number" min="0" step="1" value="0"></label>
                <label class="riyo-label">Stream hours (0 = skip)<input id="bd-streamhours" type="number" min="0" step="0.5" value="0"></label>
                <label class="riyo-label">Guild ID (stream)<input id="bd-guild" value="${lsGet(LS_GUILD)}"></label>
                <label class="riyo-label">Voice channel ID (stream)<input id="bd-channel" value="${lsGet(LS_CHANNEL)}"></label>
                <progress id="bd-progress-instant" value="0" max="1"></progress>
                <div id="bd-status-instant" class="riyo-status" role="status">Ready.</div>
                <div class="riyo-row">
                    <button type="button" id="bd-stop-instant" class="riyo-danger" disabled>${riyoIcon("stop")} Stop</button>
                    <button type="button" id="bd-run-instant" class="riyo-primary">${riyoIcon("play")} Run</button>
                </div>
            </div>
            <div id="bd-box-natural" hidden>
                <label class="riyo-label">Session limit (hours)<input id="bd-hours-n" type="number" min="1" max="100000" step="1" value="1000"></label>
                <label class="riyo-label">Game pool size<input id="bd-pool-n" type="number" min="1" max="20000" step="1" value="250"></label>
                <div class="riyo-options"><label class="riyo-check"><input type="checkbox" id="bd-wobble-n" checked> ±3% time wobble</label></div>
                <progress id="bd-progress-n" value="0" max="1"></progress>
                <div id="bd-status-n" class="riyo-status" role="status">Ready. Desktop app required.</div>
                <div class="riyo-row">
                    <button type="button" id="bd-stop-n" class="riyo-danger" disabled>${riyoIcon("stop")} Stop</button>
                    <button type="button" id="bd-start-n" class="riyo-primary">${riyoIcon("play")} Start</button>
                </div>
            </div>
            <div class="riyo-status"><b>HypeSquad</b> — real membership, reversible.</div>
            <label class="riyo-label">House
                <select id="bd-house" style="font:inherit;color:var(--riyo-text);background:#ffffff06;border:1px solid var(--riyo-line);border-radius:10px;padding:9px 11px;min-height:38px">
                    <option value="1">1 · Bravery</option>
                    <option value="2">2 · Brilliance</option>
                    <option value="3">3 · Balance</option>
                </select>
            </label>
            <div id="bd-status-hype" class="riyo-status" role="status">Not checked.</div>
            <div class="riyo-row">
                <button type="button" id="bd-leave">${riyoIcon("close")} Leave</button>
                <button type="button" id="bd-join" class="riyo-primary">${riyoIcon("play")} Join</button>
            </div>
        `;
        document.body.appendChild(panel);
        const $ = id => panel.querySelector("#" + id);
        const statusI = $("bd-status-instant"), statusN = $("bd-status-n"), statusH = $("bd-status-hype");
        const boxI = $("bd-box-instant"), boxN = $("bd-box-natural");

        let gen = 0, natural = null, naturalTimer = null;
        const stopAll = () => {
            gen++;
            instant.stopFlag = true;
            if (window[LOCK]?.stop) { try { window[LOCK].stop(); } catch { /* ignore */ } }
            clearTimeout(naturalTimer);
            natural = null;
        };
        window.addEventListener("pagehide", stopAll);
        panel.__stop = () => { stopAll(); window.removeEventListener("pagehide", stopAll); };
        $("bd-close").addEventListener("click", () => { panel.__stop(); panel.remove(); });
        $("bd-mode-instant").addEventListener("change", () => { boxI.hidden = false; boxN.hidden = true; });
        $("bd-mode-natural").addEventListener("change", () => { boxI.hidden = true; boxN.hidden = false; });

        // instant run
        $("bd-run-instant").addEventListener("click", async () => {
            const id = ++gen;
            instant.stopFlag = false;
            $("bd-run-instant").disabled = true;
            $("bd-stop-instant").disabled = false;
            const progress = $("bd-progress-instant");
            try {
                const hours = clampNumber($("bd-hours").value, 0, 100000, 1);
                const maxGames = clampInt($("bd-maxgames").value, 0, 20000, 0);
                const streamHours = clampNumber($("bd-streamhours").value, 0, 100000, 0);
                const guild = $("bd-guild").value.trim(), channel = $("bd-channel").value.trim();
                if (streamHours > 0) {
                    if (!guild || !channel) throw new Error("Guild + voice channel required for stream.");
                    lsSet(LS_GUILD, guild); lsSet(LS_CHANNEL, channel);
                }
                const token = await ensureAuth(t => { if (id === gen) statusI.textContent = t; });
                if (id !== gen) return;
                const hb = crypto.randomUUID(), sig = crypto.randomUUID(), seq = { n: 1 };
                // games
                if (hours > 0) {
                    statusI.textContent = "Loading game catalog…";
                    const raw = await (await fetch(GAMES_URL, { cache: "no-store" })).json();
                    const seen = new Set(), games = [];
                    for (const g of (Array.isArray(raw) ? raw : [])) {
                        const gid = String(g?.id || "");
                        if (!/^\d+$/.test(gid) || seen.has(gid)) continue;
                        const exe = (g.executables || []).find(e => e?.os === "win32" && e.name);
                        if (!exe) continue;
                        seen.add(gid);
                        games.push({ id: gid, name: g.name || "Unknown", exe: exe.name });
                    }
                    const list = maxGames > 0 ? games.slice(0, maxGames) : games;
                    const dur = Math.floor(hours * 3600 * 1000);
                    progress.max = list.length; progress.value = 0;
                    let ok = 0;
                    for (let i = 0; i < list.length; i += 50) {
                        if (id !== gen || instant.stopFlag) throw new Error("Stopped.");
                        const chunk = list.slice(i, i + 50);
                        const res = await postScience(token, buildGameEvents(chunk, dur, hb, sig, seq));
                        if (id !== gen || instant.stopFlag) throw new Error("Stopped.");
                        if (res.status === 204) ok += chunk.length;
                        else if (res.status === 401 || res.status === 403) throw new Error("Rejected: HTTP " + res.status);
                        progress.value = Math.min(i + 50, list.length);
                        statusI.textContent = `Games ${Math.min(i + 50, list.length)}/${list.length} · ok ${ok}`;
                        await sleep(1000);
                    }
                    statusI.textContent = `Games done: ${ok}/${list.length}.`;
                }
                // stream
                if (streamHours > 0 && id === gen && !instant.stopFlag) {
                    statusI.textContent = "Sending stream session…";
                    const dur = Math.floor(streamHours * 3600 * 1000);
                    const res = await postScience(token, buildStreamEvents(guild, channel, dur, hb, sig, seq));
                    if (res.status !== 204) throw new Error("Stream rejected: HTTP " + res.status);
                    statusI.textContent += ` Stream ${streamHours}h claimed.`;
                }
                if (id === gen && !instant.stopFlag) statusI.textContent += " All done.";
            } catch (error) {
                if (id === gen) statusI.textContent = error?.message || String(error);
            } finally {
                if (id === gen) { $("bd-run-instant").disabled = false; $("bd-stop-instant").disabled = true; }
            }
        });
        $("bd-stop-instant").addEventListener("click", () => { instant.stopFlag = true; });

        // natural run
        $("bd-start-n").addEventListener("click", async () => {
            if (natural) return;
            $("bd-start-n").disabled = true; $("bd-stop-n").disabled = false;
            const progress = $("bd-progress-n");
            try {
                const config = {
                    totalHours: clampNumber($("bd-hours-n").value, 1, 100000, 1000),
                    titles: clampInt($("bd-pool-n").value, 1, 20000, 250),
                    wobble: $("bd-wobble-n").checked
                };
                statusN.textContent = "Loading Discord game catalog…";
                const raw = await (await fetch(GAMES_URL, { cache: "no-store" })).json();
                const games = (Array.isArray(raw) ? raw : []).filter(g => g?.id && executableFor(g));
                if (!games.length) throw new Error("No usable detectable games were found.");
                const selected = shuffle(games).slice(0, Math.min(config.titles, games.length));
                progress.max = selected.length; progress.value = 0;
                natural = createPresence(selected, config, (game, shown, nextAt) => {
                    progress.value = shown;
                    statusN.textContent = `Active: ${game.name} · ${shown}/${selected.length} · next ${new Date(nextAt).toLocaleTimeString()}`;
                }, message => {
                    natural = null;
                    statusN.textContent = message;
                    $("bd-start-n").disabled = false; $("bd-stop-n").disabled = true;
                }, error => { statusN.textContent = error?.message || String(error); });
                if (!natural) { $("bd-start-n").disabled = false; $("bd-stop-n").disabled = true; }
            } catch (error) {
                statusN.textContent = error?.message || String(error);
                $("bd-start-n").disabled = false; $("bd-stop-n").disabled = true;
            }
        });
        $("bd-stop-n").addEventListener("click", () => { try { natural?.stop(); } catch { /* ignore */ } natural = null; });

        // hypesquad
        const hype = async join => {
            try {
                const api = findApi();
                const house = Number($("bd-house").value);
                if (join) {
                    await api.post({ url: "/hypesquad/online", body: { house_id: house } });
                    statusH.textContent = `Joined ${HOUSES[house]}. Refresh profile to check.`;
                } else {
                    await api.del({ url: "/hypesquad/online" });
                    statusH.textContent = "Left HypeSquad.";
                }
            } catch (error) { statusH.textContent = error?.message || String(error); }
        };
        $("bd-join").addEventListener("click", () => hype(true));
        $("bd-leave").addEventListener("click", () => hype(false));
    });
})();
