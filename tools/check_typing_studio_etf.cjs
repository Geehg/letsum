(()=>{
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {performance} = require('node:perf_hooks');
const ETF_PATH = process.env.TYPEWRITER_ETF_MODULE || require('node:path').join(__dirname,'../html/js/typing-studio-etf.js');
const api = require(ETF_PATH);
const tests = [];
function test(name, fn) { fn(); tests.push(name); }
const image = (w, h, fn) => Float32Array.from({length: w * h}, (_, i) => fn(i % w, Math.floor(i / w)));
const difference = (a, b) => Math.abs(Math.atan2(Math.sin(2 * (a - b)), Math.cos(2 * (a - b)))) * .5;

test('flat image has no confidence or invented directions', () => {
  const out = api.refine(new Float32Array(100 * 90).fill(.41), 100, 90, 10, 9);
  assert.ok(out.confidence.every(c => c === 0));
  assert.ok(out.angle.every(a => a === 0));
});

test('horizontal/vertical/diagonal directions survive sign and physical aspect', () => {
  for (const [name, fn, expected] of [
    ['vertical lines', (x, y) => .5 + .4 * Math.sin(x * .32), Math.PI / 2],
    ['horizontal lines', (x, y) => .5 + .4 * Math.sin(y * .32), 0],
    ['diagonal lines', (x, y) => .5 + .4 * Math.sin((x + y) * .23), -Math.PI / 4]
  ]) {
    const out = api.refine(image(96, 96, fn), 96, 96, 12, 12, {aspect: 1});
    const kept = Array.from(out.angle, (a, i) => ({a, c: out.confidence[i], x: i % 12, y: Math.floor(i / 12)})).filter(p => p.x > 1 && p.x < 10 && p.y > 1 && p.y < 10 && p.c > .5);
    assert.ok(kept.length >= 55, name + ' enough coherent cells');
    assert.ok(kept.every(p => difference(p.a, expected) < .035), name + ' expected tangent');
  }
  const square = api.refine(image(96, 96, (x, y) => .5 + .4 * Math.sin((x + y) * .23)), 96, 96, 12, 12, {aspect: 1.5});
  assert.ok(difference(square.angle[6 * 12 + 6], -Math.atan(1.5)) < .02, 'physical angle includes cell height');
});

test('contrast inversion produces the same unoriented line field', () => {
  const gray = image(93, 87, (x, y) => .5 + .35 * Math.sin(x * .28 + Math.sin(y * .08) * 2));
  const inv = Float32Array.from(gray, v => 1 - v);
  const a = api.refine(gray, 93, 87, 12, 11), b = api.refine(inv, 93, 87, 12, 11);
  assert.ok(a.angle.every((v, i) => difference(v, b.angle[i]) < .001));
  assert.ok(a.confidence.every((v, i) => Math.abs(v - b.confidence[i]) < .001));
});

// Independent direct implementation of shader Eq.(1)-(5), without the LUT or
// dot-product simplification. This checks the adapted formula, not just shape.
function shaderReference(initial, W, H, passes, radius) {
  let tx = new Float32Array(initial.x), ty = new Float32Array(initial.y);
  for (let pass = 0; pass < passes; pass++) {
    const nx = new Float32Array(tx.length), ny = new Float32Array(ty.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let ax = 0, ay = 0;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H || dx * dx + dy * dy >= radius * radius) continue;
        const j = Y * W + X, dot = tx[i] * tx[j] + ty[i] * ty[j];
        const phi = dot > 0 ? 1 : -1, wd = Math.abs(dot), wm = (1 + Math.tanh(initial.magnitude[j] - initial.magnitude[i])) / 2;
        ax += phi * tx[j] * wm * wd; ay += phi * ty[j] * wm * wd;
      }
      const len = Math.hypot(ax, ay); nx[i] = len ? ax / len : 0; ny[i] = len ? ay / len : 0;
    }
    tx = nx; ty = ny;
  }
  return {x: tx, y: ty};
}
test('two CPU ETF passes match independent exact shader equations', () => {
  const W = 37, H = 31, gray = image(W, H, (x, y) => .5 + .24 * Math.sin(x * .31 + Math.sin(y * .27)) + .1 * Math.sin(y * .82 + x * .15));
  const initial = api.refine(gray, W, H, 7, 6, {iterations: 0, includeField: true}).field;
  const actual = api.refine(gray, W, H, 7, 6, {iterations: 2, radius: 3, includeField: true}).field;
  const expected = shaderReference(initial, W, H, 2, 3);
  let maximumError = 0;
  for (let i = 0; i < W * H; i++) maximumError = Math.max(maximumError, Math.hypot(actual.x[i] - expected.x[i], actual.y[i] - expected.y[i]));
  assert.ok(maximumError < 2e-6, 'LUT refinement error ' + maximumError);
  console.log('Exact shader-equation maximum vector error:', maximumError.toExponential(3));
});

