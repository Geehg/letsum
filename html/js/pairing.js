// LETSUM 폰트 조합 — 제목·본문 × 한글·영문 4칸, 혼용(한 문장 안에서 영문·숫자만 영문 폰트), 견본 5종, 영문 크기 맞춤, 조합 사용 범위, CSS, 공유 링크, 규칙 기반 추천
// 데이터: data.js(FONTS 한글) + data_en.js(FONTS_EN 영문). 서버로 보내는 것 없음(마지막 조합만 이 브라우저에 저장).
(function () {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const KO = FONTS.filter((f) => !f.intro), EN = (typeof FONTS_EN !== "undefined" ? FONTS_EN : []).filter((f) => !f.intro);
  const ALL = [...KO, ...EN]; const byId = Object.fromEntries(ALL.map((f) => [f.id, f]));
  const label = (f) => `${f.name}${f.en && f.en !== f.name ? ` (${f.en})` : ""}`;
  const byLabel = Object.fromEntries(ALL.map((f) => [label(f), f]));
  const famName = (f) => f.family.split(",")[0].replace(/['"]/g, "").trim();
  const gen = (f) => (f.family.split(",").slice(1).join(",").trim() || "sans-serif");
  const commercial = (f) => (f.matrix || {}).print === "ok" && (f.matrix || {}).web === "ok";
  let toastT = 0; const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1500); };
  const copy = async (t, m) => { try { await navigator.clipboard.writeText(t); } catch (e) { prompt("복사하세요", t); return; } toast(m || "복사됨"); };

  // ---------- 폰트 불러오기: 미리보기 웹폰트는 FontFace, Google Fonts 한글은 CSS 링크. 영문은 크기 보정(size-adjust)한 별도 이름으로도 ----------
  const loaded = {};
  function load(f, w) {
    if (!f) return Promise.resolve();
    const key = f.id + "|" + w; if (loaded[key]) return loaded[key];
    if (f.webfont) {
      const ws = Object.keys(f.webfont).map(Number); const ww = ws.includes(w) ? w : ws.reduce((p, c) => Math.abs(c - w) < Math.abs(p - w) ? c : p);
      const u = f.webfont[ww]; const fmt = /\.otf(\?|$)/.test(u) ? "opentype" : /\.ttf(\?|$)/.test(u) ? "truetype" : /\.woff(\?|$)/.test(u) ? "woff" : "woff2";
      const face = new FontFace(famName(f), `url("${u}") format("${fmt}")`, { weight: String(w), display: "swap" });
      document.fonts.add(face); return (loaded[key] = face.load().catch(() => {}));
    }
    const l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + f.en.replace(/ /g, "+") + ":wght@" + f.weights.join(";") + "&display=swap"; document.head.appendChild(l);
    return (loaded[key] = new Promise((r) => { l.onload = () => document.fonts.load(`${w} 20px "${famName(f)}"`).then(r, r); l.onerror = r; setTimeout(r, 6000); }));
  }
  // 영문 크기 보정: 같은 파일을 'LSP-<id>-<n>'이라는 이름으로 sizeAdjust를 줘서 다시 선언(영문 글자만 커지거나 작아짐)
  const adjDone = {};
  function adjFam(f, w, pct) {
    if (!f || pct === 100 || !f.webfont) return f ? `'${famName(f)}'` : "";
    const name = `LSP-${f.id}-${pct}`; const key = name + "|" + w;
    if (!adjDone[key]) {
      const ws = Object.keys(f.webfont).map(Number); const ww = ws.includes(w) ? w : ws.reduce((p, c) => Math.abs(c - w) < Math.abs(p - w) ? c : p);
      const face = new FontFace(name, `url("${f.webfont[ww]}")`, { weight: String(w), sizeAdjust: pct + "%", display: "swap" });
      document.fonts.add(face); adjDone[key] = face.load().then(() => draw()).catch(() => {});
    }
    return `'${name}'`;
  }
  // 한글 높이에 맞춤: '한'의 잉크 높이 ÷ 'H'의 잉크 높이(브라우저 캔버스 측정)
  async function fit(role) {
    const s = S[role]; const ko = byId[s.ko], en = byId[s.en]; if (!ko || !en) return toast("영문 폰트를 먼저 고르세요");
    await Promise.all([load(ko, s.w), load(en, s.w)]); await document.fonts.ready;
    const c = document.createElement("canvas").getContext("2d");
    const h = (fam, ch) => { c.font = `${s.w} 200px '${fam}'`; const m = c.measureText(ch); return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent; };
    // 기준: 한글 폰트에 원래 들어 있는 영문 대문자 높이(그 폰트 디자이너가 한글과 어울리게 맞춘 크기)
    const r = h(famName(ko), "H") / h(famName(en), "H");
    if (!isFinite(r) || r <= 0) return toast("측정하지 못했습니다");
    s.adj = Math.max(80, Math.min(125, Math.round(r * 100))); sync(); draw(); toast(`영문 크기 ${s.adj}% — ${byId[s.ko].name}에 들어 있는 영문과 같은 높이`);
  }

  // ---------- 상태 ----------
  const DEF = { t: { ko: "k-pretendard", en: "e-inter", w: 700, adj: 100 }, b: { ko: "noto-serif-kr", en: "e-lora", w: 400, adj: 100 },
    tt: "Seoul Design Week 2026, 서울의 가을을 걷다", bt: "올해 서울디자인위크는 10월 24일부터 11월 2일까지 DDP와 성수동 일대에서 열립니다. 120여 개 스튜디오가 참여하고, Type & Space 전시에서는 한글과 Latin 글꼴의 조화를 주제로 한 작업 36점을 소개합니다. 입장료는 15,000원이며 사전 예약 시 20% 할인됩니다." };
  let S = JSON.parse(JSON.stringify(DEF)), layout = "mag";
  (function init() {
    const q = new URLSearchParams(location.search);
    try { const L = JSON.parse(localStorage.getItem("ls_pair") || "null"); if (L && L.t && L.b) S = Object.assign(S, L); } catch (e) {}
    const sp = (v) => (v || "").split(",");
    if (q.get("t")) { const [ko, en, w, adj] = sp(q.get("t")); S.t = { ko, en: en || "", w: +w || 700, adj: +adj || 100 }; }
    if (q.get("b")) { const [ko, en, w, adj] = sp(q.get("b")); S.b = { ko, en: en || "", w: +w || 400, adj: +adj || 100 }; }
    if (q.get("f")) { const f = byId[q.get("f")]; if (f) { if (f.id.startsWith("e-")) S.t.en = f.id; else S.t.ko = f.id; } } // 상세 화면의 '이 폰트로 조합 만들기'
    if (q.get("l")) layout = q.get("l");
    ["t", "b"].forEach((r) => { if (!byId[S[r].ko] || S[r].ko.startsWith("e-")) S[r].ko = DEF[r].ko; if (S[r].en && !byId[S[r].en]) S[r].en = ""; });
  })();

  $("#koList").innerHTML = KO.map((f) => `<option value="${esc(label(f))}">`).join("");
  $("#enList").innerHTML = EN.map((f) => `<option value="${esc(label(f))}">`).join("");

  function weightsOf(role) { const s = S[role]; const a = new Set(byId[s.ko].weights); if (byId[s.en]) byId[s.en].weights.forEach((w) => a.add(w)); return [...a].sort((x, y) => x - y); }
  function sync() {
    for (const r of ["t", "b"]) {
      const s = S[r];
      $(`#${r}Ko`).value = label(byId[s.ko]); $(`#${r}En`).value = s.en ? label(byId[s.en]) : "";
      const ws = weightsOf(r); if (!ws.includes(s.w)) s.w = ws.reduce((p, c) => Math.abs(c - s.w) < Math.abs(p - s.w) ? c : p);
      $(`#${r}W`).innerHTML = ws.map((w) => `<option value="${w}"${w === s.w ? " selected" : ""}>${w}</option>`).join("");
      $(`#${r}Adj`).value = s.adj; $(`#${r}AdjV`).textContent = s.adj + "%"; $(`#${r}Adj`).disabled = $(`#${r}Fit`).disabled = !s.en;
    }
    $("#tTxt").value = S.tt; $("#bTxt").value = S.bt;
    $$("#layoutSeg button").forEach((b) => b.classList.toggle("on", b.dataset.l === layout));
  }
  // 영문을 앞에 두고 한글을 뒤에: 브라우저는 영문 폰트에 없는 한글 글자만 다음 폰트(한글)로 그린다
  const stack = (r) => { const s = S[r]; const ko = byId[s.ko], en = byId[s.en]; return [en ? adjFam(en, s.w, s.adj) : "", `'${famName(ko)}'`, gen(ko)].filter(Boolean).join(", "); };

  // ---------- 견본 ----------
  const P = (t) => esc(t).replace(/\n/g, "<br>");
  function draw() {
    const T = `font-family:${stack("t")};font-weight:${S.t.w}`, B = `font-family:${stack("b")};font-weight:${S.b.w}`;
    const tt = P(S.tt || "제목"), bt = P(S.bt || "본문");
    const L = {
      mag: `<article class="pv-mag"><div class="k" style="${B}">FEATURE · 2026 AUTUMN</div><h3 style="${T}">${tt}</h3><p class="dek" style="${B}">글·사진 LETSUM 편집부 — Photo by Kim, 3 min read</p><div class="cols" style="${B}"><p>${bt}</p><p>${bt}</p></div></article>`,
      web: `<article class="pv-web"><nav style="${B}"><b style="${T}">Brand</b><span>소개</span><span>Products</span><span>문의</span></nav><h3 style="${T}">${tt}</h3><p style="${B}">${bt}</p><div class="btns" style="${B}"><span class="b1">지금 시작하기 →</span><span class="b2">Learn more</span></div></article>`,
      poster: `<article class="pv-poster"><div class="d" style="${B}">2026.10.24 — 11.02 · DDP Seoul</div><h3 style="${T}">${tt}</h3><p style="${B}">${bt.slice(0, 120)}</p><div class="f" style="${B}">입장 15,000원 · www.letsum.app</div></article>`,
      card: `<article class="pv-card"><div class="n" style="${B}">01 / 05</div><h3 style="${T}">${tt}</h3><p style="${B}">${bt.slice(0, 90)}…</p><div class="h" style="${B}">@letsum.app</div></article>`,
      mix: `<article class="pv-mix"><div class="r"><small>제목</small><div style="${T};font-size:44px">${tt}</div></div><div class="r"><small>본문</small><div style="${B};font-size:22px;line-height:1.6">${bt}</div></div><div class="r"><small>숫자·기호</small><div style="${B};font-size:30px">2026.10.24 · ₩15,000 · 20% · 3:45 PM · A/B Test</div></div></article>`,
    };
    $("#stage").innerHTML = L[layout] || L.mag;
    const t = S.t, b = S.b;
    $("#stageNote").innerHTML = `제목 ${esc(byId[t.ko].name)}${t.en ? ` + ${esc(byId[t.en].name)}${t.adj !== 100 ? ` (영문 ${t.adj}%)` : ""}` : ""} · 본문 ${esc(byId[b.ko].name)}${b.en ? ` + ${esc(byId[b.en].name)}${b.adj !== 100 ? ` (영문 ${b.adj}%)` : ""}` : ""} — 영문·숫자는 영문 폰트, 한글은 한글 폰트로 그립니다.`;
    drawLic(); drawCss(); save();
    Promise.all([load(byId[t.ko], t.w), load(byId[t.en], t.w), load(byId[b.ko], b.w), load(byId[b.en], b.w)]);
  }
  function save() { try { localStorage.setItem("ls_pair", JSON.stringify(S)); } catch (e) {} }

  // ---------- 조합 사용 범위: 항목마다 가장 엄격한 값 ----------
  const RANK = { ok: 0, cond: 1, no: 2 }, ST = { ok: "사용 가능", cond: "조건부", no: "사용 금지" };
  function used() { return [...new Set([S.t.ko, S.t.en, S.b.ko, S.b.en].filter(Boolean))].map((id) => byId[id]); }
  function drawLic() {
    const fs = used();
    const rows = LICENSE_CATS.map((c) => {
      const vals = fs.map((f) => [f, (f.matrix || {})[c.key] || "cond"]); const worst = vals.reduce((p, x) => (RANK[x[1]] > RANK[p] ? x[1] : p), "ok");
      const who = vals.filter((x) => x[1] === worst && worst !== "ok").map((x) => x[0].name);
      return `<tr><td><b>${c.label}</b></td><td><span class="st-${worst}">${ST[worst]}</span>${who.length ? ` <span class="note">— ${esc(who.join(", "))} 때문</span>` : ""}</td></tr>`;
    }).join("");
    $("#licBox").innerHTML = `<table class="matrix pr-lic"><tr><th style="width:110px">항목</th><th>이 조합</th></tr>${rows}</table>
      <div class="pr-fonts">${fs.map((f) => `<a class="pr-f" href="font/${f.id}.html"><b style="font-family:${esc(f.family)}">${esc(f.name)}</b><span>${esc(((LICENSE_INFO[f.license] || {}).short) || f.license)}</span></a>`).join("")}</div>`;
  }
  // ---------- CSS ----------
  function drawCss() {
    const fs = used(); const gf = fs.filter((f) => !f.webfont || /fonts\.gstatic\.com/.test(Object.values(f.webfont || {})[0] || ""));
    const other = fs.filter((f) => !gf.includes(f));
    const fam = (r) => { const s = S[r]; const ko = byId[s.ko], en = byId[s.en]; return [en ? `'${en.en}'` : "", `'${ko.en}'`, gen(ko)].filter(Boolean).join(", "); }; // 실제 폰트 이름(사이트 내부 이름 아님)
    const link = gf.length ? `<link href="https://fonts.googleapis.com/css2?${gf.map((f) => "family=" + f.en.replace(/ /g, "+") + ":wght@" + f.weights.join(";")).join("&")}&display=swap" rel="stylesheet">\n\n` : "";
    const adj = ["t", "b"].filter((r) => S[r].en && S[r].adj !== 100).map((r) => `/* ${r === "t" ? "제목" : "본문"} 영문 크기 ${S[r].adj}%: @font-face에 size-adjust: ${S[r].adj}%; 를 넣은 별도 이름으로 선언해 맨 앞에 두세요 */\n`).join("");
    $("#cssBox").textContent = `${link}${other.length ? `/* ${other.map((f) => f.name).join(", ")}: 원 배포처에서 받은 파일로 @font-face를 직접 선언하세요(아래 '웹폰트 코드' 참고) */\n` : ""}${adj}h1, h2, h3 {\n  font-family: ${fam("t")};\n  font-weight: ${S.t.w};\n}\nbody {\n  font-family: ${fam("b")};\n  font-weight: ${S.b.w};\n}\n/* 영문 폰트를 앞에 두면 영문·숫자는 영문 폰트, 한글은 한글 폰트로 그려집니다 */`;
  }

  // ---------- 추천 조합(규칙) ----------
  const MATCH = { "고딕": ["고딕"], "명조": ["명조"], "손글씨": ["손글씨", "디스플레이"], "디스플레이": ["디스플레이", "고딕"] };
  const good = (f) => commercial(f) && f.weights.length >= 1;
  function recFor(ko, avoid) {
    const L = EN.filter((e) => MATCH[ko.category].includes(e.category) && good(e) && !(e.tags || []).includes("고정폭") && !avoid.has(e.id) && (ko.category !== "고딕" && ko.category !== "명조" || e.weights.length >= 3));
    return L.sort((a, b) => (b.pop || 0) - (a.pop || 0))[0];
  }
  function drawRecs() {
    const ko = KO.filter((f) => good(f) && f.weights.length >= (f.category === "고딕" || f.category === "명조" ? 3 : 1)).sort((a, b) => (b.pop || 0) - (a.pop || 0));
    const picks = [], usedEn = new Set(), perCat = {};
    for (const f of ko) { if ((perCat[f.category] = (perCat[f.category] || 0) + 1) > 3) continue; const e = recFor(f, usedEn); if (!e) continue; usedEn.add(e.id); picks.push([f, e]); if (picks.length >= 12) break; }
    const body = (cat) => KO.find((f) => f.id === (cat === "명조" ? "noto-serif-kr" : "noto-sans-kr"));
    $("#recs").innerHTML = picks.map(([f, e], i) => { load(f, 700); load(e, 700);
      return `<button class="pr-rec" data-i="${i}"><div class="pr-rec-t" style="font-family:'${esc(famName(e))}','${esc(famName(f))}',${gen(f)};font-weight:700">한글과 Latin 2026</div>
        <div class="pr-rec-n"><b>${esc(f.name)}</b> + <b>${esc(e.name)}</b></div><div class="pr-rec-w">${esc(f.category)} ↔ ${esc((e.tags || [])[0] || e.category)} · 둘 다 인쇄·웹 상업 이용 가능</div></button>`; }).join("");
    $("#recs").onclick = (ev) => { const b = ev.target.closest(".pr-rec"); if (!b) return; const [f, e] = picks[+b.dataset.i]; const bd = body(f.category) || f;
      // 본문 영문은 제목과 다른 폰트로
      S.t = { ko: f.id, en: e.id, w: 700, adj: 100 }; S.b = { ko: bd.id, en: recFor(bd, new Set([e.id]))?.id || "", w: 400, adj: 100 };
      sync(); draw(); scrollTo({ top: 0, behavior: "smooth" }); toast(`${f.name} + ${e.name} 적용`); };
  }

  // ---------- 입력 ----------
  for (const r of ["t", "b"]) {
    $(`#${r}Ko`).addEventListener("change", (e) => { const f = byLabel[e.target.value]; if (f && !f.id.startsWith("e-")) { S[r].ko = f.id; sync(); draw(); } else e.target.value = label(byId[S[r].ko]); });
    $(`#${r}En`).addEventListener("change", (e) => { const v = e.target.value.trim(); const f = byLabel[v]; if (!v) S[r].en = ""; else if (f && f.id.startsWith("e-")) S[r].en = f.id; else { e.target.value = S[r].en ? label(byId[S[r].en]) : ""; return; } S[r].adj = 100; sync(); draw(); });
    $(`#${r}W`).addEventListener("change", (e) => { S[r].w = +e.target.value; draw(); });
    $(`#${r}Adj`).addEventListener("input", (e) => { S[r].adj = +e.target.value; $(`#${r}AdjV`).textContent = S[r].adj + "%"; draw(); });
    $(`#${r}Fit`).addEventListener("click", () => fit(r));
    $(`#${r}Ko`).addEventListener("focus", (e) => e.target.select()); $(`#${r}En`).addEventListener("focus", (e) => e.target.select());
  }
  $("#tTxt").addEventListener("input", (e) => { S.tt = e.target.value; draw(); });
  $("#bTxt").addEventListener("input", (e) => { S.bt = e.target.value; draw(); });
  $("#sameBtn").addEventListener("click", () => { S.b = Object.assign({}, S.t, { w: 400 }); sync(); draw(); });
  $("#swapBtn").addEventListener("click", () => { const t = S.t; S.t = Object.assign({}, S.b, { w: t.w }); S.b = Object.assign({}, t, { w: S.b.w }); sync(); draw(); });
  $("#rndBtn").addEventListener("click", () => {
    const pool = KO.filter((f) => good(f) && f.weights.length >= 2); const f = pool[Math.floor(Math.random() * pool.length)];
    const cands = EN.filter((e) => MATCH[f.category].includes(e.category) && good(e) && !(e.tags || []).includes("고정폭")); const e = cands[Math.floor(Math.random() * Math.min(60, cands.length))];
    S.t = { ko: f.id, en: e ? e.id : "", w: Math.max(...f.weights.filter((w) => w <= 800)), adj: 100 }; sync(); draw();
  });
  $$("#layoutSeg button").forEach((b) => b.addEventListener("click", () => { layout = b.dataset.l; sync(); draw(); }));
  $("#shareBtn").addEventListener("click", () => { const p = (r) => [S[r].ko, S[r].en, S[r].w, S[r].adj].join(","); copy(`${location.origin}${location.pathname}?t=${p("t")}&b=${p("b")}&l=${layout}`, "조합 링크 복사됨"); });
  // 이미지로 저장·공유: 지금 조합을 4:5 이미지로(제목·본문은 실제 조합 폰트로 그림)
  $("#shotBtn").addEventListener("click", () => {
    const worst = (k) => used().map((f) => (f.matrix || {})[k] || "cond").reduce((p, v) => (RANK[v] > RANK[p] ? v : p), "ok");
    const nm = (r) => `${byId[S[r].ko].name}${S[r].en ? " + " + byId[S[r].en].name : ""}`;
    LSShot.open({ title: "LETSUM 폰트 조합", file: "letsum-pairing", w: 1080, h: 1350, badge: "폰트 조합",
      blocks: [{ t: "gap", h: 30 },
        { t: "text", text: S.tt || "제목", family: stack("t"), weight: S.t.w, size: 92, min: 44, maxLines: 4, lh: 1.18, after: 34 },
        { t: "text", text: S.bt || "본문", family: stack("b"), weight: S.b.w, size: 34, min: 22, maxLines: 8, lh: 1.65, after: 10 },
        { t: "rule" },
        { t: "meta", text: "제목  " + nm("t"), size: 28, weight: 600, color: "#141413", after: 6 },
        { t: "meta", text: "본문  " + nm("b"), size: 28, weight: 600, color: "#141413", after: 24 },
        { t: "pills", items: LICENSE_CATS.filter((c) => c.key !== "ofl" && c.key !== "package").map((c) => [c.label, worst(c.key)]) }],
      footer: "폰트 조합 — 한글·영문 혼용 견본", url: "letsum.app/pairing", shareText: `${nm("t")} / ${nm("b")} — LETSUM 폰트 조합` });
  });
  $("#cssCopy").addEventListener("click", () => copy($("#cssBox").textContent, "CSS 복사됨"));

  sync(); draw(); drawRecs();
})();
