"""AI companies for the logo directory: a hand-picked roster resolved through Wikipedia/Wikidata into data/orgs.json.

Each entry names a Wikipedia article (Korean first, else English) and its field (model / platform / chip / health).
Wikidata supplies the official website (P856), the logo file on Commons (P154), the country (P17) and the labels.
Entries are added to orgs.json with group "AI 기업" (existing AI entries are replaced; the rest is untouched), so the
usual survey steps (crawl.py --only, merge.py, classify.py, check_downloads.py) pick them up.
Usage: python3 -I tools/logo-survey/ai_orgs.py
"""
import json, sys, time, urllib.parse, urllib.request
from pathlib import Path

HERE = Path(__file__).parent
UA = {"User-Agent": "LETSUM-logo-survey/1.0 (+https://letsum.app/logos/)"}
ROSTER = "LETSUM AI 기업 목록(수작업 선정)"

# Each entry: display name, field, country, and how to find it — "qid" (Wikidata item), else "ko"/"en" Wikipedia titles;
# "website" overrides Wikidata. Entries without any article keep their official site only (no Wikidata id).
AI = [
    # generative AI and models
    {"name": "OpenAI", "field": "model", "en": "OpenAI"},
    {"name": "Anthropic", "field": "model", "en": "Anthropic"},
    {"name": "Google DeepMind", "field": "model", "en": "Google DeepMind"},
    {"name": "Mistral AI", "field": "model", "en": "Mistral AI"},
    {"name": "Cohere", "field": "model", "en": "Cohere"},
    {"name": "xAI", "field": "model", "en": "xAI (company)", "website": "https://x.ai/"},
    {"name": "Perplexity", "field": "model", "en": "Perplexity AI", "website": "https://www.perplexity.ai/"},
    {"name": "Stability AI", "field": "model", "en": "Stability AI"},
    {"name": "Midjourney", "field": "model", "en": "Midjourney"},
    {"name": "DeepSeek", "field": "model", "en": "DeepSeek"},
    {"name": "Runway", "field": "model", "en": "Runway (company)"},
    {"name": "ElevenLabs", "field": "model", "en": "ElevenLabs"},
    {"name": "Character.AI", "field": "model", "en": "Character.ai"},
    {"name": "AI21 Labs", "field": "model", "en": "AI21 Labs"},
    {"name": "Moonshot AI", "field": "model", "en": "Moonshot AI"},
    {"name": "Z.ai (Zhipu AI)", "field": "model", "en": "Zhipu AI"},
    {"name": "업스테이지", "field": "model", "country": "KR", "ko": "업스테이지"},
    {"name": "LG AI연구원", "field": "model", "country": "KR", "website": "https://www.lgresearch.ai/"},
    {"name": "스캐터랩", "field": "model", "country": "KR", "website": "https://scatterlab.co.kr/"},
    {"name": "뤼튼테크놀로지스", "field": "model", "country": "KR", "website": "https://wrtn.io/"},
    {"name": "솔트룩스", "field": "model", "country": "KR", "ko": "솔트룩스"},
    {"name": "마음AI", "field": "model", "country": "KR", "ko": "마음AI"},
    # platforms and services
    {"name": "Hugging Face", "field": "platform", "en": "Hugging Face"},
    {"name": "Scale AI", "field": "platform", "en": "Scale AI", "website": "https://scale.com/"},
    {"name": "Databricks", "field": "platform", "en": "Databricks", "website": "https://www.databricks.com/"},
    {"name": "Cursor", "field": "platform", "en": "Cursor (code editor)", "website": "https://cursor.com/"},
    {"name": "네이버클라우드", "field": "platform", "country": "KR", "website": "https://www.ncloud.com/"},
    {"name": "셀바스AI", "field": "platform", "country": "KR", "ko": "셀바스AI", "website": "https://www.selvasai.com/"},
    # chips and infrastructure
    {"name": "NVIDIA", "field": "chip", "en": "Nvidia"},
    {"name": "Cerebras", "field": "chip", "en": "Cerebras"},
    {"name": "Groq", "field": "chip", "en": "Groq"},
    {"name": "리벨리온", "field": "chip", "country": "KR", "ko": "리벨리온", "website": "https://rebellions.ai/"},
    {"name": "퓨리오사AI", "field": "chip", "country": "KR", "ko": "퓨리오사AI"},
    {"name": "딥엑스", "field": "chip", "country": "KR", "ko": "딥엑스", "website": "https://deepx.ai/"},
    # medical AI
    {"name": "루닛", "field": "health", "country": "KR", "ko": "루닛", "website": "https://www.lunit.io/"},
    {"name": "뷰노", "field": "health", "country": "KR", "website": "https://www.vuno.co/"},
]


