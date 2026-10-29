// Bot-curated sources and clearly labelled samples. Never contributes to social API counts.
(function () {
  'use strict';
  const entries = /* SHOWCASE_DATA */ {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Keep Korean source strings so the shared DOM translator can switch both ways.
  const t = value => value;
  const safeURL = value => { try { const u = new URL(value, location.origin); return u.protocol === 'https:' || (u.origin === location.origin && u.pathname.startsWith('/img/font-showcase/')) ? esc(u.href) : ''; } catch (_) { return ''; } };
  const label = item => item.kind === 'usage' ? '실제 웹사이트 사용' : item.kind === 'official-example' ? '공식 적용 예시' : '공식 견본';
  const render = (id, compact) => {
    const item = entries[id]; if (!item) return '';
    const attachment = item.source;
    const isUsage = attachment?.kind === 'usage';
    const badge = !attachment ? '샘플 리뷰' : isUsage ? '사용 사례 소개' : attachment.kind === 'official-example' ? '공식 적용 예시 · 참고용' : '공식 견본 · 참고용';
    const disclosure = !attachment ? '화면 예시용 의견입니다. 실제 이용자 후기가 아닙니다.' : isUsage ? '렛썸봇이 글꼴 사용을 확인해 소개한 자료입니다. 이용자 후기가 아닙니다.' : attachment.kind === 'official-example' ? '렛썸봇이 참고용으로 게시한 제작자의 공식 적용 예시입니다. 이용자 후기가 아닙니다.' : '렛썸봇이 글꼴 비교를 돕기 위해 참고용으로 게시한 공식 견본입니다. 실제 서비스 사용 사례나 이용자 후기가 아닙니다.';
    return `<section class="sc-review${compact ? ' sc-compact' : ''}" data-post-type="${!attachment ? 'sample' : isUsage ? 'bot-usage' : 'bot-reference'}" aria-label="${esc(t(badge))}">
      <div class="sc-heading"><span class="sc-avatar" aria-hidden="true">${attachment ? '봇' : 'L'}</span><b>${attachment ? '렛썸봇' : 'LETSUM'}</b><span class="sc-badge">${esc(t(badge))}</span></div>
      <p class="sc-text">${esc(t(item.body))}</p>
      ${attachment ? `<figure class="sc-figure"><a href="${safeURL(attachment.url)}" target="_blank" rel="noopener noreferrer" title="${esc(t('출처에서 원본 보기'))}"><img src="${safeURL(attachment.image)}" alt="${esc(t(attachment.caption))}" loading="lazy" width="${attachment.width}" height="${attachment.height}"></a><figcaption><span class="sc-badge">${esc(t(label(attachment)))}</span> ${esc(t(attachment.caption))}<br><a href="${safeURL(attachment.url)}" target="_blank" rel="noopener noreferrer">${esc(attachment.publisher)} ↗</a> · <span>${esc(t('확인일'))} ${esc(attachment.checked)}</span></figcaption></figure>${!compact && attachment.usageNote ? `<p class="sc-note">${esc(t(attachment.usageNote))}</p>` : ''}` : `<p class="sc-note">${esc(t('확인된 사용 사례 이미지 없음'))}</p>`}
      ${!attachment ? `<p class="sc-demo"><span aria-hidden="true">♡</span> <span>${esc(t('데모 좋아요'))}</span> ${item.demoLikes} <span>· ${esc(t('실제 집계 제외'))}</span></p>` : ''}
      <p class="sc-disclosure">${esc(t(disclosure))}</p>
      ${compact ? `<button type="button" class="sc-open" data-cmt="${esc(id)}">${esc(t('리뷰 보기·남기기'))} ↗</button>` : ''}
    </section>`;
  };
  window.LSShowcase = { feed: id => render(id, true), review: id => render(id, false) };
})();
