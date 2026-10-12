// LETSUM — 폰트 라이선스 확인서(PDF) · 여러 개면 ZIP
// 외부 라이브러리 없이 브라우저에서 만든다: A4 세로 캔버스에 그린 뒤 JPEG로 PDF에 넣고, 여러 파일은 무압축 ZIP으로 묶는다.
// 서버로 아무것도 보내지 않는다. 제목은 그 폰트로 그려 이미지로 넣으므로 폰트 파일을 PDF에 심지 않는다(라이선스 안전).
(function () {
  const W = 1654, H = 2339, M = 130;               // A4 200dpi
  const UI = "'Pretendard Variable',Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif";
  const MONO = "'IBM Plex Mono',ui-monospace,Menlo,monospace";
  const C = { ink: "#15151a", ink2: "#3d3d45", ink3: "#77767c", rule: "#d9d6cc", paper: "#ffffff", band: "#f4f2ec", lime: "#d8ff4a", limeInk: "#243300",
    ok: "#1f7a3d", okBg: "#e3f4e8", cond: "#8a5a00", condBg: "#fdf1d8", no: "#b42318", noBg: "#fde4e1" };
  const WORD = { ok: "가능", cond: "조건부", no: "불가" };
  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (d, s = "-") => `${d.getFullYear()}${s}${pad2(d.getMonth() + 1)}${s}${pad2(d.getDate())}`;

  // ---------- 캔버스 그리기 도구 ----------
  function Pager(docNo) {
    const pages = []; let cv, x, y;
    // 쪽이 넘어가도 항상 '지금 쪽'에 그리도록 현재 캔버스로 넘겨 주는 대리 객체
    const live = new Proxy({}, { get: (t, k) => { const v = x[k]; return typeof v === "function" ? v.bind(x) : v; }, set: (t, k, v) => { x[k] = v; return true; } });
    const self = {
      get y() { return y; }, set y(v) { y = v; }, get ctx() { return live; }, pages,
      add() {
        cv = document.createElement("canvas"); cv.width = W; cv.height = H; x = cv.getContext("2d");
        x.fillStyle = C.paper; x.fillRect(0, 0, W, H); x.textBaseline = "alphabetic"; pages.push(cv); y = M; return self;
      },
      need(h) { if (y + h > H - 190) { self.add(); self.header(true); } },
      header(cont) {
        x.fillStyle = C.ink; x.fillRect(0, 0, W, 14);
        font(x, 700, 26, UI); x.fillStyle = C.ink; x.fillText("LETSUM", M, 74);
        font(x, 500, 22, UI); x.fillStyle = C.ink3; x.fillText(cont ? "폰트 라이선스 확인서 (계속)" : "폰트 라이선스 확인서 · Font License Verification Report", M + 128, 74);
        font(x, 500, 21, MONO); x.textAlign = "right"; x.fillText(docNo, W - M, 74); x.textAlign = "left";
        line(x, M, 98, W - M, 98, C.rule, 2); y = 150;
      },
    };
    return self;
  }
  const font = (x, w, s, fam) => { x.font = `${w} ${s}px ${fam}`; };
  const line = (x, x1, y1, x2, y2, c, w) => { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); };
  // 줄바꿈: 띄어쓰기에서 우선, 안 되면 글자 단위(긴 주소)
  function wrap(x, text, maxW) {
    const out = []; String(text || "").split("\n").forEach((para) => {
      let cur = "";
      for (const tok of para.split(/(\s+)/)) {
        if (x.measureText(cur + tok).width <= maxW) { cur += tok; continue; }
        if (cur.trim()) { out.push(cur.trimEnd()); cur = ""; }
        let t = tok.trimStart();
        while (x.measureText(t).width > maxW) { let i = t.length; while (i > 1 && x.measureText(t.slice(0, i)).width > maxW) i--; out.push(t.slice(0, i)); t = t.slice(i); }
        cur = t;
      }
      out.push(cur.trimEnd());
    });
    return out;
  }
  function para(P, text, opt) {
    const x = P.ctx; const o = Object.assign({ w: 400, s: 26, fam: UI, c: C.ink2, lh: 1.6, left: M, maxW: W - 2 * M }, opt);
    font(x, o.w, o.s, o.fam); const lines = wrap(x, text, o.maxW); const lh = o.s * o.lh;
    lines.forEach((l) => { P.need(lh); x.fillStyle = o.c; x.fillText(l, o.left, P.y + o.s); P.y += lh; });
  }
  function section(P, title) {
    P.need(220); const x = P.ctx; P.y += 34;
    font(x, 800, 30, UI); x.fillStyle = C.ink; x.fillText(title, M, P.y + 30); P.y += 48;
    line(x, M, P.y, W - M, P.y, C.ink, 3); P.y += 18;
  }
  // 키-값 표
  function kv(P, rows) {
    const x = P.ctx, kw = 300, vx = M + kw, vw = W - M - vx;
    rows.filter((r) => r[1]).forEach(([k, v, mono]) => {
      font(x, 400, 25, mono ? MONO : UI); const lines = wrap(x, v, vw); const h = Math.max(1, lines.length) * 40 + 22;
      P.need(h); const y0 = P.y;
      font(x, 700, 24, UI); x.fillStyle = C.ink3; x.fillText(k, M, y0 + 37);
      font(x, 400, 25, mono ? MONO : UI); x.fillStyle = C.ink; lines.forEach((l, i) => x.fillText(l, vx, y0 + 37 + i * 40));
      P.y += h; line(x, M, P.y - 4, W - M, P.y - 4, C.rule, 1.5);
    });
  }
  function icon(x, v, cx, cy, r) {
    x.save(); x.lineWidth = r * 0.28; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = v === "ok" ? C.ok : v === "no" ? C.no : C.cond; x.beginPath();
    if (v === "ok") { x.moveTo(cx - r * 0.7, cy); x.lineTo(cx - r * 0.2, cy + r * 0.5); x.lineTo(cx + r * 0.75, cy - r * 0.55); }
    else if (v === "no") { x.moveTo(cx - r * 0.55, cy - r * 0.55); x.lineTo(cx + r * 0.55, cy + r * 0.55); x.moveTo(cx + r * 0.55, cy - r * 0.55); x.lineTo(cx - r * 0.55, cy + r * 0.55); }
    else { x.moveTo(cx, cy - r * 0.75); x.lineTo(cx + r * 0.8, cy + r * 0.65); x.lineTo(cx - r * 0.8, cy + r * 0.65); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(cx, cy - r * 0.2); x.lineTo(cx, cy + r * 0.2); x.moveTo(cx, cy + r * 0.45); x.lineTo(cx, cy + r * 0.47); }
    x.stroke(); x.restore();
  }
  function rrect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  async function loadFonts(d) {
    const want = [`700 40px ${UI}`, `400 26px ${UI}`, `500 22px ${MONO}`];
    if (!d.intro) want.push(`${d.weight} 120px ${d.family}`);
    await Promise.race([Promise.all(want.map((w) => document.fonts.load(w, d.name + "가나다ABC123").catch(() => {}))), new Promise((r) => setTimeout(r, 5000))]);
  }

  // ---------- 확인서 한 부(여러 쪽 가능) ----------
  async function render(d, now) {
    await loadFonts(d);
    const docNo = `LS-${ymd(now, "")}-${(hash(d.id + now.getTime()) >>> 0).toString(16).slice(0, 6).toUpperCase()}`;
    const P = Pager(docNo).add(); P.header(false); const x = P.ctx;
    // 제목: 폰트 이름을 그 폰트로
    font(x, 600, 23, UI); x.fillStyle = C.ink3; x.fillText("폰트명", M, P.y + 24); P.y += 40;
    let s = 132; const fam = d.intro ? UI : d.family;
    do { font(x, d.weight, s, fam); s -= 6; } while (x.measureText(d.name).width > W - 2 * M && s > 50);
    x.fillStyle = C.ink; x.fillText(d.name, M - 4, P.y + s * 0.92); P.y += s * 1.16;
    font(x, 500, 27, UI); x.fillStyle = C.ink2; x.fillText(`${d.en} · ${d.category} · ${d.designer}`, M, P.y + 26); P.y += 52;
    if (!d.intro) { font(x, 400, 46, fam); x.fillStyle = C.ink2; const sample = "다람쥐 헌 쳇바퀴에 타고파 ABC 123"; x.fillText(sample, M, P.y + 46); P.y += 80; }
    else { font(x, 400, 22, UI); x.fillStyle = C.ink3; x.fillText("※ 소개 전용 폰트로, 제목은 기본 글꼴로 표시했습니다.", M, P.y + 22); P.y += 48; }
    // 판정 배지
    const okKeys = d.matrix.filter((r) => r.key !== "ofl" && r.v === "ok"), all = d.matrix.filter((r) => r.key !== "ofl").every((r) => r.v === "ok");
    const verdict = !d.verified ? ["라이선스 확인 중 — 참고 기록", C.condBg, C.cond] : all ? ["상업용 무료 사용 가능", C.lime, C.limeInk] : okKeys.length ? ["조건부 상업용 무료 — 사용 범위 확인", C.condBg, C.cond] : ["상업 사용 범위 제한 — 원문 확인", C.noBg, C.no];
    font(x, 800, 30, UI); const bw = x.measureText(verdict[0]).width + 60;
    x.fillStyle = verdict[1]; rrect(x, M, P.y, bw, 64, 32); x.fill(); x.fillStyle = verdict[2]; x.fillText(verdict[0], M + 30, P.y + 43);
    font(x, 500, 23, UI); x.fillStyle = C.ink3; x.fillText(`LETSUM 원문 대조 ${d.verified ? "완료" : "진행 중"} · 최근 확인일 ${d.checked}`, M + bw + 24, P.y + 41); P.y += 90;

    section(P, "1. 라이선스");
    kv(P, [["라이선스", d.licFull], ["요약", d.licNote], ["원문", d.licUrl, true], ["저작권자", d.holder], ["제작", d.designer], ["출처 표시", d.attribution], ["폰트 버전", d.ver, true]]);

    section(P, "2. 사용 범위");
    const colW = (W - 2 * M - 24) / 2, rowH = 112;
    const rows = d.matrix;
    for (let i = 0; i < rows.length; i += 2) {
      P.need(rowH + 14);
      [rows[i], rows[i + 1]].forEach((r, j) => {
        if (!r) return; const bx = M + j * (colW + 24), by = P.y;
        x.fillStyle = r.v === "ok" ? C.okBg : r.v === "no" ? C.noBg : C.condBg; rrect(x, bx, by, colW, rowH, 14); x.fill();
        icon(x, r.v, bx + 44, by + 44, 22);
        font(x, 800, 28, UI); x.fillStyle = C.ink; x.fillText(r.label, bx + 84, by + 52);
        font(x, 800, 25, UI); x.fillStyle = r.v === "ok" ? C.ok : r.v === "no" ? C.no : C.cond; x.textAlign = "right"; x.fillText(WORD[r.v] || "확인 필요", bx + colW - 26, by + 52); x.textAlign = "left";
        font(x, 400, 20, UI); x.fillStyle = C.ink2; const dl = wrap(x, r.desc, colW - 110)[0] || ""; x.fillText(dl, bx + 84, by + 88);
      });
      P.y += rowH + 14;
    }
    if (rows.some((r) => r.v !== "ok")) para(P, "‘조건부’·‘불가’ 범위는 라이선스 원문의 조건을 따르며, 필요하면 저작권자에게 직접 확인하세요.", { s: 22, c: C.ink3 });

    if (d.names) {
      section(P, "3. 설치 후 보이는 이름");
      const uniq = (a) => [...new Set(a.filter(Boolean))];
      kv(P, [["Mac·포토샵 목록", d.names.fam + (d.names.famEn && d.names.famEn !== d.names.fam ? ` (영문 ${d.names.famEn})` : "")], ["Windows 글꼴 목록", uniq(d.names.rows.map((r) => r.win)).join(" · ")], ["PostScript 이름", uniq(d.names.rows.map((r) => r.ps)).join(" · "), true], ["받은 파일 이름", d.names.file, true]]);
    }
    section(P, `${d.names ? 4 : 3}. 출처와 확인 근거`);
    kv(P, [["원 배포처", d.page, true], ["직접 다운로드", d.zip, true], ["확인 근거", d.ev], ["근거 자료", d.pg, true], ["LETSUM 페이지", d.letsum, true], ["고른 이유(메모)", d.note]]);

    // 확인 문구
    const cert = !d.verified
      ? `이 폰트는 LETSUM이 라이선스를 확인하는 중입니다. 본 문서는 확인서가 아닌 참고 기록이며, 사용 전 라이선스 원문을 반드시 확인하시기 바랍니다.`
      : all ? `LETSUM은 저작권자가 공개한 라이선스 원문을 대조하여, 위 폰트 「${d.name}」가 인쇄·웹사이트·영상·임베딩·BI/CI·포장 등 상업적 용도에 별도 비용 없이 사용 가능함을 확인하였기에 본 확인서를 발행합니다.`
        : `LETSUM은 저작권자가 공개한 라이선스 원문을 대조하여, 위 폰트 「${d.name}」가 ${okKeys.map((r) => r.label).join("·")} 용도에 별도 비용 없이 상업적으로 사용 가능함을 확인하였기에 본 확인서를 발행합니다. 그 밖의 용도는 표의 조건을 따릅니다.`;
    font(x, 500, 28, UI); const cl = wrap(x, cert, W - 2 * M - 280); const boxH = cl.length * 46 + 150;
    P.need(boxH + 40); P.y += 30; const by = P.y;
    x.lineWidth = 3; x.strokeStyle = C.ink; rrect(x, M, by, W - 2 * M, boxH, 6); x.stroke();
    font(x, 800, 26, UI); x.fillStyle = C.ink; x.fillText("확인 사항", M + 40, by + 56);
    font(x, 500, 28, UI); x.fillStyle = C.ink; cl.forEach((l, i) => x.fillText(l, M + 40, by + 104 + i * 46));
    font(x, 500, 22, UI); x.fillStyle = C.ink3; x.fillText(`발행 LETSUM(렛섬) · letsum.app · 발행일 ${ymd(now, ".")} · 문서번호 ${docNo}`, M + 40, by + boxH - 30);
    // 확인 도장(LETSUM 자체 표시)
    const sx = W - M - 130, sy = by + boxH / 2; x.save(); x.translate(sx, sy); x.rotate(-0.18);
    x.strokeStyle = d.verified ? "#c0392b" : C.ink3; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 92, 0, Math.PI * 2); x.stroke(); x.lineWidth = 2.5; x.beginPath(); x.arc(0, 0, 80, 0, Math.PI * 2); x.stroke();
    x.fillStyle = x.strokeStyle; x.textAlign = "center"; font(x, 800, 30, UI); x.fillText("LETSUM", 0, -10); font(x, 800, 34, UI); x.fillText(d.verified ? "확인" : "참고", 0, 34); font(x, 600, 16, MONO); x.fillText(ymd(now, "."), 0, 62); x.restore(); x.textAlign = "left";
    P.y = by + boxH;

    // 쪽 아래: 고지 · 쪽번호
    P.pages.forEach((cv, i) => {
      const c = cv.getContext("2d"); line(c, M, H - 150, W - M, H - 150, C.rule, 1.5);
      font(c, 400, 19, UI); c.fillStyle = C.ink3;
      wrap(c, "본 문서는 LETSUM이 저작권자가 공개한 라이선스 원문과 배포처 정보를 대조해 정리한 확인 기록으로, 저작권자의 권리 보증을 대신하지 않습니다. 라이선스는 바뀔 수 있으므로 사용 시점에 원문을 다시 확인하세요. 발행 시각 " + now.toLocaleString("ko-KR"), W - 2 * M - 160).forEach((l, k) => c.fillText(l, M, H - 112 + k * 30));
      font(c, 500, 20, MONO); c.textAlign = "right"; c.fillText(`${i + 1} / ${P.pages.length}`, W - M, H - 112); c.textAlign = "left";
    });
    const jpgs = [];
    for (const cv of P.pages) jpgs.push(new Uint8Array(await (await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9))).arrayBuffer()));
    return pdf(jpgs, `${d.name} 라이선스 확인서`);
  }
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h; }

  // ---------- 최소 PDF(쪽마다 JPEG 한 장) ----------
  function pdf(jpgs, title) {
    const enc = new TextEncoder(); const parts = []; const offs = []; let len = 0;
    const push = (u) => { parts.push(u); len += u.length; };
    const str = (s) => push(enc.encode(s));
    const obj = (n, body) => { offs[n] = len; str(`${n} 0 obj\n`); body(); str("\nendobj\n"); };
    const utf16 = (s) => "<FEFF" + [...s].map((ch) => { const c = ch.codePointAt(0); const h = (v) => v.toString(16).padStart(4, "0"); if (c < 0x10000) return h(c); const v = c - 0x10000; return h(0xd800 + (v >> 10)) + h(0xdc00 + (v & 0x3ff)); }).join("").toUpperCase() + ">";
    str("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const n = jpgs.length, pageIds = jpgs.map((_, i) => 4 + i * 3);
    obj(1, () => str("<< /Type /Catalog /Pages 2 0 R >>"));
    obj(2, () => str(`<< /Type /Pages /Count ${n} /Kids [${pageIds.map((p) => p + " 0 R").join(" ")}] >>`));
    obj(3, () => str(`<< /Title ${utf16(title)} /Producer (LETSUM letsum.app) /Creator (LETSUM) >>`));
    jpgs.forEach((j, i) => {
      const p = 4 + i * 3, c = p + 1, im = p + 2;
      obj(p, () => str(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${c} 0 R >>`));
      const cs = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
      obj(c, () => { str(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`); });
      obj(im, () => { str(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>\nstream\n`); push(j); str("\nendstream"); });
    });
    const total = 4 + n * 3; const xref = len;
    str(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let i = 1; i < total; i++) str(String(offs[i]).padStart(10, "0") + " 00000 n \n");
    str(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(len); let o = 0; parts.forEach((u) => { out.set(u, o); o += u.length; });
    return out;
  }

  // ---------- 무압축 ZIP(파일 이름 UTF-8) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c; } return t; })();
  const crc32 = (u) => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), now = new Date();
    const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
    const chunks = [], central = []; let off = 0;
    files.forEach(({ name, data }) => {
      const nb = enc.encode(name), crc = crc32(data), h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dt, 2], [12, dd, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nb.length, 2], [28, 0, 2]].forEach(([p, v, s]) => (s === 4 ? h.setUint32(p, v, true) : h.setUint16(p, v, true)));
      chunks.push(new Uint8Array(h.buffer), nb, data);
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dt, 2], [14, dd, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nb.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([p, v, s]) => (s === 4 ? c.setUint32(p, v, true) : c.setUint16(p, v, true)));
      central.push(new Uint8Array(c.buffer), nb);
      off += 30 + nb.length + data.length;
    });
    const cdSize = central.reduce((s, u) => s + u.length, 0), e = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cdSize, 4], [16, off, 4], [20, 0, 2]].forEach(([p, v, s]) => (s === 4 ? e.setUint32(p, v, true) : e.setUint16(p, v, true)));
    return new Blob([...chunks, ...central, new Uint8Array(e.buffer)], { type: "application/zip" });
  }
  function save(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60);

  // 공개 함수: 폰트 1개면 PDF, 여러 개면 ZIP
  window.LSReport = {
    async download(list, zipName, onProgress) {
      const now = new Date(); const files = [];
      for (let i = 0; i < list.length; i++) {
        onProgress && onProgress(i + 1, list.length);
        const bytes = await render(list[i], now);
        files.push({ name: `LETSUM_라이선스확인서_${safe(list[i].name)}_${ymd(now)}.pdf`, data: bytes });
      }
      if (files.length === 1) save(new Blob([files[0].data], { type: "application/pdf" }), files[0].name);
      else save(zip(files), `LETSUM_라이선스확인서_${safe(zipName || "보관함")}_${ymd(now)}.zip`);
    },
  };
})();
