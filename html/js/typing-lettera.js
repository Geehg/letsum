/* Lettera 32 visible-form reconstruction. Sources and adaptation limits:
 * docs/LETTERA32_MODEL.md. Dimensions below are authored scene units, not measured CAD.
 * Keep the shared 61-key input rig and paper coordinates; rebuild visible enclosure,
 * keycaps, bail, knobs and markings without scaling a Hermes shell into this model.
 */
globalThis.LSBuildLettera32 = function buildLettera32(T, root, document=globalThis.document) {
 const nodes={};root.traverse(o=>nodes[o.name]=o);
 const blue=new T.MeshPhysicalMaterial({name:'Lettera_Blue_Enamel',color:new T.Color(.25,.43,.52),metalness:.16,roughness:.38,clearcoat:.16,clearcoatRoughness:.34});
 const black=new T.MeshPhysicalMaterial({name:'Lettera_Black_Keycaps',color:new T.Color(.038,.043,.048),metalness:0,roughness:.32,clearcoat:.16,clearcoatRoughness:.3});
 const rubber=new T.MeshStandardMaterial({name:'Platen_Rubber',color:0x16191b,roughness:.75});
 const chrome=new T.MeshStandardMaterial({name:'Polished_Nickel',color:0xaeb7bb,metalness:1,roughness:.23});
 const ink=new T.MeshStandardMaterial({name:'Lettera_Legends',color:0xf3f0e7,roughness:.64});
 const dark=new T.MeshStandardMaterial({color:0x171b1e,roughness:.65});
 function replace(name,geometry,material){const o=nodes[name];o.geometry=geometry;o.material=material;o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);return o;}
 function hide(prefixes){root.traverse(o=>{if(prefixes.some(p=>o.name.startsWith(p)))o.visible=false;});}
 function rounded(x0,z0,x1,z1,r){const p=new T.Shape();p.moveTo(x0+r,z0);p.lineTo(x1-r,z0);p.quadraticCurveTo(x1,z0,x1,z0+r);p.lineTo(x1,z1-r);p.quadraticCurveTo(x1,z1,x1-r,z1);p.lineTo(x0+r,z1);p.quadraticCurveTo(x0,z1,x0,z1-r);p.lineTo(x0,z0+r);p.quadraticCurveTo(x0,z0,x0+r,z0);return p;}
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 // Closed rings: outer skirt, rounded shoulder, recessed lip and underside.
 function loft(rings,N=128){
  const pos=[],uv=[],idx=[];
  for(const r of rings){const points=r.path.getSpacedPoints(N);for(let i=0;i<N;i++){const p=points[i];pos.push(p.x,r.y(p.x,p.y),p.y);uv.push(p.x*8,p.y*8);}}
  for(let j=0;j<rings.length;j++){const next=(j+1)%rings.length;for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N,c=next*N+(i+1)%N,d=next*N+i;idx.push(a,d,b,b,d,c);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
 }
 const bodyTop=z=>.045+.102*(1-smooth(-.13,.15,z));
 replace('Cast_Perimeter',loft([
  {path:rounded(-.232,-.166,.232,.181,.020),y:()=>.014},
  {path:rounded(-.235,-.169,.235,.184,.021),y:()=>.018},
  {path:rounded(-.234,-.168,.234,.183,.020),y:(x,z)=>bodyTop(z)-.005},
  {path:rounded(-.230,-.164,.230,.179,.019),y:(x,z)=>bodyTop(z)},
  {path:rounded(-.215,-.043,.215,.169,.012),y:(x,z)=>bodyTop(z)-.002},
  {path:rounded(-.212,-.040,.212,.166,.010),y:(x,z)=>bodyTop(z)-.007},
  {path:rounded(-.212,-.040,.212,.166,.010),y:()=>.014}
 ]),blue);
 // Removable low cover: broad folded front face, flatter crown and two inner wings.
 const cover=rounded(-.224,-.151,.224,-.026,.020),hole=new T.Path();
 hole.moveTo(-.119,-.075);hole.quadraticCurveTo(-.131,-.077,-.128,-.089);hole.lineTo(-.120,-.113);
 hole.quadraticCurveTo(-.114,-.119,-.095,-.116);hole.lineTo(-.036,-.111);hole.quadraticCurveTo(-.018,-.111,-.017,-.128);
 hole.lineTo(-.015,-.148);hole.lineTo(.015,-.148);hole.lineTo(.017,-.128);hole.quadraticCurveTo(.018,-.111,.036,-.111);
 hole.lineTo(.095,-.116);hole.quadraticCurveTo(.114,-.119,.120,-.113);hole.lineTo(.128,-.089);hole.quadraticCurveTo(.131,-.077,.119,-.075);hole.lineTo(-.119,-.075);
 cover.holes.push(hole);
 const hood=new T.ExtrudeGeometry(cover,{depth:.003,steps:1,bevelEnabled:true,bevelThickness:.0014,bevelSize:.0022,bevelSegments:5,curveSegments:24});
 let dense=hood.index?hood.toNonIndexed():hood;const dp=dense.attributes.position,du=dense.attributes.uv,positions=[],uvs=[];
 function split(a,b,c,ua,ub,uc,depth){
  if(depth===0){positions.push(...a,...b,...c);uvs.push(...ua,...ub,...uc);return;}
  const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a),uab=mid(ua,ub),ubc=mid(ub,uc),uca=mid(uc,ua);
  split(a,ab,ca,ua,uab,uca,depth-1);split(ab,b,bc,uab,ub,ubc,depth-1);split(ca,bc,c,uca,ubc,uc,depth-1);split(ab,bc,ca,uab,ubc,uca,depth-1);
 }
 for(let i=0;i<dp.count;i+=3){const a=[dp.getX(i),dp.getY(i),dp.getZ(i)],b=[dp.getX(i+1),dp.getY(i+1),dp.getZ(i+1)],c=[dp.getX(i+2),dp.getY(i+2),dp.getZ(i+2)];split(a,b,c,[du.getX(i),du.getY(i)],[du.getX(i+1),du.getY(i+1)],[du.getX(i+2),du.getY(i+2)],2);}
 hood.setAttribute('position',new T.Float32BufferAttribute(positions,3));hood.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));hood.deleteAttribute('normal');hood.setIndex(null);hood.clearGroups();if(dense!==hood)dense.dispose();
 const hp=hood.attributes.position;
 const hoodY=z=>.128+.034*smooth(.026,.066,-z)+.002*smooth(.066,.15,-z);
 for(let i=0;i<hp.count;i++){const x=hp.getX(i),z=hp.getY(i),d=hp.getZ(i);hp.setXYZ(i,x,hoodY(z)+d,z);}
 // XY -> XZ reverses handedness, so restore outward face winding.
 const hi=hood.index;if(hi){for(let i=0;i<hi.count;i+=3){const t=hi.getX(i+1);hi.setX(i+1,hi.getX(i+2));hi.setX(i+2,t);}}else{for(let i=0;i<hp.count;i+=3){for(const attr of Object.values(hood.attributes)){for(let c=0;c<attr.itemSize;c++){const a=(i+1)*attr.itemSize+c,b=(i+2)*attr.itemSize+c,t=attr.array[a];attr.array[a]=attr.array[b];attr.array[b]=t;}}}}
 hood.computeVertexNormals();
 const hn=hood.attributes.normal,sums=new Map(),keys=[];for(let i=0;i<hp.count;i++){const key=[hp.getX(i),hp.getY(i),hp.getZ(i)].map(v=>Math.round(v*1e7)).join(',');keys.push(key);const sum=sums.get(key)||new T.Vector3();sum.add(new T.Vector3(hn.getX(i),hn.getY(i),hn.getZ(i)));sums.set(key,sum);}
 for(const n of sums.values())n.normalize();for(let i=0;i<hp.count;i++){const n=sums.get(keys[i]);hn.setXYZ(i,n.x,n.y,n.z);}
 replace('Ribbon_Hood',hood,blue);
 // Lower tray stays fully inside the perimeter, with a thin dark assembly seam.
 for(const name of ['Bottom_Tray','Base_Seam'])nodes[name].material=dark;
 hide(['Badge_','Hermes_Badge','Selector_','Ribbon_Dot','Margin_Indicator_','Margin_Window','Bail_Graduation_','Bail_Number_','Paper_Support_Tip']);
 // Rebuild the black caps with a lower skirt, crisp rounded-square lip and shallow dishes.
 const capCache=new Map();root.traverse(o=>{
  if(o.isMesh&&o.material.name==='Hermes_Sage_Enamel')o.material=blue;
  if(o.name.startsWith('Glyph_')){o.material=ink;o.position.y+=.0015;}
  if(!o.name.startsWith('Cap_'))return;
  o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,w=(b.max.x-b.min.x)/2,d=(b.max.z-b.min.z)/2,key=w+':'+d;
  if(!capCache.has(key)){
   const ring=(inset,y)=>({path:rounded(-w+inset,-d+inset,w-inset,d-inset,Math.min(.0023,(d-inset)*.4)),y:typeof y==='function'?y:()=>y});
   capCache.set(key,loft([
    ring(.0004,-.0085),ring(0,-.0072),ring(.00035,.0035),ring(.0011,.0057),ring(.0019,.0063),
    ring(.0026,.0059),ring(Math.min(d*.66,.0055),(x,z)=>.0049),
    {path:rounded(-.00005,-.00005,.00005,.00005,.00002),y:()=>.0047},
    {path:rounded(-.00005,-.00005,.00005,.00005,.00002),y:()=>-.0085}
   ],64));
  }
  o.geometry=capCache.get(key);o.material=black;
 });
 // Model-specific black ridged platen knobs and inset circular faces.
 root.traverse(o=>{if(o.isMesh&&/^(Platen_Knob_|Knob_)/.test(o.name))o.material=rubber;});
 for(const side of ['Left','Right']){
  const knob=nodes['Platen_Knob_'+side];knob.material=rubber;
  const face=new T.Mesh(new T.CylinderGeometry(.0184,.0184,.001,64),dark);face.name='Lettera_Knob_Inset_'+side;face.position.y=side==='Left'?-.0105:.0105;knob.add(face);
 }
 // The original Lettera has a metal scale and separate white paper-bail rollers.
 nodes.Paper_Bail_Channel.material=chrome;
 root.traverse(o=>{if(o.isMesh&&/Bail_Roller/.test(o.name))o.material=new T.MeshStandardMaterial({color:0xd9d9cf,roughness:.62});});
 const badgeCanvas=document.createElement('canvas');badgeCanvas.width=1024;badgeCanvas.height=128;const c=badgeCanvas.getContext('2d');
 c.fillStyle='#dadfdd';c.fillRect(0,0,1024,128);c.fillStyle='#171a1c';c.fillRect(10,10,444,108);c.textBaseline='middle';c.textAlign='center';c.font='bold 80px Arial';c.fillStyle='#f5f4ec';c.fillText('olivetti',230,67,420);c.fillStyle='#191c1e';c.font='bold 74px Arial';c.fillText('lettera 32',735,67,540);
 const badgeTexture=new T.CanvasTexture(badgeCanvas);badgeTexture.encoding=T.sRGBEncoding;
 const badge=new T.Mesh(new T.PlaneGeometry(.097,.0121),new T.MeshStandardMaterial({map:badgeTexture,roughness:.42,metalness:.18}));badge.name='Lettera_Split_Badge';badge.position.set(0,.145,-.042);badge.rotation.x=-.76;root.add(badge);
 // Side seam follows the detachable cover edge instead of Hermes' front selector slots.
 for(const sign of [-1,1]){
  const pts=[new T.Vector3(sign*.224,.151,-.125),new T.Vector3(sign*.225,.142,-.075),new T.Vector3(sign*.224,.123,-.028)];
  const seam=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.00045,6,false),dark);seam.name='Lettera_Cover_Seam_'+sign;root.add(seam);
 }
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
