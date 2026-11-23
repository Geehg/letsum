// Rebuild the local name index whenever the font catalogues are regenerated.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const data = vm.runInNewContext(['data', 'data_en', 'data_db'].map(name => read('html/js/' + name + '.js')).join('\n') +
  '\n;({fonts:[...FONTS,...FONTS_EN,...FONTS_DB], licenses:LICENSE_INFO})');
const names = json('html/data/names.json');
const aliases = json('tools/state/aliases.json');
const links = json('html/data/links.json');
const multilingual = json('tools/state/multilingual.json').fonts;
const extras = new Map();
for (const [alias, id] of Object.entries(aliases)) {
  if (!extras.has(id)) extras.set(id, []);
  extras.get(id).push(alias);
}
const ofl = json('tools/state/extractor_google_ofl.json');
const official = {
  "k-pretendard": {
    "base": "https://raw.githubusercontent.com/orioncactus/pretendard/5c41199ea0024a9e0b2cb31735265056e5472d76/",
    "files": {
      "packages/pretendard/dist/public/variable/PretendardVariable.ttf": 6739336,
      "packages/pretendard/dist/LICENSE.txt": 4419
    }
  },
  "k-suit": {
    "base": "https://raw.githubusercontent.com/sun-typeface/SUIT/55118d981336d8fce005eb62888c12c0568ef7b0/",
    "files": {
      "fonts/variable/ttf/SUIT-Variable.ttf": 1585020,
      "LICENSE": 4380
    }
  }
};
const catalogue = data.fonts.map(f => {
  const installed = names[f.id] || {};
  const forms = Object.values(installed.w || {}).flatMap(w => [w.win,w.winEn,w.fam,w.famEn,w.ps]);
  const aliases = [...new Set([f.en, installed.fam, installed.famEn, installed.file?.replace(/\.(ttf|otf|woff2?)$/i,''), ...forms, ...(f.searchAliases || []), ...(extras.get(f.id) || [])].filter(a => typeof a === 'string' && a && a !== f.name))];
  let source = f.dl?.page || links[f.id]?.url;
  const key = (f.en || f.name).toLowerCase().replace(/[^a-z0-9]/g,'');
  const google = [source,links[f.id]?.url,...Object.values(f.webfont || {})].some(s => /^https:\/\/(?:fonts\.google\.com|fonts\.gstatic\.com)\//.test(s));
  const eligible = google && f.status === 'verified' && !f.intro && /OFL/i.test(f.license) && ofl.families[key];
  if (eligible && source?.startsWith("https://fonts.google.com/download")) source = "https://fonts.google.com/specimen/" + encodeURIComponent(f.en || f.name);
  const direct = official[f.id] && !f.intro && f.status==="verified" && f.license==="OFL";
  if (direct) aliases.push(f.en + " Variable");
  return {id:f.id, name:f.name, aliases, license:f.license, verified:f.status === 'verified',
    detail:'/font/'+f.id+'.html', source, note:f.introReason || data.licenses[f.license]?.note,
    ...(direct ? {bundle:f.id} : eligible ? {bundle:key} : {})};
});
for (const m of multilingual) {
  if (catalogue.some(f => f.name === m.name || f.aliases.includes(m.name))) continue;
  const eligible = m.licenseUrl?.includes('/ofl/') && ofl.families[m.path];
  catalogue.push({id:'ml-'+m.id, name:m.name, aliases:[], license:eligible?'OFL':'배포처 이용조건 확인',
    verified:!!eligible, source:m.official, note:eligible?data.licenses.OFL.note:'', ...(eligible?{bundle:m.path}:{})});
}
const bundles = Object.fromEntries(catalogue.filter(f=>f.bundle).map(f=>[f.bundle, official[f.bundle]?.files || ofl.families[f.bundle]]));
const notes = [...new Set(catalogue.map(f=>f.note).filter(Boolean))];
const compact = catalogue.map(({note,...font})=>({...font,n:notes.indexOf(note)}));
const directBases = Object.fromEntries(Object.entries(official).map(([id,d])=>[id,d.base]));
const payload = JSON.stringify({fonts:compact,notes,bundles,directBases,revision:ofl.revision});
fs.writeFileSync(path.join(root,'html/data/extractor-catalog.json'),payload);
const hash = require('node:crypto').createHash('sha256').update(payload).update(read('html/data/paid_fonts.json')).digest('hex').slice(0,16);
const page = path.join(root,'html/font-extractor.html');
fs.writeFileSync(page,fs.readFileSync(page,'utf8').replace(/data-catalog-version="[^"]*"/,'data-catalog-version="'+hash+'"'));

