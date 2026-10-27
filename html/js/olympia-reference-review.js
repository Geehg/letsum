(async () => {
const T=await import('./vendor/three/three.module.js');
const {GLTFLoader}=await import('./vendor/three/GLTFLoader.js');
const host=document.getElementById('viewport'),status=document.getElementById('status');
let renderer;
try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch(e){status.textContent='3D를 표시할 수 없습니다. WebGL 지원 브라우저에서 다시 열어 주세요.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;host.appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#e6e1d7');
const camera=new T.PerspectiveCamera(34,1,.01,10),target=new T.Vector3(0,.078,0);
const room=new T.Scene();room.background=new T.Color(.008,.009,.008);
for(const [p,s,k] of [[[-.45,.8,-.55],[.65,.85,.01],6],[[.65,.4,.25],[.13,.85,.01],3],[[0,.75,-.6],[.9,.10,.01],7],[[0,.35,1.2],[.8,.12,.01],1.2]]){const m=new T.MeshBasicMaterial({color:0xffffff});m.color.multiplyScalar(k);const o=new T.Mesh(new T.BoxGeometry(...s),m);o.position.set(...p);o.lookAt(0,0,0);room.add(o);}
const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(room,.02);scene.environment=env.texture;pmrem.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
scene.add(new T.HemisphereLight(0xfff9eb,0x555e52,.10));
const sun=new T.DirectionalLight(0xfff9ee,.65);sun.position.set(-.45,.8,.6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-.31,right:.31,top:.31,bottom:-.31,near:.01,far:3});sun.shadow.radius=6;sun.shadow.blurSamples=8;sun.shadow.bias=-.00008;sun.shadow.normalBias=.00015;scene.add(sun);
const fill=new T.DirectionalLight(0xe4edf2,.12);fill.position.set(.4,.3,-.3);scene.add(fill);
const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.ShadowMaterial({opacity:.09}));floor.rotation.x=-Math.PI/2;floor.position.y=.001;floor.receiveShadow=true;scene.add(floor);
const contactTarget=new T.WebGLRenderTarget(512,512),contactBlur=new T.WebGLRenderTarget(512,512);
const contactDepth=new T.MeshDepthMaterial({depthPacking:T.BasicDepthPacking});
contactDepth.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );','gl_FragColor = vec4(vec3(0.0), pow(1.0 - fragCoordZ, 2.0) * 0.65);');};
const contactCamera=new T.OrthographicCamera(-.29,.29,.24,-.24,.001,.16);contactCamera.position.set(0,0,0);contactCamera.up.set(0,0,-1);contactCamera.lookAt(0,1,0);
const contact=new T.Mesh(new T.PlaneGeometry(.58,.48),new T.MeshBasicMaterial({map:contactTarget.texture,transparent:true,depthWrite:false,toneMapped:false,opacity:.8}));contact.rotation.x=-Math.PI/2;contact.position.y=.0015;contact.scale.y=-1;scene.add(contact);
const blurScene=new T.Scene(),blurCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
const blurMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:null},step:{value:new T.Vector2()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D source;uniform vec2 step;varying vec2 vUv;void main(){vec4 c=texture2D(source,vUv)*.227027;c+=(texture2D(source,vUv+step*1.384615)+texture2D(source,vUv-step*1.384615))*.316216;c+=(texture2D(source,vUv+step*3.230769)+texture2D(source,vUv-step*3.230769))*.070270;gl_FragColor=c;}'});
const blurQuad=new T.Mesh(new T.PlaneGeometry(2,2),blurMaterial);blurScene.add(blurQuad);
function bakeContact(){
 const bg=scene.background,clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),shadow=renderer.shadowMap.enabled;
 contact.visible=floor.visible=false;scene.background=null;scene.overrideMaterial=contactDepth;renderer.shadowMap.enabled=false;renderer.setClearColor(0x000000,0);renderer.setRenderTarget(contactTarget);renderer.render(scene,contactCamera);scene.overrideMaterial=null;
 for(let i=0;i<2;i++){blurMaterial.uniforms.source.value=contactTarget.texture;blurMaterial.uniforms.step.value.set(2/512,0);renderer.setRenderTarget(contactBlur);renderer.render(blurScene,blurCamera);blurMaterial.uniforms.source.value=contactBlur.texture;blurMaterial.uniforms.step.value.set(0,2/512);renderer.setRenderTarget(contactTarget);renderer.render(blurScene,blurCamera);}
 renderer.setRenderTarget(null);renderer.setClearColor(clear,alpha);renderer.shadowMap.enabled=shadow;scene.background=bg;contact.visible=floor.visible=true;
}
let model,angle=.60,elevation=.48,distance=.64,clay=false;const originals=new Map(),keys=[],pressed=new Map(),neutral=new T.MeshStandardMaterial({color:new T.Color(.22,.24,.20),roughness:.75});
function pose(){camera.position.set(target.x+distance*Math.sin(angle)*Math.cos(elevation),target.y+distance*Math.sin(elevation),target.z+distance*Math.cos(angle)*Math.cos(elevation));camera.lookAt(target);}
function fit(){const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();distance=Math.max(.64,.28/(Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect));pose();render();}
function render(){renderer.render(scene,camera);}
new ResizeObserver(fit).observe(host);
let start=null,moved=false;
host.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,a:angle,e:elevation};moved=false;host.setPointerCapture(e.pointerId);});
host.addEventListener('pointermove',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;angle=start.a-dx*.006;elevation=Math.max(.08,Math.min(1.55,start.e+dy*.005));pose();render();});
host.addEventListener('pointerup',e=>{if(!moved&&model){const r=host.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObjects(keys,true)[0];if(hit){let o=hit.object;while(o&&!o.userData.key_code)o=o.parent;if(o)press(o);}}start=null;});
host.addEventListener('pointercancel',()=>start=null);
host.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(.38,Math.min(1.3,distance*Math.exp(e.deltaY*.001)));pose();render();},{passive:false});
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{const v={three:[.60,.48],front:[0,.46],side:[-Math.PI/2,.13],top:[0,1.55]}[b.dataset.view];[angle,elevation]=v;distance=Math.max(.64,.28/(Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect));document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));pose();render();});
document.getElementById('clay').addEventListener('click',e=>{clay=!clay;e.currentTarget.setAttribute('aria-pressed',String(clay));model?.traverse(o=>{if(o.isMesh){o.material=clay?neutral:originals.get(o);if(o.name.startsWith('Legend_')||o.name==='Reference_emblem')o.visible=!clay;}});render();});
function press(o){if(!pressed.has(o))pressed.set(o,{y:o.position.y,start:performance.now()});animate();}
let animation=0;
function animate(){if(animation)return;animation=requestAnimationFrame(t=>{animation=0;for(const[o,s]of pressed){const dt=t-s.start;o.position.y=s.y-.003*Math.sin(Math.PI*Math.min(1,dt/170));if(dt>=170){o.position.y=s.y;pressed.delete(o);}}render();if(pressed.size)animate();});}
document.getElementById('previewInput').addEventListener('keydown',e=>{const key=keys.find(o=>o.userData.key_code===e.code||o.userData.key_code===e.key);if(key)press(key);});
try{const asset=await new GLTFLoader().loadAsync('/img/typewriters/reference/olympiasm3-reference.glb?v=2');model=asset.scene;scene.add(model);model.traverse(o=>{if(o.userData.key_code)keys.push(o);if(o.isMesh){o.castShadow=!/Legend|Scale_tick|Card_graduation|Card_holder|Reference_emblem/.test(o.name);o.receiveShadow=o.name!=='Reference_emblem';if(o.name==='Reference_emblem'){o.material.alphaTest=.35;o.material.depthWrite=false;o.material.polygonOffset=true;o.material.polygonOffsetFactor=-1;o.material.polygonOffsetUnits=-1;}originals.set(o,o.material);o.material.envMapIntensity=o.material.name.includes('moulded keys')?.30:o.material.metalness>.8?.65:.55;for(const slot of ['map','normalMap','roughnessMap','metalnessMap'])if(o.material[slot])o.material[slot].anisotropy=renderer.capabilities.getMaxAnisotropy();}});bakeContact();status.textContent='실물 대조 제작본 · 로딩 완료';fit();}catch(e){status.textContent='모델 로딩 실패 · 페이지를 새로고침해 주세요.';console.error(e);}
addEventListener('pagehide',()=>{cancelAnimationFrame(animation);model?.traverse(o=>{o.geometry?.dispose();});for(const m of new Set(originals.values())){for(const k of ['map','normalMap','metalnessMap','roughnessMap'])m[k]?.dispose();m.dispose();}contactTarget.dispose();contactBlur.dispose();contactDepth.dispose();contact.geometry.dispose();contact.material.dispose();blurQuad.geometry.dispose();blurMaterial.dispose();floor.geometry.dispose();floor.material.dispose();sun.shadow.map?.dispose();sun.shadow.mapPass?.dispose();env.dispose();neutral.dispose();renderer.dispose();});

})();
