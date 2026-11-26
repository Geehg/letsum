// Run with node --test tools/test_image_font_match.cjs. No font downloads are required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const vm = require('node:vm');

const js = path.join(__dirname, '../html/js');
const context = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(js, 'image-font-shapes.js'), 'utf8'), context);
const {compare, isConfident} = context.window.ImageFontShapes;

function lineShape(firstGlyph, lastGlyph, line) {
  const glyph = (char, pixels) => ({char, pixels, ratio:1, top:0, bottom:1});
  return {pixels:line, ratio:2, distinct:2, minGlyphHeight:30,
    glyphs:[glyph('한',firstGlyph), glyph('글',lastGlyph)]};
}

test('stable syllable shapes outweigh line changes caused by tracking', () => {
  const upright = [0, 255, 0, 255], flat = [255, 255, 0, 0];
  const target = lineShape(upright, flat, [0, 255, 255, 0]);
  const changedSpacing = lineShape(upright, flat, [255, 0, 0, 255]);
  const otherSyllables = lineShape(flat, upright, target.pixels);
  assert.ok(compare(target, changedSpacing).score > compare(target, otherSyllables).score);
});

test('weak, ambiguous or incomplete comparisons only produce alternative suggestions', () => {
  const target = {distinct:4, minGlyphHeight:30};
  const measurements = [0.95,0.61,0.57,0.50].map(score => ({score, glyph:score, coverage:1}));
  assert.equal(isConfident(target, measurements, 4), true);
  assert.equal(isConfident(target, measurements.slice(0,1), 4), false);
  assert.equal(isConfident(target, measurements, 15), false);
  assert.equal(isConfident({...target,distinct:1}, measurements, 4), false);
  assert.equal(isConfident({...target,minGlyphHeight:5}, measurements, 4), false);
  const tie = [measurements[0], {...measurements[0],score:0.94}, ...measurements.slice(2)];
  assert.equal(isConfident(target, tie, 4), false);
});

test('the scanner indexes align with the public catalogue and cover distinct syllables', () => {
  const {gunzipSync} = require('node:zlib');
  const data = path.join(js, '../data');
  const rows = JSON.parse(fs.readFileSync(path.join(data, 'image-fonts.json')));
  const weights = rows.flatMap(row => Object.keys(row.weights).map(w => row.id + '/' + w));
  const syllables = new Set();
  for (const part of ['common', 'extra']) {
    const file = gunzipSync(fs.readFileSync(path.join(data, 'image-font-index-' + part + '.gz')));
    assert.equal(file.toString('ascii', 0, 4), 'LFI2');
    const count = file.readUInt16LE(4);
    assert.equal(file.readUInt16LE(6), weights.length);
    let offset = 8;
    for (let i = 0; i < count; i++, offset += 2) {
      const char = file.readUInt16LE(offset);
      assert.ok(!syllables.has(char));
      syllables.add(char);
    }
    for (const expected of weights) {
      const length = file[offset++];
      const id = file.toString('ascii', offset, offset + length);
      offset += length;
      assert.equal(id + '/' + file.readUInt16LE(offset), expected);
      offset += 2 + 11 * count;
    }
    assert.equal(offset, file.length);
  }
  assert.equal(syllables.size, 2350);
});

test('ranking fetches the supplemental index on demand and retries a failed load', async () => {
  const {gunzipSync} = require('node:zlib');
  const data = path.join(js, '../data');
  const read = part => fs.readFileSync(path.join(data, 'image-font-index-' + part + '.gz'));
  const common = read('common'), extra = read('extra');
  const primary = gunzipSync(common), supplemental = gunzipSync(extra);
  const rows = JSON.parse(fs.readFileSync(path.join(data, 'image-fonts.json')));
  const calls = [];
  let failExtra = true;
  const sandbox = {window:{}, TextDecoder, Response, DecompressionStream, fetch: async url => {
    calls.push(url);
    if (url.includes('-common.gz')) return new Response(common);
    if (!url.includes('-extra.gz')) throw Error('Unexpected request');
    return failExtra ? new Response(null, {status: 503}) : new Response(extra);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(js, 'image-font-index.js'), 'utf8'), sandbox);
  const glyph = (file, offset) => ({char: String.fromCharCode(file.readUInt16LE(offset)), ratio: 1, pixels: new Uint8Array(1280)});
  const target = {glyphs:[glyph(primary, 8), glyph(primary, 10)], minGlyphHeight:30};
  const rank = () => sandbox.window.ImageFontIndex.rank(target, rows);
  assert.equal((await rank()).indexed, true);
  assert.equal(calls.length, 1);
  target.glyphs.push(glyph(supplemental, 8));
  const interrupted = await rank();
  assert.equal(interrupted.glyphCount, 2);
  assert.equal(interrupted.indexed, false);
  failExtra = false;
  assert.equal((await rank()).glyphCount, 3);
  assert.equal((await rank()).indexed, true);
  assert.equal(calls.length, 3);
});
