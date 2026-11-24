// Isolated, single-threaded Korean line recognition. Only fixed assets are fetched.
let ort;
const base = new URL('./vendor/korean-line-v1/', self.location.href);

async function bytes(name) {
  const url = new URL(name, base).href;
  // A versioned path also keeps previously downloaded weights usable across visits.
  let cache;
  try { cache = await caches.open('letsum-korean-line-v1'); } catch { /* private browsing */ }
  let response = await cache?.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) throw Error('OCR asset unavailable');
    if (cache) {
      try { await cache.put(url, response.clone()); } catch { /* quota exhausted */ }
    }
  }
  const raw = new Uint8Array(await response.arrayBuffer());
  if (raw[0] !== 0x1f || raw[1] !== 0x8b) return raw; // HTTP may already decode gzip.
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function loadModel() {
  ort = await import(new URL('ort.wasm.min.js', base).href);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = {mjs:new URL('ort-wasm-simd-threaded.js', base).href};
  const [binary, weights, dictionary] = await Promise.all([
    bytes('ort-wasm-simd-threaded.wasm.gz'), bytes('rec.onnx.gz'), bytes('dict.txt')
  ]);
  ort.env.wasm.wasmBinary = binary;
  const chars = ['', ...new TextDecoder().decode(dictionary).trimEnd().split(/\r?\n/), ' '];
  const model = await ort.InferenceSession.create(weights, {executionProviders:['wasm']});
  return {model, chars};
}

function histogramLimits(hist, count) {
  const percentile = fraction => {
    let n = 0;
    for (let i=0; i<255; i++) {
      n += hist[i];
      if (n >= count*fraction) return i;
    }
    return 255;
  };
  return [percentile(.015), percentile(.96)];
}

async function readLine({model, chars}, pixels, width, enhance) {
  const height = 48, stride = Math.max(320, width), plane = stride * height;
  const values = new Float32Array(3 * plane);
  const gray = new Uint8Array(width * height), histogram = new Uint32Array(256);
  for (let i=0; i<gray.length; i++) {
    const k=i*4;
    gray[i]=(77*pixels[k]+150*pixels[k+1]+29*pixels[k+2]) >> 8;
    histogram[gray[i]]++;
  }
  const [lo, hi] = histogramLimits(histogram, gray.length);
  if (hi-lo < 7) return null;
  for (let y=0; y<height; y++) {
    for (let x=0; x<width; x++) {
      const i=y*width+x, j=y*stride+x;
      // The model expects BGR planes in [-1,1], followed by zero padding.
      const tone=Math.min(255, Math.max(0, (gray[i]-lo)*255/(hi-lo)));
      for (let c=0; c<3; c++) {
        const v=pixels[i*4+2-c];
        values[c*plane+j] = (enhance ? .25*v+.75*tone : v)/127.5-1;
      }
    }
  }
  const input = new ort.Tensor('float32', values, [1,3,height,stride]);
  let output;
  try {
    output = (await model.run({[model.inputNames[0]]:input}))[model.outputNames[0]];
    const [batch, steps, count] = output.dims;
    if (batch !== 1 || count !== chars.length) throw Error('Incompatible OCR alphabet');
    let previous = -1, text = '', sum = 0, length = 0;
    const scores = output.data;
    for (let t=0; t<steps; t++) {
      const offset=t*count;
      let best=0;
      for (let i=1; i<count; i++) if (scores[offset+i]>scores[offset+best]) best=i;
      if (best && best!==previous) {
        text += chars[best]; sum += scores[offset+best]; length++;
      }
      previous=best;
    }
    text=text.normalize('NFC').trim().replace(/\s+/gu,' ');
    if ((text.match(/[가-힣]/gu)||[]).length<2 || [...text].length>40) return null;
    return {text, confidence:sum/Math.max(1,length)};
  } finally {
    input.dispose();
    output?.dispose();
  }
}

// The detector yields a probability map; group adjacent confident pixels and
// restore the margin removed by DB text detection before recognizing a line.
function textBoxes(scores, width, height) {
  const active = Uint8Array.from(scores, p=>Number(p >= .3));
  const queue = new Int32Array(active.length), boxes=[];
  for (let i=0;i<active.length;i++) {
    if (!active[i]) continue;
    let end=1, left=width, right=0, top=height, bottom=0, sum=0;
    queue[0]=i; active[i]=0;
    for (let head=0;head<end;head++) {
      const p=queue[head], x=p%width, y=Math.floor(p/width);
      left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y); sum+=scores[p];
      if(x && active[p-1]) {active[p-1]=0; queue[end++]=p-1;}
      if(x+1<width && active[p+1]) {active[p+1]=0; queue[end++]=p+1;}
      if(y && active[p-width]) {active[p-width]=0; queue[end++]=p-width;}
      if(y+1<height && active[p+width]) {active[p+width]=0; queue[end++]=p+width;}
    }
    const w=right-left+1, h=bottom-top+1, confidence=sum/end;
    if (h<3 || w<1.5*h || w>42*h || confidence<.57 || end < w*h*.22) continue;
    const margin = Math.max(2, .55*h);
    boxes.push({x:Math.max(0,left-margin)/width, y:Math.max(0,top-margin)/height,
      right:Math.min(width,right+1+margin)/width, bottom:Math.min(height,bottom+1+margin)/height,
      priority:h*confidence});
  }
  return boxes.sort((a,b)=>b.priority-a.priority).slice(0,3);
}

async function detectLines(pixels,width,height) {
  const detector = await ort.InferenceSession.create(await bytes('det.onnx.gz'), {executionProviders:['wasm']});
  const plane = width*height, values=new Float32Array(3*plane);
  const means=[.485,.456,.406], deviations=[.229,.224,.225];
  for (let i=0;i<plane;i++) for(let c=0;c<3;c++) {
    values[c*plane+i]=(pixels[4*i+2-c]/255-means[c])/deviations[c];
  }
  const input=new ort.Tensor('float32',values,[1,3,height,width]);
  let output;
  try {
    output=(await detector.run({[detector.inputNames[0]]:input}))[detector.outputNames[0]];
    return textBoxes(output.data,output.dims[3],output.dims[2]);
  } finally {
    input.dispose();
    output?.dispose();
    await detector.release();
  }
}

let loaded;
self.onmessage = async ({data:{pixels,width,height,detect}}) => {
  try {
    loaded ||= loadModel();
    const session = await loaded;
    if (detect) {
      self.postMessage(await detectLines(pixels,width,height));
      return;
    }
    const raw = await readLine(session,pixels,width,false);
    if (raw && raw.confidence >= .78) {
      const enhanced = await readLine(session,pixels,width,true);
      if (enhanced && enhanced.confidence >= .75 &&
          raw.text.replaceAll(' ','') === enhanced.text.replaceAll(' ','')) {
        self.postMessage(enhanced.confidence > raw.confidence ? enhanced.text : raw.text);
        return;
      }
    }
  } catch { /* On unsupported or offline devices the primary OCR stays usable. */ }
  self.postMessage('');
};
