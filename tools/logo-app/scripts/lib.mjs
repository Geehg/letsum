import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function canonicalSha256(value) { return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex'); }
export function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
export async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
export async function writeJson(file, value) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
export async function loadData(root = PROJECT_ROOT) {
  const [catalog, sources, taxonomy] = await Promise.all(['catalog', 'sources', 'taxonomy'].map(name => readJson(path.join(root, 'data', `${name}.json`))));
  return { catalog, sources, taxonomy };
}
export function isMain(metaUrl) { return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl); }
export function argsOf(argv, known) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!Object.prototype.hasOwnProperty.call(known, key)) throw new Error(`Unknown option: ${key}`);
    if (known[key] === 'flag') result[key] = true;
    else { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${key}`); result[key] = argv[++i]; }
  }
  return result;
}
export function assertInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw new Error('Output path must be inside the project and must not be the project root');
}
export function reportFailure(error) { console.error(error?.message ?? String(error)); process.exitCode = 1; }
