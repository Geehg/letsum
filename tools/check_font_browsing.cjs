// Browser regression for append-only results, font budgets and detached carousel cleanup.
// All API traffic is intercepted. A local font fixture isolates loader behavior from CDNs.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.LETSUM_PLAYWRIGHT || 'playwright');
const base = process.env.LETSUM_TEST_URL || 'http://127.0.0.1:8889';
const font = fs.readFileSync(process.env.LETSUM_TEST_FONT);
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  const errors = [], report = [];
  async function session(width, pathname = '/') {
    const context = await browser.newContext({ viewport:{width,height:900}, locale:'ko-KR' });
    await context.addInitScript(() => {
      const timers = new Map(), start = window.setInterval, stop = window.clearInterval;
      window.setInterval = (fn, ms, ...args) => { const id = start(fn, ms, ...args); timers.set(id, ms); return id; };
      window.clearInterval = id => { timers.delete(id); stop(id); };
      window.__carouselCount = () => [...timers.values()].filter(ms => ms === 1600 || ms === 2200).length;
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    let failing = false, fontRequests = 0;
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (req.resourceType() === 'font') {
        fontRequests++; await new Promise(resolve => setTimeout(resolve, 25));
        return failing ? route.abort() : route.fulfill({body:font,contentType:'font/ttf',headers:{'access-control-allow-origin':'*'}});
      }
      if (url.hostname === 'fonts.googleapis.com') {
        const families = url.searchParams.getAll('family');
        const css = families.length !== 1 ? '' : families.flatMap(family => {
          const [name, weights] = family.split(':wght@');
          return (weights || '400').split(';').map(w => `@font-face{font-family:'${name}';font-weight:${w};src:url('https://fixtures.test/${encodeURIComponent(name)}/${w}.ttf')}`);
        }).join('');
        return route.fulfill({body:css,contentType:'text/css'});
      }
      if (url.origin !== base) return route.abort();
      if (url.pathname.startsWith('/api/')) {
        let json = {};
        if (/comments|shots/.test(url.pathname)) { await new Promise(resolve => setTimeout(resolve, 80)); json = {items:[]}; }
        if (url.pathname === '/api/stats') json = Object.fromEntries((url.searchParams.get('ids') || '').split(',').map(id => [id,{likes:0,comments:0,recent:[],shots:[]}]));
        return route.fulfill({json});
      }
      return route.continue();
    });
    await page.goto(base + pathname + '?ui=ko', { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(1000);
    return {context,page,setFail:()=>{failing=true;},requests:()=>fontRequests};
  }
  async function append(page, button) {
    return page.evaluate(selector => {
      const first = document.querySelector('#results [data-id]');
      const n = document.querySelectorAll('#results [data-id]').length;
      document.querySelector(selector).click();
      const ids = [...document.querySelectorAll('#results [data-id]')].map(el => el.dataset.id);
      return {preserved:first === document.querySelector('#results [data-id]'), added:ids.length-n, unique:new Set(ids).size===ids.length};
    }, button);
  }
  async function checkGeometry(page) {
    const media = page.locator('#results .ig-media').first();
    await media.scrollIntoViewIfNeeded();
    const before = await media.boundingBox();
    await media.locator('.ig-track').evaluate(el=>el.style.contentVisibility='visible');
    const after = await media.boundingBox();
    await media.locator('.ig-track').evaluate(el=>el.style.removeProperty('content-visibility'));
    assert(before.width>0 && before.height>0);
    assert(Math.abs(before.width-after.width)<1 && Math.abs(before.height-after.height)<1, 'Offscreen rendering changed preview geometry');
  }
  try {
    const {context,page,setFail,requests} = await session(1440);
    for (let i=0;i<9;i++) {
      assert.deepEqual(await append(page,'#feedMore'), {preserved:true,added:24,unique:true});
      await page.locator('#results .ig').last().scrollIntoViewIfNeeded(); await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);
    assert((await page.evaluate(()=>document.fonts.size)) <= 102, 'Loaded faces must stay near the 96-face budget, plus at most 6 in flight');
    await page.locator('#results .ig').first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const id=document.querySelector('#results .ig').dataset.id, f=FONTS.find(f=>f.id===id);
      return [...document.fonts].some(face=>face.family.replace(/['"]/g,'')===f.family.split(',')[0].replace(/['"]/g,'').trim() && face.status==='loaded');
    });
    await checkGeometry(page);
    // In-flight measurement must not rebuild the review form or lose an input.
    await page.evaluate(()=>{location.hash='#f=k-pretendard';});
    await page.locator('.rv-compose textarea').fill('작성 중인 리뷰 보존');
    await page.evaluate(()=>window.__reviewInput=document.querySelector('.rv-compose textarea'));
    await page.waitForTimeout(500);
    assert(await page.evaluate(()=>window.__reviewInput===document.querySelector('.rv-compose textarea')));
    assert.equal(await page.locator('.rv-compose textarea').inputValue(),'작성 중인 리뷰 보존');
    await page.locator('#mx').click();
    assert.equal(await page.locator('#modalBox').innerHTML(),'');
    // Closing before shots/comments arrive must not mutate a later detail or throw.
    for (const id of ['k-pretendard','k-freesentation','jua']) {
      await page.evaluate(id=>{location.hash='#f='+id;},id);
      await page.waitForSelector('#mx'); await page.locator('#mx').click();
    }
    await page.waitForTimeout(200);
    await page.locator('#results .ig-media').first().hover(); await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(()=>__carouselCount()),1);
    await page.evaluate(()=>{const p=document.querySelector('#previewText');p.value='새 문장';p.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.mouse.move(0,0); await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>__carouselCount()),0,'Removed carousel interval must be cleared');
    for (const view of ['list','grid','ctx']) {
      await page.evaluate(view=>{scrollTo(0,0);document.querySelector('[data-v="'+view+'"]').click();},view);
      const result = await append(page,'#moreBtn');
      assert(result.preserved && result.unique && result.added===60, view);
    }
    await page.evaluate(() => {
      const ids=[...document.querySelectorAll('#results [data-cmp]')].slice(0,2).map(el=>el.dataset.cmp);
      ids.forEach(id=>document.querySelector('#results [data-cmp="'+id+'"]').click());
      document.querySelector('#cmpOpen').click();
    });
    assert.equal(await page.locator('.cmp .col').count(),2);
    await page.evaluate(()=>{document.querySelector('#cNorm').click();document.querySelector('#mx').click();});
    await page.waitForTimeout(300);
    await page.evaluate(()=>LSUI.choose('en'));
    await page.waitForFunction(()=>document.querySelector('nav.main a').textContent==='Korean fonts');
    await page.evaluate(()=>LSUI.choose('ko'));
    await page.waitForFunction(()=>document.querySelector('nav.main a').textContent==='한글 폰트');
    // A failed font must not cause recursive detail rebuilding/retry storms.
    setFail(); await page.evaluate(()=>{location.hash='#f=k-gmarket-sans';});
    await page.waitForTimeout(1500); const failedCount = requests();
    await page.waitForTimeout(1000); assert(requests()-failedCount <= 2, 'Failed detail caused repeated font requests');
    await page.locator('#mx').click();
    report.push('240 feed cards; cache eviction/reload; no duplicate cards; 3 other views append; carousel cleanup; draft/async close; comparison close during measurement; failed-font stability');
    await context.close();

    for (const pathname of ['/en/','/dingbat/']) {
      const {context,page} = await session(390,pathname);
      for (let i=0;i<8;i++) {
        if(!await page.locator('#feedMore').count()) break;
        const result = await append(page,'#feedMore'); assert(result.preserved && result.unique);
        await page.locator('#results .ig').last().scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
      }
      await page.waitForTimeout(300);
      assert((await page.locator('link[data-font-preview]').count()) <= 24, 'Latin/dingbat stylesheet cache grew past budget');
      await page.locator('#results .ig-media').first().scrollIntoViewIfNeeded();
      await checkGeometry(page);
      await page.screenshot({path:'/private/tmp/letsum-perf-'+(pathname==='/en/'?'latin':'dingbat')+'-mobile.png'});
      report.push(pathname+' mobile: lazy Google CSS, bounded cache, unchanged preview dimensions');
      await context.close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS',report);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
