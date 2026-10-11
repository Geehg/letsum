// LETSUM 시안 — 관리자 데모 (localStorage 기반)
(function () {
  const $ = (s) => document.querySelector(s);
  const KEY = "fm_admin_fonts";
  let fonts = JSON.parse(localStorage.getItem(KEY) || "null");
  if (!fonts) { fonts = FONTS.map((f) => ({ ...f })); persist(); }
  function persist() { localStorage.setItem(KEY, JSON.stringify(fonts)); }

  const logged = sessionStorage.getItem("fm_admin") === "1";
  if (logged) showDash();

  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("#aid").value === ADMIN_ACCOUNT.id && $("#apw").value === ADMIN_ACCOUNT.pw) {
      sessionStorage.setItem("fm_admin", "1"); showDash();
    } else {
      $("#loginMsg").textContent = "아이디 또는 비밀번호가 다릅니다. (데모: admin / font1234)";
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
