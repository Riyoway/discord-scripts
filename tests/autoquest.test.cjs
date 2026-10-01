// Run with: node tests/autoquest.test.cjs. Uses simulated Discord modules and a virtual clock; no network/account access.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../console/autoquest.js"), "utf8");
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
const ok = body => ({ ok: true, status: 200, body });
const makeQuest = (task, id = "1", options = {}) => ({
    id, preview: false,
    config: {
        config_version: 2, starts_at: new Date(Date.now() - 3600000).toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        messages: { quest_name: "Quest " + id }, application: { id: "12345", name: "Example game" },
        task_config_v2: { tasks: { [task]: { target: options.target ?? 5 } } }
    },
    user_status: options.unenrolled ? null : { enrolled_at: new Date(Date.now() - 3600000).toISOString(), completed_at: null, progress: {} }
});

function harness(quests, options = {}) {
    let now = Date.now(), timerId = 0;
    const timers = new Map(), listeners = new Map(), subscriptions = new Map();
    const calls = [], fetchCalls = [], logs = [], changes = [];
    const setTimer = (fn, ms, repeat = false) => {
        const id = ++timerId; timers.set(id, { fn, at: now + Number(ms), interval: repeat ? Number(ms) : 0 }); return id;
    };
    class ClockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    class Element {
        constructor(tag) { this.tag = tag; this.children = []; this.nodes = new Map(); this.css = {}; }
        set style(value) { this.css.cssText = value; }
        get style() { return this.css; }
        setAttribute(key, value) { this[key] = value; }
        appendChild(node) { this.children.push(node); node.parent = this; }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
        querySelector(selector) {
            if (!this.nodes.has(selector)) this.nodes.set(selector, new Element("div"));
            return this.nodes.get(selector);
        }
        querySelectorAll() { return []; }
        getBoundingClientRect() { return { left: 20, top: 20 }; }
        get offsetWidth() { return 40; }
        get offsetHeight() { return 40; }
    }
    const body = new Element("body");
    const document = {
        body, createElement: tag => new Element(tag), querySelectorAll: () => [],
        getElementById: id => body.children.find(node => node.id === id),
        querySelector: () => body.children.find(node => node.id === "autoquest-overlay")?.children.find(node => node.className === "autoquest-panel")
    };
    const window = {
        innerWidth: 1440, innerHeight: 900,
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
        removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }
    };
    const realGame = { id: "999", pid: 42, name: "Real game" };
    const originalGames = () => [realGame], originalPid = pid => pid === 42 ? realGame : undefined;
    const originalStream = () => options.noStream ? null : { id: "999", pid: 42, sourceName: "window" };
    const games = { getRunningGames: originalGames, getGameForPID: originalPid };
    const streaming = { getStreamerActiveStreamMetadata: originalStream };
    const questMap = new Map(quests.map(q => [q.id, q]));
    const store = { quests: options.storeShape === "object" ? Object.fromEntries(questMap) : options.storeShape === "array" ? quests : options.storeShape === "missing" ? undefined : questMap, getQuest: id => questMap.get(id) };
    const dispatcher = {
        dispatch: data => changes.push(data),
        subscribe(type, fn) { if (!subscriptions.has(type)) subscriptions.set(type, new Set()); subscriptions.get(type).add(fn); },
        unsubscribe(type, fn) { subscriptions.get(type)?.delete(fn); }
    };
    let h;
    const request = async (method, requestOptions) => {
        calls.push({ method, ...requestOptions, at: now });
        const custom = await options.request?.(method, requestOptions, h);
        if (custom !== undefined) return custom;
        const url = requestOptions.url;
        if (url === "/quests/@me") return ok({ quests: JSON.parse(JSON.stringify(quests)), quest_enrollment_blocked_until: options.blockedUntil ?? null });
        if (url.startsWith("/applications/public")) return ok([{ id: "12345", name: "Example game", executables: [{ os: "win32", name: "game.exe" }] }]);
        if (url === "/oauth2/tokens") return ok(h.grants.map(grant => ({ ...grant })));
        if (url.startsWith("/oauth2/tokens/") && method === "del") { h.grants = h.grants.filter(grant => String(grant.id) !== url.split("/").pop()); return ok({}); }
        if (url.startsWith("/oauth2/authorize?")) { h.grants.push({ id: "101", application: { id: "12345" } }); return ok({ location: "https://example.test/callback?code=test-code" }); }
        if (url.endsWith("/proxy-tickets")) return ok({ ticket: "test-ticket" });
        const q = quests.find(quest => url.startsWith("/quests/" + quest.id + "/"));
        if (q && url.endsWith("/enroll")) {
            q.user_status = { enrolled_at: new Date(now).toISOString(), completed_at: null, progress: {} };
            return ok(q.user_status);
        }
        if (q && (url.endsWith("/video-progress") || url.endsWith("/heartbeat"))) {
            const tasks = q.config.task_config_v2?.tasks ?? q.config.taskConfig?.tasks;
            const task = Object.keys(tasks)[0];
            const target = tasks[task].target;
            const done = requestOptions.body.timestamp ?? target;
            q.user_status ??= { enrolled_at: new Date(now).toISOString() };
            q.user_status.progress = { [task]: { value: done } };
            if (done >= target) q.user_status.completed_at = new Date(now).toISOString();
            return ok(q.user_status);
        }
        throw new Error("Unexpected request: " + method + " " + url);
    };
    const api = { get: opts => request("get", opts), post: opts => request("post", opts), del: opts => request("del", opts), put() {}, patch() {} };
    api.get = api.get.bind(api);
    api.post = api.post.bind(api);
    const channels = { getSortedPrivateChannels: () => options.noChannels ? [] : [{ id: "123" }] };
    const guilds = { getAllGuilds: () => ({}) };
    for (const value of [store, games, streaming, dispatcher, channels, guilds]) {
        Object.setPrototypeOf(value, Object.fromEntries(Object.entries(value).filter(([, method]) => typeof method === "function")));
    }
    // Mirrors Discord's lazy exports, including proxies polluted by earlier property probes.
    const lazyExport = new Proxy({ get() {}, post() {}, del() {}, put() {}, patch() {}, getQuest() {}, quests() {} }, { get: (object, key) => object[key] ?? (() => undefined) });
    const modules = {
        firstLazyExport: { exports: { default: lazyExport } },
        store: { exports: { renamedStoreExport: store } }, http: { exports: { renamedApiExport: api } },
        games: { exports: { random: games } }, streaming: { exports: streaming }, flux: { exports: { changed: dispatcher } },
        channels: { exports: channels },
        guilds: { exports: guilds }
    };
    const context = vm.createContext({
        window, document, URL, URLSearchParams, AbortController, EventTarget, Event, Date: ClockDate,
        webpackChunkdiscord_app: { push: () => ({ c: modules }), pop() {} },
        ...(options.desktop ? { DiscordNative: {} } : {}),
        setTimeout: (fn, ms) => setTimer(fn, ms), clearTimeout: id => timers.delete(id),
        setInterval: (fn, ms) => setTimer(fn, ms, true), clearInterval: id => timers.delete(id),
        console: Object.fromEntries(["log", "warn", "error"].map(name => [name, (...args) => logs.push(args.join(" "))])),
        fetch: async (url, init) => {
            fetchCalls.push({ url, ...init });
            const custom = await options.fetch?.(url, init, h);
            if (custom !== undefined) return custom;
            if (url.endsWith("/authorize")) return Response.json({ token: "activity-token" });
            quests[0].user_status.completed_at = new Date(now).toISOString();
            return new Response(null, { status: 204 });
        }
    });
    h = {
        window, context, document, calls, fetchCalls, logs, games, streaming, realGame, changes, timers,
        originals: { originalGames, originalPid, originalStream }, grants: [{ id: "100", application: { id: "12345" } }],
        get run() { return window.__riyoAutoQuest; }, now: () => now,
        panel: () => document.querySelector(),
        pause() { h.panel().querySelector("#autoquest-btn-pause").onclick({ stopPropagation() {} }); },
        emit(data) { for (const fn of subscriptions.get("QUESTS_SEND_HEARTBEAT_SUCCESS") ?? []) fn(data); },
        subscriberCount: () => subscriptions.get("QUESTS_SEND_HEARTBEAT_SUCCESS")?.size ?? 0,
        listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
        execute: () => vm.runInContext(source, context),
        async advance(ms) {
            const end = now + ms;
            let iterations = 0;
            while (true) {
                const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
                if (!next || next[1].at > end) break;
                if (++iterations > 5000) throw new Error("Virtual timers did not settle.");
                const [id, timer] = next;
                now = timer.at;
                if (timer.interval) timer.at += timer.interval; else timers.delete(id);
                timer.fn();
                await settle();
            }
            now = end;
            await settle();
        },
        async finish() {
            for (let i = 0; i < 1000; i++) {
                await settle();
                if (!h.run.state.isRunning) { await h.run.done; return; }
                const next = Math.min(...[...timers.values()].map(timer => timer.at));
                if (!Number.isFinite(next)) throw new Error("Queue is stuck with no timer.");
                await h.advance(Math.max(0, next - now));
            }
            throw new Error("Queue did not finish.");
        },
        async stop() { h.run.stop(); await h.run.done; assert.equal(h.listenerCount(), 0); assert.equal(h.subscriberCount(), 0); assert.equal(timers.size, 0); }
    };
    h.execute();
    return h;
}

