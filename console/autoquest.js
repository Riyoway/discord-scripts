// AutoQuest — client-side queue, with protocol/state handling informed by the local quest bot.
(async () => {
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
const QuestsStore = findModule(x => typeof x.getQuest === "function");
const api = findModule(x => typeof x.get === "function" && typeof x.post === "function" && (typeof x.del === "function" || typeof x.delete === "function"));
const RunningGameStore = findModule(x => typeof x.getRunningGames === "function" && typeof x.getGameForPID === "function");
const ApplicationStreamingStore = findModule(x => typeof x.getStreamerActiveStreamMetadata === "function");
const ChannelStore = findModule(x => typeof x.getSortedPrivateChannels === "function");
const GuildChannelStore = findModule(x => typeof x.getAllGuilds === "function");
const FluxDispatcher = findModule(x => typeof x.dispatch === "function" && typeof x.subscribe === "function" && typeof x.unsubscribe === "function");
if (!QuestsStore || !api) throw new Error("Discord's quest store or HTTP client was not found. Reload Discord and try again.");
const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "PLAY_ON_XBOX", "PLAY_ON_PLAYSTATION", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE", "ACHIEVEMENT_IN_ACTIVITY"];
const isApp = typeof DiscordNative !== "undefined";
const controller = new AbortController();
const signal = controller.signal;
const pauseEvents = new EventTarget();
let taskCleanup = () => {};
let overlayCleanup = () => {};

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
        container.style = "position: fixed; top: 20px; right: 20px; z-index: 10000; font-family: 'gg sans', 'Noto Sans', sans-serif; width: 40px; height: 40px;";
        
        const icon = document.createElement('button');
        icon.type = 'button';
        icon.setAttribute('aria-label', 'Pin AutoQuest monitor');
        icon.className = 'autoquest-icon';
        icon.style = "width: 40px; height: 40px; background: #1e1f22; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s;";
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M762-96 645-212l-88 88-28-28q-23-23-23-57t23-57l169-169q23-23 57-23t57 23l28 28-88 88 116 117q12 12 12 28t-12 28l-50 50q-12 12-28 12t-28-12Zm118-628L426-270l5 4q23 23 23 57t-23 57l-28 28-88-88L198-96q-12 12-28 12t-28-12l-50-50q-12-12-12-28t12-28l116-117-88-88 28-28q23-23 57-23t57 23l4 5 454-454h160v160ZM334-583l24-23 23-24-23 24-24 23Zm-56 57L80-724v-160h160l198 198-57 56-174-174h-47v47l174 174-56 57Zm92 199 430-430v-47h-47L323-374l47 47Zm0 0-24-23-23-24 23 24 24 23Z"/></svg>`;
        
        const panel = document.createElement('div');
        panel.className = 'autoquest-panel';
        panel.style = "position: absolute; top: 48px; right: 0; width: 280px; background: rgba(30, 31, 34, 0.95); backdrop-filter: blur(8px); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.5); padding: 16px; color: #dbdee1; display: none; opacity: 0; transition: opacity 0.3s; pointer-events: auto;";
        
        container.onmouseenter = () => { 
            panel.style.display = 'block'; 
            setTimeout(() => panel.style.opacity = '1', 10); 
            icon.style.transform = "scale(1.1)"; 
        };
        container.onmouseleave = () => { 
            if (OverlayUI.state.isSticky) return;
            panel.style.opacity = '0'; 
            setTimeout(() => panel.style.display = 'none', 300); 
            icon.style.transform = "scale(1.0)"; 
        };

        icon.onclick = (e) => {
            e.stopPropagation();
            OverlayUI.state.isSticky = !OverlayUI.state.isSticky;
            icon.style.background = OverlayUI.state.isSticky ? "#5865f2" : "#1e1f22";
            OverlayUI.update();
        };

        // ドラッグ移動ロジック
        let isDragging = false;
        let offsetX, offsetY;

        icon.onmousedown = (e) => {
            isDragging = true;
            icon.style.cursor = 'grabbing';
            offsetX = e.clientX - container.getBoundingClientRect().left;
            offsetY = e.clientY - container.getBoundingClientRect().top;
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            let x = e.clientX - offsetX;
            let y = e.clientY - offsetY;
            
            // ウィンドウ外に出ないように制限
            const padding = 10;
            x = Math.max(padding, Math.min(window.innerWidth - container.offsetWidth - padding, x));
            y = Math.max(padding, Math.min(window.innerHeight - container.offsetHeight - padding, y));
            
            container.style.left = x + 'px';
            container.style.top = y + 'px';
            container.style.right = 'auto'; // 固定位置を解除
        };
        const onMouseUp = () => {
            isDragging = false;
            icon.style.cursor = 'pointer';
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        overlayCleanup = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        container.appendChild(icon);
        container.appendChild(panel);
        document.body.appendChild(container);
    },
    update: () => {
        const panel = document.querySelector('#autoquest-overlay .autoquest-panel');
        if (!panel) return;
        
        const { quests, currentIdx, progress, percent, isRunning, isPaused, isSticky, overall } = OverlayUI.state;
        let html = `<div style="font-size: 14px; font-weight: bold; color: #fff; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>AutoQuest Monitor ${isSticky ? '📌' : ''}</span>
            <span style="font-size: 10px; color: ${overall === 'ERROR' ? '#ED4245' : isPaused ? '#FAA61A' : '#43B581'}">${isPaused ? 'PAUSED' : overall}</span>
        </div>`;
        
        html += `<div class="autoquest-queue" style="max-height: 320px; overflow-y: auto; padding-right: 4px;">`;
        
        if (overall === "ERROR") {
            html += `<div role="alert" style="font-size: 12px; color: #ED4245; overflow-wrap: anywhere;">${escapeHtml(progress || "Unknown error")}</div>`;
        } else if (quests.length === 0) {
            html += `<div style="font-size: 12px; color: #b5bac1;">No active quests.</div>`;
        } else {
            quests.forEach((q, i) => {
                // QuestsStoreから最新の状態を取得
                const freshQuest = normalizeQuest(QuestsStore.getQuest(q.id));
                const isDone = !!q.userStatus?.completedAt || !!freshQuest?.userStatus?.completedAt;
                const isCurrent = i === currentIdx && !isDone;
                html += `
                    <div class="autoquest-item" draggable="${isRunning && !isDone && i > currentIdx}" data-index="${i}" style="margin-bottom: 10px; padding: 10px; background: ${isCurrent ? 'rgba(88, 101, 242, 0.1)' : 'rgba(255,255,255,0.03)'}; border-radius: 6px; border-left: 3px solid ${isCurrent ? '#5865f2' : (isDone ? '#43b581' : 'transparent')}; opacity: ${isDone ? '0.5' : '1'}; cursor: ${isRunning && !isDone && i > currentIdx ? 'grab' : 'default'}; transition: background 0.2s;">
                        <div style="font-size: 12px; font-weight: bold; color: ${isCurrent ? '#fff' : '#dbdee1'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;">${escapeHtml(q.config.messages.questName)}</div>
                        <div style="font-size: 11px; margin-top: 4px; color: ${isCurrent ? '#949cf7' : '#80848e'}; display: flex; justify-content: space-between; pointer-events: none;">
                            <span>${escapeHtml(isCurrent ? (progress || 'Processing...') : (isDone ? 'Completed' : (q.result || 'Waiting...')))}</span>
                            ${isCurrent ? `<span>${Math.round(percent)}%</span>` : ''}
                        </div>
                        ${isCurrent ? `
                            <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 8px; overflow: hidden; position: relative;">
                                <div style="width: ${percent}%; height: 100%; background: #5865f2; transition: width 0.3s ease; box-shadow: 0 0 8px #5865f2;"></div>
                                ${percent === 0 || isPaused ? '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); animation: autoquest-pulse 1.5s infinite;"></div>' : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }
        html += `</div>`;

        html += `
            <div style="margin-top: 16px; display: flex; gap: 8px;">
                <button id="autoquest-btn-pause" style="flex: 1; padding: 6px; border-radius: 4px; border: none; background: ${isPaused ? '#43B581' : '#4f545c'}; color: white; font-size: 11px; cursor: pointer; font-weight: bold;">${isPaused ? 'Resume' : 'Pause'}</button>
                <button id="autoquest-btn-stop" style="padding: 6px 12px; border-radius: 4px; border: none; background: #ED4245; color: white; font-size: 11px; cursor: pointer; font-weight: bold;">Stop</button>
            </div>
            <style>
                .autoquest-queue::-webkit-scrollbar { width: 4px; }
                .autoquest-queue::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
                .autoquest-item.drag-over { background: rgba(88, 101, 242, 0.2) !important; outline: 1px dashed #5865f2; }
            </style>
        `;

        panel.innerHTML = html;
        
        // ドラッグ＆ドロップイベントの設定（コンテナベースの委譲）
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
                console.log('[AutoQuest] Drag start:', dragSrcIdx);
            };

            queue.ondragend = (e) => {
                const item = e.target.closest('.autoquest-item');
                if (item) item.style.opacity = '';
                dragSrcIdx = null;
                panel.querySelectorAll('.autoquest-item.drag-over').forEach(el => el.classList.remove('drag-over'));
                console.log('[AutoQuest] Drag end');
            };

            queue.ondragover = (e) => {
                const item = e.target.closest('.autoquest-item');
                if (!item) return;
                const targetIdx = parseInt(item.dataset.index);
                const { currentIdx } = OverlayUI.state;
                // 現在進行中のタスクより上、またはその位置には持っていけない
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

                // 現在進行中のタスクより上、またはその位置には持っていけない
                if (targetIdx <= currentIdx) {
                    console.log('[AutoQuest] Drop rejected: cannot move to or above current task');
                    return;
                }

                e.preventDefault();
                item.classList.remove('drag-over');
                console.log('[AutoQuest] Drop:', srcIdx, '->', targetIdx);
                if (srcIdx !== null && !isNaN(srcIdx) && srcIdx !== targetIdx && srcIdx > currentIdx && targetIdx > currentIdx && srcIdx < OverlayUI.state.quests.length && targetIdx < OverlayUI.state.quests.length) {
                    const movedItem = OverlayUI.state.quests.splice(srcIdx, 1)[0];
                    OverlayUI.state.quests.splice(targetIdx, 0, movedItem);
                    console.log('[AutoQuest] Reordered:', srcIdx, '->', targetIdx);
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


function cleanup() { taskCleanup(); }
function stopRun() {
    OverlayUI.state.isRunning = false;
    OverlayUI.state.isPaused = false;
    OverlayUI.state.overall = "STOPPED";
    controller.abort();
    cleanup();
    overlayCleanup();
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
            cleanup();
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
    cleanup();
    OverlayUI.state.currentIdx = -1;
    OverlayUI.state.isRunning = false;
    OverlayUI.state.isPaused = false;
    OverlayUI.update();
});
await run.done;
})().catch(error => console.error("[AutoQuest]", error.message || error));
