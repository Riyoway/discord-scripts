// Offline simulation checks. No Discord, account, or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../console/gametime.js'), 'utf8');
const catalog = [
    { id: 'one', name: 'First', executables: [{ os: 'win32' }] },
    { id: 'two', names: { default: 'Second' }, executables: [{ platform: 'windows' }] },
    { id: 'three', display_name: 'Third', executables: [{ operating_system: 'win' }] },
    { id: 'mac', name: 'Mac only', executables: [{ os: 'darwin' }] }
];

async function harness(response = { ok: true, json: async () => catalog }) {
    class Element {
        constructor() { this.nodes = new Map(); this.events = new Map(); this.disabled = false; }
        set innerHTML(html) {
            for (const match of html.matchAll(/<(?:input|button|progress|div)\b([^>]*)>/g)) {
                const id = match[1].match(/\bid="([^"]+)"/);
                if (!id) continue;
                const node = new Element();
                node.value = match[1].match(/\bvalue="([^"]+)"/)?.[1] || '';
                node.checked = /\bchecked\b/.test(match[1]);
                this.nodes.set('#' + id[1], node);
            }
        }
        querySelector(selector) { assert.ok(this.nodes.has(selector), selector); return this.nodes.get(selector); }
        addEventListener(type, handler) { this.events.set(type, handler); }
        click() { return this.events.get('click')?.(); }
        remove() { body.children = body.children.filter(node => node !== this); }
    }
    const body = { children: [], appendChild(node) { this.children.push(node); } };
    const calls = [], allocations = [], errors = [];
    let onSleep;
    const context = vm.createContext({
        riyoScriptApproved: 'gametime',
        localStorage: { setItem() {} },
        document: { body, createElement: () => new Element(), getElementById: id => body.children.find(node => node.id === id) },
        console: { log: (label, data) => allocations.push(data), error: (...args) => errors.push(args) },
        fetch: async (url, options) => {
            assert.equal(url, 'https://cdn.discordapp.com/detectables/games.json');
            assert.equal(options.cache, 'no-store');
            assert.equal(options.method, undefined, 'Catalog request must remain a GET');
            assert.equal(options.headers, undefined, 'No account credentials should be sent');
            calls.push(url);
            return response;
        },
        setTimeout: callback => { onSleep?.(); queueMicrotask(callback); }
    });
    const execute = () => vm.runInContext(source, context);
    await execute();
    const panel = body.children[0];
    const node = name => panel.querySelector('#gt-' + name);
    node('delay').value = '0';
    return { body, panel, node, execute, calls, allocations, errors, sleep: callback => { onSleep = callback; }, run: () => node('start').click() };
}

test('filters Windows games and preserves the total hours, including wobble', async () => {
    for (const wobble of [false, true]) {
        const page = await harness();
        page.node('hours').value = '60';
        page.node('games').value = '250';
        page.node('batch').value = '2';
        page.node('wobble').checked = wobble;
        await page.run();
        assert.equal(page.calls.length, 1);
        assert.equal(page.allocations.length, 3);
        assert.ok(page.allocations.every(item => item.gameId !== 'mac' && item.hours > 0));
        assert.ok(Math.abs(page.allocations.reduce((sum, item) => sum + item.hours, 0) - 60) < 1e-9);
        assert.equal(page.node('progress').value, 3);
        assert.match(page.node('status').textContent, /Finished dry run: 3 games/);
        assert.equal(page.node('start').disabled, false);
    }
});

test('Stop ends the simulation after the current delay', async () => {
    const page = await harness();
    page.node('delay').value = '100';
    page.sleep(() => page.node('stop').click());
    await page.run();
    assert.equal(page.allocations.length, 1);
    assert.match(page.node('status').textContent, /Stopped at 1\/3/);
    assert.equal(page.node('start').disabled, false);
});

test('catalog errors restore the controls without simulating any games', async () => {
    const page = await harness({ ok: false, status: 503 });
    await page.run();
    assert.match(page.node('status').textContent, /HTTP 503/);
    assert.equal(page.allocations.length, 0);
    assert.equal(page.node('start').disabled, false);
    assert.equal(page.node('hours').disabled, false);
});

test('rerunning closes the existing panel', async () => {
    const page = await harness();
    await page.execute();
    assert.equal(page.body.children.length, 0);
    assert.equal(page.calls.length, 0);
});
