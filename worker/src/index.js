// LETSUM API — 좋아요 수·댓글. 로그인 없음, 개인정보 최소화(IP는 해시로만), AI 없음.
// 경로: GET  /api/stats?ids=a,b,c        → { a: { likes, comments, liked } }
//       POST /api/like     { id, on }      → { likes, liked }
//       GET  /api/comments?id=x           → { items: [{ id, name, body, created, parent_id, likes, liked }] }  (오래된 순, 답글은 parent_id)
//       POST /api/comments { id, name, body, parent?, website(빈칸 함정) } → { ok, item }  (답글은 한 단계만)
//       POST /api/comment-like { commentId, on } → { likes, liked }
//       POST /api/report   { commentId }    → { ok }
//       GET  /api/shots?id=x               → { items: [{ id, name, caption, created }] }  (승인된 사용 사례 사진)
//       GET  /api/shot/<n>                 → 이미지(승인된 것만)
//       POST /api/shots { id, name, caption, image(dataURL), agree, website } → { ok }  (검토 대기)
//       POST /api/e { e, v? } | [ ... ]         → 204  (이용 지표: 날짜·행동·값별 합계만, 식별 정보 없음)
//       GET  /api/brand                    → { id: { bg, fg, ac, acInk, style, split, line, src } }  (승인된 히어로 브랜드 테마, 5분 캐시)
//       관리자(Authorization: Bearer ADMIN_KEY):
//       POST /api/admin/brand { id, theme | null } → 저장(검증) / null이면 삭제
//       GET  /api/admin/metrics?days=28    → { days: [...], rows: [{ day, name, font, n }] }
//       GET  /api/admin/export             → 백업용 전체 데이터(JSON, 사진은 base64) — NAS가 주 1회 받아 보관
//       GET  /api/admin/summary            → { pendingShots, reportedComments, hiddenComments }
//       GET  /api/admin/shots?status=pending|approved, GET /api/admin/shot/<n>
//       POST /api/admin/shot { shotId, action: approve|reject|unpublish }
//       GET  /api/admin/comments?filter=all|hidden|reported
//       POST /api/admin/comment { commentId, action: hide|show|delete }
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LIMIT = { commentsPer10m: 5, commentsPerDay: 30, likesPerMin: 30, body: 500, name: 20, shotBytes: 700 * 1024, shotsPerDay: 3, shotsPer10m: 1, pendingMax: 300, caption: 100 };
// 이용 지표로 받는 행동(이외는 무시). v는 폰트 id나 보기 이름 같은 짧은 값만.
const EVENTS = new Set(["visit", "detail", "cmp_add", "cmp_open", "dl_zip", "dl_page", "record", "wiz_open", "wiz_apply", "view", "text_custom", "cover_only", "comment", "like", "shot_up", "share", "proj_add", "proj_share", "proj_export"]);
const IMG = [["image/jpeg", [0xff, 0xd8, 0xff]], ["image/png", [0x89, 0x50, 0x4e, 0x47]], ["image/webp", [0x52, 0x49, 0x46, 0x46]]];

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
const bad = (msg, status = 400) => json({ error: msg }, status);

