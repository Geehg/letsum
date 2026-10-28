// LETSUM API — 좋아요 수·댓글. 로그인 없음, 개인정보 최소화(IP는 해시로만), AI 없음.
// 필사독서 회원·동기화(type.letsum.app/api/auth/*, /api/me, /api/sync …)는 account.js
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
//       POST /api/pv { p, r, s, u?, w? } | { t: "sq", q, n } | { t: "sym", k } | { t: "err", m } → 204
//       GET  /api/symtop → 최근 30일 많이 복사된 특수기호(합계)  (방문 통계: 날짜·항목별 합계만, 식별 정보 없음)
//       GET  /api/samples[?lang=en]        → { items: [{ cat, t, src }], updated }  (예시 문장, 관리자가 고친 목록. 없으면 items: null → 사이트 기본값)
//       GET  /api/brand                    → { id: { bg, fg, ac, acInk, style, split, line, src } }  (승인된 히어로 브랜드 테마, 5분 캐시)
//       POST /api/admin/login { id, pw }   → { token, exp }  (관리자 로그인 → 12시간 통행증. 이후 Authorization: Bearer <token>)
//       관리자(Authorization: Bearer ADMIN_KEY 또는 로그인 통행증):
//       POST /api/admin/brand { id, theme | null } → 저장(검증) / null이면 삭제
//       GET  /api/admin/metrics?days=28    → { days: [...], rows: [{ day, name, font, n }] }
//       GET  /api/admin/traffic?days=28    → 방문 통계(유입 채널·사이트·검색어·페이지·시간대·기기·국가)
//       GET  /api/admin/gsc?days=28        → 구글 Search Console 검색어(비밀값 GSC_SA가 있을 때)
//       GET  /api/admin/cfwa?days=7        → Cloudflare Web Analytics 요약(비밀값 CF_API_TOKEN·CF_ACCOUNT_ID·CF_WA_SITE_TAG가 있을 때)
//       POST /api/admin/samples { items }   → 예시 문장 저장(1~100개, 문장 80자) / { items: null }이면 기본값으로 되돌림
//       GET  /api/admin/export             → 백업용 전체 데이터(JSON, 사진은 base64) — NAS가 주 1회 받아 보관
//       GET  /api/admin/summary            → { pendingShots, reportedComments, hiddenComments }
//       GET  /api/admin/shots?status=pending|approved, GET /api/admin/shot/<n>
//       POST /api/admin/shot { shotId, action: approve|reject|unpublish }
//       GET  /api/admin/comments?filter=all|hidden|reported
//       POST /api/admin/comment { commentId, action: hide|show|delete }
import { account, accountCleanup } from "./account.js"; // 필사독서 선택 회원(type.letsum.app)
import { localeResponse } from "./locale.js";
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LIMIT = { commentsPer10m: 5, commentsPerDay: 30, likesPerMin: 30, body: 500, name: 20, shotBytes: 700 * 1024, shotsPerDay: 3, shotsPer10m: 1, pendingMax: 300, caption: 100 };
// 이용 지표로 받는 행동(이외는 무시). v는 폰트 id나 보기 이름 같은 짧은 값만.
const EVENTS = new Set(["visit", "detail", "cmp_add", "cmp_open", "dl_zip", "dl_page", "record", "wiz_open", "wiz_apply", "view", "text_custom", "cover_only", "comment", "like", "shot_up", "share", "proj_add", "proj_share", "proj_export", "ffail"]);
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

const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(env, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.ADMIN_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}
// 관리자 확인: 서버 관리자 키 그대로, 또는 로그인으로 받은 통행증("adm.<만료ms>.<서명>")
async function isAdmin(req, env) {
  const key = env.ADMIN_KEY; if (!key || key.length < 12) return false;
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (same(got, key)) return true;
  const m = /^adm\.(\d{13})\.([0-9a-f]{64})$/.exec(got);
  return !!m && +m[1] > Date.now() && same(m[2], await hmac(env, "adm." + m[1]));
}
// 관리자 로그인: 아이디·비밀번호(SHA-256 비교, 값은 wrangler.toml vars) → 12시간 통행증
async function adminLogin(req, env) {
  const b = await body(req);
  const pw = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(b.pw || ""))));
  if (!env.ADMIN_KEY || !env.ADMIN_PW_HASH || b.id !== env.ADMIN_ID || !same(pw, env.ADMIN_PW_HASH)) return bad("아이디 또는 비밀번호가 다릅니다", 401);
  const exp = Date.now() + 12 * 3600e3;
  return json({ token: `adm.${exp}.${await hmac(env, "adm." + exp)}`, exp });
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
    // 피드 카드용 대표 댓글 1개(폰트별): 좋아요가 가장 많은 원 댓글, 없으면 가장 먼저 달린 원 댓글
    env.DB.prepare(`SELECT font_id, name, body, likes FROM (SELECT c.font_id, c.name, substr(c.body, 1, 160) body, (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) likes, c.created,
        ROW_NUMBER() OVER (PARTITION BY c.font_id ORDER BY (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) DESC, c.created ASC) rn
        FROM comments c WHERE c.hidden = 0 AND c.parent_id IS NULL AND c.font_id IN (${q})) WHERE rn = 1`).bind(...ids),
  ]);
  const out = Object.fromEntries(ids.map((id) => [id, { likes: 0, comments: 0, liked: false, shots: [], recent: [] }]));
  recent.results.forEach((r) => out[r.font_id].recent.push({ name: r.name, body: r.body, likes: r.likes }));
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

