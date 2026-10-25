/* Hermes-inspired 87-key TKL: articulated parts, native IME paper, staged mechanical motion. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),main=$('tbMain'),stage=$('tbHermesStage'),view=$('tbHermesView'),paper=$('tbHermesPaper'),input=$('tbInput'),home=$('tbInputHome'),status=$('tbHermesStatus');
 if(!stage)return;
 const tracing=()=>main.dataset.readingMode==='immersive';
 const originalPlaceholder=input.placeholder,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let active=false,inView=true,loading=false,engine=null,composing=false,failed=false;
 function restore(){
  if(input.parentElement===paper){home.after(input);for(const p of ['paddingTop','paddingBottom','fontSize','lineHeight','height'])input.style[p]='';input.placeholder=originalPlaceholder;}
  main.dataset.hermesReady='false';
 }
 function update(){
  active=main.dataset.skin==='retro'&&main.dataset.model==='hermes3000'&&!$('tbRead').hidden;stage.hidden=!active;
  if(!active){restore();engine?.stop();return;}
  if(failed){restore();return;}
  if(!engine&&!loading)init();
  if(engine){
   if(composing&&input.parentElement!==paper)return;
   if(input.parentElement!==paper){const focused=document.activeElement===input;paper.appendChild(input);if(focused)input.focus({preventScroll:true});}
   input.placeholder=tracing()?'':'종이를 클릭하고 첫 문장을 입력하세요…';main.dataset.hermesReady='true';
   status.textContent=tracing()?'연한 글자를 따라 쓰세요 · ↵ Enter':'Hermes 3000 · 87키 · 종이에 직접 입력';engine.resize();
  }
 }
 new MutationObserver(update).observe(main,{attributes:true,attributeFilter:['data-skin','data-model','data-reading-mode']});
 new MutationObserver(update).observe($('tbRead'),{attributes:true,attributeFilter:['hidden']});
 new IntersectionObserver(e=>{inView=e[0].isIntersecting;engine?.wake();}).observe(stage);
 document.addEventListener('visibilitychange',()=>engine?.wake());
 $('tbHermesFocus').addEventListener('click',()=>input.focus({preventScroll:true}));
 view.addEventListener('click',e=>{if(e.target!==input)input.focus({preventScroll:true});});
 input.addEventListener('compositionstart',()=>{composing=true;});
 input.addEventListener('compositionend',()=>{composing=false;engine?.sync();});
 async function init(){
  loading=true;status.textContent='Hermes 3000을 준비하고 있어요…';let renderer;
  try{
   const T=await import('/js/vendor/three/three.module.js'),{GLTFLoader}=await import('/js/vendor/three/GLTFLoader.js');
   renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
   renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;
   const asset=await new GLTFLoader().loadAsync('/img/typewriters/hermes3000.glb?v=4');
   const scene=new T.Scene(),nodes={};scene.add(asset.scene);
   asset.scene.traverse(o=>{nodes[o.name]=o;if(o.isLight||o.isCamera)o.visible=false;if(o.isMesh){o.castShadow=!/Glyph_|Tick_|Ruler_Number|Knob_Reeding/.test(o.name);o.receiveShadow=true;}});
   // Invisible depth surface lets the HTML sheet hide the paper table behind it.
   nodes.Paper.visible=true;nodes.Paper.castShadow=false;nodes.Paper.receiveShadow=false;nodes.Paper.renderOrder=-10;
   // Window-shaped reflection cards describe chrome and enamel without a network HDRI.
   const room=new T.Scene();room.background=new T.Color(.055,.055,.055);
   for(const [pos,size,power,color] of [[[-2,3,2],[2.8,3.5,1],3.4,0xfff5df],[[3,1,0],[1.5,3,1],.8,0xdce9ed],[[0,3,-3],[3,.65,1],2,0xffffff]]){
    const card=new T.Mesh(new T.BoxGeometry(...size),new T.MeshBasicMaterial({color,side:T.DoubleSide}));card.material.color.multiplyScalar(power);card.position.set(...pos);card.lookAt(0,0,0);room.add(card);
   }
   const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.025);scene.environment=environment.texture;pmrem.dispose();
   room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
   // Fine deterministic surface texture; subtle enough to remain an enamel finish.
   const grainData=new Uint8Array(128*128*4);let seed=31;
   for(let i=0;i<grainData.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=115+(seed>>>27);grainData[i]=grainData[i+1]=grainData[i+2]=n;grainData[i+3]=255;}
   const grain=new T.DataTexture(grainData,128,128,T.RGBAFormat);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.magFilter=T.LinearFilter;grain.minFilter=T.LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;
   const materials=new Map();asset.scene.traverse(o=>{if(!o.isMesh)return;const old=o.material;if(materials.has(old)){o.material=materials.get(old);return;}
    let m=old;
    if(old.name==='Hermes_Sage_Enamel'){m=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(m,old);m.defines.PHYSICAL='';m.roughness=.34;m.clearcoat=.18;m.clearcoatRoughness=.32;m.bumpMap=grain;m.bumpScale=.00011;m.envMapIntensity=.48;}
    else if(old.name==='Mint_Keycaps'){m=old.clone();m.bumpMap=grain;m.bumpScale=.000045;m.envMapIntensity=.38;}
    else if(old.name==='Polished_Nickel'){m=old.clone();m.metalness=1;m.roughness=.16;m.envMapIntensity=1.1;}
    else if(old.name==='Platen_Rubber'){m=old.clone();m.bumpMap=grain;m.bumpScale=.0001;m.envMapIntensity=.12;}
    else {m=old.clone();m.envMapIntensity=.3;}
    materials.set(old,m);o.material=m;
   });
   // Keep small steel mechanisms readable under the broad reflection cards.
   const mechanismMetal=new T.MeshStandardMaterial({color:new T.Color(.22,.25,.23),metalness:.95,roughness:.32,envMapIntensity:.55});
   asset.scene.traverse(o=>{if(o.isMesh&&/^(TypebarArm_|TypeSlug_|Type_Guide_|Ribbon_Carrier_)/.test(o.name))o.material=mechanismMetal;});
   nodes.Paper.material=new T.MeshBasicMaterial({colorWrite:false,depthWrite:true,side:T.DoubleSide});
   for(const name of ['Card_Holder_Left','Card_Holder_Right']){
    const m=nodes[name].material;m.transparent=true;m.opacity=.16;m.depthWrite=false;m.side=T.DoubleSide;
    nodes[name].castShadow=false;
   }
   // Ribbon side guides stay fixed while the center follows the carrier lift.
   const ribbonPaths=['Ribbon_Path_Black','Ribbon_Path_Red'].map(n=>nodes[n]);
   for(const o of ribbonPaths){o.material=o.material.clone();o.material.side=T.DoubleSide;o.userData.basePositions=o.geometry.attributes.position.array.slice();o.geometry.attributes.position.setUsage(T.DynamicDrawUsage);}
   // One shared cap material; local-space tone survives key travel and separates the crown from the skirt.
   const capSource=nodes.Cap_KeyA.material,capMaterial=new T.MeshPhysicalMaterial();
   T.MeshStandardMaterial.prototype.copy.call(capMaterial,capSource);capMaterial.defines.PHYSICAL='';
   capMaterial.name='Mint_Keycaps_Contour';capMaterial.vertexColors=true;capMaterial.roughness=.31;
   capMaterial.clearcoat=.18;capMaterial.clearcoatRoughness=.26;capMaterial.envMapIntensity=.24;
   const shadedCaps=new Set(),smoothRange=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
   asset.scene.traverse(o=>{
    if(!o.isMesh||!o.name.startsWith('Cap_'))return;
    const g=o.geometry;
    if(!shadedCaps.has(g)){
     const p=g.attributes.position,n=g.attributes.normal,c=new Float32Array(p.count*3);
     for(let i=0;i<p.count;i++){
      const y=p.getY(i),top=smoothRange(.25,.82,n.getY(i))*smoothRange(-.001,.0035,y);
      const skirt=.56+.15*smoothRange(-.008,.003,y),rim=.045*smoothRange(.0048,.0072,y);
      const tone=skirt*(1-top)+(1.02+rim)*top;
      c[i*3]=tone*.97;c[i*3+1]=tone;c[i*3+2]=tone*.96;
     }
     g.setAttribute('color',new T.BufferAttribute(c,3));shadedCaps.add(g);
    }
    o.material=capMaterial;
   });
   scene.add(new T.HemisphereLight(0xfffaf0,0x4e5b50,.28));
   const keyLight=new T.DirectionalLight(0xfff4df,1.65);keyLight.position.set(-.5,1.6,.7);keyLight.target.position.set(0,.07,0);scene.add(keyLight,keyLight.target);
   keyLight.castShadow=true;const shadowSize=view.clientWidth>760?2048:1024;keyLight.shadow.mapSize.set(shadowSize,shadowSize);Object.assign(keyLight.shadow.camera,{left:-.52,right:.52,top:.5,bottom:-.5,near:.1,far:3});keyLight.shadow.bias=-.0001;keyLight.shadow.normalBias=.00045;keyLight.shadow.radius=5;keyLight.shadow.blurSamples=8;
   const fill=new T.DirectionalLight(0xe2edf1,.25);fill.position.set(.5,.3,-.3);scene.add(fill);
   const ground=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShadowMaterial({opacity:.17}));ground.rotation.x=-Math.PI/2;ground.position.y=-.0026;ground.receiveShadow=true;scene.add(ground);
   // Wide soft contact below the rubber feet, plus real moving cast shadows above it.
   const contactCanvas=document.createElement('canvas');contactCanvas.width=128;contactCanvas.height=128;const cc=contactCanvas.getContext('2d');const gradient=cc.createRadialGradient(64,64,12,64,64,64);gradient.addColorStop(0,'rgba(25,32,26,.16)');gradient.addColorStop(.6,'rgba(25,32,26,.07)');gradient.addColorStop(1,'rgba(25,32,26,0)');cc.fillStyle=gradient;cc.fillRect(0,0,128,128);
   const contact=new T.Mesh(new T.PlaneGeometry(.49,.33),new T.MeshBasicMaterial({map:new T.CanvasTexture(contactCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.set(0,-.003,.01);scene.add(contact);
   const camera=new T.OrthographicCamera();camera.position.set(0,.60,.73);camera.lookAt(0,.205,0);
   view.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
   const keys=Object.values(nodes).filter(o=>o.name.startsWith('Key_')),bars=Object.values(nodes).filter(o=>/^Typebar_\d+$/.test(o.name));
   keys.forEach(o=>{o.userData.rest=o.position.clone();o.userData.restQ=o.quaternion.clone();});bars.forEach(o=>{
    o.userData.rest=o.quaternion.clone();
    const slug=o.children.find(c=>c.name.startsWith('TypeSlug_'));
    const restDirection=slug.position.clone().applyQuaternion(o.quaternion).normalize();
    const strikeDirection=new T.Vector3(0,.164,-.119).sub(o.position).normalize();
    o.userData.strike=new T.Quaternion().setFromUnitVectors(restDirection,strikeDirection).multiply(o.quaternion);
   });
   const barFor=new Map(bars.map(o=>[o.userData.keyCode,o])),carriage=nodes.Carriage,platen=nodes.Platen,guide=nodes.Ribbon_Guide,lever=nodes.Return_Lever,basket=nodes.Typebasket;
   const guideY=guide.position.y,leverQ=lever.quaternion.clone(),platenQ=platen.quaternion.clone(),knobs=['Platen_Knob_Left','Platen_Knob_Right'].map(n=>nodes[n]);
   knobs.forEach(k=>{k.userData.restQ=k.quaternion.clone();});
   const pressed=new Map(),hits=[],xAxis=new T.Vector3(1,0,0),yAxis=new T.Vector3(0,1,0),delta=new T.Quaternion();
   let layoutPending=false,raf=0,until=0,prev=0,targetX=.096,currentX=.096,feed=0,currentFeed=0,returnAt=-1000,lastKeyAt=-1000,lastValue=null,width=0,height=0,shift=false,drive=null,feedDrive=null,bellLine=-1;
   const measure=document.createElement('canvas').getContext('2d'),paperWidth=600,left=42,printBottom=30;
   let paperHeight=594,traceProjection=1,sheetWidth=.224,paperTop=.396,fontPixels=34,lineHeight=48,fullHeight=paperHeight,lastLine=0,rollerFeed=0,targetRoll=0;
   const clamp=v=>Math.max(0,Math.min(1,v)),smooth=t=>t*t*(3-2*t);
   function running(){return active&&!failed&&inView&&!document.hidden;}
   function resetKeys(){pressed.clear();hits.length=0;shift=false;keys.forEach(k=>{k.position.copy(k.userData.rest);k.quaternion.copy(k.userData.restQ);});}
   function stop(){cancelAnimationFrame(raf);raf=0;prev=0;resetKeys();}
   function wake(){until=performance.now()+800;if(!raf&&running())raf=requestAnimationFrame(frame);}
   function resize(){
    if(!active||failed)return;
    width=view.clientWidth;height=view.clientHeight;if(!width||!height)return;
    const trace=tracing(),a=width/height,instrumentScale=1.15;
    const baseSpan=Math.max(.52,.70/a)/(trace?.75*instrumentScale:1);
    // On tall desktop windows keep room for both reading panels and carriage travel.
    const panelSpan=trace&&width>980?(.420/instrumentScale)*height/((width-400)/1.86):0;
    const span=Math.max(baseSpan,panelSpan);
    renderer.setSize(width,height,false);
    // Enlarge the instrument by 15%; inversely compensate the A4 sheet
    // to preserve its screen position, width, height and text size.
    sheetWidth=trace?.420/instrumentScale:.224;paperTop=trace?.174+.594/instrumentScale:.396;
    paperHeight=trace?paperWidth*297/210:594;
    camera.left=-span*a/2;camera.right=span*a/2;camera.top=span/2;camera.bottom=-span/2;
    camera.updateMatrixWorld();
    if(trace){
     // Anchor the whole sheet below the toolbar. The lower keys may leave the frame.
     const sheetTop=new T.Vector3(0,paperTop,-.151).applyMatrix4(camera.matrixWorldInverse).y;
     camera.top=sheetTop+16*span/height;camera.bottom=camera.top-span;
    }
    camera.updateProjectionMatrix();
    const selectedSize=parseFloat(getComputedStyle(main).getPropertyValue('--tb-size'))||(trace?14:18);
    const scale=sheetWidth/(span*a)*width;
    fontPixels=trace?selectedSize/(scale/600):Math.max(34,Math.min(76,16/(scale/600)));
    lineHeight=fontPixels*(trace?1.65:1.42);
    // The sheet is foreshortened by the camera, but the editor's glyphs must not be.
    traceProjection=trace?Math.abs(camera.matrixWorldInverse.elements[5]):1;
    paper.style.setProperty('--tb-trace-unskew',String(1/traceProjection));
    paper.style.setProperty('--tb-trace-size',fontPixels+'px');paper.style.setProperty('--tb-trace-line',lineHeight+'px');
    input.style.fontSize=fontPixels+'px';input.style.lineHeight=lineHeight+'px';layoutPending=true;sync(true);wake();
   }
   function layout(text){
    measure.font=fontPixels+'px '+getComputedStyle(input).fontFamily;const lines=[];let row='',units=0;
    for(const ch of Array.from(text)){if(ch==='\n'){lines.push({text:row,width:units});row='';units=0;continue;}const n=measure.measureText(ch).width;if(units+n>paperWidth-left*2&&row){lines.push({text:row,width:units});row='';units=0;}row+=ch;units+=n;}
    lines.push({text:row,width:units});return lines;
   }
   function sync(snap=false){
    if(!active||failed)return;snap=snap===true;
    const trace=tracing(),source=$('tbOrig').dataset.source||input.value,caret=Array.from(input.value.slice(0,input.selectionStart).normalize('NFC')).length;
    const prefix=trace?Array.from(source.normalize('NFC')).slice(0,caret).join(''):input.value.slice(0,input.selectionStart);
    const all=layout(input.value),before=layout(prefix),now=performance.now(),changed=input.value!==lastValue,initial=lastValue===null;
    // The sheet physically feeds upward; its print area grows instead of moving padding instantly.
    fullHeight=trace?paperHeight:paperHeight+(all.length-1)*lineHeight;paper.style.height=fullHeight+'px';input.style.height=fullHeight*traceProjection+'px';paper.style.setProperty('--tb-trace-editor-height',fullHeight*traceProjection+'px');
    input.style.paddingTop=(trace?32:paperHeight-printBottom-lineHeight)+'px';input.style.paddingBottom=(trace?32:30)+'px';if(!trace)input.scrollTop=0;
    paper.dataset.paper=main.dataset.paper||'ivory';$('tbHermesCount').textContent=$('tbCount').textContent;
    if(!composing){
     const line=before[before.length-1],nextX=sheetWidth/2-left/paperWidth*sheetWidth-line.width/paperWidth*sheetWidth,nextFeed=trace?0:(before.length-1)*lineHeight*.222/paperHeight;
     const newLine=trace?before.length>lastLine:nextFeed>feed+.0001;lastLine=before.length;
     if(newLine&&changed&&!initial)returnAt=now;
     if(initial||snap||input.value.length<(lastValue||'').length)bellLine=-1;
     if(changed&&!initial&&!snap&&line.width>(paperWidth-left*2)*.86&&bellLine!==before.length){bellLine=before.length;input.dispatchEvent(new CustomEvent('tb:hermes-sound',{detail:{key:'MarginBell'}}));}
     if(Math.abs(nextX-targetX)>.000001){const returning=newLine&&nextX>targetX;drive={from:currentX,to:nextX,start:now+(returning?55:changed?34:0),duration:returning?390:changed?58:130};targetX=nextX;}
     if(Math.abs(nextFeed-feed)>.000001){feedDrive={from:currentFeed,to:nextFeed,start:now+(newLine?20:0),duration:newLine?180:150};feed=nextFeed;}
     targetRoll=trace?(before.length-1)*lineHeight*sheetWidth/paperWidth:nextFeed;
     if(snap||initial){currentX=targetX;currentFeed=feed;rollerFeed=targetRoll;drive=feedDrive=null;}
     // Mobile IME may commit text without keyboard events. Space/newline never hit a typebar.
     if(changed&&!initial&&input.value.length>(lastValue||'').length&&now-lastKeyAt>100&&/\S$/.test(input.value)){const ch=Array.from(input.value).at(-1),bar=barFor.get('Key'+ch.toUpperCase())||bars[Array.from(input.value).length%bars.length];hits.push({bar,time:now});input.dispatchEvent(new CustomEvent('tb:hermes-sound',{detail:{key:ch}}));}
    }
    if(!composing)lastValue=input.value;wake();
   }
   function placePaper(){
    const top=paperTop+currentFeed,tl=new T.Vector3(-sheetWidth/2+currentX,top,-.151).project(camera),tr=new T.Vector3(sheetWidth/2+currentX,top,-.151).project(camera),bl=new T.Vector3(-sheetWidth/2+currentX,.174+currentFeed,-.151).project(camera);
    const x=(tl.x+1)*width/2,y=(1-tl.y)*height/2,sx=(tr.x-tl.x)*width/2/paperWidth,sy=(tl.y-bl.y)*height/2/paperHeight;
    paper.style.transform=`matrix(${sx},0,0,${sy},${x},${y})`;
   }
   function frame(now){
    raf=0;if(!running())return;const dt=Math.min((now-(prev||now))/1000,.06);prev=now;const motion=!reduced.matches;
    for(const k of keys){
     k.position.copy(k.userData.rest);k.quaternion.copy(k.userData.restQ);const p=pressed.get(k.name);if(!p)continue;
     let depth=smooth(clamp((now-p.time)/24));
     if(p.up){const t=(now-p.up)/95;depth*=t<1?1-smooth(clamp(t)):-.055*Math.exp(-(t-1)*8)*Math.sin((t-1)*12);if(t>1.5){pressed.delete(k.name);depth=0;}}
     if(motion){k.position.y-=depth*.0045;k.quaternion.multiply(delta.setFromAxisAngle(xAxis,-.025*depth));}
    }
    bars.forEach(b=>b.quaternion.copy(b.userData.rest));let lift=0,impact=0;
    for(let i=hits.length-1;i>=0;i--){
     const h=hits[i],age=now-h.time;if(age>=160){hits.splice(i,1);continue;}
     // Fast strike, brief contact, slower spring return; no sinusoidal slow approach.
     let s=age<42?smooth(clamp(age/42)):age<50?1:1-smooth(clamp((age-50)/110));if(!motion)s=0;
     h.bar.quaternion.slerpQuaternions(h.bar.userData.rest,h.bar.userData.strike,s);lift=Math.max(lift,s);impact=Math.max(impact,Math.max(0,1-Math.abs(age-46)/12));
    }
    guide.position.y=guideY+lift*.008;
    for(const o of ribbonPaths){
     const p=o.geometry.attributes.position,b=o.userData.basePositions;
     for(let i=0;i<p.count;i++){const w=1-smoothRange(.012,.101,Math.abs(b[i*3]));p.setY(i,b[i*3+1]+lift*.008*w);}
     p.needsUpdate=true;o.geometry.computeVertexNormals();
    }
    basket.position.y+=( (shift&&motion?-.004:0)-basket.position.y)*(1-Math.exp(-dt*35));
    if(!motion){currentX=targetX;currentFeed=feed;drive=feedDrive=null;}
    if(drive){const t=clamp((now-drive.start)/drive.duration);currentX=drive.from+(drive.to-drive.from)*smooth(t);if(t===1)drive=null;}
    if(feedDrive){const t=clamp((now-feedDrive.start)/feedDrive.duration);currentFeed=feedDrive.from+(feedDrive.to-feedDrive.from)*smooth(t);if(t===1)feedDrive=null;}
    carriage.position.x=currentX;carriage.position.y=motion?impact*.0002:0;
    // 18 mm is the authored mesh radius, not a measured Hermes specification.
    rollerFeed=motion?rollerFeed+(targetRoll-rollerFeed)*(1-Math.exp(-dt*20)):targetRoll;
    const angle=-(tracing()?rollerFeed:currentFeed)/.018;platen.quaternion.copy(platenQ).multiply(delta.setFromAxisAngle(yAxis,angle));knobs.forEach(k=>k.quaternion.copy(k.userData.restQ).multiply(delta.setFromAxisAngle(yAxis,angle)));
    const rt=now-returnAt;lever.quaternion.copy(leverQ);
    if(motion&&rt>=0&&rt<480){const pull=rt<85?smooth(rt/85):rt<340?1:1-smooth((rt-340)/140);lever.rotateX(-.34*pull);}
    const sheetHeight=(paperTop-.174)*fullHeight/paperHeight;
    nodes.Paper.scale.x=sheetWidth/.224;nodes.Paper.scale.y=sheetHeight/.222;nodes.Paper.position.y=paperTop+currentFeed-sheetHeight/2;
    placePaper();renderer.render(scene,camera);
    if(layoutPending){layoutPending=false;view.dispatchEvent(new CustomEvent('tb:hermes-layout'));}
    if(now<until||pressed.size||hits.length||drive||feedDrive)raf=requestAnimationFrame(frame);
   }
   function down(e){
    if(!active)return;lastKeyAt=performance.now();if(e.code.startsWith('Shift'))shift=true;
    const key=nodes['Key_'+e.code];if(key&&!e.repeat)pressed.set(key.name,{time:lastKeyAt,up:0});
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey){if(e.code==='Enter'&&!e.isComposing)returnAt=lastKeyAt;const bar=barFor.get(e.code);if(bar)hits.push({bar,time:lastKeyAt});}
    wake();
   }
   function up(e){if(e.code.startsWith('Shift'))shift=false;const k=pressed.get('Key_'+e.code);if(k)k.up=performance.now();wake();}
   input.addEventListener('keydown',down);document.addEventListener('keyup',up);window.addEventListener('blur',()=>{resetKeys();wake();});input.addEventListener('blur',()=>{resetKeys();wake();});
   ['input','click','keyup','tb:paper'].forEach(e=>input.addEventListener(e,()=>sync()));
   new MutationObserver(()=>sync()).observe(main,{attributes:true,attributeFilter:['data-paper']});
   new ResizeObserver(resize).observe(view);['tbMinus','tbPlus'].forEach(id=>$(id).addEventListener('click',()=>{if(tracing())resize();}));$('tbFontW').addEventListener('change',()=>sync(true));$('tbReset').addEventListener('click',()=>queueMicrotask(()=>sync(true)));
   renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;stop();restore();main.dataset.hermesFailed='true';status.textContent='3D 표시가 중단되어 기본 입력창으로 전환했어요.';});
   engine={sync,resize,wake,stop};main.dataset.hermesFailed='false';status.textContent='Hermes 3000 · 87키 · 종이에 직접 입력';loading=false;update();
  }catch(error){failed=true;renderer?.dispose();renderer?.domElement.remove();restore();main.dataset.hermesFailed='true';status.textContent='타자기를 불러오지 못했어요. 기본 입력창을 사용해 주세요.';console.warn('Hermes 3000 unavailable',error);loading=false;}
 }
 update();
})();
