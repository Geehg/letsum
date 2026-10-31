/* Run against a local type.letsum.app entry point in isolated, disposable contexts. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.TYPEBOOK_URL||'http://127.0.0.1:8888',out=process.env.PAPER_QA_DIR||'/tmp/letsum-paper-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const reports=[];
 const cases=process.env.TYPEBOOK_CLOSEUP?[['hermes3000',1440,900,14],['hermes3000',390,844,14]]:[['olympiasm3',1310,863,14],['hermes3000',1440,900,14],['lettera32',1280,800,18],['olympiasm3',1310,863,28],['olympiasm3',390,844,14],['hermes3000',768,1024,14]];
 for(const [model,width,height,size] of cases){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({size,close})=>{
   if(close)localStorage.setItem('typebook-v1:camera','close');
   localStorage.setItem('typebook-v1:trace-font',JSON.stringify(size));
   // Record the exact scheduled sounds without using an OS audio device.
   window.__sounds=[];const realFetch=window.fetch;
   window.fetch=async(...args)=>{const m=String(args[0]).match(/\/data\/typing\/audio\/([^/]+)\.mp3/);if(m)return {ok:true,arrayBuffer:async()=>({name:m[1],slice(){return this;}})};return realFetch(...args);};
   window.AudioContext=class{
    constructor(){this.state='running';this.currentTime=0;this.destination={};}
    createGain(){return {gain:{value:0,setValueAtTime(){}},connect(){},disconnect(){}};}
    createBufferSource(){return {connect(){return {connect(){}};},disconnect(){},stop(){},start(){window.__sounds.push({name:this.buffer.name,n:Array.from(document.getElementById('tbInput').value).length});queueMicrotask(()=>this.onended?.());}};}
    async decodeAudioData(raw){return {name:raw.name};}async resume(){}
   };
  },{size,close:!!process.env.TYPEBOOK_CLOSEUP});
  await page.goto(base+'/#/read/byeol');await page.locator('#tbModelGallery[open]').waitFor();await page.click(`[data-choose-model="${model}"]`);await page.locator('#tbMain[data-hermes-state="ready"]').waitFor({timeout:60000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(900);
  const report=await page.evaluate(async()=>{
   const input=document.getElementById('tbInput'),host=document.getElementById('tbOrig'),paper=document.getElementById('tbHermesPaper');
   const source=Array.from(host.dataset.source),lh=parseFloat(getComputedStyle(host).lineHeight),first=host.children[0].offsetTop;
   const expectedRows=Array.from(host.children,s=>Math.round((s.offsetTop-first)/lh));
   const pause=ms=>new Promise(r=>setTimeout(r,ms)),frame=()=>new Promise(requestAnimationFrame),samples=[],clips=[];
   let monitor=true,lastTop=null,maxDown=0;
   function sample(){
    const i=Array.from(input.value.slice(0,input.selectionStart).normalize('NFC')).length,s=host.children[i];if(!s)return;
    const p=paper.getBoundingClientRect(),g=s.getBoundingClientRect();
    const item={i,ch:source[i],top:p.top,height:p.height,glyphTop:g.top,glyphBottom:g.bottom,scroll:host.scrollTop};
    if(g.top<p.top-1.5||g.bottom>p.bottom+1.5)clips.push(item);
    if(lastTop!==null)maxDown=Math.max(maxDown,p.top-lastTop);lastTop=p.top;samples.push(item);
   }
   function watch(){if(!monitor)return;sample();requestAnimationFrame(watch);}watch();window.__sounds.length=0;input.focus();
   for(let i=0;i<source.length-1;i++){
    input.setRangeText(source[i],input.selectionStart,input.selectionEnd,'end');
    input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:source[i]==='\n'?'insertLineBreak':'insertText',data:source[i]}));
    await frame();
    if(source[i]==='\n'||expectedRows[i+1]!==expectedRows[i])await pause(220);
   }
   await pause(500);monitor=false;
   const expected=[];for(let i=1;i<source.length;i++)if(source[i-1]==='\n'||expectedRows[i]>expectedRows[i-1])expected.push(i);
   const bells=window.__sounds.filter(x=>x.name==='bell').map(x=>x.n),returns=window.__sounds.filter(x=>x.name==='return').map(x=>x.n);
   return {chars:source.length-1,sampleCount:samples.length,maxDown,clips:clips.slice(0,12),expected,bells,returns,final:samples.at(-1)};
  });
  await page.screenshot({path:`${out}/${model}-${width}-${size}.png`,fullPage:true});
  const item={model,width,height,size,...report,errors};reports.push(item);fs.writeFileSync(out+'/report.json',JSON.stringify(reports,null,2));
  assert.deepEqual(report.clips,[],`${model}/${width}/${size}: next glyph clipped during feed`);
  assert(report.maxDown<1,`${model}: paper jumped down by ${report.maxDown}px during forward typing`);
  assert.deepEqual(report.bells,report.expected,`${model}: bell must sound exactly at a real line transition`);
  assert.deepEqual(report.returns,report.expected,`${model}: return sound must match line transitions`);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({model,width,size,chars:report.chars,frames:report.sampleCount,bells:report.bells.length,maxDown:report.maxDown,passed:true}));
  await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
