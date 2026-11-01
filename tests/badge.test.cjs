// Offline badge checks. Mock DOM/fetch/webpack; no account access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../console/badge.js'), 'utf8');

const GAMES = [
    { id: '1', name: 'Game 1', executables: [{ os: 'win32', name: 'g1.exe' }] },
    { id: '2', name: 'Game 2', executables: [{ os: 'win32', name: 'g2.exe' }] },
    { id: '3', name: 'Game 3', executables: [{ os: 'win32', name: 'g3.exe' }] },
];

function boot() {
    class Element {
        constructor(tag) {
            this.tag = tag; this.nodes = new Map(); this.events = new Map();
            this.disabled = false; this.hidden = false;
            this.value = tag === 'select' ? '1' : '';
            this.checked = false; this.textContent = ''; this.dataset = {}; this.style = {};
        }
        set innerHTML(html) {
            for (const match of html.matchAll(/<(?:input|button|progress|div|select)\b([^>]*)>/g)) {
                const id = match[1].match(/\bid="([^"]+)"/);
                if (!id) continue;
                const node = new Element('x');
                node.value = match[1].match(/\bvalue="([^"]*)"/)?.[1] ?? (match[0].startsWith('<select') ? '1' : '');
                node.checked = /\bchecked\b/.test(match[1]);
                this.nodes.set('#' + id[1], node);
            }
        }
        querySelector(s) { assert.ok(this.nodes.has(s), s); return this.nodes.get(s); }
        addEventListener(t, h) { this.events.set(t, h); }
        click() { return this.events.get('click')?.(); }
        setAttribute(key, value) { this[key] = value; }
        getBoundingClientRect() { return { left: 20, top: 64, right: 340, bottom: 364, width: 320, height: 300 }; }
        remove() {}
    }
    const store = new Map([['riyo-scripts:consent:badge', 'yes']]);
    const science = [];
    const hype = [];
    const state = { sp: 'SP' };
    const mockFetch = async (u, o) => {
        const url = String((u && u.url) || u);
        if (url.includes('/api/v9/users/@me')) {
            return { ok: true, status: 200, json: async () => ({ analytics_token: 'AT', id: 'U9', username: 't' }) };
        }
        if (url.includes('/api/v9/science')) {
            science.push(JSON.parse(o.body).events);
            return { ok: true, status: 204, json: async () => ({}) };
        }
        if (url.includes('games.json')) {
            return { ok: true, status: 200, json: async () => GAMES };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    };
    let panel = null;
    const document = {
        getElementById: () => null,
        createElement: () => new Element('div'),
        body: { appendChild(n) { panel = n; } },
    };
    const sandbox = {
        document,
        localStorage: {
            getItem: k => (k === 'token' ? '"tok123"' : (store.get(k) ?? null)),
            setItem: (k, v) => store.set(k, v),
        },
        navigator: { userAgent: 'Windows' },
        crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
        setTimeout, clearTimeout, console, AbortController,
        riyoScriptApproved: 'badge',
        window: { innerWidth: 1200, innerHeight: 900, addEventListener() {}, removeEventListener() {} },
        webpackChunkdiscord_app: {
            push() {
                const api = {
                    get: async () => ({}),
                    post: async req => { hype.push(['post', req]); return {}; },
                    del: async req => { hype.push(['del', req]); return {}; },
                };
                return { m: { 7: { toString: () => 'HTTPUtils .get .post', __webpackModuleId: 7 } }, 7: { api } };
            },
            pop() {},
        },
    };
    // findApi calls wreq(id): route to the api holder
    const wreqHook = sandbox.webpackChunkdiscord_app.push;
    sandbox.webpackChunkdiscord_app.push = (...a) => {
        const w = wreqHook(...a);
        const fn = id => w[id];
        fn.m = w.m;
        return fn;
    };
    sandbox.window.fetch = mockFetch;
    sandbox.fetch = (...a) => sandbox.window.fetch(...a);
    sandbox.window.window = sandbox.window;
    vm.createContext(sandbox);
    return { sandbox, science, hype, get panel() { return panel; } };
}

const tick = async (cond, label) => {
    for (let i = 0; i < 200; i++) {
        if (cond()) return;
        await new Promise(r => setTimeout(r, 25));
    }
    assert.fail('timeout: ' + label);
};

