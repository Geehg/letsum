"""Find the logo file formats each organisation offers (AI, EPS, SVG, PDF, PNG, JPG, ZIP) on its CI page.

Organisations with a known CI page: re-read it (and the browser-rendered page when the static HTML shows nothing).
Organisations without one: look for the CI menu again on the browser-rendered home page; a page found this way also
updates the CI page and the official colours. Results go to data/crawl.json ("formats"); merge.py turns them into
page-listed assets. Usage: python3 tools/logo-survey/find_formats.py [--workers 6]   (not -I: needs Pillow)
"""
import argparse, json, re, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import crawl  # noqa: E402
from fill_logos import rendered_dom  # noqa: E402

FORMATS = {"ai": "AI", "eps": "EPS", "svg": "SVG", "pdf": "PDF", "png": "PNG", "jpg": "JPG", "jpeg": "JPG", "zip": "ZIP"}
TOKEN = r"(AI|EPS|SVG|PDF|PNG|JPE?G|ZIP)"
LIST = re.compile(TOKEN + r"(?:\s*(?:,|/|·|ㆍ|\||및|와|과|\s)\s*" + TOKEN + r")+", re.I)
WITH_FILE = re.compile(TOKEN + r"\s*(?:파일|형식|포맷|버전|다운로드|download|file)", re.I)
CI_HINT = re.compile(r"(CI|MI|UI|BI|로고|심벌|심볼|상징|시그니처|엠블럼|휘장|교표|logo|symbol|emblem|signature|identity|마크)", re.I)
DOWNLOAD = re.compile(r"(다운|download|받기|내려받)", re.I)
GUIDE = re.compile(r"(가이드|매뉴얼|규정|guide|manual|CI|MI|UI)", re.I)


def normalise(token):
    token = token.upper()
    return "JPG" if token == "JPEG" else token


def formats_on(markup, base):
    page = crawl.parse(markup)
    found, files = set(), []
    for link in page.links:
        href, text = link["href"] or "", (link["text"] or "").strip()
        url = crawl.absolute(base, href) if href and not href.startswith(("javascript:", "#", "mailto:")) else None
        ext = (re.search(r"\.([a-z]{2,4})(?:$|[?#])", urllib.parse.urlsplit(url).path.lower() + "") or [None, None])[1] if url else None
        hay = f"{text} {href}"
        if ext in FORMATS:
            fmt = FORMATS[ext]
            if (CI_HINT.search(hay) or DOWNLOAD.search(text)) and (fmt != "PDF" or GUIDE.search(hay)):
                found.add(fmt); files.append([fmt, url])
                continue
        if DOWNLOAD.search(text) or CI_HINT.search(text):
            for token in re.findall(r"\b" + TOKEN + r"\b", text, re.I):
                found.add(normalise(token))
                if url and not files:
                    files.append([normalise(token), url])
    text = page.plain
    for m in LIST.finditer(text):
        found.update(normalise(t) for t in re.findall(TOKEN, m.group(0), re.I))
    for m in WITH_FILE.finditer(text):
        found.add(normalise(m.group(1)))
    return sorted(found, key=lambda f: list(dict.fromkeys(FORMATS.values())).index(f)), files


def ci_candidates(markup, base):
    page = crawl.parse(markup)
    out = []
    for link in page.links:
        url = crawl.absolute(base, link["href"])
        if url and crawl.score_link(link) >= 4 and crawl.same_site(url, base) and url.rstrip("/") != base.rstrip("/"):
            out.append((crawl.score_link(link), url, (link["text"] or "").strip()[:40]))
    return [c for c in dict((u, (s, u, t)) for s, u, t in sorted(out)).values()][::-1][:4]


def read(url, rendered=False):
    if rendered:
        markup = rendered_dom(url)
        return (markup, url) if markup else (None, url)
    try:
        body, final, ctype = crawl.fetch(url, "text/html")
        return crawl.decode(body, ctype), final
    except Exception:
        return None, url


def survey(org, result):
    try:
        return _survey(org, result)
    except Exception as error:
        return {"formats_error": f"{type(error).__name__}: {str(error)[:60]}"}


def _survey(org, result):
    update = {}
    ci = result.get("ci_page")
    if not ci:
        home = result.get("website_final") or org.get("website")
        if not home:
            return update
        markup, base = read(home, rendered=True)
        if not markup:
            markup, base = read(home)
        if not markup:
            return update
        best = None
        for score, url, text in ci_candidates(markup, base):
            page_markup, final = read(url)
            if not page_markup:
                continue
            specs = crawl.colour_specs(crawl.parse(page_markup).plain)
            rank = (bool(specs), score, len(crawl.CI_WORDS.findall(page_markup[:40000])))
            if best is None or rank > best[0]:
                best = (rank, final, text, specs, page_markup)
        if not best:
            return update
        _, ci, text, specs, page_markup = best
        update.update({"ci_page": ci, "ci_link_text": text, "ci_found_by": "rendered-home"})
        if specs and not result.get("colors_official"):
            update["colors_official"] = specs
        formats, files = formats_on(page_markup, ci)
    else:
        markup, base = read(ci)
        formats, files = formats_on(markup, base) if markup else ([], [])
        if not formats:
            markup, base = read(ci, rendered=True)
            if markup:
                formats, files = formats_on(markup, base)
    if formats:
        update["formats"] = {"list": formats, "files": files[:8], "page": ci, "checked_at": crawl.TODAY}
    return update


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()
    orgs = json.loads((crawl.DATA / "orgs.json").read_text())["orgs"]
    crawl_file = crawl.DATA / "crawl.json"
    data = json.loads(crawl_file.read_text())
    work = [(o, data["results"].setdefault(crawl.org_key(o), {"name": o["name"], "group": o["group"], "checked_at": crawl.TODAY, "errors": []})) for o in orgs]
    found_formats = found_pages = 0
    with ThreadPoolExecutor(args.workers) as pool:
        for (org, result), update in zip(work, pool.map(lambda pair: survey(*pair), work)):
            if "ci_page" in update:
                found_pages += 1
            if "formats" in update:
                found_formats += 1
            result.update(update)
    crawl_file.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    total = sum(1 for _, r in work if r.get("formats"))
    print(f"new CI pages {found_pages} · formats found this run {found_formats} · organisations with formats {total}")


if __name__ == "__main__":
    main()
