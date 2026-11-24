// Image decoding, selection, and font comparison stay on this device.
(() => {
  'use strict';
  const el = id => document.getElementById('im-' + id);
  const panel = document.getElementById('image-finder');
  const preview = el('preview'), results = el('results'), status = el('status');
  const loaded = new Map();
  let picture, crop, start, revision = 0, catalog;

  function invalidate() {
    revision++;
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
  };
  preview.onpointercancel = () => { start = crop = null; paint(); };
  el('reset').onclick = () => { invalidate(); start = crop = null; paint(); };
  el('text').oninput = invalidate;

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

  el('run').onclick = async () => {
    invalidate();
    const version = revision, text = el('text').value.trim().normalize('NFC');
    const publish = el('publish')?.checked;
    if (!picture || !/[가-힣]/.test(text) || Array.from(text).length < 2) {
      status.textContent = '이미지에 보이는 한글을 포함해 두 글자 이상 입력하세요.';
      return;
    }
    el('run').disabled = true;
    try {
      const shapes = window.ImageFontShapes;
      const target = shapes.prepareTarget(picture, originalCrop(), text);
      if (!target) { status.textContent = '글자 윤곽을 찾지 못했습니다. 글자 한 줄을 다시 선택하세요.'; return; }
      status.textContent = '비교할 서체를 준비하고 있습니다…';
      if (!catalog) {
        const response = await fetch('/data/image-fonts.json?v=2');
        if (!response.ok) throw Error('Catalog unavailable');
        catalog = await response.json();
      }
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
          const reference = shapes.reference(text, family, weight);
          if (!reference) return;
          const measurement = shapes.compare(target, reference);
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
      const confident = indexed && glyphCount > 0 && shapes.isConfident(target, matches, expectedCount);
      showResults(matches, confident, text);
      if (publish && el('publish')?.checked) window.ImageFontBoard?.record(matches, confident);
    } catch {
      if (version === revision) status.textContent = '비교 자료를 열 수 없습니다. 다시 시도하세요.';
    } finally { if (version === revision) el('run').disabled = false; }
  };
})();
