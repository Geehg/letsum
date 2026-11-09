"""Colour guide for the hand-curated logo records (ids without the "kr-" prefix).

Reads colour specifications from each record's guideline/source pages (as published); when none are written there,
samples the record's thumbnail and stores the result as extracted (unofficial). Survey records are handled by merge.py.
Usage: python3 tools/logo-survey/curated_colors.py   (not -I: needs Pillow)
"""
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import crawl  # noqa: E402

APP = Path(__file__).parent.parent / "logo-app" / "data"
ROOT = Path(__file__).resolve().parents[2]
catalog = json.loads((APP / "catalog.json").read_text())
thumbs = json.loads((APP / "thumbnails.json").read_text())["thumbnails"]
colors_file = APP / "colors.json"
colors = json.loads(colors_file.read_text()) if colors_file.exists() else {"schema_version": "1.0", "updated_at": crawl.TODAY, "colors": {}}

for record in catalog["records"]:
    if record["id"].startswith("kr-"):
        continue
    entry = {"checked_at": crawl.TODAY}
    for url in dict.fromkeys(filter(None, [record.get("guideline_url"), record.get("source_url")])):
        try:
            specs = crawl.colour_specs(crawl.fetch_page(url).plain)
        except Exception as error:
            print(f"  {record['id']}: {type(error).__name__} {url}")
            continue
        if specs:
            entry.update({"official": specs, "official_source": url}); break
    thumb = thumbs.get(record["id"])
    if "official" not in entry and thumb:
        if thumb.get("mode") == "glyph" and thumb.get("bg"):
            # Simple Icons records a brand colour per glyph; still shown as extracted, not as the owner's guide.
            hexv = thumb["bg"].upper()
            entry.update({"extracted": [{"hex": hexv, "rgb": " ".join(str(int(hexv[i:i + 2], 16)) for i in (1, 3, 5)), "share": 1}], "extracted_from": thumb.get("source_url")})
        else:
            data = (ROOT / "html" / thumb["file"].lstrip("/")).read_bytes()
            pairs = crawl.svg_colours(data.decode("utf-8", "replace")) if thumb["file"].endswith(".svg") else crawl.raster_colours(data)
            extracted = crawl.brand_colours(pairs)
            if extracted:
                entry.update({"extracted": extracted, "extracted_from": thumb.get("source_url")})
    if "official" in entry or "extracted" in entry:
        colors["colors"][record["id"]] = entry
    print(record["id"], "official" if "official" in entry else "extracted" if "extracted" in entry else "-", len(entry.get("official", entry.get("extracted", []))))

colors["updated_at"] = time.strftime("%Y-%m-%d")
colors_file.write_text(json.dumps(colors, ensure_ascii=False, indent=2) + "\n")
