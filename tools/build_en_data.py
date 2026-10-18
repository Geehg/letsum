#!/usr/bin/env python3
"""영문 폰트 데이터(html/js/data_en.js) 생성 — Google Fonts 공식 메타데이터 기준.

선정: 라틴 문자를 지원하는 Google Fonts 패밀리 중 인기순 상위 N종(기본 300).
      한글·한자·일본어 전용 폰트, 아이콘·기호 폰트, 언어별 Noto(본 Noto Sans·Serif 제외)는 뺀다.
라이선스: google/fonts 저장소의 폴더(ofl·apache·ufl)로 확인 — 셋 다 상업 사용·웹 사용 허용.
미리보기: Google Fonts CSS API가 알려 주는 공식 웹폰트 주소(fonts.gstatic.com, latin 구간)를 굵기별로 그대로 쓴다(변환·보관 없음).
이미 있는 항목의 손으로 고친 설명·분류(desc·tags·mood·category·pair)는 덮어쓰지 않는다.

사용: python tools/build_en_data.py [--top 300]
"""
import argparse, json, os, re, sys, time, urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "html", "js", "data_en.js")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
TODAY = date.today().isoformat()

CAT = {"Sans Serif": "고딕", "Serif": "명조", "Display": "디스플레이", "Handwriting": "손글씨", "Monospace": "고딕"}
CAT_EN = {"Sans Serif": "산세리프", "Serif": "세리프", "Display": "디스플레이", "Handwriting": "손글씨", "Monospace": "고정폭"}
GEN = {"고딕": "sans-serif", "명조": "serif", "손글씨": "cursive", "디스플레이": "sans-serif"}
USE = {"Sans Serif": "화면 UI·본문·제목에 두루 씁니다.", "Serif": "책·잡지 본문과 격식 있는 제목에 어울립니다.",
       "Display": "포스터·로고·큰 제목처럼 크게 쓸 때 개성이 살아납니다.", "Handwriting": "손으로 쓴 느낌이 필요한 짧은 문구·카드·SNS에 씁니다.",
       "Monospace": "코드·표·데이터처럼 글자 폭을 맞춰야 할 때 씁니다."}
MOOD = {"Sans Serif": ["단정한"], "Serif": ["고전적", "차분한"], "Display": ["강렬한"], "Handwriting": ["따뜻한"], "Monospace": ["단정한"]}
PAIR = {"Sans Serif": "inter", "Serif": "playfair", "Display": "grotesk", "Handwriting": "inter", "Monospace": "plexmono"}
SUBSET_KO = {"latin-ext": "확장 라틴", "cyrillic": "키릴", "cyrillic-ext": "키릴", "greek": "그리스", "greek-ext": "그리스", "vietnamese": "베트남어"}
LIC = {"ofl": "OFL", "apache": "Apache 2.0", "ufl": "Ubuntu Font License"}


