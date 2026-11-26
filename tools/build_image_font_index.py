"""Build on-device Korean glyph indexes from the Korean catalogue and approved reference originals.

Usage: python3 tools/build_image_font_index.py ../letsum-mirror/webfonts
Uses the existing mirror, cdn and private hosted archives. Under --references store
google/<reviewed revision>/<OFL slug>/<original filename or OFL.txt> and
specimens/<catalogue id>/<numeric weight>. Private specimen originals must match
tools/state/image_font_specimens.json. Only the comparison features go into html/data.
Requires Node.js, Pillow, NumPy, fontTools and Brotli.
"""
import argparse
import gzip
import hashlib
import io
import json
import math
import os
import re
import struct
import subprocess
import tempfile
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from functools import partial
from pathlib import Path
from urllib.parse import quote, urlparse

import numpy as np
from PIL import Image, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "html" / "data"
# Preserve the small offline/error fallback used by older clients.
BASE_IDS = """
k-unpeople-gothic-ks-otf k-hakgyoansim-geurimilgi-ttf k-hakgyoansim-dunggeunmiso-ttf
k-hakgyoansim-bareondotum k-hakgyoansim-sangjang-otf-r k-hakgyoansim-bareonbatang
k-kim-jung-chul-myungjo k-ridi-batang k-kccdodamdodam k-tlabshinyb k-kcc-eunyoung
k-kcc-kimhoon k-yanolja-yache k-gabia-solmee k-kcc-ganpan k-hakgyoansim-mulgyeol
""".split()
THRESHOLD = [0] * 128 + [255] * 128
FEATURE_SIZE = 27
BLOCK_SIZE = 128
SYLLABLES = [chr(code) for code in range(0xac00, 0xd7a4)]
# Compare horizontal, vertical and diagonal ink changes in sixteen regions.
EDGE_PAIRS = []
for y in (0, 2, 5, 7):
    for x in (0, 2, 4, 6):
        cell = 8 * y + x
        EDGE_PAIRS.extend(((cell, cell + 1), (cell + 8, cell + 16),
                           (cell, cell + 17), (cell + 1, cell + 16)))
EDGE_A, EDGE_B = zip(*EDGE_PAIRS)


def describe_glyph(font, char, detailed=False):
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
    coarse = bytes([ratio] + [levels[i] * 16 + levels[i+1] for i in range(0, 20, 2)])
    return (coarse, ink.resize((8, 10), Image.Resampling.BOX).tobytes()) if detailed else coarse


def google_faces(font, google, references):
    slug = re.sub(r"[^a-z0-9]", "", font["en"].lower())
    files = google["families"].get(slug, {})
    folder = references / "google" / google["revision"] / slug
    if "OFL.txt" not in files:
        return {}
    notice = folder / "OFL.txt"
    if notice.stat().st_size != files["OFL.txt"] or "SIL OPEN FONT LICENSE" not in notice.read_text("utf-8-sig").upper():
        raise ValueError(f"Cannot verify pinned Google licence: {slug}")
    faces = {}
    for name, length in sorted(files.items()):
        if not name.lower().endswith((".ttf", ".otf")):
            continue
        path = folder / name
        if path.stat().st_size != length:
            raise ValueError(f"Incomplete Google source: {name}")
        url = f"https://raw.githubusercontent.com/google/fonts/{google['revision']}/ofl/{slug}/{quote(name)}"
        with TTFont(path, lazy=True) as original:
            if "fvar" in original:
                axis = next((a for a in original["fvar"].axes if a.axisTag == "wght"), None)
            else:
                axis = None
            weights = ([w for w in font["weights"] if axis.minValue <= w <= axis.maxValue]
                       if axis else [original["OS/2"].usWeightClass])
        for weight in weights:
            faces[int(weight)] = (url, path)
    return faces


