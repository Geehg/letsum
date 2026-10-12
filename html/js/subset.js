// LETSUM — 웹폰트 코드 만들기
// 1) 웹 사용·웹폰트 탑재 라이선스 확인  2) 공식 주소(Google Fonts · 배포처 CDN)로 넣는 코드
// 3) 로고·제목처럼 글자가 정해진 곳은 Google Fonts의 text= 기능(쓰는 글자만 담은 파일)으로 — 실제 용량을 재서 비교
// LETSUM은 파일을 제공하지 않는다. 공식 주소가 없으면 배포처 파일을 직접 올려 쓰는 방법만 안내.
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const GF = "https://fonts.googleapis.com/css2";
  // 배포처가 직접 운영하는 공식 웹폰트 CSS (tools/state/cdn_fonts.json에서 사람이 확인한 것)
  const OFFICIAL = {
    "k-nanum-square": "https://hangeul.pstatic.net/hangeul_static/css/nanum-square.css",
    "k-nanum-square-round": "https://hangeul.pstatic.net/hangeul_static/css/nanum-square-round.css",
    "k-nanum-barun-gothic": "https://hangeul.pstatic.net/hangeul_static/css/nanum-barun-gothic.css",
    "k-nanum-barun-pen": "https://hangeul.pstatic.net/hangeul_static/css/nanum-barun-pen.css",
    "k-nanum-gothic-eco": "https://hangeul.pstatic.net/hangeul_static/css/nanum-gothic-eco.css",
    "k-nanum-myeongjo-eco": "https://hangeul.pstatic.net/hangeul_static/css/nanum-myeongjo-eco.css",
    "k-spoqa-han-sans-neo": "https://cdn.jsdelivr.net/npm/spoqa-han-sans@3.3.0/css/SpoqaHanSansNeo.css",
  };
  const IC = {
    ok: '<svg class="lic-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    cond: '<svg class="lic-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    no: '<svg class="lic-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };
  const WORD = { ok: "가능", cond: "조건부", no: "불가" };
  const kind = (f) => (OFFICIAL[f.id] ? "cdn" : !f.webfont && !f.intro ? "gf" : "self");
  const KIND_LABEL = { gf: "Google Fonts", cdn: "배포처 공식 웹폰트", self: "직접 올려 쓰기" };
  const kb = (n) => (n >= 1024 * 1024 ? (n / 1048576).toFixed(1) + "MB" : Math.max(1, Math.round(n / 1024)) + "KB");

  // ---------- 폰트 목록 ----------
  const sel = $("#fSel");
  const groups = { gf: [], cdn: [], self: [] };
  FONTS.slice().sort((a, b) => a.name.localeCompare(b.name, "ko")).forEach((f) => groups[kind(f)].push(f));
  sel.innerHTML = [["gf", "Google Fonts — 쓰는 글자만 받기 가능"], ["cdn", "배포처 공식 웹폰트 주소 있음"], ["self", "공식 웹폰트 주소 없음 — 직접 올려 쓰기"]]
    .map(([k, l]) => `<optgroup label="${l} (${groups[k].length})">${groups[k].map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("")}</optgroup>`).join("");
  const want = new URLSearchParams(location.search).get("f");
  sel.value = FONTS.some((f) => f.id === want) ? want : groups.gf[0].id;

  const cur = () => FONTS.find((f) => f.id === sel.value);
  const mode = () => document.querySelector("input[name=mode]:checked").value;

  // 미리보기 글꼴(Google은 미리보기 문구 글자만, 그 외는 LETSUM 미리보기 파일 — 화면 확인용)
  const loaded = new Set();
  function previewFace(f, text) {
    if (kind(f) === "gf") {
      const k = f.id + "|" + text; if (loaded.has(k)) return; loaded.add(k);
      const l = document.createElement("link"); l.rel = "stylesheet";
      l.href = `${GF}?family=${encodeURIComponent(f.en).replace(/%20/g, "+")}:wght@${f.weights.join(";")}&text=${encodeURIComponent(text)}&display=swap`;
      document.head.appendChild(l); return;
    }
    if (!f.webfont || loaded.has(f.id)) return; loaded.add(f.id);
    const fam = f.family.split(",")[0].replace(/['"]/g, "").trim();
    Object.entries(f.webfont).forEach(([w, url]) => {
      const fmt = /\.otf/.test(url) ? "opentype" : /\.ttf/.test(url) ? "truetype" : /\.woff2/.test(url) ? "woff2" : "woff";
      const ff = new FontFace(fam, `url("${url}") format("${fmt}")`, { weight: String(w) }); document.fonts.add(ff); ff.load().catch(() => {});
    });
  }
  const famCss = (f) => (kind(f) === "gf" ? `'${f.en}', sans-serif` : f.family);

  function renderFont() {
    const f = cur(); const k = kind(f);
    try { history.replaceState(null, "", "?f=" + f.id); } catch (e) {}
    $("#fHint").innerHTML = `${esc(KIND_LABEL[k])} · ${esc(f.category)} · ${esc(f.designer)} · <a class="linklike" href="index.html#f=${f.id}">상세 보기</a>`;
    $("#wSel").innerHTML = f.weights.map((w) => `<option value="${w}">${w}</option>`).join("");
    $("#wSel").value = String(f.weights.includes(700) && f.category !== "명조" ? 700 : f.weights[Math.floor((f.weights.length - 1) / 2)]);
    const t = $("#inText").value.trim() || f.name;
    if (f.intro) $("#fPv").innerHTML = `<span class="wu-noprev">${esc(f.name)} — 미리보기 미제공(배포처에서 생김새 확인)</span>`;
    else { previewFace(f, t + f.name); $("#fPv").innerHTML = `<span style="font-family:${esc(famCss(f))};font-weight:${$("#wSel").value}">${esc(t)}</span>`; }
    // 라이선스
    const m = f.matrix, info = LICENSE_INFO[f.license] || {};
    const row = (key, label, desc) => `<div class="wu-li ${m[key]}"><span class="wu-li-k">${label}</span><span class="wu-li-v">${IC[m[key]] || IC.cond}${WORD[m[key]] || "확인 필요"}</span><span class="wu-li-d">${desc}</span></div>`;
    const block = m.web === "no" || m.embed === "no";
    $("#licBox").innerHTML = `<div class="wu-lic-h"><b>${esc(info.full || f.license)}</b>${info.url ? ` <a class="linklike" href="${esc(info.url)}" target="_blank" rel="noopener noreferrer">원문 ↗</a>` : ""}</div>
      ${row("web", "웹사이트", "웹페이지·배너에 글꼴로 표시")}
      ${row("embed", "웹폰트 탑재", "폰트 파일을 서버에 올리거나 CDN으로 불러오기")}
      ${row("ofl", "수정·변환", "파일을 줄이거나(서브셋) 형식 바꾸기")}
      ${m.embed === "cond" || m.web === "cond" ? `<p class="wu-warn">${IC.cond}<span>조건이 있습니다: ${esc(info.note || "라이선스 원문을 확인하세요.")}</span></p>` : ""}
      ${block ? `<p class="wu-stop">${IC.no}<span>이 폰트는 웹폰트로 쓰는 것이 허용되지 않습니다. 이미지로 만들어 쓰거나 다른 폰트를 고르세요.</span></p>` : ""}
      ${f.status !== "verified" ? `<p class="wu-warn">${IC.cond}<span>LETSUM이 아직 라이선스를 확인 중인 폰트입니다.</span></p>` : ""}`;
    $("#go").disabled = block;
    syncMode(); $("#out").hidden = true;
  }

  function syncMode() {
    const f = cur(), fixed = mode() === "fixed";
    $("#textField").hidden = !fixed;
    const t = $("#inText").value; const n = new Set([...t.replace(/\s/g, "")]).size;
    $("#cnt").textContent = n ? `서로 다른 글자 ${n}자` : "";
    document.querySelectorAll(".wu-mode").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
    if (!f.intro) $("#fPv span") && ($("#fPv span").style.fontWeight = $("#wSel").value);
  }

  // ---------- 코드 만들기 ----------
  const codeBox = (title, code, note) => `<div class="wu-code"><div class="wu-code-h"><b>${title}</b><button class="btn sm ghost" type="button" data-copy>복사</button></div><pre><code>${esc(code)}</code></pre>${note ? `<p class="wu-hint">${note}</p>` : ""}</div>`;
  async function sizeOf(url) {
    try { const r = await fetch(url, { method: "HEAD" }); const n = +r.headers.get("content-length"); if (n) return n; } catch (e) {}
    try { const r = await fetch(url); return (await r.blob()).size; } catch (e) { return 0; }
  }
  const urlsIn = (css) => [...css.matchAll(/url\((['"]?)([^)'"]+)\1\)\s*format\(['"]?(woff2|woff|truetype|opentype)/g)].map((m) => m[2]);
  function ranges(ur) { return ur.split(",").map((p) => p.trim().match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/)).filter(Boolean).map((m) => [parseInt(m[1], 16), parseInt(m[2] || m[1], 16)]); }

  async function build() {
    const f = cur(), k = kind(f), w = +$("#wSel").value, fixed = mode() === "fixed";
    const text = [...new Set([...$("#inText").value.replace(/\s/g, "")])].join("");
    const out = $("#outBody"); $("#out").hidden = false;
    if (fixed && !text) { out.innerHTML = '<p class="wu-warn">쓸 문구를 넣어 주세요.</p>'; return; }
    out.innerHTML = '<p class="wu-hint">만드는 중…</p>';
    const use = `.logo, h1 {\n  font-family: ${famCss(f)};\n  font-weight: ${w};\n}`;
    let html = "";
    if (k === "gf") {
      const fam = encodeURIComponent(f.en).replace(/%20/g, "+");
      const base = `${GF}?family=${fam}:wght@${w}`;
      const href = fixed ? `${base}&text=${encodeURIComponent(text)}&display=swap` : `${base}&display=swap`;
      const link = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="${href}" rel="stylesheet">`;
      html += codeBox("① HTML의 &lt;head&gt;에 넣기", link, fixed ? "이 코드는 위 문구의 글자만 담은 파일을 불러옵니다. 문구를 바꾸면 코드를 다시 만드세요." : `굵기를 더 쓰려면 <code>wght@${w}</code>를 <code>wght@400;700</code>처럼 바꾸세요.`);
      html += codeBox("② CSS에서 쓰기", fixed ? use : `body {\n  font-family: ${famCss(f)};\n}`);
      out.innerHTML = html + '<div class="wu-size" id="sizeBox"><p class="wu-hint">실제 용량을 재는 중…</p></div>'; bindCopy();
      // 용량 비교: 일반 방식(필요한 조각들) vs 글자 지정(파일 하나)
      try {
        const cssN = await (await fetch(`${base}&display=swap`)).text();
        const blocks = cssN.match(/@font-face\s*{[^}]+}/g) || [];
        const cps = [...(fixed ? text : "가나다라마바사아자차카타파하ABCabc123")].map((c) => c.codePointAt(0));
        const need = blocks.filter((b) => { const m = b.match(/unicode-range:\s*([^;]+);/); if (!m) return true; const R = ranges(m[1]); return cps.some((cp) => R.some(([a, z]) => cp >= a && cp <= z)); });
        const nSizes = await Promise.all(need.flatMap((b) => urlsIn(b).slice(0, 1)).map(sizeOf));
        const normal = nSizes.reduce((s, x) => s + x, 0);
        if (fixed) {
          const cssT = await (await fetch(href)).text(); const tu = urlsIn(cssT)[0];
          const small = tu ? await sizeOf(tu) : 0;
          const pct = normal && small ? Math.round((1 - small / normal) * 100) : 0;
          $("#sizeBox").innerHTML = `<div class="wu-bars"><div><span>일반 방식</span><i style="width:100%"></i><b>${kb(normal)}</b><small>조각 ${need.length}개</small></div>
            <div class="on"><span>쓰는 글자만</span><i style="width:${normal ? Math.max(2, (small / normal) * 100) : 0}%"></i><b>${kb(small)}</b><small>파일 1개</small></div></div>
            <p class="wu-hint">${pct > 0 ? `<b>${pct}% 가볍습니다.</b> ` : ""}${text.length}자 · ${f.name} ${w} 기준으로 지금 실제 받아 잰 값입니다.</p>`;
        } else {
          $("#sizeBox").innerHTML = `<p class="wu-hint">Google Fonts는 이 폰트를 <b>${blocks.length}개 조각</b>으로 나눠 두었고, 브라우저가 페이지에 나온 글자가 든 조각만 받습니다. 예: 짧은 한국어 문장 한 줄이면 조각 ${need.length}개, 약 ${kb(normal)}.</p>`;
        }
      } catch (e) { $("#sizeBox").innerHTML = '<p class="wu-hint">용량을 재지 못했습니다(네트워크). 코드는 그대로 쓸 수 있습니다.</p>'; }
      return;
    }
    if (k === "cdn") {
      const css = OFFICIAL[f.id];
      let fams = [];
      try { const t = await (await fetch(css)).text(); fams = [...new Set([...t.matchAll(/font-family:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))]; } catch (e) {}
      const famName = fams[0] || f.en;
      html += codeBox("① HTML의 &lt;head&gt;에 넣기", `<link href="${css}" rel="stylesheet">`, `${esc(f.designer)}가 운영하는 공식 웹폰트 주소입니다.`);
      html += codeBox("② CSS에서 쓰기", `${fixed ? ".logo, h1" : "body"} {\n  font-family: '${famName}', sans-serif;${fams.length > 1 ? "" : `\n  font-weight: ${w};`}\n}`, fams.length > 1 ? `이 CSS는 굵기마다 이름이 다릅니다: ${fams.map((x) => `<code>${esc(x)}</code>`).join(" ")}` : "");
      if (fixed) html += `<p class="wu-warn">${IC.cond}<span>이 공식 주소에는 '쓰는 글자만' 받는 기능이 없어 폰트 전체를 받습니다. 더 가볍게 하려면 아래 '직접 올려 쓰기'처럼 파일을 줄여 쓰세요(라이선스가 수정을 허용할 때만).</span></p>`;
      out.innerHTML = html + selfHostHTML(f, w, fixed, text, true); bindCopy();
      const u = f.webfont && (f.webfont[w] || Object.values(f.webfont)[0]);
      if (u) sizeOf(u).then((n) => { const el = $("#cdnSize"); if (el && n) el.textContent = `참고: 이 굵기 파일 하나가 약 ${kb(n)}입니다.`; });
      return;
    }
    out.innerHTML = selfHostHTML(f, w, fixed, text, false); bindCopy();
  }

  function selfHostHTML(f, w, fixed, text, secondary) {
    const m = f.matrix; const canMod = m.ofl === "ok";
    const fmt = (f.formats || []).join("·") || "배포처 확인";
    const ext = canMod ? "woff2" : /OTF/i.test(fmt) && !/TTF/i.test(fmt) ? "otf" : "ttf";
    const ffFmt = { woff2: "woff2", otf: "opentype", ttf: "truetype" }[ext];
    const file = `${f.en.replace(/[^A-Za-z0-9]+/g, "")}-${w}${fixed && canMod ? "-subset" : ""}.${ext}`;
    const face = `@font-face {\n  font-family: '${f.en}';\n  src: url('/fonts/${file}') format('${ffFmt}');\n  font-weight: ${w};\n  font-display: swap;\n}\n\n${fixed ? ".logo, h1" : "body"} {\n  font-family: '${f.en}', sans-serif;\n}`;
    const isOFL = /OFL/i.test(f.license);
    const shellText = text.replace(/["\\$\x60]/g, (c) => "\\" + c); // 셸 큰따옴표 안에서 안전하게
    let h = secondary ? `<h3 class="wu-sub">더 가볍게: 직접 올려 쓰기</h3><p class="wu-hint" id="cdnSize"></p>` : `<p class="wu-lead2">${f.intro ? "이 폰트는 LETSUM 미리보기를 제공하지 않습니다. " : ""}공식 웹폰트 주소가 없어, 배포처에서 받은 파일을 내 서버에 올려 씁니다.</p>`;
    h += `<ol class="wu-steps">
      <li><a class="btn sm" href="${esc((f.dl && f.dl.page) || "#")}" target="_blank" rel="noopener">배포처에서 받기 ↗</a> <span class="wu-hint">제공 형식: ${esc(fmt)}</span></li>`;
    if (canMod) {
      h += `<li>${fixed ? "쓰는 글자만 남겨 작은 WOFF2로 줄이기" : "WOFF2로 변환해 용량 줄이기"} <span class="wu-hint">(Python fontTools 필요: <code>pip install fonttools brotli</code>)</span>
        ${codeBox("터미널", `pyftsubset 받은파일.${/OTF/i.test(fmt) && !/TTF/i.test(fmt) ? "otf" : "ttf"} \\\n  ${fixed ? `--text="${shellText}"` : "--unicodes='U+0020-007E,U+AC00-D7A3,U+3131-318E'"} \\\n  --flavor=woff2 --layout-features='*' \\\n  --output-file=${file}`, isOFL ? "OFL 폰트를 줄이면 '수정본'이 됩니다. 라이선스에 예약 글꼴 이름(Reserved Font Name)이 있으면 줄인 파일은 다른 글꼴 이름으로 바꿔야 할 수 있으니 원문을 확인하세요." : "수정이 허용된 라이선스입니다. 출처 표시 등 원문의 조건을 지켜 주세요.")}</li>`;
    } else {
      h += `<li class="wu-warn-li">${IC.no}<span>이 폰트는 파일 수정·변환이 허용되지 않습니다. <b>받은 파일을 그대로</b> 올리세요(줄이거나 형식을 바꾸지 마세요).</span></li>`;
    }
    h += `<li>파일을 내 사이트의 <code>/fonts/</code> 폴더에 올리기</li>
      <li>${codeBox("CSS", face)}</li></ol>`;
    return h;
  }

  function bindCopy() {
    document.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => {
      const t = b.closest(".wu-code").querySelector("code").textContent;
      try { await navigator.clipboard.writeText(t); b.textContent = "복사됨"; } catch (e) { b.textContent = "직접 선택해 복사"; }
      setTimeout(() => (b.textContent = "복사"), 1500);
    });
  }

  sel.addEventListener("change", renderFont);
  $("#wSel").addEventListener("change", syncMode);
  document.querySelectorAll("input[name=mode]").forEach((r) => r.addEventListener("change", () => { syncMode(); $("#out").hidden = true; }));
  let tt; $("#inText").addEventListener("input", () => { syncMode(); clearTimeout(tt); tt = setTimeout(() => { const f = cur(); if (!f.intro) { const t = $("#inText").value.trim() || f.name; previewFace(f, t + f.name); $("#fPv span").textContent = t; } }, 300); });
  $("#go").addEventListener("click", build);
  renderFont();
})();
