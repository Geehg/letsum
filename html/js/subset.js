// LETSUM — 한글 웹폰트 서브셋 생성기 (리서치 중기 과제 #7)
(function () {
  const $ = (s) => document.querySelector(s);
  const sel = $("#fSel");
  sel.innerHTML = FONTS.map((f) => `<option value="${f.id}">${f.name}</option>`).join("");

  $("#go").addEventListener("click", async () => {
    const f = FONTS.find((x) => x.id === sel.value);
    const text = $("#inText").value;
    const cps = [...new Set([...text])].map((ch) => ch.codePointAt(0)).filter((cp) => cp > 32).sort((a, b) => a - b);
    const out = $("#out");
    out.style.display = "block";
    if (!cps.length) {
      $("#stat").textContent = "분석할 글자가 없습니다. 문장을 입력해 주세요.";
      $("#cssOut").textContent = "";
      return;
    }
    const needed = new Set(cps);
    $("#stat").innerHTML = `분석 글자 <b>${cps.length}</b>자 · <b>${f.name}</b> 기준`;
    $("#cssOut").textContent = "Google Fonts에서 폰트 분할 정보를 가져오는 중…";
    try {
      const css = await buildSubsetCss(f, needed);
      $("#cssOut").textContent = css || "/* 입력 문장에 해당하는 분할을 찾지 못했습니다. */";
    } catch (e) {
      $("#cssOut").textContent = manualTemplate(f, cps);
      $("#stat").innerHTML += `<br><span class="t-note">분할 정보를 가져오지 못해 수동 템플릿을 제공합니다.</span>`;
    }
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  $("#copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#cssOut").textContent); } catch (e) {}
    const b = $("#copy");
    b.textContent = "복사됨 ✓";
    setTimeout(() => { b.textContent = "CSS 복사"; }, 1500);
  });

  function parseRanges(ur) {
    const out = [];
    ur.split(",").forEach((part) => {
      const m = part.trim().match(/^U\+([0-9A-Fa-f]{4,6})(?:-([0-9A-Fa-f]{4,6}))?$/);
      if (m) out.push([parseInt(m[1], 16), parseInt(m[2] || m[1], 16)]);
    });
    return out;
  }

  async function buildSubsetCss(f, needed) {
    const fam = f.en.replace(/ /g, "+");
    const url = "https://fonts.googleapis.com/css2?family=" + fam + ":wght@" + f.weights.join(";") + "&display=swap";
    const res = await fetch(url);
    if (!res.ok) throw new Error("css fetch failed");
    const css = await res.text();
    const blocks = css.match(/@font-face\s*{[^}]+}/g) || [];
    const keep = blocks.filter((b) => {
      const m = b.match(/unicode-range:\s*([^;]+);/i);
      if (!m) return true;
      return parseRanges(m[1]).some(([a, z]) => {
        for (const cp of needed) if (cp >= a && cp <= z) return true;
        return false;
      });
    });
    if (!keep.length) return "";
    return `/* ${f.name} 서브셋 — ${needed.size}자 사용, ${keep.length}개 분할만 포함 */\n` + keep.join("\n\n");
  }

  function manualTemplate(f, cps) {
    const ranges = [];
    let s = cps[0], p = cps[0];
    for (let i = 1; i <= cps.length; i++) {
      const c = cps[i];
      if (c === p + 1) { p = c; continue; }
      ranges.push([s, p]); s = c; p = c;
    }
    const fmt = (n) => "U+" + n.toString(16).toUpperCase().padStart(4, "0");
    const ur = ranges.map(([a, b]) => (a === b ? fmt(a) : fmt(a) + "-" + fmt(b))).join(", ");
    return `/* ${f.name} — 사용할 woff2 URL을 아래 src에 붙여넣으세요\n   (Google Fonts CSS에서 해당 family의 src url을 복사) */\n@font-face {\n  font-family: "${f.family}";\n  src: url("여기에-woff2-URL") format("woff2");\n  unicode-range: ${ur};\n}`;
  }
})();
