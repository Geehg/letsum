(() => {
  'use strict';
  const data = __FEATURED_DATA__;
  const themes = { all: '모든 테마', world: '해외 캐릭터', city: '도시의 얼굴', campus: '캠퍼스 친구들', daily: '일상 속 안내자', brand: '브랜드 아이콘' };
  const slides = data.items.filter(item => item.foregroundMode !== 'photo');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const videoFor = item => item.video || (item.id === 'mm-seoulmetro-ddota' ? { id: 'Or5wErHf-i0', title: '서울교통공사 · 또타 팝업 현장' } : null);
  let theme = 'all', index = 0, playing = !motion.matches, useVideo = !motion.matches;
  let hero = null, timer = null, lastChange = 0, hovered = false, failedVideo = null, filtersOpen = false;
  let youtube, player = null, observer = null, ready = false, visible = false, wantsPlayback = false, requestedPlay = false, generation = 0;
  const entries = () => slides.filter(item => theme === 'all' || item.theme === theme);
  const itemAt = () => entries()[index];
  const optionsDialog = () => document.querySelector('#character-sources');
  const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));

  function youtubeReady() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtube) return youtube;
    youtube = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      const timer = setTimeout(() => reject(new Error('YouTube timeout')), 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timer);
        if (typeof previous === 'function') previous();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => { clearTimeout(timer); reject(new Error('YouTube unavailable')); };
      document.head.append(script);
    }).catch(error => { youtube = null; throw error; });
    return youtube;
  }

  function releasePlayer() {
    generation++;
    observer?.disconnect();
    observer = null;
    if (player) { try { player.destroy(); } catch {} }
    player = null;
    ready = visible = wantsPlayback = requestedPlay = false;
  }

  function syncPlayer() {
    if (!ready) return;
    if (!visible || document.hidden || dialogOpen()) {
      if (player.getPlayerState() === 1) player.pauseVideo();
      requestedPlay = false;
    } else if (wantsPlayback && !requestedPlay) {
      requestedPlay = true;
      player.playVideo();
    }
  }

  function attachPlayer(root, item) {
    const frame = root.querySelector('.cf-film iframe');
    const version = generation;
    const valid = () => version === generation && root.isConnected;
    const fail = () => {
      if (!valid()) return;
      failedVideo = item.id;
      draw(root);
      if (optionsDialog()?.open) openSources(root, item);
    };
    observer = new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio > .5;
      syncPlayer();
    }, { threshold: [0, .51, 1] });
    observer.observe(frame);
    youtubeReady().then(YT => {
      if (!valid()) return;
      player = new YT.Player(frame, { events: {
        onReady(event) {
          if (!valid()) return;
          ready = true;
          event.target.mute();
          wantsPlayback = useVideo;
          syncPlayer();
        },
        onStateChange(event) {
          if (!valid()) return;
          if (event.data === 1) {
            wantsPlayback = requestedPlay = true;
            syncPlayer();
          } else if (event.data === 2 && visible && !document.hidden && !dialogOpen() && requestedPlay) {
            wantsPlayback = requestedPlay = false;
          } else if (event.data === 0) {
            wantsPlayback = false;
            lastChange = Date.now();
          }
        },
        onAutoplayBlocked() { if (valid()) wantsPlayback = requestedPlay = false; },
        onError: fail
      } });
    }).catch(fail);
  }

  function panelScene(source, position) {
    return `<div class="cf-scene cf-scene-${position}" aria-hidden="true">${source ? `<img src="${escape(source)}" alt="" decoding="async">` : ''}</div>`;
  }

  // The same paths draw both banks of every gutter. A white centre stroke keeps adjacent panels separate.
  function gutters(kind, path) {
    return `<svg aria-hidden="true" class="cf-gutters cf-gutters-${kind}" viewBox="0 0 1000 1000" preserveAspectRatio="none"><path d="${path}" vector-effect="non-scaling-stroke" fill="none" stroke="#45443e" stroke-width="9"/><path d="${path}" vector-effect="non-scaling-stroke" fill="none" stroke="#fffdf7" stroke-width="5"/></svg>`;
  }

  function changeSlide(root, step) {
    const length = entries().length;
    index = (index + step + length) % length;
    failedVideo = null;
    draw(root);
  }

  function draw(root) {
    releasePlayer();
    const item = itemAt(), clip = videoFor(item), film = useVideo && clip && failedVideo !== item.id;
    const scenes = [...new Set(item.panels || [])];
    const closeup = scenes[1] || (scenes[0] !== item.image ? item.image : null);
    lastChange = Date.now();
    root.innerHTML = `<div class="cf-page-art">
      <div class="cf-field" aria-hidden="true"></div>
      ${film ? `<div class="cf-film"><iframe title="${escape(clip.title)}" src="https://www.youtube-nocookie.com/embed/${escape(clip.id)}?autoplay=0&amp;mute=1&amp;enablejsapi=1&amp;origin=${encodeURIComponent(location.origin)}&amp;playsinline=1&amp;controls=1&amp;rel=0" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>` : panelScene(scenes[0], 'wide')}
      ${panelScene(film ? scenes[0] : closeup, 'small')}
      ${gutters('wide', 'M330 0 L409 1000 M707 0 V635 L669 1000 M707 635 H1000 M388 740 L707 462')}
      ${gutters('narrow', 'M424 0 L535 1000 M0 1000 H1000')}
      <div class="cf-intro"><p class="cf-byline">${escape(themes[item.theme])}<span aria-hidden="true">/</span>${escape(item.organization)}</p>
        <h1 id="page-heading">${escape(item.name)}</h1><p class="cf-caption">${escape(item.copy)}</p>
        <a class="cf-detail" href="${escape(item.detail)}">캐릭터 상세 보기 <span aria-hidden="true">→</span></a>
      </div>
      <button type="button" class="cf-figure" data-preview-record="${escape(item.id)}" aria-label="${escape(item.name)} 상세 미리보기" aria-haspopup="dialog"><img src="${escape(item.image)}" alt="" decoding="async" fetchpriority="high"></button>
    </div>
    <div class="cf-toolbar"><div class="cf-tools-inner">
      <label class="cf-theme-select"><span class="sr-only">캐릭터 소개 테마</span><select id="character-theme">${Object.entries(themes).map(([id, label]) => `<option value="${id}"${theme === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      <button class="cf-sources" type="button" aria-haspopup="dialog">${clip ? '영상·출처' : '이미지 출처'}</button>
      <div class="cf-paging" role="group" aria-label="추천 캐릭터 슬라이드">
        <button type="button" data-step="-1" aria-label="이전 캐릭터">‹</button><span>${index + 1} <i>/</i> ${entries().length}</span>
        <button type="button" data-step="1" aria-label="다음 캐릭터">›</button><button class="cf-play" type="button"></button>
      </div>
    </div></div>`;
    updatePlay(root);
    root.querySelector('#character-theme').onchange = event => {
      theme = event.target.value;
      index = 0;
      failedVideo = null;
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
      lastChange = Date.now();
      updatePlay(root);
    };
    root.querySelector('.cf-sources').onclick = () => openSources(root, item);
    if (film) attachPlayer(root, item);
  }

  function updatePlay(root) {
    const button = root.querySelector('.cf-play');
    const label = playing ? '자동 슬라이드 정지' : '자동 슬라이드 재생';
    button.innerHTML = playing ? '<span class="cf-pause-mark" aria-hidden="true"></span>' : '<span aria-hidden="true">▶</span>';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.disabled = entries().length < 2;
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
    const clip = videoFor(item), film = Boolean(root.querySelector('.cf-film')), credit = item.imageCredit, foreground = item.foregroundCredit;
    dialog.innerHTML = `<div class="cf-dialog-head"><h2 id="cf-sources-title">${escape(item.name)} · 출처</h2><form method="dialog"><button autofocus aria-label="출처 닫기">닫기</button></form></div>
      ${clip ? `<section><h3>배경 영상</h3>${sourceLink('https://www.youtube.com/watch?v=' + clip.id, clip.title)}
      ${failedVideo === item.id ? '<p role="status">플레이어 연결에 실패해 이미지로 표시 중입니다.</p>' : ''}
      <div class="cf-dialog-actions"><button type="button" data-video-mode>${film ? '이미지로 전환' : '영상으로 전환'}</button>${film && ready ? `<button type="button" data-video-play>${wantsPlayback ? '영상 일시정지' : '영상 재생'}</button>` : ''}</div></section>` : ''}
      <section><h3>캐릭터 이미지</h3>${sourceLink(foreground?.page_url || item.official, foreground?.author || item.organization)}${foreground?.note ? `<p>${escape(foreground.note)}</p>` : ''}</section>
      ${credit ? `<section><h3>배경 이미지</h3>${sourceLink(credit.page_url, [credit.author, credit.license].filter(Boolean).join(' · '))}<p>원본의 일부를 흑백으로 표시했습니다.</p></section>` : ''}
      <p>캐릭터의 권리는 각 권리자에게 있습니다. 이용 조건은 ${sourceLink(item.official, '공식 안내')}에서 확인하세요.</p>`;
    if (!dialog.open) dialog.showModal();
    syncPlayer();
    dialog.querySelector('[data-video-mode]')?.addEventListener('click', () => {
      useVideo = !film;
      failedVideo = null;
      dialog.close();
      draw(root);
    });
    dialog.querySelector('[data-video-play]')?.addEventListener('click', () => {
      wantsPlayback = !wantsPlayback;
      requestedPlay = false;
      dialog.close();
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
    const interval = hero.querySelector('.cf-film') ? data.carousel?.videoIntervalMs || 20000 : data.carousel?.intervalMs || 7000;
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
