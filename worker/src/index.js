// LETSUM API — 좋아요 수·댓글. 로그인 없음, 개인정보 최소화(IP는 해시로만), AI 없음.
// 경로: GET  /api/stats?ids=a,b,c        → { a: { likes, comments, liked } }
//       POST /api/like     { id, on }      → { likes, liked }
//       GET  /api/comments?id=x           → { items: [{ id, name, body, created }] }
//       POST /api/comments { id, name, body, website(빈칸 함정) } → { ok, item }
//       POST /api/report   { commentId }    → { ok }
//       관리자(Authorization: Bearer ADMIN_KEY):
//       GET  /api/admin/comments?filter=all|hidden|reported
//       POST /api/admin/comment { commentId, action: hide|show|delete }
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LIMIT = { commentsPer10m: 5, commentsPerDay: 30, likesPerMin: 30, body: 500, name: 20 };

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
  const [likes, comments, mine] = await env.DB.batch([
    env.DB.prepare(`SELECT font_id, COUNT(*) n FROM likes WHERE font_id IN (${q}) GROUP BY font_id`).bind(...ids),
    env.DB.prepare(`SELECT font_id, COUNT(*) n FROM comments WHERE hidden = 0 AND font_id IN (${q}) GROUP BY font_id`).bind(...ids),
    env.DB.prepare(`SELECT font_id FROM likes WHERE voter = ? AND font_id IN (${q})`).bind(voter, ...ids),
  ]);
  const out = Object.fromEntries(ids.map((id) => [id, { likes: 0, comments: 0, liked: false }]));
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

async function listComments(url, env) {
  const id = url.searchParams.get("id") || ""; if (!ID.test(id)) return bad("잘못된 폰트");
  const r = await env.DB.prepare("SELECT id, name, body, created FROM comments WHERE font_id = ? AND hidden = 0 ORDER BY created DESC LIMIT 100").bind(id).all();
  return json({ items: r.results });
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
  const r = await env.DB.prepare("INSERT INTO comments (font_id, name, body, voter, created) VALUES (?, ?, ?, ?, ?) RETURNING id, name, body, created").bind(b.id, name, text, voter, now).first();
  return json({ ok: true, item: r });
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
  if (req.method === "POST" && url.pathname === "/api/admin/comment") {
    const b = await body(req); const cid = parseInt(b.commentId, 10); if (!cid) return bad("잘못된 댓글");
    if (b.action === "delete") { await env.DB.batch([env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(cid), env.DB.prepare("DELETE FROM reports WHERE comment_id = ?").bind(cid)]); }
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
      if (req.method === "POST" && p === "/api/like") return await like(req, env);
      if (req.method === "GET" && p === "/api/comments") return await listComments(url, env);
      if (req.method === "POST" && p === "/api/comments") return await addComment(req, env);
      if (req.method === "POST" && p === "/api/report") return await report(req, env);
      if (p === "/api/health") return json({ ok: true });
      return bad("없는 주소", 404);
    } catch (e) {
      return json({ error: "일시적인 오류입니다. 잠시 후 다시 시도해 주세요" }, 503);
    }
  },
};
