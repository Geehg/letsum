#!/usr/bin/env python3
"""필사독서(/typing.html) 도서 데이터 — 저작권 보호기간이 끝난 작품을 위키문헌(Wikisource) 원문에서 가져온다.

출력: html/data/typing/index.json(목록·테마) + html/data/typing/<id>.json(본문)
원칙
- 본문을 지어내지 않는다. 위키문헌 원문 그대로 가져오고 출처 주소를 함께 저장한다.
- 필사하기 쉽게 하는 최소한의 정리만: 괄호 속 한자 병기 삭제, 본문 한자 → 한글 독음(hanja 패키지),
  제목·창작 날짜·위키문헌 안내 줄 삭제, 줄 앞뒤 공백 정리. 옛 맞춤법은 그대로 둔다.
- 위키문헌의 '현대어' 대조본(CC BY-SA 4.0)을 쓴 작품은 license 표기를 남긴다.
- 저자 사망 후 70년이 지난 작품만(국내 기준). 영어 작품도 같은 기준.

사용: .venv/bin/python tools/build_typing_books.py   (hanja 패키지 필요)
"""
import html as H, json, os, re, sys, time, urllib.parse, urllib.request
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "html", "data", "typing")
UA = {"User-Agent": "LETSUM-typing/1.0 (https://letsum.app; interq4@naver.com)"}

