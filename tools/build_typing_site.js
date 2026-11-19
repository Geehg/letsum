// The old hostname now serves migration guidance only. The app lives in Geehg/goyo-typing.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../html');
exports.build=function(){
 fs.writeFileSync(path.join(root,'type/index.html'),fs.readFileSync(path.join(__dirname,'typing_retired.html')));
 fs.writeFileSync(path.join(root,'type/transfer.html'),fs.readFileSync(path.join(__dirname,'typing_transfer.html')));
 fs.writeFileSync(path.join(root,'type/sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
};
