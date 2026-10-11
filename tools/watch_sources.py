#!/usr/bin/env python3 -I
"""LETSUM 무료 폰트 수집기 — 여러 배포처(루트)를 돌며 카탈로그 자산을 누적한다. 비용 0원(API 키·AI 없음).

루트(소스)
  google     fonts.google.com/metadata/fonts            한글 subsets 패밀리 (키 불필요, 라이선스 구조화)
  fontsource api.fontsource.org/v1/fonts?subsets=korean  Google 미러 + npm 버전
  github     감시 목록 저장소의 최신 릴리스/커밋 + LICENSE(SPDX)
  kogl       tools/sources/*.csv — 공공데이터포털에서 내려받은 안심글꼴 목록(있을 때만)
  pages      구조화 API 없는 공공 목록 페이지 — 본문 해시로 변경 감지만

자산
  tools/state/catalog.json  폰트별 누적 레코드: 어느 루트에서 언제 처음·마지막으로 보였는지, 변경 이력,
                            자동 신뢰 가능한 라이선스(OFL/Apache/UFL/공공누리 유형), 검수 상태(사람이 적음, 자동은 덮어쓰지 않음)
  tools/state/sources.json  루트별 원본 스냅샷(이번 실행)
  tools/state/report.md     이번 실행의 변경 목록 (GitHub 이슈 본문)

원칙: 라이선스 안내문 해석과 사이트 공개는 자동화하지 않는다. 카탈로그의 review 필드는 사람이 바꾼다.
"""
import csv, glob, hashlib, json, os, re, sys, urllib.request
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_DIR = os.path.join(HERE, "state")
CATALOG = os.path.join(STATE_DIR, "catalog.json")
SNAPSHOT = os.path.join(STATE_DIR, "sources.json")
REPORT = os.path.join(STATE_DIR, "report.md")
SITE_DATA = os.path.join(HERE, "..", "html", "js", "data.js")
UA = {"User-Agent": "letsum-watch/1.1 (+https://letsum.app)"}
TODAY = date.today().isoformat()

# GitHub 루트 감시 목록 — 검수자가 추가. family는 카탈로그 병합 키
WATCH_REPOS = [
    {"repo": "orioncactus/pretendard", "family": "Pretendard"},
    {"repo": "sunn-us/SUIT", "family": "SUIT"},
    {"repo": "wanteddev/wanted-sans", "family": "Wanted Sans"},
    {"repo": "spoqa/spoqa-han-sans", "family": "Spoqa Han Sans"},
    {"repo": "adobe-fonts/source-han-sans", "family": "Source Han Sans"},
    {"repo": "adobe-fonts/source-han-serif", "family": "Source Han Serif"},
]
WATCH_PAGES = {
    "문체부 안심 글꼴파일 서비스": "https://www.mcst.go.kr/site/s_policy/subPolicy/contents/contents09.jsp",
    "공유마당 공공 안심글꼴": "https://gongu.copyright.or.kr/freeFontEvent_KOGL.html",
    "공유마당 민간 안심글꼴": "https://gongu.copyright.or.kr/freeFontEvent.html",
}
# 자동으로 신뢰할 수 있는 라이선스(원문이 구조화돼 있는 것). 그 외는 사람이 확인
TRUSTED = {"OFL-1.1": "OFL", "OFL": "OFL", "Apache-2.0": "Apache", "UFL-1.0": "UFL", "MIT": "MIT"}

