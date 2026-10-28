// Static, clearly labelled sample reviews. Never contributes to social API counts.
(function () {
  'use strict';
  const entries = /* SHOWCASE_DATA */ {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Keep Korean source strings so the shared DOM translator can switch both ways.
  const t = value => value;
  const safeURL = value => { try { const u = new URL(value, location.origin); return u.protocol === 'https:' || (u.origin === location.origin && u.pathname.startsWith('/img/font-showcase/')) ? esc(u.href) : ''; } catch (_) { return ''; } };
  const label = item => item.kind === 'usage' ? '사용 확인' : item.kind === 'official-example' ? '공식 적용 예시' : '공식 견본';
  const render = (id, compact) => {
    const item = entries[id]; if (!item) return '';
    const attachment = item.source;
    return `<section class="sc-review${compact ? ' sc-compact' : ''}" aria-label="${esc(t('샘플 리뷰'))}">
      <div class="sc-heading"><span class="sc-avatar" aria-hidden="true">L</span><b>LETSUM</b><span class="sc-badge">${esc(t('샘플 리뷰'))}</span></div>
      <p class="sc-text">${esc(t(item.body))}</p>
      ${attachment ? `<figure class="sc-figure"><a href="${safeURL(attachment.url)}" target="_blank" rel="noopener noreferrer" title="${esc(t('출처에서 원본 보기'))}"><img src="${safeURL(attachment.image)}" alt="${esc(t(attachment.caption))}" loading="lazy" width="${attachment.width}" height="${attachment.height}"></a><figcaption><span class="sc-badge">${esc(t(label(attachment)))}</span> ${esc(t(attachment.caption))}<br><a href="${safeURL(attachment.url)}" target="_blank" rel="noopener noreferrer">${esc(attachment.publisher)} ↗</a> · <span>${esc(t('확인일'))} ${esc(attachment.checked)}</span></figcaption></figure>${!compact && attachment.usageNote ? `<p class="sc-note">${esc(t(attachment.usageNote))}</p>` : ''}` : `<p class="sc-note">${esc(t('확인된 사용 사례 이미지 없음'))}</p>`}
      <p class="sc-demo"><span aria-hidden="true">♡</span> <span>${esc(t('데모 좋아요'))}</span> ${item.demoLikes} <span>· ${esc(t('실제 집계 제외'))}</span></p>
      <p class="sc-disclosure">${esc(t('화면 예시용 의견입니다. 실제 이용자 후기가 아닙니다.'))}</p>
      ${compact ? `<button type="button" class="sc-open" data-cmt="${esc(id)}">${esc(t('리뷰 보기·남기기'))} ↗</button>` : ''}
    </section>`;
  };
  window.LSShowcase = { feed: id => render(id, true), review: id => render(id, false) };
})();
