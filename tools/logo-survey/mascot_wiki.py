"""Mascot survey, step 2: well-known mascots from Korean Wikipedia (data/mascot-wiki.json).

Articles are collected from mascot categories (Korea's mascots and KBO mascots, Olympic/Paralympic, football, baseball,
basketball, city, railway, organisation, company, computer and video-game mascots, mascots by country) and from the
list articles (마스코트 목록, FIFA 월드컵 공식 마스코트). For each article: Wikidata item, the organisation that has it
as mascot (P822, inverse), country, a one-sentence description, and a freely licensed Commons image (P18 or the
article image) saved to html/mascots/thumbs/ with its licence and author.
Usage: python3 -I tools/logo-survey/mascot_wiki.py
"""
import hashlib, json, re, time, urllib.parse, urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.resolve().parents[1]
THUMBS = ROOT / "html" / "mascots" / "thumbs"
OUT = HERE / "data" / "mascot-wiki.json"
UA = {"User-Agent": "LETSUM-logo-survey/1.0 (+https://letsum.app/logos/)"}
CATS = {  # category → (group hint, how many sub-category levels to follow)
    "분류:대한민국의 마스코트": ("korea", 1), "분류:올림픽 마스코트": ("olympic", 1), "분류:패럴림픽 마스코트": ("olympic", 1),
    "분류:축구 마스코트": ("football", 1), "분류:야구 마스코트": ("baseball", 1), "분류:농구 마스코트": ("basketball", 1), "분류:도시 마스코트": ("city", 0),
    "분류:철도 마스코트": ("railway", 0), "분류:단체 마스코트": ("organisation", 0), "분류:기업 마스코트": ("company", 0), "분류:컴퓨터 마스코트": ("tech", 0),
    "분류:비디오 게임 마스코트": ("game", 0), "분류:동물 마스코트": ("other", 0), "분류:나라별 마스코트": ("country", 1), "분류:마스코트": ("other", 0),
}
LISTS = {"FIFA 월드컵 공식 마스코트": "worldcup"}
# Brand and organisation mascots that are not in the mascot categories (animation and franchise characters are left out).
EXTRA = {"펭수": "kbrand", "카카오프렌즈": "kbrand", "라이언 (카카오프렌즈)": "kbrand", "브라운 (라인프렌즈)": "kbrand", "BT21": "kbrand", "니니즈": "kbrand",
         "신한프렌즈": "kbrand", "핑크퐁": "kbrand", "해치 (마스코트)": "seoul", "구마몬": "city", "후낫시": "city", "헬로키티": "company",
         "로널드 맥도날드": "company", "커널 샌더스": "company", "M&M's": "company"}
# Category members that are not mascots of an organisation or brand.
EXCLUDE = {"페페 더 프로그", "촛불소녀", "충돌 테스트용 인형", "유루캬라", "영구", "OS탄", "카사네 테토", "모자 쓴 고양이", "케빗"}
SKIP = re.compile(r"(목록|^틀:|^분류:|^마스코트$|동음이의|^위키백과:|로고라마|탈인형|캐릭터 디자인|의인화|논란|^\\d{4}년 .*(올림픽|패럴림픽|게임|월드컵|대회)$|^FIFA 월드컵$)")


def api(base, params):
    for attempt in range(5):
        try:
            url = base + "?" + urllib.parse.urlencode({**params, "format": "json"})
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
        except Exception:
            if attempt == 4:
                raise
            time.sleep(3 * (attempt + 1))


KO = "https://ko.wikipedia.org/w/api.php"


def members(cat, depth=0, seen=None, limit=1):
    seen = seen if seen is not None else set()
    if cat in seen or depth > limit:
        return []
    seen.add(cat)
    out, cont = [], {}
    while True:
        data = api(KO, {"action": "query", "list": "categorymembers", "cmtitle": cat, "cmlimit": 500, **cont})
        for m in data["query"]["categorymembers"]:
            if m["ns"] == 14:
                out += members(m["title"], depth + 1, seen, limit) if depth < limit else []
            elif m["ns"] == 0:
                out.append(m["title"])
        if "continue" not in data:
            return out
        cont = data["continue"]


def linked(title):
    data = api(KO, {"action": "query", "titles": title, "prop": "links", "plnamespace": 0, "pllimit": 500, "redirects": 1})
    return [l["title"] for p in data["query"]["pages"].values() for l in p.get("links", [])]


def commons_image(filename):
    data = api("https://commons.wikimedia.org/w/api.php", {"action": "query", "titles": "File:" + filename, "prop": "imageinfo", "iiprop": "url|extmetadata|mime", "iiurlwidth": 600})
    for page in data["query"]["pages"].values():
        info = (page.get("imageinfo") or [None])[0]
        if not info:
            return None
        meta = info.get("extmetadata", {})
        strip = lambda v: re.sub(r"<[^>]+>", "", (v or {}).get("value", "")).strip()
        return {"url": info.get("thumburl") or info["url"], "page_url": info.get("descriptionurl"), "license": strip(meta.get("LicenseShortName")) or None,
                "author": strip(meta.get("Artist"))[:80] or None, "mime": info.get("mime")}