test('instant games: posts launch + heartbeats with configured duration', async () => {
    const b = boot();
    const { sandbox, science } = b;
    await vm.runInContext(source + '\n;undefined', sandbox, { timeout: 5000 });
    const q = s => b.panel.querySelector(s);
    q('#bd-hours').value = '2';
    q('#bd-maxgames').value = '2';
    q('#bd-streamhours').value = '0';
    const p = q('#bd-run-instant').click();
    // feed x-super-properties through the installed hook
    await sandbox.window.fetch('https://discord.com/x', { headers: { 'x-super-properties': 'SP' } });
    await p;
    await tick(() => q('#bd-status-instant').textContent.includes('done'), 'games done');
    assert.equal(science.length, 1);
    const types = science[0].map(e => e.type);
    assert.deepEqual(types, [
        'running_game_heartbeat', 'launch_game', 'running_game_heartbeat',
        'running_game_heartbeat', 'launch_game', 'running_game_heartbeat',
    ]);
    assert.deepEqual(science[0].filter(e => e.type === 'launch_game').map(e => e.properties.game), ['Game 1', 'Game 2']);
    const finals = science[0].filter(e => e.type === 'running_game_heartbeat' && e.properties.final_heartbeat);
    assert.ok(finals.every(e => e.properties.duration_tracked_ms === 2 * 3600 * 1000));
    assert.ok(finals.every(e => typeof e.properties.event_sequence_number === 'number'));
});

test('instant stream: posts 4-event session with inflated duration', async () => {
    const b = boot();
    const { sandbox, science } = b;
    await vm.runInContext(source + '\n;undefined', sandbox, { timeout: 5000 });
    const q = s => b.panel.querySelector(s);
    q('#bd-hours').value = '0';
    q('#bd-streamhours').value = '5';
    q('#bd-guild').value = 'G1';
    q('#bd-channel').value = 'C1';
    const p = q('#bd-run-instant').click();
    await sandbox.window.fetch('https://discord.com/x', { headers: { 'x-super-properties': 'SP' } });
    await p;
    await tick(() => q('#bd-status-instant').textContent.includes('done'), 'stream done');
    assert.equal(science.length, 1);
    const types = science[0].map(e => e.type);
    assert.deepEqual(types, ['media_session_joined', 'video_stream_started', 'voice_disconnect', 'screenshare_finished']);
    const byType = Object.fromEntries(science[0].map(e => [e.type, e.properties]));
    assert.ok(byType.voice_disconnect.duration >= 5 * 3600 * 1000);
    assert.ok(byType.voice_disconnect.duration <= 5.5 * 3600 * 1000);
    assert.equal(byType.voice_disconnect.context, 'stream');
    assert.equal(byType.video_stream_started.sender_user_id, 'U9');
    assert.equal(byType.screenshare_finished.duration, null);
});

test('tier presets: clicking a tier fills stream hours', async () => {
    const b = boot();
    const { sandbox } = b;
    await vm.runInContext(source + '\n;undefined', sandbox, { timeout: 5000 });
    const q = s => b.panel.querySelector(s);
    q('#bd-tier-20').click();
    assert.equal(q('#bd-streamhours').value, '20');
    q('#bd-tier-5000').click();
    assert.equal(q('#bd-streamhours').value, '5000');
});

test('hypesquad: join posts house, leave deletes', async () => {
    const b = boot();
    const { sandbox, hype } = b;
    await vm.runInContext(source + '\n;undefined', sandbox, { timeout: 5000 });
    const q = s => b.panel.querySelector(s);
    q('#bd-house').value = '2';
    await q('#bd-join').click();
    assert.equal(JSON.stringify(hype[0]), JSON.stringify(['post', { url: '/hypesquad/online', body: { house_id: 2 } }]));
    assert.match(q('#bd-status-hype').textContent, /Brilliance/);
    await q('#bd-leave').click();
    assert.equal(JSON.stringify(hype[1]), JSON.stringify(['del', { url: '/hypesquad/online' }]));
});

test('closing an idle badge panel preserves a presence session owned elsewhere', async () => {
    const b = boot();
    let stopped = 0;
    const other = { stop() { stopped++; } };
    b.sandbox.window.__badgeNaturalPresence = other;
    await vm.runInContext(source, b.sandbox);
    b.panel.querySelector('#bd-close').click();
    assert.equal(stopped, 0);
    assert.equal(b.sandbox.window.__badgeNaturalPresence, other);
});
