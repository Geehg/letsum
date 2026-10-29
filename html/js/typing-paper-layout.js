/* Shared DOM line coordinates: source glyph, carriage and audio use one layout.
 * Range around the newline text uses the parent's metrics, not the small ↵ label. */
(() => {
 'use strict';
 function position(input,host,paper){
  if(!host?.children?.length||host.parentElement!==paper||!host.clientWidth||!document.createRange)return null;
  const style=getComputedStyle(host),box=host.getBoundingClientRect(),height=parseFloat(style.height);
  const sx=box.width/host.clientWidth,sy=box.height/height,lineHeight=parseFloat(style.lineHeight);
  if(!(sx>0&&sy>0&&lineHeight>0))return null;
  const caret=Array.from(input.value.slice(0,input.selectionStart).normalize('NFC')).length;
  const spans=host.children,atEnd=caret>=spans.length,span=spans[Math.min(caret,spans.length-1)];
  const glyphRect=el=>{
   const node=el.classList.contains('nl')&&el.nextSibling?.nodeType===3?el.nextSibling:el.firstChild;
   if(!node)return el.getBoundingClientRect();
   const range=document.createRange();range.selectNodeContents(node);return range.getBoundingClientRect();
  };
  const first=glyphRect(spans[0]),rect=glyphRect(span);
  let advance=Math.max(0,(rect.top-first.top)/sy),x=(rect.left-box.left)/sx-parseFloat(style.paddingLeft||0);
  if(atEnd){if(span.classList.contains('nl')){advance+=lineHeight;x=0;}else x+=rect.width/sx;}
  return {row:Math.round(advance/lineHeight),advance,width:Math.max(0,x),lineHeight,
   glyphBottom:(rect.bottom-box.top)/sy+host.scrollTop+(atEnd&&span.classList.contains('nl')?lineHeight:0)};
 }
 window.LSTypewriterPaper={position};
})();
