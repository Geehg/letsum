// Review verification is independent of serving ads. Never auto-enable after a date.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
function canServe(c, now = Date.now()) {
  return c.adsEnabled === true && c.siteApproved === true && c.cmpPublished === true &&
    Number.isFinite(Date.parse(c.privacyEffectiveAt)) && now >= Date.parse(c.privacyEffectiveAt);
}
function build(root, files) {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'state/adsense.json')));
  if (!/^ca-pub-\d{16}$/.test(c.publisher)) throw new Error('Invalid AdSense publisher');
  if (c.adsEnabled && !canServe(c)) throw new Error('Approval, CMP and privacy notice gates must be complete before ads');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'js/adsense.js'))).update(fs.readFileSync(path.join(root,'css/adsense.css'))).digest('hex').slice(0,10);
  for (const name of files) {
    const file = path.join(root,name); if (!fs.existsSync(file)) continue;
    let s = fs.readFileSync(file,'utf8').replace(/<!--ADSENSE-->[\s\S]*?<!--\/ADSENSE-->/g,'');
    if (c.verificationEnabled && name !== '404.html') s = s.replace('</head>', `<!--ADSENSE--><meta name="google-adsense-account" content="${c.publisher}"><!--/ADSENSE--></head>`);
    const slot = c.placements[name];
    if (canServe(c) && slot) {
      if (!/^\d+$/.test(slot)) throw new Error('Invalid slot');
      s = s.replace('</head>', `<!--ADSENSE--><link rel="stylesheet" href="/css/adsense.css?v=${hash}"><script defer src="/js/adsense.js?v=${hash}"></script><!--/ADSENSE--></head>`);
      s = s.replace('</main>', `<!--ADSENSE--><aside class="ls-ad" aria-label="광고"><small>광고</small><ins class="adsbygoogle" style="display:block" data-ad-client="${c.publisher}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins></aside><!--/ADSENSE--></main>`);
    }
    fs.writeFileSync(file,s);
  }
  console.log(`AdSense verification ${c.verificationEnabled ? 'on' : 'off'}; serving ${canServe(c) ? 'on' : 'off'}`);
}
module.exports = {canServe,build};