def get(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()

def key(name):  # 병합 키: 소문자, 공백·기호 제거
    return re.sub(r"[^a-z0-9가-힣]", "", (name or "").lower())

# ---------------- 루트별 수집 ----------------
def root_google():
    raw = get("https://fonts.google.com/metadata/fonts").decode("utf-8")
    d = json.loads(raw[raw.index("{"):])
    out = {}
    for f in d.get("familyMetadataList", []):
        if "korean" not in f.get("subsets", []):
            continue
        out[f["family"]] = {"category": f.get("category"), "weights": sorted(f.get("fonts", {}).keys()),
                            "designers": f.get("designers"), "lastModified": f.get("lastModified"),
                            "license": "OFL-1.1", "url": "https://fonts.google.com/specimen/" + f["family"].replace(" ", "+")}
    return out

def root_fontsource():
    d = json.loads(get("https://api.fontsource.org/v1/fonts?subsets=korean").decode("utf-8"))
    return {f["family"]: {"id": f["id"], "license": f.get("license"), "type": f.get("type"), "version": f.get("version"),
                          "lastModified": f.get("lastModified"), "weights": f.get("weights"), "url": "https://fontsource.org/fonts/" + f["id"]} for f in d}

def root_github():
    out = {}
    for w in WATCH_REPOS:
        repo = w["repo"]; rec = {"repo": repo, "url": "https://github.com/" + repo}
        try:
            d = json.loads(get(f"https://api.github.com/repos/{repo}/releases/latest").decode("utf-8"))
            rec.update(tag=d.get("tag_name"), published=d.get("published_at"), url=d.get("html_url"))
        except Exception:
            try:
                d = json.loads(get(f"https://api.github.com/repos/{repo}/commits?per_page=1").decode("utf-8"))[0]
                rec.update(tag=None, published=d["commit"]["committer"]["date"], url=d["html_url"])
            except Exception as e:
                rec["error"] = str(e)[:80]
        try:
            lic = json.loads(get(f"https://api.github.com/repos/{repo}/license").decode("utf-8"))
            rec["license"] = (lic.get("license") or {}).get("spdx_id")
        except Exception:
            rec["license"] = None
        out[w["family"]] = rec
    return out

# 공공 라이선스 표기 → (정규 라이선스, 상업 이용, 변경 허용)
#   KOGL(출처)=공공누리 1유형, KOGL(출처/변경)=3유형(변경금지), CCL BY-NC=비영리, BY-ND=변경금지
PUBLIC_LIC = {
    "OFL": ("OFL", True, True),
    "KOGL(출처)": ("공공누리 제1유형", True, True),
    "KOGL(출처/변경)": ("공공누리 제3유형", True, False),
    "KOGL(출처/상업)": ("공공누리 제2유형", False, True),
    "KOGL(출처/상업/변경)": ("공공누리 제4유형", False, False),
    "CCL(BY-NC)": ("CC BY-NC", False, True),
    "CCL(BY-ND)": ("CC BY-ND", True, False),
}

def root_kogl():
    """tools/sources/ 의 공공데이터포털 CSV(UTF-8로 저장) 3종을 읽어 정규화한다.
      kcc_free_fonts_*.csv      한국저작권위원회 공유마당 무료폰트 목록 (저작물명·저작자·라이선스유형·저작물일련번호)
      kcisa_font_table_*.csv    한국문화정보원 글꼴테이블 (제목·종류·저작권자·다운로드횟수)
      kcisa_recommended_*.csv   추천 공공저작물 글꼴 (저작물명·소장기관명·저작물이용유형코드)
    원 배포처 링크는 공유마당 저작물 페이지(일련번호가 있을 때) 또는 공유마당 안심글꼴 목록 페이지."""
    out = {}
    def add(name, **kw):
        name = re.sub(r"\s+", " ", (name or "").strip())
        if not name: return
        r = out.setdefault(name, {"name": name, "files": []})
        for k, v in kw.items():
            if v and not r.get(k): r[k] = v
        if kw.get("file") and kw["file"] not in r["files"]: r["files"].append(kw["file"])
    for path in sorted(glob.glob(os.path.join(HERE, "sources", "*.csv"))):
        fn = os.path.basename(path)
        with open(path, encoding="utf-8-sig", newline="") as fp:
            rows = list(csv.DictReader(fp))
        for row in rows:
            if fn.startswith("kcc_free_fonts"):
                lic = (row.get("라이선스유형") or "").strip()
                sn = (row.get("저작물일련번호") or "").strip()
                add(row.get("저작물명"), author=row.get("저작자"), license_raw=lic, registered=row.get("등록일자"),
                    page=f"https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn={sn}&menuNo=200023" if sn else None, file=fn)
            elif fn.startswith("kcisa_font_table"):
                kind = (row.get("종류") or "").strip()
                lic = "OFL" if kind == "OFL" else ("KOGL(출처)" if kind == "KOGL" else "")
                add(row.get("제목"), author=row.get("저작권자"), license_raw=lic, registered=row.get("등록일자"),
                    downloads=int(row.get("다운로드횟수") or 0), page="https://gongu.copyright.or.kr/freeFontEvent.html", file=fn)
            elif fn.startswith("kcisa_recommended"):
                if (row.get("삭제여부") or "N") != "N": continue
                t = (row.get("저작물이용유형코드") or "").strip()
                lic = {"1": "KOGL(출처)", "2": "KOGL(출처/상업)", "3": "KOGL(출처/변경)", "4": "KOGL(출처/상업/변경)"}.get(t, "")
                add(row.get("저작물명"), author=row.get("소장기관명") or row.get("촬영기관명"), license_raw=lic,
                    page="https://gongu.copyright.or.kr/freeFontEvent_KOGL.html", file=fn)
    for r in out.values():
        lic, com, mod = PUBLIC_LIC.get(r.get("license_raw", ""), (r.get("license_raw") or "확인 필요", None, None))
        r.update(license=lic, commercial=com, modify=mod)
    return out

def root_pages():
    out = {}
    for name, url in WATCH_PAGES.items():
        try:
            html = get(url).decode("utf-8", "ignore")
            text = re.sub(r"<script.*?</script>|<style.*?</style>", "", html, flags=re.S)
            text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text))
            out[name] = {"sha": hashlib.sha256(text.encode()).hexdigest()[:16], "url": url}
        except Exception as e:
            out[name] = {"error": str(e)[:80], "url": url}
    return out

