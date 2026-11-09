"""Second pass for organisations that still have no logo after crawl.py.

Tries, in order: Wikidata logo/coat of arms/seal files, a Wikimedia Commons search by Korean and English name,
an inline <svg> logo in the home page header, the page's share image (og:image), and a large site icon.
Found logos are written into data/crawl.json like crawl.py results, so merge.py picks them up.
Usage: python3 tools/logo-survey/fill_logos.py [--workers 10]   (not -I: needs Pillow)
"""
import argparse, hashlib, json, re, subprocess, sys, tempfile, threading, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import crawl  # noqa: E402

DATA = crawl.DATA
LOGO_WORDS = re.compile(r"(logo|symbol|emblem|seal|\bCI\b|\bUI\b|\bMI\b|wordmark|signature|로고|상징|심벌|심볼|마크|휘장|교표)", re.I)
BAD_WORDS = re.compile(r"(photo|building|campus|map|flag of|location|사진|전경|청사|건물|지도|위치)", re.I)


_wikidata_lock = threading.Lock()
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
NOT_OFFICIAL = re.compile(r"(wikipedia|wikimedia|wikidata|naver\.com|daum\.net|youtube|facebook|instagram|twitter|x\.com|blog|archive\.org|namu\.wiki|google\.|kakao\.com|tistory|law\.go\.kr|doi\.org|news|ytn|yonhap|chosun|joongang|donga|hani|khan)", re.I)


def rendered_dom(url):
    """The page as a browser renders it (menus and logos that are drawn by JavaScript)."""
    with tempfile.TemporaryDirectory() as tmp:
        try:
            done = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", f"--user-data-dir={tmp}", "--virtual-time-budget=8000", "--timeout=25000", "--dump-dom", url], capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            return None
    return done.stdout if len(done.stdout) > 500 else None


def official_sites(org):
    """Official-looking external links on the organisation's Korean Wikipedia article, as fallbacks for the website."""
    try:
        data = json.loads(crawl.fetch("https://ko.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "format": "json", "titles": org["wiki_title"], "prop": "extlinks", "ellimit": 60, "redirects": 1}), "application/json")[0])
    except Exception:
        return []
    links = [l["*"] for p in data["query"]["pages"].values() for l in p.get("extlinks", [])]
    links = [l if l.startswith("http") else "https:" + l for l in links if not NOT_OFFICIAL.search(l)]
    score = lambda u: (bool(re.search(r"\.(go|or|ac|re|kr)\.kr", u)), -len(urllib.parse.urlsplit(u).path))
    roots = []
    for link in sorted(links, key=score, reverse=True):
        parts = urllib.parse.urlsplit(link)
        root = f"{parts.scheme}://{parts.netloc}/"
        if root not in roots:
            roots.append(root)
    return roots[:3]


def wikidata_files(qid):
    with _wikidata_lock:  # Wikidata answers 429 to bursts; one request at a time with a short pause
        for attempt in range(4):
            try:
                body = crawl.fetch("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "wbgetentities", "ids": qid, "props": "claims", "format": "json"}), "application/json")[0]
                break
            except Exception as error:
                if "429" not in str(error) or attempt == 3:
                    raise
                time.sleep(5 * (attempt + 1))
        time.sleep(0.4)
    data = json.loads(body)
    return _files_from(data, qid)


def _files_from(data, qid):
    claims = data["entities"][qid].get("claims", {})
    files = []
    for prop in ("P154", "P8972", "P94", "P158"):  # logo, small logo, coat of arms, seal
        for claim in sorted(claims.get(prop, []), key=lambda c: c.get("rank") != "preferred"):
            value = claim.get("mainsnak", {}).get("datavalue", {}).get("value")
            if value and claim.get("rank") != "deprecated" and "P582" not in claim.get("qualifiers", {}):
                files.append(value)
    return files


NOT_LOGO_FILES = re.compile(r"(commons|wiki|cc-|\bcc\b|edit|pencil|icon|flag|map|location|locator|photo|building|청사|전경|지도|위치|ministry of|government of the republic|정부상징|교육부|부\s?로고)", re.I)


def mentions(org, filename):
    """True when the file name names this organisation (Korean name, or every word of its romanised/English name)."""
    plain = re.sub(r"[\s_\-().,]", "", filename).lower()
    korean = re.sub(r"\s", "", re.sub(r"^.*? ", "", org["name"]) if " " in org["name"] else org["name"])
    if korean and korean in plain:
        return True
    for name in [org.get("name_en"), *romanised(org.get("name_en"))]:
        words = [w.lower() for w in re.findall(r"[A-Za-z]{3,}", name or "") if w.lower() not in ("the", "and", "for", "korea", "korean", "national", "institute", "university", "city", "county", "district")]
        if words and all(w in plain for w in words):
            return True
    return False


def page_images(org):
    """Lead images of the organisation's Wikipedia articles (ko, en) when they are free files on Commons."""
    files = []
    for lang, title in [("ko", org["wiki_title"]), ("en", org.get("name_en"))]:
        if not title:
            continue
        try:
            data = json.loads(crawl.fetch(f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "format": "json", "titles": title, "prop": "pageimages|images", "piprop": "name", "imlimit": 30, "redirects": 1}), "application/json")[0])
        except Exception:
            continue
        for page in data["query"]["pages"].values():
            names = [page.get("pageimage")] + [i["title"].split(":", 1)[1] for i in page.get("images", [])]
            if org["category"] == "local-government":
                # Korean municipal flags are the city/county symbol on a plain field; trimmed, they are the symbol.
                for name in names:
                    if name and re.match(r"Flag of ", name, re.I) and mentions(org, name) and name not in files:
                        files.insert(0, name)
            for name in names:
                # Only files that name this organisation and look like a logo (articles also carry photos, maps,
                # licence/edit icons and the parent ministry's emblem).
                if name and LOGO_WORDS.search(name) and not BAD_WORDS.search(name) and not NOT_LOGO_FILES.search(name) and mentions(org, name) and name not in files:
                    files.append(name)
    return files


def romanised(name_en):
    """English labels such as "Gangseo District" are filed on Commons as "Gangseo-gu"."""
    if not name_en:
        return []
    out = []
    for suffix, korean in [(" District", "-gu"), (" County", "-gun"), (" City", "-si"), (" Province", "-do"), (" Metropolitan City", "")]:
        if name_en.endswith(suffix):
            base = name_en[: -len(suffix)]
            if korean:  # the bare name ("Gangseo") would also match same-named districts elsewhere
                out.append(base + korean)
    return out


def commons_search(names):
    found = []
    for name in names:
        query = f'intitle:"{name}"'
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "format": "json", "list": "search", "srsearch": query + " filetype:drawing|bitmap", "srnamespace": 6, "srlimit": 15})
        try:
            hits = json.loads(crawl.fetch(url, "application/json")[0])["query"]["search"]
        except Exception:
            continue
        for hit in hits:
            title = hit["title"]
            if LOGO_WORDS.search(title) and not BAD_WORDS.search(title) and re.search(r"\.(svg|png)$", title, re.I):
                score = (title.lower().endswith(".svg"), bool(re.search(r"logo|로고", title, re.I)), -len(title))
                found.append((score, title[len("File:"):]))
    return [t for _, t in sorted(found, reverse=True)]


