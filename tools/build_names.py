#!/usr/bin/env python3
"""폰트 파일 속 '이름표'(name 테이블)를 읽어, 프로그램마다 보이는 이름을 정리한다 (AI 없음).

한국 폰트는 LETSUM 표기 · Windows 글꼴 목록 · Mac 서체 관리자/Adobe · 포토샵 '글꼴 누락' 창(PostScript)
이름이 제각각인 경우가 많다. 파일에 실제로 적힌 값을 읽어 html/data/names.json으로 만든다.

규칙(일반적인 동작):
  - Windows 앱(워드·한글·파워포인트) 글꼴 목록: Windows 이름표의 기본 글꼴 이름(nameID 1), 한국어 Windows면 한국어 기록 우선.
    굵기가 4종(보통·굵게·기울임)을 넘으면 'OO Light'처럼 굵기가 붙은 별도 이름으로 보인다.
  - Mac 서체 관리자·포토샵·일러스트레이터: 대표 글꼴 이름(nameID 16, 없으면 1) + 스타일(17, 없으면 2), 한국어 기록 우선.
  - 포토샵 '글꼴 누락' 창·인쇄소 납품·CSS local(): PostScript 이름(nameID 6).

입력 파일: 사이트 미리보기·배포처 공식 웹폰트 파일(data.js webfont), Google Fonts 폰트는 google/fonts 저장소의 원본 TTF.
캐시: tools/state/names_cache.json (주소별 결과 — 매주 새 주소만 받음). 소개 전용(파일 없음)은 건너뜀.
보관 중인 파일만 재검사: --local-only. 공식 안심글꼴 묶음의 TTF·OTF 이름도 대조: --original-archive.
필요: fontTools + brotli (pip install fonttools brotli)
"""
import io, json, re, subprocess, sys, time, urllib.parse, urllib.request
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "html/data/names.json"
CACHE = ROOT / "tools/state/names_cache.json"
UA = "LETSUM-font-names/1.0 (+https://letsum.app)"
KO, EN = 0x0412, 0x0409
RIBBI = {"regular", "bold", "italic", "bold italic"}


def load_fonts(include_english=False):
    js = r"""const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');
const en=process.argv[3]==='true'&&fs.existsSync(process.argv[2])?fs.readFileSync(process.argv[2],'utf8'):'';
const F=new Function('var window={};'+s+en+';return [...FONTS,...(typeof FONTS_EN!=="undefined"?FONTS_EN:[])]')();
console.log(JSON.stringify(F.map(f=>({id:f.id,name:f.name,en:f.en,intro:!!f.intro,weights:f.weights,webfont:f.webfont||null,zip:(f.dl||{}).zip||''}))));"""
    return json.loads(subprocess.run(["node", "-e", js, str(ROOT / "html/js/data.js"), str(ROOT / "html/js/data_en.js"), str(include_english).lower()], capture_output=True, text=True, check=True).stdout)


def get(url, limit=40_000_000):
    # letsum.app/fonts-hosted는 사이트 화면에서 부를 때만 내주므로(nginx) 사이트 주소를 Referer로 붙임
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://letsum.app/"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read(limit)


def rec(t, nid, lang, plat=None):
    """nameID 값: 지정 언어 → (플랫폼 제한 시 그 플랫폼만)."""
    best = None
    for r in t["name"].names:
        if r.nameID != nid: continue
        if plat is not None and r.platformID != plat: continue
        ok = (r.platformID == 3 and r.langID == lang) or (r.platformID == 1 and r.langID == (23 if lang == KO else 0))
        if not ok: continue
        try: v = r.toUnicode().strip()
        except Exception: continue
        if v and (best is None or r.platformID == 3): best = v
    return best