// ---------- 방문 통계(자체 집계) ----------
// 날짜·항목·값별 '합계'만 쌓는다. IP·쿠키·방문자 식별값은 저장하지 않고, 유입 주소는 호스트와 검색어만 남기고 버린다.
// 개인정보처리방침 변경(2026-10-18 공지) 시행일 전에는 받지 않는다.
const TRAFFIC_FROM = "2026-10-25";
const SYM_FROM = "2026-10-27"; // 특수기호 복사 합계: 2026-10-20 개인정보처리방침 추가 공지 후 7일 뒤부터
const TRAFFIC_KEEP_DAYS = 400; // 약 13개월 보관 후 삭제
const kstHour = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 13);
const SEARCH = [[/(^|\.)google\.[a-z.]+$/, "구글", "q"], [/^(m\.)?search\.naver\.com$/, "네이버", "query"], [/^(m\.)?search\.daum\.net$/, "다음", "q"],
  [/(^|\.)bing\.com$/, "빙", "q"], [/^(m\.)?search\.zum\.com$/, "줌", "query"], [/(^|\.)search\.yahoo\./, "야후", "p"], [/(^|\.)duckduckgo\.com$/, "덕덕고", "q"],
  [/(^|\.)baidu\.com$/, "바이두", "wd"], [/(^|\.)ecosia\.org$/, "에코시아", "q"], [/(^|\.)yandex\./, "얀덱스", "text"], [/(^|\.)perplexity\.ai$/, "퍼플렉시티", "q"],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "챗GPT", ""], [/(^|\.)naver\.com$/, "네이버", "query"]];
