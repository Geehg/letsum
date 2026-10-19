#!/usr/bin/env python3
"""제작사 공식 사이트에서 받아 둔 폰트 묶음을 일괄 등록한다 (공유마당 일괄 등록 도구의 일반판).

입력  tools/state/ext_batch.json  { "<폴더>": { fam, org, lic, page, srcName, license?, matrix?, mode?, evidence, id?, released?, releasedSrc?, allowDup?, en? } }
        lic   : OFL | KOGL1 | KOGL3 | CUSTOM(license에 LICENSE_INFO 이름, matrix에 JS 표현)
        mode  : convert(WOFF2 변환) | keep(원본 그대로, 미러) | hosted(원본 그대로, letsum.app 서버 전용 — 재배포 금지 라이선스)
              생략 시 OFL·KOGL1 → convert(OFL RFN이면 keep), KOGL3·CUSTOM → keep
      tools/archive/ext/<폴더>/*  — 공식 배포 파일(git 제외)
출력  미러 webfonts/<id>/ 또는 tools/archive/hosted/<id>/ + data.js·license_manual.json
사용  python tools/import_local_batch.py --mirror ../letsum-mirror [--only 폴더,폴더] [--dry]
"""
import argparse, io, json, os, re, subprocess, sys
from collections import Counter
from datetime import date
from fontTools.ttLib import TTFont, TTCollection

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from import_gongu_batch import iter_fonts, nm, real_hangul, slug, weight_of, guess_cat, norm  # 같은 규칙 재사용

