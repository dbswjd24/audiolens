const CLIENT_ID = "af78655285d7400d8349580c2c70c292";

let offscreenReady = false;
let offscreenReadyError = null;
let offscreenReadyPromise = null;
let offscreenReadyResolver = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'OFFSCREEN_READY') {
        offscreenReady = msg.ok === true;
        offscreenReadyError = msg.error || null;
        if (offscreenReadyResolver) {
            if (msg.ok) {
                offscreenReadyResolver();
            } else {
                offscreenReadyResolver(new Error(msg.error || 'Offscreen document failed to initialize'));
            }
            offscreenReadyResolver = null;
            offscreenReadyPromise = null;
        }
        sendResponse({ ok: true });
        return true;
    }

    if (msg.type === "OCR_IMAGE") {
        handleOCR(msg.dataUrl)
            .then(sendResponse)
            .catch(error => sendResponse({ error: error.message || String(error) }));
        return true;
    }
    if (msg.type === "SPOTIFY_LOGIN") {
        const redirect = chrome.identity.getRedirectURL();
        const url = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirect)}&scope=playlist-modify-public%20playlist-modify-private%20user-read-private`;
        
        console.log("Starting Spotify authentication flow...");
        console.log("Redirect URL:", redirect);
        
        chrome.identity.launchWebAuthFlow({ url, interactive: true }, (responseUrl) => {
            if (chrome.runtime.lastError) {
                console.error("Auth Error:", chrome.runtime.lastError);
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                return;
            }
            if (!responseUrl) {
                console.error("No response URL from Spotify auth - user may have cancelled");
                sendResponse({ ok: false, error: "Authentication cancelled or failed" });
                return;
            }
            try {
                console.log("Received response URL from Spotify");
                const urlObj = new URL(responseUrl);
                const hash = urlObj.hash.substring(1);
                const params = new URLSearchParams(hash);
                const token = params.get("access_token");
                const error = params.get("error");
                
                if (error) {
                    console.error("Spotify auth error:", error);
                    sendResponse({ ok: false, error: `Authentication error: ${error}` });
                    return;
                }
                
                if (token) {
                    console.log("Successfully obtained access token");
                    chrome.storage.local.set({ spotifyToken: token }, () => {
                        sendResponse({ ok: true, token: token });
                    });
                } else {
                    console.error("No access token in response");
                    sendResponse({ ok: false, error: "No access token in response" });
                }
            } catch (e) {
                console.error("Error parsing auth response:", e);
                sendResponse({ ok: false, error: e.message });
            }
        });
        return true; // Keep channel open for async response
    }
    if (msg.type === "SYNC_TO_SPOTIFY") {
        syncTracks(msg.tracks).then(sendResponse);
        return true;
    }
});

async function waitForOffscreenReady() {
    if (offscreenReady) return;
    if (offscreenReadyError) {
        throw new Error('Offscreen document initialization failed: ' + offscreenReadyError);
    }

    if (!offscreenReadyPromise) {
        offscreenReadyPromise = new Promise((resolve, reject) => {
            offscreenReadyResolver = (error) => {
                if (error) reject(error);
                else resolve();
            };
        });
    }

    const timeout = setTimeout(() => {
        if (offscreenReadyResolver) {
            offscreenReadyResolver(new Error('Offscreen document did not become ready in time'));
            offscreenReadyResolver = null;
            offscreenReadyPromise = null;
        }
    }, 10000);

    try {
        await offscreenReadyPromise;
    } finally {
        clearTimeout(timeout);
    }
}

async function handleOCR(dataUrl) {
    const existing = await chrome.offscreen.hasDocument();
    if (!existing) {
        offscreenReady = false;
        await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL("offscreen.html"),
            reasons: ["DOM_SCRAPING"],
            justification: "OCR"
        });
        await waitForOffscreenReady();
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { target: "offscreen", type: "process-ocr", data: dataUrl },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (!response) {
                    reject(new Error('No response from OCR worker'));
                } else if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            }
        );
    });
}

async function syncTracks(tracks) {
    const { spotifyToken: token } = await chrome.storage.local.get("spotifyToken");
    if (!token) return { ok: false, error: "No Token" };

    try {
        const user = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
        const uris = [];
        for (const t of tracks) {
            const q = encodeURIComponent(`track:${t.title} artist:${t.artist}`);
            const s = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
            if (s.tracks?.items?.[0]) uris.push(s.tracks.items[0].uri);
        }

        if (uris.length > 0) {
            const pl = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
                method: "POST", 
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Audiolens Import" })
            }).then(r => r.json());
            
            await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/tracks`, {
                method: "POST", 
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ uris })
            });
            return { ok: true, count: uris.length };
        }
        return { ok: false, error: "Zero tracks matched." };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}