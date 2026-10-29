'use strict';
importScripts('typing-dot-core.js?v=1');
self.onmessage=({data})=>{
 try{
  const start=performance.now(),result=DotRetro.render(data);
  self.postMessage({...result,ms:performance.now()-start},[result.rgba.buffer]);
 }catch(error){self.postMessage({error:error.message||'이미지를 변환하지 못했습니다.'});}
};
