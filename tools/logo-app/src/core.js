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

export function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').replace(/[\u1100-\u1112]/g, c => INITIALS[c.charCodeAt(0) - 0x1100]).toLowerCase().replace(/\s+/gu, ' ').trim();
}

export function getChoseong(value) {
  return [...normalizeText(value)].map(c => {
    const code = c.charCodeAt(0);
    return code >= 0xAC00 && code <= 0xD7A3 ? INITIALS[Math.floor((code - 0xAC00) / 588)] : c;
  }).join('');
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function safeUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007F-\u009F\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function getFormats(record) {
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

export function searchScore(record, query) {
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

export function filterRecords(records, filters = {}) {
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

export function summarize(records) {
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
export const CATALOG_SCHEMA = { ...schemaBase, title: 'LETSUM logo catalog 1.0', ...objectSchema({ schema_version: { const: '1.0' }, version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' }, updated_at: dateSchema, scope_note: textSchema, records: { type: 'array', items: recordSchema } }) };
const sourceSchema = objectSchema({ id: idSchema, title: textSchema, url: urlSchema, publisher: textSchema, language: textSchema, checked_at: dateSchema, scope: enumeration(['page', 'search']), observation: textSchema, note: { type: 'string' } });
export const SOURCES_SCHEMA = { ...schemaBase, title: 'LETSUM public source evidence 1.0', ...objectSchema({ updated_at: dateSchema, sources: { type: 'array', items: sourceSchema } }) };
const labelsSchema = codes => ({ type: 'array', items: objectSchema({ id: enumeration(codes), label: textSchema }), minItems: codes.length, maxItems: codes.length });
export const TAXONOMY_SCHEMA = { ...schemaBase, title: 'LETSUM logo taxonomy 1.0', ...objectSchema({ categories: labelsSchema(CATEGORY_IDS), sectors: labelsSchema(SECTOR_IDS), asset_forms: labelsSchema(ASSET_FORMS), formats: { type: 'array', items: formatSchema, minItems: FORMAT_LABELS.length, maxItems: FORMAT_LABELS.length, uniqueItems: true }, access: labelsSchema(ACCESS_IDS), identity_kinds: labelsSchema(KIND_IDS) }) };
const patchChangesProperties = Object.fromEntries(['name', 'name_en', 'aliases', 'category', 'kind', 'sectors', 'country', 'region', 'summary', 'source_url', 'guideline_url'].map(key => [key, recordSchema.properties[key]]));
patchChangesProperties.usage = objectSchema({ summary: textSchema });
export const REVIEW_PATCH_SCHEMA = { ...schemaBase, title: 'LETSUM local review patch 1.0', ...objectSchema({
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

export function validateAgainstSchema(value, schema, path = '$') {
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

export function validateCatalog(catalog, sources, taxonomy) {
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