def main():
    titles = {}
    for cat, (kind, limit) in CATS.items():
        for t in members(cat, limit=limit):
            titles.setdefault(t, kind)
    for page, kind in LISTS.items():
        for t in linked(page):
            if re.search(r"(마스코트|[가-힣]이$|돌이$)", t) and not SKIP.search(t):
                titles.setdefault(t, kind)
    titles.update(EXTRA)
    titles = {t: k for t, k in titles.items() if not SKIP.search(t) and t not in EXCLUDE}
    rows, items = {}, list(titles.items())
    for i in range(0, len(items), 50):
        chunk = items[i:i + 50]
        data = api(KO, {"action": "query", "titles": "|".join(t for t, _ in chunk), "redirects": 1, "prop": "pageprops|extracts|pageimages",
                        "ppprop": "wikibase_item", "exintro": 1, "explaintext": 1, "exsentences": 1, "piprop": "name"})
        q = data["query"]
        resolved = {t: t for t, _ in chunk}
        for r in q.get("normalized", []) + q.get("redirects", []):
            resolved = {k: (r["to"] if v == r["from"] else v) for k, v in resolved.items()}
        pages = {p["title"]: p for p in q["pages"].values() if "missing" not in p}
        for asked, kind in chunk:
            p = pages.get(resolved[asked])
            if not p or p["title"] in rows:
                continue
            rows[p["title"]] = {"title": p["title"], "kind": kind, "qid": p.get("pageprops", {}).get("wikibase_item"), "extract": (p.get("extract") or "").strip()[:200], "page_image": p.get("pageimage")}
        time.sleep(0.5)
    qids = [r["qid"] for r in rows.values() if r["qid"]]
    entities = {}
    for i in range(0, len(qids), 50):
        entities.update(api("https://www.wikidata.org/w/api.php", {"action": "wbgetentities", "ids": "|".join(qids[i:i + 50]), "props": "claims|labels", "languages": "ko|en"})["entities"])
        time.sleep(1)
    def claim(e, prop):
        for c in e.get("claims", {}).get(prop, []):
            v = c["mainsnak"].get("datavalue", {}).get("value")
            if v is not None:
                return v
    THUMBS.mkdir(parents=True, exist_ok=True)
    for row in rows.values():
        e = entities.get(row["qid"] or "", {})
        row["name_en"] = e.get("labels", {}).get("en", {}).get("value")
        country = claim(e, "P17") or claim(e, "P495")
        row["country_qid"] = country["id"] if country else None
        row["image_file"] = claim(e, "P18") or row.pop("page_image", None)
        if row["image_file"]:
            info = commons_image(row["image_file"])
            if info and info["mime"] in ("image/png", "image/jpeg", "image/svg+xml", "image/gif", "image/webp"):
                try:
                    data = urllib.request.urlopen(urllib.request.Request(info["url"], headers=UA), timeout=60).read()
                    ext = {"image/png": "png", "image/jpeg": "jpg", "image/gif": "png", "image/webp": "webp", "image/svg+xml": "png"}[info["mime"]]
                    if info["url"].lower().endswith(".svg"):
                        ext = "svg"
                    name = f"w-{hashlib.sha1(row['title'].encode()).hexdigest()[:10]}.{ext}"
                    (THUMBS / name).write_bytes(data)
                    row["image"] = {"file": "/mascots/thumbs/" + name, "source": "wikimedia-commons", "source_url": info["url"], "page_url": info["page_url"],
                                    "license": info["license"], "author": info["author"], "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
                except Exception:
                    pass
            time.sleep(0.3)
    countries = {}
    cq = sorted({r["country_qid"] for r in rows.values() if r["country_qid"]})
    for i in range(0, len(cq), 50):
        for qid, e in api("https://www.wikidata.org/w/api.php", {"action": "wbgetentities", "ids": "|".join(cq[i:i + 50]), "props": "claims"})["entities"].items():
            countries[qid] = claim(e, "P297")
    for row in rows.values():
        row["country"] = countries.get(row.pop("country_qid") or "", None)
    OUT.write_text(json.dumps({"built_at": time.strftime("%Y-%m-%d"), "mascots": sorted(rows.values(), key=lambda r: r["title"])}, ensure_ascii=False, indent=1) + "\n")
    print(f"articles {len(rows)} · with image {sum('image' in r for r in rows.values())} · Korean {sum(r['country'] == 'KR' for r in rows.values())}")


if __name__ == "__main__":
    main()
