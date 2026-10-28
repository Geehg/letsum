#!/usr/bin/env node
'use strict';
/* Cooperative renderer regression: node tools/check_typing_studio_render.cjs [repo-root]. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const file=path.join(root,'html/js/typing-studio.js');
const source=fs.readFileSync(file,'utf8');
function extract(name){const re=new RegExp('^ (?:async )?function '+name+'\\(','m'),match=re.exec(source);assert(match,'missing '+name);const end=source.indexOf('\n }',match.index);assert(end>match.index,'missing function end for '+name);return source.slice(match.index,end+3)}
let timerCalls=0,paintCost=0,clock=0,created=[];
function target(){const ctx={calls:[],clears:[],fillRect(...args){this.clears.push(args)}};return {width:1240,height:1754,ctx,getContext(){return ctx}}}
const fallbackPatterns=[[],[{g:'x',x:0,y:0}],[{g:'@',x:0,y:0},{g:'#',x:.1,y:.2}]];
const scope=vm.createContext({console,DOMException,performance:{now:()=>clock},setTimeout:cb=>{timerCalls++;return setImmediate(cb)},document:{createElement:type=>{assert.equal(type,'canvas');const c=target();created.push(c);return c}},core:{patterns:fallbackPatterns,paint(ctx,marks,...args){ctx.calls.push({marks:structuredClone(marks),args});clock+=paintCost}}});
vm.runInContext('let plan=null,exportCache=null,exportToken=0;',scope);
vm.runInContext([extract('renderCells'),extract('renderInChunks'),extract('exportCanvas')].join('\n'),scope,{filename:file});
function plan(count=2053,tag='a',withMarks=true){const cols=37,choices=Uint8Array.from({length:count},(_,i)=>i%11===0?0:i%2+1),p={cols,rows:Math.ceil(count/cols),choices,inkColor:'#3b2b24'};if(withMarks)p.marks=Array.from(choices,(v,i)=>v?Array.from({length:i%4+1},(_,j)=>({g:tag+i+'-'+j,x:j*.02,y:j*.015,a:i%3?.07:0})):[]);return p}
function setPlan(p){scope.newPlan=p;vm.runInContext('plan=newPlan',scope)}
function invalidate(){vm.runInContext('exportToken++;exportCache=null',scope)}
async function main(){
 const p=plan(),sync=target(),chunked=target();setPlan(p);scope.renderCells(sync,0,p.choices.length,p);
 const before=timerCalls,progress=[];const pending=scope.renderInChunks(chunked,p.choices.length,p,()=>true,n=>progress.push(n));assert.equal(chunked.ctx.calls.length,0,'render must yield before first batch');assert.equal(await pending,true);
 assert.deepEqual(chunked.ctx.calls,sync.ctx.calls,'chunking must preserve every mark, cell position, variation, ink and call order');assert(timerCalls-before>=Math.ceil(p.choices.length/128),'batch cap must yield across the drawing');assert.equal(progress.at(-1),1);assert(progress.every((n,i)=>i===0||n>progress[i-1]));
 const fallback=plan(417,'fallback',false),a=target(),b=target();scope.renderCells(a,0,fallback.choices.length,fallback);await scope.renderInChunks(b,fallback.choices.length,fallback);assert.deepEqual(b.ctx.calls,a.ctx.calls,'legacy patterns must match');
 paintCost=1;const costly=target(),costlyProgress=[];const costBefore=timerCalls;await scope.renderInChunks(costly,300,p,()=>true,n=>costlyProgress.push(n));assert(timerCalls-costBefore>=Math.ceil(300/16),'time budget must yield before 128-cell cap when painting is costly');paintCost=0;
 let valid=true;const cancelled=target(),cancelProgress=[];assert.equal(await scope.renderInChunks(cancelled,p.choices.length,p,()=>valid,n=>{cancelProgress.push(n);valid=false}),false);assert.equal(cancelProgress.length,1);assert.deepEqual(cancelled.ctx.calls,sync.ctx.calls.slice(0,cancelled.ctx.calls.length),'cancellation must leave an ordered prefix only');
 const never=target();assert.equal(await scope.renderInChunks(never,p.choices.length,p,()=>false),false);assert.equal(never.ctx.calls.length,0);
 // Replacing global plan during a render must never mix two plans.
 const replacement=plan(513,'replacement'),old=target();setPlan(p);let planValid=true;assert.equal(await scope.renderInChunks(old,p.choices.length,p,()=>planValid,()=>{setPlan(replacement);planValid=false}),false);assert.deepEqual(old.ctx.calls,sync.ctx.calls.slice(0,old.ctx.calls.length));
 setPlan(p);invalidate();const countBefore=created.length,export1=scope.exportCanvas(),export2=scope.exportCanvas();assert.equal(export1,export2,'concurrent exports must share one promise');const exported=await export1;assert.equal(created.length,countBefore+1);assert.equal(exported.width,2480);assert.equal(exported.height,3508);assert.equal(await scope.exportCanvas(),exported,'completed export must reuse its canvas');
 const exportExpected=target();exportExpected.width=2480;exportExpected.height=3508;scope.renderCells(exportExpected,0,p.choices.length,p);assert.deepEqual(exported.ctx.calls,exportExpected.ctx.calls,'export canvas must include all ordered marks');
 // Replacement invalidates the old work; its catch must not clear the new cache.
 invalidate();const stale=scope.exportCanvas(),staleRejected=assert.rejects(stale,{name:'AbortError'});setPlan(replacement);invalidate();const fresh=scope.exportCanvas();await staleRejected;assert.equal(scope.exportCanvas(),fresh,'old rejection must preserve the new cache');const freshCanvas=await fresh;assert(freshCanvas.ctx.calls.every(c=>c.marks.every(m=>m.g.startsWith('replacement'))));
 const marks=sync.ctx.calls.reduce((n,c)=>n+c.marks.length,0);
 console.log(JSON.stringify({passed:true,cells:p.choices.length,paintedCells:sync.ctx.calls.length,marks,batches:progress.length,costlyBatches:costlyProgress.length,checks:['exact marks/order/coordinates/ink','legacy fallback patterns','initial yield','bounded batches','time budget','cancellation before and during render','plan replacement','shared export promise/canvas','stale cache invalidation']},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
