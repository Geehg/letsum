#!/usr/bin/env python3 -I
"""글자 지원 판정용 실제 글리프 목록 — 미리보기 웹폰트 파일에서 '실제로 그려진' 글자만 센다.
cmap에 있어도 윤곽선이 비어 있으면(빈 글자) 지원하지 않는 것으로 본다(예: GS혜자로운체는 11,172칸 중 2,8xx자만 그려짐).
결과: html/data/coverage.json  { "<id>": { "n": 한글 수, "h": "<11,172비트 base64 — 없으면 한글 완성형 전체>", "hanja": bool, "old": bool, "jamo": 낱자 ㄱ~ㅣ 51자 모두 } }
사용: python -I tools/build_coverage.py <미러 webfonts 폴더>   (서버 전용 폰트는 tools/archive/hosted에서 읽음)
"""
import sys, os, json, base64, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import ControlBoundsPen
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
js = "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.o=FONTS',c);process.stdout.write(JSON.stringify(c.o))"
FONTS = json.loads(subprocess.run(["node", "-e", js, os.path.join(ROOT, "html", "js", "data.js")], capture_output=True, text=True, check=True).stdout)
mirror = sys.argv[1]; out = {}
def real(font, gs, names):
    ok = set(); glyf = font["glyf"] if "glyf" in font else None
    for name in set(names):
        if glyf is not None:
            if glyf[name].numberOfContours != 0: ok.add(name)
        else:
            p = ControlBoundsPen(gs); gs[name].draw(p)
            if p.bounds: ok.add(name)
    return ok
for f in FONTS:
    wf = f.get("webfont")
    if not wf: continue
    w = "400" if "400" in wf else sorted(wf)[0]; url = wf[w]
    if not url.startswith("https://geehg.github.io/") and "/fonts-hosted/" not in url:  # 배포처 공식 CDN → 내려받아 둔 캐시
        p = os.path.join(HERE, "archive", "cdn", f["id"], next(w for w, u in f["webfont"].items() if u == url) + "." + url.split("?")[0].rsplit(".", 1)[1])
    elif "/fonts-hosted/" in url: p = os.path.join(HERE, "archive", "hosted", url.split("/fonts-hosted/")[1])
    else: p = os.path.join(mirror, f["id"], url.split("?")[0].rsplit("/", 1)[1])
    if not os.path.exists(p): print("파일 없음:", f["id"], p); continue
    font = TTFont(p, lazy=True); cmap = font.getBestCmap() or {}; gs = font.getGlyphSet()
    hk = [k for k in cmap if 0xAC00 <= k <= 0xD7A3]
    hj = [k for k in cmap if 0x4E00 <= k <= 0x9FFF][:400]
    od = [k for k in cmap if 0x1100 <= k <= 0x11FF or 0xA960 <= k <= 0xA97F or 0xD7B0 <= k <= 0xD7FF][:200]
    jm = [k for k in range(0x3131, 0x3164) if k in cmap]  # 호환 자모 ㄱ~ㅣ 51자
    good = real(font, gs, [cmap[k] for k in hk + hj + od + jm])
    have = [k for k in hk if cmap[k] in good]
    rec = {"n": len(have), "hanja": sum(1 for k in hj if cmap[k] in good) >= 50, "old": sum(1 for k in od if cmap[k] in good) >= 50, "jamo": sum(1 for k in jm if cmap[k] in good) == 51}
    if len(have) < 11172:
        bits = bytearray(1397)
        for k in have: i = k - 0xAC00; bits[i >> 3] |= 1 << (i & 7)
        rec["h"] = base64.b64encode(bytes(bits)).decode()
    out[f["id"]] = rec
    if rec["n"] != f.get("cov"): print(f"{f['id']}: data.js cov {f.get('cov')} → 실제 {rec['n']}")
json.dump(out, open(os.path.join(ROOT, "html", "data", "coverage.json"), "w"), separators=(",", ":"))
print(f"완료 {len(out)}종 · 부분 지원 {sum(1 for v in out.values() if 'h' in v)}종")

# data.js의 글자 수 표시(cov·glyphs)와 옛한글·한자 표시를 실제 값으로 맞춘다(생성 필드 — 손으로 고치지 말 것)
import re
DATA = os.path.join(ROOT, "html", "js", "data.js"); src = open(DATA, encoding="utf-8").read(); changed = 0
for fid, rec in out.items():
    m = re.search(r'\{ id: "' + re.escape(fid) + r'".*?desc: "[^"]*"[^}]*\},', src, re.S)
    if not m: continue
    b = m.group(0); nb = re.sub(r'cov: \d+', f'cov: {rec["n"]}', b, count=1)
    nb = re.sub(r'glyphs: "한글 [\d,]+자', f'glyphs: "한글 {rec["n"]:,}자', nb, count=1)
    nb = re.sub(r'old: (true|false)', f'old: {"true" if rec["old"] else "false"}', nb, count=1)
    nb = re.sub(r'hanja: (true|false)', f'hanja: {"true" if rec["hanja"] else "false"}', nb, count=1)
    if nb != b: src = src[:m.start()] + nb + src[m.end():]; changed += 1
open(DATA, "w", encoding="utf-8").write(src)
print(f"data.js 글자 수 표시 갱신 {changed}종")
