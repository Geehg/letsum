// Compare local pixel silhouettes. Image bytes and typed text never enter a request.
(() => {
  'use strict';
  const el = id => document.getElementById('im-' + id);
  const preview = el('preview'), results = el('results'), status = el('status');
  const canvas = (w,h) => Object.assign(document.createElement('canvas'), {width:w,height:h});
  let picture, crop, start, revision=0, list;
  const loaded = new Map();
  function invalidate() {
    revision++;
    results.replaceChildren();
    status.textContent='';
    el('run').disabled=false;
  }
  function paint() {
    if (!picture) return;
    const ctx=preview.getContext('2d');
    ctx.drawImage(picture,0,0);
    if (!crop) return;
    const {x,y,w,h}=crop;
    ctx.fillStyle='rgba(0,0,0,.48)';
    ctx.fillRect(0,0,preview.width,y); ctx.fillRect(0,y+h,preview.width,preview.height-y-h);
    ctx.fillRect(0,y,x,h); ctx.fillRect(x+w,y,preview.width-x-w,h);
    ctx.strokeStyle='#1271ed'; ctx.lineWidth=2; ctx.strokeRect(x,y,w,h);
  }
  el('file').onchange=async e=>{
    invalidate(); const version=revision,file=e.target.files[0];
    start=crop=picture=null; el('edit').hidden=true;
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>25*1024*1024) {
      status.textContent='25 MB 이하 PNG, JPG, WebP 이미지를 선택하세요.';return;
    }
    const url=URL.createObjectURL(file);
    try {
      const img=new Image();img.src=url;await img.decode();
      if(version!==revision)return;
      const scale=Math.min(1,1800/Math.max(img.width,img.height));
      picture=canvas(Math.max(1,Math.round(img.width*scale)),Math.max(1,Math.round(img.height*scale)));
      const ctx=picture.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,picture.width,picture.height);
      ctx.drawImage(img,0,0,picture.width,picture.height);
      preview.width=picture.width;preview.height=picture.height;paint();el('edit').hidden=false;
    } catch {if(version===revision)status.textContent='이미지를 열 수 없습니다.';} finally {URL.revokeObjectURL(url);}
  };
  const panel=document.getElementById('image-finder');
  if (location.hash==='#image-finder') panel.open=true;
  panel.ondragover=e=>{ if(e.dataTransfer.types.includes('Files')) e.preventDefault(); };
  panel.ondrop=e=>{
    e.preventDefault();
    if (!e.dataTransfer.files.length) return;
    panel.open=true;
    const transfer=new DataTransfer();transfer.items.add(e.dataTransfer.files[0]);
    el('file').files=transfer.files;el('file').dispatchEvent(new Event('change'));
  };
  function point(e) {
    const r=preview.getBoundingClientRect();
    return [Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*preview.width),
      Math.round(Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))*preview.height)];
  }
  preview.onpointerdown=e=>{if(!e.isPrimary)return;invalidate();start=point(e);preview.setPointerCapture(e.pointerId);};
  preview.onpointermove=e=>{
    if(!start||!e.isPrimary)return;
    const [x,y]=point(e);crop={x:Math.min(x,start[0]),y:Math.min(y,start[1]),w:Math.abs(x-start[0]),h:Math.abs(y-start[1])};paint();
  };
  preview.onpointerup=e=>{if(!start||!e.isPrimary)return;preview.onpointermove(e);start=null;if(crop.w<3||crop.h<3)crop=null;paint();};
  preview.onpointercancel=()=>{start=crop=null;paint();};
  el('reset').onclick=()=>{invalidate();crop=null;paint();};
  el('text').oninput=invalidate;

  function shape(src,box) {
    const {x,y,w,h}=box||{x:0,y:0,w:src.width,h:src.height};
    const scale=Math.min(1,1000/w,200/h), c=canvas(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)));
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,x,y,w,h,0,0,c.width,c.height);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    const gray=new Uint8Array(pixels.length/4), hist=new Uint32Array(256);
    let sum=0;
    for(let i=0;i<gray.length;i++){const k=i*4;gray[i]=Math.round(.299*pixels[k]+.587*pixels[k+1]+.114*pixels[k+2]);hist[gray[i]]++;sum+=gray[i];}
    let count=0,left=0,best=0,cut=0;
    for(let i=0;i<255;i++){
      count+=hist[i];left+=i*hist[i];const rest=gray.length-count;
      if(!count||!rest)continue;
      const v=count*rest*(left/count-(sum-left)/rest)**2;
      if(v>best){best=v;cut=i;}
    }
    if(!best)return null;
    let dark=0,border=0;
    for(let i=0;i<gray.length;i++)if(i<c.width||i>=gray.length-c.width||i%c.width===0||i%c.width===c.width-1){border++;if(gray[i]<=cut)dark++;}
    const bgDark=dark>border/2;
    let x0=c.width,x1=-1,y0=c.height,y1=-1;
    const mask=ctx.createImageData(c.width,c.height);
    for(let i=0;i<gray.length;i++)if((gray[i]<=cut)!==bgDark){
      const px=i%c.width,py=Math.floor(i/c.width);x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py);
      mask.data[i*4+3]=255;
    }
    if(x1-x0<2||y1-y0<2)return null;
    ctx.putImageData(mask,0,0);
    const small=canvas(160,28), sc=small.getContext('2d');
    sc.imageSmoothingQuality='high';sc.drawImage(c,x0,y0,x1-x0+1,y1-y0+1,0,0,160,28);
    return {pixels:sc.getImageData(0,0,160,28).data,ratio:(x1-x0+1)/(y1-y0+1)};
  }
  function similarity(a,b){
    let overlap=0,total=0;
    for(let i=3;i<a.pixels.length;i+=4){overlap+=Math.min(a.pixels[i],b.pixels[i]);total+=Math.max(a.pixels[i],b.pixels[i]);}
    return overlap/Math.max(1,total)*Math.exp(-.4*Math.abs(Math.log(a.ratio/b.ratio)));
  }
  function render(text,family,fallback) {
    const font='48px "'+family+'", '+fallback;
    const proto=canvas(1,1).getContext('2d');proto.font=font;
    const c=canvas(Math.ceil(proto.measureText(text).width)+40,100),ctx=c.getContext('2d');
    ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.font=font;ctx.fillStyle='black';ctx.fillText(text,20,66);
    return c;
  }
  function glyphPixels(char, family) {
    const c=canvas(64,64),ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.font='40px "'+family+'", serif';ctx.fillText(char,6,48);
    return new Uint32Array(ctx.getImageData(0,0,64,64).data.buffer);
  }
  function hasGlyphs(family, fallbacks) {
    for (const [char,fallback] of fallbacks) {
      const actual=glyphPixels(char,family);
      if (actual.every((pixel,i)=>pixel===fallback[i])) return false;
    }
    return true;
  }
  async function face(row){
    if(!loaded.has(row.id)){
      const f=new FontFace('im-'+row.id,'url("'+row.url+'")');
      const pending=new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('timeout')),12000);
        f.load().then(resolve,reject).finally(()=>clearTimeout(timer));
      });
      loaded.set(row.id,pending.then(ok=>{document.fonts.add(ok);return ok.family;}).catch(err=>{loaded.delete(row.id);throw err;}));
    }
    return loaded.get(row.id);
  }
  el('run').onclick=async()=>{
    invalidate();
    const version=revision,text=el('text').value.trim().normalize('NFC');
    if(!/[가-힣]/.test(text)||text.length<2){status.textContent='이미지에 보이는 한글을 포함해 두 글자 이상 입력하세요.';return;}
    const target=shape(picture,crop);
    if(!target){status.textContent='글자 윤곽을 찾지 못했습니다. 글자 한 줄을 다시 선택하세요.';return;}
    el('run').disabled=true;status.textContent='비교할 서체를 준비하고 있습니다…';
    try {
      if(!list){const res=await fetch('/data/image-fonts.json?v=1');if(!res.ok)throw Error();list=await res.json();}
      const scores=[];
      const fallbacks=new Map([...new Set(text.match(/[가-힣]/g))].map(char=>[char,glyphPixels(char,'missing-image-font')]));
      for(let i=0;i<list.length;i+=3){
        if(version!==revision)return;
        await Promise.all(list.slice(i,i+3).map(async row=>{
          try{
            const family=await face(row);if(version!==revision || !hasGlyphs(family,fallbacks))return;
            const sample=shape(render(text,family,'serif'));
            if(sample)scores.push({row,family,score:similarity(target,sample)});
          }catch{/* An unavailable preview cannot contribute a match. */}
        }));
        if(version===revision)status.textContent='글자 모양 비교 중 · '+Math.min(i+3,list.length)+' / '+list.length;
      }
      if(version!==revision)return;
      scores.sort((a,b)=>b.score-a.score);
      if(!scores.length){status.textContent='입력한 글자를 지원하는 비교용 서체를 불러오지 못했습니다.';return;}
      const weak=scores[0].score<.64 || (scores.length>1 && scores[0].score-scores[1].score<.035);
      status.textContent=(weak?'판별 어려움 · 참고용 후보':'비슷한 서체 후보')+' · 비교한 서체 '+scores.length+'종. 원본 서체와 다를 수 있습니다.';
      for(const {row,family} of scores.slice(0,3)){
        const article=document.createElement('article'),title=document.createElement('strong'),sample=document.createElement('p'),detail=document.createElement('a'),source=document.createElement('a');
        title.textContent=row.name;sample.className='im-sample';sample.style.fontFamily='"'+family+'"';sample.textContent=text;
        detail.href='/font/'+row.id+'.html';detail.textContent='이용조건';source.href=row.source;source.textContent='공식 배포처';
        article.append(title,sample,detail,' · ',source);results.append(article);
      }
    }catch{if(version===revision)status.textContent='비교 자료를 열 수 없습니다. 다시 시도하세요.';}
    finally{if(version===revision)el('run').disabled=false;}
  };
})();
