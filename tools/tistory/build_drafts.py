"""티스토리 '로고' 카테고리용 글 초안: 로고 모음 데이터 → 기관별 HTML 초안·대표 이미지·관리 목록(CSV).

인지도(popularity.json) 순으로 기관(organization_id)을 묶어 상위 N곳의 글을 만든다. 한 기관에 기록이 여럿이면
(예: 서울특별시 휘장 + SEOUL MY SOUL) 한 글에 함께 싣는다.
- 소개 문장은 검수된 기록(review.status = source-reviewed)의 summary만 쓴다. 자동 수집 문구는 쓰지 않는다.
- 색상은 공식 표기(colors.official)와 로고 이미지에서 뽑은 참고값(extracted)을 구분해 적는다.
- 파일은 블로그에 올리지 않고 원래 배포처 주소(downloads.json, 로그인·신청 없이 받아지는 것으로 확인된 것)로만 연결한다.
- 대표 이미지는 로고 모음 썸네일을 복사(SVG는 macOS qlmanage로 PNG 변환)하고, 출처·라이선스 문구를 글에 넣는다.
- 글 끝에 렛섬 상세 페이지 링크. 직접 쓰는 한두 줄 자리는 HTML 주석으로 표시(그대로 올려도 화면에 안 보임).
출력: tools/tistory/out/ (커밋하지 않음) — NN-기관.html, img/, posts.csv, preview.html
사용법: python3 -I tools/tistory/build_drafts.py [--top 20]
"""
import argparse, csv, html, json, re, shutil, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "tools/logo-app/data"
HTML_ROOT = ROOT / "html"
OUT = Path(__file__).resolve().parent / "out"
SITE = "https://letsum.app"

CATEGORY = {"national-government": "중앙행정기관", "local-government": "지방자치단체", "public-institution": "공공기관",
            "education": "대학·교육기관", "business": "기업", "public-organization": "공공기관", "intergovernmental": "국제기구",
            "nonprofit": "비영리단체"}
APPROVAL = {"required": "사용 전 승인이 필요하다고 안내합니다.", "request": "신청·승인 후 파일을 제공합니다.",
            "not-required": "별도 승인 없이 쓸 수 있다고 안내합니다."}
ACCESS = {"request": "신청·승인 후 제공", "login": "로그인 후 제공", "information": "파일 없이 규정만 안내", "public": "공개"}


def esc(s):
    return html.escape(str(s or ""), quote=True)


def size(n):
    if not n:
        return ""
    return f"{n / 1048576:.1f}MB" if n >= 1048576 else f"{max(1, round(n / 1024))}KB"


def load(name, key):
    return json.loads((DATA / name).read_text())[key]


def color_rows(c):
    rows = []
    for o in c.get("official") or []:
        extra = " · ".join(x for x in [f"CMYK {o['cmyk']}" if o.get("cmyk") else "", f"PANTONE {o['pantone']}" if o.get("pantone") else ""] if x)
        rows.append((o.get("hex"), o.get("rgb"), extra, "공식 표기"))
    if not rows:
        for e in c.get("extracted") or []:
            rows.append((e["hex"], e["rgb"], "", "로고 이미지에서 뽑은 참고값"))
    return rows


def downloads_of(items):
    out = []
    for d in items:
        kinds = d["format"] + (f"(안에 {', '.join(d['inner'])})" if d.get("inner") else "")
        label = re.sub(r"\(\s*\)", "", d.get("label") or "")
        label = re.sub(r"\s*(을|를)?\s*받습니다$", "", label).replace("미리보기", "").strip()
        if label == "동의 후":  # 공식 페이지에서 이용 조건에 동의하고 받도록 안내하는 파일
            label = "공식 페이지에서 이용 조건 동의 후 받도록 안내"
        words = label.split()
        label = " ".join(w for i, w in enumerate(words) if w not in words[:i])  # '디자인 규정 서울브랜드 디자인 규정' 같은 반복 제거
        if not re.search(r"[가-힣]", label) or len(label) > 26:  # 영문 링크 문구 조각·긴 문장은 빼고 파일 이름만
            label = ""
        out.append({"url": d["url"], "text": d.get("filename") or d["url"].rsplit("/", 1)[-1], "kinds": kinds, "size": size(d.get("bytes")), "label": label})
    return out


