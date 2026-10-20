#!/usr/bin/env python3 -I
"""LETSUM 데이터 검증기 — 커밋 전에 반드시 실행. 오류가 하나라도 있으면 종료 코드 1.
어떤 AI·사람이 작업했든 같은 기준으로 '꼬임·중복·오류'를 막는다.

검사 항목
 1. data.js가 JavaScript로 정상 해석되는가 (node 필요)
 2. id 중복 / 표시 이름 중복(정규화 기준) / 영문명 중복
 3. 필수 필드·값의 형식 (분류·분위기·라이선스·매트릭스·굵기·날짜 형식)
 4. 라이선스가 LICENSE_INFO에 정의돼 있는가, 공공누리면 출처 표시(attribution)가 있는가
 5. 출시일(released)은 출처(releasedSrc)·링크(releasedUrl)와 함께 있는가, 미래 날짜가 아닌가
 6. 웹폰트 주소 형식(GitHub Pages 미러), 다운로드·원 배포처 링크 형식, 소개 전용(intro) 항목 규칙
 7. 카탈로그(catalog.json)의 site_id가 실제 data.js id를 가리키는가
 8. 검수 파일(review_*.json)·출시일 덮어쓰기(release_overrides.json)의 id가 data.js에 있는가
사용: python3 -I tools/validate.py
"""
import json, os, re, subprocess, sys, unicodedata, glob
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DATA = os.path.join(ROOT, "html", "js", "data.js")
CATS = {"고딕", "명조", "손글씨", "디스플레이"}
MOODS = {"단정한", "차분한", "따뜻한", "세련된", "고전적", "발랄한", "귀여운", "강렬한"}
MATRIX_KEYS = {"print", "web", "video", "embed", "bici", "package", "ofl"}
PAIRS = {"inter", "grotesk", "playfair", "plexmono"}
errors, warns = [], []
err = errors.append; warn = warns.append

def n(s): return re.sub(r"[^0-9a-z가-힣]", "", unicodedata.normalize("NFKC", s or "").lower())  # NFKC: Ⅱ→ii(빙그레체Ⅱ ≠ 빙그레체)

# 1) node로 data.js를 실제로 실행해 JSON으로 꺼낸다 (정규식 파싱의 오판을 피함)
js = "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);" \
     "vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.out={FONTS,LICENSE_INFO,LICENSE_CATS}',c);" \
     "process.stdout.write(JSON.stringify(c.out))"
try:
    out = subprocess.run(["node", "-e", js, DATA], capture_output=True, text=True, check=True).stdout
    D = json.loads(out)
except subprocess.CalledProcessError as e:
    print("✗ data.js 해석 실패 — 문법 오류:\n", e.stderr[-800:]); sys.exit(1)
FONTS, LIC = D["FONTS"], D["LICENSE_INFO"]
ids = [f.get("id") for f in FONTS]

# 2) 중복
for label, key in (("id", lambda f: f.get("id")), ("이름", lambda f: n(f.get("name"))), ("영문명", lambda f: n(f.get("en")))):
    seen = {}
    for f in FONTS:
        k = key(f)
        if k in seen: err(f"중복 {label}: {f.get('id')} ↔ {seen[k]} ({f.get('name')})")
        else: seen[k] = f.get("id")

