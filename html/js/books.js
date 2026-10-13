// 고요서가 출간 도서 세로 배너 — 넓은 화면은 오른쪽에 떠 있는 배너, 그보다 좁으면 왼쪽 필터 아래 카드. 5초마다 오른쪽→왼쪽으로 다음 책.
(function () {
  const BOOKS = [
    { t: "월든", s: "헨리 데이비드 소로 · 지형구 옮김", d: "숲에서 보낸 두 해, 소유와 소비와 삶의 속도에 던진 질문.", img: "img/books/walden.webp", url: "https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E000013435904" },
    { t: "오디세이아", s: "집으로 가는 가장 긴 길 · 호메로스 · 지형구 옮김", d: "트로이 전쟁 뒤 이타카로 돌아가는 긴 여정을 5부 42장으로 새로 엮었습니다.", img: "img/books/odyssey.webp", url: "https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E000013546843" },
  ];
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const html = `<aside class="bk" aria-label="고요서가 출간 도서" aria-roledescription="carousel">
    <div class="bk-h"><a class="bk-home" href="https://goyoseoga.com/" target="_blank" rel="noopener" title="고요서가 홈페이지" aria-label="고요서가 홈페이지"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg><b>고요서가</b></a><span>출간 도서</span></div>
    <div class="bk-view"><div class="bk-track">${BOOKS.map((b, i) => `<a class="bk-s" href="${esc(b.url)}" target="_blank" rel="noopener" aria-label="${esc(b.t)} — 교보문고 전자책 바로가기"${i ? ' tabindex="-1"' : ""}>
      <img src="${esc(b.img)}" alt="${esc(b.t)} 표지" width="360" height="511" loading="lazy">
      <b class="bk-t">${esc(b.t)}</b><span class="bk-s2">${esc(b.s)}</span><span class="bk-d">${esc(b.d)}</span>
      <span class="bk-kb"><img src="img/books/kyobo.png" alt="교보문고" width="356" height="106"></span>
      <span class="bk-go">바로가기 →</span></a>`).join("")}</div></div>
    <div class="bk-dots">${BOOKS.map((_, i) => `<button type="button" data-bk="${i}" aria-label="${i + 1}번째 책"${i ? "" : ' class="on"'}></button>`).join("")}</div>
  </aside>
  <div class="bk-nav"><button type="button" data-go="top" aria-label="맨 위로">▲ TOP</button><button type="button" data-go="bottom" aria-label="맨 아래로">▼ BOTTOM</button></div>`;
  const host = document.getElementById("bookRail"); if (!host) return;
  host.innerHTML = html;
  const tr = host.querySelector(".bk-track"), dots = [...host.querySelectorAll(".bk-dots button")], slides = [...host.querySelectorAll(".bk-s")];
  let i = 0, t = null;
  const go = (k) => { i = (k + BOOKS.length) % BOOKS.length; tr.style.transform = `translateX(-${i * 100}%)`; dots.forEach((d, j) => d.classList.toggle("on", j === i)); slides.forEach((s, j) => s.tabIndex = j === i ? 0 : -1); };
  // 3초마다 다음 책(마우스를 올린 동안만 멈춤). '동작 줄이기' 설정이면 미끄러짐 없이 바로 바뀜
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) tr.style.transition = "none";
  const play = () => { clearInterval(t); t = setInterval(() => go(i + 1), 3000); };
  dots.forEach((d) => d.addEventListener("click", () => { go(+d.dataset.bk); play(); }));
  host.addEventListener("mouseenter", () => clearInterval(t)); host.addEventListener("mouseleave", play);
  play();
  // 위치: 히어로·상단 조작 막대 아래에서 시작하고, 푸터와도 겹치지 않게(화면이 넓어 배너가 보일 때만 계산)
  const place = () => {
    if (getComputedStyle(host).display === "none") return;
    const gap = 16, h = host.offsetHeight;
    const hero = document.getElementById("spot"), deck = document.querySelector(".deck"), foot = document.querySelector("footer");
    const minTop = Math.max(hero ? hero.getBoundingClientRect().bottom : 0, deck ? deck.getBoundingClientRect().bottom : 0) + gap;
    const maxTop = foot ? foot.getBoundingClientRect().top - h - gap : Infinity;
    // 히어로·조작 막대 아래와 푸터 위 사이에 들어갈 자리가 없으면(낮은 화면에서 맨 아래) 겹치지 않게 잠시 숨김
    const fits = maxTop >= minTop;
    host.style.top = Math.round(minTop) + "px";
    host.style.visibility = fits ? "visible" : "hidden";
  };
  addEventListener("scroll", place, { passive: true }); addEventListener("resize", place);
  new ResizeObserver(place).observe(document.body); place();
  host.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => window.scrollTo({ top: b.dataset.go === "top" ? 0 : document.documentElement.scrollHeight, behavior: "smooth" })));
})();
