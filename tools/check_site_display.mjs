import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import api from '../worker/src/index.js';
let row = null;
const env = {
  ADMIN_KEY: 'test-only-admin-key',
  DB: {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              assert.match(sql, /SELECT data, updated FROM settings/);
              assert.equal(args[0], 'site_display');
              return row;
            },
            async run() {
              assert.match(sql, /INSERT INTO settings/);
              assert.equal(args[0], 'site_display');
              row = {data: args[1], updated: args[2]};
              return {success: true};
            }
          };
        }
      };
    }
  }
};
async function request(path, data, auth=false){return api.fetch(new Request('https://letsum.app/api/'+path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer '+env.ADMIN_KEY}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}),env);}
assert.equal((await (await request('site-display')).json()).koreanFontDirectory,false);
assert.equal((await request('admin/site-display')).status,401);
assert.equal((await request('admin/site-display',{koreanFontDirectory:true})).status,401);
for (const invalid of [null,{}, {koreanFontDirectory:'true'},{koreanFontDirectory:1}]) assert.equal((await request('admin/site-display',invalid,true)).status,400);
for (const enabled of [true,false]) {
  assert.equal((await request('admin/site-display',{koreanFontDirectory:enabled},true)).status,200);
  const response=await request('site-display');assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await response.json()).koreanFontDirectory,enabled);
  assert.equal((await (await request('admin/site-display',undefined,true)).json()).koreanFontDirectory,enabled);
}
row={data:'broken'};assert.equal((await (await request('site-display')).json()).koreanFontDirectory,false);
const source=readFileSync(new URL('../html/js/main.js',import.meta.url),'utf8');
const start=source.indexOf('  const koreanDirectory =');const end=source.indexOf('  // ---------- 폰트 로딩:',start);
assert.ok(start>0&&end>start);
async function checkVisibility(response,expected){const section={hidden:true};const context={document:{querySelector:()=>section},fetch:async()=>{if(response instanceof Error)throw response;return response;}};vm.runInNewContext(source.slice(start,end),context);await new Promise(r=>setImmediate(r));assert.equal(section.hidden,expected);}
await checkVisibility({ok:true,json:async()=>({koreanFontDirectory:true})},false);
await checkVisibility({ok:true,json:async()=>({koreanFontDirectory:false})},true);
await checkVisibility({ok:true,json:async()=>({koreanFontDirectory:'true'})},true);
await checkVisibility({ok:false},true);await checkVisibility(new Error('offline'),true);
assert.match(readFileSync(new URL('../html/index.html',import.meta.url),'utf8'),/class="seo-dir" data-korean-font-directory hidden/);
for(const path of ['en','dingbat'])assert.doesNotMatch(readFileSync(new URL(`../html/${path}/index.html`,import.meta.url),'utf8'),/data-korean-font-directory/);
console.log('PASS: 기본 숨김, 인증, 입력 검증, 서버 저장·재조회, 캐시, 장애 시 숨김, 한글에만 적용');