# 테마 → 작품. page: 위키문헌 문서 이름. poem: 줄바꿈을 살려 필사. modern: '현대어' 대조 부분만 사용
THEMES = [
  {"id": "start", "title": "처음 필사", "kicker": "몸풀기", "desc": "필사가 처음이라면 짧은 산문부터", "books": [
    {"id": "small-sentence", "title": "오늘의 작은 문장", "author": "필사독서 예문", "year": 2026, "died": 0, "text": "책은 언제나 같은 자리에 놓여 있지만, 우리는 어제와 다른 마음으로 그 책을 펼친다. 낯익은 한 문장이 어느 날 갑자기 새로운 뜻으로 다가오는 이유다.\n\n아침의 빛은 천천히 책상 위를 건넌다. 종이 끝에 닿은 햇살은 작고 따뜻한 그림자를 만든다. 우리는 잠시 서두르던 일을 멈추고, 첫 문장을 눈으로 따라간다.\n\n읽는 것은 누군가의 생각이 내 안으로 들어오는 일이다. 쓰는 것은 그 생각이 잠시 내 손끝에 머물렀다가 지나가는 일이다. 같은 문장이라도 직접 적어 보면 숨겨져 있던 리듬을 발견하게 된다.\n\n그러니 오늘은 많이 읽으려 애쓰지 않아도 좋다. 단 한 페이지를 차분히 쓰고, 그 문장이 남긴 감정을 기억하자. 작은 기록은 매일 조금씩 쌓여 결국 한 권의 완독으로 이어진다.\n\n마음에 드는 문장을 만나면 잠깐 멈춰 보자. 어떤 단어가 가장 오래 남았는지, 어느 문장에서 고개를 끄덕였는지 생각해 보자. 페이지의 끝은 생각의 끝이 아니다.\n\n마지막 글자를 누른 뒤에는 조용히 숨을 고른다. 방금 지나온 문장들이 책과 손 사이에 작은 길을 만들어 두었다. 내일 다시 돌아왔을 때, 우리는 이 길을 따라 책 속으로 들어갈 수 있다.", "font": "gowun-batang", "color": "#a6b9a0", "own": True},
    {"id": "quiet-page", "title": "The Quiet Page", "author": "필사독서 예문", "year": 2026, "died": 0, "text": "A book waits without asking anything of us. We open it at our own pace, bringing the day and all its scattered thoughts to the first page.\n\nSometimes the smallest sentence stays with us the longest. Reading it once may be enough to understand its meaning. Typing it slowly helps us notice its shape, its pauses, and its quiet rhythm.\n\nThere is no need to rush to the final chapter. Make room for a single paragraph. Let one line turn into another, and let your attention settle where the words are.\n\nWhen the page is complete, look away from the screen for a moment. Remember one sentence you want to carry into tomorrow. That is a good place to begin again.", "lang": "en", "font": "e-lora", "color": "#aaa1cb", "own": True},
  ]},
  {"id": "poems", "title": "교과서에서 만난 한국 근대 시", "kicker": "이달의 추천 테마", "desc": "짧아서 하루 한 편, 손끝으로 외우는 시", "books": [
    {"id": "seosi", "title": "서시", "author": "윤동주", "year": 1941, "died": 1945, "page": "하늘과 바람과 별과 시 (1955년)/서시", "poem": True, "font": "k-gyeonggibatangotf", "color": "#1d2b53"},
    {"id": "byeol", "title": "별 헤는 밤", "author": "윤동주", "year": 1941, "died": 1945, "page": "하늘과 바람과 별과 시 (1955년)/별헤는 밤", "poem": True, "font": "nanum-myeongjo", "color": "#0f1a3a"},
    {"id": "jahwasang", "title": "자화상", "author": "윤동주", "year": 1939, "died": 1945, "page": "하늘과 바람과 별과 시 (1955년)/자화상", "poem": True, "font": "gowun-batang", "color": "#3a4a3a"},
    {"id": "swipge", "title": "쉽게 씌어진 시", "author": "윤동주", "year": 1942, "died": 1945, "page": "쉽게 씌어진 시", "poem": True, "font": "noto-serif-kr", "color": "#4a3b2c"},
    {"id": "jindallae", "title": "진달래꽃", "author": "김소월", "year": 1925, "died": 1934, "page": "진달래꽃 (시집)/진달래꽃", "poem": True, "font": "nanum-pen", "color": "#b03a63"},
    {"id": "eomma", "title": "엄마야 누나야", "author": "김소월", "year": 1925, "died": 1934, "page": "진달래꽃 (시집)/엄마야 누나야", "poem": True, "font": "gamja-flower", "color": "#3d7a6a"},
    {"id": "nimui", "title": "님의 침묵", "author": "한용운", "year": 1926, "died": 1944, "page": "님의 침묵/님의 침묵", "poem": True, "modern": True, "font": "song-myung", "color": "#5a2d2d"},
    {"id": "gwangya", "title": "광야", "author": "이육사", "year": 1945, "died": 1944, "page": "광야 (이육사)", "poem": True, "font": "black-han-sans", "color": "#2b2b2b"},
    {"id": "ppaeatgin", "title": "빼앗긴 들에도 봄은 오는가", "author": "이상화", "year": 1926, "died": 1943, "page": "빼앗긴 들에도 봄은 오는가", "poem": True, "font": "do-hyeon", "color": "#6a7d2a"},
    {"id": "hyangsu", "title": "향수", "author": "정지용", "year": 1927, "died": 1950, "page": "향수/향수", "poem": True, "font": "hahmlet", "color": "#7a5a2a"},
  ]},
  {"id": "stories", "title": "꼭 읽어 봐야 하는 한국 근대 단편", "kicker": "한 편을 끝까지", "desc": "첫 문장부터 마지막 문장까지 완필에 도전", "books": [
    {"id": "unsu", "title": "운수 좋은 날", "author": "현진건", "year": 1924, "died": 1943, "page": "운수 좋은 날", "font": "nanum-myeongjo", "color": "#3c4a5a"},
    {"id": "memil", "title": "메밀꽃 필 무렵", "author": "이효석", "year": 1936, "died": 1942, "page": "메밀꽃 필 무렵", "font": "gowun-batang", "color": "#e8e4d4", "ink": "#2a2a2a"},
    {"id": "dongbaek", "title": "동백꽃", "author": "김유정", "year": 1936, "died": 1937, "page": "동백꽃", "font": "jua", "color": "#d8b23a", "ink": "#2a2410"},
    {"id": "bombom", "title": "봄봄", "author": "김유정", "year": 1935, "died": 1937, "page": "봄봄", "font": "do-hyeon", "color": "#7fae5a"},
  ]},
  {"id": "english", "title": "영어 고전 첫 장면", "kicker": "English classics", "desc": "영어 타자와 명문장을 한 번에", "books": [
    {"id": "pride", "title": "Pride and Prejudice", "author": "Jane Austen", "year": 1813, "died": 1817, "page": "Pride and Prejudice/Chapter 1", "host": "en", "lang": "en", "font": "e-playfair-display", "color": "#2d3a5a"},
    {"id": "alice", "title": "Alice's Adventures in Wonderland", "author": "Lewis Carroll", "year": 1865, "died": 1898, "page": "Alice's Adventures in Wonderland (1866)/Chapter 1", "host": "en", "lang": "en", "font": "e-lora", "color": "#4a8a9a"},
    {"id": "sonnet18", "title": "Sonnet 18", "author": "William Shakespeare", "year": 1609, "died": 1616, "page": "Shakespeare's Sonnets (1883)/Sonnet 18", "host": "en", "lang": "en", "poem": True, "font": "e-dancing-script", "color": "#8a3a4a"},
    {"id": "magi", "title": "The Gift of the Magi", "author": "O. Henry", "year": 1905, "died": 1910, "page": "The Four Million/The Gift of the Magi", "host": "en", "lang": "en", "font": "e-merriweather", "color": "#5a2a2a"},
  ]},
]


