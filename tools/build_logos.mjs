// Production adapter for the supplied, dependency-free logo directory.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildSite} from './logo-app/scripts/build.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)), project=path.join(root,'logo-app'), out=path.join(root,'../html/logos');
const result=await buildSite({root:project,baseUrl:'https://letsum.app/logos/'});
await fs.mkdir(out,{recursive:true});
const shared=new Map();
function asset(text,extension){const name=`shared-${createHash('sha256').update(text).digest('hex').slice(0,12)}.${extension}`;shared.set(name,text);return '/logos/'+name;}
const nav=[['/','한글 폰트'],['/en/','영문 폰트'],['/dingbat/','딩벳&특수'],['/logos/','로고모음'],['/mascots/','마스코트'],['/typing.html','필사독서']];
const globalNav=`<nav class="network-nav" aria-label="렛섬 전체 메뉴">${nav.map(([url,label])=>`<a href="${url}"${url==='/logos/'?' aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
for(const page of result.html_pages){
 if(page.route==='/review')continue;
 let html=await fs.readFile(path.join(project,'dist',page.file),'utf8');
 html=html.replace(/(https:\/\/letsum.app\/logos\/brands\/[^\"]+\/)index.html/g,'$1');
 html=html.replace('<header class="site-header">',globalNav+'<header class="site-header">');
 html=html.replace(/<style>([\s\S]*?)<\/style>/,(_,css)=>`<link rel="stylesheet" href="${asset(css+`\n.network-nav{display:flex;gap:24px;overflow-x:auto;white-space:nowrap;padding:15px max(20px,calc((100vw - 1320px)/2));border-bottom:1px solid #dcdfd7;background:#fff;font-size:14px}.network-nav a{padding:5px 0}.network-nav [aria-current]{font-weight:800;border-bottom:3px solid #172126}.site-header{position:relative;top:auto}.header-inner{height:80px}@media(max-width:600px){.network-nav{gap:20px;font-size:13px}.header-inner{height:auto}}`,'css')}">`);
 html=html.replace(/<script>window.__LETSUM_BOOTSTRAP__ = ([\s\S]*?);<\/script>/,(_,json)=>{const data=JSON.parse(json),route=data.initialRoute;delete data.initialRoute;data.production=true;return `<script src="${asset('window.__LETSUM_BOOTSTRAP__='+JSON.stringify(data).replace(/</g,'\\u003c')+';','js')}"></script><script>window.__LETSUM_BOOTSTRAP__.initialRoute=${JSON.stringify(route)};</script>`});
 html=html.replace(/<script type="module">([\s\S]*?)<\/script>/,(_,js)=>`<script type="module" src="${asset(js,'js')}"></script>`);
 html=html.replace('href="#/" aria-label="LETSUM 로고 홈"','href="/logos/" aria-label="LETSUM 로고 홈"');
 html=html.replace('</footer>','<p class="footer-inner"><a href="/subset.html">웹폰트 코드</a> · <a href="/contact.html">광고제휴 및 문의</a> · <a href="/privacy.html">개인정보처리방침</a></p></footer>');
 html=html.replace(/href="#\//g,'href="/logos/#/');
 html=html.replace('</body>','<script src="/js/pv.js?v=2" defer></script></body>');
 const dest=path.join(out,page.file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,html);
}
for(const [name,text] of shared)await fs.writeFile(path.join(out,name),text);
// Retain previously published hashed assets for cached HTML during subsequent deployments.
await fs.rm(path.join(out,'review.html'),{force:true});
console.log(`Logo directory: ${result.public_records} records, ${shared.size} shared assets`);
