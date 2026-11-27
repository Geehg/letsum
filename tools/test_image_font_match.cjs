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

test('every Korean catalogue family has a comparison method and blocks cover every modern syllable', () => {
  const {gunzipSync} = require('node:zlib');
  const data = path.join(js, '../data');
  const rows = JSON.parse(fs.readFileSync(path.join(data, 'image-fonts.json')));
  const catalogue = vm.runInNewContext(fs.readFileSync(path.join(js, 'data.js'), 'utf8') + '\n; FONTS.map(f => f.id)');
  assert.deepEqual(rows.map(r => r.id).sort(), Array.from(catalogue).sort());
  const indexed = rows.filter(row => row.mode !== 'local');
  for (const row of rows.filter(r => r.mode)) {
    assert.ok(row.source);
    assert.ok(!row.url && Object.values(row.weights).every(url => url === null));
    assert.ok(row.mode === 'local' ? row.aliases.length : row.specimen);
  }
  const count = indexed.reduce((sum, r) => sum + Object.keys(r.weights).length, 0);
  const {characters, revision, blockSize} = rows[0].shapeIndex;
  assert.equal(new Set(characters).size, 11172);
  assert.ok([...characters].every(c => c >= '가' && c <= '힣'));
  for (let start = 0; start < characters.length; start += blockSize) {
    const filename = Math.floor(start / blockSize) + '.gz';
    const file = gunzipSync(fs.readFileSync(path.join(data, 'image-font-grid', revision, filename)));
    const length = Math.min(blockSize, characters.length - start);
    assert.equal(file.toString('ascii', 0, 4), 'LFI3');
    assert.equal(file.readUInt16LE(4), start);
    assert.equal(file.readUInt16LE(6), length);
    assert.equal(file.readUInt16LE(8), count);
    assert.equal(file.readUInt16LE(10), 27);
    assert.equal(file.subarray(12, 28).toString('hex'), revision);
    assert.equal(file.length, 28 + length * 27 * count);
  }
});

test('on-demand blocks compare every available family, retry failures and avoid a false full result', async () => {
  const data = path.join(js, '../data');
  const rows = JSON.parse(fs.readFileSync(path.join(data, 'image-fonts.json')));
  const {characters, revision, blockSize} = rows[0].shapeIndex;
  const calls = [];
  let fail = true;
  const sandbox = {window: {}, TextDecoder, Response, DecompressionStream, AbortController, setTimeout, clearTimeout,
    fetch: async url => {
      calls.push(url);
      if (url.endsWith('/1.gz') && fail) return new Response(null, {status:503});
      return new Response(fs.readFileSync(path.join(data, 'image-font-grid', revision, path.basename(url))));
    }};
  vm.runInNewContext(fs.readFileSync(path.join(js, 'image-font-index.js'), 'utf8'), sandbox);
  const glyph = char => ({char, ratio: 1, pixels: new Uint8Array(1280)});
  const target = {glyphs:[glyph(characters[0]), glyph(characters[1])]};
  const rank = () => sandbox.window.ImageFontIndex.rank(target, rows);
  const first = await rank();
  assert.ok(first.indexed && first.compared > 1200 && first.faces.length > first.compared);
  const {localDistance} = sandbox.window.ImageFontIndex;
  assert.equal(localDistance(first.targets, target.glyphs), 0);
  assert.equal(localDistance(first.targets, target.glyphs.slice(0,1)), null);
  assert.equal(localDistance(first.targets, target.glyphs.slice(0,1), true), .5);
  assert.equal(localDistance(first.targets, [], true), null);
  assert.equal(calls.length, 1);
  target.glyphs.push(glyph(characters[blockSize]));
  const partial = await rank();
  assert.equal(partial.glyphCount, 2);
  assert.equal(partial.indexed, false);
  assert.equal(partial.limited, true);
  fail = false;
  assert.equal((await rank()).glyphCount, 3);
  assert.equal((await rank()).indexed, true);
  assert.equal(calls.length, 3);
  assert.equal((await sandbox.window.ImageFontIndex.rank({glyphs:[]}, rows)).compared, 0);
});

test('older browsers can compare the same catalogue and an unreadable block is never reported as a match', async () => {
  const data = path.join(js, '../data');
  const rows = JSON.parse(fs.readFileSync(path.join(data, 'image-fonts.json')));
  const index = rows[0].shapeIndex;
  const block = fs.readFileSync(path.join(data, 'image-font-grid', index.revision, '0.gz'));
  const sandbox = {window: {}, TextDecoder, Response, AbortController, setTimeout, clearTimeout};
  let unavailable = true, scripts = 0;
  sandbox.fetch = async () => unavailable ? new Response(null, {status:503}) : new Response(block);
  sandbox.document = {createElement: () => ({}), head: {append(script) {
    assert.equal(script.src, '/js/vendor/image-scan/pako-inflate-2.1.0.min.js');
    scripts++;
    sandbox.window.pako = require(path.join(js, 'vendor/image-scan/pako-inflate-2.1.0.min.js'));
    script.onload();
  }}};
  vm.runInNewContext(fs.readFileSync(path.join(js, 'image-font-index.js'), 'utf8'), sandbox);
  const target = {glyphs: [...index.characters.slice(0,2)].map(char => ({char, ratio:1, pixels:new Uint8Array(1280)}))};
  const rank = () => sandbox.window.ImageFontIndex.rank(target, rows);
  await assert.rejects(rank(), /Missing comparison data/);
  unavailable = false;
  assert.equal((await rank()).indexed, true);
  assert.equal(scripts, 1);
});

