// media — fetch media in the background, then save one ZIP.
// No tab-opening fallback: blocked URLs are reported and skipped.
(() => {
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
    const collect = (selector) => [...new Set(
        [...document.querySelectorAll(selector)]
            .map((el) => clean(el.currentSrc || el.src || el.querySelector("source")?.src))
            .filter(Boolean)
    )];
    const imgs = collect("img"), vids = collect("video");
    const fileName = (url, index) => {
        let base = "";
        try { base = decodeURIComponent(new URL(url).pathname.split("/").pop() || ""); } catch {}
        base = Array.from(base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")).slice(0, 180).join("");
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
    box.style = "position:fixed;top:20px;right:20px;z-index:10000;width:300px;max-width:calc(100vw - 40px);background:#161616;color:#ddd;border:1px solid #333;border-radius:10px;box-shadow:0 8px 32px #0008;padding:16px;font:13px/1.5 system-ui,sans-serif";
    box.innerHTML = `
        <style>
            #media-dl button{font:inherit;cursor:pointer;border:1px solid #444;border-radius:6px;padding:8px;background:#292929;color:#fff}
            #media-dl button:disabled{opacity:.45;cursor:default}
            #media-dl button:focus-visible{outline:2px solid #fff;outline-offset:2px}
            #media-dl progress{display:block;width:100%;height:8px;margin:12px 0;accent-color:#ddd}
            #media-dl [hidden]{display:none!important}
        </style>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px">
            <strong>Media downloader</strong><button id="md-x" aria-label="Close downloader" style="padding:2px 8px">&times;</button>
        </div>
        <div style="font-size:12px;color:#aaa;margin-bottom:12px">${imgs.length} image(s), ${vids.length} video(s) found.</div>
        <button id="md-all" style="width:100%;margin-bottom:6px">Download all</button>
        <div style="display:flex;gap:6px">
            <button id="md-img" style="flex:1">Images</button>
            <button id="md-vid" style="flex:1">Videos</button>
        </div>
        <progress id="md-progress" max="1" value="0" aria-label="Download progress" hidden></progress>
        <div id="md-status" role="status" style="margin-top:10px;font-size:12px;color:#bbb;overflow-wrap:anywhere">Fetch in the background, then save one ZIP.</div>
        <button id="md-stop" style="width:100%;margin-top:10px" hidden>Stop</button>
        <button id="md-save" style="width:100%;margin-top:10px;background:#ddd;color:#111" hidden>Save ZIP</button>`;
    document.body.appendChild(box);

    const status = box.querySelector("#md-status");
    const progress = box.querySelector("#md-progress");
    const stopButton = box.querySelector("#md-stop");
    const saveButton = box.querySelector("#md-save");
    const buttons = ["#md-all", "#md-img", "#md-vid"].map((id) => box.querySelector(id));
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

    const grab = async (urls) => {
        if (controller) return;
        if (!urls.length) { status.textContent = "Nothing to download."; return; }
        if (urls.length > 65535) { status.textContent = "Too many files. Choose a smaller batch."; return; }
        releaseArchive();
        controller = new AbortController();
        const signal = controller.signal;
        const files = [];
        let bytes = 0, failed = 0;
        buttons.forEach((button) => { button.disabled = true; });
        stopButton.hidden = false;
        stopButton.disabled = false;
        saveButton.disabled = false;
        progress.hidden = false;
        progress.max = urls.length;
        progress.value = 0;
        try {
            for (let i = 0; i < urls.length; i++) {
                signal.throwIfAborted();
                const name = fileName(urls[i], i);
                status.textContent = `Fetching ${i + 1}/${urls.length}: ${name}`;
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
                    files.push({ name, blob: new Blob(chunks), crc: (crc ^ 0xffffffff) >>> 0 });
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
            stopButton.hidden = true;
        }
    };
    buttons[0].onclick = () => grab([...new Set([...imgs, ...vids])]);
    buttons[1].onclick = () => grab(imgs);
    buttons[2].onclick = () => grab(vids);
})();
