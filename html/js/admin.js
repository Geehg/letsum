// LETSUM 시안 — 관리자 데모 (localStorage 기반)
(function () {
  const $ = (s) => document.querySelector(s);
  const KEY = "fm_admin_fonts";
  let fonts = JSON.parse(localStorage.getItem(KEY) || "null");
  if (!fonts) { fonts = FONTS.map((f) => ({ ...f })); persist(); }
  function persist() { localStorage.setItem(KEY, JSON.stringify(fonts)); }

  const logged = sessionStorage.getItem("fm_admin") === "1";
  if (logged) showDash();

  async function sha256(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("#aid").value === ADMIN_ACCOUNT.id && (await sha256($("#apw").value)) === ADMIN_ACCOUNT.pwHash) {
      sessionStorage.setItem("fm_admin", "1"); showDash();
    } else {
      $("#loginMsg").textContent = "아이디 또는 비밀번호가 다릅니다.";
    }
  });
  $("#logoutBtn").addEventListener("click", () => { sessionStorage.removeItem("fm_admin"); location.reload(); });
  $("#resetBtn").addEventListener("click", () => { localStorage.removeItem(KEY); localStorage.removeItem("fm_submits"); location.reload(); });

  function showDash() {
    $("#loginView").style.display = "none";
    $("#dashView").style.display = "block";
    renderFonts(); renderSubmits();
    const v = fonts.filter((f) => f.status === "verified").length;
    $("#statLine").textContent = `등록 폰트 ${fonts.length}종 · 검수 완료 ${v}종 · 확인 중 ${fonts.length - v}종`;
  }

  function renderFonts() {
    $("#fontRows").innerHTML = fonts.map((f) => `
      <tr>
        <td><b>${f.name}</b><br><span class="note">${f.en}</span></td>
        <td>${f.category}</td><td>${f.designer}</td><td>${f.license}</td>
        <td>${f.status === "verified" ? "검수 완료" : "확인 중"}</td>
        <td>${f.verified}</td>
        <td style="white-space:nowrap">
          <button class="btn sm ghost" data-edit="${f.id}">수정</button>
          <button class="btn sm ghost" data-del="${f.id}">삭제</button>
        </td>
      </tr>`).join("");
    document.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openEdit(b.dataset.edit)));
    document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      if (confirm("삭제할까요? (데모 데이터는 초기화로 복구할 수 있습니다)")) {
        fonts = fonts.filter((f) => f.id !== b.dataset.del); persist(); showDash();
      }
    }));
  }

  function renderSubmits() {
    const list = JSON.parse(localStorage.getItem("fm_submits") || "[]");
    if (!list.length) return;
    $("#submitList").innerHTML = `<table class="admin"><thead><tr><th>폰트명</th><th>제작자</th><th>라이선스</th><th>이메일</th><th>상태</th></tr></thead><tbody>` +
      list.map((s) => `<tr><td><b>${s.name}</b></td><td>${s.designer}</td><td>${s.type}</td><td>${s.email}</td><td>${s.status}</td></tr>`).join("") + "</tbody></table>";
  }

  const overlay = $("#editOverlay");
  $("#addBtn").addEventListener("click", () => openEdit(null));
  $("#editX").addEventListener("click", () => overlay.classList.remove("open"));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });

  function openEdit(id) {
    const f = id ? fonts.find((x) => x.id === id) : null;
    $("#editTitle").textContent = f ? "폰트 수정" : "폰트 추가";
    $("#ef-id").value = f ? f.id : "";
    $("#ef-name").value = f ? f.name : "";
    $("#ef-en").value = f ? f.en : "";
    $("#ef-cat").value = f ? f.category : "고딕";
    $("#ef-designer").value = f ? f.designer : "";
    $("#ef-status").value = f ? f.status : "checking";
    $("#ef-desc").value = f ? f.desc : "";
    overlay.classList.add("open");
  }

  $("#editForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#ef-id").value;
    const today = new Date().toISOString().slice(0, 10);
    if (id) {
      const f = fonts.find((x) => x.id === id);
      Object.assign(f, { name: $("#ef-name").value, en: $("#ef-en").value, category: $("#ef-cat").value,
        designer: $("#ef-designer").value, status: $("#ef-status").value, desc: $("#ef-desc").value, verified: today });
    } else {
      fonts.push({ id: "custom-" + Date.now(), name: $("#ef-name").value, en: $("#ef-en").value,
        family: "'Noto Sans KR', sans-serif", designer: $("#ef-designer").value, holder: $("#ef-designer").value,
        category: $("#ef-cat").value, tags: [], weights: [400], formats: ["TTF"], glyphs: "-",
        license: "OFL", matrix: OFL_ALL_OK, verified: today, status: $("#ef-status").value,
        pop: 50, added: today, desc: $("#ef-desc").value || "소개가 아직 없습니다." });
    }
    persist(); overlay.classList.remove("open"); showDash();
  });
})();

