/* Document bytes stay in this worker. Only font names and reference locations leave it. */
'use strict';
const vendor = 'vendor/extractor/';
const evidence = new Map();
function record(value, location) {
  if (typeof value !== 'string') return;
  const name = value.replace(/^[A-Z]{6}\+/, '').trim();
  if (!name || name.length > 220 || /[\u0000-\u001f]/.test(name)) return;
  if (!evidence.has(name)) evidence.set(name, new Set());
  if (evidence.size > 2500) throw Error('글꼴 참조 수가 분석 한도를 넘었습니다.');
  evidence.get(name).add(location);
}

async function readPdf(bytes) {
  if (!self.PDFLib) importScripts(vendor+'pdf-lib.min.js');
  const {PDFDocument,PDFName,PDFDict} = PDFLib;
  const pdf = await PDFDocument.load(bytes, {updateMetadata:false});
  const key = PDFName.of;
  function resources(dict, page, seen) {
    if (!(dict instanceof PDFDict) || seen.has(dict)) return;
    seen.add(dict);
    const fonts = dict.lookup(key('Font'));
    if (fonts instanceof PDFDict) for (const [,ref] of fonts.entries()) {
      const font = pdf.context.lookup(ref);
      if (!(font instanceof PDFDict)) continue;
      const desc = font.lookup(key('FontDescriptor'));
      const name = font.lookup(key('BaseFont')) || (desc instanceof PDFDict && desc.lookup(key('FontName')));
      if (name?.decodeText) record(name.decodeText(), page);
    }
    for (const group of ['XObject','Pattern']) {
      const objects = dict.lookup(key(group));
      if (!(objects instanceof PDFDict)) continue;
      for (const [,ref] of objects.entries()) {
        const object = pdf.context.lookup(ref);
        resources((object?.dict || object)?.lookup?.(key('Resources')), page, seen);
      }
    }
  }
  pdf.getPages().forEach((p,i) => resources(p.node.Resources(), (i+1)+'쪽 리소스', new Set()));
}

function readPpt(bytes) {
  if (!self.CFB) importScripts(vendor+'cfb.min.js');
  const file = CFB.read(bytes,{type:'array'});
  const stream = CFB.find(file,'PowerPoint Document');
  if (!stream || CFB.find(file,'EncryptedSummary') || CFB.find(file,'EncryptedPackage'))
    throw Error('PowerPoint 문서 스트림을 읽을 수 없습니다. 암호를 해제하거나 PPTX로 저장해 주세요.');
  const data = Uint8Array.from(stream.content);
  const view = new DataView(data.buffer);
  const decoder = new TextDecoder('utf-16le');
  function walk(start, end, depth) {
    if (depth > 80) throw Error('PPT 기록 구조가 너무 깊습니다.');
    for (let pos=start; pos+8<=end;) {
      const version = view.getUint16(pos,true) & 15;
      const type = view.getUint16(pos+2,true);
      const length = view.getUint32(pos+4,true);
      const next = pos+8+length;
      if (next>end) throw Error('손상되었거나 암호화된 PPT 기록입니다.');
      if (type===4023 && length>=64) record(decoder.decode(data.subarray(pos+8,pos+72)).split('\0')[0], 'PPT 글꼴 표');
      else if (version===15) walk(pos+8,next,depth+1);
      pos=next;
    }
  }
  walk(0,data.length,0);
}

async function readPptx(file) {
  if (!self.zip) importScripts(vendor+'zip-native.min.js');
  if (!self.ExtractorXML) importScripts(vendor+'saxes.min.js');
  class LocalZipReader extends zip.BlobReader {
    readUint8Array(offset, length) {
      if (length > 16 * 1024 * 1024) throw Error('PPTX 파일 목록이 분석 한도를 넘었습니다.');
      return super.readUint8Array(offset, length);
    }
  }
  const reader = new zip.ZipReader(new LocalZipReader(file), {useWebWorkers:false});
  try {
    const entries = new Map();
    for await (const entry of reader.getEntriesGenerator()) {
      if (/^ppt\/.+\.(?:xml|rels)$/.test(entry.filename)) entries.set(entry.filename, entry);
    }
    if (!entries.has('ppt/presentation.xml')) throw Error('PPTX 프레젠테이션을 찾을 수 없습니다.');
    await readSlides(entries);
  } finally { await reader.close(); }
}

