// LETSUM — 상업용 무료 한글 폰트 (홈)
// 구조: 전역 컨트롤(문장·크기·굵기·반전·영문 짝꿍) → 필터 → 목록/격자/맥락 보기 → 비교 트레이 → 상세 모달
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const LS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  // ---------- 폰트 로딩: data.js의 굵기 정보로 Google Fonts 링크 생성 ----------
  // 스타일시트가 도착하기 전에 document.fonts.load를 부르면 폰트가 없는 것으로 판정되므로, 링크 로드를 기다린다
  // 웹폰트 두 종류: Google Fonts(한 번에 CSS 링크) / LETSUM 미리보기 웹폰트(f.webfont — 화면에 보일 때만 @font-face 선언)
  const isGF = (f) => !f.webfont && !f.intro;
  // 소개 전용(intro): 라이선스상 미리보기 웹폰트를 만들 수 없는 폰트 — 견본 이미지(specimen)가 있으면 그것만, 없으면 안내 상자
  const introBox = (f, cls) => f.specimen
    ? `<div class="intro-pv${cls ? " " + cls : ""}"><img src="${f.specimen}" alt="${esc(f.name)} 견본" loading="lazy"><span class="i-cap">원본 폰트 견본 이미지 · 입력 문장 미적용</span></div>`
    : `<div class="intro-pv none${cls ? " " + cls : ""}"><b>${esc(f.name)}</b><span class="i-cap">미리보기 미제공 · 배포처에서 생김새 확인</span></div>`;
  // 출시일 표기: 확인된 정밀도까지만 (2009 → 2009년, 2016-10 → 2016년 10월, 2014-07-15 → 2014.07.15)
  const fmtRel = (d) => !d ? "" : d.length === 4 ? d + "년" : d.length === 7 ? `${d.slice(0, 4)}년 ${+d.slice(5)}월` : d.replace(/-/g, ".");
  // ---------- LETSUM 미리보기 웹폰트 로더 ----------
  // 큰 한글 폰트(평균 0.5MB, 최대 4MB)를 한꺼번에 받지 않도록 동시 4개씩 순서대로 받는다.
  // 상세·히어로처럼 지금 보는 곳은 맨 앞으로(priority). 받는 중엔 data-fl="wait"(흐리게), 실패하면 한 번 다시 시도.
  const declared = new Set(); const faceState = {}; const faceWait = [];
  let faceActive = 0; const FACE_MAX = 4;
  const fmtOf = (u) => { u = u.split("?")[0]; return /\.otf$/.test(u) ? "opentype" : /\.ttf$/.test(u) ? "truetype" : /\.woff$/.test(u) ? "woff" : "woff2"; };
  function markFace(id, st) {
    faceState[id] = st;
    document.querySelectorAll(`[data-id="${id}"]`).forEach((el) => { if (st === "ok") el.removeAttribute("data-fl"); else el.setAttribute("data-fl", st); });
  }
  async function loadFace(f, retry) {
    const fam = f.family.split(",")[0].replace(/['"]/g, "").trim();
    const faces = Object.entries(f.webfont).map(([w, url]) => new FontFace(fam, `url("${url}${retry ? (url.includes("?") ? "&" : "?") + "r=1" : ""}") format("${fmtOf(url)}")`, { weight: String(w), display: "swap" }));
    faces.forEach((x) => document.fonts.add(x));
    const t = setTimeout(() => { if (faceState[f.id] === "wait") markFace(f.id, "slow"); }, 8000);
    try { await Promise.all(faces.map((x) => x.load())); clearTimeout(t); markFace(f.id, "ok"); }
    catch (e) {
      clearTimeout(t); faces.forEach((x) => document.fonts.delete(x));
      if (!retry) { await new Promise((r) => setTimeout(r, 1500)); return loadFace(f, true); }
      markFace(f.id, "fail");
    }
  }
  function pumpFaces() {
    while (faceActive < FACE_MAX && faceWait.length) {
      const f = faceWait.shift(); faceActive++;
      loadFace(f).finally(() => { faceActive--; pumpFaces(); });
    }
  }
  function ensureFace(f, priority) {
    if (!f || !f.webfont) return;
    if (priority && faceState[f.id] === "fail") declared.delete(f.id); // 상세를 열면 실패한 폰트를 다시 시도
    if (declared.has(f.id)) { // 대기 중인데 지금 필요해지면 앞으로
      const k = faceWait.indexOf(f); if (priority && k > 0) { faceWait.splice(k, 1); faceWait.unshift(f); }
      return;
    }
    declared.add(f.id); markFace(f.id, "wait");
    priority ? faceWait.unshift(f) : faceWait.push(f); pumpFaces();
  }
  const faceObs = "IntersectionObserver" in window ? new IntersectionObserver((ents) => ents.forEach((e) => {
    if (!e.isIntersecting) return;
    ensureFace(FONTS.find((x) => x.id === e.target.dataset.id)); faceObs.unobserve(e.target);
  }), { rootMargin: "300px 0px" }) : null;
  function observeFaces(root) {
    (root || document).querySelectorAll("[data-id]").forEach((el) => {
      const f = FONTS.find((x) => x.id === el.dataset.id); if (!f || !f.webfont) return;
      if (faceState[f.id] && faceState[f.id] !== "ok") el.setAttribute("data-fl", faceState[f.id]);
      if (declared.has(f.id)) return;
      faceObs ? faceObs.observe(el) : ensureFace(f);
    });
  }
  // KS X 1001 완성형 2,350자 집합 — 2,350자 폰트의 누락 글자를 폰트를 받지 않고도 판정
  const KSX = (() => {
    const s = new Set();
    try {
      const dec = new TextDecoder("euc-kr"); const buf = [];
      for (let a = 0xb0; a <= 0xc8; a++) for (let b = 0xa1; b <= 0xfe; b++) buf.push(a, b);
      for (const ch of dec.decode(new Uint8Array(buf))) if (ch >= "가" && ch <= "힣") s.add(ch);
    } catch (e) {}
    return s;
  })();

  const fontsCssReady = new Promise((resolve) => {
    const fam = FONTS.filter(isGF).map((f) => "family=" + f.en.replace(/ /g, "+") + ":wght@" + f.weights.join(";")).join("&");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?" + fam + "&display=swap";
    link.onload = link.onerror = () => resolve();
    setTimeout(resolve, 8000);
    document.head.appendChild(link);
  });

  // ---------- 상태 ----------
  const state = {
    liveOnly: false, body: (() => { try { return localStorage.getItem("ls_body") || ""; } catch (e) { return ""; } })(), bodySize: 11.5, bodyLh: 185, bodyLs: 0,
    q: "", cat: "전체", mood: new Set(), lic: new Set(), cov: new Set(), favOnly: false, coverOnly: false,
    only: null, onlyLabel: "", coll: null,
    sort: "new", text: TEXT_PRESETS[0].t, size: 30, weight: 400, inv: false, pair: false,
    view: "grid", ctx: "thumb",
  };
  const favs = new Set(LS("fm_favs", []));
  const cmp = new Set();
  const detect = {}; // id → { old: bool, hanja: bool } 자동 검출 결과
  const coverage = {}; // id → 누락 글자 배열 (현재 문장 기준)

  // ---------- 글리프 지원 검출 (한글 특화) ----------
  // 원리: 대상 폰트로 그린 글자와, 한글이 없는 라틴 폰트(Inter)로 그린 글자를 비교.
  // 대상 폰트에 글자가 없으면 둘 다 같은 시스템 대체 폰트로 그려져 픽셀이 같다.
  const probe = (() => {
    const c = document.createElement("canvas"); c.width = 72; c.height = 72;
    const x = c.getContext("2d", { willReadFrequently: true });
    const cache = new Map();
    function draw(font, ch) {
      x.clearRect(0, 0, 72, 72); x.font = "44px " + font; x.textBaseline = "top"; x.fillStyle = "#000"; x.fillText(ch, 6, 6);
      return x.getImageData(0, 0, 72, 72).data;
    }
    function same(a, b) { for (let i = 3; i < a.length; i += 4) if (a[i] !== b[i]) return false; return true; }
    return function has(en, ch) {
      const k = en + "|" + ch;
      if (cache.has(k)) return cache.get(k);
      let r = true;
      try { r = !same(draw(`"${en}"`, ch), draw(`"Inter"`, ch)); } catch (e) {}
      cache.set(k, r); return r;
    };
  })();
  const isCJK = (ch) => /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-퟿㐀-䶿一-鿿豈-﫿]/.test(ch);

  async function detectAll() {
    await fontsCssReady;
    const gf = FONTS.filter(isGF);
    await Promise.all(gf.map((f) => document.fonts.load(`400 44px "${f.en}"`, "ᄒᆞᆫ漢가나다ㅣㅡ").catch(() => {})));
    await document.fonts.load('44px "Inter"', "ᄒᆞᆫ漢가").catch(() => {});
    gf.forEach((f) => { detect[f.id] = { old: probe(f.en, "ᆞ") && probe(f.en, "ᄒ"), hanja: probe(f.en, "漢") && probe(f.en, "國") }; });
    gf.forEach((f) => (metrics[f.id] = measure(f.en)));
    // LETSUM 웹폰트는 빌드 때 폰트 파일(cmap)에서 계산한 값을 그대로 쓴다 — 파일을 미리 받지 않음
    FONTS.filter((f) => f.webfont).forEach((f) => { const c = covData && covData[f.id]; detect[f.id] = c ? { old: c.old, hanja: c.hanja } : { old: !!f.old, hanja: !!f.hanja }; });
  }
  // LETSUM 웹폰트의 형태 측정은 상세를 열 때(파일을 받은 뒤) 한다
  async function measureLazy(f) {
    if (!f.webfont || metrics[f.id]) return;
    ensureFace(f);
    const fam = f.family.split(",")[0].replace(/['"]/g, "").trim();
    await document.fonts.load(`400 48px "${fam}"`, "가나다ㅣㅡ").catch(() => {});
    metrics[f.id] = measure(fam);
  }

  // ---------- 글자 형태 측정 (AI 없이, 브라우저 캔버스 측정만으로) — 상세 측정값 표시·비슷한 분위기 동점 정렬에 사용 ----------
  // 굵기 = '가나다' 잉크 밀도, 너비 = 글자폭/크기, 대비 = 가로획(ㅡ) 두께 / 세로획(ㅣ) 두께
  const metrics = {};
  const measure = (() => {
    const c = document.createElement("canvas"); c.width = 240; c.height = 90;
    const x = c.getContext("2d", { willReadFrequently: true });
    function ink(text) {
      x.clearRect(0, 0, 240, 90); x.font = `400 48px "${arguments[1]}"`; x.textBaseline = "top"; x.fillStyle = "#000"; x.fillText(text, 4, 8);
      const d = x.getImageData(0, 0, 240, 90).data; const rows = new Set(), cols = new Set(); let n = 0;
      for (let i = 3, p = 0; i < d.length; i += 4, p++) if (d[i] > 100) { n++; rows.add(Math.floor(p / 240)); cols.add(p % 240); }
      return { n, rows: rows.size, cols: cols.size, w: x.measureText(text).width };
    }
    return function (en) {
      try {
        const a = ink("가나다", en), v = ink("ㅣ", en), h = ink("ㅡ", en);
        return { density: a.n / (a.w * 48 || 1), width: a.w / 48 / 3, contrast: h.rows / (v.cols || 1) };
      } catch (e) { return null; }
    };
  })();
  // 비슷한 분위기: 사람이 정리한 분류·모양 태그·분위기·용도 태그가 겹치는 정도로 고름(모양 측정값은 동점일 때만 참고)
  const LOOK_TAGS = new Set(["레트로", "붓", "붓펜", "붓글씨", "캘리", "둥근", "가는", "굵은", "초강조", "좁은", "장식", "기하학", "손글씨", "펜글씨", "분필", "육필", "귀여운", "전통", "부드러운", "개성", "간판"]);
  function similar(f, k) {
    const tg = new Set(f.tags || []), md = new Set(f.mood || []), byHolder = {};
    const m = metrics[f.id];
    return FONTS.filter((x) => x.id !== f.id && !x.intro).map((x) => {
      const why = [];
      let sc = x.category === f.category ? 3 : 0;
      (x.tags || []).forEach((t) => { if (tg.has(t)) { sc += LOOK_TAGS.has(t) ? 2 : 1; why.push((LOOK_TAGS.has(t) ? 0 : 1) + "#" + t); } });
      (x.mood || []).forEach((t) => { if (md.has(t)) { sc += 1.5; why.push("2" + t); } });
      const n = metrics[x.id];
      const tie = m && n ? Math.hypot(n.density - m.density, (n.width - m.width) / 2) : 1;
      return { x, sc, tie, why: why.sort().map((w) => w.slice(1)) };
    }).filter((r) => r.why.length >= 2)
      .sort((p, q) => q.sc - p.sc || p.tie - q.tie || (q.x.pop || 0) - (p.x.pop || 0))
      .filter((r) => { const h = r.x.holder || r.x.designer; byHolder[h] = (byHolder[h] || 0) + 1; return byHolder[h] <= 1; })
      .slice(0, k);
  }
  let covTimer = null;
  function scheduleCoverage() { clearTimeout(covTimer); covTimer = setTimeout(runCoverage, 350); }
  // 글자 지원 판정 — 상태 4가지: ok(검사한 글자 모두 지원) · miss(누락 있음) · pending(확인 중) · na(확인 불가: 소개 전용)
  // 검사 범위: 한글 음절·자모, 한자, 옛한글(영문·숫자·기호·이모지는 검사하지 않음). 문장 속 서로 다른 글자 80자까지.
  // · LETSUM 미리보기 폰트: 빌드 때 폰트 파일에서 '실제로 그려진' 글자 목록(data/coverage.json)으로 판정
  // · Google Fonts: 폰트를 받은 뒤 브라우저 캔버스로 글자마다 대조
  const covState = {}; let covData = null; let covChars = [];
  const covLoad = fetch("data/coverage.json?v=1").then((r) => (r.ok ? r.json() : {})).then((j) => (covData = j || {})).catch(() => (covData = {}));
  const covHas = (rec, ch) => { const i = ch.charCodeAt(0) - 0xAC00; return !rec.h || ((covBits[rec.h] || (covBits[rec.h] = Uint8Array.from(atob(rec.h), (c) => c.charCodeAt(0))))[i >> 3] >> (i & 7)) & 1; };
  const covBits = {};
  // 실제 글자 데이터가 오면 옛한글·한자 표시와 '완성형 11,172자' 필터를 그 기준으로 다시 그린다
  covLoad.then(() => { Object.entries(covData).forEach(([id, c]) => { if (detect[id] || FONTS.some((x) => x.id === id)) detect[id] = { old: c.old, hanja: c.hanja }; }); render(); });
  async function runCoverage() {
    const chars = covChars = [...new Set([...state.text])].filter(isCJK).slice(0, 80);
    const scope = "검사 범위: 한글·한자·옛한글(영문·숫자·기호 제외)";
    if (!chars.length) { FONTS.forEach((f) => { coverage[f.id] = []; covState[f.id] = f.intro ? "na" : "ok"; }); $("#coverNote").textContent = "· 문장에 검사할 한글·한자가 없습니다"; render(); return; }
    FONTS.forEach((f) => { covState[f.id] = f.intro ? "na" : "pending"; coverage[f.id] = []; });
    $("#coverNote").textContent = `· 확인 중… (${scope})`; render();
    await covLoad;
    FONTS.filter((f) => f.webfont).forEach((f) => {
      const rec = covData[f.id]; if (!rec) return; // 목록이 없으면 확인 중으로 둔다
      coverage[f.id] = chars.filter((ch) => {
        if (ch >= "가" && ch <= "힣") return !covHas(rec, ch);
        if (/[一-鿿㐀-䶿豈-﫿]/.test(ch)) return !rec.hanja;
        if (/[ㄱ-ㅣ]/.test(ch)) return rec.jamo === false; // 낱자 ㄱ~ㅣ
        if (/[ᄀ-ᇿꥠ-꥿ힰ-퟿ㅤ-㆏]/.test(ch)) return !rec.old;
        return false;
      });
      covState[f.id] = coverage[f.id].length ? "miss" : "ok";
    });
    await fontsCssReady;
    const txt = chars.join(""); const gf = FONTS.filter(isGF);
    await Promise.all(gf.map((f) => document.fonts.load(`400 44px "${f.en}"`, txt).catch(() => {})));
    gf.forEach((f) => {
      if (!document.fonts.check(`400 44px "${f.en}"`, "가")) return; // 폰트를 못 받았으면 판정 보류
      coverage[f.id] = chars.filter((ch) => !probe(f.en, ch)); covState[f.id] = coverage[f.id].length ? "miss" : "ok";
    });
    const n = (st) => FONTS.filter((f) => covState[f.id] === st).length;
    $("#coverNote").textContent = `· 누락 ${n("miss")}종${n("pending") ? ` · 확인 중 ${n("pending")}종` : ""}${n("na") ? ` · 확인 불가 ${n("na")}종` : ""} (${scope})`;
    render();
  }

  // ---------- 초성 검색 ----------
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const choseong = (s) => [...s].map((ch) => { const c = ch.charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 ? CHO[Math.floor((c - 0xac00) / 588)] : ch; }).join("");
  const isChoQuery = (q) => q.length > 0 && [...q].every((ch) => CHO.includes(ch) || ch === " ");

  // ---------- 컨트롤 구성 ----------
  $("#presetSel").innerHTML = `<option value="">프리셋</option>` + TEXT_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("");
  $("#presetSel").addEventListener("change", (e) => {
    const p = TEXT_PRESETS.find((x) => x.id === e.target.value); if (!p) return;
    setText(p.t); e.target.value = "";
  });
  $("#previewText").addEventListener("input", (e) => setText(e.target.value, true));
  let evTyped = false;
  function setText(t, fromInput) {
    state.text = t; if (!fromInput) $("#previewText").value = t;
    if (fromInput && !evTyped && t.trim().length >= 2) { evTyped = true; ev("text_custom"); } // 직접 문장을 입력한 방문 수(내용은 보내지 않음)
    renderPreviews(); scheduleCoverage();
  }
  $("#sizeRange").addEventListener("input", (e) => { state.size = +e.target.value; $("#sizeV").textContent = state.size + "px"; renderPreviews(); });
  $$("#weightSeg button").forEach((b) => b.addEventListener("click", () => { state.weight = +b.dataset.w; $$("#weightSeg button").forEach((x) => x.classList.toggle("on", x === b)); renderPreviews(); }));
  $("#invBtn").addEventListener("click", (e) => { state.inv = !state.inv; e.currentTarget.classList.toggle("on", state.inv); e.currentTarget.setAttribute("aria-pressed", state.inv); renderPreviews(); });
  $("#pairBtn").addEventListener("click", (e) => {
    state.pair = !state.pair; e.currentTarget.classList.toggle("on", state.pair); e.currentTarget.setAttribute("aria-pressed", state.pair);
    if (state.pair && !/[A-Za-z0-9]/.test(state.text)) setText(TEXT_PRESETS.find((p) => p.id === "mixed").t);
    else renderPreviews();
  });
  $$("#viewSeg button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.v)));
  function setView(v) {
    if (v !== state.view) ev("view", v);
    state.view = v; $$("#viewSeg button").forEach((x) => x.classList.toggle("on", x.dataset.v === v));
    $("#ctxChips").style.display = v === "ctx" ? "flex" : "none";
    $("#viewHint").textContent = { list: "많은 후보를 빠르게 훑기", grid: "같은 문장으로 여러 폰트 비교", ctx: "쓰임새에 적용해 보기", feed: "적용 예시를 넘겨 보며 발견" }[v] || "";
    syncBodyPanel();
    document.body.classList.toggle("feed-mode", v === "feed"); state.feedN = 24; render();
  }
  // 보기 방식 안내: 첫 방문에만 결과 위에 펼치고, 하나를 고르거나 닫으면 다시 띄우지 않음(? 버튼으로 다시 보기)
  const tourSeen = () => { try { return localStorage.getItem("ls_vtour") === "1"; } catch (e) { return true; } };
  const tourDone = () => { try { localStorage.setItem("ls_vtour", "1"); } catch (e) {} };
  function showTour(on) {
    $("#vtour").hidden = !on;
    $$("#vtour [data-tour]").forEach((b) => b.classList.toggle("on", b.dataset.tour === state.view));
  }
  $$("#vtour [data-tour]").forEach((b) => b.addEventListener("click", () => {
    tourDone(); showTour(false); setView(b.dataset.tour);
    $("#viewSeg").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }));
  $("#vtourX").addEventListener("click", () => { tourDone(); showTour(false); });
  $("#viewHelp").addEventListener("click", () => { const on = $("#vtour").hidden; showTour(on); if (on) $("#vtour").scrollIntoView({ block: "nearest", behavior: "smooth" }); });
  if (!tourSeen()) showTour(true);
  const CTX = [["thumb", "유튜브 썸네일"], ["book", "책 본문"], ["sub", "영상 자막"], ["menu", "카페 메뉴판"], ["card", "카드뉴스"], ["ui", "문서·UI"]];
  $("#ctxChips").innerHTML = CTX.map(([k, l]) => `<button class="tbtn${k === state.ctx ? " on" : ""}" data-ctx="${k}">${l}</button>`).join("");
  $$("[data-ctx]").forEach((b) => b.addEventListener("click", () => { state.ctx = b.dataset.ctx; $$("[data-ctx]").forEach((x) => x.classList.toggle("on", x === b)); syncBodyPanel(); render(); }));
  // 책 본문 맥락: 내 원고를 붙여 넣어 긴 글로 비교(이 브라우저에만 저장, 서버로 보내지 않음)
  function syncBodyPanel() { $("#bodyPanel").hidden = !(state.view === "ctx" && state.ctx === "book"); }
  $("#bodyText").value = state.body;
  let bodyT = null;
  $("#bodyText").addEventListener("input", (e) => { state.body = e.target.value; clearTimeout(bodyT); bodyT = setTimeout(() => { try { localStorage.setItem("ls_body", state.body); } catch (x) {} render(); }, 250); });
  [["bodySize", "px"], ["bodyLh", "%"], ["bodyLs", ""]].forEach(([k, u]) => $("#" + k).addEventListener("input", (e) => { state[k] = +e.target.value; $("#" + k + "V").textContent = e.target.value + u; render(); }));
  $("#bodyReset").addEventListener("click", () => { state.body = ""; $("#bodyText").value = ""; try { localStorage.removeItem("ls_body"); } catch (x) {} render(); });
  // 휴대폰: '조절'로 크기·굵기·반전 펼치기 / 1060px 이하: '필터' 시트
  $("#deckMore")?.addEventListener("click", (e) => { const on = $(".deck").classList.toggle("more"); e.currentTarget.setAttribute("aria-expanded", on); e.currentTarget.textContent = on ? "조절 ▴" : "조절 ▾"; });
  const sideOpen = (on) => { document.body.classList.toggle("side-open", on); $("#filterBtn")?.setAttribute("aria-expanded", on); $("#sideBackdrop").hidden = !on; };
  $("#filterBtn")?.addEventListener("click", () => sideOpen(true));
  $("#sideClose")?.addEventListener("click", () => sideOpen(false));
  $("#sideBackdrop")?.addEventListener("click", () => sideOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("side-open")) sideOpen(false); });
  // 상황별 시작·용도 추천을 누르면 시트를 닫고 결과로
  document.addEventListener("click", (e) => { if (document.body.classList.contains("side-open") && e.target.closest("#side [data-coll], #side .wiz-cta")) sideOpen(false); });
  $("#liveOnly").addEventListener("change", (e) => { state.liveOnly = e.target.checked; render(); });
  // 정렬: 용도 추천을 적용하면 '추천 순'이 생기고, 다른 정렬을 고르면 그 정렬이 그대로 적용된다
  function setSort(v) {
    const sel = $("#sort"); let opt = sel.querySelector('option[value="rec"]');
    if (v === "rec" && !opt) { opt = document.createElement("option"); opt.value = "rec"; opt.textContent = "추천 순"; sel.prepend(opt); }
    if (v !== "rec" && opt && !state.rank) opt.remove();
    state.sort = v; sel.value = v;
  }
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("#qTop").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", cur); try { localStorage.setItem("ls_theme", cur); } catch (e) {}
  });

  // ---------- 필터 구성 ----------
  const cats = ["전체", ...new Set(FONTS.map((f) => f.category))];
  $("#catGrp").innerHTML = cats.map((c) => `<button class="fbtn${c === "전체" ? " on" : ""}" data-cat="${c}">${c}<span class="n">${c === "전체" ? FONTS.length : FONTS.filter((f) => f.category === c).length}</span></button>`).join("");
  $$("[data-cat]").forEach((b) => b.addEventListener("click", () => { state.cat = b.dataset.cat; $$("[data-cat]").forEach((x) => x.classList.toggle("on", x === b)); render(); }));
  $("#moodGrp").innerHTML = MOODS.map((m) => `<button class="fbtn" data-mood="${m}">${m}</button>`).join("");
  $$("[data-mood]").forEach((b) => b.addEventListener("click", () => { toggleSet(state.mood, b.dataset.mood); b.classList.toggle("on"); render(); }));
  $("#moodClear").addEventListener("click", () => { state.mood.clear(); $$("[data-mood]").forEach((x) => x.classList.remove("on")); render(); });
  const LIC_FILTERS = [{ key: "commercial", label: "상업용 OK", keys: ["print", "web", "video", "bici", "package"] }, ...LICENSE_CATS.filter((c) => c.key !== "ofl").map((c) => ({ key: c.key, label: c.label, keys: [c.key] }))];
  $("#licGrp").innerHTML = LIC_FILTERS.map((p) => `<button class="fbtn ok" data-lic="${p.key}">${p.label}</button>`).join("");
  $$("[data-lic]").forEach((b) => b.addEventListener("click", () => {
    const p = LIC_FILTERS.find((x) => x.key === b.dataset.lic);
    const on = p.keys.every((k) => state.lic.has(k));
    p.keys.forEach((k) => (on ? state.lic.delete(k) : state.lic.add(k)));
    syncLic(); render();
  }));
  function syncLic() { $$("[data-lic]").forEach((b) => { const p = LIC_FILTERS.find((x) => x.key === b.dataset.lic); b.classList.toggle("on", p.keys.every((k) => state.lic.has(k))); }); }
  $("#licClear").addEventListener("click", () => { state.lic.clear(); syncLic(); render(); });
  $$("[data-cov]").forEach((b) => b.addEventListener("click", () => { toggleSet(state.cov, b.dataset.cov); b.classList.toggle("on"); render(); }));
  $("#coverOnly").addEventListener("change", (e) => { state.coverOnly = e.target.checked; if (e.target.checked) ev("cover_only"); render(); });
  $("#favOnly").addEventListener("change", (e) => { state.favOnly = e.target.checked; render(); });
  function toggleSet(set, k) { set.has(k) ? set.delete(k) : set.add(k); }

  // 상황별 큐레이션: 분류 + 맥락 + 문장을 한 번에
  $("#collList").innerHTML = COLLECTIONS.map((c) => `<button data-coll="${c.id}"><b>${c.title}</b><span>${c.desc}</span></button>`).join("");
  $$("[data-coll]").forEach((b) => b.addEventListener("click", () => {
    const c = COLLECTIONS.find((x) => x.id === b.dataset.coll);
    if (state.coll === c.id) { state.coll = null; state.cat = "전체"; setView("list"); }
    else {
      state.coll = c.id; state.cat = c.cat; state.ctx = c.ctx; setText(c.text);
      $$("[data-ctx]").forEach((x) => x.classList.toggle("on", x.dataset.ctx === c.ctx));
      setView("ctx");
    }
    $$("[data-cat]").forEach((x) => x.classList.toggle("on", x.dataset.cat === state.cat));
    $$("[data-coll]").forEach((x) => x.classList.toggle("on", x.dataset.coll === state.coll));
    window.scrollTo({ top: $(".deck").offsetTop - 56, behavior: "smooth" });
  }));
  // 유료 폰트 대안
  $("#altList").innerHTML = ALTERNATIVES.map((a, i) => `<button data-alt="${i}">${a.for}</button>`).join("");
  $$("[data-alt]").forEach((b) => b.addEventListener("click", () => {
    const a = ALTERNATIVES[+b.dataset.alt];
    if (state.onlyLabel === a.for) { state.only = null; state.onlyLabel = ""; }
    else { state.only = new Set(a.ids); state.onlyLabel = a.for; }
    state.rank = null; state.recNote = ""; state.useLic = null; if (state.sort === "rec") setSort("new");
    $$("[data-alt]").forEach((x) => x.classList.toggle("on", x.textContent === state.onlyLabel)); render();
  }));

  // ---------- 필터링 ----------
  function matrixOk(f, keys) { return keys.every((k) => f.matrix[k] === "ok"); }
  function filtered() {
    const q = state.q.toLowerCase();
    let list = FONTS.filter((f) => {
      if (state.only && !state.only.has(f.id)) return false;
      if (state.cat !== "전체" && f.category !== state.cat) return false;
      if (state.mood.size && ![...state.mood].some((m) => f.mood.includes(m))) return false;
      if (state.lic.size && !matrixOk(f, [...state.lic])) return false;
      if (state.cov.has("11172") && ((covData && covData[f.id]) ? covData[f.id].n : f.cov) < 11172) return false;
      if (state.cov.has("old") && !(detect[f.id] && detect[f.id].old)) return false;
      if (state.cov.has("hanja") && !(detect[f.id] && detect[f.id].hanja)) return false;
      if (state.cov.has("multi") && f.weights.length < 3) return false;
      if (state.favOnly && !favs.has(f.id)) return false;
      if (state.coverOnly && covState[f.id] !== "ok") return false;
      if (state.liveOnly && f.intro) return false; // 확인 중·확인 불가는 '지원'으로 치지 않는다
      if (q) {
        if (isChoQuery(q)) { if (!choseong(f.name).includes(q.replace(/ /g, ""))) return false; }
        else { const hay = (f.name + " " + f.en + " " + f.designer + " " + f.tags.join(" ") + " " + f.mood.join(" ")).toLowerCase(); if (!hay.includes(q)) return false; }
      }
      return true;
    });
    const s = state.sort;
    if (s === "rec" && state.rank && state.only) return list.sort((a, b) => state.rank.get(a.id) - state.rank.get(b.id)); // 용도 추천 순
    const introLast = (cmp) => (a, b) => (a.intro ? 1 : 0) - (b.intro ? 1 : 0) || cmp(a, b); // 미리보기가 되는 폰트 먼저
    if (s === "pop") list.sort(introLast((a, b) => b.pop - a.pop));
    if (s === "new") list.sort(introLast((a, b) => b.added.localeCompare(a.added) || (b.released || "0").localeCompare(a.released || "0") || b.pop - a.pop));
    if (s === "released") list.sort((a, b) => (b.released || "0").localeCompare(a.released || "0") || b.pop - a.pop);
    if (s === "name") list.sort(introLast((a, b) => a.name.localeCompare(b.name, "ko")));
    if (s === "weights") list.sort(introLast((a, b) => b.weights.length - a.weights.length || b.pop - a.pop));
    return list;
  }

  // ---------- 렌더 조각 ----------
  const LIC_SHORT = { print: "인쇄", web: "웹", video: "영상", embed: "임베딩", bici: "BI·CI", package: "포장" };
  // 사용 범위 배지: 지금 고른 용도(용도 추천·상황별 시작·사용 범위 필터)에 관련된 칸만 강조하고 나머지는 한 줄로 요약
  const COLL_LIC = { thumb: ["video", "web"], book: ["print"], subtitle: ["video"], menu: ["print", "package"], card: ["web"], doc: ["print"] };
  const focusKeys = () => { const k = new Set(state.useLic || []); (COLL_LIC[state.coll] || []).forEach((x) => k.add(x)); state.lic.forEach((x) => { if (LIC_SHORT[x]) k.add(x); }); return [...k]; };
  // 사용 범위 아이콘(Lucide check · triangle-alert · x, ISC) — 굵은 선으로 통일, 배지·히어로·상세 표에 공통 사용
  const LIC_IC = {
    ok: '<svg class="lic-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    cond: '<svg class="lic-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    no: '<svg class="lic-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };
  const LIC_WORD = { ok: "가능", cond: "조건부", no: "불가" };
  const licIc = (v) => LIC_IC[v] || LIC_IC.cond;
  const pillOf = (f, k, key) => `<span class="pill ${f.matrix[k]}${key ? " key" : ""}" title="${LIC_SHORT[k]} ${LIC_WORD[f.matrix[k]] || ""}">${LIC_SHORT[k]}${licIc(f.matrix[k])}</span>`;
  const pills = (f) => {
    const keys = focusKeys(); const all = Object.keys(LIC_SHORT);
    let h;
    if (!keys.length) h = all.map((k) => pillOf(f, k)).join("");
    else {
      const rest = all.filter((k) => !keys.includes(k)); const no = rest.filter((k) => f.matrix[k] === "no").length, cond = rest.filter((k) => f.matrix[k] === "cond").length;
      h = keys.map((k) => pillOf(f, k, true)).join("") + (rest.length ? `<span class="pill rest" title="${rest.map((k) => LIC_SHORT[k] + " " + ({ ok: "가능", no: "불가", cond: "조건부" }[f.matrix[k]])).join(" · ")}">그 외 ${no || cond ? [cond ? `조건부 ${cond}` : "", no ? `불가 ${no}` : ""].filter(Boolean).join("·") : "모두 가능"}</span>` : "");
    }
    return h + (f.status === "verified" ? "" : `<span class="pill chk">확인 중</span>`) + (f.intro ? `<span class="pill intro" title="${esc(f.introReason || "")}">소개 전용</span>` : "");
  };
  const famOf = (f) => state.pair ? `${LATIN_PAIRS.find((p) => p.id === f.pair).family}, ${f.family}` : f.family;
  const wOf = (f) => { const w = state.weight; if (f.weights.includes(w)) return w; return f.weights.reduce((p, c) => Math.abs(c - w) < Math.abs(p - w) ? c : p); };
  function pvText(f) {
    const t = state.text || f.name; const miss = coverage[f.id] || [];
    if (!miss.length) return esc(t);
    return [...t].map((ch) => miss.includes(ch) ? `<span class="miss" title="이 폰트에 없는 글자(참고)">${esc(ch)}</span>` : esc(ch)).join("");
  }
  const covTags = (f) => {
    const d = detect[f.id];
    if (!f.cov) return `<span class="cov"><span class="dim">글자수 배포처 확인</span></span>`;
    return `<span class="cov"><span class="${f.cov >= 11172 ? "y" : ""}">${f.cov >= 11172 ? "11,172" : f.cov.toLocaleString()}자</span>`
      + (d ? `<span class="${d.old ? "y" : "dim"}">옛한글</span><span class="${d.hanja ? "y" : "dim"}">漢</span>` : "") + `</span>`;
  };
  const missPill = (f) => covState[f.id] === "miss" ? `<span class="pill miss" title="이 폰트에 없는 글자: ${esc(coverage[f.id].join(" "))}">누락 ${coverage[f.id].length}자</span>`
    : covState[f.id] === "pending" ? `<span class="pill chk">글자 확인 중</span>` : covState[f.id] === "na" && covChars.length ? `<span class="pill">글자 지원 미확인</span>` : "";
  const acts = (f) => `<div class="r-acts">
      <button class="abtn fav${favs.has(f.id) ? " on" : ""}" data-fav="${f.id}" aria-label="즐겨찾기">${favs.has(f.id) ? "♥" : "♡"}</button>
      ${f.intro ? "" : `<button class="abtn${cmp.has(f.id) ? " on" : ""}" data-cmp="${f.id}">${cmp.has(f.id) ? "비교 중" : "+ 비교"}</button>`}
      <button class="abtn" data-open="${f.id}">상세</button></div>`;
  const pvStyle = (f) => `font-family:${famOf(f)};font-size:${state.size}px;font-weight:${wOf(f)}`;

  function rowHTML(f) {
    return `<article class="row" data-id="${f.id}" tabindex="0">
      <div class="r-meta">
        <div class="r-name">${esc(f.name)}<span class="en">${esc(f.en)}</span></div>
        <div class="r-by">${esc(f.designer)}</div>
        <div class="r-spec">${f.weightsUnknown ? "굵기 배포처 확인" : `굵기 ${f.weights.length}종`} · ${f.formats.join("/")}</div>
        ${covTags(f)}
      </div>
      <div class="r-pvwrap">
        ${f.intro ? introBox(f) : `<div class="r-pv${state.inv ? " inv" : ""}" style="${pvStyle(f)}">${pvText(f)}</div>
        <div class="r-weights" style="font-family:${f.family}">${f.weights.map((w) => `<i style="font-weight:${w}">가<small>${w}</small></i>`).join("")}</div>`}
      </div>
      <div class="r-side"><div class="pills">${pills(f)}${missPill(f)}</div>${acts(f)}</div>
    </article>`;
  }
  function cardHTML(f) {
    return `<article class="card" data-id="${f.id}" tabindex="0">
      ${f.intro ? introBox(f) : `<div class="r-pv${state.inv ? " inv" : ""}" style="font-family:${famOf(f)};font-weight:${wOf(f)};font-size:${Math.min(state.size, 40)}px">${pvText(f)}</div>`}
      <div class="r-name">${esc(f.name)}<span class="en">${esc(f.designer)}</span></div>
      <div class="pills">${pills(f)}${missPill(f)}</div>
      <div class="foot">${covTags(f)}${acts(f)}</div>
    </article>`;
  }
  const BODY = "한글 본문 테스트입니다. 이 문장은 실제 책 본문처럼 여러 줄에 걸쳐 조판되는 모습을 확인하기 위한 장문 샘플입니다. 자간과 행간, 글줄 길이가 읽기에 알맞은지 살펴보세요. 명조체는 긴 글에, 고딕체는 제목과 화면에 자주 쓰입니다. 다람쥐 헌 쳇바퀴에 타고파.";
  function mockHTML(f, ctx) {
    const fam = famOf(f), w = wOf(f), t = esc(state.text || f.name);
    const fs = `font-family:${fam}`;
    switch (ctx) {
      case "thumb": return `<div class="mock thumb" style="${fs}"><div class="ch"><i></i>LETSUM 채널</div><div class="t" style="font-weight:${Math.max(w, f.weights[f.weights.length - 1])}">${t.replace(/(\S+)$/, "<em>$1</em>")}</div><span class="dur">12:34</span></div>`;
      case "book": return `<div class="mock book" style="${fs}"><div class="h" style="font-weight:${f.weights.includes(700) ? 700 : Math.max(w, f.weights[f.weights.length - 1])}">${t}</div><div class="p" style="font-weight:${w};font-size:${state.bodySize}px;line-height:${state.bodyLh}%;letter-spacing:${state.bodyLs / 100}em">${state.body.trim() ? esc(state.body).replace(/\n/g, "<br>") : `${BODY} ${BODY} ${BODY} ${BODY}`}</div><div class="pg">— 27 —</div></div>`;
      case "sub": return `<div class="mock sub"><div class="bar" style="${fs};font-weight:${w}">${t}</div></div>`;
      case "menu": return `<div class="mock menu" style="${fs}"><div class="mt" style="font-weight:${w}">${t}</div>${[["아메리카노", "4,500"], ["카페라떼", "5,000"], ["바닐라 크림 콜드브루", "5,800"], ["제주 말차 라떼", "6,200"]].map(([n, p]) => `<div class="mi" style="font-weight:${w}"><span>${n}</span><b>${p}</b></div>`).join("")}</div>`;
      case "card": return `<div class="mock card" style="${fs}"><div class="cn">01 / 05</div><div class="ct" style="font-weight:${Math.max(w, 700) in f.weights ? 700 : w}">${t}</div><div class="cp" style="font-weight:${w}">${BODY.slice(0, 92)}…</div></div>`;
      case "ui": return `<div class="mock ui" style="${fs};font-weight:${w}"><div class="tabs"><b>일반</b><span>알림</span><span>보안</span></div><div class="win"><div class="ut">${t}</div><div class="ub">변경 사항은 다음 로그인부터 적용됩니다. 계정 설정에서 언제든지 되돌릴 수 있습니다.</div><div class="ubtn">확인</div></div></div>`;
    }
    return "";
  }
  function ctxHTML(f) {
    return `<article class="ctxcard" data-id="${f.id}" tabindex="0">
      ${f.intro ? introBox(f, "ctx") : mockHTML(f, state.ctx)}
      <div class="lab"><div class="r-name">${esc(f.name)}<span class="en">${esc(f.designer)}</span></div>${acts(f)}</div>
      <div class="pills">${pills(f)}${missPill(f)}</div>
    </article>`;
  }

  // ---------- 이용 지표: 어떤 기능을 하루에 몇 번 썼는지 '합계'만 보낸다 ----------
  // IP·방문자 식별값·검색어·입력 문장은 보내지 않는다. 브라우저 '추적 안 함'·GPC가 켜져 있으면 보내지 않는다.
  const evQ = []; let evT = null;
  const noTrack = navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  function flushEv() {
    if (!evQ.length) return; const body = JSON.stringify(evQ.splice(0, 20));
    try { if (!navigator.sendBeacon || !navigator.sendBeacon("/api/e", new Blob([body], { type: "application/json" }))) fetch("/api/e", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {}); } catch (e) {}
  }
  function ev(e, v) {
    if (noTrack || !/^https:\/\/letsum\.app$/.test(location.origin)) return;
    evQ.push(v ? { e, v: String(v) } : { e }); clearTimeout(evT); evT = setTimeout(flushEv, 3000);
    if (evQ.length >= 20) flushEv();
  }
  addEventListener("pagehide", flushEv); document.addEventListener("visibilitychange", () => { if (document.hidden) flushEv(); });
  try { if (!sessionStorage.getItem("ls_v")) { sessionStorage.setItem("ls_v", "1"); ev("visit"); } } catch (e) {}
  // 다운로드·배포처 링크: data-dl="zip|page" data-fid="<id>"
  document.addEventListener("click", (e) => { const a = e.target.closest("a[data-dl]"); if (a) ev(a.dataset.dl === "zip" ? "dl_zip" : "dl_page", a.dataset.fid); }, true);

  // ---------- 좋아요 수·댓글 (Cloudflare Worker /api — 서버가 없거나 실패하면 조용히 숨김) ----------
  const social = {}; let apiOk = true;
  async function api(path, opt) {
    if (!apiOk) return null;
    try {
      const r = await fetch("/api/" + path, opt && { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(opt) });
      if (!(r.headers.get("content-type") || "").includes("json")) { apiOk = false; return null; }
      const j = await r.json(); return r.ok ? j : { error: j.error || "오류" };
    } catch (e) { return null; }
  }
  async function loadStats(ids) {
    ids = ids.filter((id) => !social[id]); if (!ids.length) return;
    for (let i = 0; i < ids.length; i += 60) {
      const j = await api("stats?ids=" + ids.slice(i, i + 60).join(","));
      if (!j || j.error) return;
      Object.assign(social, j);
    }
    paintSocial();
  }
  function paintShots() {
    $$(".ig[data-id]").forEach((card) => {
      const s = social[card.dataset.id]; if (!s || !s.shots || !s.shots.length || card.dataset.shots) return;
      card.dataset.shots = "1";
      const tr = card.querySelector(".ig-track"); const first = tr.firstElementChild;
      const html = s.shots.map((x) => `<div class="ig-s ig-shot"><img src="/api/shot/${x.id}" alt="사용 사례" loading="lazy"><span class="ig-cap2">사용 사례 · ${esc(x.name)}</span></div>`).join("");
      first.insertAdjacentHTML("afterend", html);
      const n = tr.children.length; const m = card.querySelector(".ig-media");
      let dots = m.querySelector(".ig-dots");
      if (!dots) { m.insertAdjacentHTML("beforeend", '<button class="ig-nav prev" aria-label="이전 이미지">‹</button><button class="ig-nav next" aria-label="다음 이미지">›</button><div class="ig-dots"></div>'); dots = m.querySelector(".ig-dots"); bindCarousel(m); }
      dots.innerHTML = Array.from({ length: n }, (_, k) => `<i class="${k ? "" : "on"}"></i>`).join("");
    });
  }
  function paintSocial() {
    paintShots();
    $$("[data-likes]").forEach((el) => { const s = social[el.dataset.likes]; el.textContent = s && s.likes ? s.likes.toLocaleString() : ""; });
    $$("[data-cmts]").forEach((el) => { const s = social[el.dataset.cmts]; el.textContent = s && s.comments ? s.comments.toLocaleString() : ""; });
    $$("[data-likeline]").forEach((el) => { const s = social[el.dataset.likeline]; el.textContent = s && s.likes ? `좋아요 ${s.likes.toLocaleString()}개` : ""; });
    $$("[data-cmtline]").forEach((el) => { const s = social[el.dataset.cmtline]; el.textContent = s && s.comments ? (s.comments > 2 ? `댓글 ${s.comments.toLocaleString()}개 모두 보기` : "댓글 보기") : ""; });
    $$("[data-recent]").forEach((el) => { const s = social[el.dataset.recent]; el.innerHTML = s && s.recent ? s.recent.map((c) => `<p><b>${esc(c.name)}</b> ${esc(c.body)}</p>`).join("") : ""; });
  }
  // 좋아요 = 즐겨찾기(이 브라우저) + 서버 좋아요 수
  async function toggleLike(id) {
    const on = !favs.has(id); toggleSet(favs, id); save("fm_favs", [...favs]);
    try { const fs = LS("ls_favsnap", {}); const f = FONTS.find((x) => x.id === id); if (on && f) fs[id] = snap(f); else delete fs[id]; save("ls_favsnap", fs); } catch (e) {}
    const s = social[id] || (social[id] = { likes: 0, comments: 0, liked: false });
    s.likes = Math.max(0, s.likes + (on ? 1 : -1)); s.liked = on;
    if (on) ev("like", id);
    const j = await api("like", { id, on });
    if (j && !j.error) s.likes = j.likes;
    return on;
  }
  const IC = {
    heart: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    cmt: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5l1.6-4.4A8.4 8.4 0 1 1 20.5 11.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6 3.5h12v17l-6-4.6-6 4.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  };

  // ---------- 피드 보기 (인스타그램식 카드) ----------
  // 한 폰트 = 한 게시물. 가운데 이미지는 넘겨 보는 슬라이드: ① 문장 샘플 ② 디자인 적용안 ③ 설명 카드 ④ 굵기 가족
  // 좋아요는 즐겨찾기(이 브라우저에만 저장), 저장은 비교 담기. 서버가 없어 좋아요 수·댓글은 표시하지 않는다(가짜 숫자 금지).
  const FEED_BG = [["var(--lime)", "var(--lime-ink)"], ["var(--ink)", "var(--paper)"], ["#e9e4d8", "#1b1b1b"], ["#dfe7f3", "#14213d"], ["#f3e1dc", "#3a1a12"]];
  const FEED_CTX = { "디스플레이": "thumb", "명조": "book", "손글씨": "card", "고딕": "ui" };
  // 피드 카드 슬라이드 — 정사각 영역의 폭(cqw)에 맞춰 글자 크기를 정하므로 카드 크기가 달라도 비율이 같다
  const FEED_POSTER = {
    "디스플레이": (f, t, fam) => `<div class="ig-s fp fp-thumb" style="font-family:${fam}"><div class="fp-ch"><i></i>LETSUM 채널 · 조회수 12만회</div><div class="fp-t" style="font-weight:${f.weights[f.weights.length - 1]}">${esc(t).replace(/(\S+)$/, "<em>$1</em>")}</div><span class="fp-dur">12:34</span><span class="ig-cap2">유튜브 썸네일 적용안</span></div>`,
    "명조": (f, t, fam) => `<div class="ig-s fp fp-book" style="font-family:${fam}"><div class="fp-k">제1장</div><div class="fp-t" style="font-weight:${f.weights.includes(700) ? 700 : f.weights[f.weights.length - 1]}">${esc(t)}</div><p style="font-weight:${f.weights.includes(400) ? 400 : f.weights[0]}">${state.body.trim() ? esc(state.body) : BODY}</p><div class="fp-pg">— 27 —</div><span class="ig-cap2">책 본문 적용안</span></div>`,
    "손글씨": (f, t, fam) => `<div class="ig-s fp fp-note" style="font-family:${fam}"><div class="fp-k">To. 오늘의 나에게</div><div class="fp-t">${esc(t)}</div><div class="fp-sign">— 렛섬 드림</div><span class="ig-cap2">손편지·카드 적용안</span></div>`,
    "고딕": (f, t, fam) => `<div class="ig-s fp fp-ui" style="font-family:${fam}"><div class="fp-win"><div class="fp-bar"><b>알림</b><span>방금</span></div><div class="fp-t" style="font-weight:${f.weights.includes(700) ? 700 : f.weights[f.weights.length - 1]}">${esc(t)}</div><p style="font-weight:${f.weights.includes(400) ? 400 : f.weights[0]}">변경 사항은 다음 로그인부터 적용됩니다. 계정 설정에서 언제든지 되돌릴 수 있습니다.</p><div class="fp-btn">확인</div></div><span class="ig-cap2">앱 화면 적용안</span></div>`,
  };
  // 글자 효과 적용안(CSS만으로 그림) — 분류로 효과 4가지를, 분위기로 그라데이션 색을 고른다
  const FX_LABEL = { outline: "외곽선", extrude: "3D 입체", retro: "레트로 오프셋", glitch: "글리치", grad: "그라데이션", shadow: "드롭섀도", neon: "네온 사인", press: "레터프레스", chalk: "칠판", thin: "가는 외곽선" };
  const FX_BY_CAT = { "디스플레이": ["outline", "extrude", "retro", "glitch"], "고딕": ["shadow", "grad", "neon", "outline"], "명조": ["press", "grad", "shadow", "thin"], "손글씨": ["neon", "chalk", "grad", "shadow"] };
  const GRAD_BY_MOOD = { "강렬한": "metal", "세련된": "metal", "귀여운": "candy", "발랄한": "candy", "따뜻한": "sunset", "고전적": "gold", "차분한": "ocean", "단정한": "ocean" };
  function fxTiles(f, t, n) {
    let fx = (FX_BY_CAT[f.category] || FX_BY_CAT["고딕"]).slice();
    if (f.category === "디스플레이" && !(f.mood || []).includes("강렬한")) fx[3] = "grad";
    const grad = GRAD_BY_MOOD[(f.mood || []).find((m) => GRAD_BY_MOOD[m])] || (f.category === "명조" ? "gold" : "ocean");
    const w = f.weights[f.weights.length - 1];
    const word = [...(t.split(/\s+/).find(Boolean) || f.name)].slice(0, n).join("");
    return fx.map((k) => `<div class="fx fx-${k}${k === "grad" ? " g-" + grad : ""}"><span style="font-family:${famOf(f)};font-weight:${w}" data-t="${esc(word)}">${esc(word)}</span><i>${FX_LABEL[k]}</i></div>`).join("");
  }
  function fxSlide(f, t) {
    return `<div class="ig-s ig-fx">${fxTiles(f, t, 5)}<span class="ig-cap2">효과 적용안</span></div>`;
  }
  function feedSlides(f, i) {
    const [bg, fg] = FEED_BG[i % FEED_BG.length];
    const t = state.text || f.name;
    const sz = t.length <= 8 ? 13 : t.length <= 16 ? 10.5 : t.length <= 28 ? 8 : 6;
    const meta = [f.weightsUnknown ? "" : `굵기 ${f.weights.length}종`, f.cov ? `한글 ${f.cov >= 11172 ? "11,172" : f.cov.toLocaleString()}자` : "", f.released ? `${fmtRel(f.released)} 출시` : ""].filter(Boolean).join(" · ");
    const info = `<div class="ig-s ig-info"><div class="ii-k">${esc(f.category)} · ${esc(licInfo(f).short)}</div>
      <div class="ii-n" style="${f.intro ? "" : `font-family:${f.family};font-weight:${f.weights[f.weights.length - 1]}`}">${esc(f.name)}</div>
      <p>${esc(f.desc)}</p><div class="ii-m">${esc(meta)}</div></div>`;
    if (f.intro) return [`<div class="ig-s ig-intro">${introBox(f, "big")}</div>`, info];
    const ws = f.weights.length > 6 ? f.weights.filter((_, k) => k % 2 === 0 || k === f.weights.length - 1) : f.weights;
    return [
      `<div class="ig-s ig-sample" style="background:${bg};color:${fg}"><div class="sm-t" style="font-family:${famOf(f)};font-weight:${wOf(f)};font-size:${sz}cqw">${esc(t)}</div><span class="ig-cap2">${esc(f.name)}</span></div>`,
      (FEED_POSTER[f.category] || FEED_POSTER["고딕"])(f, t, famOf(f)),
      fxSlide(f, t),
      info,
      `<div class="ig-s ig-weights" style="font-family:${f.family}">${ws.map((w) => `<div style="font-weight:${w}"><b>가나다 Aa 123</b><small>${w}</small></div>`).join("")}<span class="ig-cap2">굵기 ${f.weights.length}종${ws.length < f.weights.length ? " 중 일부" : ""}</span></div>`,
    ];
  }
  // 배포 주체 아이콘(빌드 때 받은 파비콘·로고) — 없으면 글자 아바타
  let avatars = {};
  fetch("data/avatars.json?v=1").then((r) => (r.ok ? r.json() : {})).then((j) => { avatars = j || {}; if (state.view === "feed") $$(".ig[data-id]").forEach((c) => { const a = avatars[c.dataset.id]; const el = c.querySelector(".ig-av"); if (a && el && !el.querySelector("img")) { el.innerHTML = `<img src="${a.icon}" alt="">`; el.classList.add("img"); const s = c.querySelector(".ig-who small"); if (s) s.textContent = a.label; } }); }).catch(() => {});
  const avHTML = (f) => { const a = avatars[f.id]; return a ? `<span class="ig-av img" aria-hidden="true"><img src="${a.icon}" alt=""></span>` : `<span class="ig-av" aria-hidden="true">${esc([...(f.holder || f.designer)][0] || "L")}</span>`; };
  const nick = () => { try { return localStorage.getItem("ls_nick") || ""; } catch (e) { return ""; } };
  function feedHTML(f, i) {
    const sl = feedSlides(f, i); const dl = dlFor(f); const av = avatars[f.id];
    return `<article class="ig" data-id="${f.id}" tabindex="0">
      <header class="ig-h">${avHTML(f)}
        <div class="ig-who"><b>${esc(f.name)}</b><small>${esc(av ? av.label : f.designer)}</small></div>
        <button class="ig-follow" data-open="${f.id}">상세</button></header>
      <div class="ig-media">
        <div class="ig-track">${sl.join("")}</div>
        ${sl.length > 1 ? `<button class="ig-nav prev" aria-label="이전 이미지">‹</button><button class="ig-nav next" aria-label="다음 이미지">›</button>
        <div class="ig-dots">${sl.map((_, k) => `<i class="${k ? "" : "on"}"></i>`).join("")}</div>` : ""}
      </div>
      <div class="ig-act">
        <button class="ig-ic${favs.has(f.id) ? " on" : ""}" data-like="${f.id}" aria-label="좋아요" title="좋아요 — 즐겨찾기에도 저장">${IC.heart}</button>
        <button class="ig-ic" data-cmt="${f.id}" aria-label="댓글" title="댓글 모두 보기">${IC.cmt}</button>
        <button class="ig-ic" data-share="${f.id}" aria-label="공유" title="링크 공유">${IC.share}</button>
        ${f.intro ? "" : `<button class="ig-ic${cmp.has(f.id) ? " on" : ""}" data-cmp="${f.id}" aria-label="비교에 저장" title="저장 — 비교에 담기">${IC.save}</button>`}
        <span class="ig-right">
          ${dl.ok ? `<a class="ig-pill dl" data-dl="zip" data-fid="${f.id}" href="${esc(dl.zip)}" target="_blank" rel="noopener" title="${esc(dl.srcName)}에서 파일 바로 받기">${IC.down}다운로드</a>` : ""}
          <button class="ig-pill" data-lic-open="${f.id}" title="${esc(licInfo(f).full)} — 사용 범위 보기">라이선스</button>
          <a class="ig-pill" data-dl="page" data-fid="${f.id}" href="${esc(dl.page)}" target="_blank" rel="noopener" title="원 배포처 페이지(${esc(dl.srcName)})">받기 ↗</a>
        </span>
      </div>
      <div class="ig-body">
        <p class="ig-likes" data-likeline="${f.id}"></p>
        <div class="ig-titlerow"><span class="ig-lics">${pills(f)}</span></div>
        <p class="ig-tags">${[f.category, ...f.tags, ...f.mood].slice(0, 6).map((x) => `#${esc(String(x).replace(/\s+/g, ""))}`).join(" ")}</p>
        <button class="ig-allc" data-cmt="${f.id}" data-cmtline="${f.id}"></button>
        <div class="ig-recent" data-recent="${f.id}"></div>
      </div>
      <form class="ig-cform" data-cform="${f.id}" autocomplete="off">
        <input name="body" maxlength="500" placeholder="댓글 달기…" aria-label="${esc(f.name)}에 댓글 달기">
        <input name="website" class="hp" tabindex="-1" aria-hidden="true">
        <button type="submit" disabled>게시</button>
      </form>
    </article>`;
  }
  let lastScroll = 0; addEventListener("scroll", () => { lastScroll = Date.now(); }, { passive: true });
  const canHover = matchMedia("(hover:hover)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  function bindCarousel(m) {
    if (m.dataset.bound) return; m.dataset.bound = "1";
    const tr = m.querySelector(".ig-track");
    // 마우스를 올리면 1.6초마다 다음 이미지로 — 마지막 뒤에 첫 장 복제를 붙여 계속 왼쪽으로 넘어가는 무한 반복(되감기 없음)
    const real = tr.children.length;
    const kOf = () => Math.round(tr.scrollLeft / tr.clientWidth);
    // 진행 중인 부드러운 넘김·스냅을 끊고 첫 장으로 순간 이동
    const jump0 = () => { tr.style.scrollSnapType = "none"; tr.scrollLeft = 0; requestAnimationFrame(() => { tr.scrollLeft = 0; tr.style.scrollSnapType = ""; }); };
    if (canHover && real > 1) {
      const cl = tr.children[0].cloneNode(true); cl.setAttribute("aria-hidden", "true"); cl.classList.add("ig-clone"); tr.appendChild(cl);
      let t = null, t0 = null; const card = m.closest(".ig") || m;
      const step = () => { let k = kOf(); if (k >= real) { tr.style.scrollSnapType = "none"; tr.scrollLeft = 0; tr.style.scrollSnapType = ""; k = 0; } tr.scrollTo({ left: (k + 1) * tr.clientWidth, behavior: "smooth" }); };
      // 복제 장(=첫 장과 같은 그림)에 도착하면 보이지 않게 진짜 첫 장으로 순간 이동
      let se = null; const snap = () => { if (kOf() >= real) jump0(); };
      tr.addEventListener("scroll", () => { clearTimeout(se); se = setTimeout(snap, 140); }, { passive: true });
      // 0.7초 이상 머물 때만 시작(스크롤하며 스치는 것은 무시)
      card.addEventListener("mouseenter", () => {
        clearInterval(t); clearTimeout(t0);
        t0 = setTimeout(() => { if (Date.now() - lastScroll < 300 || !card.matches(":hover")) return; step(); t = setInterval(step, 1600); }, 700);
      });
      // 떠나면 멈추고, 뒤로 감기는 움직임 없이 살짝 사라졌다 첫 장으로 나타남
      card.addEventListener("mouseleave", () => {
        clearInterval(t); clearTimeout(t0); t = t0 = null;
        if (tr.scrollLeft < 2) return;
        tr.classList.add("ig-fade");
        setTimeout(() => { jump0(); requestAnimationFrame(() => requestAnimationFrame(() => tr.classList.remove("ig-fade"))); }, 180);
      });
    }
    const go = (d) => tr.scrollBy({ left: d * tr.clientWidth, behavior: "smooth" });
    m.addEventListener("click", (e) => { const b = e.target.closest(".ig-nav"); if (b) go(b.classList.contains("prev") ? -1 : 1); });
    tr.addEventListener("scroll", () => { const k = kOf() % real; m.querySelectorAll(".ig-dots i").forEach((d, j) => d.classList.toggle("on", j === k)); }, { passive: true });
  }
  function bindFeed(host) {
    host.querySelectorAll(".ig-media").forEach(bindCarousel);
    host.querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", async () => {
      const f = FONTS.find((x) => x.id === b.dataset.share);
      const url = `${location.origin}/font/${f.id}.html`; ev("share", f.id);
      try { if (navigator.share) { await navigator.share({ title: `${f.name} — LETSUM`, text: f.desc, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(url); b.classList.add("done"); b.title = "링크 복사됨"; setTimeout(() => b.classList.remove("done"), 1500); } catch (e) { prompt("링크를 복사하세요", url); }
    }));
    host.querySelectorAll("[data-like]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.like; b.classList.toggle("on", !favs.has(id)); b.classList.add("pop");
      setTimeout(() => b.classList.remove("pop"), 300);
      const p = toggleLike(id); paintSocial(); await p; paintSocial();
    }));
    host.querySelectorAll("[data-cmt]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.cmt, "comments")));
    host.querySelectorAll("[data-lic-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.licOpen, "license")));
    host.querySelectorAll("[data-cform]").forEach((form) => {
      const inp = form.querySelector("input[name=body]"), btn = form.querySelector("button");
      inp.addEventListener("input", () => { btn.disabled = inp.value.trim().length < 2; });
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); const id = form.dataset.cform; const body = inp.value.trim(); if (body.length < 2) return;
        btn.disabled = true;
        const r = await api("comments", { id, name: nick(), body, website: form.querySelector(".hp").value });
        if (!r || r.error) { inp.value = ""; inp.placeholder = (r && r.error) || "잠시 후 다시 시도해 주세요"; setTimeout(() => (inp.placeholder = "댓글 달기…"), 3000); inp.value = body; btn.disabled = false; return; }
        inp.value = ""; ev("comment", id);
        const s = social[id] || (social[id] = { likes: 0, comments: 0, liked: false, shots: [], recent: [] });
        s.comments++; if (r.item) s.recent = [{ name: r.item.name, body: r.item.body.slice(0, 120) }, ...(s.recent || [])].slice(0, 2);
        paintSocial();
      });
    });
    loadStats([...host.querySelectorAll(".ig[data-id]")].map((el) => el.dataset.id));
    $("#feedMore")?.addEventListener("click", () => { state.feedN = (state.feedN || 24) + 24; render(); });
  }

  // ---------- 메인 렌더 ----------
  let renderSig = "", shownN = 60;
  function render() {
    const list = filtered();
    $("#count").innerHTML = `<b>${list.length}</b> / ${FONTS.length}종`;
    const host = $("#results");
    // 한 번에 다 그리지 않고 60개씩: 끝에 닿으면 이어서 그린다(DOM을 가볍게)
    const sig = state.view + "|" + list.length + "|" + (list[0] || {}).id;
    if (sig !== renderSig) { renderSig = sig; shownN = 60; }
    const part = list.slice(0, shownN);
    const more = list.length > shownN ? `<div class="more-sentinel" id="moreSentinel"><button class="btn ghost" id="moreBtn">더 보기 <small>${shownN} / ${list.length}종</small></button></div>` : "";
    if (!list.length) host.innerHTML = `<div class="empty">조건에 맞는 폰트가 없습니다. 필터를 줄여 보세요.</div>`;
    else if (state.view === "list") host.innerHTML = part.map(rowHTML).join("") + more;
    else if (state.view === "grid") host.innerHTML = `<div class="grid">${part.map(cardHTML).join("")}</div>` + more;
    else if (state.view === "feed") {
      const n = state.feedN || 24;
      host.innerHTML = `<div class="igrid">${list.slice(0, n).map(feedHTML).join("")}</div>`
        + (list.length > n ? `<div class="ig-more"><button class="btn ghost" id="feedMore">더 보기 <small>${n} / ${list.length}종</small></button></div>` : "");
    }
    else host.innerHTML = `<div class="ctxgrid">${part.map(ctxHTML).join("")}</div>` + more;
    renderActive(); bind(host); observeFaces(host);
    if (state.view === "feed") bindFeed(host);
    const sen = $("#moreSentinel");
    if (sen) {
      const grow = () => { const y = scrollY; shownN += 60; render(); scrollTo(0, y); };
      $("#moreBtn").addEventListener("click", grow);
      if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); grow(); } }, { rootMargin: "800px 0px" }); io.observe(sen); }
    }
  }
  function renderActive() {
    const chips = [];
    if (state.coll) chips.push(["coll", COLLECTIONS.find((c) => c.id === state.coll).title]);
    if (state.onlyLabel) chips.push(["only", state.onlyLabel.startsWith("용도:") ? state.onlyLabel : "대안: " + state.onlyLabel]);
    if (state.cat !== "전체") chips.push(["cat", state.cat]);
    state.mood.forEach((m) => chips.push(["mood:" + m, m]));
    LIC_FILTERS.forEach((p) => { if (p.keys.every((k) => state.lic.has(k)) && (p.key === "commercial" || !LIC_FILTERS[0].keys.every((k) => state.lic.has(k)) || !LIC_FILTERS[0].keys.includes(p.key))) chips.push(["lic:" + p.key, p.label]); });
    state.cov.forEach((c) => chips.push(["cov:" + c, { "11172": "완성형 11,172자", old: "옛한글", hanja: "한자", multi: "굵기 3종+" }[c]]));
    if (state.coverOnly) chips.push(["cover", "문장 글자 모두 지원"]);
    if (state.favOnly) chips.push(["fav", "즐겨찾기"]);
    const fn = $("#filterN"); if (fn) fn.textContent = chips.length ? chips.length : "";
    const bar = $("#activeBar");
    bar.innerHTML = chips.length ? `<span class="k">적용 중</span>` + chips.map(([k, l]) => `<button class="fbtn on" data-rm="${k}">${esc(l)} ×</button>`).join("") + `<button class="fbtn" data-rm="all">모두 지우기</button>` : "";
    if (state.recNote && state.only) bar.insertAdjacentHTML("beforeend", `<p class="rec-note">${esc(state.recNote)}${state.sort !== "rec" ? " (지금은 선택한 정렬 순서로 표시 중)" : ""}</p>`);
    bar.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => removeFilter(b.dataset.rm)));
  }
  function removeFilter(k) {
    const [t, v] = k.split(":");
    if (k === "all") { state.cat = "전체"; state.mood.clear(); state.lic.clear(); state.cov.clear(); state.coverOnly = false; state.favOnly = false; state.only = null; state.onlyLabel = ""; state.rank = null; state.recNote = ""; state.useLic = null; if (state.sort === "rec") setSort("new"); state.coll = null; $("#coverOnly").checked = false; $("#favOnly").checked = false; }
    else if (t === "coll") { state.coll = null; state.cat = "전체"; }
    else if (t === "only") { state.only = null; state.onlyLabel = ""; state.rank = null; state.recNote = ""; state.useLic = null; if (state.sort === "rec") setSort("new"); }
    else if (t === "cat") state.cat = "전체";
    else if (t === "mood") state.mood.delete(v);
    else if (t === "lic") LIC_FILTERS.find((p) => p.key === v).keys.forEach((x) => state.lic.delete(x));
    else if (t === "cov") state.cov.delete(v);
    else if (t === "cover") { state.coverOnly = false; $("#coverOnly").checked = false; }
    else if (t === "fav") { state.favOnly = false; $("#favOnly").checked = false; }
    $$("[data-cat]").forEach((x) => x.classList.toggle("on", x.dataset.cat === state.cat));
    $$("[data-mood]").forEach((x) => x.classList.toggle("on", state.mood.has(x.dataset.mood)));
    $$("[data-cov]").forEach((x) => x.classList.toggle("on", state.cov.has(x.dataset.cov)));
    $$("[data-coll]").forEach((x) => x.classList.toggle("on", x.dataset.coll === state.coll));
    $$("[data-alt]").forEach((x) => x.classList.toggle("on", x.textContent === state.onlyLabel));
    syncLic(); render();
  }
  // 문장·크기·굵기 변경은 전체 재렌더 없이 미리보기만 갱신
  function renderPreviews() {
    if (state.view === "ctx" || state.view === "feed") { render(); return; }
    $$("[data-id]").forEach((el) => {
      const f = FONTS.find((x) => x.id === el.dataset.id); if (!f) return;
      const pv = el.querySelector(".r-pv"); if (!pv) return;
      pv.innerHTML = pvText(f);
      pv.style.fontFamily = famOf(f); pv.style.fontWeight = wOf(f);
      pv.style.fontSize = (el.classList.contains("card") ? Math.min(state.size, 40) : state.size) + "px";
      pv.classList.toggle("inv", state.inv);
    });
  }
  function bind(host) {
    host.querySelectorAll("[data-id]").forEach((el) => {
      el.addEventListener("click", (e) => { if (e.target.closest("button, a")) return; openDetail(el.dataset.id); });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") openDetail(el.dataset.id); });
    });
    host.querySelectorAll("[data-fav]").forEach((b) => b.addEventListener("click", () => { toggleLike(b.dataset.fav); render(); })); // 즐겨찾기 = 좋아요
    host.querySelectorAll("[data-cmp]").forEach((b) => b.addEventListener("click", () => toggleCmp(b.dataset.cmp)));
    host.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.open)));
  }

  // ---------- 비교 트레이 ----------
  function toggleCmp(id) {
    if (cmp.has(id)) cmp.delete(id);
    else { if (cmp.size >= 4) { alert("비교는 최대 4종까지 담을 수 있습니다."); return; } cmp.add(id); ev("cmp_add", id); }
    renderTray(); render();
  }
  function renderTray() {
    $("#tray").classList.toggle("open", cmp.size > 0);
    $("#trayNames").innerHTML = [...cmp].map((id) => { const f = FONTS.find((x) => x.id === id); return `<button data-untray="${id}" title="빼기">${esc(f.name)} ×</button>`; }).join("");
    $$("[data-untray]").forEach((b) => b.addEventListener("click", () => toggleCmp(b.dataset.untray)));
    document.body.style.paddingBottom = cmp.size ? "70px" : "";
  }
  $("#trayClear").addEventListener("click", () => { cmp.clear(); renderTray(); render(); });
  $("#cmpOpen").addEventListener("click", openCompare);
  const overlay = $("#overlay"), modal = $("#modalBox");
  function openCompare() {
    const list = [...cmp].map((id) => FONTS.find((x) => x.id === id)); if (!list.length) return;
    ev("cmp_open");
    list.forEach(ensureFace);
    const t = { size: Math.max(28, state.size), ls: 0, lh: 140, inv: state.inv };
    modal.className = "modal wide";
    modal.innerHTML = `<button class="x" id="mx" aria-label="닫기">×</button>
      <div class="m-head"><h2>나란히 비교</h2><span class="en">${list.length}종 · 같은 문장, 같은 조건</span></div>
      <div class="tester" style="border-top:1px solid var(--rule2);margin-top:14px">
        <div class="t-row"><span>문장</span><input id="cText" type="text" value="${esc(state.text)}" style="flex:1;border:1px solid var(--rule2);padding:6px 9px;font-size:14px"></div>
        <div class="t-row"><span>크기</span><input type="range" id="cSize" min="14" max="120" value="${t.size}"><b id="cSizeV">${t.size}px</b>
          <span>자간</span><input type="range" id="cLs" min="-5" max="20" value="0"><b id="cLsV">0px</b>
          <span>행간</span><input type="range" id="cLh" min="110" max="220" value="140"><b id="cLhV">140%</b>
          <button class="tbtn${t.inv ? " on" : ""}" id="cInv">■ 반전</button>
          <button class="tbtn" id="cNorm" title="폰트마다 같은 크기 값이라도 실제로 보이는 글자 높이가 다릅니다. 한글 글자 높이를 재서 눈에 보이는 크기를 맞춥니다.">눈에 보이는 크기 맞춤</button></div>
      </div>
      <div class="cmp" style="grid-template-columns:repeat(${Math.min(list.length, 4)},1fr)">${list.map((f) => `
        <div class="col${t.inv ? " inv" : ""}" data-cid="${f.id}">
          <div class="r-name">${esc(f.name)}<span class="en">${esc(f.designer)}</span><span class="norm-k" data-normk></span></div>
          <div class="pv" style="font-family:${famOf(f)};font-weight:${wOf(f)};font-size:${t.size}px;line-height:1.4">${pvText(f)}</div>
          <div class="r-weights" style="font-family:${f.family};opacity:1">${f.weights.map((w) => `<i style="font-weight:${w}">가<small>${w}</small></i>`).join("")}</div>
          ${covTags(f)}
          <div class="pills">${pills(f)}${missPill(f)}</div>
          <button class="abtn" data-open="${f.id}">상세 보기</button>
        </div>`).join("")}</div>`;
    overlay.classList.add("open");
    $("#mx").addEventListener("click", closeModal);
    const pvs = $$(".cmp .pv");
    $("#cText").addEventListener("input", (e) => { const v = e.target.value; pvs.forEach((p) => { p.textContent = v || FONTS.find((x) => x.id === p.closest("[data-cid]").dataset.cid).name; }); });
    // 눈에 보이는 크기 맞춤: 각 폰트로 '가나다라'를 그려 잉크 높이를 재고, 가운데값에 맞춰 글자 크기를 비례 조정(브라우저 측정)
    let norm = false, ratio = {};
    const inkH = (fam, w) => { const c = document.createElement("canvas"); c.width = 520; c.height = 200; const x = c.getContext("2d", { willReadFrequently: true });
      x.font = `${w} 120px ${fam}`; x.textBaseline = "top"; x.fillText("가나다라", 10, 30); const d = x.getImageData(0, 0, 520, 200).data;
      let top = -1, bot = -1; for (let y = 0; y < 200; y++) { for (let i = 0; i < 520; i++) if (d[(y * 520 + i) * 4 + 3] > 100) { if (top < 0) top = y; bot = y; break; } } return top < 0 ? 0 : bot - top + 1; };
    async function measureNorm() {
      await Promise.all(list.map((f) => Promise.race([document.fonts.load(`${wOf(f)} 120px ${f.family.split(",")[0]}`, "가나다라").catch(() => {}), new Promise((r) => setTimeout(r, 3000))])));
      const hs = list.map((f) => inkH(f.family.split(",")[0], wOf(f))); const ok = hs.filter(Boolean).sort((a, b) => a - b); const mid = ok[Math.floor(ok.length / 2)] || 1;
      list.forEach((f, i) => (ratio[f.id] = hs[i] ? mid / hs[i] : 1));
    }
    const applySize = () => { const v = +$("#cSize").value; pvs.forEach((p) => { const id = p.closest("[data-cid]").dataset.cid; const k = norm ? ratio[id] || 1 : 1; p.style.fontSize = (v * k).toFixed(1) + "px"; const lab = p.closest("[data-cid]").querySelector("[data-normk]"); if (lab) lab.textContent = norm && Math.abs(k - 1) > 0.01 ? `크기 ×${k.toFixed(2)}` : ""; }); $("#cSizeV").textContent = v + "px"; };
    $("#cSize").addEventListener("input", applySize);
    $("#cNorm").addEventListener("click", async (e) => { const btn = e.currentTarget; norm = !norm; btn.classList.toggle("on", norm); if (norm && !Object.keys(ratio).length) { btn.textContent = "재는 중…"; await measureNorm(); btn.textContent = "눈에 보이는 크기 맞춤"; } applySize(); });
    $("#cLs").addEventListener("input", (e) => { pvs.forEach((p) => (p.style.letterSpacing = e.target.value + "px")); $("#cLsV").textContent = e.target.value + "px"; });
    $("#cLh").addEventListener("input", (e) => { pvs.forEach((p) => (p.style.lineHeight = e.target.value + "%")); $("#cLhV").textContent = e.target.value + "%"; });
    $("#cInv").addEventListener("click", (e) => { e.currentTarget.classList.toggle("on"); $$(".cmp .col").forEach((c) => c.classList.toggle("inv")); });
    modal.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.open)));
  }

  // ---------- 다운로드 경로 (3단계: 자체 미러 → 원 배포처 직링크 → 배포처 페이지) ----------
  // links.json은 tools/watch_sources.py가 매주 직링크 응답을 점검해 쓴다. 없으면 링크가 살아 있다고 본다.
  let links = {};
  fetch("data/links.json?v=" + Date.now()).then((r) => (r.ok ? r.json() : {})).then((j) => { links = j || {}; }).catch(() => {});
  // 원칙: 파일은 원 배포처 링크로 받게 한다. LETSUM 보관본(mirror)은 배포처 링크가 끊겼을 때만 대체로 보여준다.
  function dlFor(f) {
    const gfam = f.en.replace(/ /g, "+");
    const o = f.dl || {};
    const zip = o.zip || (isGF(f) ? `https://fonts.google.com/download?family=${gfam}` : null);
    const page = o.page || `https://fonts.google.com/specimen/${gfam}`;
    const st = links[f.id];
    return { zip, page, ok: !!zip && !(st && st.ok === false), checked: st && st.checked, srcName: o.srcName || (isGF(f) ? "Google Fonts" : "공유마당"), mirror: o.mirror || null };
  }
  // 사용 조건 확인 기록: 이 폰트를 고를 때 LETSUM에서 확인한 조건·출처·확인일을 텍스트로 남긴다.
  // 사용 권리를 보증하는 문서가 아니라 '언제 무엇을 확인했는지'의 메모다.
  // 확인 근거(원문 대조 요약·근거 페이지·원본 출처·폰트 버전) — 필요할 때 한 번만 받는다
  const reasonsLoad = fetch("data/reasons.json?v=1").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  let evidence = null;
  const evidenceLoad = () => evidence ? Promise.resolve(evidence) : fetch("data/evidence.json?v=1").then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => (evidence = j));
  const stText = (f) => f.status === "verified" ? "원문 대조 완료" : "확인 중(원문 대조 전)";
  function proofLines(f, dl, E, note) {
    const L = licInfo(f);
    return [
      `폰트: ${f.name} (${f.en})`, `저작권자: ${f.holder} · 제작: ${f.designer}`,
      `라이선스: ${L.full} — ${L.note}`,
      ...(L.url ? [`라이선스 원문: ${L.url}`] : []),
      ...(f.attribution ? [`출처 표시 예: ${f.attribution}`] : []),
      `검토 상태: ${stText(f)} · LETSUM 최근 확인일 ${f.verified}`,
      ...(E.ev ? [`확인 근거: ${E.ev}`] : []), ...(E.pg ? [`근거 자료: ${E.pg}`] : []),
      ...(E.src ? [`원본 파일 출처: ${E.src}`] : []), ...(E.ver ? [`폰트 버전(LETSUM 확인 파일 기준): ${E.ver}`] : []), "",
      "사용 범위(LETSUM 정리):", ...LICENSE_CATS.map((c) => `  - ${c.label}: ${f.matrix[c.key] === "ok" ? "사용 가능" : f.matrix[c.key] === "no" ? "사용 불가" : "조건부 — 원문 확인 필요"}`), "",
      `원 배포처: ${dl.page}`,
      dl.zip ? `직접 다운로드: ${dl.zip}` : "직접 다운로드: 제공 안 함 — 원 배포처에서 받으세요",
      `LETSUM 페이지: https://letsum.app/font/${f.id}.html`,
      ...(note ? [`선택 이유(메모): ${note}`] : []),
    ];
  }
  const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const PROOF_TAIL = (now) => ["", `기록 저장 시각: ${now.toLocaleString("ko-KR")} (${now.toISOString()})`, "",
    "※ 이 기록은 LETSUM이 정리한 참고 정보와 확인 시점을 남긴 메모이며, 사용 권리를 보증하지 않습니다.",
    "   최종 판단은 저작권자의 라이선스 원문을 따르고, 사용 시점에 원문을 다시 확인해 주세요."];
  function downloadText(name, lines) {
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function saveProof(f, dl) {
    const now = new Date(); ev("record", f.id);
    const E = (await evidenceLoad())[f.id] || {};
    downloadText(`LETSUM_사용조건확인기록_${f.name}_${ymdOf(now)}.txt`, ["LETSUM 사용 조건 확인 기록", "=".repeat(28), "", ...proofLines(f, dl, E), ...PROOF_TAIL(now)]);
  }

  // 웹사이트·앱에 쓸 때의 안내 — 라이선스의 임베딩 칸에 따라 다르게(공통 안내로 잘못 안내하지 않도록)
  function webUseNote(f) {
    const m = f.matrix.embed, L = licInfo(f);
    if (f.intro) return "이 폰트는 소개 전용입니다. 웹·앱 사용 가능 여부는 원 배포처의 라이선스 원문을 확인하세요.";
    if (m === "ok") return `웹사이트에 쓰려면 원 배포처에서 받은 파일을 직접 호스팅하세요(${esc(L.short)} — 웹 임베딩 허용).`;
    if (m === "no") return `<b>이 폰트는 웹폰트·앱 임베딩이 허용되지 않습니다.</b> 이미지·인쇄물·영상 등 사용 범위 표에서 허용된 방식으로만 쓰세요.`;
    return `<b>웹폰트·앱 임베딩은 조건부입니다.</b> ${esc(L.note)} — 직접 호스팅하기 전에 라이선스 원문을 확인하세요.`;
  }
  // ---------- 상세 모달 ----------
  const st = (v) => v === "ok" ? `<span class="st-ok">${licIc("ok")}사용 가능</span>` : v === "no" ? `<span class="st-no">${licIc("no")}사용 금지</span>` : `<span class="st-cond">${licIc("cond")}조건부</span>`;
  let evDetail = "";
  function openDetail(id, focus) {
    const f = FONTS.find((x) => x.id === id); if (!f) return;
    if (evDetail !== id || !overlay.classList.contains("open")) { ev("detail", id); evDetail = id; }
    ensureFace(f, true);
    if (f.webfont && !metrics[f.id]) measureLazy(f).then(() => { if (overlay.classList.contains("open") && location.hash === "#f=" + f.id) openDetail(f.id); });
    const gfam = f.en.replace(/ /g, "+");
    const gfont = `https://fonts.googleapis.com/css2?family=${gfam}:wght@${f.weights.join(";")}&display=swap`;
    const specimen = "https://fonts.google.com/specimen/" + gfam;
    const d = detect[f.id] || {};
    const miss = coverage[f.id] || [];
    const pairDef = LATIN_PAIRS.find((p) => p.id === f.pair);
    const dl = dlFor(f);
    try { history.replaceState(null, "", "#f=" + f.id); } catch (e) {}
    modal.className = "modal";
    modal.innerHTML = `
      <button class="x" id="mx" aria-label="닫기">×</button>
      <div class="m-head"><h2>${esc(f.name)}</h2><span class="en">${esc(f.en)}</span><span class="badge">${f.category}</span><span class="badge free">상업용 무료 · ${esc(licInfo(f).short)}</span>${f.status !== "verified" ? '<span class="badge check">확인 중</span>' : ""}</div>
      <p class="m-sub">저작권자 ${esc(f.holder)} · 제작 <button class="linklike" id="dsgBtn">${esc(f.designer)}</button> · ${f.mood.join(" · ")}</p>
      ${f.intro ? `${introBox(f, "big")}<div class="intro-why"><b>소개 전용 폰트</b> — ${esc(f.introReason || "")} 아래 원 배포처 페이지에서 받을 수 있습니다.</div>` : `<div class="pv-big" id="pvBig" style="font-family:${f.family};font-size:44px;font-weight:${wOf(f)}">${pvText(f)}</div>
      <div class="tester">
        <div class="t-row"><span>크기</span><input type="range" id="tSize" min="12" max="110" value="44"><b id="tSizeV">44px</b>
          <span>굵기</span><select id="tW">${f.weights.map((w) => `<option value="${w}"${w === wOf(f) ? " selected" : ""}>${w}</option>`).join("")}</select>
          <span>영문 짝꿍</span><select id="tPair"><option value="">없음 (폰트 자체 영문)</option>${LATIN_PAIRS.map((p) => `<option value="${p.id}"${state.pair && p.id === f.pair ? " selected" : ""}>${p.name}${p.id === f.pair ? " · 추천" : ""}</option>`).join("")}</select></div>
        <div class="t-row"><span>자간</span><input type="range" id="tLs" min="-5" max="20" value="0"><b id="tLsV">0px</b>
          <span>행간</span><input type="range" id="tLh" min="110" max="240" value="140"><b id="tLhV">140%</b></div>
        <div class="t-row">
          <button class="tbtn" id="tDark">■ 반전</button>
          <button class="tbtn" id="tVert">↕ 세로쓰기</button>
          <button class="tbtn" id="tLong">장문</button>
          ${TEXT_PRESETS.filter((p) => ["pang", "batchim", "mixed", "old", "hanja"].includes(p.id)).map((p) => `<button class="tbtn" data-tp="${p.id}">${p.label}</button>`).join("")}
        </div>
        <div class="t-row" style="margin-bottom:0"><span class="k">글자 범위</span>${covTags(f)}
          ${{ miss: `<span class="pill miss">현재 문장에서 누락 ${miss.length}자: ${esc(miss.join(" "))}</span>`, pending: `<span class="pill chk">글자 지원 확인 중</span>`, na: `<span class="pill">소개 전용 · 글자 지원 미확인</span>` }[covState[f.id]] || (covChars.length ? `<span class="pill ok">현재 문장의 한글·한자 모두 지원</span>` : `<span class="note">문장에 검사할 한글·한자가 없습니다</span>`)}
          <span class="note">옛한글·한자·누락은 브라우저 자동 검출(참고용)</span></div>
      </div>`}
      <p style="margin-top:16px;color:var(--ink2)">${esc(f.desc)}</p>
      <div class="why-box" id="whyBox" hidden></div>

      ${f.intro ? "" : `<div class="m-sec"><h3>쓰임새에서 보기</h3>
        <div class="m-ctx">${["thumb", "book", "sub"].map((c) => mockHTML(f, c)).join("")}</div>
        <p class="note" style="margin-top:8px">목록의 '맥락' 보기에서 메뉴판·카드뉴스·UI 프레임도 확인할 수 있습니다.</p></div>

      <div class="m-sec"><h3>효과 적용 예시</h3>
        <div class="m-fx">${fxTiles(f, state.text || f.name, 5)}</div>
        <p class="note" style="margin-top:8px">${esc(f.category)}·분위기에 어울리는 효과를 골라 이 글꼴로 바로 그렸습니다. 포토샵·피그마·캔바의 외곽선·그림자·그라데이션 설정으로 비슷하게 만들 수 있습니다.</p></div>

      <div class="m-sec"><h3>비슷한 분위기</h3>
        <div class="simrow">${similar(f, 3).map((r) => (ensureFace(r.x), r)).map(({ x: s, why }) => `<button class="simcard" data-open="${s.id}"><span class="r-pv" style="font-family:${s.family};font-weight:${wOf(s)};font-size:26px">${esc(state.text || s.name)}</span><span class="r-name">${esc(s.name)}<span class="en">${s.category}</span></span><span class="sim-why">${why.slice(0, 4).map((w) => `<i>${esc(w)}</i>`).join("")}</span></button>`).join("") || '<span class="note">겹치는 태그가 충분한 폰트가 없습니다.</span>'}</div>
        <p class="note" style="margin-top:8px">LETSUM이 정리한 분류·모양·분위기·용도 태그가 많이 겹치는 순입니다(같은 제작사는 1종만). 글자 모양이 똑같다는 뜻은 아닙니다.</p></div>`}

      <div class="m-sec"><h3>사양</h3>
        <table class="spec">
          ${f.intro ? "" : `<tr><th>측정값</th><td>${metrics[f.id] ? `굵기 밀도 ${(metrics[f.id].density * 100).toFixed(0)}% · 너비 ${metrics[f.id].width.toFixed(2)}em · 획 대비 ${metrics[f.id].contrast.toFixed(2)} <span class="note">(브라우저 측정)</span>` : "측정 중…"}</td></tr>`}
          <tr><th>굵기</th><td>${f.weightsUnknown ? '<span class="note">배포처에서 확인</span>' : f.intro ? f.weights.join(" · ") : `<span class="r-weights" style="font-family:${f.family};opacity:1;font-size:24px">${f.weights.map((w) => `<i style="font-weight:${w}">가<small>${w}</small></i>`).join("")}</span>`}</td></tr>
          <tr><th>출시·배포일</th><td>${f.released ? `${fmtRel(f.released)} <span class="note">— 출처: <a class="linklike" href="${esc(f.releasedUrl)}" target="_blank" rel="noopener">${esc(f.releasedSrc)}</a></span>` : '<span class="note">원 출시일 확인 중</span>'}</td></tr>
          <tr><th>지원 형식</th><td>${f.formats.join(", ")}</td></tr>
          <tr><th>한글 글자수</th><td>${f.glyphs}${!f.intro && f.cov && f.cov < 11172 ? ' <span class="note">— 완성형 전체가 아니라 희귀 글자(뷁·똠 등)가 빠질 수 있습니다. 위 문장 검사로 확인하세요.</span>' : ""}</td></tr>
          ${f.intro ? "" : `<tr><th>옛한글 · 한자</th><td>${d.old ? "옛한글 지원" : "옛한글 미지원"} · ${d.hanja ? "한자 지원" : "한자 미지원"} <span class="note">(자동 검출)</span></td></tr>`}
          <tr><th>라이선스</th><td>${licInfo(f).url ? `<a class="linklike" href="${licInfo(f).url}" target="_blank" rel="noopener">${esc(licInfo(f).full)}</a>` : esc(licInfo(f).full)} <span class="note">— ${esc(licInfo(f).note)}</span>${f.attribution ? `<br><span class="note">출처 표시 예: ${esc(f.attribution)}</span>` : ""}${f.hostedNote ? `<br><span class="note">미리보기: ${esc(f.hostedNote)}</span>` : ""}</td></tr>
          <tr><th>검토 상태</th><td>${stText(f)} · 최근 확인일 ${f.verified}<div class="ev-box" id="evBox"></div></td></tr>
          <tr><th>영문 짝꿍 추천</th><td>${pairDef.name} <span class="note">— ${pairDef.note}. 한글 폰트의 영문·숫자가 아쉬울 때 영문만 이 폰트로 조합합니다.</span></td></tr>
        </table></div>

      <div class="m-sec" id="licSec"><h3>사용 범위 (라이선스 매트릭스)</h3>
        <table class="matrix">
          <tr><th style="width:90px">카테고리</th><th>사용 범위</th><th style="width:92px">허용 여부</th></tr>
          ${LICENSE_CATS.map((c) => `<tr><td><b>${c.label}</b></td><td>${c.key === "ofl" ? esc(licInfo(f).note) : c.desc}</td><td>${st(f.matrix[c.key])}</td></tr>`).join("")}
        </table>
        <p class="note" style="margin-top:8px"><a class="linklike" href="subset.html?f=${f.id}">이 폰트를 내 웹사이트에 넣는 코드 만들기 →</a></p></div>

      <div class="m-sec"><h3>받기</h3>
        <div class="dlrow">
          ${dl.ok ? `<a class="btn" data-dl="zip" data-fid="${f.id}" href="${esc(dl.zip)}" target="_blank" rel="noopener">⬇ 원 배포처에서 받기 <small>${esc(dl.srcName)} · 자동 다운로드 시작 · TTF/OTF 설치용</small></a>` : ""}
          <a class="btn ghost" data-dl="page" data-fid="${f.id}" href="${esc(dl.page)}" target="_blank" rel="noopener">원 배포처 페이지 ↗</a>
          ${!dl.ok && dl.mirror ? `<a class="btn ghost" href="${esc(dl.mirror)}" rel="noopener">보관본 받기 <small>배포처 링크 끊김 시 대체 · 원본 그대로</small></a>` : ""}
          <button class="btn ghost" id="proofBtn" title="이 폰트의 사용 범위·라이선스 원문 링크·출처·LETSUM 확인일을 텍스트 파일로 남깁니다(사용 권리 보증 아님)">📄 사용 조건 확인 기록 저장</button>
        </div>
        ${dl.ok ? "" : f.intro ? `<p class="note" style="margin-top:6px">파일은 <b>${esc(dl.srcName)}</b>에서만 받을 수 있습니다. 이용 조건을 그곳에서 확인한 뒤 내려받으세요.</p>` : !isGF(f) ? `<p class="note" style="margin-top:6px">이 폰트는 <b>${esc(dl.srcName)}</b> 페이지에서 이용 범위를 확인한 뒤 내려받습니다. 원 배포처 페이지 버튼을 눌러 주세요.</p>` : `<p class="note" style="margin-top:6px">⚠ 배포처 다운로드 링크가 최근 점검(${esc(dl.checked || "—")})에서 응답하지 않습니다. 배포처 페이지에서 받아 주세요.${dl.mirror ? " 급하면 LETSUM이 보관한 원본 그대로의 ZIP(폰트 파일·라이선스 원문·출처 포함)을 받을 수 있습니다." : ""}</p>`}
        <p class="note" style="margin-top:8px">${dl.ok ? `파일은 LETSUM이 아니라 <b>원 배포처(${esc(dl.srcName)})</b>에서 내려받습니다. ${f.license === "OFL" && /\.zip(\?|$)|fonts\.google\.com\/download/.test(dl.zip || "") ? " ZIP 안에 라이선스 원문(OFL.txt)이 함께 들어 있습니다." : " 라이선스 원문은 배포처에서 함께 확인하세요."}` : ""} 받은 뒤가 막히면 아래 설치 안내를 펼쳐 보세요.</p>
        <details class="howto"><summary>설치 · PPT/한글 적용 안내 (Windows · Mac · 아이폰 · 갤럭시)</summary>
          <div class="howto-body">
            <p><b>Windows</b> — ZIP 압축을 풀고 .ttf/.otf 파일을 우클릭 → <b>모든 사용자용으로 설치</b>. 여러 굵기 파일은 전부 설치합니다.</p>
            <p><b>Mac</b> — 파일을 더블클릭 → 서체 관리자에서 <b>설치</b>. 또는 서체 관리자에 드래그.</p>
            <p><b>PPT·한글·포토샵에 안 보일 때</b> — ① 프로그램을 <b>완전히 종료 후 다시 실행</b> ② 목록에는 파일명이 아니라 <b>글꼴 이름</b>(이 폰트는 "${esc(f.en)}" 또는 "${esc(f.name)}")으로 뜹니다 ③ .woff/.woff2는 웹 전용이라 설치되지 않습니다 ④ 다른 PC에서 열면 글꼴이 바뀌니 PPT는 <b>파일 &gt; 옵션 &gt; 저장 &gt; 파일의 글꼴 포함</b>으로 저장하거나 PDF로 보내세요.</p>
            <p><b>아이폰</b> — iOS는 폰트 설치 앱(예: iFont, Fontcase)으로 프로필을 설치해야 하며, 시스템 글꼴은 바뀌지 않고 Pages·Keynote 등 앱 안에서만 쓸 수 있습니다. <b>갤럭시</b> — 설정 &gt; 디스플레이 &gt; 글꼴에서는 Galaxy Store 글꼴만 적용됩니다. 문서 앱 안에서 쓰려면 앱별 글꼴 추가 기능을 이용하세요.</p>
            <p><b>영상·디자인 프로그램</b> — 프리미어·애프터이펙트·피그마는 설치 후 재실행하면 바로 나타납니다. 캔바(무료)는 자체 폰트만 쓸 수 있고, 유료 플랜에서 업로드가 됩니다.</p>
          </div>
        </details>
        ${isGF(f) ? `<div class="codehead"><span>웹폰트 (Google Fonts CDN)</span><button class="abtn" data-copy="c1">복사</button></div>
        <pre class="code" id="c1">&lt;link href="${gfont}" rel="stylesheet"&gt;
font-family: ${esc(f.family)};${state.pair || true ? `\n/* 영문만 짝꿍 폰트로: */ font-family: ${esc(pairDef.family)}, ${esc(f.family)};` : ""}</pre>
        <div class="codehead"><span>개발자용 (Fontsource · npm, 자체 호스팅)</span><button class="abtn" data-copy="c2">복사</button></div>
        <pre class="code" id="c2">npm i @fontsource/${f.id}
import "@fontsource/${f.id}/400.css";</pre>
        <p class="note" style="margin-top:8px">필요한 글자만 내려받는 CSS는 <a href="subset.html" class="linklike">서브셋 생성기</a>에서 만들 수 있습니다. 임베딩 허용 여부는 위 매트릭스를 따릅니다.</p>` : `<p class="note" style="margin-top:12px">${webUseNote(f)} LETSUM의 미리보기용 웹폰트는 이 사이트의 미리보기 전용이며 내려받아 쓰는 파일이 아닙니다.</p>`}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
          <button class="btn ghost" id="projAdd">＋ 보관함에 담기</button>
          <button class="btn ghost" id="favBtn">${favs.has(f.id) ? "♥ 즐겨찾기 해제" : "♡ 즐겨찾기"}</button>
          ${f.intro ? "" : `<button class="btn ghost" id="cmpBtn">${cmp.has(f.id) ? "비교에서 빼기" : "+ 비교에 담기"}</button>`}
        </div></div>
      <div class="m-sec" id="shotSec"><h3>사용 사례 <span class="note" id="shotCount"></span></h3>
        <div class="shot-grid" id="shotGrid"></div>
        <details class="shot-up"><summary>이 폰트로 만든 작업 사진 올리기</summary>
          <form class="cmt-form" id="shotForm" autocomplete="off">
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required aria-label="이미지 파일">
            <input name="caption" maxlength="100" placeholder="한 줄 설명 (예: 카페 메뉴판 제목에 사용)" aria-label="설명">
            <input name="name" maxlength="20" placeholder="닉네임 (선택)" aria-label="닉네임">
            <input name="website" class="hp" tabindex="-1" aria-hidden="true">
            <label class="note shot-agree"><input type="checkbox" name="agree" required> 제가 만든(또는 게시 권한이 있는) 이미지이며, LETSUM에 사용 사례로 게시하는 데 동의합니다. 얼굴·연락처 등 개인정보가 없는지 확인했습니다.</label>
            <div class="cmt-row"><span class="note">운영자 검토 후 공개됩니다. 하루 3장까지, 긴 변 1280px로 줄여 올라갑니다.</span><button class="btn" type="submit">올리기</button></div>
            <p class="note cmt-msg" id="shotMsg"></p>
          </form></details></div>
      <div class="m-sec" id="cmtSec"><h3>댓글 <span class="note" id="cmtCount"></span></h3>
        <form class="cmt-form" id="cmtForm" autocomplete="off">
          <input name="name" maxlength="20" placeholder="닉네임 (선택)" aria-label="닉네임" value="${esc(nick())}">
          <input name="website" class="hp" tabindex="-1" aria-hidden="true" placeholder="비워 두세요">
          <textarea name="body" maxlength="500" rows="2" placeholder="이 폰트를 어디에 써 보셨나요? 사용 후기·팁을 남겨 주세요 (500자)" aria-label="댓글 내용" required></textarea>
          <div class="cmt-row"><span class="note">로그인 없이 남깁니다. 개인정보(연락처 등)는 쓰지 마세요. 부적절한 글은 신고 3회 시 자동 숨김됩니다.</span><button class="btn" type="submit">남기기</button></div>
          <p class="note cmt-msg" id="cmtMsg"></p>
        </form>
        <div class="cmt-list" id="cmtList"><p class="note">불러오는 중…</p></div></div>
      <p class="disclaimer">※ 위 사용 범위는 참고용으로, 정확한 사용 범위는 이용 전 폰트 저작권자에게 확인하시기 바랍니다. 사용 범위는 저작권자의 규정에 따라 달라질 수 있습니다.</p>`;
    overlay.classList.add("open");
    $("#mx").addEventListener("click", closeModal);
    const pv = $("#pvBig"); const base = state.text || f.name;
    reasonsLoad.then((Rz) => { const r = Rz[f.id]; const b = $("#whyBox"); if (!r || !b) return; b.hidden = false;
      b.innerHTML = `<b>추천 이유</b><p>${esc(r.why)}</p><p class="note">잘 맞는 곳: ${r.good.map(esc).join(" · ")}${r.caution ? `<br>주의: ${esc(r.caution)}` : ""}</p>`; });
    evidenceLoad().then((E) => { const x = E[f.id]; const box = $("#evBox"); if (!x || !box) return;
      box.innerHTML = `<details><summary>확인 근거 보기</summary>${x.ev ? `<p>${esc(x.ev)}</p>` : ""}${x.pg ? `<p><a class="linklike" href="${esc(x.pg)}" target="_blank" rel="noopener">근거 자료 ↗</a></p>` : ""}${x.src ? `<p class="note">원본 파일: ${esc(x.src)}</p>` : ""}${x.ver ? `<p class="note">폰트 버전: ${esc(x.ver)}</p>` : ""}</details>`; });
    const commonBind = () => {
      bindComments(f, focus); bindShots(f);
      $("#proofBtn").addEventListener("click", () => saveProof(f, dl));
      $("#dsgBtn").addEventListener("click", () => openDesigner(f.designer));
      $("#favBtn").addEventListener("click", () => { toggleLike(f.id); openDetail(f.id); render(); });
      $("#projAdd")?.addEventListener("click", () => openProjects({ addIds: [f.id] }));
    };
    if (f.intro) { commonBind(); return; }
    const LONG = BODY;
    let curPair = state.pair ? f.pair : "";
    const applyFam = () => { const p = LATIN_PAIRS.find((x) => x.id === curPair); pv.style.fontFamily = p ? `${p.family}, ${f.family}` : f.family; };
    $("#tSize").addEventListener("input", (e) => { pv.style.fontSize = e.target.value + "px"; $("#tSizeV").textContent = e.target.value + "px"; });
    $("#tW").addEventListener("change", (e) => (pv.style.fontWeight = e.target.value));
    $("#tPair").addEventListener("change", (e) => { curPair = e.target.value; applyFam(); if (curPair && !/[A-Za-z0-9]/.test(pv.textContent)) pv.textContent = TEXT_PRESETS.find((p) => p.id === "mixed").t; });
    $("#tLs").addEventListener("input", (e) => { pv.style.letterSpacing = e.target.value + "px"; $("#tLsV").textContent = e.target.value + "px"; });
    $("#tLh").addEventListener("input", (e) => { pv.style.lineHeight = e.target.value + "%"; $("#tLhV").textContent = e.target.value + "%"; });
    const tgl = (id, fn) => $(id).addEventListener("click", (e) => { e.currentTarget.classList.toggle("on"); fn(e.currentTarget.classList.contains("on")); });
    tgl("#tDark", (on) => pv.classList.toggle("dark", on));
    tgl("#tVert", (on) => pv.classList.toggle("vert", on));
    tgl("#tLong", (on) => { pv.textContent = on ? LONG : base; });
    modal.querySelectorAll("[data-tp]").forEach((b) => b.addEventListener("click", () => { pv.textContent = TEXT_PRESETS.find((p) => p.id === b.dataset.tp).t; }));
    modal.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#" + b.dataset.copy).textContent); } catch (e) {} b.textContent = "복사됨 ✓"; setTimeout(() => (b.textContent = "복사"), 1500); }));
    modal.querySelectorAll(".simcard[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.open)));
    commonBind();
    $("#cmpBtn").addEventListener("click", () => { toggleCmp(f.id); openDetail(f.id); });
  }
  const fmtAgo = (t) => { const d = (Date.now() - t) / 1000; return d < 60 ? "방금" : d < 3600 ? `${Math.floor(d / 60)}분 전` : d < 86400 ? `${Math.floor(d / 3600)}시간 전` : new Date(t).toLocaleDateString("ko-KR"); };
  const cmtHTML = (c) => `<div class="cmt" data-cid="${c.id}"><b>${esc(c.name)}</b><span class="note">${fmtAgo(c.created)}</span><p>${esc(c.body).replace(/\n/g, "<br>")}</p><button class="linklike cmt-rep" data-rep="${c.id}">신고</button></div>`;
  // 사진을 브라우저에서 줄여(긴 변 1280px, WebP→안 되면 JPEG) 700KB 이하로 만든다
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      for (const q of [0.85, 0.75, 0.6, 0.45]) {
        let d = c.toDataURL("image/webp", q); if (!d.startsWith("data:image/webp")) d = c.toDataURL("image/jpeg", q);
        if (d.length * 0.75 < 690 * 1024) return d;
      }
      return null;
    } finally { URL.revokeObjectURL(url); }
  }
  async function bindShots(f) {
    const grid = $("#shotGrid"), form = $("#shotForm"), msg = $("#shotMsg"); if (!grid) return;
    const j = await api("shots?id=" + f.id);
    if (!j || j.error) { $("#shotSec").style.display = "none"; return; }
    $("#shotCount").textContent = j.items.length ? `${j.items.length}장` : "";
    grid.innerHTML = j.items.length ? j.items.map((x) => `<figure><a href="/api/shot/${x.id}" target="_blank" rel="noopener"><img src="/api/shot/${x.id}" alt="${esc(x.caption || "사용 사례")}" loading="lazy"></a><figcaption>${esc(x.caption)} <span class="note">— ${esc(x.name)}</span></figcaption></figure>`).join("")
      : '<p class="note">아직 사용 사례가 없습니다. 이 폰트로 만든 작업을 처음으로 공유해 주세요.</p>';
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); const fd = new FormData(form); const btn = form.querySelector("button[type=submit]");
      const file = fd.get("file"); if (!file || !file.size) return;
      btn.disabled = true; msg.style.color = ""; msg.textContent = "이미지를 줄이는 중…";
      let image = null; try { image = await shrink(file); } catch (x) {}
      if (!image) { btn.disabled = false; msg.textContent = "이미지를 읽지 못했습니다. JPEG·PNG·WebP 파일을 올려 주세요."; return; }
      msg.textContent = "올리는 중…";
      const r = await api("shots", { id: f.id, name: fd.get("name"), caption: fd.get("caption"), image, agree: !!fd.get("agree"), website: fd.get("website") });
      btn.disabled = false;
      if (!r || r.error) { msg.textContent = (r && r.error) || "잠시 후 다시 시도해 주세요."; return; }
      ev("shot_up", f.id); form.reset(); msg.style.color = "var(--ink2)"; msg.textContent = "접수됐습니다. 운영자 검토 후 공개됩니다. 감사합니다!";
    });
  }
  async function bindComments(f, focus) {
    const list = $("#cmtList"), form = $("#cmtForm"), msg = $("#cmtMsg");
    if (focus === "comments") setTimeout(() => $("#cmtSec")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    if (focus === "license") setTimeout(() => $("#licSec")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    const j = await api("comments?id=" + f.id);
    if (!j || j.error) { $("#cmtSec").style.display = apiOk ? "" : "none"; list.innerHTML = '<p class="note">댓글을 불러오지 못했습니다.</p>'; return; }
    const draw = (items) => {
      $("#cmtCount").textContent = items.length ? `${items.length}개` : "";
      list.innerHTML = items.length ? items.map(cmtHTML).join("") : '<p class="note">아직 댓글이 없습니다. 첫 사용 후기를 남겨 주세요.</p>';
      list.querySelectorAll("[data-rep]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("이 댓글을 신고할까요? 신고가 3회 쌓이면 자동으로 숨겨집니다.")) return;
        await api("report", { commentId: +b.dataset.rep }); b.textContent = "신고됨"; b.disabled = true;
      }));
    };
    let items = j.items || []; draw(items);
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); const fd = new FormData(form); const btn = form.querySelector("button[type=submit]");
      btn.disabled = true; msg.textContent = "";
      try { if (fd.get("name")) localStorage.setItem("ls_nick", String(fd.get("name")).slice(0, 20)); } catch (x) {}
      const r = await api("comments", { id: f.id, name: fd.get("name"), body: fd.get("body"), website: fd.get("website") });
      btn.disabled = false;
      if (!r || r.error) { msg.textContent = (r && r.error) || "잠시 후 다시 시도해 주세요."; return; }
      ev("comment", f.id);
      if (r.item) { items = [r.item, ...items]; draw(items); form.reset(); const s = social[f.id]; if (s) { s.comments++; paintSocial(); } }
    });
  }
  function openDesigner(name) {
    const list = FONTS.filter((f) => f.designer === name);
    list.forEach(ensureFace);
    modal.className = "modal";
    modal.innerHTML = `<button class="x" id="mx" aria-label="닫기">×</button>
      <div class="m-head"><h2>${esc(name)}</h2><span class="en">LETSUM 등록 폰트 ${list.length}종</span></div>
      <div class="grid" style="margin-top:18px">${list.map((f) => `<article class="card" data-did="${f.id}"><div class="r-pv" style="font-family:${f.family};font-size:30px">${esc(state.text || f.name)}</div><div class="r-name">${esc(f.name)}<span class="en">굵기 ${f.weights.length}종</span></div></article>`).join("")}</div>
`;
    overlay.classList.add("open");
    $("#mx").addEventListener("click", closeModal);
    modal.querySelectorAll("[data-did]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.did)));
  }
  function closeModal() { overlay.classList.remove("open"); try { if (location.hash.startsWith("#f=")) history.replaceState(null, "", location.pathname); } catch (e) {} }
  // 폰트별 정적 페이지(font/<id>.html)와 공유 링크에서 #f=<id>로 들어오면 바로 상세를 연다
  function openFromHash() { const m = location.hash.match(/^#f=([\w-]+)/); if (m && FONTS.some((x) => x.id === m[1])) openDetail(m[1]); }
  window.addEventListener("hashchange", openFromHash);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // ---------- 용도 질문 마법사 (규칙 점수, AI 없음) ----------
  // 필수: 용도의 라이선스 칸이 모두 '사용 가능'. 점수: 분류 + 분위기 + 필요 조건 + 굵은 굵기 + 검수 완료 + 인기(동점 정리)
  // 소개 전용 폰트는 생김새를 확인할 수 없어 추천에서 뺀다.
  const wiz = { use: null, mood: new Set(), need: new Set() };
  function wizScore(f) {
    const u = WIZARD_USES.find((x) => x.id === wiz.use); if (!u) return null;
    if (f.intro || !u.lic.every((k) => f.matrix[k] === "ok")) return null;
    const why = [`${u.lic.map((k) => LICENSE_CATS.find((c) => c.key === k).label).join("·")} 사용 가능`];
    let sc = (u.cat[f.category] || 0) * 2; if (u.cat[f.category] >= 2) why.push(`${f.category} — ${u.why}`);
    const hit = f.mood.filter((m) => wiz.mood.has(m)); sc += hit.length * 4; if (hit.length) why.push(`분위기 ${hit.join("·")}`);
    const d = detect[f.id] || {};
    const cd = covData && covData[f.id]; // 미리보기 폰트는 실제 그려진 글자 수 기준
    const has = { full: (cd ? cd.n : f.cov) >= 11172, multi: f.weights.length >= 3, hanja: cd ? cd.hanja : !!d.hanja, old: cd ? cd.old : !!d.old };
    for (const n of wiz.need) { if (!has[n]) return null; }
    [...wiz.need].forEach((n) => why.push(WIZARD_NEEDS.find((x) => x.id === n).label));
    if (u.full && has.full) sc += u.full; if (u.multi && has.multi) sc += u.multi;
    const maxW = f.weights[f.weights.length - 1]; if (u.heavy && maxW >= 800) { sc += u.heavy * 2; why.push(`굵기 ${maxW}까지`); }
    if (f.status === "verified") sc += 1;
    return { f, sc: sc + f.pop / 100, why };
  }
  function wizResults() { return FONTS.map(wizScore).filter(Boolean).sort((a, b) => b.sc - a.sc); }
  function openWizard() {
    ev("wiz_open");
    modal.className = "modal wide wiz";
    const chip = (grp, id, label, on, sub) => `<button class="fbtn${on ? " on" : ""}" data-w${grp}="${id}">${label}${sub ? `<small>${sub}</small>` : ""}</button>`;
    const draw = () => {
      const u = WIZARD_USES.find((x) => x.id === wiz.use);
      const res = u ? wizResults() : [];
      const top = res.slice(0, 6); top.forEach((r) => ensureFace(r.f));
      modal.innerHTML = `
        <button class="x" id="mx" aria-label="닫기">×</button>
        <div class="m-head"><h2>용도로 고르기</h2><span class="en">용도와 필요한 조건을 고르면, 맞는 폰트를 추천해 드려요</span></div>
        <div class="wiz-q"><div class="wq-k">1. 어디에 쓰세요? <em>필수</em></div><div class="chips">${WIZARD_USES.map((x) => chip("u", x.id, x.label, wiz.use === x.id)).join("")}</div></div>
        <div class="wiz-q"><div class="wq-k">2. 어떤 느낌이면 좋을까요? <em>최대 2개 · 선택</em></div><div class="chips">${MOODS.map((m) => chip("m", m, m, wiz.mood.has(m))).join("")}</div></div>
        <div class="wiz-q"><div class="wq-k">3. 꼭 필요한 조건이 있나요? <em>선택</em></div><div class="chips">${WIZARD_NEEDS.map((n) => chip("n", n.id, n.label, wiz.need.has(n.id), n.note)).join("")}</div></div>
        <div class="wiz-res">${!u ? `<p class="note">1번에서 용도를 고르면 바로 추천이 나옵니다.</p>`
          : !res.length ? `<p class="note">조건을 모두 만족하는 폰트가 없습니다. 3번 조건을 줄여 보세요.</p>`
          : `<div class="wq-k">추천 ${top.length}종 <span class="note">/ 조건에 맞는 ${res.length}종 중 · 라이선스 '${u.lic.map((k) => LICENSE_CATS.find((c) => c.key === k).label).join("·")}' 사용 가능만</span></div>
            <div class="wiz-grid">${top.map((r, i) => `<button class="wiz-card" data-open="${r.f.id}">
              <span class="wc-n">${i + 1}</span>
              <span class="wc-pv" style="font-family:${r.f.family};font-weight:${u.heavy ? r.f.weights[r.f.weights.length - 1] : (r.f.weights.includes(400) ? 400 : r.f.weights[0])}">${esc(u.text)}</span>
              <span class="r-name">${esc(r.f.name)}<span class="en">${esc(r.f.designer)}</span></span>
              <span class="wc-why">${r.why.map((w) => `<i>${esc(w)}</i>`).join("")}</span></button>`).join("")}</div>
            <div class="wiz-acts"><button class="btn" id="wizApply">추천 순으로 ${res.length}종 모두 보기</button><span class="note">사용 범위는 참고용입니다. 상세에서 라이선스 원문을 확인하세요.</span></div>`}</div>`;
      $("#mx").addEventListener("click", closeModal);
      modal.querySelectorAll("[data-wu]").forEach((b) => b.addEventListener("click", () => { wiz.use = wiz.use === b.dataset.wu ? null : b.dataset.wu; draw(); }));
      modal.querySelectorAll("[data-wm]").forEach((b) => b.addEventListener("click", () => {
        const m = b.dataset.wm; if (wiz.mood.has(m)) wiz.mood.delete(m); else { if (wiz.mood.size >= 2) wiz.mood.delete([...wiz.mood][0]); wiz.mood.add(m); } draw(); }));
      modal.querySelectorAll("[data-wn]").forEach((b) => b.addEventListener("click", () => { toggleSet(wiz.need, b.dataset.wn); draw(); }));
      modal.querySelectorAll(".wiz-card[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.open)));
      const ap = $("#wizApply");
      if (ap) ap.addEventListener("click", () => {
        state.only = new Set(res.map((r) => r.f.id)); state.onlyLabel = `용도: ${u.label}`; state.rank = new Map(res.map((r, i) => [r.f.id, i]));
        state.recNote = `필수 조건(${u.lic.map((k) => LICENSE_CATS.find((c) => c.key === k).label).join("·")} 사용 가능${wiz.need.size ? ", " + [...wiz.need].map((n) => WIZARD_NEEDS.find((x) => x.id === n).label).join(", ") : ""})을 충족한 ${res.length}종을 '${u.label}'${wiz.mood.size ? "·" + [...wiz.mood].join("·") : ""}에 가까운 순으로 보여드려요. 분위기는 거르는 조건이 아니라 순위에만 반영됩니다.`;
        state.useLic = u.lic; setSort("rec"); ev("wiz_apply", u.id);
        state.ctx = u.ctx; setText(u.text);
        $$("[data-ctx]").forEach((x) => x.classList.toggle("on", x.dataset.ctx === u.ctx));
        $$("[data-alt]").forEach((x) => x.classList.remove("on"));
        closeModal(); setView("ctx");
        window.scrollTo({ top: $(".deck").offsetTop - 56, behavior: "smooth" });
      });
    };
    draw(); overlay.classList.add("open");
  }
  $("#wizBtn")?.addEventListener("click", openWizard);
  $("#wizSide")?.addEventListener("click", openWizard);

  // ---------- 히어로: 최근 출시 폰트 스포트라이트 (한 장에 한 폰트) ----------
  // 기준: 원 제작사의 출시·배포일(released, 출처 있는 날짜만). 이번 주(월~오늘) 출시분, 없으면 최근 출시 12종.
  // 디자인 규칙: 분류 → 레이아웃(포스터·지면·노트·그리드), 분위기 → 단색 배색. 움직임: 굵기 순환·타자 효과·이름 띠.
  const SPOT_PAL = {
    "강렬한": ["#111111", "#f4f1e8", "#d8ff4a"], "세련된": ["#16171b", "#f2f2ee", "#c9b98a"], "발랄한": ["#ffe14d", "#1b1b1b", "#ff5a36"],
    "귀여운": ["#ffd6e0", "#3a1a26", "#ff4f8b"], "따뜻한": ["#f6e3cf", "#3a2414", "#d9632b"], "차분한": ["#dfe7f1", "#14213d", "#2f6db5"],
    "단정한": ["#f4f4f1", "#15151a", "#2f6db5"], "고전적": ["#f1eadb", "#2a2015", "#8b2e1f"],
  };
  // 브랜드 테마: 제작사 공식 소개 페이지의 색·표현을 따른 폰트별 히어로(사람이 확인 후 등록). 없으면 분위기 팔레트
  // split: 제목 앞부분 글자 수만큼 강조색 · style: sticker(흰 외곽선 스티커) | plain
  const BRAND = {
    "k-gs-hyejaroun": { bg: "#b4e3fa", fg: "#0b2c8a", ac: "#1769f0", acInk: "#ffffff", split: 2, style: "sticker", line: ["어제의 혜자보다 오늘 더 혜자롭게", "혜자로운 이야기"], src: "hyejaroun.com" },
  };
  // 우선순위: 관리자 저장(서버 /api/brand, off면 끔) > 위 기본 등록 > 자동 추출 추천색(data/brand_auto.json, 확인 전에도 게시) > 분위기 팔레트
  let BRAND_AUTO = {}, BRAND_ADMIN = {};
  const themeOf = (f) => {
    const a = BRAND_ADMIN[f.id]; if (a) return a.off ? null : a;
    if (BRAND[f.id]) return BRAND[f.id];
    const s = BRAND_AUTO[f.id]; return s && s.bg ? { ...s, style: "plain" } : null;
  };
  const SPOT_LAYOUT = { "디스플레이": "poster", "명조": "editorial", "손글씨": "note", "고딕": "grid" };
  const SPOT_LINES = {
    poster: ["이걸 몰랐다고?", "오늘의 한 줄, 크게"], editorial: ["책을 읽는 시간은 언제나 옳다", "고요한 문장 사이로 계절이 지나간다"],
    note: ["오늘도 수고했어, 내일은 더 괜찮을 거야", "마음을 담아 꾹꾹 눌러 쓴 한 줄"], grid: ["정보는 또렷하게, 화면은 가볍게", "설정이 저장되었습니다"],
  };
  let spotTimer = null, spotTick = null, spotWt = null, spotIdx = 0, spotList = [], spotPaused = false;
  const WNAME = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };
  // 세로획 두께: 'ㅣ'를 200px로 그려 잉크가 칠해진 가로 폭을 잰다(브라우저 측정, 글자 크기 대비 %)
  const stemCache = {};
  async function stemOf(fam, w) {
    const k = fam + "|" + w; if (k in stemCache) return stemCache[k];
    try { await document.fonts.load(`${w} 200px ${fam}`, "ㅣ"); } catch (e) {}
    const c = document.createElement("canvas"); c.width = 260; c.height = 260; const x = c.getContext("2d", { willReadFrequently: true });
    x.font = `${w} 200px ${fam}`; x.textBaseline = "top"; x.fillText("ㅣ", 30, 20);
    const d = x.getImageData(0, 0, 260, 260).data; let best = 0;
    for (const y of [90, 110, 130, 150]) { let run = 0; for (let i = 0; i < 260; i++) { if (d[(y * 260 + i) * 4 + 3] > 128) { run++; best = Math.max(best, run); } else run = 0; } }
    return (stemCache[k] = best ? (best / 200) * 100 : null);
  }
  function spotHTML(f, k, week) {
    const lay = SPOT_LAYOUT[f.category] || "grid";
    const B = themeOf(f);
    const [bg, fg, ac] = B ? [B.bg, B.fg, B.ac] : SPOT_PAL[(f.mood || []).find((m) => SPOT_PAL[m])] || SPOT_PAL["단정한"];
    const dl = dlFor(f); const L = LICENSE_CATS.filter((c) => c.key !== "ofl");
    const heavy = f.weights[f.weights.length - 1];
    const nm = [...f.name];
    const title = f.intro
      ? (f.specimen ? `<img class="sp-spec" src="${f.specimen}" alt="${esc(f.name)} 견본">` : `<span class="sp-noprev">${esc(f.name)}</span>`)
      : B && B.split ? `<span class="sp-ac">${esc(nm.slice(0, B.split).join(""))}</span>${esc(nm.slice(B.split).join(""))}` : esc(f.name);
    const line = B && B.line ? B.line[k % B.line.length] : SPOT_LINES[lay][k % 2];
    return `<article class="sp sp-${lay}${B ? " sp-brand sp-st-" + (B.style || "plain") : ""}${k === 0 ? " on" : ""}" data-id="${f.id}" data-k="${k}" style="--bg:${bg};--fg:${fg};--ac:${ac}${B && B.acInk ? ";--ac-ink:" + B.acInk : ""}" aria-roledescription="slide" aria-label="${k + 1} / ${spotList.length}: ${esc(f.name)}">
      ${lay === "poster" && !f.intro ? `<div class="sp-marquee" aria-hidden="true" style="font-family:${f.family};font-weight:${heavy}"><span>${esc((f.name + " · ").repeat(8))}</span><span>${esc((f.name + " · ").repeat(8))}</span></div>` : ""}
      <div class="wrap sp-in">
        <div class="sp-main">
          <div class="sp-kick">${week ? '<b class="sp-new">NEW</b>' : ""}${fmtRel(f.released)} 출시 · <span title="출처: ${esc(f.releasedSrc)}">${esc(f.releasedSrc.replace(/\(.*\)/, ""))}</span></div>
          <h2 class="sp-title" style="${f.intro ? "" : `font-family:${f.family};font-weight:${heavy}`}" >${title}</h2>
          <p class="sp-type" style="${f.intro ? "" : `font-family:${f.family}`}" data-line="${esc(f.intro ? f.desc : line)}"></p>
          <div class="sp-cta">
            <button class="sp-btn" data-open="${f.id}">자세히 보기</button>
            ${dl.ok ? `<a class="sp-btn ac" data-dl="zip" data-fid="${f.id}" href="${esc(dl.zip)}" target="_blank" rel="noopener">⬇ 다운로드</a>` : `<a class="sp-btn ac" data-dl="page" data-fid="${f.id}" href="${esc(dl.page)}" target="_blank" rel="noopener">받기 ↗</a>`}
            ${f.intro ? '<span class="sp-chip">소개 전용 · 미리보기 미제공</span>' : ""}
          </div>
        </div>
        <aside class="sp-side">
          ${!f.intro && f.weights.length > 1 ? `<div class="sp-wt" style="--fam:${esc(f.family).replace(/&#39;/g, "'")}">
            <div class="sp-loupe" aria-hidden="true">${f.weights.map((w, j) => `<span class="${j === 0 ? "on" : ""}" style="font-family:${f.family};font-weight:${w}">가</span>`).join("")}</div>
            <div class="sp-wt-info"><div class="sp-wt-name"><b>${WNAME[f.weights[0]] || f.weights[0]}</b> <span>${f.weights[0]}</span></div>
              <div class="sp-wt-stem">세로획 두께 <b>—</b></div>
              <div class="sp-scale">${f.weights.map((w, j) => `<i style="left:${f.weights.length > 1 ? (j / (f.weights.length - 1)) * 100 : 0}%"><em>${w}</em></i>`).join("")}<u></u></div></div>
          </div>` : ""}
          <dl>
            <dt>제작·배포</dt><dd>${esc(f.designer)}</dd>
            <dt>굵기</dt><dd>${f.weightsUnknown ? "배포처 확인" : `${f.weights.length}종 · ${f.weights.map((w) => WNAME[w] || w).join(", ")}`}</dd>
            <dt>글자</dt><dd>${esc(f.glyphs)}</dd>
            <dt>라이선스</dt><dd>${esc(licInfo(f).short)}</dd>
          </dl>
          <div class="sp-lic">${L.map((c) => `<span class="${f.matrix[c.key]}">${c.label}${licIc(f.matrix[c.key])}</span>`).join("")}</div>
          <div class="sp-tags">${f.mood.map((m) => `#${esc(m)}`).join(" ")} · #${esc(f.category)}</div>
        </aside>
      </div>
    </article>`;
  }
  function spotPlay(el) {
    clearInterval(spotTick);
    const p = el.querySelector(".sp-type");
    // 타자 효과
    const s = p.dataset.line || ""; let n = 0; p.textContent = "";
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) p.textContent = s;
    spotTick = setInterval(() => { if (!reduce && n <= s.length) p.textContent = s.slice(0, n++); else clearInterval(spotTick); }, 75);
    // 굵기 돋보기: 2.8초마다 다음 굵기로 천천히 겹쳐 바꾸고, 눈금자 표시를 부드럽게 옮긴다
    clearInterval(spotWt);
    const wt = el.querySelector(".sp-wt"); if (!wt) return;
    const f = FONTS.find((x) => x.id === el.dataset.id); const layers = wt.querySelectorAll(".sp-loupe span");
    const fam = f.family.split(",")[0];
    let j = 0;
    const show = async (k) => {
      j = k; const w = f.weights[k];
      layers.forEach((l, q) => l.classList.toggle("on", q === k));
      wt.querySelector(".sp-wt-name").innerHTML = `<b>${WNAME[w] || w}</b> <span>${w}</span>`;
      wt.querySelectorAll(".sp-scale i").forEach((t, q) => t.classList.toggle("on", q === k));
      wt.querySelector(".sp-scale u").style.left = (f.weights.length > 1 ? (k / (f.weights.length - 1)) * 100 : 0) + "%";
      const st = await stemOf(fam, w); if (j === k) wt.querySelector(".sp-wt-stem b").textContent = st ? `${st.toFixed(1)}%` : "—";
    };
    show(0);
    if (!reduce) spotWt = setInterval(() => show((j + 1) % f.weights.length), 2800);
  }
  function spotGo(i, user) {
    const els = $$("#nbTrack .sp"); if (!els.length) return;
    spotIdx = (i + els.length) % els.length;
    els.forEach((el, k) => { el.classList.toggle("on", k === spotIdx); el.setAttribute("aria-hidden", k === spotIdx ? "false" : "true"); });
    const cur = els[spotIdx]; ensureFace(FONTS.find((x) => x.id === cur.dataset.id), true); ensureFace(FONTS.find((x) => x.id === (els[(spotIdx + 1) % els.length] || cur).dataset.id));
    $("#spotCount").textContent = `${spotIdx + 1} / ${els.length}`;
    const spot = $("#spot"); spot.style.setProperty("--spot-ui", cur.style.getPropertyValue("--fg")); spot.style.setProperty("--spot-bg", cur.style.getPropertyValue("--bg"));
    $$("#spotBars i").forEach((b, k) => { b.className = k < spotIdx ? "done" : k === spotIdx ? "run" : ""; });
    spotPlay(cur);
    clearTimeout(spotTimer); if (!spotPaused) spotTimer = setTimeout(() => spotGo(spotIdx + 1), 7000);
    if (user) { const bar = $$("#spotBars i")[spotIdx]; if (bar) { bar.className = ""; void bar.offsetWidth; bar.className = spotPaused ? "hold" : "run"; } }
  }
  function renderNew() {
    const track = $("#nbTrack"); if (!track) return;
    const now = new Date(); const day = (now.getDay() + 6) % 7; // 월=0
    const mon = new Date(now); mon.setDate(now.getDate() - day); mon.setHours(0, 0, 0, 0);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dot = (s) => s.replace(/-/g, ".");
    const dated = FONTS.filter((f) => f.released).sort((a, b) => b.released.localeCompare(a.released) || b.pop - a.pop);
    const weekAll = dated.filter((f) => f.released >= iso(mon) && f.released <= iso(now));
    const week = weekAll.length > 0;
    spotList = (week ? weekAll : dated).slice(0, 12);
    if (!spotList.length) { $(".newband").style.display = "none"; return; }
    $("#nbLabel").textContent = week ? `이번 주 출시 ${weekAll.length}종` : "최근 출시";
    $("#nbTitle").textContent = week ? `이번 주 출시된 한글 무료 폰트 ${weekAll.length}종` : "가장 최근 출시된 한글 무료 폰트";
    $("#nbMeta").textContent = (week ? `${dot(iso(mon))} 주간` : `이번 주 출시 없음 · 최신 출시 ${dot(dated[0].released)}`) + " · 원 제작사 출시·배포일 기준";
    track.innerHTML = spotList.map((f, k) => spotHTML(f, k, week)).join("");
    $("#spotBars").innerHTML = spotList.map(() => "<i></i>").join("");
    track.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.open)));
    const spot = $("#spot");
    const pause = (on) => { spotPaused = on; spot.classList.toggle("paused", on); $("#spotPause").textContent = on ? "▶" : "❚❚"; $("#spotPause").setAttribute("aria-label", on ? "자동 넘김 재생" : "자동 넘김 멈춤"); if (on) clearTimeout(spotTimer); else spotGo(spotIdx, true); };
    let hoverPause = false;
    spot.addEventListener("mouseenter", () => { if (!spotPaused) { hoverPause = true; pause(true); } });
    spot.addEventListener("mouseleave", () => { if (hoverPause) { hoverPause = false; pause(false); } });
    $("#spotPause").addEventListener("click", () => { hoverPause = false; pause(!spotPaused); });
    $("#nbPrev").addEventListener("click", () => spotGo(spotIdx - 1, true));
    $("#nbNext").addEventListener("click", () => spotGo(spotIdx + 1, true));
    spot.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") spotGo(spotIdx - 1, true); if (e.key === "ArrowRight") spotGo(spotIdx + 1, true); });
    let x0 = null; // 휴대폰: 좌우로 밀어 넘기기
    track.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) spotGo(spotIdx + (dx < 0 ? 1 : -1), true); x0 = null; });
    document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimeout(spotTimer); else if (!spotPaused) spotGo(spotIdx); });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) pause(true);
    spotGo(0);
  }

  // ---------- 내 프로젝트 (로그인 없이 이 브라우저에 저장 · 파일/링크로 옮기기) ----------
  // 프로젝트 = 이름 + 폰트들(선택 이유 메모 + 담을 때의 사용 조건 스냅숏) + 미리보기 문장.
  // 스냅숏과 지금 데이터를 비교해 라이선스·사용 범위가 바뀌면 '조건 바뀜'으로 알려 준다(즐겨찾기도 같은 방식).
  const LCAT = LICENSE_CATS.map((c) => c.key);
  const snap = (f) => ({ lic: f.license, m: LCAT.map((k) => f.matrix[k]).join(","), st: f.status, v: f.verified });
  const MT = { ok: "가능", no: "불가", cond: "조건부" };
  function diffSnap(f, o) {
    if (!o) return [];
    const d = []; const om = String(o.m || "").split(",");
    if (o.lic !== f.license) d.push(`라이선스 ${o.lic} → ${f.license}`);
    LCAT.forEach((k, i) => { if (om[i] && om[i] !== f.matrix[k]) d.push(`${LICENSE_CATS[i].label} ${MT[om[i]] || om[i]} → ${MT[f.matrix[k]]}`); });
    if (o.st !== f.status) d.push(f.status === "verified" ? "원문 대조 완료됨" : "다시 확인 중으로 바뀜");
    return d;
  }
  const PK = "ls_projects";
  let projects = LS(PK, []);
  const saveProjects = () => save(PK, projects);
  const newProject = (name) => { const p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: name || `새 폴더 ${projects.length + 1}`, created: Date.now(), updated: Date.now(), text: state.text, items: [] }; projects.unshift(p); saveProjects(); return p; };
  function addToProject(p, ids) {
    let n = 0;
    ids.forEach((id) => { const f = FONTS.find((x) => x.id === id); if (!f || p.items.some((x) => x.id === id)) return; p.items.push({ id, note: "", added: Date.now(), snap: snap(f) }); n++; });
    p.updated = Date.now(); if (!p.text) p.text = state.text; saveProjects(); if (n) ev("proj_add"); updateProjBtn(); return n;
  }
  const changedIn = (p) => p.items.filter((it) => { const f = FONTS.find((x) => x.id === it.id); return f && diffSnap(f, it.snap).length; }).length;
  function updateProjBtn() { const b = $("#projBtn"); if (!b) return; const ch = projects.reduce((a, p) => a + changedIn(p), 0); b.innerHTML = `폰트 보관함${projects.length ? ` <small>${projects.length}</small>` : ""}${ch ? ` <em title="사용 조건이 바뀐 폰트">${ch}</em>` : ""}`; }
  // 링크 공유: 이름·폰트·메모·문장만 주소에 담는다(서버 저장 없음)
  const b64u = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = (str) => new TextDecoder().decode(Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
  const shareUrl = (p) => `${location.origin}${location.pathname}#p=${b64u(JSON.stringify({ n: p.name, t: p.text || "", i: p.items.map((x) => [x.id, x.note || ""]) }))}`;
  // 보관함을 처음 열었을 때(폴더 없음) 무엇을 하는 곳인지 보여 주는 안내
  const PJ_INTRO = `<div class="pj-intro">
      <p class="pj-lead">작업 이름으로 폴더를 만들고, 쓸 폰트를 모아 두세요. 로그인 없이 이 브라우저에 저장됩니다.</p>
      <ol class="pj-flow">
        <li><b>1</b><strong>폴더 만들기</strong><span>아래 '첫 폴더 만들기'에 작업 이름 입력</span></li>
        <li><b>2</b><strong>폰트 담기</strong><span>폰트 상세의 '＋ 보관함에 담기'</span></li>
        <li><b>3</b><strong>확인·공유</strong><span>확인 기록 저장, 링크로 공유</span></li>
      </ol>
      <p class="pj-sub">이런 게 편해져요</p>
      <div class="pj-cards">
        <div><b>🔔 조건 바뀜 알림</b><span>담아 둔 폰트의 라이선스·사용 범위가 바뀌면 헤더의 '폰트 보관함'에 표시해 드려요.</span></div>
        <div><b>📄 확인 기록 한 번에</b><span>폴더 속 폰트들의 사용 조건 확인 기록을 문서로 저장해 클라이언트·회사에 근거로 낼 수 있어요.</span></div>
        <div><b>🔗 링크로 공유</b><span>폰트 목록과 고른 이유를 링크 하나로 동료에게 넘기고, 받은 쪽은 바로 가져와요.</span></div>
      </div>
    </div>`;
  function openProjects(opt) {
    opt = opt || {};
    modal.className = "modal proj";
    const addIds = opt.addIds || null;
    const chips = (p) => p.items.slice(0, 4).map((it) => { const f = FONTS.find((x) => x.id === it.id); return f ? `<i style="font-family:${f.family}">${esc(f.name)}</i>` : ""; }).join("") + (p.items.length > 4 ? `<i class="more">+${p.items.length - 4}</i>` : "");
    const list = () => `
      <button class="x" id="mx" aria-label="닫기">×</button>
      <div class="m-head"><h2>폰트 보관함</h2><span class="en">작업별 폴더로 폰트 모으기 · 이 브라우저에 저장</span></div>
      ${addIds ? `<div class="pj-adding"><span>담을 폰트</span><div>${addIds.map((id) => { const f = FONTS.find((x) => x.id === id); return f ? `<b style="font-family:${f.family}">${esc(f.name)}</b>` : ""; }).join("")}</div><p>어느 폴더에 담을까요? 폴더를 누르거나 새로 만드세요.</p></div>` : ""}
      ${!projects.length && !addIds ? PJ_INTRO : ""}
      <div class="pj-grid">
        <form class="pj-card pj-newcard" id="pjNew">
          <span class="pj-plus" aria-hidden="true">＋</span>
          <label for="pjNewName">${projects.length ? "새 폴더" : "첫 폴더 만들기"}</label>
          <input id="pjNewName" name="n" maxlength="40" placeholder="작업 이름 (예: 2027 국어 교재)" autocomplete="off">
          <button class="btn sm" type="submit">${addIds ? "만들고 담기" : "만들기"}</button>
        </form>
        ${projects.map((p) => { const ch = changedIn(p); return `<button class="pj-card${addIds ? " pick" : ""}" ${addIds ? `data-pjadd="${p.id}"` : `data-pjopen="${p.id}"`}>
          <span class="pj-ico" aria-hidden="true">📁</span>
          <b class="pj-t">${esc(p.name)}</b>
          <span class="pj-m">${p.items.length}종 · ${new Date(p.updated).toLocaleDateString("ko-KR")}</span>
          ${ch ? `<span class="pj-alert">조건 바뀜 ${ch}</span>` : ""}
          <span class="pj-chips">${chips(p) || '<i class="more">비어 있음</i>'}</span>
          ${addIds ? '<span class="pj-go">여기에 담기 →</span>' : '<span class="pj-go">열기 →</span>'}
        </button>`; }).join("")}
      </div>
      <div class="pj-io"><label class="linklike">📂 파일에서 가져오기<input type="file" id="pjImport" accept="application/json,.json" hidden></label>
        <span class="note">보관함은 이 브라우저에 저장돼 방문 기록을 지우면 사라집니다. 중요하면 폴더 안의 '파일로 내보내기'로 보관하세요.</span></div>`;
    const draw = () => {
      modal.innerHTML = list(); $("#mx").addEventListener("click", closeModal);
      $("#pjNew").addEventListener("submit", (e) => { e.preventDefault(); const p = newProject(String(new FormData(e.target).get("n") || "").trim()); if (addIds) addToProject(p, addIds); openProject(p.id); });
      modal.querySelectorAll("[data-pjopen]").forEach((b) => b.addEventListener("click", () => openProject(b.dataset.pjopen)));
      modal.querySelectorAll("[data-pjadd]").forEach((b) => b.addEventListener("click", () => { const p = projects.find((x) => x.id === b.dataset.pjadd); addToProject(p, addIds); openProject(p.id); }));
      $("#pjImport").addEventListener("change", async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const j = JSON.parse(await file.text()); const arr = Array.isArray(j.projects) ? j.projects : [j];
          arr.forEach((q) => { if (!q || !Array.isArray(q.items)) return; const p = newProject(String(q.name || "가져온 폴더").slice(0, 40)); p.text = String(q.text || "").slice(0, 80); p.items = q.items.filter((x) => x && FONTS.some((f) => f.id === x.id)).map((x) => ({ id: x.id, note: String(x.note || "").slice(0, 300), added: x.added || Date.now(), snap: x.snap && typeof x.snap === "object" ? x.snap : null })); });
          saveProjects(); updateProjBtn(); draw();
        } catch (x) { alert("LETSUM 보관함 파일이 아닙니다."); }
      });
    };
    draw(); overlay.classList.add("open");
  }
  function openProject(pid) {
    const p = projects.find((x) => x.id === pid); if (!p) return openProjects();
    modal.className = "modal proj wide";
    const nChg = p.items.filter((it) => { const f = FONTS.find((x) => x.id === it.id); return f && diffSnap(f, it.snap).length; }).length;
    const rows = p.items.map((it, k) => {
      const f = FONTS.find((x) => x.id === it.id); if (!f) return "";
      const d = diffSnap(f, it.snap);
      return `<div class="pj-item${d.length ? " chg" : ""}">
        <div class="pj-i-font"><button class="linklike pj-fname" data-open="${f.id}" style="font-family:${f.family}">${esc(f.name)}</button><span class="note">${esc(f.category)} · ${esc(f.designer)}</span></div>
        <div class="pj-i-lic"><span class="pj-lic">${esc(licInfo(f).short)}</span><span class="note">${stText(f)} · ${f.verified} 확인</span>
          ${d.length ? `<div class="pj-chg"><b>조건 바뀜</b> ${esc(d.join(" · "))} <button class="linklike" data-ack="${k}">확인했어요</button></div>` : ""}</div>
        <label class="pj-i-note"><span>고른 이유</span><textarea data-note="${k}" maxlength="300" rows="2" placeholder="예: 본문 12pt 가독성 좋음, 인쇄 OK">${esc(it.note || "")}</textarea></label>
        <button class="pj-rmv" data-rmv="${k}" aria-label="${esc(f.name)} 빼기" title="폴더에서 빼기">빼기</button>
      </div>`;
    }).join("");
    const dis = p.items.length ? "" : " disabled";
    modal.innerHTML = `
      <button class="x" id="mx" aria-label="닫기">×</button>
      <button class="linklike pj-back" id="pjBack">← 폰트 보관함</button>
      <div class="m-head pj-head"><span class="pj-ico" aria-hidden="true">📁</span><input class="pj-name" id="pjName" value="${esc(p.name)}" maxlength="40" aria-label="폴더 이름" title="눌러서 이름 바꾸기"><span class="en">${p.items.length}종 · 만든 날 ${new Date(p.created).toLocaleDateString("ko-KR")}</span></div>
      <div class="pj-tools">
        <button class="pj-tool" id="pjCmp"${dis}><b>⇆ 나란히 비교</b><span>최대 4종을 비교 창에서</span></button>
        <button class="pj-tool" id="pjProof"${dis}><b>📄 확인 기록 저장</b><span>사용 조건 확인 문서(txt)</span></button>
        <button class="pj-tool" id="pjShare"${dis}><b>🔗 링크 복사</b><span>동료에게 목록·이유 공유</span></button>
        <button class="pj-tool" id="pjExport"><b>⬇ 파일로 내보내기</b><span>백업·다른 컴퓨터로</span></button>
      </div>
      ${nChg ? `<p class="pj-banner">⚠ 담은 뒤 사용 조건이 바뀐 폰트가 <b>${nChg}종</b> 있습니다. 아래 표시를 확인하세요.</p>` : ""}
      ${p.text ? `<p class="note">이 폴더의 미리보기 문장: “${esc(p.text)}” <button class="linklike" id="pjUseText">이 문장으로 보기</button></p>` : ""}
      ${p.items.length ? `<div class="pj-items">${rows}</div>` : `<div class="pj-empty"><b>아직 담은 폰트가 없어요</b><p>폰트 상세에서 <b>＋ 보관함에 담기</b>, 또는 비교함에서 <b>보관함에 저장</b>을 누르면 이 폴더에 들어옵니다.</p><button class="btn sm" id="pjBrowse">폰트 둘러보기</button></div>`}
      <div class="pj-foot"><p class="disclaimer">‘조건 바뀜’은 폰트를 담을 때 LETSUM에 표시돼 있던 사용 조건과 지금을 비교한 결과입니다. 최종 판단은 라이선스 원문으로 하세요.</p><button class="linklike pj-del" id="pjDel">폴더 삭제</button></div>`;
    overlay.classList.add("open");
    const touch = () => { p.updated = Date.now(); saveProjects(); };
    $("#mx").addEventListener("click", closeModal);
    $("#pjBack").addEventListener("click", () => openProjects());
    $("#pjName").addEventListener("change", (e) => { p.name = e.target.value.trim() || p.name; touch(); });
    modal.querySelectorAll("[data-note]").forEach((t) => t.addEventListener("input", () => { p.items[+t.dataset.note].note = t.value; touch(); }));
    modal.querySelectorAll("[data-rmv]").forEach((b) => b.addEventListener("click", () => { p.items.splice(+b.dataset.rmv, 1); touch(); updateProjBtn(); openProject(pid); }));
    modal.querySelectorAll("[data-ack]").forEach((b) => b.addEventListener("click", () => { const it = p.items[+b.dataset.ack]; it.snap = snap(FONTS.find((x) => x.id === it.id)); touch(); updateProjBtn(); openProject(pid); }));
    modal.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.open)));
    $("#pjUseText")?.addEventListener("click", () => { setText(p.text); closeModal(); });
    $("#pjBrowse")?.addEventListener("click", closeModal);
    $("#pjCmp").addEventListener("click", () => { cmp.clear(); p.items.slice(0, 4).forEach((x) => cmp.add(x.id)); if (p.text) setText(p.text); renderTray(); render(); openCompare(); });
    $("#pjProof").addEventListener("click", async () => {
      const E = await evidenceLoad(); const now = new Date();
      const body = p.items.flatMap((it, k) => { const f = FONTS.find((x) => x.id === it.id); if (!f) return []; return ["", `[${k + 1}] ` + "-".repeat(26), ...proofLines(f, dlFor(f), E[f.id] || {}, it.note)]; });
      downloadText(`LETSUM_사용조건확인기록_${p.name}_${ymdOf(now)}.txt`, ["LETSUM 사용 조건 확인 기록 — 폰트 보관함", "=".repeat(28), `폴더: ${p.name}`, `폰트 ${p.items.length}종${p.text ? ` · 미리보기 문장: ${p.text}` : ""}`, ...body, ...PROOF_TAIL(now)]);
      ev("record", "project");
    });
    $("#pjShare").addEventListener("click", async (e) => { const u = shareUrl(p); ev("proj_share"); try { await navigator.clipboard.writeText(u); const t = e.currentTarget.querySelector("b"); t.textContent = "✓ 복사됨"; setTimeout(() => (t.textContent = "🔗 링크 복사"), 1500); } catch (x) { prompt("이 링크를 복사하세요", u); } });
    $("#pjExport").addEventListener("click", () => { ev("proj_export"); const blob = new Blob([JSON.stringify({ letsum: 1, projects: [p] }, null, 1)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `LETSUM_보관함_${p.name}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
    $("#pjDel").addEventListener("click", () => { if (!confirm(`'${p.name}' 폴더를 삭제할까요? 되돌릴 수 없습니다.`)) return; projects = projects.filter((x) => x.id !== pid); saveProjects(); updateProjBtn(); openProjects(); });
  }
  // 공유 링크(#p=...)로 들어오면 미리 보고 가져오기
  function openSharedFromHash() {
    const m = location.hash.match(/^#p=([\w-]+)/); if (!m) return;
    let j; try { j = JSON.parse(unb64u(m[1])); } catch (e) { return; }
    const ids = (Array.isArray(j.i) ? j.i : []).filter((x) => Array.isArray(x) && FONTS.some((f) => f.id === x[0])).slice(0, 60);
    modal.className = "modal proj";
    modal.innerHTML = `<button class="x" id="mx" aria-label="닫기">×</button>
      <div class="m-head"><h2>공유받은 폰트 모음</h2><span class="en">${esc(String(j.n || "").slice(0, 40))}</span></div>
      <ul class="pj-shared">${ids.map(([id, note]) => { const f = FONTS.find((x) => x.id === id); return `<li><b style="font-family:${f.family}">${esc(f.name)}</b> <span class="note">${esc(licInfo(f).short)}</span>${note ? `<div class="note">메모: ${esc(String(note).slice(0, 300))}</div>` : ""}</li>`; }).join("")}</ul>
      <div class="pj-acts"><button class="btn sm" id="pjTake">내 보관함으로 가져오기</button><button class="btn sm ghost" id="pjPeek">비교로 보기</button></div>`;
    overlay.classList.add("open");
    $("#mx").addEventListener("click", closeModal);
    $("#pjTake").addEventListener("click", () => { const p = newProject(String(j.n || "공유받은 모음").slice(0, 40)); p.text = String(j.t || "").slice(0, 80); addToProject(p, ids.map((x) => x[0])); ids.forEach(([id, note]) => { const it = p.items.find((x) => x.id === id); if (it) it.note = String(note || "").slice(0, 300); }); saveProjects(); try { history.replaceState(null, "", location.pathname); } catch (e) {} openProject(p.id); });
    $("#pjPeek").addEventListener("click", () => { cmp.clear(); ids.slice(0, 4).forEach(([id]) => cmp.add(id)); if (j.t) setText(String(j.t).slice(0, 80)); renderTray(); render(); openCompare(); });
  }
  // 즐겨찾기: 담을 때의 조건을 기억해 두고, 재방문 때 바뀐 폰트를 알린다
  const FK = "ls_favsnap"; const favSnap = LS(FK, {});
  favs.forEach((id) => { const f = FONTS.find((x) => x.id === id); if (f && !favSnap[id]) favSnap[id] = snap(f); }); save(FK, favSnap);
  function checkFavChanges() {
    const ch = [...favs].map((id) => FONTS.find((x) => x.id === id)).filter((f) => f && diffSnap(f, favSnap[f.id]).length);
    const bar = $("#chgBar"); if (!bar) return;
    if (!ch.length) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = `<div class="wrap"><b>즐겨찾기한 폰트 중 ${ch.length}종의 사용 조건이 바뀌었어요.</b> ${ch.map((f) => `<button class="linklike" data-open="${f.id}">${esc(f.name)}</button> <span class="note">(${esc(diffSnap(f, favSnap[f.id]).join(" · "))})</span>`).join(" · ")} <button class="btn sm ghost" id="chgAck">모두 확인함</button></div>`;
    bar.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.open)));
    $("#chgAck").addEventListener("click", () => { ch.forEach((f) => (favSnap[f.id] = snap(f))); save(FK, favSnap); checkFavChanges(); });
  }
  $("#projBtn")?.addEventListener("click", () => openProjects());
  $("#trayProj")?.addEventListener("click", () => cmp.size && openProjects({ addIds: [...cmp] }));
  updateProjBtn();

  // ---------- 시작 ----------
  // 브랜드 테마를 먼저 받아(최대 0.8초) 히어로를 그린다 — 늦거나 실패하면 기본 색으로
  const getJSON = (u) => fetch(u, { cache: "no-cache" }).then((r) => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : {})).catch(() => ({}));
  const brandLoad = Promise.all([getJSON("data/brand_auto.json"), getJSON("/api/brand")]).then(([a, b]) => { BRAND_AUTO = a || {}; BRAND_ADMIN = b || {}; });
  Promise.race([brandLoad, new Promise((r) => setTimeout(r, 800))]).then(renderNew);
  render();
  renderTray();
  openFromHash(); openSharedFromHash(); checkFavChanges();
  detectAll().then(() => { render(); runCoverage(); });
})();
