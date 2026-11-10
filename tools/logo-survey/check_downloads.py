"""Full survey of direct logo-file downloads on official CI pages → tools/logo-app/data/downloads.json.

Policy: only files the organisation itself publishes openly are linked (the file stays on the official server, as on
the font pages). Links that need a login, an application or approval never pass: a link counts only when an anonymous
request returns a file whose signature is a logo format (ZIP, PDF, AI, EPS, PNG, JPG, SVG), not an HTML page.

1. Pages: every known CI page (crawl.json "ci_page") plus the guideline/source pages of hand-curated records.
2. Candidates, from the static HTML and the browser-rendered page: links to logo-format files, links to download
   endpoints (download.do, FileDown, atchFileId …) labelled as a download or CI item, eGovFrame download calls
   (fn_egov_downFile) and file URLs inside onclick handlers; plus the files find_formats.py recorded.
3. Each candidate is requested (official page as referrer) and only its first bytes are read. ZIPs are opened from
   the end (HTTP range) to list the formats packed inside, without downloading the archive.
Usage: python3 -I tools/logo-survey/check_downloads.py [--workers 6] [--no-render]
"""
import argparse, hashlib, html as htmllib, json, re, struct, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import crawl  # noqa: E402

APP = Path(__file__).parent.parent / "logo-app" / "data"
CACHE = crawl.DATA / "download-candidates.json"
ORDER = ["AI", "EPS", "SVG", "PDF", "PNG", "JPG", "ZIP"]
EXT = {"ai": "AI", "eps": "EPS", "svg": "SVG", "pdf": "PDF", "png": "PNG", "jpg": "JPG", "jpeg": "JPG", "zip": "ZIP"}
CI_HINT = re.compile(r"((?<![a-z])(?:CI|MI|UI|BI)(?![a-z])|로고|심벌|심볼|상징|시그니처|엠블럼|엠블렘|휘장|교표|마크|워드마크|logo|symbol|emblem|signature|identity|wordmark|brand|insignia|lockup|logotype|가이드|매뉴얼|guide|manual)", re.I)
DOWN_TEXT = re.compile(r"(다운|download|받기|내려받|저장)", re.I)
DOWN_URL = re.compile(r"(download|filedown|file_down|downfile|down_file|atchfile|attach|getfile|fileid|filesn|/down\.|dn\.do|fms/|/file/)", re.I)
NOT_LOGO = re.compile(r"(개인정보|약관|채용|공고|입찰|보도자료|서식|신청서|계약|결과|회의록|예산|공시|규정집|법령|브로슈어|리플렛|홍보책자|책자|홍보물|소식지|교가|khsong|악보|akbo|가림막|sns_background|배경화면|wallpaper|신입생|freshman|인증서|웹와치|접근성|편지지|메모지|봉투|명함|글꼴|폰트|서체|font|\.ttf|\.otf|연보|annual|privacy|recruit)", re.I)
TAG = re.compile(r"<(a|button)\b([^>]*)>(.*?)</\1\s*>|<(area|input|span|div|li|img|td|p|dd)\b([^>]*\bon(?:click|mousedown)\b[^>]*)>", re.S | re.I)
ATTR = re.compile(r"""([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)""")
EGOV = re.compile(r"""fn_egov_downFile\(\s*['"]([^'"]+)['"]\s*,\s*['"]?(\d+)""")
QUOTED = re.compile(r"""['"]([^'"\s]+?(?:\.(?:ai|eps|svg|pdf|png|jpe?g|zip)(?:\?[^'"\s]*)?|(?:download|filedown|downfile|atchfile|getfile)[^'"\s]*))['"]""", re.I)


def ext_of(url):
    m = re.search(r"\.([a-z0-9]{2,4})$", urllib.parse.unquote(urllib.parse.urlsplit(url).path).lower())
    return EXT.get(m.group(1)) if m else None


def strip_tags(text):
    return re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", " ", text or ""))).strip()


