/* Photo-derived Olympia appearance, driven by the existing typing/paper rig.
   The retained rig is invisible; the reference's embedded PBR maps are preserved. */
globalThis.LSAttachOlympiaReference=function(T,scene,rig,model,nodes,{anisotropy=1}={}){
 const carriage=model.getObjectByName('Carriage');
 if(!carriage||!model.getObjectByName('Platen'))throw new Error('Olympia reference carriage missing');
 const root=new T.Group();root.name='Olympia_Reference_Integrated';root.scale.setScalar(1.1);root.position.z=-.0388;root.add(model);scene.add(root);
 rig.traverse(o=>{if(o.isMesh&&o!==nodes.Paper){o.visible=false;o.castShadow=false;}});
 const keys=[],rotors=[],bars=[],guides=[],interiorMaterials=new Map();
 model.updateMatrixWorld(true);
 model.traverse(o=>{
  if(o.userData.key_code)keys.push({object:o,rest:o.position.clone(),driver:nodes['Key_'+o.userData.key_code]});
  if(o.isMesh){o.castShadow=!/Legend|Scale_tick|Card_graduation|Card_holder/.test(o.name);o.receiveShadow=o.name!=='Reference_emblem';if(o.name==='Reference_emblem'){o.castShadow=false;o.material.alphaTest=.35;o.material.depthWrite=false;o.material.polygonOffset=true;o.material.polygonOffsetFactor=-1;o.material.polygonOffsetUnits=-1;}
   for(const m of Array.isArray(o.material)?o.material:[o.material]){m.envMapIntensity=m.name.includes('moulded keys')?.30:m.metalness>.8?.65:.55;for(const slot of ['map','normalMap','roughnessMap','metalnessMap'])if(m[slot])m[slot].anisotropy=anisotropy;}
  }
  if(/^(Platen$|Platen_knob)/.test(o.name))rotors.push({object:o,rest:o.quaternion.clone()});
  if(/^Type_guide/.test(o.name))guides.push({object:o,y:o.position.y});
 });
 // Reference bars and slugs rotate together around their authored segment end.
 for(let i=0;i<45;i++){
  const suffix=String(i).padStart(2,'0'),bar=model.getObjectByName('Typebar_'+suffix),slug=model.getObjectByName('Type_slug_'+suffix);
  if(!bar||!slug)continue;
  const a=-1.30+i*2.60/44,pivot=new T.Group();pivot.name='Reference_Strike_'+suffix;
  pivot.position.set(Math.sin(a)*.108,.104,-(.100-Math.cos(a)*.108*.70));model.add(pivot);model.updateMatrixWorld(true);pivot.attach(bar);pivot.attach(slug);
  const from=new T.Vector3(Math.sin(a)*.030,.118,-(.100-Math.cos(a)*.030*.70)).sub(pivot.position).normalize();
  const to=new T.Vector3(0,.153,-.111).sub(pivot.position).normalize();
  bars.push({object:pivot,target:new T.Quaternion().setFromUnitVectors(from,to),driver:nodes['Typebar_'+suffix]||nodes['Typebar_'+i]});
 }
 const lever=model.getObjectByName('Carriage_return_assembly'),leverPivot=new T.Group();leverPivot.name='Reference_Return_Pivot';leverPivot.position.set(-.164,.149,-.127);carriage.add(leverPivot);model.updateMatrixWorld(true);if(lever)leverPivot.attach(lever);
 const identity=new T.Quaternion(),axis=new T.Vector3(0,1,0),rotation=new T.Quaternion();
 return {sync({currentX,angle,leverPull,lift,shiftLift=0}){
  carriage.position.x=currentX/1.1;carriage.position.y=shiftLift/1.1;
  for(const k of keys)k.object.position.y=k.rest.y+(k.driver?(k.driver.position.y-k.driver.userData.rest.y)/1.1:0);
  for(const r of rotors)r.object.quaternion.copy(r.rest).multiply(rotation.setFromAxisAngle(axis,angle));
  leverPivot.rotation.x=-.34*leverPull;
  for(const b of bars){const d=b.driver,den=d?.userData.rest.angleTo(d.userData.strike)||1,t=d?Math.min(1,d.userData.rest.angleTo(d.quaternion)/den):0;b.object.quaternion.slerpQuaternions(identity,b.target,t);}
  for(const g of guides)g.object.position.y=g.y+lift*.005;
 }};
};
