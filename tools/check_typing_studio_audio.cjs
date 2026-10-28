const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sources=[],gains=[];let requests=0,active=true,release;
const gate=new Promise(r=>release=r);
class AudioContext {
 constructor(){this.state='suspended';this.currentTime=5;this.destination={};}
 resume(){this.state='running';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
 createGain(){const node={gain:{value:0,setValueAtTime(v){this.value=v;}},connect(to){return to;},disconnect(){}};gains.push(node);return node;}
 createBufferSource(){const node={connect(to){return to;},start(t,offset){this.started=[t,offset];},stop(){this.stopped=true;this.onended?.();},disconnect(){}};sources.push(node);return node;}
 decodeAudioData(){return Promise.resolve({duration:1});}
}
const scope=vm.createContext({AudioContext,fetch:async()=>{requests++;await gate;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
vm.runInContext(fs.readFileSync('html/js/typing-studio-audio.js','utf8'),scope);
const statuses=[],audio=scope.TypewriterStudioAudio.create({isActive:()=>active,onStatus:s=>statuses.push(s)});
(async()=>{
 assert.equal(await audio.prepare(),false);assert.equal(requests,0);
 audio.configure({enabled:true,volume:38});const ready=audio.prepare();assert.equal(audio.hit(),false,'cold hit is dropped');release();assert.equal(await ready,true);assert.equal(sources.length,0,'missed hits must not play late');
 assert.equal(requests,9);await audio.prepare();assert.equal(requests,9,'decoded samples reused');
 assert.equal(audio.hit(),true);assert.ok(sources[0].started[1]>0,'trim silence at attack');assert.equal(gains[0].gain.value,.38);
 audio.configure({enabled:false,volume:38});assert.ok(sources.every(s=>s.stopped));assert.equal(audio.hit(),false);
 audio.configure({enabled:true,volume:0});assert.equal(audio.carriage(),false);assert.equal(statuses.at(-1),'muted');
 audio.configure({enabled:true,volume:70});active=false;assert.equal(audio.feed(),false);active=true;
 const pending=audio.preview();audio.stop();assert.equal(await pending,false,'cancel pending preview');
 for(let i=0;i<40;i++)audio.hit();assert.ok(sources.filter(s=>!s.stopped).length<=18,'bound concurrent audio');audio.stop();assert.ok(sources.every(s=>s.stopped));
 audio.dispose();console.log('PASS: audio opt-in, cached decode, no late burst, immediate mute, volume, preview cancellation, bounded voices');
})().catch(e=>{console.error(e);process.exitCode=1;});
