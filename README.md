# 🎵 Audiolens

> turn YouTube tracklists into Spotify playlists in one click

You know when a DJ mix or playlist video has the full tracklist in the description and you want to save all the songs? Audiolens does that automatically. No more manually searching each track on Spotify.

---

## what it does

- **YouTube** reads timestamped tracklists straight from the video description
- **Screenshot** upload an image of a tracklist and it OCRs the tracks locally (no data sent anywhere)
- **Paste** copy a tracklist from a blog, comment, or anywhere and paste it in
- **Korean support** works with Melon, Genie, Bugs, and Flo screenshots
- **Flexible sync** add to an existing playlist or create a new one
- **Swap button** flip title and artist order per row when the format is ambiguous

---

## setup

1. Clone the repo
2. Download the Tesseract binaries (one time):
   ```bash
   bash setup.sh
   ```
3. Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select this folder
4. Log in with Spotify when prompted

---

## tech

`Chrome MV3` `Spotify Web API` `PKCE OAuth` `Tesseract.js` `WebAssembly` `Vanilla JS`