def api(page, host="ko"):
    u = f"https://{host}.wikisource.org/w/api.php?" + urllib.parse.urlencode({"action": "parse", "page": page, "prop": "text", "format": "json", "formatversion": 2, "redirects": 1})
    for i in range(3):
        try:
            j = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read())
            if "parse" in j: return j["parse"]["text"]
            raise RuntimeError(j.get("error", {}).get("info", "no parse"))
        except Exception:
            if i == 2: raise
            time.sleep(2)


class P(HTMLParser):
    BLOCK = ("p", "div", "h2", "h3", "h4", "li", "dd", "tr")
    def __init__(s):
        super().__init__(); s.out = []; s.buf = ""; s.skip = 0; s.stack = []
    def handle_starttag(s, t, a):
        a = dict(a); cls = a.get("class", "") or ""
        if s.skip or t in ("style", "script", "sup") or re.search(r"(navbox|ws-noexport|licen|mw-references|reference|toc|noprint|mw-editsection|metadata|ws-header|wst-header|header_|PageNumber|pagenum)", cls) or a.get("id") in ("toc", "headertemplate", "headerContainer"):
            s.skip += 1; s.stack.append(t); return
        s.stack.append(None)
        if t == "br": s.buf += "\n"
        if t in s.BLOCK: s.flush()
    def handle_startendtag(s, t, a):
        if not s.skip and t == "br": s.buf += "\n"
    def handle_endtag(s, t):
        if not s.stack: return
        x = s.stack.pop()
        if x is not None: s.skip -= 1; return
        if t in s.BLOCK: s.flush()
    def handle_data(s, d):
        if not s.skip: s.buf += d
    def flush(s):
        b = re.sub(r"[ \t ]+", " ", s.buf).strip("\n ")
        if b.strip(): s.out.append(b)
        s.buf = ""


JUNK = re.compile(r"^(라이선스|바깥 고리|레이아웃 \d|Layout \d|CHAPTER [IVXLC]+\.?|Chapter [IVXLC]+\.?|[*\s]+|PRIDE & PREJUDICE\.?|Down the rabbit-hole\.?|현대어|원문|🙝🙟|이 저작물은.*|.*퍼블릭 도메인.*|이 문서는 옛한글을.*|관련 글꼴이 설치되지.*|Public domain.*|This work .*|←.*|.*→|[IVXLC]+\.?)$")
OLDJAMO = re.compile(r"[ᄀ-ᇿꥠ-꥿ힰ-퟿]")  # 옛한글 자모가 든 블록 = 옛 표기 원본(같은 문서에 현대 표기본이 함께 있을 때 뺌)
key = lambda x: re.sub(r"[\s,.·!?'’\"]", "", x)
DATE = re.compile(r"^[一二三四五六七八九〇○十•·.\s\d]+$")