// ---------- 댓글 관리 (Cloudflare Worker /api/admin) ----------
(function () {
  const form = document.getElementById("ckForm"); if (!form) return;
  const keyEl = document.getElementById("ckKey"), list = document.getElementById("ckList"), msg = document.getElementById("ckMsg");
  const e = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  try { keyEl.value = sessionStorage.getItem("ls_admin_key") || ""; } catch (x) {}
  const key = () => keyEl.value.trim();
  async function call(path, body) {
    const r = await fetch("/api/admin/" + path, { method: body ? "POST" : "GET", headers: Object.assign({ authorization: "Bearer " + key() }, body ? { "content-type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({ error: "서버 응답 없음" }));
    if (!r.ok) throw new Error(j.error || "오류");
    return j;
  }
  async function load() {
    msg.textContent = "불러오는 중…";
    try {
      const j = await call("comments?filter=" + document.getElementById("ckFilter").value);
      try { sessionStorage.setItem("ls_admin_key", key()); } catch (x) {}
      const name = (id) => { const f = (typeof FONTS !== "undefined" ? FONTS : []).find((x) => x.id === id); return f ? f.name : id; };
      msg.textContent = `${j.items.length}건`;
      list.innerHTML = j.items.length ? `<table class="spec"><tr><th>폰트</th><th>작성</th><th>내용</th><th>상태</th><th></th></tr>${j.items.map((c) => `<tr>
        <td><a class="linklike" href="index.html#f=${e(c.font_id)}" target="_blank">${e(name(c.font_id))}</a></td>
        <td>${e(c.name)}<br><span class="note">${new Date(c.created).toLocaleString("ko-KR")}</span></td>
        <td style="max-width:420px;word-break:break-word">${e(c.body)}</td>
        <td>${c.hidden ? "숨김" : "공개"}${c.reports ? ` · 신고 ${c.reports}` : ""}</td>
        <td style="white-space:nowrap"><button class="btn sm ghost" data-act="${c.hidden ? "show" : "hide"}" data-cid="${c.id}">${c.hidden ? "복구" : "숨김"}</button>
          <button class="btn sm ghost" data-act="delete" data-cid="${c.id}">삭제</button></td></tr>`).join("")}</table>` : '<p class="note">해당하는 댓글이 없습니다.</p>';
      list.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", async () => {
        if (b.dataset.act === "delete" && !confirm("이 댓글을 영구 삭제할까요?")) return;
        try { await call("comment", { commentId: +b.dataset.cid, action: b.dataset.act }); load(); } catch (x) { msg.textContent = x.message; }
      }));
    } catch (x) { msg.textContent = x.message; list.innerHTML = ""; }
  }
  form.addEventListener("submit", (ev) => { ev.preventDefault(); load(); });
  document.getElementById("ckFilter").addEventListener("change", load);
})();

// ---------- 사용 사례 사진 검토 ----------
(function () {
  const list = document.getElementById("shotList"); if (!list) return;
  const msg = document.getElementById("shotMsgA"), badge = document.getElementById("shotBadge"), keyEl = document.getElementById("ckKey");
  const e = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const auth = () => ({ authorization: "Bearer " + keyEl.value.trim() });
  const name = (id) => { const f = (typeof FONTS !== "undefined" ? FONTS : []).find((x) => x.id === id); return f ? f.name : id; };
  let urls = [];
  async function summary() {
    try { const r = await fetch("/api/admin/summary", { headers: auth() }); if (!r.ok) return; const j = await r.json();
      badge.textContent = j.pendingShots ? `— 검토 대기 ${j.pendingShots}장` : "— 대기 없음";
      const cm = document.getElementById("ckMsg"); if (cm && j.reportedComments) cm.textContent = `신고된 댓글 ${j.reportedComments}건이 있습니다. '신고된 댓글'로 확인하세요.`;
    } catch (x) {}
  }
  async function load() {
    if (!keyEl.value.trim()) { msg.textContent = "아래 '댓글 관리'에 관리자 키를 먼저 넣어 주세요."; return; }
    msg.textContent = "불러오는 중…"; urls.forEach(URL.revokeObjectURL); urls = [];
    const st = document.getElementById("shotFilter").value;
    try {
      const r = await fetch("/api/admin/shots?status=" + st, { headers: auth() }); const j = await r.json();
      if (!r.ok) throw new Error(j.error || "오류");
      try { sessionStorage.setItem("ls_admin_key", keyEl.value.trim()); } catch (x) {}
      msg.textContent = `${j.items.length}장`; summary();
      list.innerHTML = j.items.length ? j.items.map((s) => `<div class="adm-shot" data-sid="${s.id}"><img alt="사진 ${s.id}">
        <b>${e(name(s.font_id))}</b><span>${e(s.caption || "(설명 없음)")}</span>
        <span class="note">${e(s.name)} · ${new Date(s.created).toLocaleString("ko-KR")} · ${Math.round(s.bytes / 1024)}KB</span>
        <div class="acts">${st === "pending" ? `<button class="btn sm" data-a="approve">승인(공개)</button><button class="btn sm ghost" data-a="reject">거절(삭제)</button>`
          : `<button class="btn sm ghost" data-a="unpublish">비공개로</button><button class="btn sm ghost" data-a="reject">삭제</button>`}</div></div>`).join("") : '<p class="note">해당하는 사진이 없습니다.</p>';
      list.querySelectorAll(".adm-shot").forEach(async (el) => {
        const r = await fetch("/api/admin/shot/" + el.dataset.sid, { headers: auth() }); if (!r.ok) return;
        const u = URL.createObjectURL(await r.blob()); urls.push(u); const img = el.querySelector("img"); img.src = u;
        img.addEventListener("click", () => window.open(u, "_blank"));
      });
      list.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", async () => {
        const sid = +b.closest(".adm-shot").dataset.sid;
        if (b.dataset.a === "reject" && !confirm("이 사진을 삭제할까요? 되돌릴 수 없습니다.")) return;
        const r = await fetch("/api/admin/shot", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, auth()), body: JSON.stringify({ shotId: sid, action: b.dataset.a }) });
        if (r.ok) load(); else msg.textContent = (await r.json().catch(() => ({}))).error || "오류";
      }));
    } catch (x) { msg.textContent = x.message; list.innerHTML = ""; }
  }
  document.getElementById("shotLoad").addEventListener("click", load);
  document.getElementById("shotFilter").addEventListener("change", load);
  document.getElementById("ckForm").addEventListener("submit", () => setTimeout(load, 50));
  if (keyEl.value.trim()) summary();
})();

