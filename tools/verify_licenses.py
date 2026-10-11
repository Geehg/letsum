#!/usr/bin/env python3 -I
"""공공 안심글꼴(웹폰트) 폰트의 라이선스를 원 배포처 표기와 대조한다.
 - 공유마당 저작물 페이지(wrtSn 있음): '이용조건' 영역의 링크로 판정 (openfontlicense.org → OFL, kogl.or.kr 유형 → 공공누리 N유형, creativecommons → CCL)
 - 공유마당 페이지가 없는 폰트: 한국문화정보원 글꼴테이블의 '종류'(제작 기관이 등록한 라이선스 표기)와 대조
일치하면 data.js의 status를 verified로, verified 날짜를 오늘로 바꾼다. 불일치·판정 불가는 그대로 두고 보고한다.
"""
import csv, json, os, re, time, unicodedata, urllib.request
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "html", "js", "data.js")
UA = {"User-Agent": "Mozilla/5.0 (letsum-verify)"}
TODAY = date.today().isoformat()

def n(s): return re.sub(r"[^0-9a-z가-힣]", "", unicodedata.normalize("NFC", s or "").lower())
def clean(s): return re.sub(r"\s+(R|L|B|M|EB|Black|Outline|Regular|Light|Bold|Medium)$", "", (s or "").strip())

def gongu_license(url):
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "ignore")
    i = html.find("이용조건")
    if i < 0: return None, "이용조건 영역 없음"
    seg = html[i:i + 1500]
    if "openfontlicense" in seg or re.search(r"\bOFL\b", seg): return "OFL", "공유마당 이용조건: OFL"
    m = re.search(r"licenseType(\d)", seg) or re.search(r"제\s*(\d)\s*유형", seg)
    if m: return f"공공누리 제{m.group(1)}유형", f"공유마당 이용조건: 공공누리 {m.group(1)}유형"
    if "creativecommons" in seg: return "CCL", "공유마당 이용조건: CCL"
    return None, "판정 불가"

table = {}
for r in csv.DictReader(open(os.path.join(HERE, "sources", "kcisa_font_table_20260827.csv"), encoding="utf-8")):
    table.setdefault(n(clean(r["제목"])), set()).add((r["종류"] or "").strip())

src = open(DATA, encoding="utf-8").read()
rows = []
for m in re.finditer(r'\{ id: "(k-[^"]+)", name: "([^"]*)".*?dl: \{ page: "([^"]+)"', src, re.S):
    rows.append((m.group(1), m.group(2), m.group(3)))
ok, bad, unk, report = [], [], [], []
for fid, name, page in rows:
    if "wrtSn=" in page:
        try: lic, why = gongu_license(page)
        except Exception as e: lic, why = None, f"요청 실패 {e}"
        time.sleep(0.4)
    else:
        kinds = table.get(n(clean(name)), set())
        lic, why = ("OFL", "안심글꼴 목록 종류: OFL") if "OFL" in kinds else (None, f"안심글꼴 목록 종류: {','.join(kinds) or '없음'}")
    (ok if lic == "OFL" else bad if lic else unk).append(fid)
    report.append({"id": fid, "name": name, "license": lic, "evidence": why, "page": page})
for fid in ok:
    pat = re.compile(r'(\{ id: "' + re.escape(fid) + r'".*?)verified: "[^"]*", status: "[^"]*"', re.S)
    src = pat.sub(lambda mm: mm.group(1) + f'verified: "{TODAY}", status: "verified"', src, count=1)
open(DATA, "w", encoding="utf-8").write(src)
json.dump(report, open(os.path.join(HERE, "state", "license_check.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"OFL 일치 {len(ok)} · 불일치 {len(bad)} · 판정 불가 {len(unk)}")
for r in report:
    if r["license"] != "OFL": print("  -", r["name"], r["license"], r["evidence"], r["page"])
