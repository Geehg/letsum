#!/usr/bin/env python3 -I
"""승인된 폰트의 원본 ZIP을 받아 해시를 기록하고 R2 미러(dl.letsum.app)에 올린다. 3단계 다운로드 전략의 A단계.

대상: catalog.json에서 review=approved 이고 license_auto가 재배포 허용(OFL/Apache/UFL/MIT)인 레코드,
      또는 --ids 로 지정한 사이트 폰트(data.js의 id).
동작: 원 배포처 ZIP(Google Fonts download / GitHub 릴리스 자산) 내려받기 → sha256 기록(tools/state/archive.json)
      → tools/archive/<id>.zip 보관(NAS·git 외부) → wrangler로 R2 'letsum-fonts' 버킷에 업로드.
업로드 인증은 `npx wrangler login`(OAuth) 또는 환경변수 CLOUDFLARE_API_TOKEN. 토큰을 코드·저장소에 두지 않는다.
업로드가 끝나면 data.js의 해당 폰트에 dl: { mirror: "https://dl.letsum.app/<id>.zip" } 를 넣도록 제안을 출력한다(자동 수정하지 않음).

사용:  python3 -I tools/archive_files.py --ids jua gowun-batang      # 사이트 폰트 지정
       python3 -I tools/archive_files.py --approved                  # 카탈로그 승인분 전체
       python3 -I tools/archive_files.py --ids jua --no-upload        # 보관·해시만
"""
import argparse, hashlib, json, os, re, subprocess, sys, urllib.request
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ARCHIVE_DIR = os.environ.get("LETSUM_ARCHIVE_DIR", os.path.join(HERE, "archive"))
STATE = os.path.join(HERE, "state", "archive.json")
CATALOG = os.path.join(HERE, "state", "catalog.json")
SITE_DATA = os.path.join(HERE, "..", "html", "js", "data.js")
BUCKET = os.environ.get("LETSUM_R2_BUCKET", "letsum-fonts")
MIRROR_BASE = os.environ.get("LETSUM_MIRROR_BASE", "https://dl.letsum.app")
REDISTRIBUTABLE = {"OFL", "Apache", "UFL", "MIT"}
UA = {"User-Agent": "letsum-archive/1.0 (+https://letsum.app)"}

def site_fonts():
    src = open(SITE_DATA, encoding="utf-8").read()
    out = {}
    for m in re.finditer(r'\{ id: "([^"]+)", name: "([^"]*)", en: "([^"]+)".*?license: "([^"]+)"', src, re.S):
        out[m.group(1)] = {"name": m.group(2), "en": m.group(3), "license": m.group(4)}
    return out

def google_zip(family, dest):
    """Google Fonts는 ZIP 파일 주소가 없고(페이지가 JS로 묶어 내려줌), 파일 목록(manifest)만 공개한다.
    fileRefs의 TTF와 OFL.txt를 받아 직접 ZIP으로 묶는다. 반환: (sha256, bytes, 원본 파일 URL 목록)"""
    import io, zipfile
    url = f"https://fonts.google.com/download/list?family={family.replace(' ', '+')}"
    raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8")
    man = json.loads(raw[raw.index("{"):])["manifest"]
    buf = io.BytesIO(); srcs = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for f in man.get("files", []):  # OFL.txt 등 본문이 들어 있는 파일
            z.writestr(f["filename"], f["contents"])
        for r in man.get("fileRefs", []):  # 폰트 파일
            data = urllib.request.urlopen(urllib.request.Request(r["url"], headers=UA), timeout=120).read()
            z.writestr(r["filename"], data); srcs.append(r["url"])
        z.writestr("SOURCE.txt", f"Mirrored by LETSUM from Google Fonts ({date.today().isoformat()})\n" + "\n".join(srcs) + "\n")
    data = buf.getvalue(); open(dest, "wb").write(data)
    return hashlib.sha256(data).hexdigest(), len(data), srcs

