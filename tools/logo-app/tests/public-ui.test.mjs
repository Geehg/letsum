import test from 'node:test';
import assert from 'node:assert/strict';
import { dataFixture, recordFixture } from './helpers.mjs';
import { runPublicUi } from './public-ui-fixture.mjs';
function cardHtml(html, id) { return html.match(new RegExp(`<article[^>]+data-record="${id}"[\\s\\S]*?<\\/article>`))?.[0] ?? ''; }
function categoryCount(html, id) { return Number(html.match(new RegExp(`<button[^>]+data-category="${id}"[^>]*>[\\s\\S]*?<span>(\\d+)<\\/span><\\/button>`))?.[1]); }
async function savedFixture() {
  return dataFixture([
    recordFixture({ id: 'saved-education' }),
    recordFixture({ id: 'unsaved-education', organization_id: 'other-university', organization_name: '다른대학교', name: '다른대학교 로고' }),
    recordFixture({ id: 'saved-business', organization_id: 'test-company', organization_name: '테스트회사', name: '테스트회사 CI', category: 'business' }),
    recordFixture({ id: 'hidden-draft', organization_id: 'draft-org', review: { status: 'draft', checked_at: null, source_scope: null } }),
    recordFixture({ id: 'hidden-archived', organization_id: 'archived-org', review: { status: 'archived' } })
  ]);
}
test('actual public cards distinguish search-scope evidence from a page read', async () => {
  const data = await dataFixture([recordFixture({ review: { source_scope: 'search' } })]);
  data.sources.sources[0].scope = 'search';
  const ui = await runPublicUi(data);
  const card = cardHtml(ui.app.innerHTML, 'ganada-university');
  assert.match(card, /검색 결과 확인/);
  assert.equal(card.includes('출처 페이지 확인'), false);
});
test('initial bookmarks exclude missing, draft and archived records', async () => {
  const data = await savedFixture();
  const ui = await runPublicUi(data, { route: '/saved', saved: ['saved-education', 'saved-business', 'hidden-draft', 'hidden-archived', 'missing'] });
  assert.equal(ui.savedCount.textContent, '2');
  assert.match(ui.app.innerHTML, /data-record="saved-education"/);
  assert.match(ui.app.innerHTML, /data-record="saved-business"/);
  assert.equal(ui.app.innerHTML.includes('data-record="hidden-draft"'), false);
  assert.equal(ui.app.innerHTML.includes('data-record="hidden-archived"'), false);
});
test('saved category counts describe the saved collection instead of the full catalog', async () => {
  const data = await savedFixture();
  const ui = await runPublicUi(data, { route: '/saved', saved: ['saved-education', 'saved-business'] });
  assert.equal(categoryCount(ui.app.innerHTML, 'all'), 2);
  assert.equal(categoryCount(ui.app.innerHTML, 'education'), 1);
  assert.equal(categoryCount(ui.app.innerHTML, 'business'), 1);
});
test('catalog update date is not presented as a global source verification date', async () => {
  const data = await dataFixture([recordFixture({ review: { checked_at: '2020-01-02' } })]);
  data.catalog.updated_at = '2026-11-09';
  const ui = await runPublicUi(data);
  const hero = ui.app.innerHTML.match(/<section class="directory-hero">[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(hero, /데이터 (?:갱신|업데이트|수정)일\s*2026\.11\.09/);
  assert.equal(hero.includes('출처 확인일 2026.11.09'), false);
  assert.match(cardHtml(ui.app.innerHTML, 'ganada-university'), /2020\.01\.02/);
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
test('saved link export contains only public bookmarks and no permission grant', async () => {
  const data = await savedFixture();
  const ui = await runPublicUi(data, { route: '/saved', saved: ['saved-education', 'hidden-draft', 'hidden-archived'] });
  ui.app.querySelector('#export-saved').click();
  assert.equal(ui.objectUrls.length, 1);
  const output = JSON.parse(await ui.objectUrls[0].blob.text());
  assert.deepEqual(output.records.map(record => record.id), ['saved-education']);
  assert.match(output.note, /이용 허가를 포함하지 않습니다/);
});
for (const failure of ['create', 'click']) {
  test(`saved export reports a ${failure} failure without claiming a successful save`, async () => {
    const ui = await runPublicUi(await dataFixture(), { route: '/saved', saved: ['ganada-university'], downloadFailure: failure });
    assert.doesNotThrow(() => ui.app.querySelector('#export-saved').click());
    assert.match(ui.toast.textContent, /실패|저장하지 못|저장할 수 없|다운로드.*못/);
    assert.equal(/저장했습니다|저장을 시작|다운로드를 시작/.test(ui.toast.textContent), false);
  });
}
test('suggestion export reports download failure instead of claiming submission or saving', async () => {
  const ui = await runPublicUi(await dataFixture(), { route: '/suggest', downloadFailure: 'create' });
  const form = ui.app.querySelector('#suggest-form');
  form.formValues = { name: '테스트기관', source_url: 'https://example.org/identity', category: 'education', note: '새 자료를 검토해 주세요.' };
  assert.doesNotThrow(() => form.dispatch('submit'));
  const message = `${ui.toast.textContent} ${ui.app.querySelector('#suggest-error').textContent}`;
  assert.match(message, /실패|저장하지 못|저장할 수 없|다운로드.*못/);
  assert.equal(/제보 파일을 저장했습니다/.test(message), false);
});
