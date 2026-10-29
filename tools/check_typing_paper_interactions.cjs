const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1310,height:863}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TYPEBOOK_URL||'http://127.0.0.1:8888')+'/#/read/byeol');await page.locator('#tbModelGallery[open]').waitFor();await page.click('[data-choose-model="olympiasm3"]');await page.locator('#tbMain[data-hermes-state="ready"]').waitFor({timeout:60000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(900);
 const setPrefix=async n=>{await page.evaluate(n=>{const i=document.getElementById('tbInput'),h=document.getElementById('tbOrig');i.value=Array.from(h.dataset.source).slice(0,n).join('');i.setSelectionRange(i.value.length,i.value.length);i.focus();i.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));},n);await page.waitForTimeout(450);};
 const visible=async()=>page.evaluate(()=>{const i=document.getElementById('tbInput'),h=document.getElementById('tbOrig'),p=document.getElementById('tbHermesPaper'),n=Array.from(i.value.slice(0,i.selectionStart)).length,s=h.children[n],pr=p.getBoundingClientRect(),r=s?.getBoundingClientRect();return {n,shown:!!r&&r.top>=pr.top-1.5&&r.bottom<=pr.bottom+1.5&&r.left>=pr.left-1.5&&r.right<=pr.right+1.5,top:pr.top,height:pr.height,focus:document.activeElement===i};});
 for(const n of [13,28,63,210,211]){
  await setPrefix(n);for(let repeat=0;repeat<3;repeat++){
   await page.keyboard.press('Enter');await page.waitForTimeout(230);let s=await visible();assert.equal(s.n,n+1);assert(s.shown,`Enter ${n}: next glyph missing`);
   await page.keyboard.press('Backspace');await page.waitForTimeout(180);s=await visible();assert.equal(s.n,n);assert(s.shown,`Backspace ${n}: caret missing`);
  }
 }
 // Native text insertion, then exact Korean IME start/update/confirm event order.
 await setPrefix(13);await page.keyboard.press('Enter');await page.keyboard.insertText('가');await page.waitForTimeout(300);assert.equal((await visible()).n,15);assert((await visible()).shown);
 const boundary=await page.evaluate(()=>{const h=document.getElementById('tbOrig'),children=[...h.children],line=parseFloat(getComputedStyle(h).lineHeight);return children.findIndex((s,i)=>i>220&&s.offsetTop-children[i-1].offsetTop>line/2);});
 assert(boundary>220);await setPrefix(boundary-1);
 const ime=await page.evaluate(async boundary=>{
  const i=document.getElementById('tbInput'),h=document.getElementById('tbOrig'),p=document.getElementById('tbHermesPaper'),source=Array.from(h.dataset.source),prefix=source.slice(0,boundary-1).join('');
  const y=()=>p.getBoundingClientRect().top,wait=ms=>new Promise(r=>setTimeout(r,ms));const before=y();
  i.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));i.value=prefix+'ㅎ';i.setSelectionRange(i.value.length,i.value.length);i.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'ㅎ',isComposing:true}));
  // Some platforms report false on the Enter that confirms an active composition.
  i.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',code:'Enter',keyCode:229,isComposing:false}));await wait(180);const pending=y();
  i.value=prefix+source[boundary-1];i.setSelectionRange(i.value.length,i.value.length);i.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:source[boundary-1]}));i.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:source[boundary-1],isComposing:false}));await wait(450);
  return {before,pending,after:y(),text:i.value,expected:prefix+source[boundary-1]};
 },boundary);
 assert(Math.abs(ime.before-ime.pending)<.1,'IME confirmation must not feed before commit');assert.equal(ime.text,ime.expected);assert((await visible()).shown);
 const draft=await page.inputValue('#tbInput');for(const viewport of [{width:1024,height:768},{width:768,height:1024},{width:1310,height:863}]){await page.setViewportSize(viewport);await page.waitForTimeout(800);assert.equal(await page.inputValue('#tbInput'),draft);assert((await visible()).shown,'resize preserves current glyph');}
 await page.evaluate(()=>document.getElementById('tbPaperFeed').click());await page.waitForTimeout(700);assert((await visible()).shown,'full sheet mode keeps current glyph');
 await page.evaluate(()=>document.getElementById('tbPaperFeed').click());await page.waitForTimeout(700);assert((await visible()).shown,'physical sheet mode keeps current glyph');assert.equal(await page.inputValue('#tbInput'),draft);
 // Page change resets the viewport without retaining a previous scroll window.
 await page.evaluate(()=>{const i=document.getElementById('tbInput');i.value=document.getElementById('tbOrig').dataset.source;i.setSelectionRange(i.value.length,i.value.length);i.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));});await page.waitForTimeout(350);
 await page.keyboard.press('Escape');await page.evaluate(()=>document.getElementById('tbNext').click());await page.waitForTimeout(650);assert.equal((await visible()).n,0);assert((await visible()).shown);assert.equal(await page.locator('#tbOrig').evaluate(e=>e.scrollTop),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['native Enter/Backspace at five boundaries, three repeats each','native Korean insertion','IME confirmation with keyCode 229','three viewport changes','physical/full mode toggle, draft preserved','next page scroll reset'],errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
