/* Olympia SM3 visible-form reconstruction. Sources and adaptation limits:
 * docs/OLYMPIA_SM3_MODEL.md. Dimensions below are authored scene units, not measured CAD.
 * Keep the shared 61-key input rig and paper coordinates; rebuild visible enclosure,
 * keycaps, bail, knobs and markings without scaling a Hermes shell into this model.
 */
globalThis.LSBuildOlympiaSM3 = function buildOlympiaSM3(T, root, document=globalThis.document) {
 const nodes={};root.traverse(o=>nodes[o.name]=o);
 const blue=new T.MeshPhysicalMaterial({name:'Olympia_Crinkle_Enamel',color:new T.Color(.092,.107,.079),metalness:.04,roughness:.74,clearcoat:.025,clearcoatRoughness:.65});
 const black=new T.MeshPhysicalMaterial({name:'Olympia_Green_Keycaps',color:new T.Color(.006,.018,.011),metalness:0,roughness:.22,clearcoat:.55,clearcoatRoughness:.14});
 const rubber=new T.MeshStandardMaterial({name:'Platen_Rubber',color:0x172a22,roughness:.75});
 const chrome=new T.MeshStandardMaterial({name:'Olympia_Chrome',color:0xa5adb0,metalness:1,roughness:.16,envMapIntensity:1.05});
 const ink=new T.MeshStandardMaterial({name:'Olympia_Legends',color:0xf3f0e7,roughness:.64});
 const dark=new T.MeshStandardMaterial({color:0x171b1e,roughness:.65});
 function replace(name,geometry,material){const o=nodes[name];o.geometry=geometry;o.material=material;o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);return o;}
 function hide(prefixes){root.traverse(o=>{if(prefixes.some(p=>o.name.startsWith(p)))o.visible=false;});}
 function rounded(x0,z0,x1,z1,r){const p=new T.Shape();p.moveTo(x0+r,z0);p.lineTo(x1-r,z0);p.quadraticCurveTo(x1,z0,x1,z0+r);p.lineTo(x1,z1-r);p.quadraticCurveTo(x1,z1,x1-r,z1);p.lineTo(x0+r,z1);p.quadraticCurveTo(x0,z1,x0,z1-r);p.lineTo(x0,z0+r);p.quadraticCurveTo(x0,z0,x0+r,z0);return p;}
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 // Closed rings: outer skirt, rounded shoulder, recessed lip and underside.
 function loft(rings,N=128,sideUV=false){
  const pos=[],uv=[],idx=[];
  for(const r of rings){const points=sideUV?r.path.curves.flatMap(c=>Array.from({length:N/8},(_,i)=>c.getPoint(i/(N/8)))):r.path.getSpacedPoints(N);for(let i=0;i<N;i++){const p=points[i];pos.push(p.x,r.y(p.x,p.y),p.y);uv.push(...(sideUV?[i/N*12,r.y(p.x,p.y)*8]:[p.x*8,p.y*8]));}}
  for(let j=0;j<rings.length;j++){const next=(j+1)%rings.length;for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N,c=next*N+(i+1)%N,d=next*N+i;idx.push(a,d,b,b,d,c);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
 }
 // Taller continuous side cheeks and the rounded front lip seen in the SM3 reference.
 // Recess the rear shoulder across the entire carriage sweep, not only at rest.
 // This preserves the paper/print point and gives knobs + bearings physical clearance.
 const rearRelief=z=>.039*(1-smooth(-.112,-.073,z));
 const bodyTop=z=>.048+.108*(1-smooth(-.135,.16,z))-rearRelief(z);
 replace('Cast_Perimeter',loft([
  {path:rounded(-.237,-.168,.237,.184,.031),y:()=>.013},
  {path:rounded(-.241,-.171,.241,.188,.033),y:()=>.018},
  {path:rounded(-.241,-.171,.241,.188,.033),y:(x,z)=>bodyTop(z)-.010},
  {path:rounded(-.237,-.168,.237,.184,.031),y:(x,z)=>bodyTop(z)-.002},
  {path:rounded(-.232,-.164,.232,.180,.028),y:(x,z)=>bodyTop(z)+.001},
  {path:rounded(-.216,-.152,.216,.169,.015),y:(x,z)=>bodyTop(z)-.002},
  {path:rounded(-.212,-.148,.212,.165,.012),y:(x,z)=>bodyTop(z)-.008},
  {path:rounded(-.212,-.148,.212,.165,.012),y:()=>.013}
 ],384,true),blue);
 // Broad curved opening with inward swept shoulders; exposed fan of typebars.
 const cover=rounded(-.226,-.153,.226,-.021,.027),hole=new T.Path();
 hole.moveTo(-.127,-.072);hole.bezierCurveTo(-.134,-.066,-.131,-.059,-.119,-.057);
 hole.bezierCurveTo(-.068,-.040,.068,-.040,.119,-.057);hole.bezierCurveTo(.131,-.059,.134,-.066,.127,-.072);
 hole.bezierCurveTo(.115,-.080,.079,-.074,.050,-.095);hole.quadraticCurveTo(.029,-.108,.032,-.129);
 hole.lineTo(.026,-.146);hole.lineTo(-.026,-.146);hole.lineTo(-.032,-.129);
 hole.quadraticCurveTo(-.029,-.108,-.050,-.095);hole.bezierCurveTo(-.079,-.074,-.115,-.080,-.127,-.072);
 cover.holes.push(hole);
 const hood=new T.ExtrudeGeometry(cover,{depth:.003,steps:1,bevelEnabled:true,bevelThickness:.0014,bevelSize:.0022,bevelSegments:5,curveSegments:24});
 let dense=hood.index?hood.toNonIndexed():hood;const dp=dense.attributes.position,du=dense.attributes.uv,positions=[],uvs=[];
 function split(a,b,c,ua,ub,uc,depth){
  if(depth===0){positions.push(...a,...b,...c);uvs.push(...ua,...ub,...uc);return;}
  const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a),uab=mid(ua,ub),ubc=mid(ub,uc),uca=mid(uc,ua);
  split(a,ab,ca,ua,uab,uca,depth-1);split(ab,b,bc,uab,ub,ubc,depth-1);split(ca,bc,c,uca,ubc,uc,depth-1);split(ab,bc,ca,uab,ubc,uca,depth-1);
 }
 for(let i=0;i<dp.count;i+=3){const a=[dp.getX(i),dp.getY(i),dp.getZ(i)],b=[dp.getX(i+1),dp.getY(i+1),dp.getZ(i+1)],c=[dp.getX(i+2),dp.getY(i+2),dp.getZ(i+2)];split(a,b,c,[du.getX(i),du.getY(i)],[du.getX(i+1),du.getY(i+1)],[du.getX(i+2),du.getY(i+2)],3);}
 hood.setAttribute('position',new T.Float32BufferAttribute(positions,3));hood.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));hood.deleteAttribute('normal');hood.setIndex(null);hood.clearGroups();if(dense!==hood)dense.dispose();
 const hp=hood.attributes.position;
 // Smooth the original bevel normals before bending. Transforming those normals
 // analytically avoids the diagonal reflection patches from triangulated faces.
 hood.computeVertexNormals();const sourceNormals=hood.attributes.normal,normalSums=new Map(),normalKeys=[];
 for(let i=0;i<hp.count;i++){const key=[hp.getX(i),hp.getY(i),hp.getZ(i)].map(v=>Math.round(v*1e7)).join(',');normalKeys.push(key);const n=normalSums.get(key)||new T.Vector3();n.add(new T.Vector3().fromBufferAttribute(sourceNormals,i));normalSums.set(key,n);}
 for(const n of normalSums.values())n.normalize();
 const transformedNormals=new Float32Array(hp.count*3);

 const hoodY=z=>.124+.040*smooth(.021,.095,-z)-.005*smooth(.10,.155,-z)-rearRelief(z);
 const crown=(x,z)=>(.003+.006*Math.sin(Math.PI*Math.max(0,Math.min(1,(-z-.021)/.132))))*(1-(x/.226)**2);
 for(let i=0;i<hp.count;i++){const x=hp.getX(i),z=hp.getY(i),d=hp.getZ(i),n=normalSums.get(normalKeys[i]),e=.00001;
  const fx=(crown(x+e,z)-crown(x-e,z))/(2*e),fz=(hoodY(z+e)+crown(x,z+e)-hoodY(z-e)-crown(x,z-e))/(2*e);
  const mapped=new T.Vector3(n.x-fx*n.z,n.z,n.y-fz*n.z).normalize();mapped.toArray(transformedNormals,i*3);
  hp.setXYZ(i,x,hoodY(z)+d+crown(x,z),z);hood.attributes.uv.setXY(i,x*12,z*12);
 }
 hood.setAttribute('normal',new T.Float32BufferAttribute(transformedNormals,3));
 // XY -> XZ reverses handedness, so restore outward face winding.
 const hi=hood.index;if(hi){for(let i=0;i<hi.count;i+=3){const t=hi.getX(i+1);hi.setX(i+1,hi.getX(i+2));hi.setX(i+2,t);}}else{for(let i=0;i<hp.count;i+=3){for(const attr of Object.values(hood.attributes)){for(let c=0;c<attr.itemSize;c++){const a=(i+1)*attr.itemSize+c,b=(i+2)*attr.itemSize+c,t=attr.array[a];attr.array[a]=attr.array[b];attr.array[b]=t;}}}}
 replace('Ribbon_Hood',hood,blue);
 // The cover's front apron closes the gap above the key bank.
 const apronGeo=new T.ExtrudeGeometry(rounded(-.215,.101,.215,.127,.006),{depth:.004,bevelEnabled:true,bevelThickness:.001,bevelSize:.001,bevelSegments:4,curveSegments:16});
 const apron=new T.Mesh(apronGeo,blue);apron.name='Olympia_Front_Apron';apron.position.z=-.023;root.add(apron);
 // Compact semicircular central shield leaves the radial typebar arms exposed.
 // Its outline follows the visible shield, without fabricating hidden linkages.
 nodes.Type_Guide_Shield.visible=false;
 const shieldShape=new T.Shape();shieldShape.moveTo(-.025,-.111);shieldShape.quadraticCurveTo(0,-.061,.025,-.111);shieldShape.lineTo(-.025,-.111);
 const shieldGeo=new T.ExtrudeGeometry(shieldShape,{depth:.001,bevelEnabled:true,bevelThickness:.0003,bevelSize:.0004,bevelSegments:2,curveSegments:32});shieldGeo.rotateX(Math.PI/2);
 const shield=new T.Mesh(shieldGeo,chrome);shield.name='Olympia_Central_Shield';shield.position.y=.144;nodes.Typebasket.add(shield);
 for(const x of [-.019,.019]){const screw=new T.Mesh(new T.CylinderGeometry(.0016,.0016,.0008,16),chrome);screw.name='Olympia_Shield_Fastener';screw.position.set(x,.1448,-.108);nodes.Typebasket.add(screw);}

 // The fixed slotted segment is visible between the central shield and type slugs.
 // These dividers are structural guides, separate from the moving typebar rig.
 for(let i=0;i<48;i++){
  const a=-1.27+i*2.54/47,points=[.033,.052,.075,.091].map(r=>new T.Vector3(Math.sin(a)*r,.143+Math.cos(a)*.003,-.115+Math.cos(a)*r*.65));
  const rib=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.00048,5,false),chrome);rib.name='Olympia_Segment_Divider_'+i;nodes.Typebasket.add(rib);
 }
 // Lower tray stays fully inside the perimeter, with a thin dark assembly seam.
 for(const name of ['Bottom_Tray','Base_Seam'])nodes[name].material=dark;
 hide(['Badge_','Hermes_Badge','Selector_','Ribbon_Dot','Margin_Indicator_','Margin_Window','Bail_Graduation_','Bail_Number_','Paper_Support']);
 // Taller tapered deep-green caps, dished tops, small bright crown edges; original 61-key web mapping retained.
 const capCache=new Map();root.traverse(o=>{
  if(o.isMesh&&o.material.name==='Hermes_Sage_Enamel')o.material=blue;
  if(o.isMesh&&o.name.startsWith('Glyph_')){o.material=ink;o.position.y+=.0014;const size=/^Glyph_(Key[A-Z]|Digit[0-9])$/.test(o.name)?1.32:1.10;o.scale.x*=size;o.scale.z*=size;}
  if(!o.name.startsWith('Cap_'))return;
  o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,w=(b.max.x-b.min.x)/2,d=(b.max.z-b.min.z)/2,key=w+':'+d;
  if(!capCache.has(key)){
   const ring=(inset,y)=>({path:rounded(-w+inset,-d+inset,w-inset,d-inset,Math.min(.0036,(d-inset)*.65)),y:typeof y==='function'?y:()=>y});
   capCache.set(key,loft([
    ring(.0008,-.0092),ring(0,-.0075),ring(.0007,.0038),ring(.0014,.0064),ring(.0020,.0071),
    ring(.0027,.0064),ring(Math.min(d*.65,.0055),(x,z)=>.0047),
    {path:rounded(-.00005,-.00005,.00005,.00005,.00002),y:()=>.0047},
    {path:rounded(-.00005,-.00005,.00005,.00005,.00002),y:()=>-.0092}
   ],64));
  }
  o.geometry=capCache.get(key);o.material=black;
 });
 // Dark-green ribbed platen knobs, with a narrow polished ring at the hub.
 root.traverse(o=>{if(o.isMesh&&/^(Platen_Knob_|Knob_)/.test(o.name))o.material=black;});
 for(const side of ['Left','Right']){
  const knob=nodes['Platen_Knob_'+side],sign=side==='Left'?-1:1;
  const ring=new T.Mesh(new T.TorusGeometry(.019,.00065,8,64),chrome);ring.name='Olympia_Knob_Rim_'+side;ring.rotation.x=Math.PI/2;ring.position.y=sign*.0107;knob.add(ring);
 }
 // Crinkle finish: stable procedural microrelief, no painted-on lighting or scratches.
 const size=128,data=new Uint8Array(size*size*4);let seed=1955;const field=[];
 for(let i=0;i<size*size;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;field.push((seed>>>8)/16777216);}
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const at=(dx,dy)=>field[((y+dy+size)%size)*size+(x+dx+size)%size];
  const height=Math.round(75+135*Math.abs(at(0,0)-.25*(at(1,0)+at(-1,0)+at(0,1)+at(0,-1))));
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=height;data[i+3]=255;
 }
 const grain=new T.DataTexture(data,size,size,T.RGBAFormat);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.generateMipmaps=true;grain.minFilter=T.LinearMipmapLinearFilter;grain.magFilter=T.LinearFilter;grain.needsUpdate=true;
 const finishData=new Uint8Array(data.length),roughData=new Uint8Array(data.length);
 for(let i=0;i<data.length;i+=4){const h=data[i]/255,tone=Math.round(240+15*h),rough=Math.round(213+40*h);for(let c=0;c<3;c++){finishData[i+c]=tone;roughData[i+c]=rough;}finishData[i+3]=roughData[i+3]=255;}
 const paint=new T.DataTexture(finishData,size,size,T.RGBAFormat),roughMap=new T.DataTexture(roughData,size,size,T.RGBAFormat);
 for(const texture of [paint,roughMap]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.needsUpdate=true;}
 blue.map=paint;blue.roughnessMap=roughMap;blue.bumpMap=grain;blue.bumpScale=.00030;blue.roughness=.78;
 // Continuous chrome cover seam and the lower shell trim, separate closed tubes.
 // Rolled metal edging: a broad curved face with a dark underside and a fine
 // highlight edge, so the strip reflects the room instead of reading as white paint.
 function piping(name,path,y,radius){
  const points=path.getSpacedPoints(192).slice(0,-1).map(p=>new T.Vector3(p.x,y(p.x,p.y),p.y));
  const curve=new T.CatmullRomCurve3(points,true),N=256,M=12,pos=[],idx=[];
  for(let i=0;i<=N;i++){const t=i/N,p=curve.getPointAt(t),v=curve.getTangentAt(t),out=new T.Vector3(v.z,0,-v.x).normalize();
   for(let j=0;j<M;j++){const a=j/M*Math.PI*2,q=p.clone().addScaledVector(out,Math.cos(a)*radius);q.y+=Math.sin(a)*radius*.62;pos.push(q.x,q.y,q.z);}}
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*M+j,b=i*M+(j+1)%M,c=(i+1)*M+(j+1)%M,d=(i+1)*M+j;idx.push(a,b,d,b,c,d);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  const band=new T.Mesh(g,chrome);band.name=name;root.add(band);
  const seam=new T.Mesh(new T.TubeGeometry(curve,N,radius*.55,6,true),dark);seam.name=name+'_Recess';seam.position.y=-radius*.8;root.add(seam);return band;
 }
 piping('Olympia_Cover_Chrome',rounded(-.229,-.156,.229,-.018,.029),(x,z)=>hoodY(Math.min(-.021,z))+.001+crown(x,z),.00175);
 piping('Olympia_Base_Chrome',rounded(-.240,-.171,.240,.187,.033),()=>.0145,.0016);
 // Black bail rollers on a metal scale; replace the Hermes red margin windows.
 nodes.Paper_Bail_Channel.material=chrome;
 root.traverse(o=>{if(o.isMesh&&/Bail_Roller/.test(o.name))o.material=rubber;});
 const scaleCanvas=document.createElement('canvas');scaleCanvas.width=2048;scaleCanvas.height=64;const sc=scaleCanvas.getContext('2d');sc.fillStyle='#c0c5ba';sc.fillRect(0,0,2048,64);sc.fillStyle='#272c24';sc.font='22px monospace';sc.textAlign='center';
 for(let i=0;i<=80;i++){const x=12+i*2024/80;sc.fillRect(x,32,i%5===0?2:1,i%5===0?28:16);if(i%10===0)sc.fillText(String(i),x,22);}
 const st=new T.CanvasTexture(scaleCanvas);st.encoding=T.sRGBEncoding;const ruler=new T.Mesh(new T.PlaneGeometry(.376,.007),new T.MeshStandardMaterial({map:st,roughness:.43,metalness:.55}));ruler.name='Olympia_Paper_Scale';ruler.position.set(0,.190,-.1139);nodes.Carriage.add(ruler);
 // A single folding paper support, as numbered 7 in the original SM3 instructions.
 const support=new T.Mesh(new T.BoxGeometry(.014,.068,.0018),chrome);support.name='Olympia_Paper_Support';support.position.set(-.075,.226,-.176);nodes.Carriage.add(support);
 const supportSlot=new T.Mesh(new T.BoxGeometry(.004,.045,.0003),dark);supportSlot.name='Olympia_Support_Inset';supportSlot.position.z=.0011;support.add(supportSlot);
 // Curved spoon-shaped return lever, mounted on the moving carriage assembly.
 hide(['Return_Lever_Chrome','Return_Lever_Paddle']);
 const lp=new T.Shape();lp.moveTo(0,-.003);lp.quadraticCurveTo(-.028,-.001,-.047,.019);lp.lineTo(-.090,.064);lp.quadraticCurveTo(-.105,.086,-.094,.088);lp.quadraticCurveTo(-.080,.085,-.075,.068);lp.lineTo(-.040,.027);lp.quadraticCurveTo(-.024,.007,0,.003);lp.closePath();
 const lg=new T.ExtrudeGeometry(lp,{depth:.0018,bevelEnabled:true,bevelThickness:.0008,bevelSize:.001,bevelSegments:5,curveSegments:24});lg.rotateX(Math.PI/2);
 const lever=new T.Mesh(lg,chrome);lever.name='Olympia_Return_Lever';nodes.Return_Lever.add(lever);
 // Cursive raised lettering on the RIGHT of the front cover. Hand-traced paths,
 // not an assertion that an original factory logo drawing has been recovered.
 const badge=new T.Group();badge.name='Olympia_Script_Badge';
 const badgeMetal=new T.MeshStandardMaterial({name:'Olympia_Badge_Metal',color:0xadb5b7,metalness:1,roughness:.23,envMapIntensity:.85});
 const strokes=[
  [[.80,.96],['C',.25,1.18,-.22,.33,.20,.10],['C',.73,-.20,1.36,.34,1.14,.82],['C',.95,1.22,.48,.75,.63,.42],['C',.81,.16,1.22,.43,1.34,.60]],
  [[1.34,.60],['C',1.83,1.52,1.78,1.56,1.60,1.30],['C',1.40,1.00,1.22,.02,1.65,.23],['C',1.78,.29,1.85,.40,1.95,.55]],
  [[1.95,.55],['C',1.70,-.04,2.18,.07,2.40,.59],['C',2.29,.14,2.09,-.68,1.82,-.52],['C',1.59,-.35,2.44,.23,2.62,.48]],
  [[2.62,.48],['L',2.51,.13],['C',2.95,.91,3.12,.68,2.93,.17],['C',3.34,.84,3.54,.64,3.36,.15],['C',3.62,.11,3.71,.37,3.84,.48]],
  [[3.84,.48],['L',3.46,-.51],['M',3.78,.30],['C',4.29,.98,4.45,.42,4.13,.22],['C',3.91,.10,3.82,.14,3.85,.30],['M',4.16,.22],['C',4.36,.21,4.51,.42,4.61,.51]],
  [[4.61,.51],['C',4.32,-.12,4.74,.13,4.91,.43]],
  [[4.63,.85],['L',4.66,.87]],
  [[5.45,.51],['C',5.10,.78,4.72,.17,4.99,.13],['C',5.18,.10,5.39,.40,5.44,.53],['C',5.18,-.01,5.61,.10,5.82,.34]]
 ];
 // Solid rounded rectangular strokes: a broad face, beveled edges and closed ends.
 // Place the back of every stroke on the curved lid instead of floating a flat decal.
 function badgeStroke(path){
  const profile=rounded(-.073,0,.073,.105,.022).getSpacedPoints(24).slice(0,-1),N=144,M=profile.length,pos=[],idx=[];
  for(let i=0;i<=N;i++){
   const p=path.getPoint(i/N),t=path.getTangent(i/N),len=Math.hypot(t.x,t.y)||1;
   for(const q of profile){const u=p.x-t.y/len*q.x,v=p.y+t.x/len*q.x,x=.116+u*.015,z=-.040-v*.012;
    pos.push(x,hoodY(z)+crown(x,z)+.0053+q.y*.015,z);}
  }
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*M+j,b=i*M+(j+1)%M,c=(i+1)*M+(j+1)%M,d=(i+1)*M+j;idx.push(a,b,d,b,c,d);}
  // End caps use ring vertices, keeping the extrusion watertight.
  for(let j=1;j<M-1;j++){idx.push(0,j+1,j);idx.push(N*M,N*M+j,N*M+j+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  const mesh=new T.Mesh(g,badgeMetal);mesh.name='Olympia_Badge_Stroke_'+badge.children.length;badge.add(mesh);
 }
 for(const [start,...segments] of strokes){
  let path=new T.CurvePath(),last=new T.Vector3(start[0],start[1],0);
  for(const [cmd,...v] of segments){
   if(cmd==='M'){if(path.curves.length)badgeStroke(path);path=new T.CurvePath();last=new T.Vector3(v[0],v[1],0);continue;}
   const end=new T.Vector3(v.at(-2),v.at(-1),0);
   path.add(cmd==='C'?new T.CubicBezierCurve3(last,new T.Vector3(v[0],v[1],0),new T.Vector3(v[2],v[3],0),end):new T.LineCurve3(last,end));last=end;
  }
  if(path.curves.length)badgeStroke(path);
 }
 root.add(badge);
 // Visible ribbon selector beside the right keyboard edge: black / white / red.
 for(const [i,color] of [0x1b211c,0xe7e3d3,0x923e30].entries()){
  const dot=new T.Mesh(new T.SphereGeometry(.0014,12,8),new T.MeshStandardMaterial({color,roughness:.5}));dot.name='Olympia_Ribbon_Setting_'+i;dot.position.set(.220,.086-i*.005,.046);root.add(dot);
 }
 const selector=new T.Mesh(new T.BoxGeometry(.0022,.011,.002),chrome);selector.name='Olympia_Ribbon_Selector';selector.position.set(.223,.081,.046);root.add(selector);
 root.userData.model='olympiasm3';root.userData.adaptation='61-key web layout; carriage-shift variant; photo-derived authored surfaces, not measured CAD';
 return root;
}
