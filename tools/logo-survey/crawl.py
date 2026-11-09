"""Step 2 of the logo survey: visit each organisation's official site and collect its CI page, logo image and colours.

For every organisation in data/orgs.json:
  * find the CI / symbol page from links on the home page (and its site map page),
  * read colour specifications written on that page (PANTONE, CMYK, RGB, HEX) exactly as published,
  * pick a logo image: the Wikidata logo file on Wikimedia Commons, else the site's header logo, else a CI page image,
  * if the page publishes no colour codes, sample the logo image and mark those colours as extracted (unofficial).
Results go to data/crawl.json; images to html/logos/thumbs/. Re-running keeps earlier results for sites that fail.
Usage: python3 tools/logo-survey/crawl.py [--only 이름,...] [--workers 12]   (not -I: Pillow lives in the user site-packages)
"""
import argparse, colorsys, hashlib, html, io, json, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(__file__).parent / "data"
THUMBS = ROOT / "html" / "logos" / "thumbs"
UA = "Mozilla/5.0 (compatible; LETSUM-logo-survey/1.0; +https://letsum.app/logos/)"
TODAY = time.strftime("%Y-%m-%d")
MAX_BYTES = 4 * 1024 * 1024
CI_WORDS = re.compile(r"(\bCI\b|\bMI\b|\bUI\b|\bBI\b|상징|심벌|심볼|로고|엠블럼|엠블렘|휘장|교표|교색|교기|시그니처|아이덴티티|identity|symbol|emblem|logo)", re.I)
STRONG_CI = re.compile(r"(\bCI\b|\bMI\b|\bUI\b|상징|심벌|심볼|로고|휘장|교표|아이덴티티|identity|symbol|emblem)", re.I)
# Certification marks, licence badges and promotional banners that sit next to logos.
JUNK_ALT = re.compile(r"(웹\s?접근성|접근성|인증\s?마크|품질\s?인증|공공누리|KOGL|국가상징|바로가기|배너|포털|해설사|이벤트|캠페인|축제|홍보|QR|WEB ACCESSIBILITY)", re.I)
SKIP_IMG = re.compile(r"(banner|popup|pop_|btn|button|arrow|\bbg|bg_|sns|facebook|youtube|blog|insta|twitter|naver_|top_|quick|footer_mark|wa_mark|webaccess|wa\.png|wa_|kwacc|qr|loading|spacer|blank|icon_|ico_|/ico/|/icon/|visual|slide|main_img|thumb|translate|gstatic\.com)", re.I)


class _Redirects(urllib.request.HTTPRedirectHandler):
    """Python 3.9's urllib does not follow 308 Permanent Redirect; treat it like 301."""
    def http_error_308(self, req, fp, code, msg, headers):
        return self.http_error_301(req, fp, 301, msg, headers)


_opener = urllib.request.build_opener(_Redirects())


def fetch(url, accept="*/*", limit=MAX_BYTES):
    """GET with redirects and normal certificate checks; sites with broken TLS are reported as errors."""
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept, "Accept-Language": "ko,en;q=0.5"})
    with _opener.open(request, timeout=20) as response:
        body = response.read(limit + 1)
        if len(body) > limit:
            raise ValueError("too large")
        return body, response.geturl(), response.headers.get("content-type", "")


def fetch_page(url):
    """Fetch an HTML page, following meta-refresh and small script redirects (gate/tracer pages) up to three hops."""
    for _ in range(4):
        body, final, ctype = fetch(url, "text/html")
        markup = decode(body, ctype)
        page = parse(markup); page.url = final
        target = re.search(r"<meta[^>]+http-equiv=[\"']?refresh[^>]+content=[\"'][^\"']*url\s*=\s*['\"]?([^'\">\s]+)", markup, re.I)
        if not target and len(page.links) < 5:
            target = re.search(r"(?:location\.href|location\.replace\(|window\.location|document\.location)\s*=?\s*[\"']([^\"']+)[\"']", markup)
        if not target:
            return page
        nxt = absolute(final, target.group(1))
        if not nxt or nxt == final:
            return page
        url = nxt
    return page


