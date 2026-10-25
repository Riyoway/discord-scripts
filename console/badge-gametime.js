// badge-gametime — rotating Discord desktop game presence.
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

    return riyoRunScript("badge-gametime", async () => {
        const OLD_ID = "riyo-badge-gametime-panel";
        const previous = document.getElementById(OLD_ID);

        if (previous) {
            previous.__stop?.();
            previous.remove();
            return;
        }

        const DEFAULTS = Object.freeze({
            totalHours: 1000,
            titles: 250,
            wobble: true
        });
        const LOCK = "__multiGamePresence";
        const MIN_CHANGE_MS = 23 * 60 * 1000;
        const MAX_CHANGE_MS = 38 * 60 * 1000;
        const RECENT_HISTORY_SIZE = 100;

        const GAMES_URL =
            "https://cdn.discordapp.com/detectables/games.json";

        const shuffle = input => {
            const a = [...input];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        const clampInt = (value, min, max, fallback) => {
            const n = Math.floor(Number(value));
            if (!Number.isFinite(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        };

        const clampNumber = (value, min, max, fallback) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        };

        const getName = game =>
            game?.name ||
            game?.names?.default ||
            game?.display_name ||
            `Game ${game?.id ?? "unknown"}`;

        const platform = /Linux/i.test(navigator.userAgent) ? "linux" : "win32";
        const executableFor = game => {
            const executables = Array.isArray(game?.executables) ? game.executables : [];
            return executables.find(exe => exe?.os === platform && exe.name)
                || executables.find(exe => exe?.os === "win32" && exe.name);
        };

        function createPresence(games, config, onChange, onStop, onError) {
            if (window[LOCK]?.stop) throw new Error("Another game presence session is running. Stop it with window.__multiGamePresence.stop().");
            let req = window.Vencord?.Webpack?.wreq;
            if (!req?.c && typeof webpackChunkdiscord_app !== "undefined") {
                webpackChunkdiscord_app.push([[Symbol("badge-gametime")], {}, incoming => {
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
                catch (error) { console.error("[badge-gametime] Cleanup notification failed:", error); }
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
                    console.log("[badge-gametime] Active:", current.name, "Next change in", (delay / 60000).toFixed(1), "min");
                    timer = setTimeout(next, delay);
                } catch (error) {
                    stop("Stopped after an activity error.");
                    onError(error);
                }
            };
            controller = { stop, next, games, history, get current() { return current?.name ?? null; }, get index() { return index; }, get totalGames() { return games.length; } };
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

        const panel = document.createElement("div");
        panel.id = OLD_ID;
        panel.className = "riyo-ui riyo-panel";

        panel.innerHTML = `
            ${riyoTheme}

            <header class="riyo-header">
                <strong class="riyo-title">
                    ${riyoIcon("clock")}
                    Discord Game Time &amp; Game Variety Badge
                </strong>

                <button
                    type="button"
                    class="riyo-close"
                    id="gt-close"
                    aria-label="Close"
                >
                    ${riyoIcon("close")}
                </button>
            </header>

            <label class="riyo-label">
                Session limit (hours)
                <input
                    id="gt-hours"
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    value="${DEFAULTS.totalHours}"
                >
            </label>

            <label class="riyo-label">
                Game pool size
                <input
                    id="gt-games"
                    type="number"
                    min="1"
                    max="20000"
                    step="1"
                    value="${DEFAULTS.titles}"
                >
            </label>

            <div class="riyo-options">
                <label class="riyo-check">
                    <input
                        id="gt-wobble"
                        type="checkbox"
                        ${DEFAULTS.wobble ? "checked" : ""}
                    >
                    ±3% time wobble
                </label>
            </div>

            <div
                id="gt-summary"
                class="riyo-status"
            >
                Switches every 23–38 minutes.
            </div>

            <progress
                id="gt-progress"
                aria-label="Different games shown during this session"
                value="0"
                max="1"
            ></progress>

            <div
                id="gt-status"
                class="riyo-status"
                role="status"
            >
                Ready.
            </div>

            <div class="riyo-row">
                <button
                    type="button"
                    id="gt-stop"
                    class="riyo-danger"
                    disabled
                >
                    ${riyoIcon("stop")}
                    Stop
                </button>

                <button
                    type="button"
                    id="gt-start"
                    class="riyo-primary"
                >
                    ${riyoIcon("play")}
                    Start
                </button>
            </div>
        `;

        document.body.appendChild(panel);

        const $ = selector => panel.querySelector(selector);

        const hoursInput = $("#gt-hours");
        const gamesInput = $("#gt-games");
        const wobbleInput = $("#gt-wobble");

        const summary = $("#gt-summary");
        const progress = $("#gt-progress");
        const status = $("#gt-status");

        const startButton = $("#gt-start");
        const stopButton = $("#gt-stop");
        const closeButton = $("#gt-close");

        let running = false;
        let generation = 0;
        let loading = null;
        let presence = null;

        const readConfig = () => ({
            totalHours: clampNumber(
                hoursInput.value,
                1,
                100000,
                DEFAULTS.totalHours
            ),

            titles: clampInt(
                gamesInput.value,
                1,
                20000,
                DEFAULTS.titles
            ),

            wobble: wobbleInput.checked
        });

        const updateSummary = () => {
            const config = readConfig();

            summary.textContent =
                `${config.titles.toLocaleString()} game pool ` +
                `• ${config.totalHours.toLocaleString()} h session limit ` +
                `• 23–38 min per game`;
        };

        [
            hoursInput,
            gamesInput,
            wobbleInput
        ].forEach(node =>
            node.addEventListener("input", updateSummary)
        );

        const setRunning = value => {
            running = value;

            startButton.disabled = value;
            stopButton.disabled = !value;

            hoursInput.disabled = value;
            gamesInput.disabled = value;
            wobbleInput.disabled = value;
        };

        const stop = () => {
            generation++;
            loading?.abort();
            loading = null;
            const session = presence;
            presence = null;
            session?.stop();
            setRunning(false);
            status.textContent = "Stopped.";
        };

        window.addEventListener("pagehide", stop);
        panel.__stop = () => {
            stop();
            window.removeEventListener("pagehide", stop);
        };

        closeButton.addEventListener("click", () => {
            panel.__stop();
            panel.remove();
        });

        stopButton.addEventListener("click", stop);

        startButton.addEventListener("click", async () => {
            if (running) return;

            const id = ++generation;
            const controller = new AbortController();
            loading = controller;
            setRunning(true);

            progress.value = 0;
            progress.max = 1;

            try {
                const config = readConfig();

                status.textContent =
                    "Loading Discord game catalog…";

                const response = await fetch(GAMES_URL, {
                    cache: "no-store",
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(
                        `Catalog request failed: HTTP ${response.status}`
                    );
                }

                const raw = await response.json();
                if (id !== generation) return;

                const games = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.games)
                    ? raw.games
                    : [];

                const seen = new Set();
                const compatible = games.filter(game => {
                    if (!game?.id || !executableFor(game) || seen.has(String(game.id))) return false;
                    seen.add(String(game.id));
                    return true;
                });

                if (!compatible.length) {
                    throw new Error(
                        "No usable detectable games were found."
                    );
                }

                const count = Math.min(
                    config.titles,
                    compatible.length
                );

                const selected = shuffle(compatible).slice(0, count);

                progress.max = selected.length;

                summary.textContent =
                    `${selected.length.toLocaleString()} game pool ` +
                    `• ${config.totalHours.toLocaleString()} h session limit ` +
                    `• 23–38 min per game`;
                presence = createPresence(selected, config, (game, shown, nextAt) => {
                    progress.value = shown;
                    status.textContent = `Active: ${game.name} • ${shown}/${selected.length} games shown • next change ${new Date(nextAt).toLocaleTimeString()}`;
                }, message => {
                    if (id !== generation) return;
                    presence = null;
                    status.textContent = message;
                    setRunning(false);
                }, error => {
                    console.error("[badge-gametime]", error);
                    if (id === generation) status.textContent = error?.message || String(error);
                });
            } catch (error) {
                if (id === generation) {
                    console.error("[badge-gametime]", error);
                    status.textContent = error?.message || String(error);
                }
            } finally {
                if (id === generation) {
                    loading = null;
                    if (!presence) setRunning(false);
                }
            }
        });

        updateSummary();
    });
})();
