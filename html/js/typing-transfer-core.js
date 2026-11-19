/* Browser-only record transfer. Never include credentials, sync cursors or other sites' data. */
(function(root){
'use strict';
const P='typebook-v1:', version=1;
const exact=new Set(['imports','days','points','marks','learn','last','skin2','font','trace-font','retro','kb','finger','model-v2','camera']);
const allowed=k=>k==='ls_theme'||k==='letsum-studio-audio-v1'||(k.startsWith(P)&&(exact.has(k.slice(P.length))||/^(progress|fonts|pc):[a-zA-Z0-9_-]{1,160}$/.test(k.slice(P.length))));
const parse=s=>JSON.parse(s,(k,v)=>{if(['__proto__','prototype','constructor'].includes(k))throw Error('허용되지 않는 기록 키입니다.');return v;});
function snapshot(storage){const records={};for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k&&allowed(k))records[k]=storage.getItem(k);}return {format:'goyo-typing-local',version,exportedAt:new Date().toISOString(),records};}
function validate(data){if(!data||data.format!=='goyo-typing-local'||data.version!==version||!data.records||Array.isArray(data.records)||typeof data.records!=='object')throw Error('필사독서 기록 파일이 아닙니다.');if(JSON.stringify(data).length>8*1024*1024||Object.keys(data.records).length>5000)throw Error('기록이 너무 큽니다.');for(const [k,v]of Object.entries(data.records)){if(!allowed(k)||typeof v!=='string')throw Error('허용되지 않는 항목입니다.');if(!['ls_theme',P+'model-v2',P+'camera'].includes(k))parse(v);}return data;}
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
function maxima(a,b){if(typeof a==='number'&&typeof b==='number')return Math.max(a,b);if(Array.isArray(a)&&Array.isArray(b))return a.map((v,i)=>maxima(v,b[i]??v));if(object(a)&&object(b)){const out={...a};for(const[k,v]of Object.entries(b))out[k]=k in out?maxima(out[k],v):v;return out;}return a;}
function merge(k,oldText,newText){if(newText==null)return oldText;if(['ls_theme',P+'model-v2',P+'camera'].includes(k))return newText;const old=parse(oldText),cur=parse(newText),key=k.slice(P.length);
 if(key.startsWith('progress:')&&object(old)&&object(cur)){const recent=(Date.parse(old.updatedAt)||0)>(Date.parse(cur.updatedAt)||0)?old:cur,other=recent===old?cur:old;return JSON.stringify({...other,...recent,completed:[...new Set([...(old.completed||[]),...(cur.completed||[])])].sort((a,b)=>a-b),drafts:{...(other.drafts||{}),...(recent.drafts||{})},metrics:{...(other.metrics||{}),...(recent.metrics||{})}});}
 if(['days','points','learn'].includes(key))return JSON.stringify(maxima(cur,old));
 if(key==='marks'&&object(old)&&object(cur)){const n={...cur};for(const[id,t]of Object.entries(old))if(Math.abs(t)>Math.abs(n[id]||0))n[id]=t;return JSON.stringify(n);}
 if(key==='imports'&&Array.isArray(old)&&Array.isArray(cur)){const n=[...cur];for(const book of old){if(!book||typeof book.id!=='string'||typeof book.text!=='string')throw Error('가져온 글 형식이 올바르지 않습니다.');const existing=n.find(b=>b.id===book.id);if(existing&&existing.text!==book.text)throw Error('같은 ID의 다른 글이 있습니다. 두 주소에서 백업을 받은 뒤 문의해 주세요.');if(!existing)n.push(book);}return JSON.stringify(n);}
 return newText; // Existing destination preferences win. Never discard the source copy.
}
function apply(storage,payload){validate(payload);const before=new Map(),changes=new Map();for(const[k,v]of Object.entries(payload.records)){const cur=storage.getItem(k),next=merge(k,v,cur);if(cur!==next){before.set(k,cur);changes.set(k,next);}}
 // Force a fresh account pull after a local merge, without transferring old account state.
 for(const k of [P+'sync-meta',P+'sync-snap']){before.set(k,storage.getItem(k));}
 try{for(const[k,v]of changes)storage.setItem(k,v);storage.removeItem(P+'sync-meta');storage.removeItem(P+'sync-snap');}catch(e){for(const[k,v]of before){if(v===null)storage.removeItem(k);else storage.setItem(k,v);}throw Error('저장 공간이 부족하거나 기록을 저장할 수 없습니다. 기존 기록은 복원했습니다. 백업 후 다시 시도해 주세요.');}
 return changes.size;
}
const api={allowed,snapshot,validate,merge,apply};if(typeof module!=='undefined')module.exports=api;else root.TypingTransfer=api;
})(typeof window==='undefined'?this:window);
