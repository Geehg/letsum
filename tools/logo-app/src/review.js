import { escapeHtml, safeUrl, normalizeText } from './core.js';

const reviewStatusLabels = {
  'source-reviewed': '출처 검토됨',
  'needs-review': '재검수 필요',
  draft: '초안',
  archived: '보관됨'
};
const reviewRightsLabels = {
  permitted: '허용 근거 있음', conditional: '조건 있음', restricted: '제한됨',
  unknown: '미확인', required: '승인 필요', 'not-stated': '별도 명시 확인 안 됨'
};
const reviewFileLabels = {
  'page-listed': '페이지의 제공 안내만 확인',
  'link-checked': '링크 확인',
  'file-verified': '파일 검사 완료',
  'not-provided': '파일 제공 확인 안 됨'
};
const reviewEditableKeys = [
  'name', 'name_en', 'aliases', 'category', 'kind', 'sectors', 'country',
  'region', 'summary', 'source_url', 'guideline_url', 'usage_summary'
];
const reviewFieldLabels = {
  name: '표시 이름', name_en: '영문 이름', aliases: '검색 별칭', category: '기관 분류',
  kind: '브랜드 종류', sectors: '분야', country: '국가 코드', region: '지역',
  summary: '소개', source_url: '공식 자료 URL', guideline_url: '가이드 URL',
  usage_summary: '사용 조건 요약'
};
const reviewBindings = new WeakMap();

function reviewText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function reviewLabel(items, value) {
  return (Array.isArray(items) ? items : []).find(item => item.id === value)?.label || reviewText(value);
}

function reviewBaseFields(record) {
  return {
    name: reviewText(record.name),
    name_en: record.name_en ?? null,
    aliases: Array.isArray(record.aliases) ? [...record.aliases] : [],
    category: reviewText(record.category),
    kind: reviewText(record.kind),
    sectors: Array.isArray(record.sectors) ? [...record.sectors] : [],
    country: record.country ?? null,
    region: record.region ?? null,
    summary: reviewText(record.summary),
    source_url: reviewText(record.source_url),
    guideline_url: record.guideline_url ?? null,
    usage_summary: reviewText(record.usage?.summary)
  };
}