async function voterOf(req, env) {
  const ip = req.headers.get("cf-connecting-ip") || "0.0.0.0";
  const data = new TextEncoder().encode(`${ip}|${env.VOTER_SALT || "letsum"}`);
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function body(req) { try { return await req.json(); } catch { return {}; } }
const clean = (s, max) => String(s || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

function isAdmin(req, env) {
  const key = env.ADMIN_KEY; if (!key || key.length < 12) return false;
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (got.length !== key.length) return false;
  let diff = 0; for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

async function stats(url, req, env) {
  const ids = (url.searchParams.get("ids") || "").split(",").filter((x) => ID.test(x)).slice(0, 60);
  if (!ids.length) return json({});
  const voter = await voterOf(req, env);
  const q = ids.map(() => "?").join(",");
  const [likes, comments, mine, shots, recent] = await env.DB.batch([
    env.DB.prepare(`SELECT font_id, COUNT(*) n FROM likes WHERE font_id IN (${q}) GROUP BY font_id`).bind(...ids),
    env.DB.prepare(`SELECT font_id, COUNT(*) n FROM comments WHERE hidden = 0 AND font_id IN (${q}) GROUP BY font_id`).bind(...ids),
    env.DB.prepare(`SELECT font_id FROM likes WHERE voter = ? AND font_id IN (${q})`).bind(voter, ...ids),
    env.DB.prepare(`SELECT id, font_id, name FROM shots WHERE status = 'approved' AND font_id IN (${q}) ORDER BY id DESC`).bind(...ids),
    // 피드 카드용 최근 댓글 2개(폰트별)
    env.DB.prepare(`SELECT font_id, name, substr(body, 1, 120) body FROM (SELECT font_id, name, body, ROW_NUMBER() OVER (PARTITION BY font_id ORDER BY created DESC) rn FROM comments WHERE hidden = 0 AND parent_id IS NULL AND font_id IN (${q})) WHERE rn <= 2`).bind(...ids),
  ]);
  const out = Object.fromEntries(ids.map((id) => [id, { likes: 0, comments: 0, liked: false, shots: [], recent: [] }]));
  recent.results.forEach((r) => out[r.font_id].recent.push({ name: r.name, body: r.body }));
  shots.results.forEach((r) => { const o = out[r.font_id]; if (o.shots.length < 3) o.shots.push({ id: r.id, name: r.name }); });
  likes.results.forEach((r) => (out[r.font_id].likes = r.n));
  comments.results.forEach((r) => (out[r.font_id].comments = r.n));
  mine.results.forEach((r) => (out[r.font_id].liked = true));
  return json(out);
}

async function like(req, env) {
  const b = await body(req); if (!ID.test(b.id || "")) return bad("잘못된 폰트");
  const voter = await voterOf(req, env); const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) n FROM likes WHERE voter = ? AND created > ?").bind(voter, now - 60000).first();
  if (b.on !== false && recent.n >= LIMIT.likesPerMin) return bad("잠시 후 다시 시도해 주세요", 429);
  if (b.on === false) await env.DB.prepare("DELETE FROM likes WHERE font_id = ? AND voter = ?").bind(b.id, voter).run();
  else await env.DB.prepare("INSERT OR IGNORE INTO likes (font_id, voter, created) VALUES (?, ?, ?)").bind(b.id, voter, now).run();
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM likes WHERE font_id = ?").bind(b.id).first();
  return json({ likes: n.n, liked: b.on !== false });
}

async function listComments(url, req, env) {
  const id = url.searchParams.get("id") || ""; if (!ID.test(id)) return bad("잘못된 폰트");
  const voter = await voterOf(req, env);
  const r = await env.DB.prepare(`SELECT c.id, c.name, c.body, c.created, c.parent_id,
      (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) AS likes,
      EXISTS(SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.voter = ?) AS liked
    FROM comments c WHERE c.font_id = ? AND c.hidden = 0 ORDER BY c.created ASC LIMIT 300`).bind(voter, id).all();
  return json({ items: r.results.map((x) => ({ ...x, liked: !!x.liked })) });
}
async function likeComment(req, env) {
  const b = await body(req); const cid = parseInt(b.commentId, 10); if (!cid) return bad("잘못된 댓글");
  const c = await env.DB.prepare("SELECT id FROM comments WHERE id = ? AND hidden = 0").bind(cid).first(); if (!c) return bad("없는 댓글", 404);
  const voter = await voterOf(req, env); const now = Date.now();
  if (b.on === false) await env.DB.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND voter = ?").bind(cid, voter).run();
  else {
    const recent = await env.DB.prepare("SELECT COUNT(*) n FROM comment_likes WHERE voter = ? AND created > ?").bind(voter, now - 60000).first();
    if (recent.n >= LIMIT.likesPerMin) return bad("잠시 후 다시 시도해 주세요", 429);
    await env.DB.prepare("INSERT OR IGNORE INTO comment_likes (comment_id, voter, created) VALUES (?, ?, ?)").bind(cid, voter, now).run();
  }
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM comment_likes WHERE comment_id = ?").bind(cid).first();
  return json({ likes: n.n, liked: b.on !== false });
}

async function addComment(req, env) {
  const b = await body(req);
  if (b.website) return json({ ok: true }); // 봇용 빈칸 함정: 채워져 있으면 조용히 버림
  if (!ID.test(b.id || "")) return bad("잘못된 폰트");
  const name = clean(b.name, LIMIT.name) || "익명";
  const text = clean(b.body, LIMIT.body);
  if (text.length < 2) return bad("내용을 2자 이상 입력해 주세요");
  if ((text.match(/https?:\/\//g) || []).length > 1) return bad("링크는 1개까지만 넣을 수 있습니다");
  const voter = await voterOf(req, env); const now = Date.now();
  const [a, d] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) n FROM comments WHERE voter = ? AND created > ?").bind(voter, now - 600000),
    env.DB.prepare("SELECT COUNT(*) n FROM comments WHERE voter = ? AND created > ?").bind(voter, now - 86400000),
  ]);
  if (a.results[0].n >= LIMIT.commentsPer10m || d.results[0].n >= LIMIT.commentsPerDay) return bad("댓글을 너무 자주 남겼습니다. 잠시 후 다시 시도해 주세요", 429);
  // 답글: 같은 폰트의 댓글에만, 답글의 답글은 원래 댓글 아래로(한 단계)
  let parent = null;
  if (b.parent) {
    const p = await env.DB.prepare("SELECT id, font_id, parent_id FROM comments WHERE id = ? AND hidden = 0").bind(parseInt(b.parent, 10) || 0).first();
    if (!p || p.font_id !== b.id) return bad("답글을 달 댓글을 찾지 못했습니다");
    parent = p.parent_id || p.id;
  }
  const r = await env.DB.prepare("INSERT INTO comments (font_id, name, body, voter, created, parent_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, name, body, created, parent_id").bind(b.id, name, text, voter, now, parent).first();
  r.likes = 0; r.liked = false;
  return json({ ok: true, item: r });
}

function sniff(bytes) {
  for (const [mime, sig] of IMG) if (sig.every((b, i) => bytes[i] === b)) {
    if (mime === "image/webp" && String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") return null;
    return mime;
  }
  return null;
}
async function addShot(req, env) {
  const b = await body(req);
  if (b.website) return json({ ok: true });
  if (!ID.test(b.id || "")) return bad("잘못된 폰트");
  if (b.agree !== true) return bad("게시 동의가 필요합니다");
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.image || "");
  if (!m) return bad("JPEG·PNG·WebP 이미지만 올릴 수 있습니다");
  let bytes; try { bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)); } catch { return bad("이미지를 읽을 수 없습니다"); }
  if (bytes.length > LIMIT.shotBytes) return bad("이미지가 너무 큽니다(700KB 이하)");
  const mime = sniff(bytes); if (!mime) return bad("이미지 형식이 올바르지 않습니다");
  const voter = await voterOf(req, env); const now = Date.now();
  const [a, d, p] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) n FROM shots WHERE voter = ? AND created > ?").bind(voter, now - 600000),
    env.DB.prepare("SELECT COUNT(*) n FROM shots WHERE voter = ? AND created > ?").bind(voter, now - 86400000),
    env.DB.prepare("SELECT COUNT(*) n FROM shots WHERE status = 'pending'"),
  ]);
  if (a.results[0].n >= LIMIT.shotsPer10m || d.results[0].n >= LIMIT.shotsPerDay) return bad("사진은 하루 3장까지, 10분에 1장씩 올릴 수 있습니다", 429);
  if (p.results[0].n >= LIMIT.pendingMax) return bad("검토 대기 사진이 많아 잠시 접수를 멈췄습니다. 나중에 다시 시도해 주세요", 503);
  await env.DB.prepare("INSERT INTO shots (font_id, name, caption, mime, bytes, data, voter, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(b.id, clean(b.name, LIMIT.name) || "익명", clean(b.caption, LIMIT.caption), mime, bytes.length, bytes, voter, now).run();
  return json({ ok: true });
}
async function listShots(url, env) {
  const id = url.searchParams.get("id") || ""; if (!ID.test(id)) return bad("잘못된 폰트");
  const r = await env.DB.prepare("SELECT id, name, caption, created FROM shots WHERE font_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 30").bind(id).all();
  return json({ items: r.results });
}
async function shotImage(n, env, any) {
  const row = await env.DB.prepare(`SELECT mime, data FROM shots WHERE id = ?${any ? "" : " AND status = 'approved'"}`).bind(n).first();
  if (!row) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(row.data), { headers: { "content-type": row.mime, "cache-control": any ? "private, no-store" : "public, max-age=86400", "x-content-type-options": "nosniff" } });
}

