// 보기 안내 카드용 실제 화면 캡처(디자인이 바뀌면 다시 실행).
// 사용: 로컬 서버(html/ → localhost:8731) 실행 후, puppeteer-core를 설치한 폴더에서 node tools/capture_views.js <출력폴더>
//   → 출력 PNG를 왼쪽 위 기준으로 잘라(목록 62%·격자 50%·용도 50%·피드 42% 너비, 5:3) 480×288 WebP로 html/img/views/에 저장
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--hide-scrollbars'] });
  for (const v of ['list', 'grid', 'ctx', 'feed']) {
    const p = await b.newPage();
    await p.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
    await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ls_vtour', '1'); localStorage.setItem('ls_theme', 'light'); } catch (e) {} });
    await p.goto(`http://localhost:8731/index.html?view=${v}&cap=1`, { waitUntil: 'networkidle2', timeout: 60000 });
    await p.evaluate(() => { const s = document.querySelector('#sort'); s.value = 'pop'; s.dispatchEvent(new Event('change')); const t=document.querySelector('.tray, #tray'); if(t) t.style.display='none'; document.querySelectorAll('[class*=tray]').forEach(e=>e.style.display='none'); if (location.search.includes('view=ctx')) document.querySelector('[data-ctx=sub]').click(); });
    await new Promise(r => setTimeout(r, 5000));
    const box = await p.evaluate(() => { const r = document.querySelector('#results'); r.scrollIntoView(); window.scrollBy(0, -10); const b = r.getBoundingClientRect(); return { x: b.x, y: b.y + 10, w: b.width }; });
    await new Promise(r => setTimeout(r, 1500));
    const h = Math.round(box.w * 0.6);
    await p.screenshot({ path: `${process.argv[2]}/${v}.png`, clip: { x: box.x, y: box.y, width: box.w, height: h } });
    console.log(v, box);
    await p.close();
  }
  await b.close();
})();
