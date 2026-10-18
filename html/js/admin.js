// LETSUM 관리자 — 로그인(해시 비교) 후 탭: 개요 · 히어로 테마 · 사진 · 댓글 · 방문 통계 · 검색 키워드 · 모니터링 · 기능 이용 · 폰트 목록
// 서버(Cloudflare Worker /api/admin/*)는 관리자 키(ADMIN_KEY)로만 접근. 키는 이 탭(sessionStorage)에만 기억.
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const byId = Object.fromEntries(FONTS.map((f) => [f.id, f]));
  const fname = (id) => (byId[id] ? byId[id].name : id);

  // ---------- 로그인 ----------
  async function sha256(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("#aid").value === ADMIN_ACCOUNT.id && (await sha256($("#apw").value)) === ADMIN_ACCOUNT.pwHash) { sessionStorage.setItem("fm_admin", "1"); start(); }
    else $("#loginMsg").textContent = "아이디 또는 비밀번호가 다릅니다.";
  });
  $("#logoutBtn").addEventListener("click", () => { sessionStorage.removeItem("fm_admin"); sessionStorage.removeItem("ls_admin_key"); location.reload(); });
  if (sessionStorage.getItem("fm_admin") === "1") start();

  // ---------- 서버 호출 ----------
  const keyEl = $("#ckKey");
  try { keyEl.value = sessionStorage.getItem("ls_admin_key") || ""; } catch (x) {}
  const key = () => keyEl.value.trim();
  async function call(path, bodyObj) {
    if (!key()) throw new Error("위쪽 '서버 관리자 키'를 먼저 넣고 연결하세요.");
    const r = await fetch("/api/admin/" + path, { method: bodyObj ? "POST" : "GET", headers: Object.assign({ authorization: "Bearer " + key() }, bodyObj ? { "content-type": "application/json" } : {}), body: bodyObj ? JSON.stringify(bodyObj) : undefined });
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("json")) { if (r.ok) return r; throw new Error("서버 응답 없음"); }
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "오류"); return j;
  }
  let summary = null;
  async function connect() {
    const st = $("#keyState");
    if (!key()) { st.textContent = "연결 안 됨"; st.className = "adm-conn"; return false; }
    st.textContent = "확인 중…"; st.className = "adm-conn";
    try {
      summary = await call("summary");
      try { sessionStorage.setItem("ls_admin_key", key()); } catch (x) {}
      st.textContent = "연결됨"; st.className = "adm-conn ok";
      $("#tbShots").textContent = summary.pendingShots || ""; $("#tbCmts").textContent = summary.reportedComments || "";
      renderHome(); return true;
    } catch (x) { st.textContent = x.message.includes("키") ? "키가 맞지 않음" : "연결 실패"; st.className = "adm-conn bad"; summary = null; renderHome(); return false; }
  }
  $("#keyForm").addEventListener("submit", async (e) => { e.preventDefault(); if (await connect()) loaders[curTab] && loaders[curTab](); });

  // ---------- 탭 ----------
  let curTab = "home";
  const loaders = {};
  function tab(name) {
    curTab = name;
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    $$(".adm-pane").forEach((p) => (p.hidden = p.dataset.pane !== name));
    try { history.replaceState(null, "", "#" + name); } catch (x) {}
    loaders[name] && loaders[name]();
  }
  $$("#tabs button").forEach((b) => b.addEventListener("click", () => tab(b.dataset.tab)));

  async function start() {
    $("#loginView").hidden = true; $("#loginView").style.display = "none"; $("#dashView").hidden = false;
    await loadBrandData();
    renderHome(); connect();
    const h = location.hash.slice(1); tab(["home", "brand", "shots", "cmts", "traffic", "keywords", "monitor", "metrics", "fonts"].includes(h) ? h : "home");
  }

  // ---------- 히어로 노출 목록(사이트와 같은 규칙) ----------
  const heroIds = (() => {
    const dated = FONTS.filter((f) => f.released).sort((a, b) => b.released.localeCompare(a.released) || b.pop - a.pop);
    return new Set(dated.slice(0, 12).map((f) => f.id));
  })();

  // ---------- 개요 ----------
  function renderHome() {
    const hero = [...heroIds];
    const st = (id) => (brandAdmin[id] ? (brandAdmin[id].off ? "off" : "admin") : BUILTIN[id] ? "builtin" : brandAuto[id] ? "auto" : "none");
    const cnt = (k) => hero.filter((id) => st(id) === k).length;
    const s = summary;
    $("#homeKpi").innerHTML = `
      <div><b>${FONTS.length}</b><span>등록 폰트</span></div>
      <div><b>${FONTS.filter((f) => !f.intro).length}</b><span>미리보기 제공</span></div>
      <div><b>${s ? s.pendingShots : "—"}</b><span>사진 검토 대기</span></div>
      <div><b>${s ? s.reportedComments : "—"}</b><span>신고된 댓글(공개 중)</span></div>
      <div><b>${cnt("admin") + cnt("builtin")} / ${hero.length}</b><span>히어로 테마 확정</span></div>
      <div><b>${cnt("auto")}</b><span>히어로 자동 색(확인 전 게시 중)</span></div>`;
    const todo = [];
    if (!s) todo.push(`서버 관리자 키를 넣고 <b>연결</b>하면 사진·댓글 현황이 보입니다.`);
    if (s && s.pendingShots) todo.push(`<a class="linklike" href="#shots" data-go="shots">사진 ${s.pendingShots}장</a>이 승인을 기다립니다.`);
    if (s && s.reportedComments) todo.push(`<a class="linklike" href="#cmts" data-go="cmts">신고된 댓글 ${s.reportedComments}건</a>을 확인하세요.`);
    if (cnt("auto")) todo.push(`히어로 폰트 중 <a class="linklike" href="#brand" data-go="brand">${cnt("auto")}종이 자동 추출 색</a>으로 게시 중입니다. 확인하고 표현 방식·문구를 고르면 더 좋아집니다.`);
    if (cnt("none")) todo.push(`히어로 폰트 중 ${cnt("none")}종은 제작사 색을 찾지 못해 분위기 기본색으로 나갑니다. 필요하면 직접 지정하세요.`);
    if (!todo.length) todo.push("처리할 일이 없습니다.");
    $("#homeTodo").innerHTML = todo.map((t) => `<li>${t}</li>`).join("");
    $$("#homeTodo [data-go]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); tab(a.dataset.go); }));
  }

  // ================= 히어로 테마 =================
  // 사이트(main.js)와 같은 값 — 바꿀 때 함께 바꿀 것
  const SPOT_PAL = {
    "강렬한": ["#111111", "#f4f1e8", "#d8ff4a"], "세련된": ["#16171b", "#f2f2ee", "#c9b98a"], "발랄한": ["#ffe14d", "#1b1b1b", "#ff5a36"],
    "귀여운": ["#ffd6e0", "#3a1a26", "#ff4f8b"], "따뜻한": ["#f6e3cf", "#3a2414", "#d9632b"], "차분한": ["#dfe7f1", "#14213d", "#2f6db5"],
    "단정한": ["#f4f4f1", "#15151a", "#2f6db5"], "고전적": ["#f1eadb", "#2a2015", "#8b2e1f"],
  };
  const SPOT_LAYOUT = { "디스플레이": "poster", "명조": "editorial", "손글씨": "note", "고딕": "grid" };
  const SPOT_LINES = { poster: "이걸 몰랐다고?", editorial: "책을 읽는 시간은 언제나 옳다", note: "오늘도 수고했어, 내일은 더 괜찮을 거야", grid: "정보는 또렷하게, 화면은 가볍게" };
  const BUILTIN = { "k-gs-hyejaroun": { bg: "#b4e3fa", fg: "#0b2c8a", ac: "#1769f0", acInk: "#ffffff", split: 2, style: "sticker", line: ["어제의 혜자보다 오늘 더 혜자롭게", "혜자로운 이야기"], src: "hyejaroun.com" } };
  const STYLE_NAME = { plain: "기본", sticker: "스티커(흰 외곽선)", shadow: "그림자(강조색)" };

  let brandAuto = {}, brandAdmin = {}, candidates = { items: {} };
  async function loadBrandData() {
    const get = (u) => fetch(u, { cache: "no-cache" }).then((r) => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : null)).catch(() => null);
    const [a, b, c] = await Promise.all([get("data/brand_auto.json"), get("/api/brand"), get("data/brand_candidates.json")]);
    brandAuto = a || {}; brandAdmin = b || {}; candidates = c || { items: {} };
  }
  const moodTheme = (f) => { const p = SPOT_PAL[(f.mood || []).find((m) => SPOT_PAL[m])] || SPOT_PAL["단정한"]; return { bg: p[0], fg: p[1], ac: p[2] }; };
  function effective(f) {
    const a = brandAdmin[f.id]; if (a && !a.off) return { src: "admin", t: a };
    if (a && a.off) return { src: "off", t: moodTheme(f) };
    if (BUILTIN[f.id]) return { src: "builtin", t: BUILTIN[f.id] };
    if (brandAuto[f.id]) return { src: "auto", t: { ...brandAuto[f.id], style: "plain" } };
    return { src: "none", t: moodTheme(f) };
  }
  const SRC_LABEL = { admin: "저장됨", builtin: "기본 등록", auto: "자동 추천", off: "끔", none: "기본색" };

  // 대비(WCAG)
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { try { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); } catch (e) { return 0; } };
  const crTag = (r, need) => `<span class="cr ${r >= need ? "pass" : r >= need * 0.75 ? "warn" : "fail"}">${r.toFixed(1)}:1</span>`;
  const HEXOK = /^#[0-9a-f]{6}$/i;

  // 폰트 불러오기(미리보기)
  const loaded = new Set();
  function face(f) {
    if (!f.webfont || loaded.has(f.id)) return; loaded.add(f.id);
    const fam = f.family.split(",")[0].replace(/['"]/g, "").trim();
    Object.entries(f.webfont).forEach(([w, url]) => {
      const fmt = /\.otf/.test(url) ? "opentype" : /\.ttf/.test(url) ? "truetype" : /\.woff2/.test(url) ? "woff2" : "woff";
      const ff = new FontFace(fam, `url("${url}") format("${fmt}")`, { weight: String(w) }); document.fonts.add(ff); ff.load().catch(() => {});
    });
  }

  let brFilter = "hero", sel = null, draft = null, pickSlot = "bg";
  function listRows() {
    const q = $("#brSearch").value.trim();
    let L = FONTS.filter((f) => !q || f.name.includes(q) || (f.en || "").toLowerCase().includes(q.toLowerCase()));
    if (brFilter === "hero") L = L.filter((f) => heroIds.has(f.id));
    if (brFilter === "admin") L = L.filter((f) => brandAdmin[f.id]);
    if (brFilter === "auto") L = L.filter((f) => brandAuto[f.id] && !brandAdmin[f.id]);
    L.sort((a, b) => (b.released || "").localeCompare(a.released || "") || a.name.localeCompare(b.name));
    $("#brItems").innerHTML = L.map((f) => { const e = effective(f); return `<button class="br-it${sel === f.id ? " on" : ""}" data-id="${f.id}"><span class="sw"><i style="background:${e.t.bg}"></i><i style="background:${e.t.fg}"></i><i style="background:${e.t.ac}"></i></span><b>${esc(f.name)}</b><span class="br-st">${SRC_LABEL[e.src]}</span></button>`; }).join("") || '<p class="note" style="padding:10px">해당 폰트가 없습니다.</p>';
    $$("#brItems .br-it").forEach((b) => b.addEventListener("click", () => openBrand(b.dataset.id)));
  }
  $("#brSearch").addEventListener("input", listRows);
  $$("#brFilter button").forEach((b) => b.addEventListener("click", () => { brFilter = b.dataset.f; $$("#brFilter button").forEach((x) => x.classList.toggle("on", x === b)); listRows(); }));
  loaders.brand = () => {
    const g = candidates.generated;
    $("#brMeta").innerHTML = `제작사 소개 페이지에서 뽑은 색은 매주 자동 갱신되고 <b>확인 전에도 히어로에 게시</b>됩니다(${g ? `최근 추출 ${esc(g)}` : "추출 기록 없음"}). 여기서 저장하면 자동 추천보다 우선하며, 서버에 바로 반영됩니다(방문자 화면은 최대 5분 뒤).`;
    listRows(); if (!sel) { const first = $("#brItems .br-it"); if (first) openBrand(first.dataset.id); }
  };

  function openBrand(id) {
    sel = id; const f = byId[id]; face(f);
    const e = effective(f);
    draft = { bg: e.t.bg, fg: e.t.fg, ac: e.t.ac, acInk: e.t.acInk || "", style: e.t.style || "plain", split: e.t.split || 0, line: (e.t.line || []).slice(), src: e.t.src || "" };
    listRows(); renderEditor();
  }

  function previewHTML(f, t) {
    const lay = SPOT_LAYOUT[f.category] || "grid";
    const heavy = f.weights[f.weights.length - 1];
    const nm = [...f.name];
    const title = t.split ? `<span class="sp-ac">${esc(nm.slice(0, t.split).join(""))}</span>${esc(nm.slice(t.split).join(""))}` : esc(f.name);
    const line = (t.line && t.line[0]) || SPOT_LINES[lay];
    const L = LICENSE_CATS.filter((c) => c.key !== "ofl");
    const branded = t.style && t.style !== "none";
    return `<div class="newband spot"><div class="spot-stage"><article class="sp sp-${lay}${branded ? " sp-brand sp-st-" + t.style : ""} on" style="--bg:${t.bg};--fg:${t.fg};--ac:${t.ac}${t.acInk ? ";--ac-ink:" + t.acInk : ""}">
      ${lay === "poster" && !f.intro ? `<div class="sp-marquee" aria-hidden="true" style="font-family:${f.family};font-weight:${heavy}"><span>${esc((f.name + " · ").repeat(8))}</span></div>` : ""}
      <div class="wrap sp-in"><div class="sp-main">
        <div class="sp-kick">${esc(f.released || "")} 출시 · ${esc((f.releasedSrc || "").replace(/\(.*\)/, ""))}</div>
        <h2 class="sp-title" style="${f.intro ? "" : `font-family:${f.family};font-weight:${heavy}`}">${title}</h2>
        <p class="sp-type" style="font-family:${f.family}">${esc(line)}</p>
        <div class="sp-cta"><button class="sp-btn" type="button">자세히 보기</button><a class="sp-btn ac">받기 ↗</a></div>
      </div><aside class="sp-side"><dl><dt>제작·배포</dt><dd>${esc(f.designer)}</dd><dt>라이선스</dt><dd>${esc(f.license)}</dd></dl>
        <div class="sp-lic">${L.map((c) => `<span class="${f.matrix[c.key]}">${c.label}</span>`).join("")}</div></aside></div>
    </article></div></div>`;
  }

  function renderEditor() {
    const f = byId[sel], e = effective(f), cand = (candidates.items || {})[f.id] || {};
    const pal = (cand.palette || []).map((p) => p.hex);
    const extra = ["#ffffff", "#111111", draft.bg, draft.fg, draft.ac].filter((c, i, a) => HEXOK.test(c) && a.indexOf(c) === i && !pal.includes(c));
    const slot = (k, label, need, against) => {
      const v = draft[k] || ""; const r = v && against && against() ? ratio(v, against()) : 0;
      return `<div class="br-slot${pickSlot === k ? " pick" : ""}" data-slot="${k}"><span>${label}</span><input type="color" value="${HEXOK.test(v) ? v : "#ffffff"}" data-k="${k}" aria-label="${label} 색"><input type="text" value="${esc(v)}" data-k="${k}" placeholder="${k === "acInk" ? "자동" : "#RRGGBB"}" aria-label="${label} 값">${need && v ? crTag(r, need) : "<span></span>"}</div>`;
    };
    $("#brEdit").innerHTML = `
      <div class="br-acts"><h2 style="margin:0;font-size:20px">${esc(f.name)}</h2><span class="br-st">${SRC_LABEL[e.src]}</span>
        <a class="linklike" href="index.html#f=${f.id}" target="_blank" rel="noopener">사이트 상세</a>
        ${cand.page ? `<a class="linklike" href="${esc(cand.page)}" target="_blank" rel="noopener noreferrer">제작사 페이지 ↗</a>` : ""}
        ${heroIds.has(f.id) ? '<span class="note">· 지금 히어로에 나옴</span>' : '<span class="note">· 지금은 히어로에 안 나옴(최근 출시 12종에 들면 사용)</span>'}</div>
      <div class="br-prev" id="brPrev">${previewHTML(f, draft)}</div>
      <div class="br-grid">
        <div class="br-box"><h3>색 <span class="note">칸을 고른 뒤 아래 견본을 누르면 들어갑니다</span></h3>
          ${slot("bg", "배경", 0)}
          ${slot("fg", "글자", 7, () => draft.bg)}
          ${slot("ac", "강조", 3, () => draft.bg)}
          ${slot("acInk", "버튼 글자", 4.5, () => draft.ac)}
          <p class="note" style="margin:0">대비 기준: 글자 7:1 · 강조(큰 글씨) 3:1 · 버튼 글자 4.5:1</p>
        </div>
        <div class="br-box"><h3>제작사 페이지 색 <span class="note">${cand.palette && cand.palette.length ? `${cand.palette.length}색` : esc(cand.error || "추출 기록 없음")}</span></h3>
          <div class="br-pal" style="padding-bottom:14px">${pal.map((h, i) => `<button type="button" data-hex="${h}" style="background:${h}" title="${h} · ${esc(cand.palette[i].src)}"><small>${h.slice(1)}</small></button>`).join("")}${extra.map((h) => `<button type="button" data-hex="${h}" style="background:${h}" title="${h}"><small>${h.slice(1)}</small></button>`).join("")}</div>
          <div class="br-acts">${cand.suggest ? '<button class="btn sm" type="button" id="brSuggest">자동 추천 색으로</button>' : ""}<button class="btn sm ghost" type="button" id="brMood">분위기 기본색으로</button></div>
        </div>
        <div class="br-box"><h3>표현</h3>
          <div class="br-row"><label>표현 방식<select id="brStyle">${Object.entries(STYLE_NAME).map(([k, v]) => `<option value="${k}"${draft.style === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
            <label>제목 앞 강조 글자 수<input id="brSplit" type="number" min="0" max="12" value="${draft.split || 0}"></label></div>
          <div class="br-row"><label>문구 1<input id="brLine0" maxlength="40" value="${esc(draft.line[0] || "")}" placeholder="${esc(SPOT_LINES[SPOT_LAYOUT[f.category] || "grid"])} (비우면 기본 문구)"></label></div>
          <div class="br-row"><label>문구 2<input id="brLine1" maxlength="40" value="${esc(draft.line[1] || "")}" placeholder="번갈아 나올 두 번째 문구(선택)"></label></div>
          <div class="br-row"><label>출처 메모<input id="brSrc" maxlength="120" value="${esc(draft.src || "")}" placeholder="예: hyejaroun.com 메인 색"></label></div>
        </div>
      </div>
      <div class="br-acts">
        <button class="btn blue" type="button" id="brSave">저장 — 사이트에 반영</button>
        ${brandAdmin[f.id] ? '<button class="btn ghost" type="button" id="brDel">저장 취소(자동으로 되돌리기)</button>' : ""}
        ${brandAdmin[f.id] && brandAdmin[f.id].off ? "" : '<button class="btn ghost" type="button" id="brOff">브랜드 색 끄기</button>'}
        <span class="br-msg" id="brMsg"></span>
      </div>`;
    const ed = $("#brEdit");
    const refresh = () => { $("#brPrev").innerHTML = previewHTML(f, draft); };
    $$(".br-slot", ed).forEach((s) => s.addEventListener("click", () => { pickSlot = s.dataset.slot; $$(".br-slot", ed).forEach((x) => x.classList.toggle("pick", x === s)); }));
    $$(".br-slot input", ed).forEach((inp) => inp.addEventListener(inp.type === "color" ? "input" : "change", () => {
      const k = inp.dataset.k; let v = inp.value.trim().toLowerCase(); if (v && !v.startsWith("#")) v = "#" + v;
      if (v && !HEXOK.test(v)) { $("#brMsg").textContent = "색은 #RRGGBB 형식으로 넣어 주세요."; return; }
      draft[k] = v; renderEditor();
    }));
    $$(".br-pal button", ed).forEach((b) => b.addEventListener("click", () => {
      draft[pickSlot] = b.dataset.hex; const order = ["bg", "fg", "ac", "acInk"]; pickSlot = order[(order.indexOf(pickSlot) + 1) % 4]; renderEditor();
    }));
    const sg = $("#brSuggest"); if (sg) sg.addEventListener("click", () => { Object.assign(draft, cand.suggest); renderEditor(); });
    $("#brMood").addEventListener("click", () => { Object.assign(draft, moodTheme(f), { acInk: "" }); renderEditor(); });
    $("#brStyle").addEventListener("change", (ev) => { draft.style = ev.target.value; refresh(); });
    $("#brSplit").addEventListener("input", (ev) => { draft.split = Math.max(0, Math.min(12, parseInt(ev.target.value, 10) || 0)); refresh(); });
    ["0", "1"].forEach((i) => $("#brLine" + i).addEventListener("input", (ev) => { draft.line[+i] = ev.target.value; refresh(); }));
    $("#brSrc").addEventListener("input", (ev) => { draft.src = ev.target.value; });
    const save = async (theme, okMsg) => {
      $("#brMsg").textContent = "저장 중…";
      try {
        const j = await call("brand", { id: f.id, theme });
        if (theme === null) delete brandAdmin[f.id]; else brandAdmin[f.id] = j.theme;
        $("#brMsg").textContent = okMsg; listRows(); renderHome();
        setTimeout(() => { if (sel === f.id) renderEditor(); $("#brMsg").textContent = okMsg; }, 50);
      } catch (x) { $("#brMsg").textContent = x.message; }
    };
    $("#brSave").addEventListener("click", () => {
      if (ratio(draft.fg, draft.bg) < 4.5 && !confirm("글자와 배경 대비가 낮아 읽기 어려울 수 있습니다. 그래도 저장할까요?")) return;
      const t = { bg: draft.bg, fg: draft.fg, ac: draft.ac, style: draft.style, split: draft.split, line: draft.line.map((s) => (s || "").trim()).filter(Boolean), src: draft.src };
      if (HEXOK.test(draft.acInk || "")) t.acInk = draft.acInk;
      save(t, "저장했습니다. 방문자 화면에는 최대 5분 뒤 반영됩니다.");
    });
    const del = $("#brDel"); if (del) del.addEventListener("click", () => save(null, "저장을 지웠습니다. 자동 추천(또는 기본색)으로 돌아갑니다."));
    const off = $("#brOff"); if (off) off.addEventListener("click", () => save({ off: true }, "브랜드 색을 껐습니다. 분위기 기본색으로 나갑니다."));
  }

  // ================= 사진 =================
  let urls = [];
  loaders.shots = async function () {
    const list = $("#shotList"), msg = $("#shotMsgA"); const st = $("#shotFilter").value;
    msg.textContent = "불러오는 중…"; urls.forEach(URL.revokeObjectURL); urls = [];
    try {
      const j = await call("shots?status=" + st);
      msg.textContent = `${j.items.length}장`;
      list.innerHTML = j.items.length ? j.items.map((s) => `<div class="adm-shot" data-sid="${s.id}"><img alt="사진 ${s.id}">
        <b>${esc(fname(s.font_id))}</b><span>${esc(s.caption || "(설명 없음)")}</span>
        <span class="note">${esc(s.name)} · ${new Date(s.created).toLocaleString("ko-KR")} · ${Math.round(s.bytes / 1024)}KB</span>
        <div class="acts">${st === "pending" ? `<button class="btn sm" data-a="approve">승인(공개)</button><button class="btn sm ghost" data-a="reject">거절(삭제)</button>`
          : `<button class="btn sm ghost" data-a="unpublish">비공개로</button><button class="btn sm ghost" data-a="reject">삭제</button>`}</div></div>`).join("") : '<p class="note">해당하는 사진이 없습니다.</p>';
      $$(".adm-shot", list).forEach(async (el) => {
        try { const r = await call("shot/" + el.dataset.sid); const u = URL.createObjectURL(await r.blob()); urls.push(u); const img = $("img", el); img.src = u; img.addEventListener("click", () => window.open(u, "_blank")); } catch (x) {}
      });
      $$("[data-a]", list).forEach((b) => b.addEventListener("click", async () => {
        const sid = +b.closest(".adm-shot").dataset.sid;
        if (b.dataset.a === "reject" && !confirm("이 사진을 삭제할까요? 되돌릴 수 없습니다.")) return;
        try { await call("shot", { shotId: sid, action: b.dataset.a }); loaders.shots(); connect(); } catch (x) { msg.textContent = x.message; }
      }));
    } catch (x) { msg.textContent = x.message; list.innerHTML = ""; }
  };
  $("#shotLoad").addEventListener("click", () => loaders.shots());
  $("#shotFilter").addEventListener("change", () => loaders.shots());

  // ================= 댓글 =================
  loaders.cmts = async function () {
    const list = $("#ckList"), msg = $("#ckMsg");
    msg.textContent = "불러오는 중…";
    try {
      const j = await call("comments?filter=" + $("#ckFilter").value);
      msg.textContent = `${j.items.length}건`;
      list.innerHTML = j.items.length ? `<div class="adm-scroll"><table class="spec"><tr><th>폰트</th><th>작성</th><th>내용</th><th>상태</th><th></th></tr>${j.items.map((c) => `<tr>
        <td><a class="linklike" href="index.html#f=${esc(c.font_id)}" target="_blank">${esc(fname(c.font_id))}</a></td>
        <td>${esc(c.name)}<br><span class="note">${new Date(c.created).toLocaleString("ko-KR")}</span></td>
        <td style="max-width:420px;word-break:break-word">${esc(c.body)}</td>
        <td>${c.hidden ? "숨김" : "공개"}${c.reports ? ` · 신고 ${c.reports}` : ""}</td>
        <td style="white-space:nowrap"><button class="btn sm ghost" data-act="${c.hidden ? "show" : "hide"}" data-cid="${c.id}">${c.hidden ? "복구" : "숨김"}</button>
          <button class="btn sm ghost" data-act="delete" data-cid="${c.id}">삭제</button></td></tr>`).join("")}</table></div>` : '<p class="note">해당하는 댓글이 없습니다.</p>';
      $$("[data-act]", list).forEach((b) => b.addEventListener("click", async () => {
        if (b.dataset.act === "delete" && !confirm("이 댓글을 영구 삭제할까요?")) return;
        try { await call("comment", { commentId: +b.dataset.cid, action: b.dataset.act }); loaders.cmts(); connect(); } catch (x) { msg.textContent = x.message; }
      }));
    } catch (x) { msg.textContent = x.message; list.innerHTML = ""; }
  };
  $("#ckLoad").addEventListener("click", () => loaders.cmts());
  $("#ckFilter").addEventListener("change", () => loaders.cmts());

  // ================= 이용 지표 =================
  const LABEL = { visit: "방문(세션)", detail: "상세 열기", cmp_add: "비교 담기", cmp_open: "비교 창 열기", dl_zip: "파일 바로 받기", dl_page: "배포처 페이지 이동", record: "확인 기록 저장", wiz_open: "용도 추천 열기", wiz_apply: "용도 추천 적용", view: "보기 전환", text_custom: "내 문장 입력", cover_only: "'모두 지원' 필터", comment: "댓글", like: "좋아요", shot_up: "사진 올리기", share: "공유", proj_add: "보관함에 담기", proj_share: "보관함 링크 공유", proj_export: "보관함 내보내기", ffail: "미리보기 실패" };
  loaders.metrics = async function () {
    const out = $("#mtOut"), msg = $("#mtMsg");
    msg.textContent = "불러오는 중…";
    try {
      const j = await call("metrics?days=" + $("#mtDays").value);
      const tot = {}, byDay = {}, byFont = {}, byVal = {};
      j.rows.forEach((x) => {
        tot[x.name] = (tot[x.name] || 0) + x.n;
        if (x.name === "visit") byDay[x.day] = (byDay[x.day] || 0) + x.n;
        if (x.font && ["detail", "cmp_add", "dl_zip", "dl_page", "record", "like"].includes(x.name)) { const k = x.font; byFont[k] = byFont[k] || {}; byFont[k][x.name] = (byFont[k][x.name] || 0) + x.n; }
        if (x.font && ["view", "wiz_apply"].includes(x.name)) { byVal[x.name] = byVal[x.name] || {}; byVal[x.name][x.font] = (byVal[x.name][x.font] || 0) + x.n; }
      });
      const v = tot.visit || 0, pct = (a) => (v ? Math.round((a / v) * 1000) / 10 + "%" : "—");
      const dl = (tot.dl_zip || 0) + (tot.dl_page || 0);
      const days = []; for (let d = new Date(j.from + "T00:00:00"); d <= new Date(); d.setDate(d.getDate() + 1)) days.push(d.toISOString().slice(0, 10));
      const mx = Math.max(1, ...days.map((d) => byDay[d] || 0));
      const top = (k) => Object.entries(byFont).filter(([, o]) => o[k]).sort((a, b) => b[1][k] - a[1][k]).slice(0, 10);
      msg.textContent = `${j.from}부터 · 행동 기록 ${j.rows.reduce((s, x) => s + x.n, 0).toLocaleString()}건 (날짜별 합계, 개인 식별 정보 없음)`;
      out.innerHTML = `
        <div class="mt-kpi">
          <div><b>${v.toLocaleString()}</b><span>방문(세션)</span></div>
          <div><b>${(tot.detail || 0).toLocaleString()}</b><span>상세 열기</span></div>
          <div><b>${(tot.cmp_add || 0).toLocaleString()}</b><span>비교 담기 · 방문 대비 ${pct(tot.cmp_add || 0)}</span></div>
          <div><b>${dl.toLocaleString()}</b><span>배포처 이동·받기 · ${pct(dl)}</span></div>
          <div><b>${(tot.record || 0).toLocaleString()}</b><span>확인 기록 저장 · ${pct(tot.record || 0)}</span></div>
          <div><b>${(tot.wiz_apply || 0).toLocaleString()}</b><span>용도 추천 적용 · ${pct(tot.wiz_apply || 0)}</span></div>
        </div>
        <p class="note">일별 방문</p><div class="mt-bar">${days.map((d) => `<i style="height:${((byDay[d] || 0) / mx) * 100}%" title="${d}: ${byDay[d] || 0}"></i>`).join("")}</div>
        <div class="mt-cols">
          <div><b>행동별 합계</b><table class="spec">${Object.keys(LABEL).filter((k) => tot[k]).map((k) => `<tr><th>${LABEL[k]}</th><td>${tot[k].toLocaleString()}</td></tr>`).join("") || "<tr><td>아직 기록이 없습니다</td></tr>"}</table></div>
          <div><b>많이 연 폰트</b><table class="spec">${top("detail").map(([id, o]) => `<tr><th>${esc(fname(id))}</th><td>${o.detail}</td></tr>`).join("") || "<tr><td>—</td></tr>"}</table></div>
          <div><b>배포처로 많이 간 폰트</b><table class="spec">${Object.entries(byFont).map(([id, o]) => [id, (o.dl_zip || 0) + (o.dl_page || 0)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => `<tr><th>${esc(fname(id))}</th><td>${n}</td></tr>`).join("") || "<tr><td>—</td></tr>"}</table></div>
          <div><b>보기 방식 · 용도 추천</b><table class="spec">${[...Object.entries(byVal.view || {}).map(([k, n]) => [`보기: ${k}`, n]), ...Object.entries(byVal.wiz_apply || {}).map(([k, n]) => [`용도: ${k}`, n])].map(([k, n]) => `<tr><th>${esc(k)}</th><td>${n}</td></tr>`).join("") || "<tr><td>—</td></tr>"}</table></div>
        </div>`;
    } catch (x) { msg.textContent = x.message; out.innerHTML = ""; }
  };
  $("#mtLoad").addEventListener("click", () => loaders.metrics());
  $("#mtDays").addEventListener("change", () => loaders.metrics());

  // ================= 방문 통계 · 검색 키워드 · 모니터링 =================
  const nf = (n) => (n || 0).toLocaleString("ko-KR");
  const pctOf = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  let regionName = (c) => c; try { const dn = new Intl.DisplayNames(["ko"], { type: "region" }); regionName = (c) => (c && c !== "??" && c !== "XX" ? dn.of(c) || c : "알 수 없음"); } catch (x) {}
  const pageLabel = (p) => { const m = /^\/font\/([a-z0-9-]+)\.html$/.exec(p); if (m) return `폰트 상세 · ${fname(m[1])}`; return { "/": "홈", "/notice.html": "저작권·라이선스 고지", "/privacy.html": "개인정보처리방침", "/terms.html": "이용약관", "/guide.html": "가이드", "/submit.html": "폰트 제보", "/subset.html": "서브셋 도구" }[p] || p; };
  function table(title, rows, opt) {
    opt = opt || {}; const tot = opt.total || rows.reduce((s, r) => s + r[1], 0); const L = rows.slice(0, opt.max || 15);
    return `<div><p class="mt-sub">${title}</p><table class="spec mt-tbl">${L.map(([k, n]) => `<tr><th>${opt.html ? opt.label(k) : esc(opt.label ? opt.label(k) : k)}</th><td class="n">${nf(n)}${opt.noPct ? "" : `<small>${pctOf(n, tot)}%</small>`}</td></tr>`).join("") || '<tr><td class="note">아직 기록이 없습니다</td></tr>'}</table></div>`;
  }
  function bars(items, cls) { // items: [{ v, t, k }]
    const mx = Math.max(1, ...items.map((x) => x.v));
    return `<div class="mt-bar">${items.map((x) => `<i class="${x.k || cls || ""}" style="height:${(x.v / mx) * 100}%" title="${esc(x.t)}"></i>`).join("")}</div>`;
  }
  const dayList = (from) => { const out = []; const end = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 10) <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out; };
  const WD = ["일", "월", "화", "수", "목", "금", "토"];

  loaders.traffic = async function () {
    const out = $("#tfOut"), msg = $("#tfMsg"); msg.textContent = "불러오는 중…";
    try {
      const j = await call("traffic?days=" + $("#tfDays").value); const D = j.dims; const g = (k) => D[k] || [];
      const sum = (k) => g(k).reduce((s, r) => s + r[1], 0);
      const v = sum("visit"), pv = sum("pv"), pvPrev = j.prev.pv || 0, vPrev = j.prev.visit || 0;
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      if (!j.first) {
        msg.textContent = "";
        out.innerHTML = `<div class="mt-wait"><b>${esc(j.startFrom)}부터 집계를 시작합니다.</b> 개인정보처리방침 변경(2026-10-18 공지)이 시행되는 날부터 모읍니다.<br>그 전까지는 아래 Cloudflare Web Analytics에서 방문 수·유입 경로를 볼 수 있습니다.</div>`;
      } else {
        const days = dayList(j.from); const by = {}; j.daily.forEach((x) => { (by[x.day] = by[x.day] || {})[x.dim] = x.n; });
        const wd = Array(7).fill(0); days.forEach((d) => { wd[new Date(d + "T00:00:00Z").getUTCDay()] += (by[d] || {}).visit || 0; });
        const hours = Object.fromEntries(g("vhour")); const hourPv = Object.fromEntries(g("hour"));
        const src = Object.fromEntries(g("src")); const mob = (Object.fromEntries(g("dev"))["모바일"] || 0);
        const delta = (a, b) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / b) * 100))}%` : "직전 기간 기록 없음");
        msg.textContent = `${j.from} ~ ${today} · 날짜별 합계(개인 식별 정보 없음) · 집계 시작 ${j.first}`;
        out.innerHTML = `
          <div class="mt-kpi">
            <div><b>${nf(v)}</b><span>방문 · ${delta(v, vPrev)}</span></div>
            <div><b>${nf(pv)}</b><span>페이지뷰 · ${delta(pv, pvPrev)}</span></div>
            <div><b>${v ? (pv / v).toFixed(1) : "—"}</b><span>방문당 페이지</span></div>
            <div><b>${pctOf(src["검색"] || 0, v)}%</b><span>검색 유입</span></div>
            <div><b>${pctOf((src["SNS"] || 0) + (src["블로그·커뮤니티"] || 0), v)}%</b><span>SNS·커뮤니티 유입</span></div>
            <div><b>${pctOf(mob, v)}%</b><span>모바일</span></div>
          </div>
          <p class="mt-sub">일별 방문 <span class="note">(검은 막대 = 방문, 막대에 마우스를 올리면 수치)</span></p>
          ${bars(days.map((d) => ({ v: (by[d] || {}).visit || 0, t: `${d}(${WD[new Date(d + "T00:00:00Z").getUTCDay()]}) 방문 ${(by[d] || {}).visit || 0} · 페이지뷰 ${(by[d] || {}).pv || 0}`, k: d === today ? "now" : "" })))}
          <div class="mt-axis"><span>${days[0]}</span><span>${days[days.length - 1]}</span></div>
          <div class="mt-cols">
            <div><p class="mt-sub">시간대별 방문 <span class="note">(한국 시간)</span></p>${bars([...Array(24)].map((_, h) => { const k = String(h).padStart(2, "0"); return { v: hours[k] || 0, t: `${h}시 방문 ${hours[k] || 0} · 페이지뷰 ${hourPv[k] || 0}` }; }))}<div class="mt-axis"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>23시</span></div></div>
            <div><p class="mt-sub">요일별 방문</p>${bars(wd.map((n, i) => ({ v: n, t: `${WD[i]}요일 ${n}` })))}<div class="mt-axis">${WD.map((w) => `<span>${w}</span>`).join("")}</div></div>
          </div>
          <div class="mt-cols">
            ${table("유입 채널", g("src"), { total: v })}
            ${table("유입 사이트", g("ref"), { total: v })}
            ${table("첫 페이지(들어온 곳)", g("land"), { total: v, label: pageLabel })}
            ${table("많이 본 페이지", g("path"), { total: pv, label: pageLabel })}
            ${table("국가", g("country"), { total: v, label: regionName })}
            ${table("기기", g("dev"), { total: v })}
            ${table("브라우저·앱", g("br"), { total: v })}
            ${table("운영체제", g("os"), { total: v })}
            ${table("화면 폭(px)", g("vw"), { total: v })}
            ${table("캠페인(utm_source / medium / campaign)", g("utm"), { total: v })}
          </div>`;
      }
    } catch (x) { msg.textContent = x.message; out.innerHTML = ""; }
    loadCf();
  };
  async function loadCf() {
    const el = $("#cfOut");
    try {
      const j = await call("cfwa?days=7");
      if (!j.configured) { el.innerHTML = `<div class="mt-wait">Cloudflare 통계를 여기서 보려면 서버에 읽기 전용 토큰을 한 번 등록해야 합니다(운영 문서 docs/HANDOFF.md '방문 통계' 참고). 그 전에는 <a class="linklike" href="https://dash.cloudflare.com/?to=/:account/web-analytics" target="_blank" rel="noopener noreferrer">Cloudflare 대시보드 → Web Analytics ↗</a>에서 바로 볼 수 있습니다.</div>`; return; }
      if (j.error) { el.innerHTML = `<p class="note">Cloudflare 통계를 불러오지 못했습니다: ${esc(j.error)}</p>`; return; }
      const d = j.data, tot = (d.total && d.total[0]) || { count: 0, sum: { visits: 0 } };
      const rows = (arr, k, lab) => (arr || []).map((x) => [lab ? lab(x.dimensions[k]) : x.dimensions[k] || "(없음)", x.sum.visits]);
      el.innerHTML = `<div class="mt-kpi"><div><b>${nf(tot.sum.visits)}</b><span>방문(Cloudflare)</span></div><div><b>${nf(tot.count)}</b><span>페이지뷰(Cloudflare)</span></div></div>
        ${bars((d.byDate || []).map((x) => ({ v: x.sum.visits, t: `${x.dimensions.date} 방문 ${x.sum.visits} · 페이지뷰 ${x.count}` })))}
        <div class="mt-cols">${table("유입 사이트", rows(d.byRef, "refererHost", (h) => h || "직접 방문"))}${table("페이지", rows(d.byPath, "requestPath", pageLabel))}${table("국가", rows(d.byCountry, "countryName"))}${table("기기", rows(d.byDevice, "deviceType"))}${table("브라우저", rows(d.byBrowser, "userAgentBrowser"))}${table("운영체제", rows(d.byOS, "userAgentOS"))}</div>`;
    } catch (x) { el.innerHTML = `<p class="note">${esc(x.message)}</p>`; }
  }
  $("#tfLoad").addEventListener("click", () => loaders.traffic());
  $("#tfDays").addEventListener("change", () => loaders.traffic());

  loaders.keywords = async function () {
    const days = $("#kwDays").value;
    const gEl = $("#gscOut"), kEl = $("#kwOut"), sEl = $("#sqOut");
    gEl.innerHTML = kEl.innerHTML = sEl.innerHTML = '<p class="note">불러오는 중…</p>';
    call("gsc?days=" + days).then((j) => {
      if (!j.configured) { gEl.innerHTML = `<div class="mt-wait">구글 검색어를 여기서 보려면 Search Console 연결이 한 번 필요합니다(운영 문서 docs/HANDOFF.md '방문 통계 → 구글 검색어'). 그 전에는 <a class="linklike" href="https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fletsum.app%2F" target="_blank" rel="noopener noreferrer">Search Console ↗</a>에서 직접 볼 수 있습니다.${j.error ? `<br><span class="note">${esc(j.error)}</span>` : ""}</div>`; return; }
      if (j.error) { gEl.innerHTML = `<p class="note">구글 검색어를 불러오지 못했습니다: ${esc(j.error)}<br>연결 계정 ${esc(j.account || "")} 이 Search Console 속성 ${esc(j.site || "")} 의 사용자로 추가돼 있는지 확인하세요.</p>`; return; }
      const clicks = j.queries.reduce((s, r) => s + r.clicks, 0), imps = j.queries.reduce((s, r) => s + r.impressions, 0);
      const dTot = j.dates.reduce((a, r) => ({ c: a.c + r.clicks, i: a.i + r.impressions }), { c: 0, i: 0 });
      gEl.innerHTML = `<div class="mt-kpi"><div><b>${nf(dTot.c)}</b><span>구글 검색 클릭</span></div><div><b>${nf(dTot.i)}</b><span>구글 검색 노출</span></div><div><b>${dTot.i ? ((dTot.c / dTot.i) * 100).toFixed(1) : "—"}%</b><span>클릭률</span></div></div>
        ${bars(j.dates.map((r) => ({ v: r.clicks, t: `${r.keys[0]} 클릭 ${r.clicks} · 노출 ${r.impressions}` })))}
        <div class="adm-scroll"><table class="spec mt-tbl"><tr><th>검색어</th><td class="n">클릭</td><td class="n">노출</td><td class="n">클릭률</td><td class="n">평균 순위</td></tr>${j.queries.slice(0, 60).map((r) => `<tr><th>${esc(r.keys[0])}</th><td class="n">${nf(r.clicks)}</td><td class="n">${nf(r.impressions)}</td><td class="n">${(r.ctr * 100).toFixed(1)}%</td><td class="n">${r.position.toFixed(1)}</td></tr>`).join("") || '<tr><td class="note">아직 검색 기록이 없습니다(새 사이트는 며칠~몇 주 걸립니다)</td></tr>'}</table></div>
        <div class="mt-cols">${table("구글 검색에서 들어온 페이지(클릭)", j.pages.map((r) => [r.keys[0].replace(/^https:\/\/letsum\.app/, ""), r.clicks]), { label: pageLabel })}${table("기기(클릭)", j.devices.map((r) => [{ MOBILE: "모바일", DESKTOP: "데스크톱", TABLET: "태블릿" }[r.keys[0]] || r.keys[0], r.clicks]))}</div>
        <p class="note">표시된 검색어 클릭 합계 ${nf(clicks)} · 노출 ${nf(imps)} (구글은 개인정보 보호를 위해 드문 검색어를 빼고 보여줍니다)</p>`;
    }).catch((x) => { gEl.innerHTML = `<p class="note">${esc(x.message)}</p>`; });
    call("traffic?days=" + days).then((j) => {
      const g = (k) => j.dims[k] || [];
      if (!j.first) { const w = `<p class="note">${esc(j.startFrom)}부터 집계합니다(개인정보처리방침 변경 시행일).</p>`; kEl.innerHTML = sEl.innerHTML = w; return; }
      const kw = g("kw"); const byEng = {}; kw.forEach(([k, n]) => { const [e] = k.split("|"); byEng[e] = (byEng[e] || 0) + n; });
      kEl.innerHTML = `<div class="mt-cols">${table("검색어 (엔진 · 검색어)", kw.map(([k, n]) => [k.replace("|", " · "), n]), { max: 40, noPct: true })}${table("엔진별", Object.entries(byEng).sort((a, b) => b[1] - a[1]), {})}</div>`;
      sEl.innerHTML = `<div class="mt-cols">${table("많이 찾은 검색어", g("sq"), { max: 40, noPct: true })}${table("결과가 없었던 검색어 — 등록 후보", g("sq0"), { max: 40, noPct: true })}</div>`;
    }).catch((x) => { kEl.innerHTML = sEl.innerHTML = `<p class="note">${esc(x.message)}</p>`; });
  };
  $("#kwLoad").addEventListener("click", () => loaders.keywords());
  $("#kwDays").addEventListener("change", () => loaders.keywords());

  // 모니터링: 이 브라우저에서 바로 각 서버를 불러 보고 걸린 시간을 잰다 + 가동 감시 기록 + 자동 작업 + 오류 집계
  const sample = FONTS.find((f) => f.webfont && Object.values(f.webfont).some((u) => u.includes("letsum-mirror")));
  const hostedF = FONTS.find((f) => f.webfont && Object.values(f.webfont).some((u) => u.includes("/fonts-hosted/")));
  const CHECKS = [
    ["사이트(홈)", "/index.html"], ["API 서버", "/api/health"],
    ["웹폰트 미러(GitHub Pages)", sample ? Object.values(sample.webfont).find((u) => u.includes("letsum-mirror")) : ""],
    ["서버 전용 폰트(NAS)", hostedF ? Object.values(hostedF.webfont).find((u) => u.includes("/fonts-hosted/")) : ""],
    ["Google Fonts", "https://fonts.googleapis.com/css2?family=Noto+Sans+KR&display=swap"],
  ].filter((c) => c[1]);
  async function probe(url) {
    const t0 = performance.now(); const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000);
    try { const r = await fetch(url + (url.includes("?") ? "&" : "?") + "_mo=" + Date.now(), { cache: "no-store", signal: ctl.signal }); const b = await r.arrayBuffer(); return { ok: r.ok, code: r.status, ms: Math.round(performance.now() - t0), kb: Math.round(b.byteLength / 1024) }; }
    catch (e) { return { ok: false, code: e.name === "AbortError" ? "시간 초과" : "연결 실패", ms: Math.round(performance.now() - t0), kb: 0 }; }
    finally { clearTimeout(to); }
  }
  async function runChecks() {
    $("#moMsg").textContent = "점검 중…";
    $("#moLive").innerHTML = `<div class="mo-live">${CHECKS.map(([n], i) => `<div id="mo${i}"><b>${esc(n)}</b><span class="note">확인 중…</span></div>`).join("")}</div>`;
    await Promise.all(CHECKS.map(async ([n, u], i) => {
      const r = await probe(u); const lv = !r.ok ? "bad" : r.ms > 3000 ? "warn" : "ok";
      $("#mo" + i).innerHTML = `<b>${esc(n)}</b><span class="st ${lv}">${lv === "ok" ? "정상" : lv === "warn" ? "느림" : "문제"}</span>${r.ok ? `${nf(r.ms)}ms · ${nf(r.kb)}KB` : esc(String(r.code))}`;
    }));
    $("#moMsg").textContent = `마지막 점검 ${new Date().toLocaleTimeString("ko-KR")} · 3초 넘으면 '느림'`;
  }
  loaders.monitor = async function () {
    runChecks();
    const cols = $("#moCols"); cols.innerHTML = '<p class="note">기록 불러오는 중…</p>';
    const gh = (p) => fetch("https://api.github.com/repos/Geehg/letsum/" + p, { headers: { accept: "application/vnd.github+json" } }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("GitHub " + r.status))));
    const fmt = (s) => (s ? new Date(s).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
    const [iss, runs, met, tr] = await Promise.all([
      gh("issues?labels=outage&state=all&per_page=10").catch((e) => e), gh("actions/runs?per_page=30").catch((e) => e),
      key() ? call("metrics?days=7").catch((e) => e) : Promise.resolve(null), key() ? call("traffic?days=7").catch((e) => e) : Promise.resolve(null),
    ]);
    const outage = iss instanceof Error ? `<p class="note">${esc(iss.message)}</p>` : `<table class="spec mt-tbl">${iss.map((i) => `<tr><th><span class="st ${i.state === "open" ? "bad" : "ok"}">${i.state === "open" ? "장애 중" : "복구"}</span>${esc(i.title)}</th><td class="n">${fmt(i.created_at)}${i.closed_at ? ` → ${fmt(i.closed_at)}` : ""}</td></tr>`).join("") || '<tr><td class="note">장애 기록이 없습니다</td></tr>'}</table>`;
    let jobs = ""; if (runs instanceof Error) jobs = `<p class="note">${esc(runs.message)}</p>`; else { const last = {}; runs.workflow_runs.forEach((r) => { if (!last[r.name]) last[r.name] = r; }); jobs = `<table class="spec mt-tbl">${Object.values(last).map((r) => { const lv = r.status !== "completed" ? "warn" : r.conclusion === "success" ? "ok" : "bad"; return `<tr><th><span class="st ${lv}">${lv === "ok" ? "성공" : lv === "warn" ? "진행 중" : "실패"}</span><a class="linklike" href="${esc(r.html_url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a></th><td class="n">${fmt(r.run_started_at)}</td></tr>`; }).join("")}</table>`; }
    const ffail = {}; if (met && !(met instanceof Error)) met.rows.filter((x) => x.name === "ffail").forEach((x) => { ffail[x.font] = (ffail[x.font] || 0) + x.n; });
    const needKey = '<p class="note">서버 관리자 키를 연결하면 보입니다.</p>';
    cols.innerHTML = `
      <div><p class="mt-sub">가동 감시 기록 <span class="note">(10분마다 · 최근 10건)</span></p>${outage}</div>
      <div><p class="mt-sub">자동 작업 최근 실행</p>${jobs}</div>
      ${met === null ? `<div><p class="mt-sub">미리보기 실패 폰트 (7일)</p>${needKey}</div>` : met instanceof Error ? "" : table("미리보기 실패 폰트 (7일, 방문자 화면 기준)", Object.entries(ffail).sort((a, b) => b[1] - a[1]), { label: fname, noPct: true })}
      ${tr === null ? `<div><p class="mt-sub">스크립트 오류 (7일)</p>${needKey}</div>` : tr instanceof Error ? "" : table("스크립트 오류 (7일)", tr.dims.err || [], { noPct: true, max: 20 })}
      ${tr && !(tr instanceof Error) ? table("검색 로봇 방문 (7일)", tr.dims.bot || [], { noPct: true }) : ""}`;
  };
  $("#moRun").addEventListener("click", runChecks);

  // ================= 폰트 목록(읽기 전용) =================
  loaders.fonts = function () {
    const q = $("#fSearch").value.trim().toLowerCase(), so = $("#fSort").value;
    let L = FONTS.filter((f) => !q || f.name.toLowerCase().includes(q) || (f.designer || "").toLowerCase().includes(q) || (f.en || "").toLowerCase().includes(q));
    L.sort(so === "name" ? (a, b) => a.name.localeCompare(b.name) : so === "released" ? (a, b) => (b.released || "").localeCompare(a.released || "") : (a, b) => (b.added || "").localeCompare(a.added || ""));
    $("#fCount").textContent = `${L.length} / ${FONTS.length}종`;
    $("#fontRows").innerHTML = L.map((f) => `<tr>
      <td><b>${esc(f.name)}</b><br><span class="note">${esc(f.en || "")}</span></td>
      <td>${esc(f.category)}</td><td>${esc(f.designer)}</td><td>${esc(f.license)}</td>
      <td>${esc(f.released || "—")}</td><td>${esc(f.added || "—")}</td>
      <td>${f.intro ? "소개 전용" : "제공"}</td>
      <td style="white-space:nowrap"><a class="btn sm ghost" href="index.html#f=${f.id}" target="_blank" rel="noopener">상세</a> <button class="btn sm ghost" data-br="${f.id}" type="button">히어로 테마</button></td></tr>`).join("");
    $$("[data-br]").forEach((b) => b.addEventListener("click", () => { brFilter = "all"; $$("#brFilter button").forEach((x) => x.classList.toggle("on", x.dataset.f === "all")); sel = null; tab("brand"); openBrand(b.dataset.br); }));
  };
  $("#fSearch").addEventListener("input", () => loaders.fonts());
  $("#fSort").addEventListener("change", () => loaders.fonts());
})();
