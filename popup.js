// ── Screen management ──────────────────────────────────────────────────────
const SCREENS = ["idle", "scanning", "no-tracks", "ocr", "tracks", "playlist", "syncing", "success", "error"];

function show(id) {
  SCREENS.forEach(s => document.getElementById(`screen-${s}`).classList.toggle("active", s === id));
}

function setStatus(text, state = "default") {
  document.getElementById("status-text").textContent = text;
  const dot = document.getElementById("status-dot");
  dot.className = "status-dot" + (state === "active" ? " pulse" : state === "ok" ? " green" : state === "error" ? " red" : "");
}

// ── Track parser (shared by both flows) ───────────────────────────────────
const TIMESTAMP_RE  = /^\[?(?:\d{1,2}:)?\d{1,2}:\d{2}\]?\s*[-–|]?\s*/;
const NUMBERED_RE   = /^\d{1,3}[.)]\s*/;
const SEP_RE        = /\s*[-–—·]\s*/;
const DURATION_TAIL = /\s+\d{1,2}:\d{2}\s*$/;  // trailing "03:47" on song lines

function cleanField(s) {
  return (s || "")
    .replace(DURATION_TAIL, "")
    .replace(/\(official[^)]*\)/gi, "")
    .replace(/\[official[^)]*\]/gi, "")
    .replace(/\(lyrics?\)/gi, "")
    .replace(/19금|\[TITLE\]/gi, "")
    .trim();
}

// Detect Korean music-app format: alternating title / artist lines (no separator)
// e.g.  "아무노래  03:47"  /  "지코 (ZICO)"  /  "Loveship  04:19"  /  "폴킴(Paul Kim)"
function looksLikeTwoLineFormat(lines) {
  if (lines.length < 4) return false;
  let durCount = 0;
  lines.forEach(l => { if (DURATION_TAIL.test(l)) durCount++; });
  // If ≥ 30% of lines end with a duration AND most lines have no separator, use two-line mode
  const sepCount = lines.filter(l => SEP_RE.test(l)).length;
  return durCount >= Math.max(2, lines.length * 0.25) && sepCount < lines.length * 0.3;
}

function parseTwoLine(lines) {
  const tracks = [];
  // Strip pure-junk lines (track numbers, durations-only, empty)
  const clean = lines.filter(l => l.length > 1 && !/^\d+$/.test(l));
  for (let i = 0; i < clean.length - 1; i += 2) {
    const title  = cleanField(clean[i]);
    const artist = cleanField(clean[i + 1]);
    if (title.length > 1) tracks.push({ title, artist });
  }
  return tracks;
}

function parseTracks(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // ── Mode 1: single-line format (timestamp / numbered / separator) ──────
  const tracks = [];
  for (const line of lines) {
    const hadTimestamp = TIMESTAMP_RE.test(line);
    const hadNumber    = NUMBERED_RE.test(line);
    let raw = line.replace(TIMESTAMP_RE, "").replace(NUMBERED_RE, "").trim();
    if (!raw || raw.length < 2) continue;

    const hasSep = SEP_RE.test(raw);
    if (!hadTimestamp && !hadNumber && !hasSep) continue;

    raw = cleanField(raw);
    if (!raw) continue;

    const parts = raw.split(SEP_RE);
    const a = parts[0]?.trim() || "";
    const b = parts[1]?.trim() || "";
    if (a.length > 1) tracks.push({ title: a, artist: b });
  }

  // ── Mode 2: two-line format (Korean music apps: title\nartist) ──────────
  if (tracks.length === 0 || looksLikeTwoLineFormat(lines)) {
    const twoLine = parseTwoLine(lines);
    // Use two-line result if it found more tracks (better fit)
    if (twoLine.length > tracks.length) return twoLine;
  }

  return tracks;
}

// ── Render tracks screen ───────────────────────────────────────────────────
function showTracks(tracks, sourceLabel, videoPillText) {
  document.getElementById("track-count").textContent = `${tracks.length}`;
  document.getElementById("source-label").textContent = sourceLabel;

  const pill = document.getElementById("video-pill");
  if (videoPillText) {
    pill.style.display = "";
    pill.querySelector(".video-title").textContent = videoPillText;
  } else {
    pill.style.display = "none";
  }

  if (!document.getElementById("playlist-name").value) {
    document.getElementById("playlist-name").value = "Audiolens Import";
  }

  renderTracks(tracks);
  show("tracks");
  setStatus(`Found ${tracks.length} tracks`, "ok");
}

