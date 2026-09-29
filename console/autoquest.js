delete window.$;
let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
webpackChunkdiscord_app.pop();

let ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata).exports.A;
let RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames).exports.Ay;
let QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest).exports.A;
let ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent).exports.A;
let GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel).exports.Ay;
let FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue).exports.h;
let api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get).exports.Bo;

window.__autoquest_backup = window.__autoquest_backup || {
    getRunningGames: RunningGameStore.getRunningGames,
    getGameForPID: RunningGameStore.getGameForPID,
    getStreamerActiveStreamMetadata: ApplicationStreamingStore.getStreamerActiveStreamMetadata
};

const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "PLAY_ON_XBOX", "PLAY_ON_PLAYSTATION", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE", "ACHIEVEMENT_IN_ACTIVITY"];
let isApp = typeof DiscordNative !== "undefined";

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
    state: { quests: [], currentIdx: -1, progress: "", percent: 0, isRunning: true, isPaused: false, isSticky: false },
    init: () => {
        let container = document.getElementById('autoquest-overlay');
        if (container) container.remove();
        
        container = document.createElement('div');
        container.id = 'autoquest-overlay';
        container.style = "position: fixed; top: 20px; right: 20px; z-index: 10000; font-family: 'gg sans', 'Noto Sans', sans-serif; width: 40px; height: 40px;";
        
        const icon = document.createElement('div');
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

        window.addEventListener('mousemove', (e) => {
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
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            if (icon) icon.style.cursor = 'pointer';
        });
        
        container.appendChild(icon);
        container.appendChild(panel);
        document.body.appendChild(container);
    },
    update: () => {
        const panel = document.querySelector('#autoquest-overlay .autoquest-panel');
        if (!panel) return;
        
        const { quests, currentIdx, progress, percent, isRunning, isPaused, isSticky } = OverlayUI.state;
        let html = `<div style="font-size: 14px; font-weight: bold; color: #fff; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>AutoQuest Monitor ${isSticky ? '📌' : ''}</span>
            <span style="font-size: 10px; color: ${isPaused ? '#FAA61A' : '#43B581'}">${isPaused ? 'PAUSED' : 'RUNNING'}</span>
        </div>`;
        
        html += `<div class="autoquest-queue" style="max-height: 320px; overflow-y: auto; padding-right: 4px;">`;
        
        if (quests.length === 0) {
            html += `<div style="font-size: 12px; color: #b5bac1;">No active quests.</div>`;
        } else {
            quests.forEach((q, i) => {
                // QuestsStoreから最新の状態を取得
                const freshQuest = QuestsStore.getQuest(q.id);
                const isDone = !!freshQuest?.userStatus?.completedAt;
                const isCurrent = i === currentIdx && !isDone;
                html += `
                    <div class="autoquest-item" draggable="${!isDone && !isCurrent}" data-index="${i}" style="margin-bottom: 10px; padding: 10px; background: ${isCurrent ? 'rgba(88, 101, 242, 0.1)' : 'rgba(255,255,255,0.03)'}; border-radius: 6px; border-left: 3px solid ${isCurrent ? '#5865f2' : (isDone ? '#43b581' : 'transparent')}; opacity: ${isDone ? '0.5' : '1'}; cursor: ${!isDone && !isCurrent ? 'grab' : 'default'}; transition: background 0.2s;">
                        <div style="font-size: 12px; font-weight: bold; color: ${isCurrent ? '#fff' : '#dbdee1'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;">${q.config.messages.questName}</div>
                        <div style="font-size: 11px; margin-top: 4px; color: ${isCurrent ? '#949cf7' : '#80848e'}; display: flex; justify-content: space-between; pointer-events: none;">
                            <span>${isCurrent ? (progress || 'Processing...') : (isDone ? 'Completed' : 'Waiting...')}</span>
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
                if (srcIdx !== null && !isNaN(srcIdx) && srcIdx !== targetIdx && srcIdx >= 0 && targetIdx >= 0) {
                    const movedItem = OverlayUI.state.quests.splice(srcIdx, 1)[0];
                    OverlayUI.state.quests.splice(targetIdx, 0, movedItem);
                    // 実行中のインデックスがずれた場合、同期する
                    if (OverlayUI.state.currentIdx === srcIdx) OverlayUI.state.currentIdx = targetIdx;
                    else if (srcIdx < OverlayUI.state.currentIdx && targetIdx >= OverlayUI.state.currentIdx) OverlayUI.state.currentIdx--;
                    else if (srcIdx > OverlayUI.state.currentIdx && targetIdx <= OverlayUI.state.currentIdx) OverlayUI.state.currentIdx++;

                    console.log('[AutoQuest] Reordered:', srcIdx, '->', targetIdx);
                    OverlayUI.update();
                }
            };
        }

        panel.querySelector('#autoquest-btn-pause').onclick = (e) => {
            e.stopPropagation();
            OverlayUI.state.isPaused = !OverlayUI.state.isPaused;
            OverlayUI.update();
        };
        panel.querySelector('#autoquest-btn-stop').onclick = (e) => {
            e.stopPropagation();
            OverlayUI.state.isRunning = false;
            cleanup();
            document.getElementById('autoquest-overlay').remove();
        };
    }
};

function cleanup() {
    RunningGameStore.getRunningGames = window.__autoquest_backup.getRunningGames;
    RunningGameStore.getGameForPID = window.__autoquest_backup.getGameForPID;
    ApplicationStreamingStore.getStreamerActiveStreamMetadata = window.__autoquest_backup.getStreamerActiveStreamMetadata;
    document.querySelectorAll('.autoquest-ui-badge').forEach(el => el.remove());
}

async function start() {
    cleanup();
    OverlayUI.init();

    const getTargetQuests = () => [...QuestsStore.quests.values()].filter(x => {
        const isExpired = new Date(x.config.expiresAt).getTime() <= Date.now();
        const isCompleted = !!x.userStatus?.completedAt;
        
        if (isExpired || isCompleted) return false;

        const taskConfig = x.config.taskConfig ?? x.config.taskConfigV2;
        const tasks = taskConfig?.tasks ? Object.keys(taskConfig.tasks) : [];
        const hasSupportedTask = tasks.some(y => supportedTasks.includes(y));

        return hasSupportedTask;
    });

    let quests = getTargetQuests();
    OverlayUI.state.quests = quests;
    OverlayUI.update();

    if(quests.length === 0) {
        Logger.warn("No quests to process.");
        return;
    }

    console.group(`%c[AutoQuest] Pipeline for ${quests.length} Quests`, "color: #5865F2; font-size: 1.2em; font-weight: bold;");

    let i = 0;
    while (i < OverlayUI.state.quests.length) {
        if (!OverlayUI.state.isRunning) break;
        while (OverlayUI.state.isPaused) await new Promise(r => setTimeout(r, 1000));

        // インデックスはドラッグ＆ドロップで変わる可能性があるため、常に最新を取得
        OverlayUI.state.currentIdx = i;
        let quest = OverlayUI.state.quests[i];
        
        // 既に完了しているものが手動で前に移動された場合はスキップ
        if (quest.userStatus?.completedAt) {
            i++;
            continue;
        }

        OverlayUI.state.progress = "Starting...";
        OverlayUI.state.percent = 0;
        OverlayUI.update();

        const questName = quest.config.messages.questName;
        Logger.step(questName, "STARTING");
        
        try {
            // Accept
            if (!quest.userStatus?.enrolledAt) {
                Logger.info(`Action: Enrolling...`);
                OverlayUI.state.progress = "Enrolling...";
                OverlayUI.update();
                const res = await api.post({ url: `/quests/${quest.id}/enroll`, body: { location: 1 } });
                if (res.ok) {
                    Logger.success(`Enrolled successfully.`);
                    await new Promise(r => setTimeout(r, 2000));
                    quest = QuestsStore.getQuest(quest.id);
                }
            }

            // Spoof
            if (quest.userStatus?.enrolledAt && !quest.userStatus?.completedAt) {
                Logger.info(`Action: Spoofing progress...`);
                OverlayUI.state.progress = "Spoofing Progress...";
                OverlayUI.update();
                await handleQuest(quest);
                Logger.success(`Progress requirements met.`);
                OverlayUI.state.progress = "Completed!";
                OverlayUI.update();
                await new Promise(r => setTimeout(r, 2000));
            }

            // 次のクエストへ
            i++;

        } catch (e) {
            if (e.status === 429) {
                const retryAfter = e.body?.retry_after || 5;
                Logger.error(`Rate limited. Waiting ${Math.round(retryAfter)}s...`);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
            } else {
                Logger.error(`Error processing ${questName}:`, e);
            }
        }

        Logger.info("Cooldown (3s)...");
        await new Promise(r => setTimeout(r, 3000));
        cleanup();
    }

    console.groupEnd();
    Logger.success("ALL JOBS FINISHED!");
}

async function handleQuest(quest) {
    const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
    const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null);
    if (!taskName) return;

    const secondsNeeded = taskConfig.tasks[taskName].target;
    let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

    if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
        await handleVideoQuest(quest, secondsNeeded, secondsDone);
    } else if (taskName === "PLAY_ON_DESKTOP") {
        if (isApp) await handleGameQuest(quest, secondsNeeded, secondsDone);
    } else if (taskName === "PLAY_ON_XBOX" || taskName === "PLAY_ON_PLAYSTATION") {
        await handlePlatformQuest(quest, secondsNeeded, taskName);
    } else if (taskName === "STREAM_ON_DESKTOP") {
        if (isApp) await handleStreamQuest(quest, secondsNeeded, secondsDone);
    } else if (taskName === "PLAY_ACTIVITY") {
        await handleActivityQuest(quest, secondsNeeded);
    } else if (taskName === "ACHIEVEMENT_IN_ACTIVITY") {
        await handleAchievementQuest(quest, secondsNeeded);
    }
}

async function handleVideoQuest(quest, secondsNeeded, secondsDone) {
    const maxFuture = 10, speed = 7, interval = 1;
    const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime();
    while (secondsDone < secondsNeeded) {
        if (!OverlayUI.state.isRunning) break;
        while (OverlayUI.state.isPaused) await new Promise(r => setTimeout(r, 1000));

        const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
        const timestamp = Math.min(secondsNeeded, secondsDone + speed);
        if (maxAllowed - secondsDone >= speed) {
            const res = await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: timestamp + Math.random() } });
            if (res.body.completed_at) break;
            secondsDone = timestamp;
            console.log(`[AutoQuest] Video Progress: ${secondsDone}/${secondsNeeded}s`);
            OverlayUI.state.progress = `Watching Video: ${secondsDone}/${secondsNeeded}s`;
            OverlayUI.state.percent = (secondsDone / secondsNeeded) * 100;
            OverlayUI.update();
        }
        await new Promise(r => setTimeout(r, interval * 1000));
    }
    await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } });
}

async function handleGameQuest(quest, secondsNeeded, secondsDone) {
    const applicationId = quest.config.application?.id;
    if (!applicationId) {
        Logger.error(`Quest "${quest.config.messages.questName}" has no application info to spoof (config: ${JSON.stringify(quest.config)}).`);
        return;
    }
    const res = await api.get({ url: `/applications/public?application_ids=${applicationId}` });
    const appData = res.body[0] || { name: "Unknown Game" };
    const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">", "") || "game.exe";
    const pid = Math.floor(Math.random() * 30000) + 1000;

    const fakeGame = {
        cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
        exeName,
        exePath: `c:/program files/${(appData.name || "game").toLowerCase()}/${exeName}`,
        hidden: false,
        isLauncher: false,
        id: applicationId,
        name: appData.name || "Unknown Game",
        pid: pid,
        pidPath: [pid],
        processName: appData.name || "Unknown Game",
        start: Date.now(),
    };

    RunningGameStore.getRunningGames = () => [fakeGame];
    RunningGameStore.getGameForPID = () => fakeGame;

    FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [], added: [fakeGame], games: [fakeGame] });

    OverlayUI.state.progress = "Waiting for Discord heartbeat...";
    OverlayUI.state.percent = 0;
    OverlayUI.update();

    await new Promise((resolve) => {
        const onHeartbeat = data => {
            if (!OverlayUI.state.isRunning) {
                cleanup();
                FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
                resolve();
                return;
            }
            if (OverlayUI.state.isPaused) return;

            const status = data.userStatus;
            let progress = 0;

            try {
                if (quest.config.configVersion === 1) {
                    progress = status.streamProgressSeconds || 0;
                } else {
                    const taskKey = "PLAY_ON_DESKTOP";
                    const pData = status.progress?.[taskKey];
                    progress = pData?.value ?? pData ?? 0;
                }
            } catch (e) {
                Logger.error("Failed to parse progress data", e);
            }

            console.log(`[AutoQuest] Game Progress: ${progress}/${secondsNeeded}s`);
            OverlayUI.state.progress = `Playing Game: ${progress}/${secondsNeeded}s`;
            OverlayUI.state.percent = Math.min(100, (progress / secondsNeeded) * 100);
            OverlayUI.update();

            if (progress >= secondsNeeded) {
                cleanup();
                FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
                resolve();
            }
        };
        FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
    });
}

function handleStreamQuest(quest, secondsNeeded, secondsDone) {
    return new Promise((resolve) => {
        const applicationId = quest.config.application?.id;
        if (!applicationId) {
            Logger.error(`Quest "${quest.config.messages.questName}" has no application info to spoof (config: ${JSON.stringify(quest.config)}).`);
            resolve();
            return;
        }
        const pid = Math.floor(Math.random() * 30000) + 1000;
        ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({ id: applicationId, pid, sourceName: null });

        const onHeartbeat = data => {
            if (!OverlayUI.state.isRunning) {
                cleanup();
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
                return;
            }
            if (OverlayUI.state.isPaused) return;

            let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
            OverlayUI.state.progress = `Streaming: ${progress}/${secondsNeeded}s`;
            OverlayUI.state.percent = Math.min(100, (progress / secondsNeeded) * 100);
            OverlayUI.update();
            if (progress >= secondsNeeded) {
                cleanup();
                FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
                resolve();
            }
        };
        FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
    });
}

async function handleActivityQuest(quest, secondsNeeded) {
    const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id ?? Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL.length > 0).VOCAL[0].channel.id;
    const streamKey = `call:${channelId}:1`;
    while (true) {
        if (!OverlayUI.state.isRunning) break;
        while (OverlayUI.state.isPaused) await new Promise(r => setTimeout(r, 1000));

        const res = await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: false } });
        const progress = res.body.progress.PLAY_ACTIVITY.value;
        OverlayUI.state.progress = `Activity Progress: ${progress}/${secondsNeeded}s`;
        OverlayUI.state.percent = (progress / secondsNeeded) * 100;
        OverlayUI.update();
        if (progress >= secondsNeeded) {
            await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
            break;
        }
        await new Promise(r => setTimeout(r, 20000));
    }
}

// PLAY_ON_XBOX / PLAY_ON_PLAYSTATION quests have no local process to spoof, so unlike
// handleGameQuest we drive the heartbeat ourselves instead of relying on RunningGameStore.
async function handlePlatformQuest(quest, secondsNeeded, taskName) {
    const applicationId = quest.config.application?.id;
    const applicationName = quest.config.application?.name ?? "Unknown Game";
    if (!applicationId) {
        Logger.error(`Quest "${quest.config.messages.questName}" has no application info to spoof (config: ${JSON.stringify(quest.config)}).`);
        return;
    }
    const interval = 20;

    while (true) {
        if (!OverlayUI.state.isRunning) break;
        while (OverlayUI.state.isPaused) await new Promise(r => setTimeout(r, 1000));

        const res = await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { application_id: applicationId, terminal: false } });
        const progress = res.body.progress?.[taskName]?.value ?? 0;

        console.log(`[AutoQuest] Spoofed your game to ${applicationName}. Wait for ${Math.ceil((secondsNeeded - progress) / 60)} more minute(s).`);
        OverlayUI.state.progress = `Playing ${applicationName}: ${progress}/${secondsNeeded}s`;
        OverlayUI.state.percent = Math.min(100, (progress / secondsNeeded) * 100);
        OverlayUI.update();

        if (progress >= secondsNeeded || res.body.completed_at) break;
        await new Promise(r => setTimeout(r, interval * 1000));
    }
    await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { application_id: applicationId, terminal: true } });
}

// ACHIEVEMENT_IN_ACTIVITY quests are completed through the game's embedded activity (discordsays.com),
// not the regular quest heartbeat endpoint: authorize an OAuth2 session for the activity, report the
// achievement progress directly to it, then revoke the authorization again.
async function handleAchievementQuest(quest, secondsNeeded) {
    const applicationId = quest.config.application?.id;
    const applicationName = quest.config.application?.name ?? "Unknown Game";
    if (!applicationId) {
        Logger.error(`Quest "${quest.config.messages.questName}" has no application info (config: ${JSON.stringify(quest.config)}).`);
        return;
    }

    OverlayUI.state.progress = `Authorizing ${applicationName}...`;
    OverlayUI.state.percent = 0;
    OverlayUI.update();

    const query = new URLSearchParams({
        response_type: "code",
        client_id: applicationId,
        scope: "identify applications.commands applications.entitlements",
        state: "",
    });
    const authRes = await api.post({
        url: `/oauth2/authorize?${query.toString()}`,
        body: {
            permissions: "0",
            authorize: true,
            integration_type: 1,
            location_context: { guild_id: "10000", channel_id: "10000", channel_type: 10000 },
        },
    });
    const location = authRes.body?.location;
    const authCode = location ? new URL(location).searchParams.get("code") : null;
    if (!authCode) {
        Logger.error(`No auth code received for ${applicationName}. Cannot complete the quest.`);
        return;
    }

    const ticketRes = await api.post({ url: `/applications/${applicationId}/proxy-tickets`, body: {} });
    const referrer = new URL(`https://${applicationId}.discordsays.com/`);
    referrer.searchParams.set("instance_id", "autoquest-instance");
    referrer.searchParams.set("platform", "desktop");
    referrer.searchParams.set("discord_proxy_ticket", ticketRes.body.ticket);
    const activityReferrer = referrer.toString();

    const tokenData = await fetch(`https://${applicationId}.discordsays.com/.proxy/acf/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Discord-Quest-ID": quest.id, Referer: activityReferrer },
        body: JSON.stringify({ code: authCode }),
    }).then(r => r.json()).catch(e => {
        Logger.error(`Failed to authorize with Discord Says for ${applicationName}.`, e);
        return null;
    });
    if (!tokenData?.token) {
        Logger.error(`Failed to authorize with Discord Says for ${applicationName}. Cannot complete the quest.`);
        return;
    }

    OverlayUI.state.progress = `Reporting achievement...`;
    OverlayUI.state.percent = 50;
    OverlayUI.update();

    const progressOk = await fetch(`https://${applicationId}.discordsays.com/.proxy/acf/quest/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": tokenData.token, "X-Discord-Quest-ID": quest.id, Referer: activityReferrer },
        body: JSON.stringify({ progress: secondsNeeded }),
    }).then(r => r.ok).catch(() => false);
    if (!progressOk) {
        Logger.error(`Failed to report progress with Discord Says for ${applicationName}. Cannot complete the quest.`);
        return;
    }

    // Best-effort cleanup: the quest is already completed above, so a failure here is non-fatal.
    try {
        const tokens = (await api.get({ url: `/oauth2/tokens` })).body;
        const tokenInfo = tokens.find(t => t.application.id === applicationId);
        if (tokenInfo) await api.del({ url: `/oauth2/tokens/${tokenInfo.id}` });
    } catch (e) {
        Logger.warn(`Failed to deauthorize ${applicationName} after completing the quest.`, e);
    }

    OverlayUI.state.progress = "Completed!";
    OverlayUI.state.percent = 100;
    OverlayUI.update();
}

start();