def source_url(rec):
    """원 배포처 ZIP URL. Google Fonts는 manifest 기반(google_zip), 그 외 GitHub 최신 릴리스의 첫 zip 자산."""
    if "google" in rec.get("sources", {}):
        return f"https://fonts.google.com/download/list?family={rec['name'].replace(' ', '+')}", "google"
    gh = rec.get("sources", {}).get("github")
    if gh and gh.get("tag"):
        api = f"https://api.github.com/repos/{gh['repo']}/releases/latest"
        d = json.loads(urllib.request.urlopen(urllib.request.Request(api, headers=UA), timeout=30).read())
        for a in d.get("assets", []):
            if a["name"].lower().endswith(".zip"):
                return a["browser_download_url"], "github"
    return None, None

def download(url, dest):
    req = urllib.request.Request(url, headers=UA)
    h = hashlib.sha256(); n = 0
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as fp:
        while True:
            chunk = r.read(1 << 16)
            if not chunk: break
            fp.write(chunk); h.update(chunk); n += len(chunk)
    return h.hexdigest(), n

def upload(path, key):
    cmd = ["npx", "-y", "wrangler@4", "r2", "object", "put", f"{BUCKET}/{key}", "--file", path, "--content-type", "application/zip", "--remote"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout)[-400:])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=[]); ap.add_argument("--approved", action="store_true"); ap.add_argument("--no-upload", action="store_true")
    a = ap.parse_args()
    os.makedirs(ARCHIVE_DIR, exist_ok=True); os.makedirs(os.path.dirname(STATE), exist_ok=True)
    state = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}
    catalog = json.load(open(CATALOG, encoding="utf-8")) if os.path.exists(CATALOG) else {}
    fonts = site_fonts()
    targets = []  # (id, record-like)
    for fid in a.ids:
        if fid not in fonts: print(f"! data.js에 없는 id: {fid}"); continue
        f = fonts[fid]
        if f["license"] not in REDISTRIBUTABLE: print(f"! {fid}: 라이선스 {f['license']} — 재배포 허용 확인 전이라 건너뜀"); continue
        targets.append((fid, {"name": f["en"], "sources": {"google": {}}}))
    if a.approved:
        for k, r in catalog.items():
            if r.get("review") == "approved" and r.get("license_auto") in REDISTRIBUTABLE:
                targets.append((r.get("site_id") or k, r))
    if not targets: print("대상이 없습니다. --ids <id...> 또는 --approved"); return
    suggestions = []
    for fid, rec in targets:
        url, src = source_url(rec)
        if not url: print(f"! {fid}: 원본 ZIP URL을 찾지 못함"); continue
        dest = os.path.join(ARCHIVE_DIR, f"{fid}.zip")
        try:
            sha, size = google_zip(rec["name"], dest)[:2] if src == "google" else download(url, dest)
        except Exception as e:
            print(f"! {fid}: 다운로드 실패 {e}"); continue
        prev = state.get(fid, {})
        changed = prev.get("sha256") != sha
        state[fid] = {"source": url, "root": src, "sha256": sha, "bytes": size, "archived": date.today().isoformat(),
                      "mirror": f"{MIRROR_BASE}/{fid}.zip", "uploaded": prev.get("uploaded")}
        print(f"{'●' if changed else '○'} {fid}: {size/1024:.0f}KB sha256 {sha[:12]} ({'변경' if changed else '동일'})")
        if not a.no_upload and (changed or not prev.get("uploaded")):
            try:
                upload(dest, f"{fid}.zip"); state[fid]["uploaded"] = date.today().isoformat(); print(f"  ↑ R2 {BUCKET}/{fid}.zip")
            except Exception as e:
                print(f"  ! 업로드 실패: {e}")
        if state[fid].get("uploaded"):
            suggestions.append(f'{fid}: dl: {{ mirror: "{state[fid]["mirror"]}", page: "{"https://fonts.google.com/specimen/" + rec["name"].replace(" ", "+") if src == "google" else url}" }}')
    json.dump(state, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if suggestions:
        print("\ndata.js에 넣을 미러 필드 제안:"); [print("  " + s) for s in suggestions]

if __name__ == "__main__":
    main()
