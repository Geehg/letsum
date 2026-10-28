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
 function paint(ctx,pattern,x,y,cw,ch,variation=0){
  ctx.font=`${cw*1.6}px "LS Studio Courier Prime", monospace`;ctx.textAlign='center';ctx.textBaseline='alphabetic';
  for(let k=0;k<pattern.length;k++){
   const s=pattern[k];ctx.globalAlpha=1;ctx.fillStyle='#211f1c';
   ctx.fillText(s.g,x+cw*(.5+s.x+variation*.012),y+ch*(.78+s.y),cw*1.08);
  }
  ctx.globalAlpha=1;
 }
 function atlas(createCanvas){
  const result=[];
  for(const pattern of patterns){
   const c=createCanvas(W,H),ctx=c.getContext('2d',{willReadFrequently:true});
   ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#211f1c';paint(ctx,pattern,0,0,W,H);
   const small=createCanvas(SW,SH),s=small.getContext('2d',{willReadFrequently:true});s.drawImage(c,0,0,SW,SH);
   const rgba=s.getImageData(0,0,SW,SH).data,v=new Float32Array(SW*SH);let mean=0;
   for(let i=0;i<v.length;i++){v[i]=1-rgba[i*4]/255;mean+=v[i];}
   result.push({v,mean:mean/v.length});
  }
  return result;
 }
 function prepare(rgba,width,height,contrast,edge){
  const raw=new Float32Array(width*height),out=new Float32Array(width*height);
  for(let i=0;i<raw.length;i++){
   const a=rgba[i*4+3]/255;
   const lum=(rgba[i*4]*.2126+rgba[i*4+1]*.7152+rgba[i*4+2]*.0722)*a+255*(1-a);
   raw[i]=Math.max(0,Math.min(1,(lum/255-.5)*contrast+.5));
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=y*width+x,l=raw[y*width+Math.max(0,x-1)],r=raw[y*width+Math.min(width-1,x+1)],u=raw[Math.max(0,y-1)*width+x],d=raw[Math.min(height-1,y+1)*width+x];
   out[i]=Math.max(0,Math.min(1,raw[i]+(raw[i]-(l+r+u+d)/4)*edge*2));
  }
  return out;
 }
 function match({rgba,cols,rows,contrast=1.1,ink=1,edge=.35,overstrike=true},samples,progress){
  const width=cols*SW,height=rows*SH,gray=prepare(rgba,width,height,contrast,edge),count=cols*rows;
  const choices=new Uint8Array(count),errors=new Float32Array(count),target=new Float32Array(SW*SH);
  const n=overstrike?patterns.length:glyphs.length,maxMean=Math.max(...samples.slice(0,n).map(p=>p.mean));let strikes=0;
  for(let cy=0;cy<rows;cy++){
   for(let cx=0;cx<cols;cx++){
    const cell=cy*cols+cx;let mean=0;
    for(let yy=0;yy<SH;yy++)for(let xx=0;xx<SW;xx++){
     const k=yy*SW+xx;
     target[k]=Math.max(0,Math.min(1,Math.pow(1-gray[(cy*SH+yy)*width+cx*SW+xx],.9)*maxMean*ink));mean+=target[k];
    }
    mean/=target.length;
    const desired=Math.max(0,Math.min(maxMean,mean+errors[cell]));let best=0,bestCost=Infinity;
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
    choices[cell]=best;if(best)strikes+=patterns[best].length;
    const error=(desired-samples[best].mean)*.8;
    if(cx+1<cols)errors[cell+1]+=error*7/16;
    if(cy+1<rows){if(cx)errors[cell+cols-1]+=error*3/16;errors[cell+cols]+=error*5/16;if(cx+1<cols)errors[cell+cols+1]+=error/16;}
   }
   if(progress&&cy%8===0)progress(cy/rows);
  }
  return {choices,cols,rows,strikes};
 }
 root.TypewriterArt={patterns,paint,atlas,match,SW,SH};
})(typeof self==='undefined'?globalThis:self);
