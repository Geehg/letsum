#!/usr/bin/env python3
"""공공 안심글꼴 묶음(문체부 공식 '안심글꼴 한번에 내려받기')에서 OFL 패밀리를 골라 미리보기용 웹폰트를 만든다.

입력  tools/archive/kogl/safe_fonts_365.zip (git 제외) + tools/state/catalog.json(공공 루트 라이선스)
처리  ① 묶음 안의 zip/ttf/otf를 모두 풀어 폰트 파일 목록화
      ② 파일의 name 테이블(한글·영문 패밀리명)과 카탈로그 이름을 정규화해 매칭
      ③ 카탈로그 라이선스가 OFL인 패밀리만 선택 (공공누리 등은 이번 범위 밖)
      ④ 굵기(OS/2 usWeightClass)별로 WOFF2 변환 — 글리프는 건드리지 않는다(서브셋 안 함).
         OFL의 예약 글꼴 이름(RFN) 조항상 서브셋은 '수정본'이 될 수 있어, 압축 형식 변환만 한다.
      ⑤ cmap으로 한글 완성형 수·옛한글·한자 지원을 계산(브라우저 추정 대신 정확한 값)
출력  <mirror>/webfonts/<id>/<weight>.woff2 + OFL.txt  (GitHub Pages로 서빙)
      tools/state/webfonts.json  (사이트 data.js 생성용 메타데이터)
필요  fontTools + brotli (pip install fonttools brotli). AI·외부 API 없음.

사용  python tools/build_webfonts.py --mirror <letsum-mirror 체크아웃 경로>
"""
import argparse, io, json, os, re, shutil, sys, unicodedata, zipfile
from fontTools.ttLib import TTFont, TTCollection

HERE = os.path.dirname(os.path.abspath(__file__))
BUNDLE = os.path.join(HERE, "archive", "kogl", "safe_fonts_365.zip")
CATALOG = os.path.join(HERE, "state", "catalog.json")
OUT_META = os.path.join(HERE, "state", "webfonts.json")
PAGES_BASE = "https://geehg.github.io/letsum-mirror/webfonts"

def norm(s):
    s = unicodedata.normalize("NFC", s or "")
    s = re.sub(r"\(.*?\)|\[.*?\]", "", s)
    s = re.sub(r"(?i)\b(otf|ttf|woff2?|mac|win|windows|용|ver[\d.]*|v[\d.]+)\b", "", s)
    s = re.sub(r"(?i)(thin|extralight|ultralight|light|regular|medium|semibold|bold|extrabold|heavy|black|[lrmbh])$", "", s.replace(" ", ""))
    s = re.sub(r"(씬|라이트|레귤러|미디엄|볼드|헤비|굵게|보통|가늘게)$", "", s)
    s = re.sub(r"^(배달의민족|배민)", "배달의민족", s)
    return re.sub(r"[^0-9a-z가-힣]", "", s.lower())

def zname(info):
    """zip 파일명 복원: UTF-8 플래그가 없으면 cp437로 읽힌 바이트를 UTF-8 → CP949 순으로 다시 해석."""
    raw = info.filename
    if info.flag_bits & 0x800: return raw
    b = raw.encode("cp437", "ignore")
    for enc in ("utf-8", "cp949"):
        try: return b.decode(enc)
        except UnicodeDecodeError: pass
    return raw

def iter_fonts(data, path=""):
    """zip 안의 zip까지 재귀로 열어 (경로, 바이트) 를 낸다. macOS 메타파일·실행 파일(.exe)은 건너뜀.
    data는 바이트 또는 파일 경로(최상위 묶음은 1.6GB라 메모리에 통째로 올리지 않는다)."""
    with zipfile.ZipFile(data if isinstance(data, str) else io.BytesIO(data)) as z:
        for info in z.infolist():
            name = zname(info)
            if "__MACOSX" in name or os.path.basename(name).startswith("._") or info.is_dir(): continue
            low = name.lower()
            if low.endswith(".zip"):
                yield from iter_fonts(z.read(info), path + name + "/")
            elif low.endswith((".ttf", ".otf", ".ttc")):
                yield path + name, z.read(info)
            elif os.path.basename(low).startswith(("ofl", "license")) and low.endswith(".txt"):
                yield path + name, z.read(info)

def names(tt):
    n = tt["name"]
    def get(i, lang=None):
        for r in n.names:
            if r.nameID == i and (lang is None or r.langID == lang):
                try: return r.toUnicode()
                except Exception: pass
        return None
    return {"ko": get(16, 0x412) or get(1, 0x412), "en": get(16, 0x409) or get(1, 0x409) or get(1),
            "sub": get(2, 0x409) or get(2), "license": (get(13) or "") + " " + (get(14) or "")}

