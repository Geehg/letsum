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
        if (text) result.push({text, sample, confidence:data.confidence});
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
      return text ? [{text, confidence:retry.data.confidence, sample:{image, content, area:box, isolatedInk:true}}] : [];
    }
    if (!lines.length) return [];
    const line = lines[0], bounds = line.bbox;
    const left = Math.max(0, bounds.x0-pad-3), top = Math.max(0, bounds.y0-pad-3);
    const right = Math.min(width, bounds.x1-pad+3), bottom = Math.min(height, bounds.y1-pad+3);
    if (right <= left || bottom <= top) return [];
    const area = {x:box.x + left*box.w/width, y:box.y + top*box.h/height,
      w:(right-left)*box.w/width, h:(bottom-top)*box.h/height};
    const image = draw(picture, area, right-left, bottom-top);
    return [{text:validLine(line), confidence:line.confidence, sample:{area, image, content:{x:0, y:0, w:image.width, h:image.height}}}];
  }

  // A low-confidence snippet can be reread directly. In a larger photograph,
  // first localize text if the primary reader found nothing or just a fragment.
  async function refine(picture, crop, primary, current, onRefine) {
    if (!current() || !window.Worker || !window.DecompressionStream) return primary;
    const box = crop || {x:0, y:0, w:picture.naturalWidth, h:picture.naturalHeight};
    const isStrip = box.w >= 2*box.h && box.w <= 32*box.h && box.h <= 180;
    const fragment = primary.length === 1 && primary[0].confidence < 88 &&
      (primary[0].text.match(/[가-힣]/gu) || []).length <= 2;
    const locate = !isStrip && box.w >= 200 && box.h >= 160 && (!primary.length || fragment);
    if (!primary.length && !isStrip && !locate) return primary;

    const rows = [...primary];
    let worker, stop, clock;
    async function request(area, width, height, detect = false) {
      if (!current()) return null;
      const canvas = draw(picture, area, width, height);
      const pixels = canvas.getContext('2d').getImageData(0,0,width,height).data;
      let min=255, max=0;
      for (let k=0; k<pixels.length; k+=4) {
        const luma=(77*pixels[k]+150*pixels[k+1]+29*pixels[k+2]) >> 8;
        min=Math.min(min,luma); max=Math.max(max,luma);
      }
      if (max-min<10) return null;
      if (!worker) {
        onRefine?.();
        worker = new Worker('/js/image-font-line-worker.js?v=1', {type:'module'});
        const deadline = Date.now() + 45000;
        clock = setInterval(() => {
          if (!current() || Date.now() > deadline) stop?.(Error('Line recognition interrupted'));
        }, 250);
      }
      return new Promise((resolve,reject) => {
        stop=reject;
        worker.onmessage=e=>resolve(e.data);
        worker.onerror=()=>reject(Error('Line recognition unavailable'));
        worker.postMessage({pixels,width,height,detect},[pixels.buffer]);
      });
    }
    try {
      let areas;
      if (locate) {
        const scale=Math.min(1,960/Math.max(box.w,box.h));
        const aligned = size => Math.max(32,Math.round(scale*size/32)*32);
        const bounds=await request(box,aligned(box.w),aligned(box.h),true);
        areas=(bounds || []).map(b=>({x:box.x+b.x*box.w, y:box.y+b.y*box.h,
          w:(b.right-b.x)*box.w, h:(b.bottom-b.y)*box.h}));
      } else {
        areas = isStrip && primary.length <= 1 ? [box] : primary.map(row=>row.sample.area);
      }
      for (const [index,area] of areas.entries()) {
        if (!current()) break;
        const row=primary[index];
        if (!locate && row && (row.confidence >= 88 || (area.h > 48 && row.confidence >= 80))) continue;
        if (area.w < 1.3*area.h || area.w > 32*area.h) continue;
        const text=await request(area,Math.max(2,Math.round(area.w*48/area.h)),48);
        if (!text || !current()) continue;
        // Font matching uses the original pixels and their source coordinates.
        const scale=Math.min(1,1600/Math.max(area.w,area.h));
        const image=draw(picture,area,Math.max(1,Math.round(area.w*scale)),Math.max(1,Math.round(area.h*scale)));
        const result={text,sample:{area,image,content:{x:0,y:0,w:image.width,h:image.height}}};
        if (locate) return [result];
        rows[index]=result;
      }
    } catch { /* Slow networks and unsupported devices retain the primary OCR. */ }
    finally { clearInterval(clock); worker?.terminate(); }
    return rows;
  }

  // Serialize work so a burst of new selections cannot start several WASM engines.
  function read(picture, crop, current, onRefine) {
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
    const result = pending.then(run).then(rows => refine(picture, crop, rows, current, onRefine));
    pending = result.catch(() => {});
    return result;
  }
  window.ImageFontOCR = {read};
})();