def catalog(mirror, cdn_dir, hosted, references):
    script = r"""
    const fs = require('fs'), vm = require('vm');
    process.stdout.write(JSON.stringify(vm.runInNewContext(fs.readFileSync('html/js/data.js','utf8')+'\n;FONTS')));
    """
    fonts = {r["id"]: r for r in json.loads(subprocess.check_output(["node", "-e", script], cwd=ROOT))}
    entries = {r["id"]: r for r in json.loads((DATA / "extractor-catalog.json").read_text())["fonts"]}
    cdn = json.loads((ROOT / "tools/state/cdn_fonts.json").read_text())
    blocked = [item["token"].casefold() for item in json.loads((ROOT / "tools/state/collection_blocks.json").read_text())]
    google = json.loads((ROOT / "tools/state/extractor_google_ofl.json").read_text())
    specimens = json.loads((ROOT / "tools/state/image_font_specimens.json").read_text())
    frequency = Counter()
    rows, faces = [], []
    for id_ in BASE_IDS + sorted(fonts.keys() - set(BASE_IDS)):
        font, info = fonts[id_], entries[id_]
        name = info["name"]
        frequency.update(font.get("name", "") + " " + font.get("desc", ""))
        if any(token in (id_ + " " + name).casefold() for token in blocked):
            raise ValueError(f"Blocked font in catalogue: {id_}")
        source = info.get("source") or font.get("dl", {}).get("page")
        entry = dict(id=id_, name=name, source=source, weights={})
        originals = {}
        if font.get("intro"):
            entry["mode"] = "local"
            if font.get("weightsUnknown"):
                entry["unknownWeights"] = True
            entry["aliases"] = list(dict.fromkeys([name, font.get("en", ""), *info.get("aliases", [])]))
            if font.get("specimen") and id_ in specimens:
                entry["mode"] = "signature"
                entry["specimen"] = "/" + font["specimen"].lstrip("/")
                for weight, digest in specimens[id_].items():
                    path = references / "specimens" / id_ / weight
                    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                        raise ValueError(f"Changed private specimen original: {id_} {weight}")
                    originals[int(weight)] = (None, path)
            else:
                entry["weights"] = {str(w): None for w in font["weights"]}
        elif font.get("webfont"):
            if not (info["verified"] and font.get("status") == "verified" and
                    font.get("matrix", {}).get("web") == "ok" and source):
                raise ValueError(f"Unverified catalogue preview: {id_}")
            for weight, url in font["webfont"].items():
                parsed = urlparse(url)
                if url.startswith(f"https://geehg.github.io/letsum-mirror/webfonts/{id_}/"):
                    path = mirror / id_ / Path(parsed.path).name
                elif url.startswith("https://letsum.app/fonts-hosted/"):
                    path = hosted / parsed.path.removeprefix("/fonts-hosted/")
                elif parsed.scheme == "https" and cdn.get(id_, {}).get("files", {}).get(weight) == url:
                    path = cdn_dir / id_ / (weight + Path(parsed.path).suffix)
                else:
                    raise ValueError(f"Unknown preview source: {id_} {weight}")
                originals[int(weight)] = (url, path)
        else:
            originals = google_faces(font, google, references)
            if not originals:
                raise ValueError(f"No verified source for {id_}")
            entry["source"] = "https://fonts.google.com/specimen/" + quote(font["en"].replace(" ", "+"), safe="+")
        if font.get("attribution"):
            entry["attribution"] = font["attribution"]
        for weight, (url, path) in sorted(originals.items()):
            if not path.is_file():
                raise FileNotFoundError(f"Missing original: {id_} {weight} ({path})")
            entry["weights"][str(weight)] = url
            faces.append((id_, weight, str(path)))
        rows.append(entry)
    if [r["id"] for r in rows[:len(BASE_IDS)]] != BASE_IDS:
        raise ValueError("A fallback font has lost its verified preview")
    return rows, faces, frequency


def glyph_descriptors(source, weight, supported, skip_broken=False):
    font = ImageFont.truetype(source, 48, layout_engine=ImageFont.Layout.BASIC)
    try:
        axes = font.get_variation_axes()
    except OSError:
        axes = []
    if axes:
        values = [min(a["maximum"], max(a["minimum"], weight))
                  if a["name"].lower() == b"weight" else a["default"] for a in axes]
        font.set_variation_by_axes(values)
    missing = describe_glyph(font, "\uffff", detailed=True)
    descriptors = np.zeros((len(SYLLABLES), FEATURE_SIZE), dtype=np.uint8)
    tiles = np.zeros((len(SYLLABLES), 80), dtype=np.int16)
    for code in supported:
        if not 0xac00 <= code <= 0xd7a3:
            continue
        try:
            desc = describe_glyph(font, chr(code), detailed=True)
        except OSError:
            if not skip_broken:
                raise
            continue
        if desc and desc != missing:
            index = code - 0xac00
            descriptors[index, :11] = np.frombuffer(desc[0], dtype=np.uint8)
            tiles[index] = np.frombuffer(desc[1], dtype=np.uint8)
    if not descriptors[:, 0].any():
        return None
    changes = tiles[:, EDGE_A] - tiles[:, EDGE_B]
    descriptors[:, 11:19] = np.packbits(changes > 24, axis=1, bitorder="little")
    descriptors[:, 19:] = np.packbits(changes < -24, axis=1, bitorder="little")
    return descriptors.tobytes()


def render_face(face):
    id_, weight, path = face
    with TTFont(path, lazy=True) as original:
        supported = set(original.getBestCmap() or {})
    try:
        native = glyph_descriptors(path, weight, supported)
        if native:
            return native
    except OSError:
        pass
    try:
        # The original stays intact. Match the OG renderer's in-memory outline fallback
        # for older hinting programs or incomplete embedded bitmap tables.
        from build_og import ttf_bytes
        decoded = ttf_bytes(Path(path).read_bytes(), dehint=True)
        return glyph_descriptors(io.BytesIO(decoded), weight, supported, skip_broken=True)
    except (ValueError, OSError) as error:
        raise ValueError(f"Cannot rasterize {id_} {weight}: {error}") from error


