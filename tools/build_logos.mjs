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
function swap(text,from,to,what){const next=text.replace(from,to);if(next===text)throw new Error(`build_logos: ${what} not found`);return next;}
// Reuse the site's own header, footer and stylesheets (same approach as /mascots/), so the logo pages share fonts and chrome.
const home=await fs.readFile(path.join(root,'../html/index.html'),'utf8');
const absolute=text=>text.replace(/\b(href|src)="(?!https?:|\/|#|data:|mailto:)([^"]*)"/g,'$1="/$2"');
const homeHead=home.match(/<head>([\s\S]*?)<\/head>/)[1];
const siteHead=[...homeHead.matchAll(/<script>try\{var t=localStorage[\s\S]*?<\/script>|<link rel="(?:icon|apple-touch-icon|preconnect)"[^>]*>|<link rel="stylesheet" href="(?![^"]*preview-rendering)[^"]*">|<link href="https:\/\/fonts\.googleapis\.com[^"]*" rel="stylesheet">|<script src="\/js\/ui-language\.js[^"]*"><\/script>/g)].map(m=>absolute(m[0])).join('\n');
const siteHeader=absolute(home.match(/<header>[\s\S]*?<\/header>/)[0])
 .replace(/ class="on" aria-current="page"/g,'').replace('<a href="/logos/">','<a href="/logos/" class="on" aria-current="page">')
 .replace('<a class="logo" href="/index.html">','<a class="logo" href="/">')
 .replace(/<label class="hd-search">([\s\S]*?)<\/label>/,'<form class="hd-search" role="search" action="/index.html">$1</form>');
