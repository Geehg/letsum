// 원본 글자 모양 미리보기 — 브라우저가 웹폰트로 열지 못하는 원본 폰트(부속 표 손상)를 위한 표시 방법.
// 배포처가 준 원본 파일을 그대로 받아 opentype.js로 읽고, 입력 문장의 글자 윤곽을 SVG로 그린다.
// 폰트 파일을 고치거나 새 폰트 파일을 만들지 않는다(원본으로 그린 견본 이미지를 화면에서 바로 그리는 것과 같음).
// 사용: <div class="intro-pv" data-ol-url="원본 주소" data-ol-text="문장" data-ol-size="28" data-ol-lines="3">…</div>
// 화면에 들어올 때만 파일을 받는다. 같은 파일은 한 번만 받는다.
(function () {
  "use strict";
  const LIB = (document.currentScript && document.currentScript.dataset.lib) || "/js/vendor/opentype-1.3.4.min.js";
  let libP = null;
  const lib = () => libP || (libP = window.opentype ? Promise.resolve(window.opentype) : new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = LIB; s.async = true;
    s.onload = () => (window.opentype ? ok(window.opentype) : no(new Error("opentype-missing"))); s.onerror = () => no(new Error("opentype-load"));
    document.head.appendChild(s);
  }));
  const fonts = new Map();
  const load = (url) => {
    if (!fonts.has(url)) fonts.set(url, Promise.all([lib(), fetch(url, { credentials: "omit" }).then((r) => { if (!r.ok) throw new Error("http-" + r.status); return r.arrayBuffer(); })])
      .then(([ot, buf]) => ot.parse(buf)).catch((e) => { fonts.delete(url); throw e; }));
    return fonts.get(url);
  };
  const NS = "http://www.w3.org/2000/svg";
  // 상자 폭에 맞춰 줄을 나눈다(띄어쓰기 단위, 한 단어가 너무 길면 글자 단위)
  function wrap(font, text, size, maxW, maxLines) {
    const adv = (s) => font.getAdvanceWidth(s, size, { kerning: false });
    const out = [];
    for (const para of String(text).split(/\n/)) {
      let line = "";
      for (const word of para.split(/(\s+)/)) {
        if (!word) continue;
        const next = line + word;
        if (!line || adv(next) <= maxW) { line = next; continue; }
        out.push(line.trimEnd()); line = word.trimStart();
        while (line && adv(line) > maxW) { let i = line.length; while (i > 1 && adv(line.slice(0, i)) > maxW) i--; out.push(line.slice(0, i)); line = line.slice(i); }
      }
      out.push(line);
    }
    return out.filter((l, i) => l || i === 0).slice(0, maxLines);
  }
  function draw(el, font) {
    const text = el.dataset.olText || "";
    const maxLines = Number(el.dataset.olLines) || 3;
    const box = el.clientWidth - (parseFloat(getComputedStyle(el).paddingLeft) || 0) - (parseFloat(getComputedStyle(el).paddingRight) || 0);
    const maxW = Math.max(120, box || 280);
    const size = Math.round(Math.min(Number(el.dataset.olSize) || 28, Math.max(16, maxW / 7))); // 좁은 칸(피드 카드)에서는 한 줄에 7자 이상 들어가게
    const lines = wrap(font, text, size, maxW, maxLines);
    const asc = font.ascender / font.unitsPerEm * size, desc = -font.descender / font.unitsPerEm * size, lh = Math.round((asc + desc) * 1.15);
    const svg = document.createElementNS(NS, "svg");
    const h = Math.ceil(lh * lines.length + desc * .2);
    svg.setAttribute("viewBox", `0 0 ${Math.ceil(maxW)} ${h}`); svg.setAttribute("width", Math.ceil(maxW)); svg.setAttribute("height", h);
    svg.setAttribute("role", "img"); svg.setAttribute("aria-label", text); svg.classList.add("ol-svg");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", lines.map((l, i) => font.getPath(l, 0, Math.round(asc + i * lh), size, { kerning: true }).toPathData(1)).join(""));
    p.setAttribute("fill", "currentColor"); svg.appendChild(p);
    const old = el.querySelector(".ol-svg, img"); if (old) old.replaceWith(svg); else el.prepend(svg);
    el.classList.add("ol-done"); el.classList.remove("ol-wait");
  }
  function hydrate(el) {
    if (el.dataset.olState === "busy") return; el.dataset.olState = "busy"; el.classList.add("ol-wait");
    load(el.dataset.olUrl).then((font) => { draw(el, font); el.dataset.olState = "done"; })
      .catch(() => { el.dataset.olState = "fail"; el.classList.remove("ol-wait"); el.classList.add("ol-fail"); }); // 실패하면 원래 견본 이미지가 그대로 남는다
  }
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); hydrate(e.target); } }), { rootMargin: "300px" }) : null;
  function scan(root) {
    (root || document).querySelectorAll("[data-ol-url]:not([data-ol-state])").forEach((el) => { el.dataset.olState = "wait"; if (io) io.observe(el); else hydrate(el); });
  }
  new MutationObserver((ms) => { if (ms.some((m) => m.addedNodes.length)) scan(); }).observe(document.documentElement, { childList: true, subtree: true });
  // 폭이 바뀌면(창 크기·열 수) 다시 그린다 — 이미 받은 파일만 쓴다
  let rz = 0; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => document.querySelectorAll('[data-ol-state="done"]').forEach((el) => load(el.dataset.olUrl).then((f) => draw(el, f))), 200); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => scan()); else scan();
  // 입력 문장이 바뀌면 이미 그린 상자는 받은 파일로 다시 그리고, 아직 안 그린 상자는 문장만 바꿔 둔다
  function setText(el, text) {
    if (el.dataset.olText === text) return; el.dataset.olText = text; el.setAttribute("aria-label", text);
    if (el.dataset.olState === "done") load(el.dataset.olUrl).then((f) => draw(el, f));
  }
  window.LSOutline = { scan, load, setText };
})();
