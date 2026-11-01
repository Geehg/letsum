/* Native Enter regression: extra line breaks must not consume source glyphs. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 for(const [model,width,close] of [['hermes3000',1440,false],['hermes3000',390,true],['lettera32',1280,false],['olympiasm3',1280,false]]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(close)await page.addInitScript(()=>localStorage.setItem('typebook-v1:camera','close'));
  await page.goto((process.env.TYPEBOOK_URL||'http://127.0.0.1:8892')+'/#/read/small-sentence');
  await page.click(`[data-choose-model="${model}"]`);await page.locator('#tbMain[data-hermes-state="ready"]').waitFor({timeout:60000});await page.evaluate(()=>document.fonts.ready);
  const source=await page.locator('#tbOrig').getAttribute('data-source'),chars=Array.from(source);
  const prefix=async text=>{await page.evaluate(text=>{const i=document.getElementById('tbInput');i.value=text;i.setSelectionRange(text.length,text.length);i.focus({preventScroll:true});i.dispatchEvent(new InputEvent('input',{bubbles:true}));},text);await page.waitForTimeout(200);};
  const visible=async n=>page.evaluate(n=>{const s=document.getElementById('tbOrig').children[n],c=getComputedStyle(s);return {text:s.textContent,color:c.color,error:s.dataset.whitespaceError||'',typed:s.dataset.typed};},n);
  for(const n of chars.flatMap((c,i)=>c==='\n'?[i]:[])){
   await prefix(chars.slice(0,n).join(''));await page.keyboard.press('Enter');await page.waitForTimeout(450);
   const correct=chars.slice(0,n+1).join('');assert.equal(await page.inputValue('#tbInput'),correct);
   for(let k=0;k<3;k++)await page.keyboard.press('Enter');await page.waitForTimeout(150);
   assert.equal(await page.inputValue('#tbInput'),correct,'duplicate Enter consumes next letter');assert.notEqual((await visible(n+1)).color,'rgba(0, 0, 0, 0)');
   await page.keyboard.insertText(chars[n+1]);assert.equal(await page.inputValue('#tbInput'),correct+chars[n+1]);
   // Existing drafts with an extra newline still show the expected source glyph.
   await prefix(correct+'\n');const restored=await visible(n+1);assert.equal(restored.error,'true');assert.notEqual(restored.color,'rgba(0, 0, 0, 0)');assert.equal(restored.text,chars[n+1]);
   await page.keyboard.press('Backspace');assert.equal(await page.inputValue('#tbInput'),correct);
  }
  await prefix(chars.slice(0,10).join(''));await page.keyboard.press('Enter');assert.equal(await page.inputValue('#tbInput'),chars.slice(0,10).join(''));
  const composing=await page.evaluate(()=>{const i=document.getElementById('tbInput');i.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));const e=new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertLineBreak',isComposing:true});i.dispatchEvent(e);i.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));return e.defaultPrevented;});assert.equal(composing,false,'IME confirmation intercepted');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({model,width,close,passed:true}));await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
