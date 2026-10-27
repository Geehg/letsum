/* Visible-surface refinement only. Scene dimensions are authored web values;
 * original keyboard adaptation and articulated pivots remain unchanged. */
globalThis.LSRefineTypewriterDetails = function(T,root,model){
 const nodes={};root.traverse(o=>nodes[o.name]=o);
 function roundRect(x0,z0,x1,z1,r){const p=new T.Shape();p.moveTo(x0+r,z0);p.lineTo(x1-r,z0);p.quadraticCurveTo(x1,z0,x1,z0+r);p.lineTo(x1,z1-r);p.quadraticCurveTo(x1,z1,x1-r,z1);p.lineTo(x0+r,z1);p.quadraticCurveTo(x0,z1,x0,z1-r);p.lineTo(x0,z0+r);p.quadraticCurveTo(x0,z0,x0+r,z0);return p;}
 // Hermes: broad sloping apron, rounded outer shoulders and two distinct
 // inward-curled spool covers. Rebuilt shell, not an inflated old silhouette.
 if(model==='hermes3000'){
 const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 const cover=new T.Shape();cover.moveTo(-.194,-.021);cover.lineTo(.194,-.021);
 cover.quadraticCurveTo(.216,-.021,.215,-.043);cover.lineTo(.202,-.132);
 cover.quadraticCurveTo(.199,-.155,.177,-.155);cover.lineTo(-.177,-.155);
 cover.quadraticCurveTo(-.199,-.155,-.202,-.132);cover.lineTo(-.215,-.043);
 cover.quadraticCurveTo(-.216,-.021,-.194,-.021);
 const hole=new T.Path();hole.moveTo(-.020,-.151);hole.lineTo(.020,-.151);hole.lineTo(.021,-.139);
 hole.quadraticCurveTo(.024,-.128,.049,-.130);hole.lineTo(.086,-.136);
 hole.quadraticCurveTo(.120,-.140,.129,-.119);hole.quadraticCurveTo(.135,-.108,.115,-.098);
 hole.bezierCurveTo(.067,-.045,-.067,-.045,-.115,-.098);
 hole.quadraticCurveTo(-.135,-.108,-.129,-.119);hole.quadraticCurveTo(-.120,-.140,-.086,-.136);
 hole.lineTo(-.049,-.130);hole.quadraticCurveTo(-.024,-.128,-.021,-.139);hole.lineTo(-.020,-.151);cover.holes.push(hole);
 const hood=new T.ExtrudeGeometry(cover,{depth:.004,steps:1,bevelEnabled:true,bevelThickness:.0012,bevelSize:.0010,bevelSegments:5,curveSegments:24});
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
 const hoodY=z=>{const t=-z,a=t-.024,b=t-.079,e=.0035;return .109+.048*(Math.sqrt(a*a+e*e)+a-Math.sqrt(b*b+e*e)-b)/(.055*2)+.004*smooth(.079,.149,t)-.020*smooth(.08,.12,t);};
 const crown=(x,z)=>(.007+.007*Math.sin(Math.PI*Math.max(0,Math.min(1,(-z-.021)/.134))))*Math.max(0,1-(x/.218)**8);
 for(let i=0;i<hp.count;i++){const x=hp.getX(i),z=hp.getY(i),d=hp.getZ(i),n=normalSums.get(normalKeys[i]),e=.00001;
  const fx=(crown(x+e,z)-crown(x-e,z))/(2*e),fz=(hoodY(z+e)+crown(x,z+e)-hoodY(z-e)-crown(x,z-e))/(2*e);
  const mapped=new T.Vector3(n.x-fx*n.z,n.z,n.y-fz*n.z).normalize();mapped.toArray(transformedNormals,i*3);
  hp.setXYZ(i,x,hoodY(z)+d+crown(x,z),z);hood.attributes.uv.setXY(i,x*12,z*12);
 }
 hood.setAttribute('normal',new T.Float32BufferAttribute(transformedNormals,3));
 // XY -> XZ reverses handedness, so restore outward face winding.
 const hi=hood.index;if(hi){for(let i=0;i<hi.count;i+=3){const t=hi.getX(i+1);hi.setX(i+1,hi.getX(i+2));hi.setX(i+2,t);}}else{for(let i=0;i<hp.count;i+=3){for(const attr of Object.values(hood.attributes)){for(let c=0;c<attr.itemSize;c++){const a=(i+1)*attr.itemSize+c,b=(i+2)*attr.itemSize+c,t=attr.array[a];attr.array[a]=attr.array[b];attr.array[b]=t;}}}}

 nodes.Ribbon_Hood.geometry=hood;
 nodes.Ribbon_Hood.userData.opening={points:hole.getSpacedPoints(192).slice(0,-1).map(p=>[p.x,p.y]),height:(x,z)=>hoodY(z)+crown(x,z),depth:.004};
 // Rigid fittings lie on the sloping face rather than hovering in front of it.
 const badgeZ=-.049,e=.00001,slope=(hoodY(badgeZ+e)-hoodY(badgeZ-e))/(2*e),angle=-Math.atan2(1,-slope),faceNormal=new T.Vector3(0,-Math.sin(angle),Math.cos(angle));
 for(const name of ['Badge_Frame','Badge_Inlay','Hermes_Badge']){
  const o=nodes[name],offset=name==='Hermes_Badge'?.0035:name==='Badge_Inlay'?.0029:.002;
  o.position.set(0,hoodY(badgeZ)+crown(0,badgeZ)+.004,badgeZ);o.position.addScaledVector(faceNormal,offset);
  o.rotation.set(name==='Hermes_Badge'?angle+Math.PI/2:angle,0,0);
 }
 for(const o of Object.values(nodes))if(/^(Selector_|Ribbon_Dot)/.test(o.name)){
  const x=o.position.x,z=-.049-(o.position.y-.1364)*.9,localSlope=(hoodY(z+e)+crown(x,z+e)-hoodY(z-e)-crown(x,z-e))/(2*e),localAngle=-Math.atan2(1,-localSlope);
  o.position.set(x,hoodY(z)+crown(x,z)+.004,z);o.position.addScaledVector(new T.Vector3(0,-Math.sin(localAngle),Math.cos(localAngle)),o.name.startsWith('Selector_Slot')?.0007:.0025);o.rotation.x+=localAngle;
 }
 // Short, clear card fingers leave the spool shoulders and basket visible.
 for(const o of Object.values(nodes))if(/^Card_Holder_(Left|Right|Edge)/.test(o.name)){
  o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,.183-(.183-p.getY(i))*.45);p.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
 }
 // Fixed slots of the exposed segment. The 47 animated typebars keep their pivots.
 const segmentMetal=new T.MeshStandardMaterial({name:'Hermes_Segment_Steel',color:0x879084,metalness:.94,roughness:.31});
 for(let i=0;i<48;i++){
  const a=-1.38+i*2.76/47,points=[.028,.049,.074,.095].map(r=>new T.Vector3(Math.sin(a)*r,.151+Math.cos(a)*.002+(r-.028)*.06,-.125+Math.cos(a)*r*.62));
  const rib=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.00052,5,false),segmentMetal);rib.name='Hermes_Segment_Divider_'+i;nodes.Typebasket.add(rib);
 }

 }
 if(model!=='hermes3000')for(const o of Object.values(nodes))if(/^Card_Holder_(Left|Right|Edge)/.test(o.name)){
  o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,.183-(.183-p.getY(i))*.45);p.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
 }
 // Smooth duplicated import vertices on the cast shell, while retaining sharp
 // folded edges. This removes polygon-shaped highlight patches at the corners.
 if(model==='hermes3000')for(const name of ['Ribbon_Hood','Cast_Perimeter']){
  const mesh=nodes[name];mesh.geometry=mesh.geometry.clone();const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,groups=new Map();
  for(let i=0;i<p.count;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
  const original=n.array.slice();for(const indices of groups.values())for(const i of indices){const base=new T.Vector3().fromArray(original,i*3),sum=new T.Vector3();for(const j of indices){const next=new T.Vector3().fromArray(original,j*3);if(base.dot(next)>.70)sum.add(next);}sum.normalize();n.setXYZ(i,sum.x,sum.y,sum.z);}n.needsUpdate=true;
 }
 // A shallow spoon crown on the broad return paddles gives real changing
 // metal reflections across the face instead of a uniformly grey flat plate.
 for(const name of ['Lettera_Return_Paddle','Olympia_Return_Lever']){
  const o=nodes[name];if(!o)continue;o.geometry=o.geometry.clone();const g=o.geometry,p=g.attributes.position,n=g.attributes.normal;
  const height=(x,z)=>{const u=(z-x)/Math.SQRT2,v=(x+z)/Math.SQRT2,t=Math.max(0,Math.min(1,(u-.035)/.065));return .0022*t*t*(3-2*t)*Math.max(0,1-(v/.011)**2);};
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),e=.00001,dx=(height(x+e,z)-height(x-e,z))/(2*e),dz=(height(x,z+e)-height(x,z-e))/(2*e),normal=new T.Vector3(n.getX(i)-dx*n.getY(i),n.getY(i),n.getZ(i)-dz*n.getY(i)).normalize();p.setY(i,p.getY(i)+height(x,z));n.setXYZ(i,normal.x,normal.y,normal.z);}
  p.needsUpdate=n.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
 }
 // Corresponding straight/corner samples avoid twisted quads. Long keys keep
 // a long central crown instead of collapsing all their top faces to one point.
 const cache=new Map(),lettera=model==='lettera32',olympia=model==='olympiasm3';
 root.traverse(o=>{
  if(!o.isMesh||!o.name.startsWith('Cap_'))return;
  o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,w=(b.max.x-b.min.x)/2,d=(b.max.z-b.min.z)/2;
  const id=w+':'+d;
  if(!cache.has(id)){
   const bottom=lettera?-.0048:olympia?-.0071:-.0085,peak=lettera?.0058:olympia?.0066:.0072,center=lettera?.0049:olympia?.0055:.0060;
   const core=Math.max(.00005,w-d),r=Math.min(lettera?.0036:olympia?.0045:.0033,d*.44),N=96,positions=[],index=[];
   const profile=lettera?[[w-.0005,d-.0005,bottom],[w,d,bottom+.001],[w-.0003,d-.0003,.0028],[w-.0007,d-.0007,peak-.001],[w-.0011,d-.0011,peak-.0003],[w-.0015,d-.0015,peak],[w-.0022,d-.0022,peak-.0002],[w-.0033,d-.0033,center+.0001],[core+.0012,.0012,center]]:!olympia?[[w-.001,d-.001,bottom],[w,d,bottom+.0013],[w-.0004,d-.0004,.0044],[w-.00065,d-.00065,peak-.0008],[w-.001,d-.001,peak-.0002],[w-.0014,d-.0014,peak],[w-.002,d-.002,peak-.0003],[w-.0032,d-.0032,center+.0002],[core+.0012,.0012,center]]:[[w-.0006,d-.0006,bottom],[w,d,bottom+.0014],[w-.00025,d-.00025,.0016],[w-.0007,d-.0007,peak-.0018],[w-.0013,d-.0013,peak-.00045],[w-.0020,d-.0020,peak],[w-.0027,d-.0027,peak-.0003],[w-.0038,d-.0038,center+.0002],[core+.0012,.0012,center]];
   for(const [x,z,y] of profile){const path=roundRect(-x,-z,x,z,Math.min(r,z*.8));for(const c of path.curves)for(let k=0;k<N/8;k++){const p=c.getPoint(k/(N/8));positions.push(p.x,y,p.y);}}
   const M=profile.length;
   for(let j=0;j<M-1;j++)for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N,c=(j+1)*N+(i+1)%N,d=(j+1)*N+i;index.push(a,d,b,b,d,c);}
   const baseCenter=positions.length/3;positions.push(0,bottom,0,0,center,0);
   for(let i=0;i<N;i++){const next=(i+1)%N;index.push(baseCenter,i,next,baseCenter+1,(M-1)*N+next,(M-1)*N+i);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(index);g.computeVertexNormals();
   // Local tangents produce continuous normals without the diagonal shading
   // bias of wide, skinny triangles across the space bar and modifier crowns.
   const p=g.attributes.position,old=g.attributes.normal,n=new Float32Array(p.count*3),v=(j,i)=>j<0?new T.Vector3(0,bottom,0):j>=M?new T.Vector3(0,center,0):new T.Vector3().fromBufferAttribute(p,j*N+(i+N)%N);
   for(let j=0;j<M;j++)for(let i=0;i<N;i++){const along=v(j,i+1).sub(v(j,i-1)),across=v(j+1,i).sub(v(j-1,i)),normal=along.cross(across).normalize(),k=j*N+i;if(normal.dot(new T.Vector3().fromBufferAttribute(old,k))<0)normal.negate();normal.toArray(n,k*3);}
   new T.Vector3(0,-1,0).toArray(n,baseCenter*3);new T.Vector3(0,1,0).toArray(n,(baseCenter+1)*3);
   g.setAttribute('normal',new T.Float32BufferAttribute(n,3));cache.set(id,g);
  }
  o.geometry=cache.get(id);
 });
 // Lay each existing legend onto its dished crown; raising all labels by a
 // fixed offset either buried strokes under the rim or left them floating.
 root.updateMatrixWorld(true);
 root.traverse(o=>{
  if(!o.isMesh||!o.name.startsWith('Glyph_'))return;
  const cap=nodes['Cap_'+o.name.slice(6)];if(!cap)return;
  o.geometry=o.geometry.clone();const p=o.geometry.attributes.position,local=o.matrix.clone(),inverse=local.clone().invert(),unrotate=cap.quaternion.clone().invert();
  cap.geometry.computeBoundingBox();const b=cap.geometry.boundingBox,w=(b.max.x-b.min.x)/2,d=(b.max.z-b.min.z)/2,peak=lettera?.0058:olympia?.0066:.0072,center=lettera?.0049:olympia?.0055:.0060;
  const mix=(a,b,t)=>a+(b-a)*Math.max(0,Math.min(1,t));
  for(let i=0;i<p.count;i++){
   const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(local).applyQuaternion(unrotate),inset=Math.min(w-Math.abs(v.x),d-Math.abs(v.z));
   const [a,b,c]=lettera?[.0015,.0022,.0033]:olympia?[.002,.0027,.0038]:[.0014,.002,.0032];
   const y=inset<b?mix(peak,peak-.0003,(inset-a)/(b-a)):inset<c?mix(peak-.0003,center+.0002,(inset-b)/(c-b)):mix(center+.0002,center,(inset-c)/Math.max(.001,d-.005));
   v.y=y+.00016;v.applyQuaternion(cap.quaternion).applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
  }
  p.needsUpdate=true;o.geometry.computeVertexNormals();
 });
 // Hermes has an inset metal-framed nameplate, distinct from the painted cover.
 if(model==='hermes3000'){
  const metal=new T.MeshStandardMaterial({name:'Hermes_Badge_Metal',color:0xb7c0bb,metalness:1,roughness:.16});
  const frame=nodes.Badge_Frame,path=roundRect(-.0555,-.00625,.0555,.00625,.0018),hole=roundRect(-.0534,-.0045,.0534,.0045,.0011);path.holes.push(new T.Path(hole.getPoints(32)));
  const g=new T.ExtrudeGeometry(path,{depth:.0012,bevelEnabled:true,bevelThickness:.0003,bevelSize:.0003,bevelSegments:3,curveSegments:12});g.translate(0,0,-.0006);frame.geometry=g;frame.material=metal;
  nodes.Badge_Inlay.material=new T.MeshStandardMaterial({name:'Hermes_Badge_Inlay',color:new T.Color(.23,.29,.25),metalness:.22,roughness:.40});
  const letters=nodes.Hermes_Badge;letters.geometry=letters.geometry.clone();const p=letters.geometry.attributes.position;for(let i=0;i<p.count;i++){p.setY(i,p.getY(i)*24);p.setX(i,p.getX(i)*1.28);};p.needsUpdate=true;letters.geometry.computeVertexNormals();letters.material=metal;
 }
 // Metal thickness behind the Lettera's printed split badge catches a restrained edge reflection.
 if(lettera){const badge=nodes.Lettera_Split_Badge,shape=roundRect(-.0488,-.0063,.0488,.0063,.00065),g=new T.ExtrudeGeometry(shape,{depth:.0008,bevelEnabled:true,bevelSize:.00025,bevelThickness:.0002,bevelSegments:3,curveSegments:8});g.translate(0,0,-.0015);const backing=new T.Mesh(g,new T.MeshStandardMaterial({name:'Lettera_Badge_Edge',color:0xa5adb0,metalness:1,roughness:.27}));backing.name='Lettera_Badge_Backing';badge.add(backing);}
 // Rebuild visible assembly interfaces from separate folded/rolled parts.
 // Keep the existing moving bars and strike pivots; do not stack a second fan on them.
 const enamel=nodes.Ribbon_Hood.material,steel=new T.MeshStandardMaterial({name:'Assembly_Machined_Steel',color:0x6b7274,metalness:.91,roughness:.30}),edgeSteel=new T.MeshStandardMaterial({name:'Assembly_Chrome_Edge',color:0x9ba1a3,metalness:1,roughness:.17}),blackened=new T.MeshStandardMaterial({name:'Assembly_Blackened_Steel',color:0x15191a,metalness:.44,roughness:.44});
 const innerPaint=enamel.clone();innerPaint.name='Assembly_Inner_Paint';innerPaint.color.setRGB(...(model==='hermes3000'?[.075,.10,.075]:model==='lettera32'?[.08,.132,.164]:[.037,.043,.032]));innerPaint.roughness=Math.max(.40,enamel.roughness);innerPaint.clearcoat=.12;
 const opening=nodes.Ribbon_Hood.userData.opening;
 if(opening){
  // Four corresponding rings close a thin downturned flange below the cut edge.
  // Its normals and thickness are independent of the broad painted lid.
  const p=[],uv=[],ix=[],N=opening.points.length;
  for(const [offset,drop] of [[.0002,.0001],[.0007,.008],[.0015,.008],[.0010,.0001]])for(let i=0;i<N;i++){
   const [x,z]=opening.points[i],[ax,az]=opening.points[(i+N-1)%N],[bx,bz]=opening.points[(i+1)%N],dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz)||1;
   p.push(x-dz/l*offset,opening.height(x,z)-drop,z+dx/l*offset);uv.push(i/N,drop*80);
  }
  for(let j=0;j<4;j++)for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N,c=((j+1)%4)*N+(i+1)%N,d=((j+1)%4)*N+i;ix.push(a,b,d,b,c,d);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
  const flange=new T.Mesh(g,innerPaint);flange.name='Opening_Folded_Flange';flange.material.side=T.DoubleSide;root.add(flange);
 }
 // Remove the long decorative spokes above the real bars. Short closed steel
 // separators only occupy the outer segment, leaving air between the moving arms.
 root.traverse(o=>{
  if(!/^(Hermes|Lettera|Olympia)_Segment_Divider_/.test(o.name))return;
  const i=Number(o.name.split('_').at(-1)),a=-1.26+i*2.52/47,r=.087;
  const g=new T.BoxGeometry(.00065,.0025,.009);g.rotateY(-a);g.translate(Math.sin(a)*r,.128,-.119+Math.cos(a)*r*.64);o.geometry=g;o.material=steel;
 });
 // Shallow dark spool flanges replace featureless cylinders, largely enclosed by the cover wings.
 for(const [index,name] of ['Ribbon_Spool','Ribbon_Spool001'].entries()){
  const spool=nodes[name];if(!spool)continue;
  spool.geometry=new T.CylinderGeometry(.023,.023,.007,64);spool.material=blackened;spool.quaternion.identity();spool.position.set(index? .103:-.103,.128,-.103);
  for(const y of [-.0038,.0038]){const flange=new T.Mesh(new T.CylinderGeometry(.0245,.0245,.00065,64),blackened);flange.name='Spool_Flange';flange.position.y=y;spool.add(flange);}
  const hub=new T.Mesh(new T.CylinderGeometry(.004,.004,.001,32),steel);hub.name='Spool_Hub';hub.position.y=.0046;spool.add(hub);
 }
 // Machined side bearing plates: shaped metal edges, a real shaft opening and
 // separate collars rather than the original rectangular end blocks.
 for(const side of ['L','R']){
  const cheek=nodes['Carriage_End_Cheek_'+side];if(!cheek)continue;
  const profile=roundRect(-.025,-.024,.025,.024,.006),hole=new T.Path();hole.absarc(.008,.003,.006,0,Math.PI*2,true);profile.holes.push(hole);
  const g=new T.ExtrudeGeometry(profile,{depth:.004,bevelEnabled:true,bevelSize:.00055,bevelThickness:.0004,bevelSegments:3,curveSegments:32}),p=g.attributes.position,n=g.attributes.normal;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),nx=n.getX(i),nz=n.getZ(i);p.setXYZ(i,z-.002,p.getY(i),x);n.setXYZ(i,nz,n.getY(i),nx);}
  const idx=g.index;if(idx){for(let i=0;i<idx.count;i+=3){const a=idx.getX(i+1);idx.setX(i+1,idx.getX(i+2));idx.setX(i+2,a);}}else for(let i=0;i<p.count;i+=3)for(const attr of Object.values(g.attributes))for(let k=0;k<attr.itemSize;k++){const a=(i+1)*attr.itemSize+k,b=(i+2)*attr.itemSize+k,v=attr.array[a];attr.array[a]=attr.array[b];attr.array[b]=v;}
  cheek.geometry=g;cheek.material=steel;
  const collar=new T.Mesh(new T.TorusGeometry(.0076,.0011,12,48),edgeSteel);collar.name='Carriage_Bearing_Collar_'+side;collar.rotation.y=Math.PI/2;collar.position.set(side==='L'?-.0028:.0028,.003,.008);cheek.add(collar);
  for(const [y,z] of [[.017,-.014],[-.016,.014]]){
   const screw=new T.Mesh(new T.CylinderGeometry(.0017,.0017,.0008,20),edgeSteel);screw.rotation.z=Math.PI/2;screw.position.set(side==='L'?-.0028:.0028,y,z);screw.name='Carriage_Plate_Fastener_'+side;cheek.add(screw);
   const slot=new T.Mesh(new T.BoxGeometry(.0002,.00035,.0022),blackened);slot.position.set(side==='L'?-.0033:.0033,y,z);slot.name='Carriage_Fastener_Slot_'+side;cheek.add(slot);
  }
 }
 // Pressed central segment shield with a curved front and rolled edge. Its
 // underside sits below the typebars; the ribbon lift remains a separate moving part.
 const shieldShape=new T.Shape();shieldShape.moveTo(-.024,-.116);shieldShape.lineTo(.024,-.116);shieldShape.bezierCurveTo(.022,-.103,.013,-.093,0,-.092);shieldShape.bezierCurveTo(-.013,-.093,-.022,-.103,-.024,-.116);
 const shieldGeo=new T.ExtrudeGeometry(shieldShape,{depth:.00075,bevelEnabled:true,bevelThickness:.00035,bevelSize:.00045,bevelSegments:3,curveSegments:32});shieldGeo.rotateX(Math.PI/2);
 const shield=model==='olympiasm3'?nodes.Olympia_Central_Shield:nodes.Type_Guide_Shield;
 if(shield){shield.geometry=shieldGeo;shield.position.set(0,.143,0);shield.quaternion.identity();shield.material=steel;}
 for(const name of ['Type_Guide_Fork','Type_Guide_Fork001']){
  const fork=nodes[name];if(!fork)continue;
  const g=new T.ExtrudeGeometry(roundRect(-.00105,-.0092,.00105,.0092,.00065),{depth:.0011,bevelEnabled:true,bevelThickness:.0002,bevelSize:.0002,bevelSegments:3,curveSegments:12});g.translate(0,0,-.00055);fork.geometry=g;fork.material=edgeSteel;
 }

 // Route the fabric behind the inward cover wings and into the rebuilt spool
 // edges. The original diagonal run crossed the opening like broad black wedges.
 const ribbonRoute=[[0,.1535,-.116],[.012,.1535,-.116],[.040,.151,-.119],[.076,.149,-.121],[.101,.144,-.120],[.125,.132,-.103]];
 const oldRoute=[[0,.1535],[.012,.1535],[.040,.149],[.076,.146],[.101,.145],[.125,.144]];
 const interpolate=(rows,x,column)=>{for(let i=1;i<rows.length;i++)if(x<=rows[i][0]+1e-7){const t=Math.max(0,Math.min(1,(x-rows[i-1][0])/(rows[i][0]-rows[i-1][0])));return rows[i-1][column]+(rows[i][column]-rows[i-1][column])*t;}return rows.at(-1)[column];};
 for(const name of ['Ribbon_Path_Black','Ribbon_Path_Red']){
  const ribbon=nodes[name];ribbon.geometry=ribbon.geometry.clone();const g=ribbon.geometry,p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=Math.abs(p.getX(i));p.setXYZ(i,p.getX(i),p.getY(i)+interpolate(ribbonRoute,x,1)-interpolate(oldRoute,x,1),interpolate(ribbonRoute,x,2));}
  p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 }

 root.userData.assemblyRevision=1;

 root.userData.finishRevision=4;
 return root;
};
