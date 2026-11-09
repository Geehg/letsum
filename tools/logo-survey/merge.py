"""Step 3 of the logo survey: merge data/orgs.json + data/crawl.json into the logo directory data.

Writes (replacing only survey-owned rows, so hand-curated records stay untouched):
  * tools/logo-app/data/catalog.json   records with id "kr-<wikidata>" (status needs-review: collected automatically)
  * tools/logo-app/data/sources.json   one evidence row per survey record ("kr-...-src")
  * tools/logo-app/data/thumbnails.json  survey logo images
  * tools/logo-app/data/colors.json    official colour specs (as published) and extracted logo colours (unofficial)
Usage: python3 -I tools/logo-survey/merge.py
"""
import hashlib, json, re, time, urllib.parse
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
APP = HERE.parent / "logo-app" / "data"
TODAY = time.strftime("%Y-%m-%d")

orgs = json.loads((HERE / "data" / "orgs.json").read_text())["orgs"]
crawl = json.loads((HERE / "data" / "crawl.json").read_text())["results"]
catalog = json.loads((APP / "catalog.json").read_text())
sources = json.loads((APP / "sources.json").read_text())
thumbs_file, colors_file = APP / "thumbnails.json", APP / "colors.json"
thumbs = json.loads(thumbs_file.read_text())
colors = json.loads(colors_file.read_text()) if colors_file.exists() else {"schema_version": "1.0", "updated_at": TODAY, "colors": {}}

curated = [r for r in catalog["records"] if not r["id"].startswith("kr-")]
norm = lambda s: re.sub(r"[\s·()]|대한민국", "", s or "")
taken = {norm(n) for r in curated for n in [r["organization_name"], *r["aliases"]]}

SECTOR_RULES = [
    ("research-science", r"연구|과학|기술원|기술진흥|천문|지질|표준과학"), ("healthcare", r"병원|보건|의료|건강|질병|식품의약|혈액|장기|감염"),
    ("welfare", r"복지|연금|사회보장|장애|아동|노인|자활|가족|생명존중"), ("culture-arts", r"문화|예술|박물관|미술관|도서관|국악|출판|영화|콘텐츠|유산"),
    ("tourism", r"관광"), ("sports", r"체육|스포츠|경륜|태권"), ("environment", r"환경|기후|자원순환|생물자원|국립공원|산림|수자원"),
    ("transport-logistics", r"도로|철도|공항|항만|교통|물류|해운|선박|자동차"), ("energy", r"에너지|전력|가스|석유|발전|원자력|광해|광물|전기"),
    ("finance", r"금융|보증|보험|은행|기금|자산관리|투자|예금|조폐|재정"), ("ict-digital", r"정보|방송|통신|디지털|인터넷|데이터|소프트웨어|전파|미디어"),
    ("industry-manufacturing", r"산업|무역|제조|중소|창업|특허|지식재산|표준|기업|벤처"), ("agriculture-food", r"농|수산|해양|축산|어촌|식품"),
    ("housing-construction", r"주택|토지|건설|국토|공간|도시|건축|시설"), ("safety-defense", r"안전|소방|경찰|국방|보훈|병무|방위|해양경찰|수사"),
    ("international-cooperation", r"국제|협력|외교|동포|통일|코이카"),
]


def sectors_for(org):
    if org["group"] in ("시도교육청", "대학"):
        return ["education"]
    found = [sector for sector, pattern in SECTOR_RULES if re.search(pattern, org["name"])][:2]
    if org["category"] in ("national-government", "local-government") and "administration" not in found:
        found = ["administration", *found][:2]
    return found or ["administration"]


def region_for(org):
    if org.get("region"):
        return org["region"]
    m = re.match(r"(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|충청북도|충청남도|전북특별자치도|전남광주통합특별시|경상북도|경상남도|제주특별자치도)", org["name"])
    return m.group(1) if m else None


