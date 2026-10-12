// 고요서가 출간 도서 세로 배너 — 넓은 화면은 오른쪽에 떠 있는 배너, 그보다 좁으면 왼쪽 필터 아래 카드. 5초마다 오른쪽→왼쪽으로 다음 책.
(function () {
  const BOOKS = [
    { t: "월든", s: "헨리 데이비드 소로 · 지형구 옮김", d: "숲에서 보낸 두 해, 소유와 소비와 삶의 속도에 던진 질문.", img: "img/books/walden.webp", url: "https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E000013435904" },
    { t: "오디세이아", s: "집으로 가는 가장 긴 길 · 호메로스 · 지형구 옮김", d: "트로이 전쟁 뒤 이타카로 돌아가는 긴 여정을 5부 42장으로 새로 엮었습니다.", img: "img/books/odyssey.webp", url: "https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E000013546843" },
  ];
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const html = `<aside class="bk" aria-label="고요서가 출간 도서" aria-roledescription="carousel">
    <div class="bk-h"><b>고요서가</b><span>출간 도서</span></div>
    <div class="bk-view"><div class="bk-track">${BOOKS.map((b, i) => `<a class="bk-s" href="${esc(b.url)}" target="_blank" rel="noopener" aria-label="${esc(b.t)} — 교보문고 전자책 바로가기"${i ? ' tabindex="-1"' : ""}>
      <img src="${esc(b.img)}" alt="${esc(b.t)} 표지" width="360" height="511" loading="lazy">
      <b class="bk-t">${esc(b.t)}</b><span class="bk-s2">${esc(b.s)}</span><span class="bk-d">${esc(b.d)}</span>
      <span class="bk-go">바로가기 →</span></a>`).join("")}</div></div>
    <div class="bk-dots">${BOOKS.map((_, i) => `<button type="button" data-bk="${i}" aria-label="${i + 1}번째 책"${i ? "" : ' class="on"'}></button>`).join("")}</div>
  </aside>`;
  const host = document.getElementById("bookRail"); if (!host) return;
  host.innerHTML = html;
  const tr = host.querySelector(".bk-track"), dots = [...host.querySelectorAll(".bk-dots button")], slides = [...host.querySelectorAll(".bk-s")];
  let i = 0, t = null;
  const go = (k) => { i = (k + BOOKS.length) % BOOKS.length; tr.style.transform = `translateX(-${i * 100}%)`; dots.forEach((d, j) => d.classList.toggle("on", j === i)); slides.forEach((s, j) => s.tabIndex = j === i ? 0 : -1); };
  const play = () => { clearInterval(t); if (!matchMedia("(prefers-reduced-motion: reduce)").matches) t = setInterval(() => go(i + 1), 5000); };
  dots.forEach((d) => d.addEventListener("click", () => { go(+d.dataset.bk); play(); }));
  host.addEventListener("mouseenter", () => clearInterval(t)); host.addEventListener("mouseleave", play);
  play();
})();
