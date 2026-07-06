// Tesseract worker auto-detects WebAssembly SIMD support and tries to load
// tesseract-core-simd-lstm.wasm.js, which is not bundled in this extension.
// Override WebAssembly.validate to return false so the worker falls back to
// the bundled tesseract-core.wasm.js instead.
WebAssembly.validate = () => false;

// Load the real Tesseract worker (same directory, relative path)
importScripts('worker.min.js');
