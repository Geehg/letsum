import test from 'node:test';
import assert from 'node:assert/strict';
import { dataFixture, recordFixture } from './helpers.mjs';
import { runPublicUi } from './public-ui-fixture.mjs';
function cardHtml(html, id) { return html.match(new RegExp(`<article[^>]+data-record="${id}"[\\s\\S]*?<\\/article>`))?.[0] ?? ''; }
async function hiddenFixture() {
  return dataFixture([
    recordFixture({ id: 'shown-education' }),
    recordFixture({ id: 'other-education', organization_id: 'other-university', organization_name: '다른대학교', name: '다른대학교 로고' }),
    recordFixture({ id: 'shown-business', organization_id: 'test-company', organization_name: '테스트회사', name: '테스트회사 CI', category: 'business' }),
    recordFixture({ id: 'hidden-draft', organization_id: 'draft-org', review: { status: 'draft', checked_at: null, source_scope: null } }),
    recordFixture({ id: 'hidden-archived', organization_id: 'archived-org', review: { status: 'archived' } })
  ]);
}
// Cards show only name, category and formats; review scope and dates live on the detail page.
test('detail pages distinguish search-scope evidence from a page read', async () => {
  const data = await dataFixture([recordFixture({ review: { source_scope: 'search' } })]);
  data.sources.sources[0].scope = 'search';
  const ui = await runPublicUi(data, { route: '/brand/ganada-university' });
  const heading = ui.app.innerHTML.match(/<section class="detail-heading">[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(heading, /검색 결과 확인/);
  assert.equal(heading.includes('출처 페이지 확인'), false);
});
test('catalog update date is not presented as a global source verification date', async () => {
  const data = await dataFixture([recordFixture({ review: { checked_at: '2020-01-02' } })]);
  data.catalog.updated_at = '2026-11-09';
  const ui = await runPublicUi(data);
  const hero = ui.app.innerHTML.match(/<section class="directory-hero">[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(hero, /데이터 (?:갱신|업데이트|수정)일\s*2026\.11\.09/);
  assert.equal(hero.includes('출처 확인일 2026.11.09'), false);
  const detail = await runPublicUi(data, { route: '/brand/ganada-university' });
  assert.match(detail.app.innerHTML, /2020\.01\.02/);
});
test('public markup escapes record and query HTML and refuses executable link URLs', async () => {
  const record = recordFixture({ name: '"><img src=x onerror="globalThis.pwned=1">', organization_name: '</a><script>globalThis.pwned=2</script>', summary: '<svg onload="globalThis.pwned=3">', source_url: 'javascript:alert(1)', guideline_url: 'data:text/html,evil' });
  const data = await dataFixture([record]);
  const ui = await runPublicUi(data, { route: '/brand/ganada-university' });
  assert.equal(ui.app.innerHTML.includes('<img src=x'), false);
  assert.equal(ui.app.innerHTML.includes('<script>globalThis'), false);
  assert.equal(ui.app.innerHTML.includes('<svg onload='), false);
  assert.equal(/href=["'](?:javascript:|data:)/i.test(ui.app.innerHTML), false);
  assert.match(ui.app.innerHTML, /&lt;img/);
  assert.equal(ui.context.pwned, undefined);
  const query = await runPublicUi(await dataFixture(), { route: '/?q=%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E' });
  assert.equal(query.app.innerHTML.includes('<img src=x'), false);
  assert.match(query.app.innerHTML, /&lt;img/);
});
test('suggestion export reports download failure instead of claiming submission or saving', async () => {
  const ui = await runPublicUi(await dataFixture(), { route: '/suggest', downloadFailure: 'create' });
  const form = ui.app.querySelector('#suggest-form');
  form.formValues = { name: '테스트기관', source_url: 'https://example.org/identity', category: 'education', note: '새 자료를 검토해 주세요.' };
  assert.doesNotThrow(() => form.dispatch('submit'));
  const message = `${ui.toast.textContent} ${ui.app.querySelector('#suggest-error').textContent}`;
  assert.match(message, /실패|저장하지 못|저장할 수 없|다운로드.*못/);
  assert.equal(/제보 파일을 저장했습니다/.test(message), false);
});
test('bookmarks are gone: no save buttons, cards link to the official source, the old /saved route shows the directory', async () => {
  const ui = await runPublicUi(await dataFixture(), { route: '/saved' });
  assert.equal(ui.app.innerHTML.includes('data-save'), false);
  assert.equal(ui.app.innerHTML.includes('card-footer'), false);
  assert.match(ui.app.innerHTML, /class="bookmark-button source-icon" href="https:/);
  assert.match(ui.app.innerHTML, /로고·CI 둘러보기/);
});
test('the directory leaves out draft and archived records', async () => {
  const ui = await runPublicUi(await hiddenFixture(), { route: '/' });
  assert.match(ui.app.innerHTML, /data-record="shown-education"/);
  assert.match(ui.app.innerHTML, /data-record="shown-business"/);
  assert.equal(ui.app.innerHTML.includes('data-record="hidden-draft"'), false);
  assert.equal(ui.app.innerHTML.includes('data-record="hidden-archived"'), false);
});
