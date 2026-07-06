// Wait for Tesseract to be available and initialize, then send ready message
(function() {
    console.log('offscreen-init.js: Starting initialization...');
    
    // Send ready message (with error if failed)
    function sendReadyMessage(ok, error) {
        const message = { type: 'OFFSCREEN_READY', ok: ok !== false };
        if (error) {
            message.error = error.message || String(error);
        }
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Failed to send ready message:', chrome.runtime.lastError);
            } else {
                console.log('Offscreen ready message sent:', message.ok ? 'OK' : 'ERROR');
            }
        });
    }
    
    // Wait for Tesseract to be available
    function waitForTesseract() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 200; // 10 seconds
            
            const check = setInterval(() => {
                attempts++;
                // Check for Tesseract in window or self
                const Tesseract = window.Tesseract || self.Tesseract;
                
                if (Tesseract && typeof Tesseract.createWorker === 'function') {
                    clearInterval(check);
                    console.log('Tesseract is available');
                    // Ensure it's on window for easy access
                    if (!window.Tesseract) window.Tesseract = Tesseract;
                    resolve(Tesseract);
                } else if (attempts >= maxAttempts) {
                    clearInterval(check);
                    const error = new Error('Tesseract failed to load after timeout. window.Tesseract: ' + typeof window.Tesseract + ', self.Tesseract: ' + typeof self.Tesseract);
                    reject(error);
                }
            }, 50);
        });
    }
    
    // Initialize Tesseract and send ready message
    async function initialize() {
        try {
            await waitForTesseract();
            
            // Load offscreen.js which contains the message handlers
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('offscreen.js');
            script.onload = function() {
                console.log('offscreen.js loaded');
                // Verify Tesseract is loaded before sending ready message
                console.log("Tesseract loaded:", !!window.Tesseract, typeof window.Tesseract?.createWorker);
                if (window.Tesseract && typeof window.Tesseract.createWorker === 'function') {
                    console.log("✓ Tesseract.createWorker is available");
                } else {
                    console.error("✗ Tesseract.createWorker is NOT available");
                }
                // Send success ready message
                sendReadyMessage(true);
            };
            script.onerror = function() {
                console.error('Failed to load offscreen.js');
                sendReadyMessage(false, new Error('Failed to load offscreen.js'));
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Initialization failed:', error);
            // Send error ready message so service worker doesn't timeout
            sendReadyMessage(false, error);
        }
    }
    
    // Start initialization after a brief delay to ensure Tesseract script has executed
    setTimeout(initialize, 100);
})();
