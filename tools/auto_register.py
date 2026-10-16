#!/usr/bin/env python3
"""OFL 한글 폰트 자동 등록 — GitHub에서 찾아, 조건을 모두 만족하는 폰트만 사이트에 바로 올린다 (AI 없음, 비용 0원).

자동 등록 조건(하나라도 어긋나면 건너뛰고 report.md에 사유를 남김)
  1. GitHub 저장소 라이선스가 OFL-1.1이고, LICENSE 본문에 'SIL Open Font License'가 실제로 있다
  2. 포크·보관(archived) 저장소가 아니고, 알려진 남의 폰트 모음(사본) 계정이 아니다
  3. 저장소 안의 폰트 파일을 jsDelivr로 버전 고정해 쓸 수 있다(공식 파일을 그대로 씀 — 변환·미러 없음)
  4. 한글 완성형을 2,350자 이상 실제로 그린다(빈 글자 제외)
  5. 이미 등록된 폰트와 이름이 겹치지 않는다
기업·지자체 자체 라이선스는 대상이 아니다 — 원문 해석이 필요하므로 watch_sources.py가 이슈로만 알린다.

한 번에 최대 MAX_PER_RUN 가족. 결과: data.js·cdn_fonts.json·license_manual.json·coverage.json·evidence.json·
tools/archive/cdn/<id>/ 캐시·tools/state/auto_register.json(본 저장소 기록)·report.md(이번 결과).
사용: python tools/auto_register.py [--dry]   (환경변수 GITHUB_TOKEN이 있으면 API 한도가 넉넉해짐)
필요: fontTools + brotli
"""
import base64, io, json, os, re, subprocess, sys, time, urllib.parse, urllib.request
from datetime import date
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
STATE = os.path.join(HERE, "state"); DATA = os.path.join(ROOT, "html", "js", "data.js")
TODAY = date.today().isoformat(); DRY = "--dry" in sys.argv
MAX_PER_RUN = 5; MIN_STARS = 15; MIN_HANGUL = 2350
UA = "LETSUM-auto-register/1.0 (+https://letsum.app)"
# 남이 만든 폰트를 모아 올린 사본 계정 — 공식 배포처가 아니므로 제외
COPY_OWNERS = {"fonts-archive", "wefonts", "projectnoonnu", "noonnu", "sandoll", "fontsource", "google", "googlefonts"}
QUERIES = ["한글 폰트 license:ofl-1.1", "한글 글꼴 license:ofl-1.1", "korean font license:ofl-1.1", "hangul font license:ofl-1.1",
           "topic:korean-font", "topic:hangul-font", "topic:korean-fonts"]
SKIP_PATH = re.compile(r"(subset|dynamic|unicode-range|/test|/tests/|/docs?/|demo|example|sample|node_modules|/old/|/legacy/|italic|oblique|variable|\[)", re.I)


