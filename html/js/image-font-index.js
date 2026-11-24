// Shortlist real preview faces from a fixed on-device map of Korean glyph features.
// The request for this file is identical for every image and every phrase.
(() => {
  'use strict';

  const featureSize = 11;
  let pendingIndex;

  async function loadIndex() {
    const response = await fetch('/data/image-font-index-v2.bin?v=3');
    if (!response.ok) throw new Error('Cannot load the Korean glyph index');
    const buffer = await response.arrayBuffer();
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
    return {indexed: false, glyphCount: 0,
      faces: list.slice(0, 16).map(row => ({row, weight: 400, url: row.url}))};
  }

  async function rank(target, list) {
    let index;
    try {
      pendingIndex ||= loadIndex();
      index = await pendingIndex;
    } catch {
      pendingIndex = null; // Allow a retry on a later scan.
      return baseline(list);
    }
    const glyphs = new Map();
    const distinctHangul = new Set();
    for (const glyph of target.glyphs || []) {
      if (!/^[가-힣]$/.test(glyph.char)) continue;
      distinctHangul.add(glyph.char);
      if (glyphs.has(glyph.char) || !glyph.pixels || !index.syllables.has(glyph.char)) continue;
      glyphs.set(glyph.char, {column: index.syllables.get(glyph.char), ...glyphFeatures(glyph)});
    }
    if (!glyphs.size) return baseline(list);
    const rows = new Map(list.map(row => [row.id, row]));
    const scored = [];
    for (const face of index.faces) {
      const row = rows.get(face.id);
      const url = row?.weights?.[face.weight];
      if (!url) continue;
      let cost = 0;
      for (const glyph of glyphs.values()) {
        cost += glyphDifference(index.bytes, face.offset + glyph.column * featureSize, glyph);
      }
      scored.push({row, weight: face.weight, url, cost: cost / glyphs.size});
    }
    if (!scored.length) return baseline(list);
    scored.sort((a,b) => a.cost-b.cost);
    // Keep distinct families in contention, then verify alternate weights of those families.
    const smallSample = target.minGlyphHeight < 20;
    const familyLimit = smallSample ? 16 : 10;
    const faceLimit = smallSample ? 20 : 13;
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
    return {faces, indexed: glyphs.size >= 2 && glyphs.size * 2 >= distinctHangul.size, glyphCount: glyphs.size};
  }

  window.ImageFontIndex = {rank};
})();
