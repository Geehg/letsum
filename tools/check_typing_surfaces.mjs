import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {tmpdir} from 'node:os';import path from 'node:path';
const dir=fs.mkdtempSync(path.join(tmpdir(),'letsum-surface-check-'));
try{
 fs.copyFileSync(new URL('../html/js/vendor/three/three.module.js',import.meta.url),path.join(dir,'three.mjs'));
 const T=await import(path.join(dir,'three.mjs')),ctx={};vm.runInNewContext(fs.readFileSync(new URL('../html/js/typing-surfaces.js',import.meta.url),'utf8'),ctx);
 for(const outcome of ['error','late','success']){
  let success,error,notified=0,released=0;const texture=new T.Texture();texture.addEventListener('dispose',()=>released++);
  const Loader=class{load(url,onLoad,progress,onError){success=onLoad;error=onError;return texture;}};
  const root=new T.Group(),material=new T.MeshPhysicalMaterial();material.name='Hermes_Sage_Enamel';const mesh=new T.Mesh(new T.BoxGeometry(.2,.1,.2),material);root.add(mesh);
  const result=ctx.LSApplyTypewriterSurfaces({...T,TextureLoader:Loader},root,'hermes3000',{onLoad:()=>notified++});
  if(outcome==='error'){error();assert.equal(await result.ready,false);assert(mesh.material.bumpMap.isDataTexture,'failed image keeps a neutral material');assert.equal(notified,1);}
  if(outcome==='late'){result.dispose();success(texture);assert.equal(await result.ready,false);assert.equal(notified,0,'late image cannot wake a disposed scene');assert(released>0);}
  if(outcome==='success'){success(texture);assert.equal(await result.ready,true);assert.equal(mesh.material.bumpMap,texture);assert.equal(notified,1);}
  result.dispose();mesh.geometry.dispose();mesh.material.dispose();
 }
 console.log('Surface image success, failure fallback and disposed-scene completion: passed');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
