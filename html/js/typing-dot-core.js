/* LETSUM Dot Retro — deterministic, local two-colour print renderer.
 * No image, network, font, model or DOM dependencies. Shared by worker and tests. */
(() => {
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const number=(v,f,a,b)=>Number.isFinite(Number(v))?clamp(Number(v),a,b):f;
 function color(hex,fallback){return /^#[\da-f]{6}$/i.test(hex||'')?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)):fallback;}
 function noise(x,y){let n=Math.imul(x+1,374761393)^Math.imul(y+1,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
 function render({width:w,height:h,rgba,settings={}}){
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>2400||h>2400||!(rgba instanceof Uint8ClampedArray)||rgba.length!==w*h*4)throw Error('이미지 크기를 확인해 주세요. 최대 2400px까지 지원합니다.');
  const mode=['grain','diffusion','halftone'].includes(settings.mode)?settings.mode:'grain';
  const contrast=number(settings.contrast,115,40,200)/100,brightness=number(settings.brightness,0,-50,50)/100;
  const step=Math.max(1,Math.round(number(settings.dot,2,1,12)*Math.max(w,h)/1200));
  const gw=Math.ceil(w/step),gh=Math.ceil(h/step),tone=new Float32Array(gw*gh),alpha=new Float32Array(gw*gh);
  // Average before thresholding, so small features and semi-transparent edges survive.
  for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){
   let sum=0,coverage=0,count=0;
   for(let y=gy*step;y<Math.min(h,(gy+1)*step);y++)for(let x=gx*step;x<Math.min(w,(gx+1)*step);x++){
    const i=(y*w+x)*4,a=rgba[i+3]/255,l=(rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722)/255;
    sum+=a*(1-clamp((l-.5)*contrast+.5+brightness));coverage+=a;count++;
   }
   const p=gy*gw+gx;tone[p]=sum/count;alpha[p]=coverage/count;
  }
  const ink=color(settings.ink,[42,38,124]),paper=color(settings.paper,[239,216,221]),out=new Uint8ClampedArray(w*h*4);
  const radii=new Float32Array(256);
  if(mode==='halftone')for(let i=1;i<256;i++){
   const target=i/255;let lo=0,hi=Math.SQRT1_2;
   for(let j=0;j<18;j++){const r=(lo+hi)/2,r2=r*r,area=r<=.5?Math.PI*r2:Math.PI*r2-4*(r2*Math.acos(.5/r)-.5*Math.sqrt(r2-.25));if(area<target)lo=r;else hi=r;}
   radii[i]=((lo+hi)/2)**2;
  }
  // Two scanlines of error rather than a second full-size floating-point image.
  let current=new Float32Array(gw+2),next=new Float32Array(gw+2);
  const write=(x,y,on,a)=>{const p=(y*w+x)*4,c=on?ink:paper;out[p]=c[0];out[p+1]=c[1];out[p+2]=c[2];out[p+3]=on?Math.round(a*255):(settings.transparent?0:255);};
  for(let gy=0;gy<gh;gy++){
   const reverse=gy%2===1,dir=reverse?-1:1;
   for(let k=0;k<gw;k++){
    const gx=reverse?gw-1-k:k,p=gy*gw+gx,base=tone[p],a=alpha[p];
    let on=false;
    if(mode==='diffusion'){
     const v=clamp(base+current[gx+1]);on=base>0&&(base===1||v>=.5);
     const e=(base===0||base===1)?0:v-(on?1:0);
     current[gx+1+dir]+=e*7/16;next[gx+1-dir]+=e*3/16;next[gx+1]+=e*5/16;next[gx+1+dir]+=e/16;
    }else on=base>noise(gx,gy);
    for(let y=gy*step;y<Math.min(h,(gy+1)*step);y++)for(let x=gx*step;x<Math.min(w,(gx+1)*step);x++){
     if(mode==='halftone'){
      // Discs touch and merge in shadows; full white and full black remain exact.
      const dx=(x+.5-(gx+.5)*step)/step,dy=(y+.5-(gy+.5)*step)/step;
      on=base===1||(base>0&&dx*dx+dy*dy<radii[Math.round(base*255)]);
     }
     // Alpha already contributes to ink coverage. Do not multiply it twice.
     write(x,y,on,a>0?1:0);
    }
   }
   const swap=current;current=next;next=swap;next.fill(0);
  }
  return {rgba:out,width:w,height:h,workingBytes:rgba.byteLength+out.byteLength+tone.byteLength+alpha.byteLength+current.byteLength+next.byteLength};
 }
 globalThis.DotRetro={render};
})();
