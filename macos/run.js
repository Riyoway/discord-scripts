// Native macOS runner. Uses JXA, Foundation, and AppKit; no additional runtime.
const BASE = 'https://script.riyo.me';
function debugBase(port) { return 'http://127.0.0.1:' + port; }

function parseOptions(argv) {
    let name = 'menu', client = null, i = 0;
    if (argv[0] && !argv[0].startsWith('--')) { name = argv[0]; i++; }
    while (i < argv.length) {
        if (argv[i] !== '--client' || !argv[i + 1]) throw new Error('Use --client followed by a client name or PID.');
        client = argv[i + 1]; i += 2;
    }
    return { name, client };
}

function choose(items, title, label) {
    if (items.length === 1) return items[0];
    write('\n' + title + '\n');
    items.forEach((item, index) => write((index + 1) + '. ' + label(item) + '\n'));
    while (true) {
        const answer = readLine('Pick a number (blank to cancel): ');
        if (!answer) return null;
        if (/^[1-9]\d*$/.test(answer) && items[Number(answer) - 1]) return items[Number(answer) - 1];
        write('Choose one of the listed numbers.\n');
    }
}

function chooseClient(items, requested) {
    let choices = items;
    if (requested) {
        const value = String(requested).toLowerCase();
        choices = items.filter(item => item.name.toLowerCase() === value || item.key === value || (item.pid && String(item.pid) === value));
        if (!choices.length) throw new Error('Discord client not found: ' + requested);
    } else {
        const running = items.filter(item => item.pid);
        if (running.length) choices = running;
    }
    if (!choices.length) throw new Error('No Discord app found in /Applications or ~/Applications.');
    return choose(choices, 'Choose the Discord client to use:', item => item.name + (item.pid ? ' (PID ' + item.pid + ')' : ' (not running)') + ' - ' + item.path);
}

function commandFor(name) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Invalid script name.');
    return 'curl -fsSL ' + BASE + '/d/m/' + name + ' | sh';
}

function selectPage(pages) {
    const matches = discordPages(pages);
    return matches.length ? choose(matches, 'Choose the Discord window:', page => (page.title || 'Discord') + ' - ' + page.url) : undefined;
}

function discordPages(pages) {
    return pages.filter(page => page.type === 'page' && /^https:\/\/(?:[a-z0-9-]+\.)?discord\.com\/(?:channels|quest-home|app)(?:\/|$)/.test(page.url));
}

function makeExpression(name, code, input) {
    const approval = 'const riyoScriptApproved=' + JSON.stringify(name) + ';';
    if (name === 'token') return '(function(){' + approval + 'return (\n' + code.trim().replace(/;$/, '') + '\n);})()';
    if (name === 'whoami') {
        return '(function(){' + approval + 'const tables=[];const console={log(){},table(v){tables.push(v)},error(...v){throw new Error(v.join(" "))}};\n' + code + '\nreturn tables;})()';
    }
    if (name === 'snowflake') {
        return '(function(){' + approval + 'let result;const prompt=(message,value)=>value===undefined?' + JSON.stringify(input) + ':(result=value);const alert=message=>{throw new Error(message)};\n' + code + '\nreturn result;})()';
    }
    return '(function(){' + approval + '\n' + code + '\n})()';
}

function socketUrl(page, port) {
    // The discovery endpoint must never redirect the injector to a remote socket.
    if (!new RegExp('^ws://127\\.0\\.0\\.1:' + port + '/devtools/page/[a-z0-9-]+$', 'i').test(page.webSocketDebuggerUrl)) {
        throw new Error('Unexpected Discord debug socket URL.');
    }
    return page.webSocketDebuggerUrl;
}

function text(data) {
    return ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding));
}

function write(value) {
    $.NSFileHandle.fileHandleWithStandardOutput.writeData($(String(value)).dataUsingEncoding($.NSUTF8StringEncoding));
}

function readLine(prompt) {
    write(prompt);
    // Read the terminal directly: stdin may contain the downloaded shell loader.
    const tty = $.NSFileHandle.fileHandleForReadingAtPath('/dev/tty');
    if (tty.isNil()) throw new Error('Open Terminal and run this command interactively.');
    const bytes = $.NSMutableData.data;
    try {
        while (true) {
            const byte = tty.readDataOfLength(1);
            if (!byte.length) throw new Error('Terminal input closed.');
            if (text(byte) === '\n') break;
            bytes.appendData(byte);
            if (bytes.length > 4096) throw new Error('Input is too long.');
        }
        return text(bytes).trim();
    } finally { tty.closeFile; }
}

