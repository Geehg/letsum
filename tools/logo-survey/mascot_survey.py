"""Mascot survey, step 1: find each organisation's character/mascot page and read what it publishes.

For every organisation in data/orgs.json (local governments, education offices, public bodies, universities …):
  1. read the Korean main site and its sitemap (static and browser-rendered) plus the known CI page, and score menu
     links named 캐릭터 / 마스코트 / character / mascot;
  2. read the best candidate pages and keep the one that looks like a character page (character words, character
     images, character files);
  3. from that page take: candidate character names (quoted names next to 캐릭터/마스코트 and short image alt texts),
     the best character image (saved under html/mascots/thumbs/), and download candidates whose label, file name or
     URL names a character (verified later by check_downloads-style signature checks).
Results go to data/mascot-crawl.json (one row per organisation, keyed like crawl.json). Re-runnable: --only names.
Usage: python3 tools/logo-survey/mascot_survey.py [--workers 6] [--only 수원시,고양시]   (not -I: needs Pillow)
"""
import argparse, hashlib, html as htmllib, json, re, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import crawl  # noqa: E402
import check_downloads as cd  # noqa: E402
from refind_ci import korean_roots, pages_of, SITEMAP  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
THUMBS = ROOT / "html" / "mascots" / "thumbs"
OUT = crawl.DATA / "mascot-crawl.json"
CHAR = re.compile(r"(캐릭터|마스코트|character|mascot|캐릭타)", re.I)
CHAR_URL = re.compile(r"(character|charac|mascot|chara|caracter|kerecter|캐릭터)", re.I)
NOT_CHAR = re.compile(r"(게임|공모전|공모|이벤트|굿즈|판매|쇼핑|채용|공지|뉴스|보도|모집|선발|안내문|체험|교육과정|웹툰 연재|사이버|가상)", re.I)
QUOTED = re.compile(r"[‘'\"“「『<《]\s*([가-힣A-Za-z0-9·&\s]{2,12}?)\s*[’'\"”」』>》]")
BAD_NAME = re.compile(r"(다운로드|소개|의미|컬러|색상|활용|응용|기본형|이미지|공공누리|바로가기|홈페이지|저작권|이용약관|개인정보|새창|클릭|슬로건|브랜드|심벌|로고|비전|목표|최초|대표|시민|도민|군민|구민|대한민국)")
IMG_BAD = re.compile(r"(banner|popup|btn|button|icon|ico_|arrow|logo|symbol|sns|footer|header|bg_|_bg|qr|loading|blank|spacer|tit_|title|txt_|text|slogan|슬로건|심벌|로고|배너)", re.I)


def score_links(markup, base, home):
    out = {}
    page = crawl.parse(markup)
    maps = []
    for link in page.links:
        url = crawl.absolute(base, link["href"] or "")
        if not url or not url.startswith("http") or not crawl.same_site(url, home):
            continue
        text = (link["text"] or "").strip()
        if SITEMAP.search(text):
            maps.append(url)
        score = 0
        if CHAR.search(text) and len(text) <= 24:
            score += 6
        if CHAR_URL.search(url):
            score += 3
        if NOT_CHAR.search(text):
            score -= 5
        if re.search(r"\.(pdf|zip|ai|hwp|jpg|png)$", url, re.I):
            score = 0
        if score >= 5:
            out[url] = max(out.get(url, 0), score)
    return out, maps


def names_on(markup, org_name):
    """Character names written on the page: quoted words right next to 캐릭터/마스코트 that recur on the page (a name is
    repeated across the introduction; one-off quotes such as slogans or book titles are dropped), most frequent first."""
    text = crawl.parse(markup).plain
    counts = {}
    for m in CHAR.finditer(text):
        window = text[max(0, m.start() - 25): m.end() + 30]
        for q in QUOTED.findall(window):
            q = q.strip()
            if 2 <= len(q) <= 10 and not CHAR.search(q) and q not in org_name and not BAD_NAME.search(q):
                counts[q] = text.count(q)
    return [q for q, n in sorted(counts.items(), key=lambda kv: -kv[1]) if n >= 3][:3]


