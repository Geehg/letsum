const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={Uint8ClampedArray,Float32Array};vm.createContext(scope);
vm.runInContext(fs.readFileSync('html/js/typing-dot-core.js','utf8'),scope);
const w=600,h=600,render=scope.DotRetro.render;
function pixels(gray,alpha=255){const rgba=new Uint8ClampedArray(w*h*4);for(let i=0;i<rgba.length;i+=4){rgba[i]=rgba[i+1]=rgba[i+2]=gray;rgba[i+3]=alpha;}return rgba;}
function run(gray,mode,options={}){return render({width:w,height:h,rgba:pixels(gray),settings:{mode,dot:mode==='halftone'?12:2,contrast:100,ink:'#000000',paper:'#ffffff',...options}}).rgba;}
function density(rgba){let count=0;for(let i=0;i<rgba.length;i+=4)if(rgba[i]===0&&rgba[i+3])count++;return count/(rgba.length/4);}
for(const mode of ['grain','diffusion','halftone']){
 assert.equal(density(run(255,mode)),0,`${mode}: white stays paper`);
 assert.equal(density(run(0,mode)),1,`${mode}: black stays ink`);
 const mid=run(128,mode),d=density(mid);assert(d>.4&&d<.6,`${mode}: half tone ${d}`);
 assert(density(run(200,mode))<d&&density(run(60,mode))>d,'monotonic luminance');
 assert.deepEqual(mid,run(128,mode),'deterministic PNG');
 const transparent=render({width:w,height:h,rgba:pixels(0,0),settings:{mode,transparent:true}}).rgba;
 for(let i=3;i<transparent.length;i+=4)assert.equal(transparent[i],0,'fully transparent input never gains ink');
 const paperless=run(255,mode,{transparent:true});for(let i=3;i<paperless.length;i+=4)assert.equal(paperless[i],0);
 assert(density(run(128,mode,{brightness:30}))<d,'brightness reduces ink');
}
const split=pixels(255);for(let y=0;y<h;y++)for(let x=0;x<w/2;x++){const i=(y*w+x)*4;split[i]=split[i+1]=split[i+2]=0;}
const out=render({width:w,height:h,rgba:split,settings:{mode:'diffusion',ink:'#102030',paper:'#ffeedd'}}).rgba;
assert.deepEqual([...out.slice(0,4)],[16,32,48,255]);assert.deepEqual([...out.slice((w-1)*4,w*4)],[255,238,221,255]);
assert.throws(()=>render({width:100000,height:100000,rgba:new Uint8ClampedArray(4)}));
assert.throws(()=>render({width:1,height:1,rgba:new Uint8ClampedArray(3)}));
const template=fs.readFileSync('tools/typing_app.html','utf8');const ids=[...template.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'no duplicate IDs');
console.log('PASS: exact white/black/alpha, tone coverage, monotonicity, determinism, brightness, palette, spatial shape, dimensions, DOM IDs');
