// Native macOS runner. Uses JXA, Foundation, and AppKit; no additional runtime.
const BASE = 'https://script.riyo.me';
const DEBUG = 'http://127.0.0.1:9222';

function commandFor(name) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Invalid script name.');
    return 'curl -fsSL ' + BASE + '/d/m/' + name + ' | sh';
}

function selectPage(pages) {
    const matches = pages.filter(page => page.type === 'page' &&
        /^https:\/\/(?:[a-z0-9-]+\.)?discord\.com\/(?:channels|quest-home|app)(?:\/|$)/.test(page.url));
    return matches.find(page => /\/(?:channels|app)(?:\/|$)/.test(page.url)) || matches[0];
}

function makeExpression(name, code, input) {
    if (name === 'token') return code;
    if (name === 'whoami') {
        return '(function(){const tables=[];const console={log(){},table(v){tables.push(v)},error(...v){throw new Error(v.join(" "))}};\n' + code + '\nreturn tables;})()';
    }
    if (name === 'snowflake') {
        return '(function(){let result;const prompt=(message,value)=>value===undefined?' + JSON.stringify(input) + ':(result=value);const alert=message=>{throw new Error(message)};\n' + code + '\nreturn result;})()';
    }
    return '(function(){\n' + code + '\n})()';
}

function socketUrl(page) {
    // The discovery endpoint must never redirect the injector to a remote socket.
    if (!/^ws:\/\/127\.0\.0\.1:9222\/devtools\/page\/[a-z0-9-]+$/i.test(page.webSocketDebuggerUrl)) {
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

function startDiscord() {
    const running = $.NSWorkspace.sharedWorkspace.runningApplications;
    const installed = [];
    ['/Applications', ObjC.unwrap($.NSHomeDirectory()) + '/Applications'].forEach(directory => {
        ['Discord', 'Discord PTB', 'Discord Canary', 'Discord Development'].forEach(name => {
            const path = directory + '/' + name + '.app';
            const bundle = $.NSBundle.bundleWithPath(path);
            if (bundle.isNil() || bundle.executablePath.isNil() ||
                !$.NSFileManager.defaultManager.isExecutableFileAtPath(bundle.executablePath)) return;
            const processes = [];
            for (let i = 0; i < running.count; i++) {
                const app = running.objectAtIndex(i);
                if (!app.bundleURL.isNil() && ObjC.unwrap(app.bundleURL.path) === path) processes.push(app);
            }
            installed.push({ name, path, processes });
        });
    });
    const selected = installed.find(app => app.processes.length) || installed[0];
    if (!selected) throw new Error('No Discord app found in /Applications or ~/Applications.');
    write('Starting ' + selected.name + ' with remote debugging (restarting it will drop any call)...\n');
    selected.processes.forEach(app => {
        if (!app.terminate) throw new Error('Could not quit Discord. Quit it manually and try again.');
    });
    for (let i = 0; i < 20 && selected.processes.some(app => !app.terminated); i++) delay(0.5);
    if (selected.processes.some(app => !app.terminated)) throw new Error('Discord did not quit. Quit it manually and try again.');
    execute('/usr/bin/open', ['-n', '-a', selected.path, '--args', '--remote-debugging-port=9222']);
    for (let i = 0; i < 30; i++) {
        delay(1);
        if (fetchText(DEBUG + '/json/version', 2, true)) return;
    }
    throw new Error('Debug port never opened; this Discord build may block remote debugging.');
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
    const scripts = JSON.parse(fetchText(BASE + '/d/list')).filter(script =>
        script.category === 'Discord' && /^[a-z][a-z0-9-]*$/.test(script.name) && script.source === '/d/c/' + script.name);
    let name = argv[0] || 'menu';
    let action = 'r';
    if (name === 'menu') {
        write('\nRiyo Scripts / Discord\n\n');
        scripts.forEach((script, index) => write((index + 1) + '. ' + script.name + ' — ' + script.desc + '\n'));
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
    write('Fetching ' + name + '...\n');
    const code = fetchText(BASE + script.source);
    if (action === 'c' || !script.runner) { copy(code); write('Source copied to clipboard.\n'); return; }
    const input = name === 'snowflake' ? readLine('Discord ID or message link (blank to cancel): ') : null;
    if (name === 'snowflake' && !input) return;
    if (!fetchText(DEBUG + '/json/version', 2, true)) startDiscord();
    write('Locating the Discord window...\n');
    let page;
    for (let i = 0; i < 20 && !page; i++) {
        const response = fetchText(DEBUG + '/json', 3, true);
        if (response) page = selectPage(JSON.parse(response));
        if (!page) delay(1);
    }
    if (!page) throw new Error('No Discord window found. Open the main window and log in first.');
    const client = connect(socketUrl(page));
    try {
        let ready = false;
        for (let i = 0; i < 20; i++) {
            if (client.evaluate('typeof webpackChunkdiscord_app', 3000) === 'object') { ready = true; break; }
            delay(1);
        }
        if (!ready) throw new Error('Discord did not finish loading. Log in and try again.');
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
