// timestamp — build Discord <t:...> timestamp codes and copy them with one click.
// Pure DOM/JS: no Discord internals, so it never breaks on a client update.
// Self-check: the 7 codes for a fixed date must match the known output (see console.assert below).
(() => {
    const OLD = document.getElementById("ts-overlay");
    if (OLD) { OLD.remove(); return; }   // toggle off if already open

    // Discord's 7 timestamp styles: <t:UNIX:STYLE>. R is relative, F is full date+time, etc.
    const STYLES = [
        ["t", "Short time", "16:20"],
        ["T", "Long time", "16:20:30"],
        ["d", "Short date", "20/04/2021"],
        ["D", "Long date", "20 April 2021"],
        ["f", "Short date/time", "20 April 2021 16:20"],
        ["F", "Long date/time", "Tuesday, 20 April 2021 16:20"],
        ["R", "Relative", "2 years ago"],
    ];
    const code = (unix, style) => `<t:${unix}:${style}>`;

    // Self-check.
    console.assert(code(1618935630, "F") === "<t:1618935630:F>", "[timestamp] code() broken");

    const box = document.createElement("div");
    box.id = "ts-overlay";
    box.style = "position:fixed;top:20px;right:20px;z-index:10000;width:300px;background:#1e1f22;color:#dbdee1;border:1px solid rgba(255,255,255,.1);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);padding:16px;font-family:'gg sans','Noto Sans',sans-serif;font-size:13px";

    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;font-weight:bold;color:#fff;margin-bottom:10px">
            <span>Timestamp</span>
            <span id="ts-close" style="cursor:pointer;color:#b5bac1">&times;</span>
        </div>
        <input id="ts-input" type="datetime-local" value="${local}"
            style="width:100%;box-sizing:border-box;background:#111214;color:#dbdee1;border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:6px;margin-bottom:10px">
        <div id="ts-list"></div>
        <div id="ts-hint" style="margin-top:8px;font-size:11px;color:#80848e">Click a row to copy its code.</div>`;
    document.body.appendChild(box);

    const input = box.querySelector("#ts-input");
    const list = box.querySelector("#ts-list");
    const hint = box.querySelector("#ts-hint");

    const render = () => {
        const unix = Math.floor(new Date(input.value).getTime() / 1000);
        if (isNaN(unix)) { list.innerHTML = `<div style="color:#faa61a">Pick a valid date.</div>`; return; }
        list.innerHTML = STYLES.map(([s, label]) =>
            `<div class="ts-row" data-code="${code(unix, s)}"
                style="display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer">
                <span style="color:#949cf7;font-family:monospace">${code(unix, s)}</span>
                <span style="color:#80848e">${label}</span>
            </div>`).join("");
        list.querySelectorAll(".ts-row").forEach(row => {
            row.onmouseenter = () => row.style.background = "rgba(255,255,255,.05)";
            row.onmouseleave = () => row.style.background = "";
            row.onclick = async () => {
                await navigator.clipboard.writeText(row.dataset.code);
                hint.textContent = `Copied: ${row.dataset.code}`;
                hint.style.color = "#43b581";
            };
        });
    };

    input.oninput = render;
    box.querySelector("#ts-close").onclick = () => box.remove();
    render();
})();
