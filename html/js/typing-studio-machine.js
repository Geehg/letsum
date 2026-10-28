/* Articulated studio instrument. The paper belongs to the moving carriage. */
globalThis.LSCreateStudioMachine=async function(host,art){
 const T=await import('./vendor/three/three.module.js');
 const {GLTFLoader}=await import('./vendor/three/GLTFLoader.js');
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputEncoding=T.sRGBEncoding;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;renderer.localClippingEnabled=true;
 host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','부품이 움직이는 3D 타자기');
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-.3,.3,.5,-.1,.01,5);
 camera.position.set(0,.64,1.2);camera.lookAt(0,.24,0);
 const room=new T.Scene();room.background=new T.Color(.008,.009,.008);
 for(const [x,y,z,w,h,k] of [[-.5,.7,.5,.4,.85,5],[.6,.4,.2,.12,.7,2],[0,.8,-.4,.8,.12,4]]){
  const m=new T.MeshBasicMaterial({color:0xffffff});m.color.multiplyScalar(k);const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(x,y,z);o.lookAt(0,.1,0);room.add(o);
 }
 const gen=new T.PMREMGenerator(renderer),env=gen.fromScene(room,.04);gen.dispose();scene.environment=env.texture;
 room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 scene.add(new T.HemisphereLight(0xfff9ec,0x303a30,.16));
 const light=new T.DirectionalLight(0xfff4df,1.45);light.position.set(-.45,.85,.55);light.target.position.set(0,.07,0);scene.add(light,light.target);
 light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-.55,right:.55,top:.50,bottom:-.50,near:.05,far:2.5});light.shadow.bias=-.00004;light.shadow.normalBias=.0003;light.shadow.radius=5;light.shadow.blurSamples=8;
 const fill=new T.DirectionalLight(0xdbe8f4,.22);fill.position.set(.5,.3,-.35);scene.add(fill);
 const floor=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShadowMaterial({opacity:.23}));floor.rotation.x=-Math.PI/2;floor.position.y=.001;floor.receiveShadow=true;scene.add(floor);
 // Soft contact occlusion anchors the feet; the directional shadow follows moving parts.
 const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;
 const cc=contactCanvas.getContext('2d'),gradient=cc.createRadialGradient(64,64,12,64,64,64);gradient.addColorStop(0,'rgba(31,26,19,.26)');gradient.addColorStop(.55,'rgba(31,26,19,.14)');gradient.addColorStop(1,'rgba(31,26,19,0)');cc.fillStyle=gradient;cc.fillRect(0,0,128,128);
 const contactTexture=new T.CanvasTexture(contactCanvas),contact=new T.Mesh(new T.PlaneGeometry(.43,.33),new T.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,toneMapped:false}));contact.rotation.x=-Math.PI/2;contact.position.set(0,.0015,.01);scene.add(contact);
 const texture=new T.CanvasTexture(art);texture.encoding=T.sRGBEncoding;
 const paper=new T.Mesh(new T.PlaneGeometry(.224,.317),new T.MeshStandardMaterial({map:texture,roughness:.93,side:T.DoubleSide,clippingPlanes:[new T.Plane(new T.Vector3(0,1,0),-.153)]}));
 let fitWidth=.68,fitCenter=0;
 let model,carriage,lever,keys=[],bars=[],guides=[],ribbons=[],rotors=[],token=0,raf=0,until=0,last=0,targetX=0,x=0,row=0,rows=120,feed=.025,targetFeed=.025,returnAt=-1e6,hitAt=-1e6,hitKey=null,hitBar=null,full=false;
 const rest=new T.Quaternion(),axis=new T.Vector3(0,1,0),q=new T.Quaternion();
 function resize(){const w=host.clientWidth||480,h=host.clientHeight||600;renderer.setSize(w,h,false);const span=Math.max(.57,fitWidth*h/w);camera.left=fitCenter-span*w/h/2;camera.right=fitCenter+span*w/h/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();wake();}
 const observer=new ResizeObserver(resize);observer.observe(host);
 function wake(){texture.needsUpdate=true;until=performance.now()+600;if(!raf)raf=requestAnimationFrame(frame);}
 function frame(now){raf=0;const dt=Math.min(.05,(now-(last||now))/1000);last=now;
  const returning=now-returnAt<550; x+=(targetX-x)*(1-Math.exp(-dt*(returning?10:38)));feed+=(targetFeed-feed)*(1-Math.exp(-dt*22));
  if(carriage)carriage.position.x=x;
  const age=now-hitAt,s=age>=0&&age<130?Math.sin(Math.PI*age/130):0;
  for(const k of keys)k.o.position.y=k.y-(k===hitKey?s*.004:0);
  for(const b of bars)b.o.quaternion.slerpQuaternions(rest,b.target,b===hitBar?s:0);
  for(const g of guides)g.o.position.y=g.y+s*.004;
  for(const r of ribbons){const p=r.o.geometry.attributes.position;for(let i=0;i<p.count;i++){const dx=r.base[i*3];p.setY(i,r.base[i*3+1]+s*.004*Math.max(0,1-Math.abs(dx)/.04));}p.needsUpdate=true;}
  for(const r of rotors)r.o.quaternion.copy(r.q).multiply(q.setFromAxisAngle(axis,-feed/.018));
  if(lever){const t=(now-returnAt)/500;lever.rotation.x=t>=0&&t<1?-.42*Math.sin(Math.PI*t):0;}
  paper.position.set(0,.153+feed-.317/2,-.139);renderer.render(scene,camera);
  if(now<until)raf=requestAnimationFrame(frame);
 }
 function disposeModel(root){if(!root)return;root.remove(paper);root.traverse(o=>{o.geometry?.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){for(const slot of ['map','normalMap','roughnessMap','metalnessMap'])m[slot]?.dispose();m.dispose();}});}
 async function load(id){const mine=++token;host.dataset.ready='loading';const asset=await new GLTFLoader().loadAsync(`/img/typewriters/reference/${id}-reference.glb?v=5`);
  if(mine!==token){disposeModel(asset.scene);return;}if(model){paper.parent?.remove(paper);scene.remove(model);disposeModel(model);}model=asset.scene;scene.add(model);keys=[];bars=[];guides=[];ribbons=[];rotors=[];
  const materials=new Map();const materialFor=(m,tune)=>{if(!materials.has(m))materials.set(m,tune(m));return materials.get(m);};
  model.traverse(o=>{if(o.userData.key_code)keys.push({o,y:o.position.y,code:o.userData.key_code});
   if(o.isMesh){
    o.castShadow=!/Legend|Scale_tick|Card_graduation|Reference_emblem|Transparent/.test(o.name);o.receiveShadow=true;
    const tune=source=>{const m=source.clone(),name=m.name.toLowerCase();
     m.envMapIntensity=m.metalness>.8?1.05:.60;
     if(/mechanism|felt/.test(name)){m.envMapIntensity=.22;m.color.multiplyScalar(.70);}
     if(/nickel|chrome/.test(name)){m.color.multiplyScalar(.78);m.roughness=Math.max(.18,m.roughness||.2);}
     if(/moulded keys/.test(name)){m.envMapIntensity=.48;if(!m.roughnessMap)m.roughness=.28;}
     for(const slot of ['map','normalMap','roughnessMap','metalnessMap'])if(m[slot])m[slot].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
     return m;};
    // Clone by material once: retain the authored crinkle/paint/keys texture maps.
    o.material=Array.isArray(o.material)?o.material.map(m=>materialFor(m,tune)):materialFor(o.material,tune);
   }
   if(/^Type_guide/.test(o.name))guides.push({o,y:o.position.y});
   if(/^Ribbon_(Red|Black)/.test(o.name)){o.geometry=o.geometry.clone();ribbons.push({o,base:o.geometry.attributes.position.array.slice()});}
   if(/^(Platen$|Platen_knob)/.test(o.name))rotors.push({o,q:o.quaternion.clone()});
  });
  if(id==='olympiasm3'){const bed=new T.Mesh(new T.BoxGeometry(.278,.002,.155),new T.MeshStandardMaterial({color:0x111713,roughness:.94,metalness:0}));bed.name='Studio_recess_shadow_bed';bed.position.set(0,.025,.077);bed.receiveShadow=true;model.add(bed);}
  carriage=model.getObjectByName('Carriage');if(!carriage)throw Error('Carriage missing');carriage.add(paper);
  const assembly=model.getObjectByName('Carriage_return_assembly');lever=new T.Group();lever.position.set(-.164,.149,-.127);carriage.add(lever);model.updateMatrixWorld(true);if(assembly)lever.attach(assembly);
  for(let i=0;i<45;i++){const suffix=String(i).padStart(2,'0'),bar=model.getObjectByName('Typebar_'+suffix),slug=model.getObjectByName('Type_slug_'+suffix);if(!bar||!slug)continue;
   const a=-1.3+i*2.6/44,high=id==='olympiasm3',pivot=new T.Group();pivot.position.set(Math.sin(a)*.108,high?.104:.084,-(.1-Math.cos(a)*.108*.7));model.add(pivot);model.updateMatrixWorld(true);pivot.attach(bar);pivot.attach(slug);
   const from=new T.Vector3(Math.sin(a)*.03,high?.118:.094,-(.1-Math.cos(a)*.03*.7)).sub(pivot.position).normalize(),to=new T.Vector3(0,.153,-.111).sub(pivot.position).normalize();bars.push({o:pivot,target:new T.Quaternion().setFromUnitVectors(from,to)});
  }
  // Fit the union of both carriage limits and the full lever sweep, not just the idle body.
  paper.parent.remove(paper);const sweep=new T.Box3();
  for(const travel of [-.101,.101])for(const pull of [0,-.21,-.42]){carriage.position.x=travel;lever.rotation.x=pull;model.updateMatrixWorld(true);sweep.union(new T.Box3().setFromObject(model));}
  fitWidth=sweep.max.x-sweep.min.x+.06;fitCenter=(sweep.min.x+sweep.max.x)/2;carriage.add(paper);carriage.position.x=0;lever.rotation.x=0;
  host.dataset.framing='full-carriage-travel';
  reset();host.dataset.ready='true';resize();
 }
 function reset(){targetX=x=0;targetFeed=feed=.025;row=0;full=false;hitAt=returnAt=-1e6;hitKey=hitBar=null;wake();}
 function position(col,line,count){rows=count;row=line;targetX=(.5-col)*.202;targetFeed=full?.317:.025+row/rows*.296;wake();}
 function hit(g){const code=/[a-z]/i.test(g)?'Key'+g.toUpperCase():/\d/.test(g)?'Digit'+g:g;hitKey=keys.find(k=>k.code===code)||keys[g.charCodeAt(0)%keys.length];hitBar=bars[g.charCodeAt(0)%bars.length];hitAt=performance.now();wake();}
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();host.dataset.ready='error';host.dispatchEvent(new Event('machineerror'));});
 return {load,reset,position,hit,returnCarriage(){returnAt=performance.now();wake();},finish(){full=true;targetX=0;targetFeed=.317;wake();},refresh:wake,dispose(){token++;observer.disconnect();cancelAnimationFrame(raf);paper.parent?.remove(paper);disposeModel(model);paper.geometry.dispose();paper.material.dispose();texture.dispose();env.dispose();floor.geometry.dispose();floor.material.dispose();contact.geometry.dispose();contact.material.dispose();contactTexture.dispose();light.shadow.map?.dispose();light.shadow.mapPass?.dispose();renderer.dispose();renderer.domElement.remove();}};
}
