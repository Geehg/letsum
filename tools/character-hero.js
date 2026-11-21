(() => {
  'use strict';
  const data = __FEATURED_DATA__;
  const themes = { all: '모든 테마', world: '해외 캐릭터', city: '도시의 얼굴', campus: '캠퍼스 친구들', daily: '일상 속 안내자', brand: '브랜드 아이콘' };
  const slides = data.items.filter(item => item.portrait);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const videoFor = item => item.video || (item.id === 'mm-seoulmetro-ddota' ? { id: 'Or5wErHf-i0', title: '서울교통공사 · 또타 팝업 현장' } : null);
  let theme = 'all', index = 0, playing = !motion.matches, useVideo = !motion.matches;
  let hero = null, timer = null, lastChange = 0, hovered = false, filtersOpen = false;
  let player = null, observer = null, visible = false, requestedPlay = false;
  const entries = () => slides.filter(item => theme === 'all' || item.theme === theme);
  const itemAt = () => entries()[index];
  const optionsDialog = () => document.querySelector('#character-sources');
  const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));

  function releasePlayer() {
    observer?.disconnect();
    observer = null;
    player?.pause();
    player = null;
    visible = requestedPlay = false;
  }

  function syncPlayer() {
    if (!player) return;
    if (!visible || !playing || !useVideo || document.hidden || dialogOpen()) {
      player.pause();
      requestedPlay = false;
      return;
    }
    if (requestedPlay) return;
    requestedPlay = true;
    player.play().catch(() => { /* The still remains visible if autoplay is blocked. */ });
  }

  function attachPlayer(root) {
    const video = root.querySelector('.cf-film video');
    if (!video) return;
    player = video;
    video.muted = true;
    video.addEventListener('playing', () => video.classList.add('is-playing'));
    video.addEventListener('error', () => video.classList.remove('is-playing'));
    observer = new IntersectionObserver(([entry]) => {
      if (player !== video) return;
      visible = entry.isIntersecting;
      syncPlayer();
    });
    observer.observe(root.querySelector('.cf-page-art'));
  }

  function panel(slot, src, movie) {
    const still = src ? `<img src="${escape(src)}" alt="" decoding="async">` : '';
    const video = movie ? `<video src="${escape(movie.src)}" muted loop playsinline tabindex="-1" preload="metadata" disablepictureinpicture disableremoteplayback></video>` : '';
    return `<div class="cf-panel cf-${slot}">${still}${video}</div>`;
  }

  function backdrop(item) {
    const scenes = [...new Set(item.panels || [])];
    const clip = item.stageVideo;
    const cover = clip?.poster || scenes.shift();
    const gutter = 'M340 0 L250 1000 M0 790 L271.6 760 M286 600 L720 380 L1000 500 M790 0 L720 380 L810 1000';
    return `<div class="cf-backdrop" aria-hidden="true">
      ${panel('film', cover, useVideo && clip)}
      ${panel('right-top', scenes.shift())}
      ${panel('lower', scenes.shift() || (clip ? null : (item.panels?.includes(item.image) ? null : item.image)))}
      ${panel('right-bottom', scenes.shift() || clip?.detail)}${panel('fleck')}
      <svg class="cf-gutters" viewBox="0 0 1000 1000" preserveAspectRatio="none" fill="none"><path d="${gutter}" vector-effect="non-scaling-stroke" stroke="#494841" stroke-width="7"/><path d="${gutter}" vector-effect="non-scaling-stroke" stroke="#fffcf3" stroke-width="4"/></svg>
    </div>`;
  }

  function cutoutMask(portrait) {
    if (!portrait.outline) return '';
    return `<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs><clipPath id="cf-silhouette" clipPathUnits="objectBoundingBox"><path d="${escape(portrait.outline)}"/></clipPath></defs></svg>`;
  }

  function portraitStyle({ centerX, top, bottom }) {
    return `--portrait-height:${100 / (bottom - top)}%;--portrait-x:${-centerX * 100}%;--portrait-y:${-top * 100}%`;
  }


  function changeSlide(root, step) {
    const length = entries().length;
    index = (index + step + length) % length;
    draw(root);
  }

  function draw(root) {
    releasePlayer();
    const item = itemAt(), clip = videoFor(item);
    lastChange = Date.now();
    root.innerHTML = `<div class="cf-page-art">
      ${backdrop(item)}
      <div class="cf-intro"><p class="cf-byline">${escape(themes[item.theme])}<span aria-hidden="true">/</span>${escape(item.organization)}</p>
        <h1 id="page-heading">${escape(item.name)}</h1><p class="cf-caption">${escape(item.copy)}</p>
        <a class="cf-detail" href="${escape(item.detail)}">캐릭터 상세 보기 <span aria-hidden="true">→</span></a>
      </div>
      ${cutoutMask(item.portrait)}
      <button type="button" style="${portraitStyle(item.portrait)}" class="cf-figure" data-preview-record="${escape(item.id)}" aria-label="${escape(item.name)} 상세 미리보기" aria-haspopup="dialog"><img${item.portrait.outline ? ' style="clip-path:url(#cf-silhouette)"' : ''} src="${escape(item.image)}" alt="" decoding="async" fetchpriority="high"></button>
    </div>
    <div class="cf-toolbar"><div class="cf-tools-inner">
      <label class="cf-theme-select"><span class="sr-only">캐릭터 소개 테마</span><select id="character-theme">${Object.entries(themes).filter(([id]) => id === 'all' || slides.some(slide => slide.theme === id)).map(([id, label]) => `<option value="${id}"${theme === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      <button class="cf-sources" type="button" aria-haspopup="dialog">${(clip || item.stageVideo) ? '영상·출처' : '이미지 출처'}</button>
      <div class="cf-paging" role="group" aria-label="추천 캐릭터 슬라이드">
        <button type="button" data-step="-1" aria-label="이전 캐릭터">‹</button><span>${index + 1} <i>/</i> ${entries().length}</span>
        <button type="button" data-step="1" aria-label="다음 캐릭터">›</button><button class="cf-play" type="button"></button>
      </div>
    </div></div>`;
    updatePlay(root);
    root.querySelector('#character-theme').onchange = event => {
      theme = event.target.value;
      index = 0;
      draw(root);
      root.querySelector('#character-theme').focus({ preventScroll: true });
    };
    root.querySelectorAll('[data-step]').forEach(button => {
      button.onclick = () => {
        const step = button.dataset.step;
        changeSlide(root, Number(step));
        root.querySelector(`[data-step="${step}"]`).focus({ preventScroll: true });
      };
      button.disabled = entries().length < 2;
    });
    root.querySelector('.cf-play').onclick = () => {
      playing = !playing;
      syncPlayer();
      lastChange = Date.now();
      updatePlay(root);
    };
    root.querySelector('.cf-sources').onclick = () => openSources(root, item);
    attachPlayer(root);
  }

  function updatePlay(root) {
    const button = root.querySelector('.cf-play');
    const label = playing ? '자동 전환과 움직임 정지' : '자동 전환과 움직임 재생';
    button.innerHTML = playing ? '<span class="cf-pause-mark" aria-hidden="true"></span>' : '<span aria-hidden="true">▶</span>';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.disabled = entries().length < 2 && !(useVideo && itemAt().stageVideo);
  }

  function sourceLink(url, label) {
    return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;
  }

  function openSources(root, item) {
    let dialog = optionsDialog();
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'character-sources';
      dialog.className = 'cf-dialog';
      dialog.setAttribute('aria-labelledby', 'cf-sources-title');
      document.body.append(dialog);
      dialog.addEventListener('close', () => {
        lastChange = Date.now();
        if (hero?.isConnected) hero.querySelector('.cf-sources')?.focus({ preventScroll: true });
        syncPlayer();
      });
    }
    const clip = videoFor(item), film = item.stageVideo, credit = item.imageCredit, foreground = item.foregroundCredit;
    dialog.innerHTML = `<div class="cf-dialog-head"><h2 id="cf-sources-title">${escape(item.name)} · 출처</h2><form method="dialog"><button autofocus aria-label="출처 닫기">닫기</button></form></div>
      ${film ? `<section><h3>만화 컷 배경 영상</h3>${sourceLink(film.page, film.title)}<p>${escape(film.author)} · ${sourceLink('https://creativecommons.org/licenses/by/3.0/', 'CC BY 3.0')}<br>일부 장면을 발췌해 무음·흑백으로 편집하고 컷 모양에 맞춰 표시했습니다.</p>
      <div class="cf-dialog-actions"><button type="button" data-video-mode>${useVideo ? '배경을 정지 이미지로 보기' : '배경 영상 사용'}</button></div></section>` : ''}
      ${clip ? `<section><h3>관련 공식 영상</h3>${sourceLink('https://www.youtube.com/watch?v=' + clip.id, clip.title)}</section>` : ''}

      <section><h3>캐릭터 이미지</h3>${sourceLink(foreground?.page_url || item.official, foreground?.author || item.organization)}${foreground?.note ? `<p>${escape(foreground.note)}</p>` : ''}</section>
      ${credit ? `<section><h3>배경 이미지</h3>${sourceLink(credit.page_url, [credit.author, credit.license].filter(Boolean).join(' · '))}<p>원본의 일부를 흑백으로 표시했습니다.</p></section>` : ''}
      <p>캐릭터의 권리는 각 권리자에게 있습니다. 이용 조건은 ${sourceLink(item.official, '공식 안내')}에서 확인하세요.</p>`;
    if (!dialog.open) dialog.showModal();
    syncPlayer();
    dialog.querySelector('[data-video-mode]')?.addEventListener('click', () => {
      useVideo = !useVideo;
      if (useVideo) playing = true;
      dialog.close();
      draw(root);
    });
  }

  function tick() {
    if (!hero?.isConnected) {
      releasePlayer(); clearInterval(timer); timer = hero = null; return;
    }
    syncPlayer();
    const blocked = !playing || document.hidden || hovered || dialogOpen() || entries().length < 2 ||
      (hero.contains(document.activeElement) && !document.activeElement.matches('.cf-play')) ||
      (player && !visible) || hero.getBoundingClientRect().bottom <= 0;
    if (blocked) { lastChange = Date.now(); return; }
    const interval = hero.querySelector('.cf-film video') ? data.carousel?.videoIntervalMs || 20000 : data.carousel?.intervalMs || 7000;
    if (Date.now() - lastChange >= interval) changeSlide(hero, 1);
  }

  // Keep the search engine, URL filters and thumbnail dialogs from the shared directory.
  // Move its already-bound controls into one disclosure before the router restores focus.
  function arrangeSearch(page, filters) {
    page.classList.add('character-directory');
    const section = page.querySelector('.search-section'), form = section.querySelector('#search-form');
    const examples = section.querySelector('.search-examples'), group = section.querySelector('.category-bar');
    const numActive = ['origin', 'category', 'group', 'sub', 'sector', 'format', 'region', 'access'].filter(key => filters[key] !== 'all').length + Number(filters.includeHistorical);
    const bar = document.createElement('div');
    bar.className = 'cd-search';
    bar.innerHTML = `<div class="cd-heading"><h2>캐릭터 찾기</h2><a href="/mascots/#/guide">이용안내</a></div>
      <div class="cd-search-line"><button type="button" id="character-filters" aria-controls="character-filter-panel" aria-expanded="${filtersOpen}"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7h7m5 0h6M3 17h12m4 0h2"/><circle cx="12" cy="7" r="2.4"/><circle cx="17" cy="17" r="2.4"/></svg>필터${numActive ? ` <b>${numActive}</b>` : ''}</button></div>`;
    const drawer = document.createElement('div');
    drawer.id = 'character-filter-panel';
    drawer.hidden = !filtersOpen;
    const attach = (title, ...nodes) => {
      nodes = nodes.filter(Boolean);
      if (!nodes.length) return;
      const row = document.createElement('div');
      row.className = 'cd-filter-row';
      const label = document.createElement('strong');
      label.textContent = title;
      row.append(label, ...nodes);
      drawer.append(row);
    };
    attach('국내·해외', section.querySelector('.origin-bar'));
    attach('기관 유형', group, section.querySelector('.sub-bar'));
    attach('세부 조건', section.querySelector('.filter-bar'));
    if (examples) {
      examples.querySelector('span')?.remove();
      attach('검색 예시', examples);
    }
    section.replaceChildren(bar, drawer);
    bar.querySelector('.cd-search-line').prepend(form);
    form.querySelector('label').textContent = '기관명, 캐릭터 이름, 초성 또는 파일 형식으로 검색';
    const toggle = bar.querySelector('#character-filters');
    toggle.onclick = () => {
      filtersOpen = !filtersOpen;
      drawer.hidden = !filtersOpen;
      toggle.setAttribute('aria-expanded', String(filtersOpen));
    };
    drawer.addEventListener('keydown', event => {
      if (event.key === 'Escape' && filtersOpen) {
        event.preventDefault();
        toggle.click();
        toggle.focus();
      }
    });
    const result = page.querySelector('#result-count');
    const count = result.querySelector('strong').textContent;
    result.textContent = '';
    result.append(Object.assign(document.createElement('strong'), { textContent: count }), '개');
    page.querySelector('#results-heading').textContent = filters.q ? '검색 결과' : '캐릭터 목록';
    const cardView = page.querySelector('#view-grid');
    cardView.title = '카드 보기';
    cardView.setAttribute('aria-label', '카드 보기');
  }

  window.__LETSUM_BOOTSTRAP__.renderDirectoryLayout = (page, filters) => {
    arrangeSearch(page, filters);
    const root = page.querySelector('.directory-hero');
    if (!root) return;
    root.dataset.directoryFeature = '';
    root.className = 'character-feature';
    root.setAttribute('aria-label', '추천 캐릭터');
    root.setAttribute('aria-roledescription', '캐러셀');
    hero = root;
    hovered = false;
    root.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') hovered = true; });
    root.addEventListener('pointerleave', () => { hovered = false; lastChange = Date.now(); });
    clearInterval(timer);
    timer = setInterval(tick, 500);
    draw(root);
  };
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    playing = useVideo = false;
    if (hero?.isConnected) draw(hero);
  });
  document.addEventListener('visibilitychange', syncPlayer);
  document.addEventListener('close', syncPlayer, true);
})();
