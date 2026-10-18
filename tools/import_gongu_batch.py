#!/usr/bin/env python3
"""공유마당 안심글꼴 일괄 등록 (2026-10-16 운영자 승인 목록 한정).

입력  tools/archive/kogl_dl/<wrtSn>/*  — 운영자 승인 후 저작물 페이지마다 '이용범위 동의' 체크 → 다운로드한 원본(git 제외)
      /private/tmp/.../todo.json 대신 tools/state/gongu_batch.json  (wrtSn → 가족명·제공기관·이용조건)
처리  ① ZIP(중첩 포함)·OTF·TTF에서 폰트 파일을 꺼내 name 테이블로 굵기·이름 확인(기울임꼴 제외)
      ② 라이선스별 미리보기 파일
         공공누리 1유형 → WOFF2 변환(변경 허용, 글리프는 그대로)
         OFL           → 파일에 예약 글꼴 이름(RFN)이 있으면 원본 그대로, 없으면 WOFF2 변환
         공공누리 3유형 → 변경 금지라 원본 그대로
      ③ 미러 webfonts/<id>/<굵기>.<형식> + LICENSE.txt(출처 표시), data.js·license_manual.json 추가
사용  python tools/import_gongu_batch.py --mirror ../letsum-mirror [--dry]
"""
import argparse, io, json, os, re, subprocess, sys, unicodedata, zipfile
from datetime import date
from fontTools.ttLib import TTFont, TTCollection

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
DL = os.path.join(HERE, "archive", "kogl_dl"); BATCH = os.path.join(HERE, "state", "gongu_batch.json")
DATA = os.path.join(ROOT, "html", "js", "data.js"); PAGES = "https://geehg.github.io/letsum-mirror/webfonts"
TODAY = date.today().isoformat()
sys.path.insert(0, HERE)
def guess_cat(name):  # tools/import_webfonts.py와 같은 규칙(그 파일은 불러오면 바로 실행되므로 복사)
    if re.search(r"명조|바탕|serif|세리프|궁서|송", name, re.I): return "명조", "serif", ["본문", "명조"], ["차분한", "고전적"], "playfair"
    if re.search(r"손글씨|필기|펜|붓|캘리|손편지|글씨체|어린이|엄마|할머니|할아버지|할매", name) and not re.search(r"고딕|돋움|산스|sans", name, re.I):
        return "손글씨", "cursive", ["손글씨", "감성"], ["따뜻한", "발랄한"], "inter"
    if re.search(r"고딕|돋움|산스|sans|gothic|스퀘어|바른|본문", name, re.I): return "고딕", "sans-serif", ["본문", "고딕"], ["단정한"], "inter"
    return "디스플레이", "sans-serif", ["제목", "개성"], ["발랄한"], "grotesk"

FIXED_ID = {"송암 이형식체": "songam-leehyungsik", "경복궁 수문장 제목체": "sumunjang-title", "경복궁 수문장 본문체": "sumunjang-body",
            "한글재민체6.0": "hangeuljaemin6", "환경체": "keco-hwangyeong", "행복고흥체": "happy-goheung", "전주완판본체 각": "jeonju-wanpanbon-gak", "전주완판본체 순": "jeonju-wanpanbon-sun", "서울남산세로쓰기체": "seoulnamsan-vertical", "부산체": "busan-font"}
LIC = {"KOGL1": ("공공누리 제1유형", "OFL_ALL_OK"),
       "KOGL3": ("공공누리 제3유형", '{ print: "ok", web: "ok", video: "ok", embed: "ok", bici: "ok", package: "ok", ofl: "no" }'),
       "OFL": ("OFL", "OFL_ALL_OK")}


def norm(s):
    s = unicodedata.normalize("NFKC", s or "").lower()  # NFKC: Ⅱ→ii 같은 기호도 글자로(빙그레체Ⅱ ≠ 빙그레체)
    s = re.sub(r"(otf|ttf)$", "", re.sub(r"[^0-9a-z가-힣]", "", s))
    return s


def zname(info):
    raw = info.filename
    if info.flag_bits & 0x800: return raw
    b = raw.encode("cp437", "ignore")
    for enc in ("utf-8", "cp949"):
        try: return b.decode(enc)
        except Exception: pass
    return raw