function renderTracks(tracks) {
  const list = document.getElementById("track-list");
  list.innerHTML = "";
  tracks.forEach((t, i) => addTrackRow(t.title, t.artist, i + 1));
}

function addTrackRow(title, artist, num) {
  const list = document.getElementById("track-list");
  const row = document.createElement("div");
  row.className = "track-row";
  row.innerHTML = `
    <span class="track-num">${num}</span>
    <div class="track-inputs">
      <input class="t-title" type="text" value="${esc(title)}" placeholder="Song / Artist">
      <input class="t-artist" type="text" value="${esc(artist)}" placeholder="Artist / Song">
    </div>
    <button class="swap-btn" title="Swap fields">⇄</button>
    <button class="remove-btn" title="Remove">×</button>
  `;
  row.querySelector(".swap-btn").addEventListener("click", () => {
    const t = row.querySelector(".t-title");
    const a = row.querySelector(".t-artist");
    [t.value, a.value] = [a.value, t.value];
  });
  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    renumber();
    if (list.children.length === 0) { show("no-tracks"); setStatus("All tracks removed"); }
  });
  list.appendChild(row);
}

function renumber() {
  document.querySelectorAll(".track-row").forEach((row, i) => {
    row.querySelector(".track-num").textContent = i + 1;
  });
}

