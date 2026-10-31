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
async function scenario({ locale = 'en-US', language = 'en', stored, cached, query = '', pathname = '/', userAgent, fail = false, delay = 0, blocked = false, mobile = false } = {}) {
  const context = await browser.newContext({ locale, ...(userAgent ? { userAgent } : {}), viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  await context.addInitScript(({ stored, cached, blocked }) => {
    if (stored) localStorage.setItem('ls_ui_language', stored);
    if (cached) sessionStorage.setItem('ls_ui_region', JSON.stringify({ language: cached, time: Date.now() }));
    if (blocked) for (const name of ['localStorage','sessionStorage']) Object.defineProperty(window, name, { get() { throw new Error('Storage blocked'); } });
    window.__languageHistory = [];
    new MutationObserver(() => {
      if (document.documentElement) window.__languageHistory.push(document.documentElement.lang);
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['lang'] });
  }, { stored, cached, blocked });
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
  await page.goto(base + pathname + query); await page.waitForTimeout(300);
  return { page, context };
}
async function isLanguage(page, expected) {
  await page.waitForFunction(expected => document.documentElement.lang === expected, expected);
  assert.equal(await page.locator('[data-ui-choice="' + expected + '"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('nav.main a').first().textContent(), expected === 'en' ? 'Korean fonts' : '한글 폰트');
}
try {
  for (const [options, expected] of [
    [{ locale:'ko-KR', language:'en' },'ko'],
    [{ locale:'en-US', language:'ko' },'ko'],
    [{ locale:'ja-JP', language:null },'ko'],
    [{ locale:'ko-KR', language:null },'ko'],
    [{ locale:'ko-KR', fail:true },'ko'],
    [{ locale:'en-US', fail:true },'ko'],
    [{ language:'en', stored:'ko' },'ko'],
    [{ language:'ko', stored:'en' },'en'],
    [{ language:'en', cached:'en' },'ko'],
    [{ language:'ko', stored:'ko', query:'?ui=en' },'en'],
    [{ language:'en', stored:'en', query:'?ui=ko' },'ko'],
    [{ language:'en', query:'?ui=invalid' },'ko'],
    [{ language:'en', blocked:true },'ko'],
    [{ language:'ko', query:'?ui=en', blocked:true },'en'],
  ]) {
    const { page, context } = await scenario(options); await isLanguage(page, expected);
    if (expected === 'ko') {
      assert.match(await page.title(), /^무료 한글 폰트/);
      assert(!await page.evaluate(() => window.__languageHistory.includes('en')), 'Korean page must never flash English');
    } else assert.equal(new URL(page.url()).searchParams.get('ui'), 'en');
    await context.close();
  }
  console.log('PASS: stable Korean default across regions, browser languages, old region caches and failures; explicit/saved choices');

  // Compare rendered crawlable content against the actual source, not test copy.
  // The same rule applies to ordinary visitors and Googlebot; no bot detection.
  for (const pathname of ['/', '/index.html', '/font/k-busan-dandi-gothic.html', '/topics/free-gothic-fonts.html', '/en/', '/guide.html']) {
    const file = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    const source = fs.readFileSync(new URL('../html' + file, import.meta.url), 'utf8');
    const title = source.match(/<title>([^<]+)<\/title>/)[1];
    const canonical = source.match(/<link rel="canonical" href="([^"]+)"/)[1];
    const { page, context } = await scenario({ pathname, locale:'en-US', language:'en', userAgent:'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
    await isLanguage(page, 'ko');
    assert.equal(await page.title(), title);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
    const description = source.match(/<meta name="description" content="([^"]*)"/);
    if (description) assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), description[1]);
    else assert.equal(await page.locator('meta[name="description"]').count(), 0);
    assert.match(await page.locator('h1').first().textContent(), /[가-힣]/);
    assert.equal(new URL(page.url()).pathname, pathname);
    assert.equal(new URL(page.url()).search, '');
    await context.close();
  }
  console.log('PASS: home, index alias, font detail, topic, Latin catalogue and guide keep Korean titles, headings, descriptions and canonical URLs');

  const suggested = await scenario({ mobile:true });
  assert.equal(await suggested.page.locator('[data-ui-choice="en"]').getAttribute('data-ui-suggested'), 'true');
  assert(await suggested.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert((await suggested.page.locator('#qTop').boundingBox()).width >= 200, 'Language choices must not squeeze the mobile search input');
  await suggested.page.screenshot({ path:'/private/tmp/letsum-seo-korean-mobile.png' });
  await suggested.page.locator('[data-ui-choice="en"]').click();
  await isLanguage(suggested.page, 'en');
  assert.equal(await suggested.page.locator('[data-ui-choice="en"]').getAttribute('data-ui-suggested'), 'false');
  await suggested.context.close();
  console.log('PASS: overseas visitors receive an English suggestion and can switch on mobile');

  const returning = await scenario({ stored:'en', query:'?q=Noto%20Sans%20KR#fonts' });
  const restoredURL = new URL(returning.page.url());
  assert.equal(restoredURL.searchParams.get('ui'), 'en');
  assert.equal(restoredURL.searchParams.get('q'), 'Noto Sans KR');
  assert.equal(restoredURL.hash, '#fonts');
  await returning.page.reload(); await isLanguage(returning.page, 'en');
  await returning.context.close();
  console.log('PASS: restoring a saved preference preserves search parameters, fragment and reload behavior');

  const { page, context } = await scenario({ query:'?ui=en' });
  const originalSample = await page.locator('#previewText').inputValue();
  await page.locator('#previewText').fill('분류 Filter 한글 123');
  await page.locator('[data-v="grid"]').click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.r-pv').first().textContent(), '분류 Filter 한글 123');
  await page.locator('#qTop').fill('Noto Sans KR');
  await page.waitForTimeout(100);
  assert.match(await page.locator('#count').innerText(), /1 \/ [\d,]+ fonts/);
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
  const englishRace = await scenario({ language:'ko', locale:'ko-KR', delay:900 });
  await englishRace.page.locator('[data-ui-choice="en"]').click(); await englishRace.page.waitForTimeout(1000);
  await isLanguage(englishRace.page, 'en'); await englishRace.context.close();
  const late = await scenario({ language:'en', locale:'ko-KR', delay:1800 });
  await late.page.waitForTimeout(1900); await isLanguage(late.page, 'ko'); await late.context.close();
  const blocked = await scenario({ language:'en', blocked:true });
  await blocked.page.locator('[data-ui-choice="ko"]').click();
  await blocked.page.locator('nav.main a[href^="en/"]').click(); await isLanguage(blocked.page, 'ko');
  await blocked.context.close();
  const blockedEnglish = await scenario({ blocked:true });
  await blockedEnglish.page.locator('[data-ui-choice="en"]').click();
  await blockedEnglish.page.locator('nav.main a[href^="en/"]').click(); await isLanguage(blockedEnglish.page, 'en');
  await blockedEnglish.context.close();
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
