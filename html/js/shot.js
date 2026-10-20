// LETSUM 이미지로 저장·공유 — 이미 불러온 웹폰트로 브라우저 캔버스에 그린다(외부 라이브러리·서버 없음).
// LSShot.open({ title, file, w, h, bg, fg, muted, accent, blocks: [...], footer }) → 미리보기 창(저장·이미지 복사·공유)
// blocks: { t: "kicker"|"text"|"meta"|"pills"|"rule"|"gap"|"row", ... } — 아래 draw() 참고
(function () {
  const UI = () => getComputedStyle(document.body).fontFamily || "sans-serif";
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  // 줄바꿈: 공백 단위로 채우되, 한 단어가 너무 길면(한글 문장 등) 글자 단위로 자른다
  function wrap(x, text, maxW) {
    const out = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const tok of para.split(/(\s+)/)) {
        if (!tok) continue;
        if (x.measureText(line + tok).width <= maxW) { line += tok; continue; }
        if (line.trim()) { out.push(line.trimEnd()); line = ""; }
        if (/^\s+$/.test(tok)) continue;
        for (const ch of tok) { if (x.measureText(line + ch).width > maxW && line) { out.push(line); line = ""; } line += ch; }
      }
      out.push(line.trimEnd());
    }
    return out;
  }
  // 글자 크기 자동 맞춤: maxLines 안에 들어갈 때까지 줄인다
  function fitText(x, b, maxW) {
    let size = b.size;
    for (;;) {
      x.font = `${b.weight || 400} ${size}px ${b.family || UI()}`;
      const lines = wrap(x, b.text, maxW);
      if (lines.length <= (b.maxLines || 99) || size <= (b.min || 14)) return { size, lines: lines.slice(0, b.maxLines || 99), cut: lines.length > (b.maxLines || 99) };
      size = Math.max(b.min || 14, Math.floor(size * 0.92));
    }
  }
  async function ready(spec) {
    const jobs = spec.blocks.filter((b) => b.family && b.text).map((b) => document.fonts.load(`${b.weight || 400} ${b.size}px ${b.family}`, String(b.text).slice(0, 200)).catch(() => {}));
    await Promise.race([Promise.all(jobs), wait(4000)]); await wait(60);
  }
  const logo = (dark) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = dark ? "/img/logo-dark.png" : "/img/logo.png"; });

  async function draw(spec) {
    const W = spec.w || 1080, H = spec.h || 1080, P = spec.pad || 84; const maxW = W - P * 2;
    const c = document.createElement("canvas"); const x = c.getContext("2d");
    // 높이가 'auto'면 먼저 한 번 재고 그린다
    const plan = []; let y = P + 70;
    x.textBaseline = "alphabetic";
    for (const b of spec.blocks) {
      if (b.t === "gap") { y += b.h || 24; plan.push({ b, y }); continue; }
      if (b.t === "rule") { y += 18; plan.push({ b, y }); y += 18; continue; }
      if (b.t === "pills") { plan.push({ b, y }); y += 58; continue; }
      if (b.t === "row") { plan.push({ b, y }); y += (b.size || 64) * 1.35 + 30; continue; }
      const r = fitText(x, b, maxW); const lh = r.size * (b.lh || 1.3);
      plan.push({ b, y, r, lh }); y += r.lines.length * lh + (b.after == null ? 18 : b.after);
    }
    const Hh = spec.h === "auto" ? Math.max(720, y + 150) : H;
    c.width = W; c.height = Hh;
    x.fillStyle = spec.bg || "#fbfaf6"; x.fillRect(0, 0, W, Hh);
    const lg = await logo(spec.dark); if (lg) x.drawImage(lg, P, P - 10, lg.width * 44 / lg.height, 44);
    if (spec.badge) { x.font = `700 24px ${UI()}`; const tw = x.measureText(spec.badge).width + 36; x.strokeStyle = spec.fg || "#141413"; x.lineWidth = 2; x.beginPath(); x.roundRect(W - P - tw, P - 8, tw, 44, 22); x.stroke(); x.fillStyle = spec.fg || "#141413"; x.fillText(spec.badge, W - P - tw + 18, P + 22); }
    for (const { b, y, r, lh } of plan) {
      if (b.t === "rule") { x.fillStyle = spec.rule || "#d9d6cc"; x.fillRect(P, y, maxW, 2); continue; }
      if (b.t === "gap") continue;
      if (b.t === "pills") {
        let px = P; x.font = `700 24px ${UI()}`;
        for (const [label, st] of b.items) {
          const t = label + (st === "ok" ? " ✓" : st === "no" ? " ✕" : " 조건부"); const tw = x.measureText(t).width + 32;
          if (px + tw > W - P) break;
          x.beginPath(); x.roundRect(px, y, tw, 44, 22);
          if (st === "ok") { x.fillStyle = "#d7f34b"; x.fill(); x.fillStyle = "#141413"; } else { x.strokeStyle = st === "no" ? "#8f8d84" : (spec.fg || "#141413"); x.lineWidth = 2; x.stroke(); x.fillStyle = st === "no" ? "#8f8d84" : (spec.fg || "#141413"); }
          x.fillText(t, px + 16, y + 31); px += tw + 10;
        }
        continue;
      }
      if (b.t === "row") { // 굵기 견본처럼 한 줄에 같은 글자를 여러 굵기로
        let px = P; const sz = b.size || 64;
        for (const it of b.items) { x.font = `${it.weight} ${sz}px ${b.family}`; x.fillStyle = spec.fg || "#141413"; x.fillText(it.text, px, y + sz); const tw = x.measureText(it.text).width; x.font = `500 18px ${UI()}`; x.fillStyle = spec.muted || "#8f8d84"; x.fillText(String(it.label), px, y + sz + 28); px += Math.max(tw, 40) + 28; if (px > W - P) break; }
        continue;
      }
      x.font = `${b.weight || 400} ${r.size}px ${b.family || UI()}`; x.fillStyle = b.color || (b.t === "meta" || b.t === "kicker" ? (spec.muted || "#6b6a63") : (spec.fg || "#141413"));
      r.lines.forEach((ln, i) => x.fillText(ln + (r.cut && i === r.lines.length - 1 ? "…" : ""), P, y + r.size + i * lh));
    }
    // 아래 띠: 주소
    x.fillStyle = spec.fg || "#141413"; x.fillRect(0, Hh - 96, W, 96);
    x.font = `500 24px ${UI()}`; x.fillStyle = spec.bg || "#fbfaf6"; x.fillText(spec.footer || "상업용 무료 폰트 — 라이선스까지 한 번에", P, Hh - 38);
    const u = spec.url || "letsum.app"; let us = 30; // 주소가 길면 왼쪽 문구와 겹치지 않게 줄인다
    for (; us > 16; us -= 2) { x.font = `800 ${us}px ${UI()}`; if (x.measureText(u).width <= maxW * 0.55) break; }
    x.fillStyle = "#d7f34b"; x.fillText(u, W - P - x.measureText(u).width, Hh - 37);
    return c;
  }

  // ---------- 미리보기 창 ----------
  let box = null;
  function ui() {
    if (box) return box;
    box = document.createElement("div"); box.className = "shot-ov"; box.hidden = true;
    box.innerHTML = `<div class="shot-box" role="dialog" aria-modal="true" aria-label="이미지로 저장·공유"><button class="x" data-x aria-label="닫기">×</button>
      <h3>이미지로 저장·공유</h3><div class="shot-img"><p class="note">이미지를 만드는 중…</p></div>
      <div class="shot-acts"><button class="tbtn lime" data-a="save">PNG 저장</button><button class="tbtn" data-a="copy">이미지 복사</button><button class="tbtn" data-a="share">공유하기</button></div>
      <p class="note shot-msg"></p></div>`;
    document.body.appendChild(box);
    box.addEventListener("click", (e) => { if (e.target === box || e.target.closest("[data-x]")) close(); });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.hidden) close(); });
    return box;
  }
  function close() { box.hidden = true; document.documentElement.classList.remove("shot-open"); }
  async function open(spec) {
    const b = ui(); b.hidden = false; document.documentElement.classList.add("shot-open");
    const img = b.querySelector(".shot-img"), msg = b.querySelector(".shot-msg"); img.innerHTML = '<p class="note">이미지를 만드는 중…</p>'; msg.textContent = "";
    await ready(spec); const c = await draw(spec);
    const blob = await new Promise((r) => c.toBlob(r, "image/png")); const url = URL.createObjectURL(blob);
    const name = (spec.file || "letsum") + ".png"; const file = new File([blob], name, { type: "image/png" });
    img.innerHTML = `<img src="${url}" alt="${esc(spec.title || "LETSUM 이미지")}">`;
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    b.querySelector('[data-a="share"]').hidden = !canShare;
    b.querySelector('[data-a="copy"]').hidden = !(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);
    b.querySelector(".shot-acts").onclick = async (e) => {
      const a = e.target.closest("[data-a]"); if (!a) return;
      if (a.dataset.a === "save") { const l = document.createElement("a"); l.href = url; l.download = name; document.body.appendChild(l); l.click(); l.remove(); msg.textContent = `${name} 저장됨`; }
      if (a.dataset.a === "copy") { try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); msg.textContent = "이미지를 복사했습니다 — 카톡·슬랙 대화창에 붙여 넣으세요"; } catch (x) { msg.textContent = "이 브라우저는 이미지 복사를 지원하지 않습니다. PNG 저장을 이용하세요."; } }
      if (a.dataset.a === "share") { try { await navigator.share({ files: [file], title: spec.title || "LETSUM", text: spec.shareText || "" }); } catch (x) {} }
      if (spec.onAction) spec.onAction(a.dataset.a);
    };
  }
  window.LSShot = { open, draw };
})();