(async () => {
    for (const storeShape of ["object", "array", "missing"]) {
        const client = harness([makeQuest("WATCH_VIDEO")], { storeShape });
        await client.finish();
        assert.equal(client.run.state.quests[0].result, "Completed");
        await client.stop();
    }
    for (const storeShape of ["object", "array"]) {
        const client = harness([makeQuest("WATCH_VIDEO")], { storeShape, request: (method, opts) => {
            if (opts.url === "/quests/@me") throw new Error("Quest list unavailable");
        } });
        await client.finish();
        assert.equal(client.run.state.quests[0].result, "Completed");
        await client.stop();
    }
    const startupError = harness([], { storeShape: "missing", request: () => { throw new Error("<blocked> HTTP 403"); } });
    await startupError.finish();
    assert.equal(startupError.run.state.overall, "ERROR");
    assert.match(startupError.panel().innerHTML, /&lt;blocked&gt; HTTP 403/);
    assert(!startupError.panel().innerHTML.includes("No active quests"));
    assert.equal(startupError.panel().querySelector("#autoquest-btn-pause").disabled, true);
    await startupError.stop();
    const mobile = makeQuest("WATCH_VIDEO_ON_MOBILE", "1", { unenrolled: true });
    mobile.traffic_metadata_raw = "metadata";
    const desktopVideo = makeQuest("WATCH_VIDEO", "2", { unenrolled: true });
    desktopVideo.config.taskConfig = desktopVideo.config.task_config_v2;
    delete desktopVideo.config.task_config_v2;
    desktopVideo.config.messages = { questName: '<img src=x onerror="evil">' };
    const excluded = [makeQuest("WATCH_VIDEO", "3"), makeQuest("WATCH_VIDEO", "4"), makeQuest("WATCH_VIDEO", "5")];
    excluded[0].preview = true;
    excluded[1].config.expires_at = new Date(Date.now() - 1000).toISOString();
    excluded[2].config.starts_at = new Date(Date.now() + 3600000).toISOString();
    const mixed = harness([mobile, desktopVideo, ...excluded]);
    await mixed.finish();
    assert.equal(mixed.run.state.quests.length, 2);
    assert.deepEqual(mixed.calls.filter(c => c.url.endsWith("/enroll")).map(c => c.body.location), [12, 11]);
    assert.equal(mixed.calls.find(c => c.url.endsWith("/enroll")).body.traffic_metadata_raw, "metadata");
    assert(mixed.run.state.quests.every(q => q.result === "Completed"));
    assert(!mixed.panel().innerHTML.includes('<img src=x'));
    await mixed.stop();

    const timedQuest = makeQuest("WATCH_VIDEO", "1", { target: 25 });
    timedQuest.user_status.enrolled_at = new Date().toISOString();
    const timed = harness([timedQuest]);
    await timed.finish();
    for (const call of timed.calls.filter(c => c.url.endsWith("/video-progress"))) {
        assert(call.body.timestamp <= 25);
        assert(call.body.timestamp <= Math.floor((call.at - Date.parse(timedQuest.user_status.enrolled_at)) / 1000) + 10);
    }
    await timed.stop();

    let release;
    const interrupted = harness([makeQuest("WATCH_VIDEO")], { request: (method, opts) => {
        if (opts.url.endsWith("/video-progress")) return new Promise(resolve => { release = resolve; });
    } });
    await settle();
    assert(release);
    await interrupted.stop();
    release(ok({ completed_at: new Date().toISOString() }));
    await settle();
    assert.equal(interrupted.calls.filter(c => c.url.endsWith("/video-progress")).length, 1);
    assert.equal(interrupted.run.state.quests[0].userStatus.completedAt, null);

    const paused = harness([makeQuest("WATCH_VIDEO", "1", { target: 50 })]);
    await settle();
    paused.pause();
    const pausedCalls = paused.calls.length;
    await paused.advance(120000);
    assert.equal(paused.calls.length, pausedCalls);
    await paused.stop();

    const retry = harness([makeQuest("WATCH_VIDEO", "1", { unenrolled: true }), makeQuest("WATCH_VIDEO", "2")], {
        request: (method, opts) => { if (opts.url === "/quests/1/enroll") throw { status: 429, body: { retry_after: 1 } }; }
    });
    await retry.finish();
    assert.equal(retry.calls.filter(c => c.url === "/quests/1/enroll").length, 4);
    assert.match(retry.run.state.quests[0].result, /Failed/);
    assert.equal(retry.run.state.quests[1].result, "Completed");
    await retry.stop();
    const retryStop = harness([makeQuest("WATCH_VIDEO", "1", { unenrolled: true })], {
        request: (method, opts) => { if (opts.url.endsWith("/enroll")) throw { status: 429, body: { retry_after: 2700 } }; }
    });
    await settle();
    await retryStop.stop();
    assert.equal(retryStop.calls.filter(c => c.url.endsWith("/enroll")).length, 1);

    const platforms = harness(["PLAY_ON_DESKTOP", "PLAY_ON_XBOX", "PLAY_ON_PLAYSTATION", "PLAY_ACTIVITY"].map((task, i) => makeQuest(task, String(i + 1))));
    await platforms.finish();
    assert(platforms.run.state.quests.every(q => q.result === "Completed"));
    const beats = platforms.calls.filter(c => c.url.endsWith("/heartbeat"));
    assert.equal(beats.length, 8);
    assert(beats.slice(0, 6).every(c => c.body.application_id === "12345"));
    assert(beats.slice(6).every(c => c.body.stream_key === "call:123:1"));
    await platforms.stop();
    let beatsSent = 0;
    const progressing = harness([makeQuest("PLAY_ON_XBOX", "1", { target: 10 })], { request: (method, opts) => {
        if (!opts.url.endsWith("/heartbeat")) return;
        if (opts.body.terminal) return ok({ completed_at: "confirmed" });
        beatsSent++;
        return ok({ progress: { PLAY_ON_XBOX: { value: beatsSent * 5 } } });
    } });
    await progressing.finish();
    assert.equal(beatsSent, 2);
    assert.equal(progressing.run.state.quests[0].result, "Completed");
    await progressing.stop();
    const beatStop = harness([makeQuest("PLAY_ON_XBOX", "1", { target: 10 })], { request: (method, opts) =>
        opts.url.endsWith("/heartbeat") ? ok({ progress: { PLAY_ON_XBOX: { value: 1 } } }) : undefined
    });
    await settle();
    await beatStop.stop();
    assert.equal(beatStop.calls.filter(c => c.url.endsWith("/heartbeat")).length, 1);
    assert(!beatStop.calls.some(c => c.body?.terminal));

    const native = harness([makeQuest("PLAY_ON_DESKTOP")], { desktop: true });
    await settle();
    assert.equal(native.subscriberCount(), 1);
    assert.equal(native.games.getRunningGames().length, 2);
    assert.equal(native.games.getGameForPID(42), native.realGame);
    native.emit({ questId: "other", userStatus: { progress: { PLAY_ON_DESKTOP: { value: 500 } }, completedAt: "now" } });
    await settle();
    assert(native.run.state.isRunning);
    native.pause();
    assert.equal(native.games.getRunningGames, native.originals.originalGames);
    await native.advance(240000);
    assert(native.run.state.isRunning);
    native.pause();
    assert.equal(native.games.getRunningGames().length, 2);
    native.emit({ user_status: { quest_id: "1", progress: { PLAY_ON_DESKTOP: 5 }, completed_at: new Date().toISOString() } });
    await native.run.done;
    assert.equal(native.run.state.quests[0].result, "Completed");
    assert.equal(native.games.getRunningGames, native.originals.originalGames);
    assert.equal(native.games.getGameForPID, native.originals.originalPid);
    assert.equal(native.subscriberCount(), 0);
    await native.stop();
    const ownership = harness([makeQuest("PLAY_ON_DESKTOP")], { desktop: true });
    await settle();
    ownership.pause();
    const otherPatch = () => [ownership.realGame];
    ownership.games.getRunningGames = otherPatch;
    ownership.pause();
    await ownership.run.done;
    assert.match(ownership.run.state.quests[0].result, /Another script/);
    assert.equal(ownership.games.getRunningGames, otherPatch);
    await ownership.stop();

    const nativeStop = harness([makeQuest("PLAY_ON_DESKTOP")], { desktop: true });
    await settle();
    nativeStop.pause();
    await nativeStop.stop();
    assert.equal(nativeStop.games.getRunningGames, nativeStop.originals.originalGames);
    const stuck = harness([makeQuest("PLAY_ON_DESKTOP")], { desktop: true });
    await settle();
    await stuck.advance(180001);
    await stuck.run.done;
    assert.match(stuck.run.state.quests[0].result, /3 minutes/);
    assert.equal(stuck.games.getRunningGames, stuck.originals.originalGames);
    await stuck.stop();

    const streamQuest = makeQuest("STREAM_ON_DESKTOP");
    streamQuest.config.config_version = 1;
    const stream = harness([streamQuest], { desktop: true });
    await settle();
    assert.notEqual(stream.streaming.getStreamerActiveStreamMetadata, stream.originals.originalStream);
    stream.emit({ questId: "foreign", userStatus: { streamProgressSeconds: 100 } });
    assert(stream.run.state.isRunning);
    stream.emit({ questId: "1", userStatus: { streamProgressSeconds: "5", completedAt: "now" } });
    await stream.run.done;
    assert.equal(stream.streaming.getStreamerActiveStreamMetadata, stream.originals.originalStream);
    assert.equal(stream.run.state.quests[0].result, "Completed");
    await stream.stop();
    const streamStop = harness([makeQuest("STREAM_ON_DESKTOP")], { desktop: true });
    await settle();
    await streamStop.stop(); // Must settle even when no heartbeat ever arrives.
    assert.equal(streamStop.streaming.getStreamerActiveStreamMetadata, streamStop.originals.originalStream);

    const rerun = harness([makeQuest("PLAY_ON_DESKTOP")], { desktop: true });
    await settle();
    const oldRun = rerun.run;
    rerun.execute();
    await settle();
    assert.notEqual(rerun.run, oldRun);
    assert.equal(rerun.subscriberCount(), 1);
    assert.equal(rerun.listenerCount(), 2);
    await rerun.stop();

    const activityFailure = harness([makeQuest("ACHIEVEMENT_IN_ACTIVITY")], {
        fetch: url => url.endsWith("/quest/progress") ? new Response(null, { status: 403 }) : undefined
    });
    await activityFailure.finish();
    assert.match(activityFailure.run.state.quests[0].result, /HTTP 403/);
    assert.deepEqual(activityFailure.grants.map(g => g.id), ["100"]);
    assert.deepEqual(activityFailure.calls.filter(c => c.method === "del").map(c => c.url), ["/oauth2/tokens/101"]);
    await activityFailure.stop();
    const activity = harness([makeQuest("ACHIEVEMENT_IN_ACTIVITY")]);
    await activity.finish();
    assert.equal(activity.run.state.quests[0].result, "Completed");
    assert.equal(activity.fetchCalls[1].headers["X-Auth-Token"], "activity-token");
    assert.deepEqual(activity.grants.map(g => g.id), ["100"]);
    await activity.stop();
    const activityStop = harness([makeQuest("ACHIEVEMENT_IN_ACTIVITY")], {
        fetch: (url, init) => new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }))
    });
    await settle();
    assert.equal(activityStop.fetchCalls.length, 1);
    await activityStop.stop();
    assert(activityStop.fetchCalls[0].signal.aborted);
    assert.deepEqual(activityStop.grants.map(g => g.id), ["100"]);
    const activityNoCode = harness([makeQuest("ACHIEVEMENT_IN_ACTIVITY")], { request: (method, opts, h) => {
        if (opts.url.startsWith("/oauth2/authorize?")) {
            h.grants.push({ id: "101", application: { id: "12345" } });
            return ok({ location: "https://example.test/no-code" });
        }
    } });
    await activityNoCode.finish();
    assert.match(activityNoCode.run.state.quests[0].result, /no code/);
    assert.deepEqual(activityNoCode.grants.map(g => g.id), ["100"]);
    await activityNoCode.stop();

    const pendingQuest = makeQuest("WATCH_VIDEO");
    const pending = harness([pendingQuest], {
        request: (method, opts) => opts.url.endsWith("/video-progress") ? ok({ progress: { WATCH_VIDEO: { value: 5 } } }) : undefined
    });
    await pending.finish();
    assert.equal(pending.run.state.quests[0].result, "Pending confirmation");
    await pending.stop();
    const blocked = harness([makeQuest("WATCH_VIDEO", "1", { unenrolled: true }), makeQuest("WATCH_VIDEO", "2")], { blockedUntil: new Date(Date.now() + 3600000).toISOString() });
    await blocked.finish();
    assert.match(blocked.run.state.quests[0].result, /Enrollment blocked/);
    assert.equal(blocked.run.state.quests[1].result, "Completed");
    assert(!blocked.calls.some(c => c.url.endsWith("/enroll")));
    await blocked.stop();
    const noChannel = harness([makeQuest("PLAY_ACTIVITY")], { noChannels: true });
    await noChannel.finish();
    assert.match(noChannel.run.state.quests[0].result, /No usable/);
    await noChannel.stop();
    const noStream = harness([makeQuest("STREAM_ON_DESKTOP")], { desktop: true, noStream: true });
    await noStream.finish();
    assert.match(noStream.run.state.quests[0].result, /real stream/);
    await noStream.stop();
    const andQuest = makeQuest("WATCH_VIDEO");
    andQuest.config.task_config_v2.join_operator = "AND";
    andQuest.config.task_config_v2.tasks.ACHIEVEMENT_IN_GAME = { target: 1 };
    const unsupported = harness([andQuest]);
    await unsupported.finish();
    assert.match(unsupported.run.state.quests[0].result, /unsupported task/);
    assert(!unsupported.calls.some(c => c.method === "post"));
    await unsupported.stop();
    const andSupported = makeQuest("WATCH_VIDEO");
    andSupported.config.task_config_v2.join_operator = "AND";
    andSupported.config.task_config_v2.tasks.PLAY_ACTIVITY = { target: 5 };
    const allTasks = harness([andSupported], { request: (method, opts) => {
        if (opts.url.endsWith("/video-progress")) return ok({ progress: { WATCH_VIDEO: { value: 5 } } });
        if (opts.url.endsWith("/heartbeat")) return ok({ progress: { PLAY_ACTIVITY: { value: 5 } }, completed_at: "confirmed" });
    } });
    await allTasks.finish();
    assert.equal(allTasks.run.state.quests[0].result, "Completed");
    assert(allTasks.calls.some(c => c.url.endsWith("/video-progress")));
    assert(allTasks.calls.some(c => c.url.endsWith("/heartbeat")));
    await allTasks.stop();
    const captcha = harness([makeQuest("WATCH_VIDEO", "1", { unenrolled: true })], { request: (method, opts) => {
        if (opts.url.endsWith("/enroll")) throw { status: 400, body: { captcha_sitekey: "test-sitekey" } };
    } });
    await captcha.finish();
    assert.match(captcha.run.state.quests[0].result, /CAPTCHA/);
    assert.equal(captcha.fetchCalls.length, 0);
    assert.equal(captcha.calls.filter(c => c.url.endsWith("/enroll")).length, 1);
    await captcha.stop();
    console.log("PASS: protocol/schema variants, enrollment/eligibility, video bounds, cancellation/pause/restart, bounded retries, platform/activity heartbeats, native progress isolation/watchdog/restore, achievement authorization ownership, and completion confirmation.");
})().catch(error => { console.error(error); process.exitCode = 1; });
