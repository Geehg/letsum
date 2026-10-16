#!/usr/bin/env node
// 폰트별 정적 페이지 생성기 — "폰트명 다운로드" 검색 유입구.
// html/js/data.js를 읽어 html/font/<id>.html, html/sitemap.xml, html/robots.txt를 만든다. 빌드 시 1회, 서버·AI 없음.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..", "html");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8") + "\nthis.FONTS=FONTS;this.LICENSE_CATS=LICENSE_CATS;this.LICENSE_INFO=LICENSE_INFO;", ctx);
const { FONTS, LICENSE_CATS, LICENSE_INFO } = ctx;
// 추천 이유(사람이 견본을 보고 쓴 문장) — tools/state/reasons.json → html/data/reasons.json
// 설치 후 보이는 이름(폰트 파일 이름표) — tools/build_names.py → html/data/names.json
const NAMES = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "names.json"), "utf8")); } catch (e) { return {}; } })();
const WN = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };
const namesHTML = (f) => { const n = NAMES[f.id]; if (!n) return ""; return `<h2>설치 후 보이는 이름</h2>
  <p class="note">같은 폰트라도 프로그램마다 이름이 다르게 보입니다. 폰트 파일 속 이름표에서 읽은 값입니다.</p>
  <table class="spec"><tr><th>굵기</th><th>Windows 앱 글꼴 목록</th><th>Mac 서체 관리자·포토샵</th><th>포토샵 '글꼴 누락'(PostScript)</th></tr>
  ${Object.entries(n.w || {}).map(([w, v]) => `<tr><td>${WN[w] || w} (${w})</td><td>${esc(v.win)}</td><td>${esc(v.fam)} / ${esc(v.sty)}</td><td>${esc(v.ps)}</td></tr>`).join("\n  ")}</table>
  ${n.file ? `<p class="note">배포처 파일 이름: ${esc(n.file)}</p>` : ""}`; };
const REASONS = (() => { try { const j = JSON.parse(fs.readFileSync(path.join(__dirname, "state", "reasons.json"), "utf8")); delete j._; return j; } catch (e) { return {}; } })();
fs.writeFileSync(path.join(ROOT, "data", "reasons.json"), JSON.stringify(REASONS));
const SITE = "https://letsum.app";
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const st = (v) => (v === "ok" ? '<span class="st-ok">사용 가능</span>' : v === "no" ? '<span class="st-no">사용 금지</span>' : '<span class="st-cond">조건부</span>');