def has_ai(items):
    return any(d["format"] == "AI" or "AI" in (d.get("inner") or []) for d in items)


def image_for(rec, thumbs, img_dir, slug):
    t = thumbs.get(rec["id"])
    if not t or not t.get("file"):
        return None
    src = HTML_ROOT / t["file"].lstrip("/")
    if not src.exists():
        return None
    if src.suffix.lower() == ".svg":
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["qlmanage", "-t", "-s", "800", "-o", tmp, str(src)], capture_output=True)
            made = Path(tmp) / (src.name + ".png")
            if not made.exists():
                return None
            dest = img_dir / f"{slug}.png"
            shutil.copy(made, dest)
    else:
        dest = img_dir / f"{slug}{src.suffix.lower()}"
        shutil.copy(src, dest)
    if t.get("source") == "wikimedia-commons":
        credit = f"이미지: 위키미디어 공용 <a href=\"{esc(t['page_url'])}\">{esc(t['page_url'].rsplit('/', 1)[-1])}</a>"
        credit += f" · {esc(t.get('license'))}" + (f" · 저작자 {esc(t['author'])}" if t.get("author") else "")
    elif t.get("source") == "simple-icons":
        credit = "이미지: <a href=\"https://simpleicons.org/\">Simple Icons</a> (CC0 1.0)"
    else:
        credit = f"이미지: <a href=\"{esc(t.get('page_url') or rec['source_url'])}\">공식 누리집 게시 이미지</a>(식별 목적 인용, 권리는 권리자에게 있음)"
    data = dest.read_bytes()
    width = int.from_bytes(data[16:20], "big") if data[:8] == b"\x89PNG\r\n\x1a\n" else None
    return {"file": dest.name, "credit": credit, "small": bool(width and width < 300)}


