"""Build on-device Korean glyph indexes from verified, web-embeddable preview originals.

Usage: python3 tools/build_image_font_index.py ../letsum-mirror/webfonts
Requires Node.js, Pillow with FreeType/WOFF2 support, fontTools and Brotli. Outputs comparison features, not fonts.
"""
import argparse
import gzip
import io
import json
import math
import os
import re
import struct
import subprocess
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "html" / "data"
# Preserve the small offline/error fallback used by older clients.
BASE_IDS = """
k-unpeople-gothic-ks-otf k-hakgyoansim-geurimilgi-ttf k-hakgyoansim-dunggeunmiso-ttf
k-hakgyoansim-bareondotum k-hakgyoansim-sangjang-otf-r k-hakgyoansim-bareonbatang
k-kim-jung-chul-myungjo k-ridi-batang k-kccdodamdodam k-tlabshinyb k-kcc-eunyoung
k-kcc-kimhoon k-yanolja-yache k-gabia-solmee k-kcc-ganpan k-hakgyoansim-mulgyeol
""".split()
LICENSES = {"OFL", "OFL 원본·고지 유지", "공공누리 제1유형", "온글잎 무료폰트 이용조건", "어비폰트 무료 배포 라이선스"}
KOGL = "공공누리 제1유형"
THRESHOLD = [0] * 128 + [255] * 128
FEATURE_SIZE = 11
EMPTY = bytes(FEATURE_SIZE)
SYLLABLES = [bytes((lead, trail)).decode("euc_kr")
             for lead in range(0xb0, 0xc9) for trail in range(0xa1, 0xff)]


def describe_glyph(font, char):
    mask = font.getmask(char, mode="L")
    if not mask.size[0] or not mask.size[1]:
        return None
    image = Image.frombytes("L", mask.size, bytes(mask)).point(THRESHOLD)
    box = image.getbbox()
    if not box:
        return None
    ink = image.crop(box)
    ratio = max(1, min(255, round(128 + 48 * math.log2(ink.width / ink.height))))
    cells = ink.resize((4, 5), Image.Resampling.BOX).tobytes()
    levels = [round(value / 17) for value in cells]
    return bytes([ratio] + [levels[i] * 16 + levels[i+1] for i in range(0, 20, 2)])


def catalog(mirror, cdn_dir):
    script = r"""
    const fs = require('fs'), vm = require('vm');
    process.stdout.write(JSON.stringify(vm.runInNewContext(fs.readFileSync('html/js/data.js','utf8')+'\n;FONTS')));
    """
    fonts = {r["id"]: r for r in json.loads(subprocess.check_output(["node", "-e", script], cwd=ROOT))}
    entries = {r["id"]: r for r in json.loads((DATA / "extractor-catalog.json").read_text())["fonts"]}
    cdn = json.loads((ROOT / "tools/state/cdn_fonts.json").read_text())
    blocked = [item["token"].casefold() for item in json.loads((ROOT / "tools/state/collection_blocks.json").read_text())]
    frequency = Counter()
    rows, faces = [], []
    for id_ in BASE_IDS + sorted(fonts.keys() - set(BASE_IDS)):
        f, row = fonts[id_], entries.get(id_)
        frequency.update(f.get("name", "") + " " + f.get("desc", ""))
        if (not row or not row["verified"] or f.get("status") != "verified" or f.get("intro")
                or f.get("license") not in LICENSES or row["license"] != f["license"]
                or f.get("matrix", {}).get("web") != "ok" or not f.get("cov") or not row.get("source")
                or any(s in (id_ + " " + row["name"]).casefold() for s in blocked)):
            continue
        weights = {}
        for weight, url in sorted((f.get("webfont") or {}).items(), key=lambda pair: int(pair[0])):
            parsed = urlparse(url)
            if url.startswith(f"https://geehg.github.io/letsum-mirror/webfonts/{id_}/"):
                path = mirror / id_ / Path(parsed.path).name
            elif parsed.scheme == "https" and cdn.get(id_, {}).get("files", {}).get(weight) == url:
                path = cdn_dir / id_ / (weight + Path(parsed.path).suffix)
            else:
                continue
            if not path.is_file():
                raise FileNotFoundError(f"Verified preview original missing: {id_} {weight} ({path})")
            weights[weight] = url
            faces.append((id_, int(weight), str(path)))
        if weights:
            default = min(weights, key=lambda w: abs(int(w) - 400))
            entry = dict(id=id_, name=row["name"], url=weights[default], source=row["source"], weights=weights)
            if f["license"] == KOGL:
                entry["attribution"] = f["attribution"]
            rows.append(entry)
    if [r["id"] for r in rows[:len(BASE_IDS)]] != BASE_IDS:
        raise ValueError("A fallback font has lost its verified preview")
    return rows, faces, frequency


