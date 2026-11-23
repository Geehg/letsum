// Curated alternatives; refresh against both catalogues whenever pages are built.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'html/js/data.js'),'utf8') + ';' + fs.readFileSync(path.join(root,'html/js/data_en.js'),'utf8') + ';this.all=[...FONTS,...FONTS_EN]',ctx);
const fonts = new Map(ctx.all.map(f => [f.id,f]));
const config = JSON.parse(fs.readFileSync(path.join(__dirname,'state/font_alternatives.json'),'utf8'));
const eligible = f => f && !f.intro && f.status === 'verified' && f.license === 'OFL' && !/mabyko/i.test(f.id+' '+f.name+' '+f.en) && ['print','web','video','embed','bici','package','ofl'].every(k => f.matrix && f.matrix[k] === 'ok');
const groups = config.groups.map(g => {
  if(g.re) new RegExp(g.re);
  const items = g.ids.map(id => fonts.get(id)).filter(eligible).map(f => ({id:f.id,name:f.name,en:f.en,category:f.category,license:f.license,language:f.id.startsWith('e-')?'en':'ko'}));
  for(const id of g.ids) if(!eligible(fonts.get(id))) console.warn('Alternative excluded (missing or license not eligible): '+id);
  const {ids,...rest}=g; return {...rest,items};
});
fs.writeFileSync(path.join(root,'html/data/font_alternatives.json'),JSON.stringify({checked:config.checked,groups}));
module.exports = groups;
console.log('Font alternatives: '+groups.length+' groups, verified OFL only');
