// Public entries contain only the verdict and catalog references. Timestamps come from the server.
(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const finder = get('image-finder'), board = get('im-board'), list = get('im-board-list');
  const refresh = get('im-board-refresh'), more = get('im-board-more'), state = get('im-board-state');
  const publish = get('im-publish'), postState = get('im-publish-state'), retry = get('im-publish-retry');
  let nextBefore = null, listVersion = 0, attempted = false;
  let currentPost = null, namesPromise;

  async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {...options, credentials: 'omit', signal: controller.signal});
      if (!response.ok) throw Object.assign(Error('Request failed'), {status: response.status});
      return await response.json();
    } finally { clearTimeout(timeout); }
  }

  async function fontNames() {
    if (!namesPromise) {
      namesPromise = window.ImageFontIndex.catalog()
        .then(rows => new Map(rows.map(row => [row.id, row.name])))
        .catch(error => { namesPromise = null; throw error; });
    }
    return namesPromise;
  }

  function dateFormat() {
    return new Intl.DateTimeFormat(document.documentElement.lang === 'en' ? 'en' : 'ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  }

  function renderEntry(entry, names, formatter) {
    const item = document.createElement('li');
    item.dataset.id = String(entry.id);
    const meta = document.createElement('div'), timestamp = document.createElement('time');
    meta.className = 'im-board-meta';
    timestamp.dateTime = entry.createdAt;
    timestamp.translate = false;
    timestamp.textContent = formatter.format(new Date(entry.createdAt));
    const verdict = document.createElement('strong');
    verdict.textContent = entry.confidence === 'high' ? '원본 후보 있음' : '판별 어려움 · 닮은 무료 폰트';
    meta.append(timestamp, verdict);

    const ranks = document.createElement('ol');
    ranks.className = 'im-board-ranks';
    for (const {id, weight} of entry.candidates) {
      if (!/^[a-z0-9-]+$/.test(id)) continue;
      const candidate = document.createElement('li'), link = document.createElement('a');
      link.href = '/font/' + id + '.html';
      link.textContent = names.get(id) || id;
      link.translate = false;
      const weightTag = document.createElement('small'), label = document.createElement('span');
      label.textContent = '굵기';
      weightTag.append(label, ' ' + weight);
      candidate.append(link, ' ', weightTag);
      ranks.append(candidate);
    }
    item.append(meta, ranks);
    return item;
  }

  async function load(before = null) {
    attempted = true;
    const version = ++listVersion;
    refresh.disabled = more.disabled = true;
    list.setAttribute('aria-busy', 'true');
    state.textContent = '기록을 불러오는 중입니다.';
    try {
      const url = before ? '/api/scan-board?before=' + before : '/api/scan-board';
      const {entries, nextBefore: cursor} = await requestJson(url, {cache: 'no-store'});
      const names = entries.length ? await fontNames() : null;
      if (version !== listVersion) return;
      const batch = document.createDocumentFragment(), formatter = dateFormat();
      const seen = new Set(before ? Array.from(list.children, item => item.dataset.id) : []);
      for (const entry of entries) {
        if (!seen.has(String(entry.id))) batch.append(renderEntry(entry, names, formatter));
        seen.add(String(entry.id));
      }
      if (before) list.append(batch);
      else list.replaceChildren(batch);
      nextBefore = Number.isSafeInteger(cursor) && cursor > 0 ? cursor : null;
      more.hidden = nextBefore === null;
      state.textContent = list.childElementCount ? '' : '아직 공개된 판별 기록이 없습니다.';
    } catch {
      if (version === listVersion) state.textContent = '기록을 불러오지 못했습니다. 다시 시도해 주세요.';
    } finally {
      if (version === listVersion) {
        refresh.disabled = more.disabled = false;
        list.setAttribute('aria-busy', 'false');
      }
    }
  }

  function whenVisible() {
    if (finder.open && board.open && !attempted) load();
  }
  function openLinkedBoard() {
    if (location.hash !== '#im-board') return;
    finder.open = board.open = true;
    requestAnimationFrame(() => board.scrollIntoView({block: 'start'}));
  }
  finder.addEventListener('toggle', whenVisible);
  board.addEventListener('toggle', whenVisible);
  window.addEventListener('hashchange', openLinkedBoard);
  document.addEventListener('ls:ui-language', () => {
    const formatter = dateFormat();
    for (const time of list.querySelectorAll('time')) time.textContent = formatter.format(new Date(time.dateTime));
  });
  refresh.onclick = () => load();
  more.onclick = () => { if (nextBefore) load(nextBefore); };
  openLinkedBoard();
  whenVisible();

  function reset() {
    currentPost = null;
    postState.textContent = '';
    retry.hidden = true;
  }

  async function submit(job) {
    if (!publish.checked || job !== currentPost || job.sending) return;
    job.sending = true;
    retry.hidden = true;
    postState.textContent = '공개 게시판에 기록하고 있습니다.';
    try {
      const data = await requestJson('/api/scan-board', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(job.payload)
      });
      if (!Number.isSafeInteger(data.entry?.id)) throw Error('Missing entry');
      if (job === currentPost) {
        postState.textContent = '공개 게시판에 기록했습니다.';
        currentPost = null;
        board.open = true;
      }
      if (finder.open && board.open) load();
    } catch (error) {
      if (job !== currentPost) return;
      const limited = error.status === 429;
      postState.textContent = limited
        ? '등록 요청이 많습니다. 잠시 후 다시 시도해 주세요.'
        : '공개 기록 등록을 확인하지 못했습니다.';
      retry.hidden = !!error.status && error.status < 500 && !limited && error.status !== 408;
    } finally { job.sending = false; }
  }

  function record(matches, confident) {
    if (!publish.checked || !matches.length) return;
    if (typeof window.crypto?.randomUUID !== 'function') {
      postState.textContent = '공개 기록 등록을 확인하지 못했습니다.';
      return;
    }
    const candidates = matches.slice(0, 3).map(({row, weight}) => ({id: row.id, weight}));
    currentPost = {sending: false, payload: {
      requestId: crypto.randomUUID(), confidence: confident ? 'high' : 'low', candidates
    }};
    return submit(currentPost);
  }

  retry.onclick = () => { if (currentPost) submit(currentPost); };
  publish.onchange = () => { if (!publish.checked) reset(); };
  window.ImageFontBoard = {record, reset};
})();
