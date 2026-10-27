/* Model-specific authored surface maps. See docs/TYPEWRITER_SURFACES.md.
 * Rest-space triplanar mapping keeps the grain scale continuous across folded
 * shells and attached to moving keys. The images encode relief, never lighting. */
globalThis.LSApplyTypewriterSurfaces=function(T,root,model,{anisotropy=1,onLoad=()=>{}}={}){
 const profiles={
  hermes3000:{tile:.120,depth:.00008,variation:.065,roughness:.22,coat:.58,coatRoughness:.16},
  lettera32:{tile:.120,depth:.000025,variation:.055,roughness:.23,coat:.60,coatRoughness:.16},
  olympiasm3:{tile:.120,depth:.00019,variation:.10,roughness:.69,coat:.035,coatRoughness:.58}
 };
 const profile=profiles[model];if(!profile)return {dispose(){},ready:Promise.resolve(false)};
 let disposed=false,loadedTexture;
 const neutral=new T.DataTexture(new Uint8Array([128,128,128,255]),1,1,T.RGBAFormat);neutral.needsUpdate=true;
 const mapUniform={value:neutral},materials=new Map(),oldTextures=new Set(),retiredGeometries=new Set();
 root.updateMatrixWorld(true);
 function attach(mesh,kind){
  const old=mesh.material;
  if(!materials.has(old)){
   const m=old.clone();materials.set(old,m);
   // Generated relief replaces arbitrary per-UV noise on paint and resin.
   if(kind==='paint'){for(const name of ['map','roughnessMap','bumpMap']){if(m[name])oldTextures.add(m[name]);m[name]=null;}
    m.roughness=profile.roughness;m.clearcoat=profile.coat;m.clearcoatRoughness=profile.coatRoughness;m.metalness=.02;
   }else if(m.bumpMap){oldTextures.add(m.bumpMap);m.bumpMap=null;}
   if(kind==='metal'){
    const polished=/Nickel|Chrome|Badge|Knob_Rim/.test(old.name||'');
    m.color.setRGB(polished?.27:.20,polished?.29:.22,polished?.31:.24);
    m.metalness=1;m.roughness=polished?.115:.27;m.envMapIntensity=polished?1.12:.82;
    if(m.isMeshPhysicalMaterial){m.clearcoat=0;m.clearcoatRoughness=.2;}
   }
   m.bumpMap=neutral;m.bumpScale=kind==='paint'?profile.depth:kind==='keys'?.000003:.000001;
   const tile=kind==='paint'?profile.tile:kind==='keys'?.035:.070;
   const variation=kind==='paint'?profile.variation:kind==='keys'?.035:.025;
   m.userData.surface={model,kind,tile,depth:m.bumpScale};
   m.onBeforeCompile=shader=>{
    shader.uniforms.surfaceMap=mapUniform;
    shader.uniforms.surfaceTile={value:tile};shader.uniforms.surfaceVariation={value:variation};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute vec3 surfacePosition;
attribute vec3 surfaceNormal;
varying vec3 vSurfacePosition;
varying vec3 vSurfaceNormal;`)
     .replace('#include <begin_vertex>',`#include <begin_vertex>
vSurfacePosition=surfacePosition;vSurfaceNormal=surfaceNormal;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D surfaceMap;
uniform float surfaceTile;
uniform float surfaceVariation;
varying vec3 vSurfacePosition;
varying vec3 vSurfaceNormal;
float surfaceHeight(vec3 p){
 vec3 w=pow(abs(normalize(vSurfaceNormal)),vec3(4.0));w/=max(dot(w,vec3(1.0)),0.00001);
 return dot(vec3(texture2D(surfaceMap,p.yz/surfaceTile).r,texture2D(surfaceMap,p.xz/surfaceTile).r,texture2D(surfaceMap,p.xy/surfaceTile).r),w);
}`)
     .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
float surfaceRelief=surfaceHeight(vSurfacePosition);
roughnessFactor=clamp(roughnessFactor+(surfaceRelief-.5)*surfaceVariation,.08,.92);
${kind==='keys'?'roughnessFactor=mix(roughnessFactor,roughnessFactor*.76,smoothstep(.45,.95,normalize(vSurfaceNormal).y));':''}`)
     .replace('#include <normal_fragment_maps>',`// Same relief field on every face, without a stretched UV pole.
normal=perturbNormalArb(-vViewPosition,normal,bumpScale*vec2(dFdx(surfaceRelief),dFdy(surfaceRelief)),faceDirection);`);
   };
   m.customProgramCacheKey=()=>`typewriter-surface-v1-${model}-${kind}`;
   m.needsUpdate=true;
  }
  mesh.material=materials.get(old);
  // Bake only lookup coordinates, never positions or normals used by animation.
  retiredGeometries.add(mesh.geometry);
  const g=mesh.geometry.clone(),p=g.attributes.position,n=g.attributes.normal;
  const pos=new Float32Array(p.count*3),norm=new Float32Array(p.count*3),normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld),v=new T.Vector3();
  for(let i=0;i<p.count;i++){
   v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray(pos,i*3);
   v.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize().toArray(norm,i*3);
  }
  g.setAttribute('surfacePosition',new T.BufferAttribute(pos,3));g.setAttribute('surfaceNormal',new T.BufferAttribute(norm,3));mesh.geometry=g;
 }
 root.traverse(o=>{
  if(!o.isMesh||!o.geometry?.attributes.normal||Array.isArray(o.material))return;
  const name=o.material.name||'';
  if(/^(Hermes_Sage_Enamel|Lettera_Blue_Enamel|Olympia_Crinkle_Enamel)$/.test(name))attach(o,'paint');
  else if(/^Cap_/.test(o.name))attach(o,'keys');
  else if(o.material.metalness>=.65&&!o.material.map)attach(o,'metal');
 });
 const ready=new Promise(resolve=>{
  loadedTexture=new T.TextureLoader().load(`/img/typewriters/surfaces/${model}-relief-v1.webp`,texture=>{
   if(disposed){texture.dispose();resolve(false);return;}
   texture.encoding=T.LinearEncoding;texture.wrapS=texture.wrapT=T.MirroredRepeatWrapping;
   texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=true;
   texture.anisotropy=Math.min(4,anisotropy);texture.needsUpdate=true;
   mapUniform.value=texture;for(const m of materials.values())m.bumpMap=texture;
   onLoad();resolve(true);
  },undefined,()=>{if(!disposed)onLoad();resolve(false);});
 });
 // Failure keeps a neutral, usable material and does not block the writing UI.
 return {ready,dispose(){disposed=true;neutral.dispose();loadedTexture?.dispose();oldTextures.forEach(t=>t.dispose());retiredGeometries.forEach(g=>g.dispose());materials.forEach((m,old)=>old.dispose());}};
};