def character_images(markup, base):
    out = []
    for m in re.finditer(r"<img\b([^>]*)>", markup, re.I):
        attrs = {k.lower(): htmllib.unescape(v.strip("\"'")) for k, v in cd.ATTR.findall(m.group(1))}
        src = attrs.get("src") or attrs.get("data-src") or ""
        alt = attrs.get("alt", "")
        url = crawl.absolute(base, src) if src and not src.startswith("data:") else None
        if not url:
            continue
        hay = f"{alt} {urllib.parse.unquote(url)}"
        if IMG_BAD.search(urllib.parse.unquote(urllib.parse.urlsplit(url).path)) and not CHAR_URL.search(url):
            continue
        score = (4 if CHAR.search(alt) or CHAR_URL.search(url) else 0) + (1 if re.search(r"\.(png|svg|gif)(\?|$)", url, re.I) else 0)
        if score >= 4:
            out.append((score, url, alt))
    return [(u, a) for s, u, a in sorted(out, key=lambda x: -x[0])][:6]


def fetch_image(url, page):
    try:
        data, final, ctype = crawl.fetch(url, "image/*")
    except Exception:
        return None
    kind = crawl.image_kind(data)
    if not kind:
        return None
    if kind != "svg":
        try:
            from PIL import Image
            import io
            image = Image.open(io.BytesIO(data))
            w, h = image.size
            if w < 80 or h < 80 or w / h > 2.2 or h / w > 2.6:
                return None  # banners and strips are not character images
            area = w * h * (1.6 if image.mode in ("RGBA", "LA", "P") and "transparency" in image.info or image.mode == "RGBA" else 1)
        except Exception:
            return None
    else:
        area = 10 ** 6
    return {"data": data, "ext": kind, "area": area, "url": url}


def survey(org):
    res = crawl_results.get(crawl.org_key(org), {})
    home_candidates = [res.get("website_final"), org.get("website")]
    scored = {}
    roots = korean_roots([u for u in home_candidates if u])[:4]
    for root in roots:
        pages = pages_of(root)
        if not pages:
            continue
        maps = []
        for markup, base in pages:
            s, m = score_links(markup, base, root)
            for url, sc in s.items():
                scored[url] = max(scored.get(url, 0), sc)
            maps += m
        for map_url in list(dict.fromkeys(maps))[:2]:
            for markup, base in pages_of(map_url):
                for url, sc in score_links(markup, base, root)[0].items():
                    scored[url] = max(scored.get(url, 0), sc + 1)
        break
    for ci in [res.get("ci_page"), *res.get("ci_pages_extra", [])]:
        if ci:
            scored.setdefault(ci, 4)  # symbol/CI pages often carry the character on a tab of their own
            for markup, base in pages_of(ci):
                for url, sc in score_links(markup, base, ci)[0].items():
                    scored[url] = max(scored.get(url, 0), sc)
    best = None
    for url, sc in sorted(scored.items(), key=lambda kv: -kv[1])[:4]:
        names, images, files, words = [], [], {}, 0
        for markup, base in pages_of(url):
            words += len(CHAR.findall(crawl.parse(markup).plain))
            names += names_on(markup, org["name"])
            images += character_images(markup, base)
            for f_url, label in cd.candidates(markup, base):
                hay = f"{label} {urllib.parse.unquote(f_url)}"
                if CHAR.search(hay) or CHAR_URL.search(hay) or (names and any(n in hay for n in names)):
                    files.setdefault(f_url, label)
        rank = (words >= 3) * 10 + min(words, 20) + 5 * bool(images) + 5 * bool(files) + sc
        if words and (best is None or rank > best["rank"]):
            best = {"rank": rank, "page": url, "names": list(dict.fromkeys(names))[:4], "images": list(dict.fromkeys(images)), "files": files, "words": words}
    if not best or best["words"] < 2:
        return {"name": org["name"], "group": org["group"], "checked_at": crawl.TODAY, "found": False}
    picked = None
    for img_url, alt in best["images"][:5]:
        got = fetch_image(img_url, best["page"])
        if got and (picked is None or got["area"] > picked["area"]):
            picked = {**got, "alt": alt}
    row = {"name": org["name"], "group": org["group"], "checked_at": crawl.TODAY, "found": True, "page": best["page"],
           "names": best["names"], "files": [[u, l] for u, l in best["files"].items()][:12], "words": best["words"]}
    if picked:
        key = crawl.org_key(org)
        fname = f"m-{hashlib.sha1(key.encode()).hexdigest()[:10]}.{picked['ext']}"
        THUMBS.mkdir(parents=True, exist_ok=True)
        (THUMBS / fname).write_bytes(picked["data"])
        row["image"] = {"file": "/mascots/thumbs/" + fname, "source_url": picked["url"], "page_url": best["page"], "alt": picked["alt"],
                        "sha256": hashlib.sha256(picked["data"]).hexdigest(), "bytes": len(picked["data"]), "source": "official-page-image",
                        "license": "공식 사이트 게시 이미지(권리는 권리자에게 있음)"}
    return row


