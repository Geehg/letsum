"""Trim every logo thumbnail to its drawn area and record its width/height ratio.

Raster images: crop transparent or flat-colour margins, keep a 3% margin, cap the long side at 800px.
SVG images: measure the drawn area with headless Chrome (getBBox) and rewrite the viewBox to it.
Ratios go to tools/logo-app/data/logo-geometry.json, which the logo build uses to size every logo to a similar area.
Idempotent: files whose content hash matches the one recorded in logo-geometry.json are skipped (re-measuring or
re-encoding them would shift the frame by fractions of a pixel and degrade JPEGs). GIFs are rewritten as PNG (references updated).
Usage: python3 tools/logo-survey/normalize_logos.py   (not -I: needs Pillow; needs Google Chrome for SVGs)
"""
import hashlib, io, json, re, subprocess, sys, tempfile, html as htmllib
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
THUMBS = ROOT / "html" / "logos" / "thumbs"
APP = ROOT / "tools" / "logo-app" / "data"
CRAWL = Path(__file__).parent / "data" / "crawl.json"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MAX_SIDE = 800


def trim_raster(path):
    image = Image.open(path)
    image.seek(0)
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    peak = alpha.getextrema()[1]
    if 0 < peak < 200:  # faded footer watermark: restore full opacity
        rgba.putalpha(alpha.point(lambda a: min(255, round(a * 255 / peak))))
        alpha = rgba.getchannel("A")
    if alpha.getextrema()[0] < 250:
        box = alpha.point(lambda a: 255 if a > 20 else 0).getbbox()
        background = (0, 0, 0, 0)
    else:
        w, h = rgba.size
        corners = [rgba.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
        background = max(set(corners), key=corners.count)
        diff = ImageChops.difference(rgba.convert("RGB"), Image.new("RGB", rgba.size, background[:3])).convert("L")
        box = diff.point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        return None
    cropped = rgba.crop(box)
    pad = max(2, round(0.03 * max(cropped.size)))
    canvas = Image.new("RGBA", (cropped.width + 2 * pad, cropped.height + 2 * pad), background)
    canvas.paste(cropped, (pad, pad))
    if max(canvas.size) > MAX_SIDE:
        canvas.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    suffix = path.suffix.lower()
    out = path if suffix != ".gif" else path.with_suffix(".png")
    buffer = io.BytesIO()
    if suffix in (".jpg", ".jpeg"):
        canvas.convert("RGB").save(buffer, "JPEG", quality=90, optimize=True)
    elif suffix == ".webp":
        canvas.save(buffer, "WEBP", quality=90)
    else:
        canvas.save(buffer, "PNG", optimize=True)
    data = buffer.getvalue()
    if out != path or data != path.read_bytes():
        out.write_bytes(data)
        if out != path:
            path.unlink()
    tone = "normal"
    if background[3] == 0:  # transparent artwork: mostly-white marks need a dark backdrop
        small = canvas.copy(); small.thumbnail((160, 160))
        lum = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b, a in small.getdata() if a > 160]
        if lum and sum(1 for v in lum if v > 200) / len(lum) > 0.6:
            tone = "light"
    return out, canvas.width / canvas.height, tone


def svg_frame(text):
    """(x, y, w, h) of an SVG's coordinate frame from its viewBox, else its numeric width/height."""
    tag = (re.search(r"<svg\b[^>]*>", text) or [""])[0]
    vb = re.search(r"viewBox\s*=\s*[\"']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)", tag)
    if vb:
        return tuple(float(v) for v in vb.groups())
    w = re.search(r"\swidth\s*=\s*[\"']\s*([\d.]+)\s*(px)?[\"']", tag)
    h = re.search(r"\sheight\s*=\s*[\"']\s*([\d.]+)\s*(px)?[\"']", tag)
    if w and h:
        return 0.0, 0.0, float(w.group(1)), float(h.group(1))
    return None


def measure_svgs(paths):
    """Return {name: [x, y, w, h]} of each SVG's drawn area: Chrome renders the file itself to a canvas and the
    box of coloured pixels is taken (clip paths, masks and gradients included; white-only logos use all pixels)."""
    jobs = []
    for path in paths:
        text = path.read_text("utf-8", "replace")
        frame = svg_frame(text)
        if not frame or frame[2] <= 0 or frame[3] <= 0:
            continue
        x, y, w, h = frame
        scale = 1000 / max(w, h)
        W, H = max(1, round(w * scale)), max(1, round(h * scale))
        tag = re.search(r"<svg\b[^>]*>", text).group(0)
        new_tag = re.sub(r'\s(viewBox|width|height|preserveAspectRatio)\s*=\s*("[^"]*"|\'[^\']*\')', "", tag)
        new_tag = new_tag[:-1].rstrip("/").rstrip() + f' viewBox="{x} {y} {w} {h}" width="{W}" height="{H}" preserveAspectRatio="none"' + ("/>" if tag.endswith("/>") else ">")
        jobs.append([path.name, text.replace(tag, new_tag, 1), x, y, scale, W, H])
    page = """<!doctype html><meta charset="utf-8"><body><pre id="out"></pre><canvas id="c"></canvas><script>
const jobs = """ + json.dumps(jobs).replace("</", "<\\/") + """;
const white = (r, g, b) => r > 240 && g > 240 && b > 240;
(async () => {
  const out = {}, canvas = document.getElementById('c'), ctx = canvas.getContext('2d', {willReadFrequently: true});
  for (const [name, text, x, y, scale, W, H] of jobs) {
    try {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
      await img.decode();
      canvas.width = W; canvas.height = H; ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      const boxes = [[W, H, -1, -1], [W, H, -1, -1]];
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const i = (py * W + px) * 4;
        if (data[i + 3] <= 24) continue;
        for (const k of white(data[i], data[i + 1], data[i + 2]) ? [1] : [0, 1]) {
          const b = boxes[k]; if (px < b[0]) b[0] = px; if (py < b[1]) b[1] = py; if (px > b[2]) b[2] = px; if (py > b[3]) b[3] = py;
        }
      }
      const b = boxes[0][2] >= 0 ? boxes[0] : boxes[1];
      if (b[2] >= 0) out[name] = [x + b[0] / scale, y + b[1] / scale, (b[2] - b[0] + 1) / scale, (b[3] - b[1] + 1) / scale];
    } catch (e) {}
  }
  document.getElementById('out').textContent = JSON.stringify(out);
})();
</script>"""
    with tempfile.TemporaryDirectory() as tmp:
        page_file = Path(tmp) / "measure.html"
        page_file.write_text(page, "utf-8")
        result = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", f"--user-data-dir={tmp}/profile", "--virtual-time-budget=300000", "--dump-dom", page_file.as_uri()], capture_output=True, text=True, timeout=900)
    m = re.search(r'<pre id="out">(.*?)</pre>', result.stdout, re.S)
    if not m or not m.group(1).strip():
        raise SystemExit("Chrome did not return measurements:\n" + result.stderr[-800:])
    return json.loads(htmllib.unescape(m.group(1)))


