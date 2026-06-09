// Prevent SIMD detection so Tesseract falls back to the non-SIMD core.
WebAssembly.validate = () => false;

// Polyfill fetch() for chrome-extension:// URLs using XMLHttpRequest.
// fetch() for chrome-extension:// URLs is unreliable in extension Web Workers,
// but XMLHttpRequest is consistently allowed for same-origin extension resources.
const _origFetch = self.fetch ? self.fetch.bind(self) : null;
self.fetch = function(url, opts) {
    const urlStr = typeof url === 'string' ? url : (url && url.url) || String(url);

    if (urlStr.startsWith('chrome-extension://')) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open((opts && opts.method) || 'GET', urlStr);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(new Response(xhr.response, {
                        status: xhr.status,
                        statusText: xhr.statusText,
                    }));
                } else {
                    reject(new TypeError('Failed to fetch: ' + urlStr + ' (status ' + xhr.status + ')'));
                }
            };
            xhr.onerror = () => reject(new TypeError('Failed to fetch: ' + urlStr));
            xhr.send((opts && opts.body) || null);
        });
    }

    if (_origFetch) return _origFetch(url, opts);
    return Promise.reject(new TypeError('fetch not available'));
};

// Load the real Tesseract worker.
importScripts('worker.min.js');
