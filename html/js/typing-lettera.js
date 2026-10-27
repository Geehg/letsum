/* Lettera 32 visible-form reconstruction. Sources and adaptation limits:
 * docs/LETTERA32_MODEL.md. Dimensions below are authored scene units, not measured CAD.
 * Keep the shared 61-key input rig and paper coordinates; rebuild visible enclosure,
 * keycaps, bail, knobs and markings without scaling a Hermes shell into this model.
 */
globalThis.LSBuildLettera32 = function buildLettera32(T, root, document=globalThis.document) {
 const nodes={};root.traverse(o=>nodes[o.name]=o);
 const blue=new T.MeshPhysicalMaterial({name:'Lettera_Blue_Enamel',color:new T.Color(.20,.33,.41),metalness:.08,roughness:.20,clearcoat:.72,clearcoatRoughness:.10});
 const black=new T.MeshPhysicalMaterial({name:'Lettera_Black_Keycaps',color:new T.Color(.014,.016,.018),metalness:0,roughness:.24,clearcoat:.50,clearcoatRoughness:.16});
 const rubber=new T.MeshStandardMaterial({name:'Platen_Rubber',color:0x16191b,roughness:.75});
 const chrome=new T.MeshStandardMaterial({name:'Polished_Nickel',color:0xaeb7bb,metalness:1,roughness:.23});
 const ink=new T.MeshStandardMaterial({name:'Lettera_Legends',color:0xf3f0e7,roughness:.64});
 const dark=new T.MeshStandardMaterial({color:0x171b1e,roughness:.65});
 const linkage=new T.MeshStandardMaterial({name:'Lettera_Key_Linkage',color:0x292d2f,metalness:.78,roughness:.48});
 function replace(name,geometry,material){const o=nodes[name];o.geometry=geometry;o.material=material;o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);return o;}
 function hide(prefixes){root.traverse(o=>{if(prefixes.some(p=>o.name.startsWith(p)))o.visible=false;});}
 function rounded(x0,z0,x1,z1,r){const p=new T.Shape();p.moveTo(x0+r,z0);p.lineTo(x1-r,z0);p.quadraticCurveTo(x1,z0,x1,z0+r);p.lineTo(x1,z1-r);p.quadraticCurveTo(x1,z1,x1-r,z1);p.lineTo(x0+r,z1);p.quadraticCurveTo(x0,z1,x0,z1-r);p.lineTo(x0,z0+r);p.quadraticCurveTo(x0,z0,x0+r,z0);return p;}
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 // Closed rings: outer skirt, rounded shoulder, recessed lip and underside.
 function loft(rings,N=128,sideUV=false){
  const pos=[],uv=[],idx=[];
  // Match corresponding straight/rounded sections on every ring. Equal arc-length
  // resampling shifted the inner corners and twisted the front keyboard bezel.
  for(const r of rings){const points=r.path.curves.flatMap(c=>Array.from({length:N/8},(_,i)=>c.getPoint(i/(N/8))));
   for(let i=0;i<N;i++){const p=points[i],height=r.y(p.x,p.y);pos.push(p.x,height,p.y);uv.push(...(sideUV?[i/N*16,height*12]:[p.x*12,p.y*12]));}}

  for(let j=0;j<rings.length;j++){const next=(j+1)%rings.length;for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N,c=next*N+(i+1)%N,d=next*N+i;idx.push(a,d,b,b,d,c);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
 }
 // The rear carriage shelf is lower than the cover shoulder; the front cheeks
 // descend toward the keyboard, with continuous rolled corners at the lip.
 const rearRelief=z=>.032*(1-smooth(-.116,-.097,z));
 const bodyTop=z=>.047+.100*(1-smooth(-.12,.16,z))-rearRelief(z);
 replace('Cast_Perimeter',loft([
  {path:rounded(-.232,-.166,.232,.181,.020),y:()=>.014},
  {path:rounded(-.235,-.169,.235,.184,.021),y:()=>.018},
  {path:rounded(-.234,-.168,.234,.183,.020),y:(x,z)=>bodyTop(z)-.008},
  {path:rounded(-.232,-.166,.232,.181,.020),y:(x,z)=>bodyTop(z)-.002},
  {path:rounded(-.230,-.164,.230,.179,.019),y:(x,z)=>bodyTop(z)},
  {path:rounded(-.219,-.152,.219,.170,.013),y:(x,z)=>bodyTop(z)-.002},
  {path:rounded(-.217,-.149,.217,.168,.012),y:(x,z)=>bodyTop(z)-.007},
  {path:rounded(-.217,-.149,.217,.168,.012),y:()=>.014}
 ],384,true),blue);
 // Removable low cover: broad folded front face, flatter crown and two inner wings.
 const cover=new T.Shape();cover.moveTo(-.205,-.026);cover.lineTo(.205,-.026);cover.quadraticCurveTo(.225,-.026,.224,-.046);cover.lineTo(.208,-.133);cover.quadraticCurveTo(.205,-.151,.188,-.151);cover.lineTo(-.188,-.151);cover.quadraticCurveTo(-.205,-.151,-.208,-.133);cover.lineTo(-.224,-.046);cover.quadraticCurveTo(-.225,-.026,-.205,-.026);const hole=new T.Path();
 hole.moveTo(-.119,-.075);hole.quadraticCurveTo(-.131,-.077,-.128,-.089);hole.lineTo(-.120,-.113);
 hole.quadraticCurveTo(-.114,-.119,-.095,-.116);hole.lineTo(-.036,-.111);hole.quadraticCurveTo(-.018,-.111,-.017,-.128);
 hole.lineTo(-.015,-.148);hole.lineTo(.015,-.148);hole.lineTo(.017,-.128);hole.quadraticCurveTo(.018,-.111,.036,-.111);
 hole.lineTo(.095,-.116);hole.quadraticCurveTo(.114,-.119,.120,-.113);hole.lineTo(.128,-.089);hole.quadraticCurveTo(.131,-.077,.119,-.075);hole.lineTo(-.119,-.075);
 cover.holes.push(hole);
 const hood=new T.ExtrudeGeometry(cover,{depth:.003,steps:1,bevelEnabled:true,bevelThickness:.0010,bevelSize:.0008,bevelSegments:5,curveSegments:24});
 let dense=hood.index?hood.toNonIndexed():hood;const dp=dense.attributes.position,du=dense.attributes.uv,positions=[],uvs=[];
 // Split shared edges by the same coordinate rule on both adjoining faces.
 // Independent per-triangle subdivision left T-junctions after bending the lid.
 const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])/2);
 let faces=[];
 for(let i=0;i<dp.count;i+=3)faces.push([0,1,2].map(k=>({p:[dp.getX(i+k),dp.getY(i+k),dp.getZ(i+k)],uv:[du.getX(i+k),du.getY(i+k)]})));
 for(let pass=0;pass<8;pass++){
  let changed=false;const next=[];
  for(const [a,b,c] of faces){
   const long=(a,b)=>Math.abs(a.p[0]-b.p[0])>.028||Math.abs(a.p[1]-b.p[1])>.0035;
   const mask=(long(a,b)?1:0)|(long(b,c)?2:0)|(long(c,a)?4:0);
   if(!mask){next.push([a,b,c]);continue;}changed=true;
   const mid=(a,b)=>({p:midpoint(a.p,b.p),uv:midpoint(a.uv,b.uv)}),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
   const parts={1:[[a,ab,c],[ab,b,c]],2:[[b,bc,a],[bc,c,a]],4:[[c,ca,b],[ca,a,b]],
    3:[[b,bc,ab],[a,ab,c],[ab,bc,c]],5:[[a,ab,ca],[ab,b,c],[ab,c,ca]],6:[[c,ca,bc],[a,b,ca],[b,bc,ca]],
    7:[[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]};
   next.push(...parts[mask]);
  }
  faces=next;if(!changed)break;
 }
 for(const face of faces)for(const v of face){positions.push(...v.p);uvs.push(...v.uv);}
 hood.setAttribute('position',new T.Float32BufferAttribute(positions,3));hood.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));hood.deleteAttribute('normal');hood.setIndex(null);hood.clearGroups();if(dense!==hood)dense.dispose();
 const hp=hood.attributes.position;
 // Smooth the original bevel normals before bending. Transforming those normals
 // analytically avoids the diagonal reflection patches from triangulated faces.
 hood.computeVertexNormals();const sourceNormals=hood.attributes.normal,normalSums=new Map(),normalKeys=[];
 for(let i=0;i<hp.count;i++){const key=[hp.getX(i),hp.getY(i),hp.getZ(i)].map(v=>Math.round(v*1e7)).join(',');normalKeys.push(key);const n=normalSums.get(key)||new T.Vector3();n.add(new T.Vector3().fromBufferAttribute(sourceNormals,i));normalSums.set(key,n);}
 for(const n of normalSums.values())n.normalize();
 const transformedNormals=new Float32Array(hp.count*3);

 // A broad sloping front folds into a nearly flat crown. Two short eased
 // transitions make the fold readable instead of inflating the entire lid.
 const hoodY=z=>{const t=-z,a=t-.027,b=t-.066,e=.0018,front=(Math.sqrt(a*a+e*e)+a-Math.sqrt(b*b+e*e)-b)/(.039*2);return .116+.034*front+.002*smooth(.066,.115,t)-rearRelief(z)*.78;};
 const crown=(x,z)=>(.002+.004*Math.sin(Math.PI*Math.max(0,Math.min(1,(-z-.026)/.125))))*Math.max(0,1-(x/.226)**8);
 for(let i=0;i<hp.count;i++){const x=hp.getX(i),z=hp.getY(i),d=hp.getZ(i),n=normalSums.get(normalKeys[i]),e=.00001;
  const fx=(crown(x+e,z)-crown(x-e,z))/(2*e),fz=(hoodY(z+e)+crown(x,z+e)-hoodY(z-e)-crown(x,z-e))/(2*e);
  const mapped=new T.Vector3(n.x-fx*n.z,n.z,n.y-fz*n.z).normalize();mapped.toArray(transformedNormals,i*3);
  hp.setXYZ(i,x,hoodY(z)+d+crown(x,z),z);hood.attributes.uv.setXY(i,x*12,z*12);
 }
 hood.setAttribute('normal',new T.Float32BufferAttribute(transformedNormals,3));
 // XY -> XZ reverses handedness, so restore outward face winding.
 const hi=hood.index;if(hi){for(let i=0;i<hi.count;i+=3){const t=hi.getX(i+1);hi.setX(i+1,hi.getX(i+2));hi.setX(i+2,t);}}else{for(let i=0;i<hp.count;i+=3){for(const attr of Object.values(hood.attributes)){for(let c=0;c<attr.itemSize;c++){const a=(i+1)*attr.itemSize+c,b=(i+2)*attr.itemSize+c,t=attr.array[a];attr.array[a]=attr.array[b];attr.array[b]=t;}}}}
 replace('Ribbon_Hood',hood,blue);
 nodes.Ribbon_Hood.userData.opening={points:hole.getSpacedPoints(192).slice(0,-1).map(p=>[p.x,p.y]),height:(x,z)=>hoodY(z)+crown(x,z),depth:.003};
 const apronGeo=new T.ExtrudeGeometry(rounded(-.217,.101,.217,.119,.004),{depth:.003,bevelEnabled:true,bevelThickness:.0008,bevelSize:.0008,bevelSegments:3,curveSegments:16});
 const apron=new T.Mesh(apronGeo,blue);apron.name='Lettera_Front_Apron';apron.position.z=-.029;root.add(apron);

 // Visible fixed segment below the opening; keep the animated typebar rig intact.
 for(let i=0;i<48;i++){
  const a=-1.25+i*2.5/47,points=[.028,.048,.069,.087].map(r=>new T.Vector3(Math.sin(a)*r,.137+Math.cos(a)*.003,-.123+Math.cos(a)*r*.58));
  const rib=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),10,.00042,5,false),chrome);rib.name='Lettera_Segment_Divider_'+i;nodes.Typebasket.add(rib);
 }
 // Lower tray stays fully inside the perimeter, with a thin dark assembly seam.
 for(const name of ['Bottom_Tray','Base_Seam'])nodes[name].material=dark;
 hide(['Badge_','Hermes_Badge','Selector_','Ribbon_Dot','Margin_Indicator_','Margin_Window','Bail_Graduation_','Bail_Number_','Paper_Support_Tip']);
 // Rebuild the black caps with a lower skirt, crisp rounded-square lip and shallow dishes.
 const capCache=new Map();root.traverse(o=>{
  if(o.isMesh&&o.material.name==='Hermes_Sage_Enamel')o.material=blue;
  if(o.isMesh&&/^(Stem_|Keyboard_Linkage)/.test(o.name))o.material=linkage;
  if(o.isMesh&&o.name.startsWith('Glyph_')){o.material=ink;o.position.y+=.0004;const size=/^Glyph_(Key[A-Z]|Digit[0-9])$/.test(o.name)?1.30:1.08;o.scale.x*=size;o.scale.z*=size;}
  if(!o.name.startsWith('Cap_'))return;
  o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,w=(b.max.x-b.min.x)/2,d=(b.max.z-b.min.z)/2,key=w+':'+d;
  if(!capCache.has(key)){
   const ring=(inset,y)=>({path:rounded(-w+inset,-d+inset,w-inset,d-inset,Math.min(.0032,(d-inset)*.6)),y:typeof y==='function'?y:()=>y});
   capCache.set(key,loft([
    ring(.0003,-.0058),ring(0,-.0048),ring(.0006,.0027),ring(.0011,.0048),ring(.0017,.0056),
    ring(.0023,.0055),ring(.0030,.0049),ring(Math.min(d*.66,.0055),(x,z)=>.0037),
    {path:rounded(-.00005,-.00005,.00005,.00005,.00002),y:()=>.0037},
    {path:rounded(-.00005,-.00005,.00005,.00005,.00002),y:()=>-.0058}
   ],64));
  }
  o.geometry=capCache.get(key);o.material=black;
 });
 // Model-specific black ridged platen knobs and inset circular faces.
 root.traverse(o=>{if(o.isMesh&&/^(Platen_Knob_|Knob_)/.test(o.name))o.material=rubber;});
 for(const side of ['Left','Right']){
  const knob=nodes['Platen_Knob_'+side];knob.material=rubber;
  const face=new T.Mesh(new T.CylinderGeometry(.0184,.0184,.001,64),side==='Right'?chrome:dark);face.name='Lettera_Knob_Inset_'+side;face.position.y=side==='Left'?-.0105:.0105;knob.add(face);
 }
 // The original Lettera has a metal scale and separate white paper-bail rollers.
 nodes.Paper_Bail_Channel.material=chrome;
 root.traverse(o=>{if(o.isMesh&&/Bail_Roller/.test(o.name))o.material=new T.MeshStandardMaterial({color:0xd9d9cf,roughness:.62});});
 const badgeCanvas=document.createElement('canvas');badgeCanvas.width=1024;badgeCanvas.height=128;const c=badgeCanvas.getContext('2d');
 c.fillStyle='#dadfdd';c.fillRect(0,0,1024,128);c.fillStyle='#171a1c';c.fillRect(10,10,444,108);c.textBaseline='middle';c.textAlign='center';c.font='bold 80px Arial';c.fillStyle='#f5f4ec';c.fillText('olivetti',230,67,420);c.fillStyle='#191c1e';c.font='bold 74px Arial';c.fillText('lettera 32',735,67,540);
 const badgeTexture=new T.CanvasTexture(badgeCanvas);badgeTexture.encoding=T.sRGBEncoding;
 const badge=new T.Mesh(new T.PlaneGeometry(.097,.0121),new T.MeshStandardMaterial({map:badgeTexture,roughness:.42,metalness:.18}));badge.name='Lettera_Split_Badge';badge.position.set(0,hoodY(-.046)+crown(0,-.046)+.005,-.046);const badgeSlope=(hoodY(-.04599)+crown(0,-.04599)-hoodY(-.04601)-crown(0,-.04601))/.00002;badge.rotation.x=-Math.atan2(1,-badgeSlope);badge.position.addScaledVector(new T.Vector3(0,-Math.sin(badge.rotation.x),Math.cos(badge.rotation.x)),.0018);root.add(badge);
 // Continuous removable-cover seam follows the actual edge, including corners.
 const seamPoints=cover.getSpacedPoints(160).slice(0,-1).map(p=>new T.Vector3(p.x,hoodY(p.y)-.0005+crown(p.x,p.y),p.y));
 const coverSeam=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(seamPoints,true),192,.0008,8,true),dark);coverSeam.name='Lettera_Cover_Seam';root.add(coverSeam);
 // Silver return lever with the broad rounded paddle visible in the manufacturer's photo.
 hide(['Return_Lever_Chrome','Return_Lever_Paddle']);
 const lp=new T.Shape();lp.moveTo(0,-.003);lp.quadraticCurveTo(-.035,-.001,-.050,.022);lp.lineTo(-.091,.061);lp.quadraticCurveTo(-.102,.076,-.091,.080);lp.quadraticCurveTo(-.082,.081,-.075,.069);lp.lineTo(-.043,.030);lp.quadraticCurveTo(-.027,.007,0,.003);lp.closePath();
 const lg=new T.ExtrudeGeometry(lp,{depth:.0013,bevelEnabled:true,bevelThickness:.00065,bevelSize:.0008,bevelSegments:4,curveSegments:20});
 lg.rotateX(Math.PI/2);const lever=new T.Mesh(lg,chrome);lever.name='Lettera_Return_Paddle';nodes.Return_Lever.add(lever);
 const scaleCanvas=document.createElement('canvas');scaleCanvas.width=2048;scaleCanvas.height=64;const sc=scaleCanvas.getContext('2d');sc.fillStyle='#cbd0cb';sc.fillRect(0,0,2048,64);sc.fillStyle='#242728';sc.font='22px monospace';sc.textAlign='center';
 for(let i=0;i<=87;i++){const x=12+i*2024/87;sc.fillRect(x,32,i%5===0?2:1,i%5===0?28:16);if(i%10===0)sc.fillText(String(i),x,22);}
 const st=new T.CanvasTexture(scaleCanvas);st.encoding=T.sRGBEncoding;const ruler=new T.Mesh(new T.PlaneGeometry(.376,.007),new T.MeshStandardMaterial({map:st,roughness:.42,metalness:.45}));ruler.name='Lettera_Pica_Scale';ruler.position.set(0,.190,-.1139);nodes.Carriage.add(ruler);
 root.userData.model='lettera32';root.userData.adaptation='61-key web layout; shared animated rig; observed visible forms, not factory CAD';
 return root;
}
