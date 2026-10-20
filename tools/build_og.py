#!/usr/bin/env python3
"""카카오톡·SNS 링크 미리보기 카드(og:image, 1200×630)를 만든다 (AI 없음).

  - html/img/og-main.png       : 사이트 대표 카드(홈·가이드 등)
  - html/img/og/<id>.png       : 폰트별 카드 — 폰트 이름·예문을 그 폰트로 직접 그림(/font/<id>.html 공유용)

폰트 파일: 사이트 미리보기·배포처 공식 웹폰트(data.js webfont), Google Fonts는 google/fonts 원본.
로컬에 받아 둔 파일(../letsum-mirror/webfonts, tools/archive/cdn)이 있으면 그것을 먼저 쓴다.
받은 파일은 tools/state/og_fonts/ 에 TTF로 캐시(저장소에 올리지 않음).
사용: python tools/build_og.py [--id 폰트ID] [--main] [--en (영문 폰트 전체 또는 --id와 함께)] [--db (딩벳 폰트)]
필요: Pillow, fontTools, brotli
"""
import io, json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_names import load_fonts, gf_files, get  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "html/img/og"
CACHE = ROOT / "tools/state/og_fonts"
MIRROR = ROOT.parent / "letsum-mirror/webfonts"
W, H = 1200, 630
PAPER, INK, INK2, LIME, LIME_INK, RULE = "#f4f2ec", "#15140f", "#5a584f", "#d8ff4a", "#243300", "#d9d5ca"
SAMPLE = "책을 읽는 시간은 언제나 옳다"
LIC = {"print": "인쇄", "web": "웹", "video": "영상", "embed": "임베딩"}


def ttf_bytes(data, dehint=False):
    """woff/woff2도 PIL이 읽을 수 있는 TTF/OTF로 바꿈. dehint: 힌팅 명령을 지움(FreeType이 못 읽는 폰트용)."""
    t = TTFont(io.BytesIO(data))
    t.flavor = None
    for k in ("EBDT", "EBLC", "EBSC", "bdat", "bloc", "CBDT", "CBLC"):  # 일부만 든 내장 비트맵은 FreeType 오류('Bitmap missing') → 윤곽선으로 그림
        if k in t: del t[k]
    if dehint and "glyf" in t:
        for k in ("fpgm", "prep", "cvt ", "hdmx", "LTSH", "VDMX"):
            if k in t: del t[k]
        for g in t["glyf"].glyphs.values():
            if hasattr(g, "program"): g.program = __import__("fontTools.ttLib.tables.ttProgram", fromlist=["Program"]).Program(); g.program.fromBytecode(b"")
    b = io.BytesIO(); t.save(b)
    return b.getvalue()


def font_file(f, prefer=700):
    """폰트 파일 1개(굵기는 prefer에 가장 가까운 것) → 캐시된 TTF 경로."""
    ws = f["weights"] or [400]
    w = min(ws, key=lambda x: (abs(x - prefer), -x))
    dst = CACHE / f"{f['id']}-{w}.ttf"
    if dst.exists(): return dst, w
    url = (f["webfont"] or {}).get(str(w))
    data = None
    for d in (MIRROR / f["id"], ROOT / "tools/archive/cdn" / f["id"], ROOT / "tools/archive/hosted" / f["id"]):
        for p in sorted(d.glob(f"{w}.*")) if d.exists() else []:
            if p.suffix.lower() in (".woff2", ".woff", ".ttf", ".otf"): data = p.read_bytes(); break
        if data: break
    if data is None and url: data = get(url)
    if data is None:  # Google Fonts 원본
        files = gf_files(f["en"])
        if not files: return None, w
        gw, gu = min(files, key=lambda x: abs(x[0] - w))
        data = get(gu)
    CACHE.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(ttf_bytes(data))
    return dst, w


