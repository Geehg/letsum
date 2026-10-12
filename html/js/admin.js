// LETSUM 관리자 — 로그인(해시 비교) 후 탭: 개요 · 히어로 테마 · 사진 · 댓글 · 지표 · 폰트 목록
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
    const h = location.hash.slice(1); tab(["home", "brand", "shots", "cmts", "metrics", "fonts"].includes(h) ? h : "home");
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
  const LABEL = { visit: "방문(세션)", detail: "상세 열기", cmp_add: "비교 담기", cmp_open: "비교 창 열기", dl_zip: "파일 바로 받기", dl_page: "배포처 페이지 이동", record: "확인 기록 저장", wiz_open: "용도 추천 열기", wiz_apply: "용도 추천 적용", view: "보기 전환", text_custom: "내 문장 입력", cover_only: "'모두 지원' 필터", comment: "댓글", like: "좋아요", shot_up: "사진 올리기", share: "공유", proj_add: "보관함에 담기", proj_share: "보관함 링크 공유", proj_export: "보관함 내보내기" };
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