# ---------------- 카탈로그 병합 ----------------
def load_json(p, default):
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else default

def site_ids():
    try:
        return set(re.findall(r'\bid:\s*"([^"]+)"', open(SITE_DATA, encoding="utf-8").read()))
    except Exception:
        return set()

def merge(catalog, snap):
    """루트 스냅샷을 카탈로그에 누적. 반환: 변경 메시지 목록."""
    changes = []
    def rec_for(name):
        k = key(name)
        if k not in catalog:
            catalog[k] = {"name": name, "sources": {}, "first_seen": TODAY, "last_seen": TODAY, "history": [],
                          "license_auto": None, "review": "pending", "site_id": None}
            changes.append(f"- 🆕 새 폰트 발견: **{name}**")
        r = catalog[k]; r["last_seen"] = TODAY
        return r
    def note(r, msg):
        r["history"].append({"date": TODAY, "event": msg}); changes.append(f"- {msg}")

    for name, v in snap["google"].items():
        r = rec_for(name); prev = r["sources"].get("google")
        if prev and (prev.get("weights") != v["weights"] or prev.get("lastModified") != v["lastModified"]):
            note(r, f"🔄 Google Fonts 갱신: **{name}** 굵기 {len(prev.get('weights', []))}→{len(v['weights'])}종, 수정일 {v['lastModified']}")
        r["sources"]["google"] = v
        r.setdefault("category", v["category"]); r["weights"] = v["weights"]; r["designers"] = v["designers"]
    for name, v in snap["fontsource"].items():
        r = rec_for(name); prev = r["sources"].get("fontsource")
        if prev and prev.get("version") != v.get("version"):
            note(r, f"🔄 Fontsource 버전: **{name}** {prev.get('version')} → {v.get('version')}")
        r["sources"]["fontsource"] = v
    for name, v in snap["github"].items():
        if "error" in v: continue
        r = rec_for(name); prev = r["sources"].get("github")
        if prev and prev.get("published") != v.get("published"):
            note(r, f"🏷️ GitHub 릴리스: **{name}** {v.get('tag') or ''} ({(v.get('published') or '')[:10]}) → {v['url']}")
        r["sources"]["github"] = v
    for name, v in snap["kogl"].items():
        r = rec_for(name); r["sources"]["kogl"] = v
    # 사라진 루트 표시(레코드는 지우지 않는다 — 자산)
    for k, r in catalog.items():
        for root in ("google", "fontsource", "github"):
            if root in r["sources"] and r["name"] not in snap[root] and not r["sources"][root].get("gone"):
                r["sources"][root]["gone"] = TODAY
                note(r, f"⚠️ {root}에서 사라짐: **{r['name']}** — 배포·라이선스 상태 확인 필요")
    # 자동 신뢰 라이선스 결정
    for r in catalog.values():
        lic = None
        for root in ("google", "github", "fontsource"):
            s = r["sources"].get(root, {})
            if s.get("license") in TRUSTED: lic = TRUSTED[s["license"]]; break
        kg = r["sources"].get("kogl", {})
        if not lic and kg.get("license") and kg.get("license") != "확인 필요": lic = kg["license"]
        r["license_auto"] = lic
        if kg and kg.get("commercial") is False and r.get("review") == "pending":
            r["review"] = "excluded-noncommercial"  # 비영리 조건 — 상업용 무료 사이트 대상 아님(사람이 되돌릴 수 있음)
        if kg and r.get("review") == "pending" and re.search(r"안심글꼴\s*\(|목록|모음|^\d+종", r["name"]):
            r["review"] = "excluded-bundle"  # '안심글꼴(155종)' 같은 묶음 파일 — 개별 폰트가 아님
    # 사이트 반영 여부: ① Fontsource id ② 공공 웹폰트(webfonts.json 이름) ③ 이름 대조표(aliases.json)
    ids = site_ids()
    for r in catalog.values():
        fs = r["sources"].get("fontsource", {}).get("id")
        if fs and fs in ids: r["site_id"] = fs
    wf_path = os.path.join(STATE_DIR, "webfonts.json")
    if os.path.exists(wf_path):
        for wid, w in json.load(open(wf_path, encoding="utf-8")).items():
            if wid not in ids: continue
            for k2, r in catalog.items():
                if "kogl" in r["sources"] and re.sub(r"\s+(R|L|B|M|EB|Black|Outline)$", "", r["name"]) in (w["name"], re.sub(r"\s+(R|L|B|M|EB|Black|Outline)$", "", w["name"])):
                    r["site_id"] = wid
    al_path = os.path.join(STATE_DIR, "aliases.json")
    if os.path.exists(al_path):
        al = {k: v for k, v in json.load(open(al_path, encoding="utf-8")).items() if not k.startswith("_")}
        for r in catalog.values():
            if r["name"] in al and al[r["name"]] in ids and not r.get("site_id"):
                r["site_id"] = al[r["name"]]; r["duplicate_of"] = al[r["name"]]
    for r in catalog.values():  # 사이트에 올라간 것은 승인 상태로 (사람이 검수해 올린 것)
        if r.get("site_id") and r.get("review") == "pending": r["review"] = "approved"
    prev_pages = load_json(SNAPSHOT, {}).get("pages", {})
    for name, v in snap["pages"].items():
        if "error" in v: continue
        if prev_pages.get(name, {}).get("sha") not in (None, v["sha"]):
            changes.append(f"- 📄 페이지 변경 감지: **{name}** — 사람이 확인 → {v['url']}")
    return changes

