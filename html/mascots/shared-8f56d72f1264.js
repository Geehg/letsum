
/* core.js */
/* Browser-native shared logic. No dependencies, DOM writes, network calls or mutations. */
const CATEGORY_IDS = ['national-government', 'local-government', 'public-organization', 'education', 'business', 'nonprofit', 'intergovernmental'];
const SECTOR_IDS = ['administration', 'education', 'research-science', 'healthcare', 'welfare', 'culture-arts', 'tourism', 'sports', 'environment', 'transport-logistics', 'energy', 'finance', 'ict-digital', 'industry-manufacturing', 'agriculture-food', 'housing-construction', 'safety-defense', 'international-cooperation'];
const SECTOR_LABELS = ['행정·정책', '교육·학습', '연구·과학기술', '보건·의료', '복지·사회서비스', '문화·예술', '관광', '체육·스포츠', '환경·기후', '교통·물류', '에너지·자원', '금융·보험', 'IT·통신·디지털', '산업·제조', '농림수산·식품', '주거·건설·국토', '안전·치안·국방', '국제협력·외교'];
const CATEGORY_LABELS = ['정부·국가기관', '지자체·교육행정', '공공기관·공기업', '대학·학교', '기업·브랜드', '협회·비영리단체', '국제기구'];
const KIND_IDS = ['organization', 'city-brand', 'product', 'service', 'campaign', 'anniversary', 'mascot', 'character'];
const ASSET_FORMS = ['symbol', 'wordmark', 'signature', 'emblem', 'slogan', 'character', 'guide'];
const FORMAT_LABELS = ['AI', 'EPS', 'SVG', 'PDF', 'PNG', 'JPG', 'WEBP', 'ZIP'];
const ACCESS_IDS = ['public', 'login', 'request', 'information', 'unknown'];
const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const collation = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\u1100-\u1112]/g, c => INITIALS[c.charCodeAt(0) - 0x1100]).toLowerCase().replace(/\s+/gu, ' ').trim();
}
function getChoseong(value) {
  return [...normalizeText(value)].map(c => {
    const code = c.charCodeAt(0);
    return code >= 0xAC00 && code <= 0xD7A3 ? INITIALS[Math.floor((code - 0xAC00) / 588)] : c;
  }).join('');
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function safeUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007F-\u009F\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
function getFormats(record) {
  const values = (record?.assets ?? []).flatMap(asset => Array.isArray(asset.listed_formats) ? asset.listed_formats : []);
  return [...new Set(values.map(value => String(value).toUpperCase()))].sort((a, b) => {
    const ai = FORMAT_LABELS.indexOf(a), bi = FORMAT_LABELS.indexOf(b);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
  });
}

function queryParts(query) {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  const formats = [], text = [];
  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (FORMAT_LABELS.includes(upper) || upper === 'JPEG') formats.push(upper === 'JPEG' ? 'JPG' : upper);
    else text.push(token);
  }
  return { formats: [...new Set(formats)], text };
}

function fieldsForSearch(record) {
  const names = [record.name, record.organization_name, record.name_en, ...(record.aliases ?? [])].filter(Boolean).map(normalizeText);
  const metadata = [record.summary, record.region, record.country, CATEGORY_LABELS[CATEGORY_IDS.indexOf(record.category)], ...(record.sectors ?? []).map(code => SECTOR_LABELS[SECTOR_IDS.indexOf(code)])].filter(Boolean).map(normalizeText);
  return { names, metadata };
}
function searchScore(record, query) {
  const { formats, text } = queryParts(query);
  const offered = getFormats(record);
  if (!formats.every(format => offered.includes(format))) return 0;
  if (!text.length) return 1;
  const { names, metadata } = fieldsForSearch(record);
  let score = 1;
  for (const token of text) {
    const compactToken = token.replace(/\s/g, '');
    const initialQuery = /^[ㄱ-ㅎ]+$/u.test(token);
    let tokenScore = 0;
    for (let i = 0; i < names.length; i += 1) {
      const name = names[i], compactName = name.replace(/\s/g, '');
      if (name === token) tokenScore = Math.max(tokenScore, 170 - Math.min(i, 20));
      else if (name.startsWith(token)) tokenScore = Math.max(tokenScore, 115 - Math.min(i, 20));
      else if (name.includes(token) || compactName.includes(compactToken)) tokenScore = Math.max(tokenScore, 80 - Math.min(i, 20));
      if (initialQuery && getChoseong(name).replace(/\s/g, '').includes(compactToken)) tokenScore = Math.max(tokenScore, 55 - Math.min(i, 20));
    }
    if (metadata.some(value => value.includes(token))) tokenScore = Math.max(tokenScore, 25);
    if (tokenScore === 0) return 0;
    score += tokenScore;
  }
  const phrase = text.join(' ');
  const exactIndex = names.indexOf(phrase);
  if (exactIndex >= 0) score += 1000 - Math.min(exactIndex, 20) * 10;
  else if (names.some(name => name.replace(/\s/g, '') === phrase.replace(/\s/g, ''))) score += 750;
  return score;
}

function selected(value, candidates) {
  if (value === undefined || value === null || value === 'all' || value === '' || (Array.isArray(value) && value.length === 0)) return true;
  return (Array.isArray(value) ? value : [value]).some(item => candidates.includes(item));
}
function filterRecords(records, filters = {}) {
  const f = { q: '', category: 'all', sector: 'all', format: 'all', region: 'all', access: 'all', includeHistorical: false, sort: 'relevance', ...filters };
  const scored = (Array.isArray(records) ? records : []).filter(record => {
    if (['draft', 'archived'].includes(record.review?.status)) return false;
    if (!f.includeHistorical && record.version?.status === 'historical') return false;
    if (!selected(f.category, [record.category]) || !selected(f.sector, record.sectors ?? []) || !selected(f.region, [record.region])) return false;
    const requestedFormats = Array.isArray(f.format) ? f.format.map(x => String(x).toUpperCase()) : f.format === 'all' ? 'all' : String(f.format).toUpperCase();
    if (!selected(requestedFormats, (f.formatsOf || getFormats)(record)) || !selected(f.access, (record.assets ?? []).map(asset => asset.access))) return false;
    return true;
  }).map(record => ({ record, score: searchScore(record, f.q) })).filter(item => item.score > 0);
  scored.sort((a, b) => {
    if (f.sort === 'checked') {
      const recent = Date.parse(b.record.review?.checked_at ?? '') || 0;
      const older = Date.parse(a.record.review?.checked_at ?? '') || 0;
      if (recent !== older) return recent - older;
    } else if (f.sort === 'relevance' && normalizeText(f.q) && a.score !== b.score) return b.score - a.score;
    // Default order: better-known organisations first (recognition score supplied by the production build), then by name.
    if (f.sort === 'relevance' && f.rank) {
      const known = (f.rank[b.record.id] ?? 0) - (f.rank[a.record.id] ?? 0);
      if (known) return known;
    }
    return collation.compare(a.record.name, b.record.name) || String(a.record.id).localeCompare(String(b.record.id));
  });
  return scored.map(item => item.record);
}
function summarize(records) {
  const rows = Array.isArray(records) ? records : [];
  return { records: rows.length, organizations: new Set(rows.map(row => row.organization_id)).size, categories: new Set(rows.map(row => row.category)).size, formats: new Set(rows.flatMap(getFormats)).size };
}

