/* One native editor and one original-text layer. Both return home on mode exit. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),main=$('tbMain'),read=$('tbRead'),input=$('tbInput'),original=$('tbOrig'),home=$('tbOrigHome'),paper=$('tbHermesPaper'),view=$('tbHermesView');
 if(!main||!home)return;
 // Move the real controls so their handlers and book-specific state remain intact.
 const sideControls=[[main.querySelector('.tb-stats'),$('tbFocusStats')],[$('tbTocWrap'),$('tbFocusBookTools')],[$('tbSource'),$('tbFocusBookTools')],[$('tbPrev'),$('tbFocusBookPager')],[$('tbCur').closest('.tb-pno'),$('tbFocusBookPager')]].map(([el,target])=>{
  const anchor=document.createComment('reader control home');el.before(anchor);return {el,target,anchor};
 });
 let mounted=false,frame=0,fitFrame=0,following=false,portraitViewport=0,portraitWidth=0;
 const portraitMedia=matchMedia('(max-width:600px), (max-width:1100px) and (orientation:portrait)');
 const wanted=()=>main.dataset.readingMode==='immersive'&&main.dataset.skin==='retro'&&!read.hidden;
 const count=s=>Array.from(s.normalize('NFC')).length;
 function fit(){
  fitFrame=0;if(!wanted())return;
  const portrait=portraitMedia.matches&&main.dataset.hermesReady==='true';
  const changed=main.dataset.focusPortrait!==String(portrait);
  main.dataset.focusPortrait=String(portrait);document.body.classList.toggle('tb-retro-portrait',portrait);
  let viewport=window.visualViewport?.height||window.innerHeight;
  if(portrait){
   // Keep framing stable when the software keyboard reduces only the visual viewport.
   const h=window.innerHeight,w=window.innerWidth;
   if(w!==portraitWidth||!portraitViewport||document.activeElement!==input||h>portraitViewport-160){portraitViewport=h;portraitWidth=w;}
   viewport=portraitViewport;
  }
  const top=view.getBoundingClientRect().top+window.scrollY;
  const available=Math.max(260,Math.ceil(viewport-top));
  const compact=portrait?available:view.clientWidth<600?Math.max(300,Math.round(view.clientWidth*1.05)):available;
  main.style.setProperty('--tb-focus-height',Math.min(available,compact)+'px');
  // Reserve the whole carriage sweep; side panels must never cover the writing sheet.
  const sideWidth=(view.clientWidth-paper.getBoundingClientRect().width*1.86)/2-40;
  main.style.setProperty('--tb-focus-side-width',Math.max(150,Math.floor(sideWidth))+'px');
  main.dataset.focusSides=portrait||sideWidth<150?'below':'beside';
  // Align the central sheet with the top of the book panel beside it.
  const book=main.querySelector('.tb-focus-book');
  const beside=getComputedStyle(book).position==='absolute';
  const inset=portrait?44:beside?Math.max(16,book.getBoundingClientRect().top-view.getBoundingClientRect().top):16;
  const value=inset.toFixed(2)+'px';
  if(changed||main.style.getPropertyValue('--tb-focus-sheet-top')!==value){
   main.style.setProperty('--tb-focus-sheet-top',value);
   view.dispatchEvent(new CustomEvent('tb:hermes-align'));
  }
 }
 function scheduleFit(){if(!fitFrame)fitFrame=requestAnimationFrame(fit);}
 function refresh(){
  frame=0;if(!mounted)return;
  paper.style.setProperty('--tb-trace-font',getComputedStyle(input).fontFamily);
  main.style.setProperty('--tb-focus-font',getComputedStyle(input).fontFamily);
  const start=count(input.value.slice(0,input.selectionStart)),end=count(input.value.slice(0,input.selectionEnd));
  const spans=Array.from(original.children);let caret=spans[Math.min(start,spans.length-1)];
  for(let i=0;i<spans.length;i++){
   const span=spans[i];span.classList.toggle('trace-caret',span===caret&&start===end);
   span.classList.toggle('trace-after',span===caret&&start>=spans.length);
   span.classList.toggle('trace-selected',i>=start&&i<end);
  }
  if(caret){
   const line=parseFloat(getComputedStyle(input).lineHeight)||48;
   const target=main.dataset.paperFeed==='physical'?Number(paper.dataset.feedScroll||0):Math.max(0,caret.offsetTop-(original.clientHeight-line)*.36);
   following=true;original.scrollTop=target;input.scrollTop=original.scrollTop;following=false;
  }
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(refresh);}
 function update(){
  const want=wanted(),next=want&&main.dataset.hermesReady==='true';
  const entering=want&&!document.body.classList.contains('tb-retro-immersive');
  document.body.classList.toggle('tb-retro-immersive',want);
  if(next&&!mounted){sideControls.forEach(({el,target})=>target.append(el));paper.prepend(original);original.scrollTop=0;input.setAttribute('aria-describedby','tbHermesStatus');if(!document.activeElement||document.activeElement===document.body||document.activeElement===input)input.focus({preventScroll:true});}
  if(!next&&mounted){sideControls.forEach(({el,anchor})=>anchor.after(el));home.after(original);original.scrollTop=0;input.removeAttribute('aria-describedby');original.querySelectorAll('.trace-caret,.trace-after,.trace-selected').forEach(s=>s.classList.remove('trace-caret','trace-after','trace-selected'));}
  mounted=next;
  if(entering)window.scrollTo({top:0,behavior:'instant'});
  if(!want){main.style.removeProperty('--tb-focus-height');main.dataset.focusPortrait='false';document.body.classList.remove('tb-retro-portrait');}
  if(!next){main.dataset.focusMenu='false';$('tbFocusMenu').setAttribute('aria-expanded','false');}
  schedule();scheduleFit();
 }
 new MutationObserver(update).observe(main,{attributes:true,attributeFilter:['data-reading-mode','data-skin','data-hermes-ready','data-paper-feed']});
 new MutationObserver(update).observe(read,{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(schedule).observe(original,{childList:true});
 new MutationObserver(()=>{schedule();scheduleFit();}).observe(input,{attributes:true,attributeFilter:['style']});
 for(const name of ['input','click','keyup','select','compositionstart','compositionend','tb:paper'])input.addEventListener(name,schedule);
 input.addEventListener('scroll',()=>{if(mounted&&!following&&main.dataset.paperFeed!=='physical')original.scrollTop=input.scrollTop;});
 document.addEventListener('selectionchange',()=>{if(document.activeElement===input)schedule();});
 document.fonts?.addEventListener('loadingdone',()=>{schedule();scheduleFit();});
 view.addEventListener('tb:hermes-layout',scheduleFit);
 window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);
 const observer=new ResizeObserver(scheduleFit);for(const el of [main.querySelector('.tb-topw'),main.querySelector('.tb-rh'),$('tbFocusBookTools'),$('tbFocusBookPager')])observer.observe(el);
 $('tbFocusMenu').addEventListener('click',()=>{const open=main.dataset.focusMenu!=='true';main.dataset.focusMenu=String(open);$('tbFocusMenu').setAttribute('aria-expanded',String(open));});
 $('tbFocusSettings').addEventListener('click',()=>$('tbSetOpen').click());
 portraitMedia.addEventListener('change',scheduleFit);
 update();
})();
