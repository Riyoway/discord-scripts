// Offline presence checks. Fake Discord modules and a clock isolate all activity changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../console/badge-gametime.js'), 'utf8');
const game = id => ({ id: String(id), name: `Game ${id}`, executables: [{ os: 'win32', name: `folder/game-${id}.exe` }] });
const catalog = [game(1), game(2), game(3), game(1), { id: 'mac', name: 'Mac only', executables: [{ os: 'darwin', name: 'Mac' }] }];

async function harness(options = {}) {
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
    const calls = [], events = [], errors = [], timers = new Map(), listeners = new Map();
    const real = { id: 'real', name: 'Real game', pid: 123 };
    let backing = [real], now = 1800000000000, nextTimer = 1;
    const store = Object.assign(Object.create({ getVisibleGame() { return real; } }), {
        getName: () => 'RunningGameStore',
        getRunningGames() { assert.equal(this, store); return backing; },
        getGameForPID(pid) { assert.equal(this, store); return backing.find(value => value.pid === pid); },
        getVisibleRunningGames() { assert.equal(this, store); return backing; },
        getCandidateGames() { assert.equal(this, store); return backing; }
    });
    if (options.readonly) Object.defineProperty(store, 'getGameForPID', { writable: false });
    const descriptors = Object.getOwnPropertyDescriptors(store);
    const dispatcher = {
        _subscriptions: {}, subscribe() {},
        dispatch(event) {
            events.push(event);
            if (event.type === 'RUNNING_GAMES_CHANGE') backing = Array.from(event.games);
            if (options.failActivity && event.type === 'LOCAL_ACTIVITY_UPDATE' && event.activity) throw new Error('Activity failed');
        }
    };
    const req = { c: { store: { exports: { default: store } }, dispatcher: { exports: { dispatcher } } } };
    class FakeDate extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    const context = vm.createContext({
        riyoScriptApproved: 'badge-gametime', localStorage: { setItem() {} }, AbortController,
        navigator: { userAgent: options.linux ? 'Discord Linux' : 'Discord Windows' }, Date: FakeDate,
        document: { body, createElement: () => new Element(), getElementById: id => body.children.find(node => node.id === id) },
        console: { log() {}, error: (...args) => errors.push(args) },
        fetch: async (url, fetchOptions) => {
            assert.equal(url, 'https://cdn.discordapp.com/detectables/games.json');
            assert.equal(fetchOptions.cache, 'no-store');
            assert.equal(fetchOptions.method, undefined);
            assert.equal(fetchOptions.headers, undefined, 'No account credentials should be sent');
            calls.push(fetchOptions);
            return options.fetch ? options.fetch(fetchOptions, calls.length) : { ok: true, json: async () => options.catalog || catalog };
        },
        setTimeout: (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, due: now + delay, delay }); return id; },
        clearTimeout: id => timers.delete(id),
        addEventListener: (type, callback) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
        removeEventListener: (type, callback) => listeners.get(type)?.delete(callback)
    });
    context.window = context;
    if (!options.noRegistry) {
        if (options.vencord) context.Vencord = { Webpack: { wreq: req } };
        else context.webpackChunkdiscord_app = { push: entry => entry[2](req), pop() {} };
    }
    const execute = () => vm.runInContext(source, context);
    await execute();
    const panel = body.children[0];
    const node = name => panel.querySelector('#gt-' + name);
    const restored = () => {
        assert.deepEqual(Object.getOwnPropertyDescriptors(store), descriptors);
        assert.equal(store.getVisibleGame(), real, 'Inherited methods must also be restored');
        assert.deepEqual(store.getRunningGames(), [real], 'Real games must survive cleanup');
        assert.equal(context.__multiGamePresence, undefined);
        assert.equal(timers.size, 0);
    };
    return {
        context, body, panel, node, execute, calls, events, errors, store, real, timers, listeners, restored,
        run: () => node('start').click(), stop: () => node('stop').click(),
        advance(ms) {
            const target = now + ms;
            while (true) {
                const entry = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
                if (!entry || entry[1].due > target) break;
                now = entry[1].due;
                timers.delete(entry[0]);
                entry[1].callback();
            }
            now = target;
        }
    };
}

