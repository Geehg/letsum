// LETSUM 공통 헤더(홈 외 페이지): 폰트 보관함 · 검색 · 밝기 전환 — 홈(index)은 main.js가 직접 처리
(function () {
  const base = (document.currentScript && document.currentScript.dataset.base) || "";
  const home = base + "index.html";
  const tb = document.getElementById("themeBtn");
  if (tb) tb.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", cur); try { localStorage.setItem("ls_theme", cur); } catch (e) {}
  });
  const pb = document.getElementById("projBtn");
  if (pb) {
    let n = 0; try { n = (JSON.parse(localStorage.getItem("ls_projects")) || []).length; } catch (e) {}
    if (n) pb.innerHTML = `폰트 보관함 <small>${n}</small>`;
    pb.addEventListener("click", () => { location.href = home + "#vault"; });
  }
  const q = document.getElementById("qTop");
  if (q) q.closest("form").addEventListener("submit", (e) => { e.preventDefault(); const v = q.value.trim(); location.href = home + (v ? "?q=" + encodeURIComponent(v) : ""); });
})();
