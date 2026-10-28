// LETSUM — 폰트 리뷰(대화형 댓글) 패널
// 넓은 화면: 상세 창 오른쪽에 붙는 고정 패널(목록만 스크롤, 입력창은 아래 고정) / 좁은 화면: 상세 창 안 '리뷰' 칸
// 베스트(좋아요 2개 이상 중 가장 많은 댓글)는 맨 위 고정, 답글은 한 단계 들여쓰기. 지금은 로그인 없이(닉네임) — 나중에 회원제로 바꿀 수 있게 서버에 user_id 칸을 둠.
(function () {
  // Localize browser dialogs without changing user-entered text.
  const alert = message => window.alert(window.LSUI ? LSUI.t(message) : message);
  const confirm = message => window.confirm(window.LSUI ? LSUI.t(message) : message);
  const prompt = (message, value) => window.prompt(window.LSUI ? LSUI.t(message) : message, value);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const EMO = ["❤️", "🙌", "🔥", "👏", "😍", "😮", "😂", "👍"];
  const nick = () => { try { return localStorage.getItem("ls_nick") || ""; } catch (e) { return ""; } };
  const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) % 360; return h; };
  const av = (name, cls) => `<span class="rv-av${cls ? " " + cls : ""}" style="--h:${hue(name)}" aria-hidden="true">${esc([...(name || "익")][0])}</span>`;
  const ago = (t) => { const s = (Date.now() - t) / 1000; if (s < 60) return "방금"; if (s < 3600) return `${Math.floor(s / 60)}분`; if (s < 86400) return `${Math.floor(s / 3600)}시간`; if (s < 86400 * 7) return `${Math.floor(s / 86400)}일`; const d = new Date(t); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
  async function call(path, body) {
    try {
      const r = await fetch("/api/" + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
      if (!(r.headers.get("content-type") || "").includes("json")) return null;
      const j = await r.json(); return r.ok ? j : { error: j.error || "오류" };
    } catch (e) { return null; }
  }

  // 작성 중인 글은 폰트별로 이 탭에 보관(창이 다시 만들어져도 이어 쓰기)
  const DK = "ls_rv_draft";
  const drafts = (() => { try { return JSON.parse(sessionStorage.getItem(DK) || "{}"); } catch (e) { return {}; } })();
  const saveDraft = () => { try { sessionStorage.setItem(DK, JSON.stringify(drafts)); } catch (e) {} };
  // mount(host, font, opts) → { root, moveTo(newHost), destroy }
  // 화면에 붙는 내용은 root 하나에 담아, 자리를 옮길 때 다시 만들지 않고 root만 옮긴다(입력 중인 글·포커스 유지)
  window.LSReviews = {
    mount(host, f, opts) {
      opts = opts || {};
      let items = [], replyTo = null, open = new Set(), alive = true;
      const root = document.createElement("div"); root.className = "rv-root"; host.innerHTML = ""; host.appendChild(root);
      root.innerHTML = `
        <div class="rv-h"><b>리뷰</b><span class="rv-n" data-n></span><span class="rv-sub">${esc(f.name)}를 써 본 이야기</span>${opts.closable ? '<button class="rv-x" data-close aria-label="리뷰 닫기">×</button>' : ""}</div>
        <div class="rv-list" data-list><p class="rv-empty">불러오는 중…</p></div>
        <form class="rv-compose" autocomplete="off">
          <div class="rv-replying" data-replying hidden></div>
          <div class="rv-emo">${EMO.map((e) => `<button type="button" data-emo="${e}" aria-label="${e} 넣기">${e}</button>`).join("")}</div>
          <div class="rv-in">${av(nick() || "나", "me")}<textarea name="body" rows="1" maxlength="500" placeholder="리뷰 달기…" aria-label="리뷰 내용" required></textarea><button type="submit" class="rv-post" disabled>게시</button></div>
          <div class="rv-in2"><input name="name" maxlength="20" placeholder="닉네임(선택)" aria-label="닉네임" value="${esc(nick())}"><span>로그인 없이 · 연락처 등 개인정보는 쓰지 마세요</span></div>
          <input name="website" class="hp" tabindex="-1" aria-hidden="true" placeholder="비워 두세요">
          <p class="rv-msg" data-msg></p>
        </form>`;
      const $ = (s) => root.querySelector(s);
      const list = $("[data-list]"), form = $("form"), ta = form.elements.body, post = $(".rv-post"), msg = $("[data-msg]");
      const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; post.disabled = ta.value.trim().length < 2; };
      const keep = () => { if (ta.value.trim()) drafts[f.id] = ta.value; else delete drafts[f.id]; saveDraft(); };
      if (drafts[f.id]) { ta.value = drafts[f.id]; requestAnimationFrame(fit); }
      ta.addEventListener("input", () => { fit(); keep(); });
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!post.disabled) form.requestSubmit(); } });
      root.querySelectorAll("[data-emo]").forEach((b) => b.addEventListener("click", () => { ta.value += b.dataset.emo; fit(); keep(); ta.focus(); }));
      const close = $("[data-close]"); if (close) close.addEventListener("click", () => opts.onClose && opts.onClose());

      const cHTML = (c, reply) => `<div class="rv-c${reply ? " rp" : ""}" data-cid="${c.id}">
          ${av(c.name, reply ? "sm" : "")}
          <div class="rv-b"><p><b>${esc(c.name)}</b> ${esc(c.body)}</p>
            <div class="rv-meta"><span>${ago(c.created)}</span>${c.likes ? `<span>좋아요 ${c.likes}개</span>` : ""}<button type="button" data-reply="${c.parent_id || c.id}" data-who="${esc(c.name)}">답글 달기</button><button type="button" data-rep="${c.id}">신고</button></div>
          </div>
          <button type="button" class="rv-heart${c.liked ? " on" : ""}" data-like="${c.id}" aria-label="좋아요" aria-pressed="${c.liked}">${c.liked ? "♥" : "♡"}</button>
        </div>`;
      const sample = () => window.LSShowcase ? LSShowcase.review(f.id) : "";
      function draw() {
        const top = items.filter((c) => !c.parent_id);
        const kids = (id) => items.filter((c) => c.parent_id === id);
        $("[data-n]").textContent = items.length ? items.length : "";
        opts.onCount && opts.onCount(items.length);
        if (!top.length) { list.innerHTML = sample() + '<p class="rv-empty">아직 리뷰가 없어요.<br>이 폰트를 어디에 써 보셨나요? 첫 이야기를 남겨 주세요.</p>'; return; }
        const best = top.filter((c) => c.likes >= 2).sort((a, b) => b.likes - a.likes || a.created - b.created)[0];
        const rest = top.filter((c) => c !== best).sort((a, b) => b.created - a.created);
        const thread = (c) => { const r = kids(c.id); const show = open.has(c.id) ? r : r.slice(0, 2);
          return `<div class="rv-t">${cHTML(c)}${r.length ? `<div class="rv-replies">${show.map((x) => cHTML(x, true)).join("")}${r.length > show.length ? `<button type="button" class="rv-more" data-more="${c.id}">— 답글 ${r.length - show.length}개 더 보기</button>` : ""}</div>` : ""}</div>`; };
        list.innerHTML = sample() + (best ? `<div class="rv-best"><span class="rv-pin">📌 베스트 리뷰</span>${thread(best)}</div>` : "") + rest.map(thread).join("");
      }
      list.addEventListener("click", async (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.more) { open.add(+b.dataset.more); draw(); return; }
        if (b.dataset.reply) {
          replyTo = { id: +b.dataset.reply, who: b.dataset.who };
          const r = $("[data-replying]"); r.hidden = false; r.innerHTML = `<span><b>@${esc(replyTo.who)}</b> 님에게 답글 남기는 중</span><button type="button" aria-label="답글 취소">×</button>`;
          r.querySelector("button").onclick = () => { replyTo = null; r.hidden = true; };
          if (!ta.value.startsWith("@" + replyTo.who)) ta.value = `@${replyTo.who} ` + ta.value; fit(); ta.focus(); return;
        }
        if (b.dataset.rep) {
          if (!confirm("이 리뷰를 신고할까요? 신고가 3회 쌓이면 자동으로 숨겨집니다.")) return;
          await call("report", { commentId: +b.dataset.rep }); b.textContent = "신고됨"; b.disabled = true; return;
        }
        if (b.dataset.like) {
          const c = items.find((x) => x.id === +b.dataset.like); if (!c) return;
          const on = !c.liked; c.liked = on; c.likes = Math.max(0, c.likes + (on ? 1 : -1)); draw();
          const r = await call("comment-like", { commentId: c.id, on });
          if (r && !r.error) { c.likes = r.likes; c.liked = r.liked; } else { c.liked = !on; c.likes = Math.max(0, c.likes + (on ? -1 : 1)); msg.textContent = (r && r.error) || "잠시 후 다시 시도해 주세요."; }
          if (alive) draw();
        }
      });
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); if (post.disabled) return;
        const name = form.elements.name.value.trim();
        try { if (name) localStorage.setItem("ls_nick", name.slice(0, 20)); } catch (x) {}
        post.disabled = true; msg.textContent = "";
        const r = await call("comments", { id: f.id, name, body: ta.value.trim(), parent: replyTo ? replyTo.id : undefined, website: form.elements.website.value });
        if (!r || r.error) { msg.textContent = (r && r.error) || "잠시 후 다시 시도해 주세요."; post.disabled = false; return; }
        if (r.item) { items.push(r.item); if (r.item.parent_id) open.add(r.item.parent_id); }
        ta.value = ""; delete drafts[f.id]; saveDraft(); replyTo = null; $("[data-replying]").hidden = true; fit(); draw();
        opts.onPosted && opts.onPosted(r.item);
        const el = list.querySelector(`[data-cid="${r.item && r.item.id}"]`); if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      call("comments?id=" + f.id).then((j) => {
        if (!alive) return;
        if (!j || j.error) { list.innerHTML = sample() + '<p class="rv-empty">리뷰를 불러오지 못했습니다.</p>'; return; }
        items = j.items || []; draw();
      });
      return {
        root,
        moveTo(h) { if (h && root.parentNode !== h) { const a = document.activeElement, sel = a === ta ? [ta.selectionStart, ta.selectionEnd] : null; h.innerHTML = ""; h.appendChild(root); if (sel) { ta.focus(); ta.setSelectionRange(sel[0], sel[1]); } } },
        destroy() { alive = false; root.remove(); },
      };
    },
  };
})();
