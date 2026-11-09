// Included at the end of build_pages.js so regenerated pages retain language support.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = path.join(__dirname, "..", "html");
const dictionary = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", "en.json"), "utf8"));
const runtime = fs.readFileSync(path.join(__dirname, "i18n", "runtime.js"), "utf8").replace("/* UI_DICTIONARY */ {}", JSON.stringify(dictionary));
fs.writeFileSync(path.join(root, "js", "ui-language.js"), runtime);
const version = crypto.createHash("sha256").update(runtime).update(fs.readFileSync(path.join(root, "css", "ui-language.css"))).digest("hex").slice(0, 10);
const files = ["mascots/index.html", "pairing.html", "submit.html", "contact.html", "about.html", "index.html", "en/index.html", "dingbat/index.html", "guide.html", "subset.html", "symbols.html", "typing.html", "notice.html", "privacy.html", "terms.html", "404.html"];
for (const directory of ["font", "topics"]) for (const name of fs.readdirSync(path.join(root, directory))) if (!name.startsWith(".") && name.endsWith(".html")) files.push(directory + "/" + name);
const hook = `<!--UI_LANGUAGE--><link rel="stylesheet" href="/css/ui-language.css?v=${version}"><script src="/js/ui-language.js?v=${version}"></script><!--/UI_LANGUAGE-->`;
const scriptVersions = Object.fromEntries(["main", "common", "reviews", "subset", "symbols", "shot", "data", "data_en", "data_db"].map(name => [name,
  crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "js", name + ".js"))).digest("hex").slice(0, 10)]));
for (const name of files) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  let source = fs.readFileSync(file, "utf8").replace(/<!--UI_LANGUAGE-->[\s\S]*?<!--\/UI_LANGUAGE-->\n?/g, "");
  source = source.replace(/<!--HEADER_BRAND-->[\s\S]*?<!--\/HEADER_BRAND-->\n?/g, "");
  if (source.includes('id="qTop"') && source.includes('class="logo"')) {
    source = source.replace(/(<a class="logo"[^>]*><img[^>]*>)(?:<span class="brand-copy">[\s\S]*?<\/span>)?(<\/a>)/g,
      '$1<span class="brand-copy"><strong translate="no">렛섬</strong><small>내 취향에 맞는 무료 폰트</small></span>$2');
    const headerHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "css/header-brand.css"))).digest("hex").slice(0, 10);
    source = source.replace('</head>', `<!--HEADER_BRAND--><link rel="stylesheet" href="/css/header-brand.css?v=${headerHash}"><!--/HEADER_BRAND-->\n</head>`);
  }
  source = source.replace(/<!--PREVIEW_RENDERING-->[\s\S]*?<!--\/PREVIEW_RENDERING-->\n?/g, "");
  if (["index.html", "en/index.html", "dingbat/index.html"].includes(name) || name.startsWith("font/")) {
    const renderHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "js/preview-rendering.js"))).update(fs.readFileSync(path.join(root, "css/preview-rendering.css"))).digest("hex").slice(0, 10);
    source = source.replace('</head>', `<!--PREVIEW_RENDERING--><link rel="stylesheet" href="/css/preview-rendering.css?v=${renderHash}"><script src="/js/preview-rendering.js?v=${renderHash}" defer></script><!--/PREVIEW_RENDERING-->\n</head>`);
  }
  source = source.replace('</head>', hook + '\n</head>');
  for (const [script, hash] of Object.entries(scriptVersions)) source = source.replace(new RegExp(`js/${script}\\.js\\?v=[\\w]+`, "g"), `js/${script}.js?v=${hash}`);
  source = source.replace(/<!--FAMILY_SITES-->[\s\S]*?<!--\/FAMILY_SITES-->/g, "");
  if (source.includes("</footer>")) {
    const familySites = [["한 코 · ONE DOT PATTERN", "https://pattern.one-dot.kr/", "나만의 뜨개 도안 작업실"], ["원닷 · ONE DOT", "https://one-dot.kr/", "AI를 읽는 새로운 시선"], ["F.O.V. · Field of View", "https://foview.co.kr/", "시야를 넓히는 콘텐츠 스튜디오"], ["렛섬 · LETSUM", "https://letsum.app/", "내 취향에 맞는 무료 폰트"], ["렛섬 필사독서", "https://type.letsum.app/", "읽는 것을 넘어, 쓰는 독서"], ["고요서가", "https://goyoseoga.com/", "오래된 문장, 오늘의 발견"]];
    const familyHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "css/family-sites.css"))).digest("hex").slice(0, 10);
    const family = `<div class="family-sites-row wrap"><details class="family-sites"><summary>함께 운영하는 사이트 <span aria-hidden="true">＋</span></summary><nav aria-label="함께 운영하는 사이트">${familySites.map(([label, url, copy]) => `<a href="${url}" target="_blank" rel="noopener noreferrer"><span class="family-sites-name" translate="no">${label}</span><small class="family-sites-copy">${copy}</small><span aria-hidden="true">↗</span><span class="family-sites-sr"> (새 탭)</span></a>`).join("")}</nav></details></div>`;
    source = source.replace("</footer>", `<!--FAMILY_SITES-->${family}<!--/FAMILY_SITES--></footer>`);
    source = source.replace("</head>", `<!--FAMILY_SITES--><link rel="stylesheet" href="/css/family-sites.css?v=${familyHash}"><!--/FAMILY_SITES--></head>`);
  }
  source = source.replace(/<!--SITE_ABOUT-->[\s\S]*?<!--\/SITE_ABOUT-->/g, "");
  source = source.replace("</footer>", '<!--SITE_ABOUT--><p class="wrap fine"><a href="/about.html">렛섬 소개·편집 원칙</a> · <a href="/privacy.html">개인정보처리방침</a> · <a href="/terms.html">이용약관</a></p><!--/SITE_ABOUT--></footer>');
  source = source.replace(/<!--CONTACT_STYLE-->[\s\S]*?<!--\/CONTACT_STYLE-->/g, "");
  if (source.includes("</footer>")) {
    const contactLink = '<a class="contact-link" href="/contact.html">광고제휴 및 문의</a>';
    source = source.replace(/<footer[\s\S]*?<\/footer>/g, footer => {
      footer = footer.replace(/(?:문의[: ]*)?<a[^>]*href="mailto:interq4@naver.com"[^>]*>[\s\S]*?<\/a>/g, contactLink);
      if (!footer.includes('class="contact-link"')) footer = footer.replace('</footer>', '<div class="wrap">'+contactLink+'</div></footer>');
      return footer;
    });
    const contactHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(root,"css/contact.css"))).update(fs.readFileSync(path.join(root,"js/contact.js"))).digest("hex").slice(0,10);
    source = source.replace(/<link rel="stylesheet" href="\/css\/contact.css[^" ]*">/g, "");
    source = source.replace('</head>', `<!--CONTACT_STYLE--><link rel="stylesheet" href="/css/contact.css?v=${contactHash}"><!--/CONTACT_STYLE--></head>`);
    source = source.replace(/js\/contact.js\?v=[\w]+/g, `js/contact.js?v=${contactHash}`);
  }
  fs.writeFileSync(file, source);
}
console.log(`UI language: ${Object.keys(dictionary).length} translations, ${files.length} pages`);

require("./build_font_showcase.js");

require("./build_adsense.js").build(root, files);
