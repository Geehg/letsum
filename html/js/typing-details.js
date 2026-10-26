/* Visible-surface refinement only. Scene dimensions are authored web values;
 * original keyboard adaptation and articulated pivots remain unchanged. */
globalThis.LSRefineTypewriterDetails = function(T,root,model){
 const nodes={};root.traverse(o=>nodes[o.name]=o);
 function roundRect(x0,z0,x1,z1,r){const p=new T.Shape();p.moveTo(x0+r,z0);p.lineTo(x1-r,z0);p.quadraticCurveTo(x1,z0,x1,z0+r);p.lineTo(x1,z1-r);p.quadraticCurveTo(x1,z1,x1-r,z1);p.lineTo(x0+r,z1);p.quadraticCurveTo(x0,z1,x0,z1-r);p.lineTo(x0,z0+r);p.quadraticCurveTo(x0,z0,x0+r,z0);return p;}
 // A continuous crown and a bowed apron, rather than a uniformly inflated cover.
 // Authored to the supplied reference; values are scene units, not factory CAD.
 if(model==='hermes3000'){
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  const shape=(x,y,z)=>{
   const cross=Math.max(0,1-(x/.214)**2),front=smooth(-.075,-.025,z);
   return new T.Vector3(x*(1-.045*cross*(1-front)),
    y+.010*cross*Math.sin(Math.PI*smooth(-.145,-.025,z))*smooth(.112,.156,y),
    z+.006*cross*front*Math.exp(-(((y-.137)/.026)**2)));
  };
  const mesh=nodes.Ribbon_Hood,source=mesh.geometry;
  // One shared-edge subdivision gives the broad apron interior vertices for
  // actual curvature, instead of bending only the imported perimeter vertices.
  const attributes=Object.fromEntries(Object.entries(source.attributes).map(([k,a])=>[k,{size:a.itemSize,data:Array.from(a.array)}]));
  const input=source.index.array,indices=[],midpoints=new Map();
  const midpoint=(a,b)=>{const key=a<b?a+':'+b:b+':'+a;if(midpoints.has(key))return midpoints.get(key);const id=attributes.position.data.length/3;for(const {size,data} of Object.values(attributes))for(let j=0;j<size;j++)data.push((data[a*size+j]+data[b*size+j])/2);midpoints.set(key,id);return id;};
  for(let i=0;i<input.length;i+=3){const a=input[i],b=input[i+1],c=input[i+2],ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
  const g=new T.BufferGeometry();for(const [k,{size,data}] of Object.entries(attributes))g.setAttribute(k,new T.Float32BufferAttribute(data,size));g.setIndex(indices);mesh.geometry=g;
  const p=g.attributes.position,n=g.attributes.normal;
  const h=.000001;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=shape(x+h,y,z).sub(shape(x-h,y,z)).multiplyScalar(.5/h),b=shape(x,y+h,z).sub(shape(x,y-h,z)).multiplyScalar(.5/h),c=shape(x,y,z+h).sub(shape(x,y,z-h)).multiplyScalar(.5/h);
   const normal=b.clone().cross(c).multiplyScalar(n.getX(i)).add(c.clone().cross(a).multiplyScalar(n.getY(i))).add(a.clone().cross(b).multiplyScalar(n.getZ(i))).normalize();
   const q=shape(x,y,z);p.setXYZ(i,q.x,q.y,q.z);n.setXYZ(i,normal.x,normal.y,normal.z);
  }
  p.needsUpdate=n.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
  for(const o of Object.values(nodes))if(/^(Badge_|Hermes_Badge|Selector_|Ribbon_Dot)/.test(o.name)){
   const p=o.position;o.position.copy(shape(p.x,p.y,p.z));
  }

 }
 // Smooth duplicated import vertices on the cast shell, while retaining sharp
 // folded edges. This removes polygon-shaped highlight patches at the corners.
 if(model==='hermes3000')for(const name of ['Ribbon_Hood','Cast_Perimeter']){
  const mesh=nodes[name];mesh.geometry=mesh.geometry.clone();const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,groups=new Map();
  for(let i=0;i<p.count;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
  const original=n.array.slice();for(const indices of groups.values())for(const i of indices){const base=new T.Vector3().fromArray(original,i*3),sum=new T.Vector3();for(const j of indices){const next=new T.Vector3().fromArray(original,j*3);if(base.dot(next)>.70)sum.add(next);}sum.normalize();n.setXYZ(i,sum.x,sum.y,sum.z);}n.needsUpdate=true;
 }
 // Corresponding straight/corner samples avoid twisted quads. Long keys keep
 // a long central crown instead of collapsing all their top faces to one point.
 const cache=new Map(),lettera=model==='lettera32',olympia=model==='olympiasm3';
 root.traverse(o=>{
  if(!o.isMesh||!o.name.startsWith('Cap_'))return;
  o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,w=(b.max.x-b.min.x)/2,d=(b.max.z-b.min.z)/2;
  const id=w+':'+d;
  if(!cache.has(id)){
   const bottom=lettera?-.0058:olympia?-.0092:-.0085,peak=lettera?.0060:olympia?.0074:.0072,center=lettera?.0048:olympia?.0051:.0060;
   const core=Math.max(.00005,w-d),r=Math.min(lettera||olympia?.0037:.0045,d*.48),N=96,positions=[],index=[];
   const profile=[[w-.0006,d-.0006,bottom],[w,d,bottom+.0014],[w-.00025,d-.00025,.0016],[w-.0007,d-.0007,peak-.0018],[w-.0013,d-.0013,peak-.00045],[w-.0020,d-.0020,peak],[w-.0027,d-.0027,peak-.0003],[w-.0038,d-.0038,center+.0002],[core+.0012,.0012,center]];
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
  cap.geometry.computeBoundingBox();const b=cap.geometry.boundingBox,w=(b.max.x-b.min.x)/2,d=(b.max.z-b.min.z)/2,peak=lettera?.0060:olympia?.0074:.0072,center=lettera?.0048:olympia?.0051:.0060;
  const mix=(a,b,t)=>a+(b-a)*Math.max(0,Math.min(1,t));
  for(let i=0;i<p.count;i++){
   const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(local).applyQuaternion(unrotate),inset=Math.min(w-Math.abs(v.x),d-Math.abs(v.z));
   const y=inset<.0027?mix(peak,peak-.0003,(inset-.002)/.0007):inset<.0038?mix(peak-.0003,center+.0002,(inset-.0027)/.0011):mix(center+.0002,center,(inset-.0038)/Math.max(.001,d-.005));
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
 root.userData.finishRevision=2;
 return root;
};
