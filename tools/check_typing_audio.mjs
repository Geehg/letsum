import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=fs.readFileSync('html/js/typing-audio.js','utf8');
assert(!/createOscillator|createBiquadFilter|Math\.random\(\)\s*\*\s*2\s*-\s*1/.test(code));
const events=new Map(),played=[],sources=[],observers=[];let clock=0,row=0,ratio=0,fail=false;
const eventTarget=id=>({addEventListener(n,fn){const k=id+':'+n;events.set(k,[...(events.get(k)||[]),fn]);}});
const main={...eventTarget('main'),dataset:{skin:'retro',readingMode:'immersive'}};
const input={...eventTarget('input'),value:'',selectionStart:0};
const span={get offsetTop(){return row},getBoundingClientRect(){return{left:ratio*600,width:10}}};
const original={querySelector(){return span},lastElementChild:span,getBoundingClientRect(){return{left:0,width:600}}};
const document={...eventTarget('document'),hidden:false,getElementById(id){return{tbMain:main,tbInput:input,tbOrig:original}[id]}};
class AudioContext{
 constructor(){this.state='running';this.currentTime=0;this.destination={};}
 createGain(){return{gain:{value:0,setValueAtTime(){}},connect(){}};}
 createBufferSource(){const s={connect(){return{connect(){}}},disconnect(){},start(t){played.push({name:this.buffer.name,t});},stop(){this.stopped=true;}};sources.push(s);return s;}
 async decodeAudioData(name){return{name};}
 async resume(){this.state='running';}
}
const window={...eventTarget('window'),AudioContext};
vm.runInNewContext(code,{window,document,fetch:async url=>({ok:!fail,arrayBuffer:async()=>url.match(/([^/]+)\.mp3/)[1]}),performance:{now:()=>clock},queueMicrotask,MutationObserver:class{constructor(fn){observers.push(fn)}observe(){}},ResizeObserver:class{observe(){}},console});
const api=window.LSTypewriterAudio;
const drain=async()=>{for(let i=0;i<35;i++)await Promise.resolve()};
async function emit(id,type,e={}){for(const f of events.get(id+':'+type)||[])f(e);await drain();}
function key(k,extra={}){return{key:k,code:k==='Enter'?'Enter':'KeyA',...extra};}
async function change(value,newRow=row,newRatio=ratio){input.value=value;input.selectionStart=value.length;row=newRow;ratio=newRatio;await emit('input','input');}
async function reset(value=''){input.value=value;input.selectionStart=value.length;row=0;ratio=0;await emit('input','tb:page-loaded',{detail:{changed:false}});played.length=0;}
api.configure({sound:true,volume:38});await emit('document','pointerdown');await reset();
assert.equal(main.dataset.typewriterAudio,'ready');
await emit('input','keydown',key('a'));await change('a');assert.equal(played.length,1,'physical key is not repeated by input');assert.match(played[0].name,/key-/);
await emit('input','keydown',key('Enter'));assert.equal(played.length,1,'keydown alone does not return');
await change('a\n',20);assert.deepEqual(played.slice(1).map(x=>x.name),['bell','return'],'accepted newline: bell then slide');
await reset();await emit('input','keydown',key('a'));await change('a',0,.9);assert.equal(played.filter(x=>x.name==='bell').length,1);
await emit('input','keydown',key('b'));await change('ab',20,.05);assert.equal(played.filter(x=>x.name==='bell').length,1,'no duplicate bell after margin warning');assert.equal(played.filter(x=>x.name==='return').length,1,'soft wrap slides once');
await emit('input','keyup',key('b'));assert.equal(played.filter(x=>x.name==='return').length,1);
await reset();await emit('input','compositionstart');await emit('input','keydown',key('Process'));await change('ㅎ');clock+=200;await emit('input','keydown',key('Enter',{isComposing:true}));await change('한');await emit('input','compositionend');assert.equal(played.length,1,'IME confirm Enter produces neither extra strike nor return');
await reset();clock+=500;await emit('input','compositionstart');await change('한');await emit('input','compositionend');assert.equal(played.length,1,'mobile IME without keydown sounds once');
await reset('long saved page\ncontent');assert.equal(played.length,0,'initial/restored page stays quiet');await emit('input','tb:page-loaded',{detail:{changed:true}});assert.deepEqual(played.map(x=>x.name),['paper']);
api.configure({sound:false,volume:38});assert(sources.every(s=>s.stopped),'muting stops active voices');played.length=0;await emit('input','keydown',key('a'));await change('x\n',20);assert.equal(played.length,0);
api.configure({sound:true,volume:0});await emit('input','tb:page-loaded',{detail:{changed:true}});assert.equal(played.length,0);
api.configure({sound:true,volume:38});main.dataset.skin='focus';observers[0]();await emit('input','keydown',key('a'));assert.equal(played.length,0,'other skins stay silent');
// Every distributed clip is real, nonempty and mapped to documented source intervals.
const segments=JSON.parse(fs.readFileSync('html/data/typing/audio/segments.json','utf8'));
assert.equal(segments.length,10);for(const seg of segments){assert(fs.statSync('html/data/typing/audio/'+seg.file).size>2000);assert(seg.end>seg.start);}
console.log('PASS: recorded playback, newline/wrap/margin, IME dedup, mobile IME, page changes, mute/zero/skin, no synth, 10 assets');
