// Only static engine/model assets are fetched; pixels and recognized text stay local.
(() => {
  'use strict';
  const base = '/js/vendor/ocr-6';
  let pending = Promise.resolve();

  function draw(source, box, width, height, padding = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = width + 2 * padding;
    canvas.height = height + 2 * padding;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, box.x, box.y, box.w, box.h, padding, padding, width, height);
    return canvas;
  }

  function validLine(line) {
    const text = line.text.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!/[가-힣]/u.test(text) || [...text].length < 2 || [...text].length > 40 || line.confidence < 45) return '';
    return text;
  }

  async function recognize(worker, picture, crop, current) {
    const rows = window.ImageFontColor.detect(picture, crop);
    const result = [];
    if (rows.length) {
      await worker.setParameters({tessedit_pageseg_mode:'7'}); // Single text line
      for (const sample of rows) {
        if (!current()) return [];
        const box = {x:0, y:0, w:sample.image.width, h:sample.image.height};
        const input = draw(sample.image, box, Math.max(1, Math.round(box.w * 48 / box.h)), 48, 12);
        const {data} = await worker.recognize(input);
        const text = validLine(data);
        if (text) result.push({text, sample});
      }
      if (result.length || !current()) return result;
    }

    // For photographs, read the selected area and use the most prominent Korean
    // line. Keep its original coordinates so matching uses the very same line.
    const box = crop || {x:0, y:0, w:picture.naturalWidth, h:picture.naturalHeight};
    const scale = Math.min(2, 1600 / Math.max(box.w, box.h));
    const width = Math.max(1, Math.round(box.w * scale)), height = Math.max(1, Math.round(box.h * scale));
    const pad = 12;
    const input = draw(picture, box, width, height, pad);
    await worker.setParameters({tessedit_pageseg_mode:width > height * 2.5 ? '7' : '11'});
    if (!current()) return [];
    const {data} = await worker.recognize(input, {}, {blocks:true});
    const lines = (data.blocks || []).flatMap(b => b.paragraphs.flatMap(p => p.lines))
      .filter(line => validLine(line))
      .sort((a,b) => (b.bbox.y1-b.bbox.y0)*b.confidence - (a.bbox.y1-a.bbox.y0)*a.confidence);
    if (!lines.length && current() && (crop || width > height * 2.5)) {
      const ink = window.ImageFontShapes.inkLine(picture, box);
      if (!ink) return [];
      const factor = Math.min(48 / ink.height, 1500 / ink.width);
      const content = {x:12, y:12, w:Math.max(1, Math.round(ink.width*factor)), h:Math.max(1, Math.round(ink.height*factor))};
      const image = draw(ink, {x:0, y:0, w:ink.width, h:ink.height}, content.w, content.h, 12);
      await worker.setParameters({tessedit_pageseg_mode:'7'});
      const retry = await worker.recognize(image);
      const text = validLine(retry.data);
      return text ? [{text, sample:{image, content, area:box, isolatedInk:true}}] : [];
    }
    if (!lines.length) return [];
    const line = lines[0], bounds = line.bbox;
    const left = Math.max(0, bounds.x0-pad-3), top = Math.max(0, bounds.y0-pad-3);
    const right = Math.min(width, bounds.x1-pad+3), bottom = Math.min(height, bounds.y1-pad+3);
    if (right <= left || bottom <= top) return [];
    const area = {x:box.x + left*box.w/width, y:box.y + top*box.h/height,
      w:(right-left)*box.w/width, h:(bottom-top)*box.h/height};
    const image = draw(picture, area, right-left, bottom-top);
    return [{text:validLine(line), sample:{area, image, content:{x:0, y:0, w:image.width, h:image.height}}}];
  }

  // Serialize work so a burst of new selections cannot start several WASM engines.
  function read(picture, crop, current) {
    const run = async () => {
      if (!current()) return [];
      let worker, timeout, finished = false;
      const job = async () => {
        const {default:ocr} = await import(base + '/tesseract.esm.min.js');
        if (finished || !current()) return [];
        let rejectEngine;
        const failure = new Promise((_, reject) => { rejectEngine = reject; });
        const loading = ocr.createWorker('kor', 1, {workerPath:base+'/worker.min.js', workerBlobURL:false,
          corePath:base+'/tesseract-core-lstm.wasm.js', langPath:base, errorHandler:err => rejectEngine(Error(String(err)))});
        worker = await Promise.race([loading, failure]);
        if (finished) { await worker.terminate(); return []; }
        return current() ? recognize(worker, picture, crop, current) : [];
      };
      try {
        const deadline = new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('OCR timed out')), 60000); });
        return await Promise.race([job(), deadline]);
      } finally {
        finished = true;
        clearTimeout(timeout);
        if (worker) await worker.terminate();
      }
    };
    const result = pending.then(run);
    pending = result.catch(() => {});
    return result;
  }
  window.ImageFontOCR = {read};
})();
