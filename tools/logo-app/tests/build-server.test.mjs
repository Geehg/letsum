import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm, symlink } from 'node:fs/promises';
import { buildSite, bundleModule, serializeBootstrap } from '../scripts/build.mjs';
import { startServer } from '../scripts/serve.mjs';
import { PROJECT_ROOT, canonicalSha256 } from '../scripts/lib.mjs';
import { dataFixture, writeData } from './helpers.mjs';
async function buildFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'letsum-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const data = await dataFixture();
  data.catalog.records[0].summary = '공식 안내 <script>alert("x")</script> </script><script id="injected">';
  await writeData(root, data); await mkdir(path.join(root, 'src'));
  await copyFile(path.join(PROJECT_ROOT, 'src/core.js'), path.join(root, 'src/core.js'));
  await writeFile(path.join(root, 'src/review.js'), "import { escapeHtml } from './core.js';\nexport function renderReview() { return escapeHtml('검수'); }\nexport function bindReview() {}\n");
  await writeFile(path.join(root, 'src/app.js'), "import { filterRecords } from './core.js';\nimport { renderReview, bindReview } from './review.js';\nwindow.fixtureReady = Boolean(filterRecords && renderReview && bindReview);\n");
  await writeFile(path.join(root, 'src/styles.css'), 'body { color: black; }');
  await writeFile(path.join(root, 'src/review.css'), '.review { display: block; }');
  await writeFile(path.join(root, 'src/shell.html'), '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>__TITLE__</title><meta name="description" content="__DESCRIPTION__">__CANONICAL__<style>__STYLE__</style></head><body><main id="app">__FALLBACK__</main><script>window.__LETSUM_BOOTSTRAP__ = __DATA__;</script><script type="module">__SCRIPT__</script></body></html>');
  return { root, data };
}
test('module bundling rejects unknown or dynamic imports', () => {
  assert.match(bundleModule("import { normalizeText } from './core.js';\nconst value = normalizeText('a');", 'app.js'), /const value/);
  assert.throws(() => bundleModule("import { bad } from 'remote-code';", 'app.js'), /Unrecognized import/);
  assert.throws(() => bundleModule("const code = import('remote-code');", 'app.js'), /Unsupported import/);
  assert.throws(() => bundleModule("import 'remote-code';", 'app.js'), /Unsupported import/);
  assert.throws(() => bundleModule("import { escapeHtml as html } from './core.js';", 'app.js'), /Unsupported named import/);
  assert.throws(() => bundleModule("import { invented } from './core.js';", 'app.js'), /Unsupported named import/);
});
test('bootstrap serialization prevents script termination and retains exact data', () => {
  const data = { text: '</script><script>alert(1)</script>\u2028\u2029' };
  const json = serializeBootstrap(data);
  assert.equal(json.includes('<'), false); assert.equal(json.includes('\u2028'), false);
  assert.deepEqual(JSON.parse(json), data);
});
test('build emits offline self-contained pages and real escaped static detail HTML', async t => {
  const { root, data } = await buildFixture(t);
  const result = await buildSite({ root });
  assert.equal(result.html_pages.length, 3);
  assert.equal(result.catalog_sha256, canonicalSha256(data.catalog));
  const index = await readFile(path.join(root, 'dist/index.html'), 'utf8');
  const detail = await readFile(path.join(root, 'dist/brands/ganada-university/index.html'), 'utf8');
  assert.match(detail, /<h1>가나다대학교 로고<\/h1>/);
  assert.match(detail.match(/<main id="app">([\s\S]*?)<\/main>/)[1], /id="main-content" tabindex="-1"/);
  assert.match(index.match(/<main id="app">([\s\S]*?)<\/main>/)[1], /id="main-content" tabindex="-1"/);
  assert.match(detail, /https:\/\/example.org\/identity/);
  assert.match(detail, /&lt;script&gt;alert/);
  assert.equal(detail.includes('<script id="injected">'), false);
  assert.match(detail, /"initialRoute":"\/brand\/ganada-university"/);
  assert.equal(/<script[^>]+src=|<link[^>]+rel="stylesheet"/.test(index), false);
  assert.equal(index.includes('rel="canonical"'), false);
  assert.equal(/__TITLE__|__DATA__|__FALLBACK__/.test(index), false);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'dist/data/catalog.json'), 'utf8')), data.catalog);
});
test('build validates before writing and accepts canonical URL only when explicitly supplied', async t => {
  const { root } = await buildFixture(t);
  await assert.rejects(buildSite({ root, output: root }), /inside the project/);
  await assert.rejects(buildSite({ root, baseUrl: 'javascript:alert(1)' }), /base URL/);
  await buildSite({ root, baseUrl: 'https://example.org/logos/' });
  const detail = await readFile(path.join(root, 'dist/brands/ganada-university/index.html'), 'utf8');
  assert.match(detail, /rel="canonical" href="https:\/\/example.org\/logos\/brands\/ganada-university\/index.html"/);
});
function rawRequest(base, pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    const request = http.request({ hostname: url.hostname, port: url.port, path: pathname, method }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', part => { body += part; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.on('error', reject); request.end();
  });
}
test('loopback server serves MIME/HEAD correctly and blocks traversal and symlink escape', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'letsum-server-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dist = path.join(root, 'dist'); await mkdir(dist);
  await writeFile(path.join(dist, 'index.html'), '<h1>local</h1>');
  await writeFile(path.join(dist, 'data.json'), '{"ok":true}');
  await writeFile(path.join(root, 'private.txt'), 'private');
  await symlink(path.join(root, 'private.txt'), path.join(dist, 'escape.txt'));
  const server = await startServer({ directory: dist, port: 0 }); t.after(server.close);
  assert.match(server.url, /^http:\/\/127\.0\.0\.1:/);
  const index = await rawRequest(server.url, '/'); assert.equal(index.status, 200); assert.match(index.headers['content-type'], /text\/html/);
  const json = await rawRequest(server.url, '/data.json'); assert.match(json.headers['content-type'], /application\/json/);
  assert.equal((await rawRequest(server.url, '/', 'HEAD')).body, '');
  assert.equal((await rawRequest(server.url, '/', 'POST')).status, 405);
  assert.equal((await rawRequest(server.url, '/..%2Fprivate.txt')).status, 403);
  assert.equal((await rawRequest(server.url, '/%2e%2e/private.txt')).status, 403);
  assert.equal((await rawRequest(server.url, '/escape.txt')).status, 403);
  assert.equal((await rawRequest(server.url, '/%ZZ')).status, 400);
  assert.equal((await rawRequest(server.url, '/missing')).status, 404);
});
test('server refuses non-loopback binding', async () => {
  await assert.rejects(startServer({ host: '0.0.0.0' }), /restricted to 127.0.0.1/);
});
