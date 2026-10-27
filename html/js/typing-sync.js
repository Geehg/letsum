// 필사독서 선택 회원: 카카오·네이버·구글 로그인 + 필사 기록 동기화(type.letsum.app/api, worker/src/account.js).
// 로그인하지 않으면 아무것도 보내지 않는다. 로그인하면 이 브라우저 기록(localStorage typebook-v1:*)과 서버 기록을 합친다.
// 합치기 규칙: 완성한 쪽 = 합집합, 날짜별 글자·학습 = 큰 값, 포인트 = 큰 값, 찜 = 책마다 최근 것, 마지막 쪽·설정 = 최근 것.
// 서버에 보내지 않는 것: 가져온 글 본문(imports), 쪽마다 쓰던 글 전체(지금 쓰는 쪽 하나만 보냄).
(() => {
  "use strict";
  const P = "typebook-v1:", API = "/api";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} };
  const toast = (m) => (window.TB?.toast ? window.TB.toast(m) : null);
  const PREF_KEYS = ["skin2", "font", "trace-font", "retro", "kb", "finger", "model-v2"];
  const NAMES = { kakao: "카카오", naver: "네이버", google: "구글" };
  const S = { open: false, providers: [], soon: [], user: null, busy: false, timer: 0 };

  // ---------- 이 브라우저 기록 → 서버용 묶음 ----------
  const ranges = (arr) => { const a = [...new Set(arr)].filter(Number.isInteger).sort((x, y) => x - y), out = []; for (let i = 0; i < a.length; i++) { let j = i; while (a[j + 1] === a[j] + 1) j++; out.push(i === j ? `${a[i]}` : `${a[i]}-${a[j]}`); i = j; } return out.join(","); };
  const expand = (r) => (r ? String(r).split(",").flatMap((x) => { const [a, b] = x.split("-").map(Number); return b >= a ? Array.from({ length: Math.min(b - a + 1, 20000) }, (_, k) => a + k) : Number.isFinite(a) ? [a] : []; }) : []);
  const ms = (iso) => Date.parse(iso || "") || 0;
  function localItems() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i); if (!full || !full.startsWith(P + "progress:")) continue;
      const id = full.slice((P + "progress:").length), p = get("progress:" + id, {}); if (!p || typeof p !== "object") continue;
      if (id.startsWith("import-")) continue; // 가져온 글은 이 브라우저에만
      const idx = Number(p.index) || 0;
      out["p:" + id] = { i: idx, c: ranges(p.completed || []), d: (p.drafts && typeof p.drafts[idx] === "string" ? p.drafts[idx].slice(0, 4000) : ""), m: (p.metrics && p.metrics[idx]) || null, t: ms(p.updatedAt) };
    }
    out.days = get("days", {}); out.points = { v: +get("points", 0) || 0 }; out.marks = get("marks", {}); out.learn = get("learn", {});
    const last = get("last", ""); if (last) out.last = { id: last, t: get("sync-last-t", 0) || 0 };
    const prefs = {}; PREF_KEYS.forEach((k) => { const v = get(k, undefined); if (v !== undefined) prefs[k] = v; });
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(P + "fonts:")) prefs[k.slice(P.length)] = get(k.slice(P.length), null); }
    out.prefs = { v: prefs, t: get("sync-prefs-t", 0) || 0 };
    return out;
  }

  // ---------- 서버 묶음을 이 브라우저 기록에 합치기 ----------
  function mergeIn(k, R) {
    if (!R || typeof R !== "object") return false;
    if (k.startsWith("p:")) {
      const id = k.slice(2), L = get("progress:" + id, {}) || {}, lt = ms(L.updatedAt);
      const comp = new Set([...(L.completed || []), ...expand(R.c)]);
      const n = { ...L, completed: [...comp].sort((a, b) => a - b) };
      if ((R.t || 0) > lt) { n.index = R.i || 0; n.drafts = { ...(L.drafts || {}) }; if (R.d && !comp.has(R.i)) n.drafts[R.i] = R.d; if (R.m) n.metrics = { ...(L.metrics || {}), [R.i]: R.m }; n.updatedAt = new Date(R.t).toISOString(); }
      const changed = JSON.stringify(n) !== JSON.stringify(L); if (changed) set("progress:" + id, n); return changed;
    }
    if (k === "days") { const L = get("days", {}); let ch = false; for (const [d, v] of Object.entries(R)) if ((+v || 0) > (L[d] || 0)) { L[d] = +v; ch = true; } if (ch) set("days", L); return ch; }
    if (k === "points") { const v = +R.v || 0; if (v > (+get("points", 0) || 0)) { set("points", v); return true; } return false; }
    if (k === "marks") { const L = get("marks", {}); let ch = false; for (const [id, t] of Object.entries(R)) if (Math.abs(+t) > Math.abs(L[id] || 0)) { L[id] = +t; ch = true; } if (ch) set("marks", L); return ch; }
    if (k === "learn") {
      const L = get("learn", {}); let ch = false;
      for (const [d, r] of Object.entries(R)) {
        const x = (L[d] = L[d] || { a: 0, e: 0, s: 0, k: {} });
        ["a", "e", "s"].forEach((f) => { if ((+r[f] || 0) > (x[f] || 0)) { x[f] = +r[f]; ch = true; } });
        for (const [c, [a, e]] of Object.entries(r.k || {})) { const y = (x.k[c] = x.k[c] || [0, 0]); if (a > y[0]) { y[0] = a; ch = true; } if (e > y[1]) { y[1] = e; ch = true; } }
      }
      if (ch) set("learn", L); return ch;
    }
    if (k === "last") { if ((R.t || 0) > (get("sync-last-t", 0) || 0) && R.id) { set("last", R.id); set("sync-last-t", R.t); return true; } return false; }
    if (k === "prefs") { if ((R.t || 0) > (get("sync-prefs-t", 0) || 0) && R.v) { Object.entries(R.v).forEach(([pk, v]) => set(pk, v)); set("sync-prefs-t", R.t); return true; } return false; }
    return false;
  }

  // ---------- 주고받기 ----------
  async function api(path, opt = {}) {
    const r = await fetch(API + path, { credentials: "same-origin", ...opt, headers: { ...(opt.body ? { "content-type": "application/json" } : {}), ...(opt.headers || {}) } });
    if (r.status === 401) { S.user = null; renderBtn(); throw new Error("login"); }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    return r.json();
  }
  async function pull() {
    const meta = get("sync-meta", {}), j = await api(`/sync?since=${meta.since || 0}`);
    let any = false, openChanged = false; const open = window.TB?.openId?.();
    for (const it of j.items) { let R; try { R = JSON.parse(it.v); } catch (e) { continue; } if (mergeIn(it.k, R)) { any = true; if (open && it.k === "p:" + open) openChanged = true; } }
    set("sync-meta", { ...meta, since: j.now });
    if (openChanged) window.TB?.reloadOpen?.();
    if (any) window.TB?.refreshShelf?.();
    return any;
  }
  async function push(all) {
    window.TB?.flush?.();
    const snap = get("sync-snap", {}), cur = localItems(), items = [];
    // 설정·마지막 책은 바뀐 시각을 기록해 '최근 것' 비교에 씀
    if (JSON.stringify(cur.prefs.v) !== JSON.stringify((snap.prefs && JSON.parse(snap.prefs).v) || null)) { cur.prefs.t = Date.now(); set("sync-prefs-t", cur.prefs.t); }
    if (cur.last && snap.last && JSON.parse(snap.last).id !== cur.last.id) { cur.last.t = Date.now(); set("sync-last-t", cur.last.t); } else if (cur.last && !snap.last && !cur.last.t) { cur.last.t = Date.now(); set("sync-last-t", cur.last.t); }
    for (const [k, v] of Object.entries(cur)) { const sv = JSON.stringify(v); if (all || snap[k] !== sv) items.push({ k, v: sv }); }
    for (let i = 0; i < items.length; i += 250) {
      const part = items.slice(i, i + 250);
      await api("/sync", { method: "PUT", body: JSON.stringify({ items: part }) });
      part.forEach((it) => (snap[it.k] = it.v));
    }
    set("sync-snap", snap);
    return items.length;
  }
  async function syncNow(first) {
    if (!S.user || S.busy) return; S.busy = true; setStatus("동기화 중…");
    try { await pull(); const n = await push(first); set("sync-at", Date.now()); setStatus(); if (first) toast(n ? "이 브라우저 기록과 계정 기록을 합쳤습니다." : "계정 기록을 불러왔습니다."); }
    catch (e) { if (e.message !== "login") setStatus("동기화하지 못했습니다. 잠시 후 다시 시도합니다."); }
    finally { S.busy = false; }
  }

  // ---------- 화면 ----------
  function renderBtn() {
    const b = $("tbAcct"); if (!b) return;
    b.hidden = !S.open || (!S.providers.length && !S.user);
    b.innerHTML = S.user ? `<b>☁</b> ${esc(S.user.nickname || `${NAMES[S.user.provider] || ""} 회원`)}` : "<b>☁</b> 로그인";
    b.title = S.user ? "내 계정 · 동기화" : "로그인하면 여러 기기에서 기록을 이어 씁니다";
  }
  function setStatus(msg) {
    const el = $("tbAcctStatus"); if (!el) return;
    const at = get("sync-at", 0);
    el.textContent = msg || (at ? `마지막 동기화 ${new Date(at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "아직 동기화하지 않았습니다");
  }
  const ICON = {
    kakao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#000" d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.6l-1 3.5c-.1.3.3.5.5.4l4.2-2.8c.5.1 1.1.1 1.6.1 5.5 0 10-3.5 10-7.8S17.5 3 12 3z"/></svg>',
    naver: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M15.6 12.8 8.2 3H3v18h5.4v-9.8L15.8 21H21V3h-5.4z"/></svg>',
    google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.2-10.4 7.2-17.6z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-8-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z"/></svg>',
  };
  function renderModal() {
    const body = $("tbAcctBody"); if (!body) return;
    $("tbAcctH").textContent = S.user ? "다시 만나 반가워요" : "기록 이어 쓰기";
    $("tbAcctModal").querySelector(".tb-acct-free").hidden = !!S.user;
    if (S.user) {
      body.innerHTML = `<p class="tb-acct-lead"><b>${esc(S.user.nickname || "회원")}</b> · ${esc(NAMES[S.user.provider] || S.user.provider)} 로그인 · ${new Date(S.user.created).toLocaleDateString("ko-KR")} 가입</p>
        <p class="tb-acct-st" id="tbAcctStatus"></p>
        <div class="tb-acct-acts"><button class="tb-btn pri" type="button" data-acct="sync">지금 동기화</button><a class="tb-btn" href="${API}/export" download>내 데이터 내려받기</a></div>
        <div class="tb-acct-acts"><button class="tb-btn" type="button" data-acct="logout">로그아웃</button><button class="tb-btn tb-danger" type="button" data-acct="delete">탈퇴(서버 기록 삭제)</button></div>
        <p class="tb-acct-note">로그아웃·탈퇴해도 이 브라우저에 저장된 기록은 그대로 남습니다.</p>`;
      setStatus();
    } else {
      const label = (p) => (p === "kakao" ? "카카오 로그인" : p === "naver" ? "네이버 로그인" : "Google 계정으로 로그인");
      const btn = (p, soon) => `<button type="button" class="tb-login tb-login-${p}${soon ? " tb-login-soon" : ""}"${soon ? ' aria-disabled="true"' : ` data-login="${p}"`} disabled>${ICON[p] || ""}<span>${label(p)}${soon ? " · 준비 중" : ""}</span></button>`;
      const btns = S.providers.map((p) => btn(p)).join("") + S.soon.map((p) => btn(p, true)).join("");
      body.innerHTML = `<p class="tb-acct-lead">로그인하면 다른 기기에서도<br>진도·찜한 책·학습 기록이 이어집니다.</p>
        <label class="tb-chk tb-age"><input type="checkbox" id="tbAge"> <span>만 14세 이상이며 <a href="https://letsum.app/privacy.html" target="_blank" rel="noopener">개인정보처리방침</a>·<a href="https://letsum.app/terms.html" target="_blank" rel="noopener">이용약관</a>에 동의합니다</span></label>
        <div class="tb-login-btns">${btns || `<p class="tb-mdesc">로그인 준비 중입니다.</p>`}</div>
        <p class="tb-acct-or"><span>안심하고 쓰세요</span></p>
        <ul class="tb-acct-list"><li>비밀번호를 만들지 않습니다</li><li>이메일·이름·전화번호를 받지 않습니다</li><li>언제든 내 데이터를 내려받거나 바로 탈퇴할 수 있습니다</li></ul>`;
      $("tbAge")?.addEventListener("change", (e) => body.querySelectorAll("[data-login]").forEach((b) => (b.disabled = !e.target.checked)));
    }
  }
  function openModal() { renderModal(); const ov = $("tbAcctModal"); ov.hidden = false; ov.querySelector("button:not(.x), input")?.focus(); }
  function bind() {
    $("tbAcct")?.addEventListener("click", openModal);
    $("tbAcctModal")?.addEventListener("click", async (e) => {
      const lg = e.target.closest("[data-login]"); if (lg && !lg.disabled) { window.TB?.flush?.(); location.href = `${API}/auth/${lg.dataset.login}/start?age14=1&r=${encodeURIComponent(location.pathname)}`; return; }
      const a = e.target.closest("[data-acct]")?.dataset.acct; if (!a) return;
      if (a === "sync") { await syncNow(false); setStatus(); }
      if (a === "logout") { await syncNow(false); await api("/logout", { method: "POST", body: "{}" }).catch(() => {}); S.user = null; set("sync-meta", {}); set("sync-snap", {}); renderBtn(); renderModal(); toast("로그아웃했습니다. 이 브라우저의 기록은 그대로입니다."); }
      if (a === "delete") {
        if (!confirm("탈퇴하면 서버에 보관된 회원 정보와 동기화 기록이 바로 삭제되고 되돌릴 수 없습니다. 이 브라우저의 기록은 남습니다. 탈퇴할까요?")) return;
        await api("/account", { method: "DELETE" }).then(() => { S.user = null; set("sync-meta", {}); set("sync-snap", {}); renderBtn(); renderModal(); toast("탈퇴했습니다. 서버 기록을 모두 삭제했습니다."); }).catch(() => toast("탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요."));
      }
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden && S.user) push(false).catch(() => {}); });
  }

  async function init() {
    if (!$("tbAcct")) return;
    bind();
    const st = await fetch(`${API}/auth/status`).then((r) => r.json()).catch(() => ({ open: false, providers: [] }));
    S.open = !!st.open; S.providers = st.providers || []; S.soon = st.soon || [];
    if (!S.open) return renderBtn();
    const me = await fetch(`${API}/me`, { credentials: "same-origin" }).then((r) => r.json()).catch(() => ({}));
    S.user = me.user || null; renderBtn();
    const m = location.hash.match(/[#&?]login=(\w+)/);
    if (m) {
      history.replaceState(null, "", location.pathname + location.search + "#/");
      const msg = { ok: "", cancel: "로그인을 취소했습니다.", age: "만 14세 이상 확인 후 가입할 수 있습니다.", state: "로그인 확인이 만료됐습니다. 다시 시도해 주세요.", token: "로그인하지 못했습니다. 다시 시도해 주세요." }[m[1]];
      if (msg) toast(msg);
    }
    if (S.user) { await syncNow(m && m[1] === "ok"); S.timer = setInterval(() => { if (document.visibilityState === "visible") syncNow(false); }, 45000); }
  }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", init); else init();
})();