name_counts = Counter(o["name"] for o in orgs)
# The same image on several organisations' sites is a shared banner or badge, not anyone's logo.
logo_use = Counter(r["logo"]["sha256"] for r in crawl.values() if r.get("logo"))
rejects_file = HERE / "data" / "thumbnail-rejects.json"
rejects_data = json.loads(rejects_file.read_text()) if rejects_file.exists() else {}
rejected, rejected_files = rejects_data.get("rejects", {}), rejects_data.get("reject_files", {})
records, evidence, thumb_rows, colour_rows, skipped = [], [], {}, {}, []
for org in orgs:
    key = org.get("wikidata") or org["wiki_title"]
    # Same-named districts (중구, 동구 ...) are told apart by their province.
    org_name = f"{org['region']} {org['name']}" if name_counts[org["name"]] > 1 and org.get("region") else org["name"]
    if norm(org_name) in taken or (org_name == org["name"] and norm(org["wiki_title"]) in taken):
        skipped.append((org_name, "기존 등록과 중복")); continue
    taken.add(norm(org_name))
    res = crawl.get(key, {})
    rid = "kr-" + (org["wikidata"].lower() if org.get("wikidata") else "w" + hashlib.sha1(org["wiki_title"].encode()).hexdigest()[:10])
    region = region_for(org)
    ci = res.get("ci_page")
    home = res.get("website_final") or org.get("website")
    wiki = "https://ko.wikipedia.org/wiki/" + urllib.parse.quote(org["wiki_title"].replace(" ", "_"))
    url = ci or home or wiki
    official = res.get("colors_official") or []
    if ci:
        title, publisher = f"{org_name} CI·상징 안내", org_name
        observation = f"자동 수집({res.get('checked_at', TODAY)}): 공식 홈페이지 메뉴 '{res.get('ci_link_text') or 'CI'}'에서 이 페이지를 찾음." + (f" 공식 색상 표기 {len(official)}건을 원문 그대로 읽음." if official else " 본문에서 색상 코드 표기는 찾지 못함.")
    elif home:
        title, publisher = f"{org_name} 공식 홈페이지", org_name
        observation = f"자동 수집({res.get('checked_at', TODAY)}): 홈페이지는 열렸으나 CI 안내 페이지 링크를 자동으로 찾지 못함."
    else:
        title, publisher = f"위키백과 — {org['wiki_title']}", "위키백과"
        observation = "공식 홈페이지 주소를 확인하지 못해 명단 출처 문서를 근거로 둠."
    src_id = rid + "-src"
    evidence.append({"id": src_id, "title": title, "url": url, "publisher": publisher, "language": "ko", "checked_at": res.get("checked_at", TODAY),
                     "scope": "page", "observation": observation, "note": f"명단: 위키백과 {org['roster']}" + (f" · 위키데이터 {org['wikidata']}" if org.get("wikidata") else "") + (f" · 수집 오류: {res['errors'][0]}" if res.get("errors") else "")})
    label = "상징·CI" if org["category"] == "local-government" and org["group"] != "시도교육청" else ("UI" if org["group"] == "대학" else "CI")
    summary = (f"공식 홈페이지의 CI·상징 안내 페이지를 자동 수집으로 찾았습니다." if ci else "공식 홈페이지 정보입니다. CI 안내 페이지는 자동 수집에서 찾지 못했습니다.") + f" 분류: {org['group']}."
    aliases = [a for a in dict.fromkeys([org["name"], org["wiki_title"].replace("대한민국 ", ""), org.get("name_en")]) if a and a != org_name]
    records.append({
        "id": rid, "organization_id": rid, "organization_name": org_name, "name": f"{org_name} {label}", "name_en": org.get("name_en"),
        "aliases": aliases, "category": org["category"], "kind": "organization", "sectors": sectors_for(org), "country": "KR", "region": region,
        "summary": summary, "source_ids": [src_id], "source_url": url, "guideline_url": ci, "assets": [],
        "usage": {"summary": "자동 수집 자료입니다. 이용 조건은 공식 페이지 원문에서 확인해 주세요.", "approval": "unknown", "redistribution": "unknown", "preview": "unknown", "policy_url": None},
        "version": {"status": "unconfirmed", "introduced_at": None, "label": None},
        "review": {"status": "needs-review", "checked_at": res.get("checked_at"), "source_scope": "page" if res.get("checked_at") else None},
        "related_fonts": [],
    })
    logo = res.get("logo")
    if logo and ((logo_use[logo["sha256"]] > 1 and logo.get("source") != "wikimedia-commons") or (org_name in rejected and not logo.get("filled")) or logo.get("file", "").rsplit("/", 1)[-1] in rejected_files):
        logo = None
    if logo and logo.get("file"):
        thumb_rows[rid] = {"mode": "image", "bg": None, "ink": None, "source": logo["source"], "source_url": logo["source_url"], "page_url": logo.get("page_url"),
                           "license": logo.get("license"), "author": logo.get("author"), "fetched_at": res.get("checked_at", TODAY), "tone": logo.get("tone", "normal"), "file": logo["file"], "sha256": logo["sha256"], "bytes": logo["bytes"]}
    if official or res.get("colors_extracted"):
        colour_rows[rid] = {"checked_at": res.get("checked_at", TODAY)}
        if official:
            colour_rows[rid].update({"official": official, "official_source": ci})
        elif res.get("colors_extracted") and logo:
            colour_rows[rid].update({"extracted": res["colors_extracted"], "extracted_from": logo.get("source_url")})

catalog["records"] = curated + sorted(records, key=lambda r: (r["category"], r["organization_name"]))
catalog["updated_at"] = TODAY
sources["sources"] = [s for s in sources["sources"] if not s["id"].startswith("kr-")] + evidence
sources["updated_at"] = TODAY
thumbs["thumbnails"] = {**{k: v for k, v in thumbs["thumbnails"].items() if not k.startswith("kr-")}, **thumb_rows}
colors["colors"] = {**{k: v for k, v in colors["colors"].items() if not k.startswith("kr-")}, **colour_rows}
colors["updated_at"] = TODAY
for path, data in [(APP / "catalog.json", catalog), (APP / "sources.json", sources), (thumbs_file, thumbs), (colors_file, colors)]:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print(f"survey records {len(records)} · logos {len(thumb_rows)} · official colours {sum('official' in c for c in colour_rows.values())} · extracted {sum('extracted' in c for c in colour_rows.values())} · skipped {len(skipped)}")
for name, why in skipped:
    print("  skip", name, "—", why)
