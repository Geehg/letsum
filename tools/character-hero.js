(() => {
  'use strict';
  const data = __FEATURED_DATA__;
  const themes = { ranked: '기업 규모순 10선', all: '모든 테마', world: '해외 캐릭터', city: '도시의 얼굴', campus: '캠퍼스 친구들', daily: '일상 속 안내자', brand: '브랜드 아이콘' };
  const slides = data.items.filter(item => item.portrait);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let theme = 'ranked', index = 0, playing = !motion.matches, useVideo = !motion.matches;
  let hero = null, timer = null, lastChange = 0, hovered = false, filtersOpen = false;
  let player = null, observer = null, visible = false, requestedPlay = false;
  const companies = Object.values(data.companies).sort((a, b) => b.billionYen - a.billionYen);
  const ranked = slides.filter(item => data.companies[item.company]).sort((a, b) =>
    data.companies[b.company].billionYen - data.companies[a.company].billionYen || a.name.localeCompare(b.name, 'ko')
  ).slice(0, 10);
  const entries = () => theme === 'ranked' ? ranked : slides.filter(item => theme === 'all' || item.theme === theme);
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

  function cutoutMask(portrait, id) {
    if (!portrait.outline) return '';
    return `<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs><clipPath id="${id}" clipPathUnits="objectBoundingBox"><path d="${escape(portrait.outline)}"/></clipPath></defs></svg>`;
  }

  function portraitStyle({ centerX, top, bottom }) {
    return `--portrait-height:${100 / (bottom - top)}%;--portrait-x:${-centerX * 100}%;--portrait-y:${-top * 100}%`;
  }

  function noteMarkup(text, side) {
    let position = 0;
    const words = text.split(/\s+/).map(word => {
      const letters = Array.from(word, letter => `<span class="cf-letter" style="--order:${position++}">${escape(letter)}</span>`).join('');
      return `<span class="cf-word">${letters}</span>`;
    });
    return `<p class="cf-note cf-note-${side}"><span class="sr-only">${escape(text)}</span><span class="cf-type" aria-hidden="true">${words.join(' ')}</span></p>`;
  }

  function changeSlide(root, step) {
    const length = entries().length;
    index = (index + step + length) % length;
    draw(root);
  }

  function mountControls(root) {
    root.innerHTML = `<div class="cf-page-art"></div><div class="cf-toolbar"><div class="cf-tools-inner">
      <label class="cf-theme-select"><span class="sr-only">캐릭터 소개 테마</span><select id="character-theme">${Object.entries(themes).filter(([id]) => id === 'ranked' || id === 'all' || slides.some(slide => slide.theme === id)).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
      <button class="cf-sources" type="button" aria-haspopup="dialog"></button>
      <div class="cf-paging" role="group" aria-label="추천 캐릭터 슬라이드">
        <button type="button" data-step="-1" aria-label="이전 캐릭터">‹</button><span class="cf-count"></span>
        <button type="button" data-step="1" aria-label="다음 캐릭터">›</button><button class="cf-play" type="button"></button>
      </div>
    </div></div>`;
    const select = root.querySelector('#character-theme');
    select.value = theme;
    select.onchange = () => {
      theme = select.value;
      index = 0;
      draw(root);
    };
    root.querySelectorAll('[data-step]').forEach(button => {
      button.onclick = () => changeSlide(root, Number(button.dataset.step));
    });
    root.querySelector('.cf-play').onclick = () => {
      playing = !playing;
      if (!playing) {
        root.querySelector('.cf-page-art').classList.remove('cf-moving');
        root.querySelector('.cf-leaving')?.remove();
      }
      syncPlayer();
      lastChange = Date.now();
      updatePlay(root);
    };
    root.querySelector('.cf-sources').onclick = () => openSources(root, itemAt());
  }

  function draw(root) {
    releasePlayer();
    const item = itemAt(), profile = item.profile, clip = item.video;
    const stage = root.querySelector('.cf-page-art');
    const animate = playing && !motion.matches && stage.dataset.record !== item.id;
    const oldFigure = animate && stage.querySelector('.cf-figure:not(.cf-leaving)');
    if (oldFigure) {
      const style = getComputedStyle(oldFigure);
      oldFigure.style.setProperty('--exit-from', style.transform === 'none' ? 'translateX(0)' : style.transform);
      oldFigure.style.setProperty('--exit-opacity', style.opacity);
    }
    stage.classList.toggle('cf-moving', animate);
    stage.classList.toggle('cf-swapping', Boolean(oldFigure));
    stage.classList.remove('cf-ready');
    stage.dataset.record = item.id;
    lastChange = Date.now();
    const maskId = 'cf-mask-' + item.id;
    const title = profile.nativeName;
    const company = data.companies[item.company];
    const rankLabel = theme === 'ranked' ? '기업 ' + (companies.indexOf(company) + 1) + '위 · ' + company.label : item.organization;
    const byline = title === item.name ? themes[item.theme] : item.name;
    stage.innerHTML = `${backdrop(item)}
      <div class="cf-intro"><p class="cf-byline">${escape(byline)}<span aria-hidden="true">/</span>${escape(rankLabel)}</p>
        <h1 id="page-heading" lang="${/[가-힣]/.test(title) ? 'ko' : 'en'}"${title.length > 13 ? ' class="cf-long-name"' : ''}>${escape(title)}</h1><p class="cf-caption">${escape(item.copy)}</p>
        <a class="cf-detail" href="${escape(item.detail)}">캐릭터 상세 보기 <span aria-hidden="true">→</span></a>
      </div>
      <div class="cf-notes">${noteMarkup(profile.facts[0], 'left')}${noteMarkup(profile.facts[1], 'right')}</div>
      <button type="button" style="${portraitStyle(item.portrait)}" class="cf-figure" data-preview-record="${escape(item.id)}" aria-label="${escape(item.name)} 상세 미리보기" aria-haspopup="dialog">
        ${cutoutMask(item.portrait, maskId)}<span class="cf-shadow"><img${item.portrait.outline ? ` style="clip-path:url(#${maskId})"` : ''} src="${escape(item.image)}" alt="" decoding="async" fetchpriority="high"></span>
      </button>`;
    if (oldFigure) {
      oldFigure.classList.add('cf-leaving');
      oldFigure.inert = true;
      oldFigure.setAttribute('aria-hidden', 'true');
      oldFigure.removeAttribute('data-preview-record');
      stage.append(oldFigure);
      oldFigure.addEventListener('animationend', () => oldFigure.remove(), { once: true });
    }
    const figure = stage.querySelector('.cf-figure:not(.cf-leaving)'), image = figure.querySelector('img');
    const reveal = () => {
      if (figure.parentElement === stage && !figure.classList.contains('cf-leaving')) stage.classList.add('cf-ready');
    };
    if (image.complete) reveal();
    else {
      image.addEventListener('load', reveal, { once: true });
      image.addEventListener('error', reveal, { once: true });
    }
    root.querySelector('.cf-count').innerHTML = `${index + 1} <i>/</i> ${entries().length}`;
    root.querySelector('.cf-sources').textContent = theme === 'ranked' ? '선정 기준·출처' : clip || item.stageVideo ? '영상·출처' : '이미지 출처';
    root.querySelectorAll('[data-step]').forEach(button => { button.disabled = entries().length < 2; });
    updatePlay(root);
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
    const clip = item.video, film = item.stageVideo, credit = item.imageCredit, foreground = item.foregroundCredit;
    dialog.innerHTML = `<div class="cf-dialog-head"><h2 id="cf-sources-title">${escape(item.name)} · 출처</h2><form method="dialog"><button autofocus aria-label="출처 닫기">닫기</button></form></div>
      ${theme === 'ranked' ? `<section><h3>기업 규모순 캐릭터 10선</h3><p>${escape(data.method.scope)} ${escape(data.method.period)} ${escape(data.method.ties)}</p>
      <ol>${companies.map(company => `<li>${sourceLink(company.source, company.label)} · ${(company.billionYen * 10).toLocaleString('ko', {maximumFractionDigits: 2})}억 엔<br>${escape(ranked.filter(record => data.companies[record.company] === company).map(record => record.name).join(' · '))}</li>`).join('')}</ol></section>` : ''}
      ${film ? `<section><h3>만화 컷 배경 영상</h3>${sourceLink(film.page, film.title)}${film.description ? `<p>${escape(film.description)}</p>` : ''}<p>${escape(film.author)} · ${sourceLink(film.licenseUrl, film.license)}<br>원본 일부를 무음·흑백으로 편집해 만화 컷에 맞췄습니다.</p>
      <div class="cf-dialog-actions"><button type="button" data-video-mode>${useVideo ? '배경을 정지 이미지로 보기' : '배경 영상 사용'}</button></div></section>` : ''}
      ${clip ? `<section><h3>관련 공식 영상</h3>${sourceLink(clip.url || 'https://www.youtube.com/watch?v=' + clip.id, clip.title)}</section>` : ''}

      <section><h3>캐릭터 정보</h3>${sourceLink(item.profile.factSource, item.organization + ' · 소개 자료')}</section>
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
    mountControls(root);
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