def export_candidates(catalog):
    """검수 승인(review=approved)됐지만 사이트에 없는 레코드를 data.js 형식 초안으로 내보낸다."""
    rows = [r for r in catalog.values() if r.get("review") == "approved" and not r.get("site_id")]
    if not rows: return 0
    def stub(r):
        fsid = r["sources"].get("fontsource", {}).get("id") or key(r["name"])
        w = r.get("weights") or ["400"]
        return (f'  {{ id: "{fsid}", name: "TODO 한글명", en: "{r["name"]}", family: "\'{r["name"]}\', sans-serif",\n'
                f'    designer: "{", ".join(r.get("designers") or ["TODO"])}", holder: "TODO", category: "TODO",\n'
                f'    tags: [], mood: [], weights: [{",".join(w)}], formats: ["TTF","WOFF2"],\n'
                f'    cov: 11172, glyphs: "TODO", license: "{r.get("license_auto") or "TODO"}", matrix: {"OFL_ALL_OK" if r.get("license_auto") == "OFL" else "TODO"},\n'
                f'    verified: "{TODAY}", status: "checking", pair: "inter", pop: 50, added: "{TODAY}", desc: "TODO" }},')
    open(os.path.join(STATE_DIR, "candidates.data.js"), "w", encoding="utf-8").write(
        "// 자동 생성 초안 — TODO를 채우고 라이선스 원문을 확인한 뒤 data.js로 옮기세요\n" + "\n".join(stub(r) for r in rows) + "\n")
    return len(rows)

