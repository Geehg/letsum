
import assert from 'node:assert/strict';import fs from 'node:fs';import {webcrypto}from'node:crypto';
if (!globalThis.crypto) globalThis.crypto=webcrypto;
const {account}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../worker/src/account.js',import.meta.url),'utf8')).toString('base64'));
const OLD='https://type.letsum.app',NEW='https://type.goyoseoga.com';
const sessions=new Map(),user={id:'existing-user',provider:'google',nickname:'',created:1,last_seen:Date.now()};
const sha=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
const env={AUTH_FROM:'2020-01-01',AUTH_SALT:'synthetic-test-only',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',DB:{prepare(sql){return{bind(...v){return{async run(){if(sql.startsWith('INSERT INTO tb_sessions'))sessions.set(v[0],{user_id:v[1],expires:v[3]});},async first(){if(sql.startsWith('SELECT u.id')){const s=sessions.get(v[0]);return s&&s.expires>v[1]?user:null;}if(sql.startsWith('DELETE FROM tb_sessions')){const s=sessions.get(v[0]);if(s&&s.expires>v[1]){sessions.delete(v[0]);return{user_id:s.user_id};}return null;}throw Error('Unhandled '+sql);}};}};}}};
async function call(url,cookie='',method='GET',origin=''){const req=new Request(url,{method,headers:{cookie,...(origin?{origin}:{})}});return account(req,new URL(url),env);}
const cookie=(r,name)=>r.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0];
const token='a'.repeat(64);sessions.set(await sha(token),{user_id:user.id,expires:Date.now()+100000});
async function begin(){const start=await call(NEW+'/api/auth/google/start?age14=1&r=/');assert.equal(start.status,302);assert(start.headers.get('location').startsWith(OLD+'/api/auth/handoff?'));assert.match(start.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);const auth=await call(start.headers.get('location'),'tb_s='+token);assert.equal(auth.status,302);assert(auth.headers.get('location').startsWith(NEW+'/api/auth/finish?'));return{start,auth};}
let{start,auth}=await begin();let r=await call(auth.headers.get('location'),cookie(start,'tb_h'));assert.equal(r.headers.get('location'),'//#/?login=ok'.replace('//','/'));assert(cookie(r,'tb_s'));const me=await call(NEW+'/api/me',cookie(r,'tb_s'));assert.equal((await me.json()).user.provider,'google');
const replay=await call(auth.headers.get('location'),cookie(start,'tb_h'));assert.equal(replay.headers.get('location'),'/#/?login=state');
({start,auth}=await begin());r=await call(auth.headers.get('location'));assert.equal(r.headers.get('location'),'/#/?login=state');
r=await call(auth.headers.get('location').replace(/n=[a-f0-9]{64}/,'n='+'f'.repeat(64)),cookie(start,'tb_h'));assert.equal(r.headers.get('location'),'/#/?login=state');
for(const s of sessions.values())if(s.expires<Date.now()+130000&&s.user_id===user.id)s.expires=0;
r=await call(auth.headers.get('location'),cookie(start,'tb_h'));assert.equal(r.headers.get('location'),'/#/?login=state');
r=await call(NEW+'/api/auth/google/start?age14=1&r=https://evil.test');const saved=JSON.parse(decodeURIComponent(cookie(r,'tb_h').slice(5)));assert.equal(saved.r,'/');
r=await call(NEW+'/api/sync','', 'PUT',OLD);assert.equal(r.status,403);
r=await call('https://evil.test/api/auth/status');assert.equal(r.status,404);
r=await call(NEW+'/api/auth/handoff?p=google&n='+'b'.repeat(64));assert.equal(r.status,404);
r=await call(OLD+'/api/auth/finish?n='+'b'.repeat(64));assert.equal(r.status,404);
r=await call(OLD+'/api/auth/handoff?p=google&n='+'b'.repeat(64));assert(r.headers.get('location').startsWith(OLD+'/api/auth/google/start?'));
r=await call(OLD+'/api/auth/google/start');assert(new URL(r.headers.get('location')).searchParams.get('redirect_uri')===OLD+'/api/auth/google/callback');
const newStart=await call(NEW+'/api/auth/google/start');const startUrl=new URL(newStart.headers.get('location'));startUrl.searchParams.set('failure','cancel');const fail=await call(startUrl.href);const finish=await call(fail.headers.get('location'),cookie(newStart,'tb_h'));assert.equal(finish.headers.get('location'),'/#/?login=cancel');
console.log('auth handoff: same account, cookies, original OAuth callback, one-use redemption, nonce binding, expiry, origin isolation, invalid return and cancellation tests passed');
