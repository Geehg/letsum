#!/usr/bin/env node
// 폰트별 정적 페이지 생성기 — "폰트명 다운로드" 검색 유입구.
// html/js/data.js를 읽어 html/font/<id>.html, html/sitemap.xml, html/robots.txt를 만든다. 빌드 시 1회, 서버·AI 없음.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "html");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8") + "\nthis.FONTS=FONTS;this.LICENSE_CATS=LICENSE_CATS;", ctx);
const { FONTS, LICENSE_CATS } = ctx;
const SITE = "https://letsum.app";
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const st = (v) => (v === "ok" ? '<span class="st-ok">사용 가능</span>' : v === "no" ? '<span class="st-no">사용 금지</span>' : '<span class="st-cond">조건부</span>');

function page(f) {
  const gfam = f.en.replace(/ /g, "+");
  const dl = Object.assign({ zip: `https://fonts.google.com/download?family=${gfam}`, page: `https://fonts.google.com/specimen/${gfam}` }, f.dl || {});
  const allOk = LICENSE_CATS.every((c) => f.matrix[c.key] === "ok");
  const title = `${f.name} 다운로드 — 상업용 무료 ${f.category} 폰트, 사용 범위 표 | LETSUM`;
  const desc = `${f.name}(${f.en}) 무료 폰트 다운로드와 라이선스 사용 범위(인쇄·웹·영상·임베딩·BI/CI·포장지). ${f.desc}`;
  const ld = { "@context": "https://schema.org", "@type": "WebPage", name: title, description: desc, url: `${SITE}/font/${f.id}.html`,
    mainEntity: { "@type": "CreativeWork", name: f.name, alternateName: f.en, author: { "@type": "Organization", name: f.designer }, copyrightHolder: { "@type": "Organization", name: f.holder },
      license: f.license === "OFL" ? "https://openfontlicense.org/open-font-license-official-text/" : dl.page, isAccessibleForFree: true, inLanguage: "ko", keywords: [f.category, ...f.tags, ...f.mood].join(", ") } };
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
<link rel="stylesheet" href="../css/style.css?v=2">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${gfam}:wght@${f.weights.join(";")}&family=Hahmlet:wght@700;800&display=swap" rel="stylesheet">
</head>
<body>
<header><div class="wrap hd">
  <a class="logo" href="../index.html">렛섬 <small>LETSUM</small></a>
  <nav class="main"><a href="../index.html">작업대</a><a href="../guide.html">라이선스 가이드</a><a href="../subset.html">서브셋 도구</a><a href="../submit.html">폰트 등록</a></nav>
  <div class="sp"></div>
</div></header>
<main class="wrap fp">
  <p class="k">${esc(f.category)} · ${esc(f.designer)} · 굵기 ${f.weights.length}종 · ${esc(f.glyphs)}</p>
  <h1>${esc(f.name)} <span style="font-family:var(--mono);font-size:16px;font-weight:500;color:var(--ink3)">${esc(f.en)}</span></h1>
  <p class="sub">${esc(f.desc)}</p>
  <div class="sample" style="font-family:${esc(f.family)}"><span class="l">미리보기</span>책을 읽는 시간은 언제나 옳다<br>다람쥐 헌 쳇바퀴에 타고파<br><span style="font-size:28px">한글 Hangul 2026 · ₩4,500</span></div>
  <div class="dlrow">
    <a class="btn" href="${esc(dl.zip)}" rel="noopener">⬇ ZIP 바로 받기 <small>원 배포처 파일 · TTF/OTF 설치용</small></a>
    <a class="btn ghost" href="${esc(dl.page)}" target="_blank" rel="noopener">원 배포처 페이지 ↗</a>
    <a class="btn ghost" href="../index.html#f=${f.id}">작업대에서 테스트·비교 →</a>
  </div>
  <p class="note" style="margin-top:8px">파일은 원 배포처에서 바로 내려받습니다. ZIP 안에 라이선스 원문이 함께 들어 있습니다. 설치·PPT 적용 방법은 작업대의 상세 보기에 있습니다.</p>
  <h2>사용 범위 (라이선스 매트릭스)</h2>
  <p>${allOk ? "<b>상업용 무료</b> · " : ""}${esc(f.license)}${f.license === "OFL" ? " (SIL Open Font License 1.1) — 상업 이용·수정·재배포 가능, 폰트 파일 단독 판매 금지" : ""} · 검수 ${f.status === "verified" ? "완료" : "확인 중"} (${f.verified})</p>
  <table class="matrix"><tr><th style="width:90px">카테고리</th><th>사용 범위</th><th style="width:92px">허용 여부</th></tr>
  ${LICENSE_CATS.map((c) => `<tr><td><b>${c.label}</b></td><td>${esc(c.desc)}</td><td>${st(f.matrix[c.key])}</td></tr>`).join("\n  ")}</table>
  <h2>사양</h2>
  <table class="spec">
    <tr><th>굵기</th><td>${f.weights.join(" · ")}</td></tr>
    <tr><th>형식</th><td>${f.formats.join(", ")}</td></tr>
    <tr><th>한글 글자수</th><td>${esc(f.glyphs)}</td></tr>
    <tr><th>저작권자</th><td>${esc(f.holder)}</td></tr>
    <tr><th>태그</th><td>${[...f.tags, ...f.mood].map(esc).join(", ")}</td></tr>
  </table>
  <h2>웹폰트</h2>
  <pre class="code">&lt;link href="https://fonts.googleapis.com/css2?family=${gfam}:wght@${f.weights.join(";")}&amp;display=swap" rel="stylesheet"&gt;
font-family: ${esc(f.family)};</pre>
  <p class="disclaimer">※ 위 사용 범위는 참고용으로, 정확한 사용 범위는 이용 전 폰트 저작권자에게 확인하시기 바랍니다. 모든 폰트의 저작권은 각 저작권자에게 있으며, LETSUM은 폰트 파일을 자체 호스팅하지 않습니다.</p>
</main>
<footer><div class="wrap"><p class="fine">LETSUM(렛섬) — 한글 폰트 작업대 · <a href="../index.html">전체 폰트 보기</a></p></div></footer>
</body>
</html>
`;
}

const out = path.join(ROOT, "font"); fs.mkdirSync(out, { recursive: true });
FONTS.forEach((f) => fs.writeFileSync(path.join(out, f.id + ".html"), page(f)));
const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE}/`, `${SITE}/guide.html`, `${SITE}/subset.html`, `${SITE}/submit.html`, ...FONTS.map((f) => `${SITE}/font/${f.id}.html`)];
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin.html\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`font pages ${FONTS.length}, sitemap ${urls.length} urls`);
