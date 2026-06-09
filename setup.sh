#!/bin/bash
# Downloads Tesseract.js binaries and language files into tesseract/
# Run once after cloning: bash setup.sh

set -e
DIR="$(cd "$(dirname "$0")/tesseract" && pwd)"
BASE="https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js"

echo "Downloading Tesseract core..."
curl -L "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js" -o "$DIR/tesseract-core.wasm.js"
curl -L "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-lstm.wasm.js" -o "$DIR/tesseract-core-lstm.wasm.js"
curl -L "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm" -o "$DIR/tesseract-core.wasm"

echo "Downloading language data..."
curl -L "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata" -o "$DIR/eng.traineddata"
curl -L "https://tessdata.projectnaptha.com/4.0.0/kor.traineddata" -o "$DIR/kor.traineddata"

echo "Done. Load the extension in chrome://extensions with 'Load unpacked'."