function reviewEqual(field, left, right) {
  if (field === 'sectors') {
    return JSON.stringify([...new Set(left || [])].sort()) === JSON.stringify([...new Set(right || [])].sort());
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function reviewChangedFields(state, record) {
  const draft = state.drafts.get(record.id);
  if (!draft) return [];
  const base = reviewBaseFields(record);
  return reviewEditableKeys.filter(key => !reviewEqual(key, base[key], draft.fields[key]));
}

function reviewFields(state, record) {
  return state.drafts.get(record.id)?.fields || reviewBaseFields(record);
}

function reviewChanges(state, record) {
  const fields = reviewFields(state, record);
  const changes = {};
  for (const field of reviewChangedFields(state, record)) {
    if (field === 'usage_summary') changes.usage = { summary: fields[field] };
    else changes[field] = Array.isArray(fields[field]) ? [...fields[field]] : fields[field];
  }
  return changes;
}

function reviewMakeState({ catalog, sources, taxonomy, catalogSha256 }) {
  const snapshot = JSON.parse(JSON.stringify(catalog || { version: '', records: [] }));
  const records = Array.isArray(snapshot.records) ? snapshot.records : [];
  return {
    catalog: snapshot,
    records,
    byId: new Map(records.map(record => [record.id, record])),
    sources: Array.isArray(sources?.sources) ? sources.sources : [],
    taxonomy: taxonomy || {},
    hash: /^[a-f0-9]{64}$/i.test(reviewText(catalogSha256)) ? catalogSha256.toLowerCase() : null,
    drafts: new Map(),
    selectedId: records[0]?.id || null,
    query: '',
    filter: 'all',
    storageMode: 'memory',
    storageWarning: '',
    lastExportMessage: ''
  };
}

function reviewStorageKey(state) {
  return state.hash ? `letsum-logo:review:1:${state.hash}` : null;
}

function reviewStorageChoices() {
  const choices = [];
  if (typeof window === 'undefined') return choices;
  for (const [name, property] of [['local', 'localStorage'], ['session', 'sessionStorage']]) {
    try {
      const storage = window[property];
      if (storage) choices.push({ name, storage });
    } catch { /* Restricted browser storage is handled by the visible fallback. */ }
  }
  return choices;
}

function reviewRestoreFields(record, saved) {
  const fields = reviewBaseFields(record);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return fields;
  for (const key of reviewEditableKeys) {
    if (!Object.prototype.hasOwnProperty.call(saved, key)) continue;
    const value = saved[key];
    if (key === 'aliases' || key === 'sectors') {
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) fields[key] = [...value];
    } else if (['name_en', 'country', 'region', 'guideline_url'].includes(key)) {
      if (value === null || typeof value === 'string') fields[key] = value;
    } else if (typeof value === 'string') fields[key] = value;
  }
  return fields;
}

function reviewLoadDrafts(state) {
  const key = reviewStorageKey(state);
  if (!key) {
    state.storageWarning = '원본 SHA-256이 없어 초안은 현재 화면에만 보관됩니다. 빌드된 검수 페이지에서 내보내기를 사용할 수 있습니다.';
    return;
  }
  const candidates = [];
  for (const choice of reviewStorageChoices()) {
    try {
      const raw = choice.storage.getItem(key);
      if (!raw) continue;
      const saved = JSON.parse(raw);
      if (saved.base_sha256 !== state.hash || saved.dataset_version !== state.catalog.version || !Array.isArray(saved.entries)) continue;
      candidates.push({ ...choice, saved });
    } catch {
      state.storageWarning = '이 브라우저의 일부 저장된 초안을 읽지 못했습니다. 원본 데이터는 변경되지 않았습니다.';
    }
  }
  candidates.sort((a, b) => (Date.parse(b.saved.saved_at) || 0) - (Date.parse(a.saved.saved_at) || 0));
  const candidate = candidates[0];
  if (!candidate) return;
  state.storageMode = candidate.name;
  for (const entry of candidate.saved.entries) {
    if (!entry || typeof entry.id !== 'string') continue;
    const record = state.byId.get(entry.id);
    if (!record) continue;
    const fields = reviewRestoreFields(record, entry.fields);
    const note = typeof entry.review_note === 'string' ? entry.review_note.slice(0, 4000) : '';
    state.drafts.set(record.id, { fields, note });
    if (!reviewChangedFields(state, record).length && !note.trim()) state.drafts.delete(record.id);
  }
}

function reviewPersistDrafts(state) {
  const key = reviewStorageKey(state);
  if (!key) return;
  const payload = JSON.stringify({
    schema_version: '1.0',
    dataset_version: state.catalog.version,
    base_sha256: state.hash,
    saved_at: new Date().toISOString(),
    entries: [...state.drafts].map(([id, draft]) => ({ id, fields: draft.fields, review_note: draft.note }))
  });
  for (const choice of reviewStorageChoices()) {
    try {
      choice.storage.setItem(key, payload);
      state.storageMode = choice.name;
      state.storageWarning = '';
      return;
    } catch { /* Try session storage before falling back to this mounted screen. */ }
  }
  state.storageMode = 'memory';
  state.storageWarning = '브라우저 저장소에 초안을 저장하지 못했습니다. 현재 화면을 나가기 전에 수정안을 내보내 주세요.';
}

function reviewStorageMessage(state) {
  if (state.storageWarning) return state.storageWarning;
  if (state.storageMode === 'local') return '초안과 검토 메모를 이 브라우저의 로컬 저장소에 보관합니다. 원본 파일과 서버에는 반영되지 않습니다.';
  if (state.storageMode === 'session') return '초안과 검토 메모를 현재 브라우저 세션에 보관합니다. 탭을 닫기 전에 수정안을 내보내 주세요.';
  return '초안은 현재 화면에 보관 중입니다. 수정 시 브라우저 저장소에 보관을 시도하며, 결과를 이곳에 표시합니다.';
}

function reviewValidate(state, record) {
  const fields = reviewFields(state, record);
  const errors = [];
  if (!fields.name.trim()) errors.push({ field: 'name', message: '표시 이름을 입력해 주세요.' });
  if (!(state.taxonomy.categories || []).some(item => item.id === fields.category)) errors.push({ field: 'category', message: '목록에 있는 기관 분류를 선택해 주세요.' });
  if (!(state.taxonomy.identity_kinds || []).some(item => item.id === fields.kind)) errors.push({ field: 'kind', message: '목록에 있는 브랜드 종류를 선택해 주세요.' });
  const sectorIds = new Set((state.taxonomy.sectors || []).map(item => item.id));
  if (fields.sectors.some(value => !sectorIds.has(value))) errors.push({ field: 'sectors', message: '목록에 있는 분야만 선택해 주세요. 확인하지 못했다면 선택을 비워 둘 수 있습니다.' });
  if (fields.country !== null && !/^[A-Z]{2}$/.test(fields.country)) errors.push({ field: 'country', message: '국가 코드는 영문 대문자 2자리로 입력하거나 비워 주세요.' });
  if (!fields.summary.trim()) errors.push({ field: 'summary', message: '소개를 입력해 주세요.' });
  if (!safeUrl(fields.source_url)) errors.push({ field: 'source_url', message: '공식 자료 URL은 사용자 정보가 없는 http 또는 https 주소로 입력해 주세요.' });
  if (fields.guideline_url !== null && !safeUrl(fields.guideline_url)) errors.push({ field: 'guideline_url', message: '가이드 URL은 유효한 http 또는 https 주소로 입력하거나 비워 주세요.' });
  if (!fields.usage_summary.trim()) errors.push({ field: 'usage_summary', message: '사용 조건 요약을 입력해 주세요. 확인되지 않은 조건은 미확인으로 적어 주세요.' });
  return errors;
}

function reviewMatchingRecords(state) {
  const query = normalizeText(state.query);
  return state.records.filter(record => {
    if (state.filter === 'local' && !state.drafts.has(record.id)) return false;
    if (!['all', 'local'].includes(state.filter) && record.review?.status !== state.filter) return false;
    if (!query) return true;
    const fields = reviewFields(state, record);
    const haystack = normalizeText([record.id, record.organization_name, fields.name, fields.name_en, ...fields.aliases].filter(Boolean).join(' '));
    return query.split(' ').filter(Boolean).every(token => haystack.includes(token));
  });
}

function reviewBadge(status) {
  return `<span class="review-badge review-badge--${escapeHtml(status)}">${escapeHtml(reviewStatusLabels[status] || status)}</span>`;
}

function reviewRenderList(state) {
  const matches = reviewMatchingRecords(state);
  if (!matches.length) return '<p class="review-empty">조건에 맞는 항목이 없습니다.</p>';
  return `<ul class="review-record-list">${matches.map(record => {
    const changed = reviewChangedFields(state, record).length > 0;
    const draft = state.drafts.get(record.id);
    return `<li><button type="button" class="review-record-button" data-select-record="${escapeHtml(record.id)}" aria-pressed="${record.id === state.selectedId}">
      <span class="review-record-name">${escapeHtml(reviewFields(state, record).name || '(이름 입력 중)')}</span>
      <span class="review-record-org">${escapeHtml(record.organization_name)}</span>
      <span class="review-record-flags">${reviewBadge(changed ? 'needs-review' : (record.review?.status || 'draft'))}${draft ? `<span class="review-local-mark">${changed ? '수정 초안' : '검토 메모'}</span>` : ''}</span>
    </button></li>`;
  }).join('')}</ul>`;
}

function reviewOptionList(items, selected) {
  return (items || []).map(item => `<option value="${escapeHtml(item.id)}"${item.id === selected ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
}

function reviewInput(field, value, { label = reviewFieldLabels[field], type = 'text', hint = '', wide = false, required = false, maxlength = null } = {}) {
  return `<div class="review-field${wide ? ' review-field--wide' : ''}">
    <label for="review-field-${field}">${escapeHtml(label)}${required ? '<span class="review-required"> 필수</span>' : ''}</label>
    <input id="review-field-${field}" name="${field}" type="${type}" value="${escapeHtml(reviewText(value))}" autocomplete="off"${required ? ' required' : ''}${maxlength ? ` maxlength="${maxlength}"` : ''}${hint ? ` aria-describedby="review-hint-${field}"` : ''}>
    ${hint ? `<p class="review-hint" id="review-hint-${field}">${escapeHtml(hint)}</p>` : ''}
  </div>`;
}

function reviewTextarea(field, value, { label = reviewFieldLabels[field], hint = '', rows = 3, required = false, maxlength = null } = {}) {
  return `<div class="review-field review-field--wide">
    <label for="review-field-${field}">${escapeHtml(label)}${required ? '<span class="review-required"> 필수</span>' : ''}</label>
    <textarea id="review-field-${field}" name="${field}" rows="${rows}"${required ? ' required' : ''}${maxlength ? ` maxlength="${maxlength}"` : ''}${hint ? ` aria-describedby="review-hint-${field}"` : ''}>${escapeHtml(reviewText(value))}</textarea>
    ${hint ? `<p class="review-hint" id="review-hint-${field}">${escapeHtml(hint)}</p>` : ''}
  </div>`;
}

function reviewSafeLink(url, label) {
  const safe = safeUrl(url);
  if (!safe) return '<span class="review-muted">유효한 링크 없음</span>';
  return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || safe)}<span class="review-external"> ↗<span class="review-sr-only"> 새 탭</span></span></a>`;
}

function reviewValue(value, field, state) {
  if (value === null || value === undefined || value === '') return '미기재';
  if (field === 'category') return reviewLabel(state.taxonomy.categories, value);
  if (field === 'kind') return reviewLabel(state.taxonomy.identity_kinds, value);
  if (field === 'sectors') return value.map(id => reviewLabel(state.taxonomy.sectors, id)).join(', ') || '미기재';
  if (Array.isArray(value)) return value.length ? value.join('\n') : '없음';
  return reviewText(value);
}

function reviewRenderDiff(state, record) {
  const changed = reviewChangedFields(state, record);
  const draft = state.drafts.get(record.id);
  if (!changed.length) return `<p class="review-empty">${draft?.note.trim() ? '레코드 값 변경 없이 검토 메모만 있습니다. 메모만 적용하면 원본 검수 상태를 유지합니다.' : '아직 원본과 다른 값이 없습니다.'}</p>`;
  const base = reviewBaseFields(record);
  const fields = reviewFields(state, record);
  return `<p class="review-invalidation"><strong>적용 후 재검수 필요</strong> · 검수 날짜와 검수 범위는 비워집니다. 기존 출처 검토 결과를 수정값에 승계하지 않습니다.${record.version?.status === 'current' ? ' 기존 현행 확인 상태도 현행 여부 미확인으로 전환됩니다.' : ''}</p>
    <div class="review-table-scroll"><table class="review-diff-table"><caption class="review-sr-only">원본과 수정안의 필드별 비교</caption><thead><tr><th scope="col">필드</th><th scope="col">원본</th><th scope="col">수정안</th></tr></thead><tbody>
    ${changed.map(field => `<tr><th scope="row">${escapeHtml(reviewFieldLabels[field])}</th><td><pre>${escapeHtml(reviewValue(base[field], field, state))}</pre></td><td><pre>${escapeHtml(reviewValue(fields[field], field, state))}</pre></td></tr>`).join('')}
    <tr><th scope="row">검수 상태</th><td>${escapeHtml(reviewStatusLabels[record.review?.status] || '미확인')}<br><span class="review-muted">${escapeHtml(record.review?.checked_at || '날짜 없음')}</span></td><td>재검수 필요<br><span class="review-muted">checked_at / source_scope = null</span></td></tr>
    ${record.version?.status === 'current' ? '<tr><th scope="row">현행 확인 상태</th><td>현행 근거 확인</td><td>현행 여부 미확인<br><span class="review-muted">current → unconfirmed</span></td></tr>' : ''}
    </tbody></table></div>`;
}

function reviewRenderValidation(state, record) {
  const errors = reviewValidate(state, record);
  if (!errors.length) return '<p class="review-validation-ok">입력 형식 검사 통과 · 사실·권리·출처 검증을 뜻하지 않습니다.</p>';
  return `<div class="review-validation-errors"><p><strong>내보내기 전 확인할 입력 ${errors.length}개</strong></p><ul>${errors.map(error => `<li><button type="button" class="review-text-button" data-focus-field="${error.field}">${escapeHtml(error.message)}</button></li>`).join('')}</ul></div>`;
}

function reviewRenderEvidence(state, record) {
  const sourceIds = new Set(record.source_ids || []);
  const sources = state.sources.filter(source => sourceIds.has(source.id));
  const sharedLinks = sources.map(source => reviewSafeLink(source.url, source.title)).join('<br>') || '<span class="review-muted">연결된 출처 없음</span>';
  const changed = new Set(reviewChangedFields(state, record));
  const base = reviewBaseFields(record);
  const evidenceRows = [
    { label: '이름·영문·별칭', fields: ['name', 'name_en', 'aliases'], value: [base.name, base.name_en, base.aliases.join(', ')].filter(Boolean).join(' / '), links: sharedLinks },
    { label: '기관 분류·브랜드 종류·분야', fields: ['category', 'kind', 'sectors'], value: [reviewValue(base.category, 'category', state), reviewValue(base.kind, 'kind', state), reviewValue(base.sectors, 'sectors', state)].join(' / '), links: sharedLinks },
    { label: '국가·지역', fields: ['country', 'region'], value: [base.country, base.region].filter(Boolean).join(' / ') || '미기재', links: sharedLinks },
    { label: '소개', fields: ['summary'], value: base.summary, links: sharedLinks },
    { label: '공식 자료 URL', fields: ['source_url'], value: base.source_url, links: reviewSafeLink(base.source_url, '원본 공식 자료 페이지') },
    { label: '가이드 URL', fields: ['guideline_url'], value: base.guideline_url || '미기재', links: reviewSafeLink(base.guideline_url, '원본 가이드 페이지') },
    { label: '사용 조건 요약', fields: ['usage_summary'], value: base.usage_summary, links: reviewSafeLink(record.usage?.policy_url, '원본 정책 페이지') }
  ];
  return `<p class="review-hint">아래는 원본 레코드에 연결된 공통 출처입니다. 이 데이터에는 필드별 독립 검증 결과가 없으므로 각 필드의 근거로 직접 대조해 주세요. 새 URL이나 조건을 입력해도 기존 출처 연결이 자동 검증되지는 않습니다.</p>
    <div class="review-table-scroll"><table class="review-evidence-table"><caption class="review-sr-only">필드별 원본 값과 대조할 출처</caption><thead><tr><th scope="col">필드</th><th scope="col">원본 값</th><th scope="col">대조할 근거</th></tr></thead><tbody>${evidenceRows.map(row => `<tr><th scope="row">${escapeHtml(row.label)}${row.fields.some(field => changed.has(field)) ? '<span class="review-evidence-pending">수정안 재검수 필요</span>' : ''}</th><td>${escapeHtml(row.value)}</td><td>${row.links}<span class="review-evidence-scope">해당 필드와의 일치 여부 확인 필요</span></td></tr>`).join('')}</tbody></table></div>
    <div class="review-source-cards">${sources.map(source => `<article class="review-source-card"><h4>${reviewSafeLink(source.url, source.title)}</h4><p class="review-source-meta">${escapeHtml(source.publisher || '발행처 미기재')} · ${source.scope === 'page' ? '본문 열람' : source.scope === 'search' ? '검색 결과 확인' : '확인 범위 미기재'} · ${escapeHtml(source.checked_at || '확인 날짜 없음')}</p><p>${escapeHtml(source.observation || '')}</p>${source.note ? `<p class="review-hint">${escapeHtml(source.note)}</p>` : ''}</article>`).join('')}</div>`;
}

function reviewRenderReadOnly(state, record) {
  const usage = record.usage || {};
  return `<div class="review-readonly-grid">
    <div><span>원본 승인 조건</span><strong>${escapeHtml(reviewRightsLabels[usage.approval] || '미확인')}</strong></div>
    <div><span>원본 재배포 조건</span><strong>${escapeHtml(reviewRightsLabels[usage.redistribution] || '미확인')}</strong></div>
    <div><span>원본 미리보기 표시 조건</span><strong>${escapeHtml(reviewRightsLabels[usage.preview] || '미확인')}</strong></div>
  </div><p class="review-hint">허용 상태·파일 검증·로고 버전은 이 도구에서 변경할 수 없습니다. 사용 조건 요약을 고쳐도 허용으로 승격되지 않습니다. 이 화면은 로고 이미지를 표시하지 않습니다.</p>
  <div class="review-table-scroll"><table class="review-assets-table"><caption>원본의 자료 제공·검증 상태</caption><thead><tr><th scope="col">자료</th><th scope="col">페이지 안내 형식</th><th scope="col">검증 수준</th></tr></thead><tbody>${(record.assets || []).map(asset => `<tr><th scope="row">${escapeHtml(asset.label)}</th><td>${escapeHtml((asset.listed_formats || []).join(', ') || '제공 형식 미확인')}</td><td>${escapeHtml(reviewFileLabels[asset.file_verification] || '미확인')}</td></tr>`).join('') || '<tr><td colspan="3">자료 항목 없음</td></tr>'}</tbody></table></div>`;
}

function reviewRenderEditor(state) {
  const record = state.byId.get(state.selectedId);
  if (!record) return '<section class="review-panel"><h2>검수할 항목이 없습니다</h2><p>카탈로그를 확인해 주세요.</p></section>';
  const fields = reviewFields(state, record);
  const note = state.drafts.get(record.id)?.note || '';
  return `<section class="review-panel review-editor-panel" aria-labelledby="review-editor-title">
    <header class="review-editor-header"><div><p class="review-kicker">선택한 레코드</p><h2 id="review-editor-title" data-review-editor-heading tabindex="-1">${escapeHtml(record.name)}</h2><p class="review-record-id">${escapeHtml(record.id)} · ${escapeHtml(record.organization_name)}</p></div><button type="button" class="review-button review-button--quiet" data-review-action="reset-selected"${state.drafts.has(record.id) ? '' : ' disabled'}>이 항목 초안 지우기</button></header>
    <p class="review-original-status">원본 상태 ${reviewBadge(record.review?.status || 'draft')}<span>확인일 ${escapeHtml(record.review?.checked_at || '미기재')}</span></p>
    <form data-review-form novalidate>
      <fieldset class="review-form-grid"><legend>수정 가능한 정보</legend>
        ${reviewInput('name', fields.name, { required: true })}
        ${reviewInput('name_en', fields.name_en, { hint: '공식 표기가 확인되지 않으면 비워 두세요.' })}
        ${reviewTextarea('aliases', fields.aliases.join('\n'), { rows: 2, hint: '별칭을 한 줄에 하나씩 입력하세요. 확인한 약칭과 이전 이름만 사용하세요.' })}
        <div class="review-field"><label for="review-field-category">기관 분류<span class="review-required"> 필수</span></label><select id="review-field-category" name="category">${reviewOptionList(state.taxonomy.categories, fields.category)}</select></div>
        <div class="review-field"><label for="review-field-kind">브랜드 종류<span class="review-required"> 필수</span></label><select id="review-field-kind" name="kind">${reviewOptionList(state.taxonomy.identity_kinds, fields.kind)}</select></div>
        <fieldset class="review-field review-field--wide review-sector-fieldset" id="review-field-sectors"><legend>분야<span class="review-required"> 확인한 분야만 선택</span></legend><div class="review-checkbox-grid">${(state.taxonomy.sectors || []).map((sector, index) => `<label class="review-checkbox" for="review-sector-${index}"><input type="checkbox" id="review-sector-${index}" name="sectors" value="${escapeHtml(sector.id)}"${fields.sectors.includes(sector.id) ? ' checked' : ''}><span>${escapeHtml(sector.label)}</span></label>`).join('')}</div></fieldset>
        ${reviewInput('country', fields.country, { maxlength: 2, hint: 'KR, US 등 확인한 2자리 코드만 입력하세요. 미확인은 빈칸입니다.' })}
        ${reviewInput('region', fields.region, { hint: '경기·서울 등 근거가 있는 지역만 입력하세요. 미확인은 빈칸입니다.' })}
        ${reviewTextarea('summary', fields.summary, { required: true, hint: '공식 페이지에서 확인한 사실을 간결하게 적으세요.' })}
        ${reviewInput('source_url', fields.source_url, { type: 'url', required: true, wide: true, hint: '새 URL은 재검수 대상입니다. 기존 source_ids는 자동으로 바뀌지 않습니다.' })}
        ${reviewInput('guideline_url', fields.guideline_url, { type: 'url', wide: true, hint: '공식 사용 가이드 주소입니다. 미확인일 때는 비워 두세요.' })}
        ${reviewTextarea('usage_summary', fields.usage_summary, { required: true, hint: '재배포·표시 허용 등 권리 상태는 바뀌지 않습니다. 바꾼 요약은 원문 정책과 다시 대조해야 합니다.' })}
      </fieldset>
      <div class="review-note-block">${reviewTextarea('review_note', note, { label: '검토 메모', rows: 3, maxlength: 4000, hint: '무엇을 확인했고 무엇이 남았는지 적으세요. 원문 URL과 확인 위치를 남길 수 있습니다. 메모는 패치에 포함되며 브라우저에도 보관됩니다.' })}</div>
    </form>
    <div data-review-validation class="review-validation">${reviewRenderValidation(state, record)}</div>
    <section class="review-section" aria-labelledby="review-diff-title"><h3 id="review-diff-title">원본과 수정안 비교</h3><div data-review-diff>${reviewRenderDiff(state, record)}</div></section>
    <details class="review-details" open><summary>필드별 근거 대조</summary><div data-review-evidence>${reviewRenderEvidence(state, record)}</div></details>
    <details class="review-details"><summary>원본 권리·파일 상태 · 읽기 전용</summary>${reviewRenderReadOnly(state, record)}</details>
  </section>`;
}

function reviewRenderStatus(state) {
  let changed = 0;
  let notesOnly = 0;
  let invalid = 0;
  for (const [id] of state.drafts) {
    const record = state.byId.get(id);
    if (reviewChangedFields(state, record).length) changed += 1;
    else notesOnly += 1;
    if (reviewValidate(state, record).length) invalid += 1;
  }
  return `<div class="review-summary-row"><span>원본 <strong>${state.records.length}</strong>건</span><span>내용 수정 <strong>${changed}</strong>건</span><span>메모만 <strong>${notesOnly}</strong>건</span>${invalid ? `<span class="review-error-count">입력 확인 <strong>${invalid}</strong>건</span>` : ''}</div>
    <p class="review-storage-note">${escapeHtml(reviewStorageMessage(state))}</p>
    ${state.lastExportMessage ? `<p class="review-export-message">${escapeHtml(state.lastExportMessage)}</p>` : ''}`;
}

function reviewRenderShell(state) {
  return `<div class="review-tool" data-review-tool>
    <header class="review-page-header"><p class="review-kicker">LETSUM · DATA REVIEW</p><h1>로컬 검수 도구 · 수정사항은 파일로 내보내기</h1><p class="review-intro">공식 출처를 대조하고 수정안을 만드세요. 편집 내용은 원본 카탈로그와 서버에 저장되지 않습니다.</p></header>
    <section class="review-topbar" aria-label="수정안 상태와 내보내기"><div data-review-summary role="status" aria-live="polite" aria-atomic="true">${reviewRenderStatus(state)}</div><div class="review-export-control"><button type="button" class="review-button review-button--primary" data-review-action="export" disabled>수정안 JSON 내보내기</button><span class="review-hint">목록 필터와 관계없이 모든 초안 포함</span></div></section>
    <div class="review-layout"><aside class="review-panel review-sidebar" aria-labelledby="review-list-title"><h2 id="review-list-title">레코드 목록</h2><div class="review-field"><label for="review-search">이름·기관·ID 검색</label><input id="review-search" type="search" data-review-search placeholder="예: 고양, NAVER" autocomplete="off"></div><div class="review-field"><label for="review-status-filter">원본 검수 상태</label><select id="review-status-filter" data-review-status-filter><option value="all">전체 원본 상태</option><option value="source-reviewed">출처 검토됨</option><option value="needs-review">재검수 필요</option><option value="draft">초안</option><option value="archived">보관됨</option><option value="local">로컬 수정·메모 있음</option></select></div><p class="review-list-count" data-review-list-count>${state.records.length}건</p><div data-review-list>${reviewRenderList(state)}</div></aside><div class="review-editor" data-review-editor>${reviewRenderEditor(state)}</div></div>
    <p class="review-dataset-meta">데이터 ${escapeHtml(state.catalog.version || '버전 없음')} · 원본 SHA-256 ${state.hash ? `<code>${escapeHtml(state.hash)}</code>` : '없음 — 내보내기 사용 불가'}</p>
  </div>`;
}

export function renderReview({ catalog, sources, taxonomy, catalogSha256 } = {}) {
  return reviewRenderShell(reviewMakeState({ catalog, sources, taxonomy, catalogSha256 }));
}

export function bindReview({ root, catalog, sources, taxonomy, catalogSha256, notify } = {}) {
  const toolRoot = root?.matches?.('[data-review-tool]') ? root : root?.querySelector?.('[data-review-tool]');
  if (!toolRoot) return () => {};
  reviewBindings.get(toolRoot)?.();
  const state = reviewMakeState({ catalog, sources, taxonomy, catalogSha256 });
  reviewLoadDrafts(state);
  reviewPersistDrafts(state);
  const announce = message => { if (typeof notify === 'function') notify(message); };
  const query = selector => toolRoot.querySelector(selector);

  function updateSummary() {
    query('[data-review-summary]').innerHTML = reviewRenderStatus(state);
    const exportButton = query('[data-review-action="export"]');
    exportButton.disabled = !state.hash || state.drafts.size === 0;
    exportButton.textContent = `수정안 JSON 내보내기${state.drafts.size ? ` (${state.drafts.size})` : ''}`;
  }

  function updateList() {
    query('[data-review-list]').innerHTML = reviewRenderList(state);
    const count = reviewMatchingRecords(state).length;
    query('[data-review-list-count]').textContent = `${count}건 / 전체 ${state.records.length}건`;
  }

  function markErrors(record) {
    const invalidFields = new Set(reviewValidate(state, record).map(error => error.field));
    for (const key of reviewEditableKeys) {
      const element = query(`#review-field-${key}`);
      if (!element) continue;
      if (invalidFields.has(key)) element.setAttribute('aria-invalid', 'true');
      else element.removeAttribute('aria-invalid');
    }
  }

  function updateEditor() {
    query('[data-review-editor]').innerHTML = reviewRenderEditor(state);
    const record = state.byId.get(state.selectedId);
    if (record) markErrors(record);
  }

  function updateDraft() {
    const record = state.byId.get(state.selectedId);
    const form = query('[data-review-form]');
    if (!record || !form) return;
    const value = name => reviewText(form.elements.namedItem(name)?.value).trim();
    const nullable = name => value(name) || null;
    const fields = {
      name: value('name'), name_en: nullable('name_en'),
      aliases: [...new Set(value('aliases').split(/\r?\n/).map(item => item.trim()).filter(Boolean))],
      category: value('category'), kind: value('kind'),
      sectors: [...form.querySelectorAll('input[name="sectors"]:checked')].map(input => input.value),
      country: nullable('country')?.toUpperCase() || null,
      region: nullable('region'), summary: value('summary'),
      source_url: value('source_url'), guideline_url: nullable('guideline_url'),
      usage_summary: value('usage_summary')
    };
    const note = reviewText(form.elements.namedItem('review_note')?.value).slice(0, 4000);
    state.drafts.set(record.id, { fields, note });
    if (!reviewChangedFields(state, record).length && !note.trim()) state.drafts.delete(record.id);
    state.lastExportMessage = '';
    reviewPersistDrafts(state);
    query('[data-review-diff]').innerHTML = reviewRenderDiff(state, record);
    query('[data-review-validation]').innerHTML = reviewRenderValidation(state, record);
    query('[data-review-evidence]').innerHTML = reviewRenderEvidence(state, record);
    query('[data-review-action="reset-selected"]').disabled = !state.drafts.has(record.id);
    markErrors(record);
    updateSummary();
    updateList();
  }

  function focusField(field) {
    const element = query(`#review-field-${field}`);
    if (!element) return;
    (element.matches('fieldset') ? element.querySelector('input') : element)?.focus();
    element.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  function exportPatches() {
    if (!state.hash) { announce('원본 SHA-256이 없어 내보낼 수 없습니다. 빌드된 검수 페이지를 열어 주세요.'); return; }
    if (!state.drafts.size) { announce('내보낼 수정안이나 검토 메모가 없습니다.'); return; }
    for (const [id] of state.drafts) {
      const record = state.byId.get(id);
      const errors = reviewValidate(state, record);
      if (errors.length) {
        state.selectedId = id;
        updateEditor();
        updateList();
        focusField(errors[0].field);
        announce(`${record.name}: 입력 형식을 확인한 뒤 내보내 주세요.`);
        return;
      }
    }
    const createdAt = new Date().toISOString();
    const patch = {
      schema_version: '1.0',
      dataset_version: state.catalog.version,
      base_sha256: state.hash,
      created_at: createdAt,
      patches: state.records.filter(record => state.drafts.has(record.id)).map(record => ({
        id: record.id,
        changes: reviewChanges(state, record),
        review_note: state.drafts.get(record.id).note.trim()
      }))
    };
    let objectUrl = null;
    let link = null;
    try {
      const blob = new Blob([`${JSON.stringify(patch, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
      objectUrl = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = objectUrl;
      link.download = `LETSUM_Logo_Review_${createdAt.replace(/[:.]/g, '-')}.json`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      state.lastExportMessage = '패치 파일 다운로드를 브라우저에 요청했습니다. 원본·서버에는 반영되지 않았으며 초안도 그대로 남아 있습니다.';
      updateSummary();
      announce(state.lastExportMessage);
    } catch {
      state.lastExportMessage = '패치 파일 다운로드를 요청하지 못했습니다. 초안은 유지됩니다. 브라우저의 다운로드 설정을 확인해 주세요.';
      updateSummary();
      announce(state.lastExportMessage);
    } finally {
      link?.remove();
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    }
  }

  function onInput(event) {
    const target = event.target;
    if (target?.matches?.('[data-review-search]')) {
      state.query = target.value;
      updateList();
    } else if (target?.closest?.('[data-review-form]')) updateDraft();
  }

  function onChange(event) {
    const target = event.target;
    if (target?.matches?.('[data-review-status-filter]')) {
      state.filter = target.value;
      updateList();
    } else if (target?.closest?.('[data-review-form]')) updateDraft();
  }

  function onClick(event) {
    const button = event.target?.closest?.('button');
    if (!button || !toolRoot.contains(button)) return;
    if (button.dataset.selectRecord) {
      const id = button.dataset.selectRecord;
      if (!state.byId.has(id)) return;
      state.selectedId = id;
      updateEditor();
      updateList();
      query('[data-review-editor-heading]')?.focus();
      return;
    }
    if (button.dataset.focusField) { focusField(button.dataset.focusField); return; }
    if (button.dataset.reviewAction === 'reset-selected') {
      state.drafts.delete(state.selectedId);
      state.lastExportMessage = '';
      reviewPersistDrafts(state);
      updateEditor();
      updateList();
      updateSummary();
      query('[data-review-editor-heading]')?.focus();
      announce('이 항목의 로컬 초안과 검토 메모를 지웠습니다. 원본 값은 유지됩니다.');
      return;
    }
    if (button.dataset.reviewAction === 'export') exportPatches();
  }

  function onSubmit(event) { if (event.target?.matches?.('[data-review-form]')) event.preventDefault(); }

  updateList();
  updateEditor();
  updateSummary();
  toolRoot.addEventListener('input', onInput);
  toolRoot.addEventListener('change', onChange);
  toolRoot.addEventListener('click', onClick);
  toolRoot.addEventListener('submit', onSubmit);
  const cleanup = () => {
    toolRoot.removeEventListener('input', onInput);
    toolRoot.removeEventListener('change', onChange);
    toolRoot.removeEventListener('click', onClick);
    toolRoot.removeEventListener('submit', onSubmit);
    reviewBindings.delete(toolRoot);
  };
  reviewBindings.set(toolRoot, cleanup);
  return cleanup;
}