EXT = os.path.join(HERE, "archive", "ext"); BATCH = os.path.join(HERE, "state", "ext_batch.json")
DATA = os.path.join(ROOT, "html", "js", "data.js"); PAGES = "https://geehg.github.io/letsum-mirror/webfonts"
HOSTED = os.path.join(HERE, "archive", "hosted"); TODAY = date.today().isoformat()
LIC = {"OFL": ("OFL", "OFL_ALL_OK"), "KOGL1": ("공공누리 제1유형", "OFL_ALL_OK"),
       "KOGL3": ("공공누리 제3유형", '{ print: "ok", web: "ok", video: "ok", embed: "ok", bici: "ok", package: "ok", ofl: "no" }')}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--mirror", required=True); ap.add_argument("--only"); ap.add_argument("--dry", action="store_true"); a = ap.parse_args()
    batch = json.load(open(BATCH, encoding="utf-8"))
    if a.only: batch = {k: v for k, v in batch.items() if k in a.only.split(",")}
    js = "const fs=require('fs');const F=new Function(fs.readFileSync(process.argv[1],'utf8')+';return FONTS')();console.log(JSON.stringify(F))"
    fonts = json.loads(subprocess.run(["node", "-e", js, DATA], capture_output=True, text=True, check=True).stdout)
    ids = {f["id"] for f in fonts}
    names = json.load(open(os.path.join(ROOT, "html", "data", "names.json"), encoding="utf-8"))
    have = {norm(f["en"]) for f in fonts} | {norm(f["name"]) for f in fonts} | {norm(v.get("famEn")) for v in names.values()} | {norm(v.get("fam")) for v in names.values()}
    have.discard("")
    entries, manual = [], {}
    for key, b in batch.items():
        d = os.path.join(EXT, key)
        if not os.path.isdir(d): print("폴더 없음:", key); continue
        allf, txt = [], []
        for root, _, fs in os.walk(d):
            for fn in sorted(fs):
                if fn.startswith("._"): continue
                p = os.path.join(root, fn)
                for path, data, ext in iter_fonts(open(p, "rb").read(), fn):
                    if ext == "txt": txt.append(data); continue
                    if ext == "woff": continue  # WOFF2·원본이 있으면 충분
                    try: t = TTCollection(io.BytesIO(data)).fonts[0] if ext == "ttc" else TTFont(io.BytesIO(data))
                    except Exception: continue
                    if t["OS/2"].fsSelection & 1: continue
                    fk = re.sub(r"(?i)[\s_-]*(thin|light|regular|medium|semibold|bold|extrabold|black|heavy|[blmrt]|eb|bl|sb)$", "", nm(t, 16, 0x409) or nm(t, 1, 0x409) or "").strip().lower()
                    allf.append({"w": weight_of(t, path), "rank": {"woff2": 0, "ttf": 1, "otf": 2}.get(ext, 9), "ext": ext, "data": data, "t": t, "path": path, "fk": fk})
        if not allf: print("폰트 파일 없음:", key); continue
        main_fk = Counter(f["fk"] for f in allf).most_common(1)[0][0]; k5 = lambda x: re.sub(r"[^0-9a-z가-힣]", "", x)[:5]
        files = {}
        for f in allf:
            if k5(f["fk"]) != k5(main_fk): continue
            cur = files.get(f["w"])
            hk = lambda x: sum(1 for c in (x["t"].getBestCmap() or {}) if 0xAC00 <= c <= 0xD7A3)
            if not cur or (hk(f), -f["rank"]) > (hk(cur), -cur["rank"]): files[f["w"]] = f  # 같은 굵기면 한글이 많은 파일(영문 전용 파일 제외), 그다음 형식 순
        base = files.get(400) or files[sorted(files)[0]]; t = base["t"]
        en = re.sub(r"(?i)\s*(otf|ttf)$", "", nm(t, 16, 0x409) or nm(t, 1, 0x409) or b["fam"]).strip()
        if b.get("en"): en = b["en"]  # 같은 가족의 다른 판이면 영문명을 따로 지정
        ko = nm(t, 16, 0x412) or nm(t, 1, 0x412)
        if not b.get("allowDup") and (norm(en) in have or norm(b["fam"]) in have):  # allowDup: 같은 가족의 다른 판(예: 컬러판)을 따로 등록할 때만
            print("이미 등록:", b["fam"], "/", en, "/", ko); continue
        hv = real_hangul(t)
        if len(hv) < 2000: print("한글 부족:", b["fam"], len(hv)); continue
        lictxt = b"".join(txt).decode("utf-8", "ignore") + " ".join(filter(None, [nm(t, 13, 0x409), nm(t, 0, 0x409)]))
        rfn = bool(re.search(r"reserved font name", lictxt, re.I))
        mode = b.get("mode") or ("keep" if b["lic"] in ("KOGL3", "CUSTOM") or (b["lic"] == "OFL" and rfn) else "convert")
        fid = "k-" + (b.get("id") or re.sub(r"-(b|l|r|m|eb|bold|light|regular|medium)$", "", slug(en)) or key)
        while fid in ids: fid += "-2"
        ids.add(fid); have.add(norm(en))
        webfont = {}
        outdir = os.path.join(HOSTED, fid) if mode == "hosted" else os.path.join(a.mirror, "webfonts", fid)
        for w, f in sorted(files.items()):
            ext = f["ext"] if mode in ("keep", "hosted") or f["ext"] == "woff2" else "woff2"
            webfont[str(w)] = (f"https://letsum.app/fonts-hosted/{fid}/{w}.{ext}" if mode == "hosted" else f"{PAGES}/{fid}/{w}.{ext}")
            if a.dry: continue
            os.makedirs(outdir, exist_ok=True)
            if ext == f["ext"]: open(os.path.join(outdir, f"{w}.{ext}"), "wb").write(f["data"])
            else:
                tt = TTFont(io.BytesIO(f["data"])); tt.flavor = "woff2"; tt.save(os.path.join(outdir, f"{w}.woff2"))
        lname, matrix = (b["license"], b["matrix"]) if b["lic"] == "CUSTOM" else LIC[b["lic"]]
        how = {"convert": "WOFF2 형식 변환(글리프 그대로)", "keep": "원본 파일 그대로(변환 없음)", "hosted": "원본 파일 그대로, letsum.app 서버에서 화면 표시용으로만"}[mode]
        if not a.dry:
            open(os.path.join(outdir, "LICENSE.txt"), "w", encoding="utf-8").write(f"{b['fam']} — {b['org']}\n이용조건: {lname}\n원 배포처: {b['page']}\n이 폴더의 파일은 LETSUM 미리보기용입니다: {how}.\n")
            if b["lic"] == "OFL" and txt: open(os.path.join(outdir, "OFL.txt"), "wb").write(txt[0])
        cat, gen, tags, mood, pair = guess_cat(b["fam"])
        ws = sorted(files); n = len(hv)
        q = lambda l: "[" + ", ".join(json.dumps(x, ensure_ascii=False) for x in l) + "]"
        wf = "{ " + ", ".join(f'{w}: "{webfont[str(w)]}"' for w in ws) + " }"
        fmts = sorted({f["ext"].upper() for f in files.values()} | ({"WOFF2"} if mode == "convert" else set()))
        attribution = f"{b['fam']} © {b['org']}, {lname}" if b["lic"].startswith("KOGL") else b.get("attribution", "")
        rel = f'released: "{b["released"]}", releasedSrc: {json.dumps(b.get("releasedSrc", "배포처 공식 페이지"), ensure_ascii=False)}, releasedUrl: "{b["page"]}",' if b.get("released") else ""
        desc = b.get("desc") or f"{b['org']}에서 무료로 배포하는 글꼴. 굵기 {len(ws)}종, 한글 {n:,}자를 지원합니다."
        entries.append(f'''  {{ id: "{fid}", name: {json.dumps(b['fam'], ensure_ascii=False)}, en: {json.dumps(en, ensure_ascii=False)}, family: "'LS {fid}', {gen}",
    designer: {json.dumps(b.get('designer', b['org']), ensure_ascii=False)}, holder: {json.dumps(b['org'], ensure_ascii=False)}, category: "{b.get('category', cat)}",
    tags: {q(b.get('tags', tags))}, mood: {q(b.get('mood', mood))}, weights: [{", ".join(map(str, ws))}], formats: {q(fmts)},
    cov: {n}, glyphs: "한글 {n:,}자", old: false, hanja: false,
    webfont: {wf}, webfontSrc: "배포처 공식 파일 · {how}",{f' hostedNote: "원본 파일을 변환 없이 LETSUM 서버에서 화면 표시용으로만 사용(재배포 금지 라이선스)",' if mode == "hosted" else ''}
    dl: {{ page: "{b['page']}", srcName: {json.dumps(b['srcName'], ensure_ascii=False)} }},
    license: "{lname}", matrix: {matrix}, verified: "{TODAY}", status: "verified",{f' attribution: {json.dumps(attribution, ensure_ascii=False)},' if attribution else ''}
    {rel}
    pair: "{b.get('pair', pair)}", pop: 40, added: "{TODAY}",
    desc: {json.dumps(desc, ensure_ascii=False)} }},''')
        manual[fid] = {"license": lname, "evidence": b["evidence"] + (" · 파일 RFN 있어 원본 그대로" if rfn and b["lic"] == "OFL" else ""), "page": b["page"], "checked": TODAY}
        print(f"{fid}: {b['fam']} [{b['lic']}{' RFN' if rfn else ''} · {mode}] 굵기 {ws} · 한글 {n}")
    print(f"등록 {len(entries)}종")
    if a.dry or not entries: return
    src = open(DATA, encoding="utf-8").read(); s0 = src.index("const FONTS = ["); e = src.index("\n];", s0)
    src = src[:e] + "\n" + "\n".join(entries) + src[e:]
    open(DATA, "w", encoding="utf-8").write(src)
    lmp = os.path.join(HERE, "state", "license_manual.json"); lm = json.load(open(lmp, encoding="utf-8")); lm.update(manual)
    json.dump(lm, open(lmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
