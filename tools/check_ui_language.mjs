import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { localeResponse } from '../worker/src/locale.js';
import api from '../worker/src/index.js';

// The country response never contains the visitor's country, IP or other identity data.
for (const [country, language] of [['KR','ko'],['US','en'],['JP','en'],['DE','en'],['XX',null],['T1',null],['',null],[undefined,null]]) {
  const response = localeResponse({ cf: { country } });
  assert.deepEqual(await response.json(), { language });
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('cdn-cache-control'), /no-store/);
}
const request = new Request('https://letsum.app/api/locale');
Object.defineProperty(request, 'cf', { value: { country: 'US' } });
assert.deepEqual(await (await api.fetch(request, {})).json(), { language: 'en' });
const dictionary = JSON.parse(fs.readFileSync(new URL('./i18n/en.json', import.meta.url)));
const data = {}; vm.createContext(data);
vm.runInContext(fs.readFileSync(new URL('../html/js/data.js', import.meta.url), 'utf8') + ';this.licenses=LICENSE_INFO;', data);
for (const license of Object.values(data.licenses)) for (const key of ['full','short','note']) {
  assert(dictionary[license[key]] || !/[가-힣]/.test(license[key]), `Missing license translation: ${license[key]}`);
}
console.log('PASS: country endpoint, no-store headers, API integration, all license summaries');

