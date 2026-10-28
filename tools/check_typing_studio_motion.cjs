const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('html/js/typing-studio.js','utf8');
function extract(name){const start=source.search(new RegExp('^ (?:async )?function '+name+'\\(','m'));const end=source.indexOf('\n }',start);assert(start>=0&&end>start);return source.slice(start,end+3);}
function run(strikesPerCell,step){
 const cols=160,rows=156,total=cols*rows,counts=Uint32Array.from({length:total+1},(_,i)=>i*strikesPerCell),sounds=[],copies=[];
 const c=vm.createContext({performance:{now:()=>0},Math});
 c.input={cols,rows,counts,total,sounds,copies,strikesPerCell};
 vm.runInContext(`const {cols,rows,counts,total,sounds,copies,strikesPerCell}=input;
 const PLAYBACK_MS=3600;let playing=true,active=true,cursor=0,layer=0,typed=0,phase='strike',feedRow=0,frame=0,completedAt=null;
 const plan={cols,rows,choices:new Uint8Array(total).fill(1),strikes:counts[total]};
 const playback={elapsed:0,stamp:0,counts,sheet:{},lastHit:-Infinity,lastReturn:-Infinity};
 const canvas={width:1240,height:1754};const ctx={fillRect(){},save(){},beginPath(){},rect(){},clip(){},restore(){},drawImage(...a){copies.push(a);}};
 const patternAt=()=>Array.from({length:strikesPerCell},()=>({g:'x'}));
 const machine={hit(){},returnCarriage(){}};const audio={hit:()=>sounds.push('hit'),carriage:()=>sounds.push('return'),feed:()=>sounds.push('feed')};
 const progress=()=>{},requestAnimationFrame=()=>1,complete=()=>{playing=false;completedAt=playback.elapsed;};
 ${extract('revealPlayback')}
 ${extract('tick')}
 globalThis.state=()=>({cursor,typed,elapsed:playback.elapsed,completedAt,playing});
 globalThis.pauseFor=(ms)=>{playback.stamp+=ms;};`,c);
 for(let t=0;t<=4000;t+=step)c.tick(t);
 const s=c.state();assert.equal(s.cursor,total);assert.equal(s.typed,total*strikesPerCell);assert(s.completedAt>=3600&&s.completedAt<=3800,'all cells finish within four seconds at varying refresh rates');
 assert(sounds.filter(s=>s==='hit').length<=81,'bounded sound count regardless of strike count');assert(sounds.filter(s=>s==='return').length<=14);
 assert.equal(copies.at(-1).length,3,'last frame copies full raster without clipping');
 return {strikes:total*strikesPerCell,frameMs:step,completedMs:s.completedAt,sounds:sounds.length};
}
const results=[run(1,16),run(9,16),run(9,100)];
assert.equal(results[0].completedMs,results[1].completedMs,'duration is independent of image density');
assert(!source.includes("$('tsSpeed')"),'old per-strike speed must not extend playback');
console.log('PASS: full raster, fixed deadline, low refresh rate, exact counts, bounded audio',JSON.stringify(results));