def api(base, params):
    for attempt in range(5):
        try:
            url = base + "?" + urllib.parse.urlencode({**params, "format": "json"})
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
        except Exception:
            if attempt == 4:
                raise
            time.sleep(3 * (attempt + 1))


def qid_of(lang, title):
    data = api(f"https://{lang}.wikipedia.org/w/api.php", {"action": "query", "titles": title, "redirects": 1, "prop": "pageprops", "ppprop": "wikibase_item"})
    for page in data["query"]["pages"].values():
        if "missing" not in page and page.get("pageprops", {}).get("wikibase_item"):
            return page["pageprops"]["wikibase_item"], page["title"]
    return None, None


def claim(entity, prop):
    for c in entity.get("claims", {}).get(prop, []):
        if c.get("rank") == "deprecated":
            continue
        value = c["mainsnak"].get("datavalue", {}).get("value")
        if value is not None:
            return value
    return None


def main():
    orgs_file = HERE / "data" / "orgs.json"
    data = json.loads(orgs_file.read_text())
    rows, missing = [], []
    for item in AI:
        qid = title = None
        for lang_try in ("ko", "en"):
            if item.get(lang_try):
                qid, title = qid_of(lang_try, item[lang_try])
                if qid:
                    break
        if (item.get("ko") or item.get("en")) and not qid:
            missing.append(item["name"])
            continue
        entity = api("https://www.wikidata.org/w/api.php", {"action": "wbgetentities", "ids": qid, "props": "labels|claims|sitelinks", "languages": "ko|en"})["entities"][qid] if qid else {}
        country_code = item.get("country")
        if not country_code and claim(entity, "P17"):
            c = api("https://www.wikidata.org/w/api.php", {"action": "wbgetentities", "ids": claim(entity, "P17")["id"], "props": "claims"})["entities"][claim(entity, "P17")["id"]]
            country_code = claim(c, "P297")
        ko_title = entity.get("sitelinks", {}).get("kowiki", {}).get("title")
        en_title = entity.get("sitelinks", {}).get("enwiki", {}).get("title")
        rows.append({"name": item["name"], "wiki_title": ko_title or en_title or item["name"], "wiki_lang": "ko" if ko_title else ("en" if en_title else None),
                     "group": "AI 기업", "category": "business", "region": None, "country": country_code or "US", "ai_field": item["field"],
                     "roster": ROSTER, "wikidata": qid, "website": item.get("website") or claim(entity, "P856"), "logo_file": claim(entity, "P154"),
                     "coat_of_arms": None, "name_en": entity.get("labels", {}).get("en", {}).get("value") if qid else None})
        time.sleep(0.5)
    data["orgs"] = [o for o in data["orgs"] if o.get("group") != "AI 기업"] + rows
    orgs_file.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    for r in rows:
        print(f"  {r['name']} ({r['country']}, {r['ai_field']}) {r['wikidata']} {r['website']} logo={'yes' if r['logo_file'] else 'no'}")
    print(f"AI companies {len(rows)} · not found: {', '.join(missing) or 'none'}")


if __name__ == "__main__":
    main()
