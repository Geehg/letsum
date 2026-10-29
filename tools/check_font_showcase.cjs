// Exercise bot attribution, reference/usage separation, real-count isolation and posting.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.LETSUM_PLAYWRIGHT||'playwright');
const root=path.join(__dirname,'..'),data=require('./state/font_showcase.json');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],posts=[];
  page.on('pageerror',e=>errors.push(e.stack));
  await page.route('**/api/**',route=>{
   const req=route.request(),u=new URL(req.url());let response={ok:true,items:[]};
   if(req.method()==='POST') posts.push({path:u.pathname,body:req.postDataJSON()});
   if(u.pathname==='/api/locale')response={language:'ko'};
   if(u.pathname==='/api/stats')response=Object.fromEntries((u.searchParams.get('ids')||'').split(',').map(id=>[id,{likes:3,comments:1,liked:false,shots:[],recent:[{name:'실제 댓글 테스트',body:'<img src=x onerror=alert(1)> 기존 댓글',likes:2}]}]));
   if(u.pathname==='/api/comments')response=req.method()==='GET'?{items:[{id:7,name:'실제 댓글 테스트',body:'<img src=x onerror=alert(1)> 기존 댓글',created:Date.now()-10000,likes:2,liked:false}]}:{ok:true,item:{id:8,name:'테스트',body:'새로운 실제 댓글 테스트',created:Date.now(),likes:0,liked:false}};
   return route.fulfill({json:response});
  });
  const base=process.env.LETSUM_TEST_URL||'http://127.0.0.1:8886';
  await page.goto(base+'/?ui=ko&view=feed&q=프리텐다드');
  await page.waitForSelector('.sc-review');
  const card=page.locator('.ig[data-id="k-pretendard"]');
  await assert.doesNotReject(()=>card.locator('.sc-disclosure').waitFor());
  assert.match(await card.locator('.sc-disclosure').innerText(),/렛썸봇.*이용자 후기가 아닙니다/);
  assert.equal(await card.locator('.sc-heading b').innerText(),'렛썸봇');
  assert.equal(await card.locator('.sc-demo').count(),0);
  await page.waitForFunction(()=>document.querySelector('[data-likeline="k-pretendard"]')?.textContent==='좋아요 3개');
  assert.equal(await card.locator('[data-cmts]').innerText(),'1');
  assert.equal(await card.locator('.ig-recent img').count(),0);
  assert.equal(posts.filter(x=>['/api/like','/api/comments','/api/comment-like'].includes(x.path)).length,0);
  const counts=await page.evaluate(ids=>ids.map(id=>({id,html:LSShowcase.feed(id)})),data.entries.map(x=>x.id));
  assert.equal(counts.length,30);
  assert.equal(data.entries.filter(x=>x.source?.kind==='usage').length,12);
  assert.equal(data.entries.filter(x=>x.source?.kind==='specimen').length,16);
  for(const x of counts){
   const source=data.entries.find(e=>e.id===x.id).source;
   assert.match(x.html,/sc-disclosure/);assert(!x.html.includes('data-like='));
   if(source){assert.match(x.html,/렛썸봇/);assert(!x.html.includes('sc-demo'));}
   else assert.match(x.html,/데모 좋아요/);
   if(source?.kind==='specimen'){assert.match(x.html,/공식 견본 · 참고용/);assert.match(x.html,/실제 서비스 사용 사례나 이용자 후기가 아닙니다/);assert(!x.html.includes('실제 웹사이트 사용'));}
   if(source?.kind==='usage'){assert.match(x.html,/실제 웹사이트 사용/);assert.match(x.html,/bot-usage/);}
  }
  for(const entry of data.entries.filter(x=>x.source)){
   assert(fs.existsSync(path.join(root,'html',entry.source.image)));
   assert.equal((await page.request.get(base+entry.source.image)).status(),200);
  }
  await card.locator('.sc-open').click();await page.waitForSelector('.rv-list .sc-review');
  assert.equal(await page.locator('.rv-n').innerText(),'1');
  assert.equal(await page.locator('.rv-best .sc-review').count(),0);
  assert.match(await page.locator('.rv-best').innerText(),/기존 댓글/);
  await page.locator('.rv-compose textarea').fill('새로운 실제 댓글 테스트');await page.locator('.rv-post').click();
  await page.waitForFunction(()=>document.querySelector('.rv-n')?.textContent==='2');
  assert.equal(posts.filter(x=>x.path==='/api/comments').length,1);
  await page.evaluate(()=>LSUI.choose('en'));
  assert.match(await page.locator('.rv-list .sc-disclosure').innerText(),/not a user review/);
  assert.match(await page.locator('.rv-list .sc-text').innerText(),/flex/);
  await page.evaluate(()=>LSUI.choose('ko'));
  assert.match(await page.locator('.rv-list .sc-disclosure').innerText(),/렛썸봇.*이용자 후기가 아닙니다/);
  await page.screenshot({path:process.env.LETSUM_SCREENSHOT||'/tmp/letsum-showcase-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  assert(await page.locator('.rv-list .sc-review').isVisible());
  const overflow=await page.locator('.rv-list .sc-review').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false);
  await page.locator('.rv-list .sc-review').scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/letsum-showcase-mobile.png'});
  await page.route('**/api/comments?*',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
  await page.goto(base+'/?ui=en&view=feed&q=프리텐다드');await page.waitForSelector('.sc-open');await page.locator('.sc-open').click();
  await page.waitForSelector('.rv-list .sc-review');assert.match(await page.locator('.rv-empty').innerText(),/could not|unable|failed|불러오지/i);
  await page.goto(base+'/?ui=en&view=feed&q=주아체');await page.waitForSelector('.sc-review');
  assert.match(await page.locator('.sc-heading b').innerText(),/Letsum Bot/);
  assert.match(await page.locator('.sc-disclosure').innerText(),/reference material, not a real-service usage example/);
  assert.equal(await page.locator('.sc-demo').count(),0);
  await page.evaluate(()=>LSUI.choose('ko'));
  assert.match(await page.locator('.sc-disclosure').innerText(),/참고용으로 게시한 공식 견본/);
  await page.screenshot({path:'/tmp/letsum-bot-reference.png'});
  assert.deepEqual(errors,[]);console.log('PASS: 12 verified usage posts, 16 bot references, 2 samples, 28 attachments, real counts/reviews, posting, ko/en, mobile, API failure');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
