// 필사독서(type.letsum.app) 선택 회원 — 카카오·네이버·구글 로그인 + 필사 기록 동기화.
// 원칙: 비밀번호를 받지 않음, 이메일·이름 받지 않음(회원 고유번호는 HMAC 해시로만), 세션 값도 해시로만 저장,
//       로그인 없이도 모든 기능 동작(브라우저 저장) — 서버는 기록을 보관·전달만 하고 합치기는 브라우저가 한다.
// 경로(type.letsum.app/api/*, 시행일 AUTH_FROM 이후에만 열림):
//   GET  /api/auth/status                 → { open, providers: ["kakao", …], soon: [준비 중] }
//   GET  /api/auth/<p>/start?r=/…&age14=1 → 로그인 화면으로 이동(새 가입은 만 14세 이상 확인 필요)
//   GET  /api/auth/<p>/callback           → 세션 쿠키(tb_s) 발급 후 r로 돌아감
//   GET  /api/me                          → { open, user: { provider, nickname, created } | null }
//   POST /api/logout                      → 세션 삭제
//   GET  /api/sync?since=<ms>             → { now, items: [{ k, v, u }] }  (since 이후 바뀐 항목)
//   PUT  /api/sync { items: [{ k, v }] }  → { now }  (v는 JSON 문자열, 브라우저가 합친 값)
//   GET  /api/export                      → 내 데이터 JSON 내려받기
//   DELETE /api/account                   → 탈퇴(회원·세션·기록 즉시 삭제)
// 비밀값(wrangler secret): AUTH_SALT, KAKAO_CLIENT_SECRET(선택), NAVER_CLIENT_SECRET, GOOGLE_CLIENT_SECRET
// 공개값(wrangler.toml vars): AUTH_FROM(YYYY-MM-DD, KST), KAKAO_CLIENT_ID, NAVER_CLIENT_ID, GOOGLE_CLIENT_ID

const SITE = "https://type.letsum.app";
const DAY = 864e5, SESSION_DAYS = 30, INACTIVE_DAYS = 730;
const KEY_RE = /^[A-Za-z0-9:_.\-]{1,120}$/;
const LIM = { items: 300, value: 64 * 1024, body: 768 * 1024, keys: 4000 };