function page(f) {
  const gfam = f.en.replace(/ /g, "+");
  const gf = !f.webfont && !f.intro; // Google Fonts 폰트인지, LETSUM 미리보기 웹폰트(공공 안심글꼴)인지
  const dl = Object.assign(gf ? { zip: `https://fonts.google.com/download?family=${gfam}`, page: `https://fonts.google.com/specimen/${gfam}`, srcName: "Google Fonts" } : { zip: null, srcName: "공유마당" }, f.dl || {}); // 원 배포처 링크 우선
  const famName = f.family.split(",")[0].replace(/['"]/g, "").trim();
  const faceCss = !f.webfont ? "" : Object.entries(f.webfont).map(([w, u]) => `@font-face{font-family:"${famName}";src:url("${u}") format("${((v) => /\.otf$/.test(v) ? "opentype" : /\.ttf$/.test(v) ? "truetype" : /\.woff$/.test(v) ? "woff" : "woff2")(u.split("?")[0])}");font-weight:${w};font-display:swap}`).join("");
  const allOk = LICENSE_CATS.every((c) => f.matrix[c.key] === "ok");
  const commercial = (f.matrix || {}).print === "ok" || (f.matrix || {}).web === "ok"; // 상업 이용이 원문으로 확인된 폰트만 '상업용 무료'
  const title = `${f.name} 다운로드 — ${commercial ? "상업용 무료" : "무료 배포"} ${f.category} 폰트, 사용 범위 표 | LETSUM`;
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
<meta property="og:title" content="${esc(f.name)} — ${commercial ? "상업용 무료" : "무료 배포"} 폰트 | LETSUM"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}/font/${f.id}.html"><meta property="og:type" content="article"><meta property="og:image" content="${SITE}/img/${fs.existsSync(path.join(ROOT, "img/og", f.id + ".png")) ? "og/" + f.id : "og-main"}.png"><meta property="og:image:alt" content="${esc(f.name)} 글꼴 미리보기"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="LETSUM(렛섬)"><meta property="og:locale" content="ko_KR"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script>try{var t=localStorage.getItem("ls_theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png"><link rel="icon" type="image/svg+xml" href="../favicon.svg"><link rel="apple-touch-icon" href="../img/apple-touch-icon.png">
<link rel="stylesheet" href="../css/style.css?v=12">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${gf ? `family=${gfam}:wght@${f.weights.join(";")}&` : ""}family=Hahmlet:wght@700;800&display=swap" rel="stylesheet">${faceCss ? `\n<style>${faceCss}</style>` : ""}
</head>
<body>
<header>
  <div class="wrap hd">
    <a class="logo" href="../index.html"><img class="lg-l" src="../img/logo.png" alt="렛섬 LETSUM" width="116" height="32"><img class="lg-d" src="../img/logo-dark.png" alt="" aria-hidden="true" width="116" height="32"></a>
    <nav class="main"><a href="../index.html">홈</a><a href="../guide.html">라이선스 가이드</a><a href="../subset.html">웹폰트 코드</a><button class="nav-proj" id="projBtn" type="button" title="작업별 폴더로 폰트를 모아 두고, 라이선스가 바뀌면 알려 드려요">폰트 보관함</button></nav>
    <div class="sp"></div>
    <form class="hd-search" role="search" action="../index.html"><span aria-hidden="true">⌕</span><input id="qTop" name="q" type="search" placeholder="폰트명 · 포토샵·윈도우에 보이는 이름도 OK" aria-label="폰트 검색 — LETSUM 이름, 설치 후 이름, 포토샵 글꼴 누락 이름, 초성으로 찾기" aria-describedby="qHint" autocomplete="off">
      <span class="q-hint" id="qHint" role="note"><b>프로그램에 보이는 이름으로도 찾아요</b>포토샵 '글꼴 누락' 창 이름 <code>GSHYEJAROUNTTF-Bold</code> · 윈도우 목록 이름 <code>나눔스퀘어 Light</code> · 영문 <code>NanumSquare</code> · 초성 <code>ㄴㄴㅅ</code></span></form>
    <button class="icon-btn" id="themeBtn" type="button" aria-label="밝기 전환" title="밝기 전환">◐</button>
  </div>
</header>
<main class="wrap fp">
  <p class="k">${esc(f.category)} · ${esc(f.designer)} · ${f.weightsUnknown ? "굵기 배포처 확인" : `굵기 ${f.weights.length}종`} · ${esc(f.glyphs)}</p>
  <h1>${esc(f.name)} <span style="font-family:var(--mono);font-size:16px;font-weight:500;color:var(--ink3)">${esc(f.en)}</span></h1>
  <p class="sub">${esc(f.desc)}</p>
  ${REASONS[f.id] ? `<div class="why-box"><b>추천 이유</b><p>${esc(REASONS[f.id].why)}</p><p class="note">잘 맞는 곳: ${REASONS[f.id].good.map(esc).join(" · ")}${REASONS[f.id].caution ? `<br>주의: ${esc(REASONS[f.id].caution)}` : ""}</p></div>` : ""}
  ${f.intro ? `${f.specimen ? `<div class="intro-pv big"><img src="../${esc(f.specimen)}" alt="${esc(f.name)} 견본"><span class="i-cap">원본 폰트 견본 이미지</span></div>` : ""}<div class="intro-why"><b>소개 전용 폰트</b> — ${esc(f.introReason || "")} 아래 원 배포처에서 받을 수 있습니다.</div>` : `<div class="sample" style="font-family:${esc(f.family)}"><span class="l">미리보기</span>책을 읽는 시간은 언제나 옳다<br>다람쥐 헌 쳇바퀴에 타고파<br><span style="font-size:28px">한글 Hangul 2026 · ₩4,500</span></div>`}
  <div class="dlrow">
    ${dl.zip ? `<a class="btn" href="${esc(dl.zip)}" target="_blank" rel="noopener">⬇ 원 배포처에서 받기 <small>${esc(dl.srcName)} · 자동 다운로드 시작 · TTF/OTF 설치용</small></a>` : ""}
    <a class="btn${dl.zip ? " ghost" : ""}" href="${esc(dl.page)}" target="_blank" rel="noopener">${dl.zip ? "원 배포처 페이지 ↗" : `⬇ ${esc(dl.srcName)}에서 받기 ↗ <small>이용 범위 확인 후 다운로드</small>`}</a>
    <a class="btn ghost" href="../index.html#f=${f.id}">${f.intro ? "홈에서 보기 →" : "홈에서 테스트·비교 →"}</a>
  </div>
  <p class="note" style="margin-top:8px">파일은 LETSUM이 아니라 원 배포처에서 내려받습니다. ${f.intro ? "이용 조건은 배포처 원문을 따릅니다." : "ZIP 안에 라이선스 원문이 함께 들어 있습니다."}${dl.mirror ? ` 배포처 링크가 열리지 않으면 <a href="${esc(dl.mirror)}" class="linklike">LETSUM 보관본(원본 그대로)</a>을 받을 수 있습니다.` : ""} 설치·PPT 적용 방법은 홈의 상세 보기에 있습니다.</p>
  <h2>사용 범위 (라이선스 매트릭스)</h2>
  <p>${allOk ? "<b>상업용 무료</b> · " : ""}${esc((LICENSE_INFO[f.license] || { full: f.license }).full)} — ${esc((LICENSE_INFO[f.license] || { note: "원문 확인 필요" }).note)}${f.attribution ? ` · 출처 표시 예: ${esc(f.attribution)}` : ""} · 검토 상태 ${f.status === "verified" ? "원문 대조 완료" : "확인 중"} (최근 확인일 ${f.verified})</p>
  <table class="matrix"><tr><th style="width:90px">카테고리</th><th>사용 범위</th><th style="width:92px">허용 여부</th></tr>
  ${LICENSE_CATS.map((c) => `<tr><td><b>${c.label}</b></td><td>${esc(c.desc)}</td><td>${st(f.matrix[c.key])}</td></tr>`).join("\n  ")}</table>
  ${namesHTML(f)}
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
font-family: ${esc(f.family)};</pre>` : `<h2>웹사이트·앱에 쓸 때</h2><p>${f.matrix.embed === "ok" ? "원 배포처에서 받은 파일을 직접 호스팅하세요(라이선스상 웹 임베딩 허용)." : f.matrix.embed === "no" ? "<b>이 폰트는 웹폰트·앱 임베딩이 허용되지 않습니다.</b> 이미지·인쇄물·영상 등 위 표에서 허용된 방식으로만 쓰세요." : "<b>웹폰트·앱 임베딩은 조건부입니다.</b> " + esc((LICENSE_INFO[f.license] || {}).note || "") + " — 직접 호스팅하기 전에 라이선스 원문을 확인하세요."} 이 페이지의 미리보기 웹폰트는 LETSUM 미리보기 전용입니다.</p>`}
  <p class="disclaimer">※ 위 사용 범위는 참고용으로, 정확한 사용 범위는 이용 전 폰트 저작권자에게 확인하시기 바랍니다. 모든 폰트의 저작권은 각 저작권자에게 있으며, 다운로드는 원 배포처로 연결합니다.</p>
</main>
<footer><div class="wrap"><p class="fine">LETSUM(렛섬) — 상업용 무료 한글 폰트 · <a href="../index.html">전체 폰트 보기</a> · <a href="../notice.html">저작권·라이선스 고지</a></p></div></footer>
<script src="../js/common.js?v=1" data-base="../"></script>
</body>
</html>
`;
}

const out = path.join(ROOT, "font"); fs.mkdirSync(out, { recursive: true });
FONTS.forEach((f) => fs.writeFileSync(path.join(out, f.id + ".html"), page(f)));
const today = new Date().toISOString().slice(0, 10);
const urls = [`${SITE}/`, `${SITE}/guide.html`, `${SITE}/subset.html`, `${SITE}/notice.html`, ...FONTS.map((f) => `${SITE}/font/${f.id}.html`)];
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
// robots.txt: 검색엔진·링크 미리보기는 허용, AI 학습용 수집기·대량 수집 봇은 금지(내용은 여기서만 고칠 것 — 이 파일이 매번 다시 씀)
fs.writeFileSync(path.join(ROOT, "robots.txt"), `# LETSUM(렛섬) — 검색엔진(구글·네이버·다음·빙)과 링크 미리보기(카카오톡 등)는 허용합니다.
# AI 학습용 데이터 수집과 대량 수집 봇은 허용하지 않습니다.

User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: cohere-training-data-crawler
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: ImagesiftBot
Disallow: /

User-agent: Omgilibot
Disallow: /

User-agent: Timpibot
Disallow: /

User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: PetalBot
Disallow: /

User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`);
console.log(`font pages ${FONTS.length}, sitemap ${urls.length} urls`);
