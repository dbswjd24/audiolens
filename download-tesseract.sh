#!/bin/bash
# Script to download the correct Tesseract.js browser bundle
# Run this from the ChromeExtension directory

set -e

VERSION="5.1.1"
BASE_URL="https://cdn.jsdelivr.net/npm/tesseract.js@${VERSION}/dist"

echo "Downloading Tesseract.js ${VERSION} browser bundle..."

# Download tesseract.min.js (browser UMD bundle)
echo "Downloading tesseract.min.js..."
curl -L "${BASE_URL}/tesseract.min.js" -o tesseract/tesseract.min.js

# Download worker.min.js
echo "Downloading worker.min.js..."
curl -L "${BASE_URL}/worker.min.js" -o tesseract/worker.min.js

# Download tesseract-core.wasm.js
echo "Downloading tesseract-core.wasm.js..."
curl -L "${BASE_URL}/tesseract-core.wasm.js" -o tesseract/tesseract-core.wasm.js

# Download tesseract-core.wasm
echo "Downloading tesseract-core.wasm..."
curl -L "${BASE_URL}/tesseract-core.wasm" -o tesseract/tesseract-core.wasm

echo "Download complete! All files are in tesseract/ directory."
echo ""
echo "Note: You still need to download the traineddata files (eng.traineddata, kor.traineddata)"
echo "from: https://github.com/naptha/tesseract.js-core/tree/master/traineddata"
