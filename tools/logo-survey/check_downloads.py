"""Check which logo file links found on CI pages (find_formats.py → crawl.json "formats.files") download directly.

Each link is requested from the official site (with the CI page as referrer) and only its first bytes are read: a link
counts as a direct download when the response is a file whose signature matches a logo format (ZIP, PDF, AI, EPS,
PNG, JPG, SVG) — not an HTML page, a login wall or an error. The format is taken from the signature (an "AI" link that
serves a ZIP is recorded as ZIP). Results go to tools/logo-app/data/downloads.json, which the logo build injects so the
format badges link straight to the official file (the same approach as the font pages: files come from the publisher).
Usage: python3 -I tools/logo-survey/check_downloads.py [--workers 8]
"""
import argparse, hashlib, json, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import crawl  # noqa: E402

APP = Path(__file__).parent.parent / "logo-app" / "data"


def sniff(head, claimed):
    if head.startswith(b"PK\x03\x04") or head.startswith(b"PK\x05\x06"):
        return "ZIP"
    if head.startswith(b"%PDF"):
        return "AI" if claimed == "AI" else "PDF"  # Illustrator files are PDF-compatible
    if head.startswith(b"%!PS") or head.startswith(b"\xc5\xd0\xd3\xc6"):
        return "AI" if claimed == "AI" else "EPS"
    if head.startswith(b"\x89PNG"):
        return "PNG"
    if head.startswith(b"\xff\xd8\xff"):
        return "JPG"
    text = head.lstrip(b"\xef\xbb\xbf \r\n\t")[:400].lower()
    if text.startswith(b"<?xml") and b"<svg" in head.lower() or text.startswith(b"<svg"):
        return "SVG"
    return None


def packed(name):
    """Format named in a ZIP's file name (ci_ai.zip, 로고(JPG파일).zip) — the format packed inside, else None."""
    hits = {m.upper().replace("JPEG", "JPG") for m in re.findall(r"(?<![a-z])(ai|eps|svg|pdf|png|jpe?g)(?![a-z])", (name or "").lower())}
    return hits.pop() if len(hits) == 1 else None


def filename(headers, url):
    cd = headers.get("content-disposition", "")
    m = re.search(r"filename\*\s*=\s*[^']*''([^;]+)", cd, re.I) or re.search(r'filename\s*=\s*"?([^";]+)', cd, re.I)
    if m:
        raw = m.group(1).strip()
        try:
            name = urllib.parse.unquote(raw)
            if "%" not in raw:  # servers often send UTF-8 bytes as Latin-1
                name = raw.encode("latin-1").decode("utf-8")
        except Exception:
            name = raw
        return name[:120]
    return urllib.parse.unquote(urllib.parse.urlsplit(url).path.rsplit("/", 1)[-1])[:120] or None


def check(claimed, url, page):
    try:
        request = urllib.request.Request(url, headers={"User-Agent": crawl.UA, "Accept": "*/*", "Referer": page or url})
        with crawl._opener.open(request, timeout=25) as response:
            head = response.read(1024)
            fmt = sniff(head, claimed)
            if not fmt:
                return None
            size = response.headers.get("content-length")
            return {"format": fmt, "url": url, "final_url": response.geturl(), "bytes": int(size) if size and size.isdigit() else None,
                    "filename": filename(response.headers, response.geturl())}
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    orgs = json.loads((crawl.DATA / "orgs.json").read_text())["orgs"]
    results = json.loads((crawl.DATA / "crawl.json").read_text())["results"]
    ids = {r["id"] for r in json.loads((APP / "catalog.json").read_text())["records"]}
    jobs = []
    for org in orgs:
        rid = "kr-" + (org["wikidata"].lower() if org.get("wikidata") else "w" + hashlib.sha1(org["wiki_title"].encode()).hexdigest()[:10])
        found = (results.get(crawl.org_key(org)) or {}).get("formats") or {}
        if rid not in ids:
            continue
        for url, claimed in dict((u, f) for f, u in found.get("files", [])).items():
            jobs.append((rid, claimed, url, found.get("page")))
    with ThreadPoolExecutor(args.workers) as pool:
        checked = list(pool.map(lambda job: check(*job[1:]), jobs))
    out, seen = {}, set()
    for (rid, claimed, url, page), hit in zip(jobs, checked):
        if hit and (rid, hit["final_url"]) not in seen:
            seen.add((rid, hit["final_url"]))
            hit.pop("final_url")
            if hit["format"] == "ZIP" and packed(hit["filename"]):
                hit["contains"] = packed(hit["filename"])
            out.setdefault(rid, []).append(hit)
    data = {"note": "공식 CI 페이지의 로고 파일 링크 중 바로 내려받아지는 것(파일 서명으로 확인). tools/logo-survey/check_downloads.py가 생성.",
            "checked_at": time.strftime("%Y-%m-%d"), "downloads": dict(sorted(out.items()))}
    (APP / "downloads.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    formats = {}
    for rows in out.values():
        for row in rows:
            formats[row["format"]] = formats.get(row["format"], 0) + 1
    print(f"links {len(jobs)} · direct downloads {sum(len(v) for v in out.values())} in {len(out)} records · {formats}")


if __name__ == "__main__":
    main()
