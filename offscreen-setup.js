// Critical: UMD wrapper uses 'self' as global, must be set before Tesseract loads
if (typeof self === 'undefined') {
    self = window;
} else if (self !== window) {
    // Ensure self references window
    try {
        self = window;
    } catch (e) {
        // If can't reassign, make sure window.self exists
        if (!window.self) {
            Object.defineProperty(window, 'self', {
                get: function() { return window; },
                configurable: true,
                enumerable: true
            });
        }
    }
}
// Ensure globalThis exists
if (typeof globalThis === 'undefined') {
    window.globalThis = window;
}

// Load Tesseract using chrome.runtime.getURL (required for offscreen documents)
const tesseractScript = document.createElement('script');
tesseractScript.src = chrome.runtime.getURL('tesseract/tesseract.min.js');
tesseractScript.async = false;
tesseractScript.defer = false;
tesseractScript.onerror = function() {
    console.error('Failed to load Tesseract script');
};
document.head.appendChild(tesseractScript);

// Load offscreen-init.js after Tesseract
tesseractScript.onload = function() {
    const initScript = document.createElement('script');
    initScript.src = chrome.runtime.getURL('offscreen-init.js');
    initScript.async = false;
    document.head.appendChild(initScript);
};