def main():
    global crawl_results
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--only", default="")
    parser.add_argument("--orgs", default=str(crawl.DATA / "orgs.json"), help="roster file (data/companies.json for companies)")
    parser.add_argument("--names-only", "--refresh", dest="names_only", action="store_true", help="re-read the character pages already found and recompute names and image")
    args = parser.parse_args()
    orgs = [o for o in json.loads(Path(args.orgs).read_text())["orgs"] if o["group"] != "AI 기업"]
    if args.only:
        wanted = set(args.only.split(","))
        orgs = [o for o in orgs if o["name"] in wanted]
    crawl_results = json.loads((crawl.DATA / "crawl.json").read_text())["results"]
    previous = json.loads(OUT.read_text())["results"] if OUT.exists() else {}
    if args.names_only:
        found = [(k, r) for k, r in previous.items() if r.get("found")]
        def rename(pair):
            key, row = pair
            names, images = [], []
            for markup, base in pages_of(row["page"]):
                names += names_on(markup, row["name"])
                images += character_images(markup, base)
            picked = None
            for img_url, alt in list(dict.fromkeys(images))[:5]:
                got = fetch_image(img_url, row["page"])
                if got and (picked is None or got["area"] > picked["area"]):
                    picked = {**got, "alt": alt}
            return key, list(dict.fromkeys(names))[:3], picked
        with ThreadPoolExecutor(args.workers) as pool:
            for key, names, picked in pool.map(rename, found):
                row = previous[key]
                row["names"] = names
                for old in THUMBS.glob(f"m-{hashlib.sha1(key.encode()).hexdigest()[:10]}.*"):
                    old.unlink()
                row.pop("image", None)
                if picked:
                    fname = f"m-{hashlib.sha1(key.encode()).hexdigest()[:10]}.{picked['ext']}"
                    (THUMBS / fname).write_bytes(picked["data"])
                    row["image"] = {"file": "/mascots/thumbs/" + fname, "source_url": picked["url"], "page_url": row["page"], "alt": picked["alt"],
                                    "sha256": hashlib.sha256(picked["data"]).hexdigest(), "bytes": len(picked["data"]), "source": "official-page-image",
                                    "license": "공식 사이트 게시 이미지(권리는 권리자에게 있음)"}
        OUT.write_text(json.dumps({"updated_at": crawl.TODAY, "results": previous}, ensure_ascii=False, indent=1) + "\n")
        print(f"pages {len(found)} · named {sum(bool(previous[k].get('names')) for k, _ in found)}")
        return
    results, done = dict(previous), 0
    with ThreadPoolExecutor(args.workers) as pool:
        futures = {pool.submit(survey, o): o for o in orgs}
        for future in as_completed(futures):
            org = futures[future]
            try:
                results[crawl.org_key(org)] = future.result()
            except Exception as error:
                results[crawl.org_key(org)] = {"name": org["name"], "group": org["group"], "checked_at": crawl.TODAY, "found": False, "error": f"{type(error).__name__}: {str(error)[:80]}"}
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(orgs)}", flush=True)
                OUT.write_text(json.dumps({"updated_at": crawl.TODAY, "results": results}, ensure_ascii=False, indent=1) + "\n")
    OUT.write_text(json.dumps({"updated_at": crawl.TODAY, "results": results}, ensure_ascii=False, indent=1) + "\n")
    rows = [results[crawl.org_key(o)] for o in orgs]
    print(f"orgs {len(rows)} · character pages {sum(r.get('found', False) for r in rows)} · images {sum('image' in r for r in rows)} · named {sum(bool(r.get('names')) for r in rows)} · with files {sum(bool(r.get('files')) for r in rows)}")


crawl_results = {}

if __name__ == "__main__":
    main()
