// media — download the images and videos on the current page.
// Overlay with three actions: All / Images only / Videos only. Pure DOM, so it
// works on any site; cross-origin downloads depend on that site's CSP/CORS
// (on Discord, media.discordapp.net and cdn.discordapp.com are allowed).
(() => {
    const OLD = document.getElementById("media-dl");
    if (OLD) { OLD.remove(); return; }   // toggle off

    const clean = (u) => {
        try {
            const url = new URL(u, location.href);
            // Discord CDN: drop resize/format params so we grab the original.
            if (/(^|\.)discordapp\.(net|com)$/.test(url.hostname)) {
                ["width", "height", "format", "quality"].forEach((k) => url.searchParams.delete(k));
            }
            return url.href;
        } catch { return null; }
    };

    const collect = () => {
        const imgs = new Set(), vids = new Set();
        document.querySelectorAll("img").forEach((el) => {
            const s = el.currentSrc || el.src;
            if (s && !s.startsWith("data:")) { const c = clean(s); if (c) imgs.add(c); }
        });
        document.querySelectorAll("video").forEach((el) => {
            const s = el.currentSrc || el.src || el.querySelector("source")?.src;
            if (s && !s.startsWith("blob:") && !s.startsWith("data:")) { const c = clean(s); if (c) vids.add(c); }
        });
        return { imgs: [...imgs], vids: [...vids] };
    };

    const fileName = (url, i) => {
        try {
            const base = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
            return base && base.includes(".") ? base : `media-${i + 1}`;
        } catch { return `media-${i + 1}`; }
    };

    const grab = async (urls, status) => {
        if (!urls.length) { status("Nothing to download."); return; }
        let ok = 0;
        for (let i = 0; i < urls.length; i++) {
            status(`Downloading ${i + 1}/${urls.length}...`);
            try {
                const blob = await (await fetch(urls[i])).blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = fileName(urls[i], i);
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 10000);
                ok++;
            } catch {
                window.open(urls[i], "_blank");   // CORS/CSP fallback: open so it can be saved by hand
            }
            await new Promise((r) => setTimeout(r, 300));   // let the browser queue each save
        }
        status(`Done: ${ok}/${urls.length} saved${ok < urls.length ? " (rest opened in tabs)" : ""}.`);
    };

    const { imgs, vids } = collect();

    const box = document.createElement("div");
    box.id = "media-dl";
    box.style = "position:fixed;top:20px;right:20px;z-index:10000;width:260px;background:#1e1f22;color:#dbdee1;border:1px solid rgba(255,255,255,.1);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);padding:16px;font-family:'gg sans','Noto Sans',sans-serif;font-size:13px";
    box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;font-weight:bold;color:#fff;margin-bottom:10px">
            <span>Media downloader</span><span id="md-x" style="cursor:pointer;color:#b5bac1">&times;</span>
        </div>
        <div style="font-size:12px;color:#b5bac1;margin-bottom:12px">${imgs.length} image(s), ${vids.length} video(s) found.</div>
        <button id="md-all" style="width:100%;padding:8px;margin-bottom:6px;border:0;border-radius:4px;background:#5865f2;color:#fff;font-weight:bold;cursor:pointer">Download all</button>
        <div style="display:flex;gap:6px">
            <button id="md-img" style="flex:1;padding:8px;border:0;border-radius:4px;background:#4f545c;color:#fff;cursor:pointer">Images</button>
            <button id="md-vid" style="flex:1;padding:8px;border:0;border-radius:4px;background:#4f545c;color:#fff;cursor:pointer">Videos</button>
        </div>
        <div id="md-status" style="margin-top:10px;font-size:11px;color:#80848e">Ready.</div>`;
    document.body.appendChild(box);

    const status = (t) => { box.querySelector("#md-status").textContent = t; };
    box.querySelector("#md-x").onclick = () => box.remove();
    box.querySelector("#md-all").onclick = () => grab([...imgs, ...vids], status);
    box.querySelector("#md-img").onclick = () => grab(imgs, status);
    box.querySelector("#md-vid").onclick = () => grab(vids, status);
})();