def cmap_stats(tt):
    cps = set(tt.getBestCmap() or {})
    syl = sum(1 for c in cps if 0xAC00 <= c <= 0xD7A3)
    old = 0x119E in cps or any(0xA960 <= c <= 0xA97F or 0xD7B0 <= c <= 0xD7FF for c in cps)
    hanja = sum(1 for c in cps if 0x4E00 <= c <= 0x9FFF) > 100
    return syl, old, hanja

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--mirror", required=True); ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    cat = json.load(open(CATALOG, encoding="utf-8"))
    wanted = {}  # norm name → catalog record (OFL 공공 레코드, 검수 대기)
    for k, r in cat.items():
        kg = r["sources"].get("kogl")
        if kg and kg.get("license") == "OFL" and not r.get("site_id") and r.get("review") == "pending":
            wanted.setdefault(norm(r["name"]), r)
    print(f"카탈로그 OFL 공공 레코드 {len(wanted)}개 (정규화 이름 기준)")

    files, licenses = [], {}
    for p, b in iter_fonts(BUNDLE):
        if p.lower().endswith(".txt"): licenses[os.path.dirname(p)] = b; continue
        try:
            fonts = TTCollection(io.BytesIO(b)).fonts if p.lower().endswith(".ttc") else [TTFont(io.BytesIO(b))]
        except Exception as e:
            print("  ! 읽기 실패", p, e); continue
        for tt in fonts:
            nm = names(tt); files.append({"path": p, "bytes": b, "tt": tt, **nm,
                                          "weight": tt["OS/2"].usWeightClass if "OS/2" in tt else 400,
                                          "italic": bool(tt["OS/2"].fsSelection & 1) if "OS/2" in tt else False})
    print(f"묶음 안 폰트 파일 {len(files)}개")

    fams = {}  # catalog key → list of file dicts
    for f in files:
        cands = [norm(f["ko"]), norm(f["en"]), norm(os.path.splitext(os.path.basename(f["path"]))[0]),
                 norm(os.path.basename(os.path.dirname(f["path"])))]
        hit = next((wanted[c] for c in cands if c and c in wanted), None)
        if not hit:  # 포함 관계 — 가장 긴 카탈로그 이름 하나만(나눔고딕 ⊂ 나눔고딕에코 같은 오매칭 방지)
            pairs = [(k, r) for c in cands if len(c) >= 3 for k, r in wanted.items() if len(k) >= 4 and k in c]
            if pairs: hit = max(pairs, key=lambda kr: len(kr[0]))[1]
        if hit:
            f["matched_by"] = next((c for c in cands if c in wanted), "부분일치")
            fams.setdefault(hit["name"], {"rec": hit, "files": []})["files"].append(f)
    print(f"매칭된 패밀리 {len(fams)}개 / 대상 {len(wanted)}개")

    out_dir = os.path.join(a.mirror, "webfonts"); os.makedirs(out_dir, exist_ok=True)
    meta = {}
    for i, (name, e) in enumerate(sorted(fams.items(), key=lambda kv: -(kv[1]["rec"]["sources"]["kogl"].get("downloads") or 0))):
        if a.limit and i >= a.limit: break
        first = e["files"][0]
        fid = re.sub(r"[^a-z0-9]+", "-", (first["en"] or "").lower()).strip("-") or "kogl-" + __import__("hashlib").md5(name.encode()).hexdigest()[:8]
        fid = "k-" + fid
        byw = {}
        for f in e["files"]:
            if f["italic"]: continue
            w = max(100, min(900, int(round(f["weight"] / 100.0)) * 100))
            byw.setdefault(w, f)  # 같은 굵기는 첫 파일(TTF/OTF 중 먼저 나온 것)
        d = os.path.join(out_dir, fid); os.makedirs(d, exist_ok=True)
        weights, stat = [], None
        for w, f in sorted(byw.items()):
            tt = TTFont(io.BytesIO(f["bytes"])); tt.flavor = "woff2"
            dest = os.path.join(d, f"{w}.woff2"); tt.save(dest); weights.append(w)
            if stat is None or w == 400: stat = cmap_stats(tt)
        lic = next((v for k, v in licenses.items() if k and k in first["path"]), None)
        open(os.path.join(d, "OFL.txt"), "wb").write(lic or (f"{name} — SIL Open Font License 1.1\n원 배포처: {e['rec']['sources']['kogl'].get('page')}\n라이선스 원문: https://openfontlicense.org/open-font-license-official-text/\n").encode("utf-8"))
        rfn = "reserved font name" in ((lic or b"").decode("utf-8", "ignore").lower() + first["license"].lower())
        syl, old, hanja = stat
        meta[fid] = {"name": name, "en": first["en"], "ko": first["ko"], "author": e["rec"]["sources"]["kogl"].get("author"),
                     "page": e["rec"]["sources"]["kogl"].get("page"), "downloads": e["rec"]["sources"]["kogl"].get("downloads"),
                     "weights": weights, "cov": syl, "old": old, "hanja": hanja, "rfn": rfn,
                     "files": {w: f"{PAGES_BASE}/{fid}/{w}.woff2" for w in weights},
                     "bytes": sum(os.path.getsize(os.path.join(d, f"{w}.woff2")) for w in weights), "catalog_key": norm(name)}
        meta[fid]["source_files"] = sorted(set(os.path.basename(f["path"]) for f in e["files"]))
        print(f"  {fid}: {name} 굵기 {weights} 한글 {syl}자 {'옛한글 ' if old else ''}{'한자 ' if hanja else ''}{meta[fid]['bytes']//1024}KB")
    json.dump(meta, open(OUT_META, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    unmatched = sorted(set(r["name"] for r in wanted.values()) - set(fams))
    print(f"\n웹폰트 {len(meta)}개, 총 {sum(m['bytes'] for m in meta.values())//1024//1024}MB · 묶음에 없음 {len(unmatched)}개")
    open(os.path.join(HERE, "state", "webfonts_unmatched.txt"), "w", encoding="utf-8").write("\n".join(unmatched) + "\n")

if __name__ == "__main__":
    main()
