import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('html/js/typing-studio-core.js','utf8'),sandbox);
const core=sandbox.TypewriterArt;
// Uniform reference stencils isolate tone/error diffusion from font rasterization.
const samples=core.patterns.map((p,i)=>({mean:i/(core.patterns.length-1)*.7,v:new Float32Array(core.SW*core.SH).fill(i/(core.patterns.length-1)*.7)}));
const cols=16,rows=8;
function pixels(value,alpha=255){const p=new Uint8ClampedArray(cols*core.SW*rows*core.SH*4);for(let i=0;i<p.length;i+=4){p[i]=p[i+1]=p[i+2]=value;p[i+3]=alpha;}return p;}
const run=(rgba,extra={})=>core.match({rgba,cols,rows,...extra},samples);
assert.ok([...run(pixels(255)).choices].every(v=>v===0),'white page must remain blank');
assert.ok([...run(pixels(0,0)).choices].every(v=>v===0),'transparent pixels must composite to white');
const dark=run(pixels(0)),mid=run(pixels(128));
const avg=a=>[...a.choices].reduce((s,v)=>s+samples[v].mean,0)/a.choices.length;
assert.ok(avg(dark)>avg(mid)&&avg(mid)>0,'dark tones must receive more ink');
assert.ok(dark.strikes>cols*rows,'dark area must use overstrikes');
const single=run(pixels(0),{overstrike:false});assert.ok([...single.choices].every(i=>core.patterns[i].length===1),'overstrike switch must constrain candidates');
assert.deepEqual([...mid.choices],[...run(pixels(128)).choices],'same input and settings must produce identical output');
const low=run(pixels(100),{ink:.6}),high=run(pixels(100),{ink:1.4});assert.ok(avg(high)>avg(low),'ink control must alter coverage');
const p=pixels(255);for(let y=0;y<rows*core.SH;y++)for(let x=cols*core.SW/2;x<cols*core.SW;x++){const i=(y*cols*core.SW+x)*4;p[i]=p[i+1]=p[i+2]=0;}
const edge=run(p);let left=0,right=0;for(let i=0;i<edge.choices.length;i++){if(i%cols<cols/2)left+=edge.choices[i];else right+=edge.choices[i];}assert.ok(right>left*4,'spatial structure must survive conversion');
const template=fs.readFileSync('tools/typing_app.html','utf8');for(const id of ['tsStudio','tsFile','tsCanvas','tsPNG','tsPDF','tsPrint','tsShare'])assert.equal((template.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} must be unique`);
console.log('PASS: white/transparent, monotonic tones, overstrike toggle, deterministic output, ink control, spatial structure, unique UI IDs');
// Every strike has the same ink and alpha; tone comes from glyph coverage only.
const ink=[];const pen={fillText(){ink.push([this.fillStyle,this.globalAlpha,this.font]);}};
for(const variation of [-.5,0,.5])core.paint(pen,core.patterns[40],0,0,20,30,variation);
assert.ok(ink.length>0&&ink.every(([color,alpha,font])=>color==='#211f1c'&&alpha===1&&font.includes('LS Studio Courier Prime')),'uniform solid typewriter ink and dedicated font');
console.log('PASS: identical ink color/opacity for every overstrike and variation');
