/* Recorded typewriter Foley. Same licensed clips as the reading mode.
 * Sources: /data/typing/audio/credits.html. No synthesized audio. */
(function(root){
 'use strict';
 function create({isActive=()=>true,onStatus=()=>{}}={}){
  const names=['key-1','key-2','key-3','key-4','key-5','key-6','bell','return','paper'];
  const attack={'key-1':.028,'key-2':.020,'key-3':.034,'key-4':.030,'key-5':.020,'key-6':.038,bell:.006,return:.050,paper:.012};
  const buffers=new Map(),voices=new Set();let context,master,loading,enabled=false,volume=.38,index=0,previewToken=0;
  const active=()=>enabled&&volume>0&&isActive();
  function stop(){previewToken++;for(const source of voices){try{source.stop();}catch(_){}}voices.clear();}
  function configure(settings){enabled=!!settings.enabled;volume=Math.max(0,Math.min(1,Number(settings.volume)/100||0));if(master)master.gain.setValueAtTime(volume,context.currentTime);if(!active())stop();onStatus(!enabled?'off':volume===0?'muted':buffers.size===names.length?'ready':'idle');}
  function prepare(){
   if(!enabled)return Promise.resolve(false);
   try{
    if(!context){context=new (root.AudioContext||root.webkitAudioContext)({latencyHint:'interactive'});master=context.createGain();master.gain.value=volume;master.connect(context.destination);}
    // Called directly from the user's click, before any awaited download.
    const resumed=context.state==='running'?Promise.resolve():context.resume();
    if(!loading){onStatus('loading');loading=Promise.all(names.map(async name=>{if(buffers.has(name))return;const r=await fetch('/data/typing/audio/'+name+'.mp3?v=1');if(!r.ok)throw Error('audio');buffers.set(name,await context.decodeAudioData(await r.arrayBuffer()));})).catch(e=>{loading=null;throw e;});}
    return Promise.all([resumed,loading]).then(()=>{if(enabled)onStatus(volume>0?'ready':'muted');return active()&&context.state==='running';}).catch(()=>{if(enabled)onStatus('error');return false;});
   }catch(_){onStatus('error');return Promise.resolve(false);}
  }
  function play(name,gain=1){
   // Never queue missed strikes: mute/pause/cold loading cannot create a late burst.
   if(!active()||context?.state!=='running'||!buffers.has(name))return false;
   if(voices.size>=18){const oldest=voices.values().next().value;oldest.stop();voices.delete(oldest);}
   const source=context.createBufferSource(),level=context.createGain();source.buffer=buffers.get(name);level.gain.value=gain;source.connect(level).connect(master);voices.add(source);
   source.onended=()=>{voices.delete(source);source.disconnect();level.disconnect();};source.start(context.currentTime,attack[name]);return true;
  }
  function hit(){index=(index+1)%6;return play('key-'+(index+1),.85);}
  async function preview(){const token=++previewToken;if(await prepare()&&token===previewToken){hit();return true;}return false;}
  return {configure,prepare,preview,stop,hit,bell:()=>play('bell',.42),carriage:()=>play('return',.72),feed:()=>play('paper',.48),dispose(){stop();context?.close().catch(()=>{});}};
 }
 root.TypewriterStudioAudio={create};
 if(typeof module!=='undefined')module.exports={create};
})(typeof window==='undefined'?globalThis:window);