const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
async function track(req, env) {
  let b = await body(req); if (!Array.isArray(b)) b = [b];
  const day = kstDay(); const st = [];
  for (const x of b.slice(0, 20)) {
    if (!x || !EVENTS.has(x.e)) continue;
    const v = typeof x.v === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(x.v) ? x.v : "";
    st.push(env.DB.prepare("INSERT INTO events (day, name, font, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, name, font) DO UPDATE SET n = n + 1").bind(day, x.e, v));
  }
  if (st.length) await env.DB.batch(st);
  return new Response(null, { status: 204 });
}

// ---------- 히어로 브랜드 테마 ----------
const HEX = /^#[0-9a-f]{6}$/i;
const STYLES = new Set(["plain", "sticker", "shadow"]);
function cleanTheme(t) {
  if (!t || typeof t !== "object") return null;
  if (t.off === true) return { off: true }; // 자동 추천도 쓰지 않고 분위기 기본색으로
  const out = {};
  for (const k of ["bg", "fg", "ac", "acInk"]) { if (t[k] == null || t[k] === "") continue; if (!HEX.test(t[k])) return null; out[k] = t[k].toLowerCase(); }
  if (!out.bg || !out.fg || !out.ac) return null;
  out.style = STYLES.has(t.style) ? t.style : "plain";
  const sp = parseInt(t.split, 10); if (sp > 0 && sp <= 12) out.split = sp;
  const line = (Array.isArray(t.line) ? t.line : []).map((x) => clean(x, 40)).filter(Boolean).slice(0, 2);
  if (line.length) out.line = line;
  const src = clean(t.src, 120); if (src) out.src = src;
  return out;
}
async function brandList(env) {
  const r = await env.DB.prepare("SELECT font_id, data FROM brand_themes").all();
  const out = {}; r.results.forEach((x) => { try { out[x.font_id] = JSON.parse(x.data); } catch {} });
  return json(out, 200, { "cache-control": "public, max-age=300" });
}