test('a contender beyond the old cutoff can win; later faces cannot beat the proven bound', async () => {
  const sandbox = {window: {}, setTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(js, 'image-font-index.js'), 'utf8'), sandbox);
  const {finalists, resultCost} = sandbox.window.ImageFontIndex;
  const input = Array.from({length: 130}, (_, i) => ({row: {id: String(i)}, cost: i / 3000, weight: 400}));
  const seen = [];
  const measure = async f => {
    seen.push(f.row.id);
    const score = f.row.id === '55' ? .99 : .4;
    return {...f, score, finalCost: resultCost(f, score)};
  };
  const {matches} = await finalists(input, measure, () => true, () => {});
  assert.equal(matches[0].row.id, '55');
  assert.ok(seen.length > 55 && seen.length < input.length);
  const exhaustive = input.map(f => ({...f, finalCost: resultCost(f, f.row.id === '55' ? .99 : .4)}))
    .sort((a, b) => a.finalCost - b.finalCost);
  assert.deepEqual(Array.from(matches.slice(0, 4), f => f.row.id), exhaustive.slice(0, 4).map(f => f.row.id));
});

test('overlapping original reads preserve measured weights, failures, ties and the confidence runner-up', async () => {
  const sandbox = {window: {}, setTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(js, 'image-font-index.js'), 'utf8'), sandbox);
  const {finalists, resultCost} = sandbox.window.ImageFontIndex;
  const faces = Array.from({length: 75}, (_, i) => ({
    row: {id: String(i % 19)}, weight: 100 * (1 + Math.floor(i / 19)), cost: Math.floor(i / 3) / 500, i
  }));
  async function run(slots) {
    const seen = [], snapshots = [];
    const result = await finalists(faces, async face => {
      seen.push(face.i);
      await new Promise(resolve => setTimeout(resolve, face.i % 3 === 0 ? 6 : 0));
      if (face.i % 11 === 0) return null;
      return {...face, loadFailed: face.i % 7 === 0, finalCost: resultCost(face, (face.i % 5) / 4)};
    }, () => true, () => {}, s => snapshots.push(s), slots);
    assert.equal(new Set(seen).size, seen.length);
    assert.equal(snapshots.at(-1).completed, result.attempted);
    assert.equal(snapshots.at(-1).limit, result.attempted);
    assert.ok(snapshots.some(s => s.inFlight.length === slots));
    let lastCount = 0, lastLimit = Infinity;
    for (const s of snapshots) {
      assert.ok(s.inFlight.length <= slots && s.completed >= lastCount);
      if (s.limit !== null) {
        assert.ok(s.completed <= s.limit && s.limit <= lastLimit);
        lastLimit = s.limit;
      }
      lastCount = s.completed;
    }
    return {seen: seen.sort((a,b) => a-b), failed: result.failed,
      leaders: Array.from(result.matches.slice(0,4), m => [m.row.id, m.weight, m.finalCost])};
  }
  const sequentialBatches = await run(3);
  assert.deepEqual(await run(4), sequentialBatches);
  assert.deepEqual(await run(6), sequentialBatches);
});

test('a cancelled comparison does not publish delayed results or start another batch', async () => {
  const sandbox = {window: {}, setTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(js, 'image-font-index.js'), 'utf8'), sandbox);
  let active = true, measured = 0, updates = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const faces = Array.from({length:20}, (_, i) => ({row:{id:String(i)}, cost:i / 100}));
  const pending = sandbox.window.ImageFontIndex.finalists(faces, async f => {
    measured++; await gate; return {...f, finalCost:f.cost};
  }, () => active, () => assert.fail('cancelled batch committed'), () => updates++);
  await Promise.resolve();
  const before = updates;
  active = false;
  release();
  const result = await pending;
  assert.equal(result.attempted, 0);
  assert.equal(updates, before);
  assert.equal(measured, 6);
});

test('local originals use internal font names and ambiguous aliases need explicit assignment', () => {
  const sandbox = {window: {}, TextDecoder};
  vm.runInNewContext(fs.readFileSync(path.join(js, 'image-font-local.js'), 'utf8'), sandbox);
  const local = sandbox.window.ImageFontLocal;
  const text = 'SampleFamily-Bold';
  const data = new ArrayBuffer(72 + text.length * 2), view = new DataView(data);
  const tag = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset+i, c.charCodeAt(0)));
  view.setUint32(0, 65536); view.setUint16(4, 2);
  tag(12, 'name'); view.setUint32(20, 44); view.setUint32(24, 18 + text.length * 2);
  tag(28, 'OS/2'); view.setUint32(36, data.byteLength - 8); view.setUint32(40, 8);
  view.setUint16(46, 1); view.setUint16(48, 18); view.setUint16(50, 3);
  view.setUint16(56, 6); view.setUint16(58, text.length*2);
  [...text].forEach((c, i) => view.setUint16(62 + 2*i, c.charCodeAt(0)));
  view.setUint16(data.byteLength - 4, 700);
  const meta = local.metadata(data);
  assert.deepEqual(Array.from(meta.names), [text]);
  assert.equal(meta.weight, 700);
  const row = {id: 'sample', aliases: ['Sample Family']};
  assert.equal(local.identify(meta, [row]), row);
  assert.equal(local.identify(meta, [{aliases: ['Different family']}]), null);
  assert.equal(local.identify(meta, [row, {aliases:['SampleFamily']}]), null);
  assert.throws(() => local.metadata(new ArrayBuffer(12)));
});