function copy(value) {
    const clipboard = $.NSPasteboard.generalPasteboard;
    clipboard.clearContents;
    if (!clipboard.setStringForType(String(value), $.NSPasteboardTypeString)) {
        throw new Error('Could not write to the clipboard.');
    }
}

function confirmScript(name) {
    const directory = ObjC.unwrap($.NSHomeDirectory()) + '/Library/Application Support/Riyo Scripts/consent';
    const file = directory + '/' + name + '.txt';
    const saved = $.NSData.dataWithContentsOfFile(file);
    if (!saved.isNil() && text(saved).trim() === 'yes') return true;
    write('\nRiyo Scripts - ' + name + '\n');
    write('Use this script at your own risk. You are responsible for any consequences, including issues affecting your account or data.\n');
    while (true) {
        const choice = readLine('Run this script? [Yes/No] (default: No): ').toLowerCase();
        if (!choice || choice === 'no' || choice === 'n') return false;
        if (choice === 'yes' || choice === 'y') break;
        write('Please enter Yes or No.\n');
    }
    if (!$.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(directory, true, $(), $()) ||
        !$('yes').dataUsingEncoding($.NSUTF8StringEncoding).writeToFileAtomically(file, true)) {
        write('Could not remember your choice; you will be asked again next time.\n');
    }
    return true;
}

function execute(path, args, allowFailure) {
    const task = $.NSTask.alloc.init;
    const output = $.NSPipe.pipe;
    task.launchPath = path;
    task.arguments = args;
    task.standardOutput = output;
    task.standardError = allowFailure
        ? $.NSFileHandle.fileHandleForWritingAtPath('/dev/null')
        : $.NSFileHandle.fileHandleWithStandardError;
    task.launch;
    // Drain stdout before waiting so large script sources cannot fill the pipe.
    const result = text(output.fileHandleForReading.readDataToEndOfFile);
    task.waitUntilExit;
    if (task.terminationStatus !== 0 && !allowFailure) throw new Error(path + ' failed (' + task.terminationStatus + ').');
    return task.terminationStatus === 0 ? result : null;
}

function fetchText(url, timeout, allowFailure) {
    return execute('/usr/bin/curl', ['-fsSL', '--max-time', String(timeout || 30), url], allowFailure);
}

function getClients() {
    const running = $.NSWorkspace.sharedWorkspace.runningApplications;
    const installed = [];
    ['/Applications', ObjC.unwrap($.NSHomeDirectory()) + '/Applications'].forEach(directory => {
        ['Discord', 'Discord PTB', 'Discord Canary', 'Discord Development'].forEach((name, variant) => {
            const path = directory + '/' + name + '.app';
            const bundle = $.NSBundle.bundleWithPath(path);
            if (bundle.isNil() || bundle.executablePath.isNil() ||
                !$.NSFileManager.defaultManager.isExecutableFileAtPath(bundle.executablePath)) return;
            const processes = [];
            for (let i = 0; i < running.count; i++) {
                const app = running.objectAtIndex(i);
                if (!app.bundleURL.isNil() && ObjC.unwrap(app.bundleURL.path) === path) processes.push(app);
            }
            const instances = processes.length;
            if (instances) processes.forEach(app => installed.push({ name, key: ['stable','ptb','canary','development'][variant], path, executable: ObjC.unwrap(bundle.executablePath), processes: [app], pid: Number(app.processIdentifier), instances, defaultPort: 9222 + variant }));
            else installed.push({ name, key: ['stable','ptb','canary','development'][variant], path, executable: ObjC.unwrap(bundle.executablePath), processes: [], pid: 0, instances: 0, defaultPort: 9222 + variant });
        });
    });
    return installed;
}

function parseListeners(output) {
    let pid = 0;
    const result = [];
    String(output || '').split('\n').forEach(line => {
        let match = /^p(\d+)$/.exec(line);
        if (match) pid = Number(match[1]);
        else if ((match = /^n(?:127\.0\.0\.1|0\.0\.0\.0|\*):(\d+)$/.exec(line))) result.push({ pid, port: Number(match[1]) });
    });
    return result;
}

function getListeners() {
    return parseListeners(execute('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn'], true));
}

function ownsPort(selected, port) {
    return !!selected.pid && getListeners().some(listener => listener.pid === selected.pid && listener.port === port);
}

function testPort(selected, port, deadline) {
    if (!ownsPort(selected, port)) return false;
    const value = fetchText(debugBase(port) + '/json/version', Math.min(2, remainingSeconds(deadline)), true);
    try { const version = JSON.parse(value || 'null'); return !!(version && version.Browser && version['Protocol-Version']); }
    catch (_) { return false; }
}

function remainingSeconds(deadline) {
    const seconds = Math.floor((deadline - Date.now()) / 1000);
    if (seconds < 1) throw new Error('Discord startup timed out (60-second limit). Open Discord, wait for it to load, and try again.');
    return seconds;
}

