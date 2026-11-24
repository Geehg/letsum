"""Build browser-only, text-independent comparison features from approved local mirror files.

Usage: python3 tools/build_image_font_index.py ../letsum-mirror/webfonts
Requires Pillow with FreeType/WOFF2 support and Node.js. No font files are produced.
"""
import argparse
import json
import math
import struct
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "html" / "data"
# Keep the original families first for the fallback when the sample has no indexed syllables.
BASE_IDS = """
k-unpeople-gothic-ks-otf k-hakgyoansim-geurimilgi-ttf k-hakgyoansim-dunggeunmiso-ttf
k-hakgyoansim-bareondotum k-hakgyoansim-sangjang-otf-r k-hakgyoansim-bareonbatang
k-kim-jung-chul-myungjo k-ridi-batang k-kccdodamdodam k-tlabshinyb k-kcc-eunyoung
k-kcc-kimhoon k-yanolja-yache k-gabia-solmee k-kcc-ganpan k-hakgyoansim-mulgyeol
""".split()
EXTRA_IDS = """
k-kccahnjunggeun k-kcc-jeongbeom k-kcc-kimhwanki k-ownglyph-2022-uwy-jae-seon
k-ownglyph-2022-uwy-si-woo k-ownglyph-2022-uwy-da-gyeong k-hakgyoansim-kkokkoma
k-hakgyoansim-kossuyeom k-jaemin3-0 k-hakgyoansim-moheomga k-jaemin2-0
k-hakgyoansim-jiugae k-hakgyoansim-usan k-hakgyoansim-rikodeo k-hakgyoansim-eunhasu k-kcc-sonkeechung
k-ownglyph-2022-uwy-yoon-yeong k-hakgyoansim-samulham k-hakgyoansim-kkwabaegi
k-hakgyoansim-yeohaeng k-hakgyoansim-namu k-hakgyoansim-gureum k-hakgyoansim-sonagi
k-hakgyoansim-dotbogi k-hakgyoansim-mabeopsa k-hakgyoansim-mondangbunfil-otf-r
k-hakgyoansim-boardmarker-otf-r k-hakgyoansim-sketchbook-otf-r k-kccimkwontaek k-wonju
k-line-seed-kr k-cafe24-classictype k-cafe24-dangdanghae k-cafe24-danjunghae k-cafe24-dongdong
k-cafe24-moyamoya k-cafe24-ohsquare k-cafe24-oneprettynight k-cafe24-shiningstar k-gabia-bombaram
k-gabia-napjakblock k-ghanachocolate k-kcchyerim k-kccbangjeonghwan k-kccmurukmuruk
k-kim-jung-chul-script k-kim-jung-chul-gothic k-kcc-ahnchangho
""".split()


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


THRESHOLD = [0] * 128 + [255] * 128
EMPTY = bytes(11)


def catalog():
    # Use the same canonical catalogue as build_extractor_catalog.cjs, including display-only and
    # verification flags. Only the enrolled Korean preview faces ever enter the index.
    script = """
    const fs = require('fs'), vm = require('vm');
    const source = fs.readFileSync('html/js/data.js', 'utf8');
    process.stdout.write(JSON.stringify(vm.runInNewContext(source+'\\n;FONTS').map(
      ({id,webfont,status,intro,license}) => ({id,webfont,status,intro,license}))));
    """
    fonts = {r["id"]: r for r in json.loads(subprocess.check_output(["node", "-e", script], cwd=ROOT))}
    entries = {r["id"]: r for r in json.loads((DATA / "extractor-catalog.json").read_text())["fonts"]}
    output = []
    for id_ in BASE_IDS + EXTRA_IDS:
        row, font = entries[id_], fonts[id_]
        if (not row["verified"] or font["status"] != "verified" or font.get("intro")
                or row["license"] != "OFL" or font["license"] != "OFL"):
            raise ValueError(f"Font permissions or verification changed: {id_}")
        weights = {k: url for k, url in sorted(font["webfont"].items(), key=lambda pair: int(pair[0]))
                   if url.startswith(f"https://geehg.github.io/letsum-mirror/webfonts/{id_}/")}
        output.append({"id": id_, "name": row["name"], "url": weights["400"],
                       "source": row["source"], "weights": weights})
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mirror", type=Path, help="path to letsum-mirror/webfonts")
    mirror = parser.parse_args().mirror
    rows = catalog()
    # 2,350 KS X 1001 syllables. Read as one constant asset to keep all input text on-device.
    syllables = [bytes((lead, trail)).decode("euc_kr")
                 for lead in range(0xb0, 0xc9) for trail in range(0xa1, 0xff)]
    faces = [(row, weight, url) for row in rows for weight, url in row["weights"].items()]
    index = bytearray(b"LFI2" + struct.pack("<HH", len(syllables), len(faces)))
    index.extend(struct.pack("<" + "H" * len(syllables), *map(ord, syllables)))
    for row, weight, url in faces:
        id_ = row["id"].encode("ascii")
        index.extend(bytes([len(id_)]) + id_ + struct.pack("<H", int(weight)))
        path = mirror / row["id"] / Path(urlparse(url).path).name
        font = ImageFont.truetype(str(path), 48, layout_engine=ImageFont.Layout.BASIC)
        missing = describe_glyph(font, "\uffff")
        for char in syllables:
            descriptor = describe_glyph(font, char)
            index.extend(descriptor if descriptor != missing and descriptor else EMPTY)
    (DATA / "image-font-index-v2.bin").write_bytes(index)
    (DATA / "image-fonts.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    print(f"{len(rows)} families, {len(faces)} actual faces, {len(index):,} index bytes")


if __name__ == "__main__":
    main()
