#!/usr/bin/env python3
"""특수기호 데이터(html/data/symbols.json) 생성 — 파이썬 내장 유니코드 데이터(unicodedata)로만 만든다(외부 수집·AI 없음).

카테고리: 유니코드 블록 범위 + 손으로 고른 '자주 쓰는 기호'.
이름: 유니코드 공식 영문 이름(소문자) + 한국어 검색어(카테고리 이름·자주 찾는 말).
한글 입력기 '자음 + 한자' 키: KS X 1001(완성형) 특수문자 영역(0xA1~0xAC행)을 행·유니코드 성질로 분류(참고용 — 입력기마다 조금씩 다를 수 있음).
HTML 엔티티: html.entities.codepoint2name.

사용: python3 -I tools/build_symbols.py
"""
import html.entities, json, os, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "html", "data", "symbols.json")


def rng(a, b): return [chr(c) for c in range(a, b + 1)]


def ok(c):
    try: n = unicodedata.name(c)
    except ValueError: return False
    cat = unicodedata.category(c)
    return cat[0] not in ("M", "C", "Z") and "VARIATION SELECTOR" not in n


FAV = "※☆★○●◎◇◆□■△▲▽▼→←↑↓↔♡♥♤♠♧♣☏☎♪♬✓✔✕✖✗✘♀♂·…「」『』【】〈〉《》“”‘’±×÷≠≤≥∞√∑℃㎡㎏₩€$¥①②③④⑤ⅠⅡⅢ½¹²³ⓐⓑ㉠㉡❤✿❀✦✧☀☁☂☃⚡☕♨☞☜✈✉✂"
CATS = [
    ("fav", "자주 쓰는 기호", list(dict.fromkeys(FAV)), "자주 많이 기본"),
    ("punct", "문장부호·괄호", list("‘’“”「」『』【】〔〕〈〉《》（）［］｛｝｢｣〖〗〘〙·‥…※〃§¶†‡¡¿‽⁂") + rng(0x2010, 0x205E) + rng(0x3001, 0x303F), "문장부호 괄호 따옴표 점 마침표 쉼표 말줄임"),
    ("arrow", "화살표", rng(0x2190, 0x21FF) + rng(0x27F0, 0x27FF) + rng(0x2900, 0x297F) + rng(0x2B00, 0x2B2F) + rng(0x2B30, 0x2B4F) + rng(0x2B60, 0x2BB9), "화살표 방향 위 아래 왼쪽 오른쪽"),
    ("math", "수학", list("±×÷¬°′″") + rng(0x2200, 0x22FF) + rng(0x2A00, 0x2A2F), "수학 계산 같다 부등호 무한 루트 적분 합"),
    ("num", "숫자·분수·첨자", rng(0x2150, 0x218B) + list("¹²³") + rng(0x2070, 0x209C) + rng(0x2460, 0x24FF) + rng(0x2776, 0x2793) + rng(0x3251, 0x325F) + rng(0x32B1, 0x32BF), "숫자 동그라미 원 괄호 분수 로마 위첨자 아래첨자"),
    ("hangul", "한글 원·괄호", rng(0x3200, 0x321E) + rng(0x3260, 0x327F), "한글 원 동그라미 괄호 가나다 ㄱㄴㄷ 주식회사"),
    ("unit", "단위", rng(0x3380, 0x33DF) + rng(0x2100, 0x214F), "단위 섭씨 화씨 미터 킬로그램 평방 리터 번호 상표"),
    ("money", "통화", list("$¢£¤¥₩") + rng(0x20A0, 0x20C0), "통화 돈 화폐 원 달러 엔 유로 파운드 비트코인"),
    ("shape", "도형", rng(0x25A0, 0x25FF) + rng(0x2B1B, 0x2B2F) + rng(0x2B50, 0x2B59), "도형 네모 세모 동그라미 원 사각형 삼각형 마름모 별"),
    ("deco", "별·꽃·장식", rng(0x2700, 0x27BF) + rng(0x2756, 0x2767), "장식 별 꽃 체크 가위 연필 하트 딩벳"),
    ("misc", "날씨·카드·음악", rng(0x2600, 0x26FF), "날씨 해 구름 우산 카드 트럼프 음악 음표 체스 기호"),
    ("box", "괘선·블록", rng(0x2500, 0x257F) + rng(0x2580, 0x259F), "괘선 선 표 테두리 블록 박스"),
    ("letter", "문자(그리스·키릴·일본어·자모)", rng(0x0391, 0x03A9) + rng(0x03B1, 0x03C9) + rng(0x0410, 0x044F) + rng(0x3041, 0x3096) + rng(0x30A1, 0x30FA) + rng(0x3131, 0x318E) + rng(0x00C0, 0x00FF), "그리스 알파 베타 키릴 러시아 히라가나 가타카나 일본어 한글 자모 옛한글 라틴"),
    ("emoji", "이모지", rng(0x1F600, 0x1F64F) + rng(0x1F910, 0x1F92F) + rng(0x1F970, 0x1F97A) + rng(0x1F44A, 0x1F450) + rng(0x1F493, 0x1F49F) + ["❤"] + rng(0x1F338, 0x1F33C) + rng(0x1F380, 0x1F389), "이모지 얼굴 웃음 손 하트 꽃 선물"),
]
# 자주 찾는 기호의 한국어 이름(검색용)
KO = {
    "♥": "하트 검은하트", "♡": "하트 흰하트 빈하트", "❤": "하트 빨간하트", "★": "별 검은별", "☆": "별 흰별 빈별", "※": "참고 당구장", "○": "동그라미 원",
    "●": "검은동그라미 원", "◎": "이중원 과녁", "◇": "마름모", "◆": "검은마름모", "□": "네모 사각형", "■": "검은네모", "△": "세모 삼각형", "▲": "검은세모",
    "▽": "역삼각형", "▼": "검은역삼각형", "→": "오른쪽화살표", "←": "왼쪽화살표", "↑": "위화살표", "↓": "아래화살표", "↔": "양쪽화살표", "♪": "음표", "♬": "음표 겹음표",
    "♩": "음표 사분음표", "☎": "전화", "☏": "전화", "✓": "체크", "✔": "체크 굵은체크", "✕": "엑스 곱하기", "✖": "엑스 굵은", "✗": "엑스", "✘": "엑스", "♀": "여자 여성",
    "♂": "남자 남성", "·": "가운뎃점", "…": "말줄임표", "±": "플러스마이너스", "×": "곱하기", "÷": "나누기", "≠": "같지않다", "≤": "작거나같다", "≥": "크거나같다",
    "∞": "무한대", "√": "루트", "∑": "시그마 합", "℃": "섭씨 도", "℉": "화씨", "㎡": "제곱미터 평방미터", "㎏": "킬로그램", "₩": "원화 원", "€": "유로", "$": "달러",
    "¥": "엔 위안", "£": "파운드", "₿": "비트코인", "½": "이분의일 반", "°": "도 각도", "№": "번호", "™": "상표 티엠", "®": "등록상표", "©": "저작권 카피라이트",
    "℡": "전화 텔", "㈜": "주식회사", "㉿": "한국산업규격 KS", "☀": "해 태양 맑음", "☁": "구름 흐림", "☂": "우산 비", "☃": "눈사람 눈", "⚡": "번개", "☕": "커피",
    "♨": "온천", "☞": "손가락 오른쪽", "☜": "손가락 왼쪽", "✈": "비행기", "✉": "편지 메일", "✂": "가위", "✿": "꽃", "❀": "꽃", "✦": "반짝 별", "✧": "반짝 별",
    "♠": "스페이드", "♤": "스페이드", "♣": "클로버", "♧": "클로버", "♦": "다이아", "☯": "태극 음양", "☺": "웃음 스마일", "☻": "웃음", "✌": "브이", "☑": "체크박스",
    "☐": "빈체크박스", "☒": "엑스체크박스", "⌘": "커맨드 맥", "⏎": "엔터", "⌫": "백스페이스 지우기", "⇧": "시프트", "「": "낫표", "」": "낫표", "『": "겹낫표", "』": "겹낫표",
    "【": "괄호 대괄호", "】": "괄호 대괄호", "〈": "홑화살괄호", "〉": "홑화살괄호", "《": "겹화살괄호", "》": "겹화살괄호", "“": "큰따옴표", "”": "큰따옴표", "‘": "작은따옴표",
    "’": "작은따옴표", "§": "절 섹션", "¶": "단락 문단", "†": "단검 칼표", "‰": "퍼밀", "℃": "섭씨", "㎝": "센티미터", "㎜": "밀리미터", "㎞": "킬로미터", "ℓ": "리터", "㎖": "밀리리터",
}
ALIAS = {}  # 같은 글자에 붙는 추가 이름은 KO만으로 충분