def load(path, size, wght=None):
    ft = ImageFont.truetype(str(path), size)
    if wght:
        try:
            axes = ft.get_variation_axes()
            ft.set_variation_by_axes([max(a["minimum"], min(a["maximum"], wght)) if a.get("name", b"") in (b"Weight", "Weight") else a["default"] for a in axes])
        except Exception: pass
    return ft


def covers(path, text):
    cmap = TTFont(str(path), fontNumber=0, lazy=True).getBestCmap() or {}
    return all(ord(c) in cmap for c in text if not c.isspace())


def fit(path, text, maxw, start, wght=None, minsize=40):
    s = start
    while s > minsize:
        ft = load(path, s, wght)
        if ft.getlength(text) <= maxw: return ft
        s -= 4
    return load(path, minsize, wght)


UI = {}
def ui(w, size):
    """화면 글자: 프리텐다드(사이트와 같은 글꼴)."""
    key = (w, size)
    if key not in UI:
        pw = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-{}.woff2"  # 캐시가 없을 때(GitHub Actions) 공식 웹폰트
        p, _ = font_file({"id": "k-pretendard", "weights": [400, 500, 700, 800], "en": "Pretendard",
                          "webfont": {"400": pw.format("Regular"), "500": pw.format("Medium"), "700": pw.format("Bold"), "800": pw.format("ExtraBold")}}, w)
        UI[key] = ImageFont.truetype(str(p), size)
    return UI[key]


