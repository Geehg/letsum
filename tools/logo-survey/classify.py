"""Display groups for the logo directory: a two-level browse taxonomy (대분류 → 소분류) assigned to every record.

The catalog keeps its schema category; this file adds a finer grouping for browsing only, written to
tools/logo-app/data/groups.json and injected by the logo build. Survey records are classified from their roster
group (data/orgs.json) and name; hand-curated records are listed in CURATED.
Usage: python3 -I tools/logo-survey/classify.py
"""
import hashlib, json, re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
APP = HERE.parent / "logo-app" / "data"

GROUPS = [
    ("government", "중앙정부", [("ministry", "부"), ("office", "처"), ("agency", "청"), ("commission", "위원회"), ("independent", "독립·헌법기관"), ("symbol", "국가·정부 상징"), ("foreign", "해외 정부기관")]),
    ("local", "지방정부", [("metro", "광역자치단체"), ("city", "시"), ("county", "군"), ("district", "자치구"), ("education-office", "시도교육청")]),
    ("finance", "금융", [("bank", "은행"), ("guarantee", "보증·보험"), ("pension", "연금·기금"), ("investment", "투자·자산관리"), ("support", "금융 지원")]),
    ("public", "공공기관", [("energy", "에너지·자원"), ("infra", "교통·건설·국토"), ("industry", "산업·무역·진흥"), ("welfare", "보건·복지·고용"), ("culture", "문화·체육·관광"), ("agri-env", "농림·해양·환경"), ("ict", "정보·방송·통신"), ("admin", "행정·기타")]),
    ("research", "연구기관", [("science", "과학·기술 연구"), ("social", "인문·사회 연구")]),
    ("education", "대학·교육", [("national", "국립·공립대학"), ("private", "사립대학"), ("institute", "과학기술원·특수대학"), ("teachers", "교육대학"), ("foreign", "해외 대학")]),
    ("medical", "의료기관", [("university-hospital", "대학병원"), ("public-hospital", "국립·공공병원")]),
    ("ai", "AI", [("model", "생성형 AI·모델"), ("platform", "AI 플랫폼·서비스"), ("chip", "AI 반도체·인프라"), ("health", "의료 AI")]),
    ("business", "기업·브랜드", [("it", "IT·플랫폼"), ("manufacturing", "제조")]),
    ("global", "국제기구·비영리", [("international", "국제기구"), ("nonprofit", "비영리단체")]),
]

CURATED = {
    "gok-symbol": "government/symbol", "mss-mi": "government/ministry", "nasa-brand": "government/foreign",
    "seoul-my-soul": "local/metro", "seoul-city-emblem": "local/metro", "goyang-city-logo": "local/city",
    "snu-ui": "education/national", "koreatech-ui": "education/national", "kaist-ui": "education/institute",
    "postech-ui": "education/private", "yonsei-ui": "education/private", "mit-brand": "education/foreign",
    "kedi-ci": "research/social", "nhis-ci": "public/welfare", "kepco-ci": "public/energy", "khnp-ci": "public/energy",
    "naver-brand": "business/it", "naver-api-hub-bi": "business/it", "kakao-ci": "business/it", "kakaogames-ci": "business/it",
    "google-brand": "business/it", "microsoft-brand": "business/it", "adobe-brand": "business/it", "github-logo": "business/it",
    "samsung-logo": "business/manufacturing", "hyundai-ci": "business/manufacturing", "kakaobank-brand": "finance/bank",
    "unesco-logo": "global/international", "mozilla-trademarks": "global/nonprofit", "wikimedia-foundation-mark": "global/nonprofit",
}

# National and public universities (국립·공립), matched on the name without "국립".
NATIONAL = ["서울대학교", "부산대학교", "경북대학교", "전남대학교", "전북대학교", "충남대학교", "충북대학교", "강원대학교", "경상국립대학교",
            "제주대학교", "공주대학교", "군산대학교", "목포대학교", "순천대학교", "안동대학교", "창원대학교", "한밭대학교", "한국교통대학교",
            "한국해양대학교", "부경대학교", "금오공과대학교", "서울과학기술대학교", "한국체육대학교", "한국방송통신대학교", "한경국립대학교",
            "인천대학교", "서울시립대학교", "목포해양대학교", "강릉원주대학교", "한국전통문화대학교", "한국예술종합학교", "한국교원대학교",
            "한국복지대학교", "한국농수산대학교", "한국기술교육대학교", "경상국립대", "국립목포대학교", "국립한밭대학교", "국립창원대학교"]
