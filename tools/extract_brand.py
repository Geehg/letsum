#!/usr/bin/env python3
"""제작사 소개 페이지에서 히어로 브랜드 색 후보를 뽑는다 (AI 없음, 계산만).

출처(점수 순):
  1) <meta name="theme-color">                        — 사이트가 직접 정한 대표색
  2) CSS 변수 중 이름에 color/primary/brand/main/point — 디자인 시스템 색
  3) 페이지·같은 도메인 CSS에 자주 쓰인 색             — 빈도
  4) 대표 이미지(og:image)의 주요 색                   — Pillow가 있으면(없으면 건너뜀)

결과: html/data/brand_candidates.json
  { generated, items: { 폰트id: { page, palette: [{hex, score, src}], suggest: {bg, fg, ac, acInk}, error? } } }
html/data/brand_auto.json — 추천 색만 담은 가벼운 파일. 사이트가 관리자 확인 전에도 기본으로 히어로에 적용한다.
관리자 페이지(히어로 테마)는 후보 팔레트를 보여 주고, 저장한 테마(서버)가 자동 추천보다 우선한다.

대상: 최근 출시 365일 이내 또는 최근 등록 60일 이내 폰트(기본). --all 이면 전체, --id 로 하나만.
예의: robots.txt 확인, 페이지당 1초 간격, 같은 주소는 한 번만 받음, 응답 크기 제한.
"""
import json, re, sys, time, io, colorsys, subprocess, urllib.request, urllib.parse, urllib.robotparser
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "html/data/brand_candidates.json"
UA = "LETSUM-brand-color-check/1.0 (+https://letsum.app)"
MAX_HTML, MAX_CSS, MAX_IMG = 1_500_000, 400_000, 4_000_000

try:
    from PIL import Image  # 선택
except Exception:
    Image = None


def load_fonts():
    js = r"""const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');
const F=new Function(s+';return FONTS')();
console.log(JSON.stringify(F.map(f=>({id:f.id,name:f.name,page:(f.dl||{}).page||'',brandPage:f.brandPage||'',released:f.released||'',added:f.added||'',holder:f.holder||f.designer||'',intro:!!f.intro}))));"""
    out = subprocess.run(["node", "-e", js, str(ROOT / "html/js/data.js")], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


_robots = {}
def allowed(url):
    p = urllib.parse.urlsplit(url); base = f"{p.scheme}://{p.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser(); rp.set_url(base + "/robots.txt")
        try: rp.read()
        except Exception: rp = None
        _robots[base] = rp
    rp = _robots[base]
    return True if rp is None else rp.can_fetch(UA, url)


def get(url, limit):
    if not allowed(url): raise RuntimeError("robots.txt 차단")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = r.read(limit + 1)
        if len(data) > limit: data = data[:limit]
        return data, r.headers.get("content-type", ""), r.geturl()


def norm(c):
    c = c.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{3})", c)
    if m: return "#" + "".join(ch * 2 for ch in m.group(1))
    m = re.fullmatch(r"#([0-9a-f]{6})(?:[0-9a-f]{2})?", c)
    if m: return "#" + m.group(1)
    m = re.fullmatch(r"rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)", c)
    if m:
        if m.group(4):
            a = m.group(4); a = float(a[:-1]) / 100 if a.endswith("%") else float(a)
            if a < 0.6: return None
        return "#%02x%02x%02x" % tuple(min(255, int(v)) for v in m.group(1, 2, 3))
    return None


def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def hexs(t): return "#%02x%02x%02x" % tuple(max(0, min(255, round(v))) for v in t)
def lum(h):
    def ch(v):
        v /= 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb(h); return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
def contrast(a, b):
    la, lb = lum(a), lum(b); return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
def sat(h):
    r, g, b = (v / 255 for v in rgb(h)); return colorsys.rgb_to_hls(r, g, b)[2]
def light(h):
    r, g, b = (v / 255 for v in rgb(h)); return colorsys.rgb_to_hls(r, g, b)[1]
def mix(a, b, t): return hexs(tuple(x * (1 - t) + y * t for x, y in zip(rgb(a), rgb(b))))
def dist(a, b): return sum((x - y) ** 2 for x, y in zip(rgb(a), rgb(b))) ** 0.5


COLOR_RE = re.compile(r"#[0-9a-fA-F]{3}(?![0-9a-fA-F])|#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F])|rgba?\([^)]{5,40}\)")
VAR_RE = re.compile(r"--[\w-]*(?:color|primary|brand|main|point|accent|key|theme)[\w-]*\s*:\s*([^;}{]+)", re.I)