function esc(str) {
  return (str || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function showError(msg) {
  document.getElementById("error-msg").textContent = msg;
  show("error");
  setStatus("Error", "error");
}

// ── Screenshot OCR helper ──────────────────────────────────────────────────
function wireUploadZone(zoneId, inputId, btnId, labelText) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  let fileData = null;

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  input.addEventListener("change", e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  function handleFile(f) {
    fileData = f;
    zone.classList.add("has-file");
    zone.querySelector(".upload-zone-title").textContent = f.name;
    zone.querySelector(".upload-zone-sub").textContent = `${(f.size / 1024).toFixed(0)} KB`;
    btn.disabled = false;
  }

  btn.addEventListener("click", async () => {
    if (!fileData) return;
    show("ocr");
    setStatus("Running OCR...", "active");
    document.getElementById("ocr-status-sub").textContent = "Loading OCR engine (~10s first run)...";

    try {
      const workerPath = chrome.runtime.getURL("tesseract/worker-wrapper.js");
      // Use the non-LSTM core whose binary (tesseract-core.wasm) is bundled in the extension.
      // tesseract-core-lstm.wasm.js requires tesseract-core-lstm.wasm which is not present.
      const corePath   = chrome.runtime.getURL("tesseract/tesseract-core.wasm.js");
      const langPath   = chrome.runtime.getURL("tesseract/");

      const worker = await Tesseract.createWorker(["eng", "kor"], 3, {
        workerPath,
        corePath,
        langPath,
        workerBlobURL: false,
        cacheMethod: "none",
        gzip: false,
        logger: m => {
          if (m.status === "recognizing text") {
            document.getElementById("ocr-status-sub").textContent =
              `Reading text... ${Math.round(m.progress * 100)}%`;
          }
        },
      });

      const { data } = await worker.recognize(fileData);
      await worker.terminate();

      const tracks = parseTracks(data.text);
      if (tracks.length === 0) {
        showError("No tracks found in screenshot. Supported formats:\n• 0:00 Song - Artist\n• 1. Song - Artist\n• Korean music apps (song + artist on separate lines)");
        return;
      }
      document.getElementById("playlist-name").value = "Audiolens Import";
      showTracks(tracks, labelText, null);
    } catch (e) {
      showError("OCR failed: " + (e.message || e));
    }
  });
}

// ── Paste-text helper ─────────────────────────────────────────────────────
function wirePasteZone(textareaId, btnId) {
  const ta  = document.getElementById(textareaId);
  const btn = document.getElementById(btnId);

  ta.addEventListener("input", () => {
    const hasText = ta.value.trim().length > 0;
    btn.disabled = !hasText;
    btn.style.background = hasText ? "var(--green)" : "var(--surface2)";
    btn.style.color      = hasText ? "#000"         : "var(--text-muted)";
    btn.style.border     = hasText ? "none"         : "1px solid var(--border)";
  });

  btn.addEventListener("click", () => {
    const tracks = parseTracks(ta.value);
    if (tracks.length === 0) {
      showError("No tracks found. Supported formats:\n• 0:00 Song - Artist\n• 1. Song - Artist\n• Song title on one line, artist on the next (Korean music app style)");
      return;
    }
    document.getElementById("playlist-name").value = "Audiolens Import";
    showTracks(tracks, "Pasted text", null);
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  // Wire screenshot upload on both the idle and no-tracks screens
  wireUploadZone("idle-upload-zone",     "idle-file-input",     "idle-ocr-btn",     "Screenshot");
  wireUploadZone("notracks-upload-zone", "notracks-file-input", "notracks-ocr-btn", "Screenshot");
  wirePasteZone("idle-paste-text",     "idle-paste-btn");
  wirePasteZone("notracks-paste-text", "notracks-paste-btn");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.includes("youtube.com/watch")) {
    show("idle");
    setStatus("Not on a YouTube video");
    return;
  }

  show("scanning");
  setStatus("Scanning...", "active");

  let result;
  try {
    [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeYouTube });
  } catch (e) {
    show("idle");
    setStatus("Could not access page");
    return;
  }

  const { tracks, title } = result?.result ?? {};

  if (!tracks || tracks.length === 0) {
    show("no-tracks");
    setStatus("No tracklist in description");
    return;
  }

  const videoTitle = title || tab.title?.replace(" - YouTube", "") || "YouTube video";
  document.getElementById("playlist-name").value = videoTitle.slice(0, 80);
  showTracks(tracks, "YouTube description", videoTitle);
})();

// ── Sync flow: tracks → auth → playlist picker → syncing → success ─────────
let _pendingTracks = [];
let _selectedPlaylistId = null;   // null = create new
let _selectedPlaylistName = null;

document.getElementById("sync-btn").addEventListener("click", async () => {
  _pendingTracks = Array.from(document.querySelectorAll(".track-row")).map(row => ({
    title:  row.querySelector(".t-title").value.trim(),
    artist: row.querySelector(".t-artist").value.trim(),
  })).filter(t => t.title);

  if (_pendingTracks.length === 0) return;

  // Step 1: auth
  show("syncing");
  setStatus("Connecting to Spotify...", "active");
  setSyncStatus("Connecting to Spotify...", "Authenticating with your account.");

  const authRes = await chrome.runtime.sendMessage({ type: "SPOTIFY_LOGIN" });
  if (!authRes.ok) { showError(authRes.error || "Spotify login failed."); return; }

  // Step 2: load playlists and show picker
  setSyncStatus("Loading playlists...", "Fetching your Spotify playlists.");
  const plRes = await chrome.runtime.sendMessage({ type: "GET_PLAYLISTS" });

  buildPlaylistPicker(plRes.ok ? plRes.playlists : [], _pendingTracks.length);
  show("playlist");
  setStatus("Choose a playlist", "ok");
});

function buildPlaylistPicker(playlists, trackCount) {
  document.getElementById("picker-track-count").textContent = `${trackCount} tracks`;
  const list = document.getElementById("playlist-picker-list");
  list.innerHTML = "";
  _selectedPlaylistId = null;
  _selectedPlaylistName = document.getElementById("playlist-name").value.trim() || "Audiolens Import";

  const confirmBtn = document.getElementById("confirm-sync-btn");
  confirmBtn.disabled = true;

  function selectRow(id, name, el) {
    _selectedPlaylistId = id;
    _selectedPlaylistName = name;
    list.querySelectorAll(".pl-row, .pl-new-row").forEach(r => r.classList.remove("selected"));
    el.classList.add("selected");
    confirmBtn.disabled = false;
  }

  // "Create new" row at top
  const newRow = document.createElement("div");
  newRow.className = "pl-new-row";
  const nameInput = document.getElementById("playlist-name").value.trim() || "Audiolens Import";
  newRow.innerHTML = `
    <div class="pl-new-icon">+</div>
    <input class="new-name-input" id="new-pl-name" value="${esc(nameInput)}" placeholder="New playlist name…" maxlength="100">
    <span class="pl-check">✓</span>
  `;
  newRow.addEventListener("click", (e) => {
    if (e.target.tagName === "INPUT") return;
    selectRow(null, document.getElementById("new-pl-name").value.trim() || "Audiolens Import", newRow);
  });
  newRow.querySelector(".new-name-input").addEventListener("input", e => {
    _selectedPlaylistName = e.target.value.trim() || "Audiolens Import";
    selectRow(null, _selectedPlaylistName, newRow);
  });
  list.appendChild(newRow);
  // Select "Create new" by default
  selectRow(null, nameInput, newRow);

  // Existing playlists
  playlists.forEach(pl => {
    const row = document.createElement("div");
    row.className = "pl-row";
    const imgHtml = pl.image
      ? `<img class="pl-thumb" src="${pl.image}" alt="">`
      : `<div class="pl-thumb-placeholder">🎵</div>`;
    row.innerHTML = `
      ${imgHtml}
      <div class="pl-info">
        <div class="pl-name">${esc(pl.name)}</div>
        <div class="pl-count">${pl.trackCount} tracks</div>
      </div>
      <span class="pl-check">✓</span>
    `;
    row.addEventListener("click", () => selectRow(pl.id, pl.name, row));
    list.appendChild(row);
  });
}

document.getElementById("confirm-sync-btn").addEventListener("click", async () => {
  const playlistName = _selectedPlaylistName || "Audiolens Import";
  const playlistId   = _selectedPlaylistId;   // null = create new
  const tracks       = _pendingTracks;

  show("syncing");
  setStatus("Syncing to Spotify...", "active");
  setSyncStatus("Searching tracks...", `Looking up ${tracks.length} songs on Spotify.`);

  const syncRes = await chrome.runtime.sendMessage({
    type: "SYNC_TO_SPOTIFY",
    tracks,
    playlistName,
    playlistId,
  });

  if (!syncRes.ok) { showError(syncRes.error || "Failed to sync."); return; }

  document.getElementById("success-title").textContent = playlistId ? "Added to playlist!" : "Playlist created!";
  document.getElementById("success-sub").textContent =
    `Added ${syncRes.count} of ${tracks.length} songs to "${playlistName}".`;
  const link = document.getElementById("playlist-link");
  link.href = syncRes.playlistUrl || "#";
  link.style.display = syncRes.playlistUrl ? "inline-flex" : "none";
  show("success");
  setStatus(`Done — ${syncRes.count} tracks added`, "ok");
});

function setSyncStatus(title, sub) {
  document.getElementById("sync-status-title").textContent = title;
  document.getElementById("sync-status-sub").textContent = sub;
}

document.getElementById("retry-btn").addEventListener("click", () => location.reload());
document.getElementById("error-retry-btn").addEventListener("click", () => location.reload());

// ── YouTube description scraper (injected into the tab) ───────────────────
function scrapeYouTube() {
  const LINE_RE = /^\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]?\s*[-–|]?\s*(.+)$/;
  const SEP_RE  = /\s*[-–—]\s*/;

  function parse(text) {
    return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).reduce((acc, line) => {
      const m = line.match(LINE_RE);
      if (!m) return acc;
      let raw = m[4].trim()
        .replace(/\(official[^)]*\)/gi, "").replace(/\[official[^)]*\]/gi, "")
        .replace(/\(lyrics?\)/gi, "").replace(/\(feat\.[^)]*\)/gi, "")
        .replace(/\(ft\.[^)]*\)/gi, "").replace(/19금|\[TITLE\]/gi, "").trim();
      const parts = raw.split(SEP_RE);
      const a = parts[0]?.trim() || "";
      const b = parts[1]?.trim() || "";
      if (a.length > 1) acc.push({ title: a, artist: b });
      return acc;
    }, []);
  }

  const selectors = [
    "#description-inline-expander yt-attributed-string",
    "#description .yt-core-attributed-string",
    "#description-text",
    "#description",
  ];

  let tracks = [];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.innerText) {
      tracks = parse(el.innerText);
      if (tracks.length > 0) break;
    }
  }

  const titleEl = document.querySelector(
    "h1.ytd-video-primary-info-renderer, h1.style-scope.ytd-watch-metadata, yt-formatted-string.ytd-watch-metadata"
  );
  const title = titleEl?.innerText?.trim() || document.title.replace(" - YouTube", "");

  return { tracks, title };
}
