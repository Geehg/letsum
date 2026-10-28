#!/usr/bin/env node
'use strict';
/* OpenCV segmentation worker regression: node tools/check_typing_studio_segmentation.cjs [repo-root]. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const entry=path.join(root,'html/js/typing-studio-segmentation-worker.js');
const messages=[];let imports=0;
const scope=vm.createContext({console,WebAssembly,ArrayBuffer,Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,TextDecoder,TextEncoder,Promise,setTimeout,clearTimeout,performance,atob,btoa,location:{href:'http://localhost/js/typing-studio-segmentation-worker.js'}});
scope.self=scope;
scope.importScripts=(...urls)=>{for(const url of urls){assert(!/^https?:/.test(url),'worker must load same-origin local dependencies');imports++;const filename=path.resolve(path.dirname(entry),url);vm.runInContext(fs.readFileSync(filename,'utf8'),scope,{filename});}};
scope.postMessage=(message,transfers=[])=>{if(message.type==='complete')assert(transfers.includes(message.mask.buffer),'mask buffer must be transferable');messages.push(message)};
vm.runInContext(fs.readFileSync(entry,'utf8'),scope,{filename:entry});
const uiSource=fs.readFileSync(path.join(root,'html/js/typing-studio.js'),'utf8');
const encoder=uiSource.slice(uiSource.indexOf(' function encodeGuidance('),uiSource.indexOf(' function maskData('));
const encode=vm.runInNewContext(encoder+';encodeGuidance',{Uint8Array});
const strokes=new Uint8ClampedArray([255,0,0,255, 0,0,255,255, 128,0,0,255, 0,0,128,255, 128,0,127,255, 0,0,0,255]);
assert.deepEqual([...encode(strokes)],[255,128,0,0,0,0],'antialiased stroke edges cannot flip foreground/background');
const width=240,height=351,n=width*height;
function fixture(){
 const rgba=new Uint8ClampedArray(n*4),mask=new Uint8Array(n),guidance=new Uint8Array(n),truth=new Uint8Array(n);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x;
  const head=((x-112)/46)**2+((y-115)/67)**2<1;
  const body=((x-124)/91)**2+((y-259)/93)**2<1;
  const neck=x>94&&x<134&&y>145&&y<220;
  const subject=head||body||neck;
  rgba.set(subject?[169+(x%5),59+(y%7),34,255]:[31+(x%3),122+(y%4),155,255],i*4);
  mask[i]=((x-120)/87)**2+((y-190)/166)**2<1?255:0;truth[i]=subject?1:0;
 }
 return {width,height,rgba,mask,guidance,bounds:{x:0,y:0,width,height},truth};
}
function score(a,b){let intersection=0,union=0;for(let i=0;i<n;i++){const aa=a[i]>=128,bb=b[i]===1;if(aa&&bb)intersection++;if(aa||bb)union++;}return intersection/union}
async function send(data){const offset=messages.length,start=performance.now();await scope.onmessage({data});const seen=messages.slice(offset);assert(seen.length>0,'worker did not send any response');const terminal=seen.at(-1);assert(['complete','error'].includes(terminal.type),'worker missing terminal response');assert(seen.every(m=>m.id===data.id),'response id mismatch');return {seen,terminal,ms:Math.round(performance.now()-start)}}
async function main(){
 const source=fixture();
 const first=await send({...source,id:1});assert.equal(first.terminal.type,'complete');assert.deepEqual(first.seen.map(x=>x.type),['loading','processing','complete']);assert.equal(imports,1);
 const output=first.terminal.mask;assert.equal(output.length,n);
 let changed=0,soft=0;for(let i=0;i<n;i++){if((output[i]>=128)!==(source.mask[i]>=128))changed++;if(output[i]>0&&output[i]<255)soft++;}
 const before=score(source.mask,source.truth),after=score(output,source.truth);
 assert(changed>n*.10,'segmentation must refine the ellipse significantly');assert(after>.96,'synthetic color object should be recovered');assert(after>before+.10,'refinement must improve object agreement');assert(soft>500&&soft<n*.4,'boundary should contain a bounded soft transition');
 const repeated=await send({...source,id:2});assert.equal(repeated.terminal.type,'complete');assert.deepEqual([...repeated.terminal.mask],[...output],'same input must be deterministic');assert.equal(imports,1,'persistent worker should reuse its initialized OpenCV runtime');
 const manual=fixture();const fgIndices=[],bgIndices=[];
 for(let y=151;y<156;y++)for(let x=11;x<16;x++){const i=y*width+x;manual.guidance[i]=255;fgIndices.push(i)}
 for(let y=111;y<116;y++)for(let x=108;x<113;x++){const i=y*width+x;manual.guidance[i]=128;bgIndices.push(i)}
 const guided=await send({...manual,id:3});assert.equal(guided.terminal.type,'complete');for(const i of fgIndices)assert.equal(guided.terminal.mask[i],255,'foreground guidance must remain solid');for(const i of bgIndices)assert.equal(guided.terminal.mask[i],0,'background guidance must remain empty');
 const malformed=await send({...source,width:239,id:4});assert.equal(malformed.terminal.type,'error');assert.equal(malformed.terminal.reason,'unavailable');
 const allFG=await send({...source,guidance:new Uint8Array(n).fill(255),id:5});assert.equal(allFG.terminal.type,'error');assert.equal(allFG.terminal.reason,'regions');
 const allBG=await send({...source,guidance:new Uint8Array(n).fill(128),id:6});assert.equal(allBG.terminal.type,'error');assert.equal(allBG.terminal.reason,'regions');
 const recovered=await send({...source,id:7});assert.equal(recovered.terminal.type,'complete','input error must not poison worker state');assert.deepEqual([...recovered.terminal.mask],[...output]);assert.equal(imports,1);
 console.log(JSON.stringify({passed:true,worker:path.relative(root,entry),runtime:scope.cv.getBuildInformation().match(/Version control:\s+([^\n]+)/)?.[1],firstMs:first.ms,reusedMs:repeated.ms,guidedMs:guided.ms,changedPixels:changed,softPixels:soft,initialIoU:Number(before.toFixed(4)),refinedIoU:Number(after.toFixed(4)),imports,heapBytes:scope.cv.HEAP8.length,checks:['worker message sequence','transferable mask','color boundary refinement','determinism','hard foreground/background guidance','soft transition','malformed payload','all foreground/background','recovery after errors']},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
