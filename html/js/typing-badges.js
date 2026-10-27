/* Reference-based transparent emblem images. Originals remain as load-failure fallbacks. */
(() => {
 'use strict';
 const specs={
  hermes3000:{box:[32,193,2141,515],width:.112,anchor:'Badge_Frame',hide:['Badge_Frame','Badge_Inlay','Hermes_Badge']},
  lettera32:{box:[53,232,2127,486],width:.097,anchor:'Lettera_Split_Badge',hide:['Lettera_Split_Badge']},
  olympiasm3:{box:[44,88,2136,637],width:.090,hide:['Olympia_Script_Badge']}
 };
 globalThis.LSApplyTypewriterBadges=function(T,root,model,{anisotropy=1,onLoad=()=>{}}={}){
  const spec=specs[model];if(!spec)return null;
  const old=spec.hide.map(n=>root.getObjectByName(n)).filter(Boolean),visibility=old.map(o=>o.visible);
  const [x0,y0,x1,y1]=spec.box,height=spec.width*(y1-y0)/(x1-x0);
  const geometry=new T.PlaneGeometry(spec.width,height,model==='olympiasm3'?64:1,model==='olympiasm3'?16:1);
  // The generated asset already carries its engraved/printed colour and bevel.
  // Modest physical reflections keep it attached to the scene without washing out the lettering.
  const material=new T.MeshStandardMaterial({name:'Reference_Emblem_'+model,color:0xffffff,transparent:true,alphaTest:.06,depthWrite:false,roughness:.40,metalness:.12,envMapIntensity:.25,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const mesh=new T.Mesh(geometry,material);mesh.name='Reference_Emblem';mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=true;
  if(spec.anchor){
   const anchor=root.getObjectByName(spec.anchor);mesh.position.copy(anchor.position);mesh.quaternion.copy(anchor.quaternion);
   mesh.position.add(new T.Vector3(0,0,.0016).applyQuaternion(mesh.quaternion));anchor.parent.add(mesh);
  }else{
   // Sample the real lid so the transparent script follows its crown, rather than hovering on a flat rectangle.
   root.updateMatrixWorld(true);const hood=root.getObjectByName('Ribbon_Hood'),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0).transformDirection(root.matrixWorld);
   const hit=(x,z)=>{ray.set(root.localToWorld(new T.Vector3(x,1,z)),down);const result=ray.intersectObject(hood,false)[0];if(!result)throw new Error('Emblem outside Olympia lid');return root.worldToLocal(result.point.clone());};
   const cx=.159,cz=-.044,slope=(hit(cx,cz+.0001).y-hit(cx,cz-.0001).y)/.0002,stretch=Math.sqrt(1+slope*slope),p=geometry.attributes.position;
   for(let i=0;i<p.count;i++){const x=cx+p.getX(i),z=cz-p.getY(i)/stretch,v=hit(x,z);p.setXYZ(i,v.x,v.y+.00065,v.z);}
   p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();root.add(mesh);
  }
  let disposed=false,texture;
  const ready=new Promise(resolve=>{
   texture=new T.TextureLoader().load('/img/typewriters/badges/'+model+'-v1.png',loaded=>{
    if(disposed){loaded.dispose();resolve(false);return;}
    loaded.encoding=T.sRGBEncoding;loaded.anisotropy=anisotropy;loaded.wrapS=loaded.wrapT=T.ClampToEdgeWrapping;
    loaded.offset.set(x0/2172,1-y1/724);loaded.repeat.set((x1-x0)/2172,(y1-y0)/724);loaded.needsUpdate=true;
    material.map=loaded;material.needsUpdate=true;old.forEach(o=>o.visible=false);mesh.visible=true;onLoad();resolve(true);
   },undefined,()=>{if(!disposed)onLoad();resolve(false);});
  });
  return {ready,mesh,dispose(){if(disposed)return;disposed=true;mesh.parent?.remove(mesh);geometry.dispose();material.dispose();texture?.dispose();old.forEach((o,i)=>o.visible=visibility[i]);}};
 };
})();