const PROVIDERS = {
  kakao: {
    auth: "https://kauth.kakao.com/oauth/authorize", token: "https://kauth.kakao.com/oauth/token",
    id: (env) => env.KAKAO_CLIENT_ID, secret: (env) => env.KAKAO_CLIENT_SECRET || "", needSecret: false,
    params: () => ({}),
    async profile(tok) {
      const r = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { authorization: `Bearer ${tok.access_token}` } });
      const j = await r.json(); if (!j.id) throw new Error("kakao profile");
      return { sub: String(j.id), nickname: j.properties?.nickname || j.kakao_account?.profile?.nickname || "" };
    },
  },
  naver: {
    auth: "https://nid.naver.com/oauth2.0/authorize", token: "https://nid.naver.com/oauth2.0/token",
    id: (env) => env.NAVER_CLIENT_ID, secret: (env) => env.NAVER_CLIENT_SECRET || "", needSecret: true,
    params: () => ({}),
    async profile(tok) {
      const r = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { authorization: `Bearer ${tok.access_token}` } });
      const j = await r.json(); if (!j.response?.id) throw new Error("naver profile");
      return { sub: String(j.response.id), nickname: j.response.nickname || "" };
    },
  },
  google: {
    auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token",
    id: (env) => env.GOOGLE_CLIENT_ID, secret: (env) => env.GOOGLE_CLIENT_SECRET || "", needSecret: true,
    params: () => ({ scope: "openid", prompt: "select_account" }),
    async profile(tok) {
      // 토큰 창구에서 비밀값과 함께 직접 받은 id_token이므로 내용(sub)만 읽는다(OIDC 규격상 서명 재확인 생략 가능)
      const part = String(tok.id_token || "").split(".")[1]; if (!part) throw new Error("google id_token");
      const j = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      if (!j.sub) throw new Error("google sub");
      return { sub: String(j.sub), nickname: "" };
    },
  },
};

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const rand = (n = 32) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); };
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
async function hmac(key, s) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(s)));
}
function cookies(req) {
  const out = {}; (req.headers.get("cookie") || "").split(/;\s*/).forEach((c) => { const i = c.indexOf("="); if (i > 0) out[c.slice(0, i)] = decodeURIComponent(c.slice(i + 1)); });
  return out;
}
const setCookie = (name, value, maxAge, path) => `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
export const isOpen = (env) => !!env.AUTH_FROM && Date.now() >= Date.parse(`${env.AUTH_FROM}T00:00:00+09:00`);
const ready = (env) => Object.keys(PROVIDERS).filter((p) => PROVIDERS[p].id(env) && (!PROVIDERS[p].needSecret || PROVIDERS[p].secret(env)) && env.AUTH_SALT);
/** AUTH_PAUSED(쉼표 목록)에 든 로그인은 버튼만 '준비 중'으로 보이고 쓸 수 없음(예: 네이버 검수 전) */
const paused = (env) => String(env.AUTH_PAUSED || "").split(",").map((s) => s.trim()).filter(Boolean);
const configured = (env) => ready(env).filter((p) => !paused(env).includes(p));
const safeReturn = (r) => (typeof r === "string" && /^\/[^/\\]/.test(r) && r.length < 300 ? r : "/");

async function currentUser(req, env) {
  const t = cookies(req).tb_s; if (!t || !/^[0-9a-f]{64}$/.test(t)) return null;
  const row = await env.DB.prepare("SELECT u.id, u.provider, u.nickname, u.created, u.last_seen FROM tb_sessions s JOIN tb_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires > ?")
    .bind(await sha256(t), Date.now()).first();
  if (row && Date.now() - row.last_seen > DAY) await env.DB.prepare("UPDATE tb_users SET last_seen = ? WHERE id = ?").bind(Date.now(), row.id).run();
  return row;
}

async function start(p, url, env) {
  const P = PROVIDERS[p];
  const state = rand(16), ret = safeReturn(url.searchParams.get("r")), age14 = url.searchParams.get("age14") === "1" ? 1 : 0;
  const q = new URLSearchParams({ response_type: "code", client_id: P.id(env), redirect_uri: `${SITE}/api/auth/${p}/callback`, state, ...P.params() });
  return new Response(null, { status: 302, headers: { location: `${P.auth}?${q}`, "set-cookie": setCookie("tb_o", JSON.stringify({ s: state, p, r: ret, a: age14 }), 600, "/api/auth"), "cache-control": "no-store" } });
}

async function callback(p, url, req, env) {
  const P = PROVIDERS[p], o = (() => { try { return JSON.parse(cookies(req).tb_o || "{}"); } catch (e) { return {}; } })();
  const back = (msg) => new Response(null, { status: 302, headers: { location: `${safeReturn(o.r)}${msg ? `#/?login=${msg}` : ""}`, "set-cookie": setCookie("tb_o", "", 0, "/api/auth"), "cache-control": "no-store" } });
  if (url.searchParams.get("error")) return back("cancel");
  if (!o.s || o.p !== p || url.searchParams.get("state") !== o.s) return back("state");
  const body = new URLSearchParams({ grant_type: "authorization_code", client_id: P.id(env), redirect_uri: `${SITE}/api/auth/${p}/callback`, code: url.searchParams.get("code") || "", state: o.s });
  if (P.secret(env)) body.set("client_secret", P.secret(env));
  const tr = await fetch(P.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" }, body });
  const tok = await tr.json().catch(() => ({}));
  if (!tok.access_token && !tok.id_token) return back("token");
  const prof = await P.profile(tok);
  const subHash = await hmac(env.AUTH_SALT, `${p}:${prof.sub}`), now = Date.now();
  let user = await env.DB.prepare("SELECT id FROM tb_users WHERE provider = ? AND sub_hash = ?").bind(p, subHash).first();
  if (!user) {
    if (!o.a) return back("age"); // 새 가입은 만 14세 이상 확인을 거친 경우만
    user = { id: rand(16) };
    await env.DB.prepare("INSERT INTO tb_users (id, provider, sub_hash, nickname, created, last_seen) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.id, p, subHash, (prof.nickname || "").slice(0, 30) || null, now, now).run();
  } else {
    await env.DB.prepare("UPDATE tb_users SET last_seen = ? WHERE id = ?").bind(now, user.id).run();
  }
  const token = rand(32);
  await env.DB.prepare("INSERT INTO tb_sessions (token_hash, user_id, created, expires) VALUES (?, ?, ?, ?)").bind(await sha256(token), user.id, now, now + SESSION_DAYS * DAY).run();
  const h = new Headers({ location: `${safeReturn(o.r)}#/?login=ok`, "cache-control": "no-store" });
  h.append("set-cookie", setCookie("tb_o", "", 0, "/api/auth"));
  h.append("set-cookie", setCookie("tb_s", token, SESSION_DAYS * 86400, "/api"));
  return new Response(null, { status: 302, headers: h });
}

async function syncGet(user, url, env) {
  const since = Math.max(0, +url.searchParams.get("since") || 0);
  const { results } = await env.DB.prepare("SELECT k, v, updated AS u FROM tb_data WHERE user_id = ? AND updated > ? ORDER BY updated LIMIT 5000").bind(user.id, since).all();
  return json({ now: Date.now(), items: results });
}

