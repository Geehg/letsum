// LETSUM 특수기호 — 누르면 복사, 한글 이름 검색, 모아 복사, 최근·즐겨찾기, 글자 꾸미기, 이모티콘·꾸밈선, 자음+한자 표, 기호 알아보기
// 데이터: data/symbols.json(tools/build_symbols.py가 유니코드 공식 데이터로 생성). 서버로 보내는 것 없음 — 최근·즐겨찾기·모은 기호는 이 브라우저에만 저장.
(function () {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const LS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const SV = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const cp = (c) => c.codePointAt(0), hex = (c) => cp(c).toString(16).toUpperCase().padStart(4, "0");
  let D = { cats: [], info: {}, han: [] };
  let recent = LS("ls_sym_recent", []), favs = LS("ls_sym_fav", []), mode = LS("ls_sym_mode", "copy"), cat = "fav", sel = null;

  // ---------- 복사·알림 ----------
  let toastT = 0;
  function toast(msg) { const t = $("#symToast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1400); }
  async function copy(text, label) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (x) {} ta.remove(); }
    toast(`${label || text} 복사됨`);
  }
  function pushRecent(c) { recent = [c, ...recent.filter((x) => x !== c)].slice(0, 48); SV("ls_sym_recent", recent); if (cat === "recent") drawGrid(); }

  // ---------- 모은 기호 ----------
  const bk = $("#bkText");
  bk.value = LS("ls_sym_bk", "");
  const saveBk = () => { SV("ls_sym_bk", bk.value); $("#symBasket").classList.toggle("has", !!bk.value); };
  bk.addEventListener("input", saveBk); saveBk();
  function addBk(c) { bk.value += c; saveBk(); toast(`${c} 모음 (${[...bk.value].length}자)`); }
  $("#bkCopy").addEventListener("click", () => bk.value ? copy(bk.value, "모은 기호 " + [...bk.value].length + "자") : toast("모은 기호가 없습니다"));
  $("#bkClear").addEventListener("click", () => { bk.value = ""; saveBk(); });

  // ---------- 기호표 ----------
  const nameKo = (c) => { const i = D.info[c] || {}; return (i.k || "").split(" ")[0] || (i.t || "").split(" ").slice(0, 3).join(" "); };
  function cell(c) {
    const i = D.info[c] || {};
    return `<button class="sc${c === sel ? " on" : ""}" data-c="${esc(c)}" role="listitem" title="${esc((nameKo(c) ? nameKo(c) + " · " : "") + (i.n || "") + " · U+" + hex(c))}">${esc(c)}</button>`;
  }
  function list() {
    const q = $("#symQ").value.trim();
    if (q) return search(q);
    if (cat === "recent") return recent;
    if (cat === "favs") return favs;
    const k = D.cats.find((x) => x.id === cat); return k ? [...k.chars] : [];
  }
  function search(q) {
    const all = Object.keys(D.info);
    const m = q.match(/^(?:u\+|0x|\\u)?([0-9a-f]{4,6})$/i);
    if (m) { const c = String.fromCodePoint(parseInt(m[1], 16)); return [c, ...all.filter((x) => x !== c && hex(x).startsWith(m[1].toUpperCase()))].slice(0, 300); }
    if (![...q].some((ch) => /[\p{L}\p{N}]/u.test(ch) && !/[ㄱ-ㆎ]/.test(ch))) return [...new Set([...q.replace(/\s/g, "")])]; // 기호 자체를 붙여 넣으면 그 글자들
    // 순위: ① 기호 고유 한국어 이름 ② 영문 이름을 옮긴 한국어 단어 ③ 영문 이름 ④ 분류 검색어(앞에서 하나도 없을 때만)
    const words = q.toLowerCase().split(/\s+/);
    const has = (s) => words.every((w) => s.includes(w));
    const kw = {}; D.cats.forEach((k) => (kw[k.id] = k.kw || ""));
    const scored = [];
    for (const c of all) {
      const i = D.info[c]; const k = (i.k || "").toLowerCase(), t = i.t || "", n = i.n;
      let s = -1;
      if (k && has(k)) s = k.split(" ")[0] === words[0] ? 0 : 1;
      else if (has(k + " " + t)) s = 2;
      else if (has(k + " " + t + " " + n)) s = 3;
      else if (has(k + " " + t + " " + n + " " + (kw[i.g] || ""))) s = 9;
      if (s >= 0) scored.push([c, s]);
    }
    const best = scored.filter((x) => x[1] < 9);
    return (best.length ? best : scored).sort((a, b) => a[1] - b[1]).map((x) => x[0]).slice(0, 600);
  }
  function drawCats() {
    const items = [["recent", "최근 사용", recent.length], ["favs", "즐겨찾기", favs.length], ...D.cats.map((k) => [k.id, k.name, [...k.chars].length])];
    $("#symCats").innerHTML = items.map(([id, n, len]) => `<button data-cat="${id}" class="${id === cat && !$("#symQ").value.trim() ? "on" : ""}">${esc(n)}<span>${len}</span></button>`).join("");
  }
  function drawGrid() {
    const L = list(); const q = $("#symQ").value.trim();
    $("#symGrid").innerHTML = L.length ? L.map(cell).join("") : `<p class="note sym-empty">${q ? "찾는 기호가 없습니다. 다른 이름(예: 별, 체크, 화살표)이나 코드(U+2605)로 찾아보세요." : cat === "favs" ? "기호를 누른 뒤 오른쪽의 ☆ 즐겨찾기를 누르면 여기에 모입니다." : "아직 사용한 기호가 없습니다."}</p>`;
    $("#symCount").textContent = q ? `검색 결과 ${L.length}개` : `${L.length}개`;
    drawCats();
  }
  function codes(c) {
    const n = cp(c), i = D.info[c] || {};
    const js = n > 0xffff ? `\\u{${n.toString(16).toUpperCase()}}` : `\\u${hex(c)}`;
    return [["유니코드", "U+" + hex(c)], ["HTML", `&#x${hex(c)};`], ...(i.e ? [["HTML 이름", `&${i.e};`]] : []), ["CSS", `"\\${n.toString(16).toUpperCase()}"`], ["JavaScript", `"${js}"`], ["URL", encodeURIComponent(c)]];
  }
  function info(c) {
    sel = c; const i = D.info[c] || {}; const fav = favs.includes(c);
    const h = i.h ? (D.han.find((x) => x.k === i.h) || {}) : null;
    $("#symInfo").innerHTML = `<div class="si-big">${esc(c)}</div>
      <div class="si-name">${esc(nameKo(c) || "")}<small>${esc(i.n || "")}</small></div>
      <div class="si-acts"><button class="tbtn lime" data-act="copy">복사</button><button class="tbtn" data-act="add">모으기 +</button><button class="tbtn${fav ? " on" : ""}" data-act="fav">${fav ? "★ 즐겨찾기" : "☆ 즐겨찾기"}</button><button class="tbtn" data-act="link" title="이 기호로 바로 오는 링크 복사">링크</button></div>
      ${h ? `<p class="si-han"><b>키보드로 입력</b> <kbd>${h.k}</kbd> + <kbd>한자</kbd> <span class="note">(${esc(h.name)} 목록 · 맥은 option+return)</span></p>` : ""}
      <table class="si-codes">${codes(c).map(([k, v]) => `<tr><th>${k}</th><td><code>${esc(v)}</code></td><td><button class="linklike" data-cp="${esc(v)}">복사</button></td></tr>`).join("")}</table>`;
    $$("#symGrid .sc").forEach((b) => b.classList.toggle("on", b.dataset.c === c));
    try { history.replaceState(null, "", "#c=" + hex(c)); } catch (e) {}
  }
  $("#symInfo").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !sel) return;
    if (b.dataset.cp) return copy(b.dataset.cp);
    const a = b.dataset.act;
    if (a === "copy") { copy(sel); pushRecent(sel); }
    else if (a === "add") addBk(sel);
    else if (a === "fav") { favs = favs.includes(sel) ? favs.filter((x) => x !== sel) : [sel, ...favs]; SV("ls_sym_fav", favs); info(sel); drawCats(); if (cat === "favs") drawGrid(); }
    else if (a === "link") copy(location.origin + location.pathname + "#c=" + hex(sel), "링크");
  });
  $("#symGrid").addEventListener("click", (e) => {
    const b = e.target.closest(".sc"); if (!b) return; const c = b.dataset.c;
    info(c);
    if (mode === "add") addBk(c); else { copy(c); pushRecent(c); }
  });
  $("#symCats").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; cat = b.dataset.cat; $("#symQ").value = ""; drawGrid(); $("#symGrid").scrollTop = 0; });
  let qT = 0; $("#symQ").addEventListener("input", () => { clearTimeout(qT); qT = setTimeout(() => { showTab("table"); drawGrid(); }, 120); });
  $("#symQ").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const f = list()[0]; if (f) { info(f); copy(f); pushRecent(f); } } });
  $$("#clickMode button").forEach((b) => { b.classList.toggle("on", b.dataset.m === mode); b.addEventListener("click", () => { mode = b.dataset.m; SV("ls_sym_mode", mode); $$("#clickMode button").forEach((x) => x.classList.toggle("on", x === b)); if (!$("#pane-fancy").hidden) drawFancy(); if (!$("#pane-what").hidden) drawWhat(); toast(mode === "add" ? "이제 누르면 아래 줄에 모읍니다" : "이제 누르면 바로 복사합니다"); }); });
  $$("#symFont button").forEach((b) => b.addEventListener("click", () => { $$("#symFont button").forEach((x) => x.classList.toggle("on", x === b)); document.body.classList.toggle("sym-serif", b.dataset.f === "serif"); }));

  // ---------- 탭 ----------
  function showTab(t) {
    $$("#symTabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    $$(".sym-pane").forEach((p) => (p.hidden = p.id !== "pane-" + t));
    $("#symCount").hidden = t !== "table"; // 개수는 기호표에서만
    if (t === "fancy") drawFancy(); if (t === "kao") drawKao(); if (t === "han") drawHan(); if (t === "what") drawWhat();
  }
  $$("#symTabs button").forEach((b) => b.addEventListener("click", () => { showTab(b.dataset.tab); try { history.replaceState(null, "", "#" + b.dataset.tab); } catch (e) {} }));

  // ---------- 글자 꾸미기(유니코드 수학 영숫자·원문자·전각 등) ----------
  const A = 65, a = 97;
  const off = (c, U, L, Dg, exc) => {
    if (exc && exc[c]) return exc[c];
    const n = c.charCodeAt(0);
    if (U != null && n >= 65 && n <= 90) return String.fromCodePoint(U + n - 65);
    if (L != null && n >= 97 && n <= 122) return String.fromCodePoint(L + n - 97);
    if (Dg != null && n >= 48 && n <= 57) return String.fromCodePoint(Dg + n - 48);
    return c;
  };
  const per = (fn) => (t) => [...t].map(fn).join("");
  const comb = (m) => (t) => [...t].map((c) => (c === " " ? c : c + m)).join("");
  const SMALL = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ", SUP = "ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ", SUPD = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const FLIP = { a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ", j: "ɾ", k: "ʞ", l: "l", m: "ɯ", n: "u", o: "o", p: "d", q: "b", r: "ɹ", s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", x: "x", y: "ʎ", z: "z", ".": "˙", ",": "'", "?": "¿", "!": "¡", "(": ")", ")": "(", "1": "Ɩ", "2": "ᄅ", "3": "Ɛ", "4": "ㄣ", "5": "ϛ", "6": "9", "7": "ㄥ", "8": "8", "9": "6", "0": "0" };
  const ex = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String.fromCodePoint(v)]));
  const FANCY = [
    ["굵게(세리프)", per((c) => off(c, 0x1D400, 0x1D41A, 0x1D7CE))],
    ["기울임(세리프)", per((c) => off(c, 0x1D434, 0x1D44E, null, ex({ h: 0x210E })))],
    ["굵은 기울임", per((c) => off(c, 0x1D468, 0x1D482, 0x1D7CE))],
    ["굵게(산세리프)", per((c) => off(c, 0x1D5D4, 0x1D5EE, 0x1D7EC))],
    ["기울임(산세리프)", per((c) => off(c, 0x1D608, 0x1D622))],
    ["굵은 기울임(산세리프)", per((c) => off(c, 0x1D63C, 0x1D656, 0x1D7EC))],
    ["필기체", per((c) => off(c, 0x1D49C, 0x1D4B6, null, ex({ B: 0x212C, E: 0x2130, F: 0x2131, H: 0x210B, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211B, e: 0x212F, g: 0x210A, o: 0x2134 })))],
    ["굵은 필기체", per((c) => off(c, 0x1D4D0, 0x1D4EA))],
    ["고딕(프락투어)", per((c) => off(c, 0x1D504, 0x1D51E, null, ex({ C: 0x212D, H: 0x210C, I: 0x2111, R: 0x211C, Z: 0x2128 })))],
    ["굵은 고딕(프락투어)", per((c) => off(c, 0x1D56C, 0x1D586))],
    ["겹선(더블)", per((c) => off(c, 0x1D538, 0x1D552, 0x1D7D8, ex({ C: 0x2102, H: 0x210D, N: 0x2115, P: 0x2119, Q: 0x211A, R: 0x211D, Z: 0x2124 })))],
    ["고정폭(타자기)", per((c) => off(c, 0x1D670, 0x1D68A, 0x1D7F6))],
    ["동그라미", per((c) => c === "0" ? "⓪" : off(c, 0x24B6, 0x24D0, null, null) !== c ? off(c, 0x24B6, 0x24D0) : /[1-9]/.test(c) ? String.fromCodePoint(0x2460 + +c - 1) : c)],
    ["검은 동그라미", per((c) => c === "0" ? "⓿" : /[1-9]/.test(c) ? String.fromCodePoint(0x2776 + +c - 1) : off(c.toUpperCase(), 0x1F150, null))],
    ["네모", per((c) => off(c.toUpperCase(), 0x1F130, null))],
    ["검은 네모", per((c) => off(c.toUpperCase(), 0x1F170, null))],
    ["괄호", per((c) => /[a-z]/i.test(c) ? String.fromCodePoint(0x249C + c.toLowerCase().charCodeAt(0) - 97) : /[1-9]/.test(c) ? String.fromCodePoint(0x2474 + +c - 1) : c)],
    ["전각(넓은 글자)", per((c) => c === " " ? "　" : off(c, 0xFF21, 0xFF41, 0xFF10))],
    ["작은 대문자", per((c) => /[a-z]/i.test(c) ? SMALL[c.toLowerCase().charCodeAt(0) - 97] : c)],
    ["위첨자", per((c) => /[a-z]/i.test(c) ? SUP[c.toLowerCase().charCodeAt(0) - 97] : /[0-9]/.test(c) ? SUPD[+c] : c)],
    ["뒤집기", (t) => [...t.toLowerCase()].reverse().map((c) => FLIP[c] || c).join("")],
    ["취소선", comb("̶")], ["밑줄", comb("̲")], ["두 줄 밑줄", comb("̳")], ["사선", comb("̸")],
    ["반짝 감싸기", (t) => `✧･ﾟ: *✧ ${t} ✧*:･ﾟ✧`], ["리본 감싸기", (t) => `꒰ ${t} ꒱`], ["괄호 감싸기", (t) => `【 ${t} 】`], ["별 감싸기", (t) => `★彡 ${t} 彡★`], ["하트 감싸기", (t) => `♡⸝⸝ ${t} ⸝⸝♡`],
  ];
  function drawFancy() {
    const t = $("#fancyIn").value || "Letsum";
    $("#fancyList").innerHTML = FANCY.map(([n, f], k) => { const r = f(t); return `<button class="fz" data-k="${k}"><small>${esc(n)}</small><span>${esc(r)}</span><i>${mode === "add" ? "모으기 +" : "복사"}</i></button>`; }).join("");
  }
  $("#fancyIn").addEventListener("input", drawFancy);
  $("#fancyList").addEventListener("click", (e) => { const b = e.target.closest(".fz"); if (!b) return; const r = FANCY[+b.dataset.k][1]($("#fancyIn").value || "Letsum"); if (mode === "add") addBk(r); else copy(r, FANCY[+b.dataset.k][0]); });

  // ---------- 이모티콘·꾸밈선 ----------
  const KAO = [
    ["기쁨·신남", ["(๑•̀ㅂ•́)و✧", "٩(◕‿◕｡)۶", "ヾ(≧▽≦*)o", "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "✧*｡٩(ˊᗜˋ*)و✧*｡", "(๑˃̵ᴗ˂̵)و", "(✿◠‿◠)", "ヽ(✿ﾟ▽ﾟ)ノ", "(●'◡'●)", "( ´ ▽ ` )ﾉ", "(•‿•)", "ㅇㅂㅇ", "(＾▽＾)", "＼(^o^)／"]],
    ["사랑·하트", ["(｡♥‿♥｡)", "( ˘ ³˘)♥", "(っ◔◡◔)っ ♥", "♡(ˆ‿ˆ)", "(づ｡◕‿‿◕｡)づ", "⸜(｡˃ ᵕ ˂ )⸝♡", "(๑•ᴗ•๑)♡", "( ˶ˆ꒳ˆ˵ )", "(*˘︶˘*).｡.:*♡", "(灬º‿º灬)♡"]],
    ["슬픔·당황", ["(｡•́︿•̀｡)", "(┬┬﹏┬┬)", "(；′⌒`)", "(´･ω･`)", "(⊙_⊙)？", "ಠ_ಠ", "ㅠㅠ", "(ㅠ﹏ㅠ)", "(；゜０゜)", "(・_・;)", "(°ロ°) !"]],
    ["화남·장난", ["(╯°□°）╯︵ ┻━┻", "┬─┬ノ( º _ ºノ)", "( ͡° ͜ʖ ͡°)", "¯\\_(ツ)_/¯", "ᕦ(ò_óˇ)ᕤ", "(ง •̀_•́)ง", "(｀へ´)", "凸(￣ヘ￣)", "ʘ‿ʘ", "(¬‿¬)"]],
    ["동물", ["ʕ•ᴥ•ʔ", "ฅ^•ﻌ•^ฅ", "(=^･ω･^=)", "ʕ￫ᴥ￩ʔ", "(・⊝・)", "Ꮚ・ꈊ・Ꮚ", "(∪･ω･∪)", "𓃠", "( ´(00)`)", "<(￣︶￣)>"]],
    ["인사·응원", ["( ⁎ᵕᴗᵕ⁎ )", "(￣▽￣)ノ", "✌︎('ω'✌︎ )", "ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧", "٩(ˊᗜˋ*)و", "(*•̀ᴗ•́*)و ̑̑", "( •̀ ω •́ )✧", "(^_^)/", "m(_ _)m", "(っ˘ڡ˘ς)"]],
    ["꾸밈 장식", ["˚₊‧꒰ა ☆ ໒꒱ ‧₊˚", "⋆｡°✩", "⊹₊⟡⋆", "୨୧", "✦ ✧ ✩", "⋆˚✿˖°", "❀ ✿ ❁ ✾", "♡⃛", "⁺‧₊˚ ཐི⋆♱⋆ཋྀ ˚₊‧⁺", "𖤐 𖤐 𖤐", "☾ ⋆*･ﾟ", "✩°｡⋆⸜ 🎧✮"]],
    ["구분선", ["━━━━━━━━━━", "──────────", "══════════", "▬▬▬▬▬▬▬▬", "┈┈┈┈┈┈┈┈┈┈", "・・・・・・・・", "⋯⋯⋯⋯⋯⋯", "✦ ─────── ✦", "°•°•°•°•°•°", "♡━━━━━━━━♡", "╰┈➤", "──── ୨୧ ────"]],
  ];
  function drawKao() {
    if ($("#kaoList").childElementCount) return;
    $("#kaoList").innerHTML = KAO.map(([n, L]) => `<div class="kao-g"><h3>${esc(n)}</h3><div class="kao-items">${L.map((x) => `<button class="kz" data-t="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>`).join("");
  }
  $("#kaoList").addEventListener("click", (e) => { const b = e.target.closest(".kz"); if (!b) return; if (mode === "add") addBk(b.dataset.t); else copy(b.dataset.t); });

  // ---------- 자음 + 한자 표 ----------
  function drawHan() {
    if ($("#hanList").childElementCount) return;
    $("#hanList").innerHTML = D.han.map((h) => `<div class="han-r"><div class="han-k"><kbd>${h.k}</kbd><span>+ 한자</span><b>${esc(h.name)}</b><small>${[...h.chars].length}자</small></div><div class="han-c">${[...h.chars].map((c) => `<button class="sc" data-c="${esc(c)}" title="U+${hex(c)}">${esc(c)}</button>`).join("")}</div></div>`).join("");
  }
  $("#hanList").addEventListener("click", (e) => { const b = e.target.closest(".sc"); if (!b) return; const c = b.dataset.c; if (mode === "add") addBk(c); else { copy(c); pushRecent(c); } });

  // ---------- 기호 알아보기 ----------
  function kind(c) {
    const n = cp(c);
    if (n >= 0xAC00 && n <= 0xD7A3) return "한글 음절";
    if (/\p{Script=Hangul}/u.test(c)) return "한글 자모";
    if (/\p{Script=Han}/u.test(c)) return "한자";
    if (/\p{Script=Latin}/u.test(c)) return "라틴 문자";
    if (/\p{Extended_Pictographic}/u.test(c)) return "이모지·그림 기호";
    if (/\p{N}/u.test(c)) return "숫자";
    if (/\p{P}/u.test(c)) return "문장부호";
    if (/\p{S}/u.test(c)) return "기호";
    if (/\p{M}/u.test(c)) return "결합 문자(앞 글자 위에 겹침)";
    if (/\s/.test(c)) return "공백";
    return "문자";
  }
  function drawWhat() {
    const t = $("#whatIn").value;
    const cs = [...new Set([...t])].slice(0, 60);
    $("#whatList").innerHTML = !cs.length ? `<p class="note">붙여 넣으면 글자마다 이름·코드·입력 방법을 알려 드립니다.</p>` : `<table class="what-t"><tr><th>글자</th><th>이름</th><th>코드</th><th>입력</th><th></th></tr>${cs.map((c) => {
      const i = D.info[c]; const h = i && i.h;
      return `<tr><td class="w-c">${/\s/.test(c) ? "␣" : esc(c)}</td><td>${i ? `<b>${esc(nameKo(c) || kind(c))}</b><br><small>${esc(i.n)}</small>` : `<b>${kind(c)}</b>`}</td><td><code>U+${hex(c)}</code></td><td>${h ? `<kbd>${h}</kbd> + <kbd>한자</kbd>` : ""}</td><td><button class="linklike" data-c="${esc(c)}">${mode === "add" ? "모으기 +" : "복사"}</button>${i ? ` · <button class="linklike" data-go="${esc(c)}">기호표에서 보기</button>` : ""}</td></tr>`;
    }).join("")}</table>`;
  }
  $("#whatIn").addEventListener("input", drawWhat);
  $("#whatList").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.c) { if (mode === "add") addBk(b.dataset.c); else copy(b.dataset.c); } if (b.dataset.go) { showTab("table"); $("#symQ").value = b.dataset.go; drawGrid(); info(b.dataset.go); } });

  // ---------- 시작 ----------
  fetch("data/symbols.json?v=1").then((r) => r.json()).then((j) => {
    D = j;
    const h = location.hash.slice(1);
    const mc = h.match(/^c=([0-9A-Fa-f]{4,6})$/);
    drawGrid();
    if (mc) { const c = String.fromCodePoint(parseInt(mc[1], 16)); $("#symQ").value = c; drawGrid(); info(c); }
    else if (["fancy", "kao", "han", "what"].includes(h)) showTab(h);
  }).catch(() => { $("#symGrid").innerHTML = '<p class="note">기호 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>'; });
})();
