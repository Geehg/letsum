"""Step 1 of the logo survey: build the organisation roster (tools/logo-survey/data/orgs.json).

Rosters come from Korean Wikipedia list pages and navigation templates (each entry records which page it came from);
official websites, logo files and dissolution dates come from the linked Wikidata items.
Usage: python3 -I tools/logo-survey/build_orgs.py
"""
import json, re, time, urllib.parse, urllib.request
from pathlib import Path

OUT = Path(__file__).parent / "data" / "orgs.json"
UA = {"User-Agent": "LETSUM-logo-survey/1.0 (+https://letsum.app/logos/)"}


def api(base, params):
    for attempt in range(4):
        try:
            url = base + "?" + urllib.parse.urlencode({**params, "format": "json"})
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def wikitext(title):
    data = api("https://ko.wikipedia.org/w/api.php", {"action": "parse", "page": title, "prop": "wikitext", "redirects": 1})
    return data["parse"]["wikitext"]["*"]


def links(text):
    return [m.strip() for m in re.findall(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]", text) if ":" not in m]


GROUPS = []  # (group, category, roster page, titles, region-by-title)

# Central administrative agencies: the current organisation chart, without the presidency/PM offices and advisory councils.
text = wikitext("틀:대한민국 행정부/조직도")
central = [t for t in links(text) if t.startswith("대한민국 ") and re.search(r"(부|처|청|원|위원회)$", t)
           and not re.search(r"(대통령|국무총리|비서실|자문회의|국가안보실|국가안전보장회의)$", t)]
GROUPS.append(("중앙행정기관", "national-government", "틀:대한민국 행정부/조직도", central, {}))

# Local governments: every row of the municipal list, plus the provincial tier named in its second column.
text = wikitext("대한민국의 기초자치단체 목록")
local, region_of, provinces = [], {}, []
for row in re.split(r"\n\|-", text):
    cells = [c.strip() for c in re.split(r"\|\||\n\|", row) if c.strip()]
    if len(cells) < 3:
        continue
    found = links(cells[0])
    if not found:
        continue
    province = re.sub(r"\[\[|\]\]", "", cells[1]).split("|")[-1].strip()
    local.append(found[0]); region_of[found[0]] = province
    if province not in provinces:
        provinces.append(province)
# Single-tier provincial governments have no municipalities, so they never appear in that column.
for single in ["세종특별자치시", "제주특별자치도"]:
    if single not in provinces:
        provinces.append(single)
GROUPS.append(("광역자치단체", "local-government", "대한민국의 기초자치단체 목록(광역 열) + 단층제 광역", provinces, {p: p for p in provinces}))
GROUPS.append(("기초자치단체", "local-government", "대한민국의 기초자치단체 목록", local, region_of))

# Metropolitan/provincial offices of education (not the district support offices).
text = wikitext("틀:대한민국의 교육청")
edu = [t for t in links(text) if t.endswith("교육청") and "지원청" not in t]
GROUPS.append(("시도교육청", "local-government", "틀:대한민국의 교육청", list(dict.fromkeys(edu)), {}))

# Public institutions designated under the Act on the Management of Public Institutions, by type.
for kind, template in [("시장형 공기업", "틀:대한민국의 시장형 공기업"), ("준시장형 공기업", "틀:대한민국의 준시장형 공기업"),
                       ("기금관리형 준정부기관", "틀:대한민국의 기금관리형 준정부기관"), ("위탁집행형 준정부기관", "틀:대한민국의 위탁집행형 준정부기관"),
                       ("기타공공기관", "틀:대한민국의 기타공공기관")]:
    names = [t for t in links(wikitext(template)) if not t.startswith("대한민국") and "공공기관" not in t and "공기업" not in t and "준정부기관" not in t]
    GROUPS.append((kind, "public-organization", template, list(dict.fromkeys(names)), {}))

# Universities (the alphabetical list of Korean universities).
text = wikitext("대한민국의 대학 목록")
univ = [t for t in links(text) if re.search(r"(대학교|대학|과학기술원|사관학교|대학원)$", t)]
GROUPS.append(("대학", "education", "대한민국의 대학 목록", list(dict.fromkeys(univ)), {}))

# Map Wikipedia titles to Wikidata items (following redirects), then read the claims we need.
titles = sorted({t for g in GROUPS for t in g[3]})
item_of, canonical = {}, {}
for i in range(0, len(titles), 50):
    batch = titles[i:i + 50]
    data = api("https://ko.wikipedia.org/w/api.php", {"action": "query", "titles": "|".join(batch), "prop": "pageprops", "ppprop": "wikibase_item", "redirects": 1})
    redirect = {r["from"]: r["to"] for r in data["query"].get("redirects", [])}
    normal = {n["from"]: n["to"] for n in data["query"].get("normalized", [])}
    by_title = {p["title"]: p.get("pageprops", {}).get("wikibase_item") for p in data["query"]["pages"].values()}
    for t in batch:
        target = redirect.get(normal.get(t, t), normal.get(t, t))
        canonical[t] = target; item_of[t] = by_title.get(target)

items = sorted({q for q in item_of.values() if q})
claims = {}
for i in range(0, len(items), 50):
    data = api("https://www.wikidata.org/w/api.php", {"action": "wbgetentities", "ids": "|".join(items[i:i + 50]), "props": "claims|labels", "languages": "ko|en"})
    for q, entity in data.get("entities", {}).items():
        def values(prop):
            out = []
            for claim in entity.get("claims", {}).get(prop, []):
                if claim.get("rank") == "deprecated":
                    continue
                value = claim.get("mainsnak", {}).get("datavalue", {}).get("value")
                if value is not None:
                    out.append((value, claim.get("rank"), claim.get("qualifiers", {})))
            return out
        sites = [v for v, rank, qual in values("P856") if "P582" not in qual]  # official website without an end date
        logos = [v for v, rank, qual in sorted(values("P154"), key=lambda x: x[1] != "preferred") if "P582" not in qual]
        claims[q] = {"website": sites[0] if sites else None, "logo_file": logos[0] if logos else None,
                     "coat_of_arms": (values("P94") or [[None]])[0][0], "dissolved": bool(values("P576")),
                     "name_en": entity.get("labels", {}).get("en", {}).get("value")}

NOT_ORGANISATIONS = {"대한민국의 교육청", "대학", "사이버대학", "대학교", "대학원"}
orgs, seen = [], set()
for group, category, roster, names, region_of in GROUPS:
    for t in names:
        q = item_of.get(t)
        key = q or canonical.get(t, t)
        if key in seen:
            continue
        seen.add(key)
        c = claims.get(q, {})
        if c.get("dissolved") or canonical.get(t, t) in NOT_ORGANISATIONS:
            continue
        name = re.sub(r"^대한민국 ", "", re.sub(r" \([^)]*\)$", "", canonical.get(t, t)))
        orgs.append({"name": name, "wiki_title": canonical.get(t, t), "group": group, "category": category,
                     "region": region_of.get(t) or None, "roster": roster, "wikidata": q,
                     "website": c.get("website"), "logo_file": c.get("logo_file"), "coat_of_arms": c.get("coat_of_arms"),
                     "name_en": c.get("name_en")})

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"built_at": time.strftime("%Y-%m-%d"), "orgs": orgs}, ensure_ascii=False, indent=1) + "\n")
from collections import Counter
print(Counter(o["group"] for o in orgs))
print("total", len(orgs), "website", sum(1 for o in orgs if o["website"]), "logo_file", sum(1 for o in orgs if o["logo_file"]))
