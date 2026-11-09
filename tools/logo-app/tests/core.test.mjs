import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeText, getChoseong, searchScore, filterRecords, getFormats, summarize, safeUrl, escapeHtml, validateCatalog, validateAgainstSchema, CATALOG_SCHEMA, SOURCES_SCHEMA, TAXONOMY_SCHEMA, REVIEW_PATCH_SCHEMA } from '../src/core.js';
import { PROJECT_ROOT } from '../scripts/lib.mjs';
import { recordFixture, dataFixture, taxonomyFixture } from './helpers.mjs';

test('normalization handles full-width Latin and Hangul initial queries', () => {
  assert.equal(normalizeText('  ＡＩ   가나다대  '), 'ai 가나다대');
  assert.equal(getChoseong('서울대 KAI'), 'ㅅㅇㄷ kai');
  assert.equal(normalizeText('ㅅㅇㄷ'), 'ㅅㅇㄷ');
});
test('search requires all text tokens and all standalone format tokens', () => {
  const record = recordFixture();
  assert.ok(searchScore(record, '가나다 AI PNG') > 0);
  assert.equal(searchScore(record, '가나다 AI SVG'), 0);
  assert.equal(searchScore(record, '가나다 부산'), 0);
  assert.ok(searchScore(record, 'ㄱㄴㄷㄷ') > 0);
  assert.ok(searchScore(record, 'GANADA university') > 0);
});
test('AI in KAI is a name, while standalone AI filters offered formats', () => {
  const kai = recordFixture({ id: 'kai-test', name: 'KAI 테스트 로고', organization_name: 'KAI 테스트', name_en: 'KAI', aliases: [], assets: [{ ...recordFixture().assets[0], id: 'kai-test-asset', listed_formats: ['PNG'] }] });
  assert.ok(searchScore(kai, 'KAI') > 0);
  assert.equal(searchScore(kai, 'AI'), 0);
  assert.equal(searchScore(kai, 'KAI AI'), 0);
  assert.ok(searchScore(kai, 'KAI PNG') > 0);
});
test('exact official names and aliases outrank substring results', () => {
  const exact = recordFixture({ id: 'exact', name: '가나다대', organization_name: '가나다대', aliases: [] });
  const substring = recordFixture({ id: 'substring', name: '가나다대 축제', organization_name: '가나다대 축제', aliases: [] });
  assert.equal(filterRecords([substring, exact], { q: '가나다대' })[0].id, 'exact');
});
test('public filtering excludes draft and archived; historical is opt-in; needs-review stays visible', () => {
  const records = [recordFixture(), recordFixture({ id: 'draft', review: { status: 'draft', checked_at: null, source_scope: null } }), recordFixture({ id: 'archived', review: { status: 'archived' } }), recordFixture({ id: 'history', version: { status: 'historical' } }), recordFixture({ id: 'review', review: { status: 'needs-review', checked_at: null, source_scope: null } })];
  assert.deepEqual(new Set(filterRecords(records).map(row => row.id)), new Set(['ganada-university', 'review']));
  assert.equal(filterRecords(records, { includeHistorical: true }).length, 3);
});
test('filter axes combine, saved selection works, sorting does not mutate data', () => {
  const first = recordFixture({ id: 'first', name: '나 로고', review: { checked_at: '2026-11-08' } });
  const second = recordFixture({ id: 'second', name: '가 로고', region: '경기', review: { checked_at: '2026-11-09' } });
  const records = [first, second], before = JSON.stringify(records);
  assert.equal(filterRecords(records, { region: '경기', category: 'education', format: 'AI' })[0].id, 'second');
  assert.equal(filterRecords(records, { region: '경기', category: 'business' }).length, 0);
  assert.deepEqual(filterRecords(records, { savedOnly: true, savedIds: ['first'] }).map(row => row.id), ['first']);
  assert.equal(filterRecords(records, { sort: 'name' })[0].id, 'second');
  assert.equal(filterRecords(records, { sort: 'checked' })[0].id, 'second');
  assert.equal(JSON.stringify(records), before);
});
test('summary counts unique organizations, not brand records or files', () => {
  const a = recordFixture(), b = recordFixture({ id: 'same-org-brand', kind: 'campaign' });
  assert.deepEqual(summarize([a, b]), { records: 2, organizations: 1, categories: 1, formats: 2 });
  assert.deepEqual(getFormats(a), ['AI', 'PNG']);
});
test('unsafe URLs and HTML content are neutralized', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,evil', '#section', '//example.org/x', 'https://user:pass@example.org', 'https://user@example.org', 'https://example.org/\nnext', 'https://example.org/\\evil', ' https://example.org']) assert.equal(safeUrl(value), null, value);
  assert.equal(safeUrl('https://example.org/path?q=1#section'), 'https://example.org/path?q=1#section');
  assert.equal(escapeHtml('<script a="x">&\'</script>'), '&lt;script a=&quot;x&quot;&gt;&amp;&#39;&lt;/script&gt;');
});
test('valid fixture, seven categories and eighteen sector labels match schema', async () => {
  const { catalog, sources, taxonomy } = await dataFixture();
  assert.deepEqual(validateCatalog(catalog, sources, taxonomy), { errors: [], warnings: [] });
  assert.equal(taxonomy.categories.length, 7);
  assert.equal(taxonomy.sectors.length, 18);
  assert.equal(taxonomy.sectors.find(row => row.id === 'international-cooperation').label, '국제협력·외교');
});
test('a page-listed file may have an unknown format without inventing one', async () => {
  const data = await dataFixture();
  data.catalog.records[0].assets[0].listed_formats = [];
  assert.deepEqual(validateCatalog(data.catalog, data.sources, data.taxonomy).errors, []);
});
test('file size/hash/verified format are forbidden until actual file verification', async () => {
  for (const [key, value] of [['size_bytes', 100], ['sha256', 'a'.repeat(64)], ['verified_format', 'AI']]) {
    const data = await dataFixture();
    data.catalog.records[0].assets[0][key] = value;
    assert.ok(validateCatalog(data.catalog, data.sources, data.taxonomy).errors.some(error => error.includes(key)));
    assert.ok(validateAgainstSchema(data.catalog, CATALOG_SCHEMA).length > 0);
  }
  const data = await dataFixture();
  Object.assign(data.catalog.records[0].assets[0], { file_verification: 'file-verified', size_bytes: 100, sha256: 'a'.repeat(64), verified_format: 'AI', download_url: 'https://example.org/file.ai' });
  assert.deepEqual(validateCatalog(data.catalog, data.sources, data.taxonomy).errors, []);
});
test('wrong categories, sectors, statuses and invented properties are rejected', async () => {
  for (const change of [record => { record.category = 'university'; }, record => { record.sectors = ['made-up']; }, record => { record.version.status = 'latest'; }, record => { record.usage.approval = 'free'; }, record => { record.preview_image = 'https://example.org/logo.png'; }]) {
    const data = await dataFixture(); change(data.catalog.records[0]);
    assert.ok(validateCatalog(data.catalog, data.sources, data.taxonomy).errors.length > 0);
  }
});
test('source references, unique IDs and organization category consistency are enforced', async () => {
  const data = await dataFixture();
  data.catalog.records[0].source_ids = ['missing'];
  assert.ok(validateCatalog(data.catalog, data.sources, data.taxonomy).errors.some(error => error.includes('unknown source')));
  const duplicate = await dataFixture([recordFixture(), recordFixture()]);
  assert.ok(validateCatalog(duplicate.catalog, duplicate.sources, duplicate.taxonomy).errors.some(error => error.includes('duplicate record')));
  const split = await dataFixture([recordFixture(), recordFixture({ id: 'same-org-brand', category: 'business' })]);
  assert.ok(validateCatalog(split.catalog, split.sources, split.taxonomy).errors.some(error => error.includes('multiple primary categories')));
});
test('review metadata and current-version claims require explicit evidence fields', async () => {
  const data = await dataFixture();
  data.catalog.records[0].review.checked_at = null;
  assert.ok(validateCatalog(data.catalog, data.sources, data.taxonomy).errors.some(error => error.includes('checked_at')));
  const current = await dataFixture(); current.catalog.records[0].version.status = 'current';
  assert.ok(validateCatalog(current.catalog, current.sources, current.taxonomy).errors.some(error => error.includes('label')));
});
test('new source URL is an error when source-reviewed and a warning while awaiting review', async () => {
  const data = await dataFixture();
  data.catalog.records[0].source_url = 'https://example.org/new-source';
  assert.ok(validateCatalog(data.catalog, data.sources, data.taxonomy).errors.some(error => error.includes('source_url')));
  Object.assign(data.catalog.records[0].review, { status: 'needs-review', checked_at: null, source_scope: null });
  const result = validateCatalog(data.catalog, data.sources, data.taxonomy);
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some(warning => warning.includes('source_url')));
});
test('unknown permissions are not mutated; permitted requires matching page evidence', async () => {
  const data = await dataFixture(), before = JSON.stringify(data.catalog);
  validateCatalog(data.catalog, data.sources, data.taxonomy);
  assert.equal(JSON.stringify(data.catalog), before);
  data.catalog.records[0].usage.preview = 'permitted';
  data.catalog.records[0].usage.policy_url = null;
  assert.ok(validateCatalog(data.catalog, data.sources, data.taxonomy).errors.some(error => error.includes('policy')));
});
test('schema files are identical to the schemas actually used by the validator', async () => {
  for (const [name, expected] of Object.entries({ catalog: CATALOG_SCHEMA, sources: SOURCES_SCHEMA, taxonomy: TAXONOMY_SCHEMA, 'review-patch': REVIEW_PATCH_SCHEMA })) {
    assert.deepEqual(JSON.parse(await readFile(path.join(PROJECT_ROOT, 'schemas', `${name}.schema.json`), 'utf8')), expected);
  }
});
test('invalid dates and duplicate taxonomy IDs are rejected', async () => {
  const data = await dataFixture(); data.catalog.updated_at = '2026-02-30';
  assert.ok(validateCatalog(data.catalog, data.sources, data.taxonomy).errors.some(error => error.includes('calendar date')));
  const taxonomy = await taxonomyFixture(); taxonomy.categories[1] = { ...taxonomy.categories[0] };
  assert.ok(validateCatalog((await dataFixture()).catalog, (await dataFixture()).sources, taxonomy).errors.some(error => error.includes('duplicate id')));
});
