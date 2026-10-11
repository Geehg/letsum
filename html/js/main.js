// LETSUM 시안 — 탐색/미리보기/필터/상세
(function () {
  const $ = (s) => document.querySelector(s);
  const grid = $("#grid"), count = $("#count");
  const state = { q: "", cat: "전체", lic: new Set(), sort: "pop", favOnly: false, text: $("#previewText").value };
  const favs = new Set(JSON.parse(localStorage.getItem("fm_favs") || "[]"));
  const saveFavs = () => localStorage.setItem("fm_favs", JSON.stringify([...favs]));

  // 분류 버튼
  const cats = ["전체", ...new Set(FONTS.map((f) => f.category))];
  $("#catGrp").innerHTML += cats.map((c) => `<button class="fbtn${c === "전체" ? " on" : ""}" data-cat="${c}">${c}</button>`).join("");
  // 허용 범위 버튼
  $("#licGrp").innerHTML += LICENSE_CATS.map((c) => `<button class="fbtn" data-lic="${c.key}">${c.label}</button>`).join("");
  // 빠른 선택 프리셋 (리서치 개선안 #1 — Font Squirrel식 용도 필터)
  const PRESETS = [
    { id: "commercial", label: "상업용 OK", keys: ["print", "web", "video", "bici", "package"] },
    { id: "webfont", label: "웹 임베딩 가능", keys: ["embed"] },
  ];
  $("#presetGrp").innerHTML += PRESETS.map((p) => `<button class="fbtn preset" data-preset="${p.id}">${p.label}</button>`).join("");
  function syncLicButtons() {
    document.querySelectorAll("[data-lic]").forEach((x) => x.classList.toggle("on", state.lic.has(x.dataset.lic)));
    document.querySelectorAll("[data-preset]").forEach((x) => {
      const p = PRESETS.find((y) => y.id === x.dataset.preset);
      x.classList.toggle("on", p.keys.every((k) => state.lic.has(k)));
    });
  }

  document.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => {
    state.cat = b.dataset.cat;
    document.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("on", x === b));
    render();
  }));
  document.querySelectorAll("[data-lic]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.lic;
    state.lic.has(k) ? state.lic.delete(k) : state.lic.add(k);
    syncLicButtons();
    render();
  }));
  document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = PRESETS.find((x) => x.id === b.dataset.preset);
    const allOn = p.keys.every((k) => state.lic.has(k));
    if (allOn) p.keys.forEach((k) => state.lic.delete(k));
    else p.keys.forEach((k) => state.lic.add(k));
    syncLicButtons();
    render();
  }));
  $("#favOnly").addEventListener("click", (e) => { state.favOnly = !state.favOnly; e.currentTarget.classList.toggle("on", state.favOnly); render(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("#qTop").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  $("#previewText").addEventListener("input", (e) => { state.text = e.target.value; renderPreviews(); });
  document.querySelectorAll("#quickChips .chip").forEach((c) => c.addEventListener("click", () => {
    $("#previewText").value = c.dataset.t; state.text = c.dataset.t; renderPreviews();
  }));

  function filtered() {
    let list = FONTS.filter((f) => {
      if (state.cat !== "전체" && f.category !== state.cat) return false;
      if (state.favOnly && !favs.has(f.id)) return false;
      for (const k of state.lic) if (f.matrix[k] !== "ok") return false;
      if (state.q) {
        const hay = (f.name + " " + f.en + " " + f.designer + " " + f.tags.join(" ")).toLowerCase();
        if (!hay.includes(state.q.toLowerCase())) return false;
      }
      return true;
    });
    if (state.sort === "pop") list.sort((a, b) => b.pop - a.pop);
    if (state.sort === "new") list.sort((a, b) => b.added.localeCompare(a.added));
    if (state.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return list;
  }

  function allOk(f) { return LICENSE_CATS.every((c) => f.matrix[c.key] === "ok"); }

  // 카드용 라이선스 미니 배지 (리서치 개선안 #1·#2 — 카드에서 바로 허용 용도 확인)
  const LIC_SHORT = { print: "인쇄", web: "웹", video: "영상", embed: "임베딩", bici: "BI·CI", package: "포장지" };
  function licIcons(f) {
    return Object.keys(LIC_SHORT).map((k) => {
      const v = f.matrix[k];
      const mark = v === "ok" ? "✓" : v === "no" ? "✕" : "△";
      return `<span class="${v === "ok" ? "li-ok" : "li-no"}">${LIC_SHORT[k]}${mark}</span>`;
    }).join("");
  }
  function licSummary(f) {
    if (f.license === "OFL") return "OFL · 상업 이용·수정·재배포 가능 (폰트 파일 판매 금지)";
    return f.license + " · 상세 페이지에서 사용 범위 확인";
  }

  function render() {
    const list = filtered();
    count.innerHTML = `총 <b>${list.length}</b>종 표시 · 전체 ${FONTS.length}종 (시안 데이터)`;
    grid.innerHTML = list.length ? list.map((f) => `
      <article class="card" data-id="${f.id}" tabindex="0" role="button" aria-label="${f.name} 상세 보기">
        <div class="pv" style="font-family:${f.family}">${escapeHtml(state.text || f.name)}</div>
        <div class="meta">
          <span class="fname">${f.name}</span>
          <span class="fdes">${f.designer}</span>
          <button class="fav${favs.has(f.id) ? " on" : ""}" data-fav="${f.id}" aria-label="즐겨찾기">${favs.has(f.id) ? "♥" : "♡"}</button>
        </div>
        <div class="meta">
          <span class="badge">${f.category}</span>
          ${allOk(f) ? '<span class="badge free">상업용 무료 · OFL</span>' : '<span class="badge">라이선스 확인</span>'}
          ${f.status === "verified" ? '<span class="badge">검수 완료</span>' : '<span class="badge check">확인 중</span>'}
          <span class="badge">굵기 ${f.weights.length}종</span>
        </div>
        <div class="licicons">${licIcons(f)}</div>
        <div class="licsum">${licSummary(f)}</div>
      </article>`).join("")
      : `<div class="empty">조건에 맞는 폰트가 없습니다. 필터를 줄여 보세요.</div>`;
    bindCards();
  }
  function renderPreviews() {
    const t = state.text;
    document.querySelectorAll(".card .pv").forEach((el) => { el.textContent = t || el.closest(".card").querySelector(".fname").textContent; });
    document.querySelectorAll(".mini-card .mpv").forEach((el) => { el.textContent = t || el.closest(".mini-card").querySelector(".mname").textContent; });
  }
  function bindCards() {
    grid.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-fav]")) return;
        openDetail(card.dataset.id);
      });
      card.addEventListener("keydown", (e) => { if (e.key === "Enter") openDetail(card.dataset.id); });
    });
    grid.querySelectorAll("[data-fav]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.fav;
      favs.has(id) ? favs.delete(id) : favs.add(id);
      saveFavs(); render();
    }));
  }

  // 상세 모달
  const overlay = $("#overlay"), modal = $("#modalBox");
  function st(v) { return v === "ok" ? '<span class="st-ok">사용 가능</span>' : v === "no" ? '<span class="st-no">사용 금지</span>' : '<span class="st-cond">조건부</span>'; }
  function openDetail(id) {
    const f = FONTS.find((x) => x.id === id); if (!f) return;
    const gfont = "https://fonts.googleapis.com/css2?family=" + f.en.replace(/ /g, "+") + ":wght@400;700&display=swap";
    const specimen = "https://fonts.google.com/specimen/" + f.en.replace(/ /g, "+");
    modal.innerHTML = `
      <button class="x" id="mx" aria-label="닫기">×</button>
      <div class="meta" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <h2 style="font-size:26px;font-weight:800">${f.name}</h2><span style="color:var(--ink3)">${f.en}</span>
        <span class="badge">${f.category}</span>
        ${allOk(f) ? '<span class="badge free">상업용 무료</span>' : ""}
      </div>
      <p style="color:var(--ink2);font-size:14px;margin-top:4px">저작권자 ${f.holder} · 제작 <button class="linklike" id="dsgBtn">${f.designer}</button></p>
      <div class="pv-big" id="pvBig" style="font-family:${f.family};font-size:40px">${escapeHtml(state.text || "책을 읽는 시간은 언제나 옳다")}</div>
      <div class="tester">
        <div class="t-row"><span>크기</span><input type="range" id="tSize" min="12" max="96" value="40"><b id="tSizeV">40px</b>
          <span class="t-w">굵기 ${f.weights.join(" · ")}</span></div>
        <div class="t-row"><span>자간</span><input type="range" id="tLs" min="-5" max="20" value="0"><b id="tLsV">0px</b></div>
        <div class="t-row"><span>행간</span><input type="range" id="tLh" min="120" max="240" value="160"><b id="tLhV">160%</b></div>
        <div class="t-row t-btns">
          <button class="fbtn" id="tDark">🌙 다크모드</button>
          <button class="fbtn" id="tVert">↕ 세로쓰기</button>
          <button class="fbtn" id="tLong">📄 장문</button>
          <button class="fbtn" id="tOld">옛한글</button>
          <button class="fbtn" id="tHanja">한자</button>
        </div>
        <div class="t-support" id="tSupport"><span class="badge check">글자 지원 확인 중…</span></div>
      </div>
      <p style="margin-top:14px;color:#333">${f.desc}</p>
      <table class="spec">
        <tr><th>지원 형식</th><td>${f.formats.join(", ")}</td></tr>
        <tr><th>지원 글자수</th><td>${f.glyphs}</td></tr>
        <tr><th>라이선스</th><td>${f.license} (SIL Open Font License 1.1)</td></tr>
        <tr><th>검수 상태</th><td>${f.status === "verified" ? "검수 완료" : "확인 중"} · 최종 검수일 ${f.verified}</td></tr>
        <tr><th>옛한글 지원</th><td id="mxOld">확인 중…</td></tr>
        <tr><th>한자 지원</th><td id="mxHanja">확인 중…</td></tr>
      </table>
      <h3 style="font-size:16px;font-weight:800;margin-top:20px">사용 범위 (라이선스 매트릭스)</h3>
      <table class="matrix">
        <tr><th style="width:90px">카테고리</th><th>사용 범위</th><th style="width:92px">허용 여부</th></tr>
        ${LICENSE_CATS.map((c) => `<tr><td><b>${c.label}</b></td><td>${c.key === "ofl" ? "폰트 파일의 수정·복제·배포 가능, 단 폰트 파일 자체의 유료 판매는 금지" : c.desc}</td><td>${st(f.matrix[c.key])}</td></tr>`).join("")}
      </table>
      <details class="embed">
        <summary>🌐 웹폰트로 바로 쓰기 (확장 서비스 미리보기 — F-13 CDN)</summary>
        <pre>&lt;link href="${gfont}" rel="stylesheet"&gt;

font-family: ${f.family};</pre>
        <p class="note" style="margin-top:8px">시안에서는 Google Fonts CDN으로 연결됩니다. 정식 서비스에서는 자체 CDN으로 임베드 코드를 제공할 계획입니다.</p>
      </details>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        <a class="btn blue" href="${specimen}" target="_blank" rel="noopener">원 배포처에서 다운로드</a>
        <button class="btn ghost" id="favBtn">${favs.has(f.id) ? "♥ 즐겨찾기 해제" : "♡ 즐겨찾기"}</button>
      </div>
      <p class="disclaimer">※ 위 사용 범위는 참고용으로, 정확한 사용 범위는 이용 전 폰트 저작권자에게 확인하시기 바랍니다. 사용 범위는 저작권자의 규정에 따라 달라질 수 있습니다.</p>`;
    overlay.classList.add("open");
    $("#mx").addEventListener("click", closeDetail);
    // 한글 타입 테스터 (리서치 중기 과제 #5)
    const pvBig = $("#pvBig");
    const baseText = state.text || "책을 읽는 시간은 언제나 옳다";
    const LONG_TXT = "한글 본문 테스트입니다. 이 문장은 실제 책 본문처럼 여러 줄에 걸쳐 렌더링되는 모습을 확인하기 위한 장문 샘플입니다. 자간과 행간을 조절해 가독성을 비교해 보세요. 명조체는 본문에, 고딕체는 제목과 UI에 자주 쓰입니다. 다람쥐 헌 쳇바퀴에 타고파.";
    const OLDH_TXT = "ᄒᆞᆫ글 옛한글 테스트: ᄂᆞᄅᆞᆺ말ᄊᆞ미";
    const HANJA_TXT = "韓國 漢字 1234";
    $("#tSize").addEventListener("input", (e) => { pvBig.style.fontSize = e.target.value + "px"; $("#tSizeV").textContent = e.target.value + "px"; });
    $("#tLs").addEventListener("input", (e) => { pvBig.style.letterSpacing = e.target.value + "px"; $("#tLsV").textContent = e.target.value + "px"; });
    $("#tLh").addEventListener("input", (e) => { pvBig.style.lineHeight = e.target.value + "%"; $("#tLhV").textContent = e.target.value + "%"; });
    const tgl = (id, fn) => $(id).addEventListener("click", (e) => { e.currentTarget.classList.toggle("on"); fn(e.currentTarget.classList.contains("on")); });
    tgl("#tDark", (on) => pvBig.classList.toggle("dark", on));
    tgl("#tVert", (on) => pvBig.classList.toggle("vert", on));
    tgl("#tLong", (on) => { pvBig.textContent = on ? LONG_TXT : baseText; });
    tgl("#tOld", (on) => { pvBig.textContent = on ? OLDH_TXT : baseText; });
    tgl("#tHanja", (on) => { pvBig.textContent = on ? HANJA_TXT : baseText; });
    // 옛한글·한자 지원 자동 검출 (리서치 중기 과제 #6 — document.fonts.check)
    try {
      const fam = `16px "${f.family}"`;
      const oh = document.fonts.check(fam, "ᄒᆞᆫ") ? "지원" : "미지원";
      const hj = document.fonts.check(fam, "韓國漢字") ? "지원" : "미지원";
      const badge = (v) => `<span class="badge ${v === "지원" ? "free" : ""}">${v}</span>`;
      $("#tSupport").innerHTML = `<span style="font-size:12.5px;color:var(--ink2)">옛한글</span>${badge(oh)}<span style="font-size:12.5px;color:var(--ink2)">한자</span>${badge(hj)}<span class="t-note">브라우저 자동 검출(참고용)</span>`;
      $("#mxOld").innerHTML = `${badge(oh)} <span class="t-note">자동 검출</span>`;
      $("#mxHanja").innerHTML = `${badge(hj)} <span class="t-note">자동 검출</span>`;
    } catch (err) {
      $("#tSupport").innerHTML = `<span class="badge">지원 여부 확인 불가</span>`;
      $("#mxOld").textContent = "확인 불가"; $("#mxHanja").textContent = "확인 불가";
    }
    $("#dsgBtn").addEventListener("click", () => openDesigner(f.designer));
    $("#favBtn").addEventListener("click", () => { favs.has(f.id) ? favs.delete(f.id) : favs.add(f.id); saveFavs(); openDetail(f.id); render(); });
  }
  // 제작자 페이지 (리서치 중기 과제 #8 — 제보→입점 사다리)
  function openDesigner(name) {
    const list = FONTS.filter((f) => f.designer === name);
    modal.innerHTML = `
      <button class="x" id="mx" aria-label="닫기">×</button>
      <h2 style="font-size:24px;font-weight:800;letter-spacing:-.02em">${name}</h2>
      <p style="color:var(--ink2);font-size:14px;margin:6px 0 16px">LETSUM 등록 폰트 ${list.length}종</p>
      <div class="coll-row">${list.map((f) => `
        <button class="mini-card" data-id="${f.id}">
          <span class="mpv" style="font-family:${f.family}">${escapeHtml(f.name)}</span>
          <span class="mname">${f.name} · 굵기 ${f.weights.length}종</span>
        </button>`).join("")}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
        <button class="btn blue" id="dsgSupport">❤ 제작자 후원하기</button>
        <a class="btn ghost" href="submit.html">유료 폰트 입점 신청</a>
      </div>
      <p class="note" style="margin-top:10px">후원 기능은 준비 중입니다. 입점 신청을 통해 후원 링크를 등록할 수 있습니다.</p>`;
    overlay.classList.add("open");
    $("#mx").addEventListener("click", closeDetail);
    $("#dsgSupport").addEventListener("click", () => alert("후원 기능은 준비 중입니다. 정식 서비스에서 제공될 예정입니다."));
    modal.querySelectorAll(".mini-card").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.id)));
  }
  function closeDetail() { overlay.classList.remove("open"); }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

  function escapeHtml(s) { return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  // 용도별 큐레이션 렌더링 (리서치 개선안 #3)
  function renderCollections() {
    const host = $("#collRows");
    if (!host || typeof COLLECTIONS === "undefined") return;
    host.innerHTML = COLLECTIONS.map((c) => {
      const fonts = FONTS.filter((f) => f.category === c.cat).sort((a, b) => b.pop - a.pop).slice(0, 6);
      return `<div class="coll-block">
        <div class="coll-title"><b>${c.title}</b><span>${c.desc}</span></div>
        <div class="coll-row">${fonts.map((f) => `
          <button class="mini-card" data-id="${f.id}">
            <span class="mpv" style="font-family:${f.family}">${escapeHtml(state.text || f.name)}</span>
            <span class="mname">${f.name}</span>
          </button>`).join("")}</div>
      </div>`;
    }).join("");
    host.querySelectorAll(".mini-card").forEach((b) => b.addEventListener("click", () => openDetail(b.dataset.id)));
  }

  render();
  renderCollections();
})();
