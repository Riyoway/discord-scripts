// export — save the currently-open DM/channel as a self-contained, Discord-looking HTML file.
// Uses your token to page the channel's history, then renders it. Paging history is
// self-bot behaviour: keep the message cap low. Attachment/avatar URLs are referenced,
// and Discord's CDN links expire after ~24h; tick "Inline images" for a file you can share.
(() => {
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
    box.style = "position:fixed;top:20px;right:20px;z-index:10000;width:280px;background:#1e1f22;color:#dbdee1;border:1px solid rgba(255,255,255,.1);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);padding:16px;font-family:'gg sans','Noto Sans',sans-serif;font-size:13px";
    box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;font-weight:bold;color:#fff;margin-bottom:10px">
            <span>Export chat</span><span id="dx-x" style="cursor:pointer;color:#b5bac1">&times;</span>
        </div>
        <label style="display:block;margin-bottom:8px">Max messages
            <input id="dx-cap" type="number" value="1000" min="1" style="width:100%;box-sizing:border-box;background:#111214;color:#dbdee1;border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:6px;margin-top:4px"></label>
        <label style="display:flex;gap:6px;align-items:center;margin-bottom:10px;font-size:12px;color:#b5bac1"><input id="dx-inline" type="checkbox"> Inline images (shareable, slower)</label>
        <button id="dx-go" style="width:100%;padding:8px;border:0;border-radius:4px;background:#5865f2;color:#fff;font-weight:bold;cursor:pointer">Export</button>
        <div id="dx-status" style="margin-top:10px;font-size:11px;color:#80848e">Ready.</div>`;
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
})();
