const CLIENT_ID = "af78655285d7400d8349580c2c70c292";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SPOTIFY_LOGIN")    { handleLogin().then(sendResponse);                              return true; }
  if (msg.type === "GET_PLAYLISTS")    { getPlaylists().then(sendResponse);                             return true; }
  if (msg.type === "SYNC_TO_SPOTIFY") { syncTracks(msg.tracks, msg.playlistName, msg.playlistId).then(sendResponse); return true; }
});

// ── PKCE helpers ───────────────────────────────────────────────────────────
function generateVerifier(len = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join("");
}

async function generateChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Auth (PKCE) ────────────────────────────────────────────────────────────
async function handleLogin() {
  // Return cached token if still valid
  const { spotifyToken, spotifyTokenExpiry } = await chrome.storage.local.get(["spotifyToken", "spotifyTokenExpiry"]);
  if (spotifyToken && spotifyTokenExpiry && Date.now() < spotifyTokenExpiry) {
    return { ok: true, token: spotifyToken };
  }

  const redirect   = chrome.identity.getRedirectURL();
  const verifier   = generateVerifier();
  const challenge  = await generateChallenge(verifier);
  const scopes     = "playlist-modify-public playlist-modify-private playlist-read-private user-read-private";

  const authUrl = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         "code",
    redirect_uri:          redirect,
    scope:                 scopes,
    code_challenge_method: "S256",
    code_challenge:        challenge,
  }).toString();

  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        resolve({ ok: false, error: chrome.runtime.lastError?.message || "Auth cancelled or popup blocked" });
        return;
      }
      try {
        const code = new URL(responseUrl).searchParams.get("code");
        if (!code) { resolve({ ok: false, error: "No auth code in redirect" }); return; }

        // Exchange code for token
        const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type:    "authorization_code",
            code,
            redirect_uri:  redirect,
            client_id:     CLIENT_ID,
            code_verifier: verifier,
          }).toString(),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.text();
          resolve({ ok: false, error: `Token exchange failed: ${err}` });
          return;
        }

        const { access_token, expires_in } = await tokenRes.json();
        chrome.storage.local.set({
          spotifyToken:       access_token,
          spotifyTokenExpiry: Date.now() + expires_in * 1000 - 60_000,
        });
        resolve({ ok: true, token: access_token });
      } catch (e) {
        resolve({ ok: false, error: e.message });
      }
    });
  });
}

// ── Playlists ──────────────────────────────────────────────────────────────
async function getPlaylists() {
  const { spotifyToken: token } = await chrome.storage.local.get("spotifyToken");
  if (!token) return { ok: false, error: "Not authenticated" };
  try {
    const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, error: "Failed to fetch playlists" };
    const data = await res.json();
    return {
      ok: true,
      playlists: (data.items || []).map(p => ({
        id:         p.id,
        name:       p.name,
        trackCount: p.tracks?.total ?? 0,
        image:      p.images?.[0]?.url ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Sync ───────────────────────────────────────────────────────────────────
async function syncTracks(tracks, playlistName = "Audiolens Import", playlistId = null) {
  const { spotifyToken: token } = await chrome.storage.local.get("spotifyToken");
  if (!token) return { ok: false, error: "Not authenticated with Spotify" };

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const userRes = await fetch("https://api.spotify.com/v1/me", { headers });
    if (!userRes.ok) return { ok: false, error: "Failed to fetch Spotify user" };
    const user = await userRes.json();

    // Search each track with multiple query strategies
    const uris = [];
    for (const t of tracks) {
      const parts  = [t.title, t.artist].filter(Boolean);
      const queries = [
        parts.join(" "),                                          // combined (most robust for OCR)
        parts.reverse().join(" "),                               // reversed (handle ARTIST-SONG vs SONG-ARTIST)
        t.title && t.artist ? `track:${t.title} artist:${t.artist}` : null,
        t.title && t.artist ? `track:${t.artist} artist:${t.title}` : null,
      ].filter(Boolean);

      let uri = null;
      for (const q of queries) {
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`,
          { headers }
        );
        if (!res.ok) continue;
        uri = (await res.json()).tracks?.items?.[0]?.uri;
        if (uri) break;
      }
      if (uri) uris.push(uri);
    }

    if (uris.length === 0) return { ok: false, error: "No tracks matched on Spotify" };

    let targetId  = playlistId;
    let playlistUrl = null;

    if (!targetId) {
      const plRes = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
        method: "POST", headers,
        body: JSON.stringify({ name: playlistName, public: false }),
      });
      if (!plRes.ok) return { ok: false, error: "Failed to create playlist" };
      const pl = await plRes.json();
      targetId    = pl.id;
      playlistUrl = pl.external_urls?.spotify;
    } else {
      const plRes = await fetch(`https://api.spotify.com/v1/playlists/${targetId}`, { headers });
      if (plRes.ok) playlistUrl = (await plRes.json()).external_urls?.spotify;
    }

    for (let i = 0; i < uris.length; i += 100) {
      await fetch(`https://api.spotify.com/v1/playlists/${targetId}/tracks`, {
        method: "POST", headers,
        body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
      });
    }

    return { ok: true, count: uris.length, playlistUrl };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