function clientRunning(selected) {
    return selected.task ? !!selected.task.running : selected.processes.some(app => !app.terminated);
}

function startDiscord(selected, port, deadline) {
    if (selected.instances > 1) throw new Error('This app has multiple instances. Start the intended instance with its own --remote-debugging-port before injecting.');
    if (selected.pid) {
        const command = execute('/bin/ps', ['-ww', '-p', String(selected.pid), '-o', 'command='], true);
        if (!command) throw new Error('Could not inspect the selected client arguments.');
        if (/(?:^|\s)"?--(?:user-data-dir|profile-directory)(?:=|\s)/i.test(command)) {
            throw new Error('Start this custom profile with its own --remote-debugging-port before injecting.');
        }
    }
    write('Starting ' + selected.name + ' with remote debugging (restarting it will drop any call)...\n');
    selected.processes.forEach(app => {
        if (!app.terminate) throw new Error('Could not quit Discord. Quit it manually and try again.');
    });
    // AppKit refreshes termination state only when the main run loop advances.
    for (let i = 0; i < 20 && selected.processes.some(app => !app.terminated); i++) {
        remainingSeconds(deadline);
        $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.5));
    }
    if (selected.processes.some(app => !app.terminated)) throw new Error('Discord did not quit. Quit it manually and try again.');
    // Launch the bundle executable directly and monitor Discord, not the open helper.
    const task = $.NSTask.alloc.init;
    try {
        task.executableURL = $.NSURL.fileURLWithPath(selected.executable);
        task.arguments = ['--remote-debugging-port=' + port];
        // Discord must outlive this runner without inheriting its terminal or pipes.
        task.standardInput = $.NSFileHandle.fileHandleWithNullDevice;
        task.standardOutput = $.NSFileHandle.fileHandleWithNullDevice;
        task.standardError = $.NSFileHandle.fileHandleWithNullDevice;
        const error = Ref();
        if (!task.launchAndReturnError(error)) {
            throw new Error('Could not launch ' + selected.name + ': ' + ObjC.unwrap(error[0].localizedDescription));
        }
        selected.task = task;
        selected.pid = Number(task.processIdentifier);
        write(selected.name + ' launched. Waiting for the local debug port...\n');
        for (let i = 0; ; i++) {
            remainingSeconds(deadline);
            $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(1));
            // A refused connection during startup is expected; keep waiting silently.
            if (testPort(selected, port, deadline)) return;
            if (!task.running) throw new Error(selected.name + ' exited during startup (status ' + task.terminationStatus + ').');
        }
    } catch (error) {
        if (!task.running) {
            write('Reopening ' + selected.name + ' normally...\n');
            if (!$.NSWorkspace.sharedWorkspace.openURL($.NSURL.fileURLWithPath(selected.path))) {
                throw new Error(error.message + ' Could not reopen Discord; open it from Applications.');
            }
        }
        throw error;
    }
}

function connect(url) {
    // JXA callbacks must stay on the main thread. Pump its run loop while waiting.
    const session = $.NSURLSession.sessionWithConfigurationDelegateDelegateQueue(
        $.NSURLSessionConfiguration.ephemeralSessionConfiguration, $(), $.NSOperationQueue.mainQueue);
    const socket = session.webSocketTaskWithURL($.NSURL.URLWithString(url));
    socket.maximumMessageSize = 8 * 1024 * 1024;
    socket.resume;
    let nextId = 0;
    return {
        evaluate(expression, timeout) {
            const id = ++nextId;
            const payload = JSON.stringify({ id, method: 'Runtime.evaluate', params: {
                expression, userGesture: true, awaitPromise: false, returnByValue: true
            } });
            let reply = null;
            let failure = null;
            const nativeFailure = error => {
                if (error && !error.isNil()) failure = new Error(ObjC.unwrap(error.localizedDescription));
            };
            socket.sendMessageCompletionHandler($.NSURLSessionWebSocketMessage.alloc.initWithString(payload), nativeFailure);
            const receive = () => socket.receiveMessageWithCompletionHandler((message, error) => {
                nativeFailure(error);
                if (failure) return;
                try {
                    if (message.isNil() || message.string.isNil()) throw new Error('Unexpected binary debug response.');
                    const response = JSON.parse(ObjC.unwrap(message.string));
                    if (response.id === id) reply = response;
                    else receive();
                } catch (error) { failure = error; }
            });
            receive();
            const deadline = Date.now() + (timeout || 8000);
            while (!reply && !failure && Date.now() < deadline) {
                $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.02));
            }
            if (failure) throw failure;
            if (!reply) throw new Error('Timed out waiting for Discord.');
            if (reply.error) throw new Error('Discord debug protocol failed: ' + reply.error.message);
            const result = reply.result;
            if (result.exceptionDetails) {
                const exception = result.exceptionDetails;
                throw new Error(exception.exception && exception.exception.description || exception.text);
            }
            return result.result.value;
        },
        close() { socket.cancel; session.invalidateAndCancel; }
    };
}

