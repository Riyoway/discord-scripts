// Badge — game time, game variety, stream hours, and HypeSquad, one panel.
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

    return riyoRunScript("badge", async () => {
        const OLD_ID = "riyo-badge-panel";
        const previous = document.getElementById(OLD_ID);
        if (previous) {
            previous.__stop?.();
            previous.remove();
            return;
        }

        const LOCK = "__badgeNaturalPresence";
        const MIN_CHANGE_MS = 23 * 60 * 1000;
        const MAX_CHANGE_MS = 38 * 60 * 1000;
        const RECENT_HISTORY_SIZE = 100;
        const GAMES_URL = "https://cdn.discordapp.com/detectables/games.json";
        const LS_GUILD = "riyo-scripts:badge:guild";
        const LS_CHANNEL = "riyo-scripts:badge:channel";
        const HOUSES = { 1: "Bravery", 2: "Brilliance", 3: "Balance" };

        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const shuffle = input => {
            const a = [...input];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };
        const clampNumber = (value, min, max, fallback) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        };
        const clampInt = (value, min, max, fallback) => {
            const n = Math.floor(Number(value));
            if (!Number.isFinite(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        };
        const getName = game => game?.name || game?.names?.default || game?.display_name || `Game ${game?.id ?? "unknown"}`;
        const platform = /Linux/i.test(navigator.userAgent) ? "linux" : "win32";
        const executableFor = game => {
            const executables = Array.isArray(game?.executables) ? game.executables : [];
            return executables.find(exe => exe?.os === platform && exe.name)
                || executables.find(exe => exe?.os === "win32" && exe.name);
        };
        const lsGet = key => { try { return localStorage.getItem(key) || ""; } catch { return ""; } };
        const lsSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } };

        // ---- natural presence (adapted rotation: real client, real telemetry) ----
        function createPresence(games, config, onChange, onStop, onError) {
            if (window[LOCK]?.stop) throw new Error("Another presence session is running.");
            let req = window.Vencord?.Webpack?.wreq;
            if (!req?.c && typeof webpackChunkdiscord_app !== "undefined") {
                webpackChunkdiscord_app.push([[Symbol("badge")], {}, incoming => {
                    if (Object.keys(incoming?.c || {}).length > Object.keys(req?.c || {}).length) req = incoming;
                }]);
                webpackChunkdiscord_app.pop();
            }
            if (!req?.c) throw new Error("Discord webpack registry not found. Use the Discord desktop app.");
            const exports = Object.values(req.c).flatMap(module => {
                try {
                    const value = module?.exports;
                    return value ? [value, value.default, ...(typeof value === "object" ? Object.values(value) : [])] : [];
                } catch { return []; }
            }).filter(Boolean);
            const store = exports.find(value => {
                try {
                    return value.getName?.() === "RunningGameStore"
                        || Object.getPrototypeOf(value)?.constructor?.displayName === "RunningGameStore";
                } catch { return false; }
            });
            const dispatcher = exports.find(value => typeof value.dispatch === "function" && typeof value.subscribe === "function" && value._subscriptions);
            if (!store || !dispatcher || typeof store.getRunningGames !== "function" || typeof store.getGameForPID !== "function") {
                throw new Error("Discord desktop RunningGameStore/Dispatcher not found.");
            }
            const keys = ["getRunningGames", "getGameForPID", "getVisibleGame", "getVisibleRunningGames", "getCandidateGames"];
            const originals = new Map(keys.filter(key => typeof store[key] === "function").map(key => [key, {
                fn: store[key], descriptor: Object.getOwnPropertyDescriptor(store, key)
            }]));
            const patches = new Map();
            let pid = 45000 + Math.floor(Math.random() * 10000);
            const usedPids = new Set((store.getRunningGames() || []).map(game => game?.pid));
            while (usedPids.has(pid)) pid++;
            const realGames = () => (originals.get("getRunningGames").fn.call(store) || []).filter(game => game?.pid !== pid);
            const history = [];
            const shown = new Set();
            const deadline = Date.now() + config.totalHours * 3600000;
            let current = null, index = -1, timer = null, active = true, controller;
            const patch = (key, fn) => {
                patches.set(key, fn);
                store[key] = fn;
                if (store[key] !== fn) throw new Error(`Could not patch RunningGameStore.${key}.`);
            };
            const remove = game => {
                if (!game) return;
                dispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", added: [], removed: [game], games: realGames() });
                dispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", socketId: null, pid, activity: null });
            };
            const stop = (message = "Stopped.") => {
                if (!active) return;
                active = false;
                clearTimeout(timer);
                const previous = current;
                current = null;
                for (const [key, fn] of patches) {
                    if (store[key] !== fn) continue;
                    const { descriptor } = originals.get(key);
                    if (descriptor) Object.defineProperty(store, key, descriptor);
                    else delete store[key];
                }
                try { remove(previous); }
                catch (error) { console.error("[badge] Cleanup notification failed:", error); }
                finally {
                    if (window[LOCK] === controller) delete window[LOCK];
                    onStop(message);
                }
            };
            const next = () => {
                if (!active) return;
                clearTimeout(timer);
                if (Date.now() >= deadline) { stop("Session finished: time limit reached."); return; }
                try {
                    const blocked = new Set(history);
                    blocked.add(index);
                    let candidates = games.map((_, i) => i).filter(i => !blocked.has(i));
                    if (!candidates.length) {
                        history.length = 0;
                        candidates = games.map((_, i) => i).filter(i => i !== index);
                    }
                    index = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : 0;
                    history.push(index);
                    while (history.length > Math.min(RECENT_HISTORY_SIZE, Math.max(0, games.length - 1))) history.shift();
                    const previous = current;
                    current = null;
                    remove(previous);
                    const game = games[index];
                    const slug = getName(game).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || String(game.id);
                    const executable = executableFor(game).name.replaceAll("\\", "/").split("/").pop();
                    current = {
                        id: String(game.id), name: getName(game), pid, pidPath: [pid], processName: executable,
                        start: Date.now(), exeName: executable, exePath: `/synthetic/games/${slug}/${executable}`,
                        cmdLine: `/synthetic/games/${slug}/${executable}`, executables: [{ os: platform, name: executable, is_launcher: false }],
                        windowHandle: 0, fullscreenType: 0, overlay: false, sandboxed: false, hidden: false, isLauncher: false
                    };
                    dispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", added: [current], removed: [], games: store.getRunningGames() });
                    dispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", socketId: null, pid, activity: {
                        name: current.name, type: 0, details: null, state: null, timestamps: { start: current.start }, assets: null
                    } });
                    shown.add(current.id);
                    let delay = MIN_CHANGE_MS + Math.floor(Math.random() * (MAX_CHANGE_MS - MIN_CHANGE_MS + 1));
                    if (config.wobble) delay *= 0.97 + Math.random() * 0.06;
                    delay = Math.min(deadline - Date.now(), Math.min(MAX_CHANGE_MS, Math.max(MIN_CHANGE_MS, Math.round(delay))));
                    onChange(current, shown.size, Date.now() + delay);
                    timer = setTimeout(next, delay);
                } catch (error) {
                    stop("Stopped after an activity error.");
                    onError(error);
                }
            };
            controller = { stop, next, games, history };
            try {
                patch("getRunningGames", () => current ? [...realGames(), current] : realGames());
                patch("getGameForPID", value => value === pid && current ? current : originals.get("getGameForPID").fn.call(store, value));
                if (originals.has("getVisibleGame")) patch("getVisibleGame", () => current || originals.get("getVisibleGame").fn.call(store));
                for (const key of ["getVisibleRunningGames", "getCandidateGames"]) {
                    if (originals.has(key)) patch(key, () => {
                        const real = (originals.get(key).fn.call(store) || []).filter(game => game?.pid !== pid);
                        return current ? [...real, current] : real;
                    });
                }
                window[LOCK] = controller;
                next();
                return active ? controller : null;
            } catch (error) {
                stop("Could not start game presence.");
                throw error;
            }
        }

        // ---- instant spoof (fabricated /science, backdated, minutes not days) ----
        const instant = { sp: "", analyticsToken: "", uid: "", stopFlag: false };
        const readToken = () => {
            let raw = null;
            try { raw = localStorage.getItem("token"); } catch { return ""; }
            if (!raw) return "";
            try { raw = JSON.parse(raw); } catch { /* use raw */ }
            return String(raw).replace(/^"|"$/g, "").replace(/^'|'$/g, "");
        };
        const ensureAuth = status => new Promise((resolve, reject) => {
            const token = readToken();
            if (!token) { reject(new Error("No account token in this session.")); return; }
            if (instant.sp && instant.analyticsToken) { resolve(token); return; }
            status("Waiting for x-super-properties: switch channel once…");
            const f = window.fetch;
            window.fetch = function (u, o) {
                try {
                    const sp = o && o.headers && o.headers["x-super-properties"];
                    if (sp) { window.fetch = f; instant.sp = sp; go(); }
                } catch { /* ignore */ }
                return f.apply(this, arguments);
            };
            const go = async () => {
                try {
                    status("Fetching analytics token…");
                    const res = await f("/api/v9/users/@me?with_analytics_token=true", {
                        headers: { authorization: token, "x-super-properties": instant.sp }
                    });
                    if (!res.ok) throw new Error("users/@me rejected: HTTP " + res.status);
                    const me = await res.json();
                    if (!me.analytics_token) throw new Error("No analytics_token in response.");
                    instant.analyticsToken = me.analytics_token;
                    instant.uid = me.id;
                    resolve(token);
                } catch (error) { reject(error); }
            };
        });
        const postScience = (token, events) => fetch("/api/v9/science", {
            method: "POST",
            headers: { authorization: token, "content-type": "application/json", "x-super-properties": instant.sp },
            body: JSON.stringify({ token: instant.analyticsToken, events })
        });
        const buildGameEvents = (games, dur, hb, sig, seq) => {
            const evs = [];
            for (const g of games) {
                const sid = crypto.randomUUID(), t = Date.now(), s = t - dur;
                const base = { client_heartbeat_session_id: hb, launch_signature: sig, client_app_state: "focused" };
                evs.push({ type: "running_game_heartbeat", properties: { ...base,
                    client_track_timestamp: s, event_sequence_number: seq.n++,
                    game_id: g.id, game_name: g.name, game_metadata: null,
                    game_executable: g.exe, game_detection_enabled: true,
                    initial_heartbeat: true, final_heartbeat: false,
                    game_session_id: sid, duration_tracked_ms: 0,
                    rtc_connection_id: null, media_session_id: null, client_send_timestamp: s } });
                evs.push({ type: "launch_game", properties: { ...base,
                    client_track_timestamp: s, event_sequence_number: seq.n++,
                    game: g.name, game_id: g.id, verified: true, elevated: false,
                    is_launcher: false, game_platform: "desktop",
                    detection_method: "verified_game",
                    is_overlay_enabled: false, is_overlay_game_enabled: true,
                    is_overlay_game_source: "OOP_DEFAULT_DATABASE",
                    fullscreenType: "UNKNOWN", hardware_display_count: 1,
                    overlay_method: "Disabled", activity_status_enabled: true,
                    activity_status_shared_guilds: [], current_user_status: "online",
                    game_detection_enabled: true, executable_path: g.exe,
                    voice_channel_id: null, voice_channel_type: null,
                    voice_channel_bitrate: null, voice_channel_guild_id: null,
                    hidden_by_distributor: false, game_metadata: null,
                    client_performance_cpu: null, client_performance_memory: null,
                    cpu_core_count: null, accessibility_features: 0,
                    rendered_locale: "en-US", client_rtc_state: null, client_send_timestamp: s } });
                evs.push({ type: "running_game_heartbeat", properties: { ...base,
                    client_track_timestamp: t, event_sequence_number: seq.n++,
                    game_id: g.id, game_name: g.name, game_metadata: null,
                    game_executable: g.exe, game_detection_enabled: true,
                    initial_heartbeat: false, final_heartbeat: true,
                    game_session_id: sid, duration_tracked_ms: dur,
                    rtc_connection_id: null, media_session_id: null, client_send_timestamp: t } });
            }
            return evs;
        };
        const buildStreamEvents = (guildId, channelId, dur, hb, sig, seq) => {
            const t = Date.now(), s = t - dur, secs = Math.floor(dur / 1000), ratio = dur / 70000;
            const rtc = crypto.randomUUID(), mid = crypto.randomUUID(), par = crypto.randomUUID();
            const base = ts => ({
                client_heartbeat_session_id: hb, launch_signature: sig,
                client_performance_cpu: 9.9, client_performance_memory: 1832152,
                cpu_core_count: 16, accessibility_features: 34078976,
                rendered_locale: "en-US", client_rtc_state: "RTC_CONNECTED",
                client_app_state: "focused", client_viewport_width: 475,
                client_viewport_height: 711, client_send_timestamp: ts });
            return [
                { type: "media_session_joined", properties: { ...base(s),
                    client_track_timestamp: s, event_sequence_number: seq.n++,
                    guild_id: guildId, channel_id: channelId, channel_type: 2,
                    rtc_connection_id: rtc, context: "stream",
                    voice_backend_version: "0.22.2", rtc_backend_version: "1.7.1",
                    media_session_id: mid, parent_media_session_id: par } },
                { type: "video_stream_started", properties: { ...base(s),
                    client_track_timestamp: s, event_sequence_number: seq.n++,
                    channel_id: channelId, rtc_connection_id: rtc,
                    media_session_id: mid, parent_media_session_id: par,
                    sender_user_id: instant.uid, context: "stream", guild_id: guildId,
                    stream_region: "japan", stream_source_type: "window", guild_region: "c-nrt",
                    participant_type: "streamer", video_layout: "theatre",
                    client_event_source: "APP",
                    voice_backend_version: "0.22.2", rtc_worker_backend_version: "1.7.1",
                    video_input_resolution: 1440, video_input_frame_rate: 60,
                    soundshare_session: `4${String(s).slice(-4)}.${Math.floor(s / 1000)}`,
                    share_game_name: null, share_game_id: null,
                    quality_preset: 1, connection_type: "unknown",
                    effective_connection_speed: "4g", duration_go_live_modal: 1344,
                    source_location_stack: ["rtc panel", "go live modal v2"] } },
                { type: "voice_disconnect", properties: { ...base(t),
                    client_track_timestamp: t, event_sequence_number: seq.n++,
                    guild_id: guildId, channel_id: channelId, channel_type: 2,
                    rtc_connection_id: rtc, context: "stream",
                    voice_backend_version: "0.22.2", rtc_worker_backend_version: "1.7.1",
                    hostname: "c-nrt12-96fd5c69.discord.media", port: 19315,
                    protocol: "udp", reconnect: false, reason: "Force Close",
                    duration: dur, packets_sent: Math.floor(3453 * ratio),
                    packets_sent_lost: 0, packets_received: 0, packets_received_lost: 0,
                    bytes_sent: Math.floor(93231 * ratio), bytes_received: 0,
                    channel_bitrate: 64000, connect_count: 1,
                    duration_listening_ms: 0, duration_speaking_ms: dur,
                    duration_participation_ms: dur, duration_connected_ms: dur,
                    duration_muted_ms: dur, duration_deafened_ms: 0,
                    duration_listening: 0, duration_speaking: secs,
                    duration_participation: secs, duration_connected: secs,
                    duration_connection_type_unknown: secs,
                    duration_effective_connection_speed_4g: secs,
                    media_session_id: mid, parent_media_session_id: par,
                    participant_type: "streamer", audio_input_mode: "VOICE_ACTIVITY",
                    encryption_mode: "aead_aes256_gcm_rtpsize" } },
                { type: "screenshare_finished", properties: { ...base(t),
                    client_track_timestamp: t, event_sequence_number: seq.n++,
                    hybrid_graphics_capture_frames: Math.floor(4188 * ratio),
                    hybrid_capture_method_switches: 2,
                    total_frames: Math.floor(4188 * ratio),
                    total_frames_unique: Math.floor(1166 * ratio),
                    desktop_capturer_type: "screen",
                    media_session_id: mid, rtc_connection_id: rtc,
                    context: "stream", activity: 30.0,
                    soundshare_session: `4${String(s).slice(-4)}.${Math.floor(s / 1000)}`,
                    picker_type_used: "internal", duration: null,
                    discord_is_elevated: false, target_window_elevated: false } }
            ];
        };

        // ---- hypesquad (real membership API, not spoofed) ----
        const findApi = () => {
            if (typeof webpackChunkdiscord_app === "undefined") throw new Error("Discord webpack not found.");
            const wreq = webpackChunkdiscord_app.push([[Symbol("badge-hype")], {}, r => r]);
            webpackChunkdiscord_app.pop();
            const chunks = Object.entries(wreq.m);
            const findChunkByCode = (...codes) => {
                for (const [id, func] of chunks) {
                    let code = "";
                    try { code = func.toString(); } catch { continue; }
                    if (codes.every(c => code.includes(c))) return wreq(id);
                }
                return null;
            };
            // user's snippet looks for the HTTP utils chunk; fall back to any
            // chunk exporting get/post/del (chunk names differ per client build)
            for (const codes of [["HTTPUtils"], ["getAPIBaseURL", ".post", ".del"]]) {
                const mod = findChunkByCode(...codes);
                const api = mod && Object.values(mod).find(e => e?.get && e?.post && e?.del);
                if (api) return api;
            }
            throw new Error("API module not found.");
        };

        // ---- panel ----
        const panel = document.createElement("div");
        panel.id = OLD_ID;
        panel.className = "riyo-ui riyo-panel";
        panel.innerHTML = `
            ${riyoTheme}
            <header class="riyo-header" tabindex="0">
                <strong class="riyo-title">${riyoHeading('badge')}</strong>
                <button type="button" class="riyo-close" id="bd-close" aria-label="Close badge">${riyoIcon("close")}</button>
            </header>
            <style>.bd-app{display:flex;gap:12px;min-height:0}.bd-side{display:flex;flex-direction:column;gap:6px;min-width:132px}.bd-side button{justify-content:flex-start;font-size:12px;min-height:34px}.bd-side button[aria-pressed="true"]{background:#f5f5f5;color:#111;border-color:#f5f5f5}.bd-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;overflow:auto}</style>
            <div class="bd-app">
            <nav class="bd-side" aria-label="Badge sections">
                <button type="button" id="bd-nav-games" aria-pressed="true">${riyoIcon("clock")} Game</button>
                <button type="button" id="bd-nav-stream" aria-pressed="false">${riyoIcon("video")} Streaming</button>
                <button type="button" id="bd-nav-hype" aria-pressed="false">${riyoIcon("badge")} HypeSquad</button>
            </nav>
            <div class="bd-main">
            <div id="bd-view-games" class="riyo-stack">
            <fieldset class="riyo-segmented" aria-label="Activity mode">
                <label><input type="radio" name="bd-mode" id="bd-mode-instant" checked>${riyoIcon('play')}Instant</label>
                <label><input type="radio" name="bd-mode" id="bd-mode-natural">${riyoIcon('clock')}Natural</label>
            </fieldset>
            <p class="riyo-muted">Instant uses simulated activity. Natural runs in real time.</p>
            <div id="bd-box-instant" class="riyo-stack">
                <details class="riyo-details" open><summary>${riyoIcon("clock")}Game Time Badge</summary><div class="riyo-stack">
                <label class="riyo-label">Total game hours (0 = skip)<input id="bd-hours" type="number" min="0" step="0.5" value="5000"></label>
                <div class="riyo-options" id="bd-times">
                    <button type="button" id="bd-time-1"><img src="https://cdn.discordapp.com/assets/content/b75fcc4dd1c65dfd4169a203e21023453fd6fe853c9b5c1fd839781fda98e80d.svg" alt="" width="18" height="18">Casual 1h</button>
                    <button type="button" id="bd-time-5"><img src="https://cdn.discordapp.com/assets/content/f0f32cb2a0003475e443b76a7a2baf454356953ecb84195c7a08c3ce2fd95b70.svg" alt="" width="18" height="18">Recreational 5h</button>
                    <button type="button" id="bd-time-20"><img src="https://cdn.discordapp.com/assets/content/e0c82f41bcad94a2a52713800fbef7687d0d2c6a6066b09d5e5876156d086e1a.svg" alt="" width="18" height="18">Dedicated 20h</button>
                    <button type="button" id="bd-time-75"><img src="https://cdn.discordapp.com/assets/content/16f2aeb7465c99efce4d67d9333e3ddcf7435d6e60d2f5f93dc0c07bc7c5a69b.svg" alt="" width="18" height="18">Committed 75h</button>
                    <button type="button" id="bd-time-150"><img src="https://cdn.discordapp.com/assets/content/ba26e83fa68189b41837184e38706f41c288dd29ffba266035d1a5ad9adbae22.svg" alt="" width="18" height="18">Serious 150h</button>
                    <button type="button" id="bd-time-300"><img src="https://cdn.discordapp.com/assets/content/851b194288f1913ece6c8d99976519e48210580d6f42d994f21e37801611ad54.svg" alt="" width="18" height="18">Devoted 300h</button>
                    <button type="button" id="bd-time-500"><img src="https://cdn.discordapp.com/assets/content/8b10f5c0c30abbd521be5afc2e0dd4ec6da18bfbc689f06d93a51d06577cd84a.svg" alt="" width="18" height="18">Seasoned 500h</button>
                    <button type="button" id="bd-time-1000"><img src="https://cdn.discordapp.com/assets/content/d705628490898f2cc22d669cf8b415bc03fed1ddaf98a2a8cbd97442a509293c.svg" alt="" width="18" height="18">Ironclad 1kh</button>
                    <button type="button" id="bd-time-2000"><img src="https://cdn.discordapp.com/assets/content/2bddcbc9f9959dab805eb7196c8112ce9dc68b09766c8193ab499b1870e44ac7.svg" alt="" width="18" height="18">Unshakable 2kh</button>
                    <button type="button" id="bd-time-5000"><img src="https://cdn.discordapp.com/assets/content/457ce4e657f0ced23197891cc3d75b7de29cafa065cdb8cbb81060ac0e63b07f.svg" alt="" width="18" height="18">Eternal 5kh</button>
                </div>
                </div></details>
                <details class="riyo-details" open><summary>${riyoIcon("clock")}Game Variety Badge</summary><div class="riyo-stack">
                <label class="riyo-label">Max games (0 = all)<input id="bd-maxgames" type="number" min="0" step="1" value="0"></label>
                <div class="riyo-options" id="bd-vars">
                    <button type="button" id="bd-var-2"><img src="https://cdn.discordapp.com/assets/content/ed18d5976c01a4ea19f5a13af08f0547582405cbe48b098b0822e352b8e0a822.svg" alt="" width="18" height="18">Sampler 2</button>
                    <button type="button" id="bd-var-5"><img src="https://cdn.discordapp.com/assets/content/e450d5279537db06ee47a104af520b884adaa7ffc3ef2627157526bf1c58e840.svg" alt="" width="18" height="18">Dabbler 5</button>
                    <button type="button" id="bd-var-10"><img src="https://cdn.discordapp.com/assets/content/158a9d91b8ca9e96d4afeee38cd640fc51483a8196edb9af0c26e44727acafae.svg" alt="" width="18" height="18">Enthusiast 10</button>
                    <button type="button" id="bd-var-15"><img src="https://cdn.discordapp.com/assets/content/9e491942070007f64011ae4fc478926b96433698c07621fc43bafdd5efe83912.svg" alt="" width="18" height="18">Ranger 15</button>
                    <button type="button" id="bd-var-20"><img src="https://cdn.discordapp.com/assets/content/e25fc55814262150e154ddb1a2b55fc5ed8ed5ba2ff1a22a33d4a41e651e370a.svg" alt="" width="18" height="18">Explorer 20</button>
                    <button type="button" id="bd-var-30"><img src="https://cdn.discordapp.com/assets/content/542d5277e0001ea738d5eb57b247dcab9ce6e0c29493d5892203f6258fde55b9.svg" alt="" width="18" height="18">Adventurer 30</button>
                    <button type="button" id="bd-var-40"><img src="https://cdn.discordapp.com/assets/content/082e693cb9ce98b81af618978d449409efc6522b061bc0eac6e88a949fd888c6.svg" alt="" width="18" height="18">Voyager 40</button>
                    <button type="button" id="bd-var-60"><img src="https://cdn.discordapp.com/assets/content/6fc242e9e8259c471a5e4599cd09af5476e622a572ff235883173913bf506103.svg" alt="" width="18" height="18">Maverick 60</button>
                    <button type="button" id="bd-var-80"><svg aria-hidden="true" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"><path fill="#FF5B7A" d="m8.77 4.56-.5-.76c-.15-.23-.38-.34-.6-.29L5.8 4c-.4.1-.73.49-.88 1.03l-.24.79s-.15.5 0 .52M15.23 4.56l.5-.76c.15-.23.38-.34.6-.29L18.2 4c.4.1.73.49.88 1.03l.24.79s.15.5 0 .52"/><path fill="url(#bd-poly)" d="M20.44 8.21c-1-4.07-4.79-3.68-4.79-3.68h-7.3s-3.8-.39-4.79 3.68c-1 4.07-3.2 10.92.54 11.73 0 0 1.62.58 2.87-1.91 1.25-2.5 1.46-2.88 3.8-2.88h2.47c2.33 0 2.54.39 3.79 2.88 1.25 2.49 2.87 1.91 2.87 1.91 3.75-.81 1.54-7.66.54-11.73Z"/><path fill="#FFA8DE" d="m6.1 3.92-.3.07c-.4.1-.73.49-.88 1.03l-.24.79s-.15.5 0 .52l.19-.08c-.03-.14.2-.42.2-.42l.23-.82c.16-.54.4-1 .8-1.1Z"/><path fill="#fff" d="m20.53 9.16-.03-.1.04.1Z"/><path fill="#FFA8DE" d="M4.12 8.64c1-4.07 4.55-3.83 4.55-3.83h7.3s1.7-.17 3.12.93c-1.47-1.41-3.44-1.21-3.44-1.21h-7.3s-3.8-.39-4.79 3.68c-.9 3.68-2.8 9.64-.38 11.34-1.9-2 .08-7.41.94-10.91Z"/><path fill="#5C012F" d="M16.75 10.16c.58 0 1.06-.5 1.06-1.1 0-.6-.48-1.1-1.06-1.1-.6 0-1.07.5-1.07 1.1 0 .6.48 1.1 1.07 1.1ZM16.75 14.14c.58 0 1.06-.49 1.06-1.1 0-.6-.48-1.1-1.06-1.1-.6 0-1.07.5-1.07 1.1 0 .61.48 1.1 1.07 1.1ZM14.81 12.15c.6 0 1.07-.49 1.07-1.1 0-.6-.48-1.1-1.07-1.1-.59 0-1.06.5-1.06 1.1 0 .61.47 1.1 1.06 1.1ZM18.68 12.15c.59 0 1.06-.49 1.06-1.1 0-.6-.47-1.1-1.06-1.1-.6 0-1.07.5-1.07 1.1 0 .61.48 1.1 1.07 1.1Z"/><path fill="#FFB0DB" d="M12.98 5.83h-2.04a.76.76 0 0 0-.76.77c0 .42.34.76.76.76h2.04c.42 0 .75-.34.75-.76a.76.76 0 0 0-.75-.77Z"/><path fill="#5C012F" d="M9.43 10.07H8.19V8.83c0-.4-.32-.71-.7-.71h-.46c-.4 0-.7.32-.7.71v1.24H5.07a.7.7 0 0 0-.69.69v.5c0 .38.31.69.69.69h1.24v1.23c0 .4.32.71.7.71h.46c.4 0 .7-.32.7-.71v-1.23h1.25a.7.7 0 0 0 .69-.7v-.49a.7.7 0 0 0-.7-.7Z"/><defs><linearGradient id="bd-poly" x1="12" x2="12" y1="4.52" y2="20" gradientUnits="userSpaceOnUse"><stop offset=".46" stop-color="#FF1A29"/><stop offset=".9" stop-color="#FF66EC"/></linearGradient></defs></svg>Polymath 80</button>
                    <button type="button" id="bd-var-105"><img src="https://cdn.discordapp.com/assets/content/fcc34d343451505c642f3397cec2669a2de3a4a410fb968f794b3a1a0dcd1728.svg" alt="" width="18" height="18">Universalist 100+</button>
                    <button type="button" id="bd-var-0">All games</button>
                </div>
                </div></details>
                <progress id="bd-progress-instant" value="0" max="1"></progress>
                <div id="bd-status-instant" class="riyo-status" role="status">Ready.</div>
                <div class="riyo-row">
                    <button type="button" id="bd-stop-instant" class="riyo-danger" disabled>${riyoIcon("stop")} Stop</button>
                    <button type="button" id="bd-run-instant" class="riyo-primary">${riyoIcon("play")} Run</button>
                </div>
            </div>
            <div id="bd-box-natural" class="riyo-stack" hidden><div class="riyo-grid">
                <label class="riyo-label">Session limit (hours)<input id="bd-hours-n" type="number" min="1" max="100000" step="1" value="1000"></label>
                <label class="riyo-label">Game pool size<input id="bd-pool-n" type="number" min="1" max="20000" step="1" value="250"></label>
                </div><div class="riyo-options"><label class="riyo-check"><input type="checkbox" id="bd-wobble-n" checked> ±3% time wobble</label></div>
                <progress id="bd-progress-n" value="0" max="1"></progress>
                <div id="bd-status-n" class="riyo-status" role="status">Ready. Desktop app required.</div>
                <div class="riyo-row">
                    <button type="button" id="bd-stop-n" class="riyo-danger" disabled>${riyoIcon("stop")} Stop</button>
                    <button type="button" id="bd-start-n" class="riyo-primary">${riyoIcon("play")} Start</button>
                </div>
            </div>
            </div>
            <div id="bd-view-stream" class="riyo-stack" hidden>
                <details class="riyo-details" open><summary>${riyoIcon("video")}Streaming Badge</summary><div class="riyo-stack">
                <p class="riyo-muted">Currently unavailable: stream time is measured server-side, so simulated sessions do not count (verified).</p>
                <label class="riyo-label">Stream hours (0 = skip)<input id="bd-streamhours" type="number" min="0" step="0.5" value="0" disabled></label>
                <div class="riyo-options" id="bd-tiers">
                    <button type="button" id="bd-tier-1" disabled><img src="https://cdn.discordapp.com/assets/content/c56b451e3bf04181182c2529e9bd3659e569ea80f582858090007f0752401b38.svg" alt="" width="18" height="18">Newcomer 1h</button>
                    <button type="button" id="bd-tier-5" disabled><img src="https://cdn.discordapp.com/assets/content/2e25ba794f6f371ea0f52eb2d3c8fb2b04094a56f388515e13a9bd6d7949a018.svg" alt="" width="18" height="18">Fledgling 5h</button>
                    <button type="button" id="bd-tier-20" disabled><img src="https://cdn.discordapp.com/assets/content/4e847b4dca20fbf1c56d3a47cac3c9204f02113c9d5a270ebebdf12909c75848.svg" alt="" width="18" height="18">Breakout 20h</button>
                    <button type="button" id="bd-tier-75" disabled><img src="https://cdn.discordapp.com/assets/content/27d0e6939f13dcf113243fc9eac642b15e9764ad891e06c5ed78d45a17678582.svg" alt="" width="18" height="18">Standout 75h</button>
                    <button type="button" id="bd-tier-150" disabled><img src="https://cdn.discordapp.com/assets/content/af681483be2035f14b0f2bfe2e25a8944c97149172938888ca1008edbe037aad.svg" alt="" width="18" height="18">Trendsetter 150h</button>
                    <button type="button" id="bd-tier-300" disabled><img src="https://cdn.discordapp.com/assets/content/e69a0c86a476c9782ea1d3e7b5ba308eec3d9d6a3eae6ab8af3180f67d16b468.svg" alt="" width="18" height="18">Headliner 300h</button>
                    <button type="button" id="bd-tier-500" disabled><img src="https://cdn.discordapp.com/assets/content/06b6206db966635cf626651bdb94eacce5a23ab05dc7f600f7d31aa482b2058c.svg" alt="" width="18" height="18">Star 500h</button>
                    <button type="button" id="bd-tier-1000" disabled><img src="https://cdn.discordapp.com/assets/content/1a3b9120ecd64c342083c37980b225d29ebf4544da6ab546c9268f87904c9dfe.svg" alt="" width="18" height="18">Sensation 1kh</button>
                    <button type="button" id="bd-tier-2000" disabled><img src="https://cdn.discordapp.com/assets/content/85f714b90ed3ceb1e00e1f2069bf3ebd564962fa940c92540061537a045e54ab.svg" alt="" width="18" height="18">Visionary 2kh</button>
                    <button type="button" id="bd-tier-5000" disabled><img src="https://cdn.discordapp.com/assets/content/61331d04b7a9542b38bfa59583360c0b9b93c6496a04f99c0ab37fa1d83ec58a.svg" alt="" width="18" height="18">Phenomenon 5kh</button>
                </div>
                <label class="riyo-label">Guild ID (stream)<input id="bd-guild" value="${lsGet(LS_GUILD)}" disabled></label>
                <label class="riyo-label">Voice channel ID (stream)<input id="bd-channel" value="${lsGet(LS_CHANNEL)}" disabled></label>
                </div></details>
                <progress id="bd-progress-stream" value="0" max="1"></progress>
                <div id="bd-status-stream" class="riyo-status" role="status">Unavailable.</div>
                <div class="riyo-row">
                    <button type="button" id="bd-stop-stream" class="riyo-danger" disabled>${riyoIcon("stop")} Stop</button>
                    <button type="button" id="bd-run-stream" class="riyo-primary" disabled>${riyoIcon("play")} Run</button>
                </div>
            </div>
            <div id="bd-view-hype" class="riyo-stack" hidden>
            <div class="riyo-section riyo-section-title">${riyoIcon('badge')}HypeSquad</div>
            <p class="riyo-muted">Changes your real house membership.</p>
            <input id="bd-house" type="hidden" value="1">
            <fieldset class="riyo-segmented" aria-label="HypeSquad house">
                <label><input id="bd-house-1" type="radio" name="bd-house" value="1" checked><img src="https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png" alt="" width="18" height="18">Bravery</label>
                <label><input id="bd-house-2" type="radio" name="bd-house" value="2"><img src="https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png" alt="" width="18" height="18">Brilliance</label>
                <label><input id="bd-house-3" type="radio" name="bd-house" value="3"><img src="https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png" alt="" width="18" height="18">Balance</label>
            </fieldset>
            <div id="bd-status-hype" class="riyo-status" role="status">Not checked.</div>
            <div class="riyo-row">
                <button type="button" id="bd-leave">${riyoIcon("close")} Leave</button>
                <button type="button" id="bd-join" class="riyo-primary">${riyoIcon("play")} Join</button>
            </div>
            </div>
            </div>
            </div>
        `;
        riyoMountPanel(panel, 'badge');
        panel.style.width = "560px";
        panel.style.maxWidth = "calc(100vw - 32px)";
        const $ = id => panel.querySelector("#" + id);
        const showView = name => {
            for (const v of ["games", "stream", "hype"]) {
                $("bd-view-" + v).hidden = v !== name;
                $("bd-nav-" + v).setAttribute("aria-pressed", String(v === name));
            }
        };
        $("bd-nav-games").addEventListener("click", () => showView("games"));
        $("bd-nav-stream").addEventListener("click", () => showView("stream"));
        $("bd-nav-hype").addEventListener("click", () => showView("hype"));
        const statusI = $("bd-status-instant"), statusN = $("bd-status-n"), statusH = $("bd-status-hype");
        const boxI = $("bd-box-instant"), boxN = $("bd-box-natural");

        let gen = 0, natural = null, naturalTimer = null;
        const stopAll = () => {
            gen++;
            instant.stopFlag = true;
            try { natural?.stop(); } catch { /* ignore */ }
            clearTimeout(naturalTimer);
            natural = null;
        };
        window.addEventListener("pagehide", stopAll);
        panel.__stop = () => { stopAll(); window.removeEventListener("pagehide", stopAll); };
        $("bd-close").addEventListener("click", () => panel.remove());
        [1, 2, 3].forEach(house => $("bd-house-" + house).addEventListener("change", event => { if (event.target.checked) $("bd-house").value = event.target.value; }));
        $("bd-mode-instant").addEventListener("change", () => { boxI.hidden = false; boxN.hidden = true; });
        $("bd-mode-natural").addEventListener("change", () => { boxI.hidden = true; boxN.hidden = false; });
        for (const h of [1, 5, 20, 75, 150, 300, 500, 1000, 2000, 5000]) {
            $("bd-tier-" + h).addEventListener("click", () => { $("bd-streamhours").value = String(h); });
        }
        for (const n of [2, 5, 10, 15, 20, 30, 40, 60, 80, 105, 0]) {
            $("bd-var-" + n).addEventListener("click", () => { $("bd-maxgames").value = String(n); refreshTimeButtons(); });
        }
        const refreshTimeButtons = () => {
            // total must cover 0.5h per game; disable tiers that cannot
            const n = clampInt($("bd-maxgames").value, 0, 20000, 0);
            for (const h of [1, 5, 20, 75, 150, 300, 500, 1000, 2000, 5000]) {
                $("bd-time-" + h).disabled = n > 0 && h < n * 0.5;
            }
            // pull an impossible field value up to the minimum
            if (n > 0) {
                const cur = Number($("bd-hours").value);
                if (!Number.isFinite(cur) || cur < n * 0.5) $("bd-hours").value = String(n * 0.5);
            }
        };
        $("bd-maxgames").addEventListener("input", refreshTimeButtons);
        for (const h of [1, 5, 20, 75, 150, 300, 500, 1000, 2000, 5000]) {
            $("bd-time-" + h).addEventListener("click", () => { $("bd-hours").value = String(h); });
        }

        // instant run
        $("bd-run-instant").addEventListener("click", async () => {
            const id = ++gen;
            instant.stopFlag = false;
            $("bd-run-instant").disabled = true;
            $("bd-stop-instant").disabled = false;
            const progress = $("bd-progress-instant");
            try {
                const hours = clampNumber($("bd-hours").value, 0, 100000, 1);
                const maxGames = clampInt($("bd-maxgames").value, 0, 20000, 0);
                if (hours <= 0) throw new Error("Nothing to send: set total game hours.");
                if (natural) { try { natural.stop(); } catch { /* ignore */ } natural = null; }
                const token = await ensureAuth(t => { if (id === gen) statusI.textContent = t; });
                if (id !== gen) return;
                const hb = crypto.randomUUID(), sig = crypto.randomUUID(), seq = { n: 1 };
                // games
                if (hours > 0) {
                    statusI.textContent = "Loading game catalog…";
                    const raw = await (await fetch(GAMES_URL, { cache: "no-store" })).json();
                    const seen = new Set(), games = [];
                    for (const g of (Array.isArray(raw) ? raw : [])) {
                        const gid = String(g?.id || "");
                        if (!/^\d+$/.test(gid) || seen.has(gid)) continue;
                        const exe = (g.executables || []).find(e => e?.os === "win32" && e.name);
                        if (!exe) continue;
                        seen.add(gid);
                        games.push({ id: gid, name: g.name || "Unknown", exe: exe.name });
                    }
                    const list = maxGames > 0 ? games.slice(0, maxGames) : games;
                    if (!list.length) throw new Error("No games to send.");
                    const perGame = hours / list.length;
                    if (perGame < 0.5) throw new Error(`Needs ≥${(list.length * 0.5).toLocaleString()}h total for ${list.length.toLocaleString()} games (0.5h each).`);
                    const dur = Math.floor(perGame * 3600 * 1000);
                    progress.max = list.length; progress.value = 0;
                    let ok = 0;
                    for (let i = 0; i < list.length; i += 50) {
                        if (id !== gen || instant.stopFlag) throw new Error("Stopped.");
                        const chunk = list.slice(i, i + 50);
                        const res = await postScience(token, buildGameEvents(chunk, dur, hb, sig, seq));
                        if (id !== gen || instant.stopFlag) throw new Error("Stopped.");
                        if (res.status === 204) ok += chunk.length;
                        else if (res.status === 401 || res.status === 403) throw new Error("Rejected: HTTP " + res.status);
                        progress.value = Math.min(i + 50, list.length);
                        statusI.textContent = `Games ${Math.min(i + 50, list.length)}/${list.length} · ok ${ok}`;
                        await sleep(1000);
                    }
                    statusI.textContent = `Games done: ${ok}/${list.length}.`;
                }
                // stream sending is disabled: stream time is measured server-side,
                // so fabricated sessions do not count (verified). builders kept for reference.
                if (id === gen && !instant.stopFlag) statusI.textContent += " All done.";
            } catch (error) {
                if (id === gen) statusI.textContent = error?.message || String(error);
            } finally {
                if (id === gen) { $("bd-run-instant").disabled = false; $("bd-stop-instant").disabled = true; }
            }
        });
        $("bd-stop-instant").addEventListener("click", () => { instant.stopFlag = true; });

        // natural run
        $("bd-start-n").addEventListener("click", async () => {
            if (natural) return;
            gen++; instant.stopFlag = true; // never run both modes at once
            $("bd-start-n").disabled = true; $("bd-stop-n").disabled = false;
            const progress = $("bd-progress-n");
            try {
                const config = {
                    totalHours: clampNumber($("bd-hours-n").value, 1, 100000, 1000),
                    titles: clampInt($("bd-pool-n").value, 1, 20000, 250),
                    wobble: $("bd-wobble-n").checked
                };
                statusN.textContent = "Loading Discord game catalog…";
                const raw = await (await fetch(GAMES_URL, { cache: "no-store" })).json();
                const games = (Array.isArray(raw) ? raw : []).filter(g => g?.id && executableFor(g));
                if (!games.length) throw new Error("No usable detectable games were found.");
                const selected = shuffle(games).slice(0, Math.min(config.titles, games.length));
                progress.max = selected.length; progress.value = 0;
                natural = createPresence(selected, config, (game, shown, nextAt) => {
                    progress.value = shown;
                    statusN.textContent = `Active: ${game.name} · ${shown}/${selected.length} · next ${new Date(nextAt).toLocaleTimeString()}`;
                }, message => {
                    natural = null;
                    statusN.textContent = message;
                    $("bd-start-n").disabled = false; $("bd-stop-n").disabled = true;
                }, error => { statusN.textContent = error?.message || String(error); });
                if (!natural) { $("bd-start-n").disabled = false; $("bd-stop-n").disabled = true; }
            } catch (error) {
                statusN.textContent = error?.message || String(error);
                $("bd-start-n").disabled = false; $("bd-stop-n").disabled = true;
            }
        });
        $("bd-stop-n").addEventListener("click", () => { try { natural?.stop(); } catch { /* ignore */ } natural = null; });

        // hypesquad
        const hype = async join => {
            try {
                const api = findApi();
                const house = Number($("bd-house").value);
                if (join) {
                    await api.post({ url: "/hypesquad/online", body: { house_id: house } });
                    statusH.textContent = `Joined ${HOUSES[house]}. Refresh profile to check.`;
                } else {
                    await api.del({ url: "/hypesquad/online" });
                    statusH.textContent = "Left HypeSquad.";
                }
            } catch (error) { statusH.textContent = error?.message || String(error); }
        };
        $("bd-join").addEventListener("click", () => hype(true));
        $("bd-leave").addEventListener("click", () => hype(false));
    });
})();
