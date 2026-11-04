async (page) => {
    // Start a local static server at 8791 first. Every Discord API below is an offline fixture.
    const assert = (value, message) => { if (!value) throw new Error(message); };
    const base = 'http://127.0.0.1:8791';
    await page.goto(base);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.setContent(`<style>body{margin:0;background:#313338;color:#e6e7eb;font:14px 'Segoe UI',sans-serif}body>nav{position:fixed;inset:0 auto 0 0;width:220px;background:#242529;padding:24px;box-sizing:border-box}body>main{padding:26px 30px;margin-left:220px}h1{font-size:18px;margin:0 0 24px}.channel{padding:10px;color:#9699a4}.messages{opacity:.35;line-height:2.6}.avatar{display:inline-block;width:24px;height:24px;border-radius:50%;background:#737789;vertical-align:middle;margin-right:10px}.message{margin:14px 0}</style><nav><h1>Discord</h1><div class=channel># general</div><div class=channel># games</div><div class=channel># screenshots</div></nav><main><h1># general</h1><div class=messages><div class=message><span class=avatar></span>Sam<br>Anyone up for a game tonight?</div><div class=message><span class=avatar></span>Alex<br>Ready whenever you are.</div></div></main>`);
    await page.evaluate(() => {
        history.replaceState({}, '', '/channels/111111111111111111/222222222222222222');
        window.__uiCalls = []; window.__copied = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => window.__copied.push(value) } });
        const api = {};
        for (const method of ['get', 'post', 'put', 'patch', 'del']) api[method] = (async function(req) { window.__uiCalls.push({ method, url: req.url }); return { ok: true, status: 200, body: [] }; }).bind(api);
        const entries = [
            Object.create({ getChannelId: () => '222222222222222222' }),
            Object.create({ getMessages: () => ({ toArray: () => [] }) }),
            { getCurrentUser: () => ({ id: '175928847299117063', username: 'Preview' }) },
            Object.assign(Object.create({ getQuest: () => null }), { quests: new Map() }),
            Object.create({ getRunningGames: () => [], getGameForPID: () => null }),
            Object.create({ getStreamerActiveStreamMetadata: () => null }),
            Object.create({ dispatch() {}, subscribe() {}, unsubscribe() {} }), api,
            { setToken() {}, getToken: () => 'offline-preview-token' }
        ];
        const req = () => ({ api });
        req.c = Object.fromEntries(entries.map((value, i) => [i, { exports: { Z: value, ...(i === 7 ? api : {}) } }]));
        req.m = { 7: function() { return 'HTTPUtils .get .post'; } };
        window.webpackChunkdiscord_app = { push: chunk => { chunk[2](req); return req; }, pop() {} };
        window.fetch = async () => { throw new Error('Network disabled in UI test'); };
        localStorage.clear();
    });
    const load = async name => {
        await page.evaluate(name => window.riyoScriptApproved = name, name);
        await page.addScriptTag({ url: `${base}/console/${name}.js?ui-test=${Date.now()}` });
    };
    const root = name => page.locator(`[data-riyo-script="${name}"]`);
    for (const name of ['timestamp', 'badge', 'search']) await load(name);
    const boxes = await page.locator('[data-riyo-script]').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { name: node.dataset.riyoScript, x: r.x, y: r.y, width: r.width, height: r.height }; }));
    assert(boxes.length === 3 && boxes.every(box => box.width === (box.name === 'badge' ? 560 : 320)), 'Use compact panels and the wider Badge sidebar layout');
    for (const a of boxes) for (const b of boxes) if (a !== b) assert(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, 'Initial panel placement must avoid overlap');
    await page.locator('#ts-date').fill('2026-02-31');
    assert(await page.locator('.ts-row').count() === 0, 'Reject dates that would silently roll into the next month');
    await page.locator('#ts-date').fill('2026-11-01');
    await page.locator('#ts-time').fill('13:45');
    assert(await page.locator('.ts-row').count() === 7, 'Keep all seven timestamp formats');
    await page.locator('.ts-row').first().click();
    assert(await page.evaluate(() => /^<t:\d+:t>$/.test(window.__copied[0])), 'Copy the selected timestamp');
    await page.locator('#search-all-opt').uncheck();
    assert(await page.locator('#limit-container').isVisible(), 'Custom checkbox must retain its checked/change behavior');
    await page.locator('#bd-nav-hype').click();
    await page.locator('#bd-house-3').check();
    assert(await page.locator('#bd-house').inputValue() === '3', 'Custom house selector must forward the chosen house');
    await page.locator('#bd-nav-games').click();
    await page.locator('#bd-mode-natural').check();
    assert(await page.locator('#bd-box-natural').isVisible() && !(await page.locator('#bd-box-instant').isVisible()), 'Mode tabs must switch their corresponding controls');
    assert(await page.locator('#bd-hours-n').inputValue() === '1000', 'Preserve the default 1000 hour limit');
    const before = await root('badge').boundingBox();
    const handle = await root('badge').locator('.riyo-header').boundingBox();
    await page.mouse.move(handle.x + 70, handle.y + 16); await page.mouse.down();
    await page.mouse.move(490, 190, { steps: 8 }); await page.mouse.up();
    const moved = await root('badge').boundingBox();
    assert(Math.abs(moved.x - before.x) > 50 && Math.abs(moved.y - before.y) > 20, 'Drag the window from its header');
    await root('badge').locator('.riyo-header').focus();
    await page.keyboard.press('ArrowRight');
    assert((await root('badge').boundingBox()).x > moved.x, 'Move a focused header with arrow keys');
    await root('timestamp').locator('.riyo-header').focus();
    assert(await root('timestamp').evaluate(node => +node.style.zIndex > +document.querySelector('[data-riyo-script="badge"]').style.zIndex), 'Focused panels must come to the front');
    await page.evaluate(() => { const panel = document.querySelector('[data-riyo-script="badge"]'); const stop = panel.__stop; window.__closeCalls = 0; panel.__stop = () => { window.__closeCalls++; stop(); }; });
    await root('badge').locator('.riyo-header').focus();
    await page.locator('#bd-close').click();
    assert(await root('badge').count() === 0 && await root('timestamp').count() === 1 && await root('search').count() === 1, 'Closing one script must keep the others open');
    assert(await page.evaluate(() => window.__closeCalls === 1 && window.__riyoPanels.panels.size === 2), 'Run close cleanup once and remove the panel registry entry');
    for (const name of ['media', 'export', 'snowflake', 'autoquest', 'badge']) await load(name);
    assert(await page.locator('[data-riyo-script]').count() === 7, 'All seven overlay scripts must coexist');
    assert(await page.locator('select,input[type="datetime-local"]').count() === 0, 'Do not display native select or date/time popups');
    const marks = await page.locator('.riyo-title .riyo-mark').evaluateAll(nodes => nodes.map(node => node.innerHTML));
    assert(new Set(marks).size === 7, 'Give every script its own recognizable icon');
    await root('autoquest').locator('.autoquest-icon').click();
    assert(await root('autoquest').locator('.autoquest-panel').isVisible(), 'Open the AutoQuest monitor with its icon');
    await page.locator('#autoquest-btn-close').click();
    assert(await root('autoquest').count() === 0, 'AutoQuest must have a visible close/stop action');
    await page.locator('#sf-input').fill('175928847299117063');
    await page.locator('#sf-form button').click();
    assert(await page.locator('#sf-copy').isVisible(), 'Snowflake decoding must remain usable');
    await page.evaluate(() => {
        window.__exportAborted = false;
        window.fetch = (url, init) => new Promise((resolve, reject) => { window.__exportPending = true; init.signal.addEventListener('abort', () => { window.__exportAborted = true; reject(init.signal.reason); }, { once: true }); });
    });
    await root('export').locator('.riyo-header').focus();
    await page.locator('#dx-go').click();
    await page.waitForFunction(() => window.__exportPending);
    await page.locator('#dx-x').click();
    assert(await page.evaluate(() => window.__exportAborted), 'Closing Export must abort an active request');
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForTimeout(100);
    const visible = await page.locator('[data-riyo-script]').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, overflow: node.scrollWidth > node.clientWidth }; }));
    assert(visible.every(r => r.x >= 0 && r.y >= 0 && r.right <= 391 && r.bottom <= 721 && !r.overflow), 'Keep panels reachable and free of horizontal overflow on a narrow viewport');
    await page.evaluate(() => { for (const panel of [...window.__riyoPanels.panels.keys()]) panel.remove(); });
    assert(await page.evaluate(() => window.__riyoPanels.panels.size === 0), 'Closing all panels must release their registry entries');
    await page.evaluate(() => history.replaceState({}, '', '/channels/@me'));
    await load('export');
    assert(await page.locator('#riyo-notice-export [role=alert]').textContent() === 'Open a DM or channel first.', 'Show a styled in-app error instead of a native alert');
    await page.locator('#riyo-notice-export button').click();
    await page.setViewportSize({ width: 1100, height: 800 });
    for (const name of ['autoquest', 'token', 'timestamp', 'media', 'whoami', 'export', 'snowflake', 'search', 'badge']) {
        await page.evaluate(() => { window.riyoScriptApproved = ''; localStorage.clear(); });
        await page.addScriptTag({ url: `${base}/console/${name}.js?consent-test=${Date.now()}` });
        assert(await page.locator('dialog[open] .riyo-mark').count() === 1, 'Use the same compact icon and theme in every consent dialog');
        await page.getByRole('button', { name: 'No', exact: true }).click();
        assert(await page.locator('dialog[open]').count() === 0, 'Cancel must close the dialog without running the script');
    }
    return { passed: true, scripts: 9, overlays: 7, checks: ['compact sizing', 'unique icons', 'custom controls', 'nonoverlapping placement', 'pointer and keyboard movement', 'focus stacking', 'individual close and cleanup', 'export cancellation', '390px viewport', 'all consent dialogs'] };
}
