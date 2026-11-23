/* qpdf seeks in the local File via WORKERFS. Its JSON includes dictionaries, never stream payloads. */
async function readPdfFonts(file, recordFont) {
  if (typeof Module !== 'function') importScripts('vendor/extractor/qpdf.js');
  const limit = () => Error('PDF의 문서 구조가 분석 한도를 넘었습니다.');
  const qpdf = await Module({
    noInitialRun: true, noFSInit: true,
    locateFile: () => new URL('/js/vendor/extractor/qpdf.wasm', self.location.origin).href
  });
  const fs = qpdf.FS, decoder = new TextDecoder();
  const buffer = new Uint8Array(32768), pieces = [], errors = [];
  let used = 0, total = 0;
  fs.init(null, byte => {
    if (++total > 32 * 1024 * 1024) throw limit();
    buffer[used++] = byte;
    if (used === buffer.length) {
      pieces.push(decoder.decode(buffer, {stream:true}));
      used = 0;
    }
  }, byte => { if (errors.length < 8192) errors.push(byte); });
  fs.mkdir('/input');
  fs.mount(qpdf.WORKERFS, {blobs: [{name: 'doc.pdf', data: file}]}, '/input');
  try {
    // A broken index must not trigger a sequential recovery scan of a multi-GB file.
    const status = qpdf.callMain(['--suppress-recovery', '--json-output', '--json-stream-data=none', '/input/doc.pdf']);
    if (/password|encrypt/i.test(new TextDecoder().decode(Uint8Array.from(errors)))) throw Error('암호를 해제한 사본으로 다시 시도해 주세요.');
    if (status !== 0 && status !== 3) throw Error('PDF 구조를 읽을 수 없습니다. PDF를 다시 저장한 뒤 시도해 주세요.');
  } finally { fs.unmount('/input'); }
  pieces.push(decoder.decode(buffer.subarray(0, used)));
  const objects = JSON.parse(pieces.join('')).qpdf[1];
  pieces.length = 0;
  function resolve(value) {
    if (typeof value !== 'string') return value;
    const obj = objects['obj:' + value];
    return obj ? obj.value ?? obj.stream?.dict : value;
  }
  const trailer = objects.trailer?.value;
  if (trailer?.['/Encrypt']) throw Error('암호를 해제한 사본으로 다시 시도해 주세요.');
  function resources(ref, location, seen, depth) {
    const dict = resolve(ref);
    if (!dict || typeof dict !== 'object' || seen.has(dict)) return;
    if (depth > 100) throw limit();
    seen.add(dict);
    for (const fontRef of Object.values(resolve(dict['/Font']) || {})) {
      const font = resolve(fontRef);
      const name = resolve(font?.['/BaseFont']) || resolve(resolve(font?.['/FontDescriptor'])?.['/FontName']);
      if (typeof name === 'string' && name.startsWith('/')) recordFont(name.slice(1), location);
    }
    for (const key of ['/XObject', '/Pattern']) {
      for (const item of Object.values(resolve(dict[key]) || {}))
        resources(resolve(item)?.['/Resources'], location, seen, depth + 1);
    }
  }
  const root = resolve(trailer?.['/Root']);
  const visited = new Set();
  let page = 0;
  function pages(ref, inherited, depth) {
    const node = resolve(ref);
    if (!node || typeof node !== 'object' || depth > 100 || visited.has(node)) throw Error('PDF 페이지 구조를 읽을 수 없습니다.');
    visited.add(node);
    const res = node['/Resources'] ?? inherited;
    if (node['/Type'] === '/Page') resources(res, (++page) + '쪽 리소스', new Set(), 0);
    else {
      const kids = resolve(node['/Kids']);
      if (!Array.isArray(kids)) throw Error('PDF 페이지 목록을 읽을 수 없습니다.');
      for (const kid of kids) pages(kid, res, depth + 1);
    }
  }
  pages(root?.['/Pages'], null, 0);
}