def names_of(t):
    """정적 폰트 1개 → 프로그램별 이름."""
    win_ko = rec(t, 1, KO, 3); win_en = rec(t, 1, EN, 3)
    if not win_en:  # Windows 기록이 없으면 Mac 기록이 대신 쓰인다
        win_en = rec(t, 1, EN)
    fam_ko = rec(t, 16, KO) or rec(t, 1, KO); fam_en = rec(t, 16, EN) or rec(t, 1, EN)
    sty = rec(t, 17, KO) or rec(t, 17, EN) or rec(t, 2, KO) or rec(t, 2, EN) or "Regular"
    ps = rec(t, 6, EN) or rec(t, 6, KO) or ""
    return {"win": win_ko or win_en, "winEn": win_en, "fam": fam_ko or fam_en, "famEn": fam_en, "sty": sty, "ps": ps, "koWin": bool(win_ko)}


def variable_instances(t):
    """가변 폰트: 이름 붙은 인스턴스마다 이름 계산."""
    base = names_of(t); out = {}
    for inst in t["fvar"].instances:
        w = round(inst.coordinates.get("wght", 400))
        sty = t["name"].getDebugName(inst.subfamilyNameID) or "Regular"
        ps = t["name"].getDebugName(inst.postscriptNameID) if inst.postscriptNameID not in (None, 0xFFFF) else None
        if not ps:
            pre = rec(t, 25, EN) or (base["famEn"] or "").replace(" ", "")
            ps = f"{pre}-{sty.replace(' ', '')}"
        extra = "" if sty.lower() in RIBBI else " " + sty
        # 가변 폰트의 기본 이름(nameID 1)은 기본 인스턴스 이름(예: 'Noto Sans KR Thin')이라, 대표 글꼴 이름 + 스타일로 계산
        wk = rec(t, 16, KO, 3) or rec(t, 1, KO, 3)
        out[str(w)] = {"win": (wk or base["famEn"] or "") + extra, "winEn": (base["famEn"] or "") + extra, "fam": base["fam"], "famEn": base["famEn"], "sty": sty, "ps": ps, "koWin": bool(wk), "var": True}
    return out


def document_names(t):
    """Names actually embedded in the file, including localized full names and explicit variable instances."""
    ids = {1, 4, 6, 16, 21}
    if "fvar" in t:
        ids.update(inst.postscriptNameID for inst in t["fvar"].instances
                   if inst.postscriptNameID not in (None, 0xffff))
    names = set()
    for entry in t["name"].names:
        if entry.nameID not in ids:
            continue
        try:
            value = entry.toUnicode().strip()
        except (UnicodeError, LookupError):
            continue
        if value and len(value) <= 220 and value.isprintable():
            names.add(value)
    return sorted(names)


def read(url, local=None):
    data = open(local, "rb").read() if local and Path(local).exists() else get(url)
    with TTFont(io.BytesIO(data), fontNumber=0, lazy=True) as t:
        result = {"documentNames": document_names(t)}
        if "fvar" in t and any(axis.axisTag == "wght" for axis in t["fvar"].axes):
            result["var"] = variable_instances(t)
        else:
            result["one"] = names_of(t)
        return result


def add_archived_originals(out, selected_ids):
    """Inspect paired TTF/OTF originals where the official archive and the site manifest agree."""
    from build_webfonts import BUNDLE, iter_fonts, names, norm
    import unicodedata
    manifest = json.loads((ROOT / "tools/state/webfonts.json").read_text())
    by_file = {}
    for fid in selected_ids:
        entry = manifest.get(fid, {})
        for filename in entry.get("source_files", []):
            by_file.setdefault(unicodedata.normalize("NFC", filename), set()).add(fid)
    collected = {}
    count = 0
    for path, raw in iter_fonts(BUNDLE):
        if not path.lower().endswith((".ttf", ".otf")):
            continue
        owners = by_file.get(unicodedata.normalize("NFC", Path(path).name), set())
        if len(owners) != 1:
            continue
        fid = next(iter(owners))
        with TTFont(io.BytesIO(raw), lazy=True) as font:
            actual = names(font)
            expected = manifest[fid]
            if not ({norm(actual[k]) for k in ("ko", "en") if actual[k]} &
                    {norm(expected[k]) for k in ("ko", "en", "name") if expected.get(k)}):
                continue
            collected.setdefault(fid, set()).update(document_names(font))
            count += 1
    for fid, identifiers in collected.items():
        out[fid]["originalNames"] = sorted(identifiers)
    print(f"안심글꼴 원본 {count}개 · {len(collected)}종 이름표 확인")


