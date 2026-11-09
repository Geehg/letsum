import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { applyReviewPatches, importReviewFile } from '../scripts/import-review.mjs';
import { canonicalSha256 } from '../scripts/lib.mjs';
import { dataFixture, writeData } from './helpers.mjs';
function patchFor(catalog, changes, extra = {}) {
  return { schema_version: '1.0', dataset_version: catalog.version, base_sha256: canonicalSha256(catalog), created_at: '2026-11-09T01:00:00.000Z', patches: [{ id: catalog.records[0].id, changes, review_note: 'Synthetic offline review note.' }], ...extra };
}
test('meaningful review patches invalidate review, keep unknown permissions and leave binary metadata null', async () => {
  const data = await dataFixture();
  const result = applyReviewPatches({ ...data, patchDocument: patchFor(data.catalog, { name: '가나다대학교 새 표시명', usage: { summary: '원문 조건 재확인 필요' } }), now: new Date('2026-11-09T01:00:00Z') });
  const record = result.catalog.records[0];
  assert.deepEqual(record.review, { status: 'needs-review', checked_at: null, source_scope: null });
  assert.equal(record.usage.preview, 'unknown'); assert.equal(record.usage.redistribution, 'unknown');
  assert.equal(record.assets[0].verified_format, null); assert.equal(record.assets[0].sha256, null); assert.equal(record.assets[0].size_bytes, null);
  assert.equal(data.catalog.records[0].name, '가나다대학교 로고');
  assert.equal(result.report.mode, 'dry-run'); assert.equal(result.report.changed, true);
});
test('metadata-only notes retain review and do not change the catalog hash', async () => {
  const data = await dataFixture();
  const result = applyReviewPatches({ ...data, patchDocument: patchFor(data.catalog, {}) });
  assert.deepEqual(result.catalog, data.catalog);
  assert.equal(result.report.changed, false);
  assert.equal(result.report.base_sha256, result.report.result_sha256);
  assert.equal(result.report.changes[0].review_note, 'Synthetic offline review note.');
});
test('stale hash and version reject without changing the catalog', async () => {
  const data = await dataFixture(), before = JSON.stringify(data.catalog);
  assert.throws(() => applyReviewPatches({ ...data, patchDocument: patchFor(data.catalog, { summary: 'Changed' }, { base_sha256: '0'.repeat(64) }) }), /SHA-256 mismatch/);
  assert.throws(() => applyReviewPatches({ ...data, patchDocument: patchFor(data.catalog, { summary: 'Changed' }, { dataset_version: '0.0.9' }) }), /version mismatch/);
  assert.equal(JSON.stringify(data.catalog), before);
});
test('permission, file-verification, review-date and version promotion fields are forbidden', async () => {
  const data = await dataFixture();
  const forbidden = [{ usage: { preview: 'permitted' } }, { usage: { redistribution: 'permitted' } }, { usage: { approval: 'not-stated' } }, { review: { status: 'source-reviewed' } }, { assets: [] }, { version: { status: 'current' } }, { source_ids: ['new-source'] }, { related_fonts: [] }];
  for (const changes of forbidden) assert.throws(() => applyReviewPatches({ ...data, patchDocument: patchFor(data.catalog, changes) }), /Invalid review patch/);
});
test('nested prototype and unexpected patch fields are rejected', async () => {
  const data = await dataFixture();
  const malicious = JSON.parse('{"__proto__":{"preview":"permitted"}}');
  assert.throws(() => applyReviewPatches({ ...data, patchDocument: patchFor(data.catalog, malicious) }), /unexpected property/);
});
test('duplicate or unknown patch targets and invalid categories fail', async () => {
  const data = await dataFixture();
  const duplicate = patchFor(data.catalog, {}); duplicate.patches.push(structuredClone(duplicate.patches[0]));
  assert.throws(() => applyReviewPatches({ ...data, patchDocument: duplicate }), /Duplicate patch target/);
  const unknown = patchFor(data.catalog, {}); unknown.patches[0].id = 'missing-record';
  assert.throws(() => applyReviewPatches({ ...data, patchDocument: unknown }), /Unknown patch target/);
  assert.throws(() => applyReviewPatches({ ...data, patchDocument: patchFor(data.catalog, { category: 'university' }) }), /unsupported value/);
});
test('a replacement source URL forces review and is retained as a warning until evidence is linked', async () => {
  const data = await dataFixture();
  const result = applyReviewPatches({ ...data, patchDocument: patchFor(data.catalog, { source_url: 'https://example.org/new-source' }) });
  assert.equal(result.catalog.records[0].review.status, 'needs-review');
  assert.ok(result.report.warnings.some(warning => warning.includes('source_url')));
});
test('importer defaults to dry-run; explicit write only changes local catalog and writes an audit report', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'letsum-import-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const data = await dataFixture(); await writeData(root, data);
  const patchFile = path.join(root, 'patch.json'); await writeFile(patchFile, JSON.stringify(patchFor(data.catalog, { summary: 'Changed after a human review request' })));
  const catalogFile = path.join(root, 'data/catalog.json'), original = await readFile(catalogFile, 'utf8');
  const dry = await importReviewFile({ patchFile, root });
  assert.equal(dry.mode, 'dry-run'); assert.equal(await readFile(catalogFile, 'utf8'), original);
  assert.equal((await readdir(root)).includes('reports'), false);
  const written = await importReviewFile({ patchFile, root, write: true, now: new Date('2026-11-09T01:00:00Z') });
  assert.equal(written.mode, 'local-write'); assert.ok(written.report_file);
  const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
  assert.equal(catalog.records[0].review.status, 'needs-review');
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'data/sources.json'), 'utf8')), data.sources);
  await assert.rejects(importReviewFile({ patchFile, root, write: true }), /SHA-256 mismatch/);
});

test('editing a previously current record conservatively invalidates its current claim', async () => {
  const data = await dataFixture();
  data.catalog.records[0].version = { status: 'current', introduced_at: null, label: '공식 페이지의 현행 안내 근거' };
  const result = applyReviewPatches({ ...data, patchDocument: patchFor(data.catalog, { summary: '재검토할 설명' }) });
  assert.equal(result.catalog.records[0].version.status, 'unconfirmed');
  assert.equal(result.report.changes[0].current_status_invalidated, true);
  assert.equal(result.catalog.records[0].review.checked_at, null);
  assert.equal(data.catalog.records[0].version.status, 'current');
});