def hanja_keys():
    """KS X 1001 특수문자 영역 → {글자: 자음}. 한글 입력기 '자음 + 한자' 분류(참고)."""
    out = {}
    for row in range(0xA1, 0xAD):
        for cell in range(0xA1, 0xFF):
            try: c = bytes([row, cell]).decode("euc-kr")
            except UnicodeDecodeError: continue
            if not c.strip() or c in out or not ok(c): continue
            n = unicodedata.name(c, ""); cat = unicodedata.category(c)
            if row in (0xA1, 0xA2, 0xA3):
                if row == 0xA3 and c.isdigit(): k = "ㅈ"
                elif row == 0xA3 and c.isalpha(): k = "ㅍ"
                elif ord(c) in (0x21D2, 0x21D4): k = "ㄷ"  # ⇒⇔는 수학
                elif c in "＃＆＊＠⊙" or 0x2190 <= ord(c) <= 0x21FF or 0x25A0 <= ord(c) <= 0x25FF: k = "ㅁ"  # 화살표·도형은 도형·기호 쪽
                elif c in "∥∼｜～": k = "ㄱ"
                elif ord(c) in (0x212B, 0xC5): k = "ㄹ"
                elif cat in ("Ps", "Pe", "Pi", "Pf") or c in "＂": k = "ㄴ"
                elif cat == "Sm" or 0x2200 <= ord(c) <= 0x22FF or c in "∴♂♀∠⊥⌒∂∇≡≒≪≫∽∝∵∫∬∈∋⊆⊇⊂⊃∪∩∧∨￢⇒⇔∀∃∮∑∏－":
                    k = "ㄷ" if c not in "♂♀" else "ㄷ"
                elif cat == "Sc" or c in "％‰℃℉Å′″°￦＄￠￡￥¤": k = "ㄹ"
                elif cat[0] == "P" or c in "＇｀＾＿￣´～ˇ˘˝˚˙¸˛¨ː": k = "ㄱ"
                else: k = "ㅁ"
            elif row == 0xA4: k = "ㅋ" if 0x3131 <= ord(c) <= 0x3163 else "ㅌ"
            elif row == 0xA5: k = "ㅈ" if "ROMAN" in n else "ㅎ"
            elif row == 0xA6: k = "ㅂ"
            elif row == 0xA7: k = "ㄹ"
            elif row in (0xA8, 0xA9):
                if "HANGUL" in n: k = "ㅅ"
                elif "CIRCLED" in n or "PARENTHESIZED" in n: k = "ㅇ"
                elif "FRACTION" in n or "SUPERSCRIPT" in n or "SUBSCRIPT" in n: k = "ㅊ"
                else: k = "ㄲ"
            elif row == 0xAA: k = "ㄸ"
            elif row == 0xAB: k = "ㅃ"
            else: k = "ㅆ"
            out[c] = k
    return out