def iter_fonts(data, path):
    """ZIP·폰트 바이트에서 (경로, 바이트, 확장자) — 중첩 ZIP까지."""
    if data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for i in z.infolist():
                n = zname(i)
                if i.is_dir() or "__MACOSX" in n or os.path.basename(n).startswith("._"): continue
                b = z.read(i)
                if n.lower().endswith(".zip"): yield from iter_fonts(b, path + "/" + n)
                elif re.search(r"\.(ttf|otf|woff2?|ttc)$", n, re.I): yield (path + "/" + n, b, n.rsplit(".", 1)[1].lower())
                elif re.search(r"(license|ofl|라이선스|이용|저작권).*\.txt$", n, re.I): yield (path + "/" + n, b, "txt")
    else:
        ext = path.rsplit(".", 1)[-1].lower()
        if ext in ("ttf", "otf", "woff", "woff2"): yield (path, data, ext)


def nm(t, nid, lang):
    for r in t["name"].names:
        if r.nameID == nid and r.platformID == 3 and r.langID == lang:
            try: return r.toUnicode().strip()
            except Exception: pass
    return None


def real_hangul(t):
    try: return _real_hangul(t)
    except Exception:  # CFF 이름표가 깨진 OTF 등 — 윤곽선 확인 없이 cmap 기준
        return [k for k in (t.getBestCmap() or {}) if 0xAC00 <= k <= 0xD7A3]


def _real_hangul(t):
    cmap = t.getBestCmap() or {}; ks = [k for k in cmap if 0xAC00 <= k <= 0xD7A3]
    if "glyf" in t: g = t["glyf"]; return [k for k in ks if g[cmap[k]].numberOfContours != 0]
    from fontTools.pens.boundsPen import ControlBoundsPen
    gs = t.getGlyphSet(); out = []
    for k in ks:
        p = ControlBoundsPen(gs); gs[cmap[k]].draw(p)
        if p.bounds: out.append(k)
    return out


WTOK = [(r"(?i)(extra ?bold|\bEB\b|EB(?=\.|\)|_|$))", 800), (r"(?i)(semi ?bold|\bSB\b)", 600), (r"(?i)(bold|\bB\b|[^A-Z]B(?=\.|\)|_|\s|$))", 700),
        (r"(?i)(medium|\bM\b|[^A-Z]M(?=\.|\)|_|\s|$))", 500), (r"(?i)(thin|\bT\b|[^A-Z]T(?=\.|\)|_|\s|$))", 100), (r"(?i)(light|\bL\b|[^A-Z]L(?=\.|\)|_|\s|$))", 300),
        (r"(?i)(regular|\bR\b|[^A-Z]R(?=\.|\)|_|\s|$))", 400)]


WORDS = [("extrabold", 800), ("ultrabold", 800), ("semibold", 600), ("demibold", 600), ("extralight", 200), ("ultralight", 200), ("hairline", 100),
         ("bold", 700), ("medium", 500), ("thin", 100), ("light", 300), ("regular", 400), ("black", 900), ("heavy", 900)]
CODES = [("EB", 800), ("SB", 600), ("EL", 200), ("BL", 900), ("B", 700), ("M", 500), ("T", 100), ("L", 300), ("R", 400), ("H", 900)]


def weight_of(t, path):
    """굵기: 스타일 이름(17·2)의 단어 → 파일 이름 끝의 단어·약어(B/L/M/R 등, 대소문자 구분) → usWeightClass."""
    sty = (nm(t, 17, 0x409) or nm(t, 2, 0x409) or "").strip().lower().replace(" ", "")
    if sty and sty != "regular":
        for wd, w in WORDS:
            if wd in sty: return w
    stem = re.sub(r"\s*\(.*?\)\s*$", "", os.path.basename(path).rsplit(".", 1)[0]).strip()
    low = stem.lower().replace(" ", "")
    for wd, w in WORDS:
        if low.endswith(wd): return w
    for code, w in CODES:  # 'TheCircleB'의 B처럼 소문자·한글·구분자 뒤에 오는 대문자 약어만
        if re.search(r"(?:^|[a-z가-힣0-9_\- ])" + code + r"$", stem): return w
    return min(900, max(100, int(round(t["OS/2"].usWeightClass / 100.0)) * 100))

