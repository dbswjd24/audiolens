console.log('offscreen.js: Script loaded and ready');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen') return false;
  if (message.type === 'ping') {
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

function dataURLToCanvas(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Failed to load image for OCR'));
    img.src = dataURL;
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen' || message.type !== 'process-ocr') return false;

  (async () => {
    try {
      const Tesseract = window.Tesseract || self.Tesseract;
      if (!Tesseract) throw new Error('Tesseract not loaded');

      const workerURL = chrome.runtime.getURL('tesseract/worker-wrapper.js');
      const NativeWorker = window.Worker;
      function ExtWorker(url, opts) {
        if (typeof url === 'string' && url.startsWith('blob:')) url = workerURL;
        return new NativeWorker(url, opts);
      }
      ExtWorker.prototype = NativeWorker.prototype;
      window.Worker = ExtWorker;

      const canvas = await dataURLToCanvas(message.data);

      const { data: { text } } = await Tesseract.recognize(
        canvas,
        'eng+kor',
        {
          workerPath: workerURL,
          workerBlobURL: false,
          corePath: chrome.runtime.getURL('tesseract/'),
          langPath: chrome.runtime.getURL('tesseract/'),
          gzip: false,
          cacheMethod: 'none',
          logger: m => console.log('[Tesseract]', m.status, m.progress),
        }
      );

      console.log('OCR complete, text length:', text?.length);
      sendResponse({ text: text || '' });
    } catch (err) {
      console.error('OCR error:', err);
      sendResponse({ error: err.message || String(err) });
    }
  })();

  return true;
});
