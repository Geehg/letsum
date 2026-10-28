/* Local, measured-ink composition. No learned model or semantic segmentation. */
(function(root){
 'use strict';
 const core=root.TypewriterArt,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const sets={en:'.,:;!-_/|iltoasencuvxHNRMWB8@#%&',ko:'.,·ㅣㅡ가나다라마바사아자차카타파하한글봄빛산물꿈별',ja:'、。・ノハイリソシツつくへしこあいうえおかき木水山川日月'};
 const placements=[[0,0],[-.22,0],[.22,0],[0,-.24],[0,.24],[-.20,-.22],[.20,.22],[.20,-.22],[-.20,.22]];
 function sequence(text){return Array.from((text||'').normalize('NFC').replace(/\s+/g,' ').trim());}
 function makePatterns(language='en',text=''){
  const alphabet=Array.from(new Set(sequence(text).filter(c=>c!==' ')));
  const chars=[' ',...(alphabet.length?alphabet:Array.from(sets[language]||sets.en))];
  const one=chars.map(g=>[{g,x:0,y:0,font:language}]),out=one.slice();
  // A varied alphabet remains available when no prose was supplied.
  if(!alphabet.length)for(const g of chars.slice(1))for(const n of [2,3,5,7,9])out.push(placements.slice(0,n).map(([x,y],i)=>({g:i?chars[1+(chars.indexOf(g)+i*7)%(chars.length-1)]:g,x,y,font:language})));
  return {patterns:out,singles:one.length};
 }
 function blur(src,W,H,r){
  const temp=new Float32Array(src.length),out=new Float32Array(src.length),size=2*r+1;
  for(let y=0;y<H;y++){let sum=0;for(let k=-r;k<=r;k++)sum+=src[y*W+clamp(k,0,W-1)];for(let x=0;x<W;x++){temp[y*W+x]=sum/size;sum+=src[y*W+clamp(x+r+1,0,W-1)]-src[y*W+clamp(x-r,0,W-1)];}}
  for(let x=0;x<W;x++){let sum=0;for(let k=-r;k<=r;k++)sum+=temp[clamp(k,0,H-1)*W+x];for(let y=0;y<H;y++){out[y*W+x]=sum/size;sum+=temp[clamp(y+r+1,0,H-1)*W+x]-temp[clamp(y-r,0,H-1)*W+x];}}
  return out;
 }
 function field(cols,rows,options,gray){
  const W=cols*core.SW,H=rows*core.SH,n=cols*rows,smoothed=blur(blur(gray,W,H,2),W,H,2);
  const xx=new Float32Array(n),xy=new Float32Array(n),yy=new Float32Array(n),angles=new Float32Array(n),masks=new Float32Array(n);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
   const i=y*W+x,gx=smoothed[i+1]-smoothed[i-1],gy=smoothed[i+W]-smoothed[i-W],c=Math.floor(y/core.SH)*cols+Math.floor(x/core.SW);
   xx[c]+=gx*gx;xy[c]+=gx*gy;yy[c]+=gy*gy;
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const c=y*cols+x,m=options.mask;
   masks[c]=!options.portrait||!m?1:m.data[Math.min(m.height-1,Math.floor((y+.5)/rows*m.height))*m.width+Math.min(m.width-1,Math.floor((x+.5)/cols*m.width))]/255;
   if(!options.curve||!masks[c])continue;
   let a=0,b=0,d=0;
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=cols||Y>=rows)continue;const i=Y*cols+X,w=1/(1+dx*dx+dy*dy);a+=xx[i]*w;b+=xy[i]*w;d+=yy[i]*w;
   }
   const coherence=Math.hypot(a-d,2*b)/(a+d+1e-7);
   let angle=.5*Math.atan2(2*b,a-d)+Math.PI/2;if(angle>Math.PI/2)angle-=Math.PI;
   // Fade ambiguous/vertical orientations before smoothing: prevents +90/-90 flips.
   const confidence=clamp((coherence-.28)/.55)*clamp((a+d)*90);
   angles[c]=clamp(angle,-1.05,1.05)*confidence*Math.pow(Math.abs(Math.cos(angle)),.35);
  }
  const smooth=blur(angles,cols,rows,1),offsets=new Float32Array(n);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const i=y*cols+x;angles[i]=masks[i]?smooth[i]:0;
   if(x&&masks[i]&&masks[i-1]){angles[i]=clamp(angles[i],angles[i-1]-.22,angles[i-1]+.22);offsets[i]=clamp(offsets[i-1]*.7+Math.sin(angles[i])*.10,-.24,.24);}
  }
  return {angles,offsets,masks};
 }
 // Rasterized glyphs are supplied by the same loaded font and paint() as the output.
 // Compose their union, rather than substituting prose after tone matching.
 function shifted(glyph,dx,dy){
  const W=glyph.width||core.SW,H=glyph.height||core.SH,src=glyph.ink||Float32Array.from(glyph.v,v=>v/(1-33/255)),out=new Float32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const sx=x-dx*W,sy=y-dy*H,x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0;
   const at=(X,Y)=>X>=0&&X<W&&Y>=0&&Y<H?src[Y*W+X]:0;
   out[y*W+x]=(at(x0,y0)*(1-fx)+at(x0+1,y0)*fx)*(1-fy)+(at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx)*fy;
  }
  return out;
 }
 function stamp(union,glyph){
  let sum=0;for(let i=0;i<union.length;i++){union[i]=1-(1-union[i])*(1-glyph[i]);sum+=union[i];}return sum/union.length*(1-33/255);
 }
 function flow(plan,options,gray,progress){
  const {cols,rows}=plan,n=cols*rows,W=cols*core.SW,{angles,offsets,masks}=field(cols,rows,options,gray);
  const patterns=options.patterns||core.patterns,seq=sequence(options.text),samples=options.samples;
  const textStart=Math.max(0,Math.min(seq.length,Math.trunc(Number(options.textOffset)||0))),repeatText=options.repeatText!==false;
  const charAt=i=>seq.length&&(repeatText||textStart+i<seq.length)?seq[(textStart+i)%seq.length]:null;
  // Backwards-compatible callers without measured glyph data keep their plan.
  if(!samples){let consumed=0;const marks=Array.from(plan.choices,(p,i)=>p?patterns[p].map(s=>({...s,g:seq.length?seq[consumed++%seq.length]:s.g,a:angles[i],y:s.y+offsets[i]})):[]);return {...plan,marks,angles,offsets,strikes:marks.reduce((s,p)=>s+p.length,0),textCharactersUsed:consumed,textLength:seq.length};}
  const choices=new Uint8Array(n),marks=new Array(n),errors=new Float32Array(n),glyphs=new Map();
  for(let i=0;i<options.singles;i++)glyphs.set(patterns[i][0].g,samples[i]);
  const maxLayers=options.overstrike===false?1:9;
  const pixels=(samples[0].width||core.SW)*(samples[0].height||core.SH),emptyInk=new Float32Array(pixels),stencils=new Map();
  function stencil(g,k){
   if(!stencils.has(g)){if(stencils.size>=256)stencils.delete(stencils.keys().next().value);const glyph=glyphs.get(g);stencils.set(g,placements.map(([x,y])=>glyph?shifted(glyph,x,y):emptyInk));}
   return stencils.get(g)[k];
  }
  let capacity;
  if(seq.length){
   const peaks=[];for(let start=0;start<Math.min(seq.length,160);start++){const union=new Float32Array(pixels);let mean=0;for(let k=0;k<maxLayers;k++){const g=charAt(start+k);if(g===null)break;mean=stamp(union,stencil(g,k));}peaks.push(mean);}
   peaks.sort((a,b)=>a-b);capacity=peaks[Math.floor(peaks.length*.65)]||.1;
  }else capacity=Math.max(...samples.slice(0,options.overstrike===false?options.singles:samples.length).map(s=>s.mean));
  // Preserve paper highlights and use a printable ink range; density, never gray ink.
  capacity=Math.min(.68,capacity);
  const tracing=root.TypewriterStreamlines;
  const layout=tracing?tracing.anchors({cols,rows,field:tracing.directionField(gray,W,rows*core.SH,cols,rows),foreground:options.portrait&&!options.mask?.refined?tracing.featherMask(masks,cols,rows):masks,curve:!!options.curve}):{anchors:Array.from({length:n},(_,i)=>({x:i%cols+.5,y:Math.floor(i/cols)+.5,angle:angles[i],run:-1})),runLengths:[]};
  const buckets=Array.from({length:n},()=>[]);
  for(const a of layout.anchors)buckets[Math.floor(a.y)*cols+Math.floor(a.x)].push(a);
  const densityCompensation=Math.min(1.08,n/Math.max(1,layout.anchors.length));
  const at=(x,y)=>{if(x<0||y<0||x>W-1||y>rows*core.SH-1)return 1;const X=Math.floor(x),Y=Math.floor(y),fx=x-X,fy=y-Y,X1=Math.min(W-1,X+1),Y1=Math.min(rows*core.SH-1,Y+1);return (gray[Y*W+X]*(1-fx)+gray[Y*W+X1]*fx)*(1-fy)+(gray[Y1*W+X]*(1-fx)+gray[Y1*W+X1]*fx)*fy;};
  let consumed=0,strikes=0;
  const target=new Float32Array(core.SW*core.SH),union=new Float32Array(pixels);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const i=y*cols+x,cellMarks=[],anchors=buckets[i];let cellError=0;
   for(const anchor of anchors){
    const cos=Math.cos(anchor.angle),sin=Math.sin(anchor.angle);let mean=0;
    // Match tones where each curved glyph will actually land, in its local frame.
    for(let yy=0;yy<core.SH;yy++)for(let xx=0;xx<core.SW;xx++){
     const k=yy*core.SW+xx,dx=(xx+.5)/core.SW-.5,dy=((yy+.5)/core.SH-.5)*1.5;
     const lum=at((anchor.x+dx*cos-dy*sin)*core.SW-.5,(anchor.y+(dx*sin+dy*cos)/1.5)*core.SH-.5);
     target[k]=core.inkTone(lum)*capacity*(options.ink||1)*(anchor.inkWeight??densityCompensation);mean+=target[k];
    }
    mean/=target.length;const desired=mean<1e-7?0:clamp(mean+errors[i]/Math.max(1,anchors.length),0,capacity),count=seq.length?(repeatText?maxLayers:Math.min(maxLayers,Math.max(0,seq.length-textStart-consumed))):(options.overstrike===false?options.singles:samples.length)-1;
    let best=0,bestMean=0,bestCost=desired*desired*14,entry=[];union.fill(0);
    const candidates=[];
    for(let k=1;k<=count;k++){
     let sample,coverage;
     if(seq.length){const g=charAt(consumed+k-1);coverage=stamp(union,stencil(g,k-1));sample=null;}
     else{coverage=samples[k].mean;sample=samples[k].v;}
     let shape=0;if(sample)for(let j=0;j<target.length;j++){const v=(sample[j]-coverage)-(target[j]-mean);shape+=v*v;}
     const cost=(coverage-desired)**2*14+shape/target.length*.012;
     if(!seq.length)candidates.push({k,coverage,cost});
     if(cost<bestCost){bestCost=cost;best=k;bestMean=coverage;}
    }
    // Alternate equivalent-density glyph families by a short text band, not noise
    // applied to character color or opacity. Diffusion preserves the target tone.
    if(best&&!seq.length){
     const equivalents=candidates.filter(p=>Math.abs(p.coverage-bestMean)<.009&&p.cost<=bestCost+.00016);
     if(equivalents.length>1){const band=anchor.run>=0?anchor.run:y*31+Math.floor(x/7),index=((Math.imul(band+19,2654435761)>>>0)%equivalents.length),pick=equivalents[index];best=pick.k;bestMean=pick.coverage;}
    }
    if(best){
     entry=seq.length?Array.from({length:best},(_,k)=>({g:charAt(consumed+k),x:placements[k][0],y:placements[k][1],font:options.language||'en'})):patterns[best].map(s=>({...s}));
     if(seq.length)consumed+=best;
     for(const s of entry){s.a=anchor.angle;s.px=anchor.x-(x+.5);s.py=anchor.y-(y+.5);}
     cellMarks.push(...entry);strikes+=entry.length;
    }
    cellError+=desired-bestMean;angles[i]=anchor.angle;offsets[i]=anchor.y-(y+.5);
   }
   marks[i]=cellMarks;choices[i]=cellMarks.length?1:0;
   const errorLimit=Math.max(.12,capacity*.65),error=clamp(cellError,-errorLimit,errorLimit)*.98;
   if(x+1<cols)errors[i+1]+=error*7/16;
   if(y+1<rows){if(x)errors[i+cols-1]+=error*3/16;errors[i+cols]+=error*5/16;if(x+1<cols)errors[i+cols+1]+=error/16;}
   if(progress&&x===cols-1&&y%8===0)progress(y/rows);
  }
  return {cols,rows,choices,marks,strikes,textCharactersUsed:consumed,textLength:seq.length,textStart,textRemaining:Math.max(0,seq.length-textStart-consumed),nextTextOffset:Math.min(seq.length,textStart+consumed),textRepeated:textStart+consumed>seq.length,angles,offsets,inkCapacity:capacity,inkColor:options.inkColor||'#211f1c',curvedRuns:layout.runLengths.length};
 }
 core.makePatterns=makePatterns;core.flow=flow;
})(typeof self==='undefined'?globalThis:self);
