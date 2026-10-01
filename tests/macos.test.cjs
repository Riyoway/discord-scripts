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
        'curl -fsSL https://script.riyo.me/d/m/run | sh -s -- ' + script.name);
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
assert.equal(runner.makeExpression('token', '"secret"'), '"secret"');
assert.throws(() => vm.runInNewContext(runner.makeExpression('snowflake',
    'alert("Invalid ID");', 'bad')), /Invalid ID/);
console.log('Native macOS runner logic check passed.');