async function readSlides(entries) {
  const slides = [...entries.keys()].filter(s=>/^ppt\/slides\/slide\d+\.xml$/.test(s));
  const cache = new Map();
  let budget = 64*1024*1024;
  async function xml(file) {
    if (cache.has(file)) return cache.get(file);
    const entry = entries.get(file);
    if (!entry) return [];
    const size = entry.uncompressedSize;
    if (size > 8*1024*1024 || entry.compressedSize > 9*1024*1024 || (budget-=size)<0)
      throw Error('문서 내부 XML이 분석 한도를 넘었습니다.');
    const raw = new Uint8Array(size);
    let used = 0;
    await entry.getData(new WritableStream({write(part) {
      if (used + part.length > size) throw Error('PPTX XML 크기를 확인할 수 없습니다.');
      raw.set(part, used);
      used += part.length;
    }}), {checkSignature:true});
    if (used !== size) throw Error('PPTX XML 크기를 확인할 수 없습니다.');
    const encoding = raw[0]===255 && raw[1]===254 ? 'utf-16le' : raw[0]===254 && raw[1]===255 ? 'utf-16be' : 'utf-8';
    const parser = new ExtractorXML.SaxesParser({xmlns:false});
    const events = [];
    const stack = [];
    parser.on('opentag',tag=>{
      const local = tag.name.split(':').pop();
      stack.push(local);
      const attrs = tag.attributes;
      if (local==='Relationship') events.push({type:'rel',rel:attrs.Type,target:attrs.Target,external:attrs.TargetMode==='External'});
      if (attrs.typeface) events.push({type:'font',name:attrs.typeface,script:attrs.script || local,
        theme:stack.includes('majorFont')?'mj':stack.includes('minorFont')?'mn':null});
      if (local==='fontRef' && /^(major|minor)$/.test(attrs.idx)) events.push({type:'ref',family:attrs.idx==='major'?'mj':'mn'});
    });
    parser.on('text', s=>{if(stack.at(-1)==='t' && s.trim()) events.push({type:'text',scripts:scriptsOf(s)});});
    parser.on('closetag',()=>stack.pop());
    parser.write(new TextDecoder(encoding).decode(raw)).close();
    cache.set(file,events);
    return events;
  }
  function scriptsOf(s) {
    const scripts = [];
    if (/[\p{Script=Latin}\d]/u.test(s)) scripts.push('latin');
    for (const [script,re] of [['Hang',/\p{Script=Hangul}/u],['Jpan',/[\p{Script=Hiragana}\p{Script=Katakana}]/u],['Arab',/\p{Script=Arabic}/u],['Hebr',/\p{Script=Hebrew}/u],['Thai',/\p{Script=Thai}/u],['Deva',/\p{Script=Devanagari}/u]]) if(re.test(s)) scripts.push(script);
    if (/\p{Script=Han}/u.test(s)) scripts.push('ea');
    return scripts;
  }
  async function target(file,type) {
    if (!file) return '';
    const rels=file.replace(/([^/]+)$/, '_rels/$1.rels');
    const rel=(await xml(rels)).find(r=>r.type==='rel' && !r.external && r.rel?.endsWith('/'+type));
    if (!rel?.target) return '';
    return new URL(rel.target,'https://document.invalid/'+file).pathname.slice(1);
  }
  for (const slide of slides) {
    const num = slide.match(/(\d+)\.xml$/)[1];
    const location = '슬라이드 '+num;
    const layout = await target(slide,'slideLayout');
    const master = await target(layout,'slideMaster');
    const theme = await target(master,'theme');
    const themeFonts = theme ? (await xml(theme)).filter(e=>e.theme) : [];
    const slideEvents = await xml(slide);
    const scripts = new Set(slideEvents.flatMap(e=>e.scripts||[]));
    const families = new Set();
    for (const [file,where] of [[slide,location],[layout,location+' 레이아웃'],[master,location+' 마스터']]) {
      if (!file) continue;
      for (const e of await xml(file)) {
        if (e.type==='ref') families.add(e.family);
        if (e.type!=='font') continue;
        const alias = /^\+(m[jn])-(lt|ea|cs)$/.exec(e.name);
        if (alias) families.add(alias[1]);
        else if (!e.name.startsWith('+')) record(e.name, where);
      }
    }
    if (scripts.size && !families.size) families.add('mn');
    for (const font of themeFonts) if(families.has(font.theme) && scripts.has(font.script)) record(font.name,location+' 테마 후보');
  }
}

onmessage = async ({data:{file}}) => {
  try {
    evidence.clear();
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'psd') {
      if (typeof readPsdFonts === 'undefined') importScripts('psd-font-reader.js?v=1');
      await readPsdFonts(file, record);
    } else if (ext === 'pptx') {
      await readPptx(file);
    } else if (ext === 'pdf' || ext === 'ppt') {
      // Keep the tolerant, inexpensive readers for small documents only.
      if (file.size <= 8*1024*1024) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (ext === 'pdf') await readPdf(bytes);
        else readPpt(bytes);
      } else if (ext === 'pdf') {
        if (typeof readPdfFonts === 'undefined') importScripts('pdf-font-reader.js?v=1');
        await readPdfFonts(file, record);
      } else {
        if (typeof readPptFonts === 'undefined') importScripts('ppt-font-reader.js?v=1');
        readPptFonts(file, record);
      }
    } else throw Error('지원하지 않는 파일 형식입니다.');
    postMessage({fonts:Array.from(evidence,([name,refs])=>({name,count:refs.size,refs:[...refs].slice(0,6)}))});
  } catch (error) {
    const message = /encrypt|password/i.test(error.message) ? '암호를 해제한 사본으로 다시 시도해 주세요.' :
      /[가-힣]/.test(error.message) ? error.message : '파일을 읽을 수 없습니다. 형식과 손상 여부를 확인해 주세요.';
    postMessage({error:message});
  }
};
