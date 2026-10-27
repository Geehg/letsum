/* Photo-derived Lettera appearance, driven by the existing typing/paper rig.
   The retained rig is invisible; the reference's embedded PBR maps are preserved. */
globalThis.LSAttachLetteraReference=function(T,scene,rig,model,nodes,{anisotropy=1}={}){
 const carriage=model.getObjectByName('Carriage');
 if(!carriage||!model.getObjectByName('Platen'))throw new Error('Lettera reference carriage missing');
 const root=new T.Group();root.name='Lettera_Reference_Integrated';root.scale.setScalar(1.22);root.position.z=-.02656;root.add(model);scene.add(root);
 rig.traverse(o=>{if(o.isMesh&&o!==nodes.Paper){o.visible=false;o.castShadow=false;}});
 const keys=[],rotors=[],bars=[],guides=[],interiorMaterials=new Map();
 model.updateMatrixWorld(true);
 model.traverse(o=>{
  if(o.userData.key_code)keys.push({object:o,rest:o.position.clone(),driver:nodes['Key_'+o.userData.key_code]});
  if(o.isMesh){o.castShadow=!/Legend|Scale_tick|Card_graduation|Card_holder/.test(o.name);o.receiveShadow=true;
   for(const m of Array.isArray(o.material)?o.material:[o.material]){m.envMapIntensity=m.metalness>.8?1.22:.72;for(const slot of ['map','normalMap','roughnessMap','metalnessMap'])if(m[slot])m[slot].anisotropy=anisotropy;}
  }
   // Interior surfaces receive little reflected room light. Clone by role so
   // the carriage/lever chrome and exterior enamel retain their own finish.
   const role=o.name==='Key_well_metal'?'bed':/^(Typebar_|Type_slug_|Type_guide|Stem_|Segment_arc|Ribbon_spool)/.test(o.name)?'mechanism':null;
   if(role){
    const source=o.material,key=source.uuid+':'+role;
    if(!interiorMaterials.has(key)){
     const m=source.clone();m.name=source.name+' — recessed '+role;
     if(role==='bed'){m.color.setRGB(.026,.033,.030);m.metalness=.28;m.roughness=.65;m.envMapIntensity=.16;}
     else {m.color.multiplyScalar(.45);m.roughness=Math.max(m.roughness,.46);m.envMapIntensity=.30;}
     if('clearcoat' in m)m.clearcoat=0;
     interiorMaterials.set(key,m);
    }
    o.material=interiorMaterials.get(key);
   }
  if(/^(Platen$|Platen_knob)/.test(o.name))rotors.push({object:o,rest:o.quaternion.clone()});
  if(/^Type_guide/.test(o.name))guides.push({object:o,y:o.position.y});
 });
 // Reference bars and slugs rotate together around their authored segment end.
 for(let i=0;i<45;i++){
  const suffix=String(i).padStart(2,'0'),bar=model.getObjectByName('Typebar_'+suffix),slug=model.getObjectByName('Type_slug_'+suffix);
  if(!bar||!slug)continue;
  const a=-1.30+i*2.60/44,pivot=new T.Group();pivot.name='Reference_Strike_'+suffix;
  pivot.position.set(Math.sin(a)*.108,.084,-(.100-Math.cos(a)*.108*.70));model.add(pivot);model.updateMatrixWorld(true);pivot.attach(bar);pivot.attach(slug);
  const from=new T.Vector3(Math.sin(a)*.030,.093,-(.100-Math.cos(a)*.030*.70)).sub(pivot.position).normalize();
  const to=new T.Vector3(0,.153,-.111).sub(pivot.position).normalize();
  bars.push({object:pivot,target:new T.Quaternion().setFromUnitVectors(from,to),driver:nodes['Typebar_'+suffix]||nodes['Typebar_'+i]});
 }
 const lever=model.getObjectByName('Carriage_return_assembly'),leverPivot=new T.Group();leverPivot.name='Reference_Return_Pivot';leverPivot.position.set(-.164,.149,-.127);carriage.add(leverPivot);model.updateMatrixWorld(true);if(lever)leverPivot.attach(lever);
 const identity=new T.Quaternion(),axis=new T.Vector3(0,1,0),rotation=new T.Quaternion();
 return {sync({currentX,angle,leverPull,lift}){
  carriage.position.x=currentX/1.22;
  for(const k of keys)k.object.position.y=k.rest.y+(k.driver?(k.driver.position.y-k.driver.userData.rest.y)/1.22:0);
  for(const r of rotors)r.object.quaternion.copy(r.rest).multiply(rotation.setFromAxisAngle(axis,angle));
  leverPivot.rotation.x=-.34*leverPull;
  for(const b of bars){const d=b.driver,den=d?.userData.rest.angleTo(d.userData.strike)||1,t=d?Math.min(1,d.userData.rest.angleTo(d.quaternion)/den):0;b.object.quaternion.slerpQuaternions(identity,b.target,t);}
  for(const g of guides)g.object.position.y=g.y+lift*.005;
 }};
};