def candidates(markup, base):
    """[(url, label)] of download candidates in one page's markup."""
    out = []
    for m in TAG.finditer(markup):
        tag, raw, inner = (m.group(1) or m.group(4)).lower(), (m.group(2) if m.group(1) else m.group(5)) or "", m.group(3) or ""
        attrs = {k.lower(): htmllib.unescape(v.strip("\"'")) for k, v in ATTR.findall(raw)}
        text = strip_tags(inner)[:80]
        label = " ".join(filter(None, [text, attrs.get("title", ""), attrs.get("alt", ""), attrs.get("aria-label", "")]))[:120]
        if tag == "img" and not attrs.get("onclick"):
            continue
        href = attrs.get("href", "")
        script = " ".join(v for k, v in attrs.items() if k.startswith("on") or (k == "href" and v.lower().startswith("javascript:")))
        urls = []
        if href and not href.lower().startswith(("javascript:", "#", "mailto:", "tel:")):
            urls.append(href)
        for key in ("data-href", "data-url", "data-file", "data-down", "data-src-down"):
            if attrs.get(key):
                urls.append(attrs[key])
        for file_id, sn in EGOV.findall(script):
            urls.append(f"/cmm/fms/FileDown.do?atchFileId={urllib.parse.quote(file_id)}&fileSn={sn}")
        urls += QUOTED.findall(script)
        for raw_url in urls:
            url = crawl.absolute(base, raw_url)
            if not url or not url.startswith("http"):
                continue
            fmt = ext_of(url)
            hay = f"{label} {urllib.parse.unquote(url)}"
            if NOT_LOGO.search(hay):
                continue
            if fmt in ("ZIP", "AI", "EPS"):
                ok = True
            elif fmt in ("PDF", "PNG", "JPG", "SVG"):
                ok = bool(CI_HINT.search(hay)) and (fmt == "PDF" or DOWN_TEXT.search(label) or "download" in attrs or tag != "a" or re.search(r"(down|logo|ci|symbol|signature)", url, re.I))
            elif fmt is None and (DOWN_URL.search(url) or EGOV.search(script)):
                ok = bool(DOWN_TEXT.search(label) or re.search(r"\b(AI|EPS|PNG|JPE?G|ZIP|PDF|SVG)\b", label) or CI_HINT.search(label) or "download" in attrs)
            else:
                ok = False
            if ok:
                out.append((url, label))
    return out


def read(url, render):
    pages = []
    try:
        body, final, ctype = crawl.fetch(url, "text/html")
        pages.append((crawl.decode(body, ctype), final))
    except Exception:
        pass
    if render:
        from fill_logos import rendered_dom
        dom = rendered_dom(url)
        if dom:
            pages.append((dom, url))
    return pages


def discover(job, render):
    rid, page_urls, known = job
    found = {}
    for page in page_urls:
        for markup, base in read(page, render):
            try:
                rows = candidates(markup, base)
            except Exception as error:
                print("  skip page", page, type(error).__name__, file=sys.stderr)
                continue
            for url, label in rows:
                found.setdefault(url, {"label": label, "page": page})
    for item in known:  # [format, url] from find_formats.py, or [url, page, label] from data/download-manual.json
        if len(item) >= 3:
            found.setdefault(item[0], {"label": item[2], "page": item[1], **(item[3] if len(item) > 3 else {})})
        else:
            found.setdefault(item[1], {"label": "", "page": page_urls[0] if page_urls else item[1]})
    return rid, found


# --- verification ------------------------------------------------------------------------------------------------
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
    if (text.startswith(b"<?xml") and b"<svg" in head.lower()) or text.startswith(b"<svg"):
        return "SVG"
    return None


def unmangle(name):
    """UTF-8 (or CP949) bytes that arrived decoded as Latin-1."""
    if name and any(ord(ch) > 127 for ch in name) and all(ord(ch) < 256 for ch in name):
        for codec in ("utf-8", "cp949"):
            try:
                return name.encode("latin-1").decode(codec)
            except Exception:
                continue
    return name


def filename(headers, url):
    cd = headers.get("content-disposition", "") or ""
    m = re.search(r"filename\*\s*=\s*[^']*''([^;]+)", cd, re.I) or re.search(r'filename\s*=\s*"?([^";]+)', cd, re.I)
    if m:
        raw = m.group(1).strip()
        name = urllib.parse.unquote(raw)
        if "%" not in raw:
            for codec in ("utf-8", "cp949"):
                try:
                    name = raw.encode("latin-1").decode(codec)
                    break
                except Exception:
                    continue
        return name[:120]
    return urllib.parse.unquote(urllib.parse.urlsplit(url).path.rsplit("/", 1)[-1])[:120] or None


def request(url, page, extra=None):
    headers = {"User-Agent": crawl.UA, "Accept": "*/*", "Referer": page or url, **(extra or {})}
    return crawl._opener.open(urllib.request.Request(url, headers=headers), timeout=25)