// ---------- 이용 지표 ----------
(function () {
  const out = document.getElementById("mtOut"); if (!out) return;
  const msg = document.getElementById("mtMsg"), keyEl = document.getElementById("ckKey");
  const e = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const name = (id) => { const f = (typeof FONTS !== "undefined" ? FONTS : []).find((x) => x.id === id); return f ? f.name : id; };
  const LABEL = { visit: "방문(세션)", detail: "상세 열기", cmp_add: "비교 담기", cmp_open: "비교 창 열기", dl_zip: "파일 바로 받기", dl_page: "배포처 페이지 이동", record: "확인 기록 저장", wiz_open: "용도 추천 열기", wiz_apply: "용도 추천 적용", view: "보기 전환", text_custom: "내 문장 입력", cover_only: "'모두 지원' 필터", comment: "댓글", like: "좋아요", shot_up: "사진 올리기", share: "공유", proj_add: "프로젝트에 담기", proj_share: "프로젝트 링크 공유", proj_export: "프로젝트 내보내기" };
  async function load() {
    if (!keyEl.value.trim()) { msg.textContent = "아래 '댓글 관리'에 관리자 키를 먼저 넣어 주세요."; return; }
    msg.textContent = "불러오는 중…";
    try {
      const r = await fetch("/api/admin/metrics?days=" + document.getElementById("mtDays").value, { headers: { authorization: "Bearer " + keyEl.value.trim() } });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "오류");
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
      msg.textContent = `${j.from}부터 · 행동 기록 ${j.rows.reduce((s, x) => s + x.n, 0).toLocaleString()}건`;
      out.innerHTML = `
        <div class="mt-kpi">
          <div><b>${v.toLocaleString()}</b><span>방문(세션)</span></div>
          <div><b>${(tot.detail || 0).toLocaleString()}</b><span>상세 열기</span></div>
          <div><b>${(tot.cmp_add || 0).toLocaleString()}</b><span>비교 담기 · 방문 대비 ${pct(tot.cmp_add || 0)}</span></div>
          <div><b>${dl.toLocaleString()}</b><span>배포처 이동·받기 · ${pct(dl)}</span></div>
          <div><b>${(tot.record || 0).toLocaleString()}</b><span>확인 기록 저장 · ${pct(tot.record || 0)}</span></div>
          <div><b>${(tot.wiz_apply || 0).toLocaleString()}</b><span>용도 추천 적용 · ${pct(tot.wiz_apply || 0)}</span></div>
        </div>
        <p class="note">일별 방문</p><div class="mt-bar" title="일별 방문">${days.map((d) => `<i style="height:${((byDay[d] || 0) / mx) * 100}%" title="${d}: ${byDay[d] || 0}"></i>`).join("")}</div>
        <div class="mt-cols">
          <div><b>행동별 합계</b><table class="spec">${Object.keys(LABEL).filter((k) => tot[k]).map((k) => `<tr><th>${LABEL[k]}</th><td>${tot[k].toLocaleString()}</td></tr>`).join("") || "<tr><td>아직 기록이 없습니다</td></tr>"}</table></div>
          <div><b>많이 연 폰트</b><table class="spec">${top("detail").map(([id, o]) => `<tr><th>${e(name(id))}</th><td>${o.detail}</td></tr>`).join("") || "<tr><td>—</td></tr>"}</table></div>
          <div><b>배포처로 많이 간 폰트</b><table class="spec">${Object.entries(byFont).map(([id, o]) => [id, (o.dl_zip || 0) + (o.dl_page || 0)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => `<tr><th>${e(name(id))}</th><td>${n}</td></tr>`).join("") || "<tr><td>—</td></tr>"}</table></div>
          <div><b>보기 방식 · 용도 추천</b><table class="spec">${[...Object.entries(byVal.view || {}).map(([k, n]) => [`보기: ${k}`, n]), ...Object.entries(byVal.wiz_apply || {}).map(([k, n]) => [`용도: ${k}`, n])].map(([k, n]) => `<tr><th>${e(k)}</th><td>${n}</td></tr>`).join("") || "<tr><td>—</td></tr>"}</table></div>
        </div>`;
    } catch (x) { msg.textContent = x.message; out.innerHTML = ""; }
  }
  document.getElementById("mtLoad").addEventListener("click", load);
  document.getElementById("mtDays").addEventListener("change", load);
  document.getElementById("ckForm").addEventListener("submit", () => setTimeout(load, 80));
})();
