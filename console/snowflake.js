// Show the creation time encoded in a Discord ID or message link.
(() => {
    // BEGIN SHARED UI
    // Embedded by scripts/sync-ui.cjs so every console script works without remote UI assets.
    const riyoIcon = name => {
        const paths = {
            close: '<path d="m18 6-12 12M6 6l12 12"/>',
            download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
            image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
            video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/>',
            search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
            clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
            quest: '<path d="m14.5 17.5 3 3L21 17l-3-3M13 19l6-6M3 3l3 .5L18 15l-3 3L3.5 6Zm.5 17.5L7 17l-3-3L1 17M5 19l6-6M14 6l4.5-2.5L21 3l-.5 3L18 10"/>',
            pause: '<path d="M9 4H5v16h4zM19 4h-4v16h4z"/>',
            play: '<path d="m7 4 14 8-14 8Z"/>',
            stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
            copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
            pin: '<path d="m16 3 5 5-4 1-4 4-1 4-5-5 4-1 4-4ZM9 15l-6 6"/>'
        };
        return `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.copy}</svg>`;
    };
    const riyoTheme = `<style>
    .riyo-ui{--riyo-surface:rgba(0,0,0,.76);--riyo-line:rgba(255,255,255,.14);--riyo-text:#f5f5f5;--riyo-muted:#b3b3b3;--riyo-danger:#ff9090;color-scheme:dark;font:13px/1.5 'gg sans',system-ui,sans-serif;color:var(--riyo-text)}
    .riyo-panel,.riyo-ui .autoquest-panel{box-sizing:border-box;width:360px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 96px);padding:18px;background:var(--riyo-surface);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);border:1px solid var(--riyo-line);border-radius:18px;box-shadow:0 16px 56px #0007,inset 0 1px 0 #ffffff08;overflow:auto}
    .riyo-panel{position:fixed;top:72px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:14px}
    .riyo-ui *{box-sizing:border-box;scrollbar-width:none}.riyo-ui ::-webkit-scrollbar,.riyo-ui::-webkit-scrollbar{display:none}
    .riyo-ui .riyo-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--riyo-line);flex-shrink:0}
    .riyo-ui .riyo-title{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:650;letter-spacing:-.2px;margin:0;color:var(--riyo-text)}
    .riyo-ui svg{display:inline-block;flex-shrink:0;vertical-align:middle;pointer-events:none}
    .riyo-ui button{font:inherit;font-weight:550;display:inline-flex;justify-content:center;align-items:center;gap:8px;min-height:36px;padding:8px 12px;border:1px solid var(--riyo-line);border-radius:10px;background:rgba(255,255,255,.065);color:var(--riyo-text);cursor:pointer;transition:background .15s,border-color .15s}
    .riyo-ui button:hover{background:rgba(255,255,255,.13);border-color:#ffffff40}.riyo-ui button:active{background:#ffffff20}.riyo-ui button:disabled{opacity:.4;cursor:default}
    .riyo-ui .riyo-primary{background:#f5f5f5;color:#111;border-color:#f5f5f5}.riyo-ui .riyo-primary:hover{background:#dedede;border-color:#dedede}
    .riyo-ui .riyo-danger{background:#ff909010;color:var(--riyo-danger);border-color:#ff909040}.riyo-ui .riyo-danger:hover{background:#ff909024}
    .riyo-ui .riyo-close{width:32px;min-height:32px;padding:6px;background:transparent;flex-shrink:0;border-color:transparent}
    .riyo-ui input{font:inherit;color:var(--riyo-text);min-width:0;border:1px solid var(--riyo-line);border-radius:10px;background:#ffffff06;padding:9px 11px}
    .riyo-ui input:not([type=checkbox]){width:100%;min-height:38px}.riyo-ui input::placeholder{color:#969696}.riyo-ui input[type=checkbox]{accent-color:#fff;width:15px;height:15px;margin:0}
    .riyo-ui :focus-visible{outline:2px solid #fff;outline-offset:3px}
    .riyo-ui .riyo-muted,.riyo-ui .riyo-status{font-size:12px;color:var(--riyo-muted);overflow-wrap:anywhere}.riyo-ui .riyo-status{padding:11px 12px;border:1px solid #ffffff0c;border-radius:10px;background:#ffffff04}
    .riyo-ui .riyo-row{display:flex;gap:8px;align-items:center}.riyo-ui .riyo-row>button{flex:1}.riyo-ui .riyo-options{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.riyo-ui label{font-size:12px;color:var(--riyo-muted)}
    .riyo-ui .riyo-label{display:flex;flex-direction:column;gap:7px}.riyo-ui .riyo-check{display:flex;align-items:center;gap:7px}
    .riyo-ui progress{appearance:none;display:block;width:100%;height:6px;border:0;border-radius:99px;overflow:hidden;background:#ffffff14;flex-shrink:0}
    .riyo-ui progress::-webkit-progress-bar{background:#ffffff14;border-radius:99px}.riyo-ui progress::-webkit-progress-value{background:#eee;border-radius:99px;transition:width .2s}.riyo-ui progress::-moz-progress-bar{background:#eee;border-radius:99px}
    .riyo-ui [hidden]{display:none!important}
    .riyo-ui .riyo-badge{font-size:11px;font-weight:550;padding:3px 8px;border:1px solid var(--riyo-line);border-radius:99px;white-space:nowrap}
    .riyo-ui .autoquest-panel{position:absolute;top:52px;right:0;display:none;opacity:0;transition:opacity .15s;pointer-events:auto}
    .riyo-ui .autoquest-icon{width:40px;height:40px;padding:0;border-radius:12px;background:var(--riyo-surface);backdrop-filter:blur(28px);box-shadow:0 4px 20px #0005}
    .riyo-ui .autoquest-icon[aria-pressed=true]{background:#f5f5f5;color:#111}.riyo-ui .autoquest-queue{max-height:320px;overflow:auto;margin-top:14px}
    .riyo-ui .autoquest-item{padding:12px;margin-bottom:8px;border:1px solid #ffffff0d;background:#ffffff04;border-radius:12px}.riyo-ui .autoquest-item[data-current=true]{border-color:#ffffff40;background:#ffffff09}.riyo-ui .autoquest-item[data-done=true]{opacity:.55}
    .riyo-ui .autoquest-item.drag-over{outline:1px dashed #eee;background:#ffffff14}.riyo-ui .riyo-quest-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.riyo-ui .riyo-quest-meta{display:flex;justify-content:space-between;gap:10px;margin-top:5px;font-size:12px;color:var(--riyo-muted);pointer-events:none}
    .riyo-ui .riyo-progress{height:6px;background:#ffffff14;border-radius:99px;margin-top:10px;overflow:hidden}.riyo-ui .riyo-progress>div{height:100%;background:#eee;border-radius:99px;transition:width .3s}.riyo-ui .riyo-footer{display:flex;gap:8px;padding-top:14px;margin-top:6px;border-top:1px solid var(--riyo-line)}.riyo-ui .riyo-footer>button:first-child{flex:1}
    .riyo-ui #search-results-list{overflow:auto;min-height:0}.riyo-ui #search-results-list article{padding:12px;border:1px solid #ffffff14;border-radius:12px;margin-bottom:8px;overflow-wrap:anywhere}.riyo-ui #search-results-list p{margin:6px 0 0;white-space:pre-wrap}.riyo-ui #search-results-list mark{background:#eee;color:#111;border-radius:3px}
    .riyo-ui .ts-row{width:100%;justify-content:space-between;text-align:left}.riyo-ui #ts-list{display:flex;flex-direction:column;gap:6px}.riyo-ui .ts-code{font:12px ui-monospace,monospace}.riyo-ui .ts-format{color:var(--riyo-muted);font-size:11px}
    @media(max-width:480px){.riyo-panel{right:12px;max-width:calc(100vw - 24px);padding:16px}.riyo-ui .autoquest-panel{max-width:calc(100vw - 32px);padding:16px}.riyo-ui button{min-height:40px}}
    @media(prefers-reduced-motion:reduce){.riyo-ui *{transition:none!important;animation:none!important}}
    </style>`;
    // END SHARED UI
  const decode = input => {
    const value = input.trim();
    const messageId = value.match(/^https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(?:@me|\d+)\/\d+\/(\d{15,20})\/?(?:[?#].*)?$/)?.[1];
    const id = messageId || (/^\d{15,20}$/.test(value) ? value : null);
    if (!id) throw new Error("Enter a Discord ID or a Discord message link.");
    // Discord snowflake: upper 42 bits are milliseconds since 2015-01-01 UTC.
    const milliseconds = Number((BigInt(id) >> 22n) + 1420070400000n);
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) throw new Error("Could not decode this ID.");
    return { id, createdAt: date.toISOString(), discordTimestamp: "<t:" + Math.floor(milliseconds / 1000) + ":F>" };
  };
  // Desktop runners supply a local prompt adapter for terminal input and output.
  if (typeof window === 'undefined' || prompt !== window.prompt) {
    const input = prompt("Discord ID or message link:");
    if (input === null) return;
    try {
      const result = decode(input);
      console.log(result);
      prompt("Created: " + new Date(result.createdAt).toLocaleString() + "\nCopy the Discord timestamp:", result.discordTimestamp);
    } catch (error) { alert(error.message); }
    return;
  }
  document.getElementById('snowflake-overlay')?.remove();
  const box = document.createElement('section');
  box.id = 'snowflake-overlay';
  box.className = 'riyo-ui riyo-panel';
  box.innerHTML = `${riyoTheme}
    <header class="riyo-header"><strong class="riyo-title">${riyoIcon('clock')}Snowflake</strong>
      <button id="sf-close" class="riyo-close" aria-label="Close snowflake">${riyoIcon('close')}</button></header>
    <form id="sf-form" class="riyo-label">
      <label class="riyo-label">Discord ID or message link<input id="sf-input" required placeholder="Paste an ID or message link"></label>
      <button class="riyo-primary" type="submit">Decode</button>
    </form>
    <div id="sf-result" class="riyo-status" role="status">Enter an ID to see when it was created.</div>
    <button id="sf-copy" hidden>${riyoIcon('copy')}Copy timestamp</button>`;
  document.body.appendChild(box);
  const result = box.querySelector('#sf-result');
  const copy = box.querySelector('#sf-copy');
  let timestamp = '';
  box.querySelector('#sf-close').onclick = () => box.remove();
  box.querySelector('#sf-form').onsubmit = event => {
    event.preventDefault();
    copy.hidden = true;
    try {
      const decoded = decode(box.querySelector('#sf-input').value);
      timestamp = decoded.discordTimestamp;
      result.textContent = 'Created: ' + new Date(decoded.createdAt).toLocaleString();
      copy.hidden = false;
    } catch (error) { result.textContent = error.message; }
  };
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(timestamp);
      result.textContent = 'Copied: ' + timestamp;
    } catch { result.textContent = 'Could not copy. Timestamp: ' + timestamp; }
  };
})();
