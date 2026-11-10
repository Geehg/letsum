const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../html');
const entries=[['/','한글 폰트'],['/en/','영문 폰트'],['/dingbat/','딩벳&특수'],['/logos/','로고모음'],['/mascots/','마스코트'],['/typing.html','필사독서']];
function links(active){return entries.map(([url,label])=>`<a href="${url}"${url===active?' class="on" aria-current="page"':''}>${label}</a>`).join('');}
exports.build=function(){
 // Combine both tools in one document; existing scripts retain their own scoped IDs.
 const db=path.join(root,'dingbat/index.html');let html=fs.readFileSync(db,'utf8');
 const symbols=fs.readFileSync(path.join(__dirname,'symbols_content.html'),'utf8');
 const subnav='<nav class="wrap collection-tabs" aria-label="딩벳과 특수기호"><a href="/dingbat/" data-collection="fonts" aria-controls="collection-fonts">딩벳 폰트</a><a href="/dingbat/?view=symbols" data-collection="symbols" aria-controls="collection-symbols">특수기호</a></nav>';
 html=html.replace('</header>','</header>'+subnav+'<div id="collection-fonts">').replace('<footer>','</div><div id="collection-symbols" class="sym-page" hidden>'+symbols+'</div><footer>');
 html=html.replace(/<title>.*?<\/title>/,'<title>딩벳&특수 — 딩벳 폰트·특수기호 복사 | LETSUM</title>');
 html=html.replace('</head>','<style>.collection-tabs{display:flex;gap:8px;padding-top:20px;padding-bottom:20px}.collection-tabs a{background:#fff;color:#161611;border:1px solid #aaa;padding:12px 24px;text-decoration:none;font-weight:700}.collection-tabs a[aria-current]{background:#161611;color:#fff;border-color:#161611}#collection-fonts[hidden],#collection-symbols[hidden]{display:none!important}</style></head>');
 html=html.replace('</body>','<script src="/js/symbols.js?v=integrated1"></script><script src="/js/collections.js?v=1"></script></body>');
 fs.writeFileSync(db,html);
 fs.writeFileSync(path.join(root,'symbols.html'),'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>특수기호 — 딩벳&특수 | LETSUM</title><link rel="canonical" href="https://letsum.app/dingbat/"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/dingbat/?view=symbols"></head><body><p><a href="/dingbat/?view=symbols">특수기호 통합 페이지로 이동</a></p><script>location.replace("/dingbat/?view=symbols"+location.hash)</script></body></html>');
 // /mascots/ is the mascot directory built by tools/build_mascots.mjs (run from build_pages.js after the logos).
 const files=fs.readdirSync(root).filter(n=>n.endsWith('.html')&&n!=='admin.html');
 for(const dir of ['font','topics','en','dingbat'])for(const name of fs.readdirSync(path.join(root,dir)))if(name.endsWith('.html'))files.push(dir+'/'+name);
 for(const name of files){const file=path.join(root,name);let s=fs.readFileSync(file,'utf8');
 const active=name==='index.html'?'/':name.startsWith('en/')?'/en/':name.startsWith('dingbat/')?'/dingbat/':name.startsWith('mascots/')?'/mascots/':name==='typing.html'?'/typing.html':null;
 s=s.replace(/<nav class="main">[\s\S]*?<\/nav>/,old=>'<nav class="main">'+links(active)+(old.match(/<button[^>]*id="projBtn"[\s\S]*?<\/button>/)?.[0]||'')+'</nav>');
 s=s.replace(/<footer[\s\S]*?<\/footer>/,footer=>footer.includes('subset.html')?footer:footer.replace('</footer>','<p class="wrap fine"><a href="/subset.html">웹폰트 코드</a></p></footer>'));
 fs.writeFileSync(file,s);}
 const map=path.join(root,'sitemap.xml');let xml=fs.readFileSync(map,'utf8').replace(/\s*<url><loc>https:\/\/letsum.app\/symbols.html<\/loc>[\s\S]*?<\/url>/,'');
 const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'logo-app/data/catalog.json'),'utf8'));
 const urls=['https://letsum.app/logos/',...catalog.records.filter(r=>!['draft','archived'].includes(r.review.status)).map(r=>'https://letsum.app/logos/brands/'+r.id+'/')];
 xml=xml.replace('</urlset>',urls.map(url=>`  <url><loc>${url}</loc></url>`).join('\n')+'\n</urlset>');fs.writeFileSync(map,xml);
};
