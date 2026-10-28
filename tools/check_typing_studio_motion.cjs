const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('html/js/typing-studio.js','utf8');
const block=source.slice(source.indexOf(' function resetMotion(){'),source.indexOf(' function start(){'));
const harness=`
let layer=0,typed=0,phase='strike',feedRow=0,due=0,cursor=0,frame=0,playing=true,active=true;
const machine=null;
const plan={choices:[1,2,0,1],cols:2,rows:2,strikes:4};
const noop=()=>{},styles={},classes=new Set(),painted=[];
const node={style:{},animate:noop};const area={style:{setProperty:(k,v)=>styles[k]=v},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},querySelector:()=>node};
const ui={};const $=id=>ui[id]||(ui[id]={value:20,animate:noop});
const ctx={};const canvas={width:1240,height:1754};
const core={patterns:[[],[{g:'x'}],[{g:'a'},{g:'b'}]],paint:(ctx,p)=>painted.push(p[0].g)};
const patternAt=i=>core.patterns[plan.choices[i]];
const requestAnimationFrame=()=>1,status=noop,pause=noop,controls=noop,prepareShare=noop;
${block}
complete=()=>{playing=false;};
globalThis.run=t=>tick(t);
globalThis.state=()=>({cursor,layer,typed,phase,feedRow,painted:[...painted],carriage:styles['--carriage']});
`;
const c=vm.createContext({});vm.runInContext(harness,c);
c.run(0);assert.equal(c.state().cursor,1);assert.equal(c.state().typed,1);
c.run(10000);assert.equal(c.state().cursor,1);assert.equal(c.state().layer,1);assert.equal(c.state().typed,2,'no batch catchup');
c.run(20000);assert.equal(c.state().phase,'line-end');assert.equal(c.state().feedRow,0);assert.equal(c.state().carriage,'-45%');
c.run(30000);assert.equal(c.state().phase,'return');assert.equal(c.state().feedRow,0);assert.equal(c.state().carriage,'45%');
c.run(40000);assert.equal(c.state().phase,'feed');assert.equal(c.state().feedRow,1);
c.run(50000);assert.equal(c.state().typed,3,'no strike during return/feed');
c.run(60000);assert.equal(c.state().typed,3,'space does not strike');
c.run(70000);assert.equal(c.state().typed,4);
console.log('PASS: individual overstrikes, no catch-up batch, line-end hold, rightward return, discrete feed, silent space');