def slug(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--mirror", required=True); ap.add_argument("--dry", action="store_true"); a = ap.parse_args()
    batch = json.load(open(BATCH, encoding="utf-8"))
    js = "const fs=require('fs');const F=new Function(fs.readFileSync(process.argv[1],'utf8')+';return FONTS')();console.log(JSON.stringify(F))"
    fonts = json.loads(subprocess.run(["node", "-e", js, DATA], capture_output=True, text=True, check=True).stdout)
    ids = {f["id"] for f in fonts}
    names = json.load(open(os.path.join(ROOT, "html", "data", "names.json"), encoding="utf-8"))
    have_names = {norm(f["en"]) for f in fonts} | {norm(f["name"]) for f in fonts} | {norm(v.get("famEn")) for v in names.values()} | {norm(v.get("fam")) for v in names.values()}
    have_names.discard("")
    fams = {}
    for sn, b in batch.items():
        d = os.path.join(DL, sn)
        if not os.path.isdir(d): print("파일 없음", sn, b["fam"]); continue
        g = fams.setdefault(b["fam"], {"fam": b["fam"], "org": b["org"], "lic": b["lic"], "sns": [], "files": {}, "txt": []})
        g["sns"].append(sn)
        for fn in sorted(os.listdir(d)):
            if fn.startswith("._"): continue
            for path, data, ext in iter_fonts(open(os.path.join(d, fn), "rb").read(), fn):
                if ext == "txt": g["txt"].append(data); continue
                try:
                    t = TTCollection(io.BytesIO(data)).fonts[0] if ext == "ttc" else TTFont(io.BytesIO(data))
                except Exception: continue
                if t["OS/2"].fsSelection & 1: continue
                w = weight_of(t, path)
                fk = re.sub(r"(?i)[\s_-]*(thin|light|regular|medium|semibold|bold|extrabold|black|heavy|[blmrt]|eb|bl|sb)$", "", nm(t, 16, 0x409) or nm(t, 1, 0x409) or "").strip().lower()
                rank = {"woff2": 0, "ttf": 1, "otf": 2, "woff": 3}.get(ext, 9)  # 공식 WOFF2가 있으면 그것을 우선
                g.setdefault("all", []).append({"w": w, "rank": rank, "ext": ext, "data": data, "t": t, "path": path, "fk": fk})
    for g in fams.values():  # 묶음 안에 다른 폰트가 잘못 들어간 경우(예: 이순신 돋움체 M ZIP 속 서울남산 장체) — 가장 많은 가족명만
        allf = g.pop("all", [])
        if not allf: continue
        from collections import Counter
        main = Counter(f["fk"] for f in allf).most_common(1)[0][0]
        for f in allf:
            key = lambda x: re.sub(r"[^0-9a-z가-힣]", "", x)[:5]
            if key(f["fk"]) != key(main): print("  다른 폰트 제외:", g["fam"], f["path"]); continue
            cur = g["files"].get(f["w"])
            if cur and cur["rank"] <= f["rank"]: continue
            g["files"][f["w"]] = f
    entries, manual = [], {}
    for name, g in fams.items():
        if not g["files"]:
            print("폰트 파일 없음:", name); continue
        base = g["files"].get(400) or g["files"][sorted(g["files"])[0]]
        t = base["t"]; en = re.sub(r"(?i)\s*(otf|ttf)$", "", nm(t, 16, 0x409) or nm(t, 1, 0x409) or name).strip()
        ko = nm(t, 16, 0x412) or nm(t, 1, 0x412)
        if norm(en) in have_names or norm(name) in have_names or (ko and norm(ko) in have_names):
            print("이미 등록:", name, "/", en, "/", ko); continue
        have = real_hangul(t)
        if len(have) < 2000: print("한글 부족:", name, len(have)); continue
        lictxt = b"".join(g["txt"]).decode("utf-8", "ignore") + " ".join(filter(None, [nm(t, 13, 0x409), nm(t, 0, 0x409)]))
        rfn = bool(re.search(r"reserved font name", lictxt, re.I))
        keep = g["lic"] == "KOGL3" or (g["lic"] == "OFL" and rfn)
        fid = "k-" + (FIXED_ID.get(g["fam"]) or re.sub(r"-(b|l|r|m|eb|bold|light|regular|medium)$", "", slug(en)) or "gongu-" + g["sns"][0])
        while fid in ids: fid += "-2"
        ids.add(fid)
        out = os.path.join(a.mirror, "webfonts", fid); webfont = {}
        for w, f in sorted(g["files"].items()):
            ext = f["ext"] if keep or f["ext"] == "woff2" else "woff2"
            webfont[str(w)] = f"{PAGES}/{fid}/{w}.{ext}"
            if a.dry: continue
            os.makedirs(out, exist_ok=True)
            if ext == f["ext"]: open(os.path.join(out, f"{w}.{ext}"), "wb").write(f["data"])
            else:
                tt = TTFont(io.BytesIO(f["data"])); tt.flavor = "woff2"; tt.save(os.path.join(out, f"{w}.woff2"))
        lname, matrix = LIC[g["lic"]]
        page = f"https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn={g['sns'][0]}&menuNo=200023"
        attribution = f"{name} © {g['org']}, {lname}" if g["lic"] != "OFL" else ""
        how = "원본 파일 그대로(변환 없음)" if keep else "WOFF2 형식 변환(글리프 그대로)"
        if not a.dry:
            note = f"{name} — 저작(권)자 {g['org']}\n이용조건: {lname}" + (" (출처 표시)" if g["lic"] != "OFL" else "") + f"\n원 배포처: {page}\n이 폴더의 파일은 LETSUM 미리보기용입니다: {how}.\n"
            open(os.path.join(out, "LICENSE.txt"), "w", encoding="utf-8").write(note)
            if g["lic"] == "OFL" and g["txt"]: open(os.path.join(out, "OFL.txt"), "wb").write(g["txt"][0])
        cat, gen, tags, mood, pair = guess_cat(name)
        ws = sorted(g["files"]); n = len(have)
        catword = {"고딕": "고딕", "명조": "명조", "손글씨": "손글씨", "디스플레이": "제목용 글꼴"}[cat]
        desc = f"{g['org']}에서 공유마당에 공개한 {catword}. 굵기 {len(ws)}종, 한글 {n:,}자를 지원합니다."
        q = lambda l: "[" + ", ".join(json.dumps(x, ensure_ascii=False) for x in l) + "]"
        wf = "{ " + ", ".join(f'{w}: "{webfont[str(w)]}"' for w in ws) + " }"
        fmts = sorted({f["ext"].upper() for f in g["files"].values()} | {"WOFF2"} if not keep else {f["ext"].upper() for f in g["files"].values()})
        entries.append(f'''  {{ id: "{fid}", name: {json.dumps(name, ensure_ascii=False)}, en: {json.dumps(en, ensure_ascii=False)}, family: "'LS {fid}', {gen}",
    designer: {json.dumps(g['org'], ensure_ascii=False)}, holder: {json.dumps(g['org'], ensure_ascii=False)}, category: "{cat}",
    tags: {q(tags)}, mood: {q(mood)}, weights: [{", ".join(map(str, ws))}], formats: {q(fmts)},
    cov: {n}, glyphs: "한글 {n:,}자", old: false, hanja: false,
    webfont: {wf}, webfontSrc: "공유마당 원본 · {how}",
    dl: {{ page: "{page}", srcName: "공유마당(한국저작권위원회)" }},
    license: "{lname}", matrix: {matrix}, verified: "{TODAY}", status: "verified",{f' attribution: {json.dumps(attribution, ensure_ascii=False)},' if attribution else ''}
    pair: "{pair}", pop: 35, added: "{TODAY}",
    desc: {json.dumps(desc, ensure_ascii=False)} }},''')
        manual[fid] = {"license": lname, "evidence": f"공유마당 저작물 페이지 이용조건 '{lname}'" + (" + 파일 RFN 있어 원본 그대로" if rfn and g["lic"] == "OFL" else "") + f" — 2026-10-16 운영자 승인으로 '이용범위 동의' 후 다운로드({', '.join(g['sns'])})", "page": page, "checked": TODAY}
        print(f"{fid}: {name} [{g['lic']}{' RFN' if rfn else ''}] {how} · 굵기 {ws} · 한글 {n}")
    print(f"등록 {len(entries)}종")
    if a.dry or not entries: return
    src = open(DATA, encoding="utf-8").read(); s0 = src.index("const FONTS = ["); e = src.index("\n];", s0)
    src = src[:e] + "\n" + "\n".join(entries) + src[e:]
    if '  "공공누리 제3유형": {' not in src:
        src = src.replace('  "공공누리 제1유형": {', '  "공공누리 제3유형": { full: "공공누리 제3유형(출처표시·변경금지)", short: "공공누리 3유형", note: "상업 이용 가능, 사용 시 저작권자(출처) 표시 필요, 폰트 파일 변경 금지", url: "https://www.kogl.or.kr/info/licenseType3.do" },\n  "공공누리 제1유형": {', 1)
    open(DATA, "w", encoding="utf-8").write(src)
    lmp = os.path.join(HERE, "state", "license_manual.json"); lm = json.load(open(lmp, encoding="utf-8")); lm.update(manual)
    json.dump(lm, open(lmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
