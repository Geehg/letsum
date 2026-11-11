"""Mascot survey, step 1c: organisation character pages found by hand (data/mascot-pages-manual.json).

The automatic survey (mascot_survey.py) misses character pages that sit behind script menus, on a sub-site
(tour portal, brand site) or under a different domain than the one in the roster. Those pages were looked up with a
web search limited to the organisation's own domain and checked; each entry gives the page and the character names it
shows. This step reads every listed page (static and browser-rendered), picks the character picture the same way as
mascot_images.py — with a bonus for pictures whose alt text or file name carries one of the listed names — and writes
the organisation's row in data/mascot-crawl.json (found, page, names, image). Rows are matched by name and region.
Usage: python3 tools/logo-survey/mascot_hints.py [--only 서초구,마포구] [--workers 6]   (not -I: needs Pillow)
"""
import argparse, hashlib, io, json, re, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import crawl  # noqa: E402
from refind_ci import pages_of  # noqa: E402
from mascot_survey import CHAR, CHAR_URL, THUMBS, OUT  # noqa: E402
from mascot_images import candidates, fetch, REJECTED  # noqa: E402

HINTS = crawl.DATA / "mascot-pages-manual.json"
CHARISH = re.compile(r"(char|chr_|mascot|캐릭|마스코트)", re.I)
# Chat widgets and other third-party furniture that some local-government pages embed.
FOREIGN = re.compile(r"(chatty\.kr|han\.kr/chat|kakao|naver|facebook|instagram|youtube|twitter|google)", re.I)


def judge(url, alt, referer, named):
    """Like mascot_images.judge, but a picture that carries a listed name or a character word may be wider
    (two or three characters standing side by side)."""
    data = fetch(url, referer)
    if not data or len(data) > 8_000_000:
        return None
    kind = crawl.image_kind(data)
    if not kind:
        return None
    hint = 3 if named else (2 if CHAR.search(alt) or CHARISH.search(url) else 0)
    if kind == "svg":
        return {"data": data, "ext": kind, "score": 2 + hint, "url": url, "alt": alt}
    from PIL import Image
    try:
        image = Image.open(io.BytesIO(data))
        w, h = image.size
    except Exception:
        return None
    wide = 3.2 if hint else 1.9
    if w < 150 or h < 150 or w / h > wide or h / w > 2.6:
        return None
    clear = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)
    size = min(w * h, 900 * 900) / (900 * 900)
    return {"data": data, "ext": kind, "score": hint + 2 * size + (1.5 if clear else 0) + (0.5 if h >= w else 0), "url": url, "alt": alt}


def pick(hint):
    names = [n for n in hint["names"] if len(n) >= 2]
    seen, cands, words = set(REJECTED), [], 0
    for markup, base in pages_of(hint["page"]):
        words += len(CHAR.findall(crawl.parse(markup).plain))
        for url, alt in candidates(markup, base):
            if url in seen or FOREIGN.search(url):
                continue
            seen.add(url)
            cands.append((url, alt))

    def named(c):
        hay = c[1] + " " + urllib.parse.unquote(c[0])
        return any(n in hay for n in names)
    if "image" in hint:  # picked by eye; null = the page has no usable character picture
        if not hint["image"]:
            return words, None
        data = fetch(hint["image"], hint["page"])
        kind = crawl.image_kind(data) if data else None
        alt = next((a for u, a in cands if u == hint["image"]), "")
        return words, ({"data": data, "ext": kind, "score": 9, "url": hint["image"], "alt": alt} if kind else None)
    cands.sort(key=lambda c: 0 if named(c) else (1 if CHAR.search(c[1]) or CHAR_URL.search(c[0]) or CHARISH.search(c[0]) else 2))
    best = None
    for url, alt in cands[:30]:
        got = judge(url, alt, hint["page"], named((url, alt)))
        if got:
            if best is None or got["score"] > best["score"]:
                best = got
    return words, best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()
    hints = json.loads(HINTS.read_text())["pages"]
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    if only:
        hints = [h for h in hints if h["name"] in only]
    orgs = json.loads((crawl.DATA / "orgs.json").read_text())["orgs"]
    key_of = {}
    for o in orgs:
        key_of.setdefault((o["name"], o.get("region") or o["name"]), crawl.org_key(o))
    data = json.loads(OUT.read_text())
    with ThreadPoolExecutor(args.workers) as pool:
        picks = list(pool.map(pick, hints))
    THUMBS.mkdir(parents=True, exist_ok=True)
    got = 0
    for hint, (words, best) in zip(hints, picks):
        key = key_of.get((hint["name"], hint["region"]))
        if not key:
            print(f"  ! no roster entry: {hint['name']} ({hint['region']})")
            continue
        row = data["results"].setdefault(key, {"name": hint["name"], "group": "기초자치단체"})
        row.update({"checked_at": crawl.TODAY, "found": True, "page": hint["page"], "names": hint["names"][:4], "words": max(words, row.get("words", 0) or 0),
                    "page_source": "hand-found"})
        row.setdefault("files", [])
        for old in THUMBS.glob(f"m-{hashlib.sha1(key.encode()).hexdigest()[:10]}.*"):
            old.unlink()
        row.pop("image", None)
        if best:
            name = f"m-{hashlib.sha1(key.encode()).hexdigest()[:10]}.{best['ext']}"
            (THUMBS / name).write_bytes(best["data"])
            row["image"] = {"file": "/mascots/thumbs/" + name, "source_url": best["url"], "page_url": hint["page"], "alt": best["alt"],
                            "sha256": hashlib.sha256(best["data"]).hexdigest(), "bytes": len(best["data"]), "source": "official-page-image",
                            "license": "공식 사이트 게시 이미지(권리는 권리자에게 있음)", "picked_by": "mascot_hints.py"}
            got += 1
        print(f"  {hint['name']} ({hint['region']}): words {words} · {best['url'] if best else '이미지 없음'}")
    data["updated_at"] = crawl.TODAY
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"pages {len(hints)} · images {got}")


if __name__ == "__main__":
    main()
