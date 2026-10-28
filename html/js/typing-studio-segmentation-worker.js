/* Local foreground guidance. OpenCV 4.13.0 (Apache-2.0), no image upload. */
'use strict';
let ready;
function loadCV(){
 return ready ||= new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('runtime timeout')),20000);
  const done=cv=>{clearTimeout(timer);resolve({cv});}; // cv is a self-returning thenable.
  self.Module={onAbort:error=>{clearTimeout(timer);reject(Error(String(error)));}};
  try{importScripts('vendor/opencv-4.13.0.js');const module=self.cv;
   if(module.Mat)done(module);else if(typeof module.then==='function')module.then(done);else throw Error('runtime unavailable');
  }catch(error){clearTimeout(timer);reject(error);}
 });
}
function refine(cv,{rgba,width,height,bounds,mask,guidance}){
 if(width!==240||height!==351||rgba?.length!==width*height*4||mask?.length!==width*height||guidance?.length!==width*height)throw Error('invalid input');
 const allocations=[],mat=(...args)=>{const m=new cv.Mat(...args);allocations.push(m);return m;};
 const src=mat(height,width,cv.CV_8UC4),rgb=mat(),smooth=mat(),labels=mat(height,width,cv.CV_8UC1),bg=mat(),fg=mat();
 const binary=mat(height,width,cv.CV_8UC1),inverse=mat(height,width,cv.CV_8UC1),inside=mat(),outside=mat();
 try{
  src.data.set(rgba);cv.cvtColor(src,rgb,cv.COLOR_RGBA2RGB);cv.bilateralFilter(rgb,smooth,3,25,2,cv.BORDER_DEFAULT);
  const b=bounds||{x:0,y:0,width,height};let foreground=0,background=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=y*width+x;
   // The ellipse is only a probable prior, never a claim of object recognition.
   let label=mask[i]>127?cv.GC_PR_FGD:cv.GC_PR_BGD;
   const padding=x+.5<b.x||x+.5>=b.x+b.width||y+.5<b.y||y+.5>=b.y+b.height;
   const corner=y<height*.035&&(x<width*.08||x>width*.92);
   if(padding||corner)label=cv.GC_BGD;
   if(guidance[i]===255)label=cv.GC_FGD;else if(guidance[i]===128)label=cv.GC_BGD;
   labels.data[i]=label;if(label&1)foreground++;else background++;
  }
  if(foreground<5||background<5)throw Error('both regions required');
  cv.setRNGSeed(1337);cv.grabCut(smooth,labels,new cv.Rect(0,0,width,height),bg,fg,3,cv.GC_INIT_WITH_MASK);
  let count=0;for(let i=0;i<labels.data.length;i++){const v=labels.data[i]&1?255:0;binary.data[i]=v;inverse.data[i]=255-v;if(v)count++;}
  if(count<25||count>width*height-25)throw Error('ambiguous foreground');
  cv.distanceTransform(binary,inside,cv.DIST_L2,3);cv.distanceTransform(inverse,outside,cv.DIST_L2,3);
  const result=new Uint8Array(width*height),radius=10;
  for(let i=0;i<result.length;i++){
   // Signed distance blends the direction preference, never image opacity.
   const d=inside.data32F[i]-outside.data32F[i],t=Math.max(0,Math.min(1,.5+d/(radius*2)));
   result[i]=Math.round(t*t*(3-2*t)*255);
   if(guidance[i]===255)result[i]=255;else if(guidance[i]===128)result[i]=0;
  }
  return result;
 }finally{for(const m of allocations)m.delete();}
}
let running=false;
self.onmessage=async({data})=>{
 if(running)return;running=true;const id=data?.id;
 try{self.postMessage({id,type:'loading'});const {cv}=await loadCV();self.postMessage({id,type:'processing'});
  const mask=refine(cv,data||{});self.postMessage({id,type:'complete',mask},[mask.buffer]);
 }catch(error){self.postMessage({id,type:'error',reason:error.message==='both regions required'?'regions':'unavailable'});}
 finally{running=false;}
};
