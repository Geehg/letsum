'use strict';
importScripts('typing-studio-core.js?v=1');
self.onmessage=({data})=>{
 try{
  const result=TypewriterArt.match(data,data.samples,value=>self.postMessage({type:'progress',value}));
  self.postMessage({type:'complete',...result},[result.choices.buffer]);
 }catch(error){self.postMessage({type:'error',message:'이미지를 문자로 분석하지 못했습니다. 다른 이미지로 다시 시도해 주세요.'});}
};
