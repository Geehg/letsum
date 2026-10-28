/* Deterministic, local tone/shape matching. No learned model or network calls. */
(function(root){
 'use strict';
 const W=40,H=60,SW=6,SH=9;
 const glyphs=[' ','.',',',"'",'`',':',';','-','_','/','\\','|','(',')','i','l','t','+','x','v','o','s','a','e','n','c','u','*','#','%','&','M','W','B','8','@'];
 const patterns=glyphs.map(g=>[{g,x:0,y:0}]);
 for(const [a,b] of [['x','-'],['o','/'],['|','-'],['M','W'],['@','#'],['%','&'],['8','X']])patterns.push([{g:a,x:-.025,y:0},{g:b,x:.025,y:.025}]);
 patterns.push([{g:'@',x:-.04,y:-.02},{g:'#',x:.04,y:.02},{g:'M',x:0,y:0}]);
 patterns.push([{g:'@',x:-.14,y:-.08},{g:'#',x:.14,y:.08},{g:'M',x:0,y:0}]);
 patterns.push([{g:'M',x:-.16,y:0},{g:'W',x:.16,y:0},{g:'@',x:0,y:-.12},{g:'#',x:0,y:.12}]);
 patterns.push([-1,0,1].flatMap(y=>[-1,0,1].map(x=>({g:'#',x:x*.14,y:y*.10}))));
 function paint(ctx,pattern,x,y,cw,ch,variation=0,inkColor='#211f1c'){
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  for(let k=0;k<pattern.length;k++){
   const s=pattern[k],cjk=/[^\x00-\x7f]/.test(s.g),family=s.font==='ja'?'"Noto Serif JP",serif':'"Noto Serif KR",serif';
   ctx.font=`${cw*(cjk?1:1.6)}px ${cjk?family:'"LS Studio Courier Prime",monospace'}`;
   ctx.globalAlpha=1;ctx.fillStyle=inkColor;
   if(s.a){ctx.save();ctx.translate(x+cw*(.5+(s.px||0)),y+ch*(.5+(s.py||0)));ctx.rotate(s.a);ctx.fillText(s.g,cw*(s.x+variation*.012),ch*(.28+s.y),cw*1.08);ctx.restore();}
   else ctx.fillText(s.g,x+cw*(.5+s.x+(s.px||0)+variation*.012),y+ch*(.78+s.y+(s.py||0)),cw*1.08);
  }
  ctx.globalAlpha=1;
 }
 function atlas(createCanvas,patternList=patterns){
  const result=[];
  for(const pattern of patternList){
   const c=createCanvas(W,H),ctx=c.getContext('2d',{willReadFrequently:true});
   ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#211f1c';paint(ctx,pattern,0,0,W,H);
   const small=createCanvas(SW,SH),s=small.getContext('2d',{willReadFrequently:true});s.drawImage(c,0,0,SW,SH);
   const rgba=s.getImageData(0,0,SW,SH).data,v=new Float32Array(SW*SH);let mean=0;
   for(let i=0;i<v.length;i++){v[i]=1-rgba[i*4]/255;mean+=v[i];}
   const full=ctx.getImageData(0,0,W,H).data,iw=W/2,ih=H/2,ink=new Float32Array(iw*ih);
   for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){const i=(y*2*W+x*2)*4;ink[y*iw+x]=(1020-full[i]-full[i+4]-full[i+W*4]-full[i+W*4+4])/(4*(255-33));}
   result.push({v,mean:mean/v.length,ink,width:iw,height:ih});
  }
  return result;
 }
 function prepare(rgba,width,height,contrast,edge,bounds){
  const raw=new Float32Array(width*height),out=new Float32Array(width*height);
  for(let i=0;i<raw.length;i++){
   const a=rgba[i*4+3]/255;
   const lum=(rgba[i*4]*.2126+rgba[i*4+1]*.7152+rgba[i*4+2]*.0722)*a+255*(1-a);
   raw[i]=lum/255;
  }
  // Small edge-preserving filter suppresses paint cracks/sensor grain without
  // smearing eye/lip boundaries. Large contrast edges receive almost no mixing.
  const clean=new Float32Array(raw.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=y*width+x;let sum=0,weight=0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const v=raw[Math.max(0,Math.min(height-1,y+dy))*width+Math.max(0,Math.min(width-1,x+dx))],delta=v-raw[i];
    const w=Math.exp(-delta*delta/0.006)/(1+dx*dx+dy*dy);sum+=v*w;weight+=w;
   }
   clean[i]=sum/weight;
  }
  raw.set(clean);
  // Mandatory grayscale + percentile auto-levels. Flat images remain flat.
  const hist=new Uint32Array(256);let population=0;
  const b=bounds||{x:0,y:0,width,height};
  for(let y=Math.max(0,Math.ceil(b.y));y<Math.min(height,Math.floor(b.y+b.height));y++)for(let x=Math.max(0,Math.ceil(b.x));x<Math.min(width,Math.floor(b.x+b.width));x++){hist[Math.round(raw[y*width+x]*255)]++;population++;}
  let lo=0,hi=255,total=0;for(let i=0;i<256;i++){total+=hist[i];if(total>=population*.01){lo=i;break;}}
  total=0;for(let i=255;i>=0;i--){total+=hist[i];if(total>=population*.01){hi=i;break;}}
  for(let i=0;i<raw.length;i++){
   const original=raw[i],v=hi-lo>2?Math.max(0,(original*255-lo)/(hi-lo)):original;
   let adjusted=(v-.5)*contrast+.5;
   // Highlights may reach white paper. Do not compress them back into ink.
   raw[i]=Math.max(0,Math.min(1,original>=.995?1:adjusted));
  }
  // Local contrast at feature scale (eyes, mouth, folds), not single-pixel grain.
  const stride=width+1,integral=new Float64Array(stride*(height+1));
  for(let y=0;y<height;y++){let sum=0;for(let x=0;x<width;x++){sum+=raw[y*width+x];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+sum;}}
  const radius=Math.max(3,Math.round(width/80));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const x0=Math.max(0,x-radius),x1=Math.min(width,x+radius+1),y0=Math.max(0,y-radius),y1=Math.min(height,y+radius+1),i=y*width+x;
   const local=(integral[y1*stride+x1]-integral[y1*stride+x0]-integral[y0*stride+x1]+integral[y0*stride+x0])/((x1-x0)*(y1-y0));
   let low=raw[i],high=raw[i];
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const v=raw[Math.max(0,Math.min(height-1,y+dy))*width+Math.max(0,Math.min(width-1,x+dx))];low=Math.min(low,v);high=Math.max(high,v);}
   clean[i]=Math.max(low,Math.min(high,raw[i]+(raw[i]-local)*edge*.9));
  }
  raw.set(clean);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=y*width+x,l=raw[y*width+Math.max(0,x-1)],r=raw[y*width+Math.min(width-1,x+1)],u=raw[Math.max(0,y-1)*width+x],d=raw[Math.min(height-1,y+1)*width+x];
   out[i]=Math.max(Math.min(raw[i],l,r,u,d),Math.min(Math.max(raw[i],l,r,u,d),raw[i]+(raw[i]-(l+r+u+d)/4)*edge*.8));
  }
  return out;
 }
 // Reserve bright image areas as unprinted paper, with a smooth density
 // shoulder below the cutoff so it does not produce a new posterized edge.
 function inkTone(luminance){
  if(luminance>=.82)return 0;
  const t=Math.max(0,Math.min(1,(luminance-.64)/.18));
  return Math.pow(Math.max(0,1-luminance),.80)*(1-t*t*(3-2*t));
 }
 function match({rgba,cols,rows,contrast=1.1,ink=1,edge=.35,overstrike=true,patternList=patterns,singles=glyphs.length},samples,progress){
  const width=cols*SW,height=rows*SH,gray=prepare(rgba,width,height,contrast,edge),count=cols*rows;
  const choices=new Uint8Array(count),errors=new Float32Array(count),target=new Float32Array(SW*SH);
  const n=overstrike?patternList.length:singles,maxMean=Math.max(...samples.slice(0,n).map(p=>p.mean));let strikes=0;
  for(let cy=0;cy<rows;cy++){
   for(let cx=0;cx<cols;cx++){
    const cell=cy*cols+cx;let mean=0;
    for(let yy=0;yy<SH;yy++)for(let xx=0;xx<SW;xx++){
     const k=yy*SW+xx;
     target[k]=Math.max(0,Math.min(1,inkTone(gray[(cy*SH+yy)*width+cx*SW+xx])*maxMean*ink));mean+=target[k];
    }
    mean/=target.length;
    const desired=mean<1e-7?0:Math.max(0,Math.min(maxMean,mean+errors[cell]));let best=0,bestCost=Infinity;
    for(let p=0;p<n;p++){
     const sample=samples[p],dm=sample.mean-desired;
     let shape=0;
     for(let k=0;k<target.length;k++){
      // Compare local deviations as well as total ink coverage. This rewards
      // directional strokes along edges without forcing every dark tile solid.
      const delta=(sample.v[k]-sample.mean)-(target[k]-mean)*2;
      shape+=delta*delta;
     }
     const cost=dm*dm*8+shape/target.length*(.12+edge*.14);
     if(cost<bestCost){bestCost=cost;best=p;}
    }
    choices[cell]=best;if(best)strikes+=patternList[best].length;
    const error=(desired-samples[best].mean)*.8;
    if(cx+1<cols)errors[cell+1]+=error*7/16;
    if(cy+1<rows){if(cx)errors[cell+cols-1]+=error*3/16;errors[cell+cols]+=error*5/16;if(cx+1<cols)errors[cell+cols+1]+=error/16;}
   }
   if(progress&&cy%8===0)progress(cy/rows);
  }
  return {choices,cols,rows,strikes};
 }
 function imageBounds(width,height,sourceWidth,sourceHeight,fit='contain',zoom=1,focusX=.5,focusY=.5){
  const scale=(fit==='cover'?Math.max:Math.min)(width/sourceWidth,height/sourceHeight)*Math.max(1,zoom),w=sourceWidth*scale,h=sourceHeight*scale;
  return {x:(width-w)*(w>width?Math.max(0,Math.min(1,focusX)):.5),y:(height-h)*(h>height?Math.max(0,Math.min(1,focusY)):.5),width:w,height:h};
 }
 root.TypewriterArt={patterns,paint,atlas,match,prepare,inkTone,imageBounds,SW,SH};
})(typeof self==='undefined'?globalThis:self);