def http(url, accept=None, limit=40_000_000):
    h = {"User-Agent": UA}
    if accept: h["Accept"] = accept
    if "api.github.com" in url and os.environ.get("GITHUB_TOKEN"): h["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r: return r.read(limit)


def gh(path):
    return json.loads(http("https://api.github.com/" + path.lstrip("/"), "application/vnd.github+json").decode("utf-8"))


def load_fonts():
    js = "const fs=require('fs');const F=new Function(fs.readFileSync(process.argv[1],'utf8')+';return FONTS')();console.log(JSON.stringify(F))"
    return json.loads(subprocess.run(["node", "-e", js, DATA], capture_output=True, text=True, check=True).stdout)


norm = lambda s: re.sub(r"[^0-9a-z가-힣]", "", (s or "").lower())


def name_of(t, nid, lang):
    for r in t["name"].names:
        if r.nameID == nid and r.platformID == 3 and r.langID == lang:
            try: return r.toUnicode().strip()
            except Exception: pass
    return None


def real_hangul(t):
    """cmap에 있으면서 윤곽선이 실제로 있는 한글 완성형 수."""
    cmap = t.getBestCmap() or {}; ks = [k for k in cmap if 0xAC00 <= k <= 0xD7A3]
    if "glyf" in t:
        g = t["glyf"]; return [k for k in ks if g[cmap[k]].numberOfContours != 0]
    from fontTools.pens.boundsPen import ControlBoundsPen
    gs = t.getGlyphSet(); out = []
    for k in ks:
        p = ControlBoundsPen(gs); gs[cmap[k]].draw(p)
        if p.bounds: out.append(k)
    return out


def coverage_rec(t, have):
    cmap = t.getBestCmap() or {}
    hj = sum(1 for k in cmap if 0x4E00 <= k <= 0x9FFF); od = sum(1 for k in cmap if 0x1100 <= k <= 0x11FF or 0xA960 <= k <= 0xA97F or 0xD7B0 <= k <= 0xD7FF)
    rec = {"n": len(have), "hanja": hj >= 50, "old": od >= 50, "jamo": all(k in cmap for k in range(0x3131, 0x3164))}
    if len(have) < 11172:
        bits = bytearray(1397)
        for k in have: i = k - 0xAC00; bits[i >> 3] |= 1 << (i & 7)
        rec["h"] = base64.b64encode(bytes(bits)).decode()
    return rec


def category_of(text):
    t = text.lower()
    if re.search(r"손글씨|필기|손편지|hand|script|pen\b|brush|붓|캘리", t): return "손글씨"
    if re.search(r"명조|바탕|myeongjo|batang|mincho|(?<!sans[- ])serif", t): return "명조"
    if re.search(r"픽셀|pixel|bitmap|\bdot\b|도트|레트로|retro|display|디스플레이|\d+px", t): return "디스플레이"
    return "고딕"


PRESET = {  # 분류별 기본 태그·분위기·영문 짝 (사람이 나중에 다듬을 수 있음)
    "고딕": (["본문", "UI", "제목"], ["단정한"], "inter", "고딕"),
    "명조": (["본문", "책", "제목"], ["차분한"], "playfair", "명조"),
    "손글씨": (["손글씨", "메모", "SNS"], ["따뜻한"], "inter", "손글씨"),
    "디스플레이": (["제목", "포스터", "SNS"], ["발랄한"], "grotesk", "제목용 폰트"),
}


def candidates(state):
    seen = {}
    repos = []
    try:
        sys.path.insert(0, HERE); from watch_sources import WATCH_REPOS
        for w in WATCH_REPOS:
            try: repos.append(gh(f"repos/{w['repo']}"))
            except Exception: pass
    except Exception: pass
    for q in QUERIES:
        try: repos += gh("search/repositories?" + urllib.parse.urlencode({"q": q, "sort": "stars", "per_page": 50})).get("items", [])
        except Exception as e: print("검색 실패:", q, str(e)[:80])
        time.sleep(2)
    for r in repos:
        if r["full_name"] in seen: continue
        seen[r["full_name"]] = r
    out = []
    for name, r in seen.items():
        prev = state.get(name)
        if prev and (prev.get("result") == "added" or prev.get("pushed") == r.get("pushed_at")): continue  # 바뀐 게 없으면 다시 보지 않음
        out.append(r)
    return out


def check_repo(r, existing):
    """조건 확인 → (가족별 정보 목록, 건너뛴 사유)."""
    full = r["full_name"]; owner = r["owner"]["login"]
    if r.get("fork") or r.get("archived"): return None, "포크·보관 저장소"
    if owner.lower() in COPY_OWNERS: return None, "사본 계정"
    if (r.get("license") or {}).get("spdx_id") != "OFL-1.1": return None, f"라이선스 {(r.get('license') or {}).get('spdx_id')}"
    if r.get("stargazers_count", 0) < MIN_STARS: return None, f"별 {r.get('stargazers_count', 0)}개(기준 {MIN_STARS})"
    try:
        lic = base64.b64decode(gh(f"repos/{full}/license")["content"]).decode("utf-8", "ignore")
        if "open font license" not in lic.lower(): return None, "LICENSE 본문에 OFL 문구 없음"
    except Exception: return None, "LICENSE 파일 확인 실패"
    # 버전 고정: 최신 릴리스 태그, 없으면 기본 브랜치의 최신 커밋
    rel = None
    try: rel = gh(f"repos/{full}/releases/latest"); ref = rel["tag_name"]
    except Exception: ref = gh(f"repos/{full}/commits/{r['default_branch']}")["sha"]
    try:
        lst = json.loads(http(f"https://data.jsdelivr.com/v1/packages/gh/{full}@{ref}?structure=flat").decode("utf-8"))
    except Exception as e: return None, f"jsDelivr 목록 실패({str(e)[:40]})"
    files = [f["name"] for f in lst.get("files", [])]
    if not files: return None, lst.get("message", "jsDelivr에 파일 없음")[:60]
    fonts = [p for p in files if re.search(r"\.(woff2|woff|otf|ttf)$", p, re.I) and not SKIP_PATH.search(p)]
    if not fonts: return None, "고정 굵기 폰트 파일 없음"
    for ext in ("woff2", "woff", "otf", "ttf"):
        pick = [p for p in fonts if p.lower().endswith("." + ext)]
        if pick: break
    pick = pick[:30]; base = f"https://cdn.jsdelivr.net/gh/{full}@{ref}"
    fams = {}
    for p in pick:
        url = base + urllib.parse.quote(p)
        try: data = http(url); t = TTFont(io.BytesIO(data), lazy=False)
        except Exception: continue
        if t["OS/2"].fsSelection & 1: continue  # 기울임꼴 제외
        en = name_of(t, 16, 0x409) or name_of(t, 1, 0x409)
        if not en: continue
        ko = name_of(t, 16, 0x412) or name_of(t, 1, 0x412)
        w = min(900, max(100, int(round(t["OS/2"].usWeightClass / 100.0)) * 100))
        fam = fams.setdefault(en, {"en": en, "ko": ko, "files": {}, "t": None, "data": {}, "designer": name_of(t, 9, 0x409) or name_of(t, 8, 0x409),
                                   "ver": (name_of(t, 5, 0x409) or "").strip()})
        if str(w) in fam["files"]: continue
        fam["files"][str(w)] = url; fam["data"][str(w)] = (data, ext)
        if fam["t"] is None or w == 400: fam["t"] = t
    out = []
    for en, fam in fams.items():
        if norm(en) in existing or norm(fam["ko"]) in existing: continue
        have = real_hangul(fam["t"])
        if len(have) < MIN_HANGUL: continue
        fam["have"] = have
        out.append(fam)
    if not out: return None, "한글 2,350자 미만이거나 이미 등록된 이름"
    return {"repo": r, "ref": ref, "rel": rel, "fams": out}, None


def entry(info, fam, fid):
    r = info["repo"]; full = r["full_name"]
    text = " ".join(filter(None, [fam["en"], fam["ko"], r.get("description"), " ".join(r.get("topics") or [])]))
    cat = category_of(text); tags, mood, pair, catword = PRESET[cat]
    if re.search(r"픽셀|pixel|bitmap|도트|\bpx\b|\d+px", text, re.I): tags = ["픽셀", "레트로", "제목", "게임"]
    if re.search(r"mono|code|coding|고정폭", text, re.I): tags = tags[:2] + ["고정폭", "코딩"]; pair = "plexmono"
    ws = sorted(int(w) for w in fam["files"]); n = len(fam["have"])
    first = None
    try:
        rels = gh(f"repos/{full}/releases?per_page=100")
        if rels: first = min(x["published_at"] for x in rels if x.get("published_at"))[:10]
    except Exception: pass
    rel_date, rel_src, rel_url = (first, "공식 GitHub 첫 릴리스", f"https://github.com/{full}/releases") if first else (r["created_at"][:10], "공식 GitHub 저장소 생성일", r["html_url"])
    zips = [a for a in ((info["rel"] or {}).get("assets") or []) if a["name"].lower().endswith(".zip")]
    zips.sort(key=lambda a: (bool(re.search(r"nerd|subset|web|variable", a["name"], re.I)), len(a["name"])))  # 기본 묶음 우선
    zipu = zips[0]["browser_download_url"] if zips else f"https://github.com/{full}/archive/{info['ref']}.zip"
    page = r.get("homepage") if (r.get("homepage") or "").startswith("https://") else r["html_url"]
    name = fam["ko"] or fam["en"]
    q = lambda l: "[" + ", ".join(json.dumps(x, ensure_ascii=False) for x in l) + "]"
    wf = "{ " + ", ".join(f'{w}: "{fam["files"][str(w)]}"' for w in ws) + " }"
    fmts = sorted({e.upper() for _, e in fam["data"].values()})
    desc = f"GitHub 저장소({full})로 공개된 오픈 폰트 라이선스(OFL) {catword}. 굵기 {len(ws)}종, 한글 {n:,}자를 지원합니다."
    esc = lambda s: (s or "").replace("\\", "\\\\").replace('"', '\\"')
    return f'''  {{ id: "{fid}", name: "{esc(name)}", en: "{esc(fam['en'])}", family: "'LS {fid}', sans-serif",
    designer: "{esc(fam['designer'] or r['owner']['login'])}", holder: "{esc(r['owner']['login'])}", category: "{cat}",
    tags: {q(tags)}, mood: {q(mood)}, weights: [{", ".join(map(str, ws))}], formats: {q(fmts)},
    cov: {n}, glyphs: "한글 {n:,}자", old: false, hanja: false,
    webfont: {wf}, webfontSrc: "배포처 공식 저장소 파일(jsDelivr 버전 고정, 자동 등록)",
    dl: {{ page: "{page}", zip: "{zipu}", srcName: "{esc(fam['en'])} 공식(GitHub)" }},
    license: "OFL", matrix: OFL_ALL_OK, verified: "{TODAY}", status: "verified", autoReg: true,
    released: "{rel_date}", releasedSrc: "{rel_src}", releasedUrl: "{rel_url}",
    pair: "{pair}", pop: 30, added: "{TODAY}",
    desc: "{esc(desc)}" }},'''


def main():
    statep = os.path.join(STATE, "auto_register.json")
    state = json.load(open(statep, encoding="utf-8")) if os.path.exists(statep) else {}
    if os.path.exists(os.path.join(STATE, "LOCK")): print("잠금 중 — 자동 등록 건너뜀"); return
    fonts = load_fonts()
    names = json.load(open(os.path.join(ROOT, "html", "data", "names.json"), encoding="utf-8"))
    existing = {norm(f["en"]) for f in fonts} | {norm(f["name"]) for f in fonts} | {norm(v.get("famEn")) for v in names.values()} | {norm(v.get("fam")) for v in names.values()}
    ids = {f["id"] for f in fonts}
    added, skipped = [], []
    for r in candidates(state):
        if len(added) >= MAX_PER_RUN: break
        try: info, why = check_repo(r, existing)
        except Exception as e: info, why = None, f"확인 중 오류({str(e)[:60]})"
        state[r["full_name"]] = {"result": "skip" if why else "added", "why": why, "pushed": r.get("pushed_at"), "checked": TODAY}
        if why: skipped.append((r["full_name"], why)); continue
        for fam in info["fams"]:
            if len(added) >= MAX_PER_RUN: break
            fid = "k-" + (re.sub(r"[^a-z0-9]+", "-", fam["en"].lower()).strip("-") or "font")
            while fid in ids: fid += "-2"
            ids.add(fid); existing.add(norm(fam["en"]))
            added.append((info, fam, fid, entry(info, fam, fid)))
    report = [f"\n## 🤖 OFL 자동 등록 ({TODAY})", f"등록 {len(added)}종 · 건너뜀 {len(skipped)}개 저장소"]
    for info, fam, fid, _ in added:
        report.append(f"- ✅ {fam['ko'] or fam['en']} (`{fid}`) — https://github.com/{info['repo']['full_name']} @ {info['ref']} · 굵기 {len(fam['files'])} · 한글 {len(fam['have']):,}자")
    for full, why in skipped[:40]: report.append(f"- ⏭ {full}: {why}")
    print("\n".join(report))
    if DRY or not added:
        if not DRY: json.dump(state, open(statep, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        return
    # data.js: FONTS 배열 끝에 추가
    src = open(DATA, encoding="utf-8").read(); a = src.index("const FONTS = ["); e = src.index("\n];", a)
    src = src[:e] + "\n" + "\n".join(x[3] for x in added) + src[e:]
    open(DATA, "w", encoding="utf-8").write(src)
    js = lambda n: os.path.join(STATE, n)
    cdn = json.load(open(js("cdn_fonts.json"), encoding="utf-8")); lm = json.load(open(js("license_manual.json"), encoding="utf-8"))
    covp = os.path.join(ROOT, "html", "data", "coverage.json"); cov = json.load(open(covp))
    evp = os.path.join(ROOT, "html", "data", "evidence.json"); ev = json.load(open(evp, encoding="utf-8"))
    for info, fam, fid, _ in added:
        full = info["repo"]["full_name"]
        cdn[fid] = {"page": info["repo"]["html_url"], "files": fam["files"], "auto": TODAY}
        lm[fid] = {"license": "OFL", "evidence": f"자동 확인: GitHub 저장소 라이선스 OFL-1.1 + LICENSE 본문 'SIL Open Font License' — 저장소 공식 파일을 jsDelivr로 버전({info['ref']}) 고정해 그대로 사용",
                   "page": info["repo"]["html_url"], "checked": TODAY, "auto": True}
        cov[fid] = coverage_rec(fam["t"], fam["have"])
        ev[fid] = {"ev": lm[fid]["evidence"], "pg": info["repo"]["html_url"], "src": f"https://github.com/{full} (@{info['ref']})", **({"ver": fam["ver"]} if fam["ver"] else {})}
        d = os.path.join(HERE, "archive", "cdn", fid); os.makedirs(d, exist_ok=True)
        for w, (data, ext) in fam["data"].items(): open(os.path.join(d, f"{w}.{ext}"), "wb").write(data)
    json.dump(cdn, open(js("cdn_fonts.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(lm, open(js("license_manual.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(cov, open(covp, "w"), separators=(",", ":"))
    json.dump(ev, open(evp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(state, open(statep, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(js("report.md"), "a", encoding="utf-8") as fh: fh.write("\n".join(report) + "\n")
    with open(js("auto_added.txt"), "w") as fh: fh.write("\n".join(x[2] for x in added) + "\n")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as fh: fh.write(f"added={len(added)}\n")


if __name__ == "__main__":
    main()
