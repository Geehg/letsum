/* Articulated Classic 12 visual reconstruction. No input interception or remote services. */
(() => {
  'use strict';
  const main=document.getElementById('tbMain'), input=document.getElementById('tbInput'), stage=document.getElementById('tb3dStage'), select=document.getElementById('tbModel');
  if(!main || !input || !stage || !select) return;
  const status=document.getElementById('tb3dStatus'), viewport=document.getElementById('tb3dView');
  let choice='hermes3000'; try {choice=localStorage.getItem('typebook-v1:model-v2') || choice;}catch(e){}
  if(!['hermes3000','classic12','retro'].includes(choice)) choice='hermes3000'; select.value=choice;
  let engine, loading=false, visible=false, intersecting=true;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function active(){return visible && intersecting && !document.hidden;}
  function update(){
    const model=main.dataset.readingMode==='immersive'?'hermes3000':choice;
    visible=main.dataset.skin==='retro' && !document.getElementById('tbRead').hidden && model==='classic12';
    main.dataset.model=model;stage.hidden=!visible;
    if(visible && !engine && !loading) init();
    if(engine){engine.sync();engine.wake();}
  }
  select.addEventListener('change',()=>{choice=select.value;try{localStorage.setItem('typebook-v1:model-v2',choice);}catch(e){}update();});
  new MutationObserver(update).observe(main,{attributes:true,attributeFilter:['data-skin','data-reading-mode']});
  new MutationObserver(update).observe(document.getElementById('tbRead'),{attributes:true,attributeFilter:['hidden']});
  new IntersectionObserver(entries=>{intersecting=entries[0].isIntersecting;if(engine)engine.wake();}).observe(stage);
  document.addEventListener('visibilitychange',()=>{if(engine)engine.wake();});
  document.getElementById('tb3dFocus').addEventListener('click',()=>input.focus({preventScroll:true}));
  viewport.addEventListener('click',()=>input.focus({preventScroll:true}));
  async function init(){
    loading=true;status.textContent='타자기를 불러오는 중…';
    let renderer;
    try {
      const THREE=await import('/js/vendor/three/three.module.js');
      const {GLTFLoader}=await import('/js/vendor/three/GLTFLoader.js');
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputEncoding=THREE.sRGBEncoding;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
      const gltf=await new GLTFLoader().loadAsync('/img/typewriters/classic12.glb?v=1');
      const scene=new THREE.Scene();scene.add(gltf.scene);
      gltf.scene.traverse(o=>{if(o.isLight)o.visible=false;});
      scene.add(new THREE.HemisphereLight(0xfffaf0,0x45534c,1.5));
      const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(-.4,.7,.5);scene.add(light);
      const fill=new THREE.DirectionalLight(0xcce6e1,.7);fill.position.set(.4,.3,-.2);scene.add(fill);
      const camera=new THREE.OrthographicCamera();camera.position.set(.035,.56,.58);camera.lookAt(0,.15,-.025);
      viewport.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
      const nodes={};gltf.scene.traverse(o=>{nodes[o.name]=o;});
      const carriage=nodes.Carriage, paper=nodes.Paper, guide=nodes.Ribbon_Guide, lever=nodes.Return_Lever, platen=nodes.Platen;
      const keys=Object.values(nodes).filter(o=>o.name.startsWith('Key_'));
      const bars=Object.values(nodes).filter(o=>/^Typebar_\d+$/.test(o.name));
      keys.forEach(o=>o.userData.rest=o.position.clone());bars.forEach(o=>o.userData.rest=o.quaternion.clone());
      const guideY=guide.position.y,leverQ=lever.quaternion.clone(),platenQ=platen.quaternion.clone();
      const sheet=document.createElement('canvas');sheet.width=1024;sheet.height=1024;
      const ctx=sheet.getContext('2d'), texture=new THREE.CanvasTexture(sheet);texture.encoding=THREE.sRGBEncoding;texture.flipY=false;
      paper.material=new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide,roughness:.9});
      let targetX=0,currentX=0,feed=0,returnAt=0,lastText=null,lastPaper=null,raf=0,until=0,lastTime=0;
      const presses=new Map(), hits=[];
      const barCodes=[...'1234567890'].map(x=>'Digit'+x).concat([...'QWERTYUIOPASDFGHJKLZXCVBNM'].map(x=>'Key'+x),['Comma','Period','Semicolon','Minus']);
      const barFor=new Map(barCodes.map((code,i)=>[code,bars.find(o=>o.name==='Typebar_'+i)]));
      function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);const a=w/h;const span=Math.max(.43,.56/a);camera.left=-span*a/2;camera.right=span*a/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();wake();}
      function wrapped(text){const out=[];for(const line of text.split('\n')){const chars=Array.from(line);if(!chars.length)out.push('');else for(let i=0;i<chars.length;i+=42)out.push(chars.slice(i,i+42).join(''));}return out;}
      function sync(){
        const before=input.value.slice(0,input.selectionStart), lines=wrapped(before),col=Array.from(lines[lines.length-1]||'').length;
        targetX=-Math.min(col,42)*.00294;feed=(lines.length-1)*.22;
        const color=main.dataset.paper||'ivory';
        if(input.value!==lastText || color!==lastPaper){
          lastText=input.value;lastPaper=color;ctx.fillStyle=color==='white'?'#fffefa':color==='parchment'?'#e8d6af':'#f3eedf';ctx.fillRect(0,0,1024,1024);
          ctx.fillStyle='#787567';ctx.font='18px Georgia';ctx.fillText('LETSUM  /  A PAGE OF YOUR OWN',80,92);
          ctx.fillStyle='#33352f';ctx.font='23px monospace';
          const textLines=wrapped(input.value).slice(-19);textLines.forEach((line,i)=>ctx.fillText(line,80,930-(textLines.length-1-i)*38));texture.needsUpdate=true;
        }wake();
      }
      function wake(){until=performance.now()+650;if(!raf && active())raf=requestAnimationFrame(frame);}
      function frame(now){
        raf=0;if(!active())return;const dt=Math.min((now-(lastTime||now))/1000,.06);lastTime=now;
        const moving=!reduced.matches;
        for(const k of keys){const p=presses.get(k.name);k.position.copy(k.userData.rest);if(p){const elapsed=now-p.time;const d=moving?Math.min(1,elapsed/24)*(p.up?Math.max(0,1-(now-p.up)/95):1):0;k.position.y-=d*.004;if(p.up && now-p.up>100)presses.delete(k.name);}}
        bars.forEach(o=>o.quaternion.copy(o.userData.rest));let lift=0;
        for(let i=hits.length-1;i>=0;i--){const hit=hits[i],t=(now-hit.time)/160;if(t>=1){hits.splice(i,1);continue;}const s=moving?Math.sin(Math.PI*Math.max(0,t)):0;hit.bar.quaternion.copy(hit.bar.userData.rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-1.05*s));lift=Math.max(lift,s);}
        guide.position.y=guideY+lift*.008;
        currentX=moving?currentX+(targetX-currentX)*(1-Math.exp(-dt*(now-returnAt<400?9:27))):targetX;carriage.position.x=currentX+.092;
        lever.quaternion.copy(leverQ);if(moving && now-returnAt<430)lever.rotateX(-.38*Math.sin(Math.PI*(now-returnAt)/430));
        platen.quaternion.copy(platenQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),feed));
        renderer.render(scene,camera);
        if(now<until || presses.size || hits.length || Math.abs(targetX-currentX)>.0001)raf=requestAnimationFrame(frame);
      }
      function keydown(e){
        if(!visible || e.ctrlKey || e.metaKey || e.altKey)return;
        const name='Key_'+(e.code==='ShiftRight'?'ShiftRight':e.code),k=nodes[name];
        if(k && !e.repeat)presses.set(name,{time:performance.now(),up:0});
        if(e.code==='Enter')returnAt=performance.now();
        if((/^Key[A-Z]$|^Digit\d$/.test(e.code)||['Comma','Period','Semicolon','Quote','Slash','Minus','Equal'].includes(e.code)) && !e.repeat){const bar=barFor.get(e.code);if(bar)hits.push({time:performance.now(),bar});}
        wake();
      }
      function keyup(e){const p=presses.get('Key_'+e.code);if(p)p.up=performance.now();wake();}
      function clear(){presses.clear();hits.length=0;wake();}
      input.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);window.addEventListener('blur',clear);
      ['input','compositionend','click','keyup','tb:paper'].forEach(event=>input.addEventListener(event,sync));
      new MutationObserver(sync).observe(main,{attributes:true,attributeFilter:['data-paper']});
      new ResizeObserver(resize).observe(viewport);engine={sync,wake};resize();sync();status.textContent='Classic 12 · 시각적 재현';stage.dataset.ready='true';main.dataset.modelFailed='false';
      renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();main.dataset.modelFailed='true';status.textContent='3D 표시가 중단되었습니다. 기본 필사는 계속 사용할 수 있습니다.';cancelAnimationFrame(raf);});
    }catch(e){if(renderer){renderer.dispose();renderer.domElement.remove();}status.textContent='3D를 불러오지 못했습니다. 기본 필사는 그대로 사용할 수 있습니다.';stage.dataset.ready='error';main.dataset.modelFailed='true';console.warn('Typewriter 3D unavailable',e);}
    finally{loading=false;}
  }
  update();
})();
