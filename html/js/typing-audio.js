/* Recorded Foley only. Sources and edits: /data/typing/audio/credits.html. */
(() => {
  'use strict';
  const main = document.getElementById('tbMain'), input = document.getElementById('tbInput');
  if (!main || !input) return;
  const base = '/data/typing/audio/', names = ['key-1','key-2','key-3','key-4','key-5','key-6','space','bell','return','paper'];
  // Measured attack offsets in the decoded recordings; preserve the natural tails.
  const attack = {'key-1':.028,'key-2':.020,'key-3':.034,'key-4':.030,'key-5':.020,'key-6':.038,space:.008,bell:.006,return:.050,paper:.012};
  const raw = new Map(), buffers = new Map(), voices = new Set();
  let context, master, loading, decoding, enabled = true, volume = .38, keyIndex = -1;
  let lastValue = input.value, lastLine = null, composing = false, compositionHardware = false, physicalAt = -Infinity, warned = false;
  const active = () => enabled && volume > 0 && main.dataset.skin === 'retro' && !document.hidden;
  const now = () => performance.now();
  function status(value) { main.dataset.typewriterAudio = value; }
  async function preload() {
    if (loading) return loading;
    status('loading');
    loading = Promise.all(names.map(async name => {
      if (raw.has(name)) return;
      const r = await fetch(base + name + '.mp3?v=1');
      if (!r.ok) throw new Error('Recorded sound unavailable: ' + name);
      raw.set(name, await r.arrayBuffer());
    })).then(() => status('loaded')).catch(() => { status('error'); loading = null; });
    return loading;
  }
  function ensureContext() {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)({latencyHint:'interactive'});
      master = context.createGain(); master.gain.value = volume;
      master.connect(context.destination);
    }
  }
  function prepare() {
    if (!active()) return;
    try {
      ensureContext(); // Decode ahead of typing, even while autoplay keeps the context suspended.
      if (buffers.size === names.length || decoding) return;
      decoding = (async () => {
        await preload();
        await Promise.all(names.map(async name => {
          if (!buffers.has(name) && raw.has(name)) buffers.set(name, await context.decodeAudioData(raw.get(name).slice(0)));
        }));
        status(buffers.size === names.length ? 'ready' : 'error');
      })().catch(() => status('error')).finally(() => { decoding = null; });
    } catch (_) { status('error'); }
  }
  function unlock() {
    if (!active()) return;
    prepare();
    if (context && context.state !== 'running') context.resume().catch(() => status('error'));
  }
  function stop() {
    for (const source of voices) { try { source.stop(); } catch (_) {} }
    voices.clear();
  }
  function configure(settings) {
    enabled = !!settings.sound; volume = Math.max(0, Math.min(1, Number(settings.volume) / 100 || 0));
    if (master) master.gain.setValueAtTime(volume, context.currentTime);
    if (!active()) stop(); else prepare();
  }
  function play(name, gain = 1) {
    if (!active()) return;
    const buffer = buffers.get(name);
    // The hot path is synchronous. Cold/interrupted audio is prepared for the next
    // action, never queued to play late after a load/resume or in a burst.
    if (!buffer || context?.state !== 'running') { unlock(); return; }
    if (voices.size >= 18) { const oldest = voices.values().next().value; oldest.stop(); voices.delete(oldest); }
    const source = context.createBufferSource(), level = context.createGain();
    source.buffer = buffer; level.gain.value = gain;
    source.connect(level).connect(master); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); level.disconnect(); };
    source.start(context.currentTime, attack[name] || 0);
  }
  function keySound(key) {
    if (key === 'Enter') return;
    if (key === ' ' || key === 'Backspace' || key === 'Delete') { play('space', key === ' ' ? .75 : .5); return; }
    // Distinct recorded strikes; do not transpose or generate noise.
    keyIndex = (keyIndex + 1 + Math.floor(Math.random() * 5)) % 6;
    play('key-' + (keyIndex + 1), .85);
  }
  function lineReturn() {
    if (!warned) play('bell', .42);
    play('return', .72);
    warned = false;
  }
  function inserted(before, after) {
    let a = 0, b = before.length, c = after.length;
    while (a < b && a < c && before[a] === after[a]) a++;
    while (b > a && c > a && before[b-1] === after[c-1]) { b--; c--; }
    return after.slice(a, c);
  }
  function position() {
    const caret = Array.from(input.value.slice(0, input.selectionStart).normalize('NFC')).length;
    if (main.dataset.readingMode === 'immersive') {
      const host = document.getElementById('tbOrig');
      const span = host.querySelector('[data-index="' + caret + '"]') || host.lastElementChild;
      if (span) {
        const r = span.getBoundingClientRect(), box = host.getBoundingClientRect();
        if (box.width > 0) return {row:span.offsetTop, ratio:Math.max(0,(r.left-box.left)/box.width)};
      }
    }
    // Textarea fallback: measure its actual font, inner width and explicit newlines.
    const style = getComputedStyle(input), width = input.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = style.font || style.fontSize + ' ' + style.fontFamily;
    let row = 0, x = 0;
    for (const ch of input.value.slice(0, input.selectionStart)) {
      if (ch === '\n') { row++; x = 0; continue; }
      const w = measure.measureText(ch).width;
      if (width > 0 && x + w > width && x) { row++; x = 0; }
      x += w;
    }
    return {row,ratio:width > 0 ? x/width : 0};
  }
  function reset() { lastValue = input.value; lastLine = position(); warned = false; composing = false; }
  function changed() {
    const value = input.value;
    if (composing || value === lastValue) return;
    const addition = inserted(lastValue,value), line = position(), grew = value.length > lastValue.length;
    if (active() && addition && grew) {
      // A physical Korean keystroke already sounded; composition commit must not strike twice.
      if (now() - physicalAt > 120 && !addition.includes('\n')) keySound(addition === ' ' ? ' ' : 'x');
      if (addition.includes('\n') || (lastLine && line.row > lastLine.row)) lineReturn();
      else if (line.ratio >= .86 && !warned) { play('bell', .42); warned = true; }
    }
    if (!grew) warned = false;
    lastValue = value; lastLine = line;
  }
  input.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') { physicalAt = now(); unlock(); return; }
    if (e.key.length === 1 || ['Backspace','Delete','Process','Unidentified'].includes(e.key)) {
      physicalAt = now(); if (composing) compositionHardware = true; keySound(e.code === 'Space' ? ' ' : e.code === 'Backspace' ? 'Backspace' : e.key);
    }
  });
  input.addEventListener('compositionstart', () => { composing = true; compositionHardware = false; });
  input.addEventListener('compositionend', () => { composing = false; if (compositionHardware) physicalAt = now(); changed(); });
  input.addEventListener('input', changed);
  input.addEventListener('click', () => { lastLine = position(); unlock(); });
  input.addEventListener('keyup', e => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) lastLine = position(); });
  input.addEventListener('tb:page-changing', () => { stop(); play('paper', .75); });
  input.addEventListener('tb:page-loaded', e => { if (!e.detail?.changed) stop(); reset(); });
  input.addEventListener('tb:audio-reset', reset);
  input.addEventListener('focus', unlock);
  document.addEventListener('pointerdown', () => { if (active()) unlock(); }, {passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('blur', stop);
  new MutationObserver(() => { stop(); reset(); if (active()) prepare(); }).observe(main, {attributes:true, attributeFilter:['data-skin','data-reading-mode']});
  new ResizeObserver(() => { lastLine = position(); }).observe(input);
  window.LSTypewriterAudio = {configure, preview:() => keySound('x')};
})();
