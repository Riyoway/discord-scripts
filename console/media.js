// media — fetch media in the background, then save one ZIP.
// No tab-opening fallback: blocked URLs are reported and skipped.
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
    // Shared channel parsing and authenticated history access for Search and Media.
    const riyoChannelId = (input, current) => {
        const value = input.trim();
        if (!value && /^\d{1,20}$/.test(current || '')) return current;
        const id = value.match(/^(\d{15,20})$/)?.[1] || value.match(/^<#(\d{15,20})>$/)?.[1]
            || value.match(/^https?:\/\/(?:[a-z0-9-]+\.)?discord(?:app)?\.com\/channels\/(?:@me|\d+)\/(\d{15,20})(?:\/\d{15,20})?\/?(?:[?#].*)?$/i)?.[1];
        if (!id) throw new Error('Enter a channel ID or Discord channel/message link. Leave blank for the current channel.');
        return id;
    };
    const riyoChannelModules = () => {
        if (typeof webpackChunkdiscord_app === 'undefined') throw new Error('Run this script inside Discord after it has loaded.');
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
        const store = method => find(value => typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(value), method)?.value === 'function');
        return {
            channels: store('getChannelId'), messages: store('getMessages'),
            api: find(value => ['get', 'post', 'put', 'patch'].every(method => typeof Object.getOwnPropertyDescriptor(value, method)?.value === 'function')
                && /^bound /.test(value.get.name) && /^bound /.test(value.post.name))
        };
    };
    const riyoDelay = (ms, signal) => new Promise((resolve, reject) => {
        signal.throwIfAborted();
        const cancel = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
        signal.addEventListener('abort', cancel, { once: true });
    });
    const riyoWait = (promise, signal) => new Promise((resolve, reject) => {
        const finish = (callback, value) => { clearTimeout(timer); signal.removeEventListener('abort', cancel); callback(value); };
        const cancel = () => finish(reject, signal.reason);
        const timer = setTimeout(() => finish(reject, new Error('Request timed out after 30 seconds.')), 30000);
        signal.addEventListener('abort', cancel, { once: true });
        Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
        if (signal.aborted) cancel();
    });
    const riyoFetchMessages = async (api, url, signal, report) => {
        if (!api) throw new Error("Discord's HTTP client was not found. Reload Discord and try again.");
        for (let attempt = 0; ; attempt++) {
            signal.throwIfAborted();
            try {
                const response = await riyoWait(api.get({ url, timeout: 30000 }), signal);
                signal.throwIfAborted();
                if (response?.ok === false || response?.status >= 400) throw response;
                if (!Array.isArray(response?.body)) throw new Error('Unexpected message response.');
                return response.body;
            } catch (error) {
                signal.throwIfAborted();
                if (error?.status !== 429 || attempt >= 3) throw new Error(error?.message || error?.body?.message || 'HTTP ' + (error?.status ?? 'request failed'));
                const seconds = Number(error.body?.retry_after ?? error.headers?.get?.('Retry-After') ?? 5);
                report('Rate limited. Waiting to retry...');
                await riyoDelay((Number.isFinite(seconds) && seconds >= 0 ? seconds : 5) * 1000, signal);
            }
        }
    };
    // END SHARED UI
    const OLD = document.getElementById("media-dl");
    if (OLD) { OLD.dispatchEvent(new Event("media-dl-close")); OLD.remove(); return; }

    const clean = (value) => {
        if (!value) return null;
        try {
            const url = new URL(value, location.href);
            if (!["http:", "https:"].includes(url.protocol)) return null;
            if (/(^|\.)discordapp\.(net|com)$/.test(url.hostname)) {
                ["width", "height", "format", "quality"].forEach((key) => url.searchParams.delete(key));
            }
            return url.href;
        } catch { return null; }
    };
    const { channels, api } = riyoChannelModules();
    const extensions = {
        "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
        "image/avif": "avif", "image/svg+xml": "svg", "image/bmp": "bmp",
        "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
        "video/ogg": "ogv", "video/x-matroska": "mkv", "video/x-msvideo": "avi"
    };
    const fileName = (url, index, response, signature = new Uint8Array()) => {
        let base = "";
        const disposition = response?.headers.get("Content-Disposition") || "";
        const encoded = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
        try { if (encoded) base = decodeURIComponent(encoded[1].trim()); } catch {}
        if (!base) base = disposition.match(/filename\s*=\s*(?:"([^"]*)"|([^;]*))/i)?.slice(1).find(value => value !== undefined)?.trim() || "";
        if (!base) {
            try {
                const source = new URL(response?.url || url);
                base = source.searchParams.get("filename") || source.searchParams.get("file_name") || decodeURIComponent(source.pathname.split("/").pop() || "");
            } catch {}
        }
        base = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "");
        const type = response?.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
        let extension = extensions[type];
        // Some CDNs return application/octet-stream; inspect common image/video signatures.
        const ascii = (start, end) => String.fromCharCode(...signature.subarray(start, end));
        if (!extension) {
            if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) extension = "jpg";
            else if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") extension = "png";
            else if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) extension = "gif";
            else if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") extension = "webp";
            else if (ascii(4, 8) === "ftyp") extension = ["avif", "avis"].includes(ascii(8, 12)) ? "avif" : ascii(8, 12) === "qt  " ? "mov" : "mp4";
        }
        const suffix = base.match(/\.([a-z0-9]{1,10})$/i)?.[1];
        if (extension && suffix?.toLowerCase() !== extension && !(extension === "jpg" && suffix?.toLowerCase() === "jpeg")) {
            if (suffix && Object.values(extensions).includes(suffix.toLowerCase())) base = base.slice(0, -suffix.length - 1);
            base = Array.from(base || "media").slice(0, 170).join("") + "." + extension;
        } else if (!suffix && response) base = Array.from(base || "media").slice(0, 170).join("") + ".bin";
        else {
            const ending = suffix ? "." + suffix : "";
            base = Array.from(ending ? base.slice(0, -ending.length) : base).slice(0, 170).join("") + ending;
        }
        return `${String(index + 1).padStart(4, "0")}-${base || "media"}`;
    };
    const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
        for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
        return n >>> 0;
    });

    // ponytail: stored ZIP in memory, capped at 512 MiB; use streaming file writes for larger batches.
    const batchLimit = 512 * 1024 * 1024;
    const makeZip = (files) => {
        const parts = [], directory = [];
        let offset = 0, directorySize = 0;
        const now = new Date();
        const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        for (const file of files) {
            const name = new TextEncoder().encode(file.name);
            const local = new Uint8Array(30 + name.length);
            const l = new DataView(local.buffer);
            l.setUint32(0, 0x04034b50, true);
            l.setUint16(4, 20, true);
            l.setUint16(6, 0x0800, true); // UTF-8; method 0 (stored).
            l.setUint16(10, time, true);
            l.setUint16(12, date, true);
            l.setUint32(14, file.crc, true);
            l.setUint32(18, file.blob.size, true);
            l.setUint32(22, file.blob.size, true);
            l.setUint16(26, name.length, true);
            local.set(name, 30);

            const central = new Uint8Array(46 + name.length);
            const c = new DataView(central.buffer);
            c.setUint32(0, 0x02014b50, true);
            c.setUint16(4, 20, true);
            c.setUint16(6, 20, true);
            c.setUint16(8, 0x0800, true);
            c.setUint16(12, time, true);
            c.setUint16(14, date, true);
            c.setUint32(16, file.crc, true);
            c.setUint32(20, file.blob.size, true);
            c.setUint32(24, file.blob.size, true);
            c.setUint16(28, name.length, true);
            c.setUint32(42, offset, true);
            central.set(name, 46);
            parts.push(local, file.blob);
            directory.push(central);
            offset += local.length + file.blob.size;
            directorySize += central.length;
        }
        const end = new Uint8Array(22);
        const e = new DataView(end.buffer);
        e.setUint32(0, 0x06054b50, true);
        e.setUint16(8, files.length, true);
        e.setUint16(10, files.length, true);
        e.setUint32(12, directorySize, true);
        e.setUint32(16, offset, true);
        return new Blob([...parts, ...directory, end], { type: "application/zip" });
    };

    const box = document.createElement("div");
    box.id = "media-dl";
    box.className = "riyo-ui riyo-panel";
    box.innerHTML = `
        ${riyoTheme}
        <header class="riyo-header">
            <strong class="riyo-title">${riyoIcon('download')}Media downloader</strong>
            <button id="md-x" class="riyo-close" aria-label="Close downloader">${riyoIcon('close')}</button>
        </header>
        <label class="riyo-label">Channel<input id="md-channel" placeholder="Channel ID or link (blank = current)"></label>
        <label class="riyo-label">Max messages<input id="md-limit" type="number" min="0" value="1000"></label>
        <div class="riyo-muted">Scan channel history. Use 0 for all messages.</div>
        <button id="md-all" class="riyo-primary">${riyoIcon('download')}Download all</button>
        <div class="riyo-row">
            <button id="md-img">${riyoIcon('image')}Images</button>
            <button id="md-vid">${riyoIcon('video')}Videos</button>
        </div>
        <progress id="md-progress" max="1" value="0" aria-label="Download progress" hidden></progress>
        <div id="md-status" class="riyo-status" role="status">Choose media to download.</div>
        <button id="md-stop" class="riyo-danger" hidden>${riyoIcon('stop')}Stop</button>
        <button id="md-save" class="riyo-primary" hidden>${riyoIcon('download')}Save ZIP</button>`;
    document.body.appendChild(box);

    const status = box.querySelector("#md-status");
    const progress = box.querySelector("#md-progress");
    const stopButton = box.querySelector("#md-stop");
    const saveButton = box.querySelector("#md-save");
    const buttons = ["#md-all", "#md-img", "#md-vid"].map((id) => box.querySelector(id));
    const target = box.querySelector('#md-channel'), limit = box.querySelector('#md-limit');
    let controller = null, archive = null, archiveUrl = null;
    const releaseArchive = () => {
        if (archiveUrl) URL.revokeObjectURL(archiveUrl);
        archiveUrl = null;
        archive = null;
        saveButton.hidden = true;
    };
    const stop = () => {
        if (controller) {
            controller.abort();
            stopButton.disabled = true;
            status.textContent = "Stopping...";
        }
    };
    const close = () => { stop(); releaseArchive(); box.remove(); };
    box.addEventListener("media-dl-close", close);
    box.querySelector("#md-x").onclick = close;
    stopButton.onclick = stop;
    saveButton.onclick = () => {
        if (!archive || controller) return;
        if (!archiveUrl) archiveUrl = URL.createObjectURL(archive);
        const link = document.createElement("a");
        link.href = archiveUrl;
        link.download = "media-" + new Date().toISOString().replace(/[:.]/g, "-") + ".zip";
        box.appendChild(link);
        link.click();
        link.remove();
        status.textContent = "ZIP sent to your downloads.";
        saveButton.disabled = true;
        // Keep the object URL alive long enough for the browser to start saving.
        const savedUrl = archiveUrl;
        setTimeout(() => {
            URL.revokeObjectURL(savedUrl);
            if (archiveUrl === savedUrl) { archiveUrl = null; archive = null; }
        }, 60000);
    };

    const grab = async (kind) => {
        if (controller) return;
        let channelId, maximum;
        try {
            channelId = riyoChannelId(target.value, channels?.getChannelId() || location.pathname?.match(/\/channels\/(?:@me|\d+)\/(\d+)/)?.[1]);
            maximum = Number(limit.value);
            if (!Number.isSafeInteger(maximum) || maximum < 0) throw new Error('Max messages must be a non-negative integer.');
            if (!api) throw new Error("Discord's HTTP client was not found. Reload Discord and try again.");
        } catch (error) { status.textContent = error.message; return; }
        releaseArchive();
        controller = new AbortController();
        const signal = controller.signal;
        const files = [];
        let bytes = 0, failed = 0;
        buttons.forEach((button) => { button.disabled = true; });
        target.disabled = limit.disabled = true;
        stopButton.hidden = false;
        stopButton.disabled = false;
        saveButton.disabled = false;
        progress.hidden = false;
        progress.removeAttribute('value');
        try {
            const urls = [], seenUrls = new Set(), seenMessages = new Set();
            const add = (url, type) => {
                if (kind !== 'all' && kind !== type) return;
                const value = clean(url);
                if (value && !seenUrls.has(value)) { seenUrls.add(value); urls.push(value); }
                if (urls.length > 65535) throw new Error('Too many files. Choose a smaller message limit.');
            };
            let before = null, scanned = 0;
            status.textContent = `Scanning channel ${channelId}...`;
            do {
                const count = maximum ? Math.min(100, maximum - scanned) : 100;
                const batch = await riyoFetchMessages(api, `/channels/${channelId}/messages?limit=${count}${before ? '&before=' + before : ''}`, signal,
                    text => { status.textContent = text; });
                for (const message of batch.slice(0, count)) {
                    if (!message?.id || seenMessages.has(message.id)) continue;
                    seenMessages.add(message.id);
                    scanned++;
                    for (const attachment of message.attachments || []) {
                        const type = attachment.content_type || '';
                        if (type.startsWith('image/') || /\.(?:png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(attachment.filename || '')) add(attachment.url, 'image');
                        else if (type.startsWith('video/') || /\.(?:mp4|webm|mov|mkv|avi|ogv)$/i.test(attachment.filename || '')) add(attachment.url, 'video');
                    }
                    for (const embed of message.embeds || []) {
                        if (embed.video) add(embed.video.proxy_url || embed.video.url, 'video');
                        const image = embed.image || (!embed.video && embed.thumbnail);
                        if (image) add(image.proxy_url || image.url, 'image');
                    }
                }
                status.textContent = `Scanning channel ${channelId}: ${scanned} messages, ${urls.length} media files...`;
                if (batch.length < count || (maximum && scanned >= maximum)) break;
                const oldest = batch[batch.length - 1]?.id;
                if (!/^\d+$/.test(oldest || '') || (before && BigInt(oldest) >= BigInt(before))) throw new Error('History pagination did not advance.');
                before = oldest;
                await riyoDelay(500, signal);
            } while (true);
            signal.throwIfAborted();
            if (!urls.length) { status.textContent = 'No matching media found in this channel.'; return; }
            progress.max = urls.length;
            progress.value = 0;
            for (let i = 0; i < urls.length; i++) {
                signal.throwIfAborted();
                status.textContent = `Fetching ${i + 1}/${urls.length}: ${fileName(urls[i], i)}`;
                try {
                    const response = await fetch(urls[i], { signal });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    if (!response.body) throw new Error("No readable response.");
                    const reader = response.body.getReader();
                    const total = response.headers.get("Content-Encoding") ? 0 : Number(response.headers.get("Content-Length")) || 0;
                    const chunks = [];
                    let received = 0, crc = 0xffffffff;
                    try {
                        while (true) {
                            signal.throwIfAborted();
                            const { done, value } = await reader.read();
                            if (done) break;
                            bytes += value.byteLength;
                            received += value.byteLength;
                            if (bytes > batchLimit) throw new RangeError("Batch exceeds 512 MB. Choose a smaller batch.");
                            for (let j = 0; j < value.length; j++) crc = crcTable[(crc ^ value[j]) & 0xff] ^ (crc >>> 8);
                            chunks.push(value);
                            progress.value = i + (total > 0 ? Math.min(received / total, 0.99) : 0);
                            status.textContent = `Fetching ${i + 1}/${urls.length}: ${(received / 1048576).toFixed(1)} MB${total > 0 ? " / " + (total / 1048576).toFixed(1) + " MB" : ""}`;
                        }
                    } finally {
                        await reader.cancel().catch(() => {});
                        reader.releaseLock();
                    }
                    signal.throwIfAborted();
                    const blob = new Blob(chunks);
                    const signature = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
                    signal.throwIfAborted();
                    files.push({ name: fileName(urls[i], i, response, signature), blob, crc: (crc ^ 0xffffffff) >>> 0 });
                } catch (error) {
                    if (signal.aborted || error instanceof RangeError) throw error;
                    failed++;
                    console.warn("Media downloader: skipped", urls[i], error);
                }
                progress.value = i + 1;
            }
            signal.throwIfAborted();
            if (files.length) {
                archive = makeZip(files);
                saveButton.hidden = false;
                status.textContent = `Ready: ${files.length} file(s), ${(archive.size / 1048576).toFixed(1)} MB.${failed ? " " + failed + " failed (blocked or unavailable)." : ""} Click Save ZIP.`;
            } else {
                status.textContent = "No files fetched. The URLs may be blocked or unavailable.";
            }
        } catch (error) {
            status.textContent = signal.aborted ? "Stopped. No files were saved." : error.message;
        } finally {
            files.length = 0;
            controller = null;
            buttons.forEach((button) => { button.disabled = false; });
            target.disabled = limit.disabled = false;
            stopButton.hidden = true;
            if (!archive) progress.hidden = true;
        }
    };
    buttons[0].onclick = () => grab('all');
    buttons[1].onclick = () => grab('image');
    buttons[2].onclick = () => grab('video');
})();