def clean_hanja(t):
    import hanja
    t = re.sub(r"\(([㐀-鿿豈-﫿・·, ]+)\)", "", t)  # 괄호 병기 삭제
    return hanja.translate(t, "substitution") if re.search(r"[㐀-鿿豈-﫿]", t) else t


def get_text(b):
    blocks = []
    p = P(); p.feed(api(b["page"], b.get("host", "ko"))); p.flush()
    blocks = p.out
    if b.get("modern"):
        i = next((k for k, x in enumerate(blocks) if x.strip() == "현대어"), None)
        if i is None: raise RuntimeError("현대어 부분 없음")
        blocks = blocks[i + 1:]
    out = []
    for x in blocks:
        x = x.strip()
        if not x or JUNK.match(x) or DATE.match(x): continue
        if re.fullmatch(r"[㐀-鿿]+", x): continue  # 한자 제목 줄(序詩 등)
        if key(x) == key(b["title"]) or key(x).upper() == key(b["title"]).upper(): continue  # 제목 줄
        if OLDJAMO.search(x) and not b.get("keepold"): continue
        if re.fullmatch(r"\d{1,3}", x): continue  # 소네트 번호 등
        out.append(x)
    if b.get("poem"):
        # 시: 블록(문단)마다 줄바꿈 묶음의 가장 짧은 길이 = 행 구분, 그보다 긴 묶음 = 연 구분. 블록 사이도 연 구분.
        stanzas = []
        for x in out:
            x = re.sub(r"[ \t]*\n[ \t]*", "\n", x).strip("\n")
            runs = [len(m) for m in re.findall(r"\n+", x)]
            if runs:
                m = max(set(runs), key=runs.count)  # 가장 흔한 줄바꿈 길이 = 행 구분, 그보다 긴 것 = 연 구분
                x = re.sub(r"\n+", lambda r: "\n" if len(r.group()) <= m else "\n\n", x)
            stanzas.append(x.strip())
        text = "\n\n".join(s_ for s_ in stanzas if s_)
        first, _, rest = text.partition("\n")
        if rest and key(first) == key(b["title"]): text = rest.lstrip("\n")  # 본문 첫 줄의 제목
    else:
        text = "\n\n".join(re.sub(r"\s*\n\s*", " ", x) for x in out)
    text = clean_hanja(text) if b.get("lang", "ko") == "ko" else text
    text = text.replace("…", "...").replace(" ", " ").replace("　", " ")
    return text


def main():
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    index = {"themes": [], "updated": time.strftime("%Y-%m-%d")}
    for th in THEMES:
        books = []
        for b in th["books"]:
            path = os.path.join(OUT, b["id"] + ".json")
            if only and b["id"] not in only and os.path.exists(path):
                old = json.load(open(path, encoding="utf-8")); text = old["text"]
            elif b.get("text"):
                text = b["text"]  # TYPEBOOK 자체 예문(직접 쓴 글)
            else:
                text = get_text(b); time.sleep(0.5)
            host = b.get("host", "ko")
            src = "" if b.get("own") else f"https://{host}.wikisource.org/wiki/" + urllib.parse.quote(b["page"].replace(" ", "_"))
            lic = "LETSUM 필사독서 자체 예문" if b.get("own") else "위키문헌 현대어 대조본 · CC BY-SA 4.0" if b.get("modern") else "퍼블릭 도메인(저작권 보호기간 만료)"
            meta = {k: b[k] for k in ("id", "title", "author", "year", "font", "color") if k in b}
            meta.update(lang=b.get("lang", "ko"), poem=bool(b.get("poem")), ink=b.get("ink", "#ffffff"), source=src, license=lic, chars=len(text), died=b["died"])
            json.dump({**meta, "text": text}, open(path, "w", encoding="utf-8"), ensure_ascii=False)
            books.append(meta); print(f"{b['id']:10} {len(text):6}자  {b['title']}")
        index["themes"].append({k: th[k] for k in ("id", "title", "kicker", "desc")} | {"books": books})
    json.dump(index, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("→", OUT)


if __name__ == "__main__":
    main()
