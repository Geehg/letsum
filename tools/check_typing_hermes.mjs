import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';
const model=process.argv.includes('--olympia')?'olympiasm3':process.argv.includes('--lettera')?'lettera32':'hermes3000';
const root=fileURLToPath(new URL('..',import.meta.url));const scratch=fs.mkdtempSync(path.join(tmpdir(),'letsum-hermes-check-'));process.on('exit',()=>fs.rmSync(scratch,{recursive:true,force:true}));
fs.copyFileSync(root+'/html/js/vendor/three/three.module.js',path.join(scratch,'hermes-three.mjs'));fs.writeFileSync(path.join(scratch,'hermes-loader.mjs'),fs.readFileSync(root+'/html/js/vendor/three/GLTFLoader.js','utf8').replace("'./three.module.js'","'./hermes-three.mjs'"));
const T=await import(path.join(scratch,'hermes-three.mjs')),{GLTFLoader}=await import(path.join(scratch,'hermes-loader.mjs'));
const b=fs.readFileSync(root+'/html/img/typewriters/hermes3000.glb');const gltf=await new Promise((r,j)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',r,j));const nodes={};gltf.scene.traverse(o=>nodes[o.name]=o);
const events={},observers=[];let now=1000,callbacks=new Map(),rid=0,renders=0,renderedScene;const textureLoads=[];
function el(id){return {id,dataset:{},style:{setProperty(k,v){this[k]=v},getPropertyValue(k){return this[k]||''}},hidden:false,value:'',placeholder:'write',selectionStart:0,scrollHeight:594,scrollTop:0,clientWidth:870,clientHeight:600,parentElement:null,addEventListener(e,f){(events[id+':'+e]??=[]).push(f)},removeEventListener(e,f){events[id+':'+e]=(events[id+':'+e]||[]).filter(x=>x!==f)},appendChild(c){c.parentElement=this},after(c){c.parentElement=this.parentElement},setAttribute(){},dispatchEvent(e){for(const f of events[id+':'+e.type]||[])f(e)},remove(){},focus(){ctx.document.activeElement=this},getContext(){return {measureText(c){return {width:c.codePointAt(0)>127?26:13}},fillRect(){},fillText(){},createRadialGradient(){return {addColorStop(){}}}}}};}
const ids=Object.fromEntries(['tbMain','tbHermesStage','tbHermesView','tbHermesPaper','tbInput','tbInputHome','tbHermesStatus','tbRead','tbHermesFocus','tbHermesCount','tbCount','tbFontW','tbReset','tbOrig','tbMinus','tbPlus'].map(x=>[x,el(x)]));ids.tbMain.dataset={skin:'retro',model};ids.tbInputHome.parentElement=el('original');ids.tbInput.parentElement=ids.tbInputHome.parentElement;ids.tbCount.textContent='0 / 278자';
class Renderer{constructor(){this.domElement=el('canvas');this.shadowMap={}}setPixelRatio(){}setSize(){}render(scene){renderedScene=scene;renders++}dispose(){}}
const doc=el('document');doc.getElementById=id=>ids[id];doc.createElement=id=>el(id);doc.hidden=false;
fs.copyFileSync(root+'/html/js/typing-lettera.js',path.join(scratch,'lettera.mjs'));await import(path.join(scratch,'lettera.mjs'));const buildLettera32=globalThis.LSBuildLettera32;
let thisUsed=false;
fs.copyFileSync(root+'/html/js/typing-olympia.js',path.join(scratch,'olympia.mjs'));await import(path.join(scratch,'olympia.mjs'));const buildOlympiaSM3=globalThis.LSBuildOlympiaSM3;
const ctx={LSBuildOlympiaSM3:(T,root)=>buildOlympiaSM3(T,root,doc),LSBuildLettera32:(T,root)=>buildLettera32(T,root,doc),console,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},document:doc,window:el('window'),devicePixelRatio:1,getComputedStyle:e=>({fontFamily:'monospace',getPropertyValue:k=>e.style.getPropertyValue(k)}),matchMedia:()=>({matches:false}),MutationObserver:class{constructor(f){this.fn=f}observe(e,o){this.entry={e,o,f:this.fn};observers.push(this.entry)}disconnect(){const i=observers.indexOf(this.entry);if(i>=0)observers.splice(i,1)}},IntersectionObserver:class{observe(){}},ResizeObserver:class{observe(){}disconnect(){}},performance:{now:()=>now},requestAnimationFrame:f=>{callbacks.set(++rid,f);return rid},cancelAnimationFrame:id=>callbacks.delete(id),queueMicrotask,THREE:{...T,TextureLoader:class{load(url,onLoad){textureLoads.push(url);const texture=new T.Texture();queueMicrotask(()=>onLoad(texture));return texture;}},WebGLRenderer:Renderer,PMREMGenerator:class{fromScene(){return {texture:new T.Texture(),dispose(){}}}dispose(){}}},GLTFLoader:class{loadAsync(){if(!thisUsed){thisUsed=true;return Promise.resolve(gltf)}return new Promise((r,j)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',r,j))}}};
let source=fs.readFileSync(root+'/html/js/typing-hermes.js','utf8').replace("await import('/js/vendor/three/three.module.js')",'globalThis.THREE').replace("await import('/js/vendor/three/GLTFLoader.js')",'({GLTFLoader:globalThis.GLTFLoader})');vm.runInNewContext(source,ctx);await new Promise(r=>setImmediate(r));
function event(id,e,p={}){for(const f of events[id+':'+e]||[])f(p)}function tick(ms=30){now+=ms;const q=[...callbacks.values()];callbacks.clear();q.forEach(f=>f(now));}
tick();assert.equal(ids.tbInput.parentElement,ids.tbHermesPaper);assert.equal(ids.tbMain.dataset.hermesReady,'true');assert.equal(nodes.Paper.visible,true);assert.equal(nodes.Paper.material.colorWrite,false,'paper masks rear geometry without duplicating HTML text');
assert.equal(Object.values(nodes).filter(o=>o.name.startsWith('Key_')).length,61);assert.equal(Object.values(nodes).filter(o=>/^Typebar_\d+$/.test(o.name)).length,47);assert.equal(nodes.TYPEWRITER_ROOT.scale.x,1);
const removedKeys=['Escape',...Array.from({length:12},(_,i)=>'F'+(i+1)),'PrintScreen','ScrollLock','Pause','Insert','Home','PageUp','Delete','End','PageDown','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'];
for(const code of removedKeys){
 assert(!nodes['Key_'+code]&&!nodes['Cap_'+code]&&!nodes['Glyph_'+code]&&!nodes['Stem_'+code],code+' and all visible parts are absent');
 event('tbInput','keydown',{code});event('document','keyup',{code});
}
gltf.scene.updateMatrixWorld(true);
for(const key of Object.values(nodes).filter(o=>o.name.startsWith('Key_'))){
 assert(Math.abs(key.scale.x-1.28)<1e-6&&key.scale.distanceTo(new T.Vector3(1.28,1.28,1.28))<1e-6,'uniform cap enlargement, no distortion');
 const bounds=new T.Box3().setFromObject(nodes['Cap_'+key.name.slice(4)]);
 assert(bounds.min.x>-.214&&bounds.max.x<.214,'cap fits inside unchanged keyboard recess');
}
const enlargedCaps=new T.Box3();for(const o of Object.values(nodes).filter(o=>o.name.startsWith('Cap_')))enlargedCaps.expandByObject(o);
assert(enlargedCaps.max.x-enlargedCaps.min.x>.39,'remaining keys fill the former navigation area');
assert(Math.abs(enlargedCaps.min.x+enlargedCaps.max.x)<.002,'keyboard is centered');
// The rebuilt enclosure and keycaps must export as closed surfaces, including UV seams.
function assertClosed(name){
 const g=nodes[name].geometry,p=g.attributes.position,idx=g.index?.array||Array.from({length:p.count},(_,i)=>i),edges=new Map();
 const welded=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e7)).join(','));
 for(let i=0;i<idx.length;i+=3){const ids=[welded[idx[i]],welded[idx[i+1]],welded[idx[i+2]]];if(new Set(ids).size<3)continue;for(let j=0;j<3;j++){const e=[ids[j],ids[(j+1)%3]].sort().join('|');edges.set(e,(edges.get(e)||0)+1);}}
 assert([...edges.values()].every(n=>n===2),name+' has no open or multiply joined edges');
}
for(const name of ['Ribbon_Hood','Cast_Perimeter','Bottom_Tray','Black_Keyboard_Well','Cap_Space','Cap_KeyA','Cap_Enter'])assertClosed(name);
const shellBounds=new T.Box3().setFromObject(nodes.Cast_Perimeter),trayBounds=new T.Box3().setFromObject(nodes.Bottom_Tray);
assert(trayBounds.min.x>shellBounds.min.x&&trayBounds.max.x<shellBounds.max.x&&trayBounds.min.z>shellBounds.min.z&&trayBounds.max.z<shellBounds.max.z,'bottom tray is inset within enclosure');

function barSlug(code){const b=Object.values(nodes).find(n=>/^Typebar_\d+$/.test(n.name)&&n.userData.keyCode===code);return b.children.find(n=>n.name.startsWith('TypeSlug_'));}
for(const b of Object.values(nodes).filter(o=>/^Typebar_\d+$/.test(o.name))){
 const restQ=b.quaternion.clone();b.quaternion.copy(b.userData.strike);gltf.scene.updateMatrixWorld(true);
 assert(b.children.find(o=>o.name.startsWith('TypeSlug_')).getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(0,.164,-.119))<.00001,b.name+' strike point');b.quaternion.copy(restQ);
}
const ribbon=nodes.Ribbon_Path_Black, rp=ribbon.geometry.attributes.position;
let center=0,outer=0;for(let i=0;i<rp.count;i++){if(Math.abs(rp.getX(i))<Math.abs(rp.getX(center)))center=i;if(Math.abs(rp.getX(i))>Math.abs(rp.getX(outer)))outer=i;}
const centerRest=rp.getY(center),outerRest=rp.getY(outer),cardRest=nodes.Card_Holder_Left.position.clone();
assert.equal(nodes.Margin_Indicator_Left.parent,nodes.Carriage);assert.equal(nodes.Margin_Indicator_Right.parent,nodes.Carriage);
const rest=nodes.Key_KeyA.position.y;event('tbInput','keydown',{code:'KeyA'});tick(46);assert(nodes.Key_KeyA.position.y<rest-.004);assert(nodes.Ribbon_Guide.position.y>.15);assert(rp.getY(center)>centerRest+.007,'ribbon center reaches printing line');assert.equal(rp.getY(outer),outerRest,'ribbon ends remain at side guides');gltf.scene.updateMatrixWorld(true);const slug=barSlug('KeyA').getWorldPosition(new T.Vector3());assert(slug.distanceTo(new T.Vector3(0,.164,-.119))<.00001,'typebar reaches print point');event('document','keyup',{code:'KeyA'});tick(200);assert.equal(nodes.Key_KeyA.position.y,rest);
ids.tbInput.value='hello';ids.tbInput.selectionStart=5;event('tbInput','input');for(let i=0;i<15;i++)tick();let pos=nodes.Carriage.position.x;assert(pos<.096-.02);assert(nodes.Card_Holder_Left.position.equals(cardRest),'card holder stays body-fixed while carriage moves');assert.match(ids.tbHermesPaper.style.transform,/^matrix/);
event('tbInput','compositionstart');ids.tbInput.value='hello한';ids.tbInput.selectionStart=6;event('tbInput','input');for(let i=0;i<15;i++)tick();assert(Math.abs(nodes.Carriage.position.x-pos)<.0001,'carriage waits during IME composition');event('tbInput','compositionend');for(let i=0;i<15;i++)tick();assert(nodes.Carriage.position.x<pos-.005);
const before=nodes.Carriage.position.x;const sheetBefore=ids.tbHermesPaper.style.transform;const heightBefore=parseFloat(ids.tbHermesPaper.style.height);const angleBefore=nodes.Platen.quaternion.clone();const axis=new T.Vector3(0,1,0).applyQuaternion(nodes.Platen.quaternion);ids.tbInput.value+='\n';ids.tbInput.selectionStart=7;event('tbInput','keydown',{code:'Enter'});event('tbInput','input');event('document','keyup',{code:'Enter'});tick(100);assert(nodes.Return_Lever.quaternion.angleTo(new T.Quaternion())>.1);for(let i=0;i<25;i++)tick();assert(nodes.Carriage.position.x>before+.02);assert(new T.Vector3(0,1,0).applyQuaternion(nodes.Platen.quaternion).distanceTo(axis)<.00001);
assert(parseFloat(ids.tbHermesPaper.style.height)>heightBefore,'paper extends with feed');assert.notEqual(ids.tbHermesPaper.style.transform,sheetBefore,'top edge rises');assert(nodes.Platen.quaternion.angleTo(angleBefore)>.1,'platen turns with feed');
for(const code of ['Space','Backspace','Enter','ShiftLeft','ControlLeft','AltRight','Backslash']){const k=nodes['Key_'+code],y=k.position.y;event('tbInput','keydown',{code});tick(30);assert(k.position.y<y-.004,code+' responds');event('document','keyup',{code});tick(200);assert.equal(k.position.y,y,code+' restores');}
// SM3 raises the carriage, not the basket. HTML sheet and depth-mask rise together.
if(model==='olympiasm3'){
 const paperY=Number(ids.tbHermesPaper.style.transform.slice(7,-1).split(',').at(-1)),basketY=nodes.Typebasket.position.y;
 event('tbInput','keydown',{code:'ShiftLeft'});for(let i=0;i<12;i++)tick();
 assert(nodes.Carriage.position.y>.0059,'SM3 carriage rises for Shift');assert.equal(nodes.Typebasket.position.y,basketY,'SM3 basket stays fixed');
 assert(Number(ids.tbHermesPaper.style.transform.slice(7,-1).split(',').at(-1))<paperY,'HTML sheet follows raised carriage');
 gltf.scene.updateMatrixWorld(true);assert(nodes.Paper.getWorldPosition(new T.Vector3()).y>nodes.Paper.position.y+.0059,'depth mask gets the same lift once');
 event('tbInput','keydown',{code:'ShiftRight'});event('document','keyup',{code:'ShiftLeft'});tick(100);
 assert(nodes.Carriage.position.y>.0059,'other Shift key keeps carriage up');
 event('document','keyup',{code:'ShiftRight'});for(let i=0;i<15;i++)tick();assert(nodes.Carriage.position.y<.00001,'SM3 carriage settles after Shift release');
}
let bells=0;(events['tbInput:tb:hermes-sound']??=[]).push(e=>{if(e.detail.key==='MarginBell')bells++});ids.tbInput.value='a'.repeat(36);ids.tbInput.selectionStart=36;event('tbInput','input');event('tbInput','keyup',{});assert.equal(bells,1,'one bell on approaching margin, no duplicates');
// Immersive mode keeps a fully framed A4 sheet with the instrument enlarged 15% and paper width preserved.
const paperMatrix=()=>ids.tbHermesPaper.style.transform.slice(7,-1).split(',').map(Number);
const standardPixelsPerMeter=paperMatrix()[0]*600/.224;
function assertPaperInFrame(){
 const [sx,,,sy,x,y]=paperMatrix(),w=sx*600,h=sy*parseFloat(ids.tbHermesPaper.style.height);
 const vw=ids.tbHermesView.clientWidth,vh=ids.tbHermesView.clientHeight,previousWidth=.210*1.5*vh/Math.max(.52,.70/(vw/vh));
 const framedWidth=vw>980?Math.min(previousWidth,(vw-464)/1.86):previousWidth;
 assert(Math.abs(w-framedWidth)<1e-7,'paper width preserved unless desktop side panels need space');
 assert(x>=0&&x+w<=ids.tbHermesView.clientWidth,'both side edges stay in frame during carriage travel');
 assert(y>=0&&y+h<=ids.tbHermesView.clientHeight,'whole A4 height stays in frame');
}
// Drive the carriage from the source, including through IME composition.
ids.tbMain.dataset.readingMode='immersive';ids.tbOrig.dataset.source='a'.repeat(25)+'\n'+'b'.repeat(70);
ids.tbInput.value='z'.repeat(12);ids.tbInput.selectionStart=12;
const modeObservers=()=>observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-reading-mode')).forEach(o=>o.f());
modeObservers();tick();const traceHeight=ids.tbHermesPaper.style.height,traceWidth=nodes.Paper.scale.x;
assert(Math.abs(parseFloat(traceHeight)/600-297/210)<1e-8,'A4 aspect ratio');assert(Math.abs(traceWidth*.224-.420/1.15)<1e-8);
assert(Math.abs(paperMatrix()[0]*600/(.420/1.15)/standardPixelsPerMeter-.75*1.15)<1e-8,'instrument is 15% larger than the previous .75x zoom');assertPaperInFrame();
// Full-viewport cloth must preserve the existing paper projection in its content column.
const insetMatrix=paperMatrix();ids.tbHermesView.getBoundingClientRect=()=>({left:24,right:ids.tbHermesView.clientWidth+24});doc.documentElement={clientWidth:ids.tbHermesView.clientWidth+48};
modeObservers();tick();paperMatrix().forEach((v,i)=>assert(Math.abs(v-insetMatrix[i])<1e-7,'edge-to-edge ground keeps paper framing'));
assert.equal(ids.tbHermesView.style['--tb-bleed-left'],'24px');assert.equal(ids.tbHermesView.style['--tb-bleed-right'],'24px');
delete ids.tbHermesView.getBoundingClientRect;delete doc.documentElement;modeObservers();tick();
const [textScale,,,paperYScale]=paperMatrix();
assert(Math.abs(textScale-paperYScale*Number(ids.tbHermesPaper.style['--tb-trace-unskew']))<1e-8,'glyphs have equal horizontal and vertical scale');
assert(Math.abs(parseFloat(ids.tbInput.style.fontSize)*textScale-14)<1e-8,'default immersive font is 14 screen pixels');
ids.tbMain.style.setProperty('--tb-size','10px');modeObservers();tick();
assert(Math.abs(parseFloat(ids.tbInput.style.fontSize)*paperMatrix()[0]-10)<1e-8,'minimum font uses inherited setting without a 28px logical floor');
ids.tbMain.style.setProperty('--tb-size','14px');modeObservers();tick();
assert.equal(ids.tbInput.style.paddingTop,'32px');const tracePosition=nodes.Carriage.position.x;
event('tbInput','compositionstart');ids.tbInput.value+='한';ids.tbInput.selectionStart=13;event('tbInput','input');tick(200);assert.equal(nodes.Carriage.position.x,tracePosition,'tracing also waits for IME commit');event('tbInput','compositionend');tick(300);tick(300);
ids.tbInput.value=ids.tbOrig.dataset.source.slice(0,70);ids.tbInput.selectionStart=70;event('tbInput','input');for(let i=0;i<20;i++)tick();
assert.equal(ids.tbHermesPaper.style.height,traceHeight,'long drafts do not expand the page');
assert(Math.abs(nodes.Paper.position.y-(.174+.594/1.15/2))<1e-9,'trace paper edge stays at the platen');assertPaperInFrame();
for(const [w,h] of [[1052,522],[1069,678],[1392,850],[342,570],[600,260]]){
 ids.tbHermesView.clientWidth=w;ids.tbHermesView.clientHeight=h;
 for(const caret of [0,39,70]){ids.tbInput.selectionStart=caret;modeObservers();tick();assertPaperInFrame();}
}
ids.tbHermesView.clientWidth=870;ids.tbHermesView.clientHeight=600;
const traceDraft=ids.tbInput.value;ids.tbMain.dataset.readingMode='standard';modeObservers();tick();
assert.equal(nodes.Paper.scale.x,1,'standard paper size restores');assert.equal(ids.tbInput.value,traceDraft,'mode switch preserves draft');assert.equal(ids.tbInput.style.paddingBottom,'30px');
// Wood uses the supplied image once, wraps continuously, and restores cloth drape.
const table=renderedScene.getObjectByName('Tablecloth'),tableZ=table.geometry.attributes.position;
function tableStyle(style){ids.tbMain.dataset.table=style;observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-table')).forEach(o=>o.f());tick();}
const tablePosition=table.position.clone(),tableWidth=table.scale.x;tableStyle('wood');
assert.equal(textureLoads.length,1);assert.match(textureLoads[0],/table-light-wood\.png/);
assert.equal(table.material.map.wrapS,T.MirroredRepeatWrapping);assert.equal(table.material.map.wrapT,T.MirroredRepeatWrapping);
assert.equal(table.material.map.repeat.x,4*tableWidth);assert.equal(table.material.bumpMap,null);
for(let i=0;i<tableZ.count;i++)assert.equal(tableZ.getZ(i),0,'wood surface is flat');
assert(table.position.equals(tablePosition),'wood keeps existing table placement');
tableStyle('gingham');assert(Array.from(tableZ.array).some((v,i)=>i%3===2&&Math.abs(v)>.001),'cloth drape restores');
tableStyle('wood');assert.equal(textureLoads.length,1,'wood texture reused');tableStyle('gingham');
const saved=ids.tbInput.value;ids.tbMain.dataset.model='classic12';observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-model')).forEach(o=>o.f());assert.equal(ids.tbInput.parentElement,ids.tbInputHome.parentElement);assert.equal(ids.tbInput.value,saved);assert.equal(ids.tbInput.style.paddingTop,'');assert.equal(ids.tbMain.dataset.hermesReady,'false');
ids.tbMain.dataset.model=model;observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-model')).forEach(o=>o.f());assert.equal(ids.tbInput.parentElement,ids.tbHermesPaper);event('canvas','webglcontextlost',{preventDefault(){}});assert.equal(ids.tbInput.parentElement,ids.tbInputHome.parentElement);assert.equal(ids.tbMain.dataset.hermesFailed,'true');observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-model')).forEach(o=>o.f());assert.equal(ids.tbInput.parentElement,ids.tbInputHome.parentElement,'failure does not reattach input');
if(model==='lettera32'){
 assert.equal(nodes.Ribbon_Hood.material.name,'Lettera_Blue_Enamel');
 assert.equal(nodes.Cap_KeyA.material.name,'Lettera_Keycaps_Contour');
 assert(nodes.Ribbon_Hood.material.clearcoat>.5&&nodes.Ribbon_Hood.material.roughness<.3,'Lettera enamel retains its own gloss');
 assert(nodes.Cap_KeyA.material.clearcoat>.4&&nodes.Cap_KeyA.material.roughness<.3,'Lettera caps retain distinct polished resin');
 const normals=nodes.Ribbon_Hood.geometry.attributes.normal;for(let i=0;i<normals.count;i++){const n=new T.Vector3().fromBufferAttribute(normals,i);assert(Number.isFinite(n.length())&&Math.abs(n.length()-1)<1e-5,'bent cover normals are finite unit vectors');}
 assert.equal(nodes.Hermes_Badge.visible,false);assert.equal(nodes.Selector_Slot.visible,false);assert.equal(nodes.Margin_Indicator_Left.visible,false);
 assert(gltf.scene.getObjectByName('Lettera_Split_Badge'));assert(gltf.scene.getObjectByName('Lettera_Return_Paddle'));assert(gltf.scene.getObjectByName('Lettera_Pica_Scale'));
 assert.equal(gltf.scene.userData.model,'lettera32');
}
if(model==='olympiasm3'){
 assert.equal(nodes.Ribbon_Hood.material.name,'Olympia_Crinkle_Enamel');assert(nodes.Ribbon_Hood.material.bumpMap);
 assert.equal(nodes.Cap_KeyA.material.name,'Olympia_Keycaps_Contour');assert.equal(nodes.Hermes_Badge.visible,false);
 for(const name of ['Olympia_Cover_Chrome','Olympia_Base_Chrome','Olympia_Script_Badge','Olympia_Return_Lever','Olympia_Paper_Support'])assert(gltf.scene.getObjectByName(name),name);
 assert.equal(gltf.scene.getObjectByName('Olympia_Paper_Support').parent,nodes.Carriage);
 assert(Object.values(nodes).filter(o=>o.name.startsWith('Paper_Support')).every(o=>!o.visible),'original paired supports are hidden');
}
if(['olympiasm3','lettera32'].includes(model)){
 // Sweep the conservative lower envelope of the carriage across the full
 // immersive travel range. It must clear both the fixed hood and side cheeks.
 const carriagePosition=nodes.Carriage.position.clone();nodes.Carriage.position.set(0,0,0);gltf.scene.updateMatrixWorld(true);
 const ray=new T.Raycaster(),surfaces=[nodes.Cast_Perimeter,nodes.Ribbon_Hood];
 for(const name of ['Platen_Knob_Left','Platen_Knob_Right','Platen','Carriage_Frame','Carriage_End_Cheek_L','Carriage_End_Cheek_R']){
  const box=new T.Box3();nodes[name].traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)box.expandByPoint(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));});
  for(let step=0;step<=10;step++)for(const x of [box.min.x,(box.min.x+box.max.x)/2,box.max.x])for(const z of [box.min.z,(box.min.z+box.max.z)/2,box.max.z]){
   ray.set(new T.Vector3(x-.157+step*.0314,.3,z),new T.Vector3(0,-1,0));
   const hit=ray.intersectObjects(surfaces,false)[0];
   if(hit)assert(box.min.y-hit.point.y>.001,name+' clears shell throughout carriage travel: '+JSON.stringify({gap:box.min.y-hit.point.y,x:x-.157+step*.0314,z,y:box.min.y,surface:hit.object.name}));
  }
 }
 nodes.Carriage.position.copy(carriagePosition);gltf.scene.updateMatrixWorld(true);

}
// Switch away from a failed model, then repeatedly between all three detailed models.
for(const next of [...['hermes3000','lettera32','olympiasm3'].filter(x=>x!==model),model]){
 ids.tbMain.dataset.model=next;observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-model')).forEach(o=>o.f());
 await new Promise(r=>setImmediate(r));tick();
 assert.equal(ids.tbMain.dataset.hermesReady,'true','new selection recovers from failed context');
 assert.equal(ids.tbInput.value,saved,'model switch retains draft');assert.equal(ids.tbInput.parentElement,ids.tbHermesPaper);
 assert.equal(events['tbInput:keydown'].length,1,'only one model keydown handler after switching');
 assert.equal(events['tbHermesView:tb:hermes-align'].length,1,'one alignment handler after switching');
}
console.log(JSON.stringify({model,passed:['61 independent enlarged keys / 47 bars / no root stretch','same textarea on paper','key and flexible ribbon / stationary side guides', 'carriage margins / body-fixed card holders', 'paper depth mask','closed shell, bed and caps / inset tray','typebar strike point','carriage advances','IME composition waits','Enter lever, paper edge and roller travel','61-key character/modifier mapping','platen axis','switch restores input and draft','single margin bell','immersive instrument +15% / preserved A4 width desktop-mobile / source cursor / IME / restoration','WebGL failure restores native input','model swaps retain draft, recover failure and remove duplicate listeners'],renders,nodes:Object.keys(nodes).length}));