def get(url, data=None):
    h = {"User-Agent": UA}
    if "api.github.com" in url and os.environ.get("GITHUB_TOKEN"): h["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]  # Actions 공용 IP 한도 대비
    req = urllib.request.Request(url, data=data, headers=h)
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r: return r.read()
        except Exception:
            if i == 2: raise
            time.sleep(2)


def gf_license_dirs():
    top = json.loads(get("https://api.github.com/repos/google/fonts/git/trees/main"))["tree"]
    out = {}
    for t in top:
        if t["path"] in LIC and t["type"] == "tree":
            for x in json.loads(get(f"https://api.github.com/repos/google/fonts/git/trees/{t['sha']}"))["tree"]: out[x["path"]] = t["path"]
    return out


def css_urls(family, weights):
    """Google Fonts CSS API → { 굵기: latin 구간 woff2 주소 }"""
    q = "family=" + family.replace(" ", "+") + ":wght@" + ";".join(map(str, weights)) + "&display=swap"
    css = get("https://fonts.googleapis.com/css2?" + q).decode("utf-8")
    out = {}
    for sub, body in re.findall(r"/\*\s*([a-z-]+)\s*\*/\s*@font-face\s*\{([^}]*)\}", css):
        if sub != "latin": continue
        w = re.search(r"font-weight:\s*(\d+)", body); u = re.search(r"url\((https://[^)]+)\)", body)
        if w and u: out[int(w.group(1))] = u.group(1)
    return out


def js(v): return json.dumps(v, ensure_ascii=False)


def entry_js(e):
    ks = ["id", "name", "en", "family", "designer", "holder", "category", "tags", "mood", "weights", "formats", "cov", "glyphs", "subsets", "variable",
          "webfont", "webfontSrc", "dl", "license", "matrix", "verified", "status", "released", "releasedSrc", "releasedUrl", "pair", "pop", "added", "desc", "manual"]
    parts = []
    for k in ks:
        if k not in e: continue
        v = e[k]
        if k == "matrix": parts.append(f"matrix: OFL_ALL_OK")
        elif k == "webfont": parts.append("webfont: { " + ", ".join(f'{w}: {js(u)}' for w, u in v.items()) + " }")
        else: parts.append(f"{k}: {js(v)}")
    return "  { " + ", ".join(parts) + " }"


def load_existing():
    if not os.path.exists(OUT): return {}
    import subprocess
    code = "const fs=require('fs');const src=fs.readFileSync(process.argv[1],'utf8')+fs.readFileSync(process.argv[2],'utf8');const F=new Function('var window={};'+src+';return FONTS_EN')();console.log(JSON.stringify(F))"
    try: return {f["id"]: f for f in json.loads(subprocess.run(["node", "-e", code, os.path.join(ROOT, "html", "js", "data.js"), OUT], capture_output=True, text=True, check=True).stdout)}
    except Exception: return {}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--top", type=int, default=300); a = ap.parse_args()
    meta = json.loads(get("https://fonts.google.com/metadata/fonts"))["familyMetadataList"]
    lic = gf_license_dirs()
    old = load_existing()
    cand = []
    for m in meta:
        fam = m["family"]; subs = m.get("subsets") or []
        if "latin" not in subs or m.get("primaryScript") not in ("", "Latn", None): continue
        if any(s in subs for s in ("korean", "japanese", "chinese-simplified", "chinese-traditional", "chinese-hongkong")): continue
        if re.search(r"Icons|Symbols|Emoji|Barcode|Flag|Libre Barcode|Redacted|Linefont|Wavefont|Blank|Adobe Blank", fam): continue
        if m.get("isNoto") and fam not in ("Noto Sans", "Noto Serif", "Noto Sans Mono", "Noto Sans Display", "Noto Serif Display"): continue
        if m.get("category") not in CAT: continue
        d = lic.get(re.sub(r"[^a-z0-9]", "", fam.lower()))
        if not d: continue
        cand.append((m, d))
    cand.sort(key=lambda x: x[0].get("popularity") or 9999)
    cand = cand[: a.top]
    out = []
    for i, (m, d) in enumerate(cand):
        fam = m["family"]; slug = re.sub(r"[^a-z0-9]+", "-", fam.lower()).strip("-"); fid = "e-" + slug
        ws = sorted({int(k) for k in m["fonts"] if k.isdigit()}) or [400]
        try: urls = css_urls(fam, ws)
        except Exception as ex: print("CSS 실패:", fam, ex); continue
        if not urls: print("latin 웹폰트 없음:", fam); continue
        ws = [w for w in ws if w in urls]
        var = any(x.get("tag") == "wght" for x in (m.get("axes") or []))
        subs = [SUBSET_KO[s] for s in m.get("subsets", []) if s in SUBSET_KO]; subs = list(dict.fromkeys(subs))
        catk = m["category"]; cat = CAT[catk]
        designers = ", ".join(m.get("designers") or []) or "Google Fonts"
        tags = [CAT_EN[catk]] + (["고정폭", "코딩"] if catk == "Monospace" else []) + (["가변"] if var else []) + ([f"{len(ws)}굵기"] if len(ws) >= 5 else [])
        glyphs = "라틴" + ("·" + "·".join(subs) if subs else "")
        desc = f"{designers}의 {CAT_EN[catk]} 서체. {len(ws)}가지 굵기{'(가변 폰트)' if var else ''}에 {glyphs} 문자를 지원하며, {USE[catk]}"
        e = {"id": fid, "name": fam, "en": fam, "family": f"'LS {fid}', {GEN[cat] if catk != 'Monospace' else 'monospace'}",
             "designer": designers, "holder": designers, "category": cat, "tags": tags, "mood": MOOD[catk], "weights": ws, "formats": ["TTF", "WOFF2"],
             "cov": 0, "glyphs": glyphs, "subsets": m.get("subsets", []), "variable": var,
             "webfont": {w: urls[w] for w in ws}, "webfontSrc": "Google Fonts 공식 웹폰트(라틴 구간)",
             "dl": {"page": "https://fonts.google.com/specimen/" + fam.replace(" ", "+"), "srcName": "Google Fonts"},
             "license": LIC[d], "matrix": "OFL_ALL_OK", "verified": TODAY, "status": "verified",
             "released": m.get("dateAdded") or "", "releasedSrc": "Google Fonts 등록일", "releasedUrl": "https://fonts.google.com/specimen/" + fam.replace(" ", "+"),
             "pair": PAIR[catk], "pop": max(10, 99 - i // 3), "added": old.get(fid, {}).get("added", TODAY), "desc": desc}
        if not e["released"]: del e["released"], e["releasedSrc"], e["releasedUrl"]
        o = old.get(fid)
        if o and o.get("manual"):  # 사람이 다듬은 항목은 설명·분류 유지
            for k in ("desc", "tags", "mood", "category", "pair", "manual"): e[k] = o[k]
        out.append(e)
        if (i + 1) % 50 == 0: print(f"… {i + 1}/{len(cand)}")
    body = ",\n".join(entry_js(e) for e in out)
    hdr = ("// LETSUM 영문 폰트 데이터 — tools/build_en_data.py가 Google Fonts 공식 메타데이터로 생성(손으로 고친 항목은 manual: true).\n"
           "// /en/ 페이지에서만 쓴다: data.js 다음에 불러오고, LS_LANG === \"en\"이면 FONTS를 이 목록으로 바꾼다.\n")
    with open(OUT, "w", encoding="utf-8") as fp:
        fp.write(hdr + "const FONTS_EN = [\n" + body + "\n];\n" + EN_TAIL)
    print(f"→ {OUT} ({len(out)}종)")


EN_TAIL = r'''
// 영문 전용 라이선스 설명(한글 data.js의 LICENSE_INFO에 더한다)
Object.assign(LICENSE_INFO, {
  "Apache 2.0": { full: "Apache License 2.0", short: "Apache 2.0", note: "상업 사용·수정·재배포 가능 / 저작권·라이선스 고지 유지", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  "Ubuntu Font License": { full: "Ubuntu Font Licence 1.0", short: "UFL", note: "상업 사용·재배포 가능 / 수정본은 이름을 바꿔야 함", url: "https://ubuntu.com/legal/font-licence" },
});
// 영문 예시 문장(관리자 '예시 문장'과 별개 — 영문 페이지 기본값)
const SAMPLE_LINES_EN = [
  { cat: "Pangram", t: "The quick brown fox jumps over the lazy dog", src: "Pangram" },
  { cat: "Pangram", t: "Sphinx of black quartz, judge my vow", src: "Pangram" },
  { cat: "Pangram", t: "Pack my box with five dozen liquor jugs", src: "Pangram" },
  { cat: "Poem", t: "Hope is the thing with feathers that perches in the soul", src: "Emily Dickinson" },
  { cat: "Poem", t: "I wandered lonely as a cloud", src: "William Wordsworth" },
  { cat: "Poem", t: "Two roads diverged in a yellow wood", src: "Robert Frost" },
  { cat: "Poem", t: "Shall I compare thee to a summer's day?", src: "Shakespeare, Sonnet 18" },
  { cat: "Novel", t: "It was the best of times, it was the worst of times", src: "Charles Dickens" },
  { cat: "Novel", t: "Call me Ishmael.", src: "Herman Melville" },
  { cat: "Novel", t: "It is a truth universally acknowledged", src: "Jane Austen" },
  { cat: "Quote", t: "Simplicity is the ultimate sophistication", src: "Proverb" },
  { cat: "Quote", t: "Well done is better than well said", src: "Benjamin Franklin" },
  { cat: "Quote", t: "Knowledge is power", src: "Francis Bacon" },
  { cat: "Proverb", t: "Actions speak louder than words", src: "Proverb" },
  { cat: "Proverb", t: "Every cloud has a silver lining", src: "Proverb" },
  { cat: "Headline", t: "City Library Opens New Reading Garden This Spring", src: "창작 예시" },
  { cat: "Headline", t: "Local Bakery Wins National Bread Award", src: "창작 예시" },
  { cat: "Campaign", t: "Leave only footprints. Take your trash home.", src: "창작 예시" },
  { cat: "Campaign", t: "Slow down. Every child matters.", src: "창작 예시" },
  { cat: "Lyric", t: "We danced beneath the streetlights till the morning came", src: "창작 예시" },
  { cat: "Ad", t: "Fresh mornings start here.", src: "창작 예시" },
  { cat: "Ad", t: "Made to last. Designed to be loved.", src: "창작 예시" },
  { cat: "Letter", t: "Dear friend, I hope this note finds you well", src: "창작 예시" },
  { cat: "Menu", t: "Flat White $4.50 · Almond Croissant $3.80", src: "창작 예시" },
  { cat: "UI", t: "Your changes have been saved.", src: "창작 예시" },
  { cat: "Sign", t: "Please keep your phone on silent during the show", src: "창작 예시" },
  { cat: "Greeting", t: "Happy New Year! Wishing you joy and good health", src: "창작 예시" },
  { cat: "Numbers", t: "0123456789 · $1,250.00 · 98.6% · 2026", src: "창작 예시" },
  { cat: "Poster", t: "SUMMER JAZZ NIGHT — LIVE ON THE ROOFTOP", src: "창작 예시" },
  { cat: "Book", t: "Reading is always the right time well spent", src: "창작 예시" },
];
const TEXT_PRESETS_EN = [
  { id: "body", label: "본문", t: "Reading is always the right time well spent" },
  { id: "title", label: "제목", t: "Happy New Year" },
  { id: "pang", label: "알파벳 전체", t: "The quick brown fox jumps over the lazy dog" },
  { id: "caps", label: "대문자", t: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { id: "nums", label: "숫자·기호", t: "0123456789 $€£¥ & @ # % ?!" },
  { id: "accent", label: "악센트(확장 라틴)", t: "Crème brûlée · Ångström · Ærø · Œuvre" },
];
if (typeof window !== "undefined" && window.LS_LANG === "en") {
  FONTS.splice(0, FONTS.length, ...FONTS_EN);
  SAMPLE_LINES.splice(0, SAMPLE_LINES.length, ...SAMPLE_LINES_EN);
  TEXT_PRESETS.splice(0, TEXT_PRESETS.length, ...TEXT_PRESETS_EN);
}
'''

if __name__ == "__main__":
    main()
