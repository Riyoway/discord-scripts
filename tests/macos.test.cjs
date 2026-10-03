// Offline logic check: node tests/macos.test.cjs. Does not exercise Apple's JXA bridge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'macos/run.js'), 'utf8');
const runner = vm.createContext({});
vm.runInContext(source, runner);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts.json'), 'utf8'));
for (const script of manifest) {
    const code = fs.readFileSync(path.join(root, 'console', script.name + '.js'), 'utf8');
    new vm.Script(runner.makeExpression(script.name, code, '175928847299117063'));
    assert.equal(runner.commandFor(script.name),
        'curl -fsSL https://script.riyo.me/d/m/' + script.name + ' | sh');
    const wrapper = fs.readFileSync(path.join(root, 'macos', script.name + '.sh'), 'utf8');
    assert.ok(wrapper.includes('/d/m/run') && wrapper.includes('riyo-scripts ' + script.name));
}
assert.throws(() => runner.commandFor('token; echo unsafe'), /Invalid script name/);
const login = { type: 'page', url: 'https://discord.com/login' };
const channel = { type: 'page', url: 'https://canary.discord.com/channels/@me' };
const quest = { type: 'page', url: 'https://discord.com/quest-home' };
assert.equal(runner.selectPage([login, quest, channel]), channel);
assert.equal(runner.selectPage([login]), undefined);
assert.equal(runner.selectPage([quest]), quest);
const socket = 'ws://127.0.0.1:9222/devtools/page/ABC-123';
assert.equal(runner.socketUrl({ webSocketDebuggerUrl: socket }), socket);
assert.throws(() => runner.socketUrl({ webSocketDebuggerUrl: 'ws://example.com/devtools/page/ABC' }), /Unexpected/);
assert.throws(() => runner.socketUrl({ webSocketDebuggerUrl: 'ws://127.0.0.1:9222@evil.test/devtools/page/ABC' }), /Unexpected/);
const tables = vm.runInNewContext(runner.makeExpression('whoami', 'console.table({id:"123"});'));
assert.equal(tables[0].id, '123');
const input = '123\";throw new Error("injected");//';
assert.equal(vm.runInNewContext(runner.makeExpression('snowflake',
    'const id=prompt("ID"); prompt("Result",id);', input)), input);
assert.equal(vm.runInNewContext(runner.makeExpression('token', '"secret"')), 'secret');
assert.throws(() => vm.runInNewContext(runner.makeExpression('snowflake',
    'alert("Invalid ID");', 'bad')), /Invalid ID/);
// Simulate AppKit keeping stale process state until its main run loop advances.
let quitRequested = false;
let terminated = false;
let launches = 0;
let restored = 0;
let probes = 0;
let readyAfter = 2;
let launchFails = false;
let staysRunning = true;
const executable = { isNil: () => false, value: '/Applications/Discord.app/Contents/MacOS/DiscordClient' };
const app = {
    bundleURL: { isNil: () => false, path: '/Applications/Discord.app' },
    get terminate() { quitRequested = true; return true; },
    get terminated() { return terminated; }
};
runner.ObjC = { unwrap: value => value.value || value };
runner.Ref = () => [{ localizedDescription: 'Launch denied' }];
runner.$ = {
    NSWorkspace: { sharedWorkspace: {
        runningApplications: { count: 1, objectAtIndex: () => app },
        openURL(url) { assert.equal(url, '/Applications/Discord.app'); restored++; return true; }
    } },
    NSHomeDirectory: () => '/Users/example',
    NSBundle: { bundleWithPath: bundle => ({
        isNil: () => bundle !== '/Applications/Discord.app', executablePath: executable
    }) },
    NSFileManager: { defaultManager: { isExecutableFileAtPath: () => true } },
    NSDate: { dateWithTimeIntervalSinceNow: seconds => seconds },
    NSRunLoop: { currentRunLoop: { runUntilDate() {
        assert.ok(quitRequested, 'Request a normal quit before waiting');
        terminated = true;
    } } },
    NSURL: { fileURLWithPath: value => value },
    NSFileHandle: { fileHandleWithNullDevice: {} },
    NSTask: { alloc: { get init() { return {
        get running() { return !launchFails && staysRunning; },
        terminationStatus: 42,
        launchAndReturnError() {
            assert.ok(terminated, 'Wait for confirmed termination before relaunching');
            assert.equal(this.executableURL, executable.value);
            assert.deepEqual(Array.from(this.arguments), ['--remote-debugging-port=9222']);
            for (const handle of ['standardInput', 'standardOutput', 'standardError']) {
                assert.equal(this[handle], runner.$.NSFileHandle.fileHandleWithNullDevice);
            }
            launches++;
            return !launchFails;
        }
    }; } } }
};
runner.write = () => {};
runner.fetchText = (url, timeout, allowFailure) => {
    assert.equal(url, 'http://127.0.0.1:9222/json/version');
    assert.equal(timeout, 2);
    assert.equal(allowFailure, true, 'Connection refusal must not abort startup');
    return ++probes >= readyAfter ? 'ready' : null;
};
runner.startDiscord();
assert.equal(launches, 1);
assert.equal(probes, 2);
assert.equal(restored, 0);
readyAfter = Infinity;
assert.throws(() => runner.startDiscord(), /is running, but its debug port did not open/);
assert.equal(restored, 0, 'Do not relaunch a Discord process that is still running');
// Report an exited process and recover the normal app instead of leaving it closed.
staysRunning = false;
assert.throws(() => runner.startDiscord(), /exited during startup \(status 42\)/);
assert.equal(restored, 1);
launchFails = true;
assert.throws(() => runner.startDiscord(), /Could not launch Discord: Launch denied/);
assert.equal(restored, 2);
console.log('Native macOS runner logic check passed.');
