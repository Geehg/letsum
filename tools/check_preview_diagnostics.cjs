const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..')+'/';
(async()=>{
 const code=fs.readFileSync(root+'worker/src/preview-diagnostics.js','utf8');
 const {normalizeDiagnostic}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const d=normalizeDiagnostic('Mozilla Android Mobile Chrome/130.0 Safari',{version:1,weight:700,reason:'http-4xx',error:'private input https://secret'});
 assert.deepEqual(d,{weight:700,reason:'http-4xx',error:'unknown',browser:'Chrome',device:'mobile',os:'Android'});
 assert.equal(normalizeDiagnostic('Safari',null),null);
 assert.equal(normalizeDiagnostic('Safari',{version:2}),null);
 const source=fs.readFileSync(root+'html/js/main.js','utf8');
 const segment=source.slice(source.indexOf('  async function loadFace(e)'),source.indexOf('  function pumpFaces()'));
 for(const scenario of ['retry-success','http-failure','offline','private']){
  let attempts=0,events=[],done,probes=0;
  const context={setTimeout,clearTimeout,AbortController,Number,Promise,noTrack:scenario==='private',navigator:{onLine:scenario!=='offline'},faceState:{f:'wait'},markFace(){},shownW(){return 700},trimFaces(){},fmtOf(){return 'woff2'},document:{fonts:{add(){},delete(){}}},ev(...a){events.push(a)},fetch:async()=>{probes++;return {ok:false,status:404}},FontFace:class {async load(){attempts++;if(scenario==='retry-success'&&attempts===2)return;throw Object.assign(new Error('secret URL'),{name:'NetworkError'})}}};
  vm.createContext(context);vm.runInContext(segment,context);
  await context.loadFace({f:{id:'f',family:'LS f',webfont:{700:'https://example.invalid/f.woff2'}},w:700,resolve(x){done=x}});
  await new Promise(r=>setImmediate(r));
  assert.equal(attempts,2);
  if(scenario==='retry-success'){assert.equal(done,true);assert.equal(events.length,0)}
  else if(scenario==='private'){assert.equal(events.length,0);assert.equal(probes,0)}
  else {assert.equal(done,false);assert.equal(events.length,1);assert.equal(events[0][2].reason,scenario==='offline'?'offline':'http-4xx');assert(!JSON.stringify(events).includes('secret'))}
 }
 console.log('PASS: retry recovery, final failure classification, offline, privacy opt-out, metadata sanitization');
})().catch(e=>{console.error(e);process.exit(1)});