def inline_svg(markup):
    """An <svg> drawn directly inside the header logo link (common on newer sites)."""
    for m in re.finditer(r"<(?:h1|a|div|span|p|strong)\b[^>]*(?:class|id)\s*=\s*[\"'][^\"']*logo[^\"']*[\"'][^>]*>", markup, re.I):
        chunk = markup[m.end():m.end() + 20000]
        start = chunk.find("<svg")
        if start < 0 or start > 1500:
            continue
        end = chunk.find("</svg>", start)
        if end < 0:
            continue
        svg = chunk[start:end + 6]
        if "<use" in svg or len(svg) < 300 or not re.search(r"<(path|polygon|rect|circle|g)\b", svg):
            continue
        if "xmlns=" not in svg[:300]:
            svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
        return crawl.clean_svg(svg)
    return None


def share_image(markup, base):
    m = re.search(r"<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)", markup, re.I) or re.search(r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image", markup, re.I)
    return crawl.absolute(base, m.group(1)) if m else None


def site_icons(markup, base):
    icons = []
    for tag in re.findall(r"<link\b[^>]*>", markup, re.I):
        rel = (re.search(r"\brel\s*=\s*[\"']([^\"']+)", tag, re.I) or [None, ""])[1].lower()
        href = (re.search(r"\bhref\s*=\s*[\"']([^\"']+)", tag, re.I) or [None, None])[1]
        if href and ("apple-touch-icon" in rel or rel.strip() == "icon"):
            size = int((re.search(r"sizes\s*=\s*[\"'](\d+)", tag) or [None, 0])[1] or (180 if "apple" in rel else 0))
            if size >= 120 or href.lower().endswith(".svg"):
                icons.append(crawl.absolute(base, href))
    icons.append(crawl.absolute(base, "/apple-touch-icon.png"))
    return [i for i in icons if i]


def accept(data, meta):
    kind = crawl.usable_image(data)
    if not kind:
        return None
    if kind == "svg":
        data = crawl.clean_svg(data.decode("utf-8", "replace")).encode()
    return data, kind, meta


def find_logo(org):
    tried = []
    names = [n for n in dict.fromkeys([org["name"], org["wiki_title"].replace("대한민국 ", ""), org.get("name_en")]) if n]
    files = []
    if org.get("wikidata"):
        try:
            files += wikidata_files(org["wikidata"])
        except Exception as error:
            tried.append(f"wikidata: {str(error)[:40]}")
    files += [f for f in page_images(org) if f not in files]
    files += [f for f in commons_search(names + romanised(org.get("name_en"))) if f not in files]
    for filename in files[:8]:
        try:
            found = accept(*crawl.commons_file(filename))
            if found:
                return found, tried
        except Exception:
            continue
    tried.append("commons: none")
    sites = [s for s in dict.fromkeys([org.get("website"), *(urllib.parse.urlunsplit(urllib.parse.urlsplit(org["website"])[:2] + ("/", "", "")) for _ in [0] if org.get("website")), *official_sites(org)]) if s]
    for site in sites:
        found = site_logo(site, rendered=False) or site_logo(site, rendered=True)
        if found:
            return found, tried
    tried.append(f"sites: none ({len(sites)})")
    return None, tried


def site_logo(site, rendered):
    try:
        if rendered:
            markup = rendered_dom(site)
            if not markup:
                return None
            final = site
        else:
            page = crawl.fetch_page(site)
            body, final, ctype = crawl.fetch(page.url, "text/html")
            markup = crawl.decode(body, ctype)
    except Exception:
        return None
    meta = {"source": "official-site-logo", "source_url": final, "page_url": final, "license": "공식 사이트 게시 이미지(상표권은 권리자에게 있음)", "author": None}
    page = crawl.parse(markup)
    for score, url in sorted(crawl.logo_candidates(page, final, "", "home"), key=lambda x: -x[0]):
        try:
            data, got, _ = crawl.fetch(url)
            found = accept(data, {**meta, "source_url": got})
            if found:
                return found
        except Exception:
            continue
    svg = inline_svg(markup)
    if svg:
        return svg.encode(), "svg", meta
    for url, source in [(share_image(markup, final), "official-share-image"), *[(u, "official-site-icon") for u in site_icons(markup, final)]]:
        if not url:
            continue
        try:
            data, got, _ = crawl.fetch(url)
            found = accept(data, {**meta, "source": source, "source_url": got})
            if found:
                return found
        except Exception:
            continue
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=10)
    args = parser.parse_args()
    orgs = json.loads((DATA / "orgs.json").read_text())["orgs"]
    crawl_file = DATA / "crawl.json"
    data = json.loads(crawl_file.read_text())
    thumbs = json.loads((crawl.ROOT / "tools" / "logo-app" / "data" / "thumbnails.json").read_text())["thumbnails"]
    rejected = json.loads((DATA / "thumbnail-rejects.json").read_text())["rejects"]
    def survey_id(org):
        return "kr-" + (org["wikidata"].lower() if org.get("wikidata") else "w" + hashlib.sha1(org["wiki_title"].encode()).hexdigest()[:10])
    # Organisations without a published thumbnail, including ones whose first logo was rejected as not-a-logo.
    todo = [o for o in orgs if survey_id(o) not in thumbs]
    print("to fill", len(todo))
    def work(org):
        return org, find_logo(org)
    filled = 0
    with ThreadPoolExecutor(args.workers) as pool:
        for org, (found, tried) in pool.map(work, todo):
            key = crawl.org_key(org)
            result = data["results"].setdefault(key, {"name": org["name"], "group": org["group"], "checked_at": crawl.TODAY, "errors": []})
            if not found:
                result["fill_tried"] = tried
                continue
            image, kind, meta = found
            old = result.get("logo")
            if old and old.get("sha256") == hashlib.sha256(image).hexdigest():
                continue  # same image that was rejected or shared before
            name = f"survey-{hashlib.sha1(key.encode()).hexdigest()[:10]}.{kind}"
            for stale in crawl.THUMBS.glob(f"survey-{hashlib.sha1(key.encode()).hexdigest()[:10]}.*"):
                stale.unlink()
            (crawl.THUMBS / name).write_bytes(image)
            result["logo"] = {**meta, "ext": kind, "sha256": hashlib.sha256(image).hexdigest(), "bytes": len(image), "tone": crawl.logo_tone(image, kind), "file": "/logos/thumbs/" + name, "filled": True}
            if not result.get("colors_official"):
                try:
                    pairs = crawl.svg_colours(image.decode("utf-8", "replace")) if kind == "svg" else crawl.raster_colours(image)
                    extracted = crawl.brand_colours(pairs)
                    if extracted:
                        result["colors_extracted"] = extracted
                except Exception:
                    pass
            filled += 1
    crawl_file.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print("filled", filled)


if __name__ == "__main__":
    main()