LINKS = os.path.join(HERE, "..", "html", "data", "links.json")

def check_links():
    """사이트에 올라간 폰트의 직접 다운로드 링크가 살아 있는지 점검 → html/data/links.json (끊기면 UI가 배포처 페이지로 안내)."""
    try:
        src = open(SITE_DATA, encoding="utf-8").read()
    except Exception:
        return {}
    out = {}
    for m in re.finditer(r'\{ id: "([^"]+)", name: "[^"]*", en: "([^"]+)"(.*?)verified:', src, re.S):
        fid, en, body = m.group(1), m.group(2), m.group(3)
        mz = re.search(r'\bzip: "([^"]+)"', body)  # 사이트가 기본으로 거는 것은 원 배포처 링크. 보관본(mirror)은 끊겼을 때만 대체
        mp = re.search(r'\bpage: "([^"]+)"', body)
        if mz: url = mz.group(1)
        elif "webfont:" in body and mp: url = mp.group(1)  # 공공 안심글꼴: 공유마당 페이지가 원 배포처
        else: url = f"https://fonts.google.com/download?family={en.replace(' ', '+')}"
        try:
            req = urllib.request.Request(url, headers=dict(UA, Range="bytes=0-0"))
            with urllib.request.urlopen(req, timeout=25) as r:
                ok = r.status in (200, 206)
                out[fid] = {"url": url, "ok": ok, "code": r.status, "checked": TODAY}
        except urllib.error.HTTPError as e:
            out[fid] = {"url": url, "ok": False, "code": e.code, "checked": TODAY}
        except Exception as e:
            out[fid] = {"url": url, "ok": False, "code": str(e)[:40], "checked": TODAY}
    os.makedirs(os.path.dirname(LINKS), exist_ok=True)
    json.dump(out, open(LINKS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return out

def main():
    os.makedirs(STATE_DIR, exist_ok=True)
    links = check_links()
    dead = [k for k, v in links.items() if not v["ok"]]
    catalog = load_json(CATALOG, {})
    first = not catalog
    snap = {"checked": TODAY, "google": root_google(), "fontsource": root_fontsource(), "github": root_github(),
            "kogl": root_kogl(), "pages": root_pages()}
    changes = merge(catalog, snap)
    for k in dead:
        changes.append(f"- 🔗 다운로드 직링크 끊김: **{k}** ({links[k]['code']}) — 사이트는 배포처 페이지로 자동 안내 중, 링크 갱신 필요")
    json.dump(catalog, open(CATALOG, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(snap, open(SNAPSHOT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    n_cand = export_candidates(catalog)
    roots = {k: len(v) for k, v in snap.items() if isinstance(v, dict)}
    stat = (f"카탈로그 {len(catalog)}종 · 루트 수집 " + ", ".join(f"{k} {v}" for k, v in roots.items())
            + f" · 사이트 반영 {sum(1 for r in catalog.values() if r.get('site_id'))}종 · 검수 대기 {sum(1 for r in catalog.values() if r.get('review') == 'pending')}종"
            + f" · 다운로드 링크 {len(links) - len(dead)}/{len(links)} 정상")
    body = "\n".join(changes) if (changes and not first) else ("- 최초 수집 — 모든 레코드를 새로 만들었습니다" if first else "- 변경 없음")
    md = f"# 배포처 수집 보고 — {TODAY}\n\n{stat}\n\n{body}\n\n> 라이선스 해석·사이트 공개는 자동화하지 않습니다. 카탈로그(tools/state/catalog.json)의 review 필드는 사람이 바꿉니다." + (f"\n> 승인 후 미반영 {n_cand}종 초안: tools/state/candidates.data.js" if n_cand else "")
    open(REPORT, "w", encoding="utf-8").write(md + "\n")
    print(md)
    sys.exit(3 if (changes and not first) else 0)

if __name__ == "__main__":
    main()