async function syncPut(user, req, env) {
  const raw = await req.text(); if (raw.length > LIM.body) return bad("한 번에 보내는 기록이 너무 큽니다", 413);
  let items; try { items = JSON.parse(raw).items; } catch (e) { return bad("형식 오류"); }
  if (!Array.isArray(items) || items.length > LIM.items) return bad("항목 수 오류");
  for (const it of items) if (!it || !KEY_RE.test(it.k) || typeof it.v !== "string" || it.v.length > LIM.value) return bad("항목 형식 오류");
  const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM tb_data WHERE user_id = ?").bind(user.id).first();
  if (cnt.n + items.length > LIM.keys) return bad("저장할 수 있는 항목 수를 넘었습니다", 413);
  const now = Date.now();
  const st = env.DB.prepare("INSERT INTO tb_data (user_id, k, v, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, k) DO UPDATE SET v = excluded.v, updated = excluded.updated");
  if (items.length) await env.DB.batch(items.map((it) => st.bind(user.id, it.k, it.v, now)));
  return json({ now });
}

async function exportAll(user, env) {
  const { results } = await env.DB.prepare("SELECT k, v, updated FROM tb_data WHERE user_id = ? ORDER BY k").bind(user.id).all();
  const data = { service: "LETSUM 필사독서", exported: new Date().toISOString(), account: { provider: user.provider, nickname: user.nickname, created: new Date(user.created).toISOString() }, records: results.map((r) => ({ key: r.k, updated: new Date(r.updated).toISOString(), value: (() => { try { return JSON.parse(r.v); } catch (e) { return r.v; } })() })) };
  return new Response(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="letsum-typing-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "no-store" } });
}

async function deleteAll(userId, env) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM tb_data WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM tb_sessions WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM tb_users WHERE id = ?").bind(userId),
  ]);
}

/** type.letsum.app 회원 경로면 응답, 아니면 null */
export async function account(req, url, env) {
  const p = url.pathname;
  if (!(p.startsWith("/api/auth/") || ["/api/me", "/api/logout", "/api/sync", "/api/export", "/api/account"].includes(p))) return null;
  if (url.host !== "type.letsum.app") return bad("없는 주소", 404);
  // 쓰기 요청은 같은 사이트에서만(쿠키가 SameSite=Lax라 이중 방어)
  if (req.method !== "GET") { const origin = req.headers.get("origin"); if (origin !== SITE) return bad("허용되지 않은 요청", 403); }
  const open = isOpen(env);
  if (p === "/api/auth/status") return json({ open, providers: open ? configured(env) : [], soon: open ? ready(env).filter((x) => paused(env).includes(x)) : [] });
  if (!open) return bad("회원 기능은 시행일부터 열립니다", 403);
  const m = /^\/api\/auth\/(kakao|naver|google)\/(start|callback)$/.exec(p);
  if (m) {
    if (!configured(env).includes(m[1])) return bad("아직 준비 중인 로그인입니다", 503);
    return m[2] === "start" ? start(m[1], url, env) : callback(m[1], url, req, env);
  }
  const user = await currentUser(req, env);
  if (p === "/api/me" && req.method === "GET") return json({ open, user: user ? { provider: user.provider, nickname: user.nickname, created: user.created } : null });
  if (!user) return bad("로그인이 필요합니다", 401);
  if (p === "/api/logout" && req.method === "POST") {
    const t = cookies(req).tb_s; if (t) await env.DB.prepare("DELETE FROM tb_sessions WHERE token_hash = ?").bind(await sha256(t)).run();
    return json({ ok: true }, 200, { "set-cookie": setCookie("tb_s", "", 0, "/api") });
  }
  if (p === "/api/sync" && req.method === "GET") return syncGet(user, url, env);
  if (p === "/api/sync" && req.method === "PUT") return syncPut(user, req, env);
  if (p === "/api/export" && req.method === "GET") return exportAll(user, env);
  if (p === "/api/account" && req.method === "DELETE") { await deleteAll(user.id, env); return json({ ok: true }, 200, { "set-cookie": setCookie("tb_s", "", 0, "/api") }); }
  return bad("없는 주소", 404);
}

/** 매일: 만료 세션 정리, 2년 동안 로그인하지 않은 회원 삭제 */
export async function accountCleanup(env) {
  const now = Date.now();
  await env.DB.prepare("DELETE FROM tb_sessions WHERE expires < ?").bind(now).run();
  const { results } = await env.DB.prepare("SELECT id FROM tb_users WHERE last_seen < ? LIMIT 500").bind(now - INACTIVE_DAYS * DAY).all();
  for (const r of results) await deleteAll(r.id, env);
}