def cached_face(face, cache):
    # Shared originals and unchanged faces need only one rasterization on subsequent builds.
    digest = hashlib.sha256(Path(face[2]).read_bytes()).hexdigest()
    path = cache / f"{digest}-{face[1]}.gz"
    if path.is_file():
        try:
            with gzip.open(path, "rb") as saved:
                data = saved.read()
            if len(data) in (0, len(SYLLABLES) * FEATURE_SIZE):
                return data or None
        except (OSError, EOFError):
            pass
    data = render_face(face)
    with tempfile.NamedTemporaryFile(dir=cache, delete=False) as tmp:
        tmp.write(gzip.compress(data or b"", compresslevel=1, mtime=0))
    os.replace(tmp.name, path)
    return data


def write_blocks(rows, faces, descriptors, frequency):
    # Group common characters together. Request only fixed public blocks, never a user phrase.
    order = sorted(range(len(SYLLABLES)), key=lambda i: (-frequency[SYLLABLES[i]], i))
    chars = "".join(SYLLABLES[i] for i in order)
    digest = hashlib.sha256(b"LFI3" + chars.encode("utf-8"))
    for (id_, weight, _), glyphs in zip(faces, descriptors):
        digest.update(f"{id_}/{weight}\\n".encode("ascii"))
        digest.update(glyphs)
    stamp = digest.digest()[:16]
    folder = DATA / "image-font-grid" / stamp.hex()
    folder.mkdir(parents=True, exist_ok=True)
    arrays = [np.frombuffer(buf, dtype=np.uint8).reshape(-1, FEATURE_SIZE) for buf in descriptors]
    for start in range(0, len(order), BLOCK_SIZE):
        indices = order[start:start + BLOCK_SIZE]
        path = folder / f"{start // BLOCK_SIZE}.gz"
        header = struct.pack("<4sHHHH16s", b"LFI3", start, len(indices), len(faces), FEATURE_SIZE, stamp)
        with tempfile.NamedTemporaryFile(dir=folder, delete=False) as out:
            with gzip.GzipFile(filename="", mode="wb", compresslevel=5, fileobj=out, mtime=0) as gz:
                gz.write(header)
                for face in arrays:
                    gz.write(face[indices].tobytes())
        os.chmod(out.name, 0o644)
        os.replace(out.name, path)
    rows[0]["shapeIndex"] = {"revision": stamp.hex(), "blockSize": BLOCK_SIZE, "characters": chars}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mirror", type=Path)
    parser.add_argument("--cdn-dir", type=Path, default=ROOT / "tools/archive/cdn")
    parser.add_argument("--hosted-dir", type=Path, default=ROOT / "tools/archive/hosted")
    parser.add_argument("--references", type=Path, default=ROOT / "tools/archive/image-scanner")
    parser.add_argument("--jobs", type=int, default=min(os.cpu_count() or 1, 6))
    args = parser.parse_args()
    rows, faces, frequency = catalog(args.mirror, args.cdn_dir, args.hosted_dir, args.references)
    print(f"Rendering {len(rows)} families, {len(faces)} faces", flush=True)
    cache = args.references / "glyph-cache-lfi3-hangul-v1"
    cache.mkdir(parents=True, exist_ok=True)
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        rendered = pool.map(partial(cached_face, cache=cache), faces, chunksize=2)
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
        if row.get("mode") == "local":
            continue
        row["weights"] = {w: url for w, url in row["weights"].items() if (row["id"], w) in eligible}
        if not row["weights"]:
            raise ValueError(f"No real Korean outlines for {row.get('id')}")
        if row.get("mode") != "signature":
            default = min(row["weights"], key=lambda w: abs(int(w) - 400))
            row["url"] = row["weights"][default]
    if [row["id"] for row in rows[:len(BASE_IDS)]] != BASE_IDS:
        raise ValueError("A fallback font has no usable Korean glyphs")
    write_blocks(rows, faces, descriptors, frequency)
    (DATA / "image-fonts.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n")
    page = ROOT / "html/font-extractor.html"
    content = page.read_text()
    local_count = sum(row.get("mode") == "local" for row in rows)
    for element, value in [("im-family-count", len(rows)), ("im-auto-count", len(rows) - local_count),
                           ("im-local-count", local_count)]:
        pattern = rf'(<(?:span|strong) id="{element}">)[\d,]+종(</(?:span|strong)>)'
        content, count = re.subn(pattern, lambda m: f"{m[1]}{value:,}종{m[2]}", content)
        if count != 1:
            raise ValueError(f"Missing scanner coverage display: {element}")
    page.write_text(content)
    print(f"{len(rows)} families, {len(faces)} faces, {len(SYLLABLES)} distinct syllables")


if __name__ == "__main__":
    main()