today = date.today().isoformat()
_cdn = os.path.join(HERE, "state", "cdn_fonts.json")
CDN = {k: v for k, v in json.load(open(_cdn, encoding="utf-8")).items() if not k.startswith("_")} if os.path.exists(_cdn) else {}
for f in FONTS:
    fid = f.get("id", "?")
    # 3) 필수 필드·형식
    for k in ("id", "name", "en", "family", "designer", "holder", "category", "tags", "mood", "weights", "formats",
              "license", "matrix", "verified", "status", "pair", "pop", "added", "desc", "cov", "glyphs"):
        if k not in f: err(f"{fid}: 필드 없음 '{k}'")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", fid): err(f"{fid}: id는 소문자·숫자·하이픈만")
    if f.get("category") not in CATS: err(f"{fid}: 분류 '{f.get('category')}' 허용 안 됨 {CATS}")
    if not set(f.get("mood", [])) <= MOODS: err(f"{fid}: 분위기 {set(f.get('mood', [])) - MOODS} 허용 안 됨")
    if f.get("pair") not in PAIRS: err(f"{fid}: 영문 짝꿍 '{f.get('pair')}' 허용 안 됨 {PAIRS}")
    if f.get("status") not in ("verified", "checking"): err(f"{fid}: status는 verified|checking")
    w = f.get("weights", [])
    if not w or any(x not in range(100, 1000, 100) for x in w) or w != sorted(set(w)): err(f"{fid}: 굵기 목록 형식 오류 {w}")
    if set(f.get("matrix", {})) != MATRIX_KEYS or any(v not in ("ok", "no", "cond") for v in f.get("matrix", {}).values()):
        err(f"{fid}: 매트릭스 키/값 오류")
    for k in ("verified", "added"):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", f.get(k, "")): err(f"{fid}: {k} 날짜 형식(YYYY-MM-DD) 오류")
    if not f.get("family", "").startswith("'"): err(f"{fid}: family는 따옴표로 시작하는 CSS 값이어야 함")
    # 4) 라이선스
    if f.get("license") not in LIC: err(f"{fid}: 라이선스 '{f.get('license')}'가 LICENSE_INFO에 없음")
    if (str(f.get("license", "")).startswith("공공누리") or str(f.get("license", "")).startswith("기증저작물")) and not f.get("attribution"): err(f"{fid}: 공공누리는 attribution(출처 표시) 필수")
    # 5) 출시일
    r = f.get("released")
    if r:
        if not re.fullmatch(r"\d{4}(-\d{2}(-\d{2})?)?", r): err(f"{fid}: released 형식(YYYY / YYYY-MM / YYYY-MM-DD) 오류 '{r}'")
        if r > today: err(f"{fid}: released가 미래 날짜 {r}")
        if not f.get("releasedSrc") or not str(f.get("releasedUrl", "")).startswith("http"): err(f"{fid}: released에는 releasedSrc·releasedUrl 필수")
    # 6) 링크
    for wv, url in (f.get("webfont") or {}).items():
        if not re.fullmatch(r"https://(geehg\.github\.io/letsum-mirror/webfonts|letsum\.app/fonts-hosted)/[a-z0-9-]+/\d{3}\.(woff2|ttf|otf)", url) and not re.fullmatch(r"https://letsum\.app/fonts-hosted/[a-z0-9-]+/\d{3}\.(ttf|otf)", url) \
           and url not in CDN.get(fid, {}).get("files", {}).values(): err(f"{fid}: 웹폰트 주소 형식 오류(미러·서버 전용·cdn_fonts.json 등록 주소만) {url}")
        if "/fonts-hosted/" in url and not os.path.exists(os.path.join(HERE, "archive", "hosted", url.split("/fonts-hosted/")[1])):
            warn(f"{fid}: 서버 전용 웹폰트 원본이 tools/archive/hosted에 없음(다른 컴퓨터에서 작업 중이면 정상)")
        if int(wv) not in w: err(f"{fid}: 웹폰트 굵기 {wv}가 weights에 없음")
    dl = f.get("dl") or {}
    for k in ("zip", "page", "mirror"):
        if k in dl and str(dl[k]).startswith("http://"): warn(f"{fid}: dl.{k}가 http 주소(배포처가 https를 제공하지 않음)")
        elif k in dl and not str(dl[k]).startswith("https://"): err(f"{fid}: dl.{k}는 https 주소여야 함")
    if f.get("webfont") and not dl.get("page"): err(f"{fid}: 웹폰트 폰트는 원 배포처 페이지(dl.page) 필수")
    # 소개 전용: 미리보기 웹폰트 없이 정보·배포처만. 이유와 배포처가 필수, 견본 이미지는 html/ 아래 실제 파일
    if f.get("intro"):
        if f.get("webfont"): err(f"{fid}: 소개 전용(intro)은 webfont를 가질 수 없음")
        if not f.get("introReason"): err(f"{fid}: 소개 전용은 introReason(미리보기 미제공 사유) 필수")
        if not dl.get("page"): err(f"{fid}: 소개 전용은 원 배포처 페이지(dl.page) 필수")
        if f.get("specimen") and not os.path.exists(os.path.join(ROOT, "html", f["specimen"])): err(f"{fid}: 견본 이미지 없음 {f['specimen']}")
    elif f.get("specimen") or f.get("weightsUnknown"): err(f"{fid}: specimen·weightsUnknown은 소개 전용(intro)에서만")

# 7) 카탈로그 연결
cat_path = os.path.join(HERE, "state", "catalog.json")
if os.path.exists(cat_path):
    for k, r in json.load(open(cat_path, encoding="utf-8")).items():
        if r.get("site_id") and r["site_id"] not in ids: err(f"카탈로그 {k}: site_id '{r['site_id']}'가 data.js에 없음")
# 8) 검수·덮어쓰기 파일
for p in glob.glob(os.path.join(HERE, "state", "review_*.json")) + [os.path.join(HERE, "state", "release_overrides.json"), os.path.join(HERE, "state", "reasons.json")]:
    if not os.path.exists(p): continue
    for k in json.load(open(p, encoding="utf-8")):
        if not k.startswith("_") and k not in ids: err(f"{os.path.basename(p)}: id '{k}'가 data.js에 없음")

