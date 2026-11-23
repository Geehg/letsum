// Font references in local XML packages. Font tables are evidence of a declaration, not of visible text.
// Format references used to check field names and relationships:
// https://github.com/hancom-io/hwpx-owpml-model/tree/master/OWPML/Class/Head
// https://github.com/python-openxml/python-docx/blob/master/src/docx/oxml/text/font.py
// https://github.com/exceljs/exceljs/blob/master/lib/xlsx/xform/style/font-xform.js
// https://github.com/Starou/SimpleIDML/blob/master/src/simple_idml/components.py
'use strict';
const wordNS = new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']);
const sheetNS = new Set(['http://schemas.openxmlformats.org/spreadsheetml/2006/main','http://purl.oclc.org/ooxml/spreadsheetml/main']);
const drawingNS = new Set(['http://schemas.openxmlformats.org/drawingml/2006/main','http://purl.oclc.org/ooxml/drawingml/main']);
const relNS = new Set(['http://schemas.openxmlformats.org/package/2006/relationships','http://purl.oclc.org/ooxml/package/relationships']);
const idmlNS = 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging';
const hanNS = 'http://www.hancom.co.kr/hwpml/2011/';
const mismatch = () => Error('확장자와 문서 구조가 일치하지 않거나 필요한 문서 항목이 없습니다.');