def zip_names(data):
    """File names in a ZIP's central directory, given the archive's tail bytes (or the whole archive)."""
    end = data.rfind(b"PK\x05\x06")
    if end < 0 or end + 22 > len(data):
        return None
    cd_size, cd_offset = struct.unpack("<II", data[end + 12:end + 20])
    start = end - cd_size
    if start < 0:
        return None
    names, i = [], start
    while i + 46 <= end and data[i:i + 4] == b"PK\x01\x02":
        flags = struct.unpack("<H", data[i + 8:i + 10])[0]
        n, x, c = struct.unpack("<HHH", data[i + 28:i + 34])
        raw = data[i + 46:i + 46 + n]
        try:
            names.append(raw.decode("utf-8") if flags & 0x800 else raw.decode("cp949"))
        except Exception:
            names.append(raw.decode("latin-1"))
        i += 46 + n + x + c
    return names


def inner_formats(url, page, size):
    try:
        with request(url, page, {"Range": "bytes=-131072"}) as response:
            if response.status == 206:
                data = response.read(131072 + 1)
            elif size and size <= 12 * 1024 * 1024:
                data = response.read(12 * 1024 * 1024 + 1)
            else:
                return None
        names = zip_names(data)
    except Exception:
        return None
    if names is None:
        return None
    found = {EXT.get(n.rsplit(".", 1)[-1].lower()) for n in names if "." in n and not n.startswith("__MACOSX") and "/." not in n and not n.rsplit("/", 1)[-1].startswith(".")}
    found.discard(None)
    return sorted(found, key=ORDER.index)  # [] = archive read, but no logo files inside


def check(url, page, label):
    try:
        with request(url, page) as response:
            head = response.read(1024)
            fmt = sniff(head, ext_of(url))
            if not fmt:
                return None
            size = response.headers.get("content-length")
            size = int(size) if size and size.isdigit() else None
            final, name = response.geturl(), unmangle(filename(response.headers, response.geturl()))
            if fmt in ("PDF", "EPS") and (name or "").lower().endswith(".ai"):
                fmt = "AI"
    except Exception:
        return None
    hay = f"{label} {name} {urllib.parse.unquote(url)}"
    if NOT_LOGO.search(hay) or (fmt in ("PDF", "PNG", "JPG", "SVG") and not CI_HINT.search(hay)):
        return None  # single images and PDFs are listed only when they are clearly the logo or the CI guide
    row = {"format": fmt, "url": url, "final_url": final, "bytes": size, "filename": name, "label": clean_label(label, name)}
    if fmt == "ZIP":
        inner = inner_formats(url, page, size)
        if inner == []:
            return None  # e.g. a font or document archive
        if inner:
            row["inner"] = inner
        else:
            named = {EXT.get(m) for m in re.findall(r"(?<![a-z])(ai|eps|svg|pdf|png|jpe?g)(?![a-z])", (name or "").lower())} - {None}
            if len(named) == 1:
                row["inner"] = sorted(named)
    return row


def trusted_row(url, label):
    """A file published on an official brand page whose server refuses automated requests (bot protection)."""
    name = urllib.parse.unquote(urllib.parse.urlsplit(url).path.rsplit("/", 1)[-1])
    fmt = ext_of(url)
    return {"format": fmt, "url": url, "final_url": url, "bytes": None, "filename": name, "label": label, "trusted": True} if fmt else None