# 영문 폰트(data_en.js) — /en/ 페이지
EN_DATA = os.path.join(ROOT, "html", "js", "data_en.js")
if os.path.exists(EN_DATA):
    jse = "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);" \
          "vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';'+fs.readFileSync(process.argv[2],'utf8')+';this.out={FONTS_EN,LICENSE_INFO,SAMPLE_LINES_EN,TEXT_PRESETS_EN}',c);" \
          "process.stdout.write(JSON.stringify(c.out))"
    try:
        E = json.loads(subprocess.run(["node", "-e", jse, DATA, EN_DATA], capture_output=True, text=True, check=True).stdout)
        seen_en = set(); kr = set(ids)
        for f in E["FONTS_EN"]:
            i = f.get("id", "")
            if not re.fullmatch(r"e-[a-z0-9][a-z0-9-]*", i): err(f"영문 {i}: id는 e- 접두사 소문자·숫자·하이픈")
            if i in seen_en or i in kr: err(f"영문 {i}: id 중복")
            seen_en.add(i)
            if f.get("category") not in CATS: err(f"영문 {i}: category '{f.get('category')}'")
            for m in f.get("mood") or []:
                if m not in MOODS: err(f"영문 {i}: mood '{m}'")
            if f.get("license") not in E["LICENSE_INFO"]: err(f"영문 {i}: license '{f.get('license')}'가 LICENSE_INFO에 없음")
            if not f.get("intro"):
                wf = f.get("webfont") or {}
                if not wf: err(f"영문 {i}: webfont 없음")
                for u in wf.values():
                    if not u.startswith("https://"): err(f"영문 {i}: webfont 주소 '{u[:40]}'")
            if not (f.get("dl") or {}).get("page"): err(f"영문 {i}: dl.page 없음")
            if f.get("released") and not re.fullmatch(r"\d{4}(-\d{2}(-\d{2})?)?", f["released"]): err(f"영문 {i}: released 형식")
            if not f.get("desc"): err(f"영문 {i}: desc 없음")
        if not E["SAMPLE_LINES_EN"] or not E["TEXT_PRESETS_EN"]: err("영문 예시 문장·프리셋이 비어 있음")
        print(f"영문 폰트 {len(E['FONTS_EN'])}종 확인")
    except subprocess.CalledProcessError as ex:
        err("data_en.js 해석 실패: " + ex.stderr[-300:])

# 딩벳 폰트(data_db.js) — /dingbat/ 페이지
DB_DATA = os.path.join(ROOT, "html", "js", "data_db.js")
DB_CATS = {"아이콘", "이모지·기호", "바코드", "장식·데이터"}
if os.path.exists(DB_DATA):
    jsd = "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);" \
          "vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';'+fs.readFileSync(process.argv[2],'utf8')+';this.out={FONTS_DB,LICENSE_INFO}',c);" \
          "process.stdout.write(JSON.stringify(c.out))"
    try:
        D = json.loads(subprocess.run(["node", "-e", jsd, DATA, DB_DATA], capture_output=True, text=True, check=True).stdout)
        seen_db = set()
        for f in D["FONTS_DB"]:
            i = f.get("id", "")
            if not re.fullmatch(r"d-[a-z0-9][a-z0-9-]*", i): err(f"딩벳 {i}: id는 d- 접두사 소문자·숫자·하이픈")
            if i in seen_db or i in ids: err(f"딩벳 {i}: id 중복")
            seen_db.add(i)
            if f.get("category") not in DB_CATS: err(f"딩벳 {i}: category '{f.get('category')}' (허용 {sorted(DB_CATS)})")
            for m in f.get("mood") or []:
                if m not in MOODS: err(f"딩벳 {i}: mood '{m}'")
            if f.get("license") not in D["LICENSE_INFO"]: err(f"딩벳 {i}: license '{f.get('license')}'가 LICENSE_INFO에 없음")
            for k in LICENSE_KEYS if "LICENSE_KEYS" in globals() else ("print", "web", "video", "embed", "bici", "package", "ofl"):
                if (f.get("matrix") or {}).get(k) not in ("ok", "cond", "no"): err(f"딩벳 {i}: matrix.{k} 값")
            wf = f.get("webfont") or {}
            if not wf: err(f"딩벳 {i}: webfont 없음")
            for u in wf.values():
                if not u.startswith("https://"): err(f"딩벳 {i}: webfont 주소 '{u[:40]}'")
            if not f.get("icons") or not f.get("sample"): err(f"딩벳 {i}: 견본 기호(icons·sample) 없음")
            if not (f.get("dl") or {}).get("page"): err(f"딩벳 {i}: dl.page 없음")
            if f.get("released") and not re.fullmatch(r"\d{4}(-\d{2}(-\d{2})?)?", f["released"]): err(f"딩벳 {i}: released 형식")
            if not f.get("desc"): err(f"딩벳 {i}: desc 없음")
        print(f"딩벳 폰트 {len(D['FONTS_DB'])}종 확인")
    except subprocess.CalledProcessError as ex:
        err("data_db.js 해석 실패: " + ex.stderr[-300:])

# 경고(통과는 함)
for f in FONTS:
    if not f.get("released"): warn(f"{f['id']} 출시일 없음")
    if f.get("status") == "checking": warn(f"{f['id']} 라이선스 확인 중")

print(f"폰트 {len(FONTS)}종 · 오류 {len(errors)} · 경고 {len(warns)}")
for e in errors: print("  ✗", e)
if "--warn" in sys.argv:
    for w_ in warns: print("  ·", w_)
sys.exit(1 if errors else 0)
