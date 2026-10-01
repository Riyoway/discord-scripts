// Embed shared UI assets in standalone scripts. Use --check to detect stale copies.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const theme = fs.readFileSync(path.join(root, 'ui/theme.js'), 'utf8').trim();
const start = '    // BEGIN SHARED UI';
const end = '    // END SHARED UI';
for (const name of ['autoquest', 'media', 'search', 'timestamp', 'export', 'snowflake']) {
    const assets = theme + (['media', 'search'].includes(name) ? '\n' + fs.readFileSync(path.join(root, 'ui/channels.js'), 'utf8').trim() : '');
    const block = start + '\n' + assets.split('\n').map(line => '    ' + line).join('\n') + '\n' + end;
    const file = path.join(root, 'console', name + '.js');
    const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const first = source.indexOf(start);
    const next = first < 0
        ? source.replace(/(\((?:async )?\(\) => \{\n)/, '$1' + block + '\n')
        : source.slice(0, first) + block + source.slice(source.indexOf(end, first) + end.length);
    if (!next.includes(block)) throw new Error('Missing script entry point: ' + name);
    if (process.argv.includes('--check')) {
        if (source !== next) { console.error('Stale shared UI: ' + name); process.exitCode = 1; }
    } else fs.writeFileSync(file, next);
}