KEYNAME = {"ㄱ": "문장부호", "ㄴ": "괄호·따옴표", "ㄷ": "수학·학술", "ㄹ": "단위·통화", "ㅁ": "도형·기타 기호", "ㅂ": "괘선", "ㅅ": "한글 원·괄호 문자",
           "ㅇ": "영문·숫자 원·괄호 문자", "ㅈ": "전각 숫자·로마 숫자", "ㅊ": "분수·첨자", "ㅋ": "한글 자모", "ㅌ": "옛한글 자모", "ㅍ": "전각 영문",
           "ㅎ": "그리스 문자", "ㄲ": "라틴 확장 문자", "ㄸ": "히라가나", "ㅃ": "가타카나", "ㅆ": "키릴 문자"}


# 유니코드 영문 이름의 단어 → 한국어(검색용). 이름을 통째로 번역하지 않고 단어만 옮겨 '화살표 오른쪽'처럼 찾게 한다.
TR = {"arrow": "화살표", "arrows": "화살표", "rightwards": "오른쪽", "right": "오른쪽", "leftwards": "왼쪽", "left": "왼쪽", "upwards": "위", "up": "위",
      "downwards": "아래", "down": "아래", "heart": "하트", "hearts": "하트", "star": "별", "check": "체크", "circle": "원 동그라미", "circled": "원 동그라미",
      "square": "네모 사각형", "squared": "네모", "triangle": "세모 삼각형", "black": "검은", "white": "흰", "double": "이중 겹", "digit": "숫자", "number": "숫자",
      "parenthesized": "괄호", "hangul": "한글", "fraction": "분수", "flower": "꽃", "florette": "꽃", "hand": "손", "finger": "손가락", "index": "손가락",
      "music": "음악", "musical": "음악", "note": "음표", "notes": "음표", "sun": "해 태양", "cloud": "구름", "snowman": "눈사람", "snowflake": "눈",
      "telephone": "전화", "phone": "전화", "cross": "십자 엑스", "plus": "더하기 플러스", "minus": "빼기 마이너스", "equal": "같다", "equals": "같다",
      "less": "작다", "greater": "크다", "diamond": "마름모 다이아", "lozenge": "마름모", "bullet": "점 글머리", "dot": "점", "line": "선", "box": "박스 상자",
      "drawings": "괘선", "light": "가는", "heavy": "굵은", "horizontal": "가로", "vertical": "세로", "corner": "모서리", "bracket": "괄호", "quotation": "따옴표",
      "mark": "표", "sign": "기호", "currency": "통화", "dollar": "달러", "yen": "엔", "won": "원화", "euro": "유로", "pound": "파운드", "degree": "도",
      "celsius": "섭씨", "fahrenheit": "화씨", "square meter": "제곱미터", "roman": "로마", "numeral": "숫자", "superscript": "위첨자", "subscript": "아래첨자",
      "smiling": "웃는", "face": "얼굴", "tears": "눈물", "crying": "우는", "kiss": "뽀뽀", "eyes": "눈", "sparkles": "반짝", "sparkle": "반짝", "scissors": "가위",
      "pencil": "연필", "envelope": "편지 봉투", "airplane": "비행기", "umbrella": "우산", "hot": "뜨거운", "beverage": "음료 커피", "warning": "경고 주의",
      "chess": "체스", "card": "카드", "spade": "스페이드", "club": "클로버", "suit": "카드", "moon": "달", "crescent": "초승달", "lightning": "번개",
      "infinity": "무한", "root": "루트", "integral": "적분", "summation": "합 시그마", "pointing": "가리키는", "victory": "브이", "flag": "깃발", "recycling": "재활용",
      "ballot": "체크박스 투표", "x": "엑스", "multiplication": "곱하기", "division": "나누기", "percent": "퍼센트", "per": "퍼", "mille": "밀", "greek": "그리스",
      "alpha": "알파", "beta": "베타", "gamma": "감마", "delta": "델타", "pi": "파이", "omega": "오메가", "sigma": "시그마", "lambda": "람다", "mu": "뮤",
      "hiragana": "히라가나", "katakana": "가타카나", "cyrillic": "키릴 러시아", "letter": "글자", "small": "작은", "capital": "대문자", "ideographic": "한자"}


