/* Local image -> typed artwork; mounted outside the reading engine. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),root=$('tsStudio');if(!root)return;
 const core=window.TypewriterArt,canvas=$('tsCanvas'),ctx=canvas.getContext('2d'),area=$('tsMachineArea');
 let machine=null,machinePromise=null,modelToken=0;
 const models={hermes3000:'Hermes 3000',lettera32:'Olivetti Lettera 32',olympiasm3:'Olympia SM3'};
 let model='',source=null,sourceURL='',job=null,plan=null,cursor=0,frame=0,due=0,layer=0,typed=0,phase='strike',feedRow=0,playing=false,busy=false,active=false,imageToken=0,exportToken=0,sharedFile=null,dirty=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),exportButtons=['tsPNG','tsPDF','tsPrint','tsShare'];
 const sampleCache=core.atlas((w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}));
 const status=text=>{$('tsStatus').textContent=text;};
 function controls(){
  $('tsGenerate').disabled=!source||busy||!machine||$('tsMachine3D').dataset.ready!=='true';
  for(const id of ['tsFit','tsDetail','tsContrast','tsInk','tsEdge','tsOverstrike'])$(id).disabled=busy;
  $('tsPause').disabled=!plan||cursor>=plan.choices.length||$('tsMachine3D').dataset.ready!=='true';
  $('tsPause').textContent=playing?'일시정지':'계속 그리기';
  $('tsFinish').disabled=!plan||cursor>=plan.choices.length;
  $('tsReplay').disabled=!plan||busy;
  for(const id of exportButtons)$(id).disabled=!plan||playing||cursor<plan.choices.length||busy;
 }
 function pause(){playing=false;cancelAnimationFrame(frame);area.classList.remove('is-playing');controls();}
 function clearExport(){exportToken++;sharedFile=null;$('tsPrintArea').replaceChildren();$('tsExportStatus').textContent='';}
 function stopJob(){job?.terminate();job=null;busy=false;}
 function reset(){pause();stopJob();plan=null;cursor=0;resetMotion();clearExport();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);area.style.setProperty('--feed',1);area.style.setProperty('--carriage','0px');area.classList.add('is-empty');area.classList.remove('is-complete');$('tsProgress').value=0;$('tsCount').textContent='A4 · 세로';$('tsPaperHint').hidden=false;controls();}
 function route(){
  active=location.hash.split('?')[0]==='#/studio';root.hidden=!active;document.body.classList.toggle('ts-open',active);
  document.querySelectorAll('header .main a').forEach(a=>{if(a.dataset.studioNav)a.classList.toggle('on',active);else if(a.textContent.trim()==='서가')a.classList.toggle('on',!active);});
  if(active){document.title='화방 — 타자기로 그리는 그림 | LETSUM';document.documentElement.removeAttribute('data-tb-boot');clearTimeout(window.tbBootTimer);}
  else{pause();if(busy){stopJob();status('분석을 중단했어요. 돌아와 다시 그릴 수 있습니다.');controls();}}
 }
 addEventListener('hashchange',route);route();
 async function choose(value){
  const ticket=++modelToken;$('tsMachine3D').dataset.ready='loading';
  model=value;$('tsModelName').textContent=models[value];$('tsMachine').src=`/img/typewriters/${value}-preview.png?v=3`;$('tsMachine').alt=models[value]+' 타자기';
  $('tsChooser').hidden=true;$('tsWorkspace').hidden=false;area.classList.add('is-empty');if(plan)area.classList.remove('is-empty');$('tsFile').focus({preventScroll:true});
  controls();status('움직이는 타자기를 불러오고 있어요…');
  try{machinePromise ||= import('/js/typing-studio-machine.js?v=3').then(()=>globalThis.LSCreateStudioMachine($('tsMachine3D'),canvas));machine=await machinePromise;if(ticket!==modelToken)return;await machine.load(value);if(ticket!==modelToken)return;area.classList.add('has-3d');if(plan){progress();if(cursor>=plan.choices.length)machine.finish();}status('타자기가 준비됐어요. 사진을 선택해 그려 보세요.');controls();}
  catch(e){machinePromise=null;status('3D 타자기를 불러오지 못했습니다. 타자기 바꾸기에서 다시 선택해 주세요.');controls();console.warn(e);}
 }
 root.querySelectorAll('[data-studio-model]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.studioModel)));
 $('tsChangeModel').addEventListener('click',()=>{pause();if(busy){stopJob();status('분석을 중단했어요. 타자기를 고른 뒤 다시 시작해 주세요.');controls();}$('tsChooser').hidden=false;$('tsWorkspace').hidden=true;root.querySelector(`[data-studio-model="${model}"]`).focus();});
 async function loadFile(file){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){status('JPG, PNG, WebP 이미지를 선택해 주세요.');return;}
  if(file.size>20*1024*1024){status('20MB 이하 이미지를 선택해 주세요.');return;}
  const token=++imageToken,url=URL.createObjectURL(file);status('사진을 불러오고 있어요.');
  try{
   const img=new Image();img.src=url;await img.decode();
   if(token!==imageToken){URL.revokeObjectURL(url);return;}
   if(img.naturalWidth*img.naturalHeight>60e6)throw Error('large');
   reset();if(sourceURL)URL.revokeObjectURL(sourceURL);sourceURL=url;source=img;
   $('tsSource').src=url;$('tsSourceBox').hidden=false;$('tsFileName').textContent=`${file.name} · ${img.naturalWidth} × ${img.naturalHeight}`;
   $('tsName').value=file.name.replace(/\.[^.]+$/,'').slice(0,60)+' · 타자기 드로잉';
   $('tsPaperHint').querySelector('p').textContent='설정을 고르고 타이핑을 시작해 주세요.';status('사진이 준비됐어요. 타이핑으로 그려 보세요.');controls();
  }catch(e){URL.revokeObjectURL(url);if(token===imageToken)status(e.message==='large'?'이미지가 너무 큽니다. 6천만 화소 이하로 줄여 주세요.':'이 이미지를 열 수 없습니다. 다른 파일을 선택해 주세요.');}
 }
 $('tsFile').addEventListener('change',e=>{loadFile(e.target.files[0]);e.target.value='';});
 const drop=$('tsDrop');for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('is-over');});
 drop.addEventListener('dragleave',()=>drop.classList.remove('is-over'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-over');loadFile(e.dataTransfer.files[0]);});
 for(const [id,out] of [['tsContrast','tsContrastValue'],['tsInk','tsInkValue'],['tsEdge','tsEdgeValue']])$(id).addEventListener('input',()=>{$(out).textContent=$(id).value+'%';markDirty();});
 for(const id of ['tsFit','tsDetail','tsOverstrike'])$(id).addEventListener('change',markDirty);
 function markDirty(){if(plan){dirty=true;status('설정이 바뀌었어요. 다시 그리기를 누르면 적용됩니다.');}}
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
 function drawInput(cols,rows){
  const c=document.createElement('canvas');c.width=cols*core.SW;c.height=rows*core.SH;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
  const scale=($('tsFit').value==='cover'?Math.max:Math.min)(c.width/source.naturalWidth,c.height/source.naturalHeight),w=source.naturalWidth*scale,h=source.naturalHeight*scale;
  x.drawImage(source,(c.width-w)/2,(c.height-h)/2,w,h);return x.getImageData(0,0,c.width,c.height).data;
 }
 $('tsGenerate').addEventListener('click',()=>{
  if(!source||busy)return;reset();busy=true;dirty=false;status('빛과 윤곽에 맞는 문자를 고르고 있어요…');$('tsPaperHint').hidden=true;area.classList.remove('is-empty');area.style.setProperty('--feed',0);controls();
  const cols=Number($('tsDetail').value),rows=Math.round(cols*(277/190)/1.5),rgba=drawInput(cols,rows);
  try{
   job=new Worker('/js/typing-studio-worker.js?v=1');
   job.onmessage=({data})=>{
    if(data.type==='progress'){$('tsProgress').value=data.value;status(`문자 분석 중 · ${Math.round(data.value*100)}%`);return;}
    if(data.type==='error'){stopJob();status(data.message);controls();return;}
    if(data.type==='complete'){stopJob();plan=data;cursor=0;$('tsProgress').value=0;start();}
   };
   job.onerror=()=>{stopJob();status('분석 도구를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');controls();};
   job.postMessage({rgba,cols,rows,contrast:Number($('tsContrast').value)/100,ink:Number($('tsInk').value)/100,edge:Number($('tsEdge').value)/100,overstrike:$('tsOverstrike').checked,samples:sampleCache},[rgba.buffer]);
  }catch(e){stopJob();status('이 브라우저에서 분석을 시작하지 못했습니다. 최신 브라우저로 다시 시도해 주세요.');controls();}
 });
 function renderCells(target,start,end){
  const x=target.getContext('2d'),margin=target.width*10/210,cw=(target.width-margin*2)/plan.cols,ch=(target.height-target.height*20/297)/plan.rows;
  x.fillStyle='#211f1c';for(let i=start;i<end;i++){
   const p=plan.choices[i];if(!p)continue;
   const col=i%plan.cols,row=Math.floor(i/plan.cols),variation=((i*73%101)/100)-.5;
   core.paint(x,core.patterns[p],margin+col*cw,target.height*10/297+row*ch,cw,ch,variation);
  }
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
  const pattern=core.patterns[plan.choices[cursor]],mark=pattern[layer];
  const margin=canvas.width*10/210,cw=(canvas.width-margin*2)/plan.cols,ch=canvas.height*(277/297)/plan.rows;
  ctx.fillStyle='#211f1c';
  core.paint(ctx,[mark],margin+(cursor%plan.cols)*cw,canvas.height*10/297+Math.floor(cursor/plan.cols)*ch,cw,ch,((cursor*73%101)/100)-.5);
  typed++;layer++;
  machine?.hit(mark.g);
  if(layer===pattern.length){layer=0;cursor++;}
 }
 function finishDrawing(){
  // Rebuild, including any partially overstruck cell, so fast finish is pixel-identical to export.
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);renderCells(canvas,0,plan.choices.length);complete();
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
 function start(){if(!plan||$('tsMachine3D').dataset.ready!=='true')return;area.classList.remove('is-complete');if(reduced.matches){finishDrawing();return;}playing=true;due=performance.now()+100;area.classList.add('is-playing');progress();status('한 글자씩, 겹쳐 치며 그리고 있어요…');controls();frame=requestAnimationFrame(tick);}
 $('tsPause').addEventListener('click',()=>{if(playing){pause();status('잠시 멈췄어요. 이어서 그릴 수 있습니다.');}else start();});
 $('tsFinish').addEventListener('click',()=>{if(plan)finishDrawing();});
 $('tsReplay').addEventListener('click',()=>{if(!plan)return;pause();clearExport();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);cursor=0;resetMotion();start();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){pause();status('다른 화면으로 이동해 잠시 멈췄어요. 계속 그리기를 눌러 주세요.');}});
 const filename=()=>($('tsName').value.trim()||'타자기 드로잉').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_');
 function exportCanvas(){const c=document.createElement('canvas');c.width=2480;c.height=3508;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);renderCells(c,0,plan.choices.length);return c;}
 const toBlob=(c,type='image/png')=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('이미지 저장 실패')),type,.97));
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 async function prepareShare(){const token=exportToken;try{const blob=await toBlob(exportCanvas());if(token===exportToken)sharedFile=new File([blob],filename()+'.png',{type:'image/png'});}catch(e){/* Regular download can be retried independently. */}}
 async function output(action){
  if(!plan||playing||cursor<plan.choices.length)return;
  try{$('tsExportStatus').textContent='저장할 작품을 준비하고 있어요…';await action();}catch(e){$('tsExportStatus').textContent='저장하지 못했습니다. 다시 시도해 주세요.';console.warn('Studio export failed',e);}
 }
 $('tsPNG').addEventListener('click',()=>output(async()=>{download(await toBlob(exportCanvas()),filename()+'.png');$('tsExportStatus').textContent='PNG 다운로드를 시작했습니다.';}));
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
 $('tsPDF').addEventListener('click',()=>output(async()=>{download(await pdf(exportCanvas()),filename()+'.pdf');$('tsExportStatus').textContent='A4 PDF 다운로드를 시작했습니다.';}));
 $('tsPrint').addEventListener('click',()=>output(async()=>{
  const image=new Image();image.src=exportCanvas().toDataURL('image/png');await image.decode();$('tsPrintArea').replaceChildren(image);document.body.classList.add('ts-printing');window.print();$('tsExportStatus').textContent='인쇄 창에서 A4 세로, 배율 100%를 선택해 주세요.';
 }));
 addEventListener('afterprint',()=>document.body.classList.remove('ts-printing'));
 $('tsShare').addEventListener('click',()=>{
  if(navigator.share&&navigator.canShare&&!sharedFile){$('tsExportStatus').textContent='공유할 이미지를 준비하고 있어요. 잠시 후 다시 눌러 주세요.';return;}
  if(sharedFile&&navigator.canShare?.({files:[sharedFile]})){
   const file=new File([sharedFile],filename()+'.png',{type:'image/png'});
   navigator.share({files:[file],title:$('tsName').value}).then(()=>{$('tsExportStatus').textContent='공유했습니다.';}).catch(e=>{if(e.name!=='AbortError')$('tsExportStatus').textContent='공유하지 못했습니다. PNG로 저장해 공유해 주세요.';});
  }else output(async()=>{download(sharedFile||await toBlob(exportCanvas()),filename()+'.png');$('tsExportStatus').textContent='이 브라우저는 파일 공유를 지원하지 않아 PNG로 저장했습니다. 저장한 작품을 공유해 주세요.';});
 });
 $('tsMachine3D').addEventListener('machineerror',()=>{pause();status('3D 표시가 중단되었습니다. 타자기 바꾸기에서 다시 선택해 주세요.');machine?.dispose();machine=null;machinePromise=null;controls();});
 addEventListener('pagehide',()=>machine?.dispose());
 reset();
})();
