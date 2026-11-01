// AutoQuest — client-side queue, with protocol/state handling informed by the local quest bot.
(async () => {
    // BEGIN SHARED UI
    // Embedded in each standalone script; all icons and controls work without remote assets.
    const riyoIcon = name => {
        const paths = {
            close: '<path d="m7 7 10 10M17 7 7 17"/>',
            download: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
            image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/>',
            video: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 9 5-3v12l-5-3"/>',
            search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M8 8h5"/>',
            clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
            quest: '<path d="M6 21V4m0 0c4-4 8 4 13 0v10c-5 4-9-4-13 0"/><path d="m11 6-1 4h4l-1 4"/>',
            autoquest: '<path d="M6 21V4m0 0c4-4 8 4 13 0v10c-5 4-9-4-13 0"/><path d="m11 6-1 4h4l-1 4"/>',
            token: '<path d="M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6Z" fill="currentColor" fill-opacity=".08"/><circle cx="12" cy="10" r="2"/><path d="M12 12v4"/>',
            timestamp: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/><path d="M9 14h6m-3-2v6"/>',
            media: '<path d="M6 3h12a3 3 0 0 1 3 3v10"/><rect x="3" y="7" width="14" height="14" rx="3" fill="currentColor" fill-opacity=".07"/><circle cx="7.5" cy="11.5" r="1"/><path d="m4 18 4-4 3 3 2-2 4 4"/>',
            whoami: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M5 17c0-4 8-4 8 0m3-8h2m-2 4h2"/>',
            export: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 15h7m-3-3 3 3-3 3"/>',
            snowflake: '<path d="m9 3-4 18m14-18-4 18M4 9h17M3 15h17"/><path d="M4 3h1m14 18h1" stroke-width="3"/>',
            badge: '<path d="m7 15-2 6 5-2 2-3m5-1 2 6-5-2-2-3"/><path d="m12 2 3 2 3 1 1 4-1 4-3 1-3 2-3-2-3-1-1-4 1-4 3-1Z" fill="currentColor" fill-opacity=".09"/><path d="m9 9 2 2 4-4"/>',
            'badge-gametime': '<path d="M7 7h10c3 0 5 10 3 11-2 1-4-3-5-3H9c-1 0-3 4-5 3C2 17 4 7 7 7Z" fill="currentColor" fill-opacity=".08"/><path d="M7 10v4m-2-2h4m6-1h.01m3 2h.01M9 4h6"/>',
            pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
            play: '<path d="m8 5 11 7-11 7Z" fill="currentColor" fill-opacity=".14"/>',
            stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" fill-opacity=".12"/>',
            copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 4H6a2 2 0 0 0-2 2v9"/>',
            pin: '<path d="m15 3 6 6-4 1-4 4-1 4-6-6 4-1 4-4ZM9 15l-6 6"/>',
            chevron: '<path d="m8 10 4 4 4-4"/>',
            check: '<path d="m5 12 4 4L19 6"/>',
            grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3"/>'
        };
        return `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.copy}</svg>`;
    };
    const riyoScriptNames = { autoquest: 'AutoQuest', token: 'Token', timestamp: 'Timestamp', media: 'Media', whoami: 'Account', export: 'Export chat', snowflake: 'Snowflake', search: 'Message search', badge: 'Badge', 'badge-gametime': 'Game time' };
    const riyoHeading = (name, label = riyoScriptNames[name]) => `<span class="riyo-mark" data-script="${name}">${riyoIcon(name)}</span><span class="riyo-heading">${label}</span>`;
    const riyoMountPanel = (panel, name, reservedHeight = 0) => {
        const state = window.__riyoPanels ??= { panels: new Map(), front: 10000 };
        const controller = new AbortController();
        const signal = controller.signal;
        panel.dataset.riyoScript = name;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', riyoScriptNames[name] || name);
        document.body.appendChild(panel);
        const rect = () => panel.getBoundingClientRect();
        const floating = reservedHeight ? panel.querySelector('.autoquest-panel') : null;
        const heightFor = () => Math.max(rect().height, floating?.offsetHeight ? floating.offsetTop + floating.offsetHeight : reservedHeight);
        const clamp = (x, y) => ({ x: Math.max(8, Math.min(x, window.innerWidth - rect().width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - heightFor() - 8)) });
        const position = (x, y) => {
            const p = clamp(x, y);
            Object.assign(panel.style, { left: `${p.x}px`, top: `${p.y}px`, right: 'auto' });
        };
        const raise = () => { panel.style.zIndex = String(++state.front); };
        const width = rect().width, height = Math.max(rect().height, reservedHeight);
        let placed = false;
        for (let x = window.innerWidth - width - 12; x >= 8 && !placed; x -= width + 12) {
            let y = 64;
            const occupied = [...state.panels].map(([node, size]) => ({ box: node.getBoundingClientRect(), height: size }));
            for (const { box, height: reserved } of occupied.sort((a, b) => a.box.top - b.box.top)) {
                if (x < box.right + 12 && x + width + 12 > box.left && y < box.top + Math.max(box.height, reserved) + 12 && y + height + 12 > box.top) y = box.top + Math.max(box.height, reserved) + 12;
            }
            if (y + height <= window.innerHeight - 8) { position(x, y); placed = true; }
        }
        if (!placed) position(window.innerWidth - width - 12 - (state.panels.size % 4) * 24, 64 + (state.panels.size % 4) * 28);
        state.panels.set(panel, reservedHeight);
        raise();
        let drag = null, suppressClick = false;
        panel.addEventListener('pointerdown', event => {
            raise();
            const handle = event.target.closest('.riyo-header,[data-riyo-drag]');
            if (event.button !== 0 || !handle || !panel.contains(handle) || (event.target.closest('button,input,a,summary') && !handle.hasAttribute('data-riyo-drag'))) return;
            const box = rect();
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: box.left, top: box.top };
            suppressClick = false;
            panel.setPointerCapture(event.pointerId);
            event.preventDefault();
        }, { signal });
        panel.addEventListener('pointermove', event => {
            if (!drag || drag.id !== event.pointerId) return;
            const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
            if (Math.hypot(dx, dy) < 4 && !suppressClick) return;
            suppressClick = true;
            position(drag.left + dx, drag.top + dy);
        }, { signal });
        panel.addEventListener('pointerup', event => {
            if (!drag || drag.id !== event.pointerId) return;
            if (panel.hasPointerCapture(event.pointerId)) panel.releasePointerCapture(event.pointerId);
            drag = null;
            if (suppressClick) setTimeout(() => { suppressClick = false; }, 0);
        }, { signal });
        panel.addEventListener('pointercancel', () => { drag = null; suppressClick = false; }, { signal });
        panel.addEventListener('click', event => { if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); } }, { capture: true, signal });
        panel.addEventListener('focusin', raise, { signal });
        panel.addEventListener('keydown', event => {
            if (!event.target.matches('.riyo-header') || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
            const delta = event.shiftKey ? 32 : 8, box = rect();
            position(box.left + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0), box.top + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0));
            event.preventDefault();
        }, { signal });
        const fit = () => { const box = rect(); position(box.left, box.top); };
        window.addEventListener('resize', fit, { signal });
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
        observer?.observe(panel);
        if (floating) observer?.observe(floating);
        const remove = panel.remove.bind(panel);
        let closed = false;
        panel.remove = () => {
            if (closed) return;
            closed = true;
            controller.abort(); observer?.disconnect(); state.panels.delete(panel);
            try { panel.__stop?.(); } finally { remove(); }
        };
        return panel;
    };
    const riyoTheme = `<style>
    .riyo-ui{--riyo-surface:rgba(29,29,33,.97);--riyo-line:#ffffff15;--riyo-text:#eeeef2;--riyo-muted:#aaaab5;--riyo-danger:#efa4a9;--riyo-accent:#c3c0e8;color-scheme:dark;font:12px/1.45 'gg sans','Segoe UI',system-ui,sans-serif;color:var(--riyo-text);text-align:left}
    .riyo-ui,.riyo-ui *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#ffffff25 transparent}
    .riyo-panel,.riyo-ui .autoquest-panel{width:320px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);padding:12px;background:var(--riyo-surface);border:1px solid #ffffff1c;border-radius:12px;box-shadow:0 12px 40px #0006,0 2px 8px #0005;backdrop-filter:blur(16px);overflow:auto;overscroll-behavior:contain}
    .riyo-panel{position:fixed;top:64px;right:12px;z-index:10000;display:flex;flex-direction:column;gap:10px}
    .riyo-ui .riyo-header{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:30px;padding-bottom:10px;border-bottom:1px solid var(--riyo-line);flex-shrink:0;cursor:grab;touch-action:none;user-select:none}
    .riyo-ui .riyo-header:active{cursor:grabbing}.riyo-ui .riyo-title{display:flex;align-items:center;gap:9px;min-width:0;margin:0;font-size:13px;font-weight:650;letter-spacing:-.15px;color:var(--riyo-text)}
    .riyo-ui .riyo-heading{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.riyo-ui .riyo-mark{width:28px;height:28px;display:inline-grid;place-items:center;flex-shrink:0;border:1px solid #ffffff17;border-radius:8px;background:#ffffff07;color:var(--riyo-accent)}
    .riyo-ui .riyo-mark svg{width:20px;height:20px}.riyo-ui svg{display:inline-block;flex-shrink:0;vertical-align:middle;pointer-events:none}
    .riyo-ui button,.riyo-ui input,.riyo-ui select{appearance:none;-webkit-appearance:none;box-shadow:none;font:inherit;color:var(--riyo-text);margin:0}
    .riyo-ui button{display:inline-flex;justify-content:center;align-items:center;gap:6px;min-height:29px;padding:5px 9px;border:1px solid #ffffff14;border-radius:6px;background:#ffffff08;font-weight:550;line-height:1.35;cursor:pointer;transition:background .12s,border-color .12s}
    .riyo-ui button:hover:not(:disabled){background:#ffffff12;border-color:#ffffff29}.riyo-ui button:active:not(:disabled){background:#ffffff1b}.riyo-ui button:disabled{opacity:.38;cursor:default}
    .riyo-ui .riyo-primary{background:#dedee8;border-color:#dedee8;color:#202026}.riyo-ui .riyo-primary:hover:not(:disabled){background:#f2f2f7;border-color:#f2f2f7}
    .riyo-ui .riyo-danger{color:var(--riyo-danger);background:#efa4a908;border-color:#efa4a920}.riyo-ui .riyo-danger:hover:not(:disabled){background:#efa4a915;border-color:#efa4a938}
    .riyo-ui .riyo-close{width:26px;min-height:26px;padding:4px;background:transparent;border-color:transparent;color:var(--riyo-muted);flex:0 0 auto}
    .riyo-ui input:not([type=checkbox]):not([type=radio]):not([type=hidden]),.riyo-ui select{display:block;width:100%;min-width:0;min-height:30px;border:1px solid #ffffff18;border-radius:6px;background:#11111566;padding:5px 8px;line-height:1.4;font-variant-numeric:tabular-nums;transition:border-color .12s}
    .riyo-ui input::placeholder{color:#83838f}.riyo-ui input:focus{border-color:#c3c0e880}.riyo-ui input:disabled{opacity:.5}.riyo-ui input[type=number]{-moz-appearance:textfield}.riyo-ui input::-webkit-inner-spin-button,.riyo-ui input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
    .riyo-ui input[type=checkbox],.riyo-ui input[type=radio]{flex:0 0 auto;display:inline-block;width:14px;height:14px;padding:0;border:1px solid #ffffff40;border-radius:4px;background:#11111566;cursor:pointer}
    .riyo-ui input[type=checkbox]:checked{border-color:var(--riyo-accent);background:var(--riyo-accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='m3.5 8 3 3 6-6' fill='none' stroke='%23202026' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/12px no-repeat}
    .riyo-ui input[type=radio]{border-radius:50%}.riyo-ui input[type=radio]:checked{border:4px solid var(--riyo-accent);background:#202026}
    .riyo-ui :focus-visible{outline:2px solid var(--riyo-accent);outline-offset:2px}.riyo-ui p,.riyo-ui fieldset{margin:0}.riyo-ui fieldset{min-width:0;padding:0;border:0}.riyo-ui label,.riyo-ui legend{font-size:11px;color:var(--riyo-muted)}
    .riyo-ui .riyo-muted,.riyo-ui .riyo-status{font-size:11px;color:var(--riyo-muted);overflow-wrap:anywhere}.riyo-ui .riyo-status{padding:7px 8px;border-radius:5px;background:#ffffff04;line-height:1.5;font-variant-numeric:tabular-nums}
    .riyo-ui .riyo-row{display:flex;gap:6px;align-items:center}.riyo-ui .riyo-row>button{flex:1;min-width:0}.riyo-ui .riyo-options{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}.riyo-ui .riyo-label{display:flex;flex-direction:column;gap:4px;min-width:0}.riyo-ui .riyo-check{display:inline-flex;align-items:center;gap:6px;min-height:24px;cursor:pointer}
    .riyo-ui .riyo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.riyo-ui .riyo-stack{display:flex;flex-direction:column;gap:8px}.riyo-ui .riyo-segmented{display:flex;gap:3px;padding:3px;background:#11111566;border:1px solid var(--riyo-line);border-radius:7px}
    .riyo-ui .riyo-segmented label{position:relative;flex:1;display:flex;align-items:center;justify-content:center;gap:5px;min-height:27px;padding:4px 6px;border-radius:4px;cursor:pointer;text-align:center;color:var(--riyo-muted)}
    .riyo-ui .riyo-segmented input{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:pointer}.riyo-ui .riyo-segmented label:has(input:checked){background:#ffffff12;color:var(--riyo-text);box-shadow:0 1px 2px #0003}.riyo-ui .riyo-segmented label:has(input:focus-visible){outline:2px solid var(--riyo-accent);outline-offset:1px}
    .riyo-ui .riyo-section{padding-top:10px;border-top:1px solid var(--riyo-line)}.riyo-ui .riyo-section-title{display:flex;align-items:center;gap:6px;color:var(--riyo-text);font-size:11px;font-weight:600}.riyo-ui .riyo-details{font-size:11px;color:var(--riyo-muted)}
    .riyo-ui .riyo-details summary{display:flex;align-items:center;gap:6px;min-height:28px;cursor:pointer;list-style:none}.riyo-ui .riyo-details summary::-webkit-details-marker{display:none}.riyo-ui .riyo-details summary::after{content:'';width:5px;height:5px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);margin-left:auto;margin-right:4px}.riyo-ui .riyo-details[open] summary::after{transform:rotate(225deg)}
    .riyo-ui progress{appearance:none;display:block;width:100%;height:4px;border:0;border-radius:2px;overflow:hidden;background:#ffffff0d;flex-shrink:0}.riyo-ui progress::-webkit-progress-bar{background:#ffffff0d}.riyo-ui progress::-webkit-progress-value{background:var(--riyo-accent);border-radius:2px;transition:width .2s}.riyo-ui progress::-moz-progress-bar{background:var(--riyo-accent)}
    .riyo-ui [hidden]{display:none!important}.riyo-ui .riyo-badge{font-size:10px;font-weight:550;padding:2px 6px;border:1px solid var(--riyo-line);border-radius:4px;white-space:nowrap}
    .riyo-ui .autoquest-panel{position:absolute;top:42px;right:0;display:none;opacity:0;transition:opacity .12s;pointer-events:auto}.riyo-ui .autoquest-icon{width:32px;height:32px;padding:0;border-radius:9px;background:var(--riyo-surface);box-shadow:0 4px 14px #0005;color:var(--riyo-accent);pointer-events:auto;touch-action:none}.riyo-ui .autoquest-icon svg{width:20px;height:20px}.riyo-ui .autoquest-icon[aria-pressed=true]{background:#36343f;border-color:#c3c0e84d}
    .riyo-ui .autoquest-queue{max-height:260px;overflow:auto;margin-top:8px}.riyo-ui .autoquest-item{padding:8px 0;border-bottom:1px solid #ffffff0a}.riyo-ui .autoquest-item[data-current=true]{padding:8px;border:1px solid #c3c0e829;border-radius:6px;background:#c3c0e805}.riyo-ui .autoquest-item[data-done=true]{opacity:.5}.riyo-ui .autoquest-item.drag-over{outline:1px dashed var(--riyo-accent);background:#ffffff08}
    .riyo-ui .riyo-quest-name{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.riyo-ui .riyo-quest-meta{display:flex;justify-content:space-between;gap:8px;margin-top:4px;font-size:11px;color:var(--riyo-muted);pointer-events:none}.riyo-ui .riyo-progress{height:3px;background:#ffffff0d;border-radius:2px;margin-top:7px;overflow:hidden}.riyo-ui .riyo-progress>div{height:100%;background:var(--riyo-accent);transition:width .2s}
    .riyo-ui .riyo-footer{display:flex;gap:6px;padding-top:10px;margin-top:8px;border-top:1px solid var(--riyo-line)}.riyo-ui .riyo-footer>button:first-child{flex:1}.riyo-ui #search-results-list{overflow:auto;min-height:0}.riyo-ui #search-results-list article{padding:8px 0;border-top:1px solid var(--riyo-line);overflow-wrap:anywhere}.riyo-ui #search-results-list p{margin:4px 0 0;white-space:pre-wrap}.riyo-ui #search-results-list mark{background:#c3c0e8;color:#202026;border-radius:2px}
    .riyo-ui .ts-row{width:100%;justify-content:space-between;text-align:left;min-height:32px;background:transparent;border-color:transparent;padding:6px}.riyo-ui #ts-list{display:flex;flex-direction:column;gap:1px}.riyo-ui .ts-code{font:11px ui-monospace,monospace;font-variant-numeric:tabular-nums}.riyo-ui .ts-format{display:flex;align-items:center;gap:6px;color:var(--riyo-muted);font-size:10px}.riyo-ui .ts-format svg{width:13px;height:13px}
    @media(pointer:coarse){.riyo-ui button{min-height:38px}.riyo-ui .riyo-check{min-height:32px}.riyo-ui .riyo-close{width:34px;min-height:34px}}
    @media(prefers-reduced-motion:reduce){.riyo-ui *{transition:none!important;animation:none!important}}
    </style>`;
    const riyoNotice = (name, message) => {
        document.getElementById('riyo-notice-' + name)?.remove();
        const panel = document.createElement('section');
        panel.id = 'riyo-notice-' + name;
        panel.className = 'riyo-ui riyo-panel';
        panel.innerHTML = `${riyoTheme}<header class="riyo-header" tabindex="0"><strong class="riyo-title">${riyoHeading(name)}</strong><button class="riyo-close" aria-label="Close notice">${riyoIcon('close')}</button></header><p class="riyo-status" role="alert"></p>`;
        panel.querySelector('[role=alert]').textContent = message;
        panel.querySelector('button').onclick = () => panel.remove();
        return riyoMountPanel(panel, name);
    };
    // A styled modal keeps focus management and Escape cancellation in Electron.
    const riyoRunScript = (name, run) => {
        const key = 'riyo-scripts:consent:' + name;
        const remember = () => {
            try { localStorage.setItem(key, 'yes'); } catch { /* Ask again if storage is unavailable. */ }
        };
        if (typeof riyoScriptApproved !== 'undefined' && riyoScriptApproved === name) {
            remember();
            return run();
        }
        let accepted = false;
        try { accepted = localStorage.getItem(key) === 'yes'; } catch { /* Show the warning. */ }
        if (accepted) return run();
        return new Promise((resolve, reject) => {
            const previousFocus = document.activeElement;
            const dialog = document.createElement('dialog');
            const titleId = 'riyo-consent-' + name;
            dialog.className = 'riyo-ui riyo-panel riyo-consent';
            dialog.setAttribute('aria-labelledby', titleId);
            dialog.setAttribute('aria-describedby', titleId + '-message');
            dialog.innerHTML = `${riyoTheme}
                <style>.riyo-consent{top:50%;left:50%;right:auto;margin:0;transform:translate(-50%,-50%)}.riyo-consent:not([open]){display:none}.riyo-consent::backdrop{background:#0009;backdrop-filter:blur(8px)}.riyo-consent p{margin:0}.riyo-consent form{margin:0}</style>
                <header class="riyo-header"><strong class="riyo-title" id="${titleId}">${riyoHeading(name, `Run ${name}?`)}</strong></header>
                <p id="${titleId}-message">Use this script at your own risk. You are responsible for any consequences, including issues affecting your account or data.</p>
                <form method="dialog" class="riyo-row">
                    <button type="submit" value="no" autofocus>No</button>
                    <button type="submit" value="yes" class="riyo-primary">Yes</button>
                </form>`;
            dialog.onclose = () => {
                const accepted = dialog.returnValue === 'yes';
                dialog.remove();
                previousFocus?.focus?.();
                if (!accepted) { resolve(undefined); return; }
                remember();
                try { resolve(run()); } catch (error) { reject(error); }
            };
            document.body.appendChild(dialog);
            try { dialog.showModal(); } catch (error) { dialog.remove(); reject(error); }
        });
    };
    // END SHARED UI
    return riyoRunScript('autoquest', async () => {
    const previous = window.__riyoAutoQuest;
    if (previous) {
        previous.stop();
        await previous.done;
    } else if (document.getElementById("autoquest-overlay") || window.__autoquest_backup) {
        throw new Error("An older AutoQuest is loaded. Reload Discord once before running this version.");
    }
    if (typeof webpackChunkdiscord_app === "undefined") throw new Error("Run AutoQuest inside Discord after it has loaded.");
    let wpRequire;
    try { wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]); }
    finally { webpackChunkdiscord_app.pop(); }
    const findModule = (test) => {
        for (const module of Object.values(wpRequire.c)) {
            try {
                for (const value of [module.exports, ...Object.values(module.exports ?? {})]) {
                    if (value && test(value)) return value;
                }
            } catch { /* Some lazy exports cannot be inspected before they load. */ }
        }
        return null;
    };
    // Lazy export proxies fabricate functions for unknown properties, even during descriptor probes.
    // Real stores have prototype methods; the authenticated HTTP client binds its request methods.
    const findStore = method => findModule(x => typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(x), method)?.value === "function");
    const QuestsStore = findStore("getQuest");
    const api = findModule(x => ["get", "post", "put", "patch"].every(method => typeof Object.getOwnPropertyDescriptor(x, method)?.value === "function")
        && ["del", "delete"].some(method => typeof Object.getOwnPropertyDescriptor(x, method)?.value === "function")
        && /^bound /.test(x.get.name) && /^bound /.test(x.post.name));
    const RunningGameStore = findStore("getRunningGames");
    const ApplicationStreamingStore = findStore("getStreamerActiveStreamMetadata");
    const ChannelStore = findStore("getSortedPrivateChannels");
    const GuildChannelStore = findStore("getAllGuilds");
    const FluxDispatcher = findStore("dispatch");
    if (!QuestsStore || !api) throw new Error("Discord's quest store or HTTP client was not found. Reload Discord and try again.");
    const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "PLAY_ON_XBOX", "PLAY_ON_PLAYSTATION", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE", "ACHIEVEMENT_IN_ACTIVITY"];
    const isApp = typeof DiscordNative !== "undefined";
    const controller = new AbortController();
    const signal = controller.signal;
    const pauseEvents = new EventTarget();
    let taskCleanup = () => {};

    function normalizeStatus(raw = {}) {
        const status = { ...raw };
        for (const [camel, snake] of [["enrolledAt", "enrolled_at"], ["completedAt", "completed_at"], ["claimedAt", "claimed_at"], ["questId", "quest_id"], ["streamProgressSeconds", "stream_progress_seconds"]]) {
            const value = raw[camel] ?? raw[snake];
            if (value !== undefined) status[camel] = value;
        }
        return status;
    }
    function normalizeQuest(raw) {
        if (!raw?.id || !raw.config) return null;
        const config = raw.config;
        return {
            ...raw, id: String(raw.id),
            config: {
                ...config,
                configVersion: config.configVersion ?? config.config_version,
                startsAt: config.startsAt ?? config.starts_at,
                expiresAt: config.expiresAt ?? config.expires_at,
                taskConfig: config.taskConfigV2 ?? config.task_config_v2 ?? config.taskConfig ?? config.task_config,
                messages: { ...config.messages, questName: config.messages?.questName ?? config.messages?.quest_name ?? config.application?.name ?? String(raw.id) }
            },
            userStatus: normalizeStatus(raw.userStatus ?? raw.user_status ?? {})
        };
    }
    function updateStatus(quest, response) {
        const raw = response?.userStatus ?? response?.user_status ?? response;
        if (!raw || typeof raw !== "object") return;
        const next = normalizeStatus(raw);
        quest.userStatus = { ...quest.userStatus, ...next, progress: { ...quest.userStatus.progress, ...next.progress } };
    }
    function progressValue(quest, task) {
        const value = quest.userStatus.progress?.[task];
        const legacy = quest.config.configVersion === 1 && ["PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP"].includes(task)
            ? quest.userStatus.streamProgressSeconds : 0;
        const number = Number(value?.value ?? value ?? legacy ?? 0);
        return Number.isFinite(number) ? Math.max(0, number) : 0;
    }
    function activeQuest(quest) {
        const expires = Date.parse(quest.config.expiresAt);
        const starts = Date.parse(quest.config.startsAt);
        return !quest.preview && !quest.userStatus.completedAt
            && (!quest.config.expiresAt || (Number.isFinite(expires) && expires > Date.now()))
            && (!quest.config.startsAt || (Number.isFinite(starts) && starts <= Date.now()));
    }
    function loadedQuests() {
        const quests = QuestsStore.quests ?? QuestsStore.getQuests?.();
        if (!quests) return [];
        if (Array.isArray(quests)) return quests;
        if (typeof quests.values === "function") return [...quests.values()];
        return Object.values(quests);
    }
    function assertActive(quest) {
        signal.throwIfAborted();
        if (quest.config.expiresAt && Date.parse(quest.config.expiresAt) <= Date.now()) throw new Error("Quest expired.");
    }
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    function sleep(ms) {
        signal.throwIfAborted();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
            const cancel = () => { clearTimeout(timer); reject(signal.reason); };
            signal.addEventListener("abort", cancel, { once: true });
        });
    }
    async function checkpoint() {
        signal.throwIfAborted();
        while (OverlayUI.state.isPaused) await sleep(250);
        signal.throwIfAborted();
    }
    function cancellable(promise, requestSignal = signal) {
        return new Promise((resolve, reject) => {
            let timer;
            const finish = (callback, value) => {
                clearTimeout(timer);
                requestSignal?.removeEventListener("abort", cancel);
                callback(value);
            };
            const cancel = () => finish(reject, requestSignal.reason);
            timer = setTimeout(() => finish(reject, new Error("Request timed out after 30 seconds.")), 30000);
            requestSignal?.addEventListener("abort", cancel, { once: true });
            Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
            if (requestSignal?.aborted) cancel();
        });
    }
    async function request(method, options, cleanupRequest = false) {
        for (let attempt = 0; ; attempt++) {
            if (!cleanupRequest) await checkpoint();
            try {
                const fn = method === "del" ? api.del ?? api.delete : api[method];
                const response = await cancellable(fn.call(api, { timeout: 30000, ...options }), cleanupRequest ? null : signal);
                if (!cleanupRequest) signal.throwIfAborted();
                if (response?.ok === false || response?.status >= 400) throw response;
                return response;
            } catch (error) {
                if (!cleanupRequest) signal.throwIfAborted();
                const body = error?.body ?? {};
                if (body.captcha_key || body.captcha_sitekey) throw new Error("Complete the CAPTCHA in Discord, then run AutoQuest again.");
                if (!cleanupRequest && error?.status === 429 && attempt < 3) {
                    const retry = Number(body.retry_after ?? error.headers?.get?.("Retry-After") ?? error.headers?.["retry-after"] ?? 5);
                    const seconds = Number.isFinite(retry) && retry >= 0 ? retry : 5;
                    OverlayUI.state.progress = "Rate limited. Retrying in " + Math.ceil(seconds) + "s...";
                    OverlayUI.update();
                    await sleep(seconds * 1000);
                    continue;
                }
                throw error instanceof Error ? error : new Error(error?.message || ("HTTP " + (error?.status ?? "request failed") + (body.message ? ": " + body.message : "")));
            }
        }
    }
    function showProgress(label, done, target) {
        OverlayUI.state.progress = label + ": " + Math.floor(done) + "/" + target;
        OverlayUI.state.percent = Math.max(0, Math.min(100, done / target * 100));
        OverlayUI.update();
    }

    const Logger = {
        info: (msg) => console.log(`%c[AutoQuest] %c${msg}`, "color: #5865F2; font-weight: bold;", "color: inherit;"),
        success: (msg) => console.log(`%c[AutoQuest] %c✔ ${msg}`, "color: #5865F2; font-weight: bold;", "color: #43B581; font-weight: bold;"),
        warn: (msg) => console.log(`%c[AutoQuest] %c⚠ ${msg}`, "color: #5865F2; font-weight: bold;", "color: #FAA61A;"),
        error: (msg, err) => console.log(`%c[AutoQuest] %c✖ ${msg}`, "color: #5865F2; font-weight: bold;", "color: #ED4245; font-weight: bold;", err || ""),
        step: (questName, step) => {
            console.log(`%c ${questName} %c ${step} `, "background: #5865F2; color: white; border-radius: 3px 0 0 3px; font-weight: bold;", "background: #4f545c; color: white; border-radius: 0 3px 3px 0;");
            OverlayUI.update();
        }
    };

    const OverlayUI = {
        state: { quests: [], currentIdx: -1, progress: "", percent: 0, isRunning: true, isPaused: false, isSticky: false, overall: "RUNNING" },
        init: () => {
            let container = document.getElementById('autoquest-overlay');
            if (container) container.remove();

            container = document.createElement('div');
            container.id = 'autoquest-overlay';
            container.className = 'riyo-ui';
            container.style = "position:fixed;top:64px;right:12px;z-index:10000;width:320px;height:32px;display:flex;justify-content:flex-end;pointer-events:none";

            const icon = document.createElement('button');
            icon.type = 'button';
            icon.setAttribute('aria-label', 'Pin AutoQuest monitor');
            icon.className = 'autoquest-icon';
            icon.setAttribute('aria-pressed', 'false');
            icon.innerHTML = riyoIcon('autoquest');
            icon.setAttribute('data-riyo-drag', '');

            const panel = document.createElement('div');
            panel.className = 'autoquest-panel';
            panel.style.display = 'none';

            const show = () => { panel.style.display = 'block'; panel.style.opacity = '1'; };
            const hide = () => {
                if (OverlayUI.state.isSticky || container.contains(document.activeElement)) return;
                panel.style.opacity = '0'; panel.style.display = 'none';
            };
            container.onmouseenter = container.onfocusin = show;
            container.onmouseleave = container.onfocusout = hide;
            icon.onclick = e => {
                e.stopPropagation();
                OverlayUI.state.isSticky = !OverlayUI.state.isSticky;
                icon.setAttribute('aria-pressed', String(OverlayUI.state.isSticky));
                show(); OverlayUI.update();
            };
            container.appendChild(icon);
            container.appendChild(panel);
            container.__stop = () => { if (!signal.aborted) stopRun(); };
            riyoMountPanel(container, 'autoquest', 300);
        },
        update: () => {
            const panel = document.querySelector('#autoquest-overlay .autoquest-panel');
            if (!panel) return;

            const { quests, currentIdx, progress, percent, isRunning, isPaused, isSticky, overall } = OverlayUI.state;
            const label = isPaused ? 'Paused' : overall.charAt(0) + overall.slice(1).toLowerCase();
            let html = `${riyoTheme}<header class="riyo-header" tabindex="0">
                <strong class="riyo-title">${riyoHeading('autoquest')} ${isSticky ? riyoIcon('pin') : ''}</strong>
                <span class="riyo-badge" role="status" style="color:${overall === 'ERROR' ? '#ff9090' : isPaused ? '#e5c380' : '#bce4c8'}">${label}</span><button id="autoquest-btn-close" class="riyo-close" aria-label="Close AutoQuest and stop">${riyoIcon("close")}</button>
            </header>`;

            html += `<div class="autoquest-queue">`;

            if (overall === "ERROR") {
                html += `<div class="riyo-status" role="alert" style="color:var(--riyo-danger)">${escapeHtml(progress || "Unknown error")}</div>`;
            } else if (quests.length === 0) {
                html += `<div class="riyo-status">No active quests.</div>`;
            } else {
                quests.forEach((q, i) => {
                    // Read confirmed completion from Discord's current store.
                    const freshQuest = normalizeQuest(QuestsStore.getQuest(q.id));
                    const isDone = !!q.userStatus?.completedAt || !!freshQuest?.userStatus?.completedAt;
                    const isCurrent = i === currentIdx && !isDone;
                    html += `
                        <div class="autoquest-item" draggable="${isRunning && !isDone && i > currentIdx}" data-index="${i}" data-current="${isCurrent}" data-done="${isDone}" style="cursor:${isRunning && !isDone && i > currentIdx ? 'grab' : 'default'}">
                            <div class="riyo-quest-name">${escapeHtml(q.config.messages.questName)}</div>
                            <div class="riyo-quest-meta">
                                <span>${escapeHtml(isCurrent ? (progress || 'Processing...') : (isDone ? 'Completed' : (q.result || 'Waiting...')))}</span>
                                ${isCurrent ? `<span>${Math.round(percent)}%</span>` : ''}
                            </div>
                            ${isCurrent ? `
                                <div class="riyo-progress" role="progressbar" aria-label="Quest progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}">
                                    <div style="width:${percent}%"></div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
            }
            html += `</div>`;

            html += `
                <div class="riyo-footer">
                    <button id="autoquest-btn-pause">${riyoIcon(isPaused ? 'play' : 'pause')}${isPaused ? 'Resume' : 'Pause'}</button>
                    <button id="autoquest-btn-stop" class="riyo-danger">${riyoIcon('stop')}Stop</button>
                </div>
            `;

            panel.innerHTML = html;

            panel.querySelector("#autoquest-btn-close").onclick = () => document.getElementById("autoquest-overlay")?.remove();

            // Delegate queue drag events to the container.
            const queue = panel.querySelector('.autoquest-queue');
            if (queue) {
                let dragSrcIdx = null;

                queue.ondragstart = (e) => {
                    const item = e.target.closest('.autoquest-item');
                    if (!item || item.draggable === false) { e.preventDefault(); return; }
                    dragSrcIdx = parseInt(item.dataset.index);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', dragSrcIdx);
                    item.style.opacity = '0.5';
                };

                queue.ondragend = (e) => {
                    const item = e.target.closest('.autoquest-item');
                    if (item) item.style.opacity = '';
                    dragSrcIdx = null;
                    panel.querySelectorAll('.autoquest-item.drag-over').forEach(el => el.classList.remove('drag-over'));
                };

                queue.ondragover = (e) => {
                    const item = e.target.closest('.autoquest-item');
                    if (!item) return;
                    const targetIdx = parseInt(item.dataset.index);
                    const { currentIdx } = OverlayUI.state;
                    // Only waiting quests can be reordered.
                    if (targetIdx <= currentIdx) {
                        e.dataTransfer.dropEffect = 'none';
                        return;
                    }
                    e.preventDefault();
                    if (!item.classList.contains('drag-over')) {
                        panel.querySelectorAll('.autoquest-item.drag-over').forEach(el => el.classList.remove('drag-over'));
                        item.classList.add('drag-over');
                    }
                };

                queue.ondragleave = (e) => {
                    const item = e.target.closest('.autoquest-item');
                    if (item && !item.contains(e.relatedTarget)) item.classList.remove('drag-over');
                };

                queue.ondrop = (e) => {
                    const item = e.target.closest('.autoquest-item');
                    if (!item) return;

                    const targetIdx = parseInt(item.dataset.index);
                    const srcIdx = dragSrcIdx !== null ? dragSrcIdx : parseInt(e.dataTransfer.getData('text/plain'));
                    const { currentIdx } = OverlayUI.state;

                    // Only waiting quests can be reordered.
                    if (targetIdx <= currentIdx) {
                        return;
                    }

                    e.preventDefault();
                    item.classList.remove('drag-over');
                    if (srcIdx !== null && !isNaN(srcIdx) && srcIdx !== targetIdx && srcIdx > currentIdx && targetIdx > currentIdx && srcIdx < OverlayUI.state.quests.length && targetIdx < OverlayUI.state.quests.length) {
                        const movedItem = OverlayUI.state.quests.splice(srcIdx, 1)[0];
                        OverlayUI.state.quests.splice(targetIdx, 0, movedItem);
                        OverlayUI.update();
                    }
                };
            }

            panel.querySelector('#autoquest-btn-pause').disabled = !isRunning;
            panel.querySelector('#autoquest-btn-pause').onclick = (e) => {
                e.stopPropagation();
                if (!OverlayUI.state.isRunning) return;
                OverlayUI.state.isPaused = !OverlayUI.state.isPaused;
                pauseEvents.dispatchEvent(new Event('change'));
                OverlayUI.update();
            };
            panel.querySelector('#autoquest-btn-stop').onclick = (e) => {
                e.stopPropagation();
                stopRun();
            };
        }
    };

    function stopRun() {
        OverlayUI.state.isRunning = false;
        OverlayUI.state.isPaused = false;
        OverlayUI.state.overall = "STOPPED";
        controller.abort();
        taskCleanup();
        document.getElementById("autoquest-overlay")?.remove();
    }
    async function refreshQuest(quest) {
        const stored = normalizeQuest(QuestsStore.getQuest(quest.id));
        if (stored?.userStatus.completedAt) { updateStatus(quest, stored.userStatus); return; }
        const response = await request("get", { url: "/quests/@me" });
        const fresh = response.body?.quests?.find(item => String(item.id) === quest.id);
        if (fresh) updateStatus(quest, fresh.userStatus ?? fresh.user_status);
    }
    async function start() {
        OverlayUI.init();
        let rawQuests;
        let blockedUntil = null;
        try {
            const response = await request("get", { url: "/quests/@me" });
            if (!Array.isArray(response.body?.quests)) throw new Error("Unexpected quest list response.");
            rawQuests = response.body.quests;
            blockedUntil = response.body.quest_enrollment_blocked_until ?? response.body.questEnrollmentBlockedUntil;
        } catch (error) {
            signal.throwIfAborted();
            rawQuests = loadedQuests();
            if (!rawQuests.length) throw new Error("Could not load quests: " + error.message + ". Open Discover > Quests in Discord and try again.");
            Logger.warn("Could not refresh quests; using Discord's loaded quest list. " + error.message);
        }
        OverlayUI.state.quests = rawQuests.map(normalizeQuest).filter(quest =>
            quest && activeQuest(quest) && supportedTasks.some(task => quest.config.taskConfig?.tasks?.[task])
        );
        OverlayUI.update();
        for (let i = 0; i < OverlayUI.state.quests.length; i++) {
            await checkpoint();
            const quest = OverlayUI.state.quests[i];
            OverlayUI.state.currentIdx = i;
            OverlayUI.state.percent = 0;
            const questName = quest.config.messages.questName;
            try {
                assertActive(quest);
                const tasks = quest.config.taskConfig.tasks;
                const keys = Object.keys(tasks);
                const isAnd = String(quest.config.taskConfig.joinOperator ?? quest.config.taskConfig.join_operator ?? "OR").toUpperCase() === "AND";
                if (isAnd && keys.some(key => !supportedTasks.includes(key))) throw new Error("Quest requires an unsupported task.");
                const available = supportedTasks.filter(task => tasks[task] && (task !== "STREAM_ON_DESKTOP" || isApp));
                if (!available.length) { quest.result = "Requires Discord desktop"; continue; }
                if (isAnd && available.length !== keys.length) throw new Error("Quest requires a desktop-only task.");
                const taskNames = isAnd ? available : [available.find(task => progressValue(quest, task) < Number(tasks[task].target)) ?? available[0]];
                for (const taskName of taskNames) {
                    const target = Number(tasks[taskName].target);
                    if (!Number.isFinite(target) || target <= 0) throw new Error("Quest has an invalid progress target.");
                }
                if (!quest.userStatus.enrolledAt) {
                    if (Date.parse(blockedUntil) > Date.now()) { quest.result = "Enrollment blocked until " + blockedUntil; continue; }
                    const mobile = taskNames[0] === "WATCH_VIDEO_ON_MOBILE";
                    OverlayUI.state.progress = "Enrolling...";
                    OverlayUI.update();
                    const response = await request("post", {
                        url: "/quests/" + quest.id + "/enroll",
                        body: {
                            location: mobile ? 12 : 11, is_targeted: false, metadata_sealed: null,
                            ...(quest.traffic_metadata_raw !== undefined ? { traffic_metadata_raw: quest.traffic_metadata_raw } : {}),
                            ...(quest.traffic_metadata_sealed !== undefined ? { traffic_metadata_sealed: quest.traffic_metadata_sealed } : {})
                        }
                    });
                    updateStatus(quest, response.body);
                    if (!quest.userStatus.enrolledAt) await refreshQuest(quest);
                    if (!quest.userStatus.enrolledAt) throw new Error("Enrollment was not confirmed by Discord.");
                }
                Logger.step(questName, "STARTING");
                for (const task of taskNames) {
                    await checkpoint();
                    assertActive(quest);
                    const target = Number(tasks[task].target);
                    if (quest.userStatus.completedAt || progressValue(quest, task) >= target) continue;
                    await handleQuest(quest, task, target);
                }
                await checkpoint();
                if (!quest.userStatus.completedAt) await refreshQuest(quest);
                if (quest.userStatus.completedAt) {
                    quest.result = "Completed";
                    OverlayUI.state.percent = 100;
                    Logger.success(questName + " completed.");
                } else {
                    quest.result = "Pending confirmation";
                    Logger.warn(questName + ": progress sent, but Discord has not confirmed completion.");
                }
            } catch (error) {
                if (signal.aborted) throw error;
                quest.result = "Failed: " + (error.message || "Unknown error");
                Logger.error(questName + ": " + quest.result);
            } finally {
                taskCleanup();
                OverlayUI.update();
            }
            if (i + 1 < OverlayUI.state.quests.length) await sleep(3000);
        }
        OverlayUI.state.currentIdx = -1;
        OverlayUI.state.overall = "FINISHED";
        const quests = OverlayUI.state.quests;
        Logger.info("Queue finished: " + quests.filter(q => q.result === "Completed").length + "/" + quests.length + " confirmed completed.");
    }
    async function handleQuest(quest, task, target) {
        if (task === "WATCH_VIDEO" || task === "WATCH_VIDEO_ON_MOBILE") return handleVideoQuest(quest, task, target);
        if (task === "PLAY_ON_DESKTOP" && isApp && RunningGameStore && FluxDispatcher) return handleGameQuest(quest, target);
        if (["PLAY_ON_DESKTOP", "PLAY_ON_XBOX", "PLAY_ON_PLAYSTATION", "PLAY_ACTIVITY"].includes(task)) return handleHeartbeatQuest(quest, task, target);
        if (task === "STREAM_ON_DESKTOP") return handleStreamQuest(quest, target);
        if (task === "ACHIEVEMENT_IN_ACTIVITY") return handleAchievementQuest(quest, target);
        throw new Error("Unsupported task: " + task);
    }
    async function handleVideoQuest(quest, task, target) {
        const enrolledAt = Date.parse(quest.userStatus.enrolledAt);
        if (!Number.isFinite(enrolledAt)) throw new Error("Invalid enrollment timestamp.");
        let done = progressValue(quest, task);
        while (done < target && !quest.userStatus.completedAt) {
            await checkpoint();
            assertActive(quest);
            const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + 10;
            const next = Math.min(target, done + 7, maxAllowed);
            if (next > done) {
                const timestamp = Math.min(target, maxAllowed, next + Math.random());
                const response = await request("post", { url: "/quests/" + quest.id + "/video-progress", body: { timestamp } });
                updateStatus(quest, response.body);
                done = Math.max(next, progressValue(quest, task));
                showProgress("Watching video", done, target);
            }
            if (done < target && !quest.userStatus.completedAt) await sleep(7000);
        }
        // Never force the final timestamp after Stop or before its allowed wall-clock time.
        if (!quest.userStatus.completedAt) {
            const response = await request("post", { url: "/quests/" + quest.id + "/video-progress", body: { timestamp: target } });
            updateStatus(quest, response.body);
        }
    }
    async function handleHeartbeatQuest(quest, task, target) {
        const applicationId = quest.config.application?.id;
        let body;
        if (task === "PLAY_ACTIVITY") {
            const privateChannel = ChannelStore?.getSortedPrivateChannels()?.[0];
            const guild = Object.values(GuildChannelStore?.getAllGuilds() ?? {}).find(value => value?.VOCAL?.length);
            const channelId = privateChannel?.id ?? (typeof privateChannel === "string" ? privateChannel : null) ?? guild?.VOCAL?.[0]?.channel?.id;
            if (!channelId) throw new Error("No usable DM or voice channel was found.");
            body = { stream_key: "call:" + channelId + ":1" };
        } else {
            if (!applicationId) throw new Error("Quest has no application ID.");
            body = { application_id: applicationId };
        }
        let lastProgress = progressValue(quest, task), changedAt = Date.now();
        const onPause = () => { changedAt = Date.now(); };
        pauseEvents.addEventListener("change", onPause);
        try {
            while (!quest.userStatus.completedAt && lastProgress < target) {
                await checkpoint();
                assertActive(quest);
                const response = await request("post", { url: "/quests/" + quest.id + "/heartbeat", body: { ...body, terminal: false } });
                updateStatus(quest, response.body);
                const done = progressValue(quest, task);
                showProgress(task === "PLAY_ACTIVITY" ? "Activity" : "Playing " + (quest.config.application?.name ?? "game"), done, target);
                if (quest.userStatus.completedAt || done >= target) break;
                if (done > lastProgress) { lastProgress = done; changedAt = Date.now(); }
                if (Date.now() - changedAt >= 180000) throw new Error("Discord reported no progress for 3 minutes.");
                await sleep(20000);
                if (OverlayUI.state.isPaused) { await checkpoint(); changedAt = Date.now(); }
            }
            const response = await request("post", { url: "/quests/" + quest.id + "/heartbeat", body: { ...body, terminal: true } });
            updateStatus(quest, response.body);
        } finally { pauseEvents.removeEventListener("change", onPause); }
    }
    async function waitForHeartbeat(quest, task, target, install, restore) {
        if (!FluxDispatcher) throw new Error("Discord's heartbeat dispatcher was not found.");
        let timer, heartbeat, abort, onPause;
        taskCleanup = restore;
        let done = progressValue(quest, task), changedAt = Date.now();
        try {
            await new Promise((resolve, reject) => {
                heartbeat = data => {
                    const status = data?.userStatus ?? data?.user_status;
                    const questId = data?.questId ?? data?.quest_id ?? status?.questId ?? status?.quest_id;
                    if (questId != null && String(questId) !== quest.id) return;
                    if (questId == null) {
                        const stored = normalizeQuest(QuestsStore.getQuest(quest.id));
                        if (!stored) return;
                        updateStatus(quest, stored.userStatus);
                    } else updateStatus(quest, status);
                    const next = progressValue(quest, task);
                    if (next > done) { done = next; changedAt = Date.now(); }
                    showProgress(task === "STREAM_ON_DESKTOP" ? "Streaming" : "Playing game", next, target);
                    if (quest.userStatus.completedAt || next >= target) resolve();
                };
                abort = () => reject(signal.reason);
                onPause = () => {
                    try {
                        if (OverlayUI.state.isPaused) restore();
                        else { changedAt = Date.now(); install(); }
                    } catch (error) { reject(error); }
                };
                FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", heartbeat);
                signal.addEventListener("abort", abort, { once: true });
                pauseEvents.addEventListener("change", onPause);
                timer = setInterval(() => {
                    if (OverlayUI.state.isPaused) return;
                    try {
                        assertActive(quest);
                        if (Date.now() - changedAt >= 180000) throw new Error("No matching quest progress for 3 minutes. Check Discord's quest requirements.");
                    } catch (error) { reject(error); }
                }, 1000);
                signal.throwIfAborted();
                if (!OverlayUI.state.isPaused) install();
            });
        } finally {
            clearInterval(timer);
            if (heartbeat) FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", heartbeat);
            signal.removeEventListener("abort", abort);
            pauseEvents.removeEventListener("change", onPause);
            restore();
            taskCleanup = () => {};
        }
    }
    async function handleGameQuest(quest, target) {
        const applicationId = quest.config.application?.id;
        if (!applicationId) throw new Error("Quest has no application ID.");
        const response = await request("get", { url: "/applications/public?application_ids=" + encodeURIComponent(applicationId) });
        const app = response.body?.find(value => String(value.id) === String(applicationId)) ?? response.body?.[0];
        if (!app) throw new Error("Application details were not returned.");
        const exeName = app.executables?.find(value => value.os === "win32")?.name?.replace(">", "") ?? "game.exe";
        const pid = Math.floor(Math.random() * 30000) + 1000;
        const fakeGame = {
            cmdLine: "C:\\Program Files\\" + app.name + "\\" + exeName, exeName,
            exePath: "c:/program files/" + (app.name ?? "game").toLowerCase() + "/" + exeName,
            hidden: false, isLauncher: false, id: applicationId, name: app.name,
            pid, pidPath: [pid], processName: app.name, start: Date.now()
        };
        const originalGames = RunningGameStore.getRunningGames;
        const originalPid = RunningGameStore.getGameForPID;
        const fakeGames = () => [...originalGames.call(RunningGameStore), fakeGame];
        const fakePid = value => String(value) === String(pid) ? fakeGame : originalPid.call(RunningGameStore, value);
        let installed = false;
        const install = () => {
            if (installed) return;
            if (RunningGameStore.getRunningGames !== originalGames || RunningGameStore.getGameForPID !== originalPid) throw new Error("Another script changed the game store while paused.");
            RunningGameStore.getRunningGames = fakeGames;
            RunningGameStore.getGameForPID = fakePid;
            installed = true;
            FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [], added: [fakeGame], games: fakeGames() });
        };
        const restore = () => {
            if (!installed) return;
            installed = false;
            if (RunningGameStore.getRunningGames === fakeGames) RunningGameStore.getRunningGames = originalGames;
            if (RunningGameStore.getGameForPID === fakePid) RunningGameStore.getGameForPID = originalPid;
            FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: RunningGameStore.getRunningGames() });
        };
        OverlayUI.state.progress = "Waiting for Discord heartbeat...";
        OverlayUI.update();
        await waitForHeartbeat(quest, "PLAY_ON_DESKTOP", target, install, restore);
    }
    async function handleStreamQuest(quest, target) {
        if (!isApp || !ApplicationStreamingStore) throw new Error("Streaming quests require Discord desktop.");
        const original = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
        const realStream = original.call(ApplicationStreamingStore);
        if (!realStream) throw new Error("Start a real stream in a voice channel before running this quest.");
        const applicationId = quest.config.application?.id;
        if (!applicationId) throw new Error("Quest has no application ID.");
        const pid = realStream.pid ?? Math.floor(Math.random() * 30000) + 1000;
        const fake = () => ({ ...realStream, id: applicationId, pid });
        const install = () => {
            if (ApplicationStreamingStore.getStreamerActiveStreamMetadata !== original) throw new Error("Another script changed the stream store while paused.");
            ApplicationStreamingStore.getStreamerActiveStreamMetadata = fake;
        };
        const restore = () => { if (ApplicationStreamingStore.getStreamerActiveStreamMetadata === fake) ApplicationStreamingStore.getStreamerActiveStreamMetadata = original; };
        await waitForHeartbeat(quest, "STREAM_ON_DESKTOP", target, install, restore);
    }
    async function fetchActivity(url, options, json = false) {
        await checkpoint();
        const activityController = new AbortController();
        const cancel = () => activityController.abort(signal.reason);
        signal.addEventListener("abort", cancel, { once: true });
        const timer = setTimeout(() => activityController.abort(new Error("Activity request timed out after 30 seconds.")), 30000);
        try {
            signal.throwIfAborted();
            const response = await fetch(url, { ...options, signal: activityController.signal });
            if (!response.ok) throw new Error("Activity request failed: HTTP " + response.status);
            if (json) return await response.json();
            await response.body?.cancel();
        } finally {
            clearTimeout(timer);
            signal.removeEventListener("abort", cancel);
        }
    }
    async function handleAchievementQuest(quest, target) {
        const applicationId = String(quest.config.application?.id ?? "");
        if (!/^\d+$/.test(applicationId)) throw new Error("Quest has an invalid activity application ID.");
        const before = (await request("get", { url: "/oauth2/tokens" })).body;
        if (!Array.isArray(before)) throw new Error("Could not inspect existing activity authorizations.");
        const existing = new Set(before.map(token => String(token.id)));
        let authorizationAttempted = false;
        try {
            OverlayUI.state.progress = "Authorizing activity...";
            OverlayUI.update();
            const query = new URLSearchParams({ response_type: "code", client_id: applicationId, scope: "identify applications.commands applications.entitlements", state: "" });
            authorizationAttempted = true;
            const auth = await request("post", {
                url: "/oauth2/authorize?" + query,
                body: { permissions: "0", authorize: true, integration_type: 1, location_context: { guild_id: "10000", channel_id: "10000", channel_type: 10000 } }
            });
            const code = auth.body?.location ? new URL(auth.body.location).searchParams.get("code") : null;
            if (!code) throw new Error("Activity authorization returned no code.");
            const ticket = await request("post", { url: "/applications/" + applicationId + "/proxy-tickets", body: {} });
            if (!ticket.body?.ticket) throw new Error("Activity proxy ticket was not returned.");
            const referrer = new URL("https://" + applicationId + ".discordsays.com/");
            referrer.searchParams.set("instance_id", "autoquest-instance");
            referrer.searchParams.set("platform", "desktop");
            referrer.searchParams.set("discord_proxy_ticket", ticket.body.ticket);
            const base = "https://" + applicationId + ".discordsays.com/.proxy/acf";
            // Browser/Electron CSP, CORS, and forbidden headers still apply; report failures rather than claiming completion.
            const headers = { "Content-Type": "application/json", "X-Discord-Quest-ID": quest.id, Referer: referrer.href };
            await checkpoint();
            const token = (await fetchActivity(base + "/authorize", { method: "POST", headers, body: JSON.stringify({ code }) }, true)).token;
            if (!token) throw new Error("Activity authorization returned no token.");
            await checkpoint();
            OverlayUI.state.progress = "Reporting achievement...";
            OverlayUI.update();
            await fetchActivity(base + "/quest/progress", {
                method: "POST", headers: { ...headers, "X-Auth-Token": token }, body: JSON.stringify({ progress: target })
            });
            signal.throwIfAborted();
        } finally {
            if (authorizationAttempted) {
                try {
                    // Cleanup may run after Stop, but only revoke grants created by this run.
                    const tokens = (await request("get", { url: "/oauth2/tokens" }, true)).body;
                    if (!Array.isArray(tokens)) throw new Error("Unexpected authorization list.");
                    for (const token of tokens) {
                        if (String(token.application?.id) === applicationId && !existing.has(String(token.id))) {
                            await request("del", { url: "/oauth2/tokens/" + encodeURIComponent(token.id) }, true);
                        }
                    }
                } catch (error) { Logger.warn("Could not clean up the new activity authorization. Check Authorized Apps in Discord. " + error.message); }
            }
        }
    }
    const run = { state: OverlayUI.state, stop: stopRun, done: null };
    window.__riyoAutoQuest = run;
    run.done = start().catch(error => {
        if (!signal.aborted) {
            OverlayUI.state.overall = "ERROR";
            OverlayUI.state.progress = error.message || "Unknown error";
            Logger.error(OverlayUI.state.progress);
        }
    }).finally(() => {
        taskCleanup();
        OverlayUI.state.currentIdx = -1;
        OverlayUI.state.isRunning = false;
        OverlayUI.state.isPaused = false;
        OverlayUI.update();
    });
    await run.done;
    });
})().catch(error => console.error("[AutoQuest]", error.message || error));