function run(argv) {
    ObjC.import('AppKit');
    const options = parseOptions(argv);
    const scripts = JSON.parse(fetchText(BASE + '/d/list')).filter(script =>
        script.category === 'Discord' && /^[a-z][a-z0-9-]*$/.test(script.name) && script.source === '/d/c/' + script.name);
    let name = options.name;
    let action = 'r';
    if (name === 'menu') {
        write('\nRiyo Scripts / Discord\n\n');
        scripts.forEach((script, index) => write((index + 1) + '. ' + (script.displayName || script.name) + ' — ' + script.desc + '\n'));
        const choice = readLine('\nPick a number (blank to cancel): ');
        if (!choice) return;
        if (!/^\d+$/.test(choice) || !scripts[Number(choice) - 1]) throw new Error('Invalid script number.');
        name = scripts[Number(choice) - 1].name;
        action = readLine('[r]un, [c]opy source, or [p]copy command (blank to cancel): ').toLowerCase();
        if (!action) return;
        if (!/^[rcp]$/.test(action)) throw new Error('Choose r, c, or p.');
    }
    const script = scripts.find(script => script.name === name);
    if (!script) throw new Error('Unknown Discord script: ' + name);
    if (action === 'p') { copy(commandFor(name)); write('Command copied to clipboard.\n'); return; }
    if (action === 'r' && script.runner && !confirmScript(name)) { write('Cancelled.\n'); return; }
    write('Fetching ' + name + '...\n');
    const code = fetchText(BASE + script.source);
    if (action === 'c' || !script.runner) { copy(code); write('Source copied to clipboard.\n'); return; }
    const input = name === 'snowflake' ? readLine('Discord ID or message link (blank to cancel): ') : null;
    if (name === 'snowflake' && !input) return;
    const selected = chooseClient(getClients(), options.client);
    if (!selected) { write('Cancelled.\n'); return; }
    write('Using ' + selected.name + (selected.pid ? ' (PID ' + selected.pid + ')' : '') + '.\n');
    let deadline = Date.now() + 60000;
    const listeners = getListeners();
    let port = listeners.filter(listener => listener.pid === selected.pid).map(listener => listener.port)
        .find(value => testPort(selected, value, deadline));
    if (!port) {
        port = selected.defaultPort;
        while (listeners.some(listener => listener.port === port)) port++;
        if (port > 65535) throw new Error('No available local debug port.');
        startDiscord(selected, port, deadline);
    }
    write('Locating the Discord window...\n');
    let pages = [];
    while (!pages.length) {
        const response = fetchText(debugBase(port) + '/json', Math.min(3, remainingSeconds(deadline)), true);
        try { if (response) pages = discordPages(JSON.parse(response)); } catch (_) { /* Renderer may still be starting. */ }
        if (pages.length) break;
        if (!clientRunning(selected)) throw new Error('The selected Discord client exited.');
        delay(1);
    }
    const remaining = remainingSeconds(deadline) * 1000;
    const page = selectPage(pages);
    if (!page) { write('Cancelled.\n'); return; }
    deadline = Date.now() + remaining;
    if (!ownsPort(selected, port)) throw new Error('The selected Discord client debug port is no longer available.');
    const client = connect(socketUrl(page, port));
    try {
        while (true) {
            if (client.evaluate('typeof webpackChunkdiscord_app', Math.min(3000, remainingSeconds(deadline) * 1000)) === 'object') break;
            if (!clientRunning(selected)) throw new Error('The selected Discord client exited.');
            delay(1);
        }
        if (!ownsPort(selected, port)) throw new Error('The selected Discord client debug port is no longer available.');
        write('Injecting...\n');
        const value = client.evaluate(makeExpression(name, code, input));
        if (name === 'token') {
            if (typeof value !== 'string' || !value) throw new Error('No token returned. Are you logged in?');
            copy(value);
            write('Token copied to clipboard.\n');
        } else if (name === 'whoami') {
            if (!Array.isArray(value) || !value.length) throw new Error('No account inventory returned.');
            write(JSON.stringify(value, null, 2) + '\n');
        } else if (name === 'snowflake') {
            if (value) { copy(value); write('Timestamp copied to clipboard: ' + value + '\n'); }
        } else write(name + ' injected. Use its panel in Discord.\n');
    } finally { client.close(); }
}
