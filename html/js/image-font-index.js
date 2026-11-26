// On-device comparison against the complete Korean font catalogue.
(() => {
  'use strict';

  const featureSize = 27;
  const version = '8';
  const pending = new Map();
  let catalogPromise, inflaterPromise;

  function catalog() {
    if (!catalogPromise) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      catalogPromise = fetch('/data/image-fonts.json?v=' + version, {credentials: 'omit', cache: 'no-cache', signal: controller.signal})
        .then(response => {
          if (!response.ok) throw new Error('Cannot load the font catalogue');
          return response.json();
        }).catch(error => { catalogPromise = null; throw error; }).finally(() => clearTimeout(timer));
    }
    return catalogPromise;
  }

  async function decompress(blob) {
    if (typeof DecompressionStream === 'function') {
      return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
    if (!inflaterPromise) inflaterPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/js/vendor/image-scan/pako-inflate-2.1.0.min.js';
      script.onload = () => window.pako?.ungzip ? resolve(window.pako.ungzip) : reject(Error('Inflater unavailable'));
      script.onerror = () => reject(Error('Cannot load inflater'));
      document.head.append(script);
    }).catch(error => { inflaterPromise = null; throw error; });
    const ungzip = await inflaterPromise;
    const bytes = ungzip(new Uint8Array(await blob.arrayBuffer()));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  async function loadBlock(revision, block) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    let blob;
    try {
      const response = await fetch('/data/image-font-grid/' + revision + '/' + block + '.gz', {signal: controller.signal});
      if (!response.ok) throw Error('Cannot load glyph features');
      blob = await response.blob();
    } finally { clearTimeout(timer); }
    // Some hosts deliver the already decoded file through Content-Encoding: gzip.
    const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    const data = signature[0] === 0x1f && signature[1] === 0x8b
      ? await decompress(blob) : await blob.arrayBuffer();
    const bytes = new Uint8Array(data), view = new DataView(data);
    const stamp = Array.from(bytes.subarray(12, 28), b => b.toString(16).padStart(2, '0')).join('');
    if (new TextDecoder().decode(bytes.subarray(0, 4)) !== 'LFI3' ||
        stamp !== revision || view.getUint16(10, true) !== featureSize) throw Error('Incompatible glyph index');
    const start = view.getUint16(4, true), count = view.getUint16(6, true), faces = view.getUint16(8, true);
    if (28 + count * faces * featureSize !== bytes.length) throw Error('Incomplete glyph index');
    return {bytes, start, count, faces};
  }

  function getBlock(revision, block) {
    const key = revision + '/' + block;
    if (pending.has(key)) {
      const entry = pending.get(key);
      pending.delete(key);
      pending.set(key, entry);
      return entry;
    }
    const entry = loadBlock(revision, block).catch(error => {
      if (pending.get(key) === entry) pending.delete(key);
      throw error;
    });
    pending.set(key, entry);
    // A long phrase on a phone must not keep the entire catalogue in memory.
    if (pending.size > 4) pending.delete(pending.keys().next().value);
    return entry;
  }

  const pairs = [];
  for (const y of [0, 2, 5, 7]) for (const x of [0, 2, 4, 6]) {
    const cell = 8 * y + x;
    pairs.push([cell, cell+1], [cell+8, cell+16], [cell, cell+17], [cell+1, cell+16]);
  }
  const bitCounts = Uint8Array.from({length: 256}, (_, n) => n.toString(2).replace(/0/g, '').length);

  function glyphFeatures(glyph) {
    // Average each 8×8 tile of the 32×40 tight ink mask, preserving inside spaces.
    const cells = new Float32Array(20), tiles = new Float32Array(80);
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 32; x++) {
        const ink = glyph.pixels[y * 32 + x];
        cells[(y >> 3) * 4 + (x >> 3)] += ink / (64 * 17);
        tiles[(y >> 2) * 8 + (x >> 2)] += ink / 16;
      }
    }
    const edges = new Uint8Array(16);
    pairs.forEach(([a, b], i) => {
      const difference = tiles[a] - tiles[b], flag = 1 << (i % 8);
      if (difference > 24) edges[i >> 3] |= flag;
      if (difference < -24) edges[8 + (i >> 3)] |= flag;
    });
    return {cells, edges, ratio: Math.max(1, Math.min(255, 128 + 48 * Math.log2(glyph.ratio)))};
  }

  function glyphDifference(bytes, start, target) {
    if (!bytes[start]) return 1;
    const ratioDifference = Math.min(1, Math.abs(bytes[start] - target.ratio) / 96);
    let cellDifference = 0;
    for (let i = 0; i < 10; i++) {
      const packed = bytes[start + 1 + i];
      cellDifference += Math.abs((packed >> 4) - target.cells[2 * i]);
      cellDifference += Math.abs((packed & 15) - target.cells[2 * i + 1]);
    }
    let edges = 0;
    for (let i = 0; i < 16; i++) edges += bitCounts[bytes[start + 11 + i] ^ target.edges[i]];
    return .60 * (.9 * cellDifference / 300 + .1 * ratioDifference) + .40 * edges / 128;
  }

  function featureDistance(left, right) {
    const ratio = Math.min(1, Math.abs(left.ratio - right.ratio) / 96);
    let distance = 0;
    for (let i = 0; i < left.cells.length; i++) distance += Math.abs(left.cells[i] - right.cells[i]);
    let edges = 0;
    for (let i = 0; i < 16; i++) edges += bitCounts[left.edges[i] ^ right.edges[i]];
    return .60 * (.9 * distance / 300 + .1 * ratio) + .40 * edges / 128;
  }

  function localDistance(glyphs, references, allowPartial = false) {
    const reference = new Map(references.filter(g => g.pixels).map(g => [g.char, glyphFeatures(g)]));
    let cost = 0, covered = 0;
    for (const [char, features] of glyphs) {
      if (!reference.has(char)) {
        if (!allowPartial) return null;
        cost += 1;
        continue;
      }
      covered++;
      cost += featureDistance(features, reference.get(char));
    }
    return covered ? cost / glyphs.size : null;
  }

  async function rank(target, list, active = () => true, progress = () => {}) {
    const chars = new Set(), targets = new Map();
    for (const glyph of target.glyphs || []) {
      if (!/^[가-힣]$/.test(glyph.char)) continue;
      chars.add(glyph.char);
      if (glyph.pixels && !targets.has(glyph.char)) targets.set(glyph.char, glyphFeatures(glyph));
    }
    const manifest = list.filter(row => row.mode !== 'local');
    const faces = manifest.flatMap(row => Object.entries(row.weights).map(([weight, url]) =>
      ({row, weight: Number(weight), url})));
    if (!targets.size) return {faces: [], glyphCount: 0, targets, compared: 0, indexed: false};
    const index = list[0]?.shapeIndex;
    if (!index || !/^[0-9a-f]{32}$/.test(index.revision) || index.characters.length !== 11172 ||
        index.blockSize !== 128) throw Error('Missing full catalogue index');
    const groups = new Map();
    for (const [char, features] of targets) {
      const slot = index.characters.indexOf(char);
      if (slot < 0) throw Error('Invalid Hangul coverage');
      const block = Math.floor(slot / index.blockSize);
      if (!groups.has(block)) groups.set(block, []);
      groups.get(block).push({slot, features});
    }
    const costs = new Float64Array(faces.length), covered = new Uint8Array(faces.length);
    let glyphCount = 0, limited = false, blockNumber = 0;
    for (const [block, items] of groups) {
      if (!active()) throw Error('Stopped');
      progress(++blockNumber, groups.size);
      let part;
      try { part = await getBlock(index.revision, block); } catch { limited = true; continue; }
      if (part.faces !== faces.length || part.start !== block * index.blockSize ||
          part.count !== Math.min(index.blockSize, index.characters.length - part.start)) throw Error('Mismatched glyph index');
      for (const {slot, features} of items) {
        let offset = 28 + (slot - part.start) * featureSize;
        for (let i = 0; i < faces.length; i++, offset += part.count * featureSize) {
          if (part.bytes[offset]) covered[i]++;
          costs[i] += glyphDifference(part.bytes, offset, features);
        }
        glyphCount++;
      }
    }
    if (!glyphCount) throw Error('Missing comparison data');
    const scored = [];
    for (const [i, face] of faces.entries()) {
      // A font with no ink for any tested syllable did not provide a visual comparison.
      if (covered[i]) scored.push({...face, cost: costs[i] / glyphCount, full: covered[i] === glyphCount});
    }
    const compared = new Set(scored.map(f => f.row.id)).size;
    const indexed = !limited && glyphCount >= 2 && glyphCount * 2 >= chars.size;
    return {faces: scored, targets, limited, indexed, glyphCount, compared};
  }

  // Each face's feature distance is a lower bound on its final cost. The exact pixel
  // comparison only adds a nonnegative penalty, so a face outside the bound cannot
  // change the first three families. There is no fixed limit on contenders or weights.
  const pixelWeight = .045;
  function resultCost(face, score) {
    return face.cost + pixelWeight * (1 - Math.min(1, Math.max(0, score)));
  }
  async function finalists(faces, measure, active, progress) {
    const best = new Map();
    const sorted = faces.slice().sort((a, b) => a.cost - b.cost);
    let threshold = Infinity, attempted = 0, failed = 0;
    const order = (a, b) => a.finalCost - b.finalCost || a.row.id.localeCompare(b.row.id) || a.weight - b.weight;
    for (let i = 0; i < sorted.length && active() && sorted[i].cost <= threshold; i += 3) {
      const batch = sorted.slice(i, i + 3).filter(face => face.cost <= threshold);
      const checked = await Promise.all(batch.map(measure));
      if (!active()) break;
      for (const match of checked) {
        attempted++;
        if (!match) continue;
        if (match.loadFailed) failed++;
        const previous = best.get(match.row.id);
        if (!previous || order(match, previous) < 0) best.set(match.row.id, match);
      }
      const ordered = [...best.values()].sort(order);
      if (ordered.length >= 4) threshold = ordered[3].finalCost;
      progress(ordered, attempted);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return {matches: [...best.values()].sort(order), attempted, failed};
  }

  window.ImageFontIndex = {catalog, rank, localDistance, resultCost, finalists};
})();
