#!/usr/bin/env python3
"""필사독서 생성 표지 넣기 — 이미지 폴더 → html/img/typing/<id>.webp(480×679, A5 세로) + index.json 'cover' 표시.

파일 이름은 표지 프롬프트 목록(docs/typing_cover_prompts.csv)의 '파일명'(<id>.png) 그대로가 가장 확실하고,
작품 제목 그대로(예: 메밀꽃 필 무렵.png)여도 찾는다(같은 제목이 둘이면 id로 저장해야 함).
비율이 A5와 다르면 가운데를 기준으로 잘라 맞춘다.

사용: .venv/bin/python tools/import_covers.py <이미지 폴더>
"""
import csv, json, os, re, sys, unicodedata
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "html", "img", "typing")
IDX = os.path.join(ROOT, "html", "data", "typing", "index.json")
W, H = 480, 679  # A5 1:1.414 (카드 최대 약 240px × 레티나 2배)


def norm(s):
    return re.sub(r"[\s·,.'’\"!?()\-_]", "", unicodedata.normalize("NFC", s)).lower()


def mark(index):
    """html/img/typing 에 있는 표지를 index.json 항목에 cover=수정 시각으로 표시(브라우저 캐시 갱신용)."""
    have = {f[:-5]: int(os.path.getmtime(os.path.join(OUT, f))) for f in os.listdir(OUT) if f.endswith(".webp")} if os.path.isdir(OUT) else {}
    n = 0
    for b in [b for t in index["themes"] for b in t["books"]] + index.get("library", []):
        if b["id"] in have: b["cover"] = have[b["id"]]; n += 1
        else: b.pop("cover", None)
    return n


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else ""
    index = json.load(open(IDX, encoding="utf-8"))
    books = [b for t in index["themes"] for b in t["books"]] + index.get("library", [])
    ids = {b["id"] for b in books}
    by_title = {}
    for b in books: by_title.setdefault(norm(b["title"]), set()).add(b["id"])
    os.makedirs(OUT, exist_ok=True)
    done, skip = 0, []
    # 생성 기록(generation-manifest.json)이 있으면 그 안의 source_id(<id>.png)로 정확히 짝짓기
    man = {}
    mp = os.path.join(src, "generation-manifest.json") if src else ""
    if mp and os.path.exists(mp):
        for x in json.load(open(mp, encoding="utf-8")):
            if x.get("filename") and x.get("source_id"): man[unicodedata.normalize("NFC", x["filename"])] = x["source_id"].rsplit(".", 1)[0]
    for f in sorted(os.listdir(src)) if src else []:
        stem, ext = os.path.splitext(f)
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp"): continue
        stem = unicodedata.normalize("NFC", stem)
        if man and unicodedata.normalize("NFC", f) not in man: skip.append(f); continue  # 기록에 없는 시안(…_안3 등)은 건너뜀
        bid = man.get(unicodedata.normalize("NFC", f)) if man else None
        bid = bid if bid in ids else stem if stem in ids else (next(iter(by_title[norm(stem)])) if len(by_title.get(norm(stem), ())) == 1 else None)
        if not bid: skip.append(f); continue
        im = Image.open(os.path.join(src, f)).convert("RGB")
        r = im.width / im.height
        if abs(r - W / H) > 0.01:  # 가운데 기준으로 A5 비율에 맞춰 자름
            if r > W / H: nw = round(im.height * W / H); im = im.crop(((im.width - nw) // 2, 0, (im.width - nw) // 2 + nw, im.height))
            else: nh = round(im.width * H / W); im = im.crop((0, (im.height - nh) // 2, im.width, (im.height - nh) // 2 + nh))
        im.resize((W, H), Image.LANCZOS).save(os.path.join(OUT, bid + ".webp"), "WEBP", quality=80, method=6)
        done += 1
    n = mark(index)
    json.dump(index, open(IDX, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"넣은 표지 {done}장 · 표지 있는 책 {n}권")
    if skip: print("이름을 못 맞춘 파일:", ", ".join(skip))


if __name__ == "__main__":
    main()
