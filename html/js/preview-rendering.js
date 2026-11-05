/* Display-only rendering controls. Original font files and shaping stay unchanged. */
(() => {
  'use strict';
  const KEY = 'ls_preview_rendering';
  let mode = 'auto';
  try { if (localStorage.getItem(KEY) === 'smooth') mode = 'smooth'; } catch (_) {}
  document.documentElement.dataset.previewRendering = mode;
  const mounted = new WeakSet();
  function setMode(value) {
    mode = value === 'smooth' ? 'smooth' : 'auto';
    document.documentElement.dataset.previewRendering = mode;
    try { localStorage.setItem(KEY, mode); } catch (_) {}
    document.querySelectorAll('[data-pr-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prMode === mode)));
  }
  function controls() {
    const group = document.createElement('div');
    group.className = 'pr-controls'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', '미리보기 렌더링');
    const label = document.createElement('span'); label.textContent = '글자 표시'; group.append(label);
    for (const [value, text] of [['auto', '기본'], ['smooth', '부드럽게']]) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.prMode = value;
      b.textContent = text; b.setAttribute('aria-pressed', String(mode === value));
      b.addEventListener('click', () => setMode(value)); group.append(b);
    }
    return group;
  }
  function attach(source) {
    if (mounted.has(source)) return;
    mounted.add(source);
    const box = document.createElement('section'); box.className = 'pr-panel';
    box.setAttribute('aria-label', '작은 글씨 미리보기'); box.append(controls());
    const note = document.createElement('p'); note.className = 'pr-note';
    note.textContent = '환경에 따라 차이가 없거나 획이 가늘어질 수 있습니다. 픽셀 서체는 배포처 권장 크기로도 비교하세요.'; box.append(note);
    const details = document.createElement('details'); details.className = 'pr-compare';
    const summary = document.createElement('summary'); summary.textContent = '작은 크기 비교 · 12–24px'; details.append(summary);
    const label = document.createElement('label'); label.textContent = '비교 문장';
    const input = document.createElement('input'); input.type = 'text'; input.maxLength = 120;
    input.setAttribute('aria-label', '작은 크기 비교 문장'); input.setAttribute('translate', 'no');
    label.append(input); details.append(label);
    const grid = document.createElement('div'); grid.className = 'pr-grid';
    for (const text of ['크기', '기본', '부드럽게']) { const h = document.createElement('strong'); h.textContent = text; grid.append(h); }
    const examples = [];
    for (const size of [12, 14, 16, 18, 24]) {
      const sizeLabel = document.createElement('span'); sizeLabel.className = 'pr-size'; sizeLabel.textContent = size + 'px'; grid.append(sizeLabel);
      for (const value of ['auto', 'smooth']) {
        const cell = document.createElement('div'); cell.className = 'pr-cell';
        const span = document.createElement('span'); span.className = 'pr-example'; span.dataset.prExample = value;
        span.style.fontSize = size + 'px'; span.setAttribute('translate', 'no'); cell.append(span); grid.append(cell); examples.push(span);
      }
    }
    details.append(grid); box.append(details); source.after(box);
    let edited = false, queued = false;
    function sourceText() {
      const clone = source.cloneNode(true); clone.querySelectorAll('.l').forEach(el => el.remove());
      return clone.textContent.replace(/\s+/g, ' ').trim().slice(0, 120);
    }
    function refresh() {
      queued = false;
      if (!source.isConnected || !details.open) return;
      if (!edited) input.value = sourceText();
      const style = getComputedStyle(source);
      for (const el of examples) {
        for (const key of ['fontFamily', 'fontWeight', 'fontStyle', 'fontStretch', 'fontFeatureSettings', 'fontVariationSettings', 'fontVariantLigatures', 'letterSpacing']) el.style[key] = style[key];
        el.textContent = input.value;
      }
    }
    function schedule() { if (!queued && details.open) { queued = true; requestAnimationFrame(refresh); } }
    details.addEventListener('toggle', schedule);
    input.addEventListener('input', () => { edited = true; schedule(); });
    const observer = new MutationObserver(schedule);
    observer.observe(source, { attributes: true, attributeFilter: ['style', 'class'], childList: true, characterData: true, subtree: true });
    // Release observers when an existing modal is replaced or closed.
    box._prDisconnect = () => observer.disconnect();
  }
  function scan() {
    const weight = document.querySelector('#weightSeg');
    if (weight && !document.querySelector('.pr-global')) { const g = controls(); g.classList.add('pr-global'); weight.closest('.d-tog').after(g); }
    document.querySelectorAll('#pvBig, .fp .sample:not(.db-sample)').forEach(attach);
  }
  function start() {
    scan();
    new MutationObserver(records => {
      let added = false;
      for (const r of records) {
        for (const n of r.removedNodes) if (n.nodeType === 1) {
          if (n._prDisconnect) n._prDisconnect();
          n.querySelectorAll('.pr-panel').forEach(p => p._prDisconnect?.());
        }
        if (r.addedNodes.length) added = true;
      }
      if (added) scan();
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
