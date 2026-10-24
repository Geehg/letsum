// LETSUM 필사독서 — TYPEBOOK v1.0.0 엔진(한글 IME 조합 분리·정오 판정·기록·TXT/MD/EPUB 가져오기)을 LETSUM에 맞게 확장
// 추가: 위키문헌 명작 서가(data/typing), 원문·필사 글꼴(LETSUM 폰트), 문장부호 동치 판정(“ → " 등), 시 줄바꿈(↵), 다음 글쇠 안내,
//       연속 필사일·오늘 쓴 글자, 완성한 쪽 이미지 저장(shot.js). 기록은 이 브라우저(localStorage)에만 — 서버로 보내지 않음.
(() => {
  "use strict";
  const STORAGE = "typebook-v1"; // TYPEBOOK과 같은 저장 이름(기록 호환)
  const MAX_FILE_BYTES = 10 * 1024 * 1024, MAX_TEXT_CHARS = 500000;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const normalize = (s) => String(s || "").normalize("NFC").replace(/\r\n?/g, "\n");
  const chars = (s) => Array.from(normalize(s));
  const fmt = (v) => String(v).padStart(2, "0");
  const eul = (w) => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 ? ((c - 0xac00) % 28 ? "을" : "를") : "을(를)"; };
  // 키보드로 치기 어려운 문장부호는 같은 뜻의 키보드 기호도 정답으로
  const EQ = { "“": '"', "”": '"', "„": '"', "‘": "'", "’": "'", "「": '"', "」": '"', "『": '"', "』": '"', "·": ".", "•": ".", "―": "-", "—": "-", "–": "-", "～": "~", " ": " " };
  const same = (t, e) => t === e || EQ[e] === t;
  const pageDone = (typed, target) => { const a = chars(typed), b = chars(target); return a.length === b.length && a.every((c, i) => same(c, b[i])); };
  function readJSON(k, d) { try { const v = localStorage.getItem(`${STORAGE}:${k}`); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(`${STORAGE}:${k}`, JSON.stringify(v)); return true; } catch (e) { toast("저장 공간이 부족해 이번 기록을 보관하지 못했습니다."); return false; } }
  let toastT = 0; function toast(m) { const t = $("tbToast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600); }
  const today = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); };

  // ---------- 쪽 나누기: 문단 기준 약 350자. 시는 줄바꿈을 살리고 연 단위로 ----------
  function paginate(text, poem) {
    let src = normalize(text).replace(/\u0000/g, "").replace(/\t/g, "    ").trim().replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
    if (!src) return [];
    const paras = src.split(/\n\s*\n/).map((p) => (poem ? p.split("\n").map((l) => l.replace(/[ \t]{2,}/g, " ").trim()).join("\n") : p.replace(/\n/g, " ").replace(/[ \t]{2,}/g, " ").trim())).filter(Boolean);
    const segs = [];
    for (const p of paras) {
      if (chars(p).length <= 330) { segs.push(p); continue; }
      const cs = Array.from(p); // 아주 긴 문단은 문장 끝에서 자름(글자를 버리지 않음)
      while (cs.length) {
        let take = Math.min(300, cs.length);
        if (cs.length > 330) for (let k = take; k > Math.max(190, take - 80); k--) if (/[.。!?！？;； \n]/.test(cs[k - 1] || "")) { take = k; break; }
        const piece = cs.splice(0, take).join("").trim(); if (piece) segs.push(piece);
      }
    }
    const pages = []; let cur = "";
    for (const s of segs) { const j = cur ? cur + (poem ? "\n\n" : "\n") + s : s; /* 산문은 문단마다 Enter 한 번, 시는 연 사이 빈 줄 */ if (cur && chars(j).length > (poem ? 420 : 350)) { pages.push(cur); cur = s; } else cur = j; }
    if (cur) pages.push(cur);
    return pages;
  }

  // ---------- 상태 ----------
  const state = { index: null, books: [], book: null, page: 0, draft: "", completed: new Set(), drafts: {}, metrics: {}, elapsed: 0, keystrokes: 0, attempts: 0, errors: 0, started: false, lastActivity: 0, composing: false, fontSize: 18, fonts: { ko: [], en: [] }, fontO: "", fontW: "", finger: false, kb: true };

  // ---------- 글꼴(LETSUM 폰트) 불러오기 ----------
  const fontLoaded = {};
  function fontById(id) { return [...state.fonts.ko, ...state.fonts.en].find((f) => f.id === id); }
  function loadFont(f, text) {
    if (!f) return Promise.resolve();
    const key = f.id + (text ? ":t" : "");
    if (fontLoaded[key]) return fontLoaded[key];
    if (f.gf) { // Google Fonts 공식 CSS(표지는 제목 글자만: text=)
      const l = document.createElement("link"); l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=" + f.gf.replace(/ /g, "+") + (text ? "&text=" + encodeURIComponent(text) : ":wght@" + [...new Set([400, 700].map((w) => f.weights.reduce((p, c) => Math.abs(c - w) < Math.abs(p - w) ? c : p)))].join(";")) + "&display=swap";
      document.head.appendChild(l);
      return (fontLoaded[key] = new Promise((r) => { l.onload = () => document.fonts.load(`400 20px "${f.family}"`, text || "가A").then(r, r); l.onerror = r; setTimeout(r, 5000); }));
    }
    const ws = Object.keys(f.wf || {}).map(Number); if (!ws.length) return Promise.resolve();
    const w = ws.reduce((p, c) => Math.abs(c - 400) < Math.abs(p - 400) ? c : p); const u = f.wf[w];
    const fmtOf = /\.otf(\?|$)/.test(u) ? "opentype" : /\.ttf(\?|$)/.test(u) ? "truetype" : /\.woff(\?|$)/.test(u) ? "woff" : "woff2";
    const face = new FontFace(f.family, `url("${u}") format("${fmtOf}")`, { weight: "100 900", display: "swap" });
    document.fonts.add(face); return (fontLoaded[key] = face.load().catch(() => {}));
  }
  const stackOf = (id) => { const f = fontById(id); return f ? `"${f.family}", ${f.gen}` : "inherit"; };

  // ---------- 기록 ----------
  const progressOf = (id) => readJSON(`progress:${id}`, {});
  function storeProgress() {
    if (!state.book) return;
    if (state.completed.has(state.page) && pageDone(state.draft, state.book.pages[state.page])) delete state.drafts[state.page]; // 완성한 쪽은 원문으로 복원(긴 책의 저장 공간 절약)
    else state.drafts[state.page] = state.draft;
    state.metrics[state.page] = { elapsed: state.elapsed, keystrokes: state.keystrokes, attempts: state.attempts, errors: state.errors };
    writeJSON(`progress:${state.book.id}`, { index: state.page, completed: [...state.completed], drafts: state.drafts, metrics: state.metrics, updatedAt: new Date().toISOString() });
    writeJSON("last", state.book.id);
  }
  function addDay(n) { if (n <= 0) return; const d = readJSON("days", {}); d[today()] = (d[today()] || 0) + n; writeJSON("days", d); }
  function streak() {
    const d = readJSON("days", {}); let s = 0; const t = new Date(Date.now() + 9 * 3600e3);
    if (!d[today()]) t.setUTCDate(t.getUTCDate() - 1); // 오늘 아직 안 썼으면 어제부터 셈
    for (;;) { const k = t.toISOString().slice(0, 10); if (d[k] > 0) { s++; t.setUTCDate(t.getUTCDate() - 1); } else break; }
    return s;
  }
  function renderMe() {
    const d = readJSON("days", {}); const total = Object.values(d).reduce((a, b) => a + b, 0);
    const pages = state.books.reduce((n, b) => n + ((progressOf(b.id).completed || []).length), 0);
    const books = state.books.filter((b) => b.pages && (progressOf(b.id).completed || []).length >= b.pages.length).length;
    $("tbMe").innerHTML = [["연속 필사", streak(), "일"], ["오늘 쓴 글자", (d[today()] || 0).toLocaleString(), "자"], ["지금까지 쓴 글자", total.toLocaleString(), "자"], ["완성한 쪽", pages, "쪽"], ["완필한 작품", books, "편"], ["포인트", (readJSON("points", 0) || 0).toLocaleString(), "P"]]
      .map(([k, v, u]) => `<div><span>${k}</span><b>${v}<small>${u}</small></b></div>`).join("");
    const last = readJSON("last", ""); const lb = state.books.find((b) => b.id === last);
    $("tbContinue").hidden = !lb; if (lb) $("tbContinue").textContent = `이어서 쓰기 — ${lb.title} →`;
  }

  // ---------- 화면 디자인(책상·잉크·몰입) ----------
  const SKINS = ["focus-light", "focus-dark", "retro", "book", "ink"];
  function applySkin(k) {
    if (k === "focus") k = "focus-dark"; // 예전 '몰입'(어두움)
    if (!SKINS.includes(k)) k = document.documentElement.getAttribute("data-theme") === "dark" ? "focus-dark" : "focus-light"; // 기본: 몰입(사이트 밝기 따라)
    $("tbMain").dataset.skin = k.startsWith("focus") ? "focus" : k; $("tbMain").dataset.tone = k === "focus-light" ? "light" : "dark"; $("tbMain").dataset.layout = k.startsWith("focus") || k === "retro" ? "focus" : "wide"; // 몰입·레트로 = 한 단
    writeJSON("skin2", k);
    document.querySelectorAll(".tb-skin [data-skin]").forEach((b) => { b.classList.toggle("on", b.dataset.skin === k); b.setAttribute("aria-pressed", b.dataset.skin === k); });
  }

  // ---------- 레트로 타자기: 합성 타건음(외부 음원 없음)·캐리지·용지·인쇄 ----------
  const retro = Object.assign({ sound: true, volume: 38, paper: "ivory" }, readJSON("retro", {}));
  const isRetro = () => $("tbMain").dataset.skin === "retro";
  let actx = null, strikeT = 0;
  function applyRetro() {
    $("tbMain").dataset.paper = ["ivory", "white", "parchment"].includes(retro.paper) ? retro.paper : "ivory";
    $("tbSound").checked = !!retro.sound; $("tbVolume").value = retro.volume; $("tbPaper").value = $("tbMain").dataset.paper;
  }
  function tone(f, d, a, type = "triangle", delay = 0) {
    const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(65, f * 0.63), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.00011, a), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, a, delay = 0) {
    const r = actx.sampleRate, b = actx.createBuffer(1, Math.ceil(r * d), r), x = b.getChannelData(0);
    for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / x.length, 2);
    const src = actx.createBufferSource(), fl = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = b; fl.type = "bandpass"; fl.frequency.value = 1180; fl.Q.value = 0.78; g.gain.value = a;
    src.connect(fl).connect(g).connect(actx.destination); src.start(actx.currentTime + delay);
  }
  function clack(key) {
    if (!retro.sound || !retro.volume) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume();
      const v = Math.min(0.65, Math.max(0, retro.volume / 100));
      if (key === "Enter") { noise(0.095, v * 0.14); tone(840, 0.16, v * 0.12, "sine"); tone(1180, 0.21, v * 0.075, "sine", 0.06); } // 캐리지 복귀 + 벨
      else if (key === "Backspace") { noise(0.038, v * 0.12); tone(170, 0.05, v * 0.06, "square"); }
      else if (key === " ") { noise(0.065, v * 0.19); tone(150, 0.035, v * 0.08); }
      else { noise(0.028, v * 0.19); tone(240 + Math.random() * 55, 0.035, v * 0.075, "square"); tone(580, 0.018, v * 0.025, "triangle", 0.012); }
    } catch (e) { /* 오디오를 못 쓰는 브라우저는 소리 없이 */ }
  }
  function strike() { const m = $("tbMachine"); m.classList.add("strike"); clearTimeout(strikeT); strikeT = setTimeout(() => m.classList.remove("strike"), 90); }
  function carriage() { // 줄 안에서 친 글자 수만큼 캐리지가 왼쪽으로, Enter면 처음으로
    if (!isRetro()) return;
    const inp = $("tbInput"), before = inp.value.slice(0, inp.selectionStart), col = chars(before.slice(before.lastIndexOf("\n") + 1)).length;
    $("tbMachine").style.setProperty("--col", String(col % 56));
    $("tbStatus").textContent = state.book && state.completed.has(state.page) ? "PAGE COMPLETE" : state.draft ? "TYPING" : "READY";
  }
  function printPages() {
    const b = state.book; if (!b) return;
    const out = []; b.pages.forEach((pg, i) => { const t = i === state.page ? state.draft : state.completed.has(i) ? pg : state.drafts[i] || ""; if (t.trim()) out.push(t); });
    if (!out.length) { toast("아직 쓴 쪽이 없습니다."); return; }
    const a = $("tbPrintArea"); a.style.fontFamily = stackOf(state.fontW);
    a.innerHTML = `<h1>${esc(b.title)}</h1><p class="by">${esc(b.author)} · 나의 필사 ${out.length}쪽 · LETSUM 필사독서</p>` + out.map((t) => `<div class="pp">${esc(t)}</div>`).join("");
    loadFont(fontById(state.fontW)).then(() => window.print());
  }

  // ---------- 필사 화면 왼쪽 '나의 서재'와 요약 ----------
  function renderSide() {
    const cur = state.book; if (!cur) return;
    const theme = state.index.themes.find((t) => t.books.some((b) => b.id === cur.id));
    const ids = new Set([cur.id, ...(theme ? theme.books.map((b) => b.id) : [])]);
    state.books.forEach((b) => { if (b.imported || (progressOf(b.id).completed || []).length) ids.add(b.id); });
    state.books.forEach((b) => { if (b.author === cur.author && ids.size < 40) ids.add(b.id); }); // 같은 작가의 다른 작품
    const list = [...ids].map((id) => state.books.find((b) => b.id === id)).filter(Boolean);
    $("tbSideN").textContent = fmt(list.length);
    $("tbSideList").innerHTML = list.map((b) => {
      const done = (progressOf(b.id).completed || []).length, n = b.pageCount || Math.max(1, Math.round((b.chars || 0) / 330));
      loadFont(fontById(b.font), b.title + b.author);
      return `<a class="tb-sb${b.id === cur.id ? " on" : ""}" href="#/read/${encodeURIComponent(b.id)}"${b.id === cur.id ? ' aria-current="page"' : ""}><span class="tb-sb-c${b.cover ? " has-img" : ""}" style="--c:${esc(b.color || "#5f6f6e")};--ci:${esc(b.ink || "#fff")};font-family:${esc(stackOf(b.font))}">${b.cover ? `<img src="${coverImg(b)}" alt="" loading="lazy">` : esc(Array.from(b.title)[0] || "·")}</span><span><b>${esc(b.title)}</b><small>${done}/${n}쪽 · ${b.lang === "en" ? "English" : "한국어"}</small></span></a>`;
    }).join("");
  }
  function renderMini() {
    $("tbDoneN").textContent = state.books.reduce((n, b) => n + ((progressOf(b.id).completed || []).length), 0);
    $("tbStreakN").textContent = streak();
  }

  // ---------- 서가 ----------
  const coverImg = (b) => (b.cover ? `img/typing/${encodeURIComponent(b.id)}.webp?v=${esc(String(b.cover))}` : ""); // 생성 표지가 있으면 그림으로
  function cover(b, big) {
    const f = fontById(b.font);
    if (b.cover) return `<span class="tb-cv has-img${big ? " big" : ""}" style="--c:${esc(b.color || "#444")}"><img src="${coverImg(b)}" alt="${esc(b.title)} 표지" loading="lazy" decoding="async"></span>`;
    return `<span class="tb-cv${big ? " big" : ""}" style="--c:${esc(b.color || "#444")};--ci:${esc(b.ink || "#fff")}"><span class="tb-cv-t" style="font-family:${f ? esc(stackOf(b.font)) : "inherit"}">${esc(b.title)}</span><span class="tb-cv-a">${esc(b.author)}</span>${b.year && b.year < 2000 ? `<i>${b.year}</i>` : ""}</span>`;
  }
  function bookCard(b) {
    const p = progressOf(b.id); const done = (p.completed || []).length; const n = b.pageCount || Math.max(1, Math.round((b.chars || 0) / 330)); // 열기 전에는 글자 수로 어림
    const pct = b.pageCount ? Math.round(done / b.pageCount * 100) : 0;
    return `<a class="tb-card" href="#/read/${encodeURIComponent(b.id)}">${cover(b)}<span class="tb-cm"><b>${esc(b.title)}</b><small>${esc(b.author)} · ${b.nparts > 1 ? `${b.nparts}${b.poem ? "편" : "장"} · ` : ""}${(b.chars || 0) >= 10000 ? `${Math.round(b.chars / 10000).toLocaleString()}만` : (b.chars || 0).toLocaleString()}자 · ${b.pageCount ? "" : "약 "}${n.toLocaleString()}쪽</small>
      <span class="tb-cprog"><i style="width:${pct}%"></i></span><span class="tb-cgo">${done ? (pct >= 100 ? "완필 ✓ 다시 쓰기" : `이어 쓰기 · ${done}/${n}쪽`) : "필사 시작"}<em>→</em></span></span></a>`;
  }
  function renderShelf() {
    const themes = state.index.themes.map((t) => `<section class="tb-theme"><div class="tb-th-h"><div><p class="tb-kick">${esc(t.kicker)}</p><h2>${esc(t.title)}</h2><p class="note">${esc(t.desc)}</p></div><span class="tb-th-n">${t.books.length}편</span></div>
      <div class="tb-row">${t.books.map((b) => bookCard(state.books.find((x) => x.id === b.id) || b)).join("")}</div></section>`);
    const mine = state.books.filter((b) => b.imported);
    if (mine.length) themes.unshift(`<section class="tb-theme"><div class="tb-th-h"><div><p class="tb-kick">MY SHELF</p><h2>내가 가져온 글</h2><p class="note">이 브라우저에만 보관됩니다</p></div></div><div class="tb-row">${mine.map(bookCard).join("")}</div></section>`);
    const going = state.books.filter((b) => !b.imported && (progressOf(b.id).completed || []).length && (progressOf(b.id).completed || []).length < (b.pageCount || 1e9));
    if (going.length) themes.unshift(`<section class="tb-theme"><div class="tb-th-h"><div><p class="tb-kick">CONTINUE</p><h2>이어 쓰는 중</h2><p class="note">쓰다 만 작품을 이어서</p></div><span class="tb-th-n">${going.length}편</span></div><div class="tb-row">${going.map(bookCard).join("")}</div></section>`);
    $("tbThemes").innerHTML = themes.join("");
    renderLib();
    state.index.themes.forEach((t) => t.books.forEach((b) => loadFont(fontById(b.font), b.title + b.author))); // 표지 글자만
    renderMe();
  }

  // ---------- 전체 서가(검색·갈래·작가) ----------
  const CATS = [["all", "전체"], ["소설", "소설"], ["시", "시"], ["수필", "수필"], ["동화", "동화·동요"], ["en", "English"]];
  const lib = { q: "", cat: "all", author: "", shown: 24 };
  const catOf = (b) => b.cat || (b.poem ? "시" : "소설");
  function initLib() {
    $("tbLibN").textContent = `${state.books.filter((b) => !b.imported).length}권`;
    $("tbCats").innerHTML = CATS.map(([k, n]) => `<button type="button" data-cat="${k}"${k === "all" ? ' class="on"' : ""}>${n}</button>`).join("");
    const authors = [...new Set(state.books.filter((b) => !b.imported && b.author !== "필사독서 예문").map((b) => b.author))];
    const ko = authors.filter((a) => /[가-힣]/.test(a)).sort((a, b) => a.localeCompare(b, "ko")), en = authors.filter((a) => !/[가-힣]/.test(a)).sort();
    $("tbAuthorSel").innerHTML = `<option value="">모든 작가</option><optgroup label="한국">${ko.map((a) => `<option>${esc(a)}</option>`).join("")}</optgroup><optgroup label="English">${en.map((a) => `<option>${esc(a)}</option>`).join("")}</optgroup>`;
  }
  function renderLib() {
    const q = lib.q.trim().toLowerCase().replace(/\s+/g, "");
    const order = { 소설: 0, 시: 1, 수필: 2, 동화: 3 };
    const list = state.books.filter((b) => !b.imported && b.author !== "필사독서 예문" &&
      (lib.cat === "all" || (lib.cat === "en" ? b.lang === "en" : b.lang !== "en" && catOf(b) === lib.cat)) &&
      (!lib.author || b.author === lib.author) &&
      (!q || (b.title + b.author).toLowerCase().replace(/\s+/g, "").includes(q)))
      .sort((a, b) => (a.lang === "en") - (b.lang === "en") || (order[catOf(a)] ?? 9) - (order[catOf(b)] ?? 9) || a.author.localeCompare(b.author, "ko") || a.title.localeCompare(b.title, "ko"));
    const vis = list.slice(0, lib.shown);
    $("tbGrid").innerHTML = vis.length ? vis.map(bookCard).join("") : `<p class="tb-empty">찾는 작품이 없습니다. 다른 이름으로 검색해 보세요.</p>`;
    vis.forEach((b) => loadFont(fontById(b.font), b.title + b.author));
    $("tbMore").hidden = list.length <= lib.shown; $("tbMore").textContent = `더 보기 (${(list.length - lib.shown).toLocaleString()}권 더)`;
  }

  // ---------- 책 열기 ----------
  async function getBook(id) {
    let b = state.books.find((x) => x.id === id); if (!b) return null;
    if (!b.text && !b.parts) { const j = await fetch(`data/typing/${encodeURIComponent(id)}.json?v=${state.index.updated || 1}`).then((r) => (r.ok ? r.json() : null)).catch(() => null); if (!j) return null; Object.assign(b, j); }
    if (!b.pages) prepare(b);
    return b;
  }
  function prepare(b) {
    {
      // 장(시집의 시 한 편, 소설의 한 장)마다 새 쪽에서 시작
      const parts = b.parts || [{ t: "", x: b.text }];
      b.pages = []; b.partStart = []; b.pagePart = [];
      parts.forEach((pt, i) => { const ps = paginate(pt.x, b.poem); b.partStart.push(b.pages.length); ps.forEach((x) => { b.pages.push(x); b.pagePart.push(i); }); });
      b.partTitles = parts.map((pt, i) => pt.t || (parts.length > 1 ? `${i + 1}` : ""));
      b.lens = b.pages.map((x) => chars(x).length); b.total = b.lens.reduce((a, c) => a + c, 0);
      b.pageCount = b.pages.length; if (!b.imported) writeJSON(`pc:${b.id}`, b.pageCount); // 쪽 수는 본문을 받아야 알 수 있어 기억(서가 '3/12쪽' 표시용)
    }
    return b;
  }
  async function openBook(id) {
    const b = await getBook(id); if (!b || !b.pages.length) { toast("이 글을 불러오지 못했습니다."); location.hash = "#/"; return; }
    if (state.book && state.book !== b) storeProgress();
    state.book = b; const p = progressOf(b.id);
    state.completed = new Set((p.completed || []).filter((i) => Number.isInteger(i) && i >= 0 && i < b.pages.length));
    state.drafts = p.drafts && typeof p.drafts === "object" ? p.drafts : {}; state.metrics = p.metrics && typeof p.metrics === "object" ? p.metrics : {};
    const fs = readJSON(`fonts:${b.id}`, null);
    // 기본: 원문 KoPub World 바탕체, 필사 프리텐다드(운영자 지정). 직접 고른 글꼴은 책마다 기억
    state.fontO = (fs && fontById(fs.o) && fs.o) || (fontById("k-kopubworldbatang") ? "k-kopubworldbatang" : "gowun-batang");
    state.fontW = (fs && fontById(fs.w) && fs.w) || (fontById("k-pretendard") ? "k-pretendard" : "noto-sans-kr");
    $("tbTitle").textContent = b.title; $("tbAuthor").textContent = b.author + (b.year && b.year < 2000 ? ` · ${b.year}` : "");
    $("tbSource").hidden = !b.source; if (b.source) { $("tbSource").href = b.source; $("tbSource").title = b.license || ""; }
    $("tbKbLang").textContent = b.lang === "en" ? "영문 QWERTY" : "두벌식";
    fillFontSelects(); applyFonts(); renderKeys(b.lang === "en"); fillToc();
    $("tbShelf").hidden = true; $("tbRead").hidden = false; document.title = `${b.title} 필사 — LETSUM 필사독서`; $("tbCrumb").textContent = b.title;
    loadPage(Math.max(0, Math.min(b.pages.length - 1, Number(p.index) || 0)), false);
    renderSide(); renderMini();
    scrollTo(0, 0); $("tbInput").focus({ preventScroll: true });
  }
  function showShelf() { if (state.book) storeProgress(); $("tbRead").hidden = true; $("tbShelf").hidden = false; $("tbCrumb").textContent = "서가"; document.title = "필사독서 — 명작을 따라 쓰는 타이핑 독서 | LETSUM(렛섬)"; renderShelf(); }

  // ---------- 글꼴 고르기 ----------
  function fillFontSelects() {
    const groups = (lang) => { const L = state.fonts[lang]; const cats = [...new Set(L.map((f) => f.cat))];
      return cats.map((c) => `<optgroup label="${lang === "en" ? "영문 " : ""}${esc(c === "고딕" && lang === "en" ? "산세리프" : c === "명조" && lang === "en" ? "세리프" : c)}">${L.filter((f) => f.cat === c).map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("")}</optgroup>`).join(""); };
    const html = state.book.lang === "en" ? groups("en") + groups("ko") : groups("ko") + groups("en");
    $("tbFontO").innerHTML = html; $("tbFontW").innerHTML = html;
    $("tbFontO").value = state.fontO; $("tbFontW").value = state.fontW;
  }
  function applyFonts() {
    loadFont(fontById(state.fontO)); loadFont(fontById(state.fontW));
    $("tbOrig").style.fontFamily = stackOf(state.fontO); $("tbInput").style.fontFamily = stackOf(state.fontW);
    document.documentElement.style.setProperty("--tb-size", state.fontSize + "px");
  }

  // ---------- 목차(장) ----------
  function fillToc() {
    const b = state.book, many = b.partStart.length > 1; $("tbTocWrap").hidden = !many; if (!many) return;
    $("tbToc").innerHTML = b.partTitles.map((t, i) => { const a = b.partStart[i], z = (b.partStart[i + 1] ?? b.pages.length); let d = 0; for (let k = a; k < z; k++) if (state.completed.has(k)) d++;
      return `<option value="${i}">${d >= z - a ? "✓ " : d ? "◐ " : ""}${esc(t)}</option>`; }).join("");
  }
  const partOf = (pg) => state.book.pagePart[pg] || 0;

  // ---------- 쪽 ----------
  function loadPage(i, save = true) {
    const b = state.book; if (!b || i < 0 || i >= b.pages.length) return;
    if (save) storeProgress();
    state.page = i; const m = state.metrics[i] || {};
    state.elapsed = +m.elapsed || 0; state.keystrokes = +m.keystrokes || 0; state.attempts = +m.attempts || 0; state.errors = +m.errors || 0;
    state.started = false; state.lastActivity = 0; state.composing = false;
    state.draft = state.drafts[i] ?? (state.completed.has(i) ? b.pages[i] : "");
    $("tbInput").value = state.draft; refresh(); storeProgress(); carriage();
    if (b.partStart.length > 1) { $("tbToc").value = String(partOf(i)); }
    $("tbPartName").textContent = b.partStart.length > 1 ? b.partTitles[partOf(i)] : "읽기";
  }
  function renderOrig() {
    const host = $("tbOrig"); host.textContent = "";
    const target = chars(state.book.pages[state.page]), typed = chars(state.draft);
    const fr = document.createDocumentFragment();
    for (let i = 0; i < target.length; i++) {
      const c = target[i], s = document.createElement("span");
      if (c === "\n") { s.className = "nl"; s.textContent = "↵"; }
      else s.textContent = c;
      if (i < typed.length) s.classList.add(state.composing && i === typed.length - 1 ? "pend" : same(typed[i], c) ? "ok" : "bad");
      else if (i === typed.length) s.classList.add("cur");
      fr.appendChild(s); if (c === "\n") fr.appendChild(document.createTextNode("\n"));
    }
    host.appendChild(fr);
    const cur = host.querySelector(".cur"); if (cur && host.scrollHeight > host.clientHeight) { const t = cur.offsetTop - host.clientHeight / 2; if (Math.abs(host.scrollTop - t) > host.clientHeight / 3) host.scrollTop = t; }
    const n = state.book.pages.length, done = state.completed.has(state.page) || pageDone(state.draft, state.book.pages[state.page]);
    $("tbCount").textContent = `${typed.length.toLocaleString()} / ${target.length.toLocaleString()}자`;
    $("tbCountBar").style.width = Math.min(100, typed.length / target.length * 100) + "%";
    $("tbPageNoO").textContent = $("tbPageNoW").textContent = fmt(state.page + 1);
    $("tbCur").textContent = state.page + 1; $("tbTot").textContent = n;
    $("tbPrev").disabled = state.page === 0; const reach = Math.max(-1, ...state.completed) + 1; // 완성한 쪽의 바로 다음 쪽까지 이동 가능(명세 FR-07). 새 장의 첫 쪽은 언제든
    $("tbNext").disabled = state.page >= n - 1 || !(done || state.page + 1 <= reach || state.book.partStart.includes(state.page + 1));
    $("tbDots").innerHTML = n <= 24 ? state.book.pages.map((_, k) => `<i class="${k === state.page ? "on" : state.completed.has(k) ? "past" : ""}"></i>`).join("") : "";
    $("tbPoemHint").textContent = target.includes("\n") ? "↵ 자리에서 Enter" : "";
    hintNext(target[typed.length]);
  }
  function percent() {
    const b = state.book; let d = Math.min(chars(state.draft).length, b.lens[state.page]);
    state.completed.forEach((i) => { if (i !== state.page) d += b.lens[i] || 0; });
    const p = b.total ? d / b.total * 100 : 0;
    return p > 0 && p < 1 ? Math.round(p * 10) / 10 : Math.min(100, Math.round(p));
  }
  const acc = () => (state.attempts ? Math.max(0, Math.round((state.attempts - state.errors) / state.attempts * 100)) : 100);
  const cpm = () => (state.elapsed > 0 ? Math.round(Math.max(state.keystrokes, state.attempts) * 60 / state.elapsed) : 0); // 휴대폰 자판은 글쇠 이벤트가 안 오기도 해 확정 글자 수로 보완
  function renderStats() {
    const p = percent(); $("stProg").innerHTML = `${p}<small>%</small>`; $("stTrack").style.width = p + "%";
    $("stCpm").textContent = cpm(); $("stAcc").innerHTML = `${acc()}<small>%</small>`; $("stErr").textContent = `오타 ${state.errors}회`;
    $("stTime").textContent = `${fmt(Math.floor(state.elapsed / 60))}:${fmt(state.elapsed % 60)}`;
  }
  function refresh() { renderOrig(); renderStats(); }

  // ---------- 입력 ----------
  function track(prev, next) {
    if (state.composing) return;
    const a = chars(prev), b = chars(next), t = chars(state.book.pages[state.page]);
    if (b.length > a.length) { // 새로 확정된 글자만 셈(한글 조합 중간 자모는 세지 않음)
      state.attempts += b.length - a.length; let ok = 0;
      for (let i = a.length; i < b.length; i++) if (same(b[i], t[i])) ok++; else state.errors++;
      addDay(ok);
    }
  }
  function onInput() {
    if (!state.book) return;
    const next = $("tbInput").value; if (!state.composing) track(state.draft, next);
    state.draft = next; state.lastActivity = Date.now();
    if (state.draft && !state.started && !state.completed.has(state.page)) state.started = true;
    const lim = chars(state.book.pages[state.page]).length + 200;
    if (chars(state.draft).length > lim) { state.draft = chars(state.draft).slice(0, lim).join(""); $("tbInput").value = state.draft; toast("원문보다 너무 길게 입력해 일부를 잘랐습니다."); }
    refresh(); storeProgress(); carriage(); if (!state.composing) finishCheck();
  }
  function finishCheck() {
    const b = state.book; if (!b || state.composing) return;
    if (!pageDone(state.draft, b.pages[state.page]) || state.completed.has(state.page)) return;
    state.completed.add(state.page); state.started = false;
    const bonus = 40 + Math.floor(acc() / 10); writeJSON("points", (readJSON("points", 0) || 0) + bonus);
    storeProgress(); refresh(); renderSide(); renderMini(); fillToc(); $("tbToc").value = String(partOf(state.page));
    const last = state.page >= b.pages.length - 1, all = state.completed.size >= b.pages.length;
    $("fnCpm").textContent = cpm(); $("fnAcc").textContent = acc() + "%"; $("fnPt").textContent = "+" + bonus;
    $("tbFinishH").textContent = all ? `「${b.title}」${eul(b.title)} 완필했어요!` : "한 쪽을 완성했어요!";
    $("tbFinishD").textContent = all ? "모든 쪽을 손끝으로 완성했습니다. 마음에 남은 한 문장을 이미지로 남겨 보세요." : `${state.page + 1} / ${b.pages.length}쪽 · 서두르지 말고 한 쪽씩 이어 가세요.`;
    $("fnNext").textContent = last ? "서가로 돌아가기" : "다음 쪽 →";
    open("tbFinish");
  }

  // ---------- 가상 키보드 ----------
  const ROWS = [
    [["Backquote", "`", "~"], ["Digit1", "1", "!"], ["Digit2", "2", "@"], ["Digit3", "3", "#"], ["Digit4", "4", "$"], ["Digit5", "5", "%"], ["Digit6", "6", "^"], ["Digit7", "7", "&"], ["Digit8", "8", "*"], ["Digit9", "9", "("], ["Digit0", "0", ")"], ["Minus", "-", "_"], ["Equal", "=", "+"], ["Backspace", "⌫", null, "w2"]],
    [["Tab", "Tab", null, "w15"], ["KeyQ", "Q", "ㅂ"], ["KeyW", "W", "ㅈ"], ["KeyE", "E", "ㄷ"], ["KeyR", "R", "ㄱ"], ["KeyT", "T", "ㅅ"], ["KeyY", "Y", "ㅛ"], ["KeyU", "U", "ㅕ"], ["KeyI", "I", "ㅑ"], ["KeyO", "O", "ㅐ"], ["KeyP", "P", "ㅔ"], ["BracketLeft", "[", "{"], ["BracketRight", "]", "}"], ["Backslash", "\\", "|", "w15"]],
    [["CapsLock", "Caps", null, "w18"], ["KeyA", "A", "ㅁ"], ["KeyS", "S", "ㄴ"], ["KeyD", "D", "ㅇ"], ["KeyF", "F", "ㄹ"], ["KeyG", "G", "ㅎ"], ["KeyH", "H", "ㅗ"], ["KeyJ", "J", "ㅓ"], ["KeyK", "K", "ㅏ"], ["KeyL", "L", "ㅣ"], ["Semicolon", ";", ":"], ["Quote", "'", '"'], ["Enter", "Enter", null, "w22"]],
    [["ShiftLeft", "Shift", null, "w25"], ["KeyZ", "Z", "ㅋ"], ["KeyX", "X", "ㅌ"], ["KeyC", "C", "ㅊ"], ["KeyV", "V", "ㅍ"], ["KeyB", "B", "ㅠ"], ["KeyN", "N", "ㅜ"], ["KeyM", "M", "ㅡ"], ["Comma", ",", "<"], ["Period", ".", ">"], ["Slash", "/", "?"], ["ShiftRight", "Shift", null, "w25"]],
    [["ControlLeft", "Ctrl", null, "w12"], ["AltLeft", "Alt", null, "w12"], ["MetaLeft", "⌘", null, "w12"], ["Space", "", null, "w6"], ["MetaRight", "⌘", null, "w12"], ["AltRight", "한/영", null, "w12"]],
  ];
  const FINGER = (code) => { if (!code.startsWith("Key")) return ""; const l = code.slice(3);
    return "QAZ".includes(l) ? "f1" : "WSX".includes(l) ? "f2" : "EDC".includes(l) ? "f3" : "RTFGVB".includes(l) ? "f4" : "YUHJNM".includes(l) ? "f5" : "IK".includes(l) ? "f6" : "OL".includes(l) ? "f7" : "f8"; };
  function renderKeys(en_) {
    $("tbKeys").innerHTML = ROWS.map((r) => `<div class="tb-kr">${r.map(([code, en, ko, w]) => `<span class="tb-k ${w || ""} ${FINGER(code)} ${code.startsWith("Key") ? "" : "fn"}" data-code="${code}">${code.startsWith("Key") ? (en_ ? `<b>${en}</b><small>${ko}</small>` : `<b>${ko}</b><small>${en}</small>`) : `<b>${esc(en)}</b>`}</span>`).join("")}</div>`).join("");
  }
  // 다음에 칠 글자 → 글쇠(한글은 첫 자모, 쌍자음·ㅒㅖ는 Shift 함께)
  const JAMO_KEY = { "ㅂ": "KeyQ", "ㅈ": "KeyW", "ㄷ": "KeyE", "ㄱ": "KeyR", "ㅅ": "KeyT", "ㅛ": "KeyY", "ㅕ": "KeyU", "ㅑ": "KeyI", "ㅐ": "KeyO", "ㅔ": "KeyP", "ㅁ": "KeyA", "ㄴ": "KeyS", "ㅇ": "KeyD", "ㄹ": "KeyF", "ㅎ": "KeyG", "ㅗ": "KeyH", "ㅓ": "KeyJ", "ㅏ": "KeyK", "ㅣ": "KeyL", "ㅋ": "KeyZ", "ㅌ": "KeyX", "ㅊ": "KeyC", "ㅍ": "KeyV", "ㅠ": "KeyB", "ㅜ": "KeyN", "ㅡ": "KeyM" };
  const SHIFTED = { "ㅃ": "ㅂ", "ㅉ": "ㅈ", "ㄸ": "ㄷ", "ㄲ": "ㄱ", "ㅆ": "ㅅ", "ㅒ": "ㅐ", "ㅖ": "ㅔ" };
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const SYM = { " ": "Space", "\n": "Enter", ",": "Comma", ".": "Period", "/": "Slash", ";": "Semicolon", "'": "Quote", "-": "Minus", "=": "Equal", "[": "BracketLeft", "]": "BracketRight", "`": "Backquote" };
  const SYM_SHIFT = { "!": "Digit1", "?": "Slash", '"': "Quote", ":": "Semicolon", "(": "Digit9", ")": "Digit0", "~": "Backquote", "<": "Comma", ">": "Period", "_": "Minus", "+": "Equal", "@": "Digit2", "#": "Digit3", "%": "Digit5", "&": "Digit7", "*": "Digit8" };
  function keyFor(c) {
    if (c == null) return [];
    c = EQ[c] || c;
    const n = c.charCodeAt(0);
    if (n >= 0xac00 && n <= 0xd7a3) c = CHO[Math.floor((n - 0xac00) / 588)];
    if (SHIFTED[c]) return [JAMO_KEY[SHIFTED[c]], "ShiftLeft"];
    if (JAMO_KEY[c]) return [JAMO_KEY[c]];
    if (/[a-z]/.test(c)) return ["Key" + c.toUpperCase()];
    if (/[A-Z]/.test(c)) return ["Key" + c, "ShiftLeft"];
    if (/[0-9]/.test(c)) return ["Digit" + c];
    if (SYM[c]) return [SYM[c]];
    if (SYM_SHIFT[c]) return [SYM_SHIFT[c], "ShiftLeft"];
    return [];
  }
  function hintNext(c) { document.querySelectorAll(".tb-k.next").forEach((k) => k.classList.remove("next")); keyFor(c).forEach((code) => document.querySelector(`.tb-k[data-code="${code}"]`)?.classList.add("next")); }
  const press = (code, on) => document.querySelector(`.tb-k[data-code="${code}"]`)?.classList.toggle("down", on);

  // ---------- 가져오기 ----------
  function hashText(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
  function addBook(title, author, text, save, poem) {
    text = normalize(text).trim(); if (chars(text).length < 10) throw new Error("본문은 10자 이상이어야 합니다.");
    if (chars(text).length > MAX_TEXT_CHARS) { text = chars(text).slice(0, MAX_TEXT_CHARS).join(""); toast("긴 글은 50만 자까지만 불러왔습니다."); }
    const id = "import-" + hashText(title + "\u0000" + text);
    let b = state.books.find((x) => x.id === id);
    if (!b) {
      b = { id, title: title || "제목 없는 글", author: author || "내가 가져온 글", text, lang: /[가-힣]/.test(text) ? "ko" : "en", poem: !!poem, color: "#5f6f6e", font: /[가-힣]/.test(text) ? "nanum-myeongjo" : "e-lora", imported: true, chars: chars(text).length };
      prepare(b); if (!b.pages.length) throw new Error("필사할 수 있는 본문이 없습니다.");
      state.books.push(b);
      if (save && text.length <= 120000) { const sv = readJSON("imports", []).filter((x) => x.id !== id); sv.push({ id, title: b.title, author: b.author, lang: b.lang, poem: b.poem, color: b.color, font: b.font, text }); if (!writeJSON("imports", sv)) toast("이 글은 다음 방문 때 다시 가져와야 합니다."); }
      else toast("큰 글은 진행 기록만 보관합니다. 다음 방문 때 파일을 다시 가져오세요.");
    }
    close("tbImport"); location.hash = "#/read/" + encodeURIComponent(id); toast(`「${b.title}」${eul(b.title)} 서가에 넣었습니다.`);
  }
  const zipPath = (base, rel) => { const st = (base ? base.split("/") : []).filter(Boolean); for (const s of rel.split("/")) { if (s === "..") st.pop(); else if (s && s !== ".") st.push(s); } return st.join("/"); };
  const readXML = (x) => { const d = new DOMParser().parseFromString(x, "application/xml"); if (d.querySelector("parsererror")) throw new Error("EPUB 안의 문서를 읽지 못했습니다."); return d; };
  function needZip() { return window.JSZip ? Promise.resolve() : new Promise((r, j) => { const s = document.createElement("script"); s.src = "js/jszip.min.js?v=3.10.1"; s.onload = r; s.onerror = () => j(new Error("EPUB 처리 도구를 불러오지 못했습니다.")); document.head.appendChild(s); }); }
  async function importEPUB(file) {
    await needZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const c = zip.file("META-INF/container.xml"); if (!c) throw new Error("올바른 EPUB이 아닙니다(container.xml 없음).");
    const root = readXML(await c.async("string")).getElementsByTagName("rootfile")[0]; if (!root) throw new Error("EPUB 목차 정보가 없습니다.");
    const opfPath = root.getAttribute("full-path"); const opf = zip.file(opfPath); if (!opf) throw new Error("EPUB OPF 파일이 없습니다.");
    const doc = readXML(await opf.async("string"));
    const title = doc.getElementsByTagNameNS("*", "title")[0]?.textContent?.trim() || file.name.replace(/\.epub$/i, "");
    const author = doc.getElementsByTagNameNS("*", "creator")[0]?.textContent?.trim() || "EPUB 가져오기";
    const man = new Map([...doc.getElementsByTagName("item")].map((it) => [it.getAttribute("id"), { href: it.getAttribute("href"), type: it.getAttribute("media-type") }]));
    const folder = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : ""; const out = []; let len = 0;
    for (const ref of doc.getElementsByTagName("itemref")) {
      const e = man.get(ref.getAttribute("idref")); if (!e || !e.href || !/html|xhtml/.test(e.type || "")) continue;
      const f = zip.file(zipPath(folder, decodeURIComponent(e.href.split("#")[0]))); if (!f) continue;
      const mk = await f.async("string"); let ch = new DOMParser().parseFromString(mk, "application/xhtml+xml"); if (ch.querySelector("parsererror")) ch = new DOMParser().parseFromString(mk, "text/html");
      const body = ch.querySelector("body"); if (!body) continue; body.querySelectorAll("script,style,noscript,svg,math").forEach((x) => x.remove()); const paras = []; // textContent만 — 가져온 HTML·스크립트는 실행하지 않음
      for (const n of body.querySelectorAll("h1,h2,h3,h4,p,li,blockquote")) { if (n.matches("blockquote") && n.querySelector("p")) continue; if (n.closest("nav,aside,script,style")) continue; const s = (n.textContent || "").replace(/\s+/g, " ").trim(); if (s.length > 1) paras.push(s); }
      if (paras.length) { const t = paras.join("\n\n"); out.push(t); len += t.length; } if (len > MAX_TEXT_CHARS) break;
    }
    if (!out.length) throw new Error("EPUB에서 필사할 문장을 찾지 못했습니다(DRM 보호 파일은 지원하지 않음).");
    addBook(title, author, out.join("\n\n"), true);
  }
  async function importFile(file) {
    if (!file) return; if (file.size > MAX_FILE_BYTES) throw new Error("10MB 이하 파일만 가져올 수 있습니다.");
    if (/\.epub$/i.test(file.name)) return importEPUB(file);
    if (!/\.(txt|md|markdown)$/i.test(file.name)) throw new Error("TXT·MD·EPUB 파일만 가져올 수 있습니다.");
    const buf = await file.arrayBuffer(); let t = new TextDecoder("utf-8").decode(buf);
    if (t.includes("�")) { const k = new TextDecoder("euc-kr").decode(buf); if ((k.match(/�/g) || []).length < (t.match(/�/g) || []).length) t = k; }
    if (/\.(md|markdown)$/i.test(file.name)) t = t.replace(/^---\n[\s\S]*?\n---\s*/, "").replace(/^#{1,6}\s+/gm, "").replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*|__/g, "").replace(/^>\s?/gm, "");
    addBook(file.name.replace(/\.(txt|md|markdown)$/i, ""), "내가 가져온 글", t, true);
  }

  // ---------- 창 ----------
  function open(id) { $(id).hidden = false; const f = id === "tbFinish" ? $("fnNext") : $(id).querySelector(".tb-modal button:not(.x), .tb-modal input"); f?.focus(); }
  function close(id) { $(id).hidden = true; if (id === "tbFinish" && state.book) $("tbInput").focus({ preventScroll: true }); }
  function shotPage() {
    const b = state.book; const text = b.pages[state.page]; const f = fontById(state.fontW);
    const excerpt = text.length > 260 ? chars(text).slice(0, 250).join("").replace(/\s\S*$/, "") + " …" : text;
    LSShot.open({ title: `${b.title} 필사 — LETSUM`, file: `letsum-pilsa-${b.id}-${state.page + 1}`, w: 1080, h: 1350, badge: "필사 완료",
      blocks: [{ t: "gap", h: 20 }, { t: "kicker", text: `${b.title} · ${b.author}`, size: 28, after: 28 },
        { t: "text", text: excerpt, family: stackOf(state.fontW), size: 54, min: 30, maxLines: 12, lh: 1.55, after: 20 },
        { t: "rule" }, { t: "meta", text: [`${state.page + 1} / ${b.pages.length}쪽`, `정확도 ${acc()}%`, cpm() ? `분당 ${cpm()}타` : "", `연속 ${streak()}일째`].filter(Boolean).join(" · "), size: 26, weight: 600, color: "#141413", after: 6 },
        { t: "meta", text: `필사 글꼴 ${f ? f.name : "기본"} — LETSUM 무료 폰트`, size: 24, after: 6 }],
      footer: "읽는 것을 넘어, 쓰는 독서 — LETSUM 필사독서", url: "letsum.app/typing", shareText: `「${b.title}」 ${state.page + 1}쪽 필사 완료 — LETSUM 필사독서` });
  }

  // ---------- 이벤트 ----------
  function bind() {
    const inp = $("tbInput");
    inp.addEventListener("compositionstart", () => { state.composing = true; });
    inp.addEventListener("compositionend", () => {
      state.composing = false; // 조합이 끝난 한 음절을 한 번의 시도로(중간 자모는 오타로 세지 않음)
      state.draft = inp.value; // 브라우저마다 input·compositionend 순서가 달라 실제 값으로 판정
      const t = chars(state.book.pages[state.page]); const e = chars(inp.value.slice(0, inp.selectionStart)).length;
      if (e > 0 && e <= t.length) { state.attempts++; if (same(chars(inp.value)[e - 1], t[e - 1])) addDay(1); else state.errors++; }
      refresh(); storeProgress(); finishCheck();
    });
    inp.addEventListener("input", onInput);
    inp.addEventListener("paste", (e) => { e.preventDefault(); toast("필사에서는 붙여 넣기를 쓸 수 없어요. 직접 입력해 주세요."); });
    inp.addEventListener("drop", (e) => e.preventDefault());
    inp.addEventListener("keydown", (e) => { if (isRetro() && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key.length === 1 || ["Enter", "Backspace", "Process", "Unidentified"].includes(e.key))) { clack(e.key === "Process" || e.key === "Unidentified" ? "x" : e.key); strike(); }
      if (e.key === "Tab") { e.preventDefault(); } if (!e.repeat && (e.key.length === 1 || e.key === "Enter" || e.isComposing || e.key === "Process" || e.key === "Unidentified")) state.keystrokes++; });
    document.addEventListener("keydown", (e) => { press(e.code, true); if (e.key === "Escape") ["tbImport", "tbHelp", "tbFinish"].forEach((id) => { if (!$(id).hidden) close(id); }); });
    document.addEventListener("keyup", (e) => press(e.code, false));
    addEventListener("blur", () => document.querySelectorAll(".tb-k.down").forEach((k) => k.classList.remove("down")));
    $("tbOrig").addEventListener("click", () => inp.focus());
    $("tbPrev").addEventListener("click", () => loadPage(state.page - 1));
    $("tbNext").addEventListener("click", () => loadPage(state.page + 1));
    $("tbReset").addEventListener("click", () => { if (!confirm("이 쪽에 입력한 내용만 지울까요? (완성 기록은 남습니다)")) return; Object.assign(state, { draft: "", elapsed: 0, keystrokes: 0, attempts: 0, errors: 0, started: false }); state.drafts[state.page] = ""; inp.value = ""; refresh(); storeProgress(); inp.focus(); });
    $("tbMinus").addEventListener("click", () => { state.fontSize = Math.max(14, state.fontSize - 2); writeJSON("font", state.fontSize); applyFonts(); });
    $("tbPlus").addEventListener("click", () => { state.fontSize = Math.min(34, state.fontSize + 2); writeJSON("font", state.fontSize); applyFonts(); });
    $("tbFontO").addEventListener("change", (e) => { state.fontO = e.target.value; writeJSON(`fonts:${state.book.id}`, { o: state.fontO, w: state.fontW }); applyFonts(); });
    $("tbFontW").addEventListener("change", (e) => { state.fontW = e.target.value; writeJSON(`fonts:${state.book.id}`, { o: state.fontO, w: state.fontW }); applyFonts(); inp.focus(); });
    $("tbFinger").addEventListener("click", () => { state.finger = !state.finger; $("tbKeys").classList.toggle("fg", state.finger); $("tbFinger").setAttribute("aria-pressed", state.finger); $("tbFinger").querySelector("span").textContent = state.finger ? "ON" : "OFF"; writeJSON("finger", state.finger); });
    $("tbKbToggle").addEventListener("click", () => { state.kb = !state.kb; $("tbKeys").hidden = !state.kb; $("tbKbToggle").setAttribute("aria-pressed", state.kb); $("tbKbToggle").querySelector("span").textContent = state.kb ? "ON" : "OFF"; writeJSON("kb", state.kb); });
    ["tbImportOpen", "tbImportTop", "tbSideAdd"].forEach((id) => $(id).addEventListener("click", () => open("tbImport")));
    document.querySelectorAll(".tb-skin [data-skin]").forEach((b) => b.addEventListener("click", () => applySkin(b.dataset.skin)));
    $("tbHelpOpen").addEventListener("click", () => open("tbHelp"));
    $("tbStart").addEventListener("click", () => { const L = state.index.themes.find((t) => t.id === "poems").books; const pick = L.find((b) => !(progressOf(b.id).completed || []).length) || L[Math.floor(Math.random() * L.length)]; location.hash = "#/read/" + pick.id; });
    $("tbContinue").addEventListener("click", () => { const l = readJSON("last", ""); if (l) location.hash = "#/read/" + encodeURIComponent(l); });
    document.querySelectorAll(".tb-ov").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o || e.target.closest("[data-close]")) close(o.id); }));
    document.querySelectorAll("#tbImport [data-tab]").forEach((b) => b.addEventListener("click", () => { document.querySelectorAll("#tbImport [data-tab]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("#tbImport [data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab)); }));
    $("tbPCreate").addEventListener("click", () => { try { addBook($("tbPTitle").value.trim() || "나의 필사 노트", $("tbPAuthor").value.trim() || "직접 입력", $("tbPText").value, true, $("tbPPoem").checked); } catch (e) { toast(e.message); } });
    $("tbToc").addEventListener("change", (e) => { loadPage(state.book.partStart[+e.target.value]); $("tbInput").focus({ preventScroll: true }); });
    let qT = 0; $("tbQ").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { lib.q = e.target.value; lib.shown = 24; renderLib(); }, 150); });
    $("tbCats").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; lib.cat = b.dataset.cat; lib.shown = 24; $("tbCats").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); renderLib(); });
    $("tbAuthorSel").addEventListener("change", (e) => { lib.author = e.target.value; lib.shown = 24; renderLib(); });
    $("tbMore").addEventListener("click", () => { lib.shown += 48; renderLib(); });
    $("tbSound").addEventListener("change", (e) => { retro.sound = e.target.checked; writeJSON("retro", retro); });
    $("tbVolume").addEventListener("input", (e) => { retro.volume = +e.target.value; writeJSON("retro", retro); });
    $("tbVolume").addEventListener("change", () => clack("x"));
    $("tbPaper").addEventListener("change", (e) => { retro.paper = e.target.value; writeJSON("retro", retro); applyRetro(); });
    $("tbPrint").addEventListener("click", printPages);
    inp.addEventListener("click", carriage); inp.addEventListener("keyup", carriage);
    $("tbFile").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; $("tbFileNote").textContent = "파일을 읽는 중…"; try { await importFile(f); $("tbFileNote").textContent = ""; } catch (err) { $("tbFileNote").textContent = err.message; toast(err.message); } finally { e.target.value = ""; } });
    $("fnClose").addEventListener("click", () => close("tbFinish"));
    $("fnNext").addEventListener("click", () => { close("tbFinish"); if (state.page < state.book.pages.length - 1) loadPage(state.page + 1); else location.hash = "#/"; });
    $("fnShot").addEventListener("click", shotPage);
    document.addEventListener("visibilitychange", () => { if (document.hidden) { state.started = false; storeProgress(); } });
    addEventListener("beforeunload", storeProgress);
    addEventListener("hashchange", route);
  }
  function route() {
    const m = location.hash.match(/^#\/read\/(.+)$/);
    if (m) openBook(decodeURIComponent(m[1])); else showShelf();
  }

  // ---------- 시작 ----------
  async function init() {
    applyRetro();
    applySkin(new URLSearchParams(location.search).get("skin") || readJSON("skin2", "")); // ?skin=ink 처럼 주소로도 고름
    const [idx, fonts] = await Promise.all([fetch("data/typing/index.json?v=2").then((r) => r.json()), fetch("data/typing/fonts.json?v=1").then((r) => r.json()).catch(() => ({ ko: [], en: [] }))]);
    state.index = idx; state.fonts = fonts;
    const seen = new Set();
    state.books = [...idx.themes.flatMap((t) => t.books.map((b) => ({ ...b, pick: true }))), ...(idx.library || [])]
      .filter((b) => !seen.has(b.id) && seen.add(b.id)).map((b) => ({ ...b, pageCount: readJSON(`pc:${b.id}`, null) }));
    for (const b of readJSON("imports", [])) if (b && b.id && b.text && !state.books.some((x) => x.id === b.id)) state.books.push(prepare({ ...b, imported: true, chars: chars(b.text).length }));
    initLib();
    state.fontSize = Math.max(14, Math.min(34, +readJSON("font", 18) || 18)); state.finger = readJSON("finger", false) === true; state.kb = readJSON("kb", true) !== false;
    renderKeys(); $("tbKeys").classList.toggle("fg", state.finger); $("tbFinger").querySelector("span").textContent = state.finger ? "ON" : "OFF";
    $("tbKeys").hidden = !state.kb; $("tbKbToggle").querySelector("span").textContent = state.kb ? "ON" : "OFF";
    bind(); route();
    setInterval(() => { if (state.book && state.started && !$("tbRead").hidden && document.visibilityState === "visible" && Date.now() - state.lastActivity <= 10000 && !state.completed.has(state.page)) { state.elapsed++; renderStats(); if (state.elapsed % 5 === 0) storeProgress(); } }, 1000);
  }
  init().catch((e) => { $("tbThemes").innerHTML = `<p class="note">서가를 불러오지 못했습니다. 새로고침해 주세요. (${esc(e.message)})</p>`; });
})();
