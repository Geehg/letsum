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
def clean(s):
    s = re.sub(r"\s+(R|L|B|M|EB|BL|Black|Outline|Regular|Light|Bold|Medium)$", "", (s or "").strip())
    return re.sub(r"(체)(R|L|B|M|EB|BL)$", r"\1", s)  # 서울남산체L → 서울남산체

def gongu_license(url):
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "ignore")
    i = html.find("이용조건")
    if i < 0: return None, "이용조건 영역 없음"
    seg = html[i:i + 1500]
    if "openfontlicense" in seg or re.search(r"\bOFL\b", seg): return "OFL", "공유마당 이용조건: OFL"
    m = (re.search(r"licenseType(\d)", seg) or re.search(r"제\s*(\d)\s*유형", seg)
         or re.search(r"img_license0(\d)\.png", seg) or re.search(r"자유이용허락\s*(\d)\s*유형", seg))
    if m: return f"공공누리 제{m.group(1)}유형", f"공유마당 이용조건: 공공누리 {m.group(1)}유형"
    if "creativecommons" in seg: return "CCL", "공유마당 이용조건: CCL"
    return None, "판정 불가"

table = {}
for r in csv.DictReader(open(os.path.join(HERE, "sources", "kcisa_font_table_20260827.csv"), encoding="utf-8")):
    table.setdefault(n(clean(r["제목"])), set()).add((r["종류"] or "").strip())

LIC_MAP = {"OFL": "OFL", "KOGL(출처)": "공공누리 제1유형", "KOGL(출처/변경)": "공공누리 제3유형"}
kcc_type = {}
for r in csv.DictReader(open(os.path.join(HERE, "sources", "kcc_free_fonts_20250805.csv"), encoding="utf-8")):
    kcc_type[n(clean(r["저작물명"]))] = LIC_MAP.get(r["라이선스유형"], r["라이선스유형"])
src = open(DATA, encoding="utf-8").read()
# data.js를 node로 실제 실행해 항목을 읽는다(정규식이 다음 항목까지 넘어가 엉뚱한 값을 읽는 일을 막음)
import subprocess
_js = "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.F=FONTS',c);process.stdout.write(JSON.stringify(c.F))"
_F = json.loads(subprocess.run(["node", "-e", _js, DATA], capture_output=True, text=True, check=True).stdout)
rows = [(f["id"], f["name"], (f.get("dl") or {}).get("page", ""), f["license"]) for f in _F if f.get("webfont")]
MANUAL = {k: v for k, v in json.load(open(os.path.join(HERE, "state", "license_manual.json"), encoding="utf-8")).items() if not k.startswith("_")} \
    if os.path.exists(os.path.join(HERE, "state", "license_manual.json")) else {}
ok, bad, unk, report = [], [], [], []
for fid, name, page, want in rows:
    if fid in MANUAL:  # 직접 확인한 근거 — 자동 대조하지 않음
        v = MANUAL[fid]; lic = v["license"]
        (ok if lic == want else bad).append(fid)
        report.append({"id": fid, "name": name, "expected": want, "license": lic, "evidence": "직접 확인: " + v["evidence"], "page": v["page"]}); continue
    if "wrtSn=" in page:
        try: lic, why = gongu_license(page)
        except Exception as e: lic, why = None, f"요청 실패 {e}"
        time.sleep(0.4)
    else:
        kinds = table.get(n(clean(name)), set())
        if "OFL" in kinds: lic, why = "OFL", "안심글꼴 목록 종류: OFL"
        elif "KOGL" in kinds: lic, why = "공공누리(유형 미표기)", "안심글꼴 목록 종류: KOGL"
        else: lic, why = None, f"안심글꼴 목록 종류: {','.join(kinds) or '없음'}"
    # 공유마당 페이지가 유형까지 밝히면 정확히 일치해야 하고, 목록이 'KOGL'만 밝히면 공유마당 목록(저작권위원회 CSV)의 유형으로 대조
    if lic == "공공누리(유형 미표기)" and want.startswith("공공누리"): lic = want if kcc_type.get(n(clean(name))) == want else None
    (ok if lic == want else bad if lic else unk).append(fid)
    report.append({"id": fid, "name": name, "expected": want, "license": lic, "evidence": why, "page": page})
for fid in ok:
    m = re.search(r'\{ id: "' + re.escape(fid) + r'".*?desc: "[^"]*" \},', src, re.S)  # 이 항목의 블록만
    if not m: continue
    blk = re.sub(r'verified: "[^"]*", status: "[^"]*"', f'verified: "{TODAY}", status: "verified"', m.group(0), count=1)
    src = src[:m.start()] + blk + src[m.end():]
open(DATA, "w", encoding="utf-8").write(src)
json.dump(report, open(os.path.join(HERE, "state", "license_check.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"일치 {len(ok)} · 불일치 {len(bad)} · 판정 불가 {len(unk)}")
for r in report:
    if r["license"] != r["expected"]: print("  -", r["name"], "기대", r["expected"], "확인", r["license"], r["evidence"], r["page"])
