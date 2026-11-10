import { escapeHtml, safeUrl, filterRecords, getFormats, summarize } from './core.js';
import { renderReview, bindReview } from './review.js';

// This module owns public navigation and local bookmarks. Catalog data stays immutable.
(() => {
  'use strict';
  const boot = window.__LETSUM_BOOTSTRAP__;
  if (!boot?.catalog || !boot?.taxonomy || !boot?.sources) return;
  const { catalog, taxonomy, sources, catalogSha256 } = boot;
  // Optional identification images added by the LETSUM production build (tools/fetch_logo_thumbs.mjs); absent in the standalone build.
  const thumbnails = boot.thumbnails || {};
  // CI colours: values as written on the official guide page, or sampled from the logo image (marked unofficial).
  const colors = boot.colors || {};
  // Official logo files that download directly (tools/logo-survey/check_downloads.py), and the recognition score used for the default order (popularity.py).
  const downloads = boot.downloads || {};
  const rank = boot.rank || {};
  // A ZIP named after one format (ci_ai.zip) stands for that format; a file of the format itself is preferred.
  const fileFormat = file => file.contains || file.format;
  const firstDownload = (record, format) => { const files = downloads[record.id] || [], want = String(format).toUpperCase(); return files.find(file => file.format === want && !file.contains) || files.find(file => fileFormat(file) === want) || files.find(file => file.format === want); };
  const allFormats = record => [...new Set([...getFormats(record), ...(downloads[record.id] || []).map(fileFormat)])];
  // Browse groups (대분류/소분류) from tools/logo-survey/classify.py; the standalone build falls back to categories.
  const browse = boot.groups?.groups?.length ? boot.groups : null;
  const groupOf = id => (browse?.assign?.[id] || '').split('/');
  const groupLabel = id => browse?.groups.find(g => g.id === id)?.label || '';
  const subLabel = (group, sub) => browse?.groups.find(g => g.id === group)?.subs.find(s => s.id === sub)?.label || '';
  const PAGE_SIZE = 60;
  let visibleCount = PAGE_SIZE, lastListKey = '';
  const surveyed = record => record.id.startsWith('kr-');
  const thumbSourceLabels = { 'simple-icons': 'Simple Icons', 'wikimedia-commons': 'Wikimedia Commons', 'official-page-image': '공식 페이지', 'official-site-logo': '공식 홈페이지', 'official-site-icon': '공식 사이트 아이콘' };
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  // A missing or blocked image falls back to the typeset name instead of a broken icon.
  app?.addEventListener('error', event => {
    if (!event.target.matches?.('img.logo-thumb')) return;
    event.target.closest('[data-thumb]')?.removeAttribute('data-thumb');
    event.target.remove();
  }, true);
  const sourceById = new Map(sources.sources.map(source => [source.id, source]));
  const recordById = new Map(catalog.records.map(record => [record.id, record]));
  const publicRecords = catalog.records.filter(record => !['draft', 'archived'].includes(record.review.status));
  const publicRecordIds = new Set(publicRecords.map(record => record.id));
  const visibleRecords = publicRecords.filter(record => record.version.status !== 'historical');
  const totals = summarize(visibleRecords);
  const categoryLabels = new Map(taxonomy.categories.map(item => [item.id, item.label]));
  const sectorLabels = new Map(taxonomy.sectors.map(item => [item.id, item.label]));
  const kindLabels = new Map(taxonomy.identity_kinds.map(item => [item.id, item.label]));
  const formLabels = new Map(taxonomy.asset_forms.map(item => [item.id, item.label]));
  const accessLabels = { public: '공개 제공 안내', login: '로그인 필요', request: '별도 요청', information: '정보 안내', unknown: '접근 조건 미확인' };
  const approvalLabels = { required: '사전 승인 필요', conditional: '조건별 승인 안내', 'not-stated': '해당 페이지에 명시 없음', unknown: '확인 필요' };
  const policyLabels = { permitted: '허용 근거 확인', conditional: '조건부 안내', restricted: '제한 안내', unknown: '확인 필요' };
  const reviewLabels = { 'source-reviewed': '출처 검토됨', 'needs-review': '재검수 필요', draft: '검토 전', archived: '보관 자료' };
  const categoryAbbreviations = { 'national-government': 'GOVERNMENT', 'local-government': 'CITY & REGION', 'public-organization': 'PUBLIC ORGANIZATION', education: 'EDUCATION', business: 'BUSINESS & BRAND', nonprofit: 'NONPROFIT', intergovernmental: 'INTERNATIONAL' };
  const storageKey = 'letsum-logo:saved:v1';
  let savedIds = new Set();
  let storageAvailable = true;
  let notificationTimer;
  let cleanupRoute = null;
  let lastPath = '';

  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(parsed)) {
      savedIds = new Set(parsed.filter(id => typeof id === 'string' && publicRecordIds.has(id)));
      if (JSON.stringify([...savedIds]) !== JSON.stringify(parsed)) localStorage.setItem(storageKey, JSON.stringify([...savedIds]));
    }
  } catch { storageAvailable = false; }

  const h = escapeHtml;
  const icon = (name, size = 20) => {
    const paths = {
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
      arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
      right: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
      back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
      bookmark: '<path d="M6 4h12v17l-6-4-6 4V4Z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
      tiles: '<rect x="5" y="5" width="9" height="9" rx="2.5" transform="rotate(-30 9.5 9.5)"/><rect x="11" y="11" width="9" height="9" rx="2.5" transform="rotate(-30 15.5 15.5)"/>',
      list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
      download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
      link: '<path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 8a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2" transform="translate(1 0) scale(.9)"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
      close: '<path d="m6 6 12 12M6 18 18 6"/>',
      folder: '<path d="M3 7V5h6l2 3h10v12H3V7Z"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18"/>',
      filter: '<path d="M4 6h16M7 12h10M10 18h4"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
  };
  const label = (map, value) => map.get(value) || value;
  const external = (url, text, className = '') => {
    const safe = safeUrl(url);
    return safe ? `<a class="${h(className)}" href="${h(safe)}" target="_blank" rel="noopener noreferrer">${h(text)} ${icon('arrow', 16)}<span class="sr-only"> 새 탭</span></a>` : '<span class="muted">링크 확인 필요</span>';
  };
  const domain = url => { try { return new URL(safeUrl(url)).hostname; } catch { return '출처 확인 필요'; } };
  const fmtDate = date => date ? date.replaceAll('-', '.') : '재확인 예정';
  const detailHref = id => `/logos/brands/${encodeURIComponent(id)}/`;
  const publicRecord = id => { const record = recordById.get(id); return record && !['draft', 'archived'].includes(record.review.status) ? record : null; };
  const reviewBadge = record => {
    const reviewed = record.review.status === 'source-reviewed';
    const scopeLabel = record.review.source_scope === 'page' ? '출처 페이지 확인' : record.review.source_scope === 'search' ? '검색 결과 확인' : '출처 검토됨';
    const text = reviewed ? scopeLabel : surveyed(record) && record.review.status === 'needs-review' ? '자동 수집·검수 대기' : reviewLabels[record.review.status];
    return `<span class="status-badge ${reviewed ? 'reviewed' : 'pending'}">${icon(reviewed ? 'check' : 'info', 13)}${h(text)}</span>`;
  };

  function notify(message) {
    clearTimeout(notificationTimer);
    toast.textContent = String(message);
    toast.classList.add('is-visible');
    notificationTimer = setTimeout(() => toast.classList.remove('is-visible'), 3600);
  }

  function saveBookmarks() {
    try { localStorage.setItem(storageKey, JSON.stringify([...savedIds])); storageAvailable = true; }
    catch { storageAvailable = false; }
  }

  function updateSavedUI(id) {
    document.querySelector('#saved-count').textContent = String(savedIds.size);
    document.querySelectorAll('[data-save]').forEach(button => {
      if (id && button.dataset.save !== id) return;
      const saved = savedIds.has(button.dataset.save);
      const record = recordById.get(button.dataset.save);
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', `${record?.name || '자료'} ${saved ? '보관 해제' : '보관하기'}`);
      button.classList.toggle('is-saved', saved);
      if (button.classList.contains('save-detail')) button.innerHTML = `${icon('bookmark', 18)} ${saved ? '보관됨' : '보관하기'}`;
    });
  }

  function routeInfo() {
    const raw = location.hash.startsWith('#/') ? location.hash.slice(1) : (boot.initialRoute || '/');
    const [path, query = ''] = raw.split('?');
    return { path, params: new URLSearchParams(query) };
  }

  function readFilters(params) {
    const valid = (key, values, fallback = 'all') => values.includes(params.get(key)) ? params.get(key) : fallback;
    const regions = [...new Set(publicRecords.map(record => record.region).filter(Boolean))];
    return {
      q: (params.get('q') || '').slice(0, 200),
      category: valid('category', taxonomy.categories.map(item => item.id)),
      group: browse ? valid('group', browse.groups.map(item => item.id)) : 'all',
      sub: browse ? valid('sub', browse.groups.flatMap(item => item.subs.map(s => s.id))) : 'all',
      sector: valid('sector', taxonomy.sectors.map(item => item.id)),
      format: valid('format', taxonomy.formats),
      region: valid('region', regions),
      access: valid('access', taxonomy.access.map(item => item.id)),
      includeHistorical: params.get('history') === '1',
      sort: valid('sort', ['relevance', 'name', 'checked'], 'relevance'),
      view: valid('view', ['grid', 'icons', 'list'], 'grid')
    };
  }

  function setFilters(changes, path = routeInfo().path) {
    const current = readFilters(routeInfo().params);
    const next = { ...current, ...changes };
    const params = new URLSearchParams();
    for (const key of ['q', 'category', 'group', 'sub', 'sector', 'format', 'region', 'access', 'sort', 'view']) {
      const value = next[key];
      if (value && value !== 'all' && !(key === 'sort' && value === 'relevance') && !(key === 'view' && value === 'grid')) params.set(key, value);
    }
    if (next.includeHistorical) params.set('history', '1');
    const hash = `#${path}${params.size ? '?' + params.toString() : ''}`;
    if (hash === location.hash) renderRoute(); else location.hash = hash;
  }

  const select = (name, title, options, selected) => `<label class="filter-select" for="filter-${h(name)}"><span>${h(title)}</span><select id="filter-${h(name)}" name="${h(name)}" data-filter="${h(name)}" aria-label="${h(title)}"><option value="all">전체</option>${options.map(item => `<option value="${h(item.id)}"${item.id === selected ? ' selected' : ''}>${h(item.label)}</option>`).join('')}</select></label>`;

  function renderSearch(f, isSaved) {
    return `<form id="search-form" class="search-form" role="search"><label class="sr-only" for="logo-query">기관명, 브랜드명, 초성 또는 파일 형식으로 검색</label>${icon('search', 22)}<input id="logo-query" name="q" type="search" value="${h(f.q)}" placeholder="기관명, 브랜드명, 초성으로 찾아보세요" autocomplete="off" maxlength="200"><kbd aria-hidden="true">/</kbd><button id="search-submit" type="submit">검색 ${icon('right', 18)}</button></form>
    ${!isSaved ? '<div class="search-examples"><span>이렇게 찾아보세요</span><button id="query-goyang" type="button" data-query="고양시">고양시</button><button id="query-snu" type="button" data-query="서울대">서울대</button><button id="query-naver" type="button" data-query="NAVER">NAVER</button><button id="query-ai" type="button" data-query="AI">AI 파일 안내</button></div>' : ''}`;
  }

  function renderGroupBar(f, collection) {
    const count = (group, sub) => collection.filter(record => { const [g, s] = groupOf(record.id); return g === group && (!sub || s === sub); }).length;
    const active = browse.groups.find(g => g.id === f.group);
    const bar = `<div class="category-bar group-bar" role="group" aria-label="대분류"><button id="group-all" type="button" data-group="all" class="category-button ${f.group === 'all' ? 'active' : ''}" aria-pressed="${f.group === 'all'}">전체 <span>${collection.length}</span></button>${browse.groups.map(g => `<button id="group-${h(g.id)}" type="button" data-group="${h(g.id)}" class="category-button ${f.group === g.id ? 'active' : ''}" aria-pressed="${f.group === g.id}">${h(g.label)} <span>${count(g.id)}</span></button>`).join('')}</div>`;
    const subs = active ? `<div class="sub-bar" role="group" aria-label="${h(active.label)} 소분류"><button type="button" data-sub="all" class="sub-chip ${f.sub === 'all' ? 'active' : ''}" aria-pressed="${f.sub === 'all'}">${h(active.label)} 전체</button>${active.subs.filter(s => count(active.id, s.id)).map(s => `<button id="sub-${h(s.id)}" type="button" data-sub="${h(s.id)}" class="sub-chip ${f.sub === s.id ? 'active' : ''}" aria-pressed="${f.sub === s.id}">${h(s.label)} <span>${count(active.id, s.id)}</span></button>`).join('')}</div>` : '';
    return bar + subs;
  }

  function renderFilters(f, isSaved = false) {
    const collection = publicRecords.filter(record => (!isSaved || savedIds.has(record.id)) && (f.includeHistorical || record.version.status !== 'historical'));
    const counts = new Map(taxonomy.categories.map(item => [item.id, collection.filter(record => record.category === item.id).length]));
    const regions = [...new Set(publicRecords.map(record => record.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    return `${browse ? renderGroupBar(f, collection) : `<div class="category-bar" role="group" aria-label="기관 유형"><button id="category-all" type="button" data-category="all" class="category-button ${f.category === 'all' ? 'active' : ''}" aria-pressed="${f.category === 'all'}">전체 <span>${collection.length}</span></button>${taxonomy.categories.map(item => `<button id="category-${h(item.id)}" type="button" data-category="${h(item.id)}" class="category-button ${f.category === item.id ? 'active' : ''}" aria-pressed="${f.category === item.id}">${h(item.label)} <span>${counts.get(item.id)}</span></button>`).join('')}</div>`}
    <div class="filter-bar"><div class="filter-label">${icon('filter', 18)} <span>상세 필터</span></div><div class="filter-selects">
    ${select('sector', '분야', taxonomy.sectors, f.sector)}
    ${select('format', '형식 안내', taxonomy.formats.map(id => ({id, label:id})), f.format)}
    ${select('region', '지역', regions.map(id => ({id, label:id})), f.region)}
    ${select('access', '자료 접근', taxonomy.access.map(item => ({id:item.id, label:accessLabels[item.id]})), f.access)}
    </div><label class="history-filter"><input id="history-filter" type="checkbox"${f.includeHistorical ? ' checked' : ''}> 이전 버전 포함</label><button id="reset-filters" class="text-button reset-filters" type="button" data-reset>초기화</button></div>`;
  }

  // Card and icon mock-ups: a typeset name in the category colour, never an official logo or brand colour.
  // File-type icons drawn in-house in each format's customary colours (not vendor artwork).
  const tile = (bg, inner) => `<svg class="format-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" rx="3.5" fill="${bg}"/>${inner}</svg>`;
  const letters = (text, color, size) => `<text x="8" y="${size > 7 ? 11.2 : 10.3}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${size}" fill="${color}">${text}</text>`;
  const picture = '<path d="M3.5 11.5 6.5 7.8l2.2 2.6 1.6-1.8 2.2 2.9Z" fill="#fff"/><circle cx="10.6" cy="5.4" r="1.3" fill="#fff"/>';
  const FORMAT_ICONS = {
    AI: tile('#330000', letters('Ai', '#FF9A00', 8.4)),
    EPS: tile('#330000', letters('EPS', '#FF9A00', 5.6)),
    PDF: tile('#D9221C', letters('PDF', '#fff', 5.6)),
    SVG: tile('#1F7A4D', '<path d="M3.6 11.6C5 6 11 10 12.4 4.4" stroke="#fff" stroke-width="1.3" fill="none"/><rect x="2.7" y="10.7" width="2" height="2" fill="#fff"/><rect x="11.4" y="3.4" width="2" height="2" fill="#fff"/>'),
    PNG: tile('#2F6FE0', picture),
    JPG: tile('#0E9A8F', picture),
    WEBP: tile('#5B5FD9', picture),
    ZIP: tile('#5C6066', '<path d="M7 2v1.5h2V5H7v1.5h2V8H7v1.5h2" stroke="#fff" stroke-width="1" fill="none"/><rect x="6" y="10" width="4" height="3.4" rx="1" fill="#fff"/>'),
  };
  const formatBadge = (format, record) => {
    const inner = `${FORMAT_ICONS[String(format).toUpperCase()] || ''}${h(format)}`;
    const file = record && firstDownload(record, format);
    return file ? `<a class="format-badge is-download" href="${h(safeUrl(file.url) || '#')}" target="_blank" rel="noopener noreferrer" title="공식 사이트에서 ${h(format)} 파일 받기${file.filename ? ' · ' + h(file.filename) : ''}" aria-label="${h(record.organization_name)} ${h(format)} 파일 공식 사이트에서 받기">${inner}<span class="dl-arrow" aria-hidden="true">↓</span></a>` : `<span class="format-badge">${inner}</span>`;
  };
  const fileSize = bytes => !bytes ? '' : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
  function downloadRow(record) {
    const files = downloads[record.id] || [];
    if (!files.length) return '';
    return `<div class="logo-dlrow">${files.map(file => `<a class="logo-dl" href="${h(safeUrl(file.url) || '#')}" target="_blank" rel="noopener noreferrer">${FORMAT_ICONS[fileFormat(file)] || ''}<span><b>⬇ ${h(fileFormat(file))} 파일 받기</b><small>${h([file.contains ? 'ZIP 압축' : '', domain(file.url), file.filename, fileSize(file.bytes)].filter(Boolean).join(' · '))}</small></span></a>`).join('')}</div><p class="small-copy dl-note">파일은 LETSUM이 아니라 공식 사이트에서 바로 내려받습니다. 사용 조건과 규정은 공식 출처 원문을 따릅니다.</p>`;
  }

  function cardMark(record) {
    const latin = /^[\x20-\x7e]+$/;
    const mark = latin.test(record.organization_name) ? record.organization_name : [...record.aliases].filter(alias => latin.test(alias) && alias.length <= 14).sort((a, b) => a.length - b.length)[0] || record.organization_name;
    // Approximate width of the longest word in em, so the type can scale to fit without breaking inside a word.
    const width = Math.max(...mark.split(' ').map(word => [...word].reduce((sum, char) => sum + (/[\x20-\x7e]/.test(char) ? (/[A-Z]/.test(char) ? 0.68 : 0.56) : 1), 0)));
    return { mark, latin, width: Math.max(2, width).toFixed(2), size: mark.length > 12 ? 'long' : mark.length > 7 ? 'mid' : 'short' };
  }

  const brandStyle = thumb => thumb.bg ? ` style="--brand:${h(thumb.bg)};--brand-ink:${h(thumb.ink || '#ffffff')}"` : '';
  const thumbAttrs = thumb => thumb ? ` data-thumb="${h(thumb.mode)}"${thumb.tone === 'light' ? ' data-tone="light"' : ''}${brandStyle(thumb)}` : '';
  // Glyph thumbnails (single-colour SVG) sit white on the brand colour on the front and in colour on the back.
  // Every logo is trimmed to its drawn area (tools/logo-survey/normalize_logos.py records the width/height ratio) and
  // sized so that wide wordmarks and square emblems cover a similar area of the box: height = min(1, B / r, sqrt(A / r)),
  // where B is the box's width/height ratio and A the target area in box-height units.
  const LOGO_BOXES = { front: [2.85, 0.9], tile: [1, 0.6], detail: [1.6, 0.6] };
  function logoHeight(ratio, place) {
    if (place === 'back') return `${Math.round(30 * Math.min(1, Math.sqrt(1.4 / ratio)))}px`;
    const [box, area] = LOGO_BOXES[place];
    return `${(100 * Math.min(1, box / ratio, Math.sqrt(area / ratio))).toFixed(1)}%`;
  }
  function thumbImg(thumb, place, record) {
    if (!thumb) return '';
    const src = place !== 'back' && thumb.mode === 'glyph' && thumb.on_brand ? thumb.on_brand : thumb.file;
    const size = thumb.ratio ? ` style="--lh:${logoHeight(thumb.ratio, place)}"` : '';
    return `<span class="logo-box logo-box-${place}"><img class="logo-thumb" src="${h(src)}" alt="${place === 'detail' ? h(record.organization_name + ' 로고') : ''}"${size} loading="lazy" decoding="async"></span>`;
  }

  function renderTile(record) {
    const { mark, size, latin, width } = cardMark(record);
    const thumb = thumbnails[record.id];
    return `<a class="icon-tile tone-${h(record.category)}" href="${h(detailHref(record.id))}" data-record="${h(record.id)}"${thumbAttrs(thumb)}><span class="tile-face size-${size}" style="--w:${width}" aria-hidden="true">${thumbImg(thumb, 'front', record)}<b${latin.test(mark) ? ' lang="en"' : ''}>${h(mark)}</b></span><span class="tile-name">${h(record.name)}</span><span class="tile-kind">${h(label(categoryLabels, record.category))}</span></a>`;
  }

  function renderCard(record) {
    const formats = allFormats(record);
    const { mark, size, latin, width } = cardMark(record);
    const kicker = mark === record.organization_name ? categoryAbbreviations[record.category] : record.organization_name;
    const thumb = thumbnails[record.id];
    return `<article class="brand-card" data-record="${h(record.id)}">
      <div class="identity-cover biz tone-${h(record.category)}"${thumbAttrs(thumb)}><div class="biz-front">${thumbImg(thumb, 'front', record)}<div class="cover-kicker"><span>${h(kicker)}</span><button id="save-${h(record.id)}" type="button" class="bookmark-button" data-save="${h(record.id)}" aria-label="${h(record.name)} 보관하기" aria-pressed="false">${icon('bookmark', 19)}</button></div>
      <div class="identity-name size-${size}" style="--w:${width}"${latin.test(mark) ? ' lang="en"' : ''}>${h(mark)}</div></div>
      <div class="biz-back" aria-hidden="true"><div class="biz-head">${thumbImg(thumb, 'back', record)}<span class="biz-mark size-${size}">${h(mark)}</span><span class="biz-role"><em>${h(label(kindLabels, record.kind))}</em><b>${h(record.name)}</b></span></div>
      ${colorDots(record)}<div class="biz-rows">${record.region ? `<span><em>지역</em>${h(record.region)}</span>` : ''}${formats.length ? `<span><em>형식</em>${h(formats.slice(0, 3).join(' · '))}</span>` : ''}</div><span class="biz-note">${thumb ? `이미지: ${h(thumbSourceLabels[thumb.source] || thumb.source)}` : '공식 이미지 미수록'}</span></div></div>
      <div class="card-body"><div class="card-meta"><span>${h(browse ? [groupLabel(groupOf(record.id)[0]), subLabel(...groupOf(record.id))].filter(Boolean).join(' · ') : label(categoryLabels, record.category))}</span>${record.region ? `<span>${h(record.region)}</span>` : ''}</div><h3><a href="${h(detailHref(record.id))}">${h(record.name)}</a></h3>${formats.length ? `<div class="format-row">${formats.slice(0, 6).map(format => formatBadge(format, record)).join('')}<span class="format-caption">${downloads[record.id]?.length ? '바로 받기' : '제공 안내'}</span></div>` : ''}</div>
      <div class="card-footer">${external(record.source_url, '공식 출처', 'source-button')}<a class="detail-link" href="${h(detailHref(record.id))}" aria-label="${h(record.name)} 상세정보">상세정보 ${icon('right', 16)}</a></div>
    </article>`;
  }

  function renderEmpty(isSaved, f) {
    const noSaved = isSaved && savedIds.size === 0;
    return `<div class="empty-state"><div class="empty-icon">${icon(noSaved ? 'bookmark' : 'search', 30)}</div><h2>${noSaved ? '필요한 출처를 모아두세요' : '조건에 맞는 자료가 없습니다'}</h2><p>${noSaved ? '카드의 보관 아이콘을 누르면 이 브라우저에 저장됩니다.' : '기관명이나 초성으로 다시 검색하거나, 선택한 필터를 줄여보세요.'}</p>${noSaved ? '<a class="button dark" href="/logos/#/">로고 찾아보기</a>' : '<button id="reset-empty" type="button" class="button dark" data-reset>검색 조건 초기화</button>'}<a class="text-link" href="/contact.html">찾는 기관의 공식 링크 제보하기 ${icon('arrow', 16)}</a></div>`;
  }

  function renderDirectory(isSaved, params) {
    const f = readFilters(params);
    const records = filterRecords(publicRecords, { ...f, rank, savedOnly: isSaved, savedIds: [...savedIds] })
      .filter(record => f.group === 'all' || (groupOf(record.id)[0] === f.group && (f.sub === 'all' || groupOf(record.id)[1] === f.sub)));
    const stats = summarize(records);
    // Long result lists render in pages of PAGE_SIZE; any change of route or filters starts again from the first page.
    const listKey = location.hash.replace(/[?&]more=\d+/, '');
    if (listKey !== lastListKey) { visibleCount = PAGE_SIZE; lastListKey = listKey; }
    const shown = records.slice(0, visibleCount);
    const hero = isSaved ? `<section class="directory-hero compact"><div><p class="eyebrow">YOUR COLLECTION</p><h1 id="page-heading">내 보관함<span class="accent-dot">.</span></h1><p class="hero-copy">다시 찾을 공식 출처, 한곳에 모아두세요.</p></div><div class="saved-actions"><button type="button" class="button light" id="export-saved"${savedIds.size ? '' : ' disabled'}>${icon('download', 18)} 링크 목록 저장</button><p>${storageAvailable ? '이 브라우저에 저장됩니다. 계정 간 동기화는 지원하지 않습니다.' : '저장 공간에 접근할 수 없어 현재 탭에서만 유지됩니다.'}</p></div></section>` : `<section class="directory-hero"><div><p class="eyebrow"><span class="small-dot"></span> LOGO & IDENTITY DIRECTORY</p><h1 id="page-heading">필요한 로고,<br>공식 출처에서<span class="accent-dot">.</span></h1><p class="hero-copy">공공기관부터 기업·대학까지.<br class="mobile-only"> 로고와 사용 안내를 함께 찾아보세요.</p></div><div class="hero-aside"><div class="hero-stat"><strong>${totals.organizations.toLocaleString('ko-KR')}</strong><span>기관·브랜드</span></div><div class="hero-stat"><strong>${totals.records.toLocaleString('ko-KR')}</strong><span>아이덴티티 정보</span></div><p>데이터 갱신일 ${h(fmtDate(catalog.updated_at))}<br><a href="/logos/#/guide">정보 확인 기준 ${icon('arrow', 14)}</a></p></div></section>`;
    app.innerHTML = `<div class="page-container" id="main-content" tabindex="-1">${hero}<section class="search-section" aria-label="로고 검색 및 필터">${renderSearch(f, isSaved)}${renderFilters(f, isSaved)}</section><section class="results-section" aria-labelledby="results-heading"><div class="results-toolbar"><div><h2 id="results-heading" tabindex="-1">${isSaved ? '보관한 자료' : '로고·CI 둘러보기'}</h2><span id="result-count" role="status" aria-live="polite"><strong>${records.length}</strong>개 정보 <span class="result-divider">/</span> ${stats.organizations}개 기관</span></div><div class="results-controls"><label class="sr-only" for="sort-select">정렬</label><select id="sort-select" data-filter="sort"><option value="relevance"${f.sort === 'relevance' ? ' selected' : ''}>${f.q ? '관련도순' : '인지도순'}</option><option value="name"${f.sort === 'name' ? ' selected' : ''}>이름순</option><option value="checked"${f.sort === 'checked' ? ' selected' : ''}>최근 확인순</option></select><div class="view-toggle" role="group" aria-label="보기 방식"><button id="view-grid" type="button" data-view="grid" aria-label="명함 보기" title="명함 보기" aria-pressed="${f.view === 'grid'}">${icon('grid', 17)}</button><button id="view-icons" type="button" data-view="icons" aria-label="아이콘 보기" title="아이콘 보기" aria-pressed="${f.view === 'icons'}">${icon('tiles', 18)}</button><button id="view-list" type="button" data-view="list" aria-label="목록 보기" title="목록 보기" aria-pressed="${f.view === 'list'}">${icon('list', 18)}</button></div></div></div>
    ${f.q ? `<p class="query-label">“${h(f.q)}” 검색 결과</p>` : ''}
    ${!records.length ? renderEmpty(isSaved, f) : f.view === 'icons' ? `<div class="icon-wall">${shown.map(renderTile).join('')}</div><p class="icon-wall-note">아이콘은 기관명을 유형별 색으로 조판한 견본이며 공식 로고·브랜드 색상이 아닙니다.</p>` : `<div class="brand-grid ${f.view === 'list' ? 'list-view' : ''}">${shown.map(renderCard).join('')}</div>`}${records.length > shown.length ? `<div class="more-wrap"><button id="show-more" type="button" class="button light">더 보기 <span>${records.length - shown.length}개 남음</span></button></div>` : ''}
    <div class="catalog-note">${icon('info', 18)}<p><strong>파일 형식은 공식 페이지의 안내 기준입니다.</strong> 원본 파일의 다운로드·검증 여부와 이용 허가는 각각 확인해야 합니다. <a href="/logos/#/guide">자세히 보기</a></p></div></section>
    ${!isSaved ? `<section class="contribute-banner"><div><span class="eyebrow">BUILD THE DIRECTORY</span><h2>아직 찾는 로고가 없나요?</h2><p>공식 링크를 문의 폼으로 보내주시면 확인 후 반영하겠습니다.</p></div><a class="button dark" href="/contact.html">링크 제보 작성 ${icon('right', 18)}</a></section>` : ''}</div>`;
    document.title = `${isSaved ? '내 보관함' : '로고·CI 찾기'} | LETSUM 로고`;
    bindDirectory(isSaved);
  }

  function bindDirectory(isSaved) {
    app.querySelector('#show-more')?.addEventListener('click', () => {
      const y = scrollY;
      visibleCount += PAGE_SIZE; renderRoute(); scrollTo(0, y);
    });
    app.querySelector('#search-form').addEventListener('submit', event => { event.preventDefault(); setFilters({ q: app.querySelector('#logo-query').value.trim() }); });
    app.querySelectorAll('[data-filter]').forEach(selectElement => selectElement.addEventListener('change', () => setFilters({ [selectElement.dataset.filter]: selectElement.value })));
    app.querySelector('#history-filter').addEventListener('change', event => setFilters({ includeHistorical: event.target.checked }));
    app.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => setFilters({ category: button.dataset.category })));
    app.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => setFilters({ group: button.dataset.group, sub: 'all', category: 'all' })));
    app.querySelectorAll('[data-sub]').forEach(button => button.addEventListener('click', () => setFilters({ sub: button.dataset.sub })));
    app.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setFilters({ view: button.dataset.view })));
    app.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => setFilters({ q: button.dataset.query })));
    app.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => {
      setFilters({ q: '', category: 'all', group: 'all', sub: 'all', sector: 'all', format: 'all', region: 'all', access: 'all', includeHistorical: false, sort: 'relevance', view: 'grid' }, isSaved ? '/saved' : '/');
    }));
    app.querySelector('#export-saved')?.addEventListener('click', () => {
      const records = [...savedIds].map(id => publicRecord(id)).filter(Boolean);
      const requested = downloadJson('LETSUM_Saved_Links_v1.0.json', { schema_version: '1.0', exported_at: new Date().toISOString(), catalog_version: catalog.version, note: '공식 출처 링크 보관 목록입니다. 로고 파일이나 이용 허가를 포함하지 않습니다.', records: records.map(record => ({ id: record.id, name: record.name, organization: record.organization_name, official_url: record.source_url, checked_at: record.review.checked_at })) });
      notify(requested ? `${records.length}개 출처 링크의 JSON 다운로드를 요청했습니다.` : '출처 링크 파일 다운로드를 요청하지 못했습니다. 보관함은 유지됩니다.');
    });
  }

  function colorDots(record) {
    const entry = colors[record.id];
    const list = entry?.official || entry?.extracted || [];
    const swatches = list.filter(color => color.hex).slice(0, 4);
    return swatches.length ? `<div class="biz-colors" title="${entry.official ? '공식 컬러' : '로고 추출 색(비공식)'}">${swatches.map(color => `<span style="--c:${h(color.hex)}"></span>`).join('')}<small>${h(swatches[0].hex)}${entry.official ? '' : ' 추출'}</small></div>` : '';
  }

  function colorGuide(record) {
    const entry = colors[record.id];
    if (!entry) return '';
    const official = Boolean(entry.official?.length);
    const list = official ? entry.official : entry.extracted || [];
    if (!list.length) return '';
    const code = (kind, title, value) => value ? `<div><dt>${title}</dt><dd><button type="button" class="code-copy" data-copy-code="${h(value)}" aria-label="${h(title + ' ' + value)} 복사">${h(value)}</button></dd></div>` : '';
    const rgbValue = color => color.rgb ? `rgb(${color.rgb.split(' ').join(', ')})` : '';
    const sourceLink = official && entry.official_source ? external(entry.official_source, '컬러 가이드 원문', 'text-link') : '';
    return `<section class="detail-section color-guide"><div class="section-heading"><h2>CI 컬러 가이드</h2>${sourceLink}</div>
    <p class="section-intro">${official ? `공식 페이지에 적힌 값을 그대로 옮겼습니다(${h(fmtDate(entry.checked_at))} 확인). 값을 누르면 복사됩니다.` : '공식 페이지에서 색상 코드 표기를 찾지 못해, 로고 이미지에서 대표색을 뽑은 <strong>추출값(비공식)</strong>입니다. 인쇄·제작에는 공식 가이드를 확인해 주세요.'}</p>
    <ul class="color-list">${list.map(color => `<li class="color-item"><span class="color-swatch" style="--c:${h(color.hex || '#ffffff')}"${color.hex ? '' : ' data-empty="true"'}></span><div class="color-meta"><p class="color-name">${h(color.label || (official ? '공식 컬러' : '추출 색'))}${official ? '' : '<span class="color-flag">추출값</span>'}${color.hex_derived ? `<span class="color-flag subtle">${color.hex_derived === 'cmyk' ? 'HEX는 CMYK 환산(근사)' : 'HEX는 RGB 환산'}</span>` : ''}</p><dl>${code('pantone', 'PANTONE', color.pantone)}${code('cmyk', 'CMYK', color.cmyk)}${code('rgb', 'RGB', rgbValue(color))}${code('hex', 'HEX', color.hex)}</dl></div></li>`).join('')}</ul></section>`;
  }

  function detailThumb(record) {
    const thumb = thumbnails[record.id];
    if (!thumb) return '';
    const credit = [thumbSourceLabels[thumb.source] || thumb.source, thumb.license, thumb.author].filter(Boolean).map(h).join(' · ');
    return `<figure class="detail-thumb" data-thumb="${h(thumb.mode)}"${thumb.tone === 'light' ? ' data-tone="light"' : ''}${brandStyle(thumb)}><div class="detail-thumb-frame">${thumbImg(thumb, 'detail', record)}</div><figcaption>식별용 미리보기 · 이미지 ${credit}${thumb.page_url ? ` · <a href="${h(safeUrl(thumb.page_url) || '#')}" target="_blank" rel="noopener noreferrer">이미지 출처</a>` : ''}<br>상표권은 각 권리자에게 있으며, 실제 사용은 공식 출처의 파일과 규정을 따르세요.</figcaption></figure>`;
  }

  function renderDetail(record) {
    const recordSources = record.source_ids.map(id => sourceById.get(id)).filter(Boolean);
    const historical = record.version.status === 'historical';
    const related = visibleRecords.filter(row => row.id !== record.id && row.organization_id === record.organization_id);
    app.innerHTML = `<div class="page-container detail-page" id="main-content" tabindex="-1"><nav class="breadcrumbs" aria-label="현재 위치"><a href="/logos/#/">로고·CI</a><span>/</span>${browse ? `<a href="/logos/#/?group=${h(groupOf(record.id)[0])}">${h(groupLabel(groupOf(record.id)[0]))}</a><span>/</span><a href="/logos/#/?group=${h(groupOf(record.id)[0])}&amp;sub=${h(groupOf(record.id)[1])}">${h(subLabel(...groupOf(record.id)))}</a>` : `<a href="/logos/#/?category=${h(record.category)}">${h(label(categoryLabels, record.category))}</a>`}<span>/</span><span aria-current="page">${h(record.organization_name)}</span></nav>
    ${detailThumb(record)}<section class="detail-heading"><div><p class="eyebrow">${h(categoryAbbreviations[record.category])}</p><h1 id="page-heading">${h(record.name)}</h1>${record.name_en ? `<p class="english-name">${h(record.name_en)}</p>` : ''}<p class="detail-lead">${h(record.summary)}</p><div class="detail-tags"><span class="tag">${h(label(kindLabels, record.kind))}</span>${record.sectors.map(sector => `<span class="tag">${h(label(sectorLabels, sector))}</span>`).join('')}${record.region ? `<span class="tag">${h(record.region)}</span>` : ''}${reviewBadge(record)}</div></div><div class="detail-actions">${external(record.source_url, '공식 출처에서 확인', 'button dark')}<button id="save-${h(record.id)}" type="button" class="button light save-detail" data-save="${h(record.id)}" aria-label="${h(record.name)} 보관하기" aria-pressed="false">${icon('bookmark', 18)} 보관하기</button><button id="copy-source" type="button" class="text-button" data-copy-source="${h(record.source_url)}">${icon('link', 16)} 공식 링크 복사</button></div></section>
    ${historical ? '<div class="notice warning">이전 버전 자료입니다. 실제 제작물에 적용하기 전에 현재 버전을 확인해 주세요.</div>' : ''}${record.review.status === 'needs-review' ? `<div class="notice warning">${surveyed(record) ? '공식 홈페이지를 자동 수집해 만든 정보입니다. 로고·색상·이용 조건은 공식 출처에서 최신 내용을 확인해 주세요.' : '수정 후 재검수가 필요한 정보입니다. 확인일과 이용 조건은 공식 출처에서 다시 확인해 주세요.'}</div>` : ''}
    <div class="detail-layout"><div class="detail-main">${colorGuide(record)}<section class="detail-section"><div class="section-heading"><h2>로고·자료 안내</h2><span>${record.assets.length}개 자료 항목</span></div><p class="section-intro">아래 형식과 접근 조건은 공식 페이지의 안내를 정리한 정보입니다.${downloads[record.id]?.length ? ' 바로 내려받을 수 있는 파일은 형식 배지와 아래 버튼으로 연결했습니다.' : ''}</p>${downloadRow(record)}
    <div class="asset-table-wrap"><table class="asset-table"><thead><tr><th scope="col">자료</th><th scope="col">파일 형식</th><th scope="col">접근 조건</th><th scope="col">확인 범위</th></tr></thead><tbody>${record.assets.length ? record.assets.map(asset => `<tr><th scope="row">${h(asset.label)}<small>${h(label(formLabels, asset.form))}</small></th><td>${asset.listed_formats.length ? asset.listed_formats.map(format => formatBadge(format, record)).join(' ') + '<small>공식 페이지 제공 안내</small>' : '<span class="muted">형식 미확인</span>'}</td><td>${h(accessLabels[asset.access])}</td><td><span class="asset-state">${h({ 'page-listed': '페이지 확인', 'link-checked': '링크 응답 확인', 'file-verified': '원본 파일 확인', 'not-provided': '파일 정보 미확인' }[asset.file_verification])}</span>${asset.file_verification === 'file-verified' ? `<small>${asset.size_bytes.toLocaleString('ko-KR')} bytes · ${h(asset.verified_format)}</small><details class="hash-details"><summary>SHA-256</summary><code>${h(asset.sha256)}</code></details>` : ''}</td></tr>`).join('') : '<tr><td colspan="4">등록된 자료 항목이 없습니다. 공식 출처를 확인해 주세요.</td></tr>'}</tbody></table></div>
    <div class="inline-note">${icon('info', 17)}<p>공식 이미지는 이 서비스에 수록하지 않았습니다. 원본과 세부 사용 규정은 권리자가 제공하는 페이지에서 확인해 주세요.</p></div>
    </section><section class="detail-section"><div class="section-heading"><h2>사용 전에 확인해 주세요</h2>${record.usage.policy_url ? external(record.usage.policy_url, '안내 원문', 'text-link') : ''}</div><p class="policy-summary">${h(record.usage.summary)}</p><dl class="policy-grid"><div><dt>승인 절차</dt><dd>${h(approvalLabels[record.usage.approval])}</dd></div><div><dt>재배포 조건</dt><dd>${h(policyLabels[record.usage.redistribution])}</dd></div><div><dt>미리보기 게시</dt><dd>${h(policyLabels[record.usage.preview])}</dd></div></dl><p class="small-copy">“확인 필요”는 허용을 뜻하지 않습니다. 안내가 있는 경우에도 사용 목적과 적용 범위를 원문에서 확인해 주세요.</p></section>
    <section class="detail-section"><div class="section-heading"><h2>확인한 공식 출처</h2><span>${recordSources.length}개</span></div><ul class="source-list">${recordSources.map(source => `<li><div class="source-title">${external(source.url, source.title, 'text-link')}<span>${h(source.publisher)} · ${h(source.language === 'ko' ? '한국어' : source.language === 'en' ? '영어' : source.language)}</span></div><p>${h(source.observation)}</p><div class="source-foot"><span>${h(fmtDate(source.checked_at))} ${source.scope === 'page' ? '페이지 확인' : '검색 결과 확인'}</span><span>${h(domain(source.url))}</span></div>${source.note ? `<details><summary>확인 범위 메모</summary><p>${h(source.note)}</p></details>` : ''}</li>`).join('')}</ul></section>
    ${record.related_fonts.length ? `<section class="detail-section"><div class="section-heading"><h2>관련 공식 서체</h2></div><p class="section-intro">해당 기관이 공식적으로 제공하는 서체입니다. 로고에 사용된 서체라는 뜻은 아닙니다.</p><div class="related-fonts">${record.related_fonts.map(font => external(font.source_url, font.name, 'font-tile')).join('')}</div></section>` : ''}</div>
    <aside class="detail-sidebar" aria-label="등록 정보"><div class="info-panel"><span class="eyebrow">DIRECTORY NOTE</span><h2>정보 요약</h2><dl class="info-list"><div><dt>기관·기업</dt><dd>${h(record.organization_name)}</dd></div><div><dt>분류</dt><dd>${h(label(categoryLabels, record.category))}</dd></div><div><dt>출처 확인일</dt><dd>${h(fmtDate(record.review.checked_at))}</dd></div><div><dt>버전 상태</dt><dd>${h({ current: '현행 근거 확인', historical: '이전 버전', unconfirmed: '현행 여부 미확인' }[record.version.status])}</dd></div>${record.version.label ? `<div><dt>버전 근거</dt><dd>${h(record.version.label)}</dd></div>` : ''}${record.version.introduced_at ? `<div><dt>도입일</dt><dd>${h(fmtDate(record.version.introduced_at))}</dd></div>` : ''}</dl><a href="/logos/#/guide" class="text-link">확인 상태 읽는 방법 ${icon('right', 16)}</a></div><div class="sidebar-note"><h3>정보가 달라졌나요?</h3><p>새 공식 링크나 변경 내용을 문의 폼으로 알려 주세요.</p><a class="text-link" href="/logos/#/suggest?id=${h(record.id)}">수정 제보 작성 ${icon('right', 16)}</a></div></aside></div>
    ${related.length ? `<section class="related-section"><div class="section-heading"><h2>같은 기관의 다른 아이덴티티</h2></div><div class="brand-grid">${related.map(renderCard).join('')}</div></section>` : ''}<a href="/logos/#/" class="back-link">${icon('back', 17)} 전체 로고·CI 보기</a></div>`;
    document.title = `${record.name} · 공식 출처와 사용 안내 | LETSUM 로고`;
    app.querySelector('[data-copy-source]')?.addEventListener('click', event => copyText(event.currentTarget.dataset.copySource, '공식 출처 링크를 복사했습니다.'));
    app.querySelectorAll('[data-copy-code]').forEach(button => button.addEventListener('click', () => copyText(button.dataset.copyCode, `${button.dataset.copyCode} 복사했습니다.`, '색상 코드 복사', '복사할 색상 코드')));
  }

  function renderGuide() {
    app.innerHTML = `<div class="page-container guide-page" id="main-content" tabindex="-1"><section class="text-hero"><p class="eyebrow">HOW TO USE</p><h1 id="page-heading">출처부터 확인하는<br>로고 찾기<span class="accent-dot">.</span></h1><p>필요한 파일을 찾는 일과 이용 조건을 확인하는 일.<br>LETSUM 로고에서 함께 살펴보세요.</p></section><div class="guide-grid"><section class="guide-card"><span class="step-number">01</span><h2>기관과 브랜드 찾기</h2><p>기관명·영문명·별칭·초성으로 검색할 수 있습니다. 공공기관, 대학, 기업 등 기관 유형과 분야·형식·지역을 함께 좁혀보세요.</p><code>고양시 AI</code><code>ㄱㅇ</code><code>MIT</code></section><section class="guide-card"><span class="step-number">02</span><h2>자료와 조건 확인하기</h2><p>공식 페이지에 어떤 형식이 안내되어 있는지, 로그인이 필요한지, 별도 승인이 있는지 상세정보에서 확인합니다.</p><span class="example-badge">AI · 제공 안내</span><span class="example-badge">조건별 승인 안내</span></section><section class="guide-card"><span class="step-number">03</span><h2>공식 출처로 이동하기</h2><p>원본 파일은 권리자가 제공하는 공식 페이지에서 확인합니다. 자주 찾는 출처는 보관하고 링크 목록을 파일로 저장할 수 있습니다.</p><span class="guide-cta">공식 출처에서 확인 ${icon('arrow', 17)}</span></section></div>
    <section class="guide-section"><h2>각 확인 상태는 서로 다른 의미입니다</h2><div class="guide-table-wrap"><table class="guide-table"><thead><tr><th scope="col">표시</th><th scope="col">확인한 내용</th><th scope="col">별도로 확인할 내용</th></tr></thead><tbody><tr><th scope="row">출처 페이지 확인</th><td>출처 페이지의 본문을 읽고 기록했습니다.</td><td>파일 다운로드, 현행 버전, 이용 허가</td></tr><tr><th scope="row">검색 결과 확인</th><td>공식 출처에 관한 검색 결과 범위만 확인했습니다.</td><td>페이지 본문 전체, 파일 다운로드, 현행 버전, 이용 허가</td></tr><tr><th scope="row">AI·SVG·PNG 등 제공 안내</th><td>공식 페이지에 해당 형식이 안내되어 있습니다.</td><td>실제 파일 형식·용량·무결성</td></tr><tr><th scope="row">링크 응답 확인</th><td>연결 대상의 응답을 확인했습니다.</td><td>파일 내용과 사용 조건</td></tr><tr><th scope="row">원본 파일 확인</th><td>파일 형식·용량·SHA-256을 기록했습니다.</td><td>사용 목적에 맞는 이용 허가</td></tr><tr><th scope="row">재검수 필요</th><td>정보가 바뀌어 다시 확인해야 합니다.</td><td>새 출처와 안내 내용 전체</td></tr><tr><th scope="row">현행 여부 미확인</th><td>현행 로고임을 명시하는 근거를 아직 확인하지 못했습니다.</td><td>적용하려는 버전의 유효성</td></tr></tbody></table></div></section>
    <div class="guide-two-column"><section class="guide-section"><h2>기관 유형과 분야를 나눕니다</h2><p>대학은 설립 주체와 관계없이 대학·학교에서 찾습니다. 기업이 운영하는 서비스나 도시 브랜드는 운영 기관에 연결된 별도 아이덴티티로 기록합니다.</p><p>의료·관광·문화 같은 분야는 필터입니다. 기관 수와 아이덴티티 정보 수를 따로 세어 중복을 구분합니다.</p><div class="category-reference">${taxonomy.categories.map(item => `<span>${h(item.label)}</span>`).join('')}</div></section><section class="guide-section"><h2>이미지와 파일을 제공하는 기준</h2><p>현재 자료에는 로고 원본과 썸네일을 포함하지 않았습니다. 카드에는 검색을 위한 기관 이름을 표시합니다.</p><p>이후 미리보기나 파일을 추가할 때는 해당 사용 범위의 근거와 확인일을 별도로 기록합니다. 일반적인 사이트 하단 저작권 문구만으로 로고 이용 조건을 판단하지 않습니다.</p><p>관련 서체는 해당 기관이 공식적으로 배포하는 자료만 연결하며, 로고 적용 서체로 단정하지 않습니다.</p></section></div>
    <section class="notice guide-local"><div>${icon('folder', 24)}</div><div><h2>보관함과 링크 제보 안내</h2><p>보관함은 현재 브라우저의 로컬 저장 공간을 사용합니다. 브라우저 데이터 삭제 또는 다른 기기에서는 목록이 유지되지 않을 수 있으므로 필요한 목록은 파일로 저장해 주세요.</p><p>링크 제보는 광고제휴 및 문의 폼으로 보내 주세요. 운영자가 공식 출처와 이용 조건을 확인한 뒤 반영합니다.</p></div></section><div class="guide-bottom"><a class="button dark" href="/logos/#/">로고 찾아보기 ${icon('right', 18)}</a><span>데이터 버전 ${h(catalog.version)} · ${h(fmtDate(catalog.updated_at))}</span></div></div>`;
    document.title = '이용안내 · 정보 확인 기준 | LETSUM 로고';
  }

  function renderSuggest(params) {
    const record = publicRecord(params.get('id'));
    app.innerHTML = `<div class="page-container suggest-page" id="main-content" tabindex="-1"><a class="back-link" href="${record ? h(detailHref(record.id)) : '#/'}">${icon('back', 17)} ${record ? '상세정보로 돌아가기' : '로고 찾기로 돌아가기'}</a><section class="text-hero"><p class="eyebrow">CONTRIBUTE</p><h1 id="page-heading">공식 링크를 알려주세요<span class="accent-dot">.</span></h1><p>빠진 기관이나 바뀐 정보를 검수용 파일로 정리합니다.</p></section><div class="suggest-layout"><form id="suggest-form" class="form-panel"><label>기관·브랜드 이름 <span class="required">필수</span><input name="name" type="text" required maxlength="160" value="${h(record?.organization_name || '')}" autocomplete="organization" placeholder="예: 고양특례시"></label><label>공식 페이지 주소 <span class="required">필수</span><input name="source_url" type="url" required maxlength="2000" value="${h(record?.source_url || '')}" placeholder="https://" inputmode="url"><span class="field-help">기관·기업이 운영하는 로고·CI·브랜드 안내 페이지를 입력해 주세요.</span></label><label>기관 유형<select name="category"><option value="">선택 안 함</option>${taxonomy.categories.map(item => `<option value="${h(item.id)}"${record?.category === item.id ? ' selected' : ''}>${h(item.label)}</option>`).join('')}</select></label><label>확인할 내용 <span class="required">필수</span><textarea name="note" required maxlength="3000" rows="5" placeholder="추가할 로고, 바뀐 링크, 변경된 사용 안내 등을 적어주세요."></textarea></label><p id="suggest-error" class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="button dark">${icon('download', 18)} 제보 파일 저장</button></div><p class="small-copy">JSON 파일을 생성합니다. 이 화면에서는 서버에 제출되지 않습니다.</p></form><aside class="suggest-note"><div class="note-icon">${icon('link', 24)}</div><h2>확인 가능한 출처가<br>좋은 정보의 시작입니다.</h2><p>로고 원본 파일 대신 공식 페이지 주소를 알려주세요. 자료를 추가할 때 제공 형식과 사용 조건을 함께 확인할 수 있습니다.</p><h3>이렇게 작성하면 좋습니다</h3><ul><li>바뀐 공식 페이지 주소</li><li>로고·CI·도시 브랜드 구분</li><li>공식 페이지에서 확인한 변경 내용</li></ul><p class="small-copy">불필요한 개인정보는 입력하지 마세요.</p></aside></div></div>`;
    document.title = '공식 링크 제보 작성 | LETSUM 로고';
    app.querySelector('#suggest-form').addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      const officialUrl = safeUrl(String(values.get('source_url')).trim());
      const name = String(values.get('name')).trim();
      const note = String(values.get('note')).trim();
      const error = app.querySelector('#suggest-error');
      if (!officialUrl || !name || !note) { error.textContent = '기관 이름, 올바른 HTTP(S) 공식 주소, 확인할 내용을 모두 입력해 주세요.'; return; }
      error.textContent = '';
      const requested = downloadJson(`LETSUM_Link_Suggestion_${new Date().toISOString().slice(0, 10)}.json`, { schema_version: '1.0', type: 'source-suggestion', created_at: new Date().toISOString(), record_id: record?.id || null, organization_name: name, source_url: officialUrl, category: values.get('category') || null, note, status: 'unreviewed' });
      if (!requested) error.textContent = '제보 파일 다운로드를 요청하지 못했습니다. 입력 내용은 유지됩니다.';
      notify(requested ? '제보 파일 다운로드를 요청했습니다. 서버에 제출되거나 운영 데이터에 반영되지 않습니다.' : '제보 파일 다운로드를 요청하지 못했습니다. 브라우저 설정을 확인해 주세요.');
    });
  }

  function renderNotFound() {
    app.innerHTML = `<div class="page-container" id="main-content" tabindex="-1"><div class="empty-state not-found"><p class="eyebrow">NOT FOUND</p><h1 id="page-heading">자료를 찾을 수 없습니다.</h1><p>등록된 아이덴티티인지 검색으로 확인해 주세요.</p><a class="button dark" href="/logos/#/">로고 찾아보기</a></div></div>`;
    document.title = '자료를 찾을 수 없습니다 | LETSUM 로고';
  }

  function downloadJson(filename, data) {
    let url = null;
    let anchor = null;
    try {
      const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
      url = URL.createObjectURL(blob);
      anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; anchor.hidden = true;
      document.body.append(anchor); anchor.click();
      return true;
    } catch { return false; }
    finally {
      anchor?.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }

  async function copyText(value, success, title = '공식 링크 복사', fieldLabel = '복사할 공식 주소') {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); notify(success); return; }
    } catch { /* Fall through to a visible, selectable text field. */ }
    const existing = document.querySelector('#copy-dialog');
    existing?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'copy-dialog'; dialog.className = 'copy-dialog';
    dialog.innerHTML = `<form method="dialog"><h2>${h(title)}</h2><p>아래 값을 선택해 복사해 주세요.</p><label class="sr-only" for="copy-value">${h(fieldLabel)}</label><input id="copy-value" readonly><button class="button dark" value="close">닫기</button></form>`;
    document.body.append(dialog); dialog.querySelector('input').value = value;
    dialog.addEventListener('close', () => dialog.remove()); dialog.showModal();
    dialog.querySelector('input').focus(); dialog.querySelector('input').select();
  }

  function renderRoute(options = {}) {
    if (typeof cleanupRoute === 'function') cleanupRoute();
    cleanupRoute = null;
    const { path, params } = routeInfo();
    const activeElement = document.activeElement;
    const previousFocus = activeElement?.id || null;
    const selection = activeElement instanceof HTMLInputElement ? [activeElement.selectionStart, activeElement.selectionEnd] : null;
    const changedPage = Boolean(lastPath && lastPath !== path);
    document.querySelectorAll('[data-nav]').forEach(nav => {
      const active = nav.dataset.nav === (path === '/saved' ? 'saved' : path === '/guide' ? 'guide' : path === '/' || path.startsWith('/brand/') ? 'search' : '');
      if (active) nav.setAttribute('aria-current', 'page'); else nav.removeAttribute('aria-current');
    });
    if (path === '/' || path === '/saved') renderDirectory(path === '/saved', params);
    else if (path.startsWith('/brand/')) {
      let id = ''; try { id = decodeURIComponent(path.slice('/brand/'.length)); } catch { /* invalid path */ }
      const record = publicRecord(id); if (record) renderDetail(record); else renderNotFound();
    } else if (path === '/guide') renderGuide();
    else if (path === '/suggest') { if (boot.production) location.replace('/contact.html'); else renderSuggest(params); }
    else if (path === '/review' && !boot.production) {
      app.innerHTML = `<div class="page-container review-page" id="main-content" tabindex="-1">${renderReview({catalog, sources, taxonomy, catalogSha256})}</div>`;
      cleanupRoute = bindReview({ root: app, catalog, sources, taxonomy, catalogSha256, notify });
      document.title = '로컬 검수 도구 | LETSUM 로고';
    } else renderNotFound();
    updateSavedUI();
    if (typeof options.focusId === 'string') {
      (document.getElementById(options.focusId) || app.querySelector('#results-heading') || app.querySelector('#main-content'))?.focus({ preventScroll: true });
    } else if (changedPage) { window.scrollTo({top:0, behavior:'instant'}); app.querySelector('#main-content')?.focus({ preventScroll: true }); }
    else if (previousFocus && path === lastPath) {
      const element = document.getElementById(previousFocus) || app.querySelector('#results-heading') || app.querySelector('#main-content');
      element?.focus({ preventScroll: true });
      if (selection && element instanceof HTMLInputElement && ['text', 'search'].includes(element.type)) { try { element.setSelectionRange(...selection); } catch { /* not supported for this input */ } }
    }
    lastPath = path;
  }

  app.addEventListener('click', event => {
    const save = event.target?.closest?.('[data-save]');
    if (!save || !publicRecord(save.dataset.save)) return;
    const id = save.dataset.save;
    const visibleSaveButtons = [...app.querySelectorAll('[data-save]')];
    const nextSaveButton = visibleSaveButtons[visibleSaveButtons.indexOf(save) + 1];
    const nextSaveFocusId = nextSaveButton?.id || 'results-heading';
    const removed = savedIds.delete(id);
    if (!removed) savedIds.add(id);
    saveBookmarks(); updateSavedUI(id);
    if (routeInfo().path === '/saved') renderRoute({ focusId: removed ? nextSaveFocusId : `save-${id}` });
    notify(`${removed ? '보관함에서 해제했습니다.' : '보관함에 저장했습니다.'}${storageAvailable ? '' : ' 현재 탭에서만 유지됩니다.'}`);
  });
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    try { const parsed = JSON.parse(event.newValue || '[]'); if (Array.isArray(parsed)) savedIds = new Set(parsed.filter(id => typeof id === 'string' && publicRecordIds.has(id))); }
    catch { return; }
    updateSavedUI(); if (routeInfo().path === '/saved') renderRoute();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    const input = app.querySelector('#logo-query');
    if (input) { event.preventDefault(); input.focus(); }
  });
  document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); app.querySelector('#main-content')?.focus(); });
  renderRoute();
})();
