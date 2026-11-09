import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyResponse, checkSource, fixtureFetch, runSourceChecks } from '../scripts/check-links.mjs';
const base = 'https://example.org';
const fixtures = {
  [`${base}/ok`]: { status: 200, headers: { 'content-type': 'text/html' }, body: '<title>Official identity guide</title><a>로그인</a>' },
  [`${base}/old`]: { status: 302, headers: { location: '/ok' } },
  [`${base}/forbidden`]: { status: 403 },
  [`${base}/rate`]: { status: 429 },
  [`${base}/missing`]: { status: 404 },
  [`${base}/soft`]: { status: 200, headers: { 'content-type': 'text/html' }, body: '<title>404 Not Found</title>' },
  [`${base}/login`]: { status: 200, headers: { 'content-type': 'text/html' }, body: '<title>로그인 | 공식 홈페이지</title>' },
  [`${base}/tls`]: { error: { code: 'CERT_HAS_EXPIRED' } },
  [`${base}/timeout`]: { error: { name: 'TimeoutError' } },
  [`${base}/loop`]: { status: 302, headers: { location: '/loop' } }
};
test('offline source checking distinguishes restrictions, temporary failures, TLS and missing pages', async () => {
  const expected = { ok: 'reachable', forbidden: 'access-restricted', rate: 'rate-limited', missing: 'not-found', soft: 'soft-failure', login: 'login-required', tls: 'tls-error', timeout: 'timeout', loop: 'redirect-loop' };
  for (const [name, state] of Object.entries(expected)) {
    const result = await checkSource({ id: name, url: `${base}/${name}` }, { fetchImpl: fixtureFetch(fixtures) });
    assert.equal(result.state, state, name);
  }
});
test('redirect chain and final URL are recorded separately without rewriting the source', async () => {
  const source = { id: 'old', url: `${base}/old` }, before = structuredClone(source);
  const result = await checkSource(source, { fetchImpl: fixtureFetch(fixtures) });
  assert.equal(result.state, 'reachable'); assert.equal(result.final_url, `${base}/ok`);
  assert.deepEqual(result.redirects, [{ from: `${base}/old`, to: `${base}/ok`, status: 302 }]);
  assert.deepEqual(source, before);
});
test('source-only batch is read-only and marks offline fixtures explicitly', async () => {
  const sources = { sources: [{ id: 'ok', url: `${base}/ok` }, { id: 'blocked', url: `${base}/forbidden` }] };
  const before = JSON.stringify(sources), requested = [];
  const fixture = fixtureFetch(fixtures);
  const report = await runSourceChecks(sources, { mode: 'offline-fixture', fetchImpl: async (...args) => { requested.push(args[0]); return fixture(...args); } });
  assert.equal(report.mode, 'offline-fixture'); assert.equal(JSON.stringify(sources), before);
  assert.deepEqual(new Set(requested), new Set(sources.sources.map(source => source.url)));
  assert.equal(report.summary.reachable, 1); assert.equal(report.summary['access-restricted'], 1);
});
test('unsafe source links make no network request and success is not a rights claim', async () => {
  let calls = 0;
  const result = await checkSource({ id: 'unsafe', url: 'javascript:alert(1)' }, { fetchImpl: async () => { calls += 1; } });
  assert.equal(result.state, 'unsafe-url'); assert.equal(calls, 0);
  assert.equal(classifyResponse({ status: 206 }).state, 'reachable');
  assert.match(classifyResponse({ status: 200 }).note, /not file verification, permission/);
});