def post(org, recs, ctx, n):
    name = org["name"]
    slug = f"{n:02d}-{re.sub(r'[^0-9A-Za-z가-힣]+', '-', name).strip('-')}"
    all_dl = [d for r in recs for d in ctx["downloads"].get(r["id"], [])]
    title = f"{name} CI 로고 소개 ({'AI 파일 ' if has_ai(all_dl) else ''}공식 다운로드 안내)" if all_dl else f"{name} CI 로고 소개 (공식 안내)"
    cat = CATEGORY.get(recs[0]["category"], recs[0]["category"])
    image = image_for(recs[0], ctx["thumbs"], ctx["img_dir"], slug)

    h = []
    h.append(f"<p>{esc(name)}의 CI(로고)를 정리했습니다. 공식 누리집이 안내하는 로고 파일과 색상, 이용할 때 확인할 점을 모았고, "
             "파일은 이 블로그에 따로 올리지 않고 공식 배포처로 바로 연결해 두었습니다.</p>")
    h.append("<!-- 여기에 직접 한두 줄: 이 로고를 써 본 경험, 눈에 띄는 점, 작업 팁 등 -->")
    if image:
        h.append(f"<p>[대표 이미지: img/{esc(image['file'])} 를 이 자리에 올려 주세요]</p>")
        h.append(f"<p style=\"font-size:12px;color:#888\">{image['credit']}</p>")
    basics = [("기관", name), ("분류", cat), ("지역", recs[0].get("region"))]
    h.append("<h3>기본 정보</h3><table style=\"border-collapse:collapse\"><tbody>" + "".join(
        f"<tr><th style=\"text-align:left;padding:4px 12px 4px 0\">{k}</th><td style=\"padding:4px 0\">{esc(v)}</td></tr>" for k, v in basics if v) + "</tbody></table>")

    for r in recs:
        if len(recs) > 1:
            h.append(f"<h3>{esc(r['name'])}</h3>")
        if r.get("review", {}).get("status") == "source-reviewed" and r.get("summary") and "자동 수집" not in r["summary"]:
            h.append(f"<p>{esc(r['summary'])}</p>")
        rows = color_rows(ctx["colors"].get(r["id"], {}))
        if rows:
            h.append(f"<h4>색상</h4><table style=\"border-collapse:collapse\"><tbody>" + "".join(
                f"<tr><td style=\"padding:4px 8px 4px 0\"><span style=\"display:inline-block;width:18px;height:18px;border:1px solid #ddd;vertical-align:middle;background:{esc(hx)}\"></span></td>"
                f"<td style=\"padding:4px 12px 4px 0\"><code>{esc(hx)}</code></td><td style=\"padding:4px 12px 4px 0\">RGB {esc(rgb)}</td>"
                f"<td style=\"padding:4px 12px 4px 0\">{esc(extra)}</td><td style=\"padding:4px 0;color:#888\">{note}</td></tr>"
                for hx, rgb, extra, note in rows) + "</tbody></table>")
            if rows[0][3] != "공식 표기":
                h.append("<p style=\"font-size:12px;color:#888\">참고값은 로고 이미지에서 뽑은 색이라 공식 지정색과 다를 수 있습니다. 인쇄·제작에는 공식 매뉴얼의 값을 쓰세요.</p>")
        dls = downloads_of(ctx["downloads"].get(r["id"], []))
        h.append("<h4>로고 파일 받기</h4>")
        if dls:
            h.append("<ul>" + "".join(
                f"<li><a href=\"{esc(d['url'])}\" target=\"_blank\" rel=\"noopener\">{esc(d['text'])}</a> — {esc(d['kinds'])}"
                f"{' · ' + d['size'] if d['size'] else ''}{' · ' + esc(d['label']) if d['label'] else ''}</li>" for d in dls) + "</ul>")
            h.append("<p style=\"font-size:12px;color:#888\">링크는 공식 누리집의 원본 파일로 연결됩니다. 파일이 바뀌거나 옮겨졌으면 아래 공식 페이지에서 확인해 주세요.</p>")
        else:
            gated = [ACCESS[a["access"]] for a in r.get("assets", []) if a.get("access") in ("request", "login", "information")]
            why = f"공식 페이지 기준 {gated[0]}이라" if gated else "로그인·신청 없이 바로 받는 파일을 확인하지 못해"
            h.append(f"<p>{why} 직접 받는 링크는 두지 않았습니다. 아래 공식 페이지에서 안내를 확인해 주세요.</p>")
        links = [("공식 CI 안내 페이지", r.get("source_url"))]
        if r.get("guideline_url") and r["guideline_url"] != r.get("source_url"):
            links.append(("사용 가이드", r["guideline_url"]))
        h.append("<ul>" + "".join(f"<li>{k}: <a href=\"{esc(u)}\" target=\"_blank\" rel=\"noopener\">{esc(u)}</a></li>" for k, u in links if u) + "</ul>")
        u = r.get("usage") or {}
        notes = [APPROVAL[u["approval"]]] if u.get("approval") in APPROVAL else []
        if u.get("summary") and "확인하지 못했습니다" not in u["summary"] and "자동 수집" not in u["summary"]:
            notes.insert(0, u["summary"])
        h.append("<h4>이용할 때</h4><p>" + esc(" ".join(notes) or "공식 페이지에서 일반 이용 범위를 밝히지 않았습니다. 상업적 사용이나 변형 전에는 기관에 문의하는 것이 안전합니다.") + "</p>")

    h.append(f"<p>더 많은 기관 로고와 색상은 <a href=\"{SITE}/logos/brands/{esc(recs[0]['id'])}/\" target=\"_blank\" rel=\"noopener\">렛섬 로고 모음 – {esc(name)}</a>에서 볼 수 있습니다.</p>")
    h.append("<p style=\"font-size:12px;color:#888\">*출처: 각 기관 공식 누리집. 상표와 로고의 권리는 각 권리자에게 있으며, 이 글은 안내 목적입니다.</p>")
    tags = [name, f"{name} CI", f"{name} 로고", f"{name} 로고 다운로드"] + ([f"{name} AI 파일"] if has_ai(all_dl) else []) + [cat, "CI", "로고", "로고 다운로드"]
    (OUT / f"{slug}.html").write_text("\n".join(h) + "\n")
    return {"slug": slug, "title": title, "tags": ", ".join(dict.fromkeys(tags)), "image": f"img/{image['file']}" if image else "",
            "image_note": "작음(가로 300px 미만) — 공식 파일 속 큰 이미지로 바꾸길 권장" if image and image["small"] else "",
            "downloads": len(all_dl), "letsum": f"{SITE}/logos/brands/{recs[0]['id']}/", "body": "\n".join(h)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=20)
    args = ap.parse_args()
    records = load("catalog.json", "records")
    pop = load("popularity.json", "records")
    ctx = {"colors": load("colors.json", "colors"), "downloads": load("downloads.json", "downloads"), "thumbs": load("thumbnails.json", "thumbnails")}

    orgs = {}
    for r in records:
        o = orgs.setdefault(r["organization_id"], {"name": r["organization_name"], "recs": [], "score": 0})
        o["recs"].append(r)
        o["score"] = max(o["score"], (pop.get(r["id"]) or {}).get("score", 0))
    for o in orgs.values():  # 인지도·다운로드 많은 기록 먼저
        o["recs"].sort(key=lambda r: (-(pop.get(r["id"]) or {}).get("score", 0), -len(ctx["downloads"].get(r["id"], []))))
    ranked = sorted(orgs.values(), key=lambda o: -o["score"])[:args.top]

    if OUT.exists():
        shutil.rmtree(OUT)
    ctx["img_dir"] = OUT / "img"
    ctx["img_dir"].mkdir(parents=True)
    posts = [post(o, o["recs"], ctx, i) for i, o in enumerate(ranked, 1)]

    with (OUT / "posts.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["순번", "제목", "본문 파일", "대표 이미지", "이미지 메모", "태그", "공식 다운로드 수", "렛섬 링크", "게시일", "글 주소"])
        for i, p in enumerate(posts, 1):
            w.writerow([i, p["title"], f"{p['slug']}.html", p["image"], p["image_note"], p["tags"], p["downloads"], p["letsum"], "", ""])

    toc = "".join(f"<li><a href=\"#{p['slug']}\">{esc(p['title'])}</a></li>" for p in posts)
    body = "".join(f"<article id=\"{p['slug']}\"><h2>{esc(p['title'])}</h2><p class=meta>본문: {p['slug']}.html · 태그: {esc(p['tags'])}</p>"
                   + p["body"].replace("src=\"img/", "src=\"img/").replace("[대표 이미지: img/", "<img src=\"img/").replace(" 를 이 자리에 올려 주세요]", "\" style=\"max-height:160px\">")
                   + "</article>" for p in posts)
    (OUT / "preview.html").write_text(
        "<!doctype html><meta charset=utf-8><title>티스토리 로고 글 초안</title><style>body{font:15px/1.7 sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#222}"
        "article{border-top:2px solid #eee;margin-top:40px;padding-top:8px}.meta{font-size:12px;color:#999}</style>"
        f"<h1>티스토리 로고 글 초안 {len(posts)}건</h1><ol>{toc}</ol>{body}")
    print(f"초안 {len(posts)}건 → {OUT}")
    for p in posts:
        print(f"  {p['title']} · 다운로드 {p['downloads']} · 이미지 {p['image'] or '없음'}")


if __name__ == "__main__":
    main()
