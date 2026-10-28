/* Deterministic short text streamlines. No browser, canvas, or learned model.
 * Coordinates are in cell units; physical cell height defaults to 1.5 cell widths.
 * Exported helpers attach to TypewriterStreamlines or module.exports.
 */
(function(root){
 'use strict';
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 function blur(src,W,H,r){
  const tmp=new Float32Array(src.length),out=new Float32Array(src.length),div=2*r+1;
  for(let y=0;y<H;y++){let s=0;for(let k=-r;k<=r;k++)s+=src[y*W+clamp(k,0,W-1)];for(let x=0;x<W;x++){tmp[y*W+x]=s/div;s+=src[y*W+clamp(x+r+1,0,W-1)]-src[y*W+clamp(x-r,0,W-1)];}}
  for(let x=0;x<W;x++){let s=0;for(let k=-r;k<=r;k++)s+=tmp[clamp(k,0,H-1)*W+x];for(let y=0;y<H;y++){out[y*W+x]=s/div;s+=tmp[clamp(y+r+1,0,H-1)*W+x]-tmp[clamp(y-r,0,H-1)*W+x];}}
  return out;
 }
 // A painted mask selects a direction, not a cut-out silhouette. Two box
 // filters create a smooth transition on both sides, at a scale tied to the
 // printed page rather than the resolution of the source mask.
 function featherMask(mask,cols,rows){
  const radius=Math.max(2,Math.round(cols*.022));
  const soft=blur(blur(mask,cols,rows,radius),cols,rows,radius);
  for(let i=0;i<soft.length;i++)soft[i]=soft[i]<.002?0:soft[i]>.998?1:soft[i];
  return soft;
 }
 function directionField(gray,width,height,cols,rows){
  const sm=blur(blur(gray,width,height,2),width,height,2),n=cols*rows;
  const xx=new Float32Array(n),xy=new Float32Array(n),yy=new Float32Array(n),hits=new Uint32Array(n),tone=new Float32Array(n);
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
   const i=y*width+x,gx=(sm[i+1]-sm[i-1])*.5,gy=(sm[i+width]-sm[i-width])*.5,j=Math.floor(y/height*rows)*cols+Math.floor(x/width*cols);
   xx[j]+=gx*gx;xy[j]+=gx*gy;yy[j]+=gy*gy;tone[j]+=sm[i];hits[j]++;
  }
  for(let i=0;i<n;i++){const d=Math.max(1,hits[i]);xx[i]/=d;xy[i]/=d;yy[i]/=d;tone[i]/=d;}
  const a=blur(xx,cols,rows,1),b=blur(xy,cols,rows,1),d=blur(yy,cols,rows,1);
  const angle=new Float32Array(n),confidence=new Float32Array(n),coherence=new Float32Array(n),energy=new Float32Array(n);
  for(let i=0;i<n;i++){
   const delta=Math.hypot(a[i]-d[i],2*b[i]);coherence[i]=delta/(a[i]+d[i]+1e-9);energy[i]=Math.sqrt(a[i]+d[i]);
   angle[i]=.5*Math.atan2(2*b[i],a[i]-d[i])+Math.PI/2;
   // Texture is weak after the blur. Strong vertical lines remain vertical.
   confidence[i]=clamp((coherence[i]-.25)/.65,0,1)*clamp((energy[i]-.0015)/.009,0,1);
  }
  const outlineAngle=new Float32Array(angle);
  if(root.TypewriterETF){
   // Refine an already smoothed field: paint cracks must not become garment folds.
   const etf=root.TypewriterETF.refine(sm,width,height,cols,rows,{maxDimension:640,iterations:2,radius:3,aspect:1.5});
   for(let i=0;i<n;i++){
    const support=etf.confidence[i]*clamp((energy[i]-.0015)/.009,0,1);
    if(support<.05)continue;
    const a=confidence[i],b=support;
    angle[i]=.5*Math.atan2(Math.sin(angle[i]*2)*a+Math.sin(etf.angle[i]*2)*b,Math.cos(angle[i]*2)*a+Math.cos(etf.angle[i]*2)*b);
    confidence[i]=Math.max(a,b);
   }
  }
  // Carry a nearby fold/hair direction through a smooth dark shadow. Without
  // this, energy=0 abruptly becomes horizontal even inside the same garment.
  // Confidence decays with distance; bright areas and luminance boundaries stop it.
  const extended=extendDarkDirections({cols,rows,angle,confidence,tone});
  // A single broad brightness step is an outline, not a sequence of folds.
  // Shorten tracing there instead of wrapping a continuous letter-ring around it.
  const boundary=new Float32Array(n);
  const at=(x,y)=>{const X=clamp(x,0,cols-1),Y=clamp(y,0,rows-1),x0=Math.floor(X),y0=Math.floor(Y),fx=X-x0,fy=Y-y0;return (tone[y0*cols+x0]*(1-fx)+tone[y0*cols+Math.min(cols-1,x0+1)]*fx)*(1-fy)+(tone[Math.min(rows-1,y0+1)*cols+x0]*(1-fx)+tone[Math.min(rows-1,y0+1)*cols+Math.min(cols-1,x0+1)]*fx)*fy;};
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const i=y*cols+x,nx=-Math.sin(outlineAngle[i]),ny=Math.cos(outlineAngle[i])/1.5,a=at(x+nx*1.8,y+ny*1.8),b=at(x-nx*1.8,y-ny*1.8),step=Math.abs(a-b),monotone=step/(Math.abs(a-tone[i])+Math.abs(b-tone[i])+1e-6);
   boundary[i]=clamp((step-.13)/.23,0,1)*clamp((monotone-.72)/.25,0,1)*coherence[i];
  }
  return {...extended,coherence,energy,boundary};
 }
 function extendDarkDirections({cols,rows,angle,confidence,tone,iterations=10}){
  const n=cols*rows,original=new Float32Array(confidence);let currentAngle=new Float32Array(angle),currentConfidence=new Float32Array(confidence);
  for(let pass=0;pass<iterations;pass++){
   const nextAngle=new Float32Array(currentAngle),nextConfidence=new Float32Array(currentConfidence);
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const i=y*cols+x;if(tone[i]>.62||original[i]>.48)continue;
    let cx=Math.cos(currentAngle[i]*2)*currentConfidence[i]*2,cy=Math.sin(currentAngle[i]*2)*currentConfidence[i]*2,w=currentConfidence[i]*2,peak=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const X=x+dx,Y=y+dy;if((!dx&&!dy)||X<0||Y<0||X>=cols||Y>=rows)continue;const j=Y*cols+X,delta=Math.abs(tone[j]-tone[i]);if(delta>.20)continue;
     const weight=currentConfidence[j]*(1-delta/.20)/(dx&&dy?1.414:1);cx+=Math.cos(currentAngle[j]*2)*weight;cy+=Math.sin(currentAngle[j]*2)*weight;w+=weight;peak=Math.max(peak,weight);
    }
    if(w<1e-6)continue;
    const consistency=Math.hypot(cx,cy)/w,candidate=Math.min(.60,peak*.94*consistency)*clamp((.70-tone[i])/.20,0,1);
    if(candidate>currentConfidence[i]+.005){nextAngle[i]=.5*Math.atan2(cy,cx);nextConfidence[i]=candidate;}
   }
   currentAngle=nextAngle;currentConfidence=nextConfidence;
  }
  return {angle:currentAngle,confidence:currentConfidence};
 }
 function balanceDensity(points,cols,rows,aspect=1.5){
  const bins=new Map(),radius=2.65,r2=radius*radius;
  for(const p of points){const key=Math.floor(p.x)+','+Math.floor(p.y);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);}
  const kernel=(dx,dy)=>{const d=dx*dx+dy*dy;if(d>=r2)return 0;return (1-d/r2)**2;};
  for(const p of points){let actual=0,regular=0;const X=Math.floor(p.x),Y=Math.floor(p.y);
   for(let y=Y-2;y<=Y+2;y++)for(let x=X-3;x<=X+3;x++){
    if(x>=0&&y>=0&&x<cols&&y<rows)regular+=kernel(x+.5-p.x,(y+.5-p.y)*aspect);
    for(const q of bins.get(x+','+y)||[])actual+=kernel(q.x-p.x,(q.y-p.y)*aspect);
   }
   p.inkWeight=clamp(regular/Math.max(.001,actual),.75,1.2);
  }
  return points;
 }
 function anchors({cols,rows,field,foreground,curve=true,aspect=1.5,maxRun=16,minRun=6,threshold=.25}){
  if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<1||rows<1)throw new Error('Invalid grid');
  if(!field||field.angle.length!==cols*rows||field.confidence.length!==cols*rows)throw new Error('Field/grid mismatch');
  const count=cols*rows,result=[],buckets=new Map(),runLengths=[];
  const mask=foreground||new Uint8Array(count).fill(1),inside=(x,y)=>x>=.45&&y>=.45&&x<=cols-.45&&y<=rows-.45;
  const cell=(x,y)=>clamp(Math.floor(y),0,rows-1)*cols+clamp(Math.floor(x),0,cols-1);
  const fg=(x,y)=>mask[cell(x,y)]>.001;
  const hash=(x,y)=>{let n=Math.imul(x+17,374761393)^Math.imul(y+29,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;};
  // Bilinear interpolation in doubled-angle space preserves an unoriented line.
  function sample(x,y,previous,mode){
   const X=x-.5,Y=y-.5,x0=Math.floor(X),y0=Math.floor(Y),fx=X-x0,fy=Y-y0;let cx=0,cy=0,c=0,subject=0;
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const i=clamp(y0+dy,0,rows-1)*cols+clamp(x0+dx,0,cols-1),w=(dx?fx:1-fx)*(dy?fy:1-fy),confidence=field.confidence[i];
    cx+=Math.cos(field.angle[i]*2)*confidence*w;cy+=Math.sin(field.angle[i]*2)*confidence*w;c+=confidence*w;subject+=mask[i]*w;
   }
   // Choose horizontal or structure-following lines once per run. The mask
   // mixes complete baselines instead of manufacturing intermediate angles.
   const angle=mode===0?0:.5*Math.atan2(cy,cx);let vx=Math.cos(angle),vy=Math.sin(angle);
   if(previous&&vx*previous[0]+vy*previous[1]<0){vx=-vx;vy=-vy;}
   return {vx,vy,subject,confidence:mode===0?1:c};
  }
  // Spacing tests use glyph advance/line spacing, in physical paper coordinates.
  function overlaps(p,q){
   const dx=p.x-q.x,dy=(p.y-q.y)*aspect,dist2=dx*dx+dy*dy;if(dist2>1.35*1.35)return false;
   const a=p.angle,b=q.angle,delta=clamp(Math.abs(Math.sin(a-b)),0,1);
   // At a crossing use a conservative circular radius instead of interleaving glyphs.
   if(delta>.55){
    const pi=cell(p.x,p.y),qi=cell(q.x,q.y),transition=(mask[pi]>.02&&mask[pi]<.98)||(mask[qi]>.02&&mask[qi]<.98)||(field.boundary?.[pi]||0)>.25||(field.boundary?.[qi]||0)>.25;
    const clearance=transition ? .98 : 1.12;return dist2<clearance*clearance;
   }
   const along=dx*Math.cos(a)+dy*Math.sin(a),normal=-dx*Math.sin(a)+dy*Math.cos(a);
   return along*along/(.88*.88)+normal*normal/(1.02*1.02)<1;
  }
  function clear(p,local=[]){
   if(!inside(p.x,p.y))return false;
   const bx=Math.floor(p.x),by=Math.floor(p.y);
   for(let y=by-1;y<=by+1;y++)for(let x=bx-2;x<=bx+2;x++)for(const q of buckets.get(x+','+y)||[])if(overlaps(p,q))return false;
   for(const q of local)if(overlaps(p,q))return false;
   return true;
  }
  function put(p){
   result.push(p);const key=Math.floor(p.x)+','+Math.floor(p.y),list=buckets.get(key);if(list)list.push(p);else buckets.set(key,[p]);
  }
  // Only the far background gets a fixed grid. The feather band shares the
  // same packing rules as the subject, avoiding a reserved empty seam.
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(!curve||!mask[y*cols+x])put({x:x+.5,y:y+.5,angle:0,run:-1});
  if(!curve)return {anchors:result,runLengths};
  const seeds=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;if(mask[i]>.001){const edge=field.boundary?.[i]||0,score=(.85+.15*field.confidence[i])*(1-edge*.65);if(score>=threshold)seeds.push({x:x+.5,y:y+.5,score,tie:hash(x,y)});}}
  seeds.sort((a,b)=>b.score-a.score||a.tie-b.tie);
  let run=0;
  function walk(seed,sign,limit,local,mode){
   const points=[];let p=seed,dir=[Math.cos(seed.angle)*sign,Math.sin(seed.angle)*sign];
   for(let k=0;k<limit;k++){
    const d=sample(p.x,p.y,dir,mode);if(d.confidence<threshold*.68)break;
    const half={x:p.x+d.vx*.5,y:p.y+d.vy*.5/aspect};
    if(!inside(half.x,half.y)||!fg(half.x,half.y))break;
    const mid=sample(half.x,half.y,[d.vx,d.vy],mode);if(mid.confidence<threshold*.68||(mode===0&&mid.subject>.95)||(mode===1&&mid.subject<.05))break;
    // Limit curvature per character, avoiding abrupt turns through noisy folds.
    const oldAngle=Math.atan2(dir[1],dir[0]);let nextAngle=Math.atan2(mid.vy,mid.vx),difference=Math.atan2(Math.sin(nextAngle-oldAngle),Math.cos(nextAngle-oldAngle));nextAngle=oldAngle+clamp(difference,-.28,.28);
    dir=[Math.cos(nextAngle),Math.sin(nextAngle)];
    const next={x:p.x+dir[0],y:p.y+dir[1]/aspect,angle:nextAngle,run};
    if(!inside(next.x,next.y)||!fg(next.x,next.y)||!clear(next,[...local,...points]))break;
    points.push(next);p=next;
   }
   return points;
  }
  for(const seed of seeds){
   const subject=mask[cell(seed.x,seed.y)],mode=subject>=.95?1:subject<=.05?0:((hash(Math.floor(seed.x/3)+101,Math.floor(seed.y/2)+53)/4294967296)<subject?1:0);
   const f=sample(seed.x,seed.y,undefined,mode),p={x:seed.x,y:seed.y,angle:Math.atan2(f.vy,f.vx),run};if(!clear(p))continue;
   const edge=field.boundary?.[cell(seed.x,seed.y)]||0;
   const runLimit=Math.round(maxRun-(maxRun-5)*edge),required=Math.min(minRun,runLimit);
   const left=walk(p,-1,Math.floor((runLimit-1)/2),[p],mode);
   const right=walk(p,1,runLimit-1-left.length,[p,...left],mode);
   const all=[...left.reverse(),p,...right];if(all.length<required)continue;
   // Normalize glyphs to a readable line direction without rotating the anchor offset.
   for(const q of all){while(q.angle>Math.PI/2)q.angle-=Math.PI;while(q.angle<-Math.PI/2)q.angle+=Math.PI;put(q);}
   runLengths.push(all.length);run++;
  }
  // Fill unoccupied regions. Do not force a new glyph underneath an existing run.
  // Small candidate shifts cover gaps without destroying a nearby continuous row.
  const fill=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(mask[y*cols+x])fill.push({x,y,tie:hash(x+71,y+31)});fill.sort((a,b)=>a.tie-b.tie);
  const offsets=[[0,0],[-.22,0],[.22,0],[0,-.16],[0,.16]];
  for(const seed of fill){
   for(const [dx,dy] of offsets){const x=seed.x+.5+dx,y=seed.y+.5+dy;if(!inside(x,y)||!fg(x,y))continue;
    const subject=mask[cell(x,y)],mode=subject>=.95?1:subject<=.05?0:((hash(Math.floor(x/3)+101,Math.floor(y/2)+53)/4294967296)<subject?1:0);
    const f=sample(x,y,undefined,mode),angle=f.confidence>=threshold?Math.atan2(f.vy,f.vx):0,p={x,y,angle,run:-1};
    if(clear(p)){put(p);break;}
   }
  }
  result.sort((a,b)=>Math.floor(a.y)-Math.floor(b.y)||a.x-b.x||a.y-b.y);
  balanceDensity(result,cols,rows,aspect);
  return {anchors:result,runLengths};
 }
 const api={directionField,extendDarkDirections,featherMask,balanceDensity,anchors};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TypewriterStreamlines=api;
})(typeof self==='undefined'?globalThis:self);
