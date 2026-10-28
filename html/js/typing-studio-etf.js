/*
 * TypewriterETF — deterministic, CPU/Worker edge-tangent-flow refinement.
 *
 * ETF equations and Sobel kernels adapted from:
 *   SSARCandy/Coherent-Line-Drawing, commit
 *   37887374e99fe22f1d22004ca114ed2538f0abaf (2026-07-09)
 *   https://github.com/SSARCandy/Coherent-Line-Drawing/blob/37887374e99fe22f1d22004ca114ed2538f0abaf/webgl/index.html
 *   https://github.com/SSARCandy/Coherent-Line-Drawing/blob/37887374e99fe22f1d22004ca114ed2538f0abaf/src/ETF.cpp
 * The implementation follows the WebGL shader's image x/y convention and
 * clamped borders. No image upload, trained model, OpenCV or DOM dependency.
 *
 * MIT License
 * Copyright (c) 2019 HSU,SHU-HSUAN
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Usage:
 *   const etf = TypewriterETF.refine(grayFloat32, width, height, cols, rows, {
 *     maxDimension: 640, iterations: 2, radius: 3, aspect: 1.5,
 *     onProgress: (fraction, stage) => postMessage({fraction, stage})
 *   });
 *   // etf.angle/confidence are Float32Array(cols*rows). Angles are physical
 *   // paper-space radians in [-PI/2, PI/2], not cell-space slope angles.
 *
 * Integration: retain the current structure-tensor confidence/outline signal
 * and existing dark-direction propagation. This module only estimates the
 * direction field; it does not threshold tones, create masks, or place glyphs.
 */
