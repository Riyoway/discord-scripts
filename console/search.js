// search — find messages in the current channel and export matching messages or URLs.
(() => {
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
    box.style = "position:fixed;top:80px;right:20px;z-index:10000;width:340px;max-width:calc(100vw - 40px);max-height:calc(100vh - 100px);box-sizing:border-box;display:flex;flex-direction:column;gap:12px;padding:16px;background:#161616ee;backdrop-filter:blur(16px);border:1px solid #ffffff22;border-radius:10px;color:#ddd;box-shadow:0 8px 32px #0008;font:13px/1.5 system-ui,sans-serif";
    box.innerHTML = `
        <style>
            #discord-search-overlay button,#discord-search-overlay input{font:inherit;color:inherit;background:#252525;border:1px solid #444;border-radius:5px;padding:5px 8px}
            #discord-search-overlay button{cursor:pointer} #discord-search-overlay :focus-visible{outline:2px solid white;outline-offset:2px}
            #discord-search-overlay label{display:flex;align-items:center;gap:4px;font-size:11px}
            #discord-search-overlay input[type=checkbox]{accent-color:#ddd} #discord-search-overlay [hidden]{display:none!important}
            #search-results-list{overflow:auto;min-height:0;scrollbar-width:none} #search-results-list::-webkit-scrollbar{display:none}
            #search-results-list article{padding:8px;margin-bottom:8px;border:1px solid #ffffff15;border-radius:6px;overflow-wrap:anywhere}
            #search-results-list mark{background:#ddd;color:#111} #search-results-list p{margin:4px 0;white-space:pre-wrap}
        </style>
        <header id="search-drag-handle" style="display:flex;justify-content:space-between;align-items:center;cursor:move">
            <strong>Channel Message Finder</strong><button id="search-close-btn" aria-label="Close search">×</button>
        </header>
        <input id="search-query" aria-label="Search keyword or regular expression" placeholder="Search keyword...">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
            <label><input type="checkbox" id="search-regex-opt">RegExp</label>
            <label><input type="checkbox" id="search-all-opt" checked>All messages</label>
            <label id="limit-container" hidden>Limit <input id="search-limit-opt" type="number" min="0" max="100" value="100" style="width:48px" title="0 searches cached messages"></label>
            <button id="search-submit-btn" style="margin-left:auto">Find</button>
        </div>
        <div id="search-stats" role="status" style="font-size:12px;overflow-wrap:anywhere">Open a channel, enter a keyword, then press Find.</div>
        <div id="search-export-container" hidden><button id="export-txt-btn">TXT</button> <button id="export-json-btn">JSON</button></div>
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
