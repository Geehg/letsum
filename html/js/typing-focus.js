/* Return to the real paper editor after reader actions, without stealing focus
 * from an open dialog, an unfinished control interaction, or an IME session. */
(() => {
 'use strict';
 const main=document.getElementById('tbMain'),read=document.getElementById('tbRead'),input=document.getElementById('tbInput');
 if(!main||!read||!input)return;
 let composing=false,queued=false;
 const visible=el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
 function resume(){
  queued=false;
  if(document.hidden||read.hidden||composing||input.disabled||input.readOnly||main.dataset.appReady!=='true'||main.dataset.modelGate==='pending'||main.dataset.focusMenu==='true')return;
  if([...document.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"]')].some(visible))return;
  if(!visible(input)||document.activeElement===input)return;
  input.focus({preventScroll:true});
 }
 function request(){if(!queued){queued=true;queueMicrotask(resume);}}
 document.addEventListener('click',e=>{
  // Native selects and sliders must finish their gesture before focus returns.
  if(e.target===input||e.target.closest('select,input,textarea,[contenteditable="true"]'))return;
  request();
 });
 document.addEventListener('change',request);
 document.addEventListener('keyup',e=>{if(e.key==='Escape')request();});
 input.addEventListener('compositionstart',()=>{composing=true;});
 input.addEventListener('compositionend',()=>{composing=false;});
 document.addEventListener('visibilitychange',request);
 window.addEventListener('focus',request);
 window.addEventListener('pageshow',request);
 window.addEventListener('afterprint',request);
 // Also cover asynchronous model readiness, routing and dialogs closed by code.
 new MutationObserver(request).observe(main,{attributes:true,attributeFilter:['data-app-ready','data-hermes-state','data-model-gate','data-reading-mode','data-focus-menu']});
 new MutationObserver(request).observe(read,{attributes:true,attributeFilter:['hidden','data-book-id']});
 new MutationObserver(records=>{
  if(records.some(r=>r.target.matches('.tb-ov,.shot-ov,dialog')))request();
 }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','open']});
 request();
})();
