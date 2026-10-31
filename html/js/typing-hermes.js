/* Hermes-inspired 61-key typing layout: articulated parts, native IME paper, staged mechanical motion. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),main=$('tbMain'),stage=$('tbHermesStage'),view=$('tbHermesView'),paper=$('tbHermesPaper'),input=$('tbInput'),home=$('tbInputHome'),status=$('tbHermesStatus');
 if(!stage)return;
 const modelNames={hermes3000:'Hermes 3000',lettera32:'Olivetti Lettera 32',olympiasm3:'Olympia SM3'};
 const feeding=()=>main.dataset.paperFeed==='physical';
 const tracing=()=>main.dataset.readingMode==='immersive';
 const closeButton=$('tbCloseup');
 try{main.dataset.camera=localStorage.getItem('typebook-v1:camera')==='close'?'close':'full';}catch{}
 closeButton?.addEventListener('click',()=>{main.dataset.camera=main.dataset.camera==='close'?'full':'close';try{localStorage.setItem('typebook-v1:camera',main.dataset.camera);}catch{}update();});
 const originalPlaceholder=input.placeholder,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let active=false,loading=false,engine=null,composing=false,failed=false,failedModel='';
 function sceneState(value,message){
  main.dataset.hermesState=value;
  const panel=$('tbHermesLoading'),label=$('tbHermesLoadingText'),retry=$('tbHermesRetry');
  if(panel)panel.hidden=value==='ready';if(label)label.textContent=message||'타자기를 준비하고 있어요…';if(retry)retry.hidden=value!=='error';
 }
 function failEngine(error){
  failed=true;failedModel=main.dataset.model;loading=false;
  engine?.dispose();engine=null;restore();main.dataset.hermesFailed='true';
  sceneState('error','타자기 표시가 중단됐어요. 작성한 내용은 유지됩니다.');
  status.textContent='타자기 다시 불러오기를 눌러 주세요. 기본 입력창에서도 이어 쓸 수 있어요.';
  console.warn('Typewriter unavailable',error);
 }
 $('tbHermesRetry')?.addEventListener('click',()=>{failed=false;failedModel='';main.dataset.hermesFailed='false';update();});
 function restore(){
  if(input.parentElement===paper){home.after(input);for(const p of ['paddingTop','paddingBottom','fontSize','lineHeight','height'])input.style[p]='';input.placeholder=originalPlaceholder;}
  main.dataset.hermesReady='false';
 }
 function update(){
  if(closeButton){closeButton.hidden=main.dataset.model!=='hermes3000';closeButton.setAttribute('aria-pressed',String(main.dataset.camera==='close'));closeButton.textContent=main.dataset.camera==='close'?'전체 구도':'근접 구도';}
  active=main.dataset.modelGate!=='pending'&&main.dataset.skin==='retro'&&Boolean(modelNames[main.dataset.model])&&!$('tbRead').hidden;stage.hidden=!active;
  if(!active){restore();engine?.stop();return;}
  if((engine&&engine.model!==main.dataset.model)||(failed&&failedModel!==main.dataset.model)){engine?.dispose();engine=null;failed=false;restore();}
  if(failed){restore();return;}
  if(!engine&&!loading)init();
  if(engine){
   if(composing&&input.parentElement!==paper)return;
   if(input.parentElement!==paper){const focused=document.activeElement===input;paper.appendChild(input);if(focused)input.focus({preventScroll:true});}
   input.placeholder=tracing()?'':'종이를 클릭하고 첫 문장을 입력하세요…';main.dataset.hermesReady='true';
   status.textContent=tracing()?'종이의 현재 커서 위치에서 필사를 시작할 수 있습니다.':modelNames[main.dataset.model]+(main.dataset.model==='lettera32'?' · 50키':main.dataset.model==='olympiasm3'?' · 51키':' · 54키 외형')+' · 종이에 직접 입력';engine.resize();
  }
 }
 new MutationObserver(update).observe(main,{attributes:true,attributeFilter:['data-skin','data-model','data-reading-mode','data-model-gate']});
 new MutationObserver(update).observe($('tbRead'),{attributes:true,attributeFilter:['hidden']});
 new IntersectionObserver(e=>{if(e[0].isIntersecting)engine?.wake();}).observe(stage);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)engine?.stop();else engine?.resize();});
 window.addEventListener('pageshow',()=>engine?.resize());
 view.addEventListener('click',e=>{if(e.target!==input)input.focus({preventScroll:true});});
 input.addEventListener('compositionstart',()=>{composing=true;});
 input.addEventListener('compositionend',()=>{composing=false;engine?.sync();});
 async function init(){
  loading=true;sceneState('loading');const selectedModel=main.dataset.model,cleanups=[];
  status.textContent=modelNames[selectedModel]+' 준비 중…';let renderer,disposed=false,releaseResources=()=>{};
  function releaseGraph(root){const geometries=new Set(),materials=new Set(),textures=new Set();root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  function listen(target,type,fn){target.addEventListener(type,fn);cleanups.push(()=>target.removeEventListener(type,fn));}
  function observe(Observer,fn,target,options){const o=new Observer(fn);o.observe(target,options);cleanups.push(()=>o.disconnect());}
  try{
   const T=await import('/js/vendor/three/three.module.js'),{GLTFLoader}=await import('/js/vendor/three/GLTFLoader.js');
   T.Cache.enabled=true;
   let loadExpired=false,loadTimer,detailedReference;
   const loader=new GLTFLoader();
   const pending=Promise.allSettled([
    loader.loadAsync('/img/typewriters/hermes3000.glb?v=6'),
    selectedModel==='hermes3000'?loader.loadAsync('/img/typewriters/reference/hermes3000-reference.glb?v=1'):selectedModel==='lettera32'?loader.loadAsync('/img/typewriters/reference/lettera32-reference.glb?v=4'):selectedModel==='olympiasm3'?loader.loadAsync('/img/typewriters/reference/olympiasm3-reference.glb?v=2'):Promise.resolve(null)
   ]).then(results=>{
    const error=results.find(r=>r.status==='rejected');
    if(error){for(const r of results)if(r.status==='fulfilled'&&r.value)releaseGraph(r.value.scene);throw error.reason;}
    const [base,reference]=results.map(r=>r.value);detailedReference=reference?.scene;
    return base;
   });
   pending.then(result=>{if(loadExpired){releaseGraph(result.scene);releaseGraph(detailedReference);}},()=>{});
   let asset;
   try{asset=await Promise.race([pending,new Promise((_,reject)=>{loadTimer=setTimeout(()=>{loadExpired=true;reject(new Error('Model download timed out'));},30000);})]);}finally{clearTimeout(loadTimer);}
   releaseResources=()=>{releaseGraph(asset.scene);releaseGraph(detailedReference);};
   if(!active||main.dataset.model!==selectedModel){releaseResources();loading=false;update();return;}
   renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
   renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=selectedModel==='olympiasm3'?.88:selectedModel==='lettera32'?.94:.86;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=selectedModel==='hermes3000'?T.PCFShadowMap:T.PCFSoftShadowMap;

   if(selectedModel==='lettera32')globalThis.LSBuildLettera32(T,asset.scene);
   if(selectedModel==='olympiasm3')globalThis.LSBuildOlympiaSM3(T,asset.scene);
   globalThis.LSRefineTypewriterDetails(T,asset.scene,selectedModel);
   const scene=new T.Scene(),nodes={};scene.add(asset.scene);releaseResources=()=>{releaseGraph(scene);if(detailedReference&&!detailedReference.parent)releaseGraph(detailedReference);};
   asset.scene.traverse(o=>{nodes[o.name]=o;if(o.isLight||o.isCamera)o.visible=false;if(o.isMesh){o.castShadow=!/Glyph_|Tick_|Ruler_Number|Knob_Reeding/.test(o.name);o.receiveShadow=true;}});
   // Invisible depth surface lets the HTML sheet hide the paper table behind it.
   nodes.Paper.visible=true;nodes.Paper.castShadow=true;nodes.Paper.receiveShadow=false;nodes.Paper.renderOrder=-10;
   // Window-shaped reflection cards describe chrome and enamel without a network HDRI.
   const room=new T.Scene();room.background=new T.Color(.022,.023,.025);
   for(const [pos,size,power,color] of [[[-2,3,2],[2.8,3.5,1],3.4,0xfff5df],[[3,1,0],[1.5,3,1],.8,0xdce9ed],[[0,3,-3],[3,.65,1],2,0xffffff]]){
    const card=new T.Mesh(new T.BoxGeometry(...size),new T.MeshBasicMaterial({color,side:T.DoubleSide}));card.material.color.multiplyScalar(power);card.position.set(...pos);card.lookAt(0,0,0);room.add(card);
   }
   if(['olympiasm3','lettera32','hermes3000'].includes(selectedModel)){
    // Narrow dark room divisions break up the chrome reflections; geometry and
    // physically based materials provide highlights, not white painted stripes.
    for(const [x,w] of [[-.7,.12],[.65,.24]]){const mullion=new T.Mesh(new T.BoxGeometry(w,2.6,.04),new T.MeshBasicMaterial({color:0x080b0c}));mullion.position.set(x,1.5,2.6);mullion.lookAt(0,.1,0);room.add(mullion);}
   }
   if(selectedModel==='lettera32'){
    const glossWindow=new T.Mesh(new T.BoxGeometry(.65,2.4,.025),new T.MeshBasicMaterial({color:0xf4f8ff}));glossWindow.material.color.multiplyScalar(4.2);glossWindow.position.set(-1.2,1.8,2);glossWindow.lookAt(0,0,0);room.add(glossWindow);
   }
   if(selectedModel==='hermes3000'){
    for(const child of [...room.children]){room.remove(child);child.geometry?.dispose();child.material?.dispose();}
    room.background=new T.Color(.009,.011,.012);
    for(const [pos,size,power] of [[[-1.2,2,1],[1.5,2.5,.02],2.4],[[1,.7,-1],[.25,1.6,.02],1.2],[[0,-.3,1.5],[1.6,.35,.02],2.8]]){
     const m=new T.MeshBasicMaterial({color:0xfff8ee});m.color.multiplyScalar(power);
     const card=new T.Mesh(new T.BoxGeometry(...size),m);card.position.set(...pos);card.lookAt(0,.1,0);room.add(card);
    }
   }
   if(selectedModel!=='hermes3000'){
    const bounce=new T.Mesh(new T.BoxGeometry(2.2,.65,.025),new T.MeshBasicMaterial({color:0xfff6e7}));bounce.material.color.multiplyScalar(2.2);bounce.position.set(0,-.9,2.5);bounce.lookAt(0,.1,0);room.add(bounce);
   }
   // Dark flags beside the window separate near-black silver reflections from
   // narrow highlights; the effect follows the surface normal, not painted bands.
   for(const x of [-1.25,1.25]){const flag=new T.Mesh(new T.BoxGeometry(.42,2.4,.025),new T.MeshBasicMaterial({color:0x030405}));flag.position.set(x,.3,2.4);flag.lookAt(0,.1,0);room.add(flag);}
   if(selectedModel==='olympiasm3'){
    for(const child of [...room.children]){room.remove(child);child.geometry?.dispose();child.material?.dispose();}
    room.background=new T.Color(.008,.009,.008);
    for(const [p,s,k] of [[[-.45,.8,-.55],[.65,.85,.01],6],[[.65,.4,.25],[.13,.85,.01],3],[[0,.75,-.6],[.9,.10,.01],7],[[0,.35,1.2],[.8,.12,.01],1.2]]){const m=new T.MeshBasicMaterial({color:0xffffff});m.color.multiplyScalar(k);const o=new T.Mesh(new T.BoxGeometry(...s),m);o.position.set(...p);o.lookAt(0,0,0);room.add(o);}
   }
   const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.025);scene.environment=environment.texture;pmrem.dispose();cleanups.push(()=>environment.dispose());
   room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
   // Static micrograin stays attached to the finish; mipmaps avoid sparkling at small sizes.
   const grainData=new Uint8Array(256*256*4),finishData=new Uint8Array(grainData.length);let seed=31;
   for(let i=0;i<grainData.length;i+=4){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const height=80+(seed>>>25),tone=240+(seed>>>28);
    grainData[i]=grainData[i+1]=grainData[i+2]=height;grainData[i+3]=255;
    finishData[i]=finishData[i+1]=finishData[i+2]=tone;finishData[i+3]=255;
   }
   const grain=new T.DataTexture(grainData,256,256,T.RGBAFormat),finish=new T.DataTexture(finishData,256,256,T.RGBAFormat);
   for(const texture of [grain,finish]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;}
   const materials=new Map();asset.scene.traverse(o=>{if(!o.isMesh)return;const old=o.material;if(materials.has(old)){o.material=materials.get(old);return;}
    let m=old;
    if(old.name==='Hermes_Sage_Enamel'){m=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(m,old);m.defines.PHYSICAL='';if(selectedModel!=='lettera32')m.color.lerp(new T.Color(.34,.32,.27),.16);m.color.setRGB(.19,.265,.20);m.roughness=.33;m.map=finish;m.roughnessMap=finish;m.clearcoat=.32;m.clearcoatRoughness=.23;m.bumpMap=grain;m.bumpScale=.00009;m.envMapIntensity=selectedModel==='hermes3000'?.94:.68;}
    else if(old.name==='Lettera_Blue_Enamel'){m=old.clone();m.bumpMap=grain;m.bumpScale=.000025;m.envMapIntensity=1.05;}
    else if(old.name==='Olympia_Crinkle_Enamel'){m=old.clone();m.envMapIntensity=.32;}
    else if(old.name==='Hermes_Badge_Metal'){m=old.clone();m.envMapIntensity=1.05;}
    else if(old.name==='Lettera_Badge_Edge'){m=old.clone();m.envMapIntensity=.85;}
    else if(old.name==='Olympia_Badge_Metal'){m=old.clone();m.envMapIntensity=.85;}
    else if(old.name==='Olympia_Chrome'){m=old.clone();m.envMapIntensity=1.05;}
    else if(old.name==='Mint_Keycaps'){m=old.clone();m.color.lerp(new T.Color(.48,.43,.31),.13);m.bumpMap=grain;m.bumpScale=.000065;m.envMapIntensity=.38;}
    else if(old.name==='Polished_Nickel'){m=old.clone();m.metalness=1;m.roughness=.23;m.envMapIntensity=.85;}
    else if(old.name==='Platen_Rubber'){m=old.clone();m.bumpMap=grain;m.bumpScale=.0001;m.envMapIntensity=.12;}
    else {m=old.clone();m.envMapIntensity=.3;}
    materials.set(old,m);o.material=m;
   });
   // Keep small steel mechanisms readable under the broad reflection cards.
   const mechanismMetal=new T.MeshStandardMaterial({color:new T.Color(.20,.23,.21),metalness:.95,roughness:.38,envMapIntensity:.68});
   asset.scene.traverse(o=>{if(o.isMesh&&/^(TypebarArm_|TypeSlug_|Type_Guide_|Ribbon_Carrier_)/.test(o.name))o.material=mechanismMetal;});
   const slugMetal=new T.MeshStandardMaterial({color:new T.Color(.32,.34,.31),metalness:1,roughness:.28,envMapIntensity:.72});
   asset.scene.traverse(o=>{if(o.isMesh&&/^TypeSlug_/.test(o.name))o.material=slugMetal;if(o.isMesh&&/^Olympia_Segment_Divider_/.test(o.name))o.material=mechanismMetal;});
   nodes.Paper.material=new T.MeshBasicMaterial({colorWrite:false,depthWrite:true,side:T.DoubleSide});
   for(const name of ['Card_Holder_Left','Card_Holder_Right']){
    const m=nodes[name].material;m.transparent=true;m.opacity=.16;m.depthWrite=false;m.side=T.DoubleSide;
    nodes[name].castShadow=false;
   }
   // Ribbon side guides stay fixed while the center follows the carrier lift.
   const ribbonPaths=['Ribbon_Path_Black','Ribbon_Path_Red'].map(n=>nodes[n]);
   // Both ribbon bands use the same black fabric, including during the strike lift.
   const ribbonFabric=nodes.Ribbon_Path_Black.material;
   for(const o of ribbonPaths){o.material=ribbonFabric.clone();o.material.side=T.DoubleSide;o.userData.basePositions=o.geometry.attributes.position.array.slice();o.geometry.attributes.position.setUsage(T.DynamicDrawUsage);}
   // One shared cap material; local-space tone survives key travel and separates the crown from the skirt.
   const capSource=nodes.Cap_KeyA.material,capMaterial=new T.MeshPhysicalMaterial();
   T.MeshStandardMaterial.prototype.copy.call(capMaterial,capSource);capMaterial.defines.PHYSICAL='';
   capMaterial.name=selectedModel==='olympiasm3'?'Olympia_Keycaps_Contour':selectedModel==='lettera32'?'Lettera_Keycaps_Contour':'Mint_Keycaps_Contour';capMaterial.vertexColors=true;capMaterial.roughness=.29;
   capMaterial.clearcoat=selectedModel==='olympiasm3'?.44:.30;capMaterial.clearcoatRoughness=selectedModel==='olympiasm3'?.21:.24;capMaterial.envMapIntensity=selectedModel==='olympiasm3'?.85:selectedModel==='lettera32'?.55:.24;
   if(selectedModel==='olympiasm3'){capMaterial.color.setRGB(.009,.023,.015);capMaterial.roughness=.22;capMaterial.clearcoat=.55;capMaterial.clearcoatRoughness=.16;capMaterial.envMapIntensity=.55;}
   if(selectedModel==='lettera32'){capMaterial.roughness=.22;capMaterial.clearcoat=.56;capMaterial.clearcoatRoughness=.14;capMaterial.envMapIntensity=.78;}
   if(selectedModel==='hermes3000'){capMaterial.color.setRGB(.32,.49,.255);capMaterial.roughness=.24;capMaterial.clearcoat=.42;capMaterial.clearcoatRoughness=.18;capMaterial.envMapIntensity=.65;}
   const shadedCaps=new Set(),smoothRange=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
   asset.scene.traverse(o=>{
    if(!o.isMesh||!o.name.startsWith('Cap_'))return;
    const g=o.geometry;
    if(!shadedCaps.has(g)){
     const p=g.attributes.position,n=g.attributes.normal,c=new Float32Array(p.count*3);
     for(let i=0;i<p.count;i++){
      const y=p.getY(i),top=smoothRange(.25,.82,n.getY(i))*smoothRange(-.001,.0035,y);
      const skirt=(selectedModel==='hermes3000'?.51:.64)+.13*smoothRange(-.008,.003,y),rim=.045*smoothRange(.0048,.0072,y);
      const tone=skirt*(1-top)+(1.02+rim)*top;
      c[i*3]=tone*.97;c[i*3+1]=tone;c[i*3+2]=tone*.96;
     }
     g.setAttribute('color',new T.BufferAttribute(c,3));shadedCaps.add(g);
    }
    o.material=capMaterial;
   });
   scene.add(new T.HemisphereLight(0xfff7e9,0x635347,selectedModel!=='hermes3000'?.10:selectedModel==='hermes3000'?.09:.38));
   const keyLight=new T.DirectionalLight(0xffecd7,selectedModel!=='hermes3000'?.65:1.05);keyLight.position.set(-.5,selectedModel==='hermes3000'?1.05:1.6,.7);keyLight.target.position.set(0,.07,0);scene.add(keyLight,keyLight.target);
   if(selectedModel==='olympiasm3'){keyLight.color.setHex(0xfff9ee);keyLight.position.set(-.45,.8,.6);}
   keyLight.castShadow=true;const shadowSize=selectedModel==='hermes3000'||view.clientWidth>760?2048:1024;keyLight.shadow.mapSize.set(shadowSize,shadowSize);Object.assign(keyLight.shadow.camera,{left:-.62,right:.62,top:.85,bottom:-.5,near:.1,far:3});keyLight.shadow.bias=selectedModel==='hermes3000'?-.0003:-.00015;keyLight.shadow.normalBias=selectedModel==='hermes3000'?.0008:.00018;keyLight.shadow.radius=4;keyLight.shadow.blurSamples=12;
   const fill=new T.DirectionalLight(0xe8dfd8,selectedModel==='hermes3000'?.07:.22);fill.position.set(.5,.3,-.3);scene.add(fill);
   // Seamless woven fabrics. Petals/leaves wrap across the tile edge, so the
   // full-width table has no image boundary or lighting baked into the pattern.
   const clothCache=new Map();let clothTexture,clothRepeat=12;
   function fabric(style){
    if(clothCache.has(style))return clothCache.get(style);
    if(style==='wood'){
     // User-provided wood photograph, unchanged. Mirror wrapping meets every
     // tile edge continuously without stretching the grain across the viewport.
     const texture=new T.TextureLoader().load('/img/typewriters/table-light-wood.png?v=1',()=>{if(!disposed)wake();});
     texture.encoding=T.sRGBEncoding;texture.wrapS=texture.wrapT=T.MirroredRepeatWrapping;
     texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;
     texture.anisotropy=Math.min(8,renderer.capabilities?.getMaxAnisotropy?.()||1);
     clothCache.set(style,texture);return texture;
    }

    const size=512,pixels=new Uint8Array(size*size*4);let seed=73;
    const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    // Two woven repeats per tile. Broad yarn bands, darker intersections and
    // paired fine threads match the reference's honey/brown check, not a line grid.
    const band=n=>{const t=((n%256)+256)%256;return t>=72&&t<164?1:0;};
    const pin=n=>{const t=((n%256)+256)%256;return (t>=61&&t<65)||(t>=171&&t<175);};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
     const i=(y*size+x)*4,gridX=x%128<6,gridY=y%128<6;
     const ink=style==='check'?(gridX&&gridY?.68:gridX||gridY?.54:0):0;
     const weave=((x%2?1:-1)+(y%2?1:-1))*.55+(rand()-.5)*2.6;
     // Floral albedo compensates for the warm key light/ACES washout; compare rendered colors, not raw pixels.
     const base=style==='check'?[170,187,177]:style==='linen'?[218,204,181]:[226,200,132];
     for(let c=0;c<3;c++)pixels[i+c]=Math.round(base[c]*(1-ink)+[91,121,128][c]*ink+weave);
     if(style==='gingham'){
      const u=x+y,v=y-x,bx=band(u),by=band(v),over=(Math.floor(x/2)+Math.floor(y/2))%2;
      const mix=bx&&by?.67:bx||by?.36:0;
      const fine=pin(u)||pin(v)?.095:0;
      const thread=(x%3===0?-1.6:.6)+(y%3===0?-1.4:.5)+(over?(bx-by)*2:(by-bx)*2)+Math.sin(x*Math.PI/16)*1.8+Math.sin(y*Math.PI/32)*1.4;
      for(let c=0;c<3;c++)pixels[i+c]=Math.round([193,143,76][c]*(1-mix-fine)+[99,63,38][c]*(mix+fine)+weave+thread);
     }
     pixels[i+3]=255;
    }
    function oval(cx,cy,rx,ry,angle,color,opacity=1){
     const radius=Math.ceil(Math.max(rx,ry)+1),co=Math.cos(angle),si=Math.sin(angle);
     for(let y=Math.floor(cy-radius);y<=cy+radius;y++)for(let x=Math.floor(cx-radius);x<=cx+radius;x++){
      const dx=x+.5-cx,dy=y+.5-cy,u=(dx*co+dy*si)/rx,v=(-dx*si+dy*co)/ry,d=u*u+v*v;
      if(d>=1)continue;const alpha=Math.min(1,(1-d)*4)*opacity,i=(((y%size+size)%size)*size+(x%size+size)%size)*4;
      for(let c=0;c<3;c++)pixels[i+c]=Math.round(pixels[i+c]*(1-alpha)+color[c]*alpha);
     }
    }
    if(style==='floral'){
     for(let row=0;row<7;row++)for(let col=0;col<8;col++){
      const cx=(col+.5+(rand()-.5)*.75)*size/8,cy=(row+.5+(rand()-.5)*.72)*size/7;
      const angle=rand()*Math.PI*2,scale=1.9+rand()*1.0,co=Math.cos(angle),si=Math.sin(angle);
      const stamp=(x,y,rx,ry,a,color,opacity)=>oval(cx+(x*co-y*si)*scale,cy+(x*si+y*co)*scale,rx*scale,ry*scale,a+angle,color,opacity);
      // Slender botanical sprigs and irregular, softly printed golden petals.
      stamp(0,4,.6,8,-.10,[117,126,64],.78);
      stamp(-2,6,3.2,1.3,-.55,[129,140,71],.86);stamp(2.3,9,3.6,1.4,.65,[126,139,70],.83);
      for(let k=0;k<5;k++){
       const a=k*Math.PI*2/5+rand()*.35,x=Math.cos(a)*2.1,y=Math.sin(a)*2.1-3;
       stamp(x,y,1.9+rand(),3.3+rand()*.8,a-Math.PI/2,[202,112+Math.floor(rand()*24),42],.95);
      }
      stamp(0,-3,1.35,1.35,0,[171,99,28],.9);
      stamp(3.6,1.8,1.7,2.7,-.4,[204,120,35],.9);
      // A few tiny detached buds break up the repeat without a rigid grid.
      if(rand()>.4)stamp(-12,20,1.3,2.2,.5,[204,130,48],.88);
     }
    }
    const texture=new T.DataTexture(pixels,size,size,T.RGBAFormat);
    texture.encoding=T.sRGBEncoding;texture.wrapS=texture.wrapT=T.RepeatWrapping;
    texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
    texture.anisotropy=Math.min(8,renderer.capabilities?.getMaxAnisotropy?.()||1);
    clothCache.set(style,texture);return texture;
   }
   const clothGeometry=new T.PlaneGeometry(3.6,1.8,64,48),clothPositions=clothGeometry.attributes.position;
   for(let i=0;i<clothPositions.count;i++){
    const x=clothPositions.getX(i),depth=.60-clothPositions.getY(i),drape=Math.max(0,Math.min(1,(depth-.22)/.35));
    clothPositions.setZ(i,drape*(Math.sin(x*23+depth*5)*.0016+Math.sin(x*9-depth*12)*.001));
   }
   clothGeometry.computeVertexNormals();
   const clothRestPositions=clothPositions.array.slice();
   const ground=new T.Mesh(clothGeometry,new T.MeshStandardMaterial({map:null,roughness:.96,metalness:0,bumpMap:grain,bumpScale:.000035,envMapIntensity:.12}));
   ground.name='Tablecloth';ground.rotation.x=-Math.PI/2;ground.position.set(0,-.004,.60);ground.receiveShadow=true;scene.add(ground);
   function applyTablecloth(){
    const style=['gingham','floral','check','linen','wood'].includes(main.dataset.table)?main.dataset.table:'gingham';
    clothTexture=fabric(style);clothRepeat=style==='wood'?4:style==='gingham'?30:style==='check'?45:style==='floral'?18:12;
    clothTexture.repeat.set(clothRepeat*ground.scale.x,clothRepeat/2*ground.scale.y);
    ground.material.map=clothTexture;ground.material.roughness=style==='wood'?.64:.96;
    // Compensate the room/ACES desaturation against the supplied photograph.
    ground.material.color.setRGB(style==='wood'?1.25:1,style==='wood'?.74:1,style==='wood'?.60:1);
    ground.material.bumpMap=style==='wood'?null:grain;ground.material.envMapIntensity=style==='wood'?.18:.12;
    for(let i=0;i<clothPositions.count;i++)clothPositions.setZ(i,style==='wood'?0:clothRestPositions[i*3+2]);
    clothPositions.needsUpdate=true;clothGeometry.computeVertexNormals();
    ground.material.needsUpdate=true;ground.userData.fabric=style;
   }
   applyTablecloth();
   observe(MutationObserver,()=>{applyTablecloth();wake();},main,{attributes:true,attributeFilter:['data-table']});
   // A transparent rear wall receives the same upper-left light as the table.
   // Keep it behind the entire carriage and sheet; the opaque depth-only Paper
   // mesh masks this shadow out of the HTML writing surface. Its exposed height
   // is updated with paper feed, so no hidden sheet tail casts a false shadow.
   const wall=new T.Mesh(new T.PlaneGeometry(3.6,3),new T.ShadowMaterial({color:0x514538,opacity:.24,depthWrite:false}));
   // VSM also draws receivers into its depth pass. Cull the wall's light-facing
   // side there so the infinite backdrop cannot cast a shadow onto itself.
   wall.material.shadowSide=T.BackSide;
   wall.name='Rear_Wall_Shadow';wall.position.set(0,.70,-.26);wall.receiveShadow=true;scene.add(wall);
   // Wide soft contact below the rubber feet, plus real moving cast shadows above it.
   const contactCanvas=document.createElement('canvas');contactCanvas.width=128;contactCanvas.height=128;const cc=contactCanvas.getContext('2d');const gradient=cc.createRadialGradient(64,64,12,64,64,64);gradient.addColorStop(0,'rgba(25,32,26,.16)');gradient.addColorStop(.6,'rgba(25,32,26,.07)');gradient.addColorStop(1,'rgba(25,32,26,0)');cc.fillStyle=gradient;cc.fillRect(0,0,128,128);
   const contact=new T.Mesh(new T.PlaneGeometry(.49,.33),new T.MeshBasicMaterial({map:new T.CanvasTexture(contactCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.set(0,-.003,.01);scene.add(contact);
   // Body-only presentation transform: uniform 10% reduction and a subtle
   // 3-degree top view around the fixed type strike point. Paper/carriage stay put.
   // Preserve clearance under the unchanged carriage after the body reduction.
   // The shallow rear relief affects the enclosure/seam only, not the strike rig.
   if(selectedModel!=='hermes3000')for(const name of ['Ribbon_Hood','Cast_Perimeter','Lettera_Cover_Seam','Olympia_Cover_Chrome','Opening_Folded_Flange']){
    const mesh=nodes[name];if(!mesh)continue;mesh.geometry=mesh.geometry.clone();const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++){const z=p.getZ(i),t=Math.max(0,Math.min(1,(-.10-z)/.05)),drop=.008*t*t*(3-2*t),slope=t>0&&t<1?-.008*6*t*(1-t)/.05:0;
     p.setY(i,p.getY(i)-drop);const normal=new T.Vector3(n.getX(i),n.getY(i),n.getZ(i)+slope*n.getY(i)).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);}
    p.needsUpdate=n.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
   }
   const badges=selectedModel!=='hermes3000'?null:globalThis.LSApplyTypewriterBadges?.(T,asset.scene,selectedModel,{anisotropy:renderer.capabilities?.getMaxAnisotropy?.()||1,onLoad:()=>{if(!disposed)wake();}});
   if(badges)cleanups.push(()=>badges.dispose());
   const bodyPose=new T.Group();bodyPose.name='Typewriter_Body_Pose';
   const strikePivot=new T.Vector3(0,.164,-.119);
   for(const part of [nodes.Carriage,nodes.Card_Holder_Left,nodes.Card_Holder_Right,nodes.Card_Holder_Edge,nodes.Card_Holder_Edge001])asset.scene.attach(part);
   const bodyParts=asset.scene.children.filter(o=>![nodes.Carriage,nodes.Card_Holder_Left,nodes.Card_Holder_Right,nodes.Card_Holder_Edge,nodes.Card_Holder_Edge001].includes(o)&&!o.isLight&&!o.isCamera);
   asset.scene.add(bodyPose);for(const part of bodyParts)bodyPose.attach(part);
   bodyPose.matrixAutoUpdate=false;
   bodyPose.matrix.makeTranslation(...strikePivot.toArray()).multiply(new T.Matrix4().makeRotationX(Math.PI/60)).multiply(new T.Matrix4().makeScale(.9,.9,.9)).multiply(new T.Matrix4().makeTranslation(...strikePivot.clone().negate().toArray()));
   contact.scale.set(.9,.9,1);
   // Extend only each paper holder's straight middle; retain its end profiles,
   // thickness and the inner gap around the printing point.
   for(const name of ['Card_Holder_Left','Card_Holder_Right','Card_Holder_Edge','Card_Holder_Edge001']){
    const holder=nodes[name];holder.geometry=holder.geometry.clone();const g=holder.geometry,p=g.attributes.position;g.computeBoundingBox();
    const b=g.boundingBox,extra=(b.max.x-b.min.x)*.10,mid=(b.max.x+b.min.x)/2,half=(b.max.x-b.min.x)*.20,leftSide=name.endsWith('Left')||name==='Card_Holder_Edge';
    for(let i=0;i<p.count;i++){const x=p.getX(i),t=Math.max(0,Math.min(1,(x-mid+half)/(2*half)));p.setX(i,x+(leftSide?-extra*(1-t):extra*t));}
    p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
   }
   const surfaces=globalThis.LSApplyTypewriterSurfaces?.(T,asset.scene,selectedModel,{anisotropy:renderer.capabilities?.getMaxAnisotropy?.()||1,onLoad:()=>{if(!disposed)wake();}});
   if(surfaces)cleanups.push(()=>surfaces.dispose());
   // A DOM counter follows the actual sheet corner, outside the clipped paper.
   const count=$('tbHermesCount');stage.appendChild(count);
   let countWidth=88,countHeight=20,countLimit=0;
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
   const referenceMotion=detailedReference?(selectedModel==='hermes3000'?globalThis.LSAttachHermesReference:selectedModel==='olympiasm3'?globalThis.LSAttachOlympiaReference:globalThis.LSAttachLetteraReference)(T,scene,asset.scene,detailedReference,nodes,{anisotropy:renderer.capabilities?.getMaxAnisotropy?.()||1}):null;
   const pressed=new Map(),hits=[],xAxis=new T.Vector3(1,0,0),yAxis=new T.Vector3(0,1,0),delta=new T.Quaternion();
   let resizePending=false,bufferWidth=0,bufferHeight=0,layoutPending=false,raf=0,until=0,prev=0,targetX=.096,currentX=.096,feed=0,currentFeed=0,returnAt=-1000,lastKeyAt=-1000,lastValue=null,width=0,height=0,renderWidth=0,bleedLeft=0,bleedRight=0,shift=false,shiftLift=0,drive=null,feedDrive=null,contentOffset=0;
   const measure=document.createElement('canvas').getContext('2d'),paperWidth=600,left=42,printBottom=30;
   let paperHeight=594,traceProjection=1,sheetWidth=.224,paperTop=.396,fontPixels=34,lineHeight=48,fullHeight=paperHeight,lastLine=0,rollerFeed=0,targetRoll=0;
   const clamp=v=>Math.max(0,Math.min(1,v)),smooth=t=>t*t*(3-2*t);
   function running(){return !disposed&&active&&!failed&&!document.hidden;}
   function resetKeys(){pressed.clear();hits.length=0;shift=false;keys.forEach(k=>{k.position.copy(k.userData.rest);k.quaternion.copy(k.userData.restQ);});}
   function stop(){cancelAnimationFrame(raf);raf=0;prev=0;resetKeys();}
   function wake(){until=performance.now()+800;if(!raf&&running())raf=requestAnimationFrame(frame);}
   // Canvas allocation and paper layout commit together inside a visible frame.
   function resize(){resizePending=true;wake();}
   function applyResize(){
    resizePending=false;
    if(disposed||!active||failed)return;
    width=view.clientWidth;height=view.clientHeight;if(!width||!height)return;
    const trace=tracing(),a=width/height,instrumentScale=1.15,close=selectedModel==='hermes3000'&&main.dataset.camera==='close';
    const baseSpan=Math.max(.52,.70/a)/(trace?.75*instrumentScale:1);
    // On tall desktop windows keep room for both reading panels and carriage travel.
    const panelSpan=trace&&width>980?(.420/instrumentScale)*height/((width-464)/1.86):0;
    const portrait=trace&&main.dataset.focusPortrait==='true';
    let span=portrait?Math.max(.80,.64/a):Math.max(baseSpan,panelSpan);
    // Pull back along the same orthographic sightline so tall screens do not clip the foreground cloth.
    camera.position.set(0,.60,.73);
    if(portrait)camera.position.addScaledVector(new T.Vector3(0,.395,.73).normalize(),3);
    camera.lookAt(0,.205,0);
    if(close){camera.position.set(0,.90,.40);camera.lookAt(0,.164,-.08);}
    // Render the cloth to the viewport edges without changing instrument framing.
    const rect=view.getBoundingClientRect?.(),viewportWidth=document.documentElement?.clientWidth||width;
    bleedLeft=Math.max(0,rect?.left||0);bleedRight=Math.max(0,viewportWidth-(rect?.right||width));renderWidth=width+bleedLeft+bleedRight;
    if(bufferWidth!==renderWidth||bufferHeight!==height){renderer.setSize(renderWidth,height,false);bufferWidth=renderWidth;bufferHeight=height;}
    renderer.domElement.style.width=renderWidth+'px';renderer.domElement.style.left=-bleedLeft+'px';
    view.style.setProperty('--tb-bleed-left',bleedLeft+'px');view.style.setProperty('--tb-bleed-right',bleedRight+'px');
    // Enlarge the instrument by 15%; inversely compensate the A4 sheet
    // to preserve its screen position, width, height and text size.
    sheetWidth=trace?.420/instrumentScale:.224;paperTop=trace?.174+.594/instrumentScale:.396;
    paperHeight=trace||feeding()?paperWidth*297/210:594;
    if(feeding()&&!trace)paperTop=.174+sheetWidth*297/210;
    camera.updateMatrixWorld();
    const sheetInset=trace?(parseFloat(getComputedStyle(main).getPropertyValue('--tb-focus-sheet-top'))||16):16;
    if(trace&&!portrait){
     const bounds=new T.Box3().setFromObject(bodyPose);let bottom=Infinity;
     for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])bottom=Math.min(bottom,new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse).y);
     const top=new T.Vector3(0,paperTop,-.151).applyMatrix4(camera.matrixWorldInverse).y;
     span=Math.max(span,(top-bottom)/Math.max(.35,1-(sheetInset+20)/height));
    }
    camera.left=-span*a/2-bleedLeft*span/height;camera.right=span*a/2+bleedRight*span/height;camera.top=span/2;camera.bottom=-span/2;
    if(trace){
     // Align the sheet with the flanking pages while keeping the complete body in frame.
     const sheetTop=new T.Vector3(0,paperTop,-.151).applyMatrix4(camera.matrixWorldInverse).y;
     camera.top=sheetTop+sheetInset*span/height;camera.bottom=camera.top-span;
    }
    if(close){span=Math.max(.33,.20/a);const strike=new T.Vector3(0,.174,-.151).applyMatrix4(camera.matrixWorldInverse);camera.top=strike.y+span*.20;camera.bottom=camera.top-span;camera.left=-span*a/2-bleedLeft*span/height;camera.right=span*a/2+bleedRight*span/height;}
    camera.updateProjectionMatrix();
    // Lower only the cloth by 10% of the immersive view height.
    ground.scale.y=portrait?Math.max(1,span*2):1;
    ground.position.z=portrait?.90+.9*(ground.scale.y-1):.60+(trace?span*(.10-(sheetInset-16)/height)/Math.abs(camera.matrixWorldInverse.elements[9]):0);
    clothTexture.repeat.y=clothRepeat/2*ground.scale.y;
    ground.scale.x=Math.max(1,(camera.right-camera.left)/3.6+.05);clothTexture.repeat.x=clothRepeat*ground.scale.x;
    wall.scale.x=ground.scale.x;
    const nextPanel=$('tbFocusNextText')?.parentElement?.getBoundingClientRect?.();
    countLimit=tracing()&&main.dataset.focusSides==='beside'&&nextPanel?nextPanel.left-(rect?.left||0)-8:width-8;
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
   function tracePosition(caret){
    const measured=window.LSTypewriterPaper?.position(input,$('tbOrig'),paper);if(measured)return measured;
    const host=$('tbOrig'),spans=host.children,first=spans[0];
    if(host.parentElement!==paper||!first||!host.clientWidth)return null;
    const atEnd=caret>=spans.length,span=spans[Math.min(caret,spans.length-1)];
    // Read the next glyph in the actual, fully laid-out source. Measuring just
    // the typed prefix cannot see a soft wrap until one character too late,
    // and canvas metrics can differ from the loaded webfont/DOM line boxes.
    let row=Math.max(0,Math.round((span.offsetTop-first.offsetTop)/lineHeight));
    let x=span.offsetLeft-left;
    if(atEnd){
     if(span.classList.contains('nl')){row++;x=0;}
     else x+=span.getBoundingClientRect().width/(paper.getBoundingClientRect().width/paperWidth);
    }
    return {row,width:Math.max(0,x)};
   }
   function sync(snap=false){
    if(disposed||!active||failed)return;snap=snap===true;
    const trace=tracing(),physical=feeding(),source=$('tbOrig').dataset.source||input.value,caret=Array.from(input.value.slice(0,input.selectionStart).normalize('NFC')).length;
    const prefix=trace?Array.from(source.normalize('NFC')).slice(0,caret).join(''):input.value.slice(0,input.selectionStart);
    if(trace)paper.style.setProperty('--tb-trace-font',getComputedStyle(input).fontFamily);
    const all=layout(input.value),before=layout(prefix),position=trace?tracePosition(caret):null,now=performance.now(),changed=input.value!==lastValue,initial=lastValue===null;
    // The sheet physically feeds upward; its print area grows instead of moving padding instantly.
    fullHeight=trace||physical?paperHeight:paperHeight+(all.length-1)*lineHeight;
    input.style.paddingTop=(trace||physical?32:paperHeight-printBottom-lineHeight)+'px';input.style.paddingBottom=(trace||physical?32:30)+'px';if(!trace)input.scrollTop=0;
    paper.dataset.paper=main.dataset.paper||'ivory';count.textContent=$('tbCount').textContent;countWidth=Math.max(76,count.textContent.length*6.5+12);count.style.width=countWidth+'px';
    if(!composing){
     const row=position?position.row:before.length-1,line=position||before[before.length-1],nextX=sheetWidth/2-left/paperWidth*sheetWidth-line.width/paperWidth*sheetWidth;
     // Keep the active baseline at the ribbon. Unskewed text needs the same
     // projection compensation in its mechanical feed distance.
     const worldPerPixel=(paperTop-.174)/paperHeight,rowsPerSheet=Math.max(1,Math.floor((paperHeight*traceProjection-64)/lineHeight));
     // Keep the exposed A4 sheet in place when full. Scroll only the overflow,
     // rather than snapping from the last row back to an almost hidden sheet.
     const advance=position?.advance??row*lineHeight,maxAdvance=Math.max(0,rowsPerSheet-1)*lineHeight;
     const sheetAdvance=physical?Math.min(advance,maxAdvance):advance;
     contentOffset=physical?Math.max(0,advance-maxAdvance):0;
     const nextFeed=physical?.196+(32+fontPixels*.95+sheetAdvance)/traceProjection*worldPerPixel-paperTop:trace?0:row*lineHeight*.222/paperHeight;
     const newLine=trace||physical?row+1>lastLine:nextFeed>feed+.0001;lastLine=row+1;
     if(newLine&&changed&&!initial)returnAt=now;
     if(Math.abs(nextX-targetX)>.000001){const returning=newLine&&nextX>targetX;drive={from:currentX,to:nextX,start:now+(returning?55:changed?34:0),duration:returning?390:changed?58:130};targetX=nextX;}
     if(Math.abs(nextFeed-feed)>.000001){feedDrive={from:currentFeed,to:nextFeed,start:now+(newLine?20:0),duration:newLine?180:150};feed=nextFeed;}
     targetRoll=physical?advance/traceProjection*worldPerPixel:trace?advance*sheetWidth/paperWidth:nextFeed;
     if(snap||initial){currentX=targetX;currentFeed=feed;rollerFeed=targetRoll;drive=feedDrive=null;}
     // Mobile IME may commit text without keyboard events. Space/newline never hit a typebar.
     if(changed&&!initial&&input.value.length>(lastValue||'').length&&now-lastKeyAt>100&&/\S$/.test(input.value)){const ch=Array.from(input.value).at(-1),bar=barFor.get('Key'+ch.toUpperCase())||bars[Array.from(input.value).length%bars.length];hits.push({bar,time:now});input.dispatchEvent(new CustomEvent('tb:hermes-sound',{detail:{key:ch}}));}
    }
    syncPaperScroll();if(!composing)lastValue=input.value;wake();
   }
   function syncPaperScroll(){
    if(!feeding())return;
    // During a feed animation the next glyph already belongs to the next line.
    // Compensate the not-yet-exposed part so it never slips below the ribbon.
    const worldPerPixel=(paperTop-.174)/paperHeight;
    const pending=Math.max(0,(feed-currentFeed)*traceProjection/worldPerPixel);
    const offset=contentOffset+pending;
    paper.dataset.feedScroll=String(offset);
    input.scrollTop=offset;if(tracing())$('tbOrig').scrollTop=offset;
   }
   function placePaper(){
    if(tracing()&&main.dataset.focusPortrait==='true'&&!(selectedModel==='hermes3000'&&main.dataset.camera==='close')){
     // Track part of the carriage sweep so the full body and moving paper fit a narrow screen.
     const offset=Math.max(-.07,Math.min(.07,currentX*.43)),span=camera.top-camera.bottom,a=width/height;
     camera.left=-span*a/2-bleedLeft*span/height+offset;camera.right=span*a/2+bleedRight*span/height+offset;camera.updateProjectionMatrix();
    }
    const top=paperTop+currentFeed+shiftLift,tl=new T.Vector3(-sheetWidth/2+currentX,top,-.151).project(camera),tr=new T.Vector3(sheetWidth/2+currentX,top,-.151).project(camera),bl=new T.Vector3(-sheetWidth/2+currentX,.174+currentFeed+shiftLift,-.151).project(camera);
    const x=(tl.x+1)*renderWidth/2-bleedLeft,y=(1-tl.y)*height/2,sx=(tr.x-tl.x)*renderWidth/2/paperWidth,sy=(tl.y-bl.y)*height/2/paperHeight;
    paper.style.transform=`matrix(${sx},0,0,${sy},${x},${y})`;
    const visible=feeding()?Math.max(0,Math.min(fullHeight,(top-shiftLift-.174)/(paperTop-.174)*paperHeight)):fullHeight;
    // Size the exposed sheet itself so the hidden tail cannot extend document scrolling.
    paper.style.height=(feeding()?visible:fullHeight)+'px';
    {
     const editorHeight=(feeding()?visible:fullHeight)*traceProjection+'px';
     if(input.style.height!==editorHeight)input.style.height=editorHeight;
     if(paper.style.getPropertyValue('--tb-trace-editor-height')!==editorHeight)paper.style.setProperty('--tb-trace-editor-height',editorHeight);
    }
    syncPaperScroll();paper.style.clipPath='none';
    paper.style.setProperty('--tb-feed-visible-height',visible+'px');
    const right=x+sx*paperWidth,beside=right+8+countWidth<=countLimit;
    count.dataset.placement=beside?'right':'above';
    count.style.left=((view.offsetLeft||0)+(beside?right+8:Math.max(4,Math.min(width-countWidth-4,right-countWidth))))+'px';
    count.style.top=((view.offsetTop||0)+y+(beside?2:-countHeight-6))+'px';
   }
   function frame(now){
    try{
    raf=0;if(!running())return;if(resizePending)applyResize();const dt=Math.min((now-(prev||now))/1000,.06);prev=now;const motion=!reduced.matches;
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
    const carriageShift=selectedModel==='olympiasm3';
    const shiftTarget=carriageShift&&shift&&motion?.006:0;
    shiftLift+=(shiftTarget-shiftLift)*(1-Math.exp(-dt*35));if(Math.abs(shiftTarget-shiftLift)<.000001)shiftLift=shiftTarget;
    basket.position.y+=((!carriageShift&&shift&&motion?-.004:0)-basket.position.y)*(1-Math.exp(-dt*35));
    if(!motion){currentX=targetX;currentFeed=feed;drive=feedDrive=null;}
    if(drive){const t=clamp((now-drive.start)/drive.duration);currentX=drive.from+(drive.to-drive.from)*smooth(t);if(t===1)drive=null;}
    if(feedDrive){const t=clamp((now-feedDrive.start)/feedDrive.duration);currentFeed=feedDrive.from+(feedDrive.to-feedDrive.from)*smooth(t);if(t===1)feedDrive=null;}
    carriage.position.x=currentX;carriage.position.y=shiftLift+(motion?impact*.0002:0);
    // 18 mm is the authored mesh radius, not a measured Hermes specification.
    rollerFeed=motion?rollerFeed+(targetRoll-rollerFeed)*(1-Math.exp(-dt*20)):targetRoll;
    const angle=-(tracing()||feeding()?rollerFeed:currentFeed)/.018;platen.quaternion.copy(platenQ).multiply(delta.setFromAxisAngle(yAxis,angle));knobs.forEach(k=>k.quaternion.copy(k.userData.restQ).multiply(delta.setFromAxisAngle(yAxis,angle)));
    const rt=now-returnAt;lever.quaternion.copy(leverQ);
    if(motion&&rt>=0&&rt<480){const pull=rt<85?smooth(rt/85):rt<340?1:1-smooth((rt-340)/140);lever.rotateX(-.34*pull);}
    const sheetHeight=feeding()?Math.max(.0001,paperTop+currentFeed-.174):(paperTop-.174)*fullHeight/paperHeight;
    nodes.Paper.scale.x=sheetWidth/.224;nodes.Paper.scale.y=sheetHeight/.222;nodes.Paper.position.y=paperTop+currentFeed-sheetHeight/2;
    referenceMotion?.sync({currentX,angle,leverPull:motion&&rt>=0&&rt<480?(rt<85?smooth(rt/85):rt<340?1:1-smooth((rt-340)/140)):0,lift,shiftLift});
    placePaper();renderer.render(scene,camera);
    if(main.dataset.hermesState!=='ready')sceneState('ready');
    if(layoutPending){layoutPending=false;view.dispatchEvent(new CustomEvent('tb:hermes-layout'));}
    if(!raf&&(now<until||pressed.size||hits.length||drive||feedDrive))raf=requestAnimationFrame(frame);
    }catch(error){failEngine(error);}
   }
   function down(e){
    if(!active)return;lastKeyAt=performance.now();if(e.code.startsWith('Shift'))shift=true;
    const key=nodes['Key_'+e.code];if(key&&!e.repeat)pressed.set(key.name,{time:lastKeyAt,up:0});
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey){if(e.code==='Enter'&&!e.isComposing&&!composing&&e.keyCode!==229)returnAt=lastKeyAt;const bar=barFor.get(e.code);if(bar)hits.push({bar,time:lastKeyAt});}
    wake();
   }
   function up(e){if(e.code.startsWith('Shift'))shift=[...pressed.entries()].some(([name,p])=>name!=='Key_'+e.code&&name.startsWith('Key_Shift')&&!p.up);const k=pressed.get('Key_'+e.code);if(k)k.up=performance.now();wake();}
   listen(input,'keydown',down);listen(document,'keyup',up);listen(window,'blur',()=>{resetKeys();wake();});listen(input,'blur',()=>{resetKeys();wake();});
   ['input','click','keyup','tb:paper'].forEach(e=>listen(input,e,()=>sync()));
   observe(MutationObserver,()=>sync(),main,{attributes:true,attributeFilter:['data-paper']});
   observe(MutationObserver,()=>{input.scrollTop=0;$('tbOrig').scrollTop=0;resize();},main,{attributes:true,attributeFilter:['data-paper-feed']});
   listen(view,'tb:hermes-align',resize);
   if(document.fonts)listen(document.fonts,'loadingdone',()=>sync(true));
   observe(ResizeObserver,resize,view);['tbMinus','tbPlus'].forEach(id=>listen($(id),'click',()=>{if(tracing())resize();}));listen($('tbFontW'),'change',()=>sync(true));listen($('tbReset'),'click',()=>queueMicrotask(()=>sync(true)));
   listen(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();failEngine(new Error('WebGL context lost'));});
   function dispose(){
    if(disposed)return;disposed=true;stop();cleanups.splice(0).forEach(fn=>fn());const geometries=new Set(),mats=new Set(),textures=new Set([grain,finish,contact.material.map,...clothCache.values()]);
    scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){mats.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}}});
    geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss?.();renderer.domElement.remove();
   }
   engine={sync,resize,wake,stop,dispose,model:selectedModel};stage.setAttribute('aria-label',modelNames[selectedModel]+(selectedModel==='hermes3000'?' 54키 외형':selectedModel==='olympiasm3'?' 51키':' 50키')+' 타자기와 입력 용지');main.dataset.hermesFailed='false';status.textContent=modelNames[main.dataset.model]+(main.dataset.model==='lettera32'?' · 50키':main.dataset.model==='olympiasm3'?' · 51키':' · 54키 외형')+' · 종이에 직접 입력';loading=false;update();
  }catch(error){cleanups.splice(0).forEach(fn=>fn());releaseResources();renderer?.dispose();renderer?.forceContextLoss?.();renderer?.domElement.remove();loading=false;if(selectedModel!==main.dataset.model||!active){update();return;}failEngine(error);}
 }
 update();
})();
