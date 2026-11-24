// Compare ink from the selected line locally. Font and image samples share the same pipeline.
(() => {
  'use strict';

  const glyphWidth = 32;
  const glyphHeight = 40;

  function canvas(width, height) {
    return Object.assign(document.createElement('canvas'), {width, height});
  }

  function otsu(histogram, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    let best = 0, threshold = 0, leftCount = 0, leftSum = 0;
    for (let i = 0; i < 255; i++) {
      leftCount += histogram[i];
      leftSum += i * histogram[i];
      if (!leftCount) continue;
      if (leftCount === total) break;
      const rightCount = total - leftCount;
      const distance = leftSum / leftCount - (sum - leftSum) / rightCount;
      const variance = leftCount * rightCount * distance * distance;
      if (variance > best) {
        best = variance;
        threshold = i;
      }
    }
    return best ? threshold : -1;
  }

  // Transparent exports can contain white lettering. Prefer a dark matte if
  // nearly all visible samples are light and enough of the crop is transparent.
  function matteLuminance(rgba) {
    const step = Math.max(1, Math.ceil(rgba.length / (4 * 32768))) * 4;
    let clear = 0, visible = 0, light = 0;
    for (let i = 0; i < rgba.length; i += step) {
      if (rgba[i+3] < 20) clear++;
      if (rgba[i+3] < 40) continue;
      visible++;
      if ((77*rgba[i] + 150*rgba[i+1] + 29*rgba[i+2]) / 256 > 160) light++;
    }
    return clear > (clear+visible)*.08 && visible && light > visible*.97 ? 35 : 255;
  }

  function inkSample(source, crop) {
    const w = crop.w, h = crop.h;
    if (!(w >= 2 && h >= 2)) return null;
    const scale = Math.min(1, 3200 / w, 320 / h);
    const width = Math.max(1, Math.round(w * scale));
    const height = Math.max(1, Math.round(h * scale));
    const mask = canvas(width, height);
    const ctx = mask.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(source, crop.x, crop.y, w, h, 0, 0, width, height);
    const rgba = ctx.getImageData(0, 0, width, height);
    const data = rgba.data;
    const matte = matteLuminance(data);
    const gray = new Uint8Array(width * height);
    const histogram = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) {
      const k = i * 4;
      const value = (77 * data[k] + 150 * data[k+1] + 29 * data[k+2]) >> 8;
      const alpha = data[k+3];
      gray[i] = Math.round((value * alpha + matte * (255-alpha)) / 255);
      histogram[gray[i]]++;
    }
    const threshold = otsu(histogram, gray.length);
    if (threshold < 0) return null;
    let dark = 0, count = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += (y === 0 || y === height-1) ? 1 : Math.max(1,width-1)) {
        if (gray[y * width + x] <= threshold) dark++;
        count++;
      }
    }
    const backgroundDark = dark > count / 2;
    const projection = new Uint16Array(width);
    const top = new Uint16Array(width).fill(height);
    const bottom = new Int16Array(width).fill(-1);
    let left = width, right = -1, firstRow = height, lastRow = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const ink = (gray[i] <= threshold) !== backgroundDark;
        data[4*i+3] = ink ? 255 : 0;
        if (!ink) continue;
        projection[x]++;
        top[x] = Math.min(top[x], y);
        bottom[x] = y;
        left = Math.min(left,x); right = Math.max(right,x);
        firstRow = Math.min(firstRow,y); lastRow = y;
      }
    }
    if (right-left < 2 || lastRow-firstRow < 2) return null;
    ctx.putImageData(rgba, 0, 0);
    return {mask, projection, top, bottom, left, right, firstRow, lastRow};
  }

  function maskPixels(mask, x, y, w, h, width, height) {
    const ctx = canvas(width,height).getContext('2d', {willReadFrequently:true});
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mask, x, y, w, h, 0, 0, width, height);
    const data = ctx.getImageData(0,0,width,height).data;
    const pixels = new Uint8ClampedArray(width * height);
    for (let i = 0; i < pixels.length; i++) pixels[i] = data[i*4+3];
    return pixels;
  }

  // Cut between syllables near an expected advance. Prefer blank valleys to
  // cutting a stroke. Spaces shift the expected cuts but contribute no ink.
  function cutsForText(sample, text) {
    const measure = canvas(1,1).getContext('2d');
    measure.font = '48px sans-serif';
    const chars = [];
    let advance = 0;
    for (const char of text) {
      const width = measure.measureText(char).width;
      if (!/\s/u.test(char)) chars.push({char, start:advance, end:advance+width});
      advance += width;
    }
    if (!chars.length) return [];
    const {left, right, firstRow, lastRow, projection} = sample;
    const span = right - left + 1;
    const unit = span / Math.max(1,chars[chars.length-1].end - chars[0].start);
    let from = left;
    return chars.map((glyph, i) => {
      let cut = right + 1;
      if (i < chars.length-1) {
        const next = chars[i+1];
        const middle = left + ((glyph.end + next.start)/2 - chars[0].start) * unit;
        const step = Math.min(glyph.end-glyph.start, next.end-next.start) * unit;
        const radius = Math.max(2, .42*step);
        let best = Infinity;
        const lower = Math.max(from+1, Math.floor(middle-radius));
        const upper = Math.min(right, Math.ceil(middle+radius));
        for (let x = lower; x <= upper; x++) {
          const ink = (projection[x-1] + projection[x]) / (2*(lastRow-firstRow+1));
          const bias = (x-middle)/radius;
          const cost = ink + .11*bias*bias;
          if (cost < best) {best = cost; cut = x;}
        }
        if (!Number.isFinite(best)) cut = Math.min(right+1, from+1);
      }
      const part = {char:glyph.char, from, to:cut};
      from = cut;
      return part;
    });
  }

  function prepareTarget(source, crop, text) {
    if (!source) return null;
    const box = crop || {x:0, y:0, w:source.naturalWidth || source.width, h:source.naturalHeight || source.height};
    const sample = inkSample(source,box);
    if (!sample) return null;
    const {mask, projection, top, bottom, left, right, firstRow, lastRow} = sample;
    const width = right-left+1, height = lastRow-firstRow+1;
    const pixels = maskPixels(mask, left,firstRow,width,height,160,32);
    let minGlyphHeight = Infinity;
    const glyphs = cutsForText(sample,text).map(({char,from,to}) => {
      let x = from, end = to-1, y = lastRow, last = firstRow;
      while (x <= end && !projection[x]) x++;
      while (end >= x && !projection[end]) end--;
      if (x > end) return {char, pixels:null};
      for (let i=x; i<=end; i++) {
        y = Math.min(y,top[i]);
        last = Math.max(last,bottom[i]);
      }
      const w = end-x+1, h = last-y+1;
      if (/[가-힣]/u.test(char)) minGlyphHeight = Math.min(minGlyphHeight,h);
      return {char, pixels:maskPixels(mask,x,y,w,h,glyphWidth,glyphHeight),
        box: {x:box.x + x*box.w/mask.width, y:box.y + y*box.h/mask.height,
          w:w*box.w/mask.width, h:h*box.h/mask.height},
        ratio:w/h, top:(y-firstRow)/height, bottom:(last-firstRow)/height};
    });
    return {pixels, ratio:width/height, height, glyphs, minGlyphHeight,
      distinct:new Set(text.match(/[가-힣]/gu) || []).size};
  }

  function reference(text, family, weight=400) {
    const measure = canvas(1,1).getContext('2d');
    const font = weight + ' 52px "' + family + '", serif';
    measure.font = font;
    const metrics = measure.measureText(text);
    const left = Math.ceil(Math.max(0,metrics.actualBoundingBoxLeft)) + 4;
    const above = Math.ceil(metrics.actualBoundingBoxAscent || 62) + 4;
    const below = Math.ceil(Math.max(0,metrics.actualBoundingBoxDescent || 0)) + 4;
    const image = canvas(left + Math.ceil(Math.max(metrics.width,metrics.actualBoundingBoxRight || 0)) + 4, above+below);
    const ctx = image.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0,0,image.width,image.height);
    ctx.font = font; ctx.fillStyle = 'black'; ctx.fillText(text,left,above);
    return prepareTarget(image,null,text);
  }

  function overlap(a,b) {
    let both = 0, either = 0;
    for (let i=0; i<a.length; i++) {
      both += Math.min(a[i],b[i]);
      either += Math.max(a[i],b[i]);
    }
    return both / Math.max(1,either);
  }

  function compare(target, ref) {
    const line = overlap(target.pixels,ref.pixels) * Math.exp(-.25*Math.abs(Math.log(target.ratio/ref.ratio)));
    let total = 0, weight = 0, possible = 0;
    for (let i=0; i<target.glyphs.length; i++) {
      const a = target.glyphs[i], b = ref.glyphs[i];
      const importance = /[가-힣]/u.test(a.char) ? 1 : .35;
      possible += importance;
      if (!a.pixels || !b || !b.pixels) continue;
      const shape = overlap(a.pixels,b.pixels);
      const proportion = Math.abs(Math.log(a.ratio/b.ratio));
      const offset = Math.abs(a.top-b.top) + Math.abs(a.bottom-b.bottom);
      total += importance * shape * Math.exp(-.22*proportion-.16*offset);
      weight += importance;
    }
    const glyph = total / Math.max(1,weight);
    const coverage = weight / Math.max(1,possible);
    // Independently aligned syllables retain their evidence when tracking changes.
    const score = coverage * (.80*glyph + .20*line);
    return {score, line, glyph, coverage};
  }

  function isConfident(target, matches, expectedCount) {
    const best = matches[0], second = matches[1];
    if (!best || !second || target.distinct < 2 || target.minGlyphHeight < 12) return false;
    const required = Math.max(Math.min(4,expectedCount), Math.ceil(.70*expectedCount));
    if (matches.length < required || best.coverage < .98 || best.glyph < .68) return false;
    const margin = best.score - second.score;
    return (best.score >= .74 && margin >= .04) || (best.score >= .70 && margin >= .11);
  }

  // Rank only samples that resemble at least one candidate. Account for width
  // as well as the normalized mask, which stretches both glyphs to one grid.
  function distinctiveGlyphs(targets, references) {
    const best = new Map();
    targets.forEach((target, line) => target.glyphs.forEach((source, index) => {
      if (!source.pixels || !/[가-힣]/u.test(source.char) || source.box.h < 10) return;
      const [a, b] = references.map(ref => ref[line]?.glyphs[index]);
      if (!a?.pixels || !b?.pixels || a.char !== source.char || b.char !== source.char) return;
      const fit = Math.max(overlap(source.pixels, a.pixels), overlap(source.pixels, b.pixels));
      if (fit < .45) return;
      const difference = 1 - overlap(a.pixels, b.pixels) * Math.exp(-Math.abs(Math.log(a.ratio / b.ratio)));
      const score = difference * fit * Math.min(1, source.box.h / 32);
      if (!best.has(source.char) || best.get(source.char).score < score) {
        best.set(source.char, {source, line, score});
      }
    }));
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 3);
  }

  window.ImageFontShapes = {prepareTarget, reference, compare, isConfident, distinctiveGlyphs};
})();
