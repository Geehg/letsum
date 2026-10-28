import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const context={};vm.createContext(context);for(const f of ['core','streamlines','flow'])vm.runInContext(fs.readFileSync(`html/js/typing-studio-${f}.js`,'utf8'),context);const c=context.TypewriterArt;
const cols=20,rows=20,W=cols*c.SW,H=rows*c.SH,rgba=new Uint8Array(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=90+Math.round(x/W*65),i=(y*W+x)*4;rgba.set([v,v,v,255],i);}
const gray=c.prepare(rgba,W,H,1,0);assert.ok(Math.min(...gray)<.01&&Math.max(...gray)>.94,'mandatory levels stretch low contrast');
const kit=c.makePatterns('ko','바다와 노인');assert.ok(kit.patterns.flat().every(p=>p.g===' '||'바다와노인'.includes(p.g)));
const gradient=Float32Array.from({length:W*H},(_,i)=>((i%W)+Math.floor(i/W))/(W+H));
const mask={width:2,height:1,data:new Uint8Array([255,0])};
const result=c.flow({cols,rows,choices:new Uint8Array(cols*rows).fill(1)},{...kit,language:'ko',text:'바다와 노인',curve:true,portrait:true,mask},gradient);
assert.ok(result.angles.some(a=>Math.abs(a)>.1),'diagonal direction produces rotation');
for(let y=0;y<rows;y++)for(let x=10;x<cols;x++){assert.equal(result.angles[y*cols+x],0,'background stays horizontal');assert.equal(result.offsets[y*cols+x],0);}
assert.equal(result.marks.flat().slice(0,7).map(s=>s.g).join(''),'바다와 노인바','source order and repeat');
assert.ok(result.offsets.some(x=>Math.abs(x)>0),'baseline follows flow');
const straight=c.flow({cols,rows,choices:new Uint8Array(cols*rows).fill(1)},{...kit,curve:false},gradient);assert.ok(straight.angles.every(x=>x===0));
for(const language of ['en','ko','ja']){const k=c.makePatterns(language);assert.ok(k.patterns.length<256&&k.singles>10);}
console.log('PASS: forced levels, curved baselines, horizontal background mask, text order/repeat, three language alphabets');