def tr(name):
    out = []
    for w in name.lower().replace("-", " ").split():
        if w in TR: out.append(TR[w])
    return " ".join(dict.fromkeys(out))


def main():
    hk = hanja_keys()
    cats, info = [], {}
    for cid, name, chars, kw in CATS:
        cs = [c for c in dict.fromkeys(chars) if ok(c)]
        cats.append({"id": cid, "name": name, "chars": "".join(cs), "kw": kw})
        for c in cs:
            n = unicodedata.name(c)
            d = info.setdefault(c, {"n": n.lower(), "k": KO.get(c, ""), "t": tr(n), "g": cid})
            if d.get("g") == "fav": d["g"] = cid  # '자주 쓰는'보다 원래 분류를 기억
            e = html.entities.codepoint2name.get(ord(c))
            if e: d["e"] = e
            if c in hk: d["h"] = hk[c]
    for d in info.values():
        if not d["t"]: del d["t"]
        if not d["k"]: del d["k"]
    # 자음 + 한자 표(입력기 순서)
    order = "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㄲㄸㅃㅆ"
    han = [{"k": k, "name": KEYNAME[k], "chars": "".join(c for c, v in hk.items() if v == k)} for k in order]
    for c, k in hk.items():
        if c not in info and ok(c): info[c] = {"n": unicodedata.name(c).lower(), "t": " ".join(x for x in (tr(unicodedata.name(c)), KEYNAME[k]) if x), "h": k}
    out = {"cats": cats, "info": info, "han": han, "unicode": unicodedata.unidata_version}
    with open(OUT, "w", encoding="utf-8") as f: json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"→ {OUT} · 기호 {len(info):,}개 · 분류 {len(cats)} · 자음+한자 {len(hk)}자 · 유니코드 {unicodedata.unidata_version}")


if __name__ == "__main__":
    main()
