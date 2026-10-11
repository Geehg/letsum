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
  const declared = new Set();
  const faceSheet = document.createElement("style"); document.head.appendChild(faceSheet);
  function ensureFace(f) {
    if (!f || !f.webfont || declared.has(f.id)) return;
    declared.add(f.id);
    const fam = f.family.split(",")[0].replace(/['"]/g, "").trim();
    faceSheet.textContent += Object.entries(f.webfont).map(([w, url]) =>
      `@font-face{font-family:"${fam}";src:url("${url}") format("woff2");font-weight:${w};font-display:swap}`).join("\n") + "\n";
  }
  const faceObs = "IntersectionObserver" in window ? new IntersectionObserver((ents) => ents.forEach((e) => {
    if (!e.isIntersecting) return;
    ensureFace(FONTS.find((x) => x.id === e.target.dataset.id)); faceObs.unobserve(e.target);
  }), { rootMargin: "600px 0px" }) : null;
  function observeFaces(root) {
    (root || document).querySelectorAll("[data-id]").forEach((el) => {
      const f = FONTS.find((x) => x.id === el.dataset.id);
      if (!f || !f.webfont || declared.has(f.id)) return;
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
    FONTS.filter((f) => f.webfont).forEach((f) => { detect[f.id] = { old: !!f.old, hanja: !!f.hanja }; });
  }
  // LETSUM 웹폰트의 형태 측정은 상세를 열 때(파일을 받은 뒤) 한다
  async function measureLazy(f) {
    if (!f.webfont || metrics[f.id]) return;
    ensureFace(f);
    const fam = f.family.split(",")[0].replace(/['"]/g, "").trim();
    await document.fonts.load(`400 48px "${fam}"`, "가나다ㅣㅡ").catch(() => {});
    metrics[f.id] = measure(fam);
  }

  // ---------- 글자 형태 측정 → 닮은 폰트 (AI 없이, 브라우저 캔버스 측정만으로) ----------
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
  function similar(f, k) {
    const m = metrics[f.id]; if (!m) return [];
    const all = FONTS.filter((x) => x.id !== f.id && metrics[x.id]);
    const rng = (key) => { const vs = all.map((x) => metrics[x.id][key]).concat(m[key]); return Math.max(...vs) - Math.min(...vs) || 1; };
    const rd = rng("density"), rw = rng("width"), rc = rng("contrast");
    return all.map((x) => {
      const n = metrics[x.id];
      let d = Math.hypot((n.density - m.density) / rd, (n.width - m.width) / rw, (n.contrast - m.contrast) / rc);
      if (x.category !== f.category) d += 0.35; // 분류가 다르면 거리 가산
      return [x, d];
    }).sort((a, b) => a[1] - b[1]).slice(0, k).map(([x]) => x);
  }
  let covTimer = null;
  function scheduleCoverage() { clearTimeout(covTimer); covTimer = setTimeout(runCoverage, 350); }
  async function runCoverage() {
    const chars = [...new Set([...state.text])].filter(isCJK).slice(0, 80);
    if (!chars.length) { FONTS.forEach((f) => (coverage[f.id] = [])); $("#coverNote").textContent = ""; render(); return; }
    const txt = chars.join("");
    await fontsCssReady;
    const gf = FONTS.filter(isGF);
    await Promise.all(gf.map((f) => document.fonts.load(`400 44px "${f.en}"`, txt).catch(() => {})));
    gf.forEach((f) => { coverage[f.id] = chars.filter((ch) => !probe(f.en, ch)); });
    // LETSUM 웹폰트: 빌드 때 센 완성형 수·옛한글·한자 정보로 판정 (2,350자 폰트는 KS X 1001 집합 대조)
    FONTS.filter((f) => f.intro).forEach((f) => { coverage[f.id] = []; }); // 소개 전용은 검사 대상 아님
    FONTS.filter((f) => f.webfont).forEach((f) => {
      coverage[f.id] = chars.filter((ch) => {
        if (ch >= "가" && ch <= "힣") return f.cov < 11172 && KSX.size ? !KSX.has(ch) : false;
        if (/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(ch)) return !f.hanja;
        if (/[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/.test(ch)) return !f.old;
        return false;
      });
    });
    const bad = FONTS.filter((f) => coverage[f.id].length).length;
    $("#coverNote").textContent = bad ? `(${bad}종에서 누락 발견)` : "(모두 지원)";
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
  function setText(t, fromInput) {
    state.text = t; if (!fromInput) $("#previewText").value = t;
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
    state.view = v; $$("#viewSeg button").forEach((x) => x.classList.toggle("on", x.dataset.v === v));
    $("#ctxChips").style.display = v === "ctx" ? "flex" : "none";
    document.body.classList.toggle("feed-mode", v === "feed"); state.feedN = 24; render();
  }
  const CTX = [["thumb", "유튜브 썸네일"], ["book", "책 본문"], ["sub", "영상 자막"], ["menu", "카페 메뉴판"], ["card", "카드뉴스"], ["ui", "문서·UI"]];
  $("#ctxChips").innerHTML = CTX.map(([k, l]) => `<button class="tbtn${k === state.ctx ? " on" : ""}" data-ctx="${k}">${l}</button>`).join("");
  $$("[data-ctx]").forEach((b) => b.addEventListener("click", () => { state.ctx = b.dataset.ctx; $$("[data-ctx]").forEach((x) => x.classList.toggle("on", x === b)); render(); }));
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
  $("#coverOnly").addEventListener("change", (e) => { state.coverOnly = e.target.checked; render(); });
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
    state.rank = null;
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
      if (state.cov.has("11172") && f.cov < 11172) return false;
      if (state.cov.has("old") && !(detect[f.id] && detect[f.id].old)) return false;
      if (state.cov.has("hanja") && !(detect[f.id] && detect[f.id].hanja)) return false;
      if (state.cov.has("multi") && f.weights.length < 3) return false;
      if (state.favOnly && !favs.has(f.id)) return false;
      if (state.coverOnly && coverage[f.id] && coverage[f.id].length) return false;
      if (q) {
        if (isChoQuery(q)) { if (!choseong(f.name).includes(q.replace(/ /g, ""))) return false; }
        else { const hay = (f.name + " " + f.en + " " + f.designer + " " + f.tags.join(" ") + " " + f.mood.join(" ")).toLowerCase(); if (!hay.includes(q)) return false; }
      }
      return true;
    });
    const s = state.sort;
    if (state.rank && state.only) return list.sort((a, b) => state.rank.get(a.id) - state.rank.get(b.id)); // 용도 마법사 추천 순
    if (s === "pop") list.sort((a, b) => b.pop - a.pop);
    if (s === "new") list.sort((a, b) => b.added.localeCompare(a.added) || (b.released || "0").localeCompare(a.released || "0") || b.pop - a.pop);
    if (s === "released") list.sort((a, b) => (b.released || "0").localeCompare(a.released || "0") || b.pop - a.pop);
    if (s === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    if (s === "weights") list.sort((a, b) => b.weights.length - a.weights.length || b.pop - a.pop);
    return list;
  }

  // ---------- 렌더 조각 ----------
  const LIC_SHORT = { print: "인쇄", web: "웹", video: "영상", embed: "임베딩", bici: "BI·CI", package: "포장" };
  const pills = (f) => Object.keys(LIC_SHORT).map((k) => `<span class="pill ${f.matrix[k]}">${LIC_SHORT[k]}${f.matrix[k] === "ok" ? " ✓" : f.matrix[k] === "no" ? " ✕" : " △"}</span>`).join("")
    + (f.status === "verified" ? "" : `<span class="pill chk">확인 중</span>`) + (f.intro ? `<span class="pill intro" title="${esc(f.introReason || "")}">소개 전용</span>` : "");
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
  const missPill = (f) => (coverage[f.id] && coverage[f.id].length) ? `<span class="pill miss">누락 ${coverage[f.id].length}자</span>` : "";
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
      case "book": return `<div class="mock book" style="${fs}"><div class="h" style="font-weight:${Math.max(w, 700) in f.weights ? 700 : w}">${t}</div><div class="p" style="font-weight:${w}">${BODY} ${BODY} ${BODY} ${BODY}</div><div class="pg">— 27 —</div></div>`;
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
    const s = social[id] || (social[id] = { likes: 0, comments: 0, liked: false });
    s.likes = Math.max(0, s.likes + (on ? 1 : -1)); s.liked = on;
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
    "명조": (f, t, fam) => `<div class="ig-s fp fp-book" style="font-family:${fam}"><div class="fp-k">제1장</div><div class="fp-t" style="font-weight:${f.weights.includes(700) ? 700 : f.weights[f.weights.length - 1]}">${esc(t)}</div><p style="font-weight:${f.weights.includes(400) ? 400 : f.weights[0]}">${BODY}</p><div class="fp-pg">— 27 —</div><span class="ig-cap2">책 본문 적용안</span></div>`,
    "손글씨": (f, t, fam) => `<div class="ig-s fp fp-note" style="font-family:${fam}"><div class="fp-k">To. 오늘의 나에게</div><div class="fp-t">${esc(t)}</div><div class="fp-sign">— 렛섬 드림</div><span class="ig-cap2">손편지·카드 적용안</span></div>`,
    "고딕": (f, t, fam) => `<div class="ig-s fp fp-ui" style="font-family:${fam}"><div class="fp-win"><div class="fp-bar"><b>알림</b><span>방금</span></div><div class="fp-t" style="font-weight:${f.weights.includes(700) ? 700 : f.weights[f.weights.length - 1]}">${esc(t)}</div><p style="font-weight:${f.weights.includes(400) ? 400 : f.weights[0]}">변경 사항은 다음 로그인부터 적용됩니다. 계정 설정에서 언제든지 되돌릴 수 있습니다.</p><div class="fp-btn">확인</div></div><span class="ig-cap2">앱 화면 적용안</span></div>`,
  };
  function feedSlides(f, i) {
    const [bg, fg] = FEED_BG[i % FEED_BG.length];
    const t = state.text || f.name;
    const sz = t.length <= 8 ? 13 : t.length <= 16 ? 10.5 : t.length <= 28 ? 8 : 6;
    const meta = [f.weightsUnknown ? "" : `굵기 ${f.weights.length}종`, f.cov ? `한글 ${f.cov >= 11172 ? "11,172" : f.cov.toLocaleString()}자` : "", f.released ? `${fmtRel(f.released)} 출시` : ""].filter(Boolean).join(" · ");
    const info = `<div class="ig-s ig-info"><div class="ii-k">${esc(f.category)} · ${esc(licInfo(f).short)}</div>
      <div class="ii-n" style="${f.intro ? "" : `font-family:${f.family};font-weight:${f.weights[f.weights.length - 1]}`}">${esc(f.name)}</div>
      <p>${esc(f.desc)}</p><div class="ii-pills">${pills(f)}</div><div class="ii-m">${esc(meta)}</div></div>`;
    if (f.intro) return [`<div class="ig-s ig-intro">${introBox(f, "big")}</div>`, info];
    const ws = f.weights.length > 6 ? f.weights.filter((_, k) => k % 2 === 0 || k === f.weights.length - 1) : f.weights;
    return [
      `<div class="ig-s ig-sample" style="background:${bg};color:${fg}"><div class="sm-t" style="font-family:${famOf(f)};font-weight:${wOf(f)};font-size:${sz}cqw">${esc(t)}</div><span class="ig-cap2">${esc(f.name)}</span></div>`,
      (FEED_POSTER[f.category] || FEED_POSTER["고딕"])(f, t, famOf(f)),
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
          ${dl.ok ? `<a class="ig-pill dl" href="${esc(dl.zip)}" target="_blank" rel="noopener" title="${esc(dl.srcName)}에서 파일 바로 받기">${IC.down}다운로드</a>` : ""}
          <button class="ig-pill" data-lic-open="${f.id}" title="${esc(licInfo(f).full)} — 사용 범위 보기">라이선스</button>
          <a class="ig-pill" href="${esc(dl.page)}" target="_blank" rel="noopener" title="원 배포처 페이지(${esc(dl.srcName)})">받기 ↗</a>
        </span>
      </div>
      <div class="ig-body">
        <p class="ig-likes" data-likeline="${f.id}"></p>
        <p class="ig-cap"><b>${esc(f.name)}</b> ${esc(f.desc)}</p>
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
  const canHover = matchMedia("(hover:hover)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  function bindCarousel(m) {
    if (m.dataset.bound) return; m.dataset.bound = "1";
    const tr = m.querySelector(".ig-track");
    // 마우스를 올리면 1.6초마다 다음 이미지로, 끝나면 처음으로. 내리면 멈춤
    if (canHover) {
      let t = null, t0 = null; const card = m.closest(".ig") || m;
      const step = () => { const n = tr.children.length; if (n < 2) return; const k = Math.round(tr.scrollLeft / tr.clientWidth); tr.scrollTo({ left: ((k + 1) % n) * tr.clientWidth, behavior: "smooth" }); };
      card.addEventListener("mouseenter", () => { clearInterval(t); clearTimeout(t0); t = setInterval(step, 1600); t0 = setTimeout(step, 450); });
      card.addEventListener("mouseleave", () => { clearInterval(t); clearTimeout(t0); t = t0 = null; });
    }
    const go = (d) => tr.scrollBy({ left: d * tr.clientWidth, behavior: "smooth" });
    m.addEventListener("click", (e) => { const b = e.target.closest(".ig-nav"); if (b) go(b.classList.contains("prev") ? -1 : 1); });
    tr.addEventListener("scroll", () => { const k = Math.round(tr.scrollLeft / tr.clientWidth); m.querySelectorAll(".ig-dots i").forEach((d, j) => d.classList.toggle("on", j === k)); }, { passive: true });
  }
  function bindFeed(host) {
    host.querySelectorAll(".ig-media").forEach(bindCarousel);
    host.querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", async () => {
      const f = FONTS.find((x) => x.id === b.dataset.share);
      const url = `${location.origin}/font/${f.id}.html`;
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
        inp.value = "";
        const s = social[id] || (social[id] = { likes: 0, comments: 0, liked: false, shots: [], recent: [] });
        s.comments++; if (r.item) s.recent = [{ name: r.item.name, body: r.item.body.slice(0, 120) }, ...(s.recent || [])].slice(0, 2);
        paintSocial();
      });
    });
    loadStats([...host.querySelectorAll(".ig[data-id]")].map((el) => el.dataset.id));
    $("#feedMore")?.addEventListener("click", () => { state.feedN = (state.feedN || 24) + 24; render(); });
  }

  // ---------- 메인 렌더 ----------
  function render() {
    const list = filtered();
    $("#count").innerHTML = `<b>${list.length}</b> / ${FONTS.length}종`;
    const host = $("#results");
    if (!list.length) host.innerHTML = `<div class="empty">조건에 맞는 폰트가 없습니다. 필터를 줄여 보세요.</div>`;
    else if (state.view === "list") host.innerHTML = list.map(rowHTML).join("");
    else if (state.view === "grid") host.innerHTML = `<div class="grid">${list.map(cardHTML).join("")}</div>`;
    else if (state.view === "feed") {
      const n = state.feedN || 24;
      host.innerHTML = `<div class="igrid">${list.slice(0, n).map(feedHTML).join("")}</div>`
        + (list.length > n ? `<div class="ig-more"><button class="btn ghost" id="feedMore">더 보기 <small>${n} / ${list.length}종</small></button></div>` : "");
    }
    else host.innerHTML = `<div class="ctxgrid">${list.map(ctxHTML).join("")}</div>`;
    renderActive(); bind(host); observeFaces(host);
    if (state.view === "feed") bindFeed(host);
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
    const bar = $("#activeBar");
    bar.innerHTML = chips.length ? `<span class="k">적용 중</span>` + chips.map(([k, l]) => `<button class="fbtn on" data-rm="${k}">${esc(l)} ×</button>`).join("") + `<button class="fbtn" data-rm="all">모두 지우기</button>` : "";
    bar.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => removeFilter(b.dataset.rm)));
  }
  function removeFilter(k) {
    const [t, v] = k.split(":");
    if (k === "all") { state.cat = "전체"; state.mood.clear(); state.lic.clear(); state.cov.clear(); state.coverOnly = false; state.favOnly = false; state.only = null; state.onlyLabel = ""; state.coll = null; $("#coverOnly").checked = false; $("#favOnly").checked = false; }
    else if (t === "coll") { state.coll = null; state.cat = "전체"; }
    else if (t === "only") { state.only = null; state.onlyLabel = ""; }
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
    else { if (cmp.size >= 4) { alert("비교는 최대 4종까지 담을 수 있습니다."); return; } cmp.add(id); }
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
          <button class="tbtn${t.inv ? " on" : ""}" id="cInv">■ 반전</button></div>
      </div>
      <div class="cmp" style="grid-template-columns:repeat(${Math.min(list.length, 4)},1fr)">${list.map((f) => `
        <div class="col${t.inv ? " inv" : ""}" data-cid="${f.id}">
          <div class="r-name">${esc(f.name)}<span class="en">${esc(f.designer)}</span></div>
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
    $("#cSize").addEventListener("input", (e) => { pvs.forEach((p) => (p.style.fontSize = e.target.value + "px")); $("#cSizeV").textContent = e.target.value + "px"; });
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
  // 라이선스 증빙: 사용 시점의 사용 범위·검수일·출처를 텍스트로 보관 (분쟁 대비)
  function saveProof(f, dl) {
    const now = new Date();
    const lines = [
      "LETSUM 라이선스 확인 기록", "=".repeat(28), "",
      `폰트: ${f.name} (${f.en})`, `저작권자: ${f.holder} · 제작: ${f.designer}`,
      `라이선스: ${licInfo(f).full} — ${licInfo(f).note}`,
      `LETSUM 검수: ${f.status === "verified" ? "검수 완료" : "확인 중"} · 최종 검수일 ${f.verified}`, "",
      "사용 범위:", ...LICENSE_CATS.map((c) => `  - ${c.label}: ${f.matrix[c.key] === "ok" ? "사용 가능" : f.matrix[c.key] === "no" ? "사용 금지" : "조건부"}`), "",
      `원 배포처: ${dl.page}`, `다운로드: ${dl.zip}`, `LETSUM 페이지: https://letsum.app/#f=${f.id}`, "",
      `저장 시각: ${now.toLocaleString("ko-KR")} (${now.toISOString()})`, "",
      "※ 이 기록은 LETSUM이 정리한 참고 정보입니다. 최종 확인은 저작권자의 원문 라이선스를 따릅니다.",
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `LETSUM_라이선스증빙_${f.name}_${now.toISOString().slice(0, 10)}.txt`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- 상세 모달 ----------
  const st = (v) => v === "ok" ? '<span class="st-ok">사용 가능</span>' : v === "no" ? '<span class="st-no">사용 금지</span>' : '<span class="st-cond">조건부</span>';
  function openDetail(id, focus) {
    const f = FONTS.find((x) => x.id === id); if (!f) return;
    ensureFace(f);
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
          ${miss.length ? `<span class="pill miss">현재 문장에서 누락 ${miss.length}자: ${esc(miss.join(" "))}</span>` : `<span class="pill ok">현재 문장 모두 지원</span>`}
          <span class="note">옛한글·한자·누락은 브라우저 자동 검출(참고용)</span></div>
      </div>`}
      <p style="margin-top:16px;color:var(--ink2)">${esc(f.desc)}</p>

      ${f.intro ? "" : `<div class="m-sec"><h3>쓰임새에서 보기</h3>
        <div class="m-ctx">${["thumb", "book", "sub"].map((c) => mockHTML(f, c)).join("")}</div>
        <p class="note" style="margin-top:8px">목록의 '맥락' 보기에서 메뉴판·카드뉴스·UI 프레임도 확인할 수 있습니다.</p></div>

      <div class="m-sec"><h3>닮은 폰트</h3>
        <div class="simrow">${similar(f, 3).map((s) => (ensureFace(s), s)).map((s) => `<button class="simcard" data-open="${s.id}"><span class="r-pv" style="font-family:${s.family};font-size:26px">${esc(state.text || s.name)}</span><span class="r-name">${esc(s.name)}<span class="en">${s.category}</span></span></button>`).join("") || '<span class="note">측정 중…</span>'}</div>
        <p class="note" style="margin-top:8px">글자 형태를 브라우저에서 직접 측정(굵기 밀도·너비·획 대비)해 가까운 순으로 고릅니다. 외부 서버나 AI를 쓰지 않습니다.</p></div>`}

      <div class="m-sec"><h3>사양</h3>
        <table class="spec">
          ${f.intro ? "" : `<tr><th>측정값</th><td>${metrics[f.id] ? `굵기 밀도 ${(metrics[f.id].density * 100).toFixed(0)}% · 너비 ${metrics[f.id].width.toFixed(2)}em · 획 대비 ${metrics[f.id].contrast.toFixed(2)} <span class="note">(브라우저 측정)</span>` : "측정 중…"}</td></tr>`}
          <tr><th>굵기</th><td>${f.weightsUnknown ? '<span class="note">배포처에서 확인</span>' : f.intro ? f.weights.join(" · ") : `<span class="r-weights" style="font-family:${f.family};opacity:1;font-size:24px">${f.weights.map((w) => `<i style="font-weight:${w}">가<small>${w}</small></i>`).join("")}</span>`}</td></tr>
          <tr><th>출시·배포일</th><td>${f.released ? `${fmtRel(f.released)} <span class="note">— 출처: <a class="linklike" href="${esc(f.releasedUrl)}" target="_blank" rel="noopener">${esc(f.releasedSrc)}</a></span>` : '<span class="note">원 출시일 확인 중</span>'}</td></tr>
          <tr><th>지원 형식</th><td>${f.formats.join(", ")}</td></tr>
          <tr><th>한글 글자수</th><td>${f.glyphs}${f.cov && f.cov < 11172 ? ' <span class="note">— 완성형 전체가 아니라 희귀 글자(뷁·똠 등)가 빠질 수 있습니다. 위 문장 검사로 확인하세요.</span>' : ""}</td></tr>
          ${f.intro ? "" : `<tr><th>옛한글 · 한자</th><td>${d.old ? "옛한글 지원" : "옛한글 미지원"} · ${d.hanja ? "한자 지원" : "한자 미지원"} <span class="note">(자동 검출)</span></td></tr>`}
          <tr><th>라이선스</th><td>${licInfo(f).url ? `<a class="linklike" href="${licInfo(f).url}" target="_blank" rel="noopener">${esc(licInfo(f).full)}</a>` : esc(licInfo(f).full)} <span class="note">— ${esc(licInfo(f).note)}</span>${f.attribution ? `<br><span class="note">출처 표시 예: ${esc(f.attribution)}</span>` : ""}</td></tr>
          <tr><th>검수</th><td>${f.status === "verified" ? "검수 완료" : "확인 중"} · 최종 검수일 ${f.verified}</td></tr>
          <tr><th>영문 짝꿍 추천</th><td>${pairDef.name} <span class="note">— ${pairDef.note}. 한글 폰트의 영문·숫자가 아쉬울 때 영문만 이 폰트로 조합합니다.</span></td></tr>
        </table></div>

      <div class="m-sec" id="licSec"><h3>사용 범위 (라이선스 매트릭스)</h3>
        <table class="matrix">
          <tr><th style="width:90px">카테고리</th><th>사용 범위</th><th style="width:92px">허용 여부</th></tr>
          ${LICENSE_CATS.map((c) => `<tr><td><b>${c.label}</b></td><td>${c.key === "ofl" ? esc(licInfo(f).note) : c.desc}</td><td>${st(f.matrix[c.key])}</td></tr>`).join("")}
        </table></div>

      <div class="m-sec"><h3>받기</h3>
        <div class="dlrow">
          ${dl.ok ? `<a class="btn" href="${esc(dl.zip)}" target="_blank" rel="noopener">⬇ 원 배포처에서 받기 <small>${esc(dl.srcName)} · 자동 다운로드 시작 · TTF/OTF 설치용</small></a>` : ""}
          <a class="btn ghost" href="${esc(dl.page)}" target="_blank" rel="noopener">원 배포처 페이지 ↗</a>
          ${!dl.ok && dl.mirror ? `<a class="btn ghost" href="${esc(dl.mirror)}" rel="noopener">보관본 받기 <small>배포처 링크 끊김 시 대체 · 원본 그대로</small></a>` : ""}
          <button class="btn ghost" id="proofBtn" title="폰트명·라이선스·사용 범위·검수일·출처를 텍스트로 저장">📄 라이선스 증빙 저장</button>
        </div>
        ${dl.ok ? "" : f.intro ? `<p class="note" style="margin-top:6px">파일은 <b>${esc(dl.srcName)}</b>에서만 받을 수 있습니다. 이용 조건을 그곳에서 확인한 뒤 내려받으세요.</p>` : !isGF(f) ? `<p class="note" style="margin-top:6px">이 폰트는 <b>${esc(dl.srcName)}</b> 페이지에서 이용 범위를 확인한 뒤 내려받습니다. 원 배포처 페이지 버튼을 눌러 주세요.</p>` : `<p class="note" style="margin-top:6px">⚠ 배포처 다운로드 링크가 최근 점검(${esc(dl.checked || "—")})에서 응답하지 않습니다. 배포처 페이지에서 받아 주세요.${dl.mirror ? " 급하면 LETSUM이 보관한 원본 그대로의 ZIP(폰트 파일·라이선스 원문·출처 포함)을 받을 수 있습니다." : ""}</p>`}
        <p class="note" style="margin-top:8px">${dl.ok ? `파일은 LETSUM이 아니라 <b>원 배포처(${esc(dl.srcName)})</b>에서 내려받습니다. ZIP 안에 라이선스 원문(OFL.txt)이 함께 들어 있습니다.` : ""} 받은 뒤가 막히면 아래 설치 안내를 펼쳐 보세요.</p>
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
        <p class="note" style="margin-top:8px">필요한 글자만 내려받는 CSS는 <a href="subset.html" class="linklike">서브셋 생성기</a>에서 만들 수 있습니다. 임베딩 허용 여부는 위 매트릭스를 따릅니다.</p>` : `<p class="note" style="margin-top:12px">웹사이트에 쓰려면 원 배포처에서 받은 파일을 직접 호스팅하세요(OFL은 웹 임베딩 허용). LETSUM의 미리보기용 웹폰트는 이 사이트의 미리보기 전용입니다.</p>`}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
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
    const commonBind = () => {
      bindComments(f, focus); bindShots(f);
      $("#proofBtn").addEventListener("click", () => saveProof(f, dl));
      $("#dsgBtn").addEventListener("click", () => openDesigner(f.designer));
      $("#favBtn").addEventListener("click", () => { toggleLike(f.id); openDetail(f.id); render(); });
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
      form.reset(); msg.style.color = "var(--ink2)"; msg.textContent = "접수됐습니다. 운영자 검토 후 공개됩니다. 감사합니다!";
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
    const has = { full: f.cov >= 11172, multi: f.weights.length >= 3, hanja: !!d.hanja, old: !!d.old };
    for (const n of wiz.need) { if (!has[n]) return null; }
    [...wiz.need].forEach((n) => why.push(WIZARD_NEEDS.find((x) => x.id === n).label));
    if (u.full && has.full) sc += u.full; if (u.multi && has.multi) sc += u.multi;
    const maxW = f.weights[f.weights.length - 1]; if (u.heavy && maxW >= 800) { sc += u.heavy * 2; why.push(`굵기 ${maxW}까지`); }
    if (f.status === "verified") sc += 1;
    return { f, sc: sc + f.pop / 100, why };
  }
  function wizResults() { return FONTS.map(wizScore).filter(Boolean).sort((a, b) => b.sc - a.sc); }
  function openWizard() {
    modal.className = "modal wide wiz";
    const chip = (grp, id, label, on, sub) => `<button class="fbtn${on ? " on" : ""}" data-w${grp}="${id}">${label}${sub ? `<small>${sub}</small>` : ""}</button>`;
    const draw = () => {
      const u = WIZARD_USES.find((x) => x.id === wiz.use);
      const res = u ? wizResults() : [];
      const top = res.slice(0, 6); top.forEach((r) => ensureFace(r.f));
      modal.innerHTML = `
        <button class="x" id="mx" aria-label="닫기">×</button>
        <div class="m-head"><h2>용도로 고르기</h2><span class="en">질문 3개 · 규칙으로 계산(서버·AI 없음)</span></div>
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

  // ---------- 신규 폰트 슬라이드 (히어로) ----------
  // 이번 주(월~일) 등록분을 보여주고, 없으면 최근 등록 8종을 "최근 등록" 라벨로 보여준다
  // 기준: 원 제작사의 출시·배포일(released). 우리 사이트 등록일(added)이 아니다.
  // 출처가 확인된 날짜만 쓰고(releasedSrc), 날짜가 없는 폰트는 히어로에 넣지 않는다.
  function renderNew() {
    const track = $("#nbTrack"); if (!track) return;
    const now = new Date(); const day = (now.getDay() + 6) % 7; // 월=0
    const mon = new Date(now); mon.setDate(now.getDate() - day); mon.setHours(0, 0, 0, 0);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dot = (s) => s.replace(/-/g, ".");
    const dated = FONTS.filter((f) => f.released).sort((a, b) => b.released.localeCompare(a.released) || b.pop - a.pop);
    const weekAll = dated.filter((f) => f.released >= iso(mon) && f.released <= iso(now));
    const week = weekAll.length > 0;
    const list = (week ? weekAll : dated).slice(0, 12); // 12장까지(웹폰트를 한 번에 많이 받지 않도록)
    if (!list.length) { $(".newband").style.display = "none"; return; }
    const latest = dated[0].released;
    $("#nbLabel").textContent = week ? "이번 주 출시" : "최근 출시";
    $("#nbTitle").textContent = week ? `이번 주 출시된 한글 무료 폰트 ${weekAll.length}종` : "가장 최근 출시된 한글 무료 폰트";
    $("#nbMeta").textContent = (week ? `${dot(iso(mon))} 주간` : `이번 주 출시 없음 · 최신 출시 ${dot(latest)}`)
      + ` · 원 제작사 출시·배포일 기준 · 출시일 확인 ${dated.length}/${FONTS.length}종`;
    track.innerHTML = list.map((f) => `
      <article class="slide" data-id="${f.id}" tabindex="0">
        <div class="s-top"><span class="s-date" title="출처: ${esc(f.releasedSrc)}">${fmtRel(f.released)} 출시 · ${esc(f.releasedSrc.replace(/\(.*\)/, ""))}</span>${week ? '<span class="s-new">NEW</span>' : ""}<span class="badge">${f.category}</span></div>
        ${f.intro ? introBox(f, "slide") : `<div class="s-pv" style="font-family:${f.family}">${esc(f.name)}<small>다람쥐 헌 쳇바퀴에 타고파</small></div>`}
        <div class="s-foot"><div class="r-name">${esc(f.name)}<span class="en">${esc(f.designer)}${f.weightsUnknown ? "" : ` · 굵기 ${f.weights.length}종`}</span></div>
          <div class="pills"><span class="pill ok">상업용 OK</span>${f.matrix.embed === "ok" ? '<span class="pill ok">임베딩 ✓</span>' : ""}${f.intro ? '<span class="pill intro">소개 전용</span>' : ""}</div></div>
      </article>`).join("");
    observeFaces(track);
    track.querySelectorAll(".slide").forEach((el) => {
      el.addEventListener("click", () => openDetail(el.dataset.id));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") openDetail(el.dataset.id); });
    });
    const step = () => (track.querySelector(".slide")?.getBoundingClientRect().width || 420) + 14;
    $("#nbPrev").addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    $("#nbNext").addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
  }

  // ---------- 시작 ----------
  renderNew();
  render();
  renderTray();
  openFromHash();
  detectAll().then(() => { render(); runCoverage(); });
})();
