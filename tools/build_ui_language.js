// Included at the end of build_pages.js so regenerated pages retain language support.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = path.join(__dirname, "..", "html");
const dictionary = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", "en.json"), "utf8"));
const runtime = fs.readFileSync(path.join(__dirname, "i18n", "runtime.js"), "utf8").replace("/* UI_DICTIONARY */ {}", JSON.stringify(dictionary));
fs.writeFileSync(path.join(root, "js", "ui-language.js"), runtime);
const version = crypto.createHash("sha256").update(runtime).update(fs.readFileSync(path.join(root, "css", "ui-language.css"))).digest("hex").slice(0, 10);
const files = ["index.html", "en/index.html", "dingbat/index.html", "guide.html", "subset.html", "symbols.html", "typing.html", "notice.html", "privacy.html", "terms.html", "404.html"];
for (const directory of ["font", "topics"]) for (const name of fs.readdirSync(path.join(root, directory))) if (!name.startsWith(".") && name.endsWith(".html")) files.push(directory + "/" + name);
const hook = `<!--UI_LANGUAGE--><link rel="stylesheet" href="/css/ui-language.css?v=${version}"><script src="/js/ui-language.js?v=${version}"></script><!--/UI_LANGUAGE-->`;
const scriptVersions = Object.fromEntries(["main", "common", "reviews", "subset", "symbols", "shot"].map(name => [name,
  crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "js", name + ".js"))).digest("hex").slice(0, 10)]));
for (const name of files) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  let source = fs.readFileSync(file, "utf8").replace(/<!--UI_LANGUAGE-->[\s\S]*?<!--\/UI_LANGUAGE-->\n?/g, "");
  source = source.replace('</head>', hook + '\n</head>');
  for (const [script, hash] of Object.entries(scriptVersions)) source = source.replace(new RegExp(`js/${script}\\.js\\?v=[\\w]+`, "g"), `js/${script}.js?v=${hash}`);
  fs.writeFileSync(file, source);
}
console.log(`UI language: ${Object.keys(dictionary).length} translations, ${files.length} pages`);

require("./build_font_showcase.js");