async function report(req, env) {
  const b = await body(req); const cid = parseInt(b.commentId, 10); if (!cid) return bad("잘못된 댓글");
  const voter = await voterOf(req, env);
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO reports (comment_id, voter) VALUES (?, ?)").bind(cid, voter).run();
  if (ins.meta.changes) await env.DB.prepare("UPDATE comments SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= 3 THEN 1 ELSE hidden END WHERE id = ?").bind(cid).run();
  return json({ ok: true });
}

async function admin(url, req, env) {
  if (!isAdmin(req, env)) return bad("관리자 키가 필요합니다", 401);
  if (req.method === "GET" && url.pathname === "/api/admin/comments") {
    const f = url.searchParams.get("filter") || "all";
    const where = f === "hidden" ? "WHERE hidden = 1" : f === "reported" ? "WHERE reports > 0" : "";
    const r = await env.DB.prepare(`SELECT id, font_id, name, body, created, hidden, reports FROM comments ${where} ORDER BY created DESC LIMIT 200`).all();
    return json({ items: r.results });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/export") {
    const [c, l, r, sh, e, bt, cl] = await env.DB.batch([
      env.DB.prepare("SELECT * FROM comments ORDER BY id"), env.DB.prepare("SELECT * FROM likes"), env.DB.prepare("SELECT * FROM reports"),
      env.DB.prepare("SELECT id, font_id, name, caption, mime, bytes, data, voter, created, status, approved FROM shots ORDER BY id"), env.DB.prepare("SELECT * FROM events ORDER BY day"),
      env.DB.prepare("SELECT * FROM brand_themes"),
      env.DB.prepare("SELECT * FROM comment_likes"),
    ]);
    const b64 = (d) => { const u = new Uint8Array(d); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
    const shots = sh.results.map((x) => ({ ...x, data: b64(x.data) }));
    return json({ exported: new Date().toISOString(), schema: 5, comments: c.results, likes: l.results, reports: r.results, shots, events: e.results, brand: bt.results, comment_likes: cl.results },
      200, { "content-disposition": `attachment; filename="letsum-d1-${new Date().toISOString().slice(0, 10)}.json"` });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/metrics") {
    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") || "28", 10)));
    const from = new Date(Date.now() + 9 * 3600e3 - (days - 1) * 86400e3).toISOString().slice(0, 10);
    const r = await env.DB.prepare("SELECT day, name, font, n FROM events WHERE day >= ? ORDER BY day").bind(from).all();
    return json({ from, rows: r.results });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/summary") {
    const [s, r, h] = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) n FROM shots WHERE status = 'pending'"),
      env.DB.prepare("SELECT COUNT(*) n FROM comments WHERE reports > 0 AND hidden = 0"),
      env.DB.prepare("SELECT COUNT(*) n FROM comments WHERE hidden = 1"),
    ]);
    return json({ pendingShots: s.results[0].n, reportedComments: r.results[0].n, hiddenComments: h.results[0].n });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/shots") {
    const st = url.searchParams.get("status") === "approved" ? "approved" : "pending";
    const r = await env.DB.prepare("SELECT id, font_id, name, caption, bytes, created, status FROM shots WHERE status = ? ORDER BY created DESC LIMIT 100").bind(st).all();
    return json({ items: r.results });
  }
  const sm = /^\/api\/admin\/shot\/(\d+)$/.exec(url.pathname);
  if (req.method === "GET" && sm) return shotImage(+sm[1], env, true);
  if (req.method === "POST" && url.pathname === "/api/admin/shot") {
    const b = await body(req); const sid = parseInt(b.shotId, 10); if (!sid) return bad("잘못된 사진");
    if (b.action === "approve") await env.DB.prepare("UPDATE shots SET status = 'approved', approved = ? WHERE id = ?").bind(Date.now(), sid).run();
    else if (b.action === "unpublish") await env.DB.prepare("UPDATE shots SET status = 'pending', approved = NULL WHERE id = ?").bind(sid).run();
    else if (b.action === "reject") await env.DB.prepare("DELETE FROM shots WHERE id = ?").bind(sid).run();
    else return bad("잘못된 동작");
    return json({ ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/admin/brand") {
    const b = await body(req); if (!ID.test(b.id || "")) return bad("잘못된 폰트");
    if (b.theme === null) { await env.DB.prepare("DELETE FROM brand_themes WHERE font_id = ?").bind(b.id).run(); return json({ ok: true, deleted: true }); }
    const t = cleanTheme(b.theme); if (!t) return bad("색(배경·글자·강조)은 #RRGGBB 형식이어야 합니다");
    await env.DB.prepare("INSERT INTO brand_themes (font_id, data, updated) VALUES (?, ?, ?) ON CONFLICT(font_id) DO UPDATE SET data = excluded.data, updated = excluded.updated").bind(b.id, JSON.stringify(t), Date.now()).run();
    return json({ ok: true, theme: t });
  }
  if (req.method === "POST" && url.pathname === "/api/admin/comment") {
    const b = await body(req); const cid = parseInt(b.commentId, 10); if (!cid) return bad("잘못된 댓글");
    if (b.action === "delete") { await env.DB.batch([env.DB.prepare("DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE id = ? OR parent_id = ?)").bind(cid, cid), env.DB.prepare("DELETE FROM reports WHERE comment_id IN (SELECT id FROM comments WHERE id = ? OR parent_id = ?)").bind(cid, cid), env.DB.prepare("DELETE FROM comments WHERE id = ? OR parent_id = ?").bind(cid, cid)]); }
    else if (b.action === "hide" || b.action === "show") await env.DB.prepare("UPDATE comments SET hidden = ? WHERE id = ?").bind(b.action === "hide" ? 1 : 0, cid).run();
    else return bad("잘못된 동작");
    return json({ ok: true });
  }
  return bad("없는 주소", 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // 같은 주소(letsum.app)에서만 쓰기 허용 — 다른 사이트가 대신 요청하지 못하게
    if (req.method === "POST") {
      const origin = req.headers.get("origin");
      if (origin && origin !== `https://${url.host}`) return bad("허용되지 않은 요청", 403);
      if (!(req.headers.get("content-type") || "").includes("application/json")) return bad("JSON만 받습니다", 415);
    }
    try {
      const p = url.pathname;
      if (p.startsWith("/api/admin/")) return await admin(url, req, env);
      if (req.method === "GET" && p === "/api/stats") return await stats(url, req, env);
      if (req.method === "GET" && p === "/api/brand") return await brandList(env);
      if (req.method === "POST" && p === "/api/like") return await like(req, env);
      if (req.method === "GET" && p === "/api/comments") return await listComments(url, req, env);
      if (req.method === "POST" && p === "/api/comment-like") return await likeComment(req, env);
      if (req.method === "POST" && p === "/api/comments") return await addComment(req, env);
      if (req.method === "POST" && p === "/api/report") return await report(req, env);
      if (req.method === "POST" && p === "/api/e") return await track(req, env);
      if (req.method === "GET" && p === "/api/shots") return await listShots(url, env);
      if (req.method === "POST" && p === "/api/shots") return await addShot(req, env);
      const im = /^\/api\/shot\/(\d+)$/.exec(p);
      if (req.method === "GET" && im) return await shotImage(+im[1], env, false);
      if (p === "/api/health") return json({ ok: true });
      return bad("없는 주소", 404);
    } catch (e) {
      return json({ error: "일시적인 오류입니다. 잠시 후 다시 시도해 주세요" }, 503);
    }
  },
};
