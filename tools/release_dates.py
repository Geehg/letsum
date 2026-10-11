#!/usr/bin/env python3 -I
"""폰트의 '원 제작사 출시·배포일'을 출처와 함께 정해 data.js에 기록한다 (released / releasedSrc / releasedUrl).
확인할 수 없으면 비워 둔다 — 날짜를 지어내지 않는다. 히어로 '신규 폰트'는 이 값으로만 고른다.

규칙 (근거가 있는 것만):
 1) 공공기관이 직접 공유마당에 배포한 폰트(저작자 = 한국저작권위원회·한국교육학술정보원·의왕시청소년수련관 등)
    → 공유마당/안심글꼴 목록의 최초 등록일 = 제작사 배포일. 출처 '공유마당 배포일'
 2) Google Fonts에 2021년 이후 처음 공개된 패밀리(제작사 저장소에 더 이른 릴리스 기록 없음)
    → Google Fonts 최초 공개일. 출처 'Google Fonts 최초 공개'
 3) 2018년 Google Fonts 한국어 지원 개시 때 일괄 등록된 패밀리, 민간 기업 폰트의 공유마당 재등록일
    → 원 출시가 더 이르므로 쓰지 않는다(빈 값). tools/state/release_overrides.json에 출처를 달아 직접 넣을 수 있다.
"""
import csv, json, os, re, unicodedata, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "html", "js", "data.js")
OVR = os.path.join(HERE, "state", "release_overrides.json")
OUT = os.path.join(HERE, "state", "release_dates.json")
PUBLIC_LICENSES = ("서울서체 이용조건",)  # 공유마당엔 공공누리로 등록됐지만 저작권자 조건을 따로 쓰는 기관 서체
PUBLIC_MAKERS = ("한국저작권위원회", "한국교육학술정보원", "의왕시청소련수련관", "의왕시청소년수련관")
GF_FIRST_SINCE = "2021-01-01"

def n(s): return re.sub(r"[^0-9a-z가-힣]", "", unicodedata.normalize("NFC", s or "").lower())
def clean(s):
    s = re.sub(r"\s+(R|L|B|M|EB|BL|Black|Outline|Regular|Light|Bold|Medium)$", "", (s or "").strip())
    return re.sub(r"(체)(R|L|B|M|EB|BL)$", r"\1", s)  # 서울남산체L → 서울남산체

src = open(DATA, encoding="utf-8").read()
fonts = [(m.group(1), m.group(2), m.group(3)) for m in re.finditer(r'\{ id: "([^"]+)", name: "([^"]*)", en: "([^"]+)"', src)]

# 공유마당 두 목록의 최초 등록일 (패밀리명 기준, 굵기 표기 제거)
first = {}
def take(name, date, url=None, author="", label=""):
    if not date: return
    for k in {n(clean(name)), n(clean(name)).removesuffix("체")}:  # '경기천년바탕체' ↔ '경기천년바탕'
        cur = first.get(k)
        if not cur or date < cur[0]: first[k] = (date, url, author or (cur[2] if cur else ""), label)
for r in csv.DictReader(open(os.path.join(HERE, "sources", "kcc_free_fonts_20250805.csv"), encoding="utf-8")):
    take(r["저작물명"], r["등록일자"], f"https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn={r['저작물일련번호']}&menuNo=200023", r["저작자"], "공유마당 등록일(제작 기관 배포)")
for r in csv.DictReader(open(os.path.join(HERE, "sources", "kcisa_font_table_20260827.csv"), encoding="utf-8")):
    take(r["제목"], r["등록일자"], None, r["저작권자"], "안심글꼴 목록 등록일(제작 기관 배포)")

raw = urllib.request.urlopen(urllib.request.Request("https://fonts.google.com/metadata/fonts", headers={"User-Agent": "letsum"}), timeout=60).read().decode()
gf = {f["family"]: f.get("dateAdded") for f in json.loads(raw[raw.index("{"):])["familyMetadataList"]}

ovr = json.load(open(OVR, encoding="utf-8")) if os.path.exists(OVR) else {}
out = {}
for fid, name, en in fonts:
    if fid in ovr:
        out[fid] = ovr[fid]; continue
    if en in gf:
        d = gf[en]
        if d and d >= GF_FIRST_SINCE:
            out[fid] = {"date": d, "src": "Google Fonts 최초 공개", "url": f"https://fonts.google.com/specimen/{en.replace(' ', '+')}"}
        continue
    hit = first.get(n(clean(name))) or first.get(n(clean(name)).removesuffix("체"))
    lic = (re.search(r'\{ id: "' + re.escape(fid) + r'".*?license: "([^"]+)"', src, re.S) or [None, ""])[1]
    if hit and (lic.startswith("공공누리") or lic in PUBLIC_LICENSES):  # 공공누리·지자체 이용조건은 공공기관 저작물 — 기관이 공유마당에 직접 등록한 날 = 배포일
        out[fid] = {"date": hit[0], "src": hit[3], "url": hit[1] or "https://gongu.copyright.or.kr/freeFontEvent_KOGL.html"}
    elif hit and any(p in (hit[2] or "") for p in PUBLIC_MAKERS):
        out[fid] = {"date": hit[0], "src": hit[3], "url": hit[1] or "https://gongu.copyright.or.kr/freeFontEvent_KOGL.html"}
    elif hit and fid.startswith("k-hakgyoansim"):  # 저작자 칸이 빈 학교안심(2025) — 제작사는 한국교육학술정보원
        out[fid] = {"date": hit[0], "src": hit[3], "url": hit[1] or "https://gongu.copyright.or.kr/freeFontEvent_KOGL.html"}

# data.js에 기록 (기존 released* 필드는 지우고 다시 씀)
src = re.sub(r'\n\s*released: "[^"]*", releasedSrc: "[^"]*", releasedUrl: "[^"]*",', "", src)
for fid, v in out.items():
    pat = re.compile(r'(\{ id: "' + re.escape(fid) + r'".*?)(\n(\s*)pair: )', re.S)
    m = pat.search(src)
    if not m: continue
    ins = f'\n{m.group(3)}released: "{v["date"]}", releasedSrc: "{v["src"]}", releasedUrl: "{v["url"]}",'
    src = src[:m.end(1)] + ins + src[m.end(1):]
open(DATA, "w", encoding="utf-8").write(src)
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
none = [name for fid, name, en in fonts if fid not in out]
print(f"출시일 확인 {len(out)}종 / 전체 {len(fonts)}종 · 빈 값 {len(none)}종")
print("빈 값:", ", ".join(none))
