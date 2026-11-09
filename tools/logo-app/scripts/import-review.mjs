import path from 'node:path';
import { readFile, rename, writeFile, mkdir, open } from 'node:fs/promises';
import { validateCatalog, validateAgainstSchema, REVIEW_PATCH_SCHEMA } from '../src/core.js';
import { PROJECT_ROOT, loadData, readJson, canonicalSha256, isMain, argsOf, reportFailure } from './lib.mjs';

function koreanDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = kind => parts.find(part => part.type === kind).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function applyReviewPatches({ catalog, sources, taxonomy, patchDocument, now = new Date() }) {
  const patchErrors = validateAgainstSchema(patchDocument, REVIEW_PATCH_SCHEMA, 'patch');
  if (patchErrors.length) throw new Error(`Invalid review patch:\n${patchErrors.join('\n')}`);
  const baseline = validateCatalog(catalog, sources, taxonomy);
  if (baseline.errors.length) throw new Error(`Base catalog is invalid:\n${baseline.errors.join('\n')}`);
  if (patchDocument.dataset_version !== catalog.version) throw new Error('Dataset version mismatch; re-export from the current catalog');
  const beforeHash = canonicalSha256(catalog);
  if (patchDocument.base_sha256 !== beforeHash) throw new Error('Base SHA-256 mismatch; re-export from the current catalog. No changes applied.');
  const next = structuredClone(catalog), recordMap = new Map(next.records.map(record => [record.id, record]));
  const ids = new Set(), changes = [];
  for (const patch of patchDocument.patches) {
    if (ids.has(patch.id)) throw new Error(`Duplicate patch target: ${patch.id}`);
    ids.add(patch.id);
    const record = recordMap.get(patch.id);
    if (!record) throw new Error(`Unknown patch target: ${patch.id}`);
    const modifiedFields = [];
    for (const [key, value] of Object.entries(patch.changes)) {
      if (key === 'usage') {
        if (record.usage.summary !== value.summary) { record.usage.summary = value.summary; modifiedFields.push('usage.summary'); }
      } else if (JSON.stringify(record[key]) !== JSON.stringify(value)) {
        record[key] = structuredClone(value);
        modifiedFields.push(key);
      }
    }
    let currentStatusInvalidated = false;
    if (modifiedFields.length) {
      record.review = { status: 'needs-review', checked_at: null, source_scope: null };
      // A current-version assertion may not survive invalidation of its reviewed page evidence.
      // This is a conservative downgrade, never an automatic current-version promotion.
      if (record.version.status === 'current') { record.version.status = 'unconfirmed'; currentStatusInvalidated = true; }
    }
    changes.push({ id: patch.id, modified_fields: modifiedFields, review_note: patch.review_note, review_invalidated: modifiedFields.length > 0, current_status_invalidated: currentStatusInvalidated });
  }
  const changed = changes.some(change => change.modified_fields.length > 0);
  if (changed) next.updated_at = koreanDate(now);
  const validation = validateCatalog(next, sources, taxonomy);
  if (validation.errors.length) throw new Error(`Patched catalog failed validation:\n${validation.errors.join('\n')}`);
  return {
    catalog: next,
    report: { schema_version: '1.0', processed_at: now.toISOString(), mode: 'dry-run', dataset_version: catalog.version, base_sha256: beforeHash, result_sha256: canonicalSha256(next), changed, changes, warnings: validation.warnings, note: 'Local data review only. Permissions, file verification and version flags cannot be elevated by a patch; no production publication.' }
  };
}

export async function importReviewFile({ patchFile, write = false, root = PROJECT_ROOT, now = new Date() }) {
  const data = await loadData(root);
  const patchDocument = await readJson(patchFile);
  const result = applyReviewPatches({ ...data, patchDocument, now });
  if (!write) return result.report;
  const catalogFile = path.join(root, 'data', 'catalog.json');
  const latest = JSON.parse(await readFile(catalogFile, 'utf8'));
  if (canonicalSha256(latest) !== result.report.base_sha256) throw new Error('Catalog changed during import; no changes applied');
  if (result.report.changed) {
    const temporary = `${catalogFile}.review-${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(result.catalog, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    // Recheck immediately before replacement; do not overwrite a concurrent human update.
    if (canonicalSha256(JSON.parse(await readFile(catalogFile, 'utf8'))) !== result.report.base_sha256) {
      await (await import('node:fs/promises')).unlink(temporary);
      throw new Error('Catalog changed during write; no changes applied');
    }
    await rename(temporary, catalogFile);
  }
  result.report.mode = 'local-write';
  const reportDir = path.join(root, 'reports');
  await mkdir(reportDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(reportDir, `review-import-${stamp}-${process.pid}.json`);
  const handle = await open(reportFile, 'wx');
  try { await handle.writeFile(`${JSON.stringify(result.report, null, 2)}\n`, 'utf8'); } finally { await handle.close(); }
  return { ...result.report, report_file: reportFile };
}
if (isMain(import.meta.url)) {
  try {
    const args = argsOf(process.argv.slice(2), { '--file': 'value', '--write': 'flag' });
    if (!args['--file']) throw new Error('Usage: npm run import-review -- --file review-patch.json [--write]\nDefault is dry-run; --write updates local catalog only.');
    const report = await importReviewFile({ patchFile: path.resolve(args['--file']), write: Boolean(args['--write']) });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) { reportFailure(error); }
}