test('weak noise is not promoted into confident texture', () => {
  let seed = 12345; const rand = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  const gray = image(101, 91, () => .5 + (rand() - .5) * .0002);
  const out = api.refine(gray, 101, 91, 10, 9);
  assert.ok(out.confidence.every(c => c === 0));
});

test('ETF improves a noisy curved-band tangent field', () => {
  let seed = 777;
  const rand = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  const W = 160, H = 160, C = 40, R = 40;
  const gray = image(W, H, (x, y) => .5 + .28 * Math.sin(x * .22 + 3 * Math.sin(y * .045)) + .09 * (rand() - .5));
  const error = iterations => {
    const out = api.refine(gray, W, H, C, R, {iterations, aspect: 1});
    let sum = 0, count = 0;
    for (let y = 2; y < R - 2; y++) for (let x = 2; x < C - 2; x++) {
      const i = y * C + x;
      if (out.confidence[i] < .35) continue;
      const expected = Math.atan2(.22, -.135 * Math.cos((y + .5) * H / R * .045));
      sum += difference(out.angle[i], expected); count++;
    }
    return sum / count;
  };
  const initial = error(0), refined = error(2);
  assert.ok(refined < initial * .7, 'direction error improves: ' + initial + ' -> ' + refined);
  console.log('Noisy curved-band mean angle error:', initial.toFixed(5), '->', refined.toFixed(5), 'radians');
});

test('determinism, input preservation, monotonic progress and bounded analysis', () => {
  const gray = image(800, 300, (x, y) => .5 + .3 * Math.sin(x * .07 + y * .03)), before = new Float32Array(gray), progress = [];
  const a = api.refine(gray, 800, 300, 80, 30, {maxDimension: 320, onProgress: p => progress.push(p)});
  const b = api.refine(gray, 800, 300, 80, 30, {maxDimension: 320});
  assert.deepEqual(gray, before); assert.deepEqual(a.angle, b.angle); assert.deepEqual(a.confidence, b.confidence);
  assert.equal(progress[0], 0); assert.equal(progress.at(-1), 1); assert.ok(progress.every((v, i) => !i || v >= progress[i - 1]));
  assert.equal(a.meta.analysisWidth, 320); assert.equal(a.meta.analysisHeight, 120);
  assert.ok(a.confidence.every(c => Number.isFinite(c) && c >= 0 && c <= 1));
});

test('tiny/invalid/cancel cases and Worker-style global export', () => {
  const tiny = api.refine(new Float32Array([.2]), 1, 1, 1, 1); assert.equal(tiny.confidence[0], 0);
  assert.throws(() => api.refine(new Float32Array([NaN]), 1, 1, 1, 1), /non-finite/);
  assert.throws(() => api.refine(new Uint8Array(16), 4, 4, 2, 2), /Float32Array/);
  assert.throws(() => api.refine(new Float32Array(16), 4, 4, 2, 2, {shouldCancel: () => true}), {name: 'AbortError'});
  const sandbox = {self: {}, Float32Array, Float64Array, Int32Array, Uint32Array, Math, Date, performance};
  vm.runInNewContext(fs.readFileSync(ETF_PATH, 'utf8'), sandbox);
  assert.equal(typeof sandbox.self.TypewriterETF.refine, 'function');
  assert.equal(sandbox.self.TypewriterETF.refine(new Float32Array(64).fill(.5), 8, 8, 2, 2).confidence[0], 0);
});

