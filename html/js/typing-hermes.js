/* Fixed front camera, articulated Hermes 3000, and the actual IME textarea on its paper. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), main=$('tbMain'), stage=$('tbHermesStage'), view=$('tbHermesView'), paper=$('tbHermesPaper'), input=$('tbInput'), home=$('tbInputHome'), status=$('tbHermesStatus');
 if(!stage)return;
 const originalPlaceholder=input.placeholder;
 let active=false, inView=true, loading=false, engine=null, composing=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function restore(){if(input.parentElement===paper){home.after(input);input.style.paddingTop='';input.style.fontSize='';input.style.lineHeight='';input.placeholder=originalPlaceholder;}main.dataset.hermesReady='false';}
 function update(){
  active=main.dataset.skin==='retro' && main.dataset.model==='hermes3000' && !$('tbRead').hidden;
  stage.hidden=!active;
  if(!active){restore();engine?.stop();return;}
  if(!engine && !loading)init();
  if(engine){if(composing && input.parentElement!==paper)return;if(input.parentElement!==paper){const focused=document.activeElement===input;paper.appendChild(input);if(focused)input.focus({preventScroll:true});}input.placeholder='종이를 클릭하고 첫 문장을 입력하세요…';main.dataset.hermesReady='true';engine.sync();engine.resize();}
 }
 new MutationObserver(update).observe(main,{attributes:true,attributeFilter:['data-skin','data-model']});
 new MutationObserver(update).observe($('tbRead'),{attributes:true,attributeFilter:['hidden']});
 new IntersectionObserver(e=>{inView=e[0].isIntersecting;engine?.wake();}).observe(stage);
 document.addEventListener('visibilitychange',()=>engine?.wake());
 $('tbHermesFocus').addEventListener('click',()=>input.focus({preventScroll:true}));
 view.addEventListener('click',e=>{if(e.target!==input)input.focus({preventScroll:true});});
 input.addEventListener('compositionstart',()=>{composing=true;});
 input.addEventListener('compositionend',()=>{composing=false;update();engine?.sync();});
 async function init(){
  loading=true;status.textContent='Hermes 3000을 준비하고 있어요…';let renderer;
  try{
   const T=await import('/js/vendor/three/three.module.js'),{GLTFLoader}=await import('/js/vendor/three/GLTFLoader.js');
   renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
   const asset=await new GLTFLoader().loadAsync('/img/typewriters/hermes3000.glb?v=1');
   const scene=new T.Scene();scene.add(asset.scene);const nodes={};asset.scene.traverse(o=>{nodes[o.name]=o;if(o.isLight || o.isCamera)o.visible=false;});nodes.Paper.visible=false;
   scene.add(new T.HemisphereLight(0xfffaf0,0x405348,.75));
   for(const [pos,power] of [[[-.35,.6,.5],1.5],[[.4,.3,.1],.5],[[0,.5,-.5],.4]]){const l=new T.DirectionalLight(0xffffff,power);l.position.set(...pos);scene.add(l);}
   const camera=new T.OrthographicCamera();camera.position.set(0,.42,.65);camera.lookAt(0,.18,-.015);
   view.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
   const keys=Object.values(nodes).filter(o=>o.name.startsWith('Key_')),bars=Object.values(nodes).filter(o=>/^Typebar_\d+$/.test(o.name));
   keys.forEach(o=>o.userData.rest=o.position.clone());bars.forEach(o=>o.userData.rest=o.quaternion.clone());
   const barFor=new Map(bars.map(o=>[o.userData.keyCode,o]));
   const carriage=nodes.Carriage,platen=nodes.Platen,guide=nodes.Ribbon_Guide,lever=nodes.Return_Lever,basket=nodes.Typebasket;
   const guideY=guide.position.y,leverQ=lever.quaternion.clone(),platenQ=platen.quaternion.clone();
   const pressed=new Map(),hits=[],xAxis=new T.Vector3(1,0,0),yAxis=new T.Vector3(0,1,0),delta=new T.Quaternion();
   let raf=0,until=0,prev=0,targetX=.096,currentX=.096,feed=0,currentFeed=0,returnAt=-1000,lastKeyAt=0,lastValue='',width=0,height=0,shift=false;
   const measure=document.createElement('canvas').getContext('2d');
   const paperWidth=600,paperHeight=594,left=42,printBottom=30;let fontPixels=34,lineHeight=48;
   function running(){return active && inView && !document.hidden;}
   function stop(){cancelAnimationFrame(raf);raf=0;pressed.clear();hits.length=0;}
   function wake(){until=performance.now()+700;if(!raf && running())raf=requestAnimationFrame(frame);}
   function resize(){width=view.clientWidth;height=view.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);const a=width/height,span=Math.max(.43,.63/a);camera.left=-span*a/2;camera.right=span*a/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();camera.updateMatrixWorld();const paperScale=.224/(span*a)*width;fontPixels=Math.max(34,Math.min(72,16/(paperScale/600)));lineHeight=fontPixels*1.42;input.style.fontSize=fontPixels+'px';input.style.lineHeight=lineHeight+'px';sync();wake();}
   function layout(text){
    const font=getComputedStyle(input);measure.font=fontPixels+'px '+font.fontFamily;
    const lines=[];let row='',units=0;
    for(const ch of Array.from(text)){if(ch==='\n'){lines.push({text:row,width:units});row='';units=0;continue;}const n=measure.measureText(ch).width;if(units+n>paperWidth-left*2 && row){lines.push({text:row,width:units});row='';units=0;}row+=ch;units+=n;}
    lines.push({text:row,width:units});return lines;
   }
   function sync(){
    if(!active)return;
    const all=layout(input.value),before=layout(input.value.slice(0,input.selectionStart));
    // Padding puts the current writing line at the platen; completed lines feed upward.
    input.style.paddingTop=Math.max(24,paperHeight-printBottom-all.length*lineHeight)+'px';
    if(input.selectionStart===input.value.length)input.scrollTop=input.scrollHeight;
    paper.dataset.paper=main.dataset.paper||'ivory';
    $('tbHermesCount').textContent=$('tbCount').textContent;
    if(!composing){const line=before[before.length-1];targetX=.112-left/paperWidth*.224-line.width/paperWidth*.224;feed=(before.length-1)*.22;}
    // Touch keyboards may send input without physical keydown; still strike on committed text.
    if(!composing && input.value.length>lastValue.length && performance.now()-lastKeyAt>90 && bars.length){hits.push({bar:bars[Array.from(input.value).length%bars.length],time:performance.now()});}
    lastValue=input.value;wake();
   }
   function placePaper(){
    const tl=new T.Vector3(-.112+currentX,.396,-.151).project(camera),tr=new T.Vector3(.112+currentX,.396,-.151).project(camera),bl=new T.Vector3(-.112+currentX,.174,-.151).project(camera);
    const x=(tl.x+1)*width/2,y=(1-tl.y)*height/2,sx=(tr.x-tl.x)*width/2/paperWidth,sy=(tl.y-bl.y)*height/2/paperHeight;
    paper.style.transform=`matrix(${sx},0,0,${sy},${x},${y})`;
   }
   function frame(now){
    raf=0;if(!running())return;const dt=Math.min((now-(prev||now))/1000,.06);prev=now;const motion=!reduced.matches;
    keys.forEach(k=>{k.position.copy(k.userData.rest);const p=pressed.get(k.name);if(p){let depth=Math.min(1,(now-p.time)/24);if(p.up)depth*=Math.max(0,1-(now-p.up)/90);k.position.y-=motion?depth*.0045:0;if(p.up && now-p.up>100)pressed.delete(k.name);}});
    bars.forEach(b=>b.quaternion.copy(b.userData.rest));let lift=0;
    for(let i=hits.length-1;i>=0;i--){const h=hits[i],t=(now-h.time)/150;if(t>=1){hits.splice(i,1);continue;}const s=motion?Math.sin(Math.PI*t):0;h.bar.quaternion.copy(h.bar.userData.rest).multiply(delta.setFromAxisAngle(xAxis,-1.05*s));lift=Math.max(lift,s);}
    guide.position.y=guideY+lift*.008;basket.position.y=shift&&motion?-.004:0;
    currentX=motion?currentX+(targetX-currentX)*(1-Math.exp(-dt*(now-returnAt<420?10:28))):targetX;carriage.position.x=currentX;
    currentFeed=motion?currentFeed+(feed-currentFeed)*(1-Math.exp(-dt*16)):feed;
    platen.quaternion.copy(platenQ).multiply(delta.setFromAxisAngle(yAxis,currentFeed));
    lever.quaternion.copy(leverQ);if(motion && now-returnAt<420)lever.rotateX(-.4*Math.sin(Math.PI*(now-returnAt)/420));
    for(const name of ['Platen_Knob_Left','Platen_Knob_Right']){const k=nodes[name];if(k){k.userData.restQ??=k.quaternion.clone();k.quaternion.copy(k.userData.restQ).multiply(delta.setFromAxisAngle(yAxis,currentFeed));}}
    placePaper();renderer.render(scene,camera);
    if(now<until || pressed.size || hits.length || Math.abs(currentX-targetX)>.0001 || Math.abs(currentFeed-feed)>.001)raf=requestAnimationFrame(frame);
   }
   function down(e){
    if(!active || e.ctrlKey || e.metaKey || e.altKey)return;lastKeyAt=performance.now();
    if(e.code.startsWith('Shift'))shift=true;
    const key=nodes['Key_'+e.code];if(key&&!e.repeat)pressed.set(key.name,{time:lastKeyAt,up:0});
    if(e.code==='Enter'&&!e.isComposing)returnAt=lastKeyAt;
    const bar=barFor.get(e.code);if(bar)hits.push({bar,time:lastKeyAt});wake();
   }
   function up(e){if(e.code.startsWith('Shift'))shift=false;const k=pressed.get('Key_'+e.code);if(k)k.up=performance.now();wake();}
   input.addEventListener('keydown',down);document.addEventListener('keyup',up);window.addEventListener('blur',()=>{shift=false;pressed.clear();hits.length=0;wake();});
   ['input','click','keyup','tb:paper'].forEach(e=>input.addEventListener(e,sync));
   new MutationObserver(sync).observe(main,{attributes:true,attributeFilter:['data-paper']});
   new ResizeObserver(resize).observe(view);$('tbFontW').addEventListener('change',sync);$('tbReset').addEventListener('click',()=>queueMicrotask(sync));
   renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stop();restore();main.dataset.hermesFailed='true';status.textContent='3D 표시가 중단되어 기본 입력창으로 전환했어요.';});
   engine={sync,resize,wake,stop};main.dataset.hermesFailed='false';status.textContent='정면 타자기 · 종이에 직접 입력';loading=false;update();
  }catch(error){renderer?.dispose();renderer?.domElement.remove();restore();main.dataset.hermesFailed='true';status.textContent='타자기를 불러오지 못했어요. 기본 입력창을 사용해 주세요.';console.warn('Hermes 3000 unavailable',error);loading=false;}
 }
 update();
})();
