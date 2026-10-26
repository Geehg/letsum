import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../html/js/typing-model-gallery.js',import.meta.url),'utf8');
const template=fs.readFileSync(new URL('./typing_app.html',import.meta.url),'utf8');
assert(template.indexOf("document.documentElement.dataset.tbBoot='loading'")<template.indexOf('<body'),'first-paint guard is installed in the head');
assert.match(template,/html\[data-tb-boot\] #tbMain/);
for(const mode of ['immersive','standard']){
 const observers=[],elements={},listeners={};let boot=true,cleared=false;
 function element(id){return elements[id]??=( {id,dataset:{},hidden:false,open:false,value:'hermes3000',textContent:'',addEventListener(type,fn){listeners[id+':'+type]=fn;},querySelectorAll(){return [];},showModal(){this.open=true;},close(){this.open=false;},focus(){},dispatchEvent(){}} );}
 const main=element('tbMain');main.dataset={readingMode:mode,skin:mode==='immersive'?'retro':'ink',modelGate:'pending'};
 const dialog=element('tbModelGallery');
 const context={document:{getElementById:element,activeElement:null,body:{classList:{add(){},remove(){}}},documentElement:{removeAttribute(){boot=false;}}},window:{tbBootTimer:1},clearTimeout(){cleared=true;},MutationObserver:class{constructor(fn){this.fn=fn;}observe(){observers.push(this.fn);}},location:{hash:'#/read/unsu'}};
 vm.runInNewContext(source,context);
 assert(boot&&!dialog.open,'pending route never reveals the default shelf or another reader');
 main.dataset.appReady='true';observers.forEach(fn=>fn());
 assert(!boot&&cleared,'ready route removes boot guard and timeout');
 assert.equal(dialog.open,mode==='immersive','only the requested immersive mode opens model selection');
}
console.log('Startup checks passed: first-paint guard, deferred route readiness, immersive/default and explicit other mode.');