const benchmark = [];
const sourceW = 900, sourceH = 1320;
const gray = image(sourceW, sourceH, (x, y) => .5 + .25 * Math.sin(x * .06 + Math.sin(y * .012) * 4) + .13 * Math.sin(y * .08));
for (let run = 0; run < 3; run++) {
  const out = api.refine(gray, sourceW, sourceH, 120, 117);
  benchmark.push(out.meta);
}
console.log('PASS (' + tests.length + '): ' + tests.join('; '));
console.log('640-long-side benchmark:', JSON.stringify(benchmark, null, 2));
})();
/* Read-only verification against the integrated repository, all artifacts /tmp. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {performance} = require('node:perf_hooks');
const repo = process.env.TYPEWRITER_REPO_ROOT || path.resolve(__dirname,'..');
const etfPath = path.join(repo, 'html/js/typing-studio-etf.js');
process.env.TYPEWRITER_ETF_MODULE = etfPath;

const etfSource = fs.readFileSync(etfPath, 'utf8');
const streamSource = fs.readFileSync(path.join(repo, 'html/js/typing-studio-streamlines.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(repo, 'html/js/typing-studio-worker.js'), 'utf8');
const shape = (W, H, fn) => Float32Array.from({length: W * H}, (_, i) => fn(i % W, Math.floor(i / W)));
const tests = [], metrics = {};
function test(name, fn) { fn(); tests.push(name); }
function context(withETF) {
  const c = {self: {}, Float32Array, Float64Array, Int32Array, Uint32Array, Uint8Array, Math, Date, performance};
  const sandbox = vm.createContext(c);
  if (withETF) vm.runInContext(etfSource, sandbox, {filename: etfPath});
  vm.runInContext(streamSource, sandbox, {filename: 'typing-studio-streamlines.js'});
  return c;
}
const integrated = context(true), baseline = context(false);
const current = integrated.self.TypewriterStreamlines, old = baseline.self.TypewriterStreamlines;
const originalETF = integrated.self.TypewriterETF;
let calls = 0, inputToETF;
integrated.self.TypewriterETF = {refine(gray, ...args) { calls++; inputToETF = new Float32Array(gray); return originalETF.refine(gray, ...args); }};

test('Worker imports ETF before streamlines and actual directionField invokes it', () => {
  assert.ok(workerSource.indexOf('typing-studio-etf.js') > 0);
  assert.ok(workerSource.indexOf('typing-studio-etf.js') < workerSource.indexOf('typing-studio-streamlines.js'));
  const gray = shape(160, 240, (x, y) => .5 + .3 * Math.sin(x * .18 + Math.sin(y * .03)));
  const before = calls, field = current.directionField(gray, 160, 240, 20, 20);
  assert.equal(calls, before + 1);
  assert.equal(field.angle.length, 400);
  assert.ok(field.angle.every(Number.isFinite));
  assert.ok(inputToETF.some((v, i) => Math.abs(v - gray[i]) > .001), 'ETF receives smoothed pixels, not the original');
});

test('flat bright and dark inputs have no confidence inflation', () => {
  for (const tone of [.15, .45, .72, 1]) {
    const gray = new Float32Array(160 * 240).fill(tone);
    const field = current.directionField(gray, 160, 240, 20, 20);
    assert.ok(field.confidence.every(v => v === 0), 'flat ' + tone);
  }
});

test('weak crackle does not acquire unsupported confident flow', () => {
  const W = 320, H = 480, C = 40, R = 40;
  // Thin low-contrast synthetic paint cracks on a bright field. Not a
  // semantic crack detector: this checks energy gating after smoothing.
  const gray = shape(W, H, (x, y) => .76 - .025 * ((x % 9 === 0 || (y + Math.floor(x / 17)) % 13 === 0) ? 1 : 0));
  const a = old.directionField(gray, W, H, C, R), b = current.directionField(gray, W, H, C, R);
  const raw = originalETF.refine(gray, W, H, C, R);
  let unsupported = 0, meanA = 0, meanB = 0, meanRaw = 0, maxAdded = 0;
  for (let i = 0; i < C * R; i++) {
    const gate = Math.max(0, Math.min(1, (a.energy[i] - .0015) / .009));
    assert.ok(b.confidence[i] <= Math.max(a.confidence[i], gate) + 1e-6, 'confidence cannot exceed actual tensor-gradient support');
    if (gate === 0) { unsupported++; assert.equal(b.confidence[i], a.confidence[i]); }
    meanA += a.confidence[i]; meanB += b.confidence[i]; meanRaw += raw.confidence[i]; maxAdded = Math.max(maxAdded, b.confidence[i] - a.confidence[i]);
  }
  assert.ok(unsupported > C * R * .5, 'fixture includes many low-energy cells');
  metrics.crackle = {unsupported, cells: C * R, baseMean: meanA / (C * R), integratedMean: meanB / (C * R), ungatedRawETFMean: meanRaw / (C * R), maxAdded};
});

test('tensor coherence/energy and outline mask are unchanged by ETF integration', () => {
  const W = 240, H = 360, C = 30, R = 30;
  const gray = shape(W, H, (x, y) => {
    const distance = Math.hypot((x - 120) / 70, (y - 180) / 115);
    return distance < 1 ? .20 + .08 * Math.sin(x * .17 + Math.sin(y * .04)) : .79;
  });
  const a = old.directionField(gray, W, H, C, R), b = current.directionField(gray, W, H, C, R);
  assert.deepEqual(b.energy, a.energy); assert.deepEqual(b.coherence, a.coherence); assert.deepEqual(b.boundary, a.boundary);
  assert.ok(a.boundary.some(v => v > .1), 'fixture actually has a detectable boundary');
  assert.ok(b.angle.some((v, i) => Math.abs(Math.sin(v - a.angle[i])) > .005), 'ETF changes measured directions inside the actual path');
});

test('existing dark propagation still carries local flow and stops at bright separation', () => {
  const cols = 30, rows = 10, n = cols * rows, angle = new Float32Array(n), confidence = new Float32Array(n), tone = new Float32Array(n).fill(.2);
  for (let y = 0; y < rows; y++) { confidence[y * cols + 2] = .9; angle[y * cols + 2] = .8; tone[y * cols + 10] = .95; }
  const a = old.extendDarkDirections({cols, rows, angle, confidence, tone});
  const b = current.extendDarkDirections({cols, rows, angle, confidence, tone});
  assert.deepEqual(b.angle, a.angle); assert.deepEqual(b.confidence, a.confidence);
  assert.ok(b.confidence[5 * cols + 5] > .2);
  assert.equal(b.confidence[5 * cols + 11], 0);
});

test('refined real-direction field still produces finite deterministic anchors', () => {
  const W = 240, H = 360, cols = 30, rows = 30;
  const gray = shape(W, H, (x, y) => .5 + .3 * Math.sin(x * .13 + Math.sin(y * .023) * 3));
  const field = current.directionField(gray, W, H, cols, rows);
  const options = {cols, rows, field, foreground: new Float32Array(cols * rows).fill(1)};
  const a = current.anchors(options), b = current.anchors(options);
  assert.deepEqual(a, b);
  assert.ok(a.anchors.length > cols * rows * .75);
  assert.ok(a.anchors.every(p => Number.isFinite(p.angle) && Number.isFinite(p.inkWeight)));
  metrics.anchors = {count: a.anchors.length, grid: cols * rows, runs: a.runLengths.length};
});

console.log('INTEGRATION PASS (' + tests.length + '): ' + tests.join('; '));
console.log(JSON.stringify(metrics, null, 2));