const SOCIAL = /(^|\.)(facebook\.com|fb\.me|instagram\.com|threads\.net|threads\.com|t\.co|x\.com|twitter\.com|youtube\.com|youtu\.be|pinterest\.[a-z.]+|reddit\.com|linkedin\.com|lnkd\.in|kakao\.com|kakaocdn\.net|band\.us|tiktok\.com|discord\.com|telegram\.org|t\.me|line\.me)$/;
const COMMUNITY = /(^|\.)(blog\.naver\.com|cafe\.naver\.com|post\.naver\.com|kin\.naver\.com|tistory\.com|brunch\.co\.kr|velog\.io|cafe\.daum\.net|dcinside\.com|clien\.net|ruliweb\.com|fmkorea\.com|theqoo\.net|ppomppu\.co\.kr|instiz\.net|okky\.kr|github\.com|notion\.site|medium\.com|everytime\.kr|disquiet\.io|surfit\.io|behance\.net|dribbble\.com)$/;
function uaInfo(ua) {
  const dev = /iPad|Tablet|SM-T|Tab(?!le)/i.test(ua) ? "태블릿" : /Mobi|Android|iPhone|iPod/i.test(ua) ? "모바일" : "데스크톱";
  const br = /KAKAOTALK/i.test(ua) ? "카카오톡 앱" : /NAVER\(inapp|NAVER\//i.test(ua) ? "네이버 앱" : /Instagram/i.test(ua) ? "인스타그램 앱"
    : /FBAN|FBAV/i.test(ua) ? "페이스북 앱" : /Threads/i.test(ua) ? "스레드 앱" : /DaumApps/i.test(ua) ? "다음 앱" : /SamsungBrowser/i.test(ua) ? "삼성 인터넷" : /Whale/i.test(ua) ? "웨일"
    : /Edg\//i.test(ua) ? "엣지" : /OPR\/|Opera/i.test(ua) ? "오페라" : /Firefox|FxiOS/i.test(ua) ? "파이어폭스" : /Chrome|CriOS/i.test(ua) ? "크롬" : /Safari/i.test(ua) ? "사파리" : "기타";
  const os = /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "안드로이드" : /Windows/i.test(ua) ? "윈도우" : /CrOS/i.test(ua) ? "크롬OS" : /Mac OS X|Macintosh/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "리눅스" : "기타";
  return { dev, br, os };
}
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|kakaotalk-scrap|yeti|daumoa|bingpreview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http/i;
const cleanKw = (k) => { k = String(k || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40); return !k || /@|\d{6,}|https?:/.test(k) ? "" : k; };
// 특수기호 복사 집계용: 짧은 기호·이모티콘만(주소·이메일·긴 숫자·여러 줄은 버림). 화면에는 사이트 목록에 있는 것만 다시 보여 준다.
const cleanSym = (k) => { k = String(k || ""); return !k || [...k].length > 24 || /[\r\n]|@|https?:|\d{4,}/.test(k) ? "" : k; };
const cleanPath = (p) => { p = String(p || "/").split(/[?#]/)[0].replace(/\/index\.html$/, "/").replace(/[^a-zA-Z0-9/._-]/g, "").slice(0, 80); return p.startsWith("/") ? p : "/" + p; };
function source(ref, host, ua, utm) {
  if (utm && utm.source) return { src: "캠페인(utm)", ref: "", kw: "" };
  if (/KAKAOTALK/i.test(ua) && !ref) return { src: "SNS", ref: "카카오톡(앱)", kw: "" };
  if (/Instagram/i.test(ua) && !ref) return { src: "SNS", ref: "인스타그램(앱)", kw: "" };
  if (/FBAN|FBAV/i.test(ua) && !ref) return { src: "SNS", ref: "페이스북(앱)", kw: "" };
  if (!ref) return { src: "직접 방문", ref: "", kw: "" };
  let u; try { u = new URL(ref); } catch { return { src: "직접 방문", ref: "", kw: "" }; }
  const h = u.hostname.replace(/^www\./, "").toLowerCase();
  if (h === host || h.endsWith("." + host)) return { src: "직접 방문", ref: "", kw: "" }; // 사이트 안에서 새 탭으로 연 경우
  if (COMMUNITY.test(h)) return { src: "블로그·커뮤니티", ref: h, kw: "" };
  for (const [re, name, param] of SEARCH) if (re.test(h)) {
    if (!param) return { src: "AI 검색", ref: h, kw: "" };
    const kw = cleanKw(u.searchParams.get(param)); return { src: name === "퍼플렉시티" ? "AI 검색" : "검색", ref: h, kw: kw ? `${name}|${kw}` : "" };
  }
  if (SOCIAL.test(h)) return { src: "SNS", ref: h, kw: "" };
  return { src: "다른 사이트", ref: h, kw: "" };
}
async function pageview(req, env) {
  const day = kstDay(); if (day < (env.TRAFFIC_FROM || TRAFFIC_FROM)) return new Response(null, { status: 204 }); // TRAFFIC_FROM 덮어쓰기는 로컬 시험용
  const ua = req.headers.get("user-agent") || ""; const b = await body(req);
  const add = []; const inc = (dim, key) => add.push(env.DB.prepare("INSERT INTO traffic (day, dim, key, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, dim, key) DO UPDATE SET n = n + 1").bind(day, dim, String(key).slice(0, 80)));
  if (BOT.test(ua)) { inc("bot", (ua.match(/[a-z-]*(bot|crawl|spider|yeti)[a-z-]*/i) || ["기타"])[0].toLowerCase()); }
  else if (b.t === "sq") { const q = cleanKw(b.q); if (q) { inc("sq", q); if (b.n === 0) inc("sq0", q); } }
  else if (b.t === "sym") { const k = cleanSym(b.k); if (k && day >= (env.TRAFFIC_FROM || SYM_FROM)) inc("sym", k); } // 특수기호 페이지에서 목록의 기호·이모티콘을 복사한 횟수(기호별 합계만)
  else if (b.t === "err") { const m = clean(b.m, 80).replace(/https?:\/\/\S+/g, "").trim(); if (m) inc("err", m); }
  else {
    const p = cleanPath(b.p); const host = new URL(req.url).hostname.replace(/^www\./, "");
    inc("pv", ""); inc("hour", kstHour()); inc("path", p);
    if (b.s) {
      const utm = b.u && typeof b.u === "object" ? { source: clean(b.u.source, 30), medium: clean(b.u.medium, 30), campaign: clean(b.u.campaign, 30) } : null;
      const s = source(typeof b.r === "string" ? b.r.slice(0, 500) : "", host, ua, utm);
      {
        const { dev, br, os } = uaInfo(ua);
        inc("visit", ""); inc("vhour", kstHour()); inc("land", p); inc("src", s.src); if (s.ref) inc("ref", s.ref); if (s.kw) inc("kw", s.kw);
        if (utm && utm.source) inc("utm", [utm.source, utm.medium, utm.campaign].filter(Boolean).join(" / "));
        inc("country", (req.cf && req.cf.country) || "??"); inc("dev", dev); inc("br", br); inc("os", os);
        const w = parseInt(b.w, 10); if (w > 0) inc("vw", w < 480 ? "~479" : w < 768 ? "480~767" : w < 1024 ? "768~1023" : w < 1440 ? "1024~1439" : "1440~");
      }
    }
  }
  if (Math.random() < 0.01) add.push(env.DB.prepare("DELETE FROM traffic WHERE day < ?").bind(new Date(Date.now() + 9 * 3600e3 - TRAFFIC_KEEP_DAYS * 86400e3).toISOString().slice(0, 10)));
  if (add.length) await env.DB.batch(add.slice(0, 20));
  return new Response(null, { status: 204 });
}

// 공개: 최근 30일 많이 복사된 특수기호(합계 상위 60개, 1시간 캐시) — 특수기호 페이지 히어로
async function symTop(env) {
  const r = await env.DB.prepare("SELECT key, SUM(n) n FROM traffic WHERE dim = 'sym' AND day >= ? GROUP BY key HAVING n >= 2 ORDER BY n DESC LIMIT 60").bind(daysAgo(29)).all();
  return json({ from: daysAgo(29), startFrom: env.TRAFFIC_FROM || SYM_FROM, items: r.results.map((x) => [x.key, x.n]) }, 200, { "cache-control": "public, max-age=3600" });
}

// ---------- 관리자: 방문 통계 · 구글 검색어 · Cloudflare 통계 ----------
const daysAgo = (n) => new Date(Date.now() + 9 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
async function trafficReport(url, env) {
  const days = Math.min(400, Math.max(1, parseInt(url.searchParams.get("days") || "28", 10)));
  const from = daysAgo(days - 1), prevFrom = daysAgo(days * 2 - 1);
  const [all, daily, prev, first] = await env.DB.batch([
    env.DB.prepare("SELECT dim, key, SUM(n) n FROM traffic WHERE day >= ? GROUP BY dim, key ORDER BY n DESC").bind(from),
    env.DB.prepare("SELECT day, dim, SUM(n) n FROM traffic WHERE day >= ? AND dim IN ('pv', 'visit') GROUP BY day, dim ORDER BY day").bind(from),
    env.DB.prepare("SELECT dim, SUM(n) n FROM traffic WHERE day >= ? AND day < ? AND dim IN ('pv', 'visit') GROUP BY dim").bind(prevFrom, from),
    env.DB.prepare("SELECT MIN(day) d FROM traffic"),
  ]);
  const dims = {}; all.results.forEach((x) => { const a = (dims[x.dim] = dims[x.dim] || []); if (a.length < 60) a.push([x.key, x.n]); });
  return json({ from, prevFrom, days, startFrom: env.TRAFFIC_FROM || TRAFFIC_FROM, first: first.results[0].d, dims, daily: daily.results, prev: Object.fromEntries(prev.results.map((x) => [x.dim, x.n])) });
}
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function googleToken(sa, scope) {
  const now = Math.floor(Date.now() / 1000), te = new TextEncoder();
  const head = b64u(te.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64u(te.encode(JSON.stringify({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k, te.encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + claim + "." + b64u(sig) });
  const j = await r.json(); if (!j.access_token) throw new Error("구글 인증 실패: " + (j.error_description || j.error || r.status)); return j.access_token;
}
async function gscReport(url, env) {
  if (!env.GSC_SA) return json({ configured: false });
  let sa; try { sa = JSON.parse(env.GSC_SA); } catch { return json({ configured: false, error: "GSC_SA 값이 JSON이 아닙니다" }); }
  const days = Math.min(480, Math.max(1, parseInt(url.searchParams.get("days") || "28", 10)));
  const site = env.GSC_SITE || "https://letsum.app/"; // Search Console 속성: URL 접두어 방식으로 등록돼 있음
  try {
    const tok = await googleToken(sa, "https://www.googleapis.com/auth/webmasters.readonly");
    const q = (dimensions, rowLimit) => fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: "POST", headers: { authorization: "Bearer " + tok, "content-type": "application/json" }, body: JSON.stringify({ startDate: daysAgo(days - 1), endDate: daysAgo(0), dimensions, rowLimit }) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || "Search Console 오류 " + r.status); return j.rows || []; });
    const [queries, pages, dates, devices] = await Promise.all([q(["query"], 100), q(["page"], 30), q(["date"], 500), q(["device"], 5)]);
    return json({ configured: true, site, account: sa.client_email, from: daysAgo(days - 1), queries, pages, dates, devices });
  } catch (e) { return json({ configured: true, site, account: sa.client_email, error: String(e.message || e).slice(0, 300) }); }
}
async function cfwaReport(url, env) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_WA_SITE_TAG) return json({ configured: false });
  const days = Math.min(31, Math.max(1, parseInt(url.searchParams.get("days") || "7", 10)));
  const filter = { AND: [{ datetime_geq: new Date(Date.now() - days * 86400e3).toISOString() }, { datetime_leq: new Date().toISOString() }, { siteTag: env.CF_WA_SITE_TAG }] };
  const g = (alias, dim, n) => `${alias}: rumPageloadEventsAdaptiveGroups(limit: ${n}, filter: $filter, orderBy: [sum_visits_DESC]) { count sum { visits } dimensions { ${dim} } }`;
  const query = `query($acct: String!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) { viewer { accounts(filter: { accountTag: $acct }) {
    total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: $filter) { count sum { visits } }
    byDate: rumPageloadEventsAdaptiveGroups(limit: 100, filter: $filter, orderBy: [date_ASC]) { count sum { visits } dimensions { date } }
    ${g("byRef", "refererHost", 30)} ${g("byPath", "requestPath", 30)} ${g("byCountry", "countryName", 20)} ${g("byDevice", "deviceType", 5)} ${g("byBrowser", "userAgentBrowser", 10)} ${g("byOS", "userAgentOS", 10)} } } }`;
  try {
    const r = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { authorization: "Bearer " + env.CF_API_TOKEN, "content-type": "application/json" }, body: JSON.stringify({ query, variables: { acct: env.CF_ACCOUNT_ID, filter } }) });
    const j = await r.json(); if (j.errors && j.errors.length) throw new Error(j.errors[0].message);
    return json({ configured: true, days, data: j.data.viewer.accounts[0] || {} });
  } catch (e) { return json({ configured: true, error: String(e.message || e).slice(0, 300) }); }
}

// ---------- 예시 문장(관리자 편집) ----------
function cleanSamples(list) {
  if (!Array.isArray(list)) return null;
  const out = list.map((x) => ({ cat: clean(x && x.cat, 12), t: clean(x && x.t, 80).replace(/\n/g, " "), src: clean(x && x.src, 40) })).filter((x) => x.t);
  return out.length && out.length <= 100 ? out : null;
}
const sampleKey = (lang) => (lang === "en" ? "samples_en" : "samples"); // 한글·영문 페이지 목록을 따로 보관
async function samplesGet(url, env) {
  const r = await env.DB.prepare("SELECT data, updated FROM settings WHERE key = ?").bind(sampleKey(url.searchParams.get("lang"))).first();
  let items = null; try { items = r ? JSON.parse(r.data) : null; } catch {}
  return json({ items, updated: r ? r.updated : null }, 200, { "cache-control": "public, max-age=300" });
}
async function samplesSave(req, env) {
  const b = await body(req);
  const key = sampleKey(b.lang);
  if (b.items === null) { await env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(key).run(); return json({ ok: true, reset: true }); }
  const items = cleanSamples(b.items); if (!items) return bad("문장은 1~100개, 각 80자 이내여야 합니다");
  await env.DB.prepare("INSERT INTO settings (key, data, updated) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated = excluded.updated").bind(key, JSON.stringify(items), Date.now()).run();
  return json({ ok: true, items });
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
  if (!(await isAdmin(req, env))) return bad("관리자 로그인이 필요합니다", 401);
  if (req.method === "GET" && url.pathname === "/api/admin/comments") {
    const f = url.searchParams.get("filter") || "all";
    const where = f === "hidden" ? "WHERE hidden = 1" : f === "reported" ? "WHERE reports > 0" : "";
    const r = await env.DB.prepare(`SELECT id, font_id, name, body, created, hidden, reports FROM comments ${where} ORDER BY created DESC LIMIT 200`).all();
    return json({ items: r.results });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/export") {
    const [c, l, r, sh, e, bt, cl, tf] = await env.DB.batch([
      env.DB.prepare("SELECT * FROM comments ORDER BY id"), env.DB.prepare("SELECT * FROM likes"), env.DB.prepare("SELECT * FROM reports"),
      env.DB.prepare("SELECT id, font_id, name, caption, mime, bytes, data, voter, created, status, approved FROM shots ORDER BY id"), env.DB.prepare("SELECT * FROM events ORDER BY day"),
      env.DB.prepare("SELECT * FROM brand_themes"),
      env.DB.prepare("SELECT * FROM comment_likes"),
      env.DB.prepare("SELECT * FROM traffic ORDER BY day"),
    ]);
    const b64 = (d) => { const u = new Uint8Array(d); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
    const shots = sh.results.map((x) => ({ ...x, data: b64(x.data) }));
    return json({ exported: new Date().toISOString(), schema: 6, comments: c.results, likes: l.results, reports: r.results, shots, events: e.results, brand: bt.results, comment_likes: cl.results, traffic: tf.results },
      200, { "content-disposition": `attachment; filename="letsum-d1-${new Date().toISOString().slice(0, 10)}.json"` });
  }
  if (req.method === "GET" && url.pathname === "/api/admin/metrics") {
    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") || "28", 10)));
    const from = new Date(Date.now() + 9 * 3600e3 - (days - 1) * 86400e3).toISOString().slice(0, 10);
    const r = await env.DB.prepare("SELECT day, name, font, n FROM events WHERE day >= ? ORDER BY day").bind(from).all();
    return json({ from, rows: r.results });
  }
  if (req.method === "POST" && url.pathname === "/api/admin/samples") return samplesSave(req, env);
  if (req.method === "GET" && url.pathname === "/api/admin/traffic") return trafficReport(url, env);
  if (req.method === "GET" && url.pathname === "/api/admin/gsc") return gscReport(url, env);
  if (req.method === "GET" && url.pathname === "/api/admin/cfwa") return cfwaReport(url, env);
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
    // IP별 과다 요청 차단(대량 수집·비밀번호 대입 방지). 바인딩이 없으면(로컬 등) 건너뜀
    const rip = req.headers.get("cf-connecting-ip") || "0.0.0.0";
    const rl = url.pathname.startsWith("/api/admin/") ? env.ADMIN_RL : env.API_RL;
    if (rl) { try { const { success } = await rl.limit({ key: rip }); if (!success) return bad("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요", 429); } catch (e) {} }
    // 같은 주소(letsum.app)에서만 쓰기 허용 — 다른 사이트가 대신 요청하지 못하게
    if (req.method === "POST") {
      const origin = req.headers.get("origin");
      if (origin && origin !== `https://${url.host}`) return bad("허용되지 않은 요청", 403);
      if (!(req.headers.get("content-type") || "").includes("application/json")) return bad("JSON만 받습니다", 415);
    }
    try {
      const p = url.pathname;
      if (req.method === "GET" && p === "/api/locale") return localeResponse(req);
      const acc = await account(req, url, env); if (acc) return acc;
      if (req.method === "POST" && p === "/api/admin/login") return await adminLogin(req, env);
      if (p.startsWith("/api/admin/")) return await admin(url, req, env);
      if (req.method === "GET" && p === "/api/stats") return await stats(url, req, env);
      if (req.method === "GET" && p === "/api/brand") return await brandList(env);
      if (req.method === "GET" && p === "/api/samples") return await samplesGet(url, env);
      if (req.method === "POST" && p === "/api/like") return await like(req, env);
      if (req.method === "GET" && p === "/api/comments") return await listComments(url, req, env);
      if (req.method === "POST" && p === "/api/comment-like") return await likeComment(req, env);
      if (req.method === "POST" && p === "/api/comments") return await addComment(req, env);
      if (req.method === "POST" && p === "/api/report") return await report(req, env);
      if (req.method === "POST" && p === "/api/e") return await track(req, env);
      if (req.method === "POST" && p === "/api/pv") return await pageview(req, env);
      if (req.method === "GET" && p === "/api/symtop") return await symTop(env);
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
  // 매일 한 번: 필사독서 만료 세션·장기 미접속(2년) 회원 정리
  async scheduled(event, env, ctx) { ctx.waitUntil(accountCleanup(env)); },
};