def clean_label(label, name):
    text = re.sub(r"클릭\s*시.*$", " ", label or "")
    text = re.sub(r"\s*(을|를)?\s*압축\s*(받습니다|받기|다운로드)?|(로\s*)?(다운로드|다운|download|내려받기|받기)|파일|새\s*창|열림|\(?(AI|EPS|PNG|JPE?G|ZIP|PDF|SVG)\)?|\(\s*\)", " ", text, flags=re.I)
    text = re.sub(r"\(?\s*[\d.,]+\s*(?:[KMG]i?)?B\b\s*\)?|\bOpen\b|열기", " ", text, flags=re.I)
    text = re.sub(r"[\s·,/|]+", " ", text).strip(" -_.:")
    words = text.split(" ")
    half = len(words) // 2
    if half and words[:half] == words[half:2 * half]:  # "서구 구조 서구 구조" (text + title repeated)
        text = " ".join(words[:half])
    if len(text) > 30:
        text = text[:30].rsplit(" ", 1)[0] + "…"
    return text if len(text) >= 2 and not re.fullmatch(r"[\W\d_]+", text) else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--no-render", action="store_true")
    parser.add_argument("--reuse", action="store_true", help="skip discovery and reuse data/download-candidates.json")
    parser.add_argument("--only", help="comma-separated record ids, or @file with a JSON list; other records keep their results")
    args = parser.parse_args()
    orgs = json.loads((crawl.DATA / "orgs.json").read_text())["orgs"]
    results = json.loads((crawl.DATA / "crawl.json").read_text())["results"]
    records = json.loads((APP / "catalog.json").read_text())["records"]
    ids = {r["id"] for r in records}
    jobs = []
    for org in orgs:
        rid = "kr-" + (org["wikidata"].lower() if org.get("wikidata") else "w" + hashlib.sha1(org["wiki_title"].encode()).hexdigest()[:10])
        res = results.get(crawl.org_key(org)) or {}
        known = (res.get("formats") or {}).get("files", [])
        pages = [p for p in dict.fromkeys([res.get("ci_page"), (res.get("formats") or {}).get("page"), *res.get("ci_pages_extra", [])]) if p]
        if rid in ids and (pages or known):
            jobs.append((rid, pages, known))
    for record in records:
        if not record["id"].startswith("kr-"):
            pages = [p for p in dict.fromkeys([record.get("guideline_url"), record.get("source_url")]) if p]
            known = [[a["listed_formats"][0] if a["listed_formats"] else "", a["download_url"]] for a in record["assets"] if a.get("download_url")]
            jobs.append((record["id"], pages, known))
    manual_file = crawl.DATA / "download-manual.json"
    manual = json.loads(manual_file.read_text())["files"] if manual_file.exists() else {}
    jobs = [(rid, pages, known + manual.get(rid, [])) for rid, pages, known in jobs]
    only = None
    if args.only:
        only = set(json.loads(Path(args.only[1:]).read_text()) if args.only.startswith("@") else args.only.split(","))
        jobs = [job for job in jobs if job[0] in only]
    cached = json.loads(CACHE.read_text())["candidates"] if CACHE.exists() else {}
    if args.reuse and cached:
        found = cached
        for rid, rows in manual.items():
            for url, page, label, *extra in rows:
                found.setdefault(rid, {})[url] = {"label": label, "page": page, **(extra[0] if extra else {})}
    else:
        with ThreadPoolExecutor(args.workers) as pool:
            found = dict(pool.map(lambda job: discover(job, not args.no_render), jobs))
        if only is not None:
            found = {**cached, **found}
        CACHE.write_text(json.dumps({"checked_at": crawl.TODAY, "candidates": found}, ensure_ascii=False, indent=1) + "\n")
    if only is not None:
        found = {rid: rows for rid, rows in found.items() if rid in only}
    flat = [(rid, url, meta["page"], meta["label"], meta.get("trusted", False)) for rid, rows in found.items() for url, meta in rows.items()]
    print(f"pages {len(jobs)} · candidates {len(flat)} in {sum(1 for v in found.values() if v)} records")
    with ThreadPoolExecutor(max(args.workers, 8)) as pool:
        checked = list(pool.map(lambda job: check(job[1], job[2], job[3]) or (trusted_row(job[1], job[3]) if job[4] else None), flat))
    out, seen = {}, set()
    for (rid, url, page, label, _), hit in zip(flat, checked):
        if not hit:
            continue
        key = (rid, hit["filename"], hit["bytes"]) if hit["filename"] else (rid, hit["final_url"])
        if key in seen or (rid, hit["final_url"]) in seen:
            continue
        seen.update({key, (rid, hit.pop("final_url"))})
        out.setdefault(rid, []).append({k: v for k, v in hit.items() if v is not None})
    for rid, rows in out.items():  # logo files first, the guide PDF last; at most 12 per organisation
        rows.sort(key=lambda r: (r["format"] == "PDF", ORDER.index((r.get("inner") or [r["format"]])[0])))
        out[rid] = rows[:12]
    if only is not None:  # keep every other record's verified files
        previous = json.loads((APP / "downloads.json").read_text())["downloads"]
        out = {**{rid: rows for rid, rows in previous.items() if rid not in only}, **out}
    data = {"note": "공식 CI 페이지에서 공개된 로고 파일 중 로그인·신청 없이 바로 내려받아지는 것(파일 서명으로 확인, ZIP은 내부 형식까지). tools/logo-survey/check_downloads.py가 생성.",
            "checked_at": time.strftime("%Y-%m-%d"), "downloads": dict(sorted(out.items()))}
    (APP / "downloads.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    formats = {}
    for rows in out.values():
        for row in rows:
            for f in row.get("inner") or [row["format"]]:
                formats[f] = formats.get(f, 0) + 1
    print(f"direct downloads {sum(len(v) for v in out.values())} in {len(out)} records · formats {formats}")


if __name__ == "__main__":
    main()
