"""원 배포처의 형식별 파일 링크 수집 → html/data/dl_files.json (다운로드 버튼의 '형식 골라 받기' 메뉴용).

- 원칙: 파일은 원 배포처 링크로만(AGENTS.md 2-2). 이 도구는 배포처가 공개한 직링크 주소만 모으고 파일을 저장하지 않는다.
- 수집 경로
  · 온글잎(ownglyph.com/trial/...): 페이지에 실린 공식 TTF·WOFF2 주소
  · GitHub 저장소: 최신 릴리스의 폰트 첨부 파일(gh api)
  · 그 밖의 배포처 페이지: 페이지 안의 .ttf/.otf/.woff2/.woff/.zip 링크(href·data-url 등). 여러 폰트가 한 페이지를 쓰면
    파일 이름에 그 폰트 이름이 들어간 링크만.
  · tools/state/dl_files_manual.json(손으로 관리): 페이지 구조상 자동으로 못 찾는 직링크 추가·잘못 잡힌 링크 제외
- 건너뜀: 공유마당·KERIS(이용 동의 절차 — AGENTS.md 6), 산돌구름·눈누·폰코(수집 금지), 서버 전용 폰트 배포처.
- 모든 링크는 실제로 응답하는지(앞 1바이트 요청) 확인한 것만 남긴다. User-Agent는 도구 이름 그대로(위장 금지).
사용: python3 -I tools/collect_dl_files.py [--ids id1,id2] [--only ownglyph|github|pages]
"""
import json, re, subprocess, sys, time, html as H
import urllib.request, urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "html/data/dl_files.json"
MANUAL = ROOT / "tools/state/dl_files_manual.json"
UA = {"User-Agent": "letsum-dl-check/1.0 (+https://letsum.app)"}
SKIP = re.compile(r"gongu\.copyright\.or\.kr|copyright\.keris\.or\.kr|sandollcloud|noonnu|font\.co\.kr|fonco|letsum\.app|fonts\.google\.com")
EXT = re.compile(r"\.(ttf|otf|woff2|woff|zip|ttc)(?:[?#][^\"'\s<>]*)?$", re.I)


def load_fonts():
    js = "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.o=FONTS',c);process.stdout.write(JSON.stringify(c.o))"
    return json.loads(subprocess.run(["node", "-e", js, str(ROOT / "html/js/data.js")], capture_output=True, text=True, check=True).stdout)


