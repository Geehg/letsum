"""Find the CI/symbol pages again for well-known organisations that still have no direct logo download.

Earlier passes often started from an English or tourism subsite (english.jinju.go.kr, eng.mokpo.go.kr …) whose menus
have no Korean symbol page. For each target this script:
  1. derives the Korean main site (drops eng./english./en./tour./foreign. hosts, adds www.) and adds the official
     sites linked from the Korean Wikipedia article;
  2. reads each home page (static and browser-rendered) and its sitemap page, scoring menu links that name the
     symbol, CI, MI or UI;
  3. reads the best few pages and keeps those that carry download candidates (check_downloads.candidates).
Pages found are stored in crawl.json as "ci_pages_extra" (and as "ci_page" when none was known); then run
check_downloads.py --only <ids> to verify the files.
Usage: python3 -I tools/logo-survey/refind_ci.py [--top 300] [--workers 5]
"""
import argparse, hashlib, json, re, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import crawl  # noqa: E402
import check_downloads as cd  # noqa: E402
from fill_logos import rendered_dom, official_sites  # noqa: E402

APP = Path(__file__).parent.parent / "logo-app" / "data"
SUB = re.compile(r"^(eng|english|en|tour|foreign|global|culture|intro|hsportal|kor|ko)\.", re.I)
SITEMAP = re.compile(r"(사이트맵|사이트 맵|sitemap|전체메뉴|전체 메뉴)", re.I)
PLACE = re.compile(r"(상징|심벌|심볼|CI|MI|UI|BI|로고|엠블럼|휘장|교표|브랜드|아이덴티티|identity|symbol)", re.I)


def korean_roots(urls):
    roots = []
    for url in urls:
        host = (urllib.parse.urlsplit(url or "").hostname or "").lower()
        if not host or "wikipedia" in host:
            continue
        host = SUB.sub("", re.sub(r"^www\.", "", host))
        for candidate in (f"https://www.{host}/", f"https://{host}/", f"http://www.{host}/"):
            if candidate not in roots:
                roots.append(candidate)
    return roots


def pages_of(url):
    out = []
    try:
        body, final, ctype = crawl.fetch(url, "text/html")
        out.append((crawl.decode(body, ctype), final))
    except Exception:
        pass
    dom = rendered_dom(url)
    if dom:
        out.append((dom, url))
    return out


def menu_links(markup, base, home):
    page = crawl.parse(markup)
    scored, maps = [], []
    for link in page.links:
        url = crawl.absolute(base, link["href"])
        if not url or not url.startswith("http") or not crawl.same_site(url, home):
            continue
        text = (link["text"] or "").strip()
        if SITEMAP.search(text) or re.search(r"sitemap|site_map|siteMap", url):
            maps.append(url)
        score = crawl.score_link(link)
        if PLACE.search(text) and len(text) <= 20:
            score += 2
        if score >= 4:
            scored.append((score, url))
    return scored, maps


def survey(job):
    rid, name, urls = job
    tried, scored = set(), {}
    for root in korean_roots(urls)[:6]:
        pages = pages_of(root)
        if not pages:
            continue
        maps = []
        for markup, base in pages:
            s, m = menu_links(markup, base, root)
            for score, url in s:
                scored[url] = max(scored.get(url, 0), score)
            maps += m
        for map_url in list(dict.fromkeys(maps))[:2]:
            for markup, base in pages_of(map_url):
                for score, url in menu_links(markup, base, root)[0]:
                    scored[url] = max(scored.get(url, 0), score + 1)
        if scored:
            break
    found = []
    for url, score in sorted(scored.items(), key=lambda kv: -kv[1])[:6]:
        if url in tried:
            continue
        tried.add(url)
        cands = []
        for markup, base in pages_of(url):
            try:
                cands += cd.candidates(markup, base)
            except Exception:
                pass
        if cands:
            found.append((len(set(c[0] for c in cands)), url))
    found.sort(reverse=True)
    return rid, [url for _, url in found[:3]]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=300, help="how many records by recognition to consider (use a large number for all)")
    parser.add_argument("--workers", type=int, default=5)
    args = parser.parse_args()
    records = json.loads((APP / "catalog.json").read_text())["records"]
    rank = json.loads((APP / "popularity.json").read_text())["records"]
    have = json.loads((APP / "downloads.json").read_text())["downloads"]
    orgs = json.loads((crawl.DATA / "orgs.json").read_text())["orgs"]
    crawl_file = crawl.DATA / "crawl.json"
    data = json.loads(crawl_file.read_text())
    by_id = {"kr-" + (o["wikidata"].lower() if o.get("wikidata") else "w" + hashlib.sha1(o["wiki_title"].encode()).hexdigest()[:10]): o for o in orgs}
    top = [r for r in sorted(records, key=lambda r: -rank[r["id"]]["score"])[:args.top] if r["id"] not in have and r["id"] in by_id]
    jobs = []
    for record in top:
        org = by_id[record["id"]]
        res = data["results"].get(crawl.org_key(org), {})
        jobs.append((record["id"], record["organization_name"], [res.get("website_final"), org.get("website"), record["source_url"], *official_sites(org)]))
    with ThreadPoolExecutor(args.workers) as pool:
        results = dict(pool.map(survey, jobs))
    data = json.loads(crawl_file.read_text())  # re-read: other steps may have written crawl.json meanwhile
    hits = 0
    for record in top:
        pages = results.get(record["id"]) or []
        if not pages:
            continue
        hits += 1
        res = data["results"].setdefault(crawl.org_key(by_id[record["id"]]), {})
        res["ci_pages_extra"] = pages
        if not res.get("ci_page"):
            res.update({"ci_page": pages[0], "ci_found_by": "refind"})
        print(f"  {record['organization_name']}: {pages[0]}")
    crawl_file.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    (crawl.DATA / "refind-ids.json").write_text(json.dumps([r["id"] for r in top if results.get(r["id"])]) + "\n")
    print(f"targets {len(top)} · pages with download candidates {hits}")


if __name__ == "__main__":
    main()
