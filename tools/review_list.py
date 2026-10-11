#!/usr/bin/env python3 -I
"""카탈로그의 검수 대기 목록을 사람이 보기 쉬운 표로 만든다 → tools/state/review.md
패밀리 묶기: 이름 끝의 굵기 표기(B, R, L, Bold, 라이트 등)를 떼어 같은 패밀리로 묶는다."""
import json, os, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
c = json.load(open(os.path.join(HERE, "state", "catalog.json"), encoding="utf-8"))
WEIGHT = r"(\s*[-_ ]?(Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black|Heavy|UltraLight|[TLRMBH]|씬|라이트|레귤러|미디엄|볼드|헤비|굵게|보통|가늘게|얇은|굵은))+$"

def family(name):
    n = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()
    n = re.sub(r"\s*(R,?\s*M,?\s*B|[LRMB](,\s*[LRMB])+)$", "", n)
    return re.sub(WEIGHT, "", n, flags=re.I).strip() or name

fams = collections.OrderedDict()
for k, r in sorted(c.items(), key=lambda kv: -(kv[1]["sources"].get("kogl", {}).get("downloads") or 0)):
    if r.get("review") != "pending" or r.get("site_id"): continue
    kg = r["sources"].get("kogl")
    if not kg: continue
    f = family(r["name"])
    e = fams.setdefault(f, {"members": [], "license": kg.get("license"), "author": kg.get("author"), "page": kg.get("page"), "downloads": 0})
    e["members"].append(r["name"]); e["downloads"] += kg.get("downloads") or 0
    if kg.get("page") and "wrtSn" in kg["page"]: e["page"] = kg["page"]

groups = collections.defaultdict(list)
for f, e in fams.items():
    groups[e["license"] or "확인 필요"].append((f, e))
order = ["OFL", "공공누리 제1유형", "공공누리 제3유형", "CC BY-ND", "확인 필요"]
lines = [f"# 공공 무료폰트 검수 대기 목록", "",
         f"개별 레코드 {sum(len(e['members']) for e in fams.values())}건 → 패밀리 {len(fams)}개로 묶음. 다운로드 많은 순.",
         "제외됨: 비영리 조건(공공누리 2·4유형, CC BY-NC), 묶음 파일(안심글꼴 N종 등).", ""]
for lic in order + [k for k in groups if k not in order]:
    if lic not in groups: continue
    rows = groups[lic]
    lines += [f"## {lic} — {len(rows)}개", "", "| 패밀리 | 저작권자 | 굵기/파일 | 다운로드 | 원 배포처 |", "|---|---|---|---|---|"]
    for f, e in rows:
        lines.append(f"| {f} | {e['author'] or ''} | {len(e['members'])} | {e['downloads'] or ''} | {e['page'] or ''} |")
    lines.append("")
open(os.path.join(HERE, "state", "review.md"), "w", encoding="utf-8").write("\n".join(lines))
print(f"패밀리 {len(fams)}개", {k: len(v) for k, v in groups.items()})