if (!process.env.LETSUM_PLAYWRIGHT) process.exit(0);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LETSUM_PLAYWRIGHT);
const base = process.env.LETSUM_TEST_URL || 'http://127.0.0.1:8879';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
async function scenario({ locale = 'en-US', language = 'en', stored, query = '', fail = false, delay = 0, blocked = false, mobile = false } = {}) {
  const context = await browser.newContext({ locale, viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  await context.addInitScript(({ stored, blocked }) => {
    if (stored) localStorage.setItem('ls_ui_language', stored);
    if (blocked) for (const name of ['localStorage','sessionStorage']) Object.defineProperty(window, name, { get() { throw new Error('Storage blocked'); } });
  }, { stored, blocked });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === '/api/locale') {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      return fail ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fulfill({ json: { language } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: url.pathname === '/api/samples' ? { items: null } : /comments|shots/.test(url.pathname) ? { items: [] } : {} });
    return route.continue();
  });
  await page.goto(base + '/' + query); await page.waitForTimeout(300);
  return { page, context };
}
async function isLanguage(page, expected) {
  await page.waitForFunction(expected => document.documentElement.lang === expected, expected);
  assert.equal(await page.locator('[data-ui-choice="' + expected + '"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('nav.main a').first().textContent(), expected === 'en' ? 'Korean fonts' : '한글 폰트');
}
try {
  for (const [options, expected] of [
    [{ locale:'ko-KR', language:'en' },'en'],
    [{ locale:'en-US', language:'ko' },'ko'],
    [{ locale:'ja-JP', language:null },'en'],
    [{ locale:'ko-KR', language:null },'ko'],
    [{ locale:'ko-KR', fail:true },'ko'],
    [{ locale:'en-US', fail:true },'en'],
    [{ language:'en', stored:'ko' },'ko'],
    [{ language:'ko', stored:'ko', query:'?ui=en' },'en'],
    [{ language:'en', query:'?ui=invalid' },'en'],
    [{ language:'en', blocked:true },'en'],
  ]) { const { page, context } = await scenario(options); await isLanguage(page, expected); await context.close(); }
  console.log('PASS: country priority, language fallback, preferences, explicit URL, blocked storage');

  const { page, context } = await scenario({ query:'?ui=en' });
  const originalSample = await page.locator('#previewText').inputValue();
  await page.locator('#previewText').fill('분류 Filter 한글 123');
  await page.locator('[data-v="grid"]').click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.r-pv').first().textContent(), '분류 Filter 한글 123');
  await page.locator('#qTop').fill('Noto Sans KR');
  await page.waitForTimeout(100);
  assert.match(await page.locator('#count').innerText(), /1 \/ 562 fonts/);
  await page.locator('#qTop').fill('');
  await page.locator('[data-cat="명조"]').click();
  assert.equal(await page.locator('[data-cat="명조"]').getAttribute('class'), 'fbtn on');
  assert.match(await page.locator('[data-cat="명조"]').innerText(), /Serif/);
  await page.locator('[data-ui-choice="ko"]').click(); await isLanguage(page, 'ko');
  assert.equal(await page.locator('#previewText').inputValue(), '분류 Filter 한글 123');
  assert.match(await page.locator('[data-cat="명조"]').innerText(), /명조/);
  await page.locator('[data-ui-choice="en"]').click();
  await page.locator('[data-cat="전체"]').click();
  await page.locator('[data-alt="0"]').click();
  assert.match(await page.locator('[data-alt="0"]').getAttribute('class'), /on/);
  await page.locator('[data-alt="0"]').click();
  assert.doesNotMatch(await page.locator('[data-alt="0"]').getAttribute('class') || '', /on/);
  // A dictionary key entered by a user must never be translated in their specimen or review.
  await page.evaluate(() => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="rv-b"><p>분류</p></div><div class="pv-big">분류</div><textarea placeholder="리뷰 달기…">분류</textarea><button id="dynamicLabel">닫기</button>';
    document.body.appendChild(wrapper);
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.rv-b>p').last().textContent(), '분류');
  assert.equal(await page.locator('.pv-big').last().textContent(), '분류');
  assert.equal(await page.locator('#dynamicLabel').textContent(), 'Close');
  assert.equal(await page.locator('textarea').last().getAttribute('placeholder'), 'Write a review…');
  await page.locator('nav.main a[href^="en/"]').click();
  await isLanguage(page, 'en');
  assert.equal(await page.evaluate(() => window.LS_LANG), 'en');
  assert.match(page.url(), /\/en\/\?ui=en/);
  await page.goto(base + '/?ui=en#f=noto-sans-kr'); await page.waitForTimeout(300);
  assert.match(await page.locator('#modalBox').textContent(), /Permitted uses \(license matrix\)/);
  assert.equal(await page.locator('#modalBox [data-dl="page"]').getAttribute('href'), 'https://fonts.google.com/specimen/Noto+Sans+KR');
  assert.match(await page.locator('#modalBox').textContent(), /Commercial use, modification and redistribution permitted/);
  await context.close();
  console.log('PASS: search, filter keys, alternatives, both language directions, live nodes, user text, catalogue navigation, license/download modal');

  const race = await scenario({ language:'en', locale:'ko-KR', delay:900 });
  await race.page.locator('[data-ui-choice="ko"]').click(); await race.page.waitForTimeout(1000);
  await isLanguage(race.page, 'ko'); await race.context.close();
  const blocked = await scenario({ language:'en', blocked:true });
  await blocked.page.locator('[data-ui-choice="ko"]').click();
  await blocked.page.locator('nav.main a[href^="en/"]').click(); await isLanguage(blocked.page, 'ko');
  await blocked.context.close();
  console.log('PASS: late country response cannot override manual choice; navigation retains choice without storage');

  const mobile = await scenario({ mobile:true, query:'?ui=en' });
  assert(await mobile.page.locator('[data-ui-choice="en"]').isVisible());
  assert(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await mobile.page.locator('#filterBtn').click();
  await mobile.page.locator('[data-cat="명조"]').click();
  await mobile.page.locator('#sideClose').click();
  await mobile.page.screenshot({ path:'/private/tmp/letsum-ui-mobile.png', fullPage:false });
  await mobile.context.close();
  assert.deepEqual(errors, []);
  console.log('PASS: mobile viewport, filter sheet, no browser runtime errors');
} finally { await browser.close(); }