def palette_for(page):
    score, src = {}, {}
    def add(h, s, where):
        if not h: return
        score[h] = score.get(h, 0) + s; src.setdefault(h, where)
    html, ctype, final = get(page, MAX_HTML)
    text = html.decode("utf-8", "ignore")
    m = re.search(r'<meta[^>]+name=["\']theme-color["\'][^>]*content=["\']([^"\']+)', text, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*name=["\']theme-color', text, re.I)
    if m: add(norm(m.group(1)), 40, "theme-color")
    css = [text]
    host = urllib.parse.urlsplit(final).netloc
    for href in re.findall(r'<link[^>]+rel=["\']?stylesheet["\']?[^>]*href=["\']([^"\']+)', text, re.I)[:4] + \
                re.findall(r'<link[^>]+href=["\']([^"\']+\.css[^"\']*)["\'][^>]*rel=["\']?stylesheet', text, re.I)[:2]:
        u = urllib.parse.urljoin(final, href)
        if urllib.parse.urlsplit(u).netloc != host: continue
        try: css.append(get(u, MAX_CSS)[0].decode("utf-8", "ignore")); time.sleep(0.5)
        except Exception: pass
    blob = "\n".join(css)
    for v in VAR_RE.findall(blob):
        for c in COLOR_RE.findall(v): add(norm(c), 8, "CSS 변수")
    for c in COLOR_RE.findall(blob): add(norm(c), 1, "CSS 빈도")
    og = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]*content=["\']([^"\']+)', text, re.I) or \
         re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*property=["\']og:image', text, re.I)
    if og and Image is not None:
        try:
            data = get(urllib.parse.urljoin(final, og.group(1)), MAX_IMG)[0]
            im = Image.open(io.BytesIO(data)).convert("RGB"); im.thumbnail((200, 200))
            q = im.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
            pal = q.getpalette()[:24]; counts = sorted(q.getcolors(), reverse=True)
            total = sum(n for n, _ in counts) or 1
            for n, idx in counts:
                add(hexs(pal[idx * 3: idx * 3 + 3]), 30 * n / total, "대표 이미지")
        except Exception:
            pass
    # 비슷한 색 합치기(거리 < 28)
    merged = []
    for h, s in sorted(score.items(), key=lambda x: -x[1]):
        for m_ in merged:
            if dist(m_["hex"], h) < 28: m_["score"] += s; break
        else:
            merged.append({"hex": h, "score": s, "src": src[h]})
    merged.sort(key=lambda x: -x["score"])
    for m_ in merged: m_["score"] = round(m_["score"], 1)
    return merged[:12]


# 웹 프레임워크 기본색(부트스트랩 등)은 브랜드 색이 아님
FRAMEWORK = {"#337ab7", "#007bff", "#0d6efd", "#428bca", "#2196f3", "#3f51b5", "#286090", "#23527c", "#0275d8", "#5cb85c", "#d9534f", "#f0ad4e", "#5bc0de", "#17a2b8", "#28a745", "#dc3545", "#ffc107", "#6c757d"}


def suggest(pal):
    cols = [p["hex"] for p in pal if p["hex"] not in FRAMEWORK]
    vivid = [c for c in cols if sat(c) > 0.35 and 0.18 < light(c) < 0.75]
    if not vivid: return None
    ac = vivid[0]
    lights = [c for c in cols if light(c) > 0.8 and c not in ("#ffffff",) and sat(c) > 0.2]
    bg = lights[0] if lights else mix(ac, "#ffffff", 0.78)
    darks = [c for c in cols if contrast(c, bg) >= 7]
    fg = darks[0] if darks else mix(ac, "#000000", 0.62)
    if contrast(fg, bg) < 7: fg = "#111111"
    if contrast(ac, bg) < 3:  # 강조색이 배경과 너무 비슷하면 진하게
        for t in (0.2, 0.35, 0.5):
            if contrast(mix(ac, "#000000", t), bg) >= 3: ac = mix(ac, "#000000", t); break
    ink = "#ffffff" if contrast("#ffffff", ac) >= contrast(fg, ac) else fg
    return {"bg": bg, "fg": fg, "ac": ac, "acInk": ink}


def main():
    args = sys.argv[1:]
    fonts = load_fonts()
    if "--id" in args:
        want = args[args.index("--id") + 1]; fonts = [f for f in fonts if f["id"] == want]
    elif "--all" not in args:
        y, a = (date.today() - timedelta(days=365)).isoformat(), (date.today() - timedelta(days=60)).isoformat()
        fonts = [f for f in fonts if (f["released"] and f["released"] >= y) or (f["added"] and f["added"] >= a)]
    # 여러 제작사가 같이 쓰는 주소 = 배포 플랫폼(공유마당 등) → 제작사 색이 아니므로 추천하지 않음
    host = lambda u: urllib.parse.urlsplit(u).netloc.lower()
    holders = {}
    for f in load_fonts():
        holders.setdefault(host(f["page"]), set()).add(f["holder"])
    platform = {h for h, hs in holders.items() if len(hs) >= 3}
    old = json.loads(OUT.read_text()) if OUT.exists() else {"items": {}}
    items, cache = old.get("items", {}), {}
    for f in fonts:
        page = f["brandPage"] or f["page"]
        if not page.startswith("http"): continue
        if host(page) in platform and not f["brandPage"]:
            items[f["id"]] = {"page": page, "palette": [], "error": "여러 제작사가 함께 쓰는 배포 플랫폼 주소 — 제작사 페이지(brandPage)를 지정하면 추출"}
            continue
        if page not in cache:
            try: cache[page] = {"palette": palette_for(page)}
            except Exception as e: cache[page] = {"palette": [], "error": str(e)[:120]}
            time.sleep(1)
        r = cache[page]
        it = {"page": page, "palette": r["palette"]}
        s = suggest(r["palette"]) if r["palette"] else None
        if s: it["suggest"] = s
        if r.get("error"): it["error"] = r["error"]
        items[f["id"]] = it
        print(f'{f["id"]}: {len(it["palette"])}색 {"추천 " + json.dumps(s) if s else it.get("error", "추천 없음")}')
    OUT.write_text(json.dumps({"generated": date.today().isoformat(), "items": items}, ensure_ascii=False, indent=1) + "\n")
    # 사이트가 읽는 가벼운 파일: 추천 색만(관리자 확인 전에도 기본으로 게시됨)
    (ROOT / "html/data/brand_auto.json").write_text(json.dumps({k: v["suggest"] for k, v in sorted(items.items()) if v.get("suggest")}, separators=(",", ":")) + "\n")
    print(f"→ {OUT.relative_to(ROOT)} ({len(items)}종)")


if __name__ == "__main__":
    main()