// These JSON Schema objects are also emitted verbatim to schemas/*.schema.json.
// validateCatalog uses the same schema objects, then applies cross-record invariants.
const textSchema = { type: 'string', minLength: 1 };
const nullableText = { type: ['string', 'null'] };
const idSchema = { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' };
const urlPattern = String.raw`^[Hh][Tt][Tt][Pp][Ss]?://[^/?#@\\\u0000-\u0020\u007F-\u009F]+(?:[/?#][^\\\u0000-\u0020\u007F-\u009F]*)?$`;
const urlSchema = { type: 'string', format: 'uri', pattern: urlPattern };
const nullableUrl = { type: ['string', 'null'], format: 'uri', pattern: urlPattern };
const dateSchema = { type: 'string', format: 'date' };
const nullableDate = { type: ['string', 'null'], format: 'date' };
const stringArray = { type: 'array', items: textSchema, uniqueItems: true };
const enumeration = values => ({ type: 'string', enum: values });
const objectSchema = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const schemaBase = { $schema: 'https://json-schema.org/draft/2020-12/schema' };
const formatSchema = enumeration(FORMAT_LABELS);
const policyValue = enumeration(['permitted', 'conditional', 'restricted', 'unknown']);
const assetSchema = objectSchema({
  id: idSchema, label: textSchema, form: enumeration(ASSET_FORMS),
  listed_formats: { type: 'array', items: formatSchema, uniqueItems: true },
  verified_format: { type: ['string', 'null'], enum: [...FORMAT_LABELS, null] },
  size_bytes: { type: ['integer', 'null'], minimum: 1 },
  sha256: { type: ['string', 'null'], pattern: '^[a-f0-9]{64}$' },
  download_url: nullableUrl, access: enumeration(ACCESS_IDS), source_id: idSchema,
  file_verification: enumeration(['page-listed', 'link-checked', 'file-verified', 'not-provided'])
});
assetSchema.allOf = [
  {
    if: { properties: { file_verification: { const: 'file-verified' } } },
    then: { properties: { verified_format: formatSchema, size_bytes: { type: 'integer', minimum: 1 }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, download_url: urlSchema } },
    else: { properties: { verified_format: { type: 'null' }, size_bytes: { type: 'null' }, sha256: { type: 'null' } } }
  },
  { if: { properties: { file_verification: { const: 'not-provided' } } }, then: { properties: { listed_formats: { maxItems: 0 } } } }
];
const recordSchema = objectSchema({
  id: idSchema, organization_id: idSchema, organization_name: textSchema, name: textSchema,
  name_en: nullableText, aliases: stringArray, category: enumeration(CATEGORY_IDS), kind: enumeration(KIND_IDS),
  sectors: { type: 'array', items: enumeration(SECTOR_IDS), uniqueItems: true },
  country: { type: ['string', 'null'], pattern: '^[A-Z]{2}$' }, region: nullableText,
  summary: textSchema, source_ids: { type: 'array', items: idSchema, minItems: 1, uniqueItems: true },
  source_url: urlSchema, guideline_url: nullableUrl,
  assets: { type: 'array', items: assetSchema },
  usage: objectSchema({ summary: textSchema, approval: enumeration(['required', 'conditional', 'not-stated', 'unknown']), redistribution: policyValue, preview: policyValue, policy_url: nullableUrl }),
  version: objectSchema({ status: enumeration(['current', 'historical', 'unconfirmed']), introduced_at: nullableDate, label: nullableText }),
  review: objectSchema({ status: enumeration(['source-reviewed', 'needs-review', 'draft', 'archived']), checked_at: nullableDate, source_scope: { type: ['string', 'null'], enum: ['page', 'search', null] } }),
  related_fonts: { type: 'array', items: objectSchema({ name: textSchema, source_url: urlSchema }) }
});
recordSchema.allOf = [
  {
    if: { properties: { review: { properties: { status: { const: 'source-reviewed' } } } } },
    then: { properties: { review: { properties: { checked_at: dateSchema, source_scope: enumeration(['page', 'search']) } } } }
  },
  {
    if: { properties: { version: { properties: { status: { const: 'current' } } } } },
    then: { properties: { version: { properties: { label: textSchema } }, review: { properties: { source_scope: { const: 'page' } } } } }
  }
];
const CATALOG_SCHEMA = { ...schemaBase, title: 'LETSUM logo catalog 1.0', ...objectSchema({ schema_version: { const: '1.0' }, version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' }, updated_at: dateSchema, scope_note: textSchema, records: { type: 'array', items: recordSchema } }) };
const sourceSchema = objectSchema({ id: idSchema, title: textSchema, url: urlSchema, publisher: textSchema, language: textSchema, checked_at: dateSchema, scope: enumeration(['page', 'search']), observation: textSchema, note: { type: 'string' } });
const SOURCES_SCHEMA = { ...schemaBase, title: 'LETSUM public source evidence 1.0', ...objectSchema({ updated_at: dateSchema, sources: { type: 'array', items: sourceSchema } }) };
const labelsSchema = codes => ({ type: 'array', items: objectSchema({ id: enumeration(codes), label: textSchema }), minItems: codes.length, maxItems: codes.length });
const TAXONOMY_SCHEMA = { ...schemaBase, title: 'LETSUM logo taxonomy 1.0', ...objectSchema({ categories: labelsSchema(CATEGORY_IDS), sectors: labelsSchema(SECTOR_IDS), asset_forms: labelsSchema(ASSET_FORMS), formats: { type: 'array', items: formatSchema, minItems: FORMAT_LABELS.length, maxItems: FORMAT_LABELS.length, uniqueItems: true }, access: labelsSchema(ACCESS_IDS), identity_kinds: labelsSchema(KIND_IDS) }) };
const patchChangesProperties = Object.fromEntries(['name', 'name_en', 'aliases', 'category', 'kind', 'sectors', 'country', 'region', 'summary', 'source_url', 'guideline_url'].map(key => [key, recordSchema.properties[key]]));
patchChangesProperties.usage = objectSchema({ summary: textSchema });
const REVIEW_PATCH_SCHEMA = { ...schemaBase, title: 'LETSUM local review patch 1.0', ...objectSchema({
  schema_version: { const: '1.0' }, dataset_version: CATALOG_SCHEMA.properties.version,
  base_sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, created_at: { type: 'string', format: 'date-time' },
  patches: { type: 'array', minItems: 1, items: objectSchema({ id: idSchema, changes: objectSchema(patchChangesProperties, []), review_note: { type: 'string' } }, ['id', 'changes', 'review_note']) }
}) };

function valueType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validateAgainstSchema(value, schema, path = '$') {
  const errors = [];
  function visit(item, rule, where) {
    for (const condition of rule.allOf ?? []) visit(item, condition, where);
    if (rule.if) {
      const branch = validateAgainstSchema(item, rule.if, where).length === 0 ? rule.then : rule.else;
      if (branch) visit(item, branch, where);
    }
    if (own(rule, 'const') && item !== rule.const) errors.push(`${where}: must equal ${JSON.stringify(rule.const)}`);
    if (rule.enum && !rule.enum.some(option => option === item)) errors.push(`${where}: unsupported value ${JSON.stringify(item)}`);
    if (rule.type) {
      const choices = Array.isArray(rule.type) ? rule.type : [rule.type];
      if (!choices.some(type => valueType(item, type))) { errors.push(`${where}: expected ${choices.join('|')}`); return; }
    }
    if (item === null) return;
    if (typeof item === 'string') {
      if (rule.minLength !== undefined && [...item].length < rule.minLength) errors.push(`${where}: string too short`);
      if (rule.pattern && !new RegExp(rule.pattern, 'u').test(item)) errors.push(`${where}: invalid pattern`);
      if (rule.format === 'uri' && !safeUrl(item)) errors.push(`${where}: unsafe or invalid HTTP(S) URL`);
      if (rule.format === 'date' && !validDate(item)) errors.push(`${where}: invalid calendar date`);
      if (rule.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(item) || !Number.isFinite(Date.parse(item)))) errors.push(`${where}: invalid date-time`);
    }
    if (typeof item === 'number' && rule.minimum !== undefined && item < rule.minimum) errors.push(`${where}: below minimum`);
    if (Array.isArray(item)) {
      if (rule.minItems !== undefined && item.length < rule.minItems) errors.push(`${where}: too few items`);
      if (rule.maxItems !== undefined && item.length > rule.maxItems) errors.push(`${where}: too many items`);
      if (rule.uniqueItems && new Set(item.map(part => JSON.stringify(part))).size !== item.length) errors.push(`${where}: duplicate items`);
      if (rule.items) item.forEach((part, index) => visit(part, rule.items, `${where}[${index}]`));
    } else if (item && typeof item === 'object') {
      for (const key of rule.required ?? []) if (!own(item, key)) errors.push(`${where}.${key}: required`);
      for (const [key, part] of Object.entries(item)) {
        if (rule.properties && own(rule.properties, key)) visit(part, rule.properties[key], `${where}.${key}`);
        else if (rule.additionalProperties === false) errors.push(`${where}.${key}: unexpected property`);
      }
    }
  }
  visit(value, schema, path);
  return errors;
}
function validateCatalog(catalog, sources, taxonomy) {
  const errors = [
    ...validateAgainstSchema(catalog, CATALOG_SCHEMA, 'catalog'),
    ...validateAgainstSchema(sources, SOURCES_SCHEMA, 'sources'),
    ...validateAgainstSchema(taxonomy, TAXONOMY_SCHEMA, 'taxonomy')
  ];
  const warnings = [];
  const records = Array.isArray(catalog?.records) ? catalog.records : [];
  const sourceRows = Array.isArray(sources?.sources) ? sources.sources : [];
  const sourceMap = new Map();
  for (const row of sourceRows) {
    if (!row || typeof row !== 'object') continue;
    if (sourceMap.has(row.id)) errors.push(`sources: duplicate source id ${row.id}`);
    sourceMap.set(row.id, row);
  }
  for (const key of ['categories', 'sectors', 'asset_forms', 'access', 'identity_kinds']) {
    const rows = Array.isArray(taxonomy?.[key]) ? taxonomy[key] : [];
    const ids = rows.map(row => row?.id);
    if (new Set(ids).size !== ids.length) errors.push(`taxonomy.${key}: duplicate id`);
  }
  const recordIds = new Set(), assetIds = new Set(), organizations = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const prefix = `record ${record.id ?? '(missing id)'}`;
    if (recordIds.has(record.id)) errors.push(`${prefix}: duplicate record id`);
    recordIds.add(record.id);
    const existing = organizations.get(record.organization_id);
    if (existing && existing.category !== record.category) errors.push(`${prefix}: organization ${record.organization_id} has multiple primary categories`);
    if (existing && existing.name !== record.organization_name) errors.push(`${prefix}: organization ${record.organization_id} has inconsistent official names`);
    organizations.set(record.organization_id, { category: record.category, name: record.organization_name });
    const ids = Array.isArray(record.source_ids) ? record.source_ids : [];
    const referenceRows = ids.map(id => {
      if (!sourceMap.has(id)) errors.push(`${prefix}: unknown source reference ${id}`);
      return sourceMap.get(id);
    }).filter(Boolean);
    const referenceUrls = new Set(referenceRows.map(row => safeUrl(row.url)).filter(Boolean));
    if (safeUrl(record.source_url) && !referenceUrls.has(safeUrl(record.source_url))) {
      const message = `${prefix}: source_url does not match the referenced source evidence; link new evidence before approval`;
      if (record.review?.status === 'source-reviewed') errors.push(message); else warnings.push(message);
    }
    if (record.review?.status === 'source-reviewed') {
      if (!record.review.checked_at || !record.review.source_scope) errors.push(`${prefix}: source-reviewed requires checked_at and source_scope`);
      if (record.review.source_scope === 'page' && !referenceRows.some(row => row.scope === 'page')) errors.push(`${prefix}: page review has no page-scope evidence`);
    } else if (record.review?.status === 'needs-review') warnings.push(`${prefix}: needs review; research metadata does not authorize publication`);
    if (record.version?.status === 'current' && !record.version?.label) errors.push(`${prefix}: current status requires an explicit evidence label, not a live URL alone`);
    if (record.version?.status === 'current' && record.review?.source_scope !== 'page') errors.push(`${prefix}: current status requires page-scope evidence`);
    const policy = record.usage;
    if (policy && (['required', 'conditional'].includes(policy.approval) || ['permitted', 'conditional', 'restricted'].includes(policy.redistribution) || ['permitted', 'conditional', 'restricted'].includes(policy.preview))) {
      if (!policy.policy_url) errors.push(`${prefix}: stated usage conditions require a policy URL`);
      else if (!referenceUrls.has(safeUrl(policy.policy_url))) warnings.push(`${prefix}: policy URL needs its own referenced source evidence`);
    }
    if (policy && (policy.preview === 'permitted' || policy.redistribution === 'permitted')) {
      if (!referenceRows.some(row => row.scope === 'page' && safeUrl(row.url) === safeUrl(policy.policy_url))) errors.push(`${prefix}: permitted policy requires matching page-scope evidence`);
      if (record.review?.status !== 'source-reviewed') warnings.push(`${prefix}: permitted policy is awaiting human re-review; do not promote unknown permissions`);
    }
    for (const asset of Array.isArray(record.assets) ? record.assets : []) {
      if (!asset || typeof asset !== 'object') continue;
      const at = `${prefix} / asset ${asset.id ?? '(missing id)'}`;
      if (assetIds.has(asset.id)) errors.push(`${at}: duplicate asset id`);
      assetIds.add(asset.id);
      if (!sourceMap.has(asset.source_id) || !ids.includes(asset.source_id)) errors.push(`${at}: asset source must exist and belong to record.source_ids`);
      if (asset.file_verification !== 'file-verified') {
        for (const key of ['verified_format', 'size_bytes', 'sha256']) if (asset[key] !== null) errors.push(`${at}: ${key} must be null before actual file verification`);
      } else {
        if (!asset.verified_format || !Number.isInteger(asset.size_bytes) || asset.size_bytes <= 0 || !/^[a-f0-9]{64}$/.test(asset.sha256 ?? '') || !safeUrl(asset.download_url)) errors.push(`${at}: file-verified requires format, byte size, SHA-256 and official download URL`);
      }
      if (asset.file_verification === 'not-provided' && Array.isArray(asset.listed_formats) && asset.listed_formats.length) errors.push(`${at}: not-provided cannot claim listed file formats`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}


/* review.js */



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
  </div><p class="review-hint">허용 상태·파일 검증·캐릭터 버전은 이 도구에서 변경할 수 없습니다. 사용 조건 요약을 고쳐도 허용으로 승격되지 않습니다. 이 화면은 캐릭터 이미지를 표시하지 않습니다.</p>
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
function renderReview({ catalog, sources, taxonomy, catalogSha256 } = {}) {
  return reviewRenderShell(reviewMakeState({ catalog, sources, taxonomy, catalogSha256 }));
}
function bindReview({ root, catalog, sources, taxonomy, catalogSha256, notify } = {}) {
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


/* app.js */





// This module owns public navigation. Catalog data stays immutable.
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
  // A ZIP stands for the formats packed inside it (read from the archive's directory); a file of the format itself is preferred.
  const fileFormats = file => file.inner?.length ? file.inner : [file.format];
  const firstDownload = (record, format) => { const files = downloads[record.id] || [], want = String(format).toUpperCase(); return files.find(file => file.format === want && !file.inner?.length) || files.find(file => fileFormats(file).includes(want)) || files.find(file => file.format === want); };
  const FORMAT_ORDER = ['AI', 'EPS', 'SVG', 'PDF', 'PNG', 'JPG', 'WEBP', 'ZIP'];
  const allFormats = record => [...new Set([...getFormats(record), ...(downloads[record.id] || []).flatMap(fileFormats)])].sort((a, b) => FORMAT_ORDER.indexOf(a) - FORMAT_ORDER.indexOf(b));
  // Browse groups (대분류/소분류) from tools/logo-survey/classify.py; the standalone build falls back to categories.
  const browse = boot.groups?.groups?.length ? boot.groups : null;
  const groupOf = id => (browse?.assign?.[id] || '').split('/');
  const groupLabel = id => browse?.groups.find(g => g.id === id)?.label || '';
  const subLabel = (group, sub) => browse?.groups.find(g => g.id === group)?.subs.find(s => s.id === sub)?.label || '';
  // 국내/해외: Korean organisations (country KR) versus the rest (foreign companies, universities, agencies and international bodies).
  const originOf = record => record.country === 'KR' ? 'kr' : 'global';
  const inOrigin = (record, origin) => origin === 'all' || originOf(record) === origin;
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
  let notificationTimer;
  let cleanupRoute = null;
  let lastPath = '';

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
  const detailHref = id => `/mascots/brands/${encodeURIComponent(id)}/`;
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
      origin: valid('origin', ['kr', 'global']),
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
    for (const key of ['q', 'origin', 'category', 'group', 'sub', 'sector', 'format', 'region', 'access', 'sort', 'view']) {
      const value = next[key];
      if (value && value !== 'all' && !(key === 'sort' && value === 'relevance') && !(key === 'view' && value === 'grid')) params.set(key, value);
    }
    if (next.includeHistorical) params.set('history', '1');
    const hash = `#${path}${params.size ? '?' + params.toString() : ''}`;
    if (hash === location.hash) renderRoute(); else location.hash = hash;
  }

  const select = (name, title, options, selected) => `<label class="filter-select" for="filter-${h(name)}"><span>${h(title)}</span><select id="filter-${h(name)}" name="${h(name)}" data-filter="${h(name)}" aria-label="${h(title)}"><option value="all">전체</option>${options.map(item => `<option value="${h(item.id)}"${item.id === selected ? ' selected' : ''}>${h(item.label)}</option>`).join('')}</select></label>`;

  function renderSearch(f) {
    return `<form id="search-form" class="search-form" role="search"><label class="sr-only" for="logo-query">기관명, 브랜드명, 초성 또는 파일 형식으로 검색</label>${icon('search', 22)}<input id="logo-query" name="q" type="search" value="${h(f.q)}" placeholder="기관명, 캐릭터 이름, 초성으로 찾아보세요" autocomplete="off" maxlength="200"><kbd aria-hidden="true">/</kbd><button id="search-submit" type="submit">검색 ${icon('right', 18)}</button></form>
    ${'<div class="search-examples"><span>이렇게 찾아보세요</span><button id="query-goyang" type="button" data-query="수원">수원</button><button id="query-snu" type="button" data-query="수호랑">수호랑</button><button id="query-naver" type="button" data-query="펭수">펭수</button><button id="query-ai" type="button" data-query="AI">AI 파일 있는 캐릭터</button></div>'}`;
  }

  function renderGroupBar(f, collection) {
    const count = (group, sub) => collection.filter(record => { const [g, s] = groupOf(record.id); return g === group && (!sub || s === sub); }).length;
    const active = browse.groups.find(g => g.id === f.group);
    const bar = `<div class="category-bar group-bar" role="group" aria-label="대분류"><button id="group-all" type="button" data-group="all" class="category-button ${f.group === 'all' ? 'active' : ''}" aria-pressed="${f.group === 'all'}">전체 <span>${collection.length}</span></button>${browse.groups.filter(g => count(g.id) || f.group === g.id).map(g => `<button id="group-${h(g.id)}" type="button" data-group="${h(g.id)}" class="category-button ${f.group === g.id ? 'active' : ''}" aria-pressed="${f.group === g.id}">${h(g.label)} <span>${count(g.id)}</span></button>`).join('')}</div>`;
    const subs = active ? `<div class="sub-bar" role="group" aria-label="${h(active.label)} 소분류"><button type="button" data-sub="all" class="sub-chip ${f.sub === 'all' ? 'active' : ''}" aria-pressed="${f.sub === 'all'}">${h(active.label)} 전체</button>${active.subs.filter(s => count(active.id, s.id)).map(s => `<button id="sub-${h(s.id)}" type="button" data-sub="${h(s.id)}" class="sub-chip ${f.sub === s.id ? 'active' : ''}" aria-pressed="${f.sub === s.id}">${h(s.label)} <span>${count(active.id, s.id)}</span></button>`).join('')}</div>` : '';
    return bar + subs;
  }

  function renderFilters(f) {
    const collection = publicRecords.filter(record => (f.includeHistorical || record.version.status !== 'historical'));
    const counts = new Map(taxonomy.categories.map(item => [item.id, collection.filter(record => record.category === item.id).length]));
    const regions = [...new Set(publicRecords.map(record => record.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    const originCount = origin => collection.filter(record => inOrigin(record, origin)).length;
    const originBar = `<div class="origin-bar" role="group" aria-label="국내·해외">${[['all', '전체'], ['kr', '국내'], ['global', '해외']].map(([id, text]) => `<button id="origin-${id}" type="button" data-origin="${id}" class="origin-button ${f.origin === id ? 'active' : ''}" aria-pressed="${f.origin === id}">${text} <span>${originCount(id)}</span></button>`).join('')}</div>`;
    const scoped = collection.filter(record => inOrigin(record, f.origin));
    return `${originBar}${browse ? renderGroupBar(f, scoped) : `<div class="category-bar" role="group" aria-label="기관 유형"><button id="category-all" type="button" data-category="all" class="category-button ${f.category === 'all' ? 'active' : ''}" aria-pressed="${f.category === 'all'}">전체 <span>${collection.length}</span></button>${taxonomy.categories.map(item => `<button id="category-${h(item.id)}" type="button" data-category="${h(item.id)}" class="category-button ${f.category === item.id ? 'active' : ''}" aria-pressed="${f.category === item.id}">${h(item.label)} <span>${counts.get(item.id)}</span></button>`).join('')}</div>`}
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
    return `<div class="logo-dlrow">${files.map(file => `<a class="logo-dl" href="${h(safeUrl(file.url) || '#')}" target="_blank" rel="noopener noreferrer">${FORMAT_ICONS[fileFormats(file)[0]] || ''}<span><b>⬇ ${h(fileFormats(file).join('·'))}${file.label ? ` <em>${h(file.label)}</em>` : ' 파일 받기'}</b><small>${h([file.inner?.length || file.format === 'ZIP' ? 'ZIP 압축' : '', file.filename, fileSize(file.bytes), domain(file.url), file.trusted ? '공식 브랜드 페이지 게시(자동 확인 차단)' : ''].filter(Boolean).join(' · '))}</small></span></a>`).join('')}</div><p class="small-copy dl-note">파일은 LETSUM이 아니라 공식 사이트에서 바로 내려받습니다. 사용 조건과 규정은 공식 출처 원문을 따릅니다.</p>`;
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
    return `<span class="logo-box logo-box-${place}"><img class="logo-thumb" src="${h(src)}" alt="${place === 'detail' ? h(record.organization_name + ' 캐릭터') : ''}"${size} loading="lazy" decoding="async"></span>`;
  }

  function renderTile(record) {
    const { mark, size, latin, width } = cardMark(record);
    const thumb = thumbnails[record.id];
    return `<a class="icon-tile tone-${h(record.category)}" href="${h(detailHref(record.id))}" data-record="${h(record.id)}"${thumbAttrs(thumb)}><span class="tile-face size-${size}" style="--w:${width}" aria-hidden="true">${thumbImg(thumb, 'front', record)}<b${latin.test(mark) ? ' lang="en"' : ''}>${h(mark)}</b></span><span class="tile-name">${h(record.name)}</span><span class="tile-kind">${h((browse && subLabel(...groupOf(record.id))) || label(categoryLabels, record.category))}</span></a>`;
  }

  function renderCard(record) {
    const formats = allFormats(record);
    const { mark, size, latin, width } = cardMark(record);
    const kicker = mark === record.organization_name ? categoryAbbreviations[record.category] : record.organization_name;
    const thumb = thumbnails[record.id];
    return `<article class="brand-card" data-record="${h(record.id)}">
      <div class="identity-cover biz tone-${h(record.category)}"${thumbAttrs(thumb)}><div class="biz-front">${thumbImg(thumb, 'front', record)}<div class="cover-kicker"><span>${h(kicker)}</span><a class="bookmark-button source-icon" href="${h(safeUrl(record.source_url) || '#')}" target="_blank" rel="noopener noreferrer" title="공식 출처 (새 창)" aria-label="${h(record.name)} 공식 출처 새 창으로 열기">${icon('arrow', 18)}</a></div>
      <div class="identity-name size-${size}" style="--w:${width}"${latin.test(mark) ? ' lang="en"' : ''}>${h(mark)}</div></div>
      <div class="biz-back" aria-hidden="true"><div class="biz-head">${thumbImg(thumb, 'back', record)}<span class="biz-mark size-${size}">${h(mark)}</span><span class="biz-role"><em>${h(label(kindLabels, record.kind))}</em><b>${h(record.name)}</b></span></div>
      ${colorDots(record)}</div></div>
      <div class="card-body"><div class="card-meta"><span>${h(browse ? [groupLabel(groupOf(record.id)[0]), subLabel(...groupOf(record.id))].filter(Boolean).join(' · ') : label(categoryLabels, record.category))}</span>${record.region ? `<span>${h(record.region)}</span>` : originOf(record) === 'global' ? '<span>해외</span>' : ''}</div><h3><a href="${h(detailHref(record.id))}">${h(record.name)}</a></h3>${formats.length ? `<div class="format-row">${formats.slice(0, 6).map(format => formatBadge(format, record)).join('')}<span class="format-caption">${downloads[record.id]?.length ? '바로 받기' : '제공 안내'}</span></div>` : ''}</div>
    </article>`;
  }

  function renderEmpty() {
    return `<div class="empty-state"><div class="empty-icon">${icon('search', 30)}</div><h2>조건에 맞는 자료가 없습니다</h2><p>기관명이나 초성으로 다시 검색하거나, 선택한 필터를 줄여보세요.</p><button id="reset-empty" type="button" class="button dark" data-reset>검색 조건 초기화</button><a class="text-link" href="/contact.html">찾는 기관의 공식 링크 제보하기 ${icon('arrow', 16)}</a></div>`;
  }

  function renderDirectory(params) {
    const f = readFilters(params);
    const records = filterRecords(publicRecords, { ...f, rank, formatsOf: allFormats })
      .filter(record => inOrigin(record, f.origin))
      .filter(record => f.group === 'all' || (groupOf(record.id)[0] === f.group && (f.sub === 'all' || groupOf(record.id)[1] === f.sub)));
    const stats = summarize(records);
    // Long result lists render in pages of PAGE_SIZE; any change of route or filters starts again from the first page.
    const listKey = location.hash.replace(/[?&]more=\d+/, '');
    if (listKey !== lastListKey) { visibleCount = PAGE_SIZE; lastListKey = listKey; }
    const shown = records.slice(0, visibleCount);
    const hero = `<section class="directory-hero"><div><p class="eyebrow"><span class="small-dot"></span> MASCOT & CHARACTER DIRECTORY</p><h1 id="page-heading">우리 동네 마스코트,<br>공식 출처에서<span class="accent-dot">.</span></h1><p class="hero-copy">지자체·공공기관부터 기업·스포츠까지.<br class="mobile-only"> 캐릭터와 사용 안내를 함께 찾아보세요.</p></div><div class="hero-aside"><div class="hero-stat"><strong>${totals.organizations.toLocaleString('ko-KR')}</strong><span>기관·브랜드</span></div><div class="hero-stat"><strong>${totals.records.toLocaleString('ko-KR')}</strong><span>캐릭터 정보</span></div><p>데이터 갱신일 ${h(fmtDate(catalog.updated_at))}<br><a href="/mascots/#/guide">정보 확인 기준 ${icon('arrow', 14)}</a></p></div></section>`;
    app.innerHTML = `<div class="page-container" id="main-content" tabindex="-1">${hero}<section class="search-section" aria-label="캐릭터 검색 및 필터">${renderSearch(f)}${renderFilters(f)}</section><section class="results-section" aria-labelledby="results-heading"><div class="results-toolbar"><div><h2 id="results-heading" tabindex="-1">마스코트 둘러보기</h2><span id="result-count" role="status" aria-live="polite"><strong>${records.length}</strong>개 정보 <span class="result-divider">/</span> ${stats.organizations}개 기관</span></div><div class="results-controls"><label class="sr-only" for="sort-select">정렬</label><select id="sort-select" data-filter="sort"><option value="relevance"${f.sort === 'relevance' ? ' selected' : ''}>${f.q ? '관련도순' : '인지도순'}</option><option value="name"${f.sort === 'name' ? ' selected' : ''}>이름순</option><option value="checked"${f.sort === 'checked' ? ' selected' : ''}>최근 확인순</option></select><div class="view-toggle" role="group" aria-label="보기 방식"><button id="view-grid" type="button" data-view="grid" aria-label="명함 보기" title="명함 보기" aria-pressed="${f.view === 'grid'}">${icon('grid', 17)}</button><button id="view-icons" type="button" data-view="icons" aria-label="아이콘 보기" title="아이콘 보기" aria-pressed="${f.view === 'icons'}">${icon('tiles', 18)}</button><button id="view-list" type="button" data-view="list" aria-label="목록 보기" title="목록 보기" aria-pressed="${f.view === 'list'}">${icon('list', 18)}</button></div></div></div>
    ${f.q ? `<p class="query-label">“${h(f.q)}” 검색 결과</p>` : ''}
    ${!records.length ? renderEmpty() : f.view === 'icons' ? `<div class="icon-wall">${shown.map(renderTile).join('')}</div><p class="icon-wall-note">아이콘은 기관명을 유형별 색으로 조판한 견본이며 공식 캐릭터·브랜드 색상이 아닙니다.</p>` : `<div class="brand-grid ${f.view === 'list' ? 'list-view' : ''}">${shown.map(renderCard).join('')}</div>`}${records.length > shown.length ? `<div class="more-wrap"><button id="show-more" type="button" class="button light">더 보기 <span>${records.length - shown.length}개 남음</span></button></div>` : ''}
    <div class="catalog-note">${icon('info', 18)}<p><strong>파일 형식은 공식 페이지의 안내 기준입니다.</strong> 원본 파일의 다운로드·검증 여부와 이용 허가는 각각 확인해야 합니다. <a href="/mascots/#/guide">자세히 보기</a></p></div></section>
    ${`<section class="contribute-banner"><div><span class="eyebrow">BUILD THE DIRECTORY</span><h2>아직 찾는 마스코트가 없나요?</h2><p>공식 링크를 문의 폼으로 보내주시면 확인 후 반영하겠습니다.</p></div><a class="button dark" href="/contact.html">링크 제보 작성 ${icon('right', 18)}</a></section>`}</div>`;
    document.title = '마스코트 찾기 | LETSUM 마스코트';
    bindDirectory();
  }

  function bindDirectory() {
    app.querySelector('#show-more')?.addEventListener('click', () => {
      const y = scrollY;
      visibleCount += PAGE_SIZE; renderRoute(); scrollTo(0, y);
    });
    app.querySelector('#search-form').addEventListener('submit', event => { event.preventDefault(); setFilters({ q: app.querySelector('#logo-query').value.trim() }); });
    app.querySelectorAll('[data-filter]').forEach(selectElement => selectElement.addEventListener('change', () => setFilters({ [selectElement.dataset.filter]: selectElement.value })));
    app.querySelector('#history-filter').addEventListener('change', event => setFilters({ includeHistorical: event.target.checked }));
    app.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => setFilters({ category: button.dataset.category })));
    app.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => setFilters({ group: button.dataset.group, sub: 'all', category: 'all' })));
    app.querySelectorAll('[data-origin]').forEach(button => button.addEventListener('click', () => setFilters({ origin: button.dataset.origin, group: 'all', sub: 'all', category: 'all' })));
    app.querySelectorAll('[data-sub]').forEach(button => button.addEventListener('click', () => setFilters({ sub: button.dataset.sub })));
    app.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setFilters({ view: button.dataset.view })));
    app.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => setFilters({ q: button.dataset.query })));
    app.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => {
      setFilters({ q: '', origin: 'all', category: 'all', group: 'all', sub: 'all', sector: 'all', format: 'all', region: 'all', access: 'all', includeHistorical: false, sort: 'relevance', view: 'grid' }, '/');
    }));
  }

  function colorDots(record) {
    const entry = colors[record.id];
    const list = entry?.official || entry?.extracted || [];
    const swatches = list.filter(color => color.hex).slice(0, 4);
    return swatches.length ? `<div class="biz-colors" title="${entry.official ? '공식 컬러' : '캐릭터 추출 색(비공식)'}">${swatches.map(color => `<span style="--c:${h(color.hex)}"></span>`).join('')}<small>${h(swatches[0].hex)}${entry.official ? '' : ' 추출'}</small></div>` : '';
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
    <p class="section-intro">${official ? `공식 페이지에 적힌 값을 그대로 옮겼습니다(${h(fmtDate(entry.checked_at))} 확인). 값을 누르면 복사됩니다.` : '공식 페이지에서 색상 코드 표기를 찾지 못해, 캐릭터 이미지에서 대표색을 뽑은 <strong>추출값(비공식)</strong>입니다. 인쇄·제작에는 공식 가이드를 확인해 주세요.'}</p>
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
    app.innerHTML = `<div class="page-container detail-page" id="main-content" tabindex="-1"><nav class="breadcrumbs" aria-label="현재 위치"><a href="/mascots/#/">마스코트</a><span>/</span>${browse ? `<a href="/mascots/#/?group=${h(groupOf(record.id)[0])}">${h(groupLabel(groupOf(record.id)[0]))}</a><span>/</span><a href="/mascots/#/?group=${h(groupOf(record.id)[0])}&amp;sub=${h(groupOf(record.id)[1])}">${h(subLabel(...groupOf(record.id)))}</a>` : `<a href="/mascots/#/?category=${h(record.category)}">${h(label(categoryLabels, record.category))}</a>`}<span>/</span><span aria-current="page">${h(record.organization_name)}</span></nav>
    ${detailThumb(record)}<section class="detail-heading"><div><p class="eyebrow">${h(categoryAbbreviations[record.category])}</p><h1 id="page-heading">${h(record.name)}</h1>${record.name_en ? `<p class="english-name">${h(record.name_en)}</p>` : ''}<p class="detail-lead">${h(record.summary)}</p><div class="detail-tags"><span class="tag">${h(label(kindLabels, record.kind))}</span>${record.sectors.map(sector => `<span class="tag">${h(label(sectorLabels, sector))}</span>`).join('')}${record.region ? `<span class="tag">${h(record.region)}</span>` : ''}${reviewBadge(record)}</div></div><div class="detail-actions">${external(record.source_url, '공식 출처에서 확인', 'button dark')}<button id="copy-source" type="button" class="text-button" data-copy-source="${h(record.source_url)}">${icon('link', 16)} 공식 링크 복사</button></div></section>
    ${historical ? '<div class="notice warning">이전 버전 자료입니다. 실제 제작물에 적용하기 전에 현재 버전을 확인해 주세요.</div>' : ''}${record.review.status === 'needs-review' ? `<div class="notice warning">${surveyed(record) ? '공식 홈페이지를 자동 수집해 만든 정보입니다. 캐릭터·색상·이용 조건은 공식 출처에서 최신 내용을 확인해 주세요.' : '수정 후 재검수가 필요한 정보입니다. 확인일과 이용 조건은 공식 출처에서 다시 확인해 주세요.'}</div>` : ''}
    <div class="detail-layout"><div class="detail-main">${colorGuide(record)}<section class="detail-section"><div class="section-heading"><h2>캐릭터·자료 안내</h2><span>${record.assets.length}개 자료 항목</span></div><p class="section-intro">아래 형식과 접근 조건은 공식 페이지의 안내를 정리한 정보입니다.${downloads[record.id]?.length ? ' 바로 내려받을 수 있는 파일은 형식 배지와 아래 버튼으로 연결했습니다.' : ''}</p>${downloadRow(record)}
    <div class="asset-table-wrap"><table class="asset-table"><thead><tr><th scope="col">자료</th><th scope="col">파일 형식</th><th scope="col">접근 조건</th><th scope="col">확인 범위</th></tr></thead><tbody>${record.assets.length ? record.assets.map(asset => `<tr><th scope="row">${h(asset.label)}<small>${h(label(formLabels, asset.form))}</small></th><td>${asset.listed_formats.length ? asset.listed_formats.map(format => formatBadge(format, record)).join(' ') + '<small>공식 페이지 제공 안내</small>' : '<span class="muted">형식 미확인</span>'}</td><td>${h(accessLabels[asset.access])}</td><td><span class="asset-state">${h({ 'page-listed': '페이지 확인', 'link-checked': '링크 응답 확인', 'file-verified': '원본 파일 확인', 'not-provided': '파일 정보 미확인' }[asset.file_verification])}</span>${asset.file_verification === 'file-verified' ? `<small>${asset.size_bytes.toLocaleString('ko-KR')} bytes · ${h(asset.verified_format)}</small><details class="hash-details"><summary>SHA-256</summary><code>${h(asset.sha256)}</code></details>` : ''}</td></tr>`).join('') : '<tr><td colspan="4">등록된 자료 항목이 없습니다. 공식 출처를 확인해 주세요.</td></tr>'}</tbody></table></div>
    <div class="inline-note">${icon('info', 17)}<p>공식 이미지는 이 서비스에 수록하지 않았습니다. 원본과 세부 사용 규정은 권리자가 제공하는 페이지에서 확인해 주세요.</p></div>
    </section><section class="detail-section"><div class="section-heading"><h2>사용 전에 확인해 주세요</h2>${record.usage.policy_url ? external(record.usage.policy_url, '안내 원문', 'text-link') : ''}</div><p class="policy-summary">${h(record.usage.summary)}</p><dl class="policy-grid"><div><dt>승인 절차</dt><dd>${h(approvalLabels[record.usage.approval])}</dd></div><div><dt>재배포 조건</dt><dd>${h(policyLabels[record.usage.redistribution])}</dd></div><div><dt>미리보기 게시</dt><dd>${h(policyLabels[record.usage.preview])}</dd></div></dl><p class="small-copy">“확인 필요”는 허용을 뜻하지 않습니다. 안내가 있는 경우에도 사용 목적과 적용 범위를 원문에서 확인해 주세요.</p></section>
    <section class="detail-section"><div class="section-heading"><h2>확인한 공식 출처</h2><span>${recordSources.length}개</span></div><ul class="source-list">${recordSources.map(source => `<li><div class="source-title">${external(source.url, source.title, 'text-link')}<span>${h(source.publisher)} · ${h(source.language === 'ko' ? '한국어' : source.language === 'en' ? '영어' : source.language)}</span></div><p>${h(source.observation)}</p><div class="source-foot"><span>${h(fmtDate(source.checked_at))} ${source.scope === 'page' ? '페이지 확인' : '검색 결과 확인'}</span><span>${h(domain(source.url))}</span></div>${source.note ? `<details><summary>확인 범위 메모</summary><p>${h(source.note)}</p></details>` : ''}</li>`).join('')}</ul></section>
    ${record.related_fonts.length ? `<section class="detail-section"><div class="section-heading"><h2>관련 공식 서체</h2></div><p class="section-intro">해당 기관이 공식적으로 제공하는 서체입니다. 캐릭터에 사용된 서체라는 뜻은 아닙니다.</p><div class="related-fonts">${record.related_fonts.map(font => external(font.source_url, font.name, 'font-tile')).join('')}</div></section>` : ''}</div>
    <aside class="detail-sidebar" aria-label="등록 정보"><div class="info-panel"><span class="eyebrow">DIRECTORY NOTE</span><h2>정보 요약</h2><dl class="info-list"><div><dt>기관·기업</dt><dd>${h(record.organization_name)}</dd></div><div><dt>분류</dt><dd>${h(label(categoryLabels, record.category))}</dd></div><div><dt>출처 확인일</dt><dd>${h(fmtDate(record.review.checked_at))}</dd></div><div><dt>버전 상태</dt><dd>${h({ current: '현행 근거 확인', historical: '이전 버전', unconfirmed: '현행 여부 미확인' }[record.version.status])}</dd></div>${record.version.label ? `<div><dt>버전 근거</dt><dd>${h(record.version.label)}</dd></div>` : ''}${record.version.introduced_at ? `<div><dt>도입일</dt><dd>${h(fmtDate(record.version.introduced_at))}</dd></div>` : ''}</dl><a href="/mascots/#/guide" class="text-link">확인 상태 읽는 방법 ${icon('right', 16)}</a></div><div class="sidebar-note"><h3>정보가 달라졌나요?</h3><p>새 공식 링크나 변경 내용을 문의 폼으로 알려 주세요.</p><a class="text-link" href="/mascots/#/suggest?id=${h(record.id)}">수정 제보 작성 ${icon('right', 16)}</a></div></aside></div>
    ${related.length ? `<section class="related-section"><div class="section-heading"><h2>같은 기관의 다른 아이덴티티</h2></div><div class="brand-grid">${related.map(renderCard).join('')}</div></section>` : ''}<a href="/mascots/#/" class="back-link">${icon('back', 17)} 전체 마스코트 보기</a></div>`;
    document.title = `${record.name} · 공식 출처와 사용 안내 | LETSUM 마스코트`;
    app.querySelector('[data-copy-source]')?.addEventListener('click', event => copyText(event.currentTarget.dataset.copySource, '공식 출처 링크를 복사했습니다.'));
    app.querySelectorAll('[data-copy-code]').forEach(button => button.addEventListener('click', () => copyText(button.dataset.copyCode, `${button.dataset.copyCode} 복사했습니다.`, '색상 코드 복사', '복사할 색상 코드')));
  }

  function renderGuide() {
    app.innerHTML = `<div class="page-container guide-page" id="main-content" tabindex="-1"><section class="text-hero"><p class="eyebrow">HOW TO USE</p><h1 id="page-heading">출처부터 확인하는<br>마스코트 찾기<span class="accent-dot">.</span></h1><p>필요한 파일을 찾는 일과 이용 조건을 확인하는 일.<br>LETSUM 마스코트에서 함께 살펴보세요.</p></section><div class="guide-grid"><section class="guide-card"><span class="step-number">01</span><h2>기관과 브랜드 찾기</h2><p>기관명·영문명·별칭·초성으로 검색할 수 있습니다. 공공기관, 대학, 기업 등 기관 유형과 분야·형식·지역을 함께 좁혀보세요.</p><code>고양시 AI</code><code>ㄱㅇ</code><code>MIT</code></section><section class="guide-card"><span class="step-number">02</span><h2>자료와 조건 확인하기</h2><p>공식 페이지에 어떤 형식이 안내되어 있는지, 로그인이 필요한지, 별도 승인이 있는지 상세정보에서 확인합니다.</p><span class="example-badge">AI · 제공 안내</span><span class="example-badge">조건별 승인 안내</span></section><section class="guide-card"><span class="step-number">03</span><h2>공식 출처로 이동하기</h2><p>원본 파일은 권리자가 제공하는 공식 페이지에서 확인합니다. 바로 받을 수 있는 파일은 형식 배지와 상세 페이지 버튼으로 연결했습니다.</p><span class="guide-cta">공식 출처에서 확인 ${icon('arrow', 17)}</span></section></div>
    <section class="guide-section"><h2>각 확인 상태는 서로 다른 의미입니다</h2><div class="guide-table-wrap"><table class="guide-table"><thead><tr><th scope="col">표시</th><th scope="col">확인한 내용</th><th scope="col">별도로 확인할 내용</th></tr></thead><tbody><tr><th scope="row">출처 페이지 확인</th><td>출처 페이지의 본문을 읽고 기록했습니다.</td><td>파일 다운로드, 현행 버전, 이용 허가</td></tr><tr><th scope="row">검색 결과 확인</th><td>공식 출처에 관한 검색 결과 범위만 확인했습니다.</td><td>페이지 본문 전체, 파일 다운로드, 현행 버전, 이용 허가</td></tr><tr><th scope="row">AI·SVG·PNG 등 제공 안내</th><td>공식 페이지에 해당 형식이 안내되어 있습니다.</td><td>실제 파일 형식·용량·무결성</td></tr><tr><th scope="row">링크 응답 확인</th><td>연결 대상의 응답을 확인했습니다.</td><td>파일 내용과 사용 조건</td></tr><tr><th scope="row">원본 파일 확인</th><td>파일 형식·용량·SHA-256을 기록했습니다.</td><td>사용 목적에 맞는 이용 허가</td></tr><tr><th scope="row">재검수 필요</th><td>정보가 바뀌어 다시 확인해야 합니다.</td><td>새 출처와 안내 내용 전체</td></tr><tr><th scope="row">현행 여부 미확인</th><td>현행 캐릭터임을 명시하는 근거를 아직 확인하지 못했습니다.</td><td>적용하려는 버전의 유효성</td></tr></tbody></table></div></section>
    <div class="guide-two-column"><section class="guide-section"><h2>기관 유형과 분야를 나눕니다</h2><p>대학은 설립 주체와 관계없이 대학·학교에서 찾습니다. 기업이 운영하는 서비스나 도시 브랜드는 운영 기관에 연결된 별도 아이덴티티로 기록합니다.</p><p>의료·관광·문화 같은 분야는 필터입니다. 기관 수와 아이덴티티 정보 수를 따로 세어 중복을 구분합니다.</p><div class="category-reference">${taxonomy.categories.map(item => `<span>${h(item.label)}</span>`).join('')}</div></section><section class="guide-section"><h2>이미지와 파일을 제공하는 기준</h2><p>현재 자료에는 캐릭터 원본과 썸네일을 포함하지 않았습니다. 카드에는 검색을 위한 기관 이름을 표시합니다.</p><p>이후 미리보기나 파일을 추가할 때는 해당 사용 범위의 근거와 확인일을 별도로 기록합니다. 일반적인 사이트 하단 저작권 문구만으로 캐릭터 이용 조건을 판단하지 않습니다.</p><p>관련 서체는 해당 기관이 공식적으로 배포하는 자료만 연결하며, 캐릭터 적용 서체로 단정하지 않습니다.</p></section></div>
    <section class="notice guide-local"><div>${icon('folder', 24)}</div><div><h2>링크 제보 안내</h2><p>링크 제보는 광고제휴 및 문의 폼으로 보내 주세요. 운영자가 공식 출처와 이용 조건을 확인한 뒤 반영합니다.</p></div></section><div class="guide-bottom"><a class="button dark" href="/mascots/#/">마스코트 찾아보기 ${icon('right', 18)}</a><span>데이터 버전 ${h(catalog.version)} · ${h(fmtDate(catalog.updated_at))}</span></div></div>`;
    document.title = '이용안내 · 정보 확인 기준 | LETSUM 마스코트';
  }

  function renderSuggest(params) {
    const record = publicRecord(params.get('id'));
    app.innerHTML = `<div class="page-container suggest-page" id="main-content" tabindex="-1"><a class="back-link" href="${record ? h(detailHref(record.id)) : '#/'}">${icon('back', 17)} ${record ? '상세정보로 돌아가기' : '마스코트 찾기로 돌아가기'}</a><section class="text-hero"><p class="eyebrow">CONTRIBUTE</p><h1 id="page-heading">공식 링크를 알려주세요<span class="accent-dot">.</span></h1><p>빠진 기관이나 바뀐 정보를 검수용 파일로 정리합니다.</p></section><div class="suggest-layout"><form id="suggest-form" class="form-panel"><label>기관·브랜드 이름 <span class="required">필수</span><input name="name" type="text" required maxlength="160" value="${h(record?.organization_name || '')}" autocomplete="organization" placeholder="예: 고양특례시"></label><label>공식 페이지 주소 <span class="required">필수</span><input name="source_url" type="url" required maxlength="2000" value="${h(record?.source_url || '')}" placeholder="https://" inputmode="url"><span class="field-help">기관·기업이 운영하는 마스코트·브랜드 안내 페이지를 입력해 주세요.</span></label><label>기관 유형<select name="category"><option value="">선택 안 함</option>${taxonomy.categories.map(item => `<option value="${h(item.id)}"${record?.category === item.id ? ' selected' : ''}>${h(item.label)}</option>`).join('')}</select></label><label>확인할 내용 <span class="required">필수</span><textarea name="note" required maxlength="3000" rows="5" placeholder="추가할 캐릭터, 바뀐 링크, 변경된 사용 안내 등을 적어주세요."></textarea></label><p id="suggest-error" class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="button dark">${icon('download', 18)} 제보 파일 저장</button></div><p class="small-copy">JSON 파일을 생성합니다. 이 화면에서는 서버에 제출되지 않습니다.</p></form><aside class="suggest-note"><div class="note-icon">${icon('link', 24)}</div><h2>확인 가능한 출처가<br>좋은 정보의 시작입니다.</h2><p>캐릭터 원본 파일 대신 공식 페이지 주소를 알려주세요. 자료를 추가할 때 제공 형식과 사용 조건을 함께 확인할 수 있습니다.</p><h3>이렇게 작성하면 좋습니다</h3><ul><li>바뀐 공식 페이지 주소</li><li>마스코트·도시 브랜드 구분</li><li>공식 페이지에서 확인한 변경 내용</li></ul><p class="small-copy">불필요한 개인정보는 입력하지 마세요.</p></aside></div></div>`;
    document.title = '공식 링크 제보 작성 | LETSUM 마스코트';
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
    app.innerHTML = `<div class="page-container" id="main-content" tabindex="-1"><div class="empty-state not-found"><p class="eyebrow">NOT FOUND</p><h1 id="page-heading">자료를 찾을 수 없습니다.</h1><p>등록된 아이덴티티인지 검색으로 확인해 주세요.</p><a class="button dark" href="/mascots/#/">마스코트 찾아보기</a></div></div>`;
    document.title = '자료를 찾을 수 없습니다 | LETSUM 마스코트';
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
      const active = nav.dataset.nav === (path === '/guide' ? 'guide' : path === '/' || path === '/saved' || path.startsWith('/brand/') ? 'search' : '');
      if (active) nav.setAttribute('aria-current', 'page'); else nav.removeAttribute('aria-current');
    });
    if (path === '/' || path === '/saved') renderDirectory(params); // /saved: the former bookmarks page now shows the directory
    else if (path.startsWith('/brand/')) {
      let id = ''; try { id = decodeURIComponent(path.slice('/brand/'.length)); } catch { /* invalid path */ }
      const record = publicRecord(id); if (record) renderDetail(record); else renderNotFound();
    } else if (path === '/guide') renderGuide();
    else if (path === '/suggest') { if (boot.production) location.replace('/contact.html'); else renderSuggest(params); }
    else if (path === '/review' && !boot.production) {
      app.innerHTML = `<div class="page-container review-page" id="main-content" tabindex="-1">${renderReview({catalog, sources, taxonomy, catalogSha256})}</div>`;
      cleanupRoute = bindReview({ root: app, catalog, sources, taxonomy, catalogSha256, notify });
      document.title = '로컬 검수 도구 | LETSUM 마스코트';
    } else renderNotFound();
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

  window.addEventListener('hashchange', renderRoute);
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    const input = app.querySelector('#logo-query');
    if (input) { event.preventDefault(); input.focus(); }
  });
  document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); app.querySelector('#main-content')?.focus(); });
  renderRoute();
})();

