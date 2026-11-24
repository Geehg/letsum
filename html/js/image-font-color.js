// Locate flat-color lettering before the luminance matcher sees an outline or shadow.
// Work on a bounded thumbnail for discovery, then extract each line from the original.
(() => {
  'use strict';

  function raster(source, box, limit) {
    const scale = Math.min(1, limit / Math.max(box.w, box.h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(box.w * scale));
    canvas.height = Math.max(1, Math.round(box.h * scale));
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(source,box.x,box.y,box.w,box.h,0,0,canvas.width,canvas.height);
    return {canvas,ctx,image:ctx.getImageData(0,0,canvas.width,canvas.height)};
  }

  function palette(data) {
    const counts = new Map();
    const step = 4 * Math.max(1, Math.floor(data.length / (4*24000)));
    let samples = 0;
    for (let k=0; k<data.length; k+=step) {
      samples++;
      if (data[k+3] < 245) continue;
      const rgb = (data[k]<<16) | (data[k+1]<<8) | data[k+2];
      counts.set(rgb,(counts.get(rgb) || 0)+1);
    }
    const peaks = [...counts].filter(([,count]) => count >= samples*.012)
      .sort((a,b) => b[1]-a[1]).slice(0,8);
    const colors = peaks.map(([rgb]) => [rgb>>16,(rgb>>8)&255,rgb&255]);
    if (peaks.reduce((sum,p) => sum+p[1],0) < samples*.55 ||
        !colors.some(c => Math.max(...c)-Math.min(...c)>45)) return [];
    return colors;
  }

  function near(data,k,color) {
    return data[k+3]>=224 && Math.abs(data[k]-color[0])<=9 &&
      Math.abs(data[k+1]-color[1])<=9 && Math.abs(data[k+2]-color[2])<=9;
  }

  function findBands(image,color) {
    const {width:w,height:h,data} = image;
    const pixels = new Uint8Array(w*h);
    for (let i=0; i<pixels.length; i++) pixels[i]=near(data,i*4,color);
    const queue = new Int32Array(w*h);
    const rows = new Uint32Array(h);
    // Remove connected backdrop panels before projecting lettering onto the rows.
    for (let i=0; i<pixels.length; i++) {
      if (pixels[i]!==1) continue;
      let end=1, left=w, right=0, top=h, bottom=0;
      queue[0] = i;
      pixels[i] = 2;
      for (let head=0; head<end; head++) {
        const p=queue[head], x=p%w, y=Math.floor(p/w);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        if (x && pixels[p-1]===1) {pixels[p-1]=2;queue[end++]=p-1;}
        if (x+1<w && pixels[p+1]===1) {pixels[p+1]=2;queue[end++]=p+1;}
        if (y && pixels[p-w]===1) {pixels[p-w]=2;queue[end++]=p-w;}
        if (y+1<h && pixels[p+w]===1) {pixels[p+w]=2;queue[end++]=p+w;}
      }
      const backdrop = right - left > w * .59 || (bottom - top > h * .92 && (left === 0 || right === w - 1));
      if (!backdrop && end>=3) {
        for (let j = 0; j < end; j++) {
          const pixel = queue[j];
          pixels[pixel] = 3;
          rows[Math.floor(pixel / w)]++;
        }
      }
    }
    const bands=[];
    let top=-1,last=-1;
    for(let y=0;y<=h+3;y++) {
      if(y<h && rows[y]>=3) {
        if(top<0) top=y;
        last=y;
      } else if(top>=0 && y-last>=4) {
        const height=last-top+1, cols=new Uint16Array(w);
        for (let row = top; row <= last; row++) {
          for (let x = 0; x < w; x++) {
            if (pixels[row * w + x] === 3) cols[x]++;
          }
        }
        let left=0,right=w-1;
        while(left<w && !cols[left])left++;
        while(right>left && !cols[right])right--;
        const width=right-left+1;
        const density=cols.reduce((a,b)=>a+b,0)/(width*height);
        if(height>=8 && width>=height*1.2 && density>.09 && density<.85) {
          bands.push({x:left,y:top,w:width,h:height,color});
        }
        top=-1;
      }
    }
    return bands;
  }

  function selectBands(bands,lines) {
    // Prefer a row wide enough for the typed syllables. For two rows, also
    // require reading order, similar type size and a nearby horizontal center.
    const choices=lines.map(text=>{
      const length=[...text].reduce((n,c)=>n+(/\s/.test(c) ? 0.45 : /[ -~]/.test(c) ? 0.62 : 1),0);
      return bands.map(b=>{
        const error=Math.abs(Math.log(b.w/(b.h*length)));
        return {b,score:Math.log(b.h)*.45-error*3,error};
      }).filter(r=>r.error<.48).sort((a,b)=>b.score-a.score).slice(0,12);
    });
    if(lines.length===1) return choices[0].length?[choices[0][0].b]:[];
    let best=-Infinity, pair=[];
    for(const a of choices[0]) for(const b of choices[1]) {
      const p=a.b,q=b.b,h=Math.max(p.h,q.h);
      const gap=q.y-p.y-p.h, scale=Math.abs(Math.log(p.h/q.h));
      const offset=Math.abs((p.x+p.w/2)-(q.x+q.w/2))/Math.max(p.w,q.w);
      if(gap< -h*.10 || gap>h*1.8 || scale>.45 || offset>.5) continue;
      const score=a.score+b.score-scale*2-offset-Math.abs(gap/h)*.25;
      if (score > best) {
        best = score;
        pair = [p, q];
      }
    }
    return pair;
  }

  function detect(source,crop,lines) {
    const box=crop || {x:0,y:0,w:source.naturalWidth||source.width,h:source.naturalHeight||source.height};
    const {image}=raster(source,box,640);
    const colors=palette(image.data);
    const bands=colors.flatMap(c=>findBands(image,c));
    return selectBands(bands,lines).map(b=>{
      const sx=box.w/image.width, sy=box.h/image.height;
      const x=Math.max(0,b.x-1), y=Math.max(0,b.y-1);
      const area={x:box.x+x*sx,y:box.y+y*sy,
        w:(Math.min(image.width,b.x+b.w+1)-x)*sx,h:(Math.min(image.height,b.y+b.h+1)-y)*sy};
      const sample=raster(source,area,1600);
      const data=sample.image.data;
      for(let k=0;k<data.length;k+=4) {
        const ink = near(data, k, b.color);
        data[k] = data[k+1] = data[k+2] = ink ? 0 : 255;
        data[k+3] = 255;
      }
      sample.ctx.putImageData(sample.image,0,0);
      // A clean margin keeps the existing polarity detector independent of the outline.
      const framed=document.createElement('canvas');
      framed.width=sample.canvas.width+8;framed.height=sample.canvas.height+8;
      const ctx=framed.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,framed.width,framed.height);
      ctx.drawImage(sample.canvas,4,4);
      return {image:framed,area};
    });
  }
  window.ImageFontColor={detect};
})();
