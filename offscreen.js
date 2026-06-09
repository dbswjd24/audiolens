// Runs in the offscreen document — handles Tesseract OCR out of the service worker
let worker = null;

async function getWorker() {
  if (worker) return worker;
  worker = await Tesseract.createWorker(["eng", "kor"], 1, {
    workerPath: chrome.runtime.getURL("tesseract/worker-wrapper.js"),
    corePath: chrome.runtime.getURL("tesseract/tesseract-core-lstm.wasm.js"),
    langPath: chrome.runtime.getURL("tesseract/"),
    workerBlobURL: false,
    cacheMethod: "none",
    logger: () => {},
  });
  return worker;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return false;

  if (msg.type === "process-ocr") {
    (async () => {
      try {
        const w = await getWorker();
        const { data } = await w.recognize(msg.data);
        sendResponse({ text: data.text });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }
});

// Signal ready
chrome.runtime.sendMessage({ type: "OFFSCREEN_READY", ok: true });