(function(root) {
  'use strict';

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  // Eq.(3) is sampled at 1/1024 intervals and linearly interpolated. Its maximum
  // interpolation error is < 1e-7 on [-1,1]; this avoids millions of tanh calls.
  const WM_SCALE = 1024;
  const WM = new Float64Array(2 * WM_SCALE + 1);
  for (let i = 0; i < WM.length; i++) WM[i] = (1 + Math.tanh((i - WM_SCALE) / WM_SCALE)) * .5;

  function integer(value, name, lo, hi) {
    if (!Number.isInteger(value) || value < lo || value > hi) throw new RangeError(name + ' must be an integer in [' + lo + ', ' + hi + ']');
    return value;
  }

  // Exact area resampling avoids turning fine source patterns into false
  // directional edges when the analysis image is reduced to ~640 pixels.
  function resample(gray, width, height, W, H) {
    const out = new Float32Array(W * H);
    const sx = width / W, sy = height / H;
    const xRanges = Array.from({length: W}, (_, x) => {
      const a = x * sx, b = (x + 1) * sx, start = Math.floor(a), end = Math.min(width, Math.ceil(b));
      const weights = new Float64Array(end - start);
      for (let j = start; j < end; j++) weights[j - start] = Math.min(b, j + 1) - Math.max(a, j);
      return {start, end, weights};
    });
    for (let y = 0; y < H; y++) {
      const a = y * sy, b = (y + 1) * sy, start = Math.floor(a), end = Math.min(height, Math.ceil(b));
      for (let x = 0; x < W; x++) {
        const range = xRanges[x];
        let sum = 0;
        for (let yy = start; yy < end; yy++) {
          const wy = Math.min(b, yy + 1) - Math.max(a, yy), row = yy * width;
          let line = 0;
          for (let xx = range.start; xx < range.end; xx++) line += gray[row + xx] * range.weights[xx - range.start];
          sum += line * wy;
        }
        if (!Number.isFinite(sum)) throw new TypeError('gray contains a non-finite value');
        out[y * W + x] = clamp(sum / (sx * sy), 0, 1);
      }
    }
    return out;
  }

  // 5x5 separable Sobel: S=[1,4,6,4,1], D=[-1,-2,0,2,1].
  // An interior unit-per-pixel ramp has derivative response 128, so dividing
  // the magnitude by 128 preserves an absolute grayscale-gradient measure.
  function initialField(gray, W, H) {
    const n = W * H, hD = new Float32Array(n), hS = new Float32Array(n);
    const tx = new Float32Array(n), ty = new Float32Array(n), rawMagnitude = new Float32Array(n), magnitude = new Float32Array(n);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x, a = gray[row + Math.max(0, x - 2)], b = gray[row + Math.max(0, x - 1)], c = gray[i], d = gray[row + Math.min(W - 1, x + 1)], e = gray[row + Math.min(W - 1, x + 2)];
        hD[i] = -a - 2 * b + 2 * d + e;
        hS[i] = a + 4 * b + 6 * c + 4 * d + e;
      }
    }
    let minMagnitude = Infinity, maxMagnitude = 0;
    for (let y = 0; y < H; y++) {
      const ra = Math.max(0, y - 2) * W, rb = Math.max(0, y - 1) * W, rc = y * W, rd = Math.min(H - 1, y + 1) * W, re = Math.min(H - 1, y + 2) * W;
      for (let x = 0; x < W; x++) {
        const i = rc + x;
        const gx = hD[ra + x] + 4 * hD[rb + x] + 6 * hD[i] + 4 * hD[rd + x] + hD[re + x];
        const gy = -hS[ra + x] - 2 * hS[rb + x] + 2 * hS[rd + x] + hS[re + x];
        const length = Math.hypot(gx, gy), raw = length / 128;
        rawMagnitude[i] = raw;
        minMagnitude = Math.min(minMagnitude, raw); maxMagnitude = Math.max(maxMagnitude, raw);
        if (length > 1e-9) { tx[i] = -gy / length; ty[i] = gx / length; }
      }
    }
    const span = maxMagnitude - minMagnitude;
    if (span > 1e-12) for (let i = 0; i < n; i++) magnitude[i] = (rawMagnitude[i] - minMagnitude) / span;
    return {tx, ty, magnitude, rawMagnitude};
  }

  function refineVectors(field, W, H, iterations, radius, notify) {
    let tx = field.tx, ty = field.ty, nextX = new Float32Array(W * H), nextY = new Float32Array(W * H);
    const mag = field.magnitude, offsets = [];
    // Eq.(2): binary circular spatial window with strict distance < radius.
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy < radius * radius) offsets.push([dx, dy, dy * W + dx]);
    }
    const dxs = Int32Array.from(offsets, p => p[0]), dys = Int32Array.from(offsets, p => p[1]), delta = Int32Array.from(offsets, p => p[2]);
    for (let pass = 0; pass < iterations; pass++) {
      for (let y = 0; y < H; y++) {
        if ((y & 31) === 0) notify(.25 + .60 * (pass + y / H) / Math.max(1, iterations), 'refine');
        for (let x = 0; x < W; x++) {
          const i = y * W + x, ax = tx[i], ay = ty[i], gm = mag[i];
          const border = x < radius || x >= W - radius || y < radius || y >= H - radius;
          let vx = 0, vy = 0;
          for (let k = 0; k < delta.length; k++) {
            if (border && (x + dxs[k] < 0 || x + dxs[k] >= W || y + dys[k] < 0 || y + dys[k] >= H)) continue;
            const j = i + delta[k], bx = tx[j], by = ty[j], dot = ax * bx + ay * by;
            const at = clamp((mag[j] - gm) * WM_SCALE + WM_SCALE, 0, 2 * WM_SCALE), low = Math.floor(at), f = at - low;
            const wm = WM[low] + (WM[Math.min(low + 1, 2 * WM_SCALE)] - WM[low]) * f;
            // Eq.(4) wd=abs(dot), Eq.(5) phi=sign(dot).
            // phi * wd is exactly dot: opposite tangent signs align correctly.
            const weight = dot * wm;
            vx += bx * weight; vy += by * weight;
          }
          const length = Math.hypot(vx, vy);
          nextX[i] = length > 1e-12 ? vx / length : 0;
          nextY[i] = length > 1e-12 ? vy / length : 0;
        }
      }
      [tx, nextX] = [nextX, tx]; [ty, nextY] = [nextY, ty];
    }
    return {tx, ty, magnitude: mag, rawMagnitude: field.rawMagnitude};
  }

  function pool(field, W, H, cols, rows, aspect) {
    const n = cols * rows, c2 = new Float64Array(n), s2 = new Float64Array(n), weights = new Float64Array(n), gradients = new Float64Array(n), hits = new Uint32Array(n);
    const angle = new Float32Array(n), confidence = new Float32Array(n), coherence = new Float32Array(n), energy = new Float32Array(n);
    const physicalX = cols / W, physicalY = rows * aspect / H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = Math.min(rows - 1, Math.floor((y + .5) * rows / H)) * cols + Math.min(cols - 1, Math.floor((x + .5) * cols / W));
      let vx = field.tx[i] * physicalX, vy = field.ty[i] * physicalY;
      const length = Math.hypot(vx, vy), w = field.rawMagnitude[i];
      gradients[j] += w; hits[j]++;
      if (length < 1e-12 || w < 1e-12) continue;
      vx /= length; vy /= length;
      // Doubled-vector averaging treats tangent and its negative as the same
      // line. Direct angle averaging would incorrectly flatten +/-90 degrees.
      c2[j] += (vx * vx - vy * vy) * w;
      s2[j] += 2 * vx * vy * w;
      weights[j] += w;
    }
    for (let i = 0; i < n; i++) {
      const c = weights[i] > 1e-12 ? Math.min(1, Math.hypot(c2[i], s2[i]) / weights[i]) : 0;
      const e = gradients[i] / Math.max(1, hits[i]);
      coherence[i] = c; energy[i] = e;
      confidence[i] = clamp((c - .25) / .65, 0, 1) * clamp((e - .0015) / .009, 0, 1);
      angle[i] = confidence[i] > 0 ? .5 * Math.atan2(s2[i], c2[i]) : 0;
    }
    return {angle, confidence, coherence, energy};
  }

  function refine(gray, width, height, cols, rows, options = {}) {
    integer(width, 'width', 1, 32768); integer(height, 'height', 1, 32768);
    integer(cols, 'cols', 1, width); integer(rows, 'rows', 1, height);
    if (!(gray instanceof Float32Array) || gray.length !== width * height) throw new TypeError('gray must be a Float32Array(width * height)');
    const maxDimension = integer(options.maxDimension ?? 640, 'maxDimension', 16, 2048);
    const iterations = integer(options.iterations ?? 2, 'iterations', 0, 6), radius = integer(options.radius ?? 3, 'radius', 1, 8);
    const aspect = options.aspect ?? 1.5;
    if (!Number.isFinite(aspect) || aspect <= 0) throw new RangeError('aspect must be positive');
    const start = now(), timings = {}, scale = Math.min(1, maxDimension / Math.max(width, height));
    const W = Math.max(1, Math.round(width * scale)), H = Math.max(1, Math.round(height * scale));
    const notify = (fraction, stage) => {
      if (options.shouldCancel && options.shouldCancel()) { const error = new Error('ETF refinement cancelled'); error.name = 'AbortError'; throw error; }
      if (options.onProgress) options.onProgress(fraction, stage);
    };
    notify(0, 'resample');
    let t = now(); const small = resample(gray, width, height, W, H); timings.resampleMs = now() - t;
    notify(.12, 'gradient');
    t = now(); const initial = initialField(small, W, H); timings.gradientMs = now() - t;
    notify(.25, 'refine');
    t = now(); const field = refineVectors(initial, W, H, iterations, radius, notify); timings.refineMs = now() - t;
    notify(.85, 'pool');
    t = now(); const result = pool(field, W, H, cols, rows, aspect); timings.poolMs = now() - t;
    result.meta = {backend: 'cpu-etf', analysisWidth: W, analysisHeight: H, iterations, radius, elapsedMs: now() - start, timings};
    if (options.includeField) result.field = {x: field.tx, y: field.ty, magnitude: field.magnitude, rawMagnitude: field.rawMagnitude, width: W, height: H};
    notify(1, 'complete');
    return result;
  }

  const api = Object.freeze({refine});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TypewriterETF = api;
})(typeof self === 'undefined' ? globalThis : self);
