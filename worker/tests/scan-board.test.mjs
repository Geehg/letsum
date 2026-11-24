import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';
import catalog from '../../html/data/image-fonts.json' with {type: 'json'};

const origin = 'https://letsum.app';
const api = origin + '/api/scan-board';
const candidates = catalog.slice(0, 3).map(font => ({id: font.id, weight: 400}));
function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0011_scan_board.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const DB = {prepare(sql) {
    return {bind(...args) {
      return {first: async () => sqlite.prepare(sql).get(...args), all: async () => ({results: sqlite.prepare(sql).all(...args)})};
    }};
  }};
  const env = {DB};
  const query = (init, search = '') => worker.fetch(new Request(api + search, init), env);
  const post = (payload, overrides = {}) => query({method:'POST', headers:{origin, 'content-type':'application/json'},
    body:JSON.stringify(payload), ...overrides});
  const payload = () => ({requestId:crypto.randomUUID(), confidence:'high', candidates});
  return {env, query, post, payload};
}

test('publishes a classification once across concurrent and repeated submissions', async t => {
  const {env, query, post, payload} = setup(t), sample = payload();
  const statuses = await Promise.all([post(sample), post(sample)]);
  assert.deepEqual(statuses.map(resp => resp.status).sort(), [200, 201]);
  const records = (await (await query()).json()).entries;
  assert.equal(records.length, 1);
  assert.deepEqual(Object.keys(records[0]).sort(), ['candidates','confidence','createdAt','id']);
  assert.deepEqual(records[0].candidates, candidates);
  assert.ok(Number.isFinite(Date.parse(records[0].createdAt)));
  assert.equal((await post({...sample,confidence:'low'})).status,409);
  env.SCAN_BOARD_RL = {limit: async () => ({success:false})};
  assert.equal((await post(sample)).status,200);
  assert.equal((await post(payload())).status,429);
});

test('publishes only catalogue IDs, genuine weights and bounded, same-origin JSON', async t => {
  const {post, query, payload} = setup(t), p = payload();
  for (const invalid of [
    {...p, text:'private'}, {...p, requestId:'abc'}, {...p, confidence:'maybe'},
    {...p, candidates:[]}, {...p, candidates:[...candidates,candidates[0]]},
    {...p, candidates:[{id:candidates[0].id,weight:999}]},
    {...p, candidates:[{id:'unknown',weight:400}]},
    {...p, candidates:[{...candidates[0],fileName:'private.png'}]},
    {...p, candidates:[candidates[1], candidates[1]]}
  ]) assert.equal((await post(invalid)).status,400);
  assert.equal((await post(p, {body:' '.repeat(1200)})).status,400);
  assert.equal((await post(p,{headers:{'content-type':'application/json'}})).status,403);
  assert.equal((await post(p,{headers:{origin:'https://example.com','content-type':'application/json'}})).status,403);
  assert.equal((await post(p,{headers:{origin,'content-type':'text/plain'}})).status,415);
  assert.deepEqual((await (await query()).json()).entries,[]);
});

test('uses the actual registered weights for a family without a regular face', async t => {
  const {post, payload} = setup(t);
  const id = 'k-gmarket-sans';
  const sample = {...payload(), candidates:[{id, weight:500}]};
  assert.equal((await post(sample)).status, 201);
  assert.equal((await post({...payload(), candidates:[{id, weight:400}]})).status, 400);
});

test('lists newest first without duplicates across intervening posts', async t => {
  const {query, post, payload} = setup(t);
  for (let i = 0; i < 24; i++) assert.equal((await post(payload())).status,201);
  const first = await (await query()).json();
  assert.equal(first.entries.length,20);
  assert.equal(first.entries[0].id,24);
  assert.equal(first.nextBefore,5);
  await post(payload());
  const last = await (await query(undefined,'?before='+first.nextBefore)).json();
  assert.deepEqual(last.entries.map(row=>row.id),[4,3,2,1]);
  assert.equal(last.nextBefore,null);
  assert.equal((await query(undefined,'?before=0')).status,400);
});
