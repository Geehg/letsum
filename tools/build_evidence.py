#!/usr/bin/env python3 -I
"""확인 근거 모음 — 사용 조건 확인 기록·상세 창에 '무엇을 근거로 판단했는지'를 보여 주기 위한 정적 파일.
입력: tools/state/license_check.json(원문 대조 결과·근거 페이지), license_manual.json(사람이 직접 확인한 근거),
      webfonts.json(원본 파일 출처), 미리보기 파일의 name 테이블(폰트 버전)
결과: html/data/evidence.json  { "<id>": { "ev": 근거 요약, "pg": 근거 페이지, "src": 원본 출처, "ver": 폰트 버전 } }
사용: python -I tools/build_evidence.py <미러 webfonts 폴더>
"""
import sys, os, json, subprocess
from fontTools.ttLib import TTFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
js = "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.o=FONTS',c);process.stdout.write(JSON.stringify(c.o))"
FONTS = json.loads(subprocess.run(["node", "-e", js, os.path.join(ROOT, "html", "js", "data.js")], capture_output=True, text=True, check=True).stdout)
st = lambda n: json.load(open(os.path.join(HERE, "state", n), encoding="utf-8"))
chk = {r["id"]: r for r in st("license_check.json")}; man = st("license_manual.json"); wf = st("webfonts.json")
mirror = sys.argv[1] if len(sys.argv) > 1 else None; out = {}
for f in FONTS:
    fid = f["id"]; r = {}
    m = man.get(fid); c = chk.get(fid)
    if m: r["ev"], r["pg"] = m.get("evidence", ""), m.get("page", "")
    elif c: r["ev"], r["pg"] = c.get("evidence", ""), c.get("page", "")
    elif not f.get("webfont") and not f.get("intro"): r["ev"], r["pg"] = "Google Fonts 메타데이터의 라이선스 항목(OFL)", f"https://fonts.google.com/specimen/{f['en'].replace(' ', '+')}/license"
    if wf.get(fid, {}).get("source"): r["src"] = wf[fid]["source"]
    url = next(iter((f.get("webfont") or {}).values()), None)
    if url and mirror:
        if "/fonts-hosted/" in url: p = os.path.join(HERE, "archive", "hosted", url.split("/fonts-hosted/")[1])
        elif url.startswith("https://geehg.github.io/"): p = os.path.join(mirror, fid, url.rsplit("/", 1)[1])
        else: p = os.path.join(HERE, "archive", "cdn", fid, next(w for w, u in f["webfont"].items() if u == url) + "." + url.rsplit(".", 1)[1])  # 배포처 공식 CDN 캐시
        try:
            v = TTFont(p, lazy=True)["name"].getDebugName(5)
            if v: r["ver"] = v.strip()[:80]
        except Exception: pass
    if r: out[fid] = r
json.dump(out, open(os.path.join(ROOT, "html", "data", "evidence.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"근거 {len(out)}종 · 버전 {sum(1 for v in out.values() if 'ver' in v)}종 · 근거 없음 {len(FONTS) - sum(1 for v in out.values() if 'ev' in v)}종")
