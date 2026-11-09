import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_ROOT } from '../scripts/lib.mjs';
export async function taxonomyFixture() { return JSON.parse(await readFile(path.join(PROJECT_ROOT, 'data', 'taxonomy.json'), 'utf8')); }
export function recordFixture(overrides = {}) {
  const id = overrides.id ?? 'ganada-university';
  const base = {
    id, organization_id: 'ganada-university', organization_name: '가나다대학교', name: '가나다대학교 로고', name_en: 'Ganada University', aliases: ['가나다대'], category: 'education', kind: 'organization', sectors: ['education'], country: 'KR', region: '서울', summary: '테스트용 공식 자료 안내입니다.', source_ids: ['official-one'], source_url: 'https://example.org/identity', guideline_url: 'https://example.org/identity',
    assets: [{ id: `${id}-asset`, label: '로고타입', form: 'wordmark', listed_formats: ['AI', 'PNG'], verified_format: null, size_bytes: null, sha256: null, download_url: null, access: 'public', source_id: 'official-one', file_verification: 'page-listed' }],
    usage: { summary: '이용조건 원문 확인 필요', approval: 'unknown', redistribution: 'unknown', preview: 'unknown', policy_url: 'https://example.org/identity' },
    version: { status: 'unconfirmed', introduced_at: null, label: null },
    review: { status: 'source-reviewed', checked_at: '2026-11-09', source_scope: 'page' }, related_fonts: []
  };
  return { ...base, ...overrides, usage: { ...base.usage, ...overrides.usage }, version: { ...base.version, ...overrides.version }, review: { ...base.review, ...overrides.review } };
}
export async function dataFixture(records = [recordFixture()]) {
  return {
    catalog: { schema_version: '1.0', version: '0.1.0', updated_at: '2026-11-09', scope_note: 'Synthetic offline test fixtures, not production evidence.', records },
    sources: { updated_at: '2026-11-09', sources: [{ id: 'official-one', title: 'Synthetic source page', url: 'https://example.org/identity', publisher: 'Fixture', language: 'ko', checked_at: '2026-11-09', scope: 'page', observation: 'Synthetic test evidence only.', note: 'No network request is made.' }] },
    taxonomy: await taxonomyFixture()
  };
}
export async function writeData(root, data) {
  await mkdir(path.join(root, 'data'), { recursive: true });
  for (const [name, value] of Object.entries(data)) await writeFile(path.join(root, 'data', `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}
