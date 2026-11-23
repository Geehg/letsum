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