def logo(height, dark=False):
    im = Image.open(ROOT / f"html/img/{'logo-dark' if dark else 'logo'}.png").convert("RGBA")
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def pill(d, x, y, text, font, fg, bg, pad=(16, 9), outline=None):
    tw = d.textlength(text, font=font); bb = font.getbbox("가")
    h = bb[3] - bb[1] + pad[1] * 2
    d.rounded_rectangle([x, y, x + tw + pad[0] * 2, y + h], radius=h // 2, fill=bg, outline=outline, width=2 if outline else 0)
    d.text((x + pad[0], y + pad[1] - bb[1]), text, font=font, fill=fg)
    return x + tw + pad[0] * 2


def save(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, optimize=True)


def card_font(f, fonts_by_id):
    path, w = font_file(f)
    if not path: return False
    wght = w if "fvar" in TTFont(str(path), lazy=True) else None
    im = Image.new("RGB", (W, H), PAPER); d = ImageDraw.Draw(im)
    lg = logo(46); im.paste(lg, (64, 52), lg)
    x = W - 64
    cat = f["category"]; tw = d.textlength(cat, font=ui(700, 24)) + 32
    pill(d, x - tw, 56, cat, ui(700, 24), INK, PAPER, outline=INK)
    # 폰트 이름(그 폰트로) — 글자가 빠진 폰트는 프리텐다드로
    name_font = fit(path, f["name"], W - 128, 150, wght) if covers(path, f["name"]) else ui(800, 120)
    bb = name_font.getbbox(f["name"])
    try: d.text((64, 150 - bb[1] + max(0, (150 - (bb[3] - bb[1])) // 2)), f["name"], font=name_font, fill=INK)
    except OSError:  # 일부 글리프를 FreeType가 못 그리는 폰트 — 이 줄만 프리텐다드로
        name_font = ui(800, 120); bb = name_font.getbbox(f["name"]); d.rectangle([0, 120, W, 320], fill=PAPER)
        d.text((64, 150 - bb[1]), f["name"], font=name_font, fill=INK)
    sample = SAMPLE if covers(path, SAMPLE) else f["en"]
    sf = fit(path, sample, W - 128, 56, wght, 28)
    sb = sf.getbbox(sample)
    try: d.text((64, 345 - sb[1]), sample, font=sf, fill=INK2)
    except OSError:
        sf = ui(500, 48); sb = sf.getbbox(sample); d.rectangle([0, 330, W, 430], fill=PAPER); d.text((64, 345 - sb[1]), sample, font=sf, fill=INK2)
    # 아래 띠: 사용 범위 + 주소
    d.rectangle([0, H - 150, W, H], fill=INK)
    d.text((64, H - 124), "상업용 무료 · " + f["glyphs"], font=ui(500, 24), fill="#b7b4a9")
    x = 64; y = H - 78
    for k, label in LIC.items():
        st = (f.get("matrix") or {}).get(k)
        if st == "ok": x = pill(d, x, y, label + " ✓", ui(700, 24), LIME_INK, LIME) + 10
        elif st == "cond": x = pill(d, x, y, label + " 조건부", ui(700, 24), "#f1efe8", INK, outline="#8f8d84") + 10
        elif st == "no": x = pill(d, x, y, label + " ✕", ui(700, 24), "#8f8d84", INK, outline="#3a3a34") + 10
    t = "letsum.app"; d.text((W - 64 - d.textlength(t, font=ui(700, 30)), H - 98), t, font=ui(700, 30), fill=LIME)
    save(im, OUT / f"{f['id']}.png")
    return True


def liga_chars(path, words):
    """합자로 아이콘을 만드는 글꼴(Material): 단어 → 합자 글리프 → 그 글리프의 코드포인트(PUA). PIL에 합자 처리(raqm)가 없어 직접 찾는다."""
    t = TTFont(str(path)); cmap = t.getBestCmap(); rev = {g: c for c, g in cmap.items()}; out = []
    ligs = {}
    if "GSUB" in t:
        for lk in t["GSUB"].table.LookupList.Lookup:
            for st in lk.SubTable:
                st = getattr(st, "ExtSubTable", st)
                for first, L in (getattr(st, "ligatures", None) or {}).items():
                    for lg in L: ligs[(first, *lg.Component)] = lg.LigGlyph
    for w in words:
        key = tuple(cmap.get(ord(c)) for c in w); g = ligs.get(key)
        if g and g in rev: out.append(chr(rev[g]))
    return out


def card_db(f):
    """딩벳 카드: 이름은 사이트 글꼴(프리텐다드), 그 아래에 실제 견본 기호를 그 글꼴로"""
    path, w = font_file(f)
    if not path: return False
    if "COLR" in TTFont(str(path), lazy=True): print(f"{f['id']}: 컬러 글리프(COLR)는 PIL이 못 그려 기본 카드 사용"); return True
    wght = w if "fvar" in TTFont(str(path), lazy=True) else None
    im = Image.new("RGB", (W, H), PAPER); d = ImageDraw.Draw(im)
    lg = logo(46); im.paste(lg, (64, 52), lg)
    cat = f["category"]; tw = d.textlength(cat, font=ui(700, 24)) + 32
    pill(d, W - 64 - tw, 56, cat, ui(700, 24), INK, PAPER, outline=INK)
    nf = ui(800, 96)
    while d.textlength(f["name"], font=nf) > W - 128 and nf.size > 56: nf = ui(800, nf.size - 6)
    bb = nf.getbbox(f["name"]); d.text((64, 140 - bb[1]), f["name"], font=nf, fill=INK)
    if f.get("typeable"):
        sf = fit(path, f["sample"], W - 128, 120, wght, 40); sb = sf.getbbox(f["sample"]); d.text((64, 290 - sb[1]), f["sample"], font=sf, fill=INK)
    else:
        chars = liga_chars(path, [x[0] for x in f["icons"]]) if f.get("liga") else [x[0] for x in f["icons"]]
        cm = TTFont(str(path), lazy=True).getBestCmap() or {}; chars = [c for c in chars if ord(c) in cm][:9]
        if not chars: return False
        ft = load(path, 92, wght); step = (W - 128) / 9
        for i, c in enumerate(chars):
            b = ft.getbbox(c); cx = 64 + step * i + (step - (b[2] - b[0])) / 2 - b[0]
            d.text((cx, 300 - b[1] + (92 - (b[3] - b[1])) / 2), c, font=ft, fill=INK)
    d.rectangle([0, H - 150, W, H], fill=INK)
    d.text((64, H - 124), "상업용 무료 딩벳 · " + f["glyphs"], font=ui(500, 24), fill="#b7b4a9")
    x = 64; y = H - 78
    for k, label in LIC.items():
        st = (f.get("matrix") or {}).get(k)
        if st == "ok": x = pill(d, x, y, label + " ✓", ui(700, 24), LIME_INK, LIME) + 10
        elif st == "cond": x = pill(d, x, y, label + " 조건부", ui(700, 24), "#f1efe8", INK, outline="#8f8d84") + 10
        elif st == "no": x = pill(d, x, y, label + " ✕", ui(700, 24), "#8f8d84", INK, outline="#3a3a34") + 10
    t = "letsum.app"; d.text((W - 64 - d.textlength(t, font=ui(700, 30)), H - 98), t, font=ui(700, 30), fill=LIME)
    save(im, OUT / f"{f['id']}.png")
    return True


def load_db():
    js = r"""const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8')+fs.readFileSync(process.argv[2],'utf8');
const F=new Function('var window={};'+s+';return FONTS_DB')();
console.log(JSON.stringify(F.map(f=>({id:f.id,name:f.name,en:f.en,intro:false,weights:f.weights,webfont:f.webfont,category:f.category,glyphs:f.glyphs,matrix:f.matrix,icons:f.icons,sample:f.sample,typeable:!!f.typeable,liga:!!f.liga}))));"""
    return json.loads(__import__("subprocess").run(["node", "-e", js, str(ROOT / "html/js/data.js"), str(ROOT / "html/js/data_db.js")], capture_output=True, text=True, check=True).stdout)


def card_main(fonts):
    n = len(fonts)
    im = Image.new("RGB", (W, H), PAPER); d = ImageDraw.Draw(im)
    lg = logo(96); im.paste(lg, (64, 70), lg)
    d.text((64, 214), "상업용 무료 한글 폰트", font=ui(800, 62), fill=INK)
    d.text((64, 300), "쓸 곳에 맞게 고르고, 내 문장으로 확인하고,", font=ui(500, 30), fill=INK2)
    d.text((64, 344), "라이선스 원문까지 한 번에.", font=ui(500, 30), fill=INK2)
    # 오른쪽: '가' 타일 — 서로 다른 분위기의 폰트 4종
    picks = ["k-pretendard", "nanum-myeongjo", "jua", "k-cafe24-ssurround"]
    by = {f["id"]: f for f in fonts}
    tiles = [(LIME, LIME_INK), (INK, "#f1efe8"), ("#ffffff", INK), (INK, LIME)]
    S, G, x0, y0 = 150, 16, W - 64 - 150 * 2 - 16, 70
    for i, fid in enumerate(picks):
        f = by.get(fid)
        p = font_file(f)[0] if f else None
        bg, fg = tiles[i]
        x, y = x0 + (i % 2) * (S + G), y0 + (i // 2) * (S + G)
        d.rounded_rectangle([x, y, x + S, y + S], radius=18, fill=bg, outline=INK if bg == "#ffffff" else None, width=2)
        ft = load(p, 96, 800 if i == 0 else None) if p else ui(800, 96)
        bb = ft.getbbox("가")
        d.text((x + (S - (bb[2] - bb[0])) / 2 - bb[0], y + (S - (bb[3] - bb[1])) / 2 - bb[1]), "가", font=ft, fill=fg)
        lab = f["name"] if f else ""
        d.text((x + 12, y + S - 26), lab, font=ui(500, 15), fill=fg)
    # 아래 띠
    d.rectangle([0, H - 150, W, H], fill=INK)
    x = 64; y = H - 98
    for t in (f"{n}종", "인쇄·웹·영상 사용 범위 표시", "공식 배포처로 바로 받기"):
        x = pill(d, x, y, t, ui(700, 26), LIME_INK if t.endswith("종") else "#f1efe8", LIME if t.endswith("종") else INK, outline=None if t.endswith("종") else "#5a584f") + 12
    t = "letsum.app"; d.text((W - 64 - d.textlength(t, font=ui(800, 34)), H - 100), t, font=ui(800, 34), fill=LIME)
    save(im, ROOT / "html/img/og-main.png")


def load_en():
    """영문 폰트(data_en.js) — data.js의 상수(OFL_ALL_OK 등)를 먼저 읽는다"""
    js = r"""const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8')+fs.readFileSync(process.argv[2],'utf8');
const F=new Function('var window={};'+s+';return FONTS_EN')();
console.log(JSON.stringify(F.map(f=>({id:f.id,name:f.name,en:f.en,intro:!!f.intro,weights:f.weights,webfont:f.webfont||null,zip:'',category:(f.tags&&f.tags[0])||f.category,glyphs:f.glyphs,matrix:f.matrix}))));"""
    return json.loads(__import__("subprocess").run(["node", "-e", js, str(ROOT / "html/js/data.js"), str(ROOT / "html/js/data_en.js")], capture_output=True, text=True, check=True).stdout)


def main():
    global SAMPLE
    if "--db" in sys.argv:  # 딩벳 카드(컬러 이모지처럼 PIL이 못 그리는 글꼴은 건너뛰고 기본 카드)
        fonts = load_db(); sys.argv += ["--en"] if "--en" not in sys.argv else []
        if "--id" not in sys.argv and "--all" not in sys.argv: sys.argv += ["--all"]
    elif "--en" in sys.argv:  # 영문 폰트 카드: 분류는 산세리프·세리프처럼 영문 기준 태그, 예문은 영문
        fonts = load_en(); SAMPLE = "The quick brown fox jumps over the lazy dog"
        if "--id" not in sys.argv and "--all" not in sys.argv: sys.argv += ["--all"]
    else:
        fonts = load_fonts()
    if "--en" not in sys.argv:
        full = {f["id"]: f for f in json.loads(__import__("subprocess").run(["node", "-e", "const fs=require('fs');const F=new Function(fs.readFileSync(process.argv[1],'utf8')+';return FONTS')();console.log(JSON.stringify(F))", str(ROOT / "html/js/data.js")], capture_output=True, text=True, check=True).stdout)}
        for f in fonts: f.update({k: full[f["id"]].get(k) for k in ("category", "glyphs", "matrix")})
    if "--en" not in sys.argv and ("--main" in sys.argv or "--id" not in sys.argv): card_main(fonts); print("→ html/img/og-main.png")
    if "--main" in sys.argv: return
    only = sys.argv[sys.argv.index("--id") + 1] if "--id" in sys.argv else None
    ok = bad = 0
    for f in fonts:
        if f["intro"] or (only and f["id"] != only): continue
        if "--missing" in sys.argv and (OUT / f"{f['id']}.png").exists(): continue  # 카드가 이미 있는 폰트는 건너뜀(주간 자동 갱신용)
        try:
            try: r = card_db(f) if "--db" in sys.argv else card_font(f, None)
            except OSError as e:  # FreeType가 힌팅을 못 읽는 폰트 → 힌팅 지운 사본으로 다시
                if not any(k in str(e) for k in ("function definitions", "Bitmap missing")) and "invalid" not in str(e).lower(): raise
                for p in CACHE.glob(f"{f['id']}-*.ttf"): p.write_bytes(ttf_bytes(p.read_bytes(), dehint=True))
                r = card_db(f) if "--db" in sys.argv else card_font(f, None)
            if r: ok += 1
            else: bad += 1; print(f"{f['id']}: 파일 없음")
        except Exception as e:
            bad += 1; print(f"{f['id']}: {str(e)[:120]}")
    print(f"→ html/img/og/ {ok}장 (실패 {bad})")


if __name__ == "__main__":
    main()
