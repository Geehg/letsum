/* Local image -> typed artwork; mounted outside the reading engine. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),root=$('tsStudio');if(!root)return;
 const core=window.TypewriterArt,canvas=$('tsCanvas'),ctx=canvas.getContext('2d'),area=$('tsMachineArea');
 let machine=null,machinePromise=null,modelToken=0;
 const models={hermes3000:'Hermes 3000',lettera32:'Olivetti Lettera 32',olympiasm3:'Olympia SM3'};
 let model='',source=null,sourceURL='',job=null,plan=null,cursor=0,frame=0,due=0,layer=0,typed=0,phase='strike',feedRow=0,playing=false,busy=false,active=false,imageToken=0,exportToken=0,sharedFile=null,dirty=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),exportButtons=['tsPNG','tsPDF','tsPrint','tsShare'];
 let sampleCache=null,fontPromise=null,generationId=0;
 let maskWorker=null,maskBusy=false,maskTicket=0,maskTimer=0,maskRefined=false;
 let finishing=false,exportCache=null,zoomToken=0;
 function ensureFont(){
  return fontPromise ||= (async()=>{
   const face=new FontFace('LS Studio Courier Prime','url(https://fonts.gstatic.com/s/courierprime/v11/u-450q2lgwslOqpF_6gQ8kELawFpWs39pvk.woff2)',{weight:'400',style:'normal'});
   await face.load();document.fonts.add(face);
   sampleCache=core.atlas((w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}));
  })().catch(e=>{fontPromise=null;throw e;});
 }
 const status=text=>{$('tsStatus').textContent=text;};
 function controls(){
  const locked=busy||maskBusy||finishing;
  $('tsGenerate').disabled=!source||locked||!sampleCache||!machine||$('tsMachine3D').dataset.ready!=='true';
  for(const id of ['tsFit','tsSubjectZoom','tsFocusX','tsFocusY','tsFrameReset','tsDetail','tsContrast','tsInkTone','tsInk','tsEdge','tsOverstrike','tsLanguage','tsCustomText','tsCurve','tsPortrait','tsMaskBrush','tsMaskSize','tsMaskReset','tsMaskAll'])$(id).disabled=locked;
  $('tsMaskAuto').disabled=!source||locked||!$('tsPortrait').checked;
  $('tsMaskCancel').hidden=!maskBusy;
  $('tsPause').disabled=locked||!plan||cursor>=plan.choices.length||$('tsMachine3D').dataset.ready!=='true';
  $('tsPause').textContent=playing?'일시정지':'계속 그리기';
  $('tsFinish').disabled=locked||!plan||cursor>=plan.choices.length;
  $('tsReplay').disabled=!plan||locked;
  $('tsZoomOpen').disabled=!plan||locked;
  for(const id of exportButtons)$(id).disabled=!plan||playing||cursor<plan.choices.length||locked;
 }
 function pause(){playing=false;cancelAnimationFrame(frame);area.classList.remove('is-playing');controls();}
 function clearExport(){exportToken++;exportCache=null;sharedFile=null;$('tsPrintArea').replaceChildren();$('tsExportStatus').textContent='';}
 function stopJob(){job?.terminate();job=null;busy=false;}
 function reset(){generationId++;finishing=false;pause();stopJob();plan=null;cursor=0;resetMotion();clearExport();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);area.style.setProperty('--feed',1);area.style.setProperty('--carriage','0px');area.classList.add('is-empty');area.classList.remove('is-complete');$('tsProgress').value=0;$('tsCount').textContent='A4 · 세로';$('tsPaperHint').hidden=false;controls();}
 function route(){
  active=location.hash.split('?')[0]==='#/studio';root.hidden=!active;document.body.classList.toggle('ts-open',active);
  document.querySelectorAll('header .main a').forEach(a=>{if(a.dataset.studioNav)a.classList.toggle('on',active);else if(a.textContent.trim()==='서가')a.classList.toggle('on',!active);});
  if(active){document.title='화방 — 타자기로 그리는 그림 | LETSUM';document.documentElement.removeAttribute('data-tb-boot');clearTimeout(window.tbBootTimer);}
  else{pause();cancelMask();controls();if(busy){stopJob();status('분석을 중단했어요. 돌아와 다시 그릴 수 있습니다.');controls();}}
 }
 addEventListener('hashchange',route);route();
 async function choose(value){
  const ticket=++modelToken;$('tsMachine3D').dataset.ready='loading';
  model=value;$('tsModelName').textContent=models[value];$('tsMachine').src=`/img/typewriters/${value}-preview.png?v=3`;$('tsMachine').alt=models[value]+' 타자기';
  $('tsChooser').hidden=true;$('tsWorkspace').hidden=false;area.classList.add('is-empty');if(plan)area.classList.remove('is-empty');$('tsFile').focus({preventScroll:true});
  controls();status('움직이는 타자기를 불러오고 있어요…');
  try{await ensureFont();machinePromise ||= import('/js/typing-studio-machine.js?v=4').then(()=>globalThis.LSCreateStudioMachine($('tsMachine3D'),canvas));machine=await machinePromise;if(ticket!==modelToken)return;await machine.load(value);if(ticket!==modelToken)return;area.classList.add('has-3d');if(plan){progress();if(cursor>=plan.choices.length)machine.finish();}status('타자기가 준비됐어요. 사진을 선택해 그려 보세요.');controls();}
  catch(e){machinePromise=null;status(sampleCache?'3D 타자기를 불러오지 못했습니다. 타자기 바꾸기에서 다시 선택해 주세요.':'타자기 글꼴을 불러오지 못했습니다. 연결을 확인하고 타자기를 다시 선택해 주세요.');controls();console.warn(e);}
 }
 root.querySelectorAll('[data-studio-model]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.studioModel)));
 $('tsChangeModel').addEventListener('click',()=>{pause();cancelMask();controls();if(busy){stopJob();status('분석을 중단했어요. 타자기를 고른 뒤 다시 시작해 주세요.');controls();}$('tsChooser').hidden=false;$('tsWorkspace').hidden=true;root.querySelector(`[data-studio-model="${model}"]`).focus();});
 async function loadFile(file){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){status('JPG, PNG, WebP 이미지를 선택해 주세요.');return;}
  if(file.size>20*1024*1024){status('20MB 이하 이미지를 선택해 주세요.');return;}
  cancelMask();controls();const token=++imageToken,url=URL.createObjectURL(file);status('사진을 불러오고 있어요.');
  try{
   const img=new Image();img.src=url;await img.decode();
   if(token!==imageToken){URL.revokeObjectURL(url);return;}
   if(img.naturalWidth*img.naturalHeight>60e6)throw Error('large');
   reset();if(sourceURL)URL.revokeObjectURL(sourceURL);sourceURL=url;source=img;lastImageBounds=null;resetMask();previewMask();
   $('tsSource').src=url;$('tsSourceBox').hidden=false;$('tsFileName').textContent=`${file.name} · ${img.naturalWidth} × ${img.naturalHeight}`;
   $('tsName').value=file.name.replace(/\.[^.]+$/,'').slice(0,60)+' · 타자기 드로잉';
   $('tsPaperHint').querySelector('p').textContent='설정을 고르고 타이핑을 시작해 주세요.';status('사진이 준비됐어요. 타이핑으로 그려 보세요.');controls();if($('tsPortrait').checked)refineMask();
  }catch(e){URL.revokeObjectURL(url);if(token===imageToken)status(e.message==='large'?'이미지가 너무 큽니다. 6천만 화소 이하로 줄여 주세요.':'이 이미지를 열 수 없습니다. 다른 파일을 선택해 주세요.');}
 }
 $('tsFile').addEventListener('change',e=>{loadFile(e.target.files[0]);e.target.value='';});
 const drop=$('tsDrop');for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('is-over');});
 drop.addEventListener('dragleave',()=>drop.classList.remove('is-over'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-over');loadFile(e.dataTransfer.files[0]);});
 for(const [id,out] of [['tsContrast','tsContrastValue'],['tsInk','tsInkValue'],['tsEdge','tsEdgeValue']])$(id).addEventListener('input',()=>{$(out).textContent=$(id).value+'%';markDirty();});
 for(const id of ['tsDetail','tsOverstrike'])$(id).addEventListener('change',markDirty);
 function markDirty(){if(source)previewMask();if(plan){dirty=true;status('설정이 바뀌었어요. 다시 그리기를 누르면 적용됩니다.');}}
 let cjkPromise=null;
 async function ensureLanguage(language,text){
  if(language==='en'&&!/[^\x00-\x7f]/.test(text))return;
  if(!cjkPromise)cjkPromise=new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400&family=Noto+Serif+JP:wght@400&display=block';link.onload=resolve;link.onerror=()=>{link.remove();cjkPromise=null;reject(Error('font'));};document.head.appendChild(link);});
  await cjkPromise;const sample=text|| (language==='ja'?'あいうえおかき木水山川日月':'가나다라마바사아자차카타파하한글봄빛산물꿈별');
  await document.fonts.load('24px "Noto Serif KR"',sample);await document.fonts.load('24px "Noto Serif JP"',sample);
 }
 let lastImageBounds=null,maskAnchorBounds=null;
 const maskAnchor=document.createElement('canvas'),guidanceAnchor=document.createElement('canvas'),guidanceCanvas=document.createElement('canvas'),maskCanvas=document.createElement('canvas');
 for(const c of [maskAnchor,guidanceAnchor,guidanceCanvas,maskCanvas]){c.width=240;c.height=351;}
 const maskCtx=maskCanvas.getContext('2d',{willReadFrequently:true}),guidanceCtx=guidanceCanvas.getContext('2d',{willReadFrequently:true}),maskPreview=$('tsMaskPreview');
 function rememberMask(){if(!source)return;
  for(const [anchor,c] of [[maskAnchor,maskCanvas],[guidanceAnchor,guidanceCanvas]]){const x=anchor.getContext('2d');x.clearRect(0,0,240,351);x.drawImage(c,0,0);}
  maskAnchorBounds=core.imageBounds(240,351,source.naturalWidth,source.naturalHeight,$('tsFit').value,Number($('tsSubjectZoom').value),Number($('tsFocusX').value)/100,Number($('tsFocusY').value)/100);
 }
 function clearGuidance(){guidanceCtx.fillStyle='#000';guidanceCtx.fillRect(0,0,240,351);}
 function resetMask(){maskRefined=false;clearGuidance();maskCtx.fillStyle='#000';maskCtx.fillRect(0,0,240,351);maskCtx.fillStyle='#fff';maskCtx.beginPath();maskCtx.ellipse(120,190,87,166,0,0,Math.PI*2);maskCtx.fill();rememberMask();$('tsMaskStatus').textContent='초기 범위입니다. 사진에서 범위를 찾거나 브러시로 조정하세요.';}
 function channel(x){const rgba=x.getImageData(0,0,240,351).data,data=new Uint8Array(240*351);for(let i=0;i<data.length;i++)data[i]=rgba[i*4];return data;}
 function encodeGuidance(rgba){
  const result=new Uint8Array(rgba.length/4);
  // Separate channels keep an antialiased foreground edge from becoming background.
  for(let i=0;i<result.length;i++){const r=rgba[i*4],b=rgba[i*4+2];result[i]=r>=250&&b<=5?255:b>=250&&r<=5?128:0;}
  return result;
 }
 function maskData(){return {data:channel(maskCtx),width:240,height:351,refined:maskRefined};}
 function cancelMask(){maskTicket++;clearTimeout(maskTimer);maskWorker?.terminate();maskWorker=null;maskBusy=false;}
 function refineMask(){
  if(!source||busy||maskBusy||finishing||!$('tsPortrait').checked)return;
  pause();clearTimeout(maskTimer);maskBusy=true;const id=++maskTicket;
  $('tsMaskStatus').textContent='사진에서 인물과 배경의 범위를 찾고 있어요…';controls();
  const fail=reason=>{if(id!==maskTicket)return;cancelMask();$('tsMaskStatus').textContent=reason==='regions'?'인물과 배경을 각각 조금씩 칠한 뒤 다시 찾아 주세요.':'범위를 자동으로 찾지 못했어요. 현재 범위를 브러시로 다듬거나 다시 시도해 주세요.';controls();};
  try{
   maskWorker ||= new Worker('/js/typing-studio-segmentation-worker.js?v=1');
   maskWorker.onmessage=({data})=>{
    if(data.id!==maskTicket)return;
    if(data.type==='loading'){$('tsMaskStatus').textContent='범위 분석을 준비하고 있어요. 처음에는 잠시 걸릴 수 있습니다.';return;}
    if(data.type==='processing'){$('tsMaskStatus').textContent='사진의 색 차이를 비교해 범위를 다듬고 있어요…';return;}
    if(data.type==='error'){fail(data.reason);return;}
    if(data.type!=='complete')return;
    clearTimeout(maskTimer);maskBusy=false;maskRefined=true;const im=maskCtx.createImageData(240,351);
    for(let i=0;i<data.mask.length;i++){im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=data.mask[i];im.data[i*4+3]=255;}maskCtx.putImageData(im,0,0);
    rememberMask();markDirty();$('tsMaskStatus').textContent='사진에서 범위를 찾았어요. 빠지거나 넘친 부분을 칠하고 다시 찾을 수 있습니다.';controls();
    // Release the 128 MiB WASM heap after a short correction window.
    maskTimer=setTimeout(()=>{maskWorker?.terminate();maskWorker=null;},30000);
   };
   maskWorker.onerror=()=>fail();maskTimer=setTimeout(()=>fail(),30000);
   const {rgba,bounds}=drawInput(40,39,true),mask=channel(maskCtx),guidance=encodeGuidance(guidanceCtx.getImageData(0,0,240,351).data);
   // Antialiased stroke edges remain probable rather than becoming hard labels.
   for(let i=0;i<guidance.length;i++)if(guidance[i]!==255&&guidance[i]!==128)guidance[i]=0;
   maskWorker.postMessage({id,rgba,width:240,height:351,bounds,mask,guidance},[rgba.buffer,mask.buffer,guidance.buffer]);
  }catch(error){fail();}
 }
 function previewMask(){if(!source)return;const {rgba,bounds}=drawInput(40,39,true);lastImageBounds=bounds;const gray=core.prepare(rgba,240,351,Number($('tsContrast').value)/100,Number($('tsEdge').value)/100,bounds),x=maskPreview.getContext('2d'),im=x.createImageData(240,351),mask=maskData().data;
  for(let i=0;i<gray.length;i++){const v=Math.round(gray[i]*255),weight=$('tsPortrait').checked?mask[i]/255:0;im.data[i*4]=v*(1-weight*.28);im.data[i*4+1]=v*(1-weight*.18)+35*weight;im.data[i*4+2]=v*(1-weight*.28);im.data[i*4+3]=255;}x.putImageData(im,0,0);
 }
 let painting=false,lastBrush=null;
 function brush(e){if(!source||busy||maskBusy||finishing||!$('tsPortrait').checked)return;const r=maskPreview.getBoundingClientRect(),p=[(e.clientX-r.left)/r.width*240,(e.clientY-r.top)/r.height*351],add=$('tsMaskBrush').value==='add';
  for(const [x,color] of [[maskCtx,add?'#fff':'#000'],[guidanceCtx,add?'#ff0000':'#0000ff']]){x.strokeStyle=x.fillStyle=color;x.lineWidth=Number($('tsMaskSize').value);x.lineCap='round';x.beginPath();x.moveTo(...(lastBrush||p));x.lineTo(...p);x.stroke();x.beginPath();x.arc(...p,x.lineWidth/2,0,Math.PI*2);x.fill();}
  lastBrush=p;rememberMask();markDirty();$('tsMaskStatus').textContent='직접 칠한 범위는 다시 찾을 때도 유지됩니다.';
 }
 maskPreview.addEventListener('pointerdown',e=>{if(busy||maskBusy)return;painting=true;lastBrush=null;maskPreview.setPointerCapture(e.pointerId);brush(e);});maskPreview.addEventListener('pointermove',e=>{if(painting)brush(e);});for(const ev of ['pointerup','pointercancel'])maskPreview.addEventListener(ev,()=>{painting=false;lastBrush=null;});
 $('tsMaskAuto').addEventListener('click',refineMask);
 $('tsMaskCancel').addEventListener('click',()=>{cancelMask();$('tsMaskStatus').textContent='범위 찾기를 중단했어요. 현재 범위로 계속 그릴 수 있습니다.';controls();});
 $('tsMaskReset').addEventListener('click',()=>{resetMask();markDirty();});$('tsMaskAll').addEventListener('click',()=>{maskRefined=false;clearGuidance();maskCtx.fillStyle='#fff';maskCtx.fillRect(0,0,240,351);rememberMask();markDirty();$('tsMaskStatus').textContent='전체 이미지의 결을 따라 그립니다.';});
 // Reframe both the soft region and explicit strokes in source coordinates.
 function reframe(){
  $('tsFramingTools').hidden=Number($('tsSubjectZoom').value)===1&&$('tsFit').value==='contain';
  if(source&&lastImageBounds){
   const old=maskAnchorBounds||lastImageBounds,next=core.imageBounds(240,351,source.naturalWidth,source.naturalHeight,$('tsFit').value,Number($('tsSubjectZoom').value),Number($('tsFocusX').value)/100,Number($('tsFocusY').value)/100),sx=next.width/old.width,sy=next.height/old.height;
   for(const [x,anchor] of [[maskCtx,maskAnchor],[guidanceCtx,guidanceAnchor]]){x.fillStyle='#000';x.fillRect(0,0,240,351);x.imageSmoothingEnabled=x!==guidanceCtx;x.drawImage(anchor,next.x-old.x*sx,next.y-old.y*sy,240*sx,351*sy);}
  }
  markDirty();
 }
 for(const id of ['tsFit','tsSubjectZoom'])$(id).addEventListener('change',reframe);
 for(const id of ['tsFocusX','tsFocusY'])$(id).addEventListener('input',reframe);
 $('tsFrameReset').addEventListener('click',()=>{$('tsSubjectZoom').value='1';$('tsFocusX').value=$('tsFocusY').value='50';reframe();});
 $('tsPortrait').addEventListener('change',()=>{$('tsMaskTools').hidden=!$('tsPortrait').checked;markDirty();controls();if($('tsPortrait').checked&&!maskRefined)refineMask();});
 for(const id of ['tsLanguage','tsCurve','tsInkTone'])$(id).addEventListener('change',markDirty);
 $('tsCustomText').addEventListener('input',markDirty);
 resetMask();
 // A locally drawn still-life is provided so the studio works without an upload.
 $('tsExample').addEventListener('click',()=>{
  const c=document.createElement('canvas');c.width=720;c.height=1000;const x=c.getContext('2d');
  x.fillStyle='#f2eee5';x.fillRect(0,0,720,1000);
  const g=x.createLinearGradient(0,0,720,1000);g.addColorStop(0,'#fff');g.addColorStop(1,'#91918a');x.fillStyle=g;x.fillRect(0,0,720,1000);
  x.fillStyle='#c6c0b0';x.fillRect(0,760,720,240);x.fillStyle='#63645c';x.beginPath();x.ellipse(395,795,230,35,-.06,0,Math.PI*2);x.fill();
  const vase=x.createLinearGradient(220,0,475,0);vase.addColorStop(0,'#454c45');vase.addColorStop(.25,'#d1d1bf');vase.addColorStop(.55,'#f5f1db');vase.addColorStop(1,'#65695c');x.fillStyle=vase;x.beginPath();x.moveTo(295,530);x.bezierCurveTo(300,630,220,635,245,770);x.bezierCurveTo(270,825,440,825,465,770);x.bezierCurveTo(490,635,410,630,415,530);x.closePath();x.fill();
  x.fillStyle='#434d41';x.beginPath();x.ellipse(355,532,60,12,0,0,Math.PI*2);x.fill();
  for(let i=0;i<7;i++){const endX=115+i*77,endY=160+Math.sin(i*2)*65;x.strokeStyle='#46513e';x.lineWidth=5;x.beginPath();x.moveTo(355,535);x.quadraticCurveTo(300+i*15,330,endX,endY);x.stroke();
   for(let j=0;j<6;j++){const angle=j*Math.PI/3;x.fillStyle=j%2?'#d0d1bf':'#f4f1df';x.beginPath();x.ellipse(endX+Math.cos(angle)*28,endY+Math.sin(angle)*28,24,40,angle+Math.PI/2,0,Math.PI*2);x.fill();x.strokeStyle='#858b76';x.lineWidth=1;x.stroke();}
   x.fillStyle='#3e4535';x.beginPath();x.arc(endX,endY,17,0,Math.PI*2);x.fill();
  }
  c.toBlob(b=>{if(b)loadFile(new File([b],'창가의 꽃병.png',{type:'image/png'}));});
 });
 function drawInput(cols,rows,withBounds=false){
  const c=document.createElement('canvas');c.width=cols*core.SW;c.height=rows*core.SH;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
  const bounds=core.imageBounds(c.width,c.height,source.naturalWidth,source.naturalHeight,$('tsFit').value,Number($('tsSubjectZoom').value),Number($('tsFocusX').value)/100,Number($('tsFocusY').value)/100);
  x.drawImage(source,bounds.x,bounds.y,bounds.width,bounds.height);const rgba=x.getImageData(0,0,c.width,c.height).data;return withBounds?{rgba,bounds}:rgba;
 }
 $('tsGenerate').addEventListener('click',async()=>{
  if(!source||busy||maskBusy||finishing)return;reset();const generation=generationId;busy=true;dirty=false;status('빛과 윤곽에 맞는 문자를 고르고 있어요…');$('tsPaperHint').hidden=true;area.classList.remove('is-empty');area.style.setProperty('--feed',0);controls();
  const cols=Number($('tsDetail').value),rows=Math.round(cols*(277/190)/1.5),{rgba,bounds}=drawInput(cols,rows,true);
  try{
   const language=$('tsLanguage').value,text=$('tsCustomText').value,inkColor=$('tsInkTone').value;
   await ensureLanguage(language,text);if(!busy||!active||generation!==generationId)return;
   const kit=core.makePatterns(language,text),samples=[];
   // Yield between font-atlas batches, including long multilingual source texts.
   for(let i=0;i<kit.patterns.length;i+=64){
    samples.push(...core.atlas((w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}),kit.patterns.slice(i,i+64)));
    await new Promise(resolve=>setTimeout(resolve,0));if(!busy||generation!==generationId)return;
   }
   $('tsFontLabel').textContent={en:'Courier Prime',ko:'본명조',ja:'Noto Serif JP'}[language];
   job=new Worker('/js/typing-studio-worker.js?v=10');
   job.onmessage=({data})=>{
    if(data.type==='progress'){$('tsProgress').value=data.value;status(`문자 분석 중 · ${Math.round(data.value*100)}%`);return;}
    if(data.type==='error'){stopJob();status(data.message);controls();return;}
    if(data.type==='complete'){stopJob();plan=data;$('tsInkLabel').textContent=data.inkColor==='#3b2b24'?'진갈색 리본':'차콜 블랙 리본';cursor=0;$('tsExportStatus').textContent=data.textLength?`본문 ${data.textLength.toLocaleString()}자 · 사용 ${data.textCharactersUsed.toLocaleString()}자 (부족하면 반복)`:'선택한 언어의 문자로 그립니다.';$('tsProgress').value=0;start();}
   };
   job.onerror=()=>{stopJob();status('분석 도구를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');controls();};
   job.postMessage({rgba,bounds,cols,rows,inkColor,contrast:Number($('tsContrast').value)/100,ink:Number($('tsInk').value)/100,edge:Number($('tsEdge').value)/100,overstrike:$('tsOverstrike').checked,samples,patterns:kit.patterns,singles:kit.singles,language,text,curve:$('tsCurve').checked,portrait:$('tsPortrait').checked,mask:maskData()},[rgba.buffer]);
  }catch(e){stopJob();status('이 브라우저에서 분석을 시작하지 못했습니다. 최신 브라우저로 다시 시도해 주세요.');controls();}
 });
 const patternAt=i=>plan.marks?plan.marks[i]:core.patterns[plan.choices[i]];
 function renderCells(target,start,end,drawing=plan){
  const x=target.getContext('2d'),margin=target.width*10/210,cw=(target.width-margin*2)/drawing.cols,ch=(target.height-target.height*20/297)/drawing.rows;
  x.fillStyle='#211f1c';for(let i=start;i<end;i++){
   const p=drawing.choices[i];if(!p)continue;
   const col=i%drawing.cols,row=Math.floor(i/drawing.cols),variation=((i*73%101)/100)-.5;
   core.paint(x,(drawing.marks?drawing.marks[i]:core.patterns[drawing.choices[i]]),margin+col*cw,target.height*10/297+row*ch,cw,ch,variation,drawing.inkColor);
  }
 }
 // Yield between bounded batches; large overstrike drawings must not freeze controls.
 async function renderInChunks(target,end,drawing,valid=()=>true,notify=()=>{}){
  for(let start=0;start<end;){
   await new Promise(resolve=>setTimeout(resolve,0));if(!valid())return false;
   const deadline=performance.now()+6;let next=start;
   do{const stop=Math.min(end,next+16);renderCells(target,next,stop,drawing);next=stop;}while(next<end&&next-start<128&&performance.now()<deadline);
   start=next;notify(start/end);
  }
  return valid();
 }
 function resetMotion(){machine?.reset();layer=0;typed=0;phase='strike';feedRow=0;due=0;area.classList.remove('is-returning');}
 function progress(){
  const p=cursor/plan.choices.length;$('tsProgress').value=p;
  $('tsCount').textContent=`${Math.round(p*100)}% · ${typed.toLocaleString()} / ${plan.strikes.toLocaleString()}타`;
  // The platen turns only on a line feed, never while a line is being typed.
  area.style.setProperty('--feed',Math.min(1,.20+feedRow/plan.rows*.80));
  const col=phase==='line-end'?plan.cols-1:phase==='return'?0:cursor%plan.cols;
  machine?.position(col/Math.max(1,plan.cols-1),feedRow,plan.rows);
  area.style.setProperty('--carriage',`${(0.5-col/Math.max(1,plan.cols-1))*90}%`);
 }
 function strike(){
  const pattern=patternAt(cursor),mark=pattern[layer];
  const margin=canvas.width*10/210,cw=(canvas.width-margin*2)/plan.cols,ch=canvas.height*(277/297)/plan.rows;
  ctx.fillStyle='#211f1c';
  core.paint(ctx,[mark],margin+(cursor%plan.cols)*cw,canvas.height*10/297+Math.floor(cursor/plan.cols)*ch,cw,ch,((cursor*73%101)/100)-.5,plan.inkColor);
  typed++;layer++;
  machine?.hit(mark.g);
  if(layer===pattern.length){layer=0;cursor++;}
 }
 async function finishDrawing(){
  if(!plan||busy||maskBusy||finishing)return;
  pause();finishing=true;controls();const drawing=plan,generation=generationId;
  // Rebuild including a partially overstruck cell, identical to the saved plan.
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  try{
   const done=await renderInChunks(canvas,drawing.choices.length,drawing,()=>generation===generationId&&plan===drawing,p=>status(`작품을 완성하고 있어요 · ${Math.round(p*100)}%`));
   if(done){finishing=false;complete();}
  }finally{if(generation===generationId){finishing=false;controls();}}
 }
 function complete(){pause();cursor=plan.choices.length;typed=plan.strikes;feedRow=plan.rows;phase='strike';area.classList.remove('is-returning');progress();area.classList.add('is-complete');machine?.finish();status(dirty?'완성됐어요. 바꾼 설정은 다시 그리기를 누르면 적용됩니다.':'완성됐어요. 한 장의 작품으로 저장해 보세요.');controls();prepareShare();}
 function tick(now){
  if(!playing||!active)return;
  if(now>=due){
   if(phase==='line-end'){
    phase='return';machine?.returnCarriage();area.classList.add('is-returning');progress();status('캐리지 복귀…');due=now+360;
   }else if(phase==='return'){
    feedRow++;phase='feed';progress();status('종이를 한 줄 올리고 있어요…');due=now+200;
   }else if(phase==='feed'){
    phase='strike';area.classList.remove('is-returning');status('한 글자씩, 겹쳐 치며 그리고 있어요…');due=now+100;
   }else{
    // At most one strike per animation frame: no catch-up batches after a slow frame.
    if(plan.choices[cursor])strike();else cursor++;
    if(cursor>=plan.choices.length){complete();return;}
    if(layer===0&&cursor%plan.cols===0){phase='line-end';due=now+180;}
    else due=now+1000/Number($('tsSpeed').value)*(layer?.85:1+(cursor%7)*.045);
    progress();
   }
  }
  frame=requestAnimationFrame(tick);
 }
 function start(){if(finishing||busy||maskBusy||!plan||$('tsMachine3D').dataset.ready!=='true')return;area.classList.remove('is-complete');if(reduced.matches){finishDrawing();return;}playing=true;due=performance.now()+100;area.classList.add('is-playing');progress();status('한 글자씩, 겹쳐 치며 그리고 있어요…');controls();frame=requestAnimationFrame(tick);}
 $('tsPause').addEventListener('click',()=>{if(playing){pause();status('잠시 멈췄어요. 이어서 그릴 수 있습니다.');}else start();});
 $('tsFinish').addEventListener('click',()=>{if(plan)finishDrawing();});
 $('tsReplay').addEventListener('click',()=>{if(!plan)return;pause();clearExport();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);cursor=0;resetMotion();start();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){pause();status('다른 화면으로 이동해 잠시 멈췄어요. 계속 그리기를 눌러 주세요.');}});
 // Redraw the glyphs at the requested display resolution; never stretch the preview bitmap.
 const zoomDialog=$('tsZoomDialog'),zoomCanvas=$('tsZoomCanvas'),zoomScroll=$('tsZoomScroll');
 let resumeAfterZoom=false;
 async function drawZoom(){
  if(!plan||!zoomDialog.open)return;
  const token=++zoomToken,drawing=plan,end=cursor,partial=layer;
  const zoom=Number($('tsZoomLevel').value),base=Math.min(640,Math.max(200,zoomScroll.clientWidth-40),Math.max(200,(zoomScroll.clientHeight-40)*210/297));
  const cssWidth=base*zoom,pixelWidth=Math.ceil(cssWidth*Math.min(devicePixelRatio||1,2));
  zoomCanvas.width=pixelWidth;zoomCanvas.height=Math.round(pixelWidth*297/210);
  zoomCanvas.style.width=cssWidth+'px';zoomCanvas.style.height=(cssWidth*297/210)+'px';
  const z=zoomCanvas.getContext('2d');z.fillStyle='#fff';z.fillRect(0,0,zoomCanvas.width,zoomCanvas.height);
  const done=await renderInChunks(zoomCanvas,end,drawing,()=>token===zoomToken&&zoomDialog.open&&plan===drawing);
  if(!done)return;
  if(partial&&end<drawing.choices.length){
   const margin=pixelWidth*10/210,cw=(pixelWidth-margin*2)/plan.cols,ch=zoomCanvas.height*(277/297)/plan.rows;
   core.paint(z,(drawing.marks?drawing.marks[end]:core.patterns[drawing.choices[end]]).slice(0,partial),margin+(end%drawing.cols)*cw,zoomCanvas.height*10/297+Math.floor(end/drawing.cols)*ch,cw,ch,((end*73%101)/100)-.5,drawing.inkColor);
  }
 }
 function openZoom(){if(!plan||busy||maskBusy||finishing)return;resumeAfterZoom=playing;pause();zoomDialog.showModal();drawZoom();}
 $('tsZoomOpen').addEventListener('click',openZoom);
 $('tsMachine3D').addEventListener('dblclick',openZoom);
 $('tsZoomClose').addEventListener('click',()=>zoomDialog.close());
 $('tsZoomLevel').addEventListener('change',drawZoom);
 zoomDialog.addEventListener('close',()=>{zoomToken++;zoomCanvas.width=1;zoomCanvas.height=1;if(resumeAfterZoom&&active)start();resumeAfterZoom=false;});
 addEventListener('resize',drawZoom);
 const filename=()=>($('tsName').value.trim()||'타자기 드로잉').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_');
 function exportCanvas(){
  if(exportCache)return exportCache;
  const drawing=plan,token=exportToken;
  exportCache=(async()=>{const c=document.createElement('canvas');c.width=2480;c.height=3508;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
   if(!await renderInChunks(c,drawing.choices.length,drawing,()=>token===exportToken&&plan===drawing))throw new DOMException('Drawing replaced','AbortError');return c;
  })().catch(error=>{if(token===exportToken)exportCache=null;throw error;});return exportCache;
 }
 const toBlob=(c,type='image/png')=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('이미지 저장 실패')),type,.97));
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 async function prepareShare(){const token=exportToken;try{const blob=await toBlob(await exportCanvas());if(token===exportToken)sharedFile=new File([blob],filename()+'.png',{type:'image/png'});}catch(e){/* Regular download can be retried independently. */}}
 async function output(action){
  if(!plan||playing||cursor<plan.choices.length)return;
  try{$('tsExportStatus').textContent='저장할 작품을 준비하고 있어요…';await action();}catch(e){if(e.name==='AbortError')return;$('tsExportStatus').textContent='저장하지 못했습니다. 다시 시도해 주세요.';console.warn('Studio export failed',e);}
 }
 $('tsPNG').addEventListener('click',()=>output(async()=>{download(await toBlob(await exportCanvas()),filename()+'.png');$('tsExportStatus').textContent='PNG 다운로드를 시작했습니다.';}));
 // Minimal single-page PDF: lossless layout, high-resolution JPEG artwork on A4.
 async function pdf(c){
  const jpg=new Uint8Array(await (await toBlob(c,'image/jpeg')).arrayBuffer()),enc=new TextEncoder(),parts=[],offsets=[0];let length=0;
  const add=b=>{if(typeof b==='string')b=enc.encode(b);parts.push(b);length+=b.length;};
  add('%PDF-1.4\n');
  const obj=(n,s)=>{offsets[n]=length;add(`${n} 0 obj\n${s}\nendobj\n`);};
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.2756 841.8898] /Resources << /XObject << /Art 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4]=length;add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);add(jpg);add('\nendstream\nendobj\n');
  const stream='q\n595.2756 0 0 841.8898 0 0 cm\n/Art Do\nQ\n';obj(5,`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`);
  const xref=length;add('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);return new Blob(parts,{type:'application/pdf'});
 }
 $('tsPDF').addEventListener('click',()=>output(async()=>{download(await pdf(await exportCanvas()),filename()+'.pdf');$('tsExportStatus').textContent='A4 PDF 다운로드를 시작했습니다.';}));
 $('tsPrint').addEventListener('click',()=>output(async()=>{
  const image=new Image();image.src=(await exportCanvas()).toDataURL('image/png');await image.decode();$('tsPrintArea').replaceChildren(image);document.body.classList.add('ts-printing');window.print();$('tsExportStatus').textContent='인쇄 창에서 A4 세로, 배율 100%를 선택해 주세요.';
 }));
 addEventListener('afterprint',()=>document.body.classList.remove('ts-printing'));
 $('tsShare').addEventListener('click',()=>{
  if(navigator.share&&navigator.canShare&&!sharedFile){$('tsExportStatus').textContent='공유할 이미지를 준비하고 있어요. 잠시 후 다시 눌러 주세요.';return;}
  if(sharedFile&&navigator.canShare?.({files:[sharedFile]})){
   const file=new File([sharedFile],filename()+'.png',{type:'image/png'});
   navigator.share({files:[file],title:$('tsName').value}).then(()=>{$('tsExportStatus').textContent='공유했습니다.';}).catch(e=>{if(e.name!=='AbortError')$('tsExportStatus').textContent='공유하지 못했습니다. PNG로 저장해 공유해 주세요.';});
  }else output(async()=>{download(sharedFile||await toBlob(await exportCanvas()),filename()+'.png');$('tsExportStatus').textContent='이 브라우저는 파일 공유를 지원하지 않아 PNG로 저장했습니다. 저장한 작품을 공유해 주세요.';});
 });
 $('tsMachine3D').addEventListener('machineerror',()=>{pause();status('3D 표시가 중단되었습니다. 타자기 바꾸기에서 다시 선택해 주세요.');machine?.dispose();machine=null;machinePromise=null;controls();});
 addEventListener('pagehide',()=>{cancelMask();machine?.dispose();});
 reset();
})();
