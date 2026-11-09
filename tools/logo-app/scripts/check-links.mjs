import path from 'node:path';
import { mkdir, open } from 'node:fs/promises';
import { safeUrl } from '../src/core.js';
import { PROJECT_ROOT, readJson, isMain, argsOf, reportFailure } from './lib.mjs';

function headerValue(headers, name) { return headers?.get ? headers.get(name) : Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? null; }
export function classifyResponse({ status, contentType = '', body = '' }) {
  if (status === 401) return { state: 'login-required', note: 'Authentication required; source page retained.' };
  if (status === 403) return { state: 'access-restricted', note: 'Access restriction does not prove a broken link.' };
  if (status === 429) return { state: 'rate-limited', note: 'Retry later; no policy or source mutation.' };
  if (status === 404 || status === 410) return { state: 'not-found', note: 'Target absent at check time; human recheck required before removal.' };
  if (status >= 500) return { state: 'temporary-error', note: 'Server error; no permanent removal decision.' };
  if (status >= 300 && status < 400) return { state: 'redirect-unresolved', note: 'Redirect needs investigation.' };
  if (status >= 200 && status < 300) {
    if (/html|text/i.test(contentType)) {
      const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ' ') ?? '';
      if (/\b(?:404|not found|page unavailable)\b|페이지를\s*찾을\s*수\s*없|존재하지\s*않는\s*페이지/i.test(title)) return { state: 'soft-failure', note: 'Success status with a possible error-page title; manual review required.' };
      if (/access denied|forbidden|captcha|just a moment|접근.{0,8}제한|보안.{0,5}확인/i.test(title)) return { state: 'access-restricted', note: 'Possible challenge or restriction page; not a missing source.' };
      if (/^(?:\s*)(?:login|log in|sign in|로그인)(?:\s*[-|–:]|\s*$)/i.test(title)) return { state: 'login-required', note: 'Response appears to be a login page; manual review required.' };
    }
    return { state: 'reachable', note: 'HTTP response only; not file verification, permission, or current-logo confirmation.' };
  }
  return { state: 'needs-review', note: `Unexpected HTTP status ${status}.` };
}
function classifyError(error) {
  const code = error?.cause?.code ?? error?.code ?? '';
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || /TIMEOUT|TIMEDOUT/.test(code)) return { state: 'timeout', note: 'Timed out; temporary or access-related failure.' };
  if (/TLS|SSL|CERT|SELF_SIGNED|UNABLE_TO_VERIFY|CERTIFICATE/i.test(code)) return { state: 'tls-error', note: 'TLS error; not proof of a removed page.' };
  return { state: 'network-error', note: `Network request failed${code ? ` (${code})` : ''}.` };
}
async function limitedText(response, limit = 65536) {
  if (!response.body?.getReader) return String(await response.text()).slice(0, limit);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    while (bytes < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      const kept = value.subarray(0, limit - bytes);
      bytes += kept.byteLength;
      text += decoder.decode(kept, { stream: true });
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
  return text;
}
export async function checkSource(source, { fetchImpl = fetch, timeoutMs = 12000, maxRedirects = 5 } = {}) {
  const result = { source_id: source.id, requested_url: source.url, checked_at: new Date().toISOString(), final_url: null, http_status: null, redirects: [] };
  let url = safeUrl(source.url);
  if (!url) return { ...result, state: 'unsafe-url', note: 'Only safe HTTP(S) source URLs may be checked.' };
  const seen = new Set();
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      if (seen.has(url)) return { ...result, final_url: url, state: 'redirect-loop', note: 'Redirect loop detected.' };
      seen.add(url);
      const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal, headers: { Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1', 'User-Agent': 'LETSUM-SourceCheck/0.1 (+read-only-source-pages)' } });
      result.http_status = response.status;
      result.final_url = url;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = headerValue(response.headers, 'location');
        let next = null;
        try { next = safeUrl(new URL(location, url).href); } catch { /* classified below */ }
        await response.body?.cancel?.().catch(() => {});
        if (!location || !next) return { ...result, state: 'redirect-unresolved', note: 'Redirect destination is missing or unsafe.' };
        result.redirects.push({ from: url, to: next, status: response.status });
        url = next;
        continue;
      }
      const contentType = headerValue(response.headers, 'content-type') ?? '';
      const body = /html|text/i.test(contentType) ? await limitedText(response) : '';
      if (!/html|text/i.test(contentType)) await response.body?.cancel?.().catch(() => {});
      return { ...result, content_type: contentType, ...classifyResponse({ status: response.status, contentType, body }) };
    }
    return { ...result, state: 'too-many-redirects', note: 'Redirect limit exceeded; manual review required.' };
  } catch (error) { return { ...result, ...classifyError(error) }; }
}
export function fixtureFetch(fixtures) {
  return async url => {
    const item = fixtures[url];
    if (!item) throw new Error(`No offline fixture for ${url}`);
    if (item.error) { const error = new Error(item.error.message ?? 'Fixture network error'); error.name = item.error.name ?? 'Error'; error.code = item.error.code; throw error; }
    return new Response(item.body ?? '', { status: item.status ?? 200, headers: item.headers ?? { 'content-type': 'text/html' } });
  };
}
export async function runSourceChecks(sources, { fetchImpl = fetch, concurrency = 3, timeoutMs = 12000, mode = 'network' } = {}) {
  if (!Array.isArray(sources?.sources)) throw new Error('Expected sources.sources array');
  const rows = sources.sources, results = new Array(rows.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, rows.length || 1)) }, async () => {
    while (cursor < rows.length) { const index = cursor++; results[index] = await checkSource(rows[index], { fetchImpl, timeoutMs }); }
  });
  await Promise.all(workers);
  return { schema_version: '1.0', checked_at: new Date().toISOString(), mode, scope: 'Official source URLs only; no binary asset checks and no catalog/policy/review mutation.', results, summary: results.reduce((acc, row) => { acc[row.state] = (acc[row.state] ?? 0) + 1; return acc; }, {}) };
}
if (isMain(import.meta.url)) {
  try {
    const args = argsOf(process.argv.slice(2), { '--fixture': 'value', '--output': 'value', '--timeout-ms': 'value', '--sources': 'value' });
    const sourceFile = args['--sources'] ? path.resolve(args['--sources']) : path.join(PROJECT_ROOT, 'data', 'sources.json');
    const timeoutMs = args['--timeout-ms'] ? Number(args['--timeout-ms']) : 12000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('timeout-ms must be from 1 to 60000');
    const sources = await readJson(sourceFile);
    const fixtures = args['--fixture'] ? await readJson(path.resolve(args['--fixture'])) : null;
    const report = await runSourceChecks(sources, { fetchImpl: fixtures ? fixtureFetch(fixtures) : fetch, timeoutMs, mode: fixtures ? 'offline-fixture' : 'network' });
    const stamp = report.checked_at.replace(/[:.]/g, '-');
    const destination = args['--output'] ? path.resolve(args['--output']) : path.join(PROJECT_ROOT, 'reports', `source-links-${stamp}.json`);
    if ([sourceFile, ...['catalog', 'sources', 'taxonomy'].map(name => path.join(PROJECT_ROOT, 'data', `${name}.json`))].map(file => path.resolve(file)).includes(destination)) throw new Error('A report may not overwrite source data');
    await mkdir(path.dirname(destination), { recursive: true });
    const handle = await open(destination, 'wx');
    try { await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`, 'utf8'); } finally { await handle.close(); }
    console.log(`Wrote ${report.results.length} source checks to ${destination}\n${JSON.stringify(report.summary)}\nCatalog, policies, versions and file-verification states were not changed.`);
  } catch (error) { reportFailure(error); }
}
