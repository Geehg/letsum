// Present real scanner milestones at a readable pace. Results are available as soon as matching finishes.
(() => {
  'use strict';
  const el = id => document.getElementById('im-' + id);
  const scan = el('scan'), glass = el('glass'), rows = [...el('steps').children];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dwell = [1000, 2000, 3000, 0];
  let visible = 0, reached = 0, since = 0, timer;
  let sourceWidth = 0, sourceHeight = 0;
  let work, workTimer, clockTimer;

  function label(node, ko, en = ko) {
    node.dataset.ko = ko;
    node.dataset.en = en;
    node.textContent = document.documentElement.lang === 'en' ? en : ko;
  }
  function note(step, ko, en) { label(rows[step].querySelector('small'), ko, en); }

  function paint(step) {
    visible = step;
    since = performance.now();
    scan.dataset.step = String(step);
    rows.forEach((row, i) => {
      row.dataset.mark = i < step ? 'done' : i === step ? 'current' : 'pending';
      if (i === step) row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
    });
    if (step === rows.length) label(el('scan-title'), '분석 완료', 'Scan complete');
  }
  function advanceDisplay() {
    clearTimeout(timer);
    if (visible >= reached) return;
    const wait = dwell[visible] - (performance.now() - since);
    if (wait > 0 && !reduced.matches && !document.hidden) {
      timer = setTimeout(advanceDisplay, Math.ceil(wait));
      return;
    }
    paint(visible + 1);
    advanceDisplay();
  }
  function reset() {
    clearTimeout(timer);
    clearWork();
    reached = -1;
    paint(-1);
    scan.hidden = glass.hidden;
    scan.dataset.state = 'idle';
    label(el('scan-title'), '문구 확인', 'Review text');
    label(rows[1].querySelector('b'), '한글 읽기', 'Read Korean text');
    for (const step of [1, 2, 3]) note(step, '');
    el('ink').replaceChildren();
    el('boxes').replaceChildren();
    el('ready').hidden = el('fix').hidden = el('cancel').hidden = true;
  }
  function begin(step) {
    reset();
    scan.hidden = false;
    scan.dataset.state = 'running';
    label(el('scan-title'), '이미지 분석 중', 'Scanning image');
    el('cancel').hidden = false;
    reached = step;
    paint(step);
  }
  function reach(step) {
    if (scan.dataset.state !== 'running') begin(step);
    else if (step === 3) { clearTimeout(timer); reached = step; paint(step); }
    else { reached = Math.max(reached, step); advanceDisplay(); }
  }
  function imageSize(width, height) {
    glass.hidden = !width;
    sourceWidth = width; sourceHeight = height;
    if (width) {
      glass.style.setProperty('--im-aspect', width / height);
      glass.style.setProperty('--im-ideal', Math.round(width * 2.25) + 'px');
    }
    note(0, width ? width.toLocaleString() + ' × ' + height.toLocaleString() + ' px' : '');
  }
  function enteredText(text) {
    begin(1);
    label(rows[1].querySelector('b'), '입력 문구 확인', 'Use entered text');
    note(1, text);
  }
  function stop(state, ko, en, detailKo, detailEn) {
    clearTimeout(timer);
    clearWork();
    reached = Math.max(0, Math.min(reached, 3));
    paint(reached);
    if (detailKo) note(reached, detailKo, detailEn);
    scan.hidden = false;
    scan.dataset.state = state;
    label(el('scan-title'), ko, en);
    el('fix').hidden = state !== 'review' || glass.hidden;
    el('ready').hidden = el('cancel').hidden = true;
  }
  function finish(count) {
    if (work) {
      work.done = true;
      clearInterval(clockTimer);
      clearTimeout(workTimer);
      renderWork();
    }
    scan.dataset.state = 'ready';
    label(el('scan-title'), '분석 과정', 'Scan breakdown');
    label(el('ready'), '후보 ' + count + '개 보기 ↓', 'View matches (' + count + ') ↓');
    el('cancel').hidden = el('fix').hidden = true;
    el('ready').hidden = false;
    reached = rows.length;
    advanceDisplay();
  }
  el('ready').addEventListener('click', event => {
    event.preventDefault();
    clearTimeout(timer);
    paint(reached);
    el('results').focus({preventScroll: true});
    el('results').scrollIntoView({block: 'start'});
  });
  el('fix').addEventListener('click', event => {
    event.preventDefault();
    el('text').focus();
  });
  reduced.addEventListener('change', advanceDisplay);
  document.addEventListener('visibilitychange', advanceDisplay);

  function clearWork() {
    clearInterval(clockTimer);
    clearTimeout(workTimer);
    workTimer = work = null;
    el('work').hidden = el('work-pair').hidden = true;
    el('work-bar').removeAttribute('value');
  }
  function scheduleWork() {
    if (!workTimer) workTimer = setTimeout(renderWork, 100);
  }
  function updateWork(snapshot) {
    if (scan.dataset.state !== 'running' || reached !== 3) return;
    const now = performance.now();
    const first = !work;
    if (first) {
      work = {start: now, lastCompletion: now, completed: 0};
      el('work').hidden = false;
      clockTimer = setInterval(scheduleWork, 1000);
    }
    if (snapshot.completed > work.completed) work.lastCompletion = now;
    Object.assign(work, snapshot);
    if (first) renderWork();
    else scheduleWork();
  }
  function showOutline(source, candidate, face) {
    if (!work) return;
    work.pair = {source, candidate, face};
    scheduleWork();
  }
  function drawMask(tile, pixels, r, g, b) {
    const ctx = tile.getContext('2d'), mask = ctx.createImageData(32, 40);
    for (let p = 0; p < pixels.length; p++) {
      const i = p * 4;
      mask.data[i] = r; mask.data[i+1] = g; mask.data[i+2] = b; mask.data[i+3] = pixels[p];
    }
    ctx.putImageData(mask, 0, 0);
  }
  function renderWork() {
    workTimer = null;
    if (!work) return;
    const {completed, limit, inFlight, done, pair} = work;
    const now = performance.now(), elapsed = (now - work.start) / 1000, seconds = Math.floor(elapsed);
    const bar = el('work-bar');
    let ko = completed + '개 굵기 대조', en = completed + ' weights checked';
    if (done) { ko += ' 완료'; en += ' · complete'; }
    else if (limit !== null) { ko += ' / 최대 ' + limit + '개'; en += ' / up to ' + limit; }
    label(el('work-count'), ko, en);
    if (done || limit > 0) {
      bar.value = done ? 100 : Math.min(99, Math.floor(100 * completed / limit));
      el('work-percent').textContent = bar.value + '%';
    } else {
      bar.removeAttribute('value');
      el('work-percent').textContent = '';
    }
    const face = inFlight[0];
    const rest = inFlight.length - 1;
    if (face && !done) {
      const name = face.row.name + ' ' + face.weight;
      label(el('work-active'), name + (rest > 0 ? ' 외 ' + rest + '개' : '') + ' 대조 중',
        'Comparing ' + name + (rest > 0 ? ' +' + rest : ''));
    } else label(el('work-active'), done ? '' : '후보 순위 계산 중', done ? '' : 'Ranking candidates');
    let timeKo = '경과 ' + seconds + '초', timeEn = seconds + 's elapsed';
    if (!done && now - work.lastCompletion > 4500 && face) {
      timeKo += ' · 원본 응답 대기'; timeEn += ' · awaiting originals';
    } else if (!done && limit > completed && completed >= 4 && elapsed >= 1) {
      const remaining = Math.max(1, Math.ceil(elapsed * (limit - completed) / completed));
      timeKo += ' · 약 ' + remaining + '초 남음'; timeEn += ' · ~' + remaining + 's left';
    } else if (!done && face) {
      timeKo += ' · 남은 시간 계산 중'; timeEn += ' · estimating time';
    }
    label(el('work-time'), timeKo, timeEn);
    if (pair) {
      drawMask(el('work-source'), pair.source.pixels, 240, 245, 241);
      drawMask(el('work-ref'), pair.candidate.pixels, 194, 246, 121);
      el('work-face').textContent = pair.face.row.name + ' ' + pair.face.weight + ' · ' + pair.source.char;
      el('work-pair').hidden = false;
      work.pair = null;
    }
  }

  // These are the scanner's actual 32 × 40 normalized ink masks, including antialiasing.
  function showInk(glyphs) {
    const markers = document.createDocumentFragment();
    for (const {box} of glyphs.slice(0, 20)) {
      const marker = document.createElement('span');
      marker.style.left = 100 * box.x / sourceWidth + '%';
      marker.style.top = 100 * box.y / sourceHeight + '%';
      marker.style.width = 100 * box.w / sourceWidth + '%';
      marker.style.height = 100 * box.h / sourceHeight + '%';
      markers.append(marker);
    }
    el('boxes').replaceChildren(markers);
    const tiles = document.createDocumentFragment(), seen = new Set();
    for (const glyph of glyphs) {
      if (seen.has(glyph.char)) continue;
      seen.add(glyph.char);
      const tile = document.createElement('canvas');
      tile.width = 32; tile.height = 40;
      drawMask(tile, glyph.pixels, 194, 246, 121);
      tiles.append(tile);
      if (seen.size === 4) break;
    }
    el('ink').replaceChildren(tiles);
  }
  window.ImageFontProgress = {begin, reach, note, enteredText, imageSize, showInk, updateWork, showOutline, reset, stop, finish};
})();
