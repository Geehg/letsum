// LETSUM 방문 통계 — 본 페이지 주소, (방문 첫 페이지일 때만) 들어온 주소, 화면 폭만 보낸다.
// 쿠키·방문자 식별값은 쓰지 않고, 서버는 날짜별 합계만 남긴다(유입 주소는 사이트 이름과 검색어만 남기고 버림).
// 브라우저 '추적 안 함'·GPC가 켜져 있으면 아무것도 보내지 않는다.
(function () {
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
  if (!/^https:\/\/letsum\.app$/.test(location.origin)) return;
  const send = (o) => {
    const b = JSON.stringify(o);
    try { if (!(navigator.sendBeacon && navigator.sendBeacon("/api/pv", new Blob([b], { type: "application/json" })))) fetch("/api/pv", { method: "POST", headers: { "content-type": "application/json" }, body: b, keepalive: true }).catch(() => {}); } catch (e) {}
  };
  let s = 1; try { if (sessionStorage.getItem("ls_pv")) s = 0; else sessionStorage.setItem("ls_pv", "1"); } catch (e) {}
  const q = new URLSearchParams(location.search);
  const u = q.get("utm_source") ? { source: q.get("utm_source"), medium: q.get("utm_medium") || "", campaign: q.get("utm_campaign") || "" } : null;
  send({ p: location.pathname, r: s ? document.referrer : "", s, u, w: innerWidth });
  // 스크립트 오류(모니터링): 파일 이름과 메시지 앞부분만, 한 페이지에 3건까지
  let errs = 0;
  addEventListener("error", (e) => {
    if (!e.message || /^Script error\.?$/.test(e.message) || errs++ >= 3) return;
    send({ t: "err", m: (e.filename ? e.filename.split("/").pop().split("?")[0] + ": " : "") + e.message });
  });
  // 사이트 안 검색어(합계만): 홈 검색창이 입력을 멈춘 뒤 부른다. n = 결과 수(0이면 '결과 없는 검색어'로도 집계)
  window.lsSearch = (text, n) => send({ t: "sq", q: String(text).slice(0, 40), n });
})();
