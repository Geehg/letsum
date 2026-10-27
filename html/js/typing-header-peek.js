/* Retro immersive reading: show the site header and toolbar for 3s, then slide them away.
 * Hovering (or tapping) the top edge brings them back; leaving them hides them again. */
(() => {
 'use strict';
 const main=document.getElementById('tbMain'),header=document.querySelector('body>header'),bar=main?.querySelector('.tb-topw');
 if(!main||!header||!bar)return;
 const body=document.body,zone=document.createElement('div');
 zone.className='tb-peek-zone';zone.setAttribute('aria-hidden','true');body.append(zone);
 const FIRST=3000,LEAVE=600;
 let on=false,timer=0;
 const panels=[header,bar];
 const wanted=()=>body.classList.contains('tb-retro-immersive')&&!body.classList.contains('tb-retro-portrait')&&main.dataset.modelGate!=='pending';
 // Never hide under the pointer or while a control inside (e.g. search) has focus.
 const busy=()=>panels.some(el=>el.matches(':hover')||el.contains(document.activeElement));
 function hideLater(ms){clearTimeout(timer);timer=setTimeout(()=>{if(!on)return;if(busy())hideLater(LEAVE);else body.classList.add('tb-peek-off');},ms);}
 function show(ms){if(!on)return;body.classList.remove('tb-peek-off');hideLater(ms);}
 function update(){
  const want=wanted();if(want===on)return;
  on=want;clearTimeout(timer);
  body.classList.toggle('tb-peek',on);body.classList.remove('tb-peek-off');
  if(on){body.style.setProperty('--tb-peek-hd',header.offsetHeight+'px');hideLater(FIRST);}
  // The bars leave or rejoin the flow, so the typewriter view must refit its height.
  dispatchEvent(new Event('resize'));
 }
 zone.addEventListener('mouseenter',()=>show(FIRST));
 zone.addEventListener('click',()=>show(FIRST));
 for(const el of panels){
  el.addEventListener('mouseenter',()=>{if(on)clearTimeout(timer);});
  el.addEventListener('mouseleave',()=>show(LEAVE));
  el.addEventListener('focusin',()=>show(FIRST));
  el.addEventListener('focusout',()=>show(LEAVE));
 }
 addEventListener('resize',()=>{if(on)body.style.setProperty('--tb-peek-hd',header.offsetHeight+'px');});
 new MutationObserver(update).observe(body,{attributes:true,attributeFilter:['class']});
 new MutationObserver(update).observe(main,{attributes:true,attributeFilter:['data-model-gate']});
 update();
})();
