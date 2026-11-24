// Image decoding, selection, and font comparison stay on this device.
(() => {
  'use strict';
  const el = id => document.getElementById('im-' + id);
  const panel = document.getElementById('image-finder');
  const preview = el('preview'), results = el('results'), status = el('status');
  const loaded = new Map();
  let picture, crop, start, revision = 0, catalog;

  let detectedAreas = [];
  let ocrRequest = 0, recognized = [];
  const ocrStatus = el('ocr-status');

  function cancelReading() {
    ocrRequest++;
    ocrStatus.textContent = '';
    ocrStatus.removeAttribute('aria-busy');
  }

  async function readText() {
    if (!picture) return;
    const request = ++ocrRequest;
    const current = () => request === ocrRequest;
    if (recognized.length && el('text').value === recognized.map(row => row.text).join('\n')) el('text').value = '';
    recognized = [];
    ocrStatus.setAttribute('aria-busy', 'true');
    ocrStatus.textContent = '이 기기에서 한글을 읽고 있습니다…';
    try {
      const rows = await window.ImageFontOCR.read(picture, originalCrop(), current, () => {
        if (current()) ocrStatus.textContent = '작은 글자를 다시 읽고 있습니다. 첫 사용 시 추가 인식 자료를 받습니다…';
      });
      if (!current()) return;
      if (!rows.length) {
        ocrStatus.textContent = '한글을 읽기 어렵습니다. 원하는 한 줄을 드래그하거나 직접 입력하세요.';
        return;
      }
      recognized = rows;
      el('text').value = rows.map(row => row.text).join('\n');
      detectedAreas = rows.map(row => row.sample.area);
      paint();
      ocrStatus.textContent = '문구를 자동으로 채웠습니다. 글자를 확인한 뒤 폰트를 찾아보세요.';
    } catch {
      if (current()) ocrStatus.textContent = '자동 읽기를 완료하지 못했습니다. 다시 읽거나 직접 입력하세요.';
    } finally {
      if (current()) ocrStatus.removeAttribute('aria-busy');
    }
  }
  el('read').onclick = () => { invalidate(); readText(); };

  function invalidate() {
    revision++;
    if (detectedAreas.length) { detectedAreas = []; paint(); }
    window.ImageFontBoard?.reset();
    results.replaceChildren();
    status.replaceChildren();
    delete status.dataset.confidence;
    el('run').disabled = false;
  }

  function paint() {
    if (!picture) return;
    const ctx = preview.getContext('2d');
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.drawImage(picture, 0, 0, preview.width, preview.height);
    if (detectedAreas.length) {
      const sx = preview.width / picture.naturalWidth, sy = preview.height / picture.naturalHeight;
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#111';
      for (const box of detectedAreas) ctx.strokeRect(box.x*sx, box.y*sy, box.w*sx, box.h*sy);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#fff';
      for (const box of detectedAreas) ctx.strokeRect(box.x*sx, box.y*sy, box.w*sx, box.h*sy);
      ctx.restore();
    }
    if (!crop) return;
    const {x, y, w, h} = crop;
    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.fillRect(0, 0, preview.width, y);
    ctx.fillRect(0, y + h, preview.width, preview.height - y - h);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, preview.width - x - w, h);
    ctx.strokeStyle = '#1271ed';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  const fileInput = el('file'), attachment = el('attachment'), attachStatus = el('attach-status');
  const formats = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const isImageFile = file => formats.has(file.type) ||
    ((!file.type || file.type === 'application/octet-stream') && /\.(png|jpe?g|webp)$/i.test(file.name));

  async function attach(files) {
    if (!files.length) return;
    invalidate();
    const version = revision, file = files[0];
    if (files.length !== 1) {
      attachStatus.textContent = '이미지를 한 장씩 놓아주세요.';
      return;
    }
    if (!isImageFile(file) || file.size > 25 * 1024 * 1024) {
      attachStatus.textContent = '25 MB 이하 PNG, JPG, WebP 이미지를 선택하세요.';
      return;
    }
    cancelReading();
    recognized = [];
    el('text').value = '';
    start = crop = picture = null;
    attachment.textContent = '';
    el('edit').hidden = true;
    attachStatus.textContent = '이미지를 여는 중입니다.';
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (version !== revision) return;
      picture = img;
      const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      preview.width = Math.max(1, Math.round(img.naturalWidth * scale));
      preview.height = Math.max(1, Math.round(img.naturalHeight * scale));
      paint();
      attachment.textContent = file.name;
      el('edit').hidden = false;
      attachStatus.textContent = '이미지가 첨부되었습니다.';
      readText();
    } catch {
      if (version === revision) attachStatus.textContent = '이미지를 열 수 없습니다.';
    } finally { URL.revokeObjectURL(url); }
  }

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    fileInput.value = '';
    attach(files);
  });

  // A native paste already carries the pixels; keyboard and context-menu paste need no clipboard read.
  function attachPasted(files) {
    panel.open = true;
    panel.scrollIntoView({block: 'nearest'});
    attach(files);
  }

  document.addEventListener('paste', event => {
    const data = event.clipboardData;
    if (!data || event.defaultPrevented) return;
    const editable = event.target instanceof Element &&
      (event.target.closest('input, textarea') || event.target.isContentEditable);
    if (editable && (data.getData('text/plain') || data.getData('text/html'))) return;

    let files = Array.from(data.files);
    if (!files.length) {
      files = Array.from(data.items).filter(item => item.kind === 'file')
        .map(item => item.getAsFile()).filter(Boolean);
    }
    if (!files.some(file => file.type.startsWith('image/') || isImageFile(file))) return;
    event.preventDefault();
    attachPasted(files);
  });

  let pasteRequest = 0;
  el('paste').addEventListener('click', async () => {
    const request = ++pasteRequest, version = revision;
    const current = () => request === pasteRequest && version === revision;
    const shortcut = '이미지를 복사한 뒤 Ctrl+V 또는 ⌘V로 붙여넣으세요.';
    if (!navigator.clipboard?.read) {
      attachStatus.textContent = shortcut;
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      if (!current()) return;
      const files = [];
      for (const item of items) {
        const type = item.types.find(t => formats.has(t)) || item.types.find(t => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          files.push(new File([blob], 'clipboard.' + type.split('/')[1], {type}));
        }
      }
      if (!current()) return;
      if (files.length) attachPasted(files);
      else attachStatus.textContent = '클립보드에 이미지가 없습니다. 이미지 복사 후 다시 시도하세요.';
    } catch {
      if (current()) attachStatus.textContent = shortcut;
    }
  });

  if (location.hash === '#image-finder') panel.open = true;
  function isFileDrag(transfer) {
    return Array.from(transfer.types).includes('Files') || Array.from(transfer.items || []).some(item => item.kind === 'file');
  }
  function isLinkOnTarget(event) {
    return event.target.closest('#im-drop, #image-finder > summary') && Array.from(event.dataTransfer.types).includes('text/uri-list');
  }
  for (const name of ['dragenter', 'dragover']) {
    panel.addEventListener(name, event => {
      if (!isFileDrag(event.dataTransfer) && !isLinkOnTarget(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      panel.dataset.drag = 'on';
    });
  }
  panel.addEventListener('dragleave', event => {
    if (!panel.contains(event.relatedTarget)) delete panel.dataset.drag;
  });
  panel.addEventListener('drop', event => {
    delete panel.dataset.drag;
    const files = event.dataTransfer.files;
    if (!files.length && !isFileDrag(event.dataTransfer) && !isLinkOnTarget(event)) return;
    event.preventDefault();
    panel.open = true;
    if (files.length) attach(files);
    else attachStatus.textContent = '기기에 저장한 이미지 파일을 놓아주세요.';
  });

  // The scanner's general drop area also accepts a single image.
  window.ImageFontFinder = {acceptDrop(file) {
    if (!isImageFile(file)) return false;
    panel.open = true;
    panel.scrollIntoView({block: 'start'});
    attach([file]);
    return true;
  }};

  function point(event) {
    const rect = preview.getBoundingClientRect();
    return [Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * preview.width),
      Math.round(Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * preview.height)];
  }
  preview.onpointerdown = event => {
    if (!event.isPrimary) return;
    invalidate();
    cancelReading();
    start = point(event);
    preview.setPointerCapture(event.pointerId);
  };
  preview.onpointermove = event => {
    if (!start || !event.isPrimary) return;
    const [x, y] = point(event);
    crop = {x: Math.min(x, start[0]), y: Math.min(y, start[1]), w: Math.abs(x - start[0]), h: Math.abs(y - start[1])};
    paint();
  };
  preview.onpointerup = event => {
    if (!start || !event.isPrimary) return;
    preview.onpointermove(event);
    start = null;
    if (crop.w < 3 || crop.h < 3) { crop = null; paint(); }
    readText();
  };
  preview.onpointercancel = () => { if (start) { start = crop = null; paint(); readText(); } };
  el('reset').onclick = () => { invalidate(); start = crop = null; paint(); readText(); };
  el('text').oninput = () => {
    cancelReading();
    invalidate();
    detectedAreas = recognized.map(row => row.sample.area);
    paint();
  };

  function originalCrop() {
    if (!crop) return null;
    const sx = picture.naturalWidth / preview.width, sy = picture.naturalHeight / preview.height;
    const x = Math.floor(crop.x * sx), y = Math.floor(crop.y * sy);
    return {x, y, w: Math.min(picture.naturalWidth, Math.ceil((crop.x + crop.w) * sx)) - x,
      h: Math.min(picture.naturalHeight, Math.ceil((crop.y + crop.h) * sy)) - y};
  }

  function glyphPixels(char, family, weight) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.font = `${weight} 40px "${family}", serif`;
    ctx.fillText(char, 6, 48);
    return new Uint32Array(ctx.getImageData(0, 0, 64, 64).data.buffer);
  }

  function hasGlyphs(family, weight, characters, fallbacks) {
    for (const char of characters) {
      const key = `${weight}/${char}`;
      if (!fallbacks.has(key)) fallbacks.set(key, glyphPixels(char, 'missing-image-font', weight));
      const actual = glyphPixels(char, family, weight), fallback = fallbacks.get(key);
      if (actual.every((pixel, index) => pixel === fallback[index])) return false;
    }
    return true;
  }

  function loadFace({row, weight, url}) {
    if (!loaded.has(url)) {
      const font = new FontFace(`im-${row.id}-${weight}`, `url("${url}")`, {weight: String(weight)});
      const entry = {font};
      entry.ready = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Font load timed out')), 12000);
        font.load().then(resolve, reject).finally(() => clearTimeout(timer));
      }).then(() => {
        document.fonts.add(font);
        return font.family;
      }).catch(error => { loaded.delete(url); throw error; });
      loaded.set(url, entry);
    }
    return loaded.get(url).ready;
  }

  function trimFaces(needed) {
    // Each scan has a bounded shortlist. Release old decoded fonts between scans.
    for (const [url, entry] of loaded) {
      if (loaded.size <= 16) break;
      if (!needed.has(url) && entry.font.status === 'loaded') {
        document.fonts.delete(entry.font);
        loaded.delete(url);
      }
    }
  }

  function showResults(matches, confident, text) {
    status.dataset.confidence = confident ? 'high' : 'low';
    status.textContent = confident ? '글자 모양이 가장 가까운 원본 후보입니다.' : '원본 서체 판별 어려움. 아래는 모양이 비슷한 무료 서체입니다.';
    for (const [index, match] of matches.slice(0, 3).entries()) {
      const article = document.createElement('article'), title = document.createElement('strong');
      const label = document.createElement('small');
      label.textContent = confident && index === 0 ? '원본 후보' : '닮은 무료 폰트';
      if (Object.keys(match.row.weights || {}).length > 1) {
        const weightLabel = document.createElement('span');
        weightLabel.textContent = '굵기';
        label.append(' · ', weightLabel, ' ' + match.weight);
      }
      title.textContent = match.row.name;
      title.translate = false;
      const sample = document.createElement('p');
      sample.className = 'im-sample';
      sample.translate = false;
      sample.textContent = text;
      sample.style.fontFamily = `"${match.family}"`;
      sample.style.fontWeight = String(match.weight);
      const detail = document.createElement('a'), source = document.createElement('a');
      detail.href = '/font/' + match.row.id + '.html';
      detail.textContent = '이용조건';
      source.href = match.row.source;
      source.textContent = '공식 배포처';
      article.append(label, title, sample, detail, ' · ', source);
      results.append(article);
    }
  }

  function showGlyphComparison(matches, lines, targets, samples) {
    if (matches.length < 2) return;
    const pair = matches.slice(0, 2);
    const shapes = window.ImageFontShapes;
    const references = pair.map(match => lines.map(line => shapes.reference(line, match.family, match.weight)));
    const chosen = shapes.distinctiveGlyphs(targets, references);
    if (!chosen.length) return;

    const table = document.createElement('table');
    table.className = 'im-glyph-comparison';
    table.createCaption().textContent = '글자 확대 비교';
    const heading = table.createTHead().insertRow();
    for (const [index, name] of ['원본 이미지', ...pair.map(match => match.row.name)].entries()) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = name;
      if (index > 0) th.translate = false;
      heading.append(th);
    }
    const body = table.createTBody();
    for (const {source, line} of chosen) {
      let {x, y, w, h} = source.box;
      // The color detector surrounds the isolated ink with a clean margin.
      // Map back through that margin to show the actual, full-color source.
      if (samples[line]) {
        const {content, area} = samples[line];
        x = area.x + (x - content.x) * area.w / content.w;
        y = area.y + (y - content.y) * area.h / content.h;
        w *= area.w / content.w;
        h *= area.h / content.h;
      }
      const row = body.insertRow();
      const canvases = Array.from({length:3}, () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 160;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', source.char);
        row.insertCell().append(canvas);
        return canvas;
      });
      const inks = pair.map((match, i) => {
        const ctx = canvases[i+1].getContext('2d');
        ctx.font = match.weight + ' 128px "' + match.family + '"';
        return ctx.measureText(source.char);
      });
      const ratios = inks.map(m => (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) /
        Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent));
      const height = 138 / Math.max(1, w/h, ...ratios);
      const width = height * w/h;
      canvases[0].getContext('2d').drawImage(picture, x, y, w, h, (160-width)/2, (160-height)/2, width, height);
      inks.forEach((m, i) => {
        const ctx = canvases[i+1].getContext('2d');
        const scale = height / Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
        ctx.translate((160 - height*ratios[i])/2, (160-height)/2);
        ctx.scale(scale, scale);
        ctx.fillText(source.char, m.actualBoundingBoxLeft, m.actualBoundingBoxAscent);
      });
    }
    results.append(table);
  }

  el('run').onclick = async () => {
    if (!el('text').value.trim() && ocrStatus.hasAttribute('aria-busy')) return;
    invalidate();
    const version = revision, text = el('text').value.trim().normalize('NFC');
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const publish = el('publish')?.checked;
    if (!picture || !lines.length || lines.some(line => !/[가-힣]/.test(line) || [...line].length < 2)) {
      status.textContent = '이미지에 보이는 한글을 포함해 두 글자 이상 입력하세요.';
      return;
    }
    if (lines.length > 2 || lines.some(line => [...line].length > 40)) {
      status.textContent = '한 번에 두 줄까지, 한 줄에 40자까지 비교할 수 있습니다.';
      return;
    }
    cancelReading();
    el('run').disabled = true;
    try {
      const shapes = window.ImageFontShapes;
      const selection = originalCrop();
      const samples = recognized.length === lines.length
        ? recognized.map(row => row.sample)
        : window.ImageFontColor.detect(picture, selection, lines);
      if (lines.length === 2 && samples.length !== 2) {
        status.textContent = '두 줄의 글자색을 분리하기 어렵습니다. 한 줄을 드래그하고 그 문구만 입력하세요.';
        return;
      }
      detectedAreas = samples.map(sample => sample.area);
      paint();
      const targets = lines.map((line, i) => samples[i]
        ? shapes.prepareTarget(samples[i].image, null, line)
        : shapes.prepareTarget(picture, selection, line));
      if (targets.some(target => !target)) { status.textContent = '글자 윤곽을 찾지 못했습니다. 글자 한 줄을 다시 선택하세요.'; return; }
      status.textContent = '비교할 서체를 준비하고 있습니다…';
      if (!catalog) {
        const response = await fetch('/data/image-fonts.json?v=3');
        if (!response.ok) throw Error('Catalog unavailable');
        catalog = await response.json();
      }
      const target = {
        glyphs: targets.flatMap(line => line.glyphs),
        minGlyphHeight: Math.min(...targets.map(line => line.minGlyphHeight)),
        distinct: new Set(text.match(/[가-힣]/g)).size
      };
      const {faces, indexed, glyphCount} = await window.ImageFontIndex.rank(target, catalog);
      if (version !== revision) return;
      trimFaces(new Set(faces.map(face => face.url)));
      const characters = new Set(text.match(/[가-힣]/g)), fallbacks = new Map(), bestByFamily = new Map();
      status.textContent = '글자의 획과 굵기를 비교하고 있습니다…';
      for (let i = 0; i < faces.length; i += 3) {
        if (version !== revision) return;
        await Promise.all(faces.slice(i, i + 3).map(async candidate => {
          const {row, weight} = candidate;
          let family;
          try { family = await loadFace(candidate); } catch { return; }
          if (version !== revision || !hasGlyphs(family, weight, characters, fallbacks)) return;
          const scores = [];
          for (const [index, line] of lines.entries()) {
            const reference = shapes.reference(line, family, weight);
            if (!reference) return;
            scores.push(shapes.compare(targets[index], reference));
          }
          const measurement = {...scores[0], scores};
          if (scores.length === 2) {
            for (const key of ['score', 'glyph', 'line']) measurement[key] = (scores[0][key] + scores[1][key]) / 2;
            measurement.coverage = Math.min(scores[0].coverage, scores[1].coverage);
          }
          if (!Number.isFinite(measurement.score)) return;
          const best = bestByFamily.get(row.id);
          if (!best || measurement.score > best.score) bestByFamily.set(row.id, {...measurement, family, weight, row});
        }));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (version !== revision) return;
      const matches = [...bestByFamily.values()].sort((a, b) => b.score - a.score);
      if (!matches.length) { status.textContent = '입력한 글자를 지원하는 비교용 서체를 불러오지 못했습니다.'; return; }
      const expectedCount = new Set(faces.map(face => face.row.id)).size;
      // A strong row must not hide a conflicting or weak second row.
      const agree = targets.length === 1 || targets.every((line, i) => {
        const ranked = matches.map(match => match.scores[i]).sort((a, b) => b.score - a.score);
        return ranked[0] === matches[0].scores[i] && shapes.isConfident(line, ranked, expectedCount);
      });
      // Automatically isolating a color can trim antialiased edges; close fits are suggestions.
      const clearColorMatch = !samples.some(sample => sample.isolatedInk) || (matches.length > 1 && matches[0].score - matches[1].score >= .06);
      const confident = shapes.isConfident(target, matches, expectedCount) && indexed && glyphCount > 0 && agree && clearColorMatch;
      showResults(matches, confident, text);
      showGlyphComparison(matches, lines, targets, samples);
      if (publish && el('publish')?.checked) window.ImageFontBoard?.record(matches, confident);
    } catch {
      if (version === revision) status.textContent = '비교 자료를 열 수 없습니다. 다시 시도하세요.';
    } finally { if (version === revision) el('run').disabled = false; }
  };
})();
