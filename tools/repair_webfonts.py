#!/usr/bin/env python3 -I
"""미리보기 웹폰트의 '부속 표' 기술 수리 — 브라우저 보안 검사(OTS)가 파일을 거부하는 경우만.
글리프(글자 모양)·cmap·자간은 건드리지 않는다. 대상은 변경이 허용된 라이선스(공공누리 제1유형, RFN 없는 OFL)만.
고치는 것: ① CFF 내부 이름(PostScript 이름에 공백 등) ② vhea 표 버전 ③ 깨진 kern 표(GPOS가 있으면 제거)
          ④ name 레코드 정렬(저장 시 자동)
사용: python -I tools/repair_webfonts.py <미러 webfonts 폴더> <id> [<id> ...]   → 같은 자리에 덮어쓰고 tools/state/webfonts.json에 기록
"""
import sys, os, re, json
from fontTools.ttLib import TTFont
HERE = os.path.dirname(os.path.abspath(__file__))
root, ids = sys.argv[1], sys.argv[2:]
W = os.path.join(HERE, "state", "webfonts.json"); WF = json.load(open(W, encoding="utf-8"))
ps = lambda s: re.sub(r"[^A-Za-z0-9-]", "", s)[:63] or "LetsumPreview"
for fid in ids:
    lic = (WF.get(fid) or {}).get("license", "")
    if not (lic.startswith("공공누리 제1유형") or lic == "OFL"):
        print("건너뜀(라이선스):", fid, lic); continue
    for fn in sorted(os.listdir(os.path.join(root, fid))):
        if not fn.endswith(".woff2"): continue
        p = os.path.join(root, fid, fn); f = TTFont(p); done = []
        if lic == "OFL" and "Reserved Font Name" in (f["name"].getDebugName(0) or ""):
            print("건너뜀(OFL 예약 이름):", fid); break
        if "CFF " in f:
            cff = f["CFF "].cff; new = [ps(n) for n in cff.fontNames]
            if new != cff.fontNames: done.append(f"CFF 이름 {cff.fontNames}→{new}"); cff.fontNames = new
        if "vhea" in f and f["vhea"].tableVersion not in (0x00010000, 0x00011000):
            done.append(f"vhea {hex(f['vhea'].tableVersion)}→0x11000"); f["vhea"].tableVersion = 0x00011000
        if "kern" in f and "GPOS" in f:
            del f["kern"]; done.append("kern 제거(GPOS 있음)")
        elif "kern" in f:
            try: f["kern"].kernTables
            except Exception: del f["kern"]; done.append("kern 제거(손상)")
        f.flavor = "woff2"; f.save(p); done.append("name 정렬·재저장")
        r = WF.setdefault(fid, {}).setdefault("repair", [])
        r.append({"file": fn, "fixes": done}); print(fid, fn, "; ".join(done))
json.dump(WF, open(W, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
