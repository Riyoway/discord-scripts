// export — save the currently-open DM/channel as a self-contained, Discord-looking HTML file.
// Uses your token to page the channel's history, then renders it. Paging history is
// self-bot behaviour: keep the message cap low. Attachment/avatar URLs are referenced,
// and Discord's CDN links expire after ~24h; tick "Inline images" for a file you can share.
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
    return riyoRunScript('export', () => {
    const OLD = document.getElementById("dc-export");
    if (OLD) { OLD.remove(); return; }

    const channelId = location.pathname.split("/").pop();
    if (!/^\d+$/.test(channelId)) { alert("Open a DM or channel first."); return; }

    // Grab the token the same way the token script does.
    let token;
    const req = webpackChunkdiscord_app.push([[Symbol()], {}, (r) => r]);
    webpackChunkdiscord_app.pop();
    for (const m of Object.values(req.c)) {
        const ex = m?.exports;
        const getter = ex?.default?.getToken ?? ex?.getToken ?? ex?.Z?.getToken ?? ex?.A?.getToken;
        if (typeof getter === "function") { try { const t = getter(); if (t) { token = t; break; } } catch { } }
    }
    if (!token) { alert("Could not read your token."); return; }

    // esc() is used for both text and attribute values (it escapes quotes), so every
    // piece of message-controlled data below goes through it before hitting the file.
    const esc = (s) => (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const md = (t) => esc(t)
        .replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c}</pre>`)
        .replace(/`([^`\n]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
        .replace(/\*([^*]+)\*/g, "<i>$1</i>")
        .replace(/__([^_]+)__/g, "<u>$1</u>")
        .replace(/~~([^~]+)~~/g, "<s>$1</s>")
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>')
        .replace(/\n/g, "<br>");
    const avatar = (u) => u.avatar
        ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
        : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;
    const stamp = (iso) => new Date(iso).toLocaleString();
    const status = (t) => { const s = box.querySelector("#dx-status"); if (s) s.textContent = t; };

    const fetchAll = async (cap) => {
        const all = [];
        let before = null;
        while (all.length < cap) {
            const url = `/api/v9/channels/${channelId}/messages?limit=100${before ? "&before=" + before : ""}`;
            const res = await fetch(url, { headers: { Authorization: token } });
            if (res.status === 429) { const d = (await res.json()).retry_after ?? 1; status(`Rate limited, waiting ${Math.ceil(d)}s...`); await new Promise((r) => setTimeout(r, d * 1000)); continue; }
            if (!res.ok) throw new Error(`API ${res.status}`);
            const batch = await res.json();
            if (!batch.length) break;
            all.push(...batch);
            before = batch[batch.length - 1].id;
            status(`Fetched ${all.length} messages...`);
            await new Promise((r) => setTimeout(r, 700));   // be gentle on the rate limit
        }
        return all.slice(0, cap).reverse();   // oldest first
    };

    const toDataUri = async (url) => {
        try {
            const blob = await (await fetch(url)).blob();
            return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
        } catch { return url; }   // CORS/CSP fallback: keep the remote URL
    };
    // Resolve a raw URL to a safe attribute value (optionally inlined as a data URI).
    const srcFor = async (url, inline) => esc(inline ? await toDataUri(url) : url);

    const renderAttachment = async (a, inline) => {
        const t = a.content_type ?? "";
        if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(a.filename)) return `<img class="att" src="${await srcFor(a.url, inline)}" loading="lazy">`;
        if (t.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(a.filename)) return `<video class="att" src="${esc(a.url)}" controls></video>`;   // videos are never inlined
        return `<a class="file" href="${esc(a.url)}" target="_blank">📎 ${esc(a.filename)}</a>`;
    };
    const renderEmbed = async (e, inline) => {
        const img = e.image?.url ?? e.thumbnail?.url;
        return `<div class="embed">${e.title ? `<div class="etitle">${esc(e.title)}</div>` : ""}${e.description ? `<div>${md(e.description)}</div>` : ""}${img ? `<img class="att" src="${await srcFor(img, inline)}" loading="lazy">` : ""}</div>`;
    };

    const build = async (msgs, inline) => {
        const rows = [];
        for (let i = 0; i < msgs.length; i++) {
            const m = msgs[i];
            if (inline) status(`Inlining images ${i + 1}/${msgs.length}...`);
            let body = m.content ? `<div class="content">${md(m.content)}</div>` : "";
            for (const a of m.attachments ?? []) body += await renderAttachment(a, inline);
            for (const e of m.embeds ?? []) body += await renderEmbed(e, inline);
            const av = await srcFor(avatar(m.author), inline);
            const name = esc(m.author.global_name ?? m.author.username);
            rows.push(`<div class="msg"><img class="avatar" src="${av}"><div><span class="name">${name}</span><span class="time">${esc(stamp(m.timestamp))}</span>${body}</div></div>`);
        }
        return `<!doctype html><meta charset="utf-8"><title>Discord export ${esc(channelId)}</title><style>
body{background:#313338;color:#dbdee1;font-family:'gg sans','Noto Sans',sans-serif;margin:0;padding:24px}
.msg{display:flex;gap:16px;padding:6px 0}
.avatar{width:40px;height:40px;border-radius:50%;flex:none}
.name{font-weight:600;color:#f2f3f5}.time{font-size:12px;color:#949ba4;margin-left:6px}
.content{margin-top:2px;white-space:pre-wrap;word-break:break-word}
.att{max-width:400px;max-height:300px;border-radius:8px;display:block;margin-top:6px}
.file{color:#00a8fc;display:inline-block;margin-top:6px}
.embed{border-left:4px solid #5865f2;background:#2b2d31;padding:8px 12px;border-radius:4px;margin-top:6px;max-width:432px}
.etitle{font-weight:600;color:#f2f3f5;margin-bottom:4px}
pre{background:#2b2d31;padding:8px;border-radius:4px;overflow:auto}code{background:#2b2d31;padding:2px 4px;border-radius:3px}
a{color:#00a8fc}</style><h3>#${esc(channelId)} — ${msgs.length} messages</h3>${rows.join("")}`;
    };

    const box = document.createElement("div");
    box.id = "dc-export";
    box.className = "riyo-ui riyo-panel";
    box.innerHTML = `
        ${riyoTheme}
        <header class="riyo-header">
            <strong class="riyo-title">${riyoIcon('download')}Export chat</strong>
            <button id="dx-x" class="riyo-close" aria-label="Close export">${riyoIcon('close')}</button>
        </header>
        <label class="riyo-label">Max messages<input id="dx-cap" type="number" value="1000" min="1"></label>
        <label class="riyo-check"><input id="dx-inline" type="checkbox">Include images in the file</label>
        <div class="riyo-muted">Including images takes longer, but keeps them available offline.</div>
        <button id="dx-go" class="riyo-primary">${riyoIcon('download')}Export HTML</button>
        <div id="dx-status" class="riyo-status" role="status">Ready to export this channel.</div>`;
    document.body.appendChild(box);

    box.querySelector("#dx-x").onclick = () => box.remove();
    box.querySelector("#dx-go").onclick = async () => {
        const cap = Math.max(1, parseInt(box.querySelector("#dx-cap").value) || 1000);
        const inline = box.querySelector("#dx-inline").checked;
        const btn = box.querySelector("#dx-go"); btn.disabled = true;
        try {
            const msgs = await fetchAll(cap);
            if (!msgs.length) { status("No messages."); return; }
            status("Building HTML...");
            const html = await build(msgs, inline);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
            a.download = `discord-${channelId}.html`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);
            status(`Done: ${msgs.length} messages saved.`);
        } catch (e) {
            status("Error: " + e.message);
        } finally {
            btn.disabled = false;
        }
    };
    });
})();
