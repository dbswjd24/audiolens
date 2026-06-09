# Audiolens

A Chrome extension that detects tracklists from YouTube videos and adds them to your Spotify playlist in one click.

## Features

- Reads timestamped tracklists from YouTube video descriptions
- Falls back to screenshot OCR (Tesseract.js, runs locally) when no description tracklist is found
- Paste-text input for tracklists from blogs or comments
- Supports English and Korean, including two-line Korean music app format (Melon, Genie, Bugs, Flo)
- Add to an existing Spotify playlist or create a new one
- Secure Spotify login via PKCE OAuth 2.0

## Setup

1. Clone the repo
2. Run the setup script to download Tesseract binaries:
   ```bash
   bash setup.sh
   ```
3. Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select this folder
4. Add your Spotify app's redirect URI in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):
   - Open the extension background service worker to find your redirect URI (`chrome.identity.getRedirectURL()`)

## Tech stack

- Chrome Extensions Manifest V3
- Spotify Web API + PKCE OAuth 2.0
- Tesseract.js v5 (WebAssembly OCR)
- Vanilla JavaScript / HTML / CSS
