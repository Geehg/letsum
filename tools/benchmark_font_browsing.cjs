const { chromium } = require(process.env.LETSUM_PLAYWRIGHT || 'playwright');
const fs = require('node:fs');
const out = process.argv[2] || 'before';
const base = process.env.LETSUM_TEST_URL || 'http://127.0.0.1:8889';
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  const context = await browser.newContext({ viewport:{width:1440,height:900},locale:'ko-KR' });
  await context.addInitScript(() => {
    const intervals = new Map(), observers = [];
    const si = window.setInterval, ci = window.clearInterval;
    window.setInterval = function(fn, ms, ...args) { const id = si(fn, ms, ...args); intervals.set(id, {ms, stack:new Error().stack}); return id; };
    window.clearInterval = function(id) { intervals.delete(id); return ci(id); };
    const IO = window.IntersectionObserver;
    window.IntersectionObserver = class extends IO {
      constructor(fn, options) { super(fn, options); this.refs = new Set(); this.refByTarget = new WeakMap(); observers.push(new WeakRef(this)); }
      observe(el) { if(!this.refByTarget.has(el)) {const ref=new WeakRef(el);this.refByTarget.set(el,ref);this.refs.add(ref);} super.observe(el); }
      unobserve(el) { this.refs.delete(this.refByTarget.get(el)); this.refByTarget.delete(el); super.unobserve(el); }
      disconnect() { this.refs.clear(); this.refByTarget=new WeakMap(); super.disconnect(); }
    };
    // Weak references ensure this instrumentation cannot keep removed cards alive.
    window.__perfProbe = () => ({
      observed: observers.flatMap(r => {const o=r.deref();return o?[...o.refs.values()].map(r=>r.deref()).filter(Boolean):[]}).reduce((r,n)=>(r[n.isConnected?'connected':'detached']++,r),{connected:0,detached:0}),
      intervals:[...intervals.values()].map(x=>({ms:x.ms,carousel:x.stack.includes('step')})),
      nodes:document.querySelectorAll('*').length, cards:document.querySelectorAll('#results [data-id]').length,
      fonts:document.fonts.size,
    });
  });
  const page = await context.newPage(); const errors = [], requests = [];
  page.on('pageerror', e=>errors.push(e.message));
  const font = fs.readFileSync(process.env.LETSUM_TEST_FONT);
  await page.route('**/*', async route => {
    const req=route.request(), u=new URL(req.url());
    if (req.resourceType()==='font') { requests.push(u.href); return route.fulfill({body:font,contentType:'font/ttf',headers:{'access-control-allow-origin':'*'}}); }
    if (u.origin!==base) return u.hostname==='fonts.googleapis.com' ? route.fulfill({body:'',contentType:'text/css'}) : route.abort();
    if (u.pathname.startsWith('/api/')) {
      let json={};
      if(u.pathname==='/api/stats') json=Object.fromEntries((u.searchParams.get('ids')||'').split(',').map(id=>[id,{likes:0,comments:0,shots:[],recent:[]}]));
      if(/comments|shots/.test(u.pathname)) json={items:[]};
      return route.fulfill({json});
    }
    return route.continue();
  });
  const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
  const report={samples:[],grow:[],detail:[],errors,fixture:'All requested font URLs use one local Arial file to isolate DOM, loader and lifecycle costs from network variation.'};
  async function sample(label) {
    await cdp.send('HeapProfiler.collectGarbage');
    const dom=await cdp.send('Memory.getDOMCounters');
    const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
    const data=await page.evaluate(()=>window.__perfProbe());
    report.samples.push({label,...data,retainedDOM:dom.nodes,listeners:dom.jsEventListeners,heapMB:metrics.JSHeapUsedSize/1048576,fontRequests:requests.length});
    console.log(label,JSON.stringify(report.samples.at(-1)));
  }
  try {
    await page.goto(base+'/index.html?ui=ko',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1500);
    await sample('initial');
    for(let i=0;i<9;i++) {
      report.grow.push(await page.evaluate(async () => {const t=performance.now();document.querySelector('#feedMore').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-t;}));
      await page.locator('#results .ig').last().scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
      if([2,5,8].includes(i)) await sample('grow-'+(i+1));
    }
    // Replace cards repeatedly while they remain observed offscreen.
    for(let i=0;i<12;i++) await page.evaluate(i=>{const p=document.querySelector('#previewText');p.value='누적 열람 성능 확인 '+i;p.dispatchEvent(new Event('input',{bubbles:true}));},i);
    await page.waitForTimeout(500); await sample('rerender-12');
    const ids=await page.evaluate(()=>[...document.querySelectorAll('#results .ig[data-id]')].slice(0,24).map(el=>el.dataset.id));
    for(const id of ids) {
      report.detail.push(await page.evaluate(async id=>{const t=performance.now();document.querySelector('[data-open="'+id+'"]').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));document.querySelector('#mx').click();return performance.now()-t;},id));
    }
    await sample('details-24');
    // A hover animation can lose its mouseleave when its card is replaced by a render.
    await page.evaluate(()=>scrollTo(0,0));
    await page.locator('#results .ig').first().hover(); await page.waitForTimeout(1200);
    await page.evaluate(()=>{const p=document.querySelector('#previewText');p.value='교체';p.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.mouse.move(0,0); await page.waitForTimeout(1000);
    await sample('hover-replaced');
    await page.evaluate(()=>document.querySelector('[data-v="list"]').click());await page.waitForTimeout(200);
    await sample('list-reset');
  } finally {
    fs.writeFileSync(require('node:path').join(process.env.LETSUM_BENCH_DIR || require('node:os').tmpdir(), 'letsum-font-browsing-'+out+'.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
