#!/usr/bin/env python3 -I
"""tools/state/webfonts.json(build_webfonts.py 결과)을 html/js/data.js의 FONTS에 넣는다.
- 이미 있는 id는 굵기·웹폰트 주소·글자 정보만 갱신하고, 사람이 고친 한글명·분류·설명·태그는 건드리지 않는다.
- 새 항목은 status "checking"(확인 중)으로 넣는다. 분류는 이름으로 추정한 값이라 검수 때 고친다.
"""
import json, os, re
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
META = json.load(open(os.path.join(HERE, "state", "webfonts.json"), encoding="utf-8"))
DATA = os.path.join(HERE, "..", "html", "js", "data.js")
TODAY = date.today().isoformat()

def guess_cat(name):
    if re.search(r"명조|바탕|serif|세리프|궁서|송", name, re.I): return "명조", "serif", ["본문", "명조"], ["차분한", "고전적"], "playfair"
    if re.search(r"손글씨|필기|펜|붓|캘리|손편지|글씨체|어린이|엄마|할머니|할아버지|체$" , name) and not re.search(r"고딕|돋움|산스|sans", name, re.I):
        return "손글씨", "cursive", ["손글씨", "감성"], ["따뜻한", "발랄한"], "inter"
    if re.search(r"고딕|돋움|산스|sans|gothic|스퀘어|바른", name, re.I): return "고딕", "sans-serif", ["본문", "고딕"], ["단정한"], "inter"
    return "디스플레이", "sans-serif", ["제목", "개성"], ["발랄한"], "grotesk"

def clean(name):
    """표시명에서 끝의 굵기 표기 제거: '학교안심 꼬꼬마 R' → '학교안심 꼬꼬마'"""
    name = re.sub(r"\s+(R|L|B|M|EB|Black|Outline|Regular|Light|Bold|Medium)$", "", name).strip()
    return re.sub(r"(체)(R|L|B|M|EB|BL)$", r"\1", name)  # 김해가야체B -> 김해가야체

def entry(fid, m):
    m = dict(m, name=clean(m["name"]))
    cat, gen, tags, mood, pair = guess_cat(m["name"])
    fam = "LS " + fid[2:]
    weights = sorted(int(w) for w in m["weights"])
    wf = ", ".join(f'{w}: "{u}"' for w, u in sorted(((int(k), v) for k, v in m["files"].items())))
    glyphs = f"한글 {m['cov']:,}자" if m["cov"] else "한글 확인 필요"
    lic = m.get("license", "OFL")
    if lic == "OFL":
        desc = f"{m['author'] or '공공기관·기업'}이(가) 무료 배포한 {cat} 폰트. 공유마당 안심글꼴(OFL)로 제공되며, 상업적 이용·웹 임베딩이 가능합니다."
        attribution = ""
    else:
        desc = f"{m['author'] or '공공기관'}이(가) 공공누리 제1유형으로 배포한 {cat} 폰트. 상업적 이용·변경이 가능하며, 사용 시 저작권자 표시가 필요합니다."
        attribution = f"{m['name']} © {m['author'] or '저작권자'}, 공공누리 제1유형"
    pop = min(80, 40 + int((m.get("downloads") or 0) / 300))
    return (f'  {{ id: "{fid}", name: "{m["name"]}", en: "{m["en"] or m["name"]}", family: "\'{fam}\', {gen}",\n'
            f'    designer: "{m["author"] or "확인 필요"}", holder: "{m["author"] or "확인 필요"}", category: "{cat}",\n'
            f'    tags: {json.dumps(tags, ensure_ascii=False)}, mood: {json.dumps(mood, ensure_ascii=False)}, weights: {weights}, formats: ["TTF","OTF"],\n'
            f'    cov: {m["cov"]}, glyphs: "{glyphs}", old: {str(m["old"]).lower()}, hanja: {str(m["hanja"]).lower()},\n'
            f'    webfont: {{ {wf} }},\n'
            f'    dl: {{ page: "{m["page"]}", srcName: "공유마당" }},\n'
            f'    license: "{lic}", matrix: OFL_ALL_OK, verified: "{TODAY}", status: "checking",' + (f' attribution: "{attribution}",' if attribution else '') + '\n'
            f'    pair: "{pair}", pop: {pop}, added: "{TODAY}",\n'
            f'    desc: "{desc}" }},')

src = open(DATA, encoding="utf-8").read()
have = set(re.findall(r'\{ id: "([^"]+)"', src))
new, upd = [], 0
for fid, m in META.items():
    if fid in have:
        # 웹폰트 주소·굵기만 갱신
        pat = re.compile(r'(\{ id: "' + re.escape(fid) + r'".*?)webfont: \{[^}]*\}', re.S)
        wf = ", ".join(f'{w}: "{u}"' for w, u in sorted(((int(k), v) for k, v in m["files"].items())))
        src, n = pat.subn(lambda mm: mm.group(1) + "webfont: { " + wf + " }", src, count=1); upd += n
    else:
        new.append(entry(fid, m))
if new:
    src = src.replace("\n];\n\n// 관리자 계정", "\n" + "\n".join(new) + "\n];\n\n// 관리자 계정", 1)
open(DATA, "w", encoding="utf-8").write(src)
print(f"새 항목 {len(new)}개, 갱신 {upd}개")
