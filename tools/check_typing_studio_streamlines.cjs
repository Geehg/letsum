const assert=require('node:assert/strict');
const {directionField,anchors}=require('../html/js/typing-studio-streamlines.js');
const cols=50,rows=45,n=cols*rows;
const angle=new Float32Array(n),confidence=new Float32Array(n).fill(.9),foreground=new Uint8Array(n).fill(1);
// Smooth curved contours: trajectories change baseline by several whole rows.
for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)angle[y*cols+x]=.8*Math.sin((x/cols)*Math.PI);
const a=anchors({cols,rows,field:{angle,confidence},foreground});
assert.ok(a.runLengths.length>10,'continuous runs exist');
assert.ok(a.runLengths.every(n=>n>=6&&n<=16),'6–16 character runs');
const groups=new Map();for(const p of a.anchors)if(p.run>=0){if(!groups.has(p.run))groups.set(p.run,[]);groups.get(p.run).push(p);}
assert.ok([...groups.values()].some(g=>Math.max(...g.map(p=>p.y))-Math.min(...g.map(p=>p.y))>3),'real baseline bends over multiple rows');
assert.deepEqual(a,anchors({cols,rows,field:{angle,confidence},foreground}),'deterministic placement');
for(let y=0;y<rows;y++)for(let x=cols/2;x<cols;x++)foreground[y*cols+x]=0;
const masked=anchors({cols,rows,field:{angle,confidence},foreground});
const bg=masked.anchors.filter(p=>p.x>=cols/2);assert.equal(bg.length,n/2);assert.ok(bg.every(p=>p.angle===0&&p.x%1===.5&&p.y%1===.5),'background keeps horizontal grid');
const straight=anchors({cols,rows,field:{angle,confidence},curve:false});assert.equal(straight.anchors.length,n);assert.ok(straight.anchors.every(p=>p.angle===0));
assert.ok(a.anchors.every(p=>p.x>=.45&&p.y>=.45&&p.x<=cols-.45&&p.y<=rows-.45),'bounds');
let minDistance=Infinity;for(let i=0;i<a.anchors.length;i++)for(let j=i+1;j<a.anchors.length;j++){const p=a.anchors[i],q=a.anchors[j];minDistance=Math.min(minDistance,Math.hypot(p.x-q.x,(p.y-q.y)*1.5));}
assert.ok(minDistance>.879,'no collapsed/crossing anchors');
const width=cols*6,height=rows*9,gray=Float32Array.from({length:width*height},(_,i)=>Math.min(1,(i%width)/width*4));const field=directionField(gray,width,height,cols,rows);
assert.ok([...field.angle].some((x,i)=>field.confidence[i]>.25&&Math.abs(Math.cos(x))<.1),'vertical tangents retained');
const vert=anchors({cols,rows,field:{angle:new Float32Array(n).fill(Math.PI/2),confidence},maxRun:16});
assert.ok(vert.runLengths.length>0&&vert.anchors.some(p=>Math.abs(p.angle)>1.4),'vertical rows supported');
console.log(JSON.stringify({runs:a.runLengths.length,anchors:a.anchors.length,grid:n,minDistance,meanRun:a.runLengths.reduce((a,b)=>a+b,0)/a.runLengths.length,verticalRuns:vert.runLengths.length}));
console.log('PASS: true curved runs, deterministic spacing, preserved vertical direction, horizontal background, bounds, curve-off grid');

const {extendDarkDirections}=require('../html/js/typing-studio-streamlines.js');
const ac=new Float32Array(n).fill(Math.PI/3),cc=new Float32Array(n),tone=new Float32Array(n).fill(.2);
for(let y=0;y<rows;y++)for(let x=0;x<3;x++)cc[y*cols+x]=.9;
// A bright region is a hard barrier to this specifically dark-region extension.
for(let y=0;y<rows;y++)tone[y*cols+15]=.85;
const extended=extendDarkDirections({cols,rows,angle:ac,confidence:cc,tone});
assert.ok(extended.confidence[20*cols+8]>.25,'reliable fold direction fills a nearby dark shadow');
assert.ok(Math.abs(extended.angle[20*cols+8]-Math.PI/3)<.001,'propagation preserves tangent');
assert.equal(extended.confidence[20*cols+15],0,'bright region cannot inherit dark direction');
assert.equal(extended.confidence[20*cols+25],0,'finite-distance propagation');
console.log('PASS: finite dark-shadow direction extension, bright barrier, tangent preservation');