test('Start activates game presence and stays running instead of completing a dry run', async () => {
    const page = await harness();
    assert.equal(page.node('hours').value, '1000');
    assert.equal(page.node('wobble').checked, true);
    assert.equal(page.events.length, 0, 'Do not change activity before Start');
    await page.run();
    assert.equal(page.calls.length, 1);
    assert.equal(page.context.__multiGamePresence.totalGames, 3, 'Catalog entries must be usable and unique');
    const activity = page.events.find(event => event.type === 'LOCAL_ACTIVITY_UPDATE' && event.activity);
    assert.ok(activity);
    assert.equal(activity.activity.type, 0);
    assert.equal(page.store.getRunningGames().length, 2);
    assert.equal(page.store.getGameForPID(123), page.real);
    assert.match(page.store.getGameForPID(activity.pid).processName, /game-\d.exe/);
    assert.match(page.node('status').textContent, /^Active:/);
    assert.equal(page.node('start').disabled, true);
    assert.equal(page.node('stop').disabled, false);
    assert.equal(page.timers.size, 1);
    page.stop();
    page.restored();
    assert.equal(page.node('start').disabled, false);
    assert.ok(page.events.some(event => event.type === 'LOCAL_ACTIVITY_UPDATE' && event.activity === null));
});

test('rotations stay within 23–38 minutes and avoid the last 100 games', async () => {
    for (const wobble of [false, true]) {
        const page = await harness({ catalog: Array.from({ length: 120 }, (_, i) => game(i)) });
        page.node('wobble').checked = wobble;
        await page.run();
        const history = [];
        for (let i = 0; i < 110; i++) {
            const current = page.context.__multiGamePresence.current;
            assert.ok(!history.slice(-100).includes(current));
            history.push(current);
            assert.equal(page.timers.size, 1);
            const timer = [...page.timers.values()][0];
            assert.ok(timer.delay >= 23 * 60000 && timer.delay <= 38 * 60000);
            page.advance(timer.delay);
        }
        assert.ok(page.context.__multiGamePresence.history.length <= 100);
        page.stop();
        page.restored();
    }
});

test('time limit ends the session and restores the original store', async () => {
    const page = await harness();
    page.node('hours').value = '1';
    await page.run();
    page.advance(3600000);
    assert.match(page.node('status').textContent, /time limit reached/);
    assert.equal(page.node('start').disabled, false);
    page.restored();
});

test('manual next replaces the existing timer and a one-game pool remains usable', async () => {
    const page = await harness({ catalog: [game(1)], vencord: true });
    await page.run();
    page.context.__multiGamePresence.next();
    assert.equal(page.context.__multiGamePresence.current, 'Game 1');
    assert.equal(page.timers.size, 1);
    page.context.__multiGamePresence.stop();
    page.restored();
    assert.equal(page.node('start').disabled, false);
});

test('closing, rerunning, and leaving the page all stop presence', async () => {
    for (const action of ['close', 'rerun', 'pagehide']) {
        const page = await harness();
        await page.run();
        if (action === 'close') page.node('close').click();
        else if (action === 'rerun') await page.execute();
        else for (const callback of page.listeners.get('pagehide')) callback();
        page.restored();
        if (action !== 'pagehide') {
            assert.equal(page.body.children.length, 0);
            assert.equal(page.listeners.get('pagehide').size, 0);
        }
    }
});

test('Stop during loading aborts the old fetch without interrupting a new session', async () => {
    let resolveOld;
    const page = await harness({ fetch: (_, count) => count === 1 ? new Promise(resolve => { resolveOld = resolve; }) : { ok: true, json: async () => catalog } });
    const oldRun = page.run();
    page.stop();
    assert.equal(page.calls[0].signal.aborted, true);
    await page.run();
    const session = page.context.__multiGamePresence;
    resolveOld({ ok: true, json: async () => catalog });
    await oldRun;
    assert.equal(page.context.__multiGamePresence, session);
    assert.equal(page.node('start').disabled, true);
    page.stop();
    page.restored();
});

test('catalog and missing-client errors leave the controls usable', async () => {
    for (const options of [
        { fetch: () => ({ ok: false, status: 503 }) }, { catalog: [] }, { noRegistry: true }
    ]) {
        const page = await harness(options);
        await page.run();
        assert.equal(page.node('start').disabled, false);
        assert.ok(page.errors.length);
        page.restored();
    }
});

test('partial patch and activity dispatch failures roll back all changed methods', async () => {
    for (const options of [{ readonly: true }, { failActivity: true }]) {
        const page = await harness(options);
        await page.run();
        assert.ok(page.errors.length);
        assert.equal(page.node('start').disabled, false);
        page.restored();
    }
});

test('a pre-existing external presence session is preserved', async () => {
    const page = await harness();
    const other = { stop() {} };
    page.context.__multiGamePresence = other;
    await page.run();
    assert.equal(page.context.__multiGamePresence, other);
    assert.match(page.node('status').textContent, /Another game presence session/);
    assert.equal(page.events.length, 0);
    delete page.context.__multiGamePresence;
    page.restored();
});
