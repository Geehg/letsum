#!/usr/bin/env python3 -I
"""피드 카드 프로필 아이콘 — 폰트의 배포 주체(저작권자 기관·회사, 없으면 배포처) 사이트 아이콘을 받아 html/img/src/에 둔다.
방문자 브라우저가 외부에 요청하지 않도록 빌드할 때 한 번만 받는다(Google 파비콘 서비스, 64px PNG).
결과: html/data/avatars.json  { "<font id>": { "icon": "img/src/<domain>.png", "label": "<표시 이름>" } }
사용: python3 -I tools/fetch_icons.py   (이미 받은 아이콘은 건너뜀, --force로 다시 받기)
"""
import json, os, subprocess, sys, urllib.request, urllib.parse, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
OUT = os.path.join(ROOT, "html", "img", "src"); os.makedirs(OUT, exist_ok=True)
js = "const vm=require('vm'),fs=require('fs');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.o=FONTS',c);process.stdout.write(JSON.stringify(c.o))"
FONTS = json.loads(subprocess.run(["node", "-e", js, os.path.join(ROOT, "html", "js", "data.js")], capture_output=True, text=True, check=True).stdout)
HD = {k: v for k, v in json.load(open(os.path.join(HERE, "state", "holder_domains.json"), encoding="utf-8")).items() if not k.startswith("_")}
SRC_LABEL = {"fonts.google.com": "Google Fonts", "gongu.copyright.or.kr": "공유마당"}

def domain_of(f):
    for h in [f.get("holder", "")] + [x.strip() for x in f.get("holder", "").replace("·", ",").split(",")]:
        if h in HD: return HD[h], h
    page = (f.get("dl") or {}).get("page") or "https://fonts.google.com/"
    d = urllib.parse.urlparse(page).hostname.removeprefix("www.")
    if d == "blog.naver.com": return None, None
    return d, SRC_LABEL.get(d, f.get("holder"))

def fetch(d):
    p = os.path.join(OUT, d + ".png")
    if os.path.exists(p) and "--force" not in sys.argv: return p
    for q in (d, "www." + d):  # 기관 사이트는 www.가 붙어야 아이콘이 잡히는 경우가 많다
        req = urllib.request.Request(f"https://www.google.com/s2/favicons?domain={q}&sz=64", headers={"User-Agent": "LETSUM-icons/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
                if r.status != 200 or len(data) < 200 or not data.startswith(b"\x89PNG"): continue
        except Exception:
            continue  # 404 = 아이콘 없음(기본 지구본)
        open(p, "wb").write(data); return p
    # 2차: 사이트의 /favicon.ico를 직접 받아 PNG로 변환(Pillow 필요 — 없으면 건너뜀)
    try:
        from PIL import Image
        import io
    except ImportError:
        return None
    import re
    cands = []
    for q in ("https://www." + d, "https://" + d):
        cands.append(q + "/favicon.ico")
        try:  # 3차: 홈페이지의 <link rel="icon" href=...>
            with urllib.request.urlopen(urllib.request.Request(q + "/", headers={"User-Agent": "Mozilla/5.0 LETSUM-icons/1.0"}), timeout=15) as r:
                html = r.read(300000).decode("utf-8", "ignore"); base = r.geturl()
            js_go = re.search(r'^\s*location\.href\s*=\s*["\']([^"\']+)', html, re.M)  # 스크립트로 메인 페이지 이동하는 기관 사이트
            if js_go and len(html) < 2000:
                with urllib.request.urlopen(urllib.request.Request(urllib.parse.urljoin(base, js_go.group(1)), headers={"User-Agent": "Mozilla/5.0 LETSUM-icons/1.0"}), timeout=15) as r2:
                    html = r2.read(300000).decode("utf-8", "ignore"); base = r2.geturl()
            for m in re.finditer(r'<link[^>]+rel=["\'][^"\']*icon[^"\']*["\'][^>]*>', html, re.I):
                h = re.search(r'href=["\']([^"\']+)', m.group(0))
                if h and not h.group(1).endswith(".svg"): cands.append(urllib.parse.urljoin(base, h.group(1)))
        except Exception:
            pass
    for q in cands:
        try:
            req = urllib.request.Request(q, headers={"User-Agent": "Mozilla/5.0 LETSUM-icons/1.0"})
            with urllib.request.urlopen(req, timeout=15) as r:
                data = r.read()
            im = Image.open(io.BytesIO(data)); im.load()
            if max(im.size) < 16: continue
            im = im.convert("RGBA"); im.thumbnail((64, 64))
            im.save(p, "PNG", optimize=True); return p
        except Exception:
            continue
    return None  # → 글자 아바타 사용

out, got, miss = {}, {}, set()
for f in FONTS:
    d, label = domain_of(f)
    if not d: continue
    if d not in got: got[d] = fetch(d)
    if got[d]: out[f["id"]] = {"icon": f"img/src/{d}.png", "label": label or d}
    else: miss.add(d)
json.dump(out, open(os.path.join(ROOT, "html", "data", "avatars.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"아이콘 {sum(1 for v in got.values() if v)}개 도메인 · 폰트 {len(out)}/{len(FONTS)}종 연결 · 없음: {', '.join(sorted(miss)) or '-'}")