def get(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(3_000_000).decode("utf-8", "replace"), r.geturl()


def alive(url):
    try:
        req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-0"})
        with urllib.request.urlopen(req, timeout=25) as r:
            ct = (r.headers.get("Content-Type") or "").lower()
            return r.status in (200, 206) and "text/html" not in ct
    except Exception:
        return False


def nk(s):
    return re.sub(r"[^0-9a-z가-힣]", "", urllib.parse.unquote(str(s or "")).lower())


WEIGHTS = ["thin", "extralight", "ultralight", "light", "regular", "book", "medium", "semibold", "demibold", "bold", "extrabold", "ultrabold", "heavy", "black"]


def label(url):
    """형식 이름(TTF·OTF·WOFF2·ZIP 묶음)과 굵기 등 구분 말."""
    name = urllib.parse.unquote(urllib.parse.urlparse(url).path.rsplit("/", 1)[-1])
    ext = name.rsplit(".", 1)[-1].lower()
    low = name.lower()
    if ext == "zip":
        has = [k for k in ("ttf", "otf", "woff") if k in low]
        if "mac" in low: fmt = "맥용 ZIP"
        elif "win" in low: fmt = "윈도용 ZIP"
        elif "woff" in has: fmt = "웹폰트 묶음(ZIP)"
        elif has == ["ttf"]: fmt = "TTF 묶음(ZIP)"
        elif has == ["otf"]: fmt = "OTF 묶음(ZIP)"
        elif has == ["woff"] or "web" in low: fmt = "웹폰트 묶음(ZIP)"
        elif "ttf" in has and "otf" in has: fmt = "TTF·OTF 묶음(ZIP)"
        else: fmt = "전체 묶음(ZIP)"
    else:
        fmt = {"ttf": "TTF", "otf": "OTF", "ttc": "TTC", "woff2": "WOFF2(웹용)", "woff": "WOFF(웹용)"}[ext]
    stem = re.sub(r"\.[a-z0-9]+$", "", low)
    w = next((x for x in sorted(WEIGHTS, key=len, reverse=True) if re.search(r"(?<![a-z])" + x + r"(?![a-z])|[-_ ]" + x + "$", stem.replace(" ", "-"))), "")
    return fmt, w.capitalize() if w else "", name


def from_ownglyph(f):
    page, _ = get(f["dl"]["page"])
    urls = []
    for key in ("fontUrl", "woff2Url"):
        m = re.search(r'"%s":"(https://[^"]+)"' % key, page)
        if m: urls.append(m.group(1))
    return urls


def from_github(f):
    m = re.match(r"https://github\.com/([^/]+)/([^/#?]+)", f["dl"]["page"])
    if not m: return []
    try:
        out = subprocess.run(["gh", "api", f"repos/{m.group(1)}/{m.group(2)}/releases/latest"], capture_output=True, text=True, timeout=40)
        rel = json.loads(out.stdout) if out.returncode == 0 else {}
    except Exception:
        rel = {}
    return [a["browser_download_url"] for a in rel.get("assets", []) if EXT.search(a["name"])]


def from_page(f):
    page, final = get(f["dl"]["page"])
    found = []
    for m in re.finditer(r'(?:href|data-url|data-href|data-file|data-download)\s*=\s*["\']([^"\']+)["\']', page, re.I):
        u = urllib.parse.urljoin(final, H.unescape(m.group(1)).strip())
        if u.startswith("http") and EXT.search(urllib.parse.urlparse(u).path) and u not in found:
            found.append(u)
    return found


def raw_links(f):
    page = (f.get("dl") or {}).get("page") or ""
    if not page or SKIP.search(page) or f.get("intro") and not f.get("webfont"):
        return []
    try:
        if "ownglyph.com" in page: urls = from_ownglyph(f)
        elif "github.com" in page: urls = from_github(f)
        else: urls = from_page(f)
    except Exception as e:
        print(f"  ! {f['id']}: {type(e).__name__}", file=sys.stderr); urls = []
    if f["dl"].get("zip") and f["dl"]["zip"] not in urls:
        urls.insert(0, f["dl"]["zip"])
    return urls


def group_key(f):
    """같은 파일 목록을 보는 폰트끼리 묶는 기준: GitHub는 저장소, 그 밖에는 배포처 페이지 주소."""
    p = (f.get("dl") or {}).get("page") or ""
    m = re.match(r"https://github\.com/([^/]+/[^/#?]+)", p)
    return ("gh:" + m.group(1).lower()) if m else p


def match_score(f, url):
    """파일 이름이 이 폰트를 가리키는 정도(맞춘 이름 길이). 0이면 안 가리킴."""
    fn = nk(urllib.parse.urlparse(url).path.rsplit("/", 1)[-1])
    keys = {nk(f["en"]), nk(f["id"].removeprefix("k-")), nk(f["name"])} - {""}
    best = max([len(k) for k in keys if len(k) >= 4 and k in fn] or [0])
    toks = [nk(t) for t in re.split(r"[\s\-_]+", f["en"]) if len(nk(t)) >= 2]
    if len(toks) >= 2 and all(t in fn for t in toks):
        best = max(best, sum(map(len, toks)))
    return best


# 폰트가 아닌 배포 자료(로고·심벌 이미지, AI·PDF 매뉴얼, 서식, 자동 설치 프로그램 묶음)
NONFONT = re.compile(r"(^|[_\-])(jpe?g|png|ai|eps|pdf|psd|svg)([_\-.0-9]|$)|logo(?!s)|emblem|symbol|signature|slogan|_qr|qr_|guideline|manual|template|character|automatic_installation", re.I)
ALL_FONTS = []


def owned_elsewhere(f, url):
    """다른 폰트 이름이 이 파일 이름에 더 잘 맞으면 True(그 폰트의 파일)."""
    mine = match_score(f, url)
    return any(match_score(g, url) > mine for g in ALL_FONTS if g["id"] != f["id"])


def assign(group, links):
    """한 페이지·저장소의 링크를 폰트별로 나눈다. 이름이 맞는 폰트가 있으면 가장 잘 맞는 폰트에게만,
    아무 폰트도 안 맞으면(패밀리 공통 묶음) 모두에게 — 단 여러 폰트가 섞인 모노레포(/tree/ 주소)면 버린다."""
    out = {f["id"]: [] for f in group}
    mono = any("/tree/" in ((f.get("dl") or {}).get("page") or "") for f in group)
    zip_owner = {}
    for f in group:
        z = (f.get("dl") or {}).get("zip")
        if z: zip_owner.setdefault(z, []).append(f["id"])
    for u in links:
        if u in zip_owner:   # 어떤 폰트의 dl.zip(사람이 확인한 직링크)이면 그 폰트 것
            for fid in zip_owner[u]: out[fid].append(u)
            continue
        sc = {f["id"]: match_score(f, u) for f in group}
        top = max(sc.values())
        if top:
            for fid, v in sc.items():
                if v == top: out[fid].append(u)
        elif not mono:
            for fid in out: out[fid].append(u)
    # 폰트가 아닌 자료·사이트 자체 웹폰트(이름이 안 맞는 woff/woff2)·다른 폰트의 파일은 뺀다
    for f in group:
        web = "ownglyph.com" not in ((f.get("dl") or {}).get("page") or "")
        out[f["id"]] = [u for u in out[f["id"]] if not NONFONT.search(urllib.parse.unquote(urllib.parse.urlparse(u).path.rsplit("/", 1)[-1]))
                        and not (web and re.search(r"\.woff2?$", urllib.parse.urlparse(u).path, re.I) and not match_score(f, u))
                        and (u == (f.get("dl") or {}).get("zip") or not owned_elsewhere(f, u))]
    # 한 폰트 페이지라도 링크가 많으면(다른 크기·다른 언어판이 섞임) 이름이 맞는 것만
    for f in group:
        lst = out[f["id"]]
        if len(lst) > 8 and any(match_score(f, u) for u in lst):
            out[f["id"]] = [u for u in lst if match_score(f, u)]
    return out


def main():
    fonts = load_fonts()
    ALL_FONTS[:] = [f for f in fonts if not f.get("intro")]
    ids = None
    if "--ids" in sys.argv: ids = set(sys.argv[sys.argv.index("--ids") + 1].split(","))
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    manual = json.loads(MANUAL.read_text()) if MANUAL.exists() else {}
    old = json.loads(OUT.read_text()) if OUT.exists() else {}
    pages = {}
    for f in fonts:
        p = (f.get("dl") or {}).get("page")
        if p: pages[p] = pages.get(p, 0) + 1
    todo = []
    for f in fonts:
        if ids and f["id"] not in ids: continue
        p = (f.get("dl") or {}).get("page") or ""
        kind = "ownglyph" if "ownglyph.com" in p else "github" if "github.com" in p else "pages"
        if only and kind != only: continue
        todo.append(f)
    print(f"대상 {len(todo)}종")

    groups = {}
    for f in fonts:
        groups.setdefault(group_key(f), []).append(f)
    gtodo = {}
    for f in todo:
        gtodo.setdefault(group_key(f), groups[group_key(f)])

    def work(item):
        key, group = item
        if key.startswith("https://www.ownglyph.com"): time.sleep(0.3)
        if len(group) == 1 or key.startswith("gh:"):
            links = []
            for f in group:   # 저장소는 같아도 폰트마다 dl.zip이 다를 수 있다
                for u in raw_links(f):
                    if u not in links: links.append(u)
        else:
            links = raw_links(group[0])
            for f in group[1:]:
                z = (f.get("dl") or {}).get("zip")
                if z and z not in links: links.append(z)
        per = assign(group, links)
        res_all = []
        for f in group:
            m = manual.get(f["id"], {})
            ex = [re.compile(r) for r in m.get("exclude_re", [])]
            keep = [re.compile(r) for r in m.get("keep_re", [])]
            urls = [u for u in per[f["id"]] if u not in m.get("exclude", []) and not any(r.search(u) for r in ex) and (not keep or any(r.search(u) for r in keep))]
            urls += [x["url"] for x in m.get("add", []) if x["url"] not in urls]
            res, seen = [], set()
            for u in urls:
                over = next((x for x in m.get("add", []) if x["url"] == u), {})
                fmt, w, name = (over["fmt"], over.get("w", ""), over.get("file", "")) if "fmt" in over else label(u)
                if u in seen or name in seen: continue
                if alive(u):
                    seen.update({u, name}); res.append({"fmt": fmt, "w": w, "url": u, "file": name})
            res_all.append((f["id"], res))
        return res_all

    with ThreadPoolExecutor(6) as ex:
        results = [r for rs in ex.map(work, gtodo.items()) for r in rs]
    todo = [f for g in gtodo.values() for f in g]
    done = {f["id"] for f in todo}
    data = {k: v for k, v in old.items() if k not in done}
    for fid, res in results:
        if res: data[fid] = res
        else: data.pop(fid, None)
    data = dict(sorted(data.items()))
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    multi = sum(1 for v in data.values() if len(v) >= 2)
    print(f"직링크 있는 폰트 {len(data)}종 · 형식 2개 이상 {multi}종 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
