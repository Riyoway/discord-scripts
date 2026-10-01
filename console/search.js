// search — find messages in the current channel and export matching messages or URLs.
(() => {
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
    // END SHARED UI
    const old = document.getElementById("discord-search-overlay");
    if (old) { old.dispatchEvent(new Event("search-close")); old.remove(); }
    if (typeof webpackChunkdiscord_app === "undefined") throw new Error("Run search inside Discord after it has loaded.");
    let require;
    try { require = webpackChunkdiscord_app.push([[Symbol()], {}, value => value]); }
    finally { webpackChunkdiscord_app.pop(); }
    const find = predicate => {
        for (const module of Object.values(require.c)) {
            try {
                for (const value of [module.exports, ...Object.values(module.exports ?? {})]) {
                    if (value && predicate(value)) return value;
                }
            } catch { /* Lazy exports may not be initialized yet. */ }
        }
        return null;
    };
    // Lazy exports fabricate methods; use store prototypes and the HTTP client's bound methods.
    const store = method => find(value => typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(value), method)?.value === "function");
    const channels = store("getChannelId"), messages = store("getMessages");
    const api = find(value => ["get", "post", "put", "patch"].every(method => typeof Object.getOwnPropertyDescriptor(value, method)?.value === "function")
        && /^bound /.test(value.get.name) && /^bound /.test(value.post.name));
    const box = document.createElement("section");
    box.id = "discord-search-overlay";
    box.className = "riyo-ui riyo-panel";
    box.innerHTML = `
        ${riyoTheme}
        <header id="search-drag-handle" class="riyo-header" style="cursor:move">
            <strong class="riyo-title">${riyoIcon('search')}Message search</strong>
            <button id="search-close-btn" class="riyo-close" aria-label="Close search">${riyoIcon('close')}</button>
        </header>
        <input id="search-query" aria-label="Search keyword or regular expression" placeholder="Search keyword...">
        <div class="riyo-options">
            <label class="riyo-check"><input type="checkbox" id="search-regex-opt">RegExp</label>
            <label class="riyo-check"><input type="checkbox" id="search-all-opt" checked>All messages</label>
            <label id="limit-container" class="riyo-check" hidden>Limit <input id="search-limit-opt" type="number" min="0" max="100" value="100" style="width:64px" title="0 searches cached messages"></label>
        </div>
        <button id="search-submit-btn" class="riyo-primary">Find</button>
        <div id="search-stats" class="riyo-status" role="status">Open a channel, enter a keyword, then press Find.</div>
        <div id="search-export-container" class="riyo-row" hidden><button id="export-txt-btn">${riyoIcon('download')}Save TXT</button><button id="export-json-btn">${riyoIcon('download')}Save JSON</button></div>
        <div id="search-results-list"></div>`;
    document.body.appendChild(box);
    const node = id => box.querySelector("#" + id);
    const query = node("search-query"), regex = node("search-regex-opt"), all = node("search-all-opt");
    const limit = node("search-limit-opt"), button = node("search-submit-btn"), stats = node("search-stats");
    const results = node("search-results-list"), exports = node("search-export-container");
    let controller = null, matched = [], exportQuery = "", closed = false, drag = null;
    const move = event => {
        if (!drag) return;
        box.style.left = Math.max(10, Math.min(window.innerWidth - box.offsetWidth - 10, event.clientX - drag.x)) + "px";
        box.style.top = Math.max(10, Math.min(window.innerHeight - box.offsetHeight - 10, event.clientY - drag.y)) + "px";
        box.style.right = "auto";
    };
    const up = () => { drag = null; };
    node("search-drag-handle").onmousedown = event => {
        if (event.target.closest("button")) return;
        const rect = box.getBoundingClientRect();
        drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        event.preventDefault();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    const close = () => {
        closed = true;
        controller?.abort();
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        matched = [];
        box.remove();
    };
    box.addEventListener("search-close", close);
    node("search-close-btn").onclick = close;
    all.onchange = () => { node("limit-container").hidden = all.checked; };
    // Cancel local waits immediately; an already-sent internal HTTP request cannot be recalled.
    const wait = (promise, signal) => new Promise((resolve, reject) => {
        const finish = (callback, value) => { clearTimeout(timer); signal.removeEventListener("abort", cancel); callback(value); };
        const cancel = () => finish(reject, signal.reason);
        const timer = setTimeout(() => finish(reject, new Error("Request timed out after 30 seconds.")), 30000);
        signal.addEventListener("abort", cancel, { once: true });
        Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
        if (signal.aborted) cancel();
    });
    const delay = (ms, signal) => new Promise((resolve, reject) => {
        signal.throwIfAborted();
        const cancel = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
        signal.addEventListener("abort", cancel, { once: true });
    });
    const fetchBatch = async (url, signal) => {
        for (let attempt = 0; ; attempt++) {
            signal.throwIfAborted();
            try {
                const response = await wait(api.get({ url, timeout: 30000 }), signal);
                signal.throwIfAborted();
                if (response?.ok === false || response?.status >= 400) throw response;
                if (!Array.isArray(response?.body)) throw new Error("Unexpected message response.");
                return response.body;
            } catch (error) {
                signal.throwIfAborted();
                if (error?.status !== 429 || attempt >= 3) throw new Error(error?.message || error?.body?.message || "HTTP " + (error?.status ?? "request failed"));
                const seconds = Number(error.body?.retry_after ?? error.headers?.get?.("Retry-After") ?? 5);
                stats.textContent = "Rate limited. Waiting to retry...";
                await delay((Number.isFinite(seconds) && seconds >= 0 ? seconds : 5) * 1000, signal);
            }
        }
    };
    const render = pattern => {
        results.replaceChildren();
        // Keep the overlay responsive; exports include every match, including undisplayed results.
        for (const message of matched.slice(0, 200)) {
            const item = document.createElement("article"), heading = document.createElement("strong"), content = document.createElement("p");
            const date = new Date(message.timestamp);
            heading.textContent = (message.author?.global_name || message.author?.globalName || message.author?.username || "Unknown user") + (Number.isNaN(date.getTime()) ? "" : " · " + date.toLocaleString());
            const text = message.content || "";
            pattern.lastIndex = 0;
            let cursor = 0, match;
            while ((match = pattern.exec(text))) {
                if (!match[0].length) { pattern.lastIndex = match.index + 1; continue; }
                content.appendChild(document.createTextNode(text.slice(cursor, match.index)));
                const mark = document.createElement("mark");
                mark.textContent = match[0];
                content.appendChild(mark);
                cursor = match.index + match[0].length;
            }
            content.appendChild(document.createTextNode(text.slice(cursor)));
            item.appendChild(heading);
            item.appendChild(content);
            results.appendChild(item);
        }
        if (!matched.length) results.textContent = "No matching messages found.";
        exports.hidden = matched.length === 0;
    };
    const search = async () => {
        if (controller) { controller.abort(); return; }
        let pattern, channelId, maximum;
        try {
            if (!query.value.trim()) throw new Error("Enter a keyword or regular expression.");
            pattern = new RegExp(regex.checked ? query.value.trim() : query.value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), regex.checked ? "g" : "gi");
            channelId = channels?.getChannelId() || location.pathname.match(/\/channels\/(?:@me|\d+)\/(\d+)/)?.[1];
            if (!/^\d+$/.test(channelId || "")) throw new Error("Open a text channel or DM first.");
            maximum = Number(limit.value);
            if (!all.checked && (!Number.isInteger(maximum) || maximum < 0 || maximum > 100)) throw new Error("Limit must be 0–100. Use 0 for cached messages.");
            if ((all.checked || maximum > 0) && !api) throw new Error("Discord's HTTP client was not found. Reload Discord and try again.");
        } catch (error) { stats.textContent = error.message; return; }
        controller = new AbortController();
        const signal = controller.signal;
        matched = [];
        exportQuery = query.value.trim();
        exports.hidden = true;
        results.replaceChildren();
        button.textContent = "Cancel";
        button.className = "riyo-danger";
        const inputs = [query, regex, all, limit];
        inputs.forEach(input => { input.disabled = true; });
        let scanned = 0, before = null, outcome = "Finished";
        const seen = new Set();
        const consume = batch => {
            for (const message of batch) {
                if (!message?.id || seen.has(message.id)) continue;
                seen.add(message.id);
                scanned++;
                pattern.lastIndex = 0;
                if (pattern.test(message.content || "")) matched.push(message);
            }
            stats.textContent = `Scanning: ${scanned} messages, ${matched.length} matches...`;
        };
        try {
            if (!all.checked && maximum === 0) {
                if (!messages) throw new Error("Discord's message cache was not found.");
                const cached = messages.getMessages(channelId);
                consume(cached?.toArray?.() ?? cached?._array ?? (Array.isArray(cached) ? cached : []));
            } else {
                do {
                    const batch = await fetchBatch(`/channels/${channelId}/messages?limit=${all.checked ? 100 : maximum}${before ? "&before=" + before : ""}`, signal);
                    consume(batch);
                    if (!all.checked || batch.length < 100) break;
                    const oldest = batch[batch.length - 1]?.id;
                    if (!/^\d+$/.test(oldest || "") || (before && BigInt(oldest) >= BigInt(before))) throw new Error("History pagination did not advance.");
                    before = oldest;
                    await delay(500, signal);
                } while (true);
            }
        } catch (error) { outcome = signal.aborted ? "Stopped" : "Error: " + error.message; }
        finally {
            controller = null;
            if (!closed) {
                button.textContent = "Find";
                button.className = "riyo-primary";
                inputs.forEach(input => { input.disabled = false; });
                render(pattern);
                stats.textContent = `${outcome}. ${matched.length} matches; ${scanned} messages scanned.${matched.length > 200 ? " Showing the first 200; exports include all matches." : ""}`;
            }
        }
    };
    button.onclick = search;
    query.onkeydown = event => { if (event.key === "Enter") { event.preventDefault(); search(); } };
    const download = (content, extension, type) => {
        if (!matched.length || controller) return;
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "search-results-" + Array.from(exportQuery.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")).slice(0, 80).join("").replace(/[. ]+$/, "") + "." + extension;
        box.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
    node("export-txt-btn").onclick = () => {
        const urls = [...new Set(matched.flatMap(message => (message.content || "").match(/https?:\/\/[^\s<>]+/g) || []))];
        download(urls.length ? urls.join("\n") : matched.map(message => message.content || "").join("\n"), "txt", "text/plain;charset=utf-8");
    };
    node("export-json-btn").onclick = () => download(JSON.stringify(matched.map(({ id, timestamp, author, content }) => ({ id, timestamp, author: author ? { id: author.id, username: author.username, discriminator: author.discriminator } : null, content })), null, 2), "json", "application/json;charset=utf-8");
})();
