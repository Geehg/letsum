import path from 'node:path';
import vm from 'node:vm';
import { readFile, mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { escapeHtml, safeUrl, filterRecords, getFormats, validateCatalog } from '../src/core.js';
import { PROJECT_ROOT, loadData, canonicalSha256, writeJson, isMain, argsOf, assertInside, reportFailure } from './lib.mjs';

export function serializeBootstrap(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
export function bundleModule(code, name) {
  const allowed = { 'core.js': [], 'review.js': ['./core.js'], 'app.js': ['./core.js', './review.js'] }[name];
  if (!allowed) throw new Error(`Unsupported source module: ${name}`);
  let result = code.replace(/^\s*import\s+([\s\S]*?)\s+from\s+(['"])([^'"\n]+)\2\s*;?/gm, (full, clause, quote, target) => {
    if (!allowed.includes(target) || !/^\{[\s\S]*\}$/.test(clause.trim())) throw new Error(`Unrecognized import in ${name}: ${target}`);
    const knownExports = {
      './core.js': ['normalizeText', 'getChoseong', 'searchScore', 'filterRecords', 'getFormats', 'summarize', 'validateCatalog', 'escapeHtml', 'safeUrl', 'validateAgainstSchema', 'CATALOG_SCHEMA', 'SOURCES_SCHEMA', 'TAXONOMY_SCHEMA', 'REVIEW_PATCH_SCHEMA'],
      './review.js': ['renderReview', 'bindReview']
    };
    const names = clause.trim().slice(1, -1).split(',').map(value => value.trim()).filter(Boolean);
    if (names.some(value => !/^[A-Za-z_$][\w$]*$/.test(value) || !knownExports[target]?.includes(value))) throw new Error(`Unsupported named import or alias in ${name}: ${clause.trim()}`);
    return '\n';
  });
  if (/^\s*import\b/m.test(result) || /\bimport\s*\(/.test(result)) throw new Error(`Unsupported import left in ${name}`);
  result = result.replace(/^\s*export\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/gm, '');
  if (/^\s*export\b/m.test(result)) throw new Error(`Unsupported export left in ${name}`);
  return `\n/* ${name} */\n${result}\n`;
}

function officialLink(url, label) {
  const safe = safeUrl(url);
  return safe ? `<a href="${escapeHtml(safe)}" rel="noreferrer noopener">${escapeHtml(label)}</a>` : '';
}
export function fallbackHtml(catalog, route, taxonomy) {
  const categoryLabels = new Map(taxonomy.categories.map(row => [row.id, row.label]));
  if (route.startsWith('/brand/')) {
    const record = catalog.records.find(row => row.id === route.slice('/brand/'.length));
    if (!record) return '<section id="main-content" tabindex="-1"><h1>자료를 찾을 수 없습니다</h1></section>';
    const formats = getFormats(record);
    return `<article class="static-fallback" id="main-content" tabindex="-1"><p>LETSUM 로고 · 공식 출처 안내</p><h1>${escapeHtml(record.name)}</h1><p>${escapeHtml(record.organization_name)} · ${escapeHtml(categoryLabels.get(record.category) ?? record.category)}</p><p>${escapeHtml(record.summary)}</p><p>공식 페이지 안내 형식: ${escapeHtml(formats.length ? formats.join(' · ') : '확인된 형식 안내 없음')}</p><p>${escapeHtml(record.usage.summary)}</p><p>출처 확인일: ${escapeHtml(record.review.checked_at ?? '재검토 필요')} · 실제 파일 검증과 별개입니다.</p><p>${officialLink(record.source_url, '공식 자료 보기')} ${officialLink(record.guideline_url, '사용 안내 보기')}</p><p>자료는 제공처의 이용조건을 확인해 사용하세요.</p></article>`;
  }
  if (route === '/review') return '<section class="static-fallback" id="main-content" tabindex="-1"><h1>LETSUM 로고 자료 검수</h1><p>검수 화면은 브라우저 JavaScript가 필요합니다. 변경 내용은 로컬 검토 패치로 내보내며 카탈로그를 직접 게시하지 않습니다.</p></section>';
  const records = filterRecords(catalog.records, { sort: 'name' });
  return `<section class="static-fallback" id="main-content" tabindex="-1"><h1>LETSUM 로고·CI</h1><p>공공기관·기업·대학의 공식 로고와 사용 안내를 찾는 디렉터리입니다.</p><p>${escapeHtml(catalog.scope_note)}</p><ul>${records.map(record => `<li><h2>${escapeHtml(record.name)}</h2><p>${escapeHtml(record.summary)}</p>${officialLink(record.source_url, '공식 자료 보기')}</li>`).join('')}</ul></section>`;
}

export async function buildSite({ root = PROJECT_ROOT, output = path.join(root, 'dist'), baseUrl = null } = {}) {
  assertInside(root, output);
  const { catalog, sources, taxonomy } = await loadData(root);
  const validation = validateCatalog(catalog, sources, taxonomy);
  if (validation.errors.length) throw new Error(`Build refused: invalid catalog\n${validation.errors.join('\n')}`);
  if (baseUrl && (!safeUrl(baseUrl) || new URL(baseUrl).search || new URL(baseUrl).hash)) throw new Error('Explicit base URL must be an HTTP(S) URL without query or fragment');
  const files = await Promise.all(['shell.html', 'styles.css', 'review.css', 'core.js', 'review.js', 'app.js'].map(name => readFile(path.join(root, 'src', name), 'utf8')));
  const [shell, styles, reviewStyles, core, review, app] = files;
  for (const placeholder of ['__TITLE__', '__DESCRIPTION__', '__STYLE__', '__DATA__', '__SCRIPT__', '__FALLBACK__', '__CANONICAL__']) {
    if (!shell.includes(placeholder)) throw new Error(`Missing shell placeholder: ${placeholder}`);
  }
  const javascript = bundleModule(core, 'core.js') + bundleModule(review, 'review.js') + bundleModule(app, 'app.js');
  new vm.Script(`(async () => {\n${javascript}\n})`, { filename: 'letsum-bundle.js' });
  const script = javascript.replace(/<\/script/gi, '<\\/script');
  const css = `${styles}\n${reviewStyles}`.replace(/<\/style/gi, '<\\/style');
  const catalogSha256 = canonicalSha256(catalog);
  const publicRecords = filterRecords(catalog.records, { includeHistorical: true, sort: 'name' });
  const pages = [
    { file: 'index.html', route: '/', title: 'LETSUM 로고·CI — 공식 자료 찾기', description: '공공기관·기업·대학의 공식 로고와 CI·사용 안내를 찾습니다.' },
    { file: 'review.html', route: '/review', title: '자료 검수 — LETSUM 로고', description: '공식 출처와 사용 안내의 로컬 검수 화면입니다.' },
    ...publicRecords.map(record => ({ file: `brands/${record.id}/index.html`, route: `/brand/${record.id}`, title: `${record.name} — LETSUM 로고`, description: record.summary }))
  ];
  const rendered = pages.map(page => {
    const canonicalTarget = baseUrl ? new URL(page.file === 'index.html' ? './' : page.file, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).href : null;
    const replacements = {
      '__TITLE__': escapeHtml(page.title), '__DESCRIPTION__': escapeHtml(page.description), '__STYLE__': css,
      '__DATA__': serializeBootstrap({ catalog, sources, taxonomy, catalogSha256, initialRoute: page.route, version: '0.1.0' }),
      '__SCRIPT__': script, '__FALLBACK__': fallbackHtml(catalog, page.route, taxonomy),
      '__CANONICAL__': canonicalTarget ? `<link rel="canonical" href="${escapeHtml(canonicalTarget)}">` : ''
    };
    let html = shell.replace(/__(?:TITLE|DESCRIPTION|STYLE|DATA|SCRIPT|FALLBACK|CANONICAL)__/g, key => replacements[key]);
    return { ...page, html };
  });
  await rm(output, { recursive: true, force: true });
  await mkdir(path.join(output, 'data'), { recursive: true });
  for (const page of rendered) {
    const destination = path.join(output, page.file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, page.html, 'utf8');
  }
  for (const name of ['catalog', 'sources', 'taxonomy']) await copyFile(path.join(root, 'data', `${name}.json`), path.join(output, 'data', `${name}.json`));
  const report = { built_at: new Date().toISOString(), catalog_version: catalog.version, catalog_sha256: catalogSha256, canonical_base_url: baseUrl, html_pages: rendered.map(({ file, route }) => ({ file, route })), public_records: publicRecords.length, warnings: validation.warnings, scope: 'Static local files only. No production deployment.' };
  await writeJson(path.join(output, 'build-report.json'), report);
  return { ...report, output };
}
if (isMain(import.meta.url)) {
  try {
    const args = argsOf(process.argv.slice(2), { '--base-url': 'value' });
    buildSite({ baseUrl: args['--base-url'] ?? null }).then(result => console.log(`Built ${result.html_pages.length} self-contained HTML pages in ${result.output}\nCatalog SHA-256: ${result.catalog_sha256}\nWarnings: ${result.warnings.length}`)).catch(reportFailure);
  } catch (error) { reportFailure(error); }
}
