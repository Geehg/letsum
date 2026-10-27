import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {tmpdir} from 'node:os';import path from 'node:path';
const dir=fs.mkdtempSync(path.join(tmpdir(),'letsum-badge-check-'));
try{
 fs.copyFileSync(new URL('../html/js/vendor/three/three.module.js',import.meta.url),path.join(dir,'three.mjs'));
 const T=await import(path.join(dir,'three.mjs')),ctx={};vm.runInNewContext(fs.readFileSync(new URL('../html/js/typing-badges.js',import.meta.url),'utf8'),ctx);
 for(const outcome of ['error','late','success']){
  let success,error,wakes=0,disposed=0;const texture=new T.Texture();texture.addEventListener('dispose',()=>disposed++);
  const Loader=class{load(url,onLoad,progress,onError){assert(url.endsWith('hermes3000-v1.png'));success=onLoad;error=onError;return texture;}};
  const root=new T.Group(),old=['Badge_Frame','Badge_Inlay','Hermes_Badge'].map(name=>{const o=new T.Group();o.name=name;root.add(o);return o;});
  const result=ctx.LSApplyTypewriterBadges({...T,TextureLoader:Loader},root,'hermes3000',{onLoad:()=>wakes++});
  assert(old.every(o=>o.visible)&&!result.mesh.visible,'existing mark stays until image is ready');
  if(outcome==='error'){error();assert.equal(await result.ready,false);assert(old.every(o=>o.visible));assert(!result.mesh.visible);}
  if(outcome==='late'){result.dispose();success(texture);assert.equal(await result.ready,false);assert.equal(wakes,0);assert(disposed>0);assert(!root.getObjectByName('Reference_Emblem'));}
  if(outcome==='success'){success(texture);assert.equal(await result.ready,true);assert(old.every(o=>!o.visible));assert(result.mesh.visible);assert.equal(texture.encoding,T.sRGBEncoding);assert(texture.repeat.x<1&&texture.repeat.y<1,'transparent padding cropped in UVs, source alpha retained');}
  result.dispose();result.dispose();assert(old.every(o=>o.visible));assert(!root.getObjectByName('Reference_Emblem'));
 }
 console.log('Emblem success, failed download, late completion and disposal: passed');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
