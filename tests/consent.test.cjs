// Offline check: node tests/consent.test.cjs. No Discord, network, or disk writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const scripts = JSON.parse(fs.readFileSync(path.join(root, 'scripts.json'), 'utf8'));
const helper = fs.readFileSync(path.join(root, 'ui/consent.js'), 'utf8');

function browser() {
    const saved = new Map();
    let dialog, shown = 0;
    const context = vm.createContext({
        riyoTheme: '', console,
        localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
        document: { body: { appendChild(node) { dialog = node; } }, createElement(tag) {
            assert.equal(tag, 'dialog', 'No script overlay may open before approval');
            return { setAttribute() {}, showModal() { shown++; }, remove() {}, returnValue: '' };
        } }
    });
    vm.runInContext(helper + '\nthis.runScript = riyoRunScript;', context);
    return { context, saved, get shown() { return shown; }, close(value) { dialog.returnValue = value; dialog.onclose(); } };
}

(async () => {
    // Every real script must stop before touching Discord when No is chosen.
    for (const { name } of scripts) {
        const page = browser();
        const result = vm.runInContext(fs.readFileSync(path.join(root, 'console', name + '.js'), 'utf8'), page.context);
        assert.equal(page.shown, 1, name + ' must show its warning');
        page.close('no');
        await result;
        assert.equal(page.saved.size, 0, name + ' must not remember No');
    }
    const page = browser();
    let runs = 0;
    const first = page.context.runScript('token', () => ++runs);
    assert.equal(runs, 0);
    page.close('yes');
    assert.equal(await first, 1);
    assert.equal(page.context.runScript('token', () => ++runs), 2);
    assert.equal(page.shown, 1, 'An approved script must not ask again');
    const other = page.context.runScript('media', () => ++runs);
    page.close('');
    await other;
    assert.equal(runs, 2, 'Escape/close must cancel a different script');
    assert.throws(() => page.context.runScript('token', () => { throw new Error('Original error'); }), /Original error/);
    assert.equal(page.shown, 2, 'A script error must not reopen the warning');

    // The native terminal approval skips the dialog and preserves token return values.
    const native = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'macos/run.js'), 'utf8'), native);
    const tokenContext = { webpackChunkdiscord_app: {
        push: entries => entries[2]({ c: { token: { exports: { setToken() {}, getToken: () => 'offline-token' } } } }), pop() {}
    } };
    assert.equal(vm.runInNewContext(native.makeExpression('token', fs.readFileSync(path.join(root, 'console/token.js'), 'utf8')), tokenContext), 'offline-token');
    let answers = ['invalid', 'No'];
    const approvals = new Map();
    native.$ = value => ({ dataUsingEncoding: () => ({ writeToFileAtomically(file) { approvals.set(file, value); return true; } }) });
    Object.assign(native.$, {
        NSHomeDirectory: () => '/Users/offline',
        NSData: { dataWithContentsOfFile: file => ({ isNil: () => !approvals.has(file), text: approvals.get(file) }) },
        NSFileManager: { defaultManager: { createDirectoryAtPathWithIntermediateDirectoriesAttributesError: () => true } }
    });
    native.ObjC = { unwrap: value => value };
    native.text = data => data.text;
    native.write = () => {};
    native.readLine = () => { assert.ok(answers.length, 'Unexpected terminal prompt'); return answers.shift(); };
    assert.equal(native.confirmScript('token'), false);
    assert.equal(approvals.size, 0);
    answers = ['YES'];
    assert.equal(native.confirmScript('token'), true);
    assert.equal(native.confirmScript('token'), true);
    answers = [''];
    assert.equal(native.confirmScript('media'), false);
    assert.equal(approvals.size, 1);
    console.log('First-run consent check passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
