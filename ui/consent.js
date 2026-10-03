// A native dialog also works in Electron, where window.confirm is unsupported.
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
            <header class="riyo-header"><strong class="riyo-title" id="${titleId}">Run ${name}?</strong></header>
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
