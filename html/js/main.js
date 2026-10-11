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

  document.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => {
    state.cat = b.dataset.cat;
    document.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("on", x === b));
    render();
  }));
  document.querySelectorAll("[data-lic]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.lic;
    state.lic.has(k) ? state.lic.delete(k) : state.lic.add(k);
    b.classList.toggle("on");
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
      </article>`).join("")
      : `<div class="empty">조건에 맞는 폰트가 없습니다. 필터를 줄여 보세요.</div>`;
    bindCards();
  }
  function renderPreviews() {
    document.querySelectorAll(".card .pv").forEach((el) => { el.textContent = state.text || el.closest(".card").querySelector(".fname").textContent; });
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
      <p style="color:var(--ink2);font-size:14px;margin-top:4px">저작권자 ${f.holder} · 제작 ${f.designer}</p>
      <div class="pv-big" id="pvBig" style="font-family:${f.family};font-size:40px">${escapeHtml(state.text || "책을 읽는 시간은 언제나 옳다")}</div>
      <div class="size-row"><span>미리보기 크기</span><input type="range" id="pvSize" min="16" max="72" value="40"><span id="pvSizeVal">40px</span>
      <span style="margin-left:auto">굵기 ${f.weights.join(" · ")}</span></div>
      <p style="margin-top:14px;color:#333">${f.desc}</p>
      <table class="spec">
        <tr><th>지원 형식</th><td>${f.formats.join(", ")}</td></tr>
        <tr><th>지원 글자수</th><td>${f.glyphs}</td></tr>
        <tr><th>라이선스</th><td>${f.license} (SIL Open Font License 1.1)</td></tr>
        <tr><th>검수 상태</th><td>${f.status === "verified" ? "검수 완료" : "확인 중"} · 최종 검수일 ${f.verified}</td></tr>
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
    $("#pvSize").addEventListener("input", (e) => { $("#pvBig").style.fontSize = e.target.value + "px"; $("#pvSizeVal").textContent = e.target.value + "px"; });
    $("#favBtn").addEventListener("click", () => { favs.has(f.id) ? favs.delete(f.id) : favs.add(f.id); saveFavs(); openDetail(f.id); render(); });
  }
  function closeDetail() { overlay.classList.remove("open"); }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

  function escapeHtml(s) { return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  render();
})();
