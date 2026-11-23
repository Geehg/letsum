// Only publish classifications that the scanner can produce. User input stays on the device.
import catalog from '../../html/data/image-fonts.json' with {type: 'json'};

const catalogWeights = new Map(catalog.map(font => [font.id, new Set(Object.keys(font.weights).map(Number))]));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBytes = 1024;
const pageSize = 20;
const columns = 'id, created, confidence, candidates';

function reply(data, status = 200) {
  return Response.json(data, {status, headers: {'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});
}

function entry(row) {
  return {id: row.id, createdAt: new Date(row.created).toISOString(), confidence: row.confidence,
    candidates: JSON.parse(row.candidates)};
}

function validKeys(value, names) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}

function validPayload(value) {
  if (!validKeys(value, ['requestId', 'confidence', 'candidates'])
    || typeof value.requestId !== 'string' || !uuid.test(value.requestId)
    || !['high', 'low'].includes(value.confidence) || !Array.isArray(value.candidates)
    || value.candidates.length < 1 || value.candidates.length > 3) return false;
  const used = new Set();
  for (const candidate of value.candidates) {
    if (!validKeys(candidate, ['id', 'weight']) || used.has(candidate.id)
      || !catalogWeights.get(candidate.id)?.has(candidate.weight)) return false;
    used.add(candidate.id);
  }
  return true;
}

async function readPayload(req) {
  // Enforce the limit on the stream as well as Content-Length (which can be absent).
  if (!req.body || Number(req.headers.get('content-length')) > maxBytes) return null;
  const reader = req.body.getReader(), bytes = new Uint8Array(maxBytes);
  let length = 0;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    if (value.length > maxBytes - length) { await reader.cancel(); return null; }
    bytes.set(value, length);
    length += value.length;
  }
  try { return JSON.parse(new TextDecoder().decode(bytes.subarray(0, length))); }
  catch { return null; }
}

function replay(row, confidence, candidates) {
  if (row.confidence !== confidence || row.candidates !== candidates) {
    return reply({error: '이미 다른 판별 결과에 사용된 요청입니다.'}, 409);
  }
  return reply({entry: entry(row)});
}

export async function scanBoard(req, env) {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const before = url.searchParams.get('before');
    if (before !== null && (!/^[1-9]\d{0,15}$/.test(before) || !Number.isSafeInteger(Number(before)))) {
      return reply({error: '이전 기록의 위치를 확인하세요.'}, 400);
    }
    const select = 'SELECT ' + columns + ' FROM scan_board';
    const list = before === null
      ? env.DB.prepare(select + ' ORDER BY id DESC LIMIT ?').bind(pageSize + 1)
      : env.DB.prepare(select + ' WHERE id < ? ORDER BY id DESC LIMIT ?').bind(Number(before), pageSize + 1);
    const {results} = await list.all();
    const entries = results.slice(0, pageSize).map(entry);
    return reply({entries, nextBefore: results.length > pageSize ? entries[entries.length - 1].id : null});
  }
  if (req.method !== 'POST') return reply({error: '지원하지 않는 요청입니다.'}, 405);
  if (req.headers.get('origin') !== url.origin) return reply({error: '같은 사이트에서 등록하세요.'}, 403);
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return reply({error: 'JSON만 받습니다.'}, 415);
  }
  const payload = await readPayload(req);
  if (!validPayload(payload)) return reply({error: '판별 결과를 확인하세요.'}, 400);
  const {confidence} = payload;
  const requestId = payload.requestId.toLowerCase();
  const candidates = JSON.stringify(payload.candidates.map(({id, weight}) => ({id, weight})));
  const lookup = env.DB.prepare('SELECT ' + columns + ' FROM scan_board WHERE request_id = ?').bind(requestId);
  const existing = await lookup.first();
  if (existing) return replay(existing, confidence, candidates);
  if (env.SCAN_BOARD_RL) {
    const {success} = await env.SCAN_BOARD_RL.limit({key: req.headers.get('cf-connecting-ip') || 'local'});
    if (!success) return reply({error: '잠시 후 다시 등록해 주세요.'}, 429);
  }
  const row = await env.DB.prepare('INSERT INTO scan_board(request_id, created, confidence, candidates) VALUES (?, ?, ?, ?) '
    + 'ON CONFLICT(request_id) DO NOTHING RETURNING ' + columns).bind(requestId, Date.now(), confidence, candidates).first();
  return row ? reply({entry: entry(row)}, 201) : replay(await lookup.first(), confidence, candidates);
}
