/* One native editor and one original-text layer. Both return home on mode exit. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),main=$('tbMain'),read=$('tbRead'),input=$('tbInput'),original=$('tbOrig'),home=$('tbOrigHome'),paper=$('tbHermesPaper'),view=$('tbHermesView');
 if(!main||!home)return;
 let mounted=false,frame=0,fitFrame=0,following=false,nextMeasureKey='';
 const wanted=()=>main.dataset.readingMode==='immersive'&&main.dataset.skin==='retro'&&!read.hidden;
 const count=s=>Array.from(s.normalize('NFC')).length;
 function fitNextPage(){
  const text=$('tbFocusNextText'),sheet=text.parentElement;
  if(!mounted||!text.clientWidth)return;
  const key=[text.textContent,sheet.clientWidth,getComputedStyle(text).fontFamily].join('|');
  if(key===nextMeasureKey)return;
  nextMeasureKey=key;sheet.style.minHeight='';text.style.fontSize='11px';
  // Fit the complete next page, rather than hiding overflow behind a scrollbar.
  let size=11;
  while(size>8&&(text.scrollHeight>text.clientHeight+1||text.scrollWidth>text.clientWidth+1)){
   size-=.25;text.style.fontSize=size+'px';
  }
  if(text.scrollHeight>text.clientHeight+1){
   const css=getComputedStyle(sheet);
   sheet.style.minHeight=Math.ceil(text.scrollHeight+parseFloat(css.paddingTop)+parseFloat(css.paddingBottom))+'px';
  }
  text.scrollTop=0;
 }
 function fit(){
  fitFrame=0;if(!wanted())return;
  const viewport=window.visualViewport?.height||window.innerHeight;
  const top=view.getBoundingClientRect().top+window.scrollY,foot=$('tbHermesStage').querySelector('.tb-hermes-foot').getBoundingClientRect().height;
  const available=Math.max(260,Math.floor(viewport-top-foot-8));
  const compact=view.clientWidth<600?Math.max(300,Math.round(view.clientWidth*1.05)):available;
  main.style.setProperty('--tb-focus-height',Math.min(available,compact)+'px');
  // Reserve the whole carriage sweep; side panels must never cover the writing sheet.
  const sideWidth=(view.clientWidth-paper.getBoundingClientRect().width*1.86)/2-40;
  main.style.setProperty('--tb-focus-side-width',Math.max(150,Math.floor(sideWidth))+'px');
  main.dataset.focusSides=sideWidth<150?'below':'beside';
  fitNextPage();
 }
 function scheduleFit(){if(!fitFrame)fitFrame=requestAnimationFrame(fit);}
 function refresh(){
  frame=0;if(!mounted)return;
  paper.style.setProperty('--tb-trace-font',getComputedStyle(input).fontFamily);
  main.style.setProperty('--tb-focus-font',getComputedStyle(input).fontFamily);
  fitNextPage();
  const start=count(input.value.slice(0,input.selectionStart)),end=count(input.value.slice(0,input.selectionEnd));
  const spans=Array.from(original.children);let caret=spans[Math.min(start,spans.length-1)];
  for(let i=0;i<spans.length;i++){
   const span=spans[i];span.classList.toggle('trace-caret',span===caret&&start===end);
   span.classList.toggle('trace-after',span===caret&&start>=spans.length);
   span.classList.toggle('trace-selected',i>=start&&i<end);
  }
  if(caret){
   const line=parseFloat(getComputedStyle(input).lineHeight)||48;
   const target=Math.max(0,caret.offsetTop-(original.clientHeight-line)*.36);
   following=true;original.scrollTop=target;input.scrollTop=original.scrollTop;following=false;
  }
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(refresh);}
 function update(){
  const want=wanted(),next=want&&main.dataset.hermesReady==='true';
  const entering=want&&!document.body.classList.contains('tb-retro-immersive');
  document.body.classList.toggle('tb-retro-immersive',want);
  if(next&&!mounted){paper.prepend(original);original.scrollTop=0;input.setAttribute('aria-describedby','tbHermesStatus');}
  if(!next&&mounted){home.after(original);original.scrollTop=0;input.removeAttribute('aria-describedby');original.querySelectorAll('.trace-caret,.trace-after,.trace-selected').forEach(s=>s.classList.remove('trace-caret','trace-after','trace-selected'));}
  mounted=next;
  if(entering)window.scrollTo({top:0,behavior:'instant'});
  if(!want)main.style.removeProperty('--tb-focus-height');
  schedule();scheduleFit();
 }
 new MutationObserver(update).observe(main,{attributes:true,attributeFilter:['data-reading-mode','data-skin','data-hermes-ready']});
 new MutationObserver(update).observe(read,{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(schedule).observe(original,{childList:true});
 new MutationObserver(()=>{nextMeasureKey='';scheduleFit();}).observe($('tbFocusNextText'),{childList:true,characterData:true,subtree:true});
 new MutationObserver(()=>{schedule();scheduleFit();}).observe(input,{attributes:true,attributeFilter:['style']});
 for(const name of ['input','click','keyup','select','compositionstart','compositionend','tb:paper'])input.addEventListener(name,schedule);
 input.addEventListener('scroll',()=>{if(mounted&&!following)original.scrollTop=input.scrollTop;});
 document.addEventListener('selectionchange',()=>{if(document.activeElement===input)schedule();});
 document.fonts?.addEventListener('loadingdone',()=>{nextMeasureKey='';schedule();scheduleFit();});
 view.addEventListener('tb:hermes-layout',scheduleFit);
 window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);
 const observer=new ResizeObserver(scheduleFit);for(const el of [main.querySelector('.tb-topw'),main.querySelector('.tb-rh'),$('tbHermesStage').querySelector('.tb-hermes-foot')])observer.observe(el);
 update();
})();