def gf_files(en):
    """Google Fonts 원본: google/fonts 저장소 METADATA.pb에서 파일 목록."""
    d = re.sub(r"[^a-z0-9]", "", en.lower())
    for lic in ("ofl", "apache", "ufl"):
        base = f"https://raw.githubusercontent.com/google/fonts/main/{lic}/{d}/"
        try: meta = get(base + "METADATA.pb").decode("utf-8", "ignore")
        except Exception: continue
        out = []
        for blk in re.findall(r"fonts\s*\{(.*?)\}", meta, re.S):
            st = re.search(r'style:\s*"(\w+)"', blk); fn = re.search(r'filename:\s*"([^"]+)"', blk); w = re.search(r"weight:\s*(\d+)", blk)
            if fn and (not st or st.group(1) == "normal"): out.append((int(w.group(1)) if w else 400, base + urllib.parse.quote(fn.group(1))))
        return out
    return []


def main():
    only = sys.argv[sys.argv.index("--id") + 1] if "--id" in sys.argv else None
    selected = set(sys.argv[sys.argv.index("--ids") + 1].split(",")) if "--ids" in sys.argv else None
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    fonts = [f for f in load_fonts(include_english=True) if not f["intro"] and (not only or f["id"] == only) and (not selected or f["id"] in selected)]
    out = json.loads(OUT.read_text()) if OUT.exists() else {}
    local_only = "--local-only" in sys.argv  # Backfill from archived files without any network requests.
    for f in fonts:
        if local_only and not f["webfont"]:
            continue
        files = [(int(w), u) for w, u in (f["webfont"] or {}).items()] if f["webfont"] else gf_files(f["en"])
        per = {}
        identifiers = set()
        for w, u in files:
            fn = f"{w}." + u.split("?")[0].rsplit(".", 1)[-1]
            folder = "hosted" if "/fonts-hosted/" in u else "cdn"
            loc = ROOT / "tools/archive" / folder / f["id"] / fn
            cached = cache.get(u, {})
            if "documentNames" not in cached and (not local_only or loc.is_file()):
                try:
                    cache[u] = read(u, loc)
                    if not loc.is_file():
                        time.sleep(0.3)
                except Exception as e:
                    if not cached:
                        cache[u] = {"err": str(e)[:100]}
            c = cache.get(u, {})
            identifiers.update(c.get("documentNames", []))
            if "one" in c: per[str(w)] = dict(c["one"])
            elif "var" in c:
                for iw, v in c["var"].items():
                    if int(iw) in f["weights"] or not f["weights"]: per[iw] = dict(v)
        if local_only and f["id"] in out:
            if identifiers:
                out[f["id"]]["documentNames"] = sorted(identifiers)
            continue
        if not per:
            print(f"{f['id']}: 이름 못 읽음 {[cache.get(u, {}).get('err') for _, u in files][:1]}"); continue
        first = per.get("400") or per[sorted(per, key=lambda k: abs(int(k) - 400))[0]]
        item = {"fam": first["fam"], "famEn": first["famEn"], "w": dict(sorted(per.items(), key=lambda x: int(x[0])))}
        if identifiers: item["documentNames"] = sorted(identifiers)
        if not any(v.get("koWin") for v in per.values()): item["noKoWin"] = True
        z = f["zip"].split("?")[0]
        if re.search(r"\.(ttf|otf|woff2?)$", z, re.I): item["file"] = urllib.parse.unquote(z.rsplit("/", 1)[-1])
        for v in item["w"].values(): v.pop("koWin", None)
        if "originalNames" in out.get(f["id"], {}):
            item["originalNames"] = out[f["id"]]["originalNames"]
        out[f["id"]] = item
        print(f"{f['id']}: {item['fam']} / {item['famEn']} · {len(per)}굵기")
    if "--original-archive" in sys.argv:
        add_archived_originals(out, {f["id"] for f in fonts if f["id"] in out})
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")) + "\n")
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"→ {OUT.relative_to(ROOT)} ({len(out)}종)")


if __name__ == "__main__":
    main()
