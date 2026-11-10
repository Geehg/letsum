"""Recognition score for the logo directory's default order (most known / most looked-up first, within every category).

For every catalog record the Korean Wikipedia article is resolved (survey records: their roster article; hand-curated
records: their organisation name or aliases), then two public signals are read:
  * pageviews  Korean Wikipedia views by people over the last 12 full months (Wikimedia pageviews API) — demand
  * sitelinks  number of Wikipedia language editions with an article on the organisation (Wikidata) — scale and reach
score = log10(pageviews + 10) + 0.6 * log10(sitelinks + 1); records without an article score 0.
Writes tools/logo-app/data/popularity.json, which the logo build injects. Usage: python3 -I tools/logo-survey/popularity.py
"""
import datetime, hashlib, json, math, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
APP = HERE.parent / "logo-app" / "data"
UA = {"User-Agent": "LETSUM-logo-survey/1.0 (+https://letsum.app/logos/)"}


def get(url):
    for attempt in range(5):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            if attempt == 4:
                raise
            time.sleep(3 * (attempt + 1))
        except Exception:
            if attempt == 4:
                raise
            time.sleep(3 * (attempt + 1))


def api(base, params):
    return get(base + "?" + urllib.parse.urlencode({**params, "format": "json"}))


def resolve(titles):
    """{asked title: (canonical title, wikidata id)} for existing Korean Wikipedia articles."""
    out = {}
    titles = list(dict.fromkeys(t for t in titles if t))
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        data = api("https://ko.wikipedia.org/w/api.php", {"action": "query", "titles": "|".join(chunk), "redirects": 1, "prop": "pageprops", "ppprop": "wikibase_item"})["query"]
        step = {t: t for t in chunk}
        for n in data.get("normalized", []):
            step = {k: (n["to"] if v == n["from"] else v) for k, v in step.items()}
        for r in data.get("redirects", []):
            step = {k: (r["to"] if v == r["from"] else v) for k, v in step.items()}
        pages = {p["title"]: p for p in data.get("pages", {}).values() if "missing" not in p}
        for asked, final in step.items():
            if final in pages:
                out[asked] = (final, pages[final].get("pageprops", {}).get("wikibase_item"))
        time.sleep(0.3)
    return out


def sitelinks(qids):
    out = {}
    qids = sorted({q for q in qids if q})
    for i in range(0, len(qids), 50):
        data = api("https://www.wikidata.org/w/api.php", {"action": "wbgetentities", "ids": "|".join(qids[i:i + 50]), "props": "sitelinks"})
        for qid, entity in data.get("entities", {}).items():
            out[qid] = sum(1 for site in entity.get("sitelinks", {}) if site.endswith("wiki") and site not in ("commonswiki", "specieswiki", "metawiki"))
        time.sleep(1)
    return out


def pageviews(title, start, end):
    url = ("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ko.wikipedia.org/all-access/user/"
           + urllib.parse.quote(title.replace(" ", "_"), safe="") + f"/monthly/{start}/{end}")
    data = get(url)
    return sum(item["views"] for item in data["items"]) if data else 0


def main():
    records = json.loads((APP / "catalog.json").read_text())["records"]
    orgs = json.loads((HERE / "data" / "orgs.json").read_text())["orgs"]
    by_id = {"kr-" + (o["wikidata"].lower() if o.get("wikidata") else "w" + hashlib.sha1(o["wiki_title"].encode()).hexdigest()[:10]): o for o in orgs}
    candidates = {}
    for record in records:
        org = by_id.get(record["id"])
        names = [org["wiki_title"]] if org else []
        names += [record["organization_name"], *record.get("aliases", []), record.get("name_en")]
        candidates[record["id"]] = [n for n in dict.fromkeys(names) if n]
    found = resolve([n for names in candidates.values() for n in names])
    article = {rid: next((found[n] for n in names if n in found), None) for rid, names in candidates.items()}
    for rid, hit in article.items():  # survey records keep their roster item even when the article lacks a Wikidata link
        org = by_id.get(rid)
        if hit and org and org.get("wikidata") and not hit[1]:
            article[rid] = (hit[0], org["wikidata"])
    links = sitelinks(q for hit in article.values() if hit for q in [hit[1]])
    today = datetime.date.today().replace(day=1)
    end = today - datetime.timedelta(days=1)
    start = (end.replace(day=1) - datetime.timedelta(days=330)).replace(day=1)
    titles = sorted({hit[0] for hit in article.values() if hit})
    with ThreadPoolExecutor(4) as pool:
        views = dict(zip(titles, pool.map(lambda t: pageviews(t, start.strftime("%Y%m%d"), end.strftime("%Y%m%d")), titles)))
    rows = {}
    for rid, hit in article.items():
        if not hit:
            rows[rid] = {"score": 0, "wiki_title": None, "pageviews": None, "sitelinks": None}
            continue
        pv, sl = views.get(hit[0], 0), links.get(hit[1], 0)
        rows[rid] = {"score": round(math.log10(pv + 10) + 0.6 * math.log10(sl + 1), 3), "wiki_title": hit[0], "pageviews": pv, "sitelinks": sl}
    out = {"note": "기본 정렬용 인지도 점수: 한국어 위키백과 최근 12개월 조회수(수요)와 위키백과 언어판 수(규모·인지도). tools/logo-survey/popularity.py가 생성.",
           "period": f"{start:%Y-%m}~{end:%Y-%m}", "updated_at": datetime.date.today().isoformat(), "records": dict(sorted(rows.items()))}
    (APP / "popularity.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    missing = [rid for rid, r in rows.items() if not r["wiki_title"]]
    print(f"records {len(rows)} · articles {len(rows) - len(missing)} · without article {len(missing)}")
    for rid, r in sorted(rows.items(), key=lambda kv: -kv[1]["score"])[:15]:
        print(f"  {r['score']:.2f} {r['wiki_title']} pv={r['pageviews']} sl={r['sitelinks']}")
    print("  no article:", ", ".join(missing[:30]))


if __name__ == "__main__":
    main()
