// LETSUM — 한글 폰트 작업대
// 구조: 전역 컨트롤(문장·크기·굵기·반전·영문 짝꿍) → 필터 → 목록/격자/맥락 보기 → 비교 트레이 → 상세 모달
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const LS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  // ---------- 폰트 로딩: data.js의 굵기 정보로 Google Fonts 링크 생성 ----------
  // 스타일시트가 도착하기 전에 document.fonts.load를 부르면 폰트가 없는 것으로 판정되므로, 링크 로드를 기다린다
  const fontsCssReady = new Promise((resolve) => {
    const fam = FONTS.map((f) => "family=" + f.en.replace(/ /g, "+") + ":wght@" + f.weights.join(";")).join("&");
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
    sort: "pop", text: TEXT_PRESETS[0].t, size: 44, weight: 400, inv: false, pair: false,
    view: "list", ctx: "thumb",
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
    await Promise.all(FONTS.map((f) => document.fonts.load(`400 44px "${f.en}"`, "ᄒᆞᆫ漢가나다ㅣㅡ").catch(() => {})));
    await document.fonts.load('44px "Inter"', "ᄒᆞᆫ漢가").catch(() => {});
    FONTS.forEach((f) => { detect[f.id] = { old: probe(f.en, "ᆞ") && probe(f.en, "ᄒ"), hanja: probe(f.en, "漢") && probe(f.en, "國") }; });
    FONTS.forEach((f) => (metrics[f.id] = measure(f.en)));
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
    await Promise.all(FONTS.map((f) => document.fonts.load(`400 44px "${f.en}"`, txt).catch(() => {})));
    FONTS.forEach((f) => { coverage[f.id] = chars.filter((ch) => !probe(f.en, ch)); });
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
    $("#ctxChips").style.display = v === "ctx" ? "flex" : "none"; render();
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
    if (s === "pop") list.sort((a, b) => b.pop - a.pop);
    if (s === "new") list.sort((a, b) => b.added.localeCompare(a.added));
    if (s === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    if (s === "weights") list.sort((a, b) => b.weights.length - a.weights.length || b.pop - a.pop);
    return list;
  }

  // ---------- 렌더 조각 ----------
  const LIC_SHORT = { print: "인쇄", web: "웹", video: "영상", embed: "임베딩", bici: "BI·CI", package: "포장" };
  const pills = (f) => Object.keys(LIC_SHORT).map((k) => `<span class="pill ${f.matrix[k]}">${LIC_SHORT[k]}${f.matrix[k] === "ok" ? " ✓" : f.matrix[k] === "no" ? " ✕" : " △"}</span>`).join("")
    + (f.status === "verified" ? "" : `<span class="pill chk">확인 중</span>`);
  const famOf = (f) => state.pair ? `${LATIN_PAIRS.find((p) => p.id === f.pair).family}, ${f.family}` : f.family;
  const wOf = (f) => { const w = state.weight; if (f.weights.includes(w)) return w; return f.weights.reduce((p, c) => Math.abs(c - w) < Math.abs(p - w) ? c : p); };
  function pvText(f) {
    const t = state.text || f.name; const miss = coverage[f.id] || [];
    if (!miss.length) return esc(t);
    return [...t].map((ch) => miss.includes(ch) ? `<span class="miss" title="이 폰트에 없는 글자(참고)">${esc(ch)}</span>` : esc(ch)).join("");
  }
  const covTags = (f) => {
    const d = detect[f.id];
    return `<span class="cov"><span class="${f.cov >= 11172 ? "y" : ""}">${f.cov >= 11172 ? "11,172" : f.cov.toLocaleString()}자</span>`
      + (d ? `<span class="${d.old ? "y" : "dim"}">옛한글</span><span class="${d.hanja ? "y" : "dim"}">漢</span>` : "") + `</span>`;
  };
  const missPill = (f) => (coverage[f.id] && coverage[f.id].length) ? `<span class="pill miss">누락 ${coverage[f.id].length}자</span>` : "";
  const acts = (f) => `<div class="r-acts">
      <button class="abtn fav${favs.has(f.id) ? " on" : ""}" data-fav="${f.id}" aria-label="즐겨찾기">${favs.has(f.id) ? "♥" : "♡"}</button>
      <button class="abtn${cmp.has(f.id) ? " on" : ""}" data-cmp="${f.id}">${cmp.has(f.id) ? "비교 중" : "+ 비교"}</button>
      <button class="abtn" data-open="${f.id}">상세</button></div>`;
  const pvStyle = (f) => `font-family:${famOf(f)};font-size:${state.size}px;font-weight:${wOf(f)}`;

  function rowHTML(f) {
    return `<article class="row" data-id="${f.id}" tabindex="0">
      <div class="r-meta">
        <div class="r-name">${esc(f.name)}<span class="en">${esc(f.en)}</span></div>
        <div class="r-by">${esc(f.designer)}</div>
        <div class="r-spec">굵기 ${f.weights.length}종 · ${f.formats.join("/")}</div>
        ${covTags(f)}
      </div>
      <div class="r-pvwrap">
        <div class="r-pv${state.inv ? " inv" : ""}" style="${pvStyle(f)}">${pvText(f)}</div>
        <div class="r-weights" style="font-family:${f.family}">${f.weights.map((w) => `<i style="font-weight:${w}">가<small>${w}</small></i>`).join("")}</div>
      </div>
      <div class="r-side"><div class="pills">${pills(f)}${missPill(f)}</div>${acts(f)}</div>
    </article>`;
  }
  function cardHTML(f) {
    return `<article class="card" data-id="${f.id}" tabindex="0">
      <div class="r-pv${state.inv ? " inv" : ""}" style="font-family:${famOf(f)};font-weight:${wOf(f)};font-size:${Math.min(state.size, 40)}px">${pvText(f)}</div>
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
      ${mockHTML(f, state.ctx)}
      <div class="lab"><div class="r-name">${esc(f.name)}<span class="en">${esc(f.designer)}</span></div>${acts(f)}</div>
      <div class="pills">${pills(f)}${missPill(f)}</div>
    </article>`;
  }

  // ---------- 메인 렌더 ----------
  function render() {
    const list = filtered();
    $("#count").innerHTML = `<b>${list.length}</b> / ${FONTS.length}종`;
    const host = $("#results");
    if (!list.length) host.innerHTML = `<div class="empty">조건에 맞는 폰트가 없습니다. 필터를 줄여 보세요.</div>`;
    else if (state.view === "list") host.innerHTML = list.map(rowHTML).join("");
    else if (state.view === "grid") host.innerHTML = `<div class="grid">${list.map(cardHTML).join("")}</div>`;
    else host.innerHTML = `<div class="ctxgrid">${list.map(ctxHTML).join("")}</div>`;
    renderActive(); bind(host);
  }
  function renderActive() {
    const chips = [];
    if (state.coll) chips.push(["coll", COLLECTIONS.find((c) => c.id === state.coll).title]);
    if (state.onlyLabel) chips.push(["only", "대안: " + state.onlyLabel]);
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
    if (state.view === "ctx") { render(); return; }
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
      el.addEventListener("click", (e) => { if (e.target.closest("button")) return; openDetail(el.dataset.id); });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") openDetail(el.dataset.id); });
    });
    host.querySelectorAll("[data-fav]").forEach((b) => b.addEventListener("click", () => { toggleSet(favs, b.dataset.fav); save("fm_favs", [...favs]); render(); }));
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
  function dlFor(f) {
    const gfam = f.en.replace(/ /g, "+");
    const o = f.dl || {};
    const zip = o.mirror || o.zip || `https://fonts.google.com/download?family=${gfam}`;
    const page = o.page || `https://fonts.google.com/specimen/${gfam}`;
    const st = links[f.id];
    return { zip, page, ok: !(st && st.ok === false), checked: st && st.checked, srcName: o.mirror ? "LETSUM 미러" : (o.srcName || "Google Fonts") };
  }
  // 라이선스 증빙: 사용 시점의 사용 범위·검수일·출처를 텍스트로 보관 (분쟁 대비)
  function saveProof(f, dl) {
    const now = new Date();
    const lines = [
      "LETSUM 라이선스 확인 기록", "=".repeat(28), "",
      `폰트: ${f.name} (${f.en})`, `저작권자: ${f.holder} · 제작: ${f.designer}`,
      `라이선스: ${f.license}${f.license === "OFL" ? " (SIL Open Font License 1.1) — 상업 이용·수정·재배포 가능, 폰트 파일 단독 판매 금지" : ""}`,
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
  function openDetail(id) {
    const f = FONTS.find((x) => x.id === id); if (!f) return;
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
      <div class="m-head"><h2>${esc(f.name)}</h2><span class="en">${esc(f.en)}</span><span class="badge">${f.category}</span><span class="badge free">상업용 무료 · OFL</span>${f.status !== "verified" ? '<span class="badge check">확인 중</span>' : ""}</div>
      <p class="m-sub">저작권자 ${esc(f.holder)} · 제작 <button class="linklike" id="dsgBtn">${esc(f.designer)}</button> · ${f.mood.join(" · ")}</p>
      <div class="pv-big" id="pvBig" style="font-family:${f.family};font-size:44px;font-weight:${wOf(f)}">${pvText(f)}</div>
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
      </div>
      <p style="margin-top:16px;color:var(--ink2)">${esc(f.desc)}</p>

      <div class="m-sec"><h3>쓰임새에서 보기</h3>
        <div class="m-ctx">${["thumb", "book", "sub"].map((c) => mockHTML(f, c)).join("")}</div>
        <p class="note" style="margin-top:8px">목록의 '맥락' 보기에서 메뉴판·카드뉴스·UI 프레임도 확인할 수 있습니다.</p></div>

      <div class="m-sec"><h3>닮은 폰트</h3>
        <div class="simrow">${similar(f, 3).map((s) => `<button class="simcard" data-open="${s.id}"><span class="r-pv" style="font-family:${s.family};font-size:26px">${esc(state.text || s.name)}</span><span class="r-name">${esc(s.name)}<span class="en">${s.category}</span></span></button>`).join("") || '<span class="note">측정 중…</span>'}</div>
        <p class="note" style="margin-top:8px">글자 형태를 브라우저에서 직접 측정(굵기 밀도·너비·획 대비)해 가까운 순으로 고릅니다. 외부 서버나 AI를 쓰지 않습니다.</p></div>

      <div class="m-sec"><h3>사양</h3>
        <table class="spec">
          <tr><th>측정값</th><td>${metrics[f.id] ? `굵기 밀도 ${(metrics[f.id].density * 100).toFixed(0)}% · 너비 ${metrics[f.id].width.toFixed(2)}em · 획 대비 ${metrics[f.id].contrast.toFixed(2)} <span class="note">(브라우저 측정)</span>` : "측정 중…"}</td></tr>
          <tr><th>굵기</th><td><span class="r-weights" style="font-family:${f.family};opacity:1;font-size:24px">${f.weights.map((w) => `<i style="font-weight:${w}">가<small>${w}</small></i>`).join("")}</span></td></tr>
          <tr><th>지원 형식</th><td>${f.formats.join(", ")}</td></tr>
          <tr><th>한글 글자수</th><td>${f.glyphs}${f.cov < 11172 ? ' <span class="note">— 완성형 전체가 아니라 희귀 글자(뷁·똠 등)가 빠질 수 있습니다. 위 문장 검사로 확인하세요.</span>' : ""}</td></tr>
          <tr><th>옛한글 · 한자</th><td>${d.old ? "옛한글 지원" : "옛한글 미지원"} · ${d.hanja ? "한자 지원" : "한자 미지원"} <span class="note">(자동 검출)</span></td></tr>
          <tr><th>라이선스</th><td>${f.license} (SIL Open Font License 1.1)</td></tr>
          <tr><th>검수</th><td>${f.status === "verified" ? "검수 완료" : "확인 중"} · 최종 검수일 ${f.verified}</td></tr>
          <tr><th>영문 짝꿍 추천</th><td>${pairDef.name} <span class="note">— ${pairDef.note}. 한글 폰트의 영문·숫자가 아쉬울 때 영문만 이 폰트로 조합합니다.</span></td></tr>
        </table></div>

      <div class="m-sec"><h3>사용 범위 (라이선스 매트릭스)</h3>
        <table class="matrix">
          <tr><th style="width:90px">카테고리</th><th>사용 범위</th><th style="width:92px">허용 여부</th></tr>
          ${LICENSE_CATS.map((c) => `<tr><td><b>${c.label}</b></td><td>${c.key === "ofl" ? "폰트 파일의 수정·복제·배포 가능, 단 폰트 파일 자체의 유료 판매는 금지" : c.desc}</td><td>${st(f.matrix[c.key])}</td></tr>`).join("")}
        </table></div>

      <div class="m-sec"><h3>받기</h3>
        <div class="dlrow">
          ${dl.ok ? `<a class="btn" href="${esc(dl.zip)}" rel="noopener">⬇ ZIP 받기 <small>${dl.srcName === "LETSUM 미러" ? "미러 파일 · 즉시 다운로드" : "원 배포처에서 자동 다운로드 시작"} · TTF/OTF 설치용</small></a>` : ""}
          <a class="btn ghost" href="${esc(dl.page)}" target="_blank" rel="noopener">원 배포처 페이지 ↗</a>
          <button class="btn ghost" id="proofBtn" title="폰트명·라이선스·사용 범위·검수일·출처를 텍스트로 저장">📄 라이선스 증빙 저장</button>
        </div>
        ${dl.ok ? "" : `<p class="note" style="margin-top:6px">⚠ 직접 다운로드 링크가 최근 점검(${esc(dl.checked || "—")})에서 응답하지 않아 배포처 페이지로 안내합니다.</p>`}
        <p class="note" style="margin-top:8px">${dl.ok ? `파일은 저희 서버가 아니라 <b>원 배포처(${esc(dl.srcName)})</b>에서 바로 내려받습니다. ZIP 안에 라이선스 원문(OFL.txt)이 함께 들어 있습니다.` : ""} 받은 뒤가 막히면 아래 설치 안내를 펼쳐 보세요.</p>
        <details class="howto"><summary>설치 · PPT/한글 적용 안내 (Windows · Mac · 아이폰 · 갤럭시)</summary>
          <div class="howto-body">
            <p><b>Windows</b> — ZIP 압축을 풀고 .ttf/.otf 파일을 우클릭 → <b>모든 사용자용으로 설치</b>. 여러 굵기 파일은 전부 설치합니다.</p>
            <p><b>Mac</b> — 파일을 더블클릭 → 서체 관리자에서 <b>설치</b>. 또는 서체 관리자에 드래그.</p>
            <p><b>PPT·한글·포토샵에 안 보일 때</b> — ① 프로그램을 <b>완전히 종료 후 다시 실행</b> ② 목록에는 파일명이 아니라 <b>글꼴 이름</b>(이 폰트는 "${esc(f.en)}" 또는 "${esc(f.name)}")으로 뜹니다 ③ .woff/.woff2는 웹 전용이라 설치되지 않습니다 ④ 다른 PC에서 열면 글꼴이 바뀌니 PPT는 <b>파일 &gt; 옵션 &gt; 저장 &gt; 파일의 글꼴 포함</b>으로 저장하거나 PDF로 보내세요.</p>
            <p><b>아이폰</b> — iOS는 폰트 설치 앱(예: iFont, Fontcase)으로 프로필을 설치해야 하며, 시스템 글꼴은 바뀌지 않고 Pages·Keynote 등 앱 안에서만 쓸 수 있습니다. <b>갤럭시</b> — 설정 &gt; 디스플레이 &gt; 글꼴에서는 Galaxy Store 글꼴만 적용됩니다. 문서 앱 안에서 쓰려면 앱별 글꼴 추가 기능을 이용하세요.</p>
            <p><b>영상·디자인 프로그램</b> — 프리미어·애프터이펙트·피그마는 설치 후 재실행하면 바로 나타납니다. 캔바(무료)는 자체 폰트만 쓸 수 있고, 유료 플랜에서 업로드가 됩니다.</p>
          </div>
        </details>
        <div class="codehead"><span>웹폰트 (Google Fonts CDN)</span><button class="abtn" data-copy="c1">복사</button></div>
        <pre class="code" id="c1">&lt;link href="${gfont}" rel="stylesheet"&gt;
font-family: ${esc(f.family)};${state.pair || true ? `\n/* 영문만 짝꿍 폰트로: */ font-family: ${esc(pairDef.family)}, ${esc(f.family)};` : ""}</pre>
        <div class="codehead"><span>개발자용 (Fontsource · npm, 자체 호스팅)</span><button class="abtn" data-copy="c2">복사</button></div>
        <pre class="code" id="c2">npm i @fontsource/${f.id}
import "@fontsource/${f.id}/400.css";</pre>
        <p class="note" style="margin-top:8px">필요한 글자만 내려받는 CSS는 <a href="subset.html" class="linklike">서브셋 생성기</a>에서 만들 수 있습니다. 임베딩 허용 여부는 위 매트릭스를 따릅니다.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
          <button class="btn ghost" id="favBtn">${favs.has(f.id) ? "♥ 즐겨찾기 해제" : "♡ 즐겨찾기"}</button>
          <button class="btn ghost" id="cmpBtn">${cmp.has(f.id) ? "비교에서 빼기" : "+ 비교에 담기"}</button>
        </div></div>
      <p class="disclaimer">※ 위 사용 범위는 참고용으로, 정확한 사용 범위는 이용 전 폰트 저작권자에게 확인하시기 바랍니다. 사용 범위는 저작권자의 규정에 따라 달라질 수 있습니다.</p>`;
    overlay.classList.add("open");
    $("#mx").addEventListener("click", closeModal);
    const pv = $("#pvBig"); const base = state.text || f.name;
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
    $("#proofBtn").addEventListener("click", () => saveProof(f, dl));
    $("#dsgBtn").addEventListener("click", () => openDesigner(f.designer));
    $("#favBtn").addEventListener("click", () => { toggleSet(favs, f.id); save("fm_favs", [...favs]); openDetail(f.id); render(); });
    $("#cmpBtn").addEventListener("click", () => { toggleCmp(f.id); openDetail(f.id); });
  }
  function openDesigner(name) {
    const list = FONTS.filter((f) => f.designer === name);
    modal.className = "modal";
    modal.innerHTML = `<button class="x" id="mx" aria-label="닫기">×</button>
      <div class="m-head"><h2>${esc(name)}</h2><span class="en">LETSUM 등록 폰트 ${list.length}종</span></div>
      <div class="grid" style="margin-top:18px">${list.map((f) => `<article class="card" data-did="${f.id}"><div class="r-pv" style="font-family:${f.family};font-size:30px">${esc(state.text || f.name)}</div><div class="r-name">${esc(f.name)}<span class="en">굵기 ${f.weights.length}종</span></div></article>`).join("")}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
        <button class="btn" id="dsgSupport">♥ 제작자 후원하기</button>
        <a class="btn ghost" href="submit.html">유료 폰트 입점 신청</a></div>
      <p class="note" style="margin-top:10px">후원 기능은 준비 중입니다. 입점 신청을 통해 후원 링크를 등록할 수 있습니다.</p>`;
    overlay.classList.add("open");
    $("#mx").addEventListener("click", closeModal);
    $("#dsgSupport").addEventListener("click", () => alert("후원 기능은 준비 중입니다. 정식 서비스에서 제공될 예정입니다."));
    modal.querySelectorAll("[data-did]").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.did)));
  }
  function closeModal() { overlay.classList.remove("open"); try { if (location.hash.startsWith("#f=")) history.replaceState(null, "", location.pathname); } catch (e) {} }
  // 폰트별 정적 페이지(font/<id>.html)와 공유 링크에서 #f=<id>로 들어오면 바로 상세를 연다
  function openFromHash() { const m = location.hash.match(/^#f=([\w-]+)/); if (m && FONTS.some((x) => x.id === m[1])) openDetail(m[1]); }
  window.addEventListener("hashchange", openFromHash);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // ---------- 신규 폰트 슬라이드 (히어로) ----------
  // 이번 주(월~일) 등록분을 보여주고, 없으면 최근 등록 8종을 "최근 등록" 라벨로 보여준다
  function renderNew() {
    const track = $("#nbTrack"); if (!track) return;
    const now = new Date(); const day = (now.getDay() + 6) % 7; // 월=0
    const mon = new Date(now); mon.setDate(now.getDate() - day); mon.setHours(0, 0, 0, 0);
    const iso = (d) => d.toISOString().slice(0, 10);
    const byNew = [...FONTS].sort((a, b) => b.added.localeCompare(a.added));
    let list = byNew.filter((f) => f.added >= iso(mon)); let week = true;
    if (!list.length) { list = byNew.slice(0, 8); week = false; }
    const latest = byNew[0].added.replace(/-/g, ".");
    $("#nbLabel").textContent = week ? "이번 주 신규" : "최근 등록";
    $("#nbTitle").textContent = week ? `이번 주 새로 배포된 한글 무료 폰트 ${list.length}종` : "최근 등록된 한글 무료 폰트";
    $("#nbMeta").textContent = (week ? `${iso(mon).replace(/-/g, ".")} 주간` : `이번 주 신규 없음 · 최신 갱신 ${latest} 기준`) + ` · 전체 ${FONTS.length}종 · 검수 ${FONTS.map((f) => f.verified).sort().pop().replace(/-/g, ".")}`;
    track.innerHTML = list.map((f) => `
      <article class="slide" data-id="${f.id}" tabindex="0">
        <div class="s-top"><span class="s-date">${f.added.replace(/-/g, ".")} 등록</span>${f.added >= iso(mon) ? '<span class="s-new">NEW</span>' : ""}<span class="badge">${f.category}</span></div>
        <div class="s-pv" style="font-family:${f.family}">${esc(f.name)}<small>다람쥐 헌 쳇바퀴에 타고파</small></div>
        <div class="s-foot"><div class="r-name">${esc(f.name)}<span class="en">${esc(f.designer)} · 굵기 ${f.weights.length}종</span></div>
          <div class="pills"><span class="pill ok">상업용 OK</span>${f.matrix.embed === "ok" ? '<span class="pill ok">임베딩 ✓</span>' : ""}</div></div>
      </article>`).join("");
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
