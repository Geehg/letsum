/* Local document-to-plain-text import. Existing JSZip 3.10.1 is loaded on demand.
 * Imported markup is never inserted into the page. */
(function(root){
 'use strict';
 const MAX_CHARS=1000000,MAX_BYTES=20*1024*1024,MAX_XML=24*1024*1024;
 let zipPromise;
 const normalize=text=>text.normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\n{4,}/g,'\n\n\n').trim();
 function validate(text){text=normalize(text);if(!text)throw Error('문서에서 읽을 수 있는 본문을 찾지 못했습니다.');if(Array.from(text).length>MAX_CHARS)throw Error('본문은 최대 100만 자입니다. 문서를 나눠서 첨부해 주세요.');return text;}
 function decode(bytes){
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(b[0]===255&&b[1]===254)return new TextDecoder('utf-16le',{fatal:true}).decode(b);
  if(b[0]===254&&b[1]===255)return new TextDecoder('utf-16be',{fatal:true}).decode(b);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(b);}catch(_){try{return new TextDecoder('euc-kr',{fatal:true}).decode(b);}catch(_){throw Error('문자 인코딩을 읽지 못했습니다. UTF-8 텍스트로 저장한 뒤 첨부해 주세요.');}}
 }
 function markdown(text){return text.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/,'').replace(/^#{1,6}\s+/gm,'').replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|__/g,'').replace(/^>\s?/gm,'').replace(/^```[^\n]*$/gm,'');}
 function xml(text){if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('외부 문서 정의가 포함된 파일은 읽을 수 없습니다.');const d=new DOMParser().parseFromString(text,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('문서 구조를 읽지 못했습니다. 파일을 다시 저장해 주세요.');return d;}
 const elements=(doc,name)=>Array.from(doc.getElementsByTagNameNS('*',name));
 function wordText(text){
  const doc=xml(text),out=[];const body=elements(doc,'body')[0];if(!body)throw Error('Word 본문이 없는 문서입니다.');
  function visit(n){const name=n.localName;if(['del','instrText','drawing','pict'].includes(name))return;if(name==='t'){out.push(n.textContent);return;}if(name==='tab'){out.push('\t');return;}if(name==='br'||name==='cr'){out.push('\n');return;}for(const child of n.childNodes)if(child.nodeType===1)visit(child);if(name==='p'||name==='tr')out.push('\n');if(name==='tc')out.push('\t');}
  visit(body);return out.join('');
 }
 function chapterText(text){
  const doc=xml(text),body=elements(doc,'body')[0];if(!body)return '';const out=[];
  function visit(n){if(n.nodeType===3){out.push(n.nodeValue.replace(/\s+/g,' '));return;}if(n.nodeType!==1)return;const name=n.localName?.toLowerCase();if(['script','style','noscript','svg','math','nav','aside','head'].includes(name))return;if(name==='br'){out.push('\n');return;}const block=/^(p|div|h[1-6]|li|blockquote|section|tr)$/.test(name);if(block)out.push('\n');for(const c of n.childNodes)visit(c);if(block)out.push('\n');}
  visit(body);return out.join('').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 }
 function zipPath(base,href){if(!href||/^(?:[a-z]+:|\/\/)/i.test(href))throw Error('외부 문서 링크는 읽지 않습니다.');const parts=base.split('/').filter(Boolean);for(const part of decodeURIComponent(href.split('#')[0]).split('/')){if(part==='..'){if(!parts.length)throw Error('문서 경로가 잘못되었습니다.');parts.pop();}else if(part&&part!=='.')parts.push(part);}return parts.join('/');}
 function needZip(){
  if(root.JSZip)return Promise.resolve(root.JSZip);
  return zipPromise ||= new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/js/jszip.min.js?v=3.10.1';s.onload=()=>resolve(root.JSZip);s.onerror=()=>{s.remove();zipPromise=null;reject(Error('문서 읽기 도구를 불러오지 못했습니다. 다시 시도해 주세요.'));};document.head.appendChild(s);});
 }
 // Bound decompressed XML before retaining it; a small ZIP may expand enormously.
 function readEntry(zip,path,budget,signal){
  const entry=zip.file(path);if(!entry)throw Error('문서의 본문 파일이 없습니다: '+path);
  return new Promise((resolve,reject)=>{const chunks=[];let size=0,done=false;const stream=entry.internalStream('uint8array');
   const fail=e=>{if(done)return;done=true;stream.pause();signal?.removeEventListener('abort',abort);reject(e);};
   const abort=()=>fail(new DOMException('취소됨','AbortError'));if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
   stream.on('data',chunk=>{if(done)return;size+=chunk.length;budget.bytes+=chunk.length;if(size>MAX_XML||budget.bytes>MAX_XML){fail(Error('문서의 압축 해제 용량이 너무 큽니다. 본문만 나눠 저장해 주세요.'));return;}chunks.push(chunk);}).on('error',()=>fail(Error('손상되었거나 암호로 보호된 문서입니다.'))).on('end',()=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}try{resolve(decode(bytes));}catch(e){reject(e);}}).resume();
  });
 }
 async function read(file,{signal,onProgress=()=>{}}={}){
  if(!file||file.size>MAX_BYTES)throw Error('20MB 이하 문서만 첨부할 수 있습니다.');const ext=file.name.split('.').pop().toLowerCase();
  if(!['txt','md','markdown','docx','epub'].includes(ext))throw Error('TXT·MD·DOCX·EPUB 파일을 선택해 주세요. PDF·HWP는 텍스트로 저장한 뒤 첨부할 수 있습니다.');
  const bytes=await file.arrayBuffer();if(signal?.aborted)throw new DOMException('취소됨','AbortError');let text;
  if(['txt','md','markdown'].includes(ext)){text=decode(bytes);if(ext!=='txt')text=markdown(text);}
  else{
   const JSZip=await needZip();let zip;try{zip=await JSZip.loadAsync(bytes);}catch(_){throw Error('손상되었거나 암호로 보호된 문서입니다.');}
   if(Object.keys(zip.files).length>5000)throw Error('파일 항목이 너무 많은 문서입니다. 본문을 나눠 주세요.');const budget={bytes:0};
   if(ext==='docx')text=wordText(await readEntry(zip,'word/document.xml',budget,signal));
   else{
    const container=xml(await readEntry(zip,'META-INF/container.xml',budget,signal)),path=elements(container,'rootfile')[0]?.getAttribute('full-path');if(!path)throw Error('EPUB 목차를 찾지 못했습니다.');
    const opf=xml(await readEntry(zip,path,budget,signal)),folder=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'',manifest=new Map(elements(opf,'item').map(n=>[n.getAttribute('id'),n]));
    const spine=elements(opf,'itemref').filter(n=>n.getAttribute('linear')!=='no'),chapters=[];let count=0;
    for(let i=0;i<spine.length;i++){if(signal?.aborted)throw new DOMException('취소됨','AbortError');const item=manifest.get(spine[i].getAttribute('idref'));if(!item||!/html/.test(item.getAttribute('media-type')||''))continue;
     const t=chapterText(await readEntry(zip,zipPath(folder,item.getAttribute('href')),budget,signal));count+=Array.from(t).length;if(count>MAX_CHARS)throw Error('본문은 최대 100만 자입니다. 문서를 나눠서 첨부해 주세요.');chapters.push(t);onProgress((i+1)/spine.length);}
    text=chapters.join('\n\n');
   }
  }
  if(signal?.aborted)throw new DOMException('취소됨','AbortError');text=validate(text);onProgress(1);return {text,count:Array.from(text).length,name:file.name};
 }
 const api={read,validate,normalize,decode,markdown,wordText,chapterText,zipPath,MAX_CHARS,MAX_BYTES};root.TypewriterDocuments=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
