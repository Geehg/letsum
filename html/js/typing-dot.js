/* Local image input -> transferable pixels -> cancellable worker -> exact PNG. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),root=$('drApp');if(!root)return;
 const result=$('drResult'),original=$('drOriginal'),source=document.createElement('canvas');
 const mobile=matchMedia('(max-width:600px)').matches||(navigator.deviceMemory&&navigator.deviceMemory<=4),cap=mobile?1600:2400;
 let active=false,hasSource=false,ready=false,dirty=false,loading=false,saving=false,view='result',worker=null,timer=0,watchdog=0,revision=0,imageRevision=0,filename='도트레트로';
 const palettes={rose:['#2a267c','#efd8dd'],cream:['#292820','#f4eddb'],green:['#274d3c','#f0eedf'],orange:['#b94025','#faf0df']};
 if(mobile){$('drSize').value='1200';$('drSize').querySelector('[value="2400"]').disabled=true;$('drSizeNote').textContent='모바일·저메모리 기기는 최대 1,600px. 원본보다 확대하지 않습니다.';}
 const status=text=>{$('drStatus').textContent=text;};
 function controls(){
  $('drSave').disabled=!ready||dirty||loading||saving||!!worker;
  $('drClear').disabled=!hasSource&&!loading;
  $('drZoom').disabled=!ready;$('drCancel').hidden=!worker;
  root.setAttribute('aria-busy',String(loading||!!worker||saving));
 }
 function show(){
  $('drEmpty').hidden=hasSource;original.hidden=!hasSource||view!=='original';result.hidden=!ready||view!=='result';
  $('drViewOriginal').setAttribute('aria-pressed',String(view==='original'));
  $('drViewResult').setAttribute('aria-pressed',String(view==='result'));
 }
 function stop(){clearTimeout(timer);clearTimeout(watchdog);worker?.terminate();worker=null;revision++;saving=false;controls();}
 function settings(){return {mode:$('drMode').value,dot:+$('drDot').value,contrast:+$('drContrast').value,brightness:+$('drBrightness').value,ink:$('drInk').value,paper:$('drPaper').value,transparent:$('drTransparent').checked};}
 function updateLabels(){for(const key of ['Dot','Contrast','Brightness'])$('dr'+key+'Value').textContent=$('dr'+key).value+(key==='Contrast'?'%':'');}
 function schedule(){
  updateLabels();stop();dirty=true;$('drRetry').hidden=true;controls();
  if(hasSource&&active&&!loading){status('설정을 반영하고 있어요…');timer=setTimeout(convert,180);}
 }
 function convert(){
  if(!hasSource||!active||loading)return;
  stop();dirty=true;const ticket=revision,start=performance.now();
  const scale=Math.min(1,Math.min(cap,+$('drSize').value)/Math.max(source.width,source.height));
  original.width=Math.max(1,Math.round(source.width*scale));original.height=Math.max(1,Math.round(source.height*scale));
  const ctx=original.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,original.width,original.height);
  status('잉크 점을 찍고 있어요…');$('drRetry').hidden=true;
  function failed(message){if(ticket!==revision)return;stop();dirty=true;status(message);$('drRetry').hidden=false;controls();}
  try{
   const rgba=ctx.getImageData(0,0,original.width,original.height).data;
   worker=new Worker('/js/typing-dot-worker.js?v=1');controls();
   watchdog=setTimeout(()=>failed('처리가 오래 걸려 중단했어요. 출력 크기를 줄이고 다시 시도해 주세요.'),20000);
   worker.onerror=e=>{e.preventDefault();failed('변환 도구를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');};
   worker.onmessage=({data})=>{
    if(ticket!==revision||!active)return;
    if(data.error){failed(data.error);return;}
    clearTimeout(watchdog);worker.terminate();worker=null;
    result.width=data.width;result.height=data.height;
    result.getContext('2d').putImageData(new ImageData(data.rgba,data.width,data.height),0,0);
    ready=true;dirty=false;controls();show();
    $('drDimensions').textContent=`${data.width.toLocaleString()} × ${data.height.toLocaleString()} PX`;
    const elapsed=performance.now()-start;root.dataset.renderMs=elapsed.toFixed(1);root.dataset.workerMs=data.ms.toFixed(1);root.dataset.workingBytes=data.workingBytes;
    status(`완성 · ${(elapsed/1000).toFixed(2)}초 · PNG로 저장해 보세요.`);
   };
   worker.postMessage({width:original.width,height:original.height,rgba,settings:settings()},[rgba.buffer]);
  }catch(_){failed('이 브라우저에서 변환하지 못했어요. 최신 브라우저로 열거나 출력 크기를 줄여 주세요.');}
 }
 function useImage(image,name){
  stop();const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height,s=Math.min(1,cap/Math.max(w,h));
  source.width=Math.max(1,Math.round(w*s));source.height=Math.max(1,Math.round(h*s));source.getContext('2d').drawImage(image,0,0,source.width,source.height);
  hasSource=true;ready=false;dirty=true;filename=name.replace(/\.[^.]+$/,'').slice(0,70)||'도트레트로';
  $('drFileName').textContent=`${name} · ${w.toLocaleString()} × ${h.toLocaleString()}`;
  $('drPaperFrame').classList.remove('is-zoom');$('drZoom').textContent='실제 크기 보기';$('drZoom').setAttribute('aria-pressed','false');
  show();schedule();
 }
 async function loadFile(file){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){status('JPG, PNG, WebP 파일을 선택해 주세요.');return;}
  if(file.size>20*1024*1024){status('20MB 이하 이미지를 선택해 주세요.');return;}
  stop();loading=true;controls();const ticket=++imageRevision,url=URL.createObjectURL(file),img=new Image();
  status('사진을 이 기기에서 열고 있어요…');
  try{
   img.src=url;await img.decode();if(ticket!==imageRevision||!active)return;
   if(img.naturalWidth*img.naturalHeight>24e6)throw Error('large');
   loading=false;useImage(img,file.name);
  }catch(error){if(ticket===imageRevision){loading=false;status(error.message==='large'?'2,400만 화소 이하로 줄인 이미지를 선택해 주세요.':'이 이미지를 열 수 없어요. 다른 파일을 선택해 주세요.');controls();if(hasSource&&dirty)$('drRetry').hidden=false;}}
  finally{URL.revokeObjectURL(url);img.src='';}
 }
 $('drFile').addEventListener('change',e=>{loadFile(e.target.files[0]);e.target.value='';});
 for(const ev of ['dragenter','dragover'])$('drDrop').addEventListener(ev,e=>{e.preventDefault();$('drDrop').classList.add('is-over');});
 for(const ev of ['dragleave','drop'])$('drDrop').addEventListener(ev,e=>{e.preventDefault();$('drDrop').classList.remove('is-over');if(ev==='drop')loadFile(e.dataTransfer.files[0]);});
 for(const id of ['drDot','drContrast','drBrightness','drInk','drPaper'])$(id).addEventListener('input',()=>{if(id==='drInk'||id==='drPaper')$('drPalette').value='custom';schedule();});
 for(const id of ['drMode','drTransparent','drSize'])$(id).addEventListener('change',()=>{if(id==='drMode')$('drDot').value=$('drMode').value==='halftone'?'8':'2';schedule();});
 $('drPalette').addEventListener('change',()=>{const p=palettes[$('drPalette').value];if(p){$('drInk').value=p[0];$('drPaper').value=p[1];schedule();}});
 $('drReset').addEventListener('click',()=>{$('drMode').value='grain';$('drDot').value='2';$('drContrast').value='115';$('drBrightness').value='0';schedule();});
 for(const choice of ['Original','Result'])$('drView'+choice).addEventListener('click',()=>{view=choice.toLowerCase();show();});
 $('drZoom').addEventListener('click',()=>{const zoom=$('drPaperFrame').classList.toggle('is-zoom');$('drZoom').textContent=zoom?'화면에 맞추기':'실제 크기 보기';$('drZoom').setAttribute('aria-pressed',String(zoom));});
 $('drRetry').addEventListener('click',convert);
 $('drCancel').addEventListener('click',()=>{stop();dirty=true;controls();$('drRetry').hidden=false;status('변환을 중단했어요. 설정을 바꾸거나 다시 변환해 주세요.');});
 $('drClear').addEventListener('click',()=>{
  stop();imageRevision++;loading=false;hasSource=ready=dirty=false;
  for(const c of [source,original,result]){c.width=1;c.height=1;}
  $('drFileName').textContent='사진을 선택하거나 예제로 시작하세요.';$('drDimensions').textContent='PRINT PREVIEW';$('drRetry').hidden=true;
  show();controls();status('사진을 지웠어요. 새 사진으로 시작해 보세요.');
 });
 $('drSave').addEventListener('click',()=>{
  if(!ready||dirty||worker||saving||loading)return;
  saving=true;controls();const ticket=revision;status('PNG 파일을 만들고 있어요…');
  result.toBlob(blob=>{
   if(ticket!==revision||!active)return;
   saving=false;controls();if(!blob){status('PNG 저장에 실패했어요. 출력 크기를 줄이고 다시 시도해 주세요.');return;}
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename+'-도트레트로.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
   status('PNG 저장을 요청했어요. 브라우저 다운로드를 확인해 주세요.');
  },'image/png');
 });
 // An original procedural still life; no remote image or third-party specimen.
 function example(){
  imageRevision++;loading=false;const c=document.createElement('canvas');c.width=1200;c.height=1400;const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
  x.save();x.translate(560,690);x.rotate(-.35);
  const steel=x.createLinearGradient(-190,0,190,0);steel.addColorStop(0,'#353535');steel.addColorStop(.19,'#a0a0a0');steel.addColorStop(.4,'#f7f7f7');steel.addColorStop(.55,'#9d9d9d');steel.addColorStop(.75,'#ededed');steel.addColorStop(1,'#323232');
  x.strokeStyle=steel;x.lineWidth=68;x.beginPath();x.moveTo(-155,-120);x.lineTo(-155,-330);x.bezierCurveTo(-155,-550,155,-550,155,-330);x.lineTo(155,-120);x.stroke();
  x.fillStyle=steel;x.beginPath();x.roundRect(-240,-120,480,430,42);x.fill();
  const bevel=x.createLinearGradient(0,-120,0,310);bevel.addColorStop(0,'#ffffff99');bevel.addColorStop(.15,'#ffffff00');bevel.addColorStop(.85,'#11111100');bevel.addColorStop(1,'#11111199');x.fillStyle=bevel;x.fill();
  x.strokeStyle='#555';x.lineWidth=3;x.stroke();
  x.fillStyle='#242424';x.beginPath();x.arc(0,50,40,0,Math.PI*2);x.fill();x.beginPath();x.moveTo(-16,75);x.lineTo(-29,144);x.lineTo(29,144);x.lineTo(16,75);x.closePath();x.fill();x.restore();
  useImage(c,'금속 자물쇠 · 자체 제작 예제');c.width=c.height=1;
 }
 $('drExample').addEventListener('click',example);
 function route(){
  active=location.hash.split('?')[0]==='#/dot-retro';root.hidden=!active;document.body.classList.toggle('dr-open',active);
  const path=location.hash.split('?')[0];
  for(const a of document.querySelectorAll('header .main a')){const on=a.hash==='#/'?!['#/studio','#/dot-retro'].includes(path):a.hash===path;a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  if(active){document.title='도트레트로 — 사진을 점으로 바꾸는 인쇄 화방 | LETSUM';clearTimeout(window.tbBootTimer);document.documentElement.removeAttribute('data-tb-boot');if(!hasSource)example();else if(dirty)schedule();}
  else{stop();imageRevision++;loading=false;controls();}
 }
 addEventListener('hashchange',route);addEventListener('pagehide',()=>{stop();imageRevision++;});
 route();
})();
