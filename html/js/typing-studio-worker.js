
'use strict';
importScripts('typing-studio-core.js?v=8','typing-studio-etf.js?v=1','typing-studio-streamlines.js?v=6','typing-studio-flow.js?v=7');
self.onmessage=({data})=>{try{
 const core=TypewriterArt,gray=core.prepare(data.rgba,data.cols*core.SW,data.rows*core.SH,data.contrast,data.edge,data.bounds);
 const final=core.flow({cols:data.cols,rows:data.rows},data,gray,value=>self.postMessage({type:'progress',value}));
 self.postMessage({type:'complete',...final},[final.choices.buffer,final.angles.buffer,final.offsets.buffer]);
}catch(error){self.postMessage({type:'error',message:'이미지를 문자로 분석하지 못했습니다. 설정을 확인한 뒤 다시 시도해 주세요.'});}};
