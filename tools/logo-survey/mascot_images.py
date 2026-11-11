"""Mascot survey, step 1b: second look for a character picture on pages where step 1 found the character page but no image.

mascot_survey.py keeps only images whose alt text or file name says 캐릭터/character. Many pages name their files
img01.png or draw the character as a CSS background, so this pass reads the page again (static and browser-rendered)
and considers every picture on it: <img> src / data-src / data-original / srcset and inline background-image URLs.
Header/footer furniture (logos, icons, buttons, banners, QR codes) is skipped; each remaining file is downloaded with the
page as Referer (some sites refuse hotlinks) and judged by size and shape: portrait-ish or square pictures of at least
150 px, transparent PNGs preferred, character words in the alt text or file name preferred.
Picks are checked by eye; pictures that are not the character go to data/mascot-image-reject.json and are skipped on
later runs. The pick is written into data/mascot-crawl.json (row["image"], source "official-page-image") and saved under
html/mascots/thumbs/. Rows that already have an image are left alone unless named with --only.
Usage: python3 tools/logo-survey/mascot_images.py [--only 강원 FC,수원 FC] [--workers 6]   (not -I: needs Pillow)
"""
import argparse, hashlib, html as htmllib, io, json, re, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import crawl  # noqa: E402
from refind_ci import pages_of  # noqa: E402
from mascot_survey import CHAR, CHAR_URL, THUMBS, OUT  # noqa: E402

SKIP = re.compile(r"(banner|popup|btn|button|icon|ico_|_ico|arrow|logo|symbol|sns|footer|header|gnb|lnb|snb|nav|menu|qr|loading|blank|spacer|"
                  r"tit_|title|txt_|text|slogan|슬로건|심벌|로고|배너|mark_wa|wa_mark|webaccess|kwacc|copyright|kogl|opentype|공공누리|"
                  r"visual|main_v|mainvisual|bg_|_bg|background|pattern|line_|dot_|bul_|bullet|tab_|top_|quick|family|map_|sitemap)", re.I)
URLS = re.compile(r"""(?:src|data-src|data-original|data-lazy|data-url)\s*=\s*["']([^"']+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^"']*)?)["']""", re.I)
SRCSET = re.compile(r"""srcset\s*=\s*["']([^"']+)["']""", re.I)
BG = re.compile(r"""url\(\s*['"]?([^'")]+\.(?:png|jpe?g|gif|webp|svg)(?:\?[^'")]*)?)['"]?\s*\)""", re.I)
ALT = re.compile(r"""<img\b[^>]*>""", re.I)


def candidates(markup, base):
    found = {}
    for m in ALT.finditer(markup):
        tag = m.group(0)
        alt = (re.search(r"""alt\s*=\s*["']([^"']*)["']""", tag, re.I) or [None, ""])[1]
        urls = URLS.findall(tag) + [p.strip().split(" ")[0] for s in SRCSET.findall(tag) for p in s.split(",") if p.strip()]
        for u in urls:
            found.setdefault(crawl.absolute(base, htmllib.unescape(u)), htmllib.unescape(alt))
    for u in BG.findall(markup):
        found.setdefault(crawl.absolute(base, htmllib.unescape(u)), "")
    out = []
    for url, alt in found.items():
        if not url or not url.startswith("http"):
            continue
        path = urllib.parse.unquote(urllib.parse.urlsplit(url).path)
        if SKIP.search(path) and not CHAR_URL.search(path):
            continue
        if re.search(r"(로고|심벌|슬로건|배너|바로가기|아이콘|QR|인증마크|공공누리)", alt):
            continue
        out.append((url, alt))
    return out


def fetch(url, referer):
    req = urllib.request.Request(url, headers={"User-Agent": crawl.UA, "Accept": "image/*", "Referer": referer})
    try:
        with crawl._opener.open(req, timeout=20) as r:
            return r.read(8_000_001)
    except Exception:
        return None


def judge(url, alt, referer):
    data = fetch(url, referer)
    if not data or len(data) > 8_000_000:
        return None
    kind = crawl.image_kind(data)
    if not kind:
        return None
    hint = 3 if CHAR.search(alt) or CHAR_URL.search(url) else 0
    if kind == "svg":
        return {"data": data, "ext": kind, "score": 2 + hint, "url": url, "alt": alt}
    from PIL import Image
    try:
        image = Image.open(io.BytesIO(data))
        w, h = image.size
    except Exception:
        return None
    if w < 150 or h < 150 or w / h > 1.9 or h / w > 2.6:
        return None
    clear = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)
    size = min(w * h, 900 * 900) / (900 * 900)  # bigger is better, up to a point
    return {"data": data, "ext": kind, "score": hint + 2 * size + (1.5 if clear else 0) + (0.5 if h >= w else 0), "url": url, "alt": alt}


REJECTED = {r["url"] for r in json.loads((crawl.DATA / "mascot-image-reject.json").read_text())["rejected"]} if (crawl.DATA / "mascot-image-reject.json").exists() else set()


def pick(page):
    seen, cands = set(REJECTED), []
    for markup, base in pages_of(page):
        for url, alt in candidates(markup, base):
            if url not in seen:
                seen.add(url)
                cands.append((url, alt))
    # character-named files first, then document order (character pages put the main picture near the top)
    cands.sort(key=lambda c: 0 if CHAR.search(c[1]) or CHAR_URL.search(c[0]) else 1)
    best = None
    for url, alt in cands[:14]:
        got = judge(url, alt, page)
        if got and (best is None or got["score"] > best["score"]):
            best = got
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()
    data = json.loads(OUT.read_text())
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    # Rows from hand-found pages (mascot_hints.py) were picked by eye, an empty image there is deliberate.
    todo = [(k, r) for k, r in data["results"].items() if r.get("found") and r.get("page") and r.get("page_source") != "hand-found"
            and ((r["name"] in only) if only else not r.get("image"))]
    print(f"pages to read: {len(todo)}")
    with ThreadPoolExecutor(args.workers) as pool:
        picks = list(pool.map(lambda kr: pick(kr[1]["page"]), todo))
    THUMBS.mkdir(parents=True, exist_ok=True)
    got = 0
    for (key, row), best in zip(todo, picks):
        if not best:
            continue
        name = f"m-{hashlib.sha1(key.encode()).hexdigest()[:10]}.{best['ext']}"
        (THUMBS / name).write_bytes(best["data"])
        row["image"] = {"file": "/mascots/thumbs/" + name, "source_url": best["url"], "page_url": row["page"], "alt": best["alt"],
                        "sha256": hashlib.sha256(best["data"]).hexdigest(), "bytes": len(best["data"]), "source": "official-page-image",
                        "license": "공식 사이트 게시 이미지(권리는 권리자에게 있음)", "picked_by": "mascot_images.py"}
        got += 1
        print(f"  {row['name']}: {best['url']}")
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"images found {got} / {len(todo)}")


if __name__ == "__main__":
    main()
