// Verified screenshots and synthetic review copy are kept separate from visitor data.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'state/font_showcase.json'), 'utf8'));
if (data.entries.length !== 30 || new Set(data.entries.map(x => x.id)).size !== 30) throw Error('Expected 30 unique sample reviews');
for (const row of data.entries) {
  if (!row.body || !Number.isSafeInteger(row.demoLikes) || row.demoLikes < 0) throw Error('Invalid sample review');
  if (row.source && (!row.source.proof || !row.source.checked || !/^https:\/\//.test(row.source.url) || !row.source.image.startsWith('/img/font-showcase/') || !fs.existsSync(path.join(root, 'html', row.source.image)))) throw Error('Unverified screenshot: ' + row.id);
}
const publicEntries = Object.fromEntries(data.entries.map(({id, body, demoLikes, source}) => [id, {body,demoLikes,source:source ? (({proof,...publicSource})=>publicSource)(source) : null}]));
const js = fs.readFileSync(path.join(__dirname, 'showcase_runtime.js'), 'utf8').replace('/* SHOWCASE_DATA */ {}', JSON.stringify(publicEntries));
fs.writeFileSync(path.join(root,'html/js/font-showcase.js'),js);
const hash=crypto.createHash('sha256').update(js).update(fs.readFileSync(path.join(root,'html/css/font-showcase.css'))).digest('hex').slice(0,10);
for(const name of ['index.html','en/index.html','dingbat/index.html']){
  const file=path.join(root,'html',name);let html=fs.readFileSync(file,'utf8').replace(/<!--FONT_SHOWCASE-->[\s\S]*?<!--\/FONT_SHOWCASE-->\n?/g,'');
  html=html.replace(/(<script src="(?:\.\.\/)?js\/reviews\.js)/,`<!--FONT_SHOWCASE--><link rel="stylesheet" href="/css/font-showcase.css?v=${hash}"><script src="/js/font-showcase.js?v=${hash}"></script><!--/FONT_SHOWCASE-->\n$1`);
  fs.writeFileSync(file,html);
}
console.log(`Font showcase: ${data.entries.length} samples, ${data.entries.filter(x=>x.source).length} verified attachments`);
