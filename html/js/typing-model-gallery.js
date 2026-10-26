/* Select an instrument before entering immersive reading. Native dialog supplies
 * focus containment and makes the underlying editor inert, including during IME. */
(() => {
 'use strict';
 const main=document.getElementById('tbMain'),dialog=document.getElementById('tbModelGallery'),read=document.getElementById('tbRead'),select=document.getElementById('tbModel');
 if(!dialog||!main||!select)return;
 let first=true,wasImmersive=false,wasReading=false,lastBook='',returnFocus=null,fromSettings=false;
 const immersive=()=>main.dataset.readingMode==='immersive'&&main.dataset.skin==='retro';
 function open(settings=false){
  if(dialog.open)return;
  fromSettings=settings;returnFocus=document.activeElement;
  document.getElementById('tbModelGalleryBack').textContent=settings?'설정으로 돌아가기 ↗':'서가로 돌아가기 ↗';
  document.getElementById('tbSet').hidden=true;
  main.dataset.modelGate='pending';
  for(const card of dialog.querySelectorAll('[data-gallery-model]'))card.dataset.current=String(card.dataset.galleryModel===select.value);
  dialog.showModal();document.body.classList.add('tb-model-choosing');dialog.scrollTop=0;
  document.getElementById('tbModelGalleryTitle').focus({preventScroll:true});
 }
 function close(){dialog.close();document.body.classList.remove('tb-model-choosing');}
 function cancel(){
  close();
  if(fromSettings){main.dataset.modelGate='ready';document.getElementById('tbSet').hidden=false;returnFocus?.focus({preventScroll:true});}
  else {location.hash='#/';document.querySelector('.tb-crumb a')?.focus({preventScroll:true});}
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
 document.getElementById('tbModelGalleryBack').addEventListener('click',cancel);
 document.getElementById('tbModelGalleryOpen').addEventListener('click',()=>open(true));
 dialog.addEventListener('click',e=>{
  const button=e.target.closest('[data-choose-model]');if(!button)return;
  select.value=button.dataset.chooseModel;select.dispatchEvent(new Event('change',{bubbles:true}));
  main.dataset.modelGate='ready';close();
  if(!read.hidden)document.getElementById('tbInput').focus({preventScroll:true});
  else document.getElementById('tbStart').focus({preventScroll:true});
 });
 function sync(){
  if(main.dataset.appReady!=='true')return;
  const wanted=immersive(),reading=!read.hidden,book=read.dataset.bookId||'';
  if(wanted&&reading&&(first||!wasImmersive||!wasReading||book!==lastBook))open();
  if((!wanted||!reading)&&dialog.open)close();
  first=false;wasImmersive=wanted;wasReading=reading;lastBook=book;
  clearTimeout(window.tbBootTimer);document.documentElement.removeAttribute('data-tb-boot');
 }
 new MutationObserver(sync).observe(main,{attributes:true,attributeFilter:['data-reading-mode','data-skin','data-app-ready']});
 new MutationObserver(sync).observe(read,{attributes:true,attributeFilter:['hidden','data-book-id']});
 sync();
})();
