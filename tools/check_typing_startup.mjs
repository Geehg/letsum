import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../html/js/typing-model-gallery.js',import.meta.url),'utf8');
const template=fs.readFileSync(new URL('./typing_app.html',import.meta.url),'utf8');
assert(template.indexOf("document.documentElement.dataset.tbBoot='loading'")<template.indexOf('<body'),'first-paint guard is installed in the head');
assert.match(template,/html\[data-tb-boot\] #tbMain/);
for(const mode of ['immersive','standard'])for(const direct of [false,true]){
 const observers=[],elements={},listeners={};let boot=true,cleared=false;
 function element(id){return elements[id]??=( {id,dataset:{},hidden:false,open:false,value:'hermes3000',textContent:'',addEventListener(type,fn){listeners[id+':'+type]=fn;},querySelectorAll(){return [];},showModal(){this.open=true;},close(){this.open=false;},focus(){},dispatchEvent(){}} );}
 const main=element('tbMain');main.dataset={readingMode:mode,skin:mode==='immersive'?'retro':'ink',modelGate:'pending'};
 const dialog=element('tbModelGallery'),read=element('tbRead');read.hidden=!direct;read.dataset.bookId=direct?'unsu':'';
 const context={document:{getElementById:element,activeElement:null,body:{classList:{add(){},remove(){}}},documentElement:{removeAttribute(){boot=false;}}},window:{tbBootTimer:1},clearTimeout(){cleared=true;},MutationObserver:class{constructor(fn){this.fn=fn;}observe(){observers.push(this.fn);}},location:{hash:'#/read/unsu'}};
 vm.runInNewContext(source,context);
 assert(boot&&!dialog.open,'pending route never reveals the default shelf or another reader');
 main.dataset.appReady='true';observers.forEach(fn=>fn());
 assert(!boot&&cleared,'ready route removes boot guard and timeout');
 assert.equal(dialog.open,mode==='immersive'&&direct,'shelf never opens the chooser; direct immersive reading does');
 if(mode==='immersive'){
  dialog.close();main.dataset.modelGate='ready';
  read.hidden=true;observers.forEach(fn=>fn());assert(!dialog.open,'return to shelf closes chooser');
  read.dataset.bookId='unsu';read.hidden=false;observers.forEach(fn=>fn());assert(dialog.open,'clicking a book from shelf opens chooser');
  dialog.close();main.dataset.modelGate='ready';observers.forEach(fn=>fn());assert(!dialog.open,'page updates do not reopen chooser');
  read.dataset.bookId='memil';observers.forEach(fn=>fn());assert(dialog.open,'changing books offers model choice again');
  read.hidden=true;observers.forEach(fn=>fn());assert(!dialog.open,'cancel returns to unobstructed shelf');
 }
}
console.log('Startup checks passed: first-paint guard, deferred route readiness, shelf entry, book choice/re-entry, direct reading, book changes and explicit other mode.');
