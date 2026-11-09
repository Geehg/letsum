// Collects identification thumbnails for /logos/ and keeps them on our own server (no hotlinking).
// Usage: node tools/fetch_logo_thumbs.mjs [record-id ...]
// Sources are tried in the order given in tools/logo-app/data/thumbnail-sources.json. If every source fails,
// the previously downloaded file and its manifest entry are kept, so a flaky site never empties a thumbnail.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, 'logo-app/data'), outDir = path.join(root, '../html/logos/thumbs');
const SIMPLE_ICONS = '16.37.0';
const UA = 'LETSUM-logo-thumbs/1.0 (+https://letsum.app/logos/)';
const MAX_BYTES = 3 * 1024 * 1024;
const today = new Date().toISOString().slice(0, 10);

const {sources} = JSON.parse(await fs.readFile(path.join(dataDir, 'thumbnail-sources.json'), 'utf8'));
const manifestFile = path.join(dataDir, 'thumbnails.json');
let manifest = {schema_version: '1.0', updated_at: today, thumbnails: {}};
try { manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8')); } catch {}
await fs.mkdir(outDir, {recursive: true});

async function get(url, accept = '*/*') {
  const response = await fetch(url, {headers: {'User-Agent': UA, Accept: accept}, redirect: 'follow', signal: AbortSignal.timeout(25000)});
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error(`too large ${url}`);
  return {bytes, type: response.headers.get('content-type') || '', url: response.url};
}
function kind(bytes) {
  const head = bytes.subarray(0, 12), text = bytes.subarray(0, 2048).toString('utf8');
  if (head[0] === 0x89 && head.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (head[0] === 0xff && head[1] === 0xd8) return 'jpg';
  if (head.toString('latin1', 0, 3) === 'GIF') return 'gif';
  if (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (head[0] === 0 && head[1] === 0 && head[2] === 1 && head[3] === 0) return 'ico';
  if (/<svg[\s>]/i.test(text)) return 'svg';
  return null;
}
// Shown through <img>, where scripts never run; this also keeps the stored files clean.
const cleanSvg = svg => svg.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, '$1#');
const stripHtml = html => html ? html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160) : null;

let iconData;
async function simpleIcon(source) {
  iconData ??= JSON.parse((await get(`https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS}/data/simple-icons.json`)).bytes.toString('utf8'));
  const list = Array.isArray(iconData) ? iconData : iconData.icons;
  const meta = list.find(icon => (icon.slug || icon.title.toLowerCase().replace(/[^a-z0-9]/g, '')) === source.slug);
  if (!meta) throw new Error(`simple-icons has no ${source.slug}`);
  const svg = cleanSvg((await get(`https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS}/icons/${source.slug}.svg`)).bytes.toString('utf8'));
  if (!/<path/.test(svg)) throw new Error('empty glyph');
  const paint = colour => svg.replace('<svg ', `<svg fill="${colour}" `);
  // Light brand colours (e.g. Kakao yellow) get a dark glyph on the brand background.
  const [r, g, b] = [0, 2, 4].map(i => parseInt(meta.hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const ink = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#191919' : '#ffffff';
  return {mode: 'glyph', bg: '#' + meta.hex, ink, files: {'': paint('#' + meta.hex), '-onbrand': paint(ink)}, ext: 'svg',
    source: 'simple-icons', source_url: `https://simpleicons.org/?q=${source.slug}`, page_url: meta.source || null,
    license: meta.license ? `${meta.license.type || 'custom'} (Simple Icons)` : 'CC0 1.0 (Simple Icons)', author: 'Simple Icons contributors', guidelines: meta.guidelines || null};
}
async function commons(source) {
  const api = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({action: 'query', format: 'json', titles: source.file, prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '512'});
  const page = Object.values(JSON.parse((await get(api, 'application/json')).bytes.toString('utf8')).query.pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`commons has no ${source.file}`);
  const meta = info.extmetadata || {};
  const file = await get(info.mime === 'image/svg+xml' ? info.url : info.thumburl || info.url);
  const ext = kind(file.bytes);
  if (!ext) throw new Error('not an image');
  return {mode: 'image', bg: null, files: {'': ext === 'svg' ? cleanSvg(file.bytes.toString('utf8')) : file.bytes}, ext,
    source: 'wikimedia-commons', source_url: file.url, page_url: info.descriptionurl,
    license: stripHtml(meta.LicenseShortName?.value) || 'unknown', author: stripHtml(meta.Artist?.value)};
}
async function siteIcon(source) {
  const page = await get(source.url, 'text/html');
  const html = page.bytes.toString('utf8');
  const candidates = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = (tag.match(/\brel\s*=\s*["']([^"']+)["']/i) || [])[1]?.toLowerCase() || '';
    const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!href || !/(^|\s)(apple-touch-icon|icon|apple-touch-icon-precomposed)(\s|$)/.test(rel)) continue;
    const size = Number((tag.match(/\bsizes\s*=\s*["'](\d+)x\d+/i) || [])[1]) || (/apple/.test(rel) ? 180 : /\.svg/i.test(href) ? 512 : 32);
    candidates.push({url: new URL(href.replace(/&amp;/g, '&'), page.url).href, size});
  }
  candidates.push({url: new URL('/apple-touch-icon.png', page.url).href, size: 180}, {url: new URL('/favicon.ico', page.url).href, size: 16});
  candidates.sort((a, b) => b.size - a.size);
  for (const candidate of candidates) {
    try {
      const file = await get(candidate.url);
      const ext = kind(file.bytes);
      if (!ext || file.bytes.length < 100) continue;
      return {mode: 'image', bg: null, files: {'': ext === 'svg' ? cleanSvg(file.bytes.toString('utf8')) : file.bytes}, ext,
        source: 'official-site-icon', source_url: file.url, page_url: source.url, license: '공식 사이트 아이콘(상표권은 권리자에게 있음)', author: null, small: candidate.size < 96};
    } catch {}
  }
  throw new Error(`no usable icon on ${source.url}`);
}
async function officialImage(source) {
  const file = await get(source.url);
  const ext = kind(file.bytes);
  if (!ext || file.bytes.length < 300) throw new Error(`not a usable image ${source.url}`);
  return {mode: 'image', bg: null, files: {'': ext === 'svg' ? cleanSvg(file.bytes.toString('utf8')) : file.bytes}, ext,
    source: 'official-page-image', source_url: file.url, page_url: source.page, license: '공식 페이지 게시 이미지(상표권은 권리자에게 있음)', author: null};
}
const fetchers = {'simple-icons': simpleIcon, commons, image: officialImage, 'site-icon': siteIcon};

const only = process.argv.slice(2);
let fetched = 0, kept = 0, missing = 0;
for (const [id, list] of Object.entries(sources)) {
  if (only.length && !only.includes(id)) continue;
  let done = null, errors = [];
  for (const source of list) {
    try { done = await fetchers[source.type](source); break; } catch (error) { errors.push(`${source.type}: ${error.message}`); }
  }
  if (!done) {
    if (manifest.thumbnails[id]) { kept++; console.warn(`kept   ${id} (${errors.join(' | ')})`); }
    else { missing++; console.warn(`miss   ${id} (${errors.join(' | ')})`); }
    continue;
  }
  const entry = {mode: done.mode, bg: done.bg, ink: done.ink || null, source: done.source, source_url: done.source_url, page_url: done.page_url, license: done.license, author: done.author || null, fetched_at: today};
  if (done.guidelines) entry.guidelines = done.guidelines;
  if (done.small) entry.small = true;
  for (const old of await fs.readdir(outDir)) if (old.startsWith(id + '.') || old.startsWith(id + '-onbrand.')) await fs.rm(path.join(outDir, old));
  for (const [suffix, body] of Object.entries(done.files)) {
    const name = `${id}${suffix}.${done.ext}`;
    await fs.writeFile(path.join(outDir, name), body);
    const hash = createHash('sha256').update(body).digest('hex');
    if (suffix === '') Object.assign(entry, {file: `/logos/thumbs/${name}`, sha256: hash, bytes: Buffer.byteLength(body)});
    else entry.on_brand = `/logos/thumbs/${name}`;
  }
  manifest.thumbnails[id] = entry; fetched++;
  console.log(`ok     ${id} ← ${done.source} (${done.license})`);
}
manifest.updated_at = today;
manifest.thumbnails = Object.fromEntries(Object.entries(manifest.thumbnails).sort(([a], [b]) => a.localeCompare(b)));
await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
console.log(`thumbnails: ${fetched} fetched, ${kept} kept from before, ${missing} missing`);