def decode(body, content_type):
    m = re.search(r"charset=([\w-]+)", content_type or "", re.I) or re.search(rb'<meta[^>]+charset=["\']?([\w-]+)', body[:3000], re.I)
    charset = (m.group(1).decode() if isinstance(m.group(1), bytes) else m.group(1)) if m else "utf-8"
    try:
        return body.decode(charset, "replace")
    except LookupError:
        return body.decode("utf-8", "replace")


class Page(HTMLParser):
    """Collects visible text (plus img alt, where many CI pages put colour specs), links and images."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text, self.links, self.images, self.skip, self.stack = [], [], [], 0, []
        self._link = None

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag in ("script", "style", "noscript", "template"):
            self.skip += 1
        if tag == "a":
            self._link = {"href": a.get("href", ""), "text": a.get("title", "")}
        if tag == "img":
            context = " ".join(f"{t}.{c}" for t, c in self.stack[-4:])
            self.images.append({"src": a.get("src") or a.get("data-src", ""), "alt": a.get("alt", ""), "attrs": " ".join(f"{k}={v}" for k, v in a.items() if k in ("class", "id")), "context": context})
            if a.get("alt"):
                self.text.append(" " + a["alt"] + " ")
                if self._link is not None:
                    self._link["text"] += " " + a["alt"]
        if tag not in ("img", "br", "meta", "link", "input", "hr"):
            self.stack.append((tag, (a.get("class", "") + " " + a.get("id", "")).strip()))

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "template") and self.skip:
            self.skip -= 1
        if tag == "a" and self._link is not None:
            self.links.append(self._link); self._link = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if not self.skip:
            self.text.append(data)
            if self._link is not None:
                self._link["text"] += data


def parse(markup):
    page = Page()
    try:
        page.feed(markup)
    except Exception:
        pass
    page.plain = re.sub(r"[ \t\r\f\v ]+", " ", "".join(page.text))
    return page


# --- colour specifications written on the page -------------------------------------------------------------------
NUM = r"(\d{1,3}(?:\.\d+)?)"
SEP = r"\s*[:=]?\s*"
GAP = r"\s*%?\s*[,/·\s]?\s*"
PATTERNS = [
    ("pantone", re.compile(r"(?:PANTONE|PMS|팬톤)\s*[®:.]?\s*((?:Process\s+|Reflex\s+|Warm\s+|Cool\s+)?[0-9]{2,5}(?:\s?-\s?\d+)?\s?(?:C|U|CV|CVC|TPX|TCX)?|(?:Black|Process Blue|Reflex Blue|Warm Red|Rubine Red|Rhodamine Red|Green|Yellow|Orange 021|Red 032|Purple|Violet|Blue 072)\s?(?:\d\s?)?(?:C|U)?)\b", re.I)),
    # "106C" written without the word PANTONE counts only right before a CMYK/RGB value.
    ("pantone", re.compile(r"(?<![\w#.])((?:[1-9]\d{2,3}|[1-9]\d{0,2}-\d{1,2})\s?C)\b(?=[^\n]{0,40}?(?:\bC\s*[:=]?\s*\d|\bR\s*[:=]?\s*\d|CMYK|RGB))")),
    ("cmyk", re.compile(r"\bC" + SEP + NUM + GAP + r"M" + SEP + NUM + GAP + r"Y" + SEP + NUM + GAP + r"K" + SEP + NUM)),
    ("cmyk", re.compile(r"CMYK\s*[:=]?\s*\(?\s*" + NUM + r"\s*[,/\s]\s*" + NUM + r"\s*[,/\s]\s*" + NUM + r"\s*[,/\s]\s*" + NUM, re.I)),
    ("rgb", re.compile(r"\bR" + SEP + NUM + GAP + r"G" + SEP + NUM + GAP + r"B" + SEP + NUM + r"(?!\d)")),
    ("rgb", re.compile(r"RGB\s*[:=]?\s*\(?\s*" + NUM + r"\s*[,/\s]\s*" + NUM + r"\s*[,/\s]\s*" + NUM + r"(?!\d)", re.I)),
    ("hex", re.compile(r"(?:#|HEX\s*[:=]?\s*#?|\bWEB\s*[:=]?\s*#?)\s?([0-9A-Fa-f]{6})\b")),
]


def colour_specs(text):
    hits = []
    for kind, pattern in PATTERNS:
        for m in pattern.finditer(text):
            values = m.groups()
            if kind == "cmyk":
                nums = [float(v) for v in values]
                if any(v > 100 for v in nums):
                    continue
                value = "C{} M{} Y{} K{}".format(*[f"{v:g}" for v in nums])
            elif kind == "rgb":
                nums = [float(v) for v in values]
                if any(v > 255 for v in nums):
                    continue
                value = "{} {} {}".format(*[f"{v:g}" for v in nums])
            elif kind == "hex":
                value = "#" + values[0].upper()
            else:
                value = re.sub(r"\s+", " ", values[0].strip()).upper().replace(" - ", "-")
                value = re.sub(r"(?<=\d)\s?(C|U|CV|CVC|TPX|TCX)$", r" \1", value)
                value = re.sub(r"(RED|BLUE|GREEN|YELLOW|BLACK|ORANGE|PURPLE|VIOLET)(C|U)$", r"\1 \2", value)
                if not re.search(r"\d|BLACK|BLUE|RED|GREEN|YELLOW|ORANGE|PURPLE|VIOLET", value):
                    continue
            hits.append((m.start(), m.end(), kind, value))
    hits.sort()
    kept = []
    for hit in hits:
        if kept and hit[0] < kept[-1][1] and hit[2] == kept[-1][2]:
            continue
        kept.append(hit)
    # Group neighbouring values into one colour; a repeated kind or a long gap starts the next colour.
    groups, current, last_end, prev_end = [], {}, -1, 0
    for start, end, kind, value in kept:
        if current and (kind in current or start - last_end > 140):
            groups.append(current); current = {}; prev_end = last_end
        if not current:
            label = text[max(prev_end, start - 60):start]
            for _, pattern in PATTERNS:
                label = pattern.sub(" ", label)
            label = re.split(r"[\n:|]", label)[-1]
            label = re.sub(r"(?i)\b(pantone|cmyk|rgb|hex|pms|web|color|colour)\b|컬러|색상|이미지\d*|[\d/%]+", " ", label)
            words = [w for w in re.split(r"\s+", label.strip(" -–·,()[].")) if w]
            label = " ".join(words[-3:]).strip(" ()[]-–·,.")[:30]
            current["label"] = label if len(label) >= 2 and re.search(r"[가-힣]{2}|[A-Za-z]{3}", label) and not re.search(r"[_,=]", label) else None
        current[kind] = value
        last_end = end
    if current:
        groups.append(current)
    out = []
    for g in groups:
        if "rgb" in g and "hex" not in g:
            r, gg, b = (round(float(x)) for x in g["rgb"].split())
            g["hex"] = "#%02X%02X%02X" % (r, gg, b); g["hex_derived"] = "rgb"
        elif "cmyk" in g and "hex" not in g:
            c, m, y, k = (float(x) / 100 for x in re.findall(r"[\d.]+", g["cmyk"]))
            g["hex"] = "#%02X%02X%02X" % tuple(round(255 * (1 - v) * (1 - k)) for v in (c, m, y)); g["hex_derived"] = "cmyk"
        if not any(k in g for k in ("pantone", "cmyk", "rgb", "hex")):
            continue
        key = (g.get("hex"), g.get("pantone"), g.get("cmyk"))
        if key not in [(o.get("hex"), o.get("pantone"), o.get("cmyk")) for o in out]:
            out.append(g)
    # Pages with dozens of bare hex values are usually stylesheets or charts, not a colour guide.
    hex_only = [g for g in out if set(g) <= {"hex", "label"}]
    if len(hex_only) > 12:
        out = [g for g in out if g not in hex_only]
    return out[:16]


# --- colours sampled from a logo image (fallback, unofficial) ---------------------------------------------------
def svg_colours(svg):
    counts = {}
    for value in re.findall(r"(?:fill|stroke|stop-color)\s*[:=]\s*[\"']?\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]*\))", svg):
        value = value.lower()
        if value.startswith("rgb"):
            nums = [int(float(x)) for x in re.findall(r"[\d.]+", value)[:3]]
            if len(nums) < 3:
                continue
            value = "#%02x%02x%02x" % tuple(nums)
        if len(value) == 4:
            value = "#" + "".join(c * 2 for c in value[1:])
        counts[value] = counts.get(value, 0) + 1
    return sorted(counts.items(), key=lambda x: -x[1])


def raster_colours(data):
    from PIL import Image
    image = Image.open(io.BytesIO(data))
    image.seek(0)
    image = image.convert("RGBA")
    image.thumbnail((160, 160))
    pixels = [p for p in image.getdata() if p[3] > 160]
    if not pixels:
        return []
    flat = Image.new("RGB", (len(pixels), 1)); flat.putdata([p[:3] for p in pixels])
    quant = flat.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    palette = quant.getpalette()
    return [("#%02x%02x%02x" % tuple(palette[i * 3:i * 3 + 3]), n) for n, i in sorted(quant.getcolors(), key=lambda x: -x[0])]


def brand_colours(pairs):
    """Keep up to three distinct, meaningful colours: drop near-white, merge near-duplicates, chromatic first."""
    total = sum(n for _, n in pairs) or 1
    chosen = []
    for hexv, n in pairs:
        r, g, b = (int(hexv[i:i + 2], 16) for i in (1, 3, 5))
        if min(r, g, b) > 232 or n / total < 0.03:
            continue
        if any(sum(abs(a - c) for a, c in zip((r, g, b), other)) < 60 for other, _ in chosen):
            continue
        chosen.append(((r, g, b), n))
    chromatic = [c for c in chosen if colorsys.rgb_to_hsv(*(v / 255 for v in c[0]))[1] > 0.25]
    neutral = [c for c in chosen if c not in chromatic]
    return [{"hex": "#%02X%02X%02X" % rgb, "rgb": "%d %d %d" % rgb, "share": round(n / total, 2)} for rgb, n in (chromatic + neutral)[:3]]


# --- finding the CI page and the logo ---------------------------------------------------------------------------
def score_link(link):
    text = (link["text"] or "").strip()
    href = link["href"]
    if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")) or re.search(r"\.(pdf|zip|ai|hwp|jpg|png)$", href, re.I):
        return 0
    s = 0
    if STRONG_CI.search(text):
        s += 5
    elif CI_WORDS.search(text):
        s += 2
    if re.search(r"(symbol|emblem|\bci\b|ci\.|/ci|identity|logo|sangjing|simbol|mark)", href, re.I):
        s += 2
    if len(text) > 30:
        s -= 2
    if re.search(r"(다운로드 센터|채용|공지|보도|뉴스|news|notice|board|bbs)", text + href, re.I):
        s -= 3
    return s


def absolute(base, href):
    try:
        return urllib.parse.urljoin(base, html.unescape(href.strip()))
    except Exception:
        return None


def same_site(a, b):
    ha, hb = urllib.parse.urlsplit(a).hostname or "", urllib.parse.urlsplit(b).hostname or ""
    root = lambda h: ".".join(h.split(".")[-3:]) if re.search(r"\.(go|or|ac|co|re|ne)\.kr$", h) else ".".join(h.split(".")[-2:])
    return root(ha) == root(hb)


def logo_candidates(page, base, org_name, where):
    out = []
    short = re.sub(r"(특별시|광역시|특별자치시|특별자치도|대학교)$", "", org_name)
    for img in page.images:
        src = img["src"].strip()
        if not src or src.startswith("data:"):
            continue
        url = absolute(base, src)
        if not url or SKIP_IMG.search(src) or JUNK_ALT.search(img["alt"]):
            continue
        hay = f"{img['alt']} {img['attrs']} {img['context']} {src}"
        s = 0
        if where == "home":
            if re.search(r"logo", img["attrs"] + " " + img["context"] + " " + src, re.I):
                s += 6
            if img["alt"] and org_name and (org_name in img["alt"] or (len(short) > 1 and short in img["alt"])):
                s += 3
            if re.search(r"(footer|foot|bottom)", img["context"] + " " + src, re.I):
                s -= 2
        else:
            if re.search(r"(심벌|심볼|로고|logo|symbol|emblem|휘장|상징|signature|시그니처|\bci\b|_ci|ci_|mark|교표)", hay, re.I):
                s += 4
            if re.search(r"(color|컬러|색상|grid|금지|misuse|wrong)", hay, re.I):
                s -= 3
        if url.lower().split("?")[0].endswith(".svg"):
            s += 1
        if s >= 4:
            out.append((s, url))
    return out


def image_kind(data):
    head = data[:12]
    if head[:4] == b"\x89PNG": return "png"
    if head[:2] == b"\xff\xd8": return "jpg"
    if head[:3] == b"GIF": return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP": return "webp"
    if re.search(rb"<svg[\s>]", data[:4096], re.I): return "svg"
    return None


def clean_svg(text):
    text = re.sub(r"<script[\s\S]*?</script>", "", text, flags=re.I)
    text = re.sub(r"<foreignObject[\s\S]*?</foreignObject>", "", text, flags=re.I)
    return re.sub(r"\son[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*')", "", text, flags=re.I)


def usable_image(data):
    kind = image_kind(data)
    if not kind or len(data) < 200:
        return None
    if kind == "svg":
        return kind
    from PIL import Image
    try:
        w, h = Image.open(io.BytesIO(data)).size
    except Exception:
        return None
    if w < 48 or h < 20 or w * h > 25_000_000 or w / h > 9 or h / w > 4:
        return None
    return kind


def logo_tone(data, kind):
    """'light' when the logo is drawn in white/pale colours (made for dark footers) and needs a dark backdrop."""
    try:
        if kind == "svg":
            pairs = svg_colours(data.decode("utf-8", "replace"))
            values = [(int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), n) for h, n in pairs]
        else:
            from PIL import Image
            image = Image.open(io.BytesIO(data)); image.seek(0); image = image.convert("RGBA"); image.thumbnail((120, 120))
            values = [(r, g, b, 1) for r, g, b, a in image.getdata() if a > 160]
            if len(values) > 0.9 * image.size[0] * image.size[1]:
                return "normal"  # opaque artwork carries its own background
        total = sum(v[3] for v in values)
        if not total:
            return "normal"
        light = sum(n for r, g, b, n in values if 0.2126 * r + 0.7152 * g + 0.0722 * b > 200)
        return "light" if light / total > 0.75 else "normal"
    except Exception:
        return "normal"


def commons_file(filename):
    api = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "format": "json", "titles": "File:" + filename, "prop": "imageinfo", "iiprop": "url|mime|extmetadata", "iiurlwidth": 640})
    body, _, _ = fetch(api, "application/json")
    page = next(iter(json.loads(body)["query"]["pages"].values()))
    info = (page.get("imageinfo") or [None])[0]
    if not info:
        raise ValueError("no commons file")
    meta = info.get("extmetadata", {})
    strip = lambda v: re.sub(r"<[^>]+>", "", v or "").strip()[:160] or None
    url = info["url"] if info["mime"] == "image/svg+xml" else info.get("thumburl") or info["url"]
    data, final, _ = fetch(url)
    return data, {"source": "wikimedia-commons", "source_url": final, "page_url": info.get("descriptionurl"), "license": strip(meta.get("LicenseShortName", {}).get("value")) or "unknown", "author": strip(meta.get("Artist", {}).get("value"))}


def survey(org):
    result = {"name": org["name"], "group": org["group"], "checked_at": TODAY, "website": org.get("website"), "errors": []}
    home = None
    if org.get("website"):
        try:
            home = fetch_page(org["website"]); result["website_final"] = home.url
        except Exception as error:
            result["errors"].append(f"home: {type(error).__name__}: {str(error)[:80]}")
    # CI page: best scoring links on the home page and on its site map.
    candidates = []
    if home:
        pool = list(home.links)
        sitemap = next((l for l in home.links if re.search(r"(사이트맵|sitemap|전체메뉴)", (l["text"] or "") + l["href"], re.I)), None)
        if sitemap:
            url = absolute(home.url, sitemap["href"])
            if url and same_site(url, home.url):
                try:
                    smap = fetch_page(url)
                    pool += [{"href": absolute(smap.url, l["href"]) or "", "text": l["text"]} for l in smap.links]
                except Exception:
                    pass
        # CI menus usually sit under the "about" section; look one level deeper when the home page has no CI link.
        if not any(score_link(l) >= 4 for l in pool):
            intros = [l for l in home.links if re.search(r"(기관\s?소개|공단\s?소개|공사\s?소개|회사\s?소개|원\s?소개|대학\s?(소개|안내)|학교\s?소개|시정\s?소개|군정\s?소개|구정\s?소개|도정\s?소개|일반\s?현황|about|intro)", (l["text"] or "") + " " + l["href"], re.I)]
            for link in intros[:3]:
                url = absolute(home.url, link["href"])
                if not url or not same_site(url, home.url):
                    continue
                try:
                    sub = fetch_page(url)
                    pool += [{"href": absolute(sub.url, l["href"]) or "", "text": l["text"]} for l in sub.links]
                except Exception:
                    continue
        for link in pool:
            s = score_link(link)
            url = absolute(home.url, link["href"])
            if s >= 4 and url and same_site(url, home.url) and url.rstrip("/") != home.url.rstrip("/"):
                candidates.append((s, url, (link["text"] or "").strip()[:40]))
    seen, best = set(), None
    for s, url, text in sorted(candidates, key=lambda x: -x[0]):
        if url in seen or len(seen) >= 4:
            continue
        seen.add(url)
        try:
            page = fetch_page(url)
        except Exception:
            continue
        specs = colour_specs(page.plain)
        rank = (len(specs) > 0, s, len(CI_WORDS.findall(page.plain[:20000])))
        if best is None or rank > best[0]:
            best = (rank, page, specs, text)
    logos = []
    if best:
        _, page, specs, text = best
        result["ci_page"] = page.url; result["ci_link_text"] = text
        if specs:
            result["colors_official"] = specs
        logos += [(s - 1, u, "official-page-image", page.url) for s, u in logo_candidates(page, page.url, org["name"], "ci")]
    if home:
        logos += [(s, u, "official-site-logo", home.url) for s, u in logo_candidates(home, home.url, org["name"], "home")]
    image = None
    if org.get("logo_file"):
        try:
            data, meta = commons_file(org["logo_file"])
            kind = usable_image(data)
            if kind:
                image = (data, kind, meta)
        except Exception as error:
            result["errors"].append(f"commons: {str(error)[:60]}")
    for s, url, source, page_url in sorted(logos, key=lambda x: -x[0]):
        if image:
            break
        try:
            data, final, _ = fetch(url)
            kind = usable_image(data)
            if kind:
                image = (data, kind, {"source": source, "source_url": final, "page_url": page_url, "license": "공식 사이트 게시 이미지(상표권은 권리자에게 있음)", "author": None})
        except Exception:
            continue
    if image:
        data, kind, meta = image
        if kind == "svg":
            data = clean_svg(data.decode("utf-8", "replace")).encode()
        result["logo"] = {**meta, "ext": kind, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "tone": logo_tone(data, kind)}
        result["_image"] = data
        if not result.get("colors_official"):
            try:
                pairs = svg_colours(data.decode("utf-8", "replace")) if kind == "svg" else raster_colours(data)
                extracted = brand_colours(pairs)
                if extracted:
                    result["colors_extracted"] = extracted
            except Exception as error:
                result["errors"].append(f"colour: {str(error)[:60]}")
    return result


def org_key(org):
    return org.get("wikidata") or org["wiki_title"]


def recolour(workers):
    out_file = DATA / "crawl.json"
    data = json.loads(out_file.read_text())
    targets = [r for r in data["results"].values() if r.get("ci_page")]
    def work(result):
        try:
            specs = colour_specs(fetch_page(result["ci_page"]).plain)
        except Exception:
            return result, None
        return result, specs
    with ThreadPoolExecutor(workers) as pool:
        for result, specs in pool.map(work, targets):
            if specs is None:
                continue
            if specs:
                result["colors_official"] = specs
            else:
                result.pop("colors_official", None)
    out_file.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"recoloured {len(targets)} CI pages · official colours {sum('colors_official' in r for r in data['results'].values())}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--colours-only", action="store_true", help="re-read colour specs from the CI pages already found")
    args = parser.parse_args()
    if args.colours_only:
        return recolour(args.workers)
    orgs = json.loads((DATA / "orgs.json").read_text())["orgs"]
    if args.only:
        wanted = set(args.only.split(","))
        orgs = [o for o in orgs if o["name"] in wanted or o["wiki_title"] in wanted]
    out_file = DATA / "crawl.json"
    previous = json.loads(out_file.read_text())["results"] if out_file.exists() else {}
    THUMBS.mkdir(parents=True, exist_ok=True)
    results, done = dict(previous), 0
    with ThreadPoolExecutor(args.workers) as pool:
        futures = {pool.submit(survey, org): org for org in orgs}
        for future in as_completed(futures):
            org = futures[future]; key = org_key(org)
            try:
                result = future.result()
            except Exception as error:
                result = {"name": org["name"], "group": org["group"], "checked_at": TODAY, "errors": [f"crash: {error}"]}
            old = previous.get(key, {})
            # Keep what an earlier run found only when this run could not reach the site.
            unreachable = any(e.startswith(("home:", "crash:")) for e in result.get("errors", []))
            for field in ("ci_page", "colors_official", "logo", "colors_extracted"):
                if unreachable and field not in result and field in old:
                    result[field] = old[field]; result.setdefault("kept", []).append(field)
            data = result.pop("_image", None)
            if data:
                name = f"survey-{hashlib.sha1(key.encode()).hexdigest()[:10]}.{result['logo']['ext']}"
                (THUMBS / name).write_bytes(data)
                result["logo"]["file"] = "/logos/thumbs/" + name
            results[key] = result; done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(orgs)}", flush=True)
                out_file.write_text(json.dumps({"updated_at": TODAY, "results": results}, ensure_ascii=False, indent=1) + "\n")
    out_file.write_text(json.dumps({"updated_at": TODAY, "results": results}, ensure_ascii=False, indent=1) + "\n")
    rs = [results[org_key(o)] for o in orgs if org_key(o) in results]
    print(f"orgs {len(rs)} · CI page {sum('ci_page' in r for r in rs)} · official colours {sum('colors_official' in r for r in rs)} · logo {sum('logo' in r for r in rs)} · extracted colours {sum('colors_extracted' in r for r in rs)}")


if __name__ == "__main__":
    main()
