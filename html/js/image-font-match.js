// Image decoding, selection, and font comparison stay on this device.
(() => {
  'use strict';
  const el = id => document.getElementById('im-' + id);
  const panel = document.getElementById('image-finder');
  const preview = el('preview'), results = el('results'), status = el('status');
  const progress = window.ImageFontProgress;
  const loaded = new Map();
  const msg = (ko, en) => document.documentElement.lang === "en" ? en : ko;
  let picture, crop, start, revision = 0;

  let detectedAreas = [];
  let ocrRequest = 0, recognized = [], reader;
  let pendingPost = null;
  const ocrStatus = el('ocr-status');

  function cancelReading() {
    ocrRequest++;
    reader?.abort();
    reader = null;
    ocrStatus.textContent = '';
    ocrStatus.removeAttribute('aria-busy');
  }

  async function readText() {
    if (!picture) return;
    const request = ++ocrRequest, version = revision;
    reader = new AbortController();
    const current = () => request === ocrRequest && version === revision;
    if (recognized.length && el('text').value === recognized.map(row => row.text).join('\n')) el('text').value = '';
    recognized = [];
    progress.reach(1);
    progress.note(1, '이미지에서 글줄을 찾고 있습니다.', 'Locating text lines in the image.');
    el('run').disabled = true;
    ocrStatus.setAttribute('aria-busy', 'true');
    ocrStatus.textContent = '이 기기에서 한글을 읽고 있습니다…';
    try {
      const rows = await window.ImageFontOCR.read(picture, originalCrop(), current, () => {
        if (current()) {
          ocrStatus.textContent = '작은 글자를 다시 읽고 있습니다. 첫 사용 시 추가 인식 자료를 받습니다…';
          progress.note(1, '작은 글자를 확대해 다시 읽는 중', 'Rereading small text at a larger scale');
        }
      }, reader.signal);
      if (!current()) return;
      if (!rows.length) {
        ocrStatus.textContent = '한글을 읽기 어렵습니다. 원하는 한 줄을 드래그하거나 직접 입력하세요.';
        progress.note(1, '한 줄을 드래그하거나 문구를 입력하세요.', 'Select one line or enter its text.');
        progress.stop('review', '문구 확인 필요', 'Text needs review');
        return;
      }
      recognized = rows;
      el('text').value = rows.map(row => row.text).join('\n');
      detectedAreas = rows.map(row => row.sample.area);
      paint();
      progress.note(1, rows.map(row => row.text).join(' / '));
      ocrStatus.textContent = msg('자동으로 읽은 문구입니다. 수정한 뒤 다시 대조할 수 있습니다.', 'Automatically read text. Edit it to run another comparison.');
    } catch {
      if (current()) {
        ocrStatus.textContent = '자동 읽기를 완료하지 못했습니다. 다시 읽거나 직접 입력하세요.';
        progress.note(1, '문구 다시 읽기 또는 직접 입력', 'Retry reading or enter the text');
        progress.stop('review', '문구 확인 필요', 'Text needs review');
      }
      return;
    } finally {
      if (current()) {
        reader = null;
        ocrStatus.removeAttribute('aria-busy');
        el('run').disabled = false;
      }
    }
    if (current()) return compare(true);
  }
  el('read').onclick = () => { invalidate(); readText(); };

  function invalidate(keepProgress = false) {
    revision++;
    cancelReading();
    pendingPost = null;
    el('post-result').hidden = true;
    if (!keepProgress) progress.reset();
    trimFaces(new Set());
    if (detectedAreas.length) { detectedAreas = []; paint(); }
    window.ImageFontBoard?.reset();
    results.replaceChildren();
    status.replaceChildren();
    for (const key of ['confidence', 'compared', 'total', 'localMissing']) delete status.dataset[key];
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
    const file = files[0];
    if (files.length !== 1) {
      attachStatus.textContent = '이미지를 한 장씩 놓아주세요.';
      return;
    }
    if (!isImageFile(file) || file.size > 25 * 1024 * 1024) {
      attachStatus.textContent = '25 MB 이하 PNG, JPG, WebP 이미지를 선택하세요.';
      return;
    }
    invalidate();
    const version = revision;
    recognized = [];
    el('text').value = '';
    start = crop = picture = null;
    attachment.textContent = '';
    el('edit').hidden = true;
    progress.imageSize(0, 0);
    progress.begin(0);
    const scan = el('scan');
    const top = scan.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * .65) scan.scrollIntoView({block: 'start'});
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
      progress.imageSize(img.naturalWidth, img.naturalHeight);
      attachment.textContent = file.name;
      el('edit').hidden = false;
      attachStatus.textContent = '이미지가 첨부되었습니다.';
      readText();
    } catch {
      if (version === revision) {
        attachStatus.textContent = '이미지를 열 수 없습니다.';
        progress.note(0, '다른 PNG, JPG 또는 WebP를 선택하세요.', 'Choose a different PNG, JPG or WebP.');
        progress.stop('error', '이미지를 열 수 없습니다', 'Could not open image');
      }
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
    readText();
  };
  preview.onpointercancel = () => { if (start) { start = crop = null; paint(); readText(); } };
  el('reset').onclick = () => { invalidate(); start = crop = null; paint(); readText(); };
  el('text').oninput = () => {
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

  function faceKey({row, weight}) { return row.id + "/" + weight; }

  function loadFace(candidate) {
    const {row, weight, url} = candidate, key = faceKey(candidate);
    if (!loaded.has(key)) {
      const font = new FontFace(`im-${row.id}-${weight}`, `url("${url}")`, {weight: String(weight)});
      const entry = {font};
      entry.ready = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Font load timed out')), 12000);
        font.load().then(resolve, reject).finally(() => clearTimeout(timer));
      }).then(() => {
        if (loaded.get(key) !== entry) throw Error('Superseded font load');
        document.fonts.add(font);
        return font.family;
      }).catch(error => {
        if (loaded.get(key) === entry) loaded.delete(key);
        throw error;
      });
      loaded.set(key, entry);
    }
    return loaded.get(key).ready;
  }

  function trimFaces(needed) {
    // Release decoded originals as soon as they can no longer appear in the results.
    for (const [key, entry] of loaded) {
      if (!needed.has(key)) {
        document.fonts.delete(entry.font);
        loaded.delete(key);
      }
    }
  }

  function sampleElement(match, text) {
    if (match.row.specimen) {
      const sample = document.createElement('img');
      sample.src = match.row.specimen;
      sample.className = 'im-fixed-specimen';
      sample.alt = match.row.name + msg(' 공식 원본 견본', ' reference specimen');
      sample.loading = 'lazy';
      return sample;
    }
    if (match.family && !match.row.mode) {
      const sample = document.createElement('p');
      sample.className = 'im-sample';
      sample.translate = false;
      sample.textContent = text;
      sample.style.fontFamily = '"' + match.family + '"';
      sample.style.fontWeight = String(match.weight);
      return sample;
    }
    return null;
  }

  function showResults(matches, confident, text, limited, count) {
    status.dataset.confidence = confident ? 'high' : 'low';
    status.dataset.compared = count.compared;
    status.dataset.total = count.total;
    status.dataset.localMissing = count.missing;
    status.textContent = confident ? '글자 모양이 가장 가까운 원본 후보입니다.'
      : msg('원본을 특정하기 어렵습니다. 모양이 가까운 후보를 표시합니다.', 'The original is uncertain. These are the closest visual matches.');
    const coverage = document.createElement('small');
    const n = value => value.toLocaleString(document.documentElement.lang);
    const parts = [msg('글자 모양 대조 ', 'Families compared ') + n(count.compared) + ' / ' + n(count.total)];
    if (count.missing) parts.push(msg('기기 원본 미연결 ', 'Local original unavailable ') + count.missing);
    if (count.noGlyph) parts.push((count.coverageUnknown
      ? msg('글자 지원 미확인 ', 'Glyph coverage unverified ')
      : msg('비교할 글자 없음 ', 'No matching glyphs ')) + count.noGlyph);
    if (limited) parts.push(msg('일부 비교 자료를 받지 못했습니다.', 'Some comparison data could not be loaded.'));
    coverage.textContent = parts.join(' · ');
    coverage.title = msg('입력한 한글 중 실제 윤곽을 하나 이상 비교한 서체 수입니다.', 'Counts families with at least one comparable input syllable.');
    status.append(' ', coverage);
    for (const [index, match] of matches.slice(0, 3).entries()) {
      const article = document.createElement('article'), title = document.createElement('strong');
      const label = document.createElement('small');
      label.textContent = confident && index === 0 ? '원본 후보' : msg('닮은 서체', 'Similar typeface');
      if (match.manual) label.append(' · ', msg('직접 지정한 원본', 'Manually assigned original'));
      else if (match.row.mode === 'local') label.append(' · ', msg('기기 원본 대조', 'Compared on this device'));
      if (match.full === false) label.append(' · ', msg('일부 글자만 대조', 'Partial glyph comparison'));
      else if (!match.family) label.append(' · ', msg('글자 특징 대조', 'Glyph feature match'));
      if (Object.keys(match.row.weights || {}).length > 1) {
        const weightLabel = document.createElement('span');
        weightLabel.textContent = '굵기';
        label.append(' · ', weightLabel, ' ' + match.weight);
      }
      title.textContent = match.row.name;
      title.translate = false;
      article.append(label, title);
      const sample = sampleElement(match, text);
      if (sample) article.append(sample);
      const detail = document.createElement('a'), source = document.createElement('a');
      detail.href = '/font/' + match.row.id + '.html';
      detail.textContent = '이용조건';
      source.href = match.row.source;
      source.textContent = '공식 배포처';
      article.append(detail, ' · ', source);
      if (match.row.attribution) {
        const credit = document.createElement('small');
        credit.translate = false;
        credit.textContent = match.row.attribution;
        article.append(credit);
      }
      results.append(article);
    }
  }

  function showAllFamilies(faces, leaders, text, measure, active) {
    const byId = new Map();
    for (const face of faces) {
      if (!byId.has(face.row.id)) byId.set(face.row.id, []);
      byId.get(face.row.id).push(face);
    }
    const families = [...byId.values()].map(group => group.sort((a,b) => a.cost-b.cost))
      .sort((a,b) => a[0].cost-b[0].cost);
    const details = document.createElement('details'), summary = document.createElement('summary');
    details.className = 'im-all-families';
    summary.textContent = msg('전체 대조 후보 보기', 'All compared families') + ' (' + families.length.toLocaleString() + ')';
    const input = document.createElement('input'), list = document.createElement('ol'), more = document.createElement('button');
    input.type = 'search';
    input.placeholder = msg('대조한 서체 이름 검색', 'Search compared families');
    input.setAttribute('aria-label', input.placeholder);
    list.setAttribute('aria-label', msg('획 특징이 가까운 순서', 'Ordered by stroke features'));
    more.type = 'button';
    more.textContent = msg('후보 더 보기', 'Show more families');
    const selected = document.createElement('div');
    selected.className = 'im-selected-face';
    selected.setAttribute('role', 'status');
    let request = 0, limit = 15, opened = false;
    const keep = new Set(leaders.map(faceKey));
    const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[\s_-]+/g, '');
    async function inspect(group) {
      const current = ++request;
      selected.textContent = msg('이 서체의 굵기를 비교하고 있습니다…', 'Comparing this family’s weights…');
      const checked = [];
      for (let i = 0; i < group.length; i += 2) {
        if (!active() || request !== current) return;
        const batch = await Promise.all(group.slice(i, i+2).map(measure));
        checked.push(...batch.filter(Boolean));
      }
      if (!active() || request !== current) return;
      const best = checked.sort((a,b) => a.finalCost-b.finalCost)[0];
      if (!best) { selected.textContent = msg('이 문구를 비교할 수 없습니다.', 'This text could not be compared.'); return; }
      trimFaces(new Set([...keep, faceKey(best)]));
      const title = document.createElement('strong');
      title.translate = false;
      title.textContent = best.row.name;
      const method = best.full === false ? msg('일부 글자만 대조', 'Partial glyph comparison')
        : best.family ? msg('원본의 획 대조', 'Original outlines compared') : msg('글자 특징 대조', 'Glyph features compared');
      const weight = best.row.unknownWeights ? '' : ' · ' + msg('굵기 ', 'Weight ') + best.weight;
      selected.replaceChildren(title, document.createTextNode(weight + ' · ' + method));
      const sample = sampleElement(best, text);
      if (sample) selected.append(sample);
      const link = document.createElement('a');
      link.href = '/font/' + best.row.id + '.html';
      link.textContent = '이용조건';
      selected.append(' · ', link);
      if (best.row.attribution) {
        const credit = document.createElement('small');
        credit.translate = false;
        credit.textContent = best.row.attribution;
        selected.append(document.createElement('br'), credit);
      }
    }
    function render() {
      const query = normalize(input.value);
      const found = families.filter(([{row}]) => !query ||
        [row.name, row.id, ...(row.aliases || [])].some(name => normalize(name).includes(query)));
      list.replaceChildren();
      for (const group of found.slice(0,limit)) {
        const li = document.createElement('li'), button = document.createElement('button');
        button.type = 'button';
        button.textContent = group[0].row.name;
        button.translate = false;
        button.addEventListener('click', () => inspect(group).catch(() => {
          if (active()) selected.textContent = msg('다시 선택해 주세요.', 'Please select the family again.');
        }));
        li.append(button);
        list.append(li);
      }
      more.hidden = limit >= found.length;
      if (!found.length) selected.textContent = msg('대조한 후보 중 일치하는 이름이 없습니다.', 'No matching name among the compared families.');
    }
    details.addEventListener('toggle', () => {
      if (details.open && !opened) { opened = true; render(); }
    });
    input.addEventListener('input', () => { request++; limit = 15; selected.replaceChildren(); render(); });
    more.onclick = () => { limit += 30; render(); };
    const hint = document.createElement('p');
    hint.textContent = msg('획 특징이 가까운 순서입니다. 이름을 누르면 해당 서체의 굵기별 모양을 비교합니다.',
      'Ordered by stroke features. Select a name to compare its available weights.');
    details.append(summary, hint, input, selected, list, more);
    results.append(details);
  }

  function originalGlyphBox(box, sample) {
    if (!sample) return box;
    // The detector can isolate ink with a margin. Map its coordinates back onto the original image.
    const {content, area} = sample;
    return {
      x: area.x + (box.x - content.x) * area.w / content.w,
      y: area.y + (box.y - content.y) * area.h / content.h,
      w: box.w * area.w / content.w, h: box.h * area.h / content.h
    };
  }

  function showGlyphComparison(matches, lines, targets, samples) {
    if (matches.length < 2 || matches.slice(0, 2).some(m => !m.family || m.row.mode)) return;
    const pair = matches.slice(0, 2);
    const shapes = window.ImageFontShapes;
    const references = pair.map(match => lines.map((line, index) => shapes.reference(line, match.family, match.weight, targets[index].height)));
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
      const {x, y, w, h} = originalGlyphBox(source.box, samples[line]);
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

  window.ImageFontLocal.bind(invalidate);
  el('cancel').onclick = () => {
    invalidate(true);
    progress.stop('stopped', '분석을 중지했습니다', 'Scan stopped', '이 단계에서 중지됨', 'Stopped at this step');
    status.textContent = msg('분석을 중지했습니다.', 'Scan stopped.');
    if (!el('edit').hidden) el('run').focus({preventScroll: true});
  };

  function offerPost() { el('post-result').hidden = !pendingPost || !el('publish').checked; }
  el('publish').addEventListener('change', offerPost);
  el('post-result').onclick = () => {
    if (!pendingPost || !el('publish').checked) return;
    const {matches, confident} = pendingPost;
    pendingPost = null;
    offerPost();
    window.ImageFontBoard?.record(matches, confident);
  };
  function review(ko, en, step = 2) {
    status.textContent = msg(ko, en);
    progress.note(step, ko, en);
    progress.stop('review', '문구 확인 필요', 'Text needs review');
  }
  el('run').onclick = () => {
    if (!el('text').value.trim() && ocrStatus.hasAttribute('aria-busy')) return;
    invalidate();
    return compare(false);
  };
  async function compare(automatic) {
    const version = revision, text = el('text').value.trim().normalize('NFC');
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const publish = !automatic && el('publish').checked;
    if (!automatic) progress.enteredText(lines.join(' / '));
    if (!picture || !lines.length || lines.some(line => !/[가-힣]/.test(line) || [...line].length < 2)) {
      review('이미지에 보이는 한글을 포함해 두 글자 이상 입력하세요.', 'Enter at least two characters, including Korean text visible in the image.', 1);
      return;
    }
    if (lines.length > 2 || lines.some(line => [...line].length > 40)) {
      review('한 번에 두 줄까지, 한 줄에 40자까지 비교할 수 있습니다.', 'Compare up to two lines with 40 characters per line.', 1);
      return;
    }
    progress.reach(2);
    el('run').disabled = true;
    try {
      const shapes = window.ImageFontShapes;
      const selection = originalCrop();
      const samples = recognized.length === lines.length
        ? recognized.map(row => row.sample)
        : window.ImageFontColor.detect(picture, selection, lines);
      if (lines.length === 2 && samples.length !== 2) {
        review('두 줄의 글자색을 분리하기 어렵습니다. 한 줄을 드래그하고 그 문구만 입력하세요.', 'The two lines could not be separated. Select one line and enter its text.');
        return;
      }
      detectedAreas = samples.map(sample => sample.area);
      paint();
      const targets = lines.map((line, i) => samples[i]
        ? shapes.prepareTarget(samples[i].image, null, line)
        : shapes.prepareTarget(picture, selection, line));
      if (targets.some(target => !target)) {
        review('글자 윤곽을 찾지 못했습니다. 글자 한 줄을 다시 선택하세요.', 'No letter outlines were found. Select one line again.');
        return;
      }
      status.textContent = '비교할 서체를 준비하고 있습니다…';
      const target = {
        glyphs: targets.flatMap(line => line.glyphs),
        minGlyphHeight: Math.min(...targets.map(line => line.minGlyphHeight)),
        distinct: new Set(text.match(/[가-힣]/g)).size
      };
      const measuredGlyphs = targets.flatMap((line, i) => line.glyphs
        .filter(glyph => glyph.pixels && /^[가-힣]$/.test(glyph.char))
        .map(glyph => ({...glyph, box: originalGlyphBox(glyph.box, samples[i])})));
      progress.showInk(measuredGlyphs);
      const index = window.ImageFontIndex;
      const catalog = await index.catalog();
      if (version !== revision) return;
      const ranked = await index.rank(target, catalog, () => version === revision, (part, total) => {
        if (version !== revision) return;
        progress.note(2, '획 특징 자료 읽는 중 · ' + part + ' / ' + total, 'Reading glyph data · ' + part + ' / ' + total);
      });
      if (version !== revision) return;
      if (!ranked.glyphCount) {
        review('대조할 글자 윤곽을 분리하기 어렵습니다. 한 줄만 선택하고 문구를 확인하세요.', 'Select one line and check its text so individual glyphs can be compared.');
        return;
      }
      const local = await window.ImageFontLocal.available(catalog);
      if (version !== revision) return;
      trimFaces(new Set());
      const characters = new Set(text.match(/[가-힣]/g)), fallbacks = new Map();
      const localCompared = new Set();
      function pixels(candidate, family) {
        const {row, weight} = candidate;
        const hasCharacter = c => candidate.coverageTable ? candidate.coverageTable[c.charCodeAt(0) - 0xac00]
          : hasGlyphs(family, weight, [c], fallbacks);
        if (![...characters].every(hasCharacter)) {
          if (row.mode !== 'local') return null;
          const present = [...ranked.targets.keys()].filter(hasCharacter);
          const refs = present.flatMap(c => shapes.reference(c, family, weight)?.glyphs || []);
          const cost = index.localDistance(ranked.targets, refs, true);
          return cost === null ? null : featureOnly({...candidate, cost, full: false}, false);
        }
        const scores = [], glyphs = [];
        for (const [i, line] of lines.entries()) {
          const reference = shapes.reference(line, family, weight, targets[i].height);
          if (!reference) return null;
          const fullSize = targets[i].height < 28 ? shapes.reference(line, family, weight) : null;
          scores.push(shapes.compare(targets[i], reference, fullSize));
          glyphs.push(...reference.glyphs);
        }
        const measurement = {...scores[0], scores};
        if (scores.length === 2) {
          for (const name of ['score', 'glyph', 'line']) measurement[name] = (scores[0][name] + scores[1][name]) / 2;
          measurement.coverage = Math.min(scores[0].coverage, scores[1].coverage);
        }
        const cost = candidate.cost ?? index.localDistance(ranked.targets, glyphs);
        if (cost === null || !Number.isFinite(measurement.score)) return null;
        return {...measurement, row, weight, cost, family, manual: candidate.manual,
          finalCost: index.resultCost({cost}, measurement.score)};
      }
      const faces = ranked.faces;
      for (const candidate of local) {
        const match = pixels(candidate, candidate.family);
        if (match) {
          localCompared.add(candidate.row.id);
          faces.push({...candidate, cost: match.cost, measured: match});
        }
      }
      const waiting = catalog.filter(r => r.mode === 'local').length - new Set(local.map(f => f.row.id)).size;
      const compared = ranked.compared + localCompared.size;
      const count = {compared, total: catalog.length, missing: waiting, noGlyph: catalog.length - compared - waiting,
        coverageUnknown: ranked.limited};
      function featureOnly(candidate, loadFailed) {
        const loss = Math.min(1, .24 + 1.4 * candidate.cost);
        return {...candidate, family: null, loadFailed, finalCost: index.resultCost(candidate, 1 - loss)};
      }
      async function measure(candidate) {
        if (candidate.measured) return candidate.measured;
        if (!candidate.full || !candidate.url) return featureOnly(candidate, false);
        let family;
        try { family = await loadFace(candidate); } catch { return featureOnly(candidate, true); }
        if (version !== revision) return null;
        return pixels(candidate, family) || featureOnly(candidate, false);
      }
      let updated = 0;
      const active = () => version === revision;
      progress.note(2, compared.toLocaleString() + '종의 획 특징 대조', 'Glyphs compared across ' + compared.toLocaleString() + ' families');
      progress.reach(3);
      progress.note(3, '가까운 후보의 굵기와 윤곽 확인 중', 'Checking weights and outlines of close matches');
      status.textContent = msg('글자 특징 대조 완료 · 원본의 획을 비교하고 있습니다…', 'Glyph features compared. Checking original outlines…');
      const {matches, failed} = await index.finalists(faces, measure, active, (ordered, attempted) => {
        if (!active()) return;
        trimFaces(new Set(ordered.slice(0, 4).map(faceKey)));
        if (Date.now() - updated < 700) return;
        updated = Date.now();
        progress.note(3, '후보 굵기 ' + attempted + '개 확인', 'Checked ' + attempted + ' candidate faces');
      });
      if (!active()) return;
      if (!matches.length) {
        status.textContent = msg('해당 글자의 모양을 대조할 수 없습니다. 다른 한글을 선택해 주세요.', 'No comparable shapes. Please select other Korean text.');
        progress.note(3, '다른 한글을 선택해 주세요.', 'Select a different Korean line.');
        progress.stop('review', '대조할 후보가 없습니다', 'No comparable matches');
        return;
      }
      const leaders = matches.slice(0, 4);
      const raw = leaders.every(m => m.scores && !m.manual);
      const agree = raw && targets.every((line, i) => {
        const scores = leaders.map(m => m.scores[i]).sort((a, b) => b.score - a.score);
        return scores[0] === leaders[0].scores[i] && shapes.isConfident(line, scores, leaders.length);
      });
      const clearColorMatch = !samples.some(sample => sample.isolatedInk) ||
        (leaders.length > 1 && leaders[0].score - leaders[1].score >= .06);
      const confident = ranked.indexed && !failed && agree && clearColorMatch;
      showResults(matches, confident, text, ranked.limited || failed > 0, count);
      showGlyphComparison(matches, lines, targets, samples);
      showAllFamilies(faces, leaders, text, measure, active);
      const top = matches.slice(0, 3);
      progress.note(3, top.map(match => match.row.name).join(' · '));
      progress.finish(top.length);
      if (top.some(m => m.manual)) {
        if (el('publish').checked) el('publish-state').textContent = msg('직접 지정한 후보가 있어 이 기기에만 표시합니다.', 'Results containing a manually assigned original are shown only on this device.');
      } else if (automatic) {
        pendingPost = {matches: top, confident};
        offerPost();
      } else if (publish && el('publish').checked) {
        window.ImageFontBoard?.record(top, confident);
      }
    } catch {
      if (version === revision) {
        status.textContent = '비교 자료를 열 수 없습니다. 다시 시도하세요.';
        progress.stop('error', '대조 자료를 열 수 없습니다', 'Comparison data unavailable', '연결을 확인하고 다시 대조하세요.', 'Check your connection and retry.');
      }
    } finally {
      if (version === revision) el('run').disabled = false;
    }
  }
})();
