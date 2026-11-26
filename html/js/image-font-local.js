// Local-only catalogue entries can be compared with an installed face or a user-selected original.
(() => {
  'use strict';

  const supplied = new Map();
  let installed;
  const key = (row, weight) => row.id + '/' + weight;
  const msg = (ko, en) => document.documentElement.lang === 'en' ? en : ko;
  function nameKey(name) {
    return name.normalize('NFKC').toLowerCase().replace(/[\s_\-().]/g, '')
      .replace(/(?:semibold|regular|normal|medium|light|bold|레귤러|볼드|라이트)$/u, '');
  }

  function hangulCoverage(data, table) {
    if (!table || table.length < 4) return null;
    const map = new Uint8Array(11172);
    const words = new DataView(data.buffer, table.offset, table.length);
    const count = words.getUint16(2), visited = new Set();
    if (4 + count * 8 > table.length) throw Error('cmap');
    for (let i = 0; i < count; i++) {
      const entry = 4 + i * 8, platform = words.getUint16(entry), encoding = words.getUint16(entry+2);
      if (platform !== 0 && !(platform === 3 && [1,10].includes(encoding))) continue;
      const at = words.getUint32(entry+4);
      if (visited.has(at)) continue;
      visited.add(at);
      const format = words.getUint16(at);
      if (format === 4) {
        const length = words.getUint16(at+2), n = words.getUint16(at+6) >> 1;
        if (at + length > table.length || 16 + 8 * n > length) throw Error('cmap4');
        const ends = at+14, starts = ends+2*n+2, deltas = starts+2*n, ranges = deltas+2*n;
        let previous = -1;
        for (let j = 0; j < n; j++) {
          const start = words.getUint16(starts+2*j), end = words.getUint16(ends+2*j);
          const delta = words.getInt16(deltas+2*j), rangeAt = ranges+2*j, range = words.getUint16(rangeAt);
          if (start <= previous || end < start) throw Error('cmap4 order');
          previous = end;
          for (let code = Math.max(0xac00,start); code <= Math.min(0xd7a3,end); code++) {
            const glyphAt = rangeAt + range + 2*(code-start);
            if (range && glyphAt+2 > at+length) throw Error('cmap4 glyph');
            const base = range ? words.getUint16(glyphAt) : code;
            if (base && ((base+delta)&65535)) map[code-0xac00] = 1;
          }
        }
      } else if (format === 12 || format === 13) {
        const length = words.getUint32(at+4), n = words.getUint32(at+12);
        if (at + length > table.length || 16 + n * 12 > length) throw Error('cmap12');
        let previous = -1;
        for (let j = 0; j < n; j++) {
          const group = at+16+12*j, start = words.getUint32(group), end = words.getUint32(group+4);
          const firstGlyph = words.getUint32(group+8);
          if (start <= previous || end < start) throw Error('cmap12 order');
          previous = end;
          for (let code = Math.max(0xac00,start); code <= Math.min(0xd7a3,end); code++) {
            if (format === 13 ? firstGlyph : firstGlyph+code-start) map[code-0xac00] = 1;
          }
        }
      }
    }
    return map;
  }

  function metadata(buffer) {
    const data = new DataView(buffer);
    const tag = offset => String.fromCharCode(...new Uint8Array(buffer, offset, 4));
    if (data.byteLength < 12 || (data.getUint32(0) !== 0x10000 && tag(0) !== 'OTTO')) throw Error('format');
    const tables = new Map();
    for (let n = 0; n < data.getUint16(4); n++) {
      const record = 12 + n * 16;
      const offset = data.getUint32(record + 8), length = data.getUint32(record + 12);
      if (offset + length > data.byteLength) throw Error('table');
      tables.set(tag(record), {offset, length});
    }
    const table = tables.get('name'), os = tables.get('OS/2');
    if (!table || table.length < 6 || !os || os.length < 6) throw Error('names');
    const names = new Set(), count = data.getUint16(table.offset + 2);
    const strings = data.getUint16(table.offset + 4);
    if (6 + 12 * count > table.length || strings > table.length) throw Error('name table');
    for (let n = 0; n < count; n++) {
      const record = table.offset + 6 + 12 * n, platform = data.getUint16(record);
      if (![0, 1, 3].includes(platform) || ![1, 4, 6, 16, 21].includes(data.getUint16(record + 6))) continue;
      const length = data.getUint16(record + 8), start = strings + data.getUint16(record + 10);
      if (start + length > table.length || length > 1024) continue;
      const codec = platform === 1 ? 'macintosh' : 'utf-16be';
      const text = new TextDecoder(codec).decode(new Uint8Array(buffer, table.offset + start, length));
      if (text.trim()) names.add(text.trim());
    }
    return {names: [...names], weight: data.getUint16(os.offset + 4), coverage: hangulCoverage(data, tables.get('cmap'))};
  }

  function identify(meta, rows) {
    const aliases = new Set(meta.names.map(nameKey).filter(Boolean));
    const found = rows.filter(row => row.aliases.some(alias => aliases.has(nameKey(alias))));
    return found.length === 1 ? found[0] : null;
  }

  async function findInstalled(rows) {
    const found = [];
    const suffixes = {300: ['Light', 'L', '라이트'], 400: ['Regular', 'R', ''], 700: ['Bold', 'B', '볼드']};
    for (const row of rows) {
      for (const w of Object.keys(row.weights)) {
        const names = new Set();
        for (const alias of row.aliases.filter(Boolean)) {
          for (const suffix of suffixes[w] || [w]) {
            if (!suffix) { names.add(alias); continue; }
            names.add(alias + ' ' + suffix);
            names.add(alias.replace(/\s+/g, '') + '-' + suffix);
            names.add(alias.replace(/\s+/g, '') + suffix);
          }
        }
        const source = [...names].map(n => 'local(' + JSON.stringify(n) + ')').join(',');
        let font;
        try {
          font = new FontFace('im-installed-' + row.id + '-' + w, source, {weight: w});
          await font.load();
        } catch { continue; }
        document.fonts.add(font);
        found.push({row, weight: Number(w), family: font.family});
      }
    }
    return found;
  }

  async function available(rows) {
    const local = rows.filter(row => row.mode === 'local');
    if (!installed) installed = findInstalled(local).catch(error => { installed = null; throw error; });
    const faces = new Map((await installed).map(face => [key(face.row, face.weight), face]));
    for (const [k, face] of supplied) faces.set(k, face);
    return [...faces.values()];
  }

  function bind(invalidate) {
    const setLanguage = () => {
      const lang = document.documentElement.lang === 'en' ? 'en' : 'ko';
      document.querySelectorAll('#image-finder [data-ko][data-en]').forEach(node => {
        if (node.textContent !== node.dataset[lang]) node.textContent = node.dataset[lang];
      });
    };
    setLanguage();
    new MutationObserver(setLanguage).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
    const input = document.getElementById('im-originals'), select = document.getElementById('im-original-family');
    const status = document.getElementById('im-original-status'), clear = document.getElementById('im-original-clear');
    let choices, generation = 0;
    function loadChoices() {
      if (!choices) choices = window.ImageFontIndex.catalog().then(rows => {
        const local = rows.filter(row => row.mode === 'local');
        for (const row of local) select.add(new Option(row.name, row.id));
        return local;
      }).catch(error => { choices = null; throw error; });
      return choices;
    }
    document.getElementById('im-original-panel').addEventListener('toggle', e => {
      if (e.currentTarget.open) loadChoices().catch(() => {
        status.textContent = msg('목록을 받을 수 없습니다. 다시 열어 주세요.', 'Reopen to retry the catalogue.');
      });
    });
    clear.onclick = () => {
      generation++;
      invalidate();
      for (const {font} of supplied.values()) document.fonts.delete(font);
      supplied.clear();
      input.value = '';
      clear.hidden = true;
      status.textContent = msg('선택한 원본을 해제했습니다.', 'Selected originals cleared.');
    };
    input.onchange = async () => {
      const files = [...input.files], selected = select.value, token = ++generation;
      input.value = '';
      invalidate();
      const connected = [], rejected = [];
      try {
        const rows = await loadChoices();
        for (const file of files) {
          if (token !== generation) return;
          try {
            const data = await file.arrayBuffer(), meta = metadata(data);
            if (!meta.coverage?.some(Boolean)) throw Error('No Korean glyphs');
            const identified = identify(meta, rows);
            const row = selected ? rows.find(r => r.id === selected) : identified;
            if (!row || (identified && identified.id !== row.id)) throw Error('identity');
            const weight = row.unknownWeights ? Number(Object.keys(row.weights)[0]) : meta.weight;
            if (!Object.hasOwn(row.weights, weight)) throw Error('weight');
            const font = await new FontFace('im-file-' + row.id + '-' + weight, data, {weight: String(weight)}).load();
            if (token !== generation) return;
            const k = key(row, weight);
            if (supplied.has(k)) document.fonts.delete(supplied.get(k).font);
            document.fonts.add(font);
            supplied.set(k, {row, weight, font, family: font.family, coverageTable: meta.coverage, manual: Boolean(selected)});
            connected.push(row.name);
          } catch { rejected.push(file.name); }
        }
        if (token !== generation) return;
        invalidate();
        const notes = [];
        if (connected.length) notes.push(msg('연결한 원본 ', 'Connected ') + [...new Set(connected)].join(', '));
        if (rejected.length) notes.push(msg('이름·굵기·파일 형식 확인 필요 ', 'Check name, weight or file format ') + rejected.join(', '));
        status.textContent = notes.join(' · ');
        clear.hidden = supplied.size === 0;
      } catch {
        if (token === generation) status.textContent = msg('대조 목록을 받을 수 없습니다. 다시 시도하세요.', 'Cannot load the catalogue. Please retry.');
      }
    };
  }

  window.ImageFontLocal = {metadata, identify, available, bind};
})();
