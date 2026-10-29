import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';
const model=process.argv.includes('--olympia')?'olympiasm3':process.argv.includes('--lettera')?'lettera32':'hermes3000';
const root=fileURLToPath(new URL('..',import.meta.url));const scratch=fs.mkdtempSync(path.join(tmpdir(),'letsum-hermes-check-'));process.on('exit',()=>fs.rmSync(scratch,{recursive:true,force:true}));
fs.copyFileSync(root+'/html/js/vendor/three/three.module.js',path.join(scratch,'hermes-three.mjs'));fs.writeFileSync(path.join(scratch,'hermes-loader.mjs'),fs.readFileSync(root+'/html/js/vendor/three/GLTFLoader.js','utf8').replace("'./three.module.js'","'./hermes-three.mjs'"));
const T=await import(path.join(scratch,'hermes-three.mjs')),{GLTFLoader}=await import(path.join(scratch,'hermes-loader.mjs'));
const b=fs.readFileSync(root+'/html/img/typewriters/hermes3000.glb');const gltf=await new Promise((r,j)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',r,j));const nodes={};gltf.scene.traverse(o=>nodes[o.name]=o);
const events={},observers=[];let now=1000,callbacks=new Map(),rid=0,renders=0,sizeChanges=0,renderedScene,renderedCamera;const textureLoads=[];let failNextLoad=false,throwNextRender=false,releasedContexts=0,delayNextLoad=false,releaseDelayedLoad;
function el(id){return {id,children:[],dataset:{},style:{setProperty(k,v){this[k]=v},getPropertyValue(k){return this[k]||''}},hidden:false,value:'',placeholder:'write',selectionStart:0,scrollHeight:594,scrollTop:0,clientWidth:870,clientHeight:600,parentElement:null,addEventListener(e,f){(events[id+':'+e]??=[]).push(f)},removeEventListener(e,f){events[id+':'+e]=(events[id+':'+e]||[]).filter(x=>x!==f)},appendChild(c){c.parentElement=this},after(c){c.parentElement=this.parentElement},setAttribute(){},dispatchEvent(e){for(const f of events[id+':'+e.type]||[])f(e)},remove(){},focus(){ctx.document.activeElement=this},getContext(){return {measureText(c){return {width:c.codePointAt(0)>127?26:13}},fillRect(){},fillText(){},createRadialGradient(){return {addColorStop(){}}}}}};}
const ids=Object.fromEntries(['tbMain','tbHermesStage','tbHermesView','tbHermesPaper','tbInput','tbInputHome','tbHermesStatus','tbRead','tbHermesFocus','tbHermesCount','tbCount','tbFontW','tbReset','tbOrig','tbMinus','tbPlus','tbHermesLoading','tbHermesLoadingText','tbHermesRetry'].map(x=>[x,el(x)]));ids.tbMain.dataset={skin:'retro',model};ids.tbInputHome.parentElement=el('original');ids.tbInput.parentElement=ids.tbInputHome.parentElement;ids.tbCount.textContent='0 / 278자';
class Renderer{constructor(){this.domElement=el('canvas');this.shadowMap={}}setPixelRatio(){}setSize(){sizeChanges++}render(scene,camera){if(throwNextRender){throwNextRender=false;throw new Error('simulated render failure');}renderedScene=scene;renderedCamera=camera;renders++}dispose(){}forceContextLoss(){releasedContexts++}}
const doc=el('document');doc.getElementById=id=>ids[id];doc.createElement=id=>el(id);doc.hidden=false;
fs.copyFileSync(root+'/html/js/typing-lettera.js',path.join(scratch,'lettera.mjs'));await import(path.join(scratch,'lettera.mjs'));const buildLettera32=globalThis.LSBuildLettera32;
let thisUsed=false;
fs.copyFileSync(root+'/html/js/typing-olympia.js',path.join(scratch,'olympia.mjs'));await import(path.join(scratch,'olympia.mjs'));const buildOlympiaSM3=globalThis.LSBuildOlympiaSM3;
fs.copyFileSync(root+'/html/js/typing-details.js',path.join(scratch,'details.mjs'));await import(path.join(scratch,'details.mjs'));

// Geometry-only decode in Node: browser QA separately verifies embedded PBR images.
async function loadLetteraGeometry(url){
 const data=fs.readFileSync(root+'/html/img/typewriters/reference/'+(url.includes('olympiasm3')?'olympiasm3':'lettera32')+'-reference.glb'),size=data.readUInt32LE(12),json=JSON.parse(data.subarray(20,20+size));
 function strip(o){if(!o||typeof o!=='object')return;for(const k of Object.keys(o)){if(k.endsWith('Texture'))delete o[k];else strip(o[k]);}}strip(json.materials);delete json.images;delete json.textures;
 let body=Buffer.from(JSON.stringify(json));body=Buffer.concat([body,Buffer.alloc((4-body.length%4)%4,32)]);const tail=data.subarray(20+size),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+body.length+tail.length,8);header.writeUInt32LE(body.length,12);header.writeUInt32LE(0x4e4f534a,16);const packed=Buffer.concat([header,body,tail]);return new Promise((r,j)=>new GLTFLoader().parse(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength),'',r,j));
}
const ctx={setTimeout,clearTimeout,LSRefineTypewriterDetails:globalThis.LSRefineTypewriterDetails,LSBuildOlympiaSM3:(T,root)=>buildOlympiaSM3(T,root,doc),LSBuildLettera32:(T,root)=>buildLettera32(T,root,doc),console,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},document:doc,window:el('window'),devicePixelRatio:1,getComputedStyle:e=>({fontFamily:'monospace',getPropertyValue:k=>e.style.getPropertyValue(k)}),matchMedia:()=>({matches:false}),MutationObserver:class{constructor(f){this.fn=f}observe(e,o){this.entry={e,o,f:this.fn};observers.push(this.entry)}disconnect(){const i=observers.indexOf(this.entry);if(i>=0)observers.splice(i,1)}},IntersectionObserver:class{observe(){}},ResizeObserver:class{observe(){}disconnect(){}},performance:{now:()=>now},requestAnimationFrame:f=>{callbacks.set(++rid,f);return rid},cancelAnimationFrame:id=>callbacks.delete(id),queueMicrotask,THREE:{...T,TextureLoader:class{load(url,onLoad){textureLoads.push(url);const texture=new T.Texture();queueMicrotask(()=>onLoad(texture));return texture;}},WebGLRenderer:Renderer,PMREMGenerator:class{fromScene(){return {texture:new T.Texture(),dispose(){}}}dispose(){}}},GLTFLoader:class{loadAsync(url){if(url?.includes('lettera32-reference')||url?.includes('olympiasm3-reference'))return loadLetteraGeometry(url);if(url?.includes('hermes-return-lever')){const data=fs.readFileSync(root+'/html/img/typewriters/reference/hermes-return-lever.glb');return new Promise((r,j)=>new GLTFLoader().parse(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'',r,j));}if(delayNextLoad){delayNextLoad=false;return new Promise(resolve=>{releaseDelayedLoad=()=>resolve(new ctx.GLTFLoader().loadAsync());});}if(failNextLoad){failNextLoad=false;return Promise.reject(new Error('simulated model download failure'));}if(!thisUsed){thisUsed=true;return Promise.resolve(gltf)}return new Promise((r,j)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',r,j))}}};
vm.runInNewContext(fs.readFileSync(root+'/html/js/typing-lettera-reference.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync(root+'/html/js/typing-olympia-reference.js','utf8'),ctx);
let source=fs.readFileSync(root+'/html/js/typing-hermes.js','utf8').replace("await import('/js/vendor/three/three.module.js')",'globalThis.THREE').replace("await import('/js/vendor/three/GLTFLoader.js')",'({GLTFLoader:globalThis.GLTFLoader})');vm.runInNewContext(fs.readFileSync(root+'/html/js/typing-surfaces.js','utf8'),ctx);vm.runInNewContext(fs.readFileSync(root+'/html/js/typing-badges.js','utf8'),ctx);vm.runInNewContext(source,ctx);await new Promise(r=>setImmediate(r));
function event(id,e,p={}){for(const f of events[id+':'+e]||[])f(p)}function tick(ms=30){now+=ms;const q=[...callbacks.values()];callbacks.clear();q.forEach(f=>f(now));}
tick();assert.equal(ids.tbInput.parentElement,ids.tbHermesPaper);assert.equal(ids.tbMain.dataset.hermesReady,'true');assert.equal(nodes.Paper.visible,true);assert.equal(nodes.Paper.material.colorWrite,false,'paper masks rear geometry without duplicating HTML text');
if(model==='hermes3000'){
 const replacement=gltf.scene.getObjectByName('Hermes_Reference_Return');
 assert(replacement&&replacement.parent===nodes.Return_Lever,'new lever follows the existing animated return pivot');
 assert(replacement.getObjectByName('Return_lever')?.isMesh,'reference lever geometry loaded');
 assert.equal(nodes.Return_Lever_Chrome.visible,false,'old shaft hidden');
 assert.equal(nodes.Return_Lever_Paddle.visible,false,'old paddle hidden');
 assert(!replacement.getObjectByName('Key_R0_00'),'part asset does not duplicate the keyboard');
}else assert(!gltf.scene.getObjectByName('Hermes_Reference_Return'),'other models retain their own levers');
assert(textureLoads.includes(`/img/typewriters/surfaces/${model}-relief-v1.webp`),'chosen model loads its own relief');
for(const name of ['Ribbon_Hood','Cast_Perimeter','Cap_KeyA','Cap_Space']){
 const mesh=nodes[name],g=mesh.geometry,m=mesh.material;
 assert(m.userData.surface,'paint and key surfaces are mapped');
 assert.equal(g.attributes.surfacePosition.count,g.attributes.position.count);
 assert([...g.attributes.surfacePosition.array,...g.attributes.surfaceNormal.array].every(Number.isFinite));
 assert.equal(m.bumpMap.encoding,T.LinearEncoding);assert.equal(m.bumpMap.wrapS,T.MirroredRepeatWrapping);
 const rest=g.attributes.surfacePosition.array.slice();mesh.position.x+=.001;mesh.updateMatrixWorld(true);
 assert.deepEqual(g.attributes.surfacePosition.array,rest,'grain remains attached during movement');mesh.position.x-=.001;
 const shader={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};m.onBeforeCompile(shader);
 assert(shader.fragmentShader.includes('perturbNormalArb(-vViewPosition'));assert(shader.vertexShader.includes('surfacePosition'));
}
const silverMaterials=new Set();gltf.scene.traverse(o=>{if(o.isMesh&&o.material?.userData.surface?.kind==='metal')silverMaterials.add(o.material);});
assert(silverMaterials.size>=3,'rails, badges and mechanisms use the shared silver treatment');
for(const m of silverMaterials){assert.equal(m.metalness,1);assert(m.color.r>=.19&&m.color.r<=.28&&m.color.b<=.32,'silver midtones stay restrained');assert(m.roughness<=.27,'metal keeps defined reflection contrast');}
if(model==='hermes3000'){const emblem=gltf.scene.getObjectByName('Reference_Emblem');assert(emblem?.visible,'generated emblem is visible after load');assert(textureLoads.includes(`/img/typewriters/badges/${model}-v1.png`));assert(emblem.material.transparent&&emblem.material.alphaTest>0,'emblem preserves transparent contours');assert([...emblem.geometry.attributes.position.array].every(Number.isFinite),'emblem surface projection is finite');assert.equal(emblem.material.map.encoding,T.sRGBEncoding);}
if(model==='lettera32'){const replacement=renderedScene.getObjectByName('Lettera_Reference_Integrated');assert(replacement,'full reference model loaded');assert.equal(nodes.Ribbon_Hood.visible,false,'old shell hidden');assert.equal(nodes.Cap_KeyA.visible,false,'old keys hidden');let count=0;replacement.traverse(o=>{if(o.userData.key_code)count++;});assert.equal(count,50);}
if(model==='olympiasm3'){const replacement=renderedScene.getObjectByName('Olympia_Reference_Integrated');assert(replacement,'new Olympia loaded');assert.equal(nodes.Ribbon_Hood.visible,false);let count=0;replacement.traverse(o=>{if(o.userData.key_code)count++;});assert.equal(count,51);assert(replacement.getObjectByName('Reference_emblem').material.alphaTest>.3);}
const wall=renderedScene.getObjectByName('Rear_Wall_Shadow');
assert(wall?.receiveShadow&&wall.material.isShadowMaterial,'rear wall receives real projected shadows without painting the background');
assert(!wall.material.depthWrite,'wall cannot occlude the HTML paper depth mask');
assert(nodes.Paper.castShadow&&!nodes.Paper.material.colorWrite,'the visible sheet casts a shadow without a duplicate paper rendering');
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
assert(enlargedCaps.max.x-enlargedCaps.min.x>.39*.9,'remaining keys fill the former navigation area');
assert(Math.abs(enlargedCaps.min.x+enlargedCaps.max.x)<.002,'keyboard is centered');
const bodyPose=gltf.scene.getObjectByName('Typewriter_Body_Pose'),bodyScale=new T.Vector3(),bodyPosition=new T.Vector3(),bodyRotation=new T.Quaternion();
bodyPose.matrix.decompose(bodyPosition,bodyRotation,bodyScale);
assert(bodyScale.distanceTo(new T.Vector3(.9,.9,.9))<1e-9,'body reduces uniformly by 10 percent');
assert(Math.abs(new T.Euler().setFromQuaternion(bodyRotation).x-Math.PI/60)<1e-9,'body-only top view is three degrees');
assert(new T.Vector3(0,.164,-.119).applyMatrix4(bodyPose.matrix).distanceTo(new T.Vector3(0,.164,-.119))<1e-9,'body pose keeps the printing point fixed');
assert.equal(nodes.Carriage.parent,gltf.scene,'carriage and paper remain outside body reduction');
for(const side of ['Left','Right']){const holder=nodes['Card_Holder_'+side];holder.geometry.computeBoundingBox();const b=holder.geometry.boundingBox;
 assert(Math.abs(b.max.x-b.min.x-.094*1.1)<1e-7,'holder width grows ten percent');
 assert(Math.abs((side==='Left'?b.max.x:b.min.x)-(side==='Left'?-.014:.014))<1e-7,'holder keeps its inner printing gap');
 assert.equal(holder.parent,gltf.scene,'holder does not shrink with the body');}
assert(!renderedScene.getObjectByName('Typing_Progress_Inset'),'old counter plate is removed');

// The rebuilt enclosure and keycaps must export as closed surfaces, including UV seams.
function assertClosed(name){
 const g=nodes[name].geometry,p=g.attributes.position,idx=g.index?.array||Array.from({length:p.count},(_,i)=>i),edges=new Map();
 const welded=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e7)).join(','));
 for(let i=0;i<idx.length;i+=3){const ids=[welded[idx[i]],welded[idx[i+1]],welded[idx[i+2]]];if(new Set(ids).size<3)continue;for(let j=0;j<3;j++){const e=[ids[j],ids[(j+1)%3]].sort().join('|');edges.set(e,(edges.get(e)||0)+1);}}
 assert([...edges.values()].every(n=>n===2),name+' has no open or multiply joined edges');
}
for(const name of ['Ribbon_Hood','Cast_Perimeter','Bottom_Tray','Black_Keyboard_Well','Cap_Space','Cap_KeyA','Cap_Enter'])assertClosed(name);
// Probe the actual cut-out, not only welded topology: bevels must not bridge the opening.
const opening=nodes.Ribbon_Hood.userData.opening,cutRay=new T.Raycaster(),outline=opening.points;
const inside=(x,z)=>{let yes=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const [a,b]=outline[i],[c,d]=outline[j];if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)yes=!yes;}return yes;};
let voidSamples=0;gltf.scene.updateMatrixWorld(true);
for(let x=-.12;x<=.12;x+=.008)for(let z=-.14;z<=-.065;z+=.006){
 if(!inside(x,z)||outline.some(([a,b])=>Math.hypot(a-x,b-z)<.004))continue;
 const hood=nodes.Ribbon_Hood,origin=new T.Vector3(x,.4,z).applyMatrix4(hood.matrixWorld),direction=new T.Vector3(0,-1,0).transformDirection(hood.matrixWorld);cutRay.set(origin,direction);
 assert.equal(cutRay.intersectObject(hood,false).length,0,'cut-out contains no unwanted cap/overlapping bevel');voidSamples++;
}
assert(voidSamples>40,'opening has a substantial unobstructed interior');
const flange=gltf.scene.getObjectByName('Opening_Folded_Flange');assert(flange,'opening has a separate downturned inner edge');nodes.Opening_Folded_Flange=flange;assertClosed('Opening_Folded_Flange');
for(const name of ['Carriage_End_Cheek_L','Carriage_End_Cheek_R'])assertClosed(name);
assert(gltf.scene.getObjectByName('Carriage_Bearing_Collar_L'),'bearing is a separate part');
// Cap crowns are closed even at the long center of the space bar, with smooth finite normals.
const detailRay=new T.Raycaster();gltf.scene.updateMatrixWorld(true);
for(const name of ['Cap_KeyA','Cap_Space','Cap_Enter']){
 const cap=nodes[name],n=cap.geometry.attributes.normal;
 for(let i=0;i<n.count;i++){const v=new T.Vector3().fromBufferAttribute(n,i);assert(Number.isFinite(v.length())&&Math.abs(v.length()-1)<1e-5,'cap tangent normals stay normalized');}
 const at=new T.Vector3(0,.04,0).applyMatrix4(cap.matrixWorld),dir=new T.Vector3(0,-1,0).transformDirection(cap.matrixWorld);detailRay.set(at,dir);assert(detailRay.intersectObject(cap,false).length>0,'crown has an outward-facing solid center: '+name);
}
if(model==='hermes3000'){
 assert.equal(nodes.Badge_Frame.material.metalness,1);assert.equal(nodes.Hermes_Badge.material.metalness,1);
 assert(nodes.Ribbon_Hood.geometry.attributes.position.count>10000,'rebuilt curved cover has interior surface samples');
 const n=nodes.Ribbon_Hood.geometry.attributes.normal;for(let i=0;i<n.count;i++)assert(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5,'deformed cover keeps unit normals');
 const badgeRay=new T.Raycaster(),badge=nodes.Badge_Frame,normal=new T.Vector3(0,0,1).transformDirection(badge.matrixWorld),bp=badge.geometry.attributes.position;
 for(const i of [0,Math.floor(bp.count/3),Math.floor(bp.count*2/3),bp.count-1]){
  const point=new T.Vector3().fromBufferAttribute(bp,i).applyMatrix4(badge.matrixWorld);badgeRay.set(point.clone().addScaledVector(normal,.03),normal.clone().negate());const hit=badgeRay.intersectObject(nodes.Ribbon_Hood,false)[0];assert(hit&&hit.distance>.0298,'badge frame stays above the sloping cover');
 }
 const dividers=[];gltf.scene.traverse(o=>{if(o.name.startsWith('Hermes_Segment_Divider_'))dividers.push(o);});assert.equal(dividers.length,48,'fixed segment remains separate from animated typebars');
 assert(nodes.Cap_KeyA.material.envMapIntensity>.5,'key reflections remain visible');
 assert(nodes.Ribbon_Hood.material.color.g<.30,'sage paint keeps its midtone');
 assert(shadowLightForCheck().shadow.normalBias<.0002,'fine gaps do not lose their contact shadow');
}
function shadowLightForCheck(){return renderedScene.children.find(o=>o.isDirectionalLight&&o.castShadow);}
if(model==='lettera32')assert(gltf.scene.getObjectByName('Lettera_Badge_Backing'),'split badge has a solid metal edge');
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
let referenceKey,referenceY;if(model!=='hermes3000'){renderedScene.getObjectByName(model==='olympiasm3'?'Olympia_Reference_Integrated':'Lettera_Reference_Integrated').traverse(o=>{if(o.userData.key_code==='KeyA')referenceKey=o;});referenceY=referenceKey.position.y;}
const rest=nodes.Key_KeyA.position.y;event('tbInput','keydown',{code:'KeyA'});tick(46);assert(nodes.Key_KeyA.position.y<rest-.004);if(referenceKey)assert(referenceKey.position.y<referenceY-.003,'visible reference key depresses');assert(nodes.Ribbon_Guide.position.y>.15);assert(rp.getY(center)>centerRest+.007,'ribbon center reaches printing line');assert.equal(rp.getY(outer),outerRest,'ribbon ends remain at side guides');gltf.scene.updateMatrixWorld(true);const slug=barSlug('KeyA').getWorldPosition(new T.Vector3());assert(slug.distanceTo(new T.Vector3(0,.164,-.119))<.00001,'typebar reaches print point');event('document','keyup',{code:'KeyA'});tick(200);assert.equal(nodes.Key_KeyA.position.y,rest);
ids.tbInput.value='hello';ids.tbInput.selectionStart=5;event('tbInput','input');for(let i=0;i<15;i++)tick();let pos=nodes.Carriage.position.x;if(model==='lettera32')assert(Math.abs(renderedScene.getObjectByName('Lettera_Reference_Integrated').getObjectByName('Carriage').position.x*1.22-pos)<1e-6,'visible reference carriage tracks typing');assert(pos<.096-.02);assert(nodes.Card_Holder_Left.position.equals(cardRest),'card holder stays body-fixed while carriage moves');assert.match(ids.tbHermesPaper.style.transform,/^matrix/);
event('tbInput','compositionstart');ids.tbInput.value='hello한';ids.tbInput.selectionStart=6;event('tbInput','input');for(let i=0;i<15;i++)tick();assert(Math.abs(nodes.Carriage.position.x-pos)<.0001,'carriage waits during IME composition');event('tbInput','compositionend');for(let i=0;i<15;i++)tick();assert(nodes.Carriage.position.x<pos-.005);
const before=nodes.Carriage.position.x;const sheetBefore=ids.tbHermesPaper.style.transform;const heightBefore=parseFloat(ids.tbHermesPaper.style.height);const angleBefore=nodes.Platen.quaternion.clone();const axis=new T.Vector3(0,1,0).applyQuaternion(nodes.Platen.quaternion);ids.tbInput.value+='\n';ids.tbInput.selectionStart=7;event('tbInput','keydown',{code:'Enter'});event('tbInput','input');event('document','keyup',{code:'Enter'});tick(100);if(model==='lettera32')assert(renderedScene.getObjectByName('Reference_Return_Pivot').rotation.x<-.3,'visible reference lever returns');assert(nodes.Return_Lever.quaternion.angleTo(new T.Quaternion())>.1);for(let i=0;i<25;i++)tick();assert(nodes.Carriage.position.x>before+.02);assert(new T.Vector3(0,1,0).applyQuaternion(nodes.Platen.quaternion).distanceTo(axis)<.00001);
assert(parseFloat(ids.tbHermesPaper.style.height)>heightBefore,'paper extends with feed');assert.notEqual(ids.tbHermesPaper.style.transform,sheetBefore,'top edge rises');assert(nodes.Platen.quaternion.angleTo(angleBefore)>.1,'platen turns with feed');
for(const code of ['Space','Backspace','Enter','ShiftLeft','ControlLeft','AltRight','Backslash']){const k=nodes['Key_'+code],y=k.position.y;event('tbInput','keydown',{code});tick(30);assert(k.position.y<y-.004,code+' responds');event('document','keyup',{code});tick(200);assert.equal(k.position.y,y,code+' restores');}
// SM3 raises the carriage, not the basket. HTML sheet and depth-mask rise together.
if(model==='olympiasm3'){
 const paperY=Number(ids.tbHermesPaper.style.transform.slice(7,-1).split(',').at(-1)),basketY=nodes.Typebasket.position.y;
 event('tbInput','keydown',{code:'ShiftLeft'});for(let i=0;i<12;i++)tick();assert(renderedScene.getObjectByName('Olympia_Reference_Integrated').getObjectByName('Carriage').position.y>.005,'reference carriage rises during shift');
 assert(nodes.Carriage.position.y>.0059,'SM3 carriage rises for Shift');assert.equal(nodes.Typebasket.position.y,basketY,'SM3 basket stays fixed');
 assert(Number(ids.tbHermesPaper.style.transform.slice(7,-1).split(',').at(-1))<paperY,'HTML sheet follows raised carriage');
 gltf.scene.updateMatrixWorld(true);assert(nodes.Paper.getWorldPosition(new T.Vector3()).y>nodes.Paper.position.y+.0059,'depth mask gets the same lift once');
 event('tbInput','keydown',{code:'ShiftRight'});event('document','keyup',{code:'ShiftLeft'});tick(100);
 assert(nodes.Carriage.position.y>.0059,'other Shift key keeps carriage up');
 event('document','keyup',{code:'ShiftRight'});for(let i=0;i<15;i++)tick();assert(nodes.Carriage.position.y<.00001,'SM3 carriage settles after Shift release');
}
let bells=0;(events['tbInput:tb:hermes-sound']??=[]).push(e=>{if(e.detail.key==='MarginBell')bells++});ids.tbInput.value='a'.repeat(36);ids.tbInput.selectionStart=36;event('tbInput','input');event('tbInput','keyup',{});assert.equal(bells,0,'carriage must not emit an early margin bell');
// Immersive mode keeps a fully framed A4 sheet with the instrument enlarged 15% and paper width preserved.
const paperMatrix=()=>ids.tbHermesPaper.style.transform.slice(7,-1).split(',').map(Number);
const standardPixelsPerMeter=paperMatrix()[0]*600/.224;
function assertPaperInFrame(){
 const [sx,,,sy,x,y]=paperMatrix(),w=sx*600,h=sy*parseFloat(ids.tbHermesPaper.style.height);
 const vw=ids.tbHermesView.clientWidth,vh=ids.tbHermesView.clientHeight,previousWidth=.210*1.5*vh/Math.max(.52,.70/(vw/vh));
 const framedWidth=vw>980?Math.min(previousWidth,(vw-464)/1.86):previousWidth;
 assert(w>0&&w<=framedWidth+1e-7,'paper fits available space with the entire body visible');
 assert(x>=0&&x+w<=ids.tbHermesView.clientWidth,'both side edges stay in frame during carriage travel');
 assert(y>=0&&y+h<=ids.tbHermesView.clientHeight,'whole A4 height stays in frame');
 const counterX=parseFloat(ids.tbHermesCount.style.left),counterY=parseFloat(ids.tbHermesCount.style.top),counterW=parseFloat(ids.tbHermesCount.style.width);
 assert(counterX>=0&&counterX+counterW<=vw,'progress stays horizontally inside the view');
 assert(counterX>=x+w||counterY+20<=y,'progress is outside the paper');

}
// Drive the carriage from the source, including through IME composition.
ids.tbMain.dataset.readingMode='immersive';ids.tbOrig.dataset.source='a'.repeat(25)+'\n'+'b'.repeat(70);
ids.tbInput.value='z'.repeat(12);ids.tbInput.selectionStart=12;
const modeObservers=()=>observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-reading-mode')).forEach(o=>o.f());
modeObservers();tick();const traceHeight=ids.tbHermesPaper.style.height,traceWidth=nodes.Paper.scale.x;
assert(Math.abs(parseFloat(traceHeight)/600-297/210)<1e-8,'A4 aspect ratio');assert(Math.abs(traceWidth*.224-.420/1.15)<1e-8);
assert(paperMatrix()[0]>0,'immersive scale remains positive after fitting the complete scene');assertPaperInFrame();
// A full A4 must remain inside the light camera; otherwise the wall shadow
// acquires an artificial diagonal cut along the shadow-map frustum.
renderedScene.updateMatrixWorld(true);
const shadowLight=renderedScene.children.find(o=>o.isDirectionalLight&&o.castShadow);
shadowLight.shadow.updateMatrices(shadowLight);
const sheetBox=new T.Box3().setFromObject(nodes.Paper);
for(const x of [sheetBox.min.x,sheetBox.max.x])for(const y of [sheetBox.min.y,sheetBox.max.y])for(const z of [sheetBox.min.z,sheetBox.max.z]){
 const projected=new T.Vector3(x,y,z).project(shadowLight.shadow.camera);
 assert(Math.abs(projected.x)<1&&Math.abs(projected.y)<1,'entire A4 casts an unclipped shadow');
}

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
 for(const caret of [0,39,70]){ids.tbInput.selectionStart=caret;modeObservers();tick();assertPaperInFrame();renderedScene.updateMatrixWorld(true);const box=new T.Box3().setFromObject(bodyPose);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])assert(new T.Vector3(x,y,z).project(renderedCamera).y>=-1.001,'desktop body never drops below the viewport');}
}
ids.tbHermesView.clientWidth=870;ids.tbHermesView.clientHeight=600;
const traceDraft=ids.tbInput.value;ids.tbMain.dataset.readingMode='standard';modeObservers();tick();
assert.equal(nodes.Paper.scale.x,1,'standard paper size restores');assert.equal(ids.tbInput.value,traceDraft,'mode switch preserves draft');assert.equal(ids.tbInput.style.paddingBottom,'30px');
// Portrait devices frame the complete paper and body, including the carriage sweep.
ids.tbMain.dataset.readingMode='immersive';ids.tbMain.dataset.focusPortrait='true';ids.tbMain.style.setProperty('--tb-focus-sheet-top','44px');
for(const [w,h] of [[390,844],[768,1024],[1024,1366]]){
 ids.tbHermesView.clientWidth=w;ids.tbHermesView.clientHeight=h;
 for(const caret of [0,25,70]){
  ids.tbInput.selectionStart=caret;modeObservers();tick();
  const [sx,,,sy,x,y]=paperMatrix();assert(x>=-1&&x+sx*600<=w+1,'portrait paper stays inside both screen edges');assert(y>=0&&y+sy*parseFloat(ids.tbHermesPaper.style.height)<=h,'portrait paper fits vertically');
  renderedScene.updateMatrixWorld(true);const bodyBox=new T.Box3().setFromObject(nodes.Cast_Perimeter);
  for(const bx of [bodyBox.min.x,bodyBox.max.x])for(const by of [bodyBox.min.y,bodyBox.max.y])for(const bz of [bodyBox.min.z,bodyBox.max.z]){const p=new T.Vector3(bx,by,bz).project(renderedCamera);assert(p.x>=-1.01&&p.x<=1.01&&p.y>=-1&&p.y<=1,'portrait body is not cropped');}
 }
}
ids.tbMain.dataset.focusPortrait='false';ids.tbMain.style.setProperty('--tb-focus-sheet-top','16px');ids.tbHermesView.clientWidth=870;ids.tbHermesView.clientHeight=600;modeObservers();tick();
// Optional physical feed: first line starts at the platen; line transitions, not letters, raise the sheet.
function feedOption(on){ids.tbMain.dataset.paperFeed=on?'physical':'full';observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-paper-feed')).forEach(o=>o.f());tick();}
ids.tbMain.dataset.readingMode='immersive';ids.tbOrig.dataset.source='a'.repeat(80)+'\n'+'b'.repeat(120);ids.tbInput.value='';ids.tbInput.selectionStart=0;modeObservers();tick();
const fullPaperMatrix=paperMatrix(),fullPaperHeight=parseFloat(ids.tbHermesPaper.style.height);feedOption(true);
const firstLineY=paperMatrix()[5],firstLineHeight=parseFloat(ids.tbHermesPaper.style.height),firstRoll=nodes.Platen.quaternion.clone();
// A background resize must not clear the last canvas or expose the entire paper
// before a render can restore its physical feed crop.
const beforeBackground={sizes:sizeChanges,renders,height:ids.tbHermesPaper.style.height};
doc.hidden=true;event('document','visibilitychange');
ids.tbHermesView.clientWidth+=12;
event('tbHermesView','tb:hermes-align');event('tbInput','tb:paper');
assert.equal(sizeChanges,beforeBackground.sizes,'background resize must not clear the last canvas');
assert.equal(ids.tbHermesPaper.style.height,beforeBackground.height,'background sync keeps the exposed sheet height');
tick();assert.equal(renders,beforeBackground.renders,'hidden document does not render');
doc.hidden=false;event('document','visibilitychange');tick();
assert(renders>beforeBackground.renders,'foreground resume paints the pending resize');
assert.equal(sizeChanges,beforeBackground.sizes+1,'pending size changes commit with the render');
const stableSizes=sizeChanges;event('tbHermesView','tb:hermes-align');tick();
assert.equal(sizeChanges,stableSizes,'same-size alignment never clears the drawing buffer');
ids.tbHermesView.clientWidth-=12;event('tbHermesView','tb:hermes-align');tick();

assert(firstLineHeight<fullPaperHeight*.25,'initial exposed sheet is just the first line and top margin');
assert(Math.abs(paperMatrix()[0]-fullPaperMatrix[0])<1e-9,'physical feed keeps A4 width');
assert(Math.abs(nodes.Paper.position.y-nodes.Paper.scale.y*.222/2-.174)<1e-9,'depth mask ends at the platen instead of obscuring the keyboard');
ids.tbInput.value='a';ids.tbInput.selectionStart=1;event('tbInput','input');for(let i=0;i<20;i++)tick();
assert(Math.abs(paperMatrix()[5]-firstLineY)<1e-9,'typing within a line does not feed vertically');
ids.tbInput.value='a'.repeat(45);ids.tbInput.selectionStart=45;event('tbInput','input');for(let i=0;i<20;i++)tick();
assert(paperMatrix()[5]<firstLineY-1,'soft wrapping raises the paper');
assert(parseFloat(ids.tbHermesPaper.style.height)>firstLineHeight,'more paper emerges after wrapping');
assert(nodes.Platen.quaternion.angleTo(firstRoll)>.01,'platen rolls with paper feed');
const physicalY=paperMatrix()[5];event('tbInput','compositionstart');ids.tbInput.value=ids.tbOrig.dataset.source.slice(0,82);ids.tbInput.selectionStart=82;event('tbInput','input');for(let i=0;i<20;i++)tick();
assert.equal(paperMatrix()[5],physicalY,'IME composition cannot prematurely feed');event('tbInput','compositionend');for(let i=0;i<20;i++)tick();assert(paperMatrix()[5]<physicalY,'committed newline advances the sheet');
ids.tbOrig.dataset.source='a'.repeat(3000);ids.tbInput.value='a'.repeat(1000);ids.tbInput.selectionStart=1000;event('tbInput','input');for(let i=0;i<20;i++)tick();
assert(Number(ids.tbHermesPaper.dataset.feedScroll)>0,'long source scrolls after the exposed sheet fills');assert(parseFloat(ids.tbHermesPaper.style.height)<=fullPaperHeight,'new sheet stays within A4 height');
// Forward input must never collapse a full sheet at a modulo row boundary.
ids.tbInput.value='';ids.tbInput.selectionStart=0;event('tbInput','tb:paper');for(let i=0;i<20;i++)tick();
let previousHeight=parseFloat(ids.tbHermesPaper.style.height);
for(let n=31;n<=1100;n+=31){ids.tbInput.value='a'.repeat(n);ids.tbInput.selectionStart=n;event('tbInput','input');for(let i=0;i<30;i++)tick();const h=parseFloat(ids.tbHermesPaper.style.height);assert(h>=previousHeight-1e-7,'forward input must not retract the sheet');assert(h<=fullPaperHeight,'exposed sheet stays bounded');previousHeight=h;}
ids.tbInput.value='';ids.tbInput.selectionStart=0;event('tbInput','tb:paper');for(let i=0;i<20;i++)tick();assert.equal(ids.tbHermesPaper.dataset.feedScroll,'0','next page resets to its first line');
const feedDraft=ids.tbInput.value;feedOption(false);assert.equal(ids.tbInput.value,feedDraft,'feed toggle preserves draft');assert.equal(parseFloat(ids.tbHermesPaper.style.height),fullPaperHeight,'OFF restores the complete A4');assert.equal(ids.tbOrig.scrollTop,0);
ids.tbMain.dataset.readingMode='standard';modeObservers();feedOption(true);assert(parseFloat(ids.tbHermesPaper.style.height)<600,'standard retro also exposes a short first section');feedOption(false);assert.equal(ids.tbInput.style.paddingBottom,'30px');
// Wood uses the supplied image once, wraps continuously, and restores cloth drape.
const table=renderedScene.getObjectByName('Tablecloth'),tableZ=table.geometry.attributes.position;
function tableStyle(style){ids.tbMain.dataset.table=style;observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-table')).forEach(o=>o.f());tick();}
const tablePosition=table.position.clone(),tableWidth=table.scale.x;tableStyle('wood');
assert.equal(textureLoads.filter(u=>u.includes('table-light-wood')).length,1);
assert.equal(table.material.map.wrapS,T.MirroredRepeatWrapping);assert.equal(table.material.map.wrapT,T.MirroredRepeatWrapping);
assert.equal(table.material.map.repeat.x,4*tableWidth);assert.equal(table.material.bumpMap,null);
for(let i=0;i<tableZ.count;i++)assert.equal(tableZ.getZ(i),0,'wood surface is flat');
assert(table.position.equals(tablePosition),'wood keeps existing table placement');
tableStyle('gingham');assert(Array.from(tableZ.array).some((v,i)=>i%3===2&&Math.abs(v)>.001),'cloth drape restores');
tableStyle('wood');assert.equal(textureLoads.filter(u=>u.includes('table-light-wood')).length,1,'wood texture reused');tableStyle('gingham');
const saved=ids.tbInput.value;ids.tbMain.dataset.model='classic12';observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-model')).forEach(o=>o.f());assert.equal(ids.tbInput.parentElement,ids.tbInputHome.parentElement);assert.equal(ids.tbInput.value,saved);assert.equal(ids.tbInput.style.paddingTop,'');assert.equal(ids.tbMain.dataset.hermesReady,'false');
ids.tbMain.dataset.model=model;observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-model')).forEach(o=>o.f());assert.equal(ids.tbInput.parentElement,ids.tbHermesPaper);event('canvas','webglcontextlost',{preventDefault(){}});assert.equal(ids.tbInput.parentElement,ids.tbInputHome.parentElement);assert.equal(ids.tbMain.dataset.hermesFailed,'true');observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-model')).forEach(o=>o.f());assert.equal(ids.tbInput.parentElement,ids.tbInputHome.parentElement,'failure does not reattach input');
if(model==='lettera32'){
 assert.equal(nodes.Ribbon_Hood.material.name,'Lettera_Blue_Enamel');
 assert.equal(nodes.Cap_KeyA.material.name,'Lettera_Keycaps_Contour');
 assert(nodes.Ribbon_Hood.material.clearcoat>.5&&nodes.Ribbon_Hood.material.roughness<.3,'Lettera enamel retains its own gloss');
 assert(nodes.Cap_KeyA.material.clearcoat>.4&&nodes.Cap_KeyA.material.roughness<.3,'Lettera caps retain distinct polished resin');
 const normals=nodes.Ribbon_Hood.geometry.attributes.normal;for(let i=0;i<normals.count;i++){const n=new T.Vector3().fromBufferAttribute(normals,i);assert(Number.isFinite(n.length())&&Math.abs(n.length()-1)<1e-5,'bent cover normals are finite unit vectors');}
 assert.equal(nodes.Hermes_Badge.visible,false);assert.equal(nodes.Selector_Slot.visible,false);assert.equal(nodes.Margin_Indicator_Left.visible,false);
 assert.equal(gltf.scene.getObjectByName('Lettera_Knob_Inset_Right').material.metalness,1,'right knob has its observed metal center');
 assert(gltf.scene.getObjectByName('Lettera_Segment_Divider_47'),'fixed segment is visible independently of moving bars');
 assert(gltf.scene.getObjectByName('Lettera_Split_Badge'));assert(gltf.scene.getObjectByName('Lettera_Return_Paddle'));assert(gltf.scene.getObjectByName('Lettera_Pica_Scale'));
 assert.equal(gltf.scene.userData.model,'lettera32');
}
if(model==='olympiasm3'){
 assert.equal(nodes.Ribbon_Hood.material.name,'Olympia_Crinkle_Enamel');assert(nodes.Ribbon_Hood.material.bumpMap);
 const normals=nodes.Ribbon_Hood.geometry.attributes.normal;for(let i=0;i<normals.count;i++){const n=new T.Vector3().fromBufferAttribute(normals,i);assert(Number.isFinite(n.length())&&Math.abs(n.length()-1)<1e-5,'SM3 curved cover has finite unit normals');}
 gltf.scene.updateMatrixWorld(true);const badgeRay=new T.Raycaster();
 for(const stroke of gltf.scene.getObjectByName('Olympia_Script_Badge').children){
  assert.equal(stroke.material.metalness,1);assert.equal(stroke.material.name,'Olympia_Badge_Metal');
  const p=stroke.geometry.attributes.position;
  for(const index of [0,Math.floor(p.count/2),p.count-1]){const point=new T.Vector3().fromBufferAttribute(p,index).applyMatrix4(stroke.matrixWorld);badgeRay.set(new T.Vector3(point.x,.4,point.z),new T.Vector3(0,-1,0));const hit=badgeRay.intersectObject(nodes.Ribbon_Hood,false)[0];assert(hit&&point.y>hit.point.y,'solid logo remains above the cover mesh '+JSON.stringify({stroke:stroke.name,index,point,hit:hit?.point}));}
 }
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
// Retry the same model after a context loss, a rejected download, and a frame exception.
const recoveryDraft=ids.tbInput.value;
event('canvas','webglcontextlost',{preventDefault(){}});
assert.equal(ids.tbMain.dataset.hermesState,'error');assert.equal(ids.tbHermesRetry.hidden,false);
failNextLoad=true;event('tbHermesRetry','click');await new Promise(r=>setImmediate(r));
assert.equal(ids.tbMain.dataset.hermesState,'error','download rejection exits loading and offers retry');
event('tbHermesRetry','click');await new Promise(r=>setImmediate(r));tick();
assert.equal(ids.tbMain.dataset.hermesState,'ready','same-model retry returns to rendered state');
throwNextRender=true;event('tbInput','tb:paper');tick();
assert.equal(ids.tbMain.dataset.hermesState,'error','frame exceptions cannot leave a blank ready canvas');
event('tbHermesRetry','click');await new Promise(r=>setImmediate(r));tick();
assert.equal(ids.tbMain.dataset.hermesState,'ready');assert.equal(ids.tbInput.value,recoveryDraft);
assert(releasedContexts>=5,'switches and recovery explicitly release old GPU contexts');
assert.equal(events['tbInput:keydown'].length,1);assert.equal(events['tbHermesView:tb:hermes-align'].length,1);
// A late response for the previous selection must never replace the latest model.
event('canvas','webglcontextlost',{preventDefault(){}});delayNextLoad=true;event('tbHermesRetry','click');
await new Promise(r=>setImmediate(r));
ids.tbMain.dataset.model=model==='lettera32'?'olympiasm3':'lettera32';
observers.filter(o=>o.e===ids.tbMain&&o.o.attributeFilter.includes('data-model')).forEach(o=>o.f());
releaseDelayedLoad();await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));tick();
assert.equal(ids.tbMain.dataset.hermesState,'ready');
assert(renderedScene.children.some(o=>o.userData.model===ids.tbMain.dataset.model),'stale load cannot win over newest choice');
assert.equal(ids.tbInput.value,recoveryDraft);

console.log(JSON.stringify({model,passed:['61 independent enlarged keys / 47 bars / no root stretch','same textarea on paper','key and flexible ribbon / stationary side guides', 'carriage margins / body-fixed card holders', 'paper depth mask','closed shell, bed and caps / inset tray','typebar strike point','carriage advances','IME composition waits','Enter lever, paper edge and roller travel','61-key character/modifier mapping','platen axis','switch restores input and draft','no early margin bell','complete desktop scene framing / source cursor / IME / restoration','optional physical feed / fixed print line / soft wrap / IME / continuous overflow / OFF restoration','portrait phone/tablet full-body framing and carriage sweep','WebGL failure restores native input','model swaps retain draft, recover failure and remove duplicate listeners','download/render failure retry / released GPU contexts / stale load rejection'],renders,nodes:Object.keys(nodes).length}));