def rewrite_svg(path, box):
    x, y, w, h = box
    pad = 0.03 * max(w, h)
    x, y, w, h = x - pad, y - pad, w + 2 * pad, h + 2 * pad
    text = path.read_text("utf-8", "replace")
    m = re.search(r"<svg\b[^>]*>", text)
    if not m:
        return None
    tag = m.group(0)
    new = re.sub(r'\s(viewBox|width|height)\s*=\s*("[^"]*"|\'[^\']*\')', "", tag)
    scale = 400 / max(w, h)
    new = new[:-1].rstrip("/").rstrip() + f' viewBox="{x:.2f} {y:.2f} {w:.2f} {h:.2f}" width="{w * scale:.1f}" height="{h * scale:.1f}"' + (" />" if tag.endswith("/>") else ">")
    text = text.replace(tag, new, 1)
    path.write_text(text, "utf-8")
    return w / h


def svg_tone(path):
    counts = {}
    for value in re.findall(r"(?:fill|stroke)\s*[:=]\s*[\"']?\s*(#[0-9a-fA-F]{3,6}\b|white)", path.read_text("utf-8", "replace")):
        value = "#ffffff" if value.lower() == "white" else value.lower()
        if len(value) == 4:
            value = "#" + "".join(c * 2 for c in value[1:])
        counts[value] = counts.get(value, 0) + 1
    total = sum(counts.values())
    light = sum(n for h, n in counts.items() if 0.2126 * int(h[1:3], 16) + 0.7152 * int(h[3:5], 16) + 0.0722 * int(h[5:7], 16) > 200)
    return "light" if total and light / total > 0.6 else "normal"


def main():
    global THUMBS
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--thumbs", default=str(THUMBS), help="thumbnail folder (default: html/logos/thumbs)")
    parser.add_argument("--geometry", default=str(APP / "logo-geometry.json"))
    parser.add_argument("--manifest", default=str(APP / "thumbnails.json"))
    parser.add_argument("--also", nargs="*", default=[str(CRAWL)], help="other files whose thumbnail paths follow GIF→PNG renames")
    args = parser.parse_args()
    THUMBS = Path(args.thumbs)
    geometry_file = Path(args.geometry)
    previous = json.loads(geometry_file.read_text()) if geometry_file.exists() else {}
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    geometry = {}
    renamed = {}
    svgs = []
    for path in sorted(THUMBS.iterdir()):
        suffix = path.suffix.lower()
        known = previous.get(path.name)
        if known and known.get("sha") == digest(path):
            geometry[path.name] = known
            continue
        if suffix == ".svg":
            svgs.append(path)
        elif suffix in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
            try:
                done = trim_raster(path)
            except Exception as error:
                print("  skip", path.name, error)
                continue
            if done:
                out, ratio, tone = done
                geometry[out.name] = {"ratio": round(ratio, 4), "tone": tone, "sha": digest(out)}
                if out != path:
                    renamed[path.name] = out.name
    boxes = measure_svgs(svgs) if svgs else {}
    for path in svgs:
        box = boxes.get(path.name)
        if box:
            ratio = rewrite_svg(path, box)
            if ratio:
                geometry[path.name] = {"ratio": round(ratio, 4), "tone": svg_tone(path), "sha": digest(path)}
        else:
            print("  unmeasured", path.name)
    # Point manifests at renamed (GIF → PNG) files.
    if renamed:
        prefix = f"/{THUMBS.parent.name}/thumbs/"
        for file in [Path(args.manifest), *map(Path, args.also)]:
            text = file.read_text()
            for old, new in renamed.items():
                text = text.replace(prefix + old, prefix + new)
            file.write_text(text)
    geometry_file.write_text(json.dumps(dict(sorted(geometry.items())), indent=1) + "\n")
    print(f"normalized {len(geometry)} logos ({len(svgs)} svg, {len(renamed)} gif→png)")


if __name__ == "__main__":
    main()
