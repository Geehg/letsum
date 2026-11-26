// Present real scanner milestones at a readable pace. Results are available as soon as matching finishes.
(() => {
  'use strict';
  const el = id => document.getElementById('im-' + id);
  const scan = el('scan'), glass = el('glass'), rows = [...el('steps').children];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dwell = [1000, 2000, 3000, 4000];
  let visible = 0, reached = 0, since = 0, timer;
  let sourceWidth = 0, sourceHeight = 0;

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
      const ctx = tile.getContext('2d'), mask = ctx.createImageData(tile.width, tile.height);
      for (let p = 0; p < glyph.pixels.length; p++) {
        const i = p * 4;
        mask.data[i] = 194; mask.data[i+1] = 246; mask.data[i+2] = 121;
        mask.data[i+3] = glyph.pixels[p];
      }
      ctx.putImageData(mask, 0, 0);
      tiles.append(tile);
      if (seen.size === 4) break;
    }
    el('ink').replaceChildren(tiles);
  }
  window.ImageFontProgress = {begin, reach, note, enteredText, imageSize, showInk, reset, stop, finish};
})();
