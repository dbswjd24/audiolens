#!/bin/bash
# Install Tesseract.js from npm and copy offline browser artifacts
# Run this from the ChromeExtension directory

set -e

VERSION="5.1.1"
TEMP_DIR=$(mktemp -d)
echo "Installing tesseract.js@${VERSION} from npm..."

# Install tesseract.js in temp directory
cd "$TEMP_DIR"
npm init -y > /dev/null 2>&1
npm install "tesseract.js@${VERSION}" --save > /dev/null 2>&1

# Find the dist directory
DIST_DIR="$TEMP_DIR/node_modules/tesseract.js/dist"
if [ ! -d "$DIST_DIR" ]; then
    echo "Error: dist directory not found in node_modules/tesseract.js"
    exit 1
fi

echo "Found dist directory: $DIST_DIR"

# Create tesseract directory if it doesn't exist
cd - > /dev/null
mkdir -p tesseract

# Copy browser bundle files
echo "Copying browser bundle files..."
cp "$DIST_DIR/tesseract.min.js" tesseract/tesseract.min.js
cp "$DIST_DIR/worker.min.js" tesseract/worker.min.js
cp "$DIST_DIR/tesseract-core.wasm.js" tesseract/tesseract-core.wasm.js
cp "$DIST_DIR/tesseract-core.wasm" tesseract/tesseract-core.wasm

# Verify files
echo ""
echo "Verifying files..."
for file in tesseract.min.js worker.min.js tesseract-core.wasm.js tesseract-core.wasm; do
    if [ -f "tesseract/$file" ]; then
        size=$(stat -f%z "tesseract/$file" 2>/dev/null || stat -c%s "tesseract/$file" 2>/dev/null)
        echo "  ✓ $file ($size bytes)"
    else
        echo "  ✗ $file (missing)"
    fi
done

# Check worker file for issues
echo ""
echo "Checking worker.min.js for issues..."
if [ -f "tesseract/worker.min.js" ]; then
    if grep -q "cdn.jsdelivr.net" tesseract/worker.min.js; then
        echo "  ⚠ WARNING: worker.min.js contains CDN references"
    else
        echo "  ✓ No CDN references found"
    fi
    
    if grep -q "export " tesseract/worker.min.js; then
        echo "  ⚠ WARNING: worker.min.js contains ESM export syntax"
    else
        echo "  ✓ No ESM export syntax found"
    fi
    
    if grep -q "importScripts" tesseract/worker.min.js; then
        echo "  ✓ Contains importScripts (expected for classic worker)"
    fi
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "Installation complete!"
echo ""
echo "Note: You still need to download the traineddata files (eng.traineddata, kor.traineddata)"
echo "from: https://github.com/naptha/tesseract.js-core/tree/master/traineddata"
echo "or use: npm install @tesseract.js-data/eng @tesseract.js-data/kor"