INDEPENDENT = {"감사원", "국가정보원", "고위공직자범죄수사처", "대통령경호처", "국가인권위원회"}
RESEARCH = r"(연구원|연구소|연구회|연구재단|기획평가원|기술평가원|과학기술원|나노기술원|세라믹기술원|원자력안전기술원|원자력통제기술원|해양과학기술원|교육개발원|교육과정평가원|해양수산개발원|학중앙연구원)"
# Public institutions by what they do, checked in this order (first match wins).
PUBLIC_RULES = [
    ("energy", r"에너지|전력|가스|석유|발전|원자력|광해|광물|전기|난방|한전"),
    ("ict", r"정보|방송|통신|디지털|인터넷|데이터|소프트웨어|전파|미디어|KDN|지능"),
    ("infra", r"도로|철도|공항|항만|교통|물류|해운|선박|자동차|주택|토지|건설|국토|공간|도시|건축|시설|코레일|에스알|부동산|수자원|상하수도|승강기|항로|개발공사|매립지"),
    ("welfare", r"보건|복지|건강|의료|의약|장애|노인|아동|보육|고용|노동|산업안전|(?<!마)사회|자활|생명|혈액|장기|조직|마약|청소년|여성|양성평등|가족|소비자|장학|법률구조|인권|인력"),
    ("culture", r"문화|예술|박물관|미술관|도서관|국악|출판|영화|콘텐츠|관광|체육|스포츠|마사회|레저|랜드|경륜|태권|학당|번역|기념|국제교류|언론|저작권|잡월드|한식|과학관|등산|트레킹|게임|영상"),
    ("agri-env", r"농|수산|해양|축산|어촌|식품|산림|임업|환경|생태|기상|기후|생물|식물|검역|방역|치산|수목원|공원"),
    ("industry", r"산업|무역|중소|창업|특허|발명|지식재산|표준|기업|벤처|소상공인|시장|제품|디자인|기술|품질|인증|검사|시험|우편"),
]
SOCIAL = r"(경제|사회|정책|행정|법제|법무|형사|노동|교육|문화|여성|통일|국토|조세|재정|청소년|외교|농촌|해양수산개발|정보통신정책|산업연구|건축공간|무역|중소|직업능력|개발연구|보건사회|학중앙|고전번역|행정연구|인문)"


def survey_id(org):
    return "kr-" + (org["wikidata"].lower() if org.get("wikidata") else "w" + hashlib.sha1(org["wiki_title"].encode()).hexdigest()[:10])


def classify(org, record):
    name, group = org["name"], org["group"]
    if group == "AI 기업":
        return "ai/" + org["ai_field"]
    if group == "중앙행정기관":
        if name in INDEPENDENT:
            return "government/independent"
        for suffix, sub in [("위원회", "commission"), ("부", "ministry"), ("처", "office"), ("청", "agency")]:
            if name.endswith(suffix):
                return f"government/{sub}"
        return "government/independent"
    if group == "광역자치단체":
        return "local/metro"
    if group == "기초자치단체":
        return "local/" + {"시": "city", "군": "county", "구": "district"}.get(name[-1], "city")
    if group == "시도교육청":
        return "local/education-office"
    if group == "대학":
        plain = re.sub(r"^국립", "", name)
        if "교육대학교" in name:
            return "education/teachers"
        if re.search(r"과학기술원|에너지공과대학교|사관학교", name):
            return "education/institute"
        if name.startswith("국립") or any(plain == n or plain == re.sub(r"^국립", "", n) for n in NATIONAL):
            return "education/national"
        return "education/private"
    # Public institutions.
    if re.search(r"대학$", name):
        return "education/institute"
    if re.search(r"병원|의료원|암센터", name):
        return "medical/university-hospital" if "대학" in name else "medical/public-hospital"
    if re.search(r"은행$", name) and "조직은행" not in name:
        return "finance/bank"
    if re.search(r"보증|예금보험|무역보험|정책보험|손해배상", name):
        return "finance/guarantee"
    if re.search(r"연금|기금(?!원)", name):
        return "finance/pension"
    if re.search(r"투자공사|자산관리|벤처투자", name):
        return "finance/investment"
    if re.search(r"금융|조폐|재정정보", name):
        return "finance/support"
    if re.search(RESEARCH, name):
        return "research/social" if re.search(SOCIAL, name) else "research/science"
    for sub, pattern in PUBLIC_RULES:
        if re.search(pattern, name):
            return "public/" + sub
    return "public/admin"


def main():
    orgs = json.loads((HERE / "data" / "orgs.json").read_text())["orgs"]
    by_id = {survey_id(o): o for o in orgs}
    records = json.loads((APP / "catalog.json").read_text())["records"]
    valid = {f"{g}/{s}" for g, _, subs in GROUPS for s, _ in subs}
    assign = {}
    for record in records:
        if record["id"] in CURATED:
            value = CURATED[record["id"]]
        elif record["id"] in by_id:
            value = classify(by_id[record["id"]], record)
        else:
            raise SystemExit(f"no group rule for {record['id']}")
        assert value in valid, value
        assign[record["id"]] = value
    out = {"note": "로고모음 화면용 대분류·소분류. 카탈로그 스키마의 category와 별개(tools/logo-survey/classify.py가 생성).",
           "groups": [{"id": g, "label": label, "subs": [{"id": s, "label": l} for s, l in subs]} for g, label, subs in GROUPS],
           "assign": dict(sorted(assign.items()))}
    (APP / "groups.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    counts = Counter(assign.values())
    for g, label, subs in GROUPS:
        print(label, sum(counts[f"{g}/{s}"] for s, _ in subs), {l: counts[f"{g}/{s}"] for s, l in subs})


if __name__ == "__main__":
    main()