function attr(tag, name, uri = '') {
  for (const field of Object.values(tag.attributes))
    if (field.local === name && field.uri === uri) return field.value;
}
function partTarget(owner, target) {
  if (!target || /[\\#?]|^[a-z][a-z\d+.-]*:|^\/\//i.test(target)) return '';
  const url = new URL(target, 'https://document.invalid/' + owner);
  return url.origin === 'https://document.invalid' ? decodeURI(url.pathname.slice(1)) : '';
}
async function part(archive, file, root, visit = {}, namespaces) {
  const stack = [];
  await archive.parse(file, {
    opentag(tag) {
      if (!stack.length && (tag.local !== root || (namespaces && !namespaces.has(tag.uri)))) throw mismatch();
      if (stack.length > 256) throw Error('문서 XML 구조가 너무 깊습니다.');
      stack.push(tag);
      visit.open?.(tag, stack);
    },
    closetag(tag) { visit.close?.(tag, stack); stack.pop(); },
    text(text) { visit.text?.(text, stack); },
    cdata(text) { visit.text?.(text, stack); }
  });
}
async function relationships(archive, owner) {
  const filename = owner ? owner.replace(/([^/]+)$/, '_rels/$1.rels') : '_rels/.rels';
  const links = new Map();
  if (!archive.entries.has(filename)) return links;
  await part(archive, filename, 'Relationships', {open(tag) {
    if (tag.local !== 'Relationship' || !relNS.has(tag.uri) || attr(tag,'TargetMode') === 'External') return;
    const path = partTarget(owner, attr(tag,'Target'));
    const type = attr(tag,'Type') || '';
    if (path && /^https?:\/\/(?:schemas\.openxmlformats\.org\/officeDocument\/2006|purl\.oclc\.org\/ooxml\/officeDocument)\/relationships\//.test(type))
      links.set(attr(tag,'Id'), {type:type.split('/').pop(), path});
  }}, relNS);
  return links;
}
const firstPart = (links, type) => [...links.values()].find(link => link.type === type)?.path;

async function themeFonts(archive, file) {
  const fonts = new Map();
  if (!file) return fonts;
  await part(archive, file, 'theme', {open(tag, stack) {
    const parent = stack.at(-2)?.local;
    if (!drawingNS.has(tag.uri) || !['majorFont','minorFont'].includes(parent)) return;
    const name = attr(tag,'typeface');
    if (name) fonts.set(parent.slice(0,5) + ':' + (attr(tag,'script') || tag.local), name);
  }}, drawingNS);
  return fonts;
}

async function readWord(archive, main, links) {
  const theme = await themeFonts(archive, firstPart(links,'theme'));
  const langs = {};
  const settings = firstPart(links,'settings');
  if (settings) await part(archive, settings, 'settings', {open(tag) {
    if (wordNS.has(tag.uri) && tag.local === 'themeFontLang') for (const key of ['eastAsia','bidi']) langs[key] = attr(tag,key,tag.uri);
  }}, wordNS);
  function fontNames(tag) {
    const names = new Set();
    for (const key of ['ascii','hAnsi','eastAsia','cs']) {
      const named = attr(tag,key,tag.uri);
      const slot = attr(tag,key === 'cs' ? 'cstheme' : key+'Theme',tag.uri) || attr(tag,key+'Theme',tag.uri);
      if (!slot) { if (named) names.add(named); continue; }
      const group = /^(major|minor)/.exec(slot)?.[0];
      const kind = /EastAsia$/i.test(slot) ? 'ea' : /Bidi$/i.test(slot) ? 'cs' : 'latin';
      let name = theme.get(group+':'+kind);
      if (!name && kind !== 'latin') {
        const lang = langs[kind === 'ea' ? 'eastAsia' : 'bidi'] || '';
        const script = [['ko','Hang'],['ja','Jpan'],['zh-TW','Hant'],['zh-HK','Hant'],['zh','Hans'],['ar','Arab'],['he','Hebr'],['hi','Deva']].find(([prefix])=>lang.toLowerCase().startsWith(prefix.toLowerCase()));
        if (script) name = theme.get(group+':'+script[1]);
      }
      if (name || named) names.add(name || named);
    }
    return names;
  }
  const styles = new Map(), defaults = new Set();
  const styleFile = firstPart(links,'styles');
  if (styleFile) {
    let style;
    await part(archive, styleFile, 'styles', {open(tag, stack) {
      if (!wordNS.has(tag.uri)) return;
      if (tag.local === 'style') {
        style = {names:new Set(), base:null};
        const id = attr(tag,'styleId',tag.uri); styles.set(id,style);
        if (attr(tag,'type',tag.uri) === 'paragraph' && ['1','true','on'].includes(attr(tag,'default',tag.uri))) defaults.add(id);
      }
      if (tag.local === 'basedOn' && style) style.base = attr(tag,'val',tag.uri);
      if (tag.local === 'rFonts') for (const font of fontNames(tag)) {
        record(font,'Word 스타일 정의 후보',true);
        if (style) style.names.add(font);
        else if (stack.some(t=>t.local==='docDefaults')) {
          if (!styles.has('')) styles.set('',{names:new Set()});
          styles.get('').names.add(font);
        }
      }
    }, close(tag) { if (wordNS.has(tag.uri) && tag.local === 'style') style = null; }}, wordNS);
  }
  const table = firstPart(links,'fontTable');
  if (table) await part(archive,table,'fonts',{open(tag) {
    if (wordNS.has(tag.uri) && tag.local==='font') record(attr(tag,'name',tag.uri),'Word 글꼴 표 후보',true);
  }},wordNS);
  const places = {header:['hdr','머리글'],footer:['ftr','바닥글'],footnotes:['footnotes','각주'],endnotes:['endnotes','미주']};
  const parts = [[main,'document','Word 본문']];
  for (const link of links.values()) if (places[link.type]) parts.push([link.path,...places[link.type]]);
  for (const [file,root,where] of parts) {
    const used = new Set();
    await part(archive,file,root,{open(tag) {
      if (!wordNS.has(tag.uri)) return;
      if (tag.local==='rFonts') for (const name of fontNames(tag)) record(name,where+' 글자 서식');
      if (tag.local==='rStyle' || tag.local==='pStyle') used.add(attr(tag,'val',tag.uri));
      if (tag.local==='t') { used.add(''); for (const id of defaults) used.add(id); }
    }},wordNS);
    const visited = new Set();
    for (let id of used) while (id != null && styles.has(id) && !visited.has(id)) {
      visited.add(id);
      const style = styles.get(id);
      for (const name of style.names) record(name,where+' 연결 스타일');
      id = style.base;
    }
  }
}

async function readExcel(archive, main, links) {
  const sheets = [];
  await part(archive,main,'workbook',{open(tag) {
    if (sheetNS.has(tag.uri) && tag.local==='sheet') {
      const id = Object.values(tag.attributes).find(a=>a.local==='id' && a.uri.endsWith('/relationships'))?.value;
      const link = links.get(id);
      if (link?.type==='worksheet') sheets.push(link.path);
    }
  }}, sheetNS);
  const fonts = [], formats = [], rich = new Map();
  const theme = await themeFonts(archive,firstPart(links,'theme'));
  const styles = firstPart(links,'styles');
  if (styles) {
    let font;
    await part(archive,styles,'styleSheet',{open(tag, stack) {
      if (!sheetNS.has(tag.uri)) return;
      const parent = stack.at(-2)?.local;
      if (tag.local==='font' && parent==='fonts') { font={}; fonts.push(font); }
      if (font && parent==='font' && tag.local==='name') font.name=attr(tag,'val');
      if (font && parent==='font' && tag.local==='scheme') font.scheme=attr(tag,'val');
      if (tag.local==='xf' && parent==='cellXfs') formats.push(attr(tag,'fontId') || '0');
    },close(tag) {
      if (tag.local==='font' && font) {
        record(font.name,'Excel 셀 서식표 후보',true);
        font.name = theme.get(font.scheme+':latin') || font.name;
        font=null;
      }
    }},sheetNS);
  }
  const strings = firstPart(links,'sharedStrings');
  if (strings) {
    let index = -1;
    await part(archive,strings,'sst',{open(tag, stack) {
      if (!sheetNS.has(tag.uri)) return;
      if (tag.local==='si') index++;
      if (tag.local==='rFont' && stack.at(-2)?.local==='rPr') {
        const name=attr(tag,'val'); if (!name) return;
        if (!rich.has(index)) rich.set(index,new Set());
        rich.get(index).add(name);
        record(name,'Excel 공유 문자열 표 후보',true);
      }
    }},sheetNS);
  }
  for (const [index,file] of sheets.entries()) {
    const where = 'Excel 시트 '+(index+1), stylesUsed = new Set();
    let sharedCell=false, value='';
    await part(archive,file,'worksheet',{open(tag, stack) {
      if (!sheetNS.has(tag.uri)) return;
      if (tag.local==='c') {
        stylesUsed.add(attr(tag,'s') || '0');
        sharedCell = attr(tag,'t')==='s'; value='';
      }
      if (tag.local==='row' && attr(tag,'s')) stylesUsed.add(attr(tag,'s'));
      if (tag.local==='col' && attr(tag,'style')) stylesUsed.add(attr(tag,'style'));
      if (tag.local==='rFont' && stack.at(-2)?.local==='rPr') record(attr(tag,'val'),where+' 문자열');
    },text(s,stack) { if (sharedCell && stack.at(-1)?.local==='v' && value.length<20) value+=s; },
    close(tag) {
      if (tag.local==='c' && sharedCell) {
        if (/^\d+$/.test(value.trim())) for (const name of rich.get(Number(value)) || []) record(name,where+' 공유 문자열');
        sharedCell=false;
      }
    }},sheetNS);
    for (const id of stylesUsed) record(fonts[formats[id]]?.name,where+' 셀 서식');
  }
}

async function readHangul(archive) {
  const hpf = 'Contents/content.hpf';
  const items = new Map(), order = [];
  await part(archive,hpf,'package',{open(tag) {
    if (tag.local==='item') {
      const href = attr(tag,'href');
      const rootPath = partTarget('',href);
      items.set(attr(tag,'id'),archive.entries.has(rootPath) ? rootPath : partTarget(hpf,href));
    }
    if (tag.local==='itemref') order.push(attr(tag,'idref'));
  }});
  const header = items.get('header');
  if (!header) throw mismatch();
  const faces = new Map(), properties = new Map();
  let language, property;
  await part(archive,header,'head',{open(tag) {
    if (tag.uri!==hanNS+'head') return;
    if (tag.local==='fontface') language=(attr(tag,'lang') || '').toLowerCase();
    if (tag.local==='font' && language) {
      const font = attr(tag,'face');
      faces.set(language+':'+attr(tag,'id'),font);
      record(font,'한글 문서 글꼴 표 후보',true);
    }
    if (tag.local==='charPr') property=attr(tag,'id');
    if (tag.local==='fontRef' && property!=null)
      properties.set(property,new Map(Object.values(tag.attributes).map(field=>[field.local,field.value])));
  },close(tag) {
    if (tag.local==='fontface') language=null;
    if (tag.local==='charPr') property=null;
  }},new Set([hanNS+'head']));
  const sections = order.filter(id => /^section\d+$/i.test(id) || /\/section\d+\.xml$/i.test(items.get(id) || ''));
  if (!sections.length) throw mismatch();
  const scripts = [
    ['hangul',/\p{Script=Hangul}/u],['latin',/[\p{Script=Latin}\d]/u],['hanja',/\p{Script=Han}/u],
    ['japanese',/[\p{Script=Hiragana}\p{Script=Katakana}]/u],['user',/\p{Co}/u],['symbol',/\p{S}/u],
    ['other',/[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Thai}\p{Script=Devanagari}]/u]
  ];
  for (const [index,id] of sections.entries()) {
    const runs=[];
    await part(archive,items.get(id),'sec',{open(tag) {
      if (tag.uri===hanNS+'paragraph' && tag.local==='run') runs.push(properties.get(attr(tag,'charPrIDRef')));
    },text(text,stack) {
      const tag=stack.at(-1), refs=runs.at(-1);
      if (!refs || tag?.uri!==hanNS+'paragraph' || tag.local!=='t') return;
      for (const [lang,re] of scripts) if (re.test(text))
        record(faces.get(lang+':'+refs.get(lang)), '한글 '+(index+1)+'구역 본문');
    },close(tag) {
      if (tag.uri===hanNS+'paragraph' && tag.local==='run') runs.pop();
    }},new Set([hanNS+'section']));
  }
}

async function readIndesign(archive) {
  const parts = {Fonts:[],Styles:[],Story:[]};
  await part(archive,'designmap.xml','Document',{open(tag) {
    if (tag.uri===idmlNS && Object.hasOwn(parts,tag.local)) parts[tag.local].push(partTarget('designmap.xml',attr(tag,'src')));
  }});
  if (!Object.values(parts).some(list=>list.length)) throw mismatch();
  for (const file of parts.Fonts) await part(archive,file,'Fonts',{open(tag) {
    if (tag.local==='FontFamily') record(attr(tag,'Name'),'InDesign 글꼴 표 후보',true);
  }},new Set([idmlNS]));
  const styles = new Map();
  for (const [kind,files] of [['Styles',parts.Styles],['Story',parts.Story]]) {
    for (const [index,file] of files.entries()) {
      const where = 'InDesign 스토리 '+(index+1);
      const used = new Set();
      let style, propertyText='';
      function font(name) {
        if (!name || name.startsWith('$ID/') || name==='NothingEnum.NOTHING') return;
        if (kind==='Styles') {
          if (style) style.names.add(name);
          record(name,'InDesign 스타일 정의 후보',true);
        } else record(name,where+' 글자 서식');
      }
      await part(archive,file,kind,{open(tag) {
        if (tag.uri) return;
        if (kind==='Styles' && /^(Character|Paragraph)Style$/.test(tag.local)) {
          style={names:new Set(), kind:tag.local}; styles.set(attr(tag,'Self'),style);
        }
        if (kind==='Story' && /^(Character|Paragraph)StyleRange$/.test(tag.local))
          used.add(attr(tag,tag.local==='CharacterStyleRange'?'AppliedCharacterStyle':'AppliedParagraphStyle'));
        font(attr(tag,'AppliedFont'));
        if (tag.local==='BasedOn' || tag.local==='AppliedFont') propertyText='';
      },text(text,stack) {
        if (['BasedOn','AppliedFont'].includes(stack.at(-1)?.local) && propertyText.length<512) propertyText+=text;
      },close(tag) {
        if (tag.uri) return;
        if (tag.local==='AppliedFont') font(propertyText.trim());
        if (tag.local==='BasedOn' && style) {
          const base=propertyText.trim();
          style.base=/^(ParagraphStyle|CharacterStyle)\//.test(base) ? base : style.kind+'/'+base;
        }
        if (/^(Character|Paragraph)Style$/.test(tag.local)) style=null;
      }},new Set([idmlNS]));
      const visited=new Set();
      for (let id of used) while (styles.has(id) && !visited.has(id)) {
        visited.add(id);
        const linked=styles.get(id);
        for (const name of linked.names) record(name,where+' 연결 스타일');
        id=linked.names.size ? null : linked.base;
      }
    }
  }
}

async function readDocumentPackage(file, ext) {
  const xmlPart = path => /(?:\.xml|\.rels|\.hpf)$/i.test(path);
  await withFontArchive(file,xmlPart,async archive => {
    if (ext==='hwpx') return readHangul(archive);
    if (ext==='idml') return readIndesign(archive);
    const main=firstPart(await relationships(archive,''),'officeDocument');
    if (!main || !archive.entries.has('[Content_Types].xml')) throw mismatch();
    const type = ext==='docx' ? 'wordprocessingml.document' : 'spreadsheetml.sheet';
    const expected='application/vnd.openxmlformats-officedocument.'+type+'.main+xml';
    let matches=false;
    await part(archive,'[Content_Types].xml','Types',{open(tag) {
      if (tag.local==='Override' && partTarget('',attr(tag,'PartName'))===main && attr(tag,'ContentType')===expected) matches=true;
    }});
    if (!matches) throw mismatch();
    const links=await relationships(archive,main);
    if (ext==='docx') return readWord(archive,main,links);
    return readExcel(archive,main,links);
  });
}