def glyph_descriptors(source, weight):
    font = ImageFont.truetype(source, 48, layout_engine=ImageFont.Layout.BASIC)
    try:
        axes = font.get_variation_axes()
    except OSError:
        axes = []
    if axes:
        values = [min(a["maximum"], max(a["minimum"], weight))
                  if a["name"].lower() == b"weight" else a["default"] for a in axes]
        font.set_variation_by_axes(values)
    missing = describe_glyph(font, "\uffff")
    values = []
    for char in SYLLABLES:
        desc = describe_glyph(font, char)
        values.append(desc if desc and desc != missing else EMPTY)
    return b"".join(values) if any(v != EMPTY for v in values) else None


def render_face(face):
    id_, weight, path = face
    try:
        native = glyph_descriptors(path, weight)
        if native:
            return native
    except OSError:
        pass
    try:
        # The original stays intact. Match the OG renderer's in-memory outline fallback
        # for older hinting programs or incomplete embedded bitmap tables.
        from build_og import ttf_bytes
        decoded = ttf_bytes(Path(path).read_bytes(), dehint=True)
        return glyph_descriptors(io.BytesIO(decoded), weight)
    except (ValueError, OSError) as error:
        raise ValueError(f"Cannot rasterize {id_} {weight}: {error}") from error


def write_index(path, faces, columns, descriptors):
    data = bytearray(b"LFI2" + struct.pack("<HH", len(columns), len(faces)))
    data.extend(struct.pack("<" + "H" * len(columns), *(ord(SYLLABLES[i]) for i in columns)))
    for (id_, weight, _), glyphs in zip(faces, descriptors):
        name = id_.encode("ascii")
        data.extend(bytes([len(name)]) + name + struct.pack("<H", weight))
        data.extend(b"".join(glyphs[i*FEATURE_SIZE:(i+1)*FEATURE_SIZE] for i in columns))
    # mtime and filename are fixed so repeated builds are byte-identical.
    with path.open("wb") as file, gzip.GzipFile(filename="", mode="wb", compresslevel=6, fileobj=file, mtime=0) as archive:
        archive.write(data)
    return path.stat().st_size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mirror", type=Path)
    parser.add_argument("--cdn-dir", type=Path, default=ROOT / "tools/archive/cdn")
    parser.add_argument("--jobs", type=int, default=min(os.cpu_count() or 1, 6))
    args = parser.parse_args()
    rows, faces, frequency = catalog(args.mirror, args.cdn_dir)
    # The first, smaller request covers common syllables in public catalogue names/descriptions.
    # No search logs or user images/phrases contribute to the selection.
    first = sorted(range(len(SYLLABLES)), key=lambda i: (-frequency[SYLLABLES[i]], i))[:512]
    first_set = set(first)
    remaining = [i for i in range(len(SYLLABLES)) if i not in first_set]
    print(f"Rendering {len(rows)} families, {len(faces)} faces", flush=True)
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        rendered = pool.map(render_face, faces, chunksize=2)
        retained, descriptors = [], []
        for face, glyphs in zip(faces, rendered):
            if glyphs:
                retained.append(face)
                descriptors.append(glyphs)
            else:
                print(f"No usable Korean outlines: {face[0]} {face[1]}", flush=True)
    faces = retained
    eligible = {(id_, str(weight)) for id_, weight, _ in faces}
    for row in rows:
        row["weights"] = {w: url for w, url in row["weights"].items() if (row["id"], w) in eligible}
        if row["weights"]:
            default = min(row["weights"], key=lambda w: abs(int(w) - 400))
            row["url"] = row["weights"][default]
    rows = [row for row in rows if row["weights"]]
    if [row["id"] for row in rows[:len(BASE_IDS)]] != BASE_IDS:
        raise ValueError("A fallback font has no usable Korean glyphs")
    for label, columns in [("common", sorted(first)), ("extra", remaining)]:
        path = DATA / f"image-font-index-{label}.gz"
        print(path.name, write_index(path, faces, columns, descriptors), "bytes")
    (DATA / "image-fonts.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n")
    page = ROOT / "html/font-extractor.html"
    content, count = re.subn(r'(<span id="im-family-count">)[\d,]+종(</span>)',
                             lambda m: f"{m[1]}{len(rows):,}종{m[2]}", page.read_text())
    if count != 1:
        raise ValueError("Missing scanner coverage display")
    page.write_text(content)
    print(f"{len(rows)} families, {len(faces)} faces, {len(SYLLABLES)} distinct syllables")


if __name__ == "__main__":
    main()
