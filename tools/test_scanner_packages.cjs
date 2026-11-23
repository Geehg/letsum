// Run with node tools/test_scanner_packages.cjs. No network or document contents leave this process.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const js = path.join(__dirname, '../html/js');
const rel = 'http://schemas.openxmlformats.org/package/2006/relationships';
const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const sheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const adobe = 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging';
function links(items) {
  return '<Relationships xmlns="'+rel+'">'+items.map(([id,type,target]) =>
    '<Relationship Id="'+id+'" Type="'+office+'/'+type+'" Target="'+target+'"/>').join('')+'</Relationships>';
}
async function inspect(ext, parts) {
  const found = [];
  const context = vm.createContext({URL, record(name, where, candidate=false) {if (name) found.push({name,where,candidate});}});
  vm.runInContext(fs.readFileSync(path.join(js,'vendor/extractor/saxes.min.js'),'utf8'),context);
  context.withFontArchive = async (_, keep, read) => read({
    entries:new Map(Object.entries(parts).filter(([name])=>keep(name))),
    async parse(name,events) {
      const parser=new context.ExtractorXML.SaxesParser({xmlns:true});
      for (const [event,handler] of Object.entries(events)) parser.on(event,handler);
      parser.write(parts[name]).close();
    }
  });
  vm.runInContext(fs.readFileSync(path.join(js,'office-font-reader.js'),'utf8'),context);
  await context.readDocumentPackage(null,ext);
  return found;
}
function has(rows,name,candidate) { return rows.some(row=>row.name===name && row.candidate===candidate); }
test('DOCX resolves a linked style and retains unused fonts as declarations',async()=>{
  const parts={'[Content_Types].xml':'<Types><Override PartName="/word/main.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':links([['doc','officeDocument','word/main.xml']]),
    'word/_rels/main.xml.rels':links([['s','styles','styles.xml'],['f','fontTable','fonts.xml']]),
    'word/main.xml':'<w:document xmlns:w="'+word+'"><w:p><w:pPr><w:pStyle w:val="Test"/></w:pPr><w:r><w:t>x</w:t></w:r></w:p></w:document>',
    'word/styles.xml':'<w:styles xmlns:w="'+word+'"><w:style w:styleId="Test"><w:rPr><w:rFonts w:eastAsia="Used"/></w:rPr></w:style></w:styles>',
    'word/fonts.xml':'<w:fonts xmlns:w="'+word+'"><w:font w:name="Declared"/></w:fonts>'};
  const rows=await inspect('docx',parts);
  assert.ok(has(rows,'Used',false));assert.ok(has(rows,'Declared',true));assert.ok(!has(rows,'Declared',false));
  await assert.rejects(()=>inspect('xlsx',parts),/문서 구조/);
});
test('XLSX maps cell indices and only referenced rich strings to their worksheet',async()=>{
  const parts={'[Content_Types].xml':'<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>','_rels/.rels':links([['doc','officeDocument','xl/workbook.xml']]),
    'xl/workbook.xml':'<workbook xmlns="'+sheet+'" xmlns:r="'+office+'"><sheets><sheet name="S" r:id="s"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':links([['s','worksheet','s.xml'],['r','sharedStrings','strings.xml'],['f','styles','styles.xml']]),
    'xl/styles.xml':'<styleSheet xmlns="'+sheet+'"><fonts><font><name val="Declared"/></font><font><name val="Used"/></font></fonts><cellXfs><xf fontId="1"/></cellXfs></styleSheet>',
    'xl/strings.xml':'<sst xmlns="'+sheet+'"><si><r><rPr><rFont val="Rich"/></rPr></r></si></sst>',
    'xl/s.xml':'<worksheet xmlns="'+sheet+'"><sheetData><row><c t="s"><v>0</v></c></row></sheetData></worksheet>'};
  const rows=await inspect('xlsx',parts);
  assert.ok(has(rows,'Used',false));assert.ok(has(rows,'Rich',false));assert.ok(!has(rows,'Declared',false));
});
test('HWPX resolves the same numeric font ID independently for Hangul and Latin',async()=>{
  const ns='http://www.hancom.co.kr/hwpml/2011/';
  const parts={'Contents/content.hpf':'<package><manifest><item id="header" href="header.xml"/><item id="section0" href="section0.xml"/></manifest><spine><itemref idref="section0"/></spine></package>',
    'Contents/header.xml':'<head xmlns="'+ns+'head"><fontface lang="HANGUL"><font id="0" face="Hangul"/></fontface><fontface lang="LATIN"><font id="0" face="Latin"/></fontface><charPr id="5"><fontRef hangul="0" latin="0"/></charPr></head>',
    'Contents/section0.xml':'<sec xmlns="'+ns+'section" xmlns:p="'+ns+'paragraph"><p:run charPrIDRef="5"><p:t>한글</p:t></p:run></sec>'};
  const rows=await inspect('hwpx',parts);
  assert.ok(has(rows,'Hangul',false));assert.ok(has(rows,'Latin',true));assert.ok(!has(rows,'Latin',false));
});
test('IDML follows a relative BasedOn style name, including the default paragraph style',async()=>{
  const parts={'designmap.xml':'<Document xmlns:i="'+adobe+'"><i:Styles src="Resources/Styles.xml"/><i:Story src="Stories/main.xml"/></Document>',
    'Resources/Styles.xml':'<i:Styles xmlns:i="'+adobe+'"><ParagraphStyle Self="ParagraphStyle/Base"><Properties><AppliedFont>Used</AppliedFont></Properties></ParagraphStyle><ParagraphStyle Self="ParagraphStyle/Derived"><Properties><BasedOn type="string">Base</BasedOn></Properties></ParagraphStyle></i:Styles>',
    'Stories/main.xml':'<i:Story xmlns:i="'+adobe+'"><Story><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Derived"/></Story></i:Story>'};
  assert.ok(has(await inspect('idml',parts),'Used',false));
});
