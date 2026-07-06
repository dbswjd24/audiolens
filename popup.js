const fileInput = document.getElementById("fileInput");
const chooseBtn = document.getElementById("chooseBtn");
const runBtn = document.getElementById("runBtn");
const syncBtn = document.getElementById("syncBtn");
const batchList = document.getElementById("batchList");
const status = document.getElementById("status");

let selectedFile = null;

chooseBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        runBtn.disabled = false;
        status.textContent = `Selected: ${selectedFile.name}`;
    }
});

runBtn.addEventListener("click", async () => {
    status.textContent = "Processing OCR...";
    runBtn.disabled = true;
    const reader = new FileReader();
    reader.onload = async () => {
        const resp = await chrome.runtime.sendMessage({ type: "OCR_IMAGE", dataUrl: reader.result });
        if (resp && resp.text) {
            const tracks = parseTracks(resp.text);
            renderBatch(tracks);
            status.textContent = `Found ${tracks.length} tracks.`;
        } else {
            status.textContent = "OCR Failed. Check Console.";
        }
        runBtn.disabled = false;
    };
    reader.readAsDataURL(selectedFile);
});

function parseTracks(text) {
    const separatorRegex = /[\-\|•\/·]/;
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 3).map(line => {
        const parts = line.split(separatorRegex).map(p => p.trim());
        const strip = (s) => s.replace(/19금|\[TITLE\]/gi, '').replace(/\(feat\..*?\)/gi, '').trim();
        return { title: strip(parts[0] || ""), artist: strip(parts[1] || "") };
    }).filter(t => t.title);
}

function renderBatch(tracks) {
    batchList.innerHTML = "";
    batchList.style.display = "block";
    syncBtn.style.display = "block";
    tracks.forEach(t => addTrackRow(t.title, t.artist));
}

function addTrackRow(title, artist) {
    const row = document.createElement("div");
    row.className = "track-row";
    row.innerHTML = `<input type="text" class="t-in" value="${title}"><input type="text" class="a-in" value="${artist}"><button class="remove-btn">×</button>`;
    row.querySelector(".remove-btn").addEventListener("click", () => {
        row.remove();
        if (batchList.children.length === 0) {
            batchList.style.display = "none";
            syncBtn.style.display = "none";
        }
    });
    batchList.appendChild(row);
}

syncBtn.addEventListener("click", async () => {
    const finalTracks = Array.from(document.querySelectorAll(".track-row")).map(row => ({
        title: row.querySelector(".t-in").value.trim(),
        artist: row.querySelector(".a-in").value.trim()
    })).filter(t => t.title !== "");

    status.textContent = "Connecting to Spotify...";
    const auth = await chrome.runtime.sendMessage({ type: "SPOTIFY_LOGIN" });
    if (auth.ok) {
        status.textContent = "Syncing...";
        const res = await chrome.runtime.sendMessage({ type: "SYNC_TO_SPOTIFY", tracks: finalTracks });
        status.textContent = res.ok ? `Success! Added ${res.count} songs.` : `Error: ${res.error}`;
    } else {
        status.textContent = "Login Failed.";
    }
});