// Regression: a mask must not create an empty cut-out seam.
(()=>{
const assert=require('node:assert/strict');
const api=require('../html/js/typing-studio-streamlines.js');
const cols=80,rows=60,n=cols*rows,cx=40,cy=30,radius=23,aspect=1.5;
const dist=(x,y)=>radius-Math.hypot(x-cx,(y-cy)*aspect);
const binary=Uint8Array.from({length:n},(_,i)=>dist(i%cols+.5,Math.floor(i/cols)+.5)>0?1:0);
const field={angle:new Float32Array(n).fill(.85),confidence:new Float32Array(n).fill(.9)};
const stats=[];
for(const [name,mask] of [['hard',binary],['feather',api.featherMask(binary,cols,rows)]]){
 const layout=api.anchors({cols,rows,field,foreground:mask});
 const bands=[[-6,-3],[-3,-1],[-1,1],[1,3],[3,6],[6,50]],table=[];
 for(const [lo,hi] of bands){let baseline=0,actual=0,angles=[];for(let i=0;i<n;i++){const d=dist(i%cols+.5,Math.floor(i/cols)+.5);if(d>=lo&&d<hi)baseline++;}for(const a of layout.anchors){const d=dist(a.x,a.y);if(d>=lo&&d<hi){actual++;angles.push(Math.abs(a.angle));}}table.push({band:[lo,hi],density:actual/baseline,angle:angles.reduce((a,b)=>a+b,0)/Math.max(1,angles.length)});}
 stats.push({name,count:layout.anchors.length,table});
 assert.ok(layout.anchors.every(p=>p.x>=.45&&p.y>=.45&&p.x<=cols-.45&&p.y<=rows-.45));
 const background=layout.anchors.filter(a=>dist(a.x,a.y)<-8);assert.ok(background.every(a=>Math.abs(a.angle)<1e-6),'far background remains horizontal');
}

assert.ok(stats[1].table[2].density>stats[0].table[2].density,'boundary packing density improves');
assert.ok(stats[1].table[2].density>.92&&stats[1].table[2].density<1.15,'no white gutter/dark halo in boundary band');
for(let i=1;i<stats[1].table.length;i++)assert.ok(stats[1].table[i].angle>=stats[1].table[i-1].angle,'smooth angular transition');
assert.ok(Math.abs(stats[1].table[3].angle-stats[1].table[2].angle)<.4,'no abrupt angle step at boundary');
console.log('PASS: smoother direction, denser boundary, far horizontal background, bounds');

})();

// Natural boundaries: mix existing line directions rather than inventing a collar.
(()=>{
 const api=require('../html/js/typing-studio-streamlines.js'),cols=80,rows=60,n=cols*rows;
 const distance=(x,y)=>23-Math.hypot(x-40,(y-30)*1.5);
 const mask=api.featherMask(Uint8Array.from({length:n},(_,i)=>distance(i%cols+.5,Math.floor(i/cols)+.5)>0?1:0),cols,rows);
 const field={angle:new Float32Array(n).fill(.85),confidence:new Float32Array(n).fill(.9)};
 const result=api.anchors({cols,rows,field,foreground:mask}),band=result.anchors.filter(p=>Math.abs(distance(p.x,p.y))<1);
 assert.ok(band.some(p=>Math.abs(p.angle)<.01)&&band.some(p=>Math.abs(p.angle-.85)<.01),'horizontal and contour runs interleave');
 assert.ok(band.every(p=>Math.abs(p.angle)<.01||Math.abs(p.angle-.85)<.01),'no artificial intermediate-angle collar');
 const grid=Array.from({length:n},(_,i)=>({x:i%cols+.5,y:Math.floor(i/cols)+.5}));api.balanceDensity(grid,cols,rows);
 assert.ok(grid.every(p=>Math.abs(p.inkWeight-1)<1e-6),'regular grid remains unchanged including page edges');
 const crowded=Array.from({length:n},(_,i)=>({x:(i%cols)*.8+.5,y:Math.floor(i/cols)+.5}));api.balanceDensity(crowded,cols,rows);
 assert.ok(crowded.filter(p=>p.x>10&&p.x<50&&p.y>5&&p.y<55).every(p=>p.inkWeight<.9),'crowded contours receive less total ink, not darker letter color');
 const width=cols*6,height=rows*9,gray=Float32Array.from({length:width*height},(_,i)=>i%width>width/2?.7:.15),step=api.directionField(gray,width,height,cols,rows);
 assert.ok(Math.max(...step.boundary)>.9,'single brightness step is distinguished from a flat field');
 const short=api.anchors({cols,rows,field:step}),long=api.anchors({cols,rows,field:{...step,boundary:undefined}}),average=a=>a.reduce((s,v)=>s+v,0)/a.length;
 assert.ok(average(short.runLengths)<average(long.runLengths)*.85,'strong outline runs cannot dominate as long letter rings');
 console.log('PASS: interleaved boundary runs, no invented collar, local ink coverage, bounded outline tracing');
})();
