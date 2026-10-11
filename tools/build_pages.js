#!/usr/bin/env node
// 폰트별 정적 페이지 생성기 — "폰트명 다운로드" 검색 유입구.
// html/js/data.js를 읽어 html/font/<id>.html, html/sitemap.xml, html/robots.txt를 만든다. 빌드 시 1회, 서버·AI 없음.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "html");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8") + "\nthis.FONTS=FONTS;this.LICENSE_CATS=LICENSE_CATS;this.LICENSE_INFO=LICENSE_INFO;", ctx);
const { FONTS, LICENSE_CATS, LICENSE_INFO } = ctx;
const SITE = "https://letsum.app";
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const st = (v) => (v === "ok" ? '<span class="st-ok">사용 가능</span>' : v === "no" ? '<span class="st-no">사용 금지</span>' : '<span class="st-cond">조건부</span>');

function page(f) {
  const gfam = f.en.replace(/ /g, "+");
  const gf = !f.webfont && !f.intro; // Google Fonts 폰트인지, LETSUM 미리보기 웹폰트(공공 안심글꼴)인지
  const dl = Object.assign(gf ? { zip: `https://fonts.google.com/download?family=${gfam}`, page: `https://fonts.google.com/specimen/${gfam}`, srcName: "Google Fonts" } : { zip: null, srcName: "공유마당" }, f.dl || {}); // 원 배포처 링크 우선
  const famName = f.family.split(",")[0].replace(/['"]/g, "").trim();
  const faceCss = !f.webfont ? "" : Object.entries(f.webfont).map(([w, u]) => `@font-face{font-family:"${famName}";src:url("${u}") format("woff2");font-weight:${w};font-display:swap}`).join("");
  const allOk = LICENSE_CATS.every((c) => f.matrix[c.key] === "ok");
  const title = `${f.name} 다운로드 — 상업용 무료 ${f.category} 폰트, 사용 범위 표 | LETSUM`;
  const desc = `${f.name}(${f.en}) 무료 폰트 다운로드와 라이선스 사용 범위(인쇄·웹·영상·임베딩·BI/CI·포장지). ${f.desc}`;
  const ld = { "@context": "https://schema.org", "@type": "WebPage", name: title, description: desc, url: `${SITE}/font/${f.id}.html`,
    mainEntity: { "@type": "CreativeWork", name: f.name, alternateName: f.en, author: { "@type": "Organization", name: f.designer }, copyrightHolder: { "@type": "Organization", name: f.holder },
      license: (LICENSE_INFO[f.license] || {}).url || dl.page, isAccessibleForFree: true, inLanguage: "ko", keywords: [f.category, ...f.tags, ...f.mood].join(", ") } };
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/font/${f.id}.html">
<meta property="og:title" content="${esc(f.name)} — 상업용 무료 폰트 | LETSUM"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}/font/${f.id}.html">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script>try{var t=localStorage.getItem("ls_theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<link rel="stylesheet" href="../css/style.css?v=11">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${gf ? `family=${gfam}:wght@${f.weights.join(";")}&` : ""}family=Hahmlet:wght@700;800&display=swap" rel="stylesheet">${faceCss ? `\n<style>${faceCss}</style>` : ""}
</head>
<body>
<header><div class="wrap hd">
  <a class="logo" href="../index.html">렛섬 <small>LETSUM</small></a>
  <nav class="main"><a href="../index.html">홈</a><a href="../guide.html">라이선스 가이드</a><a href="../subset.html">서브셋 도구</a></nav>
  <div class="sp"></div>
</div></header>
<main class="wrap fp">
  <p class="k">${esc(f.category)} · ${esc(f.designer)} · ${f.weightsUnknown ? "굵기 배포처 확인" : `굵기 ${f.weights.length}종`} · ${esc(f.glyphs)}</p>
  <h1>${esc(f.name)} <span style="font-family:var(--mono);font-size:16px;font-weight:500;color:var(--ink3)">${esc(f.en)}</span></h1>
  <p class="sub">${esc(f.desc)}</p>
  ${f.intro ? `${f.specimen ? `<div class="intro-pv big"><img src="../${esc(f.specimen)}" alt="${esc(f.name)} 견본"><span class="i-cap">원본 폰트 견본 이미지</span></div>` : ""}<div class="intro-why"><b>소개 전용 폰트</b> — ${esc(f.introReason || "")} 아래 원 배포처에서 받을 수 있습니다.</div>` : `<div class="sample" style="font-family:${esc(f.family)}"><span class="l">미리보기</span>책을 읽는 시간은 언제나 옳다<br>다람쥐 헌 쳇바퀴에 타고파<br><span style="font-size:28px">한글 Hangul 2026 · ₩4,500</span></div>`}
  <div class="dlrow">
    ${dl.zip ? `<a class="btn" href="${esc(dl.zip)}" target="_blank" rel="noopener">⬇ 원 배포처에서 받기 <small>${esc(dl.srcName)} · 자동 다운로드 시작 · TTF/OTF 설치용</small></a>` : ""}
    <a class="btn${dl.zip ? " ghost" : ""}" href="${esc(dl.page)}" target="_blank" rel="noopener">${dl.zip ? "원 배포처 페이지 ↗" : `⬇ ${esc(dl.srcName)}에서 받기 ↗ <small>이용 범위 확인 후 다운로드</small>`}</a>
    <a class="btn ghost" href="../index.html#f=${f.id}">${f.intro ? "홈에서 보기 →" : "홈에서 테스트·비교 →"}</a>
  </div>
  <p class="note" style="margin-top:8px">파일은 LETSUM이 아니라 원 배포처에서 내려받습니다. ${f.intro ? "이용 조건은 배포처 원문을 따릅니다." : "ZIP 안에 라이선스 원문이 함께 들어 있습니다."}${dl.mirror ? ` 배포처 링크가 열리지 않으면 <a href="${esc(dl.mirror)}" class="linklike">LETSUM 보관본(원본 그대로)</a>을 받을 수 있습니다.` : ""} 설치·PPT 적용 방법은 홈의 상세 보기에 있습니다.</p>
  <h2>사용 범위 (라이선스 매트릭스)</h2>
  <p>${allOk ? "<b>상업용 무료</b> · " : ""}${esc((LICENSE_INFO[f.license] || { full: f.license }).full)} — ${esc((LICENSE_INFO[f.license] || { note: "원문 확인 필요" }).note)}${f.attribution ? ` · 출처 표시 예: ${esc(f.attribution)}` : ""} · 검수 ${f.status === "verified" ? "완료" : "확인 중"} (${f.verified})</p>
  <table class="matrix"><tr><th style="width:90px">카테고리</th><th>사용 범위</th><th style="width:92px">허용 여부</th></tr>
  ${LICENSE_CATS.map((c) => `<tr><td><b>${c.label}</b></td><td>${esc(c.desc)}</td><td>${st(f.matrix[c.key])}</td></tr>`).join("\n  ")}</table>
  <h2>사양</h2>
  <table class="spec">
    <tr><th>굵기</th><td>${f.weightsUnknown ? "배포처 확인" : f.weights.join(" · ")}</td></tr>
    <tr><th>출시·배포일</th><td>${f.released ? `${f.released.length === 4 ? f.released + "년" : f.released.length === 7 ? f.released.slice(0, 4) + "년 " + (+f.released.slice(5)) + "월" : f.released.replace(/-/g, ".")} <span class="note">— 출처: <a href="${esc(f.releasedUrl)}" target="_blank" rel="noopener">${esc(f.releasedSrc)}</a></span>` : "원 출시일 확인 중"}</td></tr>
    <tr><th>형식</th><td>${f.formats.join(", ")}</td></tr>
    <tr><th>한글 글자수</th><td>${esc(f.glyphs)}</td></tr>
    <tr><th>저작권자</th><td>${esc(f.holder)}</td></tr>
    <tr><th>태그</th><td>${[...f.tags, ...f.mood].map(esc).join(", ")}</td></tr>
  </table>
  ${f.intro ? "" : gf ? `<h2>웹폰트</h2>
  <pre class="code">&lt;link href="https://fonts.googleapis.com/css2?family=${gfam}:wght@${f.weights.join(";")}&amp;display=swap" rel="stylesheet"&gt;
font-family: ${esc(f.family)};</pre>` : `<h2>웹폰트</h2><p>웹사이트에 쓰려면 원 배포처에서 받은 파일을 직접 호스팅하세요(라이선스의 임베딩 허용 여부는 위 표를 따릅니다). 이 페이지의 미리보기 웹폰트는 LETSUM 미리보기 전용입니다.</p>`}
  <p class="disclaimer">※ 위 사용 범위는 참고용으로, 정확한 사용 범위는 이용 전 폰트 저작권자에게 확인하시기 바랍니다. 모든 폰트의 저작권은 각 저작권자에게 있으며, 다운로드는 원 배포처로 연결합니다.</p>
</main>
<footer><div class="wrap"><p class="fine">LETSUM(렛섬) — 상업용 무료 한글 폰트 · <a href="../index.html">전체 폰트 보기</a></p></div></footer>
</body>
</html>
`;
}

const out = path.join(ROOT, "font"); fs.mkdirSync(out, { recursive: true });
FONTS.forEach((f) => fs.writeFileSync(path.join(out, f.id + ".html"), page(f)));
const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE}/`, `${SITE}/guide.html`, `${SITE}/subset.html`, ...FONTS.map((f) => `${SITE}/font/${f.id}.html`)];
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin.html\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`font pages ${FONTS.length}, sitemap ${urls.length} urls`);
