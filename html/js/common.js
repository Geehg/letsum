// LETSUM 공통 헤더(홈 외 페이지): 폰트 보관함 · 검색 · 밝기 전환 — 홈(index)은 main.js가 직접 처리
(function () {
  const base = (document.currentScript && document.currentScript.dataset.base) || "";
  const home = base + "index.html";
  const localizedURL = value => window.LSUI ? LSUI.localURL(value) : value;
  const tb = document.getElementById("themeBtn");
  if (tb) tb.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", cur); try { localStorage.setItem("ls_theme", cur); } catch (e) {}
  });
  const pb = document.getElementById("projBtn");
  if (pb) {
    let n = 0; try { n = (JSON.parse(localStorage.getItem("ls_projects")) || []).length; } catch (e) {}
    if (n) pb.innerHTML = `폰트 보관함 <small>${n}</small>`;
    pb.addEventListener("click", () => { location.href = localizedURL(home + "#vault"); });
  }
  const q = document.getElementById("qTop");
  if (q) q.closest("form").addEventListener("submit", (e) => { e.preventDefault(); const v = q.value.trim(); location.href = localizedURL(home + (v ? "?q=" + encodeURIComponent(v) : "")); });
  // 폰트 상세 페이지: 받기를 누르면 운영체제별 설치 순서와 '설치 후 보이는 이름'을 알려 준다(홈 main.js와 같은 안내)
  const inst = document.getElementById("instData");
  if (inst) document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-dl]"); if (!a) return;
    try { if (localStorage.getItem("ls_noTip") === "1") return; } catch (x) {}
    let d = {}; try { d = JSON.parse(inst.textContent); } catch (x) {}
    const u = navigator.userAgent, os = /iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ? "ios" : /Android/.test(u) ? "android" : /Mac/.test(u) ? "mac" : /Windows/.test(u) ? "win" : "etc";
    const E = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
    const steps = {
      win: ["받은 zip 파일을 <b>오른쪽 클릭 → 압축 풀기</b>", "글꼴 파일(.ttf·.otf)을 <b>오른쪽 클릭 → 모든 사용자용으로 설치</b>", "쓰던 프로그램을 <b>껐다 켜면</b> 목록에 보입니다"],
      mac: ["받은 zip 파일을 <b>더블클릭</b>하면 폴더가 풀립니다", "글꼴 파일(.ttf·.otf)을 <b>더블클릭 → 서체 설치</b>", "쓰던 프로그램을 <b>껐다 켜면</b> 목록에 보입니다"],
      ios: ["아이폰·아이패드는 글꼴 설치를 지원하는 앱에서만 쓸 수 있어요", "PC나 Mac에서 설치해 작업하는 것을 권합니다"],
      android: ["안드로이드는 앱마다 글꼴 추가 방법이 다릅니다", "PC나 Mac에서 설치해 작업하는 것을 권합니다"],
    }[os] || ["받은 파일의 압축을 풀고 글꼴 파일(.ttf·.otf)을 운영체제 글꼴 폴더에 설치하세요"];
    const pre = a.dataset.dl === "page" ? [d.gf ? "열린 Google Fonts 페이지 오른쪽 위 <b>Get font → Download all</b>" : "열린 배포처 페이지에서 이용 조건을 확인하고 파일을 받으세요"] : [];
    const nm = os === "mac" ? (d.fam || d.win) : (d.win || d.fam);
    let el = document.getElementById("instTip");
    if (!el) { el = document.createElement("aside"); el.id = "instTip"; el.className = "inst-tip"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = `<button class="it-x" type="button" aria-label="닫기">×</button><p class="it-k">${E(d.name || "")} 설치 방법 · ${{ win: "Windows", mac: "Mac", ios: "iPhone·iPad", android: "Android" }[os] || "PC"}</p>
      <ol>${[...pre, ...steps].map((x) => `<li>${x}</li>`).join("")}</ol>${nm ? `<p class="it-name">설치 후 프로그램에서 찾을 이름<br><b>${E(nm)}</b>${d.ps ? ` <small>포토샵 PostScript: ${E(d.ps)}</small>` : ""}</p>` : ""}
      <label class="it-no"><input type="checkbox"> 다시 보지 않기</label>`;
    el.hidden = false;
    el.querySelector(".it-x").onclick = () => { el.hidden = true; };
    el.querySelector(".it-no input").onchange = (ev) => { try { localStorage.setItem("ls_noTip", ev.target.checked ? "1" : "0"); } catch (x) {} if (ev.target.checked) el.hidden = true; };
  }, true);
})();