// A4 padding must not enter the histogram, and white paper must stay empty.
const width=120,height=90,padded=new Uint8ClampedArray(width*height*4).fill(255);
for(let y=0;y<height;y++)for(let x=20;x<100;x++){const i=(y*width+x)*4,v=70+Math.round((x-20)/79*80);padded[i]=padded[i+1]=padded[i+2]=v;}
const leveled=c.prepare(padded,width,height,1,0,{x:20,y:0,width:80,height});
assert.ok(leveled[45*width+22]<.08&&leveled[45*width+97]>.92,'levels use the image, excluding white padding');
assert.equal(leveled[0],1,'paper margin remains white');
// Glyphs of unequal ink area must retain source order, with bounded overstrikes.
const english=c.makePatterns('en','iMW ');
const samples=english.patterns.map((p,i)=>{const ink=Float32Array.from({length:54},(_,k)=>k%6<i?1:0),v=Float32Array.from(ink,x=>x*(1-33/255));return {ink,v,mean:v.reduce((a,b)=>a+b,0)/54,width:6,height:9};});
const compose=(value,extra={})=>c.flow({cols,rows},{...english,samples,text:'iMW ',language:'en',curve:false,overstrike:true,...extra},new Float32Array(W*H).fill(value));
const white=compose(1,{portrait:true,mask});assert.ok(white.marks.every(a=>a.length===0),'no forced background text on white pixels');
const black=compose(0),middle=compose(.5),light=compose(.72);// Independently rasterize the rectangular synthetic glyphs. Stroke counts alone
// are not coverage: three dense strokes and three separated thin ones differ.
function coverage(plan){let ink=0;for(const marks of plan.marks){for(let y=0;y<20;y++)for(let x=0;x<20;x++){const X=(x+.5)/20,Y=(y+.5)/20;if(marks.some(m=>X>=m.x&&X<m.x+('iMW'.indexOf(m.g)+1)/6&&Y>=m.y&&Y<m.y+1))ink++;}}return ink/(plan.marks.length*400);}
assert.ok(coverage(black)>coverage(middle)&&coverage(middle)>coverage(light),'measured ink produces monotonic tones');
assert.ok(coverage(light)>0&&light.textCharactersUsed>30,'printable light midtones cannot stall at the next dense glyph');
for(const v of [.82,.9,.99,1])assert.ok(compose(v).marks.every(p=>!p.length),'bright areas have no letters');
for(const v of [.82,.9,.99,1])assert.ok(compose(v,{text:''}).marks.every(p=>!p.length),'free glyphs also leave highlights unprinted');
const boundaryGray=Float32Array.from({length:W*H},(_,i)=>i%W<W/2?.05:.9);
const boundaryPlan=c.flow({cols,rows},{...english,samples,text:'iMW',curve:false,overstrike:true},boundaryGray);
assert.ok(boundaryPlan.marks.filter((p,i)=>i%cols>=cols/2).every(p=>!p.length),'dark-neighbor diffusion cannot insert letters into highlights');
assert.ok(boundaryPlan.marks.some(p=>p.length),'dark subject remains printed');
const tones=[0,.4,.64,.7,.78,.82,1].map(c.inkTone);
assert.ok(tones.every((v,i)=>!i||v<=tones[i-1]),'ink response declines smoothly toward reserved highlights');
assert.ok(black.marks.every(a=>a.length<=9),'overstrikes bounded');
assert.ok(compose(0,{overstrike:false}).marks.every(a=>a.length<=1),'single-strike mode');
const actual=middle.marks.flat().map(s=>s.g).join(''),source='iMW';assert.equal(actual,source.repeat(Math.ceil(actual.length/source.length)).slice(0,actual.length),'actual typed characters retain source order');
assert.deepEqual(Array.from(middle.choices),Array.from(compose(.5).choices),'deterministic composition');
const fit=c.imageBounds(600,900,1000,1000,'contain',1),zoom=c.imageBounds(600,900,1000,1000,'contain',1.4);
assert.equal(zoom.width/fit.width,1.4);assert.equal(zoom.width/zoom.height,fit.width/fit.height,'zoom preserves source aspect ratio');
assert.ok(Math.abs(c.imageBounds(600,900,1000,1000,'contain',1.4,0).x)<1e-9);
assert.equal(c.imageBounds(600,900,1000,1000,'contain',1.4,1).x,600-zoom.width,'focal position reaches both crop edges');
const wide=c.imageBounds(600,900,1600,900,'cover',1.2,.7,.3);assert.ok(wide.width>=600&&wide.height>=900,'cover zoom never uncovers paper');
console.log('PASS: image-only levels, white background, measured prose ink/order, bounded layers, deterministic planning, zoom/crop geometry');

// Sharpening a clean step must not invent light/dark halos on either side.
{
 const width=240,height=180,rgba=new Uint8Array(width*height*4);
 for(let i=0;i<width*height;i++){const x=i%width,v=x<80?30:x>160?220:x<120?90:160;rgba.set([v,v,v,255],i*4);}
 const plain=c.prepare(rgba,width,height,1,0),sharp=c.prepare(rgba,width,height,1,.7);
 for(let y=0;y<height;y++)for(let x=82;x<158;x++)assert.ok(Math.abs(plain[y*width+x]-sharp[y*width+x])<.00001,'source step does not gain a bright or dark rim');
 console.log('PASS: halo-free local contrast on a clean brightness edge');
}

// Source offsets consume exactly the supplied sequence without dropping its tail.
const finite=compose(0,{text:'iMWiMW',textOffset:2,repeatText:false});
assert.equal(finite.marks.flat().map(s=>s.g).join(''),'WiMW');
assert.equal(finite.textCharactersUsed,4);assert.equal(finite.textRemaining,0);assert.equal(finite.nextTextOffset,6);assert.equal(finite.textRepeated,false);
const longText='iMW'.repeat(100000),first=compose(0,{text:longText,repeatText:false});
assert.equal(first.textLength,300000);assert.ok(first.textRemaining>0);
const second=compose(0,{text:longText,textOffset:first.nextTextOffset,repeatText:false});
assert.equal(second.marks.flat().map(s=>s.g).join(''),longText.slice(first.nextTextOffset,second.nextTextOffset));
assert.equal(second.textRemaining,longText.length-second.nextTextOffset);
assert.ok(compose(0,{text:'iMW',textOffset:3,repeatText:false}).marks.every(p=>!p.length),'exhausted prose produces no invented letters');
assert.ok(compose(0,{text:'iMW',repeatText:true}).textRepeated,'short prose can explicitly repeat');
console.log('PASS: 300,000-character source, exact continuation, finite text and optional repeat');
