// Shared channel parsing and authenticated history access for Search and Media.
const riyoChannelId = (input, current) => {
    const value = input.trim();
    if (!value && /^\d{1,20}$/.test(current || '')) return current;
    const id = value.match(/^(\d{15,20})$/)?.[1] || value.match(/^<#(\d{15,20})>$/)?.[1]
        || value.match(/^https?:\/\/(?:[a-z0-9-]+\.)?discord(?:app)?\.com\/channels\/(?:@me|\d+)\/(\d{15,20})(?:\/\d{15,20})?\/?(?:[?#].*)?$/i)?.[1];
    if (!id) throw new Error('Enter a channel ID or Discord channel/message link. Leave blank for the current channel.');
    return id;
};
const riyoChannelModules = () => {
    if (typeof webpackChunkdiscord_app === 'undefined') throw new Error('Run this script inside Discord after it has loaded.');
    let require;
    try { require = webpackChunkdiscord_app.push([[Symbol()], {}, value => value]); }
    finally { webpackChunkdiscord_app.pop(); }
    const find = predicate => {
        for (const module of Object.values(require.c)) {
            try {
                for (const value of [module.exports, ...Object.values(module.exports ?? {})]) {
                    if (value && predicate(value)) return value;
                }
            } catch { /* Lazy exports may not be initialized yet. */ }
        }
        return null;
    };
    const store = method => find(value => typeof Object.getOwnPropertyDescriptor(Object.getPrototypeOf(value), method)?.value === 'function');
    return {
        channels: store('getChannelId'), messages: store('getMessages'),
        api: find(value => ['get', 'post', 'put', 'patch'].every(method => typeof Object.getOwnPropertyDescriptor(value, method)?.value === 'function')
            && /^bound /.test(value.get.name) && /^bound /.test(value.post.name))
    };
};
const riyoDelay = (ms, signal) => new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
});
const riyoWait = (promise, signal) => new Promise((resolve, reject) => {
    const finish = (callback, value) => { clearTimeout(timer); signal.removeEventListener('abort', cancel); callback(value); };
    const cancel = () => finish(reject, signal.reason);
    const timer = setTimeout(() => finish(reject, new Error('Request timed out after 30 seconds.')), 30000);
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal.aborted) cancel();
});
const riyoFetchMessages = async (api, url, signal, report) => {
    if (!api) throw new Error("Discord's HTTP client was not found. Reload Discord and try again.");
    for (let attempt = 0; ; attempt++) {
        signal.throwIfAborted();
        try {
            const response = await riyoWait(api.get({ url, timeout: 30000 }), signal);
            signal.throwIfAborted();
            if (response?.ok === false || response?.status >= 400) throw response;
            if (!Array.isArray(response?.body)) throw new Error('Unexpected message response.');
            return response.body;
        } catch (error) {
            signal.throwIfAborted();
            if (error?.status !== 429 || attempt >= 3) throw new Error(error?.message || error?.body?.message || 'HTTP ' + (error?.status ?? 'request failed'));
            const seconds = Number(error.body?.retry_after ?? error.headers?.get?.('Retry-After') ?? 5);
            report('Rate limited. Waiting to retry...');
            await riyoDelay((Number.isFinite(seconds) && seconds >= 0 ? seconds : 5) * 1000, signal);
        }
    }
};
