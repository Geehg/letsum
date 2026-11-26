// Shortlist real preview faces from a fixed on-device map of Korean glyph features.
// Two fixed assets cover 2,350 syllables. No request contains the input text or image.
(() => {
  'use strict';

  const featureSize = 11;
  const files = {
    common: '/data/image-font-index-common.gz?v=1',
    extra: '/data/image-font-index-extra.gz?v=1',
    legacy: '/data/image-font-index-v2.bin?v=5'
  };
  const pending = new Map();
  let catalogPromise;

  function catalog() {
    if (!catalogPromise) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      catalogPromise = fetch('/data/image-fonts.json?v=6', {credentials: 'omit', signal: controller.signal})
        .then(response => {
          if (!response.ok) throw new Error('Cannot load the font catalogue');
          return response.json();
        }).catch(error => { catalogPromise = null; throw error; }).finally(() => clearTimeout(timer));
    }
    return catalogPromise;
  }

  async function loadIndex(part) {
    const response = await fetch(files[part]);
    if (!response.ok) throw new Error('Cannot load the Korean glyph index');
    const blob = await response.blob();
    const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    // A host may already have sent Content-Encoding: gzip and the browser decoded it.
    const buffer = signature[0] === 0x1f && signature[1] === 0x8b
      ? await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      : await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const decoder = new TextDecoder();
    if (decoder.decode(bytes.subarray(0,4)) !== 'LFI2') throw new Error('Unsupported glyph index');
    const syllableCount = view.getUint16(4, true);
    const faceCount = view.getUint16(6, true);
    let offset = 8;
    const syllables = new Map();
    for (let column = 0; column < syllableCount; column++) {
      syllables.set(String.fromCharCode(view.getUint16(offset, true)), column);
      offset += 2;
    }
    const faces = [];
    for (let face = 0; face < faceCount; face++) {
      const length = bytes[offset++];
      const id = decoder.decode(bytes.subarray(offset, offset + length));
      offset += length;
      const weight = view.getUint16(offset, true);
      offset += 2;
      faces.push({id, weight, offset});
      offset += featureSize * syllableCount;
    }
    if (offset !== bytes.length) throw new Error('Incomplete glyph index');
    return {bytes, syllables, faces};
  }

  function getIndex(part) {
    if (!pending.has(part)) {
      pending.set(part, loadIndex(part).catch(error => {
        pending.delete(part); // A later scan can retry a failed request.
        throw error;
      }));
    }
    return pending.get(part);
  }

  function glyphFeatures(glyph) {
    // Average each 8×8 tile of the 32×40 tight ink mask, preserving inside spaces.
    const cells = new Float32Array(20);
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 32; x++) {
        cells[(y >> 3) * 4 + (x >> 3)] += glyph.pixels[y * 32 + x] / (64 * 17);
      }
    }
    return {cells, ratio: Math.max(1, Math.min(255, 128 + 48 * Math.log2(glyph.ratio)))};
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
    return 0.9 * cellDifference / 300 + 0.1 * ratioDifference;
  }

  function baseline(list) {
    return {indexed: false, glyphCount: 0, limited: true,
      faces: list.slice(0, 16).map(row => {
        const weight = Object.keys(row.weights).find(w => row.weights[w] === row.url);
        return {row, weight: Number(weight), url: row.url};
      })};
  }

  async function rank(target, list) {
    const chars = new Set(), targets = new Map();
    for (const glyph of target.glyphs || []) {
      if (!/^[가-힣]$/.test(glyph.char)) continue;
      chars.add(glyph.char);
      if (glyph.pixels && !targets.has(glyph.char)) targets.set(glyph.char, glyphFeatures(glyph));
    }
    if (!targets.size) return baseline(list);

    let index, extra, limited = false;
    try {
      index = await getIndex('common');
      if ([...targets.keys()].some(char => !index.syllables.has(char))) {
        try {
          extra = await getIndex('extra');
          if (extra.faces.length !== index.faces.length || extra.faces.some((f, i) =>
            f.id !== index.faces[i].id || f.weight !== index.faces[i].weight)) {
            throw new Error('Mismatched glyph indexes');
          }
        } catch {
          extra = null;
          limited = true;
        }
      }
    } catch {
      // Older browsers and interrupted downloads can still use the original comparison set.
      try { index = await getIndex('legacy'); } catch { return baseline(list); }
      limited = true;
    }

    const glyphs = [];
    for (const [char, features] of targets) {
      const part = index.syllables.has(char) ? index : extra;
      const column = part?.syllables.get(char);
      if (column !== undefined) glyphs.push({part, column, features});
    }
    if (!glyphs.length) return baseline(list);
    const rows = new Map(list.map(row => [row.id, row]));
    const scored = [];
    for (const [i, face] of index.faces.entries()) {
      const row = rows.get(face.id);
      const url = row?.weights?.[face.weight];
      if (!url) continue;
      let cost = 0;
      for (const {part, column, features} of glyphs) {
        cost += glyphDifference(part.bytes, part.faces[i].offset + column * featureSize, features);
      }
      scored.push({row, weight: face.weight, url, cost: cost / glyphs.length});
    }
    if (!scored.length) return baseline(list);
    scored.sort((a,b) => a.cost-b.cost);
    // Keep distinct families in contention, then verify alternate weights of those families.
    const smallSample = target.minGlyphHeight < 20;
    const familyLimit = smallSample ? 24 : 12;
    const faceLimit = smallSample ? 30 : 16;
    const families = new Set();
    const faces = [];
    for (const face of scored) {
      if (families.has(face.row.id)) continue;
      families.add(face.row.id);
      faces.push(face);
      if (faces.length === familyLimit) break;
    }
    const bestFaces = new Set(faces);
    for (const face of scored) {
      if (!families.has(face.row.id) || bestFaces.has(face)) continue;
      if (faces.length >= faceLimit) break;
      faces.push(face);
    }
    return {faces, limited, indexed: !limited && glyphs.length >= 2 && glyphs.length * 2 >= chars.size, glyphCount: glyphs.length};
  }

  window.ImageFontIndex = {catalog, rank};
})();
