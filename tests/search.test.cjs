// Offline check: node tests/search.test.cjs. No account or network access.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../console/search.js"), "utf8");
const message = (id, content) => ({ id: String(id), content, timestamp: "2026-10-01T00:00:00Z", author: { username: "<script>user</script>", id: "1" } });
function harness(handler, cached = []) {
    class Element {
        constructor(tag) { this.tag = tag; this.children = []; this.nodes = new Map(); this.events = new Map(); this.style = {}; this.value = ""; }
        appendChild(child) { child.parent = this; this.children.push(child); }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
        querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new Element("input")); return this.nodes.get(selector); }
        addEventListener(type, fn) { this.events.set(type, fn); }
        dispatchEvent(event) { this.events.get(event.type)?.(); }
        replaceChildren() { this.children = []; this.textContent = ""; }
        getBoundingClientRect() { return { left: 20, top: 80 }; }
        click() { if (this.tag === "a") downloads.push({ name: this.download, blob: blobs.get(this.href) }); }
    }
    const body = new Element("body"), listeners = new Map(), downloads = [], blobs = new Map(), calls = [];
    const document = { body, createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }), getElementById: id => body.children.find(child => child.id === id) };
    const channels = Object.create({ getChannelId: () => "123" });
    const messages = Object.create({ getMessages: () => ({ toArray: () => cached }) });
    const api = { get: async options => { calls.push(options.url); return handler(options.url, calls.length); }, post() {}, put() {}, patch() {} };
    api.get = api.get.bind(api); api.post = api.post.bind(api);
    const lazy = new Proxy({}, { get: () => () => undefined });
    class LocalURL extends URL { static createObjectURL(blob) { const id = "blob:" + blobs.size; blobs.set(id, blob); return id; } static revokeObjectURL(id) { blobs.delete(id); } }
    const context = vm.createContext({
        document, URL: LocalURL, Blob, Event, AbortController, location: { pathname: "/channels/@me/123" },
        webpackChunkdiscord_app: { push: () => ({ c: { lazy: { exports: { default: lazy } }, channels: { exports: { A: channels } }, messages: { exports: { A: messages } }, api: { exports: { Bo: api } } } }), pop() {} },
        window: { innerWidth: 1200, innerHeight: 900, addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); }, removeEventListener(type, fn) { listeners.get(type)?.delete(fn); } },
        setTimeout: (fn, ms) => { const timer = setTimeout(fn, ms === 500 ? 0 : ms); if (ms >= 30000) timer.unref(); return timer; }, clearTimeout
    });
    const execute = () => vm.runInContext(source, context);
    execute();
    const box = document.getElementById("discord-search-overlay"), node = id => box.querySelector("#" + id);
    node("search-query").value = "needle";
    node("search-all-opt").checked = true;
    node("search-limit-opt").value = "100";
    return { box, node, calls, downloads, execute, document, listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0), run: () => node("search-submit-btn").onclick(), close: () => node("search-close-btn").onclick() };
}
(async () => {
    const first = Array.from({ length: 100 }, (_, i) => message(1000 - i, i === 0 ? "NEEDLE <img onerror=evil()> https://example.test/a" : "other"));
    const full = harness((url, count) => ({ ok: true, body: count === 1 ? first : [message(900, "needle https://example.test/a")] }));
    await full.run();
    assert.equal(full.calls.length, 2);
    assert.match(full.calls[1], /before=901/);
    assert.match(full.node("search-stats").textContent, /2 matches; 101 messages scanned/);
    assert.equal(full.node("search-results-list").children.length, 2);
    const rendered = full.node("search-results-list").children[0];
    assert.equal(rendered.children[0].textContent, "<script>user</script> · " + new Date(first[0].timestamp).toLocaleString());
    assert(rendered.children[1].children.some(child => child.textContent.includes("<img onerror=evil()>")));
    assert(rendered.children[1].children.some(child => child.tag === "mark" && child.textContent === "NEEDLE"));
    full.node("export-txt-btn").onclick();
    assert.equal(await full.downloads[0].blob.text(), "https://example.test/a");
    full.node("export-json-btn").onclick();
    assert.equal(JSON.parse(await full.downloads[1].blob.text()).length, 2);
    full.close(); assert.equal(full.listenerCount(), 0);

    const cache = harness(() => { throw Error("Cache mode must not fetch"); }, [message(1, "needle")]);
    cache.node("search-all-opt").checked = false; cache.node("search-limit-opt").value = "0";
    await cache.run(); assert.equal(cache.calls.length, 0); assert.match(cache.node("search-stats").textContent, /1 matches/);
    cache.node("search-regex-opt").checked = true; cache.node("search-query").value = "[";
    await cache.run(); assert.match(cache.node("search-stats").textContent, /regular expression/i);
    cache.node("search-query").value = "^";
    await cache.run(); assert.match(cache.node("search-stats").textContent, /1 matches/); cache.close();

    const limited = harness(url => { assert.match(url, /limit=5$/); return { body: [message(1, "needle")] }; });
    limited.node("search-all-opt").checked = false; limited.node("search-limit-opt").value = "5";
    await limited.run(); assert.equal(limited.calls.length, 1); limited.close();
    const throttled = harness(() => { throw { status: 429, body: { retry_after: 0 } }; });
    await throttled.run(); assert.equal(throttled.calls.length, 4); assert.match(throttled.node("search-stats").textContent, /Error: HTTP 429/); throttled.close();
    const stalled = harness(() => new Promise(() => {}));
    const pending = stalled.run(); await new Promise(setImmediate); await stalled.run(); await pending;
    assert.equal(stalled.calls.length, 1); assert.match(stalled.node("search-stats").textContent, /Stopped/); stalled.close();
    const restarted = harness(() => new Promise(() => {}));
    const oldRun = restarted.run(); restarted.execute(); await oldRun;
    assert.equal(restarted.listenerCount(), 2);
    restarted.document.getElementById("discord-search-overlay").dispatchEvent(new Event("search-close"));
    assert.equal(restarted.listenerCount(), 0);
    console.log("PASS: lazy exports, pagination, cache/limit/regex, safe rendering, exports, bounded retries, cancellation and restart cleanup.");
})().catch(error => { console.error(error); process.exitCode = 1; });
