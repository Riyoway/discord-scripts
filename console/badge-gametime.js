// badge-gametime — rotating Discord desktop game presence.
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

    return riyoRunScript("badge-gametime", async () => {
        const OLD_ID = "riyo-badge-gametime-panel";
        const previous = document.getElementById(OLD_ID);

        if (previous) {
            previous.__stop?.();
            previous.remove();
            return;
        }

        const DEFAULTS = Object.freeze({
            totalHours: 1000,
            titles: 250,
            wobble: true
        });
        const LOCK = "__multiGamePresence";
        const MIN_CHANGE_MS = 23 * 60 * 1000;
        const MAX_CHANGE_MS = 38 * 60 * 1000;
        const RECENT_HISTORY_SIZE = 100;

        const GAMES_URL =
            "https://cdn.discordapp.com/detectables/games.json";

        const shuffle = input => {
            const a = [...input];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        const clampInt = (value, min, max, fallback) => {
            const n = Math.floor(Number(value));
            if (!Number.isFinite(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        };

        const clampNumber = (value, min, max, fallback) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        };

        const getName = game =>
            game?.name ||
            game?.names?.default ||
            game?.display_name ||
            `Game ${game?.id ?? "unknown"}`;

        const platform = /Linux/i.test(navigator.userAgent) ? "linux" : "win32";
        const executableFor = game => {
            const executables = Array.isArray(game?.executables) ? game.executables : [];
            return executables.find(exe => exe?.os === platform && exe.name)
                || executables.find(exe => exe?.os === "win32" && exe.name);
        };

        function createPresence(games, config, onChange, onStop, onError) {
            if (window[LOCK]?.stop) throw new Error("Another game presence session is running. Stop it with window.__multiGamePresence.stop().");
            let req = window.Vencord?.Webpack?.wreq;
            if (!req?.c && typeof webpackChunkdiscord_app !== "undefined") {
                webpackChunkdiscord_app.push([[Symbol("badge-gametime")], {}, incoming => {
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
                catch (error) { console.error("[badge-gametime] Cleanup notification failed:", error); }
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
                    console.log("[badge-gametime] Active:", current.name, "Next change in", (delay / 60000).toFixed(1), "min");
                    timer = setTimeout(next, delay);
                } catch (error) {
                    stop("Stopped after an activity error.");
                    onError(error);
                }
            };
            controller = { stop, next, games, history, get current() { return current?.name ?? null; }, get index() { return index; }, get totalGames() { return games.length; } };
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

        const panel = document.createElement("div");
        panel.id = OLD_ID;
        panel.className = "riyo-ui riyo-panel";

        panel.innerHTML = `
            ${riyoTheme}

            <header class="riyo-header" tabindex="0">
                <strong class="riyo-title">${riyoHeading('badge-gametime')}</strong>

                <button
                    type="button"
                    class="riyo-close"
                    id="gt-close"
                    aria-label="Close game time"
                >
                    ${riyoIcon("close")}
                </button>
            </header>

            <div class="riyo-grid"><label class="riyo-label">
                Session limit (hours)
                <input
                    id="gt-hours"
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    value="${DEFAULTS.totalHours}"
                >
            </label>

            <label class="riyo-label">
                Game pool size
                <input
                    id="gt-games"
                    type="number"
                    min="1"
                    max="20000"
                    step="1"
                    value="${DEFAULTS.titles}"
                >
            </label>

            </div><div class="riyo-options">
                <label class="riyo-check">
                    <input
                        id="gt-wobble"
                        type="checkbox"
                        ${DEFAULTS.wobble ? "checked" : ""}
                    >
                    ±3% time wobble
                </label>
            </div>

            <div
                id="gt-summary"
                class="riyo-status"
            >
                Switches every 23–38 minutes.
            </div>

            <progress
                id="gt-progress"
                aria-label="Different games shown during this session"
                value="0"
                max="1"
            ></progress>

            <div
                id="gt-status"
                class="riyo-status"
                role="status"
            >
                Ready.
            </div>

            <div class="riyo-row">
                <button
                    type="button"
                    id="gt-stop"
                    class="riyo-danger"
                    disabled
                >
                    ${riyoIcon("stop")}
                    Stop
                </button>

                <button
                    type="button"
                    id="gt-start"
                    class="riyo-primary"
                >
                    ${riyoIcon("play")}
                    Start
                </button>
            </div>
        `;

        riyoMountPanel(panel, 'badge-gametime');

        const $ = selector => panel.querySelector(selector);

        const hoursInput = $("#gt-hours");
        const gamesInput = $("#gt-games");
        const wobbleInput = $("#gt-wobble");

        const summary = $("#gt-summary");
        const progress = $("#gt-progress");
        const status = $("#gt-status");

        const startButton = $("#gt-start");
        const stopButton = $("#gt-stop");
        const closeButton = $("#gt-close");

        let running = false;
        let generation = 0;
        let loading = null;
        let presence = null;

        const readConfig = () => ({
            totalHours: clampNumber(
                hoursInput.value,
                1,
                100000,
                DEFAULTS.totalHours
            ),

            titles: clampInt(
                gamesInput.value,
                1,
                20000,
                DEFAULTS.titles
            ),

            wobble: wobbleInput.checked
        });

        const updateSummary = () => {
            const config = readConfig();

            summary.textContent =
                `${config.titles.toLocaleString()} game pool ` +
                `• ${config.totalHours.toLocaleString()} h session limit ` +
                `• 23–38 min per game`;
        };

        [
            hoursInput,
            gamesInput,
            wobbleInput
        ].forEach(node =>
            node.addEventListener("input", updateSummary)
        );

        const setRunning = value => {
            running = value;

            startButton.disabled = value;
            stopButton.disabled = !value;

            hoursInput.disabled = value;
            gamesInput.disabled = value;
            wobbleInput.disabled = value;
        };

        const stop = () => {
            generation++;
            loading?.abort();
            loading = null;
            const session = presence;
            presence = null;
            session?.stop();
            setRunning(false);
            status.textContent = "Stopped.";
        };

        window.addEventListener("pagehide", stop);
        panel.__stop = () => {
            stop();
            window.removeEventListener("pagehide", stop);
        };

        closeButton.addEventListener("click", () => {
            panel.remove();
        });

        stopButton.addEventListener("click", stop);

        startButton.addEventListener("click", async () => {
            if (running) return;

            const id = ++generation;
            const controller = new AbortController();
            loading = controller;
            setRunning(true);

            progress.value = 0;
            progress.max = 1;

            try {
                const config = readConfig();

                status.textContent =
                    "Loading Discord game catalog…";

                const response = await fetch(GAMES_URL, {
                    cache: "no-store",
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(
                        `Catalog request failed: HTTP ${response.status}`
                    );
                }

                const raw = await response.json();
                if (id !== generation) return;

                const games = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.games)
                    ? raw.games
                    : [];

                const seen = new Set();
                const compatible = games.filter(game => {
                    if (!game?.id || !executableFor(game) || seen.has(String(game.id))) return false;
                    seen.add(String(game.id));
                    return true;
                });

                if (!compatible.length) {
                    throw new Error(
                        "No usable detectable games were found."
                    );
                }

                const count = Math.min(
                    config.titles,
                    compatible.length
                );

                const selected = shuffle(compatible).slice(0, count);

                progress.max = selected.length;

                summary.textContent =
                    `${selected.length.toLocaleString()} game pool ` +
                    `• ${config.totalHours.toLocaleString()} h session limit ` +
                    `• 23–38 min per game`;
                presence = createPresence(selected, config, (game, shown, nextAt) => {
                    progress.value = shown;
                    status.textContent = `Active: ${game.name} • ${shown}/${selected.length} games shown • next change ${new Date(nextAt).toLocaleTimeString()}`;
                }, message => {
                    if (id !== generation) return;
                    presence = null;
                    status.textContent = message;
                    setRunning(false);
                }, error => {
                    console.error("[badge-gametime]", error);
                    if (id === generation) status.textContent = error?.message || String(error);
                });
            } catch (error) {
                if (id === generation) {
                    console.error("[badge-gametime]", error);
                    status.textContent = error?.message || String(error);
                }
            } finally {
                if (id === generation) {
                    loading = null;
                    if (!presence) setRunning(false);
                }
            }
        });

        updateSummary();
    });
})();
