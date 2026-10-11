#!/usr/bin/env python3 -I
"""사람(또는 AI)이 견본을 보고 작성한 분류 검수 파일을 data.js에 반영한다. 여러 번 실행해도 결과가 같다(멱등).
검수 파일 형식(tools/state/review_*.json): { "<font id>": ["분류", "설명", ["태그"...], ["분위기"...]] }
분류는 고딕·명조·손글씨·디스플레이 중 하나여야 한다. 분류에 맞춰 대체 글꼴(sans-serif/serif/cursive)과 영문 짝꿍도 바꾼다.
사용: python3 -I tools/apply_review.py tools/state/review_webfonts.json tools/state/review_webfonts_kogl.json
"""
import json, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "html", "js", "data.js")
GEN = {"고딕": ("sans-serif", "inter"), "명조": ("serif", "playfair"), "손글씨": ("cursive", "inter"), "디스플레이": ("sans-serif", "grotesk")}
MOODS = {"단정한", "차분한", "따뜻한", "세련된", "고전적", "발랄한", "귀여운", "강렬한"}
J = lambda x: json.dumps(x, ensure_ascii=False)

s = open(DATA, encoding="utf-8").read(); n = 0; errors = []
for path in sys.argv[1:]:
    for fid, (cat, desc, tags, mood) in json.load(open(path, encoding="utf-8")).items():
        if cat not in GEN: errors.append(f"{fid}: 분류 '{cat}' 허용 안 됨"); continue
        if not set(mood) <= MOODS: errors.append(f"{fid}: 분위기 {set(mood) - MOODS} 허용 안 됨"); continue
        m = re.search(r'\{ id: "' + re.escape(fid) + r'".*?desc: "[^"]*" \},', s, re.S)
        if not m: errors.append(f"{fid}: data.js에 없음"); continue
        b = m.group(0); gen, pair = GEN[cat]
        b = re.sub(r'family: "\'(LS [^\']+)\', [a-z-]+"', lambda mm: f'family: "\'{mm.group(1)}\', {gen}"', b)
        b = re.sub(r'category: "[^"]*"', f'category: "{cat}"', b)
        b = re.sub(r'tags: \[[^\]]*\]', "tags: " + J(tags), b)
        b = re.sub(r'mood: \[[^\]]*\]', "mood: " + J(mood), b)
        b = re.sub(r'pair: "[^"]*"', f'pair: "{pair}"', b)
        b = re.sub(r'desc: "[^"]*"', "desc: " + J(desc), b)
        s = s.replace(m.group(0), b); n += 1
open(DATA, "w", encoding="utf-8").write(s)
print(f"반영 {n}건")
if errors:
    print("오류:", *errors, sep="\n  "); sys.exit(1)