const siteFooter=absolute(home.match(/<footer>[\s\S]*?<\/footer>/)[0]);
// CI colours (official values as published, or extracted from the logo and marked unofficial).
let groups=null;
try{groups=JSON.parse(await fs.readFile(path.join(project,'data/groups.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let rank={},downloads={};
try{for(const [id,row] of Object.entries(JSON.parse(await fs.readFile(path.join(project,'data/popularity.json'),'utf8')).records))rank[id]=row.score;}catch(error){if(error.code!=='ENOENT')throw error;}
try{for(const [id,rows] of Object.entries(JSON.parse(await fs.readFile(path.join(project,'data/downloads.json'),'utf8')).downloads))downloads[id]=rows.map(({format,inner,label,url,bytes,filename})=>({format,inner:inner||null,label:label||null,url,bytes:bytes||null,filename:filename||null}));}catch(error){if(error.code!=='ENOENT')throw error;}
let colors={};
try{colors=JSON.parse(await fs.readFile(path.join(project,'data/colors.json'),'utf8')).colors;}catch(error){if(error.code!=='ENOENT')throw error;}
// Identification thumbnails kept on our server by tools/fetch_logo_thumbs.mjs; the catalog schema itself stays image-free.
let thumbnails={},geometry={};
try{geometry=JSON.parse(await fs.readFile(path.join(project,'data/logo-geometry.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
try{const manifest=JSON.parse(await fs.readFile(path.join(project,'data/thumbnails.json'),'utf8'));
 for(const [id,t] of Object.entries(manifest.thumbnails)){
  // Version from the file as published (normalize_logos.py rewrites files after collection).
  let bytes;try{bytes=await fs.readFile(path.join(root,'../html',t.file));}catch{continue;}
  const v='?v='+createHash('sha256').update(bytes).digest('hex').slice(0,10);
  const geo=geometry[path.basename(t.file)]||{};
  thumbnails[id]={mode:t.mode,tone:t.mode==='glyph'?'normal':geo.tone||t.tone||'normal',bg:t.bg,ink:t.ink,file:t.file+v,on_brand:t.on_brand?t.on_brand+v:null,ratio:geometry[path.basename(t.file)]?.ratio??null,source:t.source,license:t.license,author:t.author,page_url:t.page_url};
 }}catch(error){if(error.code!=='ENOENT')throw error;}
// The logo app's own variables are scoped to .logo-app so they no longer override the site's palette (and dark mode) in the shared header.
const scopedCss=css=>swap(css,/:root\{--paper:#f6f6f1;([\s\S]*?)--ink:#172126;([\s\S]*?)font-family:Arial,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;/,'.logo-app{--paper:#f4f2ec;$1--ink:#15140f;$2font-family:inherit;','logo :root palette')
 +`\n.logo-app{background:var(--paper);color:var(--ink)}
.logo-app .site-header{position:static;background:transparent;border:0}
.logo-app .header-inner{max-width:1280px;height:auto;min-height:0;padding:20px 24px;gap:8px}
.logo-app .primary-nav{height:auto;gap:8px;margin:0;flex-basis:auto}
.logo-app .primary-nav>a{height:auto;padding:12px 24px;border:1px solid #aaa;background:#fff;color:#161611;font-size:14px;font-weight:700}
.logo-app .primary-nav>a[aria-current]{background:#161611;color:#fff;border-color:#161611}
.logo-app .primary-nav>a[aria-current]:after{display:none}
.logo-app .primary-nav>a[aria-current] .nav-count{background:#fff;color:#161611}
.logo-app .page-container{max-width:1280px;padding-left:24px;padding-right:24px}
.logo-rights{max-width:1280px;margin:0 auto;padding:0 24px 8px;font-size:12px;color:var(--muted);line-height:1.7}
.logo-rights a{text-decoration:underline;text-underline-offset:3px}
@media(max-width:600px){.logo-app .header-inner{padding:16px 20px}.logo-app .primary-nav>a{padding:10px 16px;font-size:13px}.logo-app .page-container,.logo-rights{padding-left:20px;padding-right:20px}}`;
// Detail-only data (source evidence, image credits, full colour specs) leaves the shared bootstrap and is attached to each detail page, so the list loads less.
const credits={},colorsFull=colors,colorsLight={};
for(const [id,t] of Object.entries(thumbnails)){const {source,license,author,page_url,...rest}=t;thumbnails[id]=rest;credits[id]={source,license,author,page_url};}
for(const [id,c] of Object.entries(colorsFull)){const light={};for(const key of ['official','extracted'])if(c[key])light[key]=c[key].filter(x=>x.hex).slice(0,4).map(x=>({hex:x.hex}));colorsLight[id]=light;}
const loadingCss=`.logo-js #app>.static-fallback{display:none}
.logo-js #app:has(>.static-fallback){min-height:80vh;max-width:1280px;margin:0 auto;padding:40px 24px}
.logo-js #app:has(>.static-fallback)::before{content:"";display:block;height:70vh;border-radius:14px;background:linear-gradient(90deg,transparent 0,rgba(255,255,255,.55) 50%,transparent 100%) 0 0/40% 100% no-repeat,linear-gradient(#e7e4dc,#e7e4dc) 0 0/58% 64px no-repeat,linear-gradient(#ecE9e1,#ecE9e1) 0 96px/100% 72px no-repeat,repeating-linear-gradient(90deg,#ece9e1 0 calc(25% - 14px),transparent calc(25% - 14px) 25%) 0 200px/100% 220px no-repeat;animation:logo-shimmer 1.2s linear infinite}
@keyframes logo-shimmer{to{background-position:250% 0,0 0,0 96px,0 200px}}
@media(max-width:700px){.logo-js #app:has(>.static-fallback)::before{background:linear-gradient(#e7e4dc,#e7e4dc) 0 0/80% 48px no-repeat,linear-gradient(#ece9e1,#ece9e1) 0 80px/100% 60px no-repeat,repeating-linear-gradient(90deg,#ece9e1 0 calc(50% - 7px),transparent calc(50% - 7px) 50%) 0 170px/100% 200px no-repeat}}
@media(prefers-reduced-motion:reduce){.logo-js #app:has(>.static-fallback)::before{animation:none}}`;
for(const page of result.html_pages){
 if(page.route==='/review')continue;
 let html=await fs.readFile(path.join(project,'dist',page.file),'utf8'),bootSrc='',appSrc='';
 html=html.replace(/(https:\/\/letsum.app\/logos\/brands\/[^\"]+\/)index.html/g,'$1');
 html=html.replace(/\s*<meta name="color-scheme" content="light">/,'');
 html=swap(html,/<style>([\s\S]*?)<\/style>/,(_,css)=>`${siteHead}\n<link rel="stylesheet" href="${asset(scopedCss(css),'css')}">`,'inline style');
 html=swap(html,/<a class="brand"[\s\S]*?<\/a>\s*/,'','logo app brand');
 html=swap(html,/\s*<a class="font-link"[\s\S]*?<\/a>/,'','font link');
 html=swap(html,'<header class="site-header">',siteHeader+'<div class="logo-app"><header class="site-header" aria-label="로고모음 메뉴">','logo header');
 html=swap(html,/<footer class="site-footer">[\s\S]*?<\/footer>/,'<p class="logo-rights">상표와 로고의 권리는 각 권리자에게 있습니다. 공식 페이지의 이용 조건을 확인해 주세요. · <a href="#/guide">정보 확인 기준</a> · <a href="/contact.html">링크 제보</a></p></div>'+siteFooter,'logo footer');
 html=html.replace(/<script>window.__LETSUM_BOOTSTRAP__ = ([\s\S]*?);<\/script>/,(_,json)=>{const data=JSON.parse(json),route=data.initialRoute;delete data.initialRoute;data.production=true;data.thumbnails=thumbnails;data.colors=colorsLight;const pageSources=data.sources;data.sources={...pageSources,sources:[]};data.groups=groups;data.rank=rank;data.downloads=downloads;const id=route.startsWith('/brand/')?route.slice(7):null,record=id&&data.catalog.records.find(r=>r.id===id);
  const extra=record?{sources:pageSources.sources.filter(s=>record.source_ids.includes(s.id)),credit:credits[id]||null,colors:colorsFull[id]||null}:null;
  const inline=`var B=window.__LETSUM_BOOTSTRAP__;B.initialRoute=${JSON.stringify(route)};`+(extra?`var X=${JSON.stringify(extra).replace(/</g,'\\u003c')};B.sources.sources=X.sources;if(X.credit&&B.thumbnails[${JSON.stringify(id)}])Object.assign(B.thumbnails[${JSON.stringify(id)}],X.credit);if(X.colors)B.colors[${JSON.stringify(id)}]=X.colors;`:'');
  bootSrc=asset('window.__LETSUM_BOOTSTRAP__='+JSON.stringify(data).replace(/</g,'\\u003c')+';','js');
  return `<script src="${bootSrc}"></script><script>${inline}</script>`});
 html=html.replace(/<script type="module">([\s\S]*?)<\/script>/,(_,js)=>{appSrc=asset(js,'js');return `<script type="module" src="${appSrc}"></script>`;});
 // While the app script loads, show a text-free skeleton instead of the no-JavaScript fallback list; the list returns if the app never starts.
 html=swap(html,'</head>',`<script>document.documentElement.classList.add('logo-js')</script>\n<link rel="preload" href="${bootSrc}" as="script">\n<link rel="modulepreload" href="${appSrc}">\n<style>${loadingCss}</style>\n</head>`,'head end');
 html=html.replace('</body>',`<script>setTimeout(function(){if(document.querySelector('#app>.static-fallback'))document.documentElement.classList.remove('logo-js')},10000)</script></body>`);
 // The fallback (no JavaScript, search engines) keeps names and official links only — no machine-collected notes.
 html=html.replace(/(<li><h2>[^<]*<\/h2>)<p>[^<]*<\/p>/g,'$1').replace(/<p>공식 페이지 본문을 확인한 초기 안내 데이터[^<]*<\/p>/,'').replace(/<p>공식 홈페이지(?:의 CI·상징 안내 페이지를 자동 수집으로 찾았습니다| 정보입니다)[^<]*<\/p>/g,'');
 html=html.replace(/href="#\//g,'href="/logos/#/');
 html=html.replace('</body>','<script src="/js/common.js" data-base="/"></script><script src="/js/pv.js?v=2" defer></script></body>');
 const dest=path.join(out,page.file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,html);
}
for(const [name,text] of shared)await fs.writeFile(path.join(out,name),text);
// Retain previously published hashed assets for cached HTML during subsequent deployments.
await fs.rm(path.join(out,'review.html'),{force:true});
console.log(`Logo directory: ${result.public_records} records, ${shared.size} shared assets`);
