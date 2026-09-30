// Run with: node tests/media.test.cjs (Node 22.15+).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const { crc32 } = require("node:zlib");

const source = fs.readFileSync(path.join(__dirname, "../console/media.js"), "utf8");
const payload = Buffer.from("123456789");
let requests = [], aborted = 0;
const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url === "/blocked") { res.writeHead(403); res.end(); return; }
    if (req.url === "/slow") {
        res.writeHead(200, { "Content-Length": 131072 });
        res.write(Buffer.alloc(256, 1));
        res.on("close", () => { if (!res.writableEnded) aborted++; });
        return;
    }
    res.writeHead(200, { "Content-Length": payload.length });
    res.end(payload);
});
const waitFor = async (check) => {
    for (let i = 0; i < 300; i++) {
        if (check()) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Timed out waiting for the downloader.");
};

function harness(base, imagePaths, videoPaths = []) {
    const downloads = [], blobs = new Map();
    class Element {
        constructor(tag) { this.tag = tag; this.children = []; this.nodes = new Map(); this.events = new Map(); }
        appendChild(node) { node.parent = this; this.children.push(node); }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); }
        querySelector(id) {
            if (!this.nodes.has(id)) this.nodes.set(id, new Element("button"));
            return this.nodes.get(id);
        }
        addEventListener(type, callback) { this.events.set(type, callback); }
        dispatchEvent(event) { this.events.get(event.type)?.(); }
        click() { if (this.tag === "a") downloads.push(blobs.get(this.href)); }
    }
    const body = new Element("body");
    const document = {
        body,
        getElementById: (id) => body.children.find((node) => node.id === id),
        createElement: (tag) => new Element(tag),
        querySelectorAll: (selector) => (selector === "img" ? imagePaths : videoPaths).map((url) => ({
            src: url ? base + url : "", querySelector: () => null
        }))
    };
    class LocalURL extends URL {
        static createObjectURL(blob) { const key = "blob:" + blobs.size; blobs.set(key, blob); return key; }
        static revokeObjectURL(key) { blobs.delete(key); }
    }
    const context = vm.createContext({
        document, location: { href: base }, fetch, URL: LocalURL, Blob,
        TextEncoder, AbortController, Event, console: { warn() {} },
        window: { open() { throw new Error("A popup was opened."); } },
        setTimeout: (fn, ms) => setTimeout(fn, ms).unref()
    });
    vm.runInContext(source, context);
    const box = document.getElementById("media-dl");
    return { box, downloads, document, runAgain: () => vm.runInContext(source, context), node: (id) => box.querySelector("#md-" + id) };
}

function checkZip(bytes) {
    const end = bytes.length - 22;
    assert.equal(bytes.readUInt32LE(end), 0x06054b50);
    assert.equal(bytes.readUInt16LE(end + 10), 3);
    let central = bytes.readUInt32LE(end + 16);
    const directoryStart = central;
    const names = [];
    for (let i = 0; i < 3; i++) {
        assert.equal(bytes.readUInt32LE(central), 0x02014b50);
        assert.equal(bytes.readUInt16LE(central + 8), 0x0800);
        const nameLength = bytes.readUInt16LE(central + 28);
        const name = bytes.subarray(central + 46, central + 46 + nameLength).toString("utf8");
        const local = bytes.readUInt32LE(central + 42);
        assert.equal(bytes.readUInt32LE(local), 0x04034b50);
        assert.equal(bytes.readUInt16LE(local + 8), 0); // No compression.
        assert.equal(bytes.readUInt32LE(local + 14), crc32(payload));
        const start = local + 30 + bytes.readUInt16LE(local + 26);
        assert.deepEqual(bytes.subarray(start, start + bytes.readUInt32LE(local + 22)), payload);
        assert.equal(bytes.subarray(local + 30, start).toString("utf8"), name);
        names.push(name);
        central += 46 + nameLength;
    }
    assert.equal(central, end);
    assert.equal(central - directoryStart, bytes.readUInt32LE(end + 12));
    assert.equal(new Set(names).size, 3);
    assert(names.some((name) => name.includes("日本.png")));
}

(async () => {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    try {
        const complete = harness(base, ["/%E6%97%A5%E6%9C%AC.png", "/%E6%97%A5%E6%9C%AC.png", "/same.png?one", ""], ["/same.png?two", "/blocked"]);
        const running = complete.node("all").onclick();
        complete.node("all").onclick(); // A second click must not start another queue.
        await running;
        assert.equal(requests.length, 4);
        assert.equal(complete.downloads.length, 0); // Background fetching never opens a save dialog.
        assert.equal(complete.node("progress").value, 4);
        assert.match(complete.node("status").textContent, /Ready: 3 file.*1 failed/);
        assert.equal(complete.node("save").hidden, false);
        complete.node("save").onclick();
        assert.equal(complete.downloads.length, 1);
        checkZip(Buffer.from(await complete.downloads[0].arrayBuffer()));
        complete.node("x").onclick();

        for (const action of ["stop", "x", "toggle"]) {
            requests = [];
            const before = aborted;
            const test = harness(base, ["/slow", "/never-start"]);
            const pending = test.node("all").onclick();
            await waitFor(() => Number(test.node("progress").value) > 0);
            assert.equal(test.node("all").disabled, true);
            if (action === "toggle") test.runAgain();
            else test.node(action).onclick();
            await pending;
            await waitFor(() => aborted > before);
            assert.deepEqual(requests, ["/slow"]);
            assert.match(test.node("status").textContent, /Stopped/);
            assert.equal(test.downloads.length, 0);
            assert.equal(test.node("all").disabled, false);
            if (action !== "stop") assert.equal(test.document.getElementById("media-dl"), undefined);
            test.node("x").onclick();
        }
        const failed = harness(base, ["/blocked"]);
        await failed.node("all").onclick();
        assert.match(failed.node("status").textContent, /No files fetched/);
        assert.equal(failed.node("save").hidden, true);
        assert.equal(failed.downloads.length, 0);
        failed.node("x").onclick();
        console.log("PASS: ZIP integrity, Unicode/duplicate names, failed URLs, single queue, progress, Stop, close, and toggle.");
    } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });
