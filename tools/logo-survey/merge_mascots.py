"""Mascot survey, step 3: build the mascot directory data (tools/mascot-app/data/) from the survey results.

Inputs: data/mascot-crawl.json (organisations' character pages, mascot_survey.py), data/mascot-wiki.json (well-known
mascots from Korean Wikipedia, mascot_wiki.py), data/mascots-manual.json (hand-checked company/brand characters).
Writes catalog.json, sources.json, thumbnails.json, downloads.json (files verified by their signature, as for
logos), groups.json (browse taxonomy) and popularity.json (Wikipedia pageviews for well-known mascots; the
organisation's recognition score for organisation characters). Usage: python3 -I tools/logo-survey/merge_mascots.py
"""
import hashlib, json, re, sys, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import crawl  # noqa: E402
import check_downloads as cd  # noqa: E402

APP = HERE.parent / "mascot-app" / "data"
LOGO = HERE.parent / "logo-app" / "data"
TODAY = time.strftime("%Y-%m-%d")

GROUPS = [
    ("local", "지자체 캐릭터", [("metro", "광역자치단체"), ("city", "시"), ("county", "군"), ("district", "자치구"), ("education-office", "시도교육청")]),
    ("public", "공공기관", [("government", "중앙정부"), ("institution", "공공기관"), ("research", "연구·의료·금융")]),
    ("education", "대학", [("university", "대학교")]),
    ("event", "행사·올림픽", [("olympic", "올림픽·패럴림픽"), ("worldcup", "월드컵·국제대회"), ("expo", "엑스포·박람회·기타 행사")]),
    ("sports", "스포츠 구단", [("baseball", "야구"), ("football", "축구"), ("basketball", "농구·배구·기타")]),
    ("business", "기업·브랜드", [("brand", "기업·브랜드"), ("tech", "IT·게임"), ("transport", "철도·교통")]),
    ("world", "해외·기타", [("city", "도시·지역"), ("other", "기타")]),
]
ORG_GROUP = {"광역자치단체": "local/metro", "시도교육청": "local/education-office", "중앙행정기관": "public/government", "대학": "education/university"}
LOCAL_SUFFIX = {"시": "local/city", "군": "local/county", "구": "local/district"}
WIKI_GROUP = {"olympic": "event/olympic", "worldcup": "event/worldcup", "baseball": "sports/baseball", "football": "sports/football",
              "basketball": "sports/basketball", "company": "business/brand", "tech": "business/tech", "game": "business/tech",
              "railway": "business/transport", "city": "world/city", "organisation": "world/other", "other": "world/other", "country": "world/other"}
CATEGORY_OF = {"local": "local-government", "public": "public-organization", "education": "education", "event": "nonprofit", "sports": "business", "business": "business", "world": "nonprofit"}
SECTOR_OF = {"local": ["administration"], "public": ["administration"], "education": ["education"], "event": ["sports"], "sports": ["sports"], "business": ["culture-arts"], "world": ["culture-arts"]}
USAGE = {"summary": "자동 수집 자료입니다. 캐릭터 이용 조건은 공식 페이지 원문에서 확인해 주세요.", "approval": "unknown", "redistribution": "unknown", "preview": "unknown", "policy_url": None}


def org_id(org):
    return "kr-" + (org["wikidata"].lower() if org.get("wikidata") else "w" + hashlib.sha1(org["wiki_title"].encode()).hexdigest()[:10])


def wiki_group(row):
    title, kind = row["title"], row["kind"]
    if kind == "kbrand":
        return "business/brand"
    if kind == "seoul":
        return "local/metro"
    if kind == "korea":
        if re.search(r"올림픽|호돌이|수호랑|반다비|곰두리", title + row["extract"]):
            return "event/olympic"
        if re.search(r"엑스포|박람회|꿈돌이", title + row["extract"]):
            return "event/expo"
        if re.search(r"KBO|구단|타이거즈|라이온즈|베어스|트윈스|이글스|자이언츠|랜더스|위즈|다이노스|히어로즈", title + row["extract"]):
            return "sports/baseball"
        return "public/government"
    if kind == "olympic" and row.get("country") == "KR":
        return "event/olympic"
    return WIKI_GROUP.get(kind, "world/other")


def verify(files, page):
    rows = []
    for url, label in files:
        hit = cd.check(url, page, label)
        if hit:
            hit.pop("final_url", None)
            rows.append({k: v for k, v in hit.items() if v is not None})
    return rows


def main():
    orgs = json.loads((HERE / "data" / "orgs.json").read_text())["orgs"]
    survey = json.loads((HERE / "data" / "mascot-crawl.json").read_text())["results"]
    wiki = json.loads((HERE / "data" / "mascot-wiki.json").read_text())["mascots"] if (HERE / "data" / "mascot-wiki.json").exists() else []
    manual = json.loads((HERE / "data" / "mascots-manual.json").read_text())["mascots"] if (HERE / "data" / "mascots-manual.json").exists() else []
    logo_rank = json.loads((LOGO / "popularity.json").read_text())["records"]
    records, sources, thumbs, assign, rank, file_jobs = [], [], {}, {}, {}, []
    names_seen = set()

    def add(rid, org_name, name, aliases, group, country, region, summary, page, note, image, files, score, kind="character", name_en=None, checked=TODAY):
        g, s = group.split("/")
        src = rid + "-src"
        sources.append({"id": src, "title": f"{name} 공식 안내" if page and "wikipedia" not in page else f"위키백과 — {name}", "url": page,
                        "publisher": org_name if page and "wikipedia" not in page else "위키백과", "language": "ko", "checked_at": checked, "scope": "page",
                        "observation": summary, "note": note})
        records.append({"id": rid, "organization_id": rid, "organization_name": org_name, "name": name, "name_en": name_en, "aliases": [a for a in dict.fromkeys(aliases) if a and a != name],
                        "category": CATEGORY_OF[g], "kind": kind, "sectors": SECTOR_OF[g], "country": country, "region": region, "summary": summary,
                        "source_ids": [src], "source_url": page, "guideline_url": page if page and "wikipedia" not in page else None, "assets": [],
                        "usage": USAGE, "version": {"status": "unconfirmed", "introduced_at": None, "label": None},
                        "review": {"status": "needs-review", "checked_at": checked, "source_scope": "page"}, "related_fonts": []})
        assign[rid] = group
        rank[rid] = {"score": score}
        if image:
            thumbs[rid] = {"mode": "image", "bg": None, "ink": None, "source": image.get("source"), "source_url": image.get("source_url"), "page_url": image.get("page_url"),
                           "license": image.get("license"), "author": image.get("author"), "fetched_at": checked, "tone": "normal", "file": image["file"], "sha256": image["sha256"], "bytes": image["bytes"]}
        if files:
            file_jobs.append((rid, files, page))

    # 1. Organisations' own characters.
    by_key = {crawl.org_key(o): o for o in orgs}
    for key, row in survey.items():
        org = by_key.get(key)
        if not org or not row.get("found"):
            continue
        names = [n for n in row.get("names", []) if n not in org["name"]]
        group = ORG_GROUP.get(org["group"]) or (LOCAL_SUFFIX.get(org["name"][-1], "local/city") if org["group"] == "기초자치단체" else
                                               "public/research" if re.search(r"연구|병원|의료|금융|은행|보증|보험|연금|기금", org["name"]) else "public/institution")
        rid = "mc-" + org_id(org)[3:]
        name = " · ".join(names[:3]) if names else f"{org['name']} 캐릭터"
        names_seen.update(names)
        summary = f"{org['name']}의 공식 캐릭터 소개 페이지를 자동 수집으로 찾았습니다." + (f" 페이지에 적힌 캐릭터 이름: {', '.join(names[:3])}." if names else "")
        add(rid, org["name"], name, [*names, f"{org['name']} 캐릭터", f"{org['name']} 마스코트"], group, org.get("country") or "KR", org.get("region"), summary, row["page"],
            f"명단: 위키백과 {org['roster']} · 캐릭터 페이지 자동 탐색", row.get("image"), row.get("files"), logo_rank.get(org_id(org), {}).get("score", 0), checked=row.get("checked_at", TODAY))
    # 2. Well-known mascots (Korean Wikipedia).
    for row in wiki:
        if row["title"] in names_seen:
            continue
        rid = "mw-" + hashlib.sha1(row["title"].encode()).hexdigest()[:10]
        group = wiki_group(row)
        page = "https://ko.wikipedia.org/wiki/" + urllib.parse.quote(row["title"].replace(" ", "_"))
        summary = row["extract"] or f"{row['title']}에 관한 위키백과 문서입니다."
        korean = row["kind"] in ("korea", "kbrand", "seoul")
        add(rid, row["title"], re.sub(r" \((마스코트|캐릭터|카카오프렌즈|라인프렌즈)\)$", "", row["title"]), [row.get("name_en"), row["title"]], group, row.get("country") or ("KR" if korean else None), "서울" if row["kind"] == "seoul" else None,
            summary, page, f"위키백과 분류 기반 수집 · 위키데이터 {row['qid']}" if row.get("qid") else "위키백과 분류 기반 수집", row.get("image"), None,
            0, kind="mascot", name_en=row.get("name_en"))
    # 3. Hand-checked company and brand characters.
    for row in manual:
        add(row["id"], row["organization"], row["name"], row.get("aliases", []), row["group"], row.get("country", "KR"), None, row["summary"], row["page"],
            "수작업 확인(공식 페이지)", row.get("image"), row.get("files"), row.get("score", 0), kind=row.get("kind", "character"), name_en=row.get("name_en"))

    # Downloads: same signature checks as the logo directory.
    with ThreadPoolExecutor(8) as pool:
        verified = dict(zip([j[0] for j in file_jobs], pool.map(lambda j: verify(j[1], j[2]), file_jobs)))
    downloads = {rid: rows[:12] for rid, rows in verified.items() if rows}
    # Recognition for well-known mascots: Korean Wikipedia pageviews over the last 12 months.
    sys.path.insert(0, str(HERE))
    import popularity as pop  # noqa: E402
    import datetime, math
    end = datetime.date.today().replace(day=1) - datetime.timedelta(days=1)
    start = (end.replace(day=1) - datetime.timedelta(days=330)).replace(day=1)
    wiki_ids = {"mw-" + hashlib.sha1(r["title"].encode()).hexdigest()[:10]: r["title"] for r in wiki}
    with ThreadPoolExecutor(4) as pool:
        views = dict(zip(wiki_ids, pool.map(lambda t: pop.pageviews(t, start.strftime("%Y%m%d"), end.strftime("%Y%m%d")), wiki_ids.values())))
    for rid, pv in views.items():
        if rid in rank:
            rank[rid] = {"score": round(math.log10(pv + 10), 3), "pageviews": pv}

    APP.mkdir(parents=True, exist_ok=True)
    catalog = {"schema_version": "1.0", "version": "0.1.0", "updated_at": TODAY, "scope_note": "기관·기업·행사의 공식 캐릭터·마스코트 안내를 모은 자료입니다. 이미지는 식별용 미리보기이며 이용 조건은 공식 출처 원문을 따릅니다.",
               "records": sorted(records, key=lambda r: r["id"])}
    (APP / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    (APP / "sources.json").write_text(json.dumps({"updated_at": TODAY, "sources": sources}, ensure_ascii=False, indent=2) + "\n")
    (APP / "thumbnails.json").write_text(json.dumps({"updated_at": TODAY, "thumbnails": thumbs}, ensure_ascii=False, indent=1) + "\n")
    (APP / "downloads.json").write_text(json.dumps({"note": "공식 캐릭터 페이지의 캐릭터 파일 중 바로 내려받아지는 것(파일 서명 확인).", "checked_at": TODAY, "downloads": downloads}, ensure_ascii=False, indent=1) + "\n")
    (APP / "groups.json").write_text(json.dumps({"note": "마스코트 화면용 대분류·소분류(tools/logo-survey/merge_mascots.py가 생성).",
                                                 "groups": [{"id": g, "label": label, "subs": [{"id": s, "label": l} for s, l in subs]} for g, label, subs in GROUPS],
                                                 "assign": dict(sorted(assign.items()))}, ensure_ascii=False, indent=1) + "\n")
    (APP / "popularity.json").write_text(json.dumps({"note": "기본 정렬용 점수: 위키백과 문서가 있는 마스코트는 최근 12개월 조회수, 기관 캐릭터는 해당 기관의 인지도 점수.", "records": dict(sorted(rank.items()))}, ensure_ascii=False, indent=1) + "\n")
    from collections import Counter
    print(f"mascot records {len(records)} · images {len(thumbs)} · downloads {len(downloads)} records / {sum(len(v) for v in downloads.values())} files")
    print(Counter(assign.values()).most_common())


if __name__ == "__main__":
    main()
