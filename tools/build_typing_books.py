#!/usr/bin/env python3
"""필사독서(/typing.html) 도서 데이터 — 저작권 보호기간이 끝난 작품을 위키문헌(Wikisource) 원문에서 가져온다.

출력: html/data/typing/index.json(목록·테마) + html/data/typing/<id>.json(본문)
원칙
- 본문을 지어내지 않는다. 위키문헌 원문 그대로 가져오고 출처 주소를 함께 저장한다.
- 필사하기 쉽게 하는 최소한의 정리만: 괄호 속 한자 병기 삭제, 본문 한자 → 한글 독음(hanja 패키지),
  제목·창작 날짜·위키문헌 안내 줄 삭제, 줄 앞뒤 공백 정리. 옛 맞춤법은 그대로 둔다.
- 위키문헌의 '현대어' 대조본(CC BY-SA 4.0)을 쓴 작품은 license 표기를 남긴다.
- 저자 사망 후 70년이 지난 작품만(국내 기준). 영어 작품도 같은 기준.

전체 서가: 위키문헌 작가 문서(저자:OOO)의 갈래(소설·시·수필·동화)를 따라 자동 수집 — 소설은 작품마다 한 권,
  시·수필·동화는 작가별 모음 한 권(작품마다 장). 영어 고전은 Project Gutenberg 공개 텍스트(EN_BOOKS), 목차로 장 나눔.
  옛한글(아래아 등)·국한문·일본어가 많은 글은 뺌(된시옷 ᄯᅢ→때 는 현대 쌍자음으로 바꿔 살림).
  받은 원문은 ../tmp/typing-cache 에 보관(다시 돌려도 위키문헌에 또 묻지 않음).

사용: .venv/bin/python -I tools/build_typing_books.py [--no-library|--ko-only|--en-only]   (hanja 패키지 필요)
목록 문서: docs/typing_library.md
"""
import collections, html as H, json, os, re, sys, time, urllib.parse, urllib.request
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
  {"id": "english", "title": "영어 고전", "kicker": "English classics", "desc": "영어 타자와 명문장을 한 번에 — 원하는 장부터", "books": [
    {"ref": "g1342"},  # 전체 서가의 전권(장별)으로 연결
    {"ref": "g11"},
    {"id": "sonnet18", "title": "Sonnet 18", "author": "William Shakespeare", "year": 1609, "died": 1616, "page": "Shakespeare's Sonnets (1883)/Sonnet 18", "host": "en", "lang": "en", "poem": True, "font": "e-dancing-script", "color": "#8a3a4a"},
    {"id": "magi", "title": "The Gift of the Magi", "author": "O. Henry", "year": 1905, "died": 1910, "page": "The Four Million/The Gift of the Magi", "host": "en", "lang": "en", "font": "e-merriweather", "color": "#5a2a2a"},
  ]},
]


CACHE = os.path.join(os.path.dirname(ROOT), "tmp", "typing-cache")  # 받아 온 원문 보관(다시 돌릴 때 위키문헌에 또 묻지 않음)


def fetch(url, binary=False):
    import hashlib
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest())
    if os.path.exists(f):
        b = open(f, "rb").read()
    else:
        for i in range(4):
            try:
                b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read(); break
            except Exception:
                if i == 3: raise
                time.sleep(3 * (i + 1))
        open(f, "wb").write(b); time.sleep(0.25)
    return b if binary else b.decode("utf-8", "replace")


def parse_page(page, host="ko"):
    """위키문헌 문서 → (실제 문서 이름, HTML). 넘겨주기(redirect)는 따라감. 없는 문서는 (None, '')."""
    u = f"https://{host}.wikisource.org/w/api.php?" + urllib.parse.urlencode({"action": "parse", "page": page, "prop": "text", "format": "json", "formatversion": 2, "redirects": 1})
    j = json.loads(fetch(u))
    if "parse" not in j: return None, ""
    return j["parse"]["title"], j["parse"]["text"]


def api(page, host="ko"):
    t, h = parse_page(page, host)
    if t is None: raise RuntimeError(f"문서 없음: {page}")
    return h


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


SIOS = {"\u112d": "\u1101", "\u112f": "\u1104", "\u1132": "\u1108", "\u1136": "\u110d"}  # 된시옷(ᄭ·ᄯ·ᄲ·ᄶ) → 쌍자음(ㄲ·ㄸ·ㅃ·ㅉ)


def modern_jamo(t):
    """1930년대 맞춤법 이전의 된시옷 표기(ᄯᅢ → 때)를 같은 소리의 현대 쌍자음으로. 그 밖의 옛 표기는 그대로 둔다."""
    import unicodedata
    if not OLDJAMO.search(t): return t
    t = "".join(SIOS.get(c, c) for c in unicodedata.normalize("NFD", t))
    return unicodedata.normalize("NFC", t)


def clean_hanja(t):
    import hanja
    t = re.sub(r"\(([\u3400-\u9fff\uf900-\ufaff・·, ]+)\)", "", t)  # 괄호 병기 삭제
    t = re.sub(r"([\u3400-\u9fff\uf900-\ufaff]+)\(([가-힣]+)\)", lambda m: m.group(2) if len(m.group(1)) == len(m.group(2)) else m.group(0), t)  # 孃(양) → 양
    return hanja.translate(t, "substitution") if re.search(r"[\u3400-\u9fff\uf900-\ufaff]", t) else t


def extract(h, title, poem=False, lang="ko", modern=False, keepold=False):
    """HTML → 필사용 본문. 옛한글·국한문·일본어가 많아 필사하기 어려운 글은 None(이유)."""
    p = P(); p.feed(h); p.flush()
    blocks = [modern_jamo(x) for x in p.out]
    cut = next((k for k, x in enumerate(blocks) if x.strip() in ("저작권", "라이선스", "라이센스")), None)
    if cut is not None: blocks = blocks[:cut]  # 문서 끝 저작권 안내부터는 본문 아님
    i = next((k for k, x in enumerate(blocks) if x.strip() == "현대어"), None)
    used_modern = False
    if i is not None:  # 원문·현대어 대조 문서는 현대어 부분만(옛 표기는 필사하기 어려움)
        j = next((k for k, x in enumerate(blocks[i + 1:], i + 1) if x.strip() == "원문"), len(blocks))
        blocks = blocks[i + 1:j] if j > i + 1 else blocks[i + 1:]; used_modern = True
    elif modern:
        return None, "현대어 부분 없음"
    out, raw, dropped = [], 0, 0
    for x in blocks:
        x = x.strip()
        if not x or JUNK.match(x) or DATE.match(x) or re.fullmatch(r"[\W_]+", x): continue  # 장식 기호만 있는 줄(🙝 🙟, * * *)
        if re.fullmatch(r"[\u3400-\u9fff]+", x): continue  # 한자 제목 줄(序詩 등)
        kx = key(clean_hanja(x)) if lang == "ko" and len(x) < 60 else key(x)
        if kx == key(title) or kx.upper() == key(title).upper(): continue  # 제목 줄(한자 제목 포함)
        if re.match(r"현재 브라우저에서는 오디오 재생이|오디오 파일을 다운로드", x): continue  # 낭독 음성 안내
        raw += len(x)
        if OLDJAMO.search(x) and not keepold: dropped += len(x); continue
        if re.fullmatch(r"\d{1,3}", x): continue  # 소네트 번호 등
        out.append(x)
    if raw and dropped / raw > 0.03: return None, "옛한글"
    body = "".join(out)
    if lang == "ko":
        han = len(re.findall(r"[\u3400-\u9fff\uf900-\ufaff]", body)); hg = len(re.findall(r"[가-힣]", body))
        if han > 0.25 * (han + hg + 1): return None, "국한문"
        if len(re.findall(r"[぀-ヿ]", body)) > 20: return None, "일본어"
    if poem:
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
        if rest and key(first) == key(title): text = rest.lstrip("\n")  # 본문 첫 줄의 제목
    else:
        text = "\n\n".join(re.sub(r"\s*\n\s*", " ", x) for x in out)
    text = clean_hanja(text) if lang == "ko" else text
    text = text.replace("…", "...").replace("\u00a0", " ").replace("　", " ").strip()
    if len(text) < (15 if poem else 80): return None, "너무 짧음"
    return (text, used_modern), ""


def get_text(b):
    r, why = extract(api(b["page"], b.get("host", "ko")), b["title"], b.get("poem"), b.get("lang", "ko"), b.get("modern"), b.get("keepold"))
    if r is None: raise RuntimeError(f"{b['title']}: {why}")
    return r[0]


# ---------------------------------------------------------------- 전체 서가(자동 수집)
# 국내 기준 저작권 보호기간(사망 다음 해부터 70년)이 끝난 작가만: 사망 1955년 이전.
KO_AUTHORS = [("김유정", 1937), ("현진건", 1943), ("이효석", 1942), ("나도향", 1926), ("최서해", 1932), ("이상", 1937), ("김동인", 1951),
              ("채만식", 1950), ("이광수", 1950), ("심훈", 1936), ("방정환", 1931), ("김소월", 1934), ("윤동주", 1945), ("한용운", 1944),
              ("이육사", 1944), ("이상화", 1943), ("정지용", 1950), ("김영랑", 1950), ("박용철", 1938), ("이장희", 1929), ("오장환", 1951),
              ("홍사용", 1947), ("노자영", 1940), ("백신애", 1939), ("강경애", 1944), ("이인직", 1916), ("이해조", 1927), ("안국선", 1926),
              ("임화", 1953), ("조명희", 1938), ("윤곤강", 1950), ("김상용", 1951)]


def sec_cat(h):
    """작가 문서의 갈래 제목 → 서가 분류. 번역·희곡·평론·편지·선전시·한시는 넣지 않음."""
    h = h.strip()
    if re.search(r"번역|번안 시|희곡|평론|편지|선전|한시|시론|논문|기타|기고|일어|불교|유심|개벽|어린이", h) and not h.startswith("번역, 번안"): return None
    if h.startswith("번역, 번안"): return "동화"  # 방정환의 번안 동화(원작도 저작권 만료)
    if "동화" in h or "동요" in h or "동시" in h: return "동화"
    if "소설" in h or h in ("한일 병합 이전", "한일 병합 이후"): return "소설"
    if "수필" in h: return "수필"
    if "시" in h or h in ("1", "2", "3", "4", "5") or h == "": return "시" if h else None
    return None


PALETTE = ["#2d3a5a", "#3c4a5a", "#5a2d2d", "#2f4a3a", "#6a4a2a", "#3d5a6a", "#5a3d5a", "#7a5a3a", "#2a3a3a", "#4a5a2a", "#6a2a3a", "#3a3a5a", "#a6b9a0", "#c8b48a", "#9aa8c0", "#b08a8a"]
LIGHT = {"#a6b9a0", "#c8b48a", "#9aa8c0", "#b08a8a"}
FONTS = {"시": ["nanum-myeongjo", "song-myung", "gowun-batang", "hahmlet", "diphylleia"], "소설": ["noto-serif-kr", "gowun-batang", "nanum-myeongjo", "hahmlet"],
         "수필": ["gowun-batang", "gowun-dodum", "nanum-myeongjo"], "동화": ["jua", "gamja-flower", "single-day", "poor-story"],
         "en": ["e-lora", "e-merriweather", "e-playfair-display", "e-libre-baskerville", "e-cormorant-garamond"]}


def look(seed, cat, lang):
    import hashlib
    h = int(hashlib.sha1(seed.encode()).hexdigest(), 16)
    c = PALETTE[h % len(PALETTE)]; f = FONTS["en" if lang == "en" else cat]
    return {"color": c, "ink": "#2a2a2a" if c in LIGHT else "#ffffff", "font": f[(h >> 8) % len(f)]}


def nice(t):
    return re.sub(r"\s*\([^)]*\)\s*$", "", t).strip()


def subpages(title, h):
    seen, out = set(), []
    for x in re.findall(r'<a href="/wiki/[^"#]+"[^>]*title="([^"]+)"', h):
        x = H.unescape(x)
        if x.startswith(title + "/") and x not in seen: seen.add(x); out.append(x)
    return out


def ws_parts(page, poem, depth=0):
    """위키문헌 문서 하나 → [(소제목, 본문, 현대어 사용 여부)]. 하위 문서(장·편)가 있으면 그 순서대로."""
    title, h = parse_page(page)
    if title is None: return []
    subs = subpages(title, h)
    if len(subs) >= 2 and depth < 2:
        return [p_ for sp in subs for p_ in ws_parts(sp, poem, depth + 1)]
    r, why = extract(h, nice(title.split("/")[-1]), poem)
    if r is None:
        print(f"   - 뺌({why}): {title}"); return []
    return [(nice(title.split("/")[-1]), r[0], r[1])]


def dedupe(parts):
    seen, out = set(), []
    for t, x, m in parts:
        k = key(x[:60])
        if k in seen: continue
        seen.add(k); out.append((t, x, m))
    return out


def ko_library(skip_pages):
    books = []
    for author, died in KO_AUTHORS:
        title, h = parse_page("저자:" + author)
        sec, items = "", []
        for hd, t in re.findall(r'<h[2-4][^>]*>(.*?)</h[2-4]>|<a href="/wiki/[^"#]+"[^>]*title="([^"]+)"', h):
            if hd: sec = re.sub(r"<[^>]+>", "", H.unescape(hd)).strip(); continue
            t = H.unescape(t); c = sec_cat(sec)
            if not c or ":" in t or "(페이지가 없음)" in t or t.startswith("저자") or (c, t) in items: continue
            items.append((c, t))
        coll = {"시": [], "수필": [], "동화": []}
        for c, page in items:
            if page in skip_pages: continue
            if c == "소설":
                parts = dedupe(ws_parts(page, False))
                if not parts: continue
                books.append(dict(title=nice(page).replace("/", " "), page=page, author=author, died=died, cat="소설", lang="ko", poem=False, parts=parts,
                                  source="https://ko.wikisource.org/wiki/" + urllib.parse.quote(page.replace(" ", "_")), seed=author + page))
            else:
                coll[c] += ws_parts(page, c == "시")
        for c, name in (("시", "시 모음"), ("수필", "수필 모음"), ("동화", "동화·동요 모음")):
            parts = dedupe(coll[c])
            if not parts: continue
            books.append(dict(title=f"{author} {name}", author=author, died=died, cat=c, lang="ko", poem=c == "시", parts=parts,
                              source="https://ko.wikisource.org/wiki/" + urllib.parse.quote("저자:" + author), seed=author + c))
        print(f"{author}: 작품 {len(items)}개 → 누적 {len(books)}권")
    return books


# 영어 고전: 저작권 만료 원문 전자책(Project Gutenberg 공개 텍스트). 번역본은 번역자도 1955년 이전 사망한 것만.
EN_BOOKS = [
    (1342, "Pride and Prejudice", "Jane Austen", 1817, "소설"), (161, "Sense and Sensibility", "Jane Austen", 1817, "소설"),
    (158, "Emma", "Jane Austen", 1817, "소설"), (105, "Persuasion", "Jane Austen", 1817, "소설"),
    (11, "Alice's Adventures in Wonderland", "Lewis Carroll", 1898, "동화"), (12, "Through the Looking-Glass", "Lewis Carroll", 1898, "동화"),
    (1661, "The Adventures of Sherlock Holmes", "Arthur Conan Doyle", 1930, "소설"), (2852, "The Hound of the Baskervilles", "Arthur Conan Doyle", 1930, "소설"),
    (244, "A Study in Scarlet", "Arthur Conan Doyle", 1930, "소설"), (1260, "Jane Eyre", "Charlotte Brontë", 1855, "소설"),
    (768, "Wuthering Heights", "Emily Brontë", 1848, "소설"), (84, "Frankenstein", "Mary Shelley", 1851, "소설"),
    (345, "Dracula", "Bram Stoker", 1912, "소설"), (46, "A Christmas Carol", "Charles Dickens", 1870, "소설"),
    (98, "A Tale of Two Cities", "Charles Dickens", 1870, "소설"), (1400, "Great Expectations", "Charles Dickens", 1870, "소설"),
    (74, "The Adventures of Tom Sawyer", "Mark Twain", 1910, "소설"), (76, "Adventures of Huckleberry Finn", "Mark Twain", 1910, "소설"),
    (174, "The Picture of Dorian Gray", "Oscar Wilde", 1900, "소설"), (902, "The Happy Prince and Other Tales", "Oscar Wilde", 1900, "동화"),
    (64317, "The Great Gatsby", "F. Scott Fitzgerald", 1940, "소설"), (45, "Anne of Green Gables", "L. M. Montgomery", 1942, "소설"),
    (514, "Little Women", "Louisa May Alcott", 1888, "소설"), (16, "Peter Pan", "J. M. Barrie", 1937, "동화"),
    (120, "Treasure Island", "Robert Louis Stevenson", 1894, "소설"), (43, "Strange Case of Dr Jekyll and Mr Hyde", "Robert Louis Stevenson", 1894, "소설"),
    (55, "The Wonderful Wizard of Oz", "L. Frank Baum", 1919, "동화"), (113, "The Secret Garden", "Frances Hodgson Burnett", 1924, "소설"),
    (215, "The Call of the Wild", "Jack London", 1916, "소설"), (236, "The Jungle Book", "Rudyard Kipling", 1936, "동화"),
    (2701, "Moby-Dick", "Herman Melville", 1891, "소설"), (25344, "The Scarlet Letter", "Nathaniel Hawthorne", 1864, "소설"),
    (35, "The Time Machine", "H. G. Wells", 1946, "소설"), (36, "The War of the Worlds", "H. G. Wells", 1946, "소설"),
    (2814, "Dubliners", "James Joyce", 1941, "소설"), (2776, "The Four Million", "O. Henry", 1910, "소설"),
    (219, "Heart of Darkness", "Joseph Conrad", 1924, "소설"), (1952, "The Yellow Wallpaper", "Charlotte Perkins Gilman", 1935, "소설"),
    (1041, "Shakespeare's Sonnets", "William Shakespeare", 1616, "시"), (12242, "Poems, Three Series", "Emily Dickinson", 1886, "시"),
    (58585, "The Prophet", "Kahlil Gibran", 1931, "시"), (2591, "Grimms' Fairy Tales", "Brothers Grimm", 1859, "동화"),
    (1597, "Andersen's Fairy Tales", "Hans Christian Andersen", 1875, "동화"), (19994, "Aesop's Fables", "Aesop", 0, "동화"),
]
HEAD = re.compile(r"^(?:(?:CHAPTER|Chapter|STAVE|Stave|BOOK|Book|PART|Part|LETTER|Letter|ADVENTURE|Adventure)\s+(?:[\dIVXLCivxlc]+|[A-Z][A-Za-z-]+)\b.*|[IVXLC]+\.?(?:\s+[A-Z][^a-z]*)?|\d{1,3}\.?)$")


def gutenberg(gid, poem):
    """공개 텍스트 → [(장 제목, 본문, False)]. 앞쪽 목차(Contents)의 제목을 본문에서 차례로 찾아 장을 나눔.
    목차가 없으면 'CHAPTER I' 같은 장 표시로, 그것도 없으면 한 덩어리(속표지는 뺌)."""
    t = fetch(f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt").replace("\r\n", "\n").replace("﻿", "")
    m = re.search(r"^Title:\s*(.+)$", t, re.M); print(f"   [{gid}] {m.group(1).strip() if m else '?'}")
    a = re.search(r"^\*\*\* ?START OF.*$", t, re.M); b = re.search(r"^\*\*\* ?END OF.*$", t, re.M)
    t = t[a.end() if a else 0: b.start() if b else len(t)]
    t = re.sub(r"\[Illustration:[^\]]*?\n\s*((?:Chapter|CHAPTER) [IVXLC]+\.?)\]", r"\n\n\1\n\n", t)  # 삽화 설명 안에 든 장 제목
    t = re.sub(r"\[(?:Illustration|Picture|Footnote|Transcriber|Sidenote)[^\]]*\]", "", t, flags=re.S | re.I)
    t = re.sub(r"(?<![\w*])_([^_\n]+(?:\n[^_\n]+)*)_(?![\w])", r"\1", t)
    blocks = [x.strip("\n") for x in re.split(r"\n\s*\n", t)]
    blocks = [x for x in blocks if x.strip() and not re.fullmatch(r"[\s*.·—-]+", x.strip()) and not re.fullmatch(r"\s*\[[\s\S]*\]\s*", x)]
    norm = lambda x: re.sub(r"[^A-Z0-9]", "", re.sub(r"\s+\d+\s*$", "", x).upper())
    # 1) 목차
    heads = []
    ci = next((i for i, x in enumerate(blocks[:200]) if re.fullmatch(r"(?:A )?(?:TABLE OF )?(?:CONTENTS|LIST OF THE FABLES)[.:]?", x.strip(), re.I)), None)
    body0 = 0
    if ci is not None:
        entries = []
        for j in range(ci + 1, min(len(blocks), ci + 400)):
            lines = [l.strip() for l in blocks[j].split("\n") if l.strip()]
            if any(len(l) > 110 for l in lines): break
            if entries and norm(lines[0]) and norm(lines[0]) == norm(entries[0]) and len(entries) >= 2: body0 = j; break
            entries += [l for l in lines if norm(l) and norm(l) != "PAGE"]
        if body0:
            ents = [norm(e) for e in entries]
            k = body0
            for e in ents:
                for j in range(k, len(blocks)):
                    if len(blocks[j]) < 160 and (norm(blocks[j]) == e or (len(e) > 5 and norm(blocks[j].split("\n")[0]) == e) or (len(e) > 8 and norm(blocks[j]).startswith(e))):
                        heads.append(j); k = j + 1; break
            if len(heads) < 2: heads = []
            elif heads[0] > body0 and sum(len(x) for x in blocks[body0:heads[0]]) > 1000:
                heads.insert(0, body0 - 1 if norm(blocks[body0 - 1]) else body0)  # 첫 장 제목을 못 찾았을 때 그 앞 본문도 살림
    # 2) 장 표시
    if not heads:
        heads = [i for i, x in enumerate(blocks) if len(x) < 120 and x.count("\n") < 3 and HEAD.match(x.split("\n")[0].strip())]
        if len(heads) < 2: heads = []
    # 3) 너무 긴 장은 안쪽의 장 표시(CHAPTER TWENTY-FOUR 등)로 한 번 더 나눔(목차가 앞부분만 있는 책)
    if heads and not poem:
        extra = [i for i, x in enumerate(blocks) if i > heads[0] and len(x) < 120 and HEAD.match(x.split("\n")[0].strip()) and i not in heads]
        hs = sorted(set(heads))
        for i in extra:
            prev = max(h for h in hs if h < i); nxt = min([h for h in hs if h > i] + [len(blocks)])
            if sum(len(x) for x in blocks[prev:nxt]) > 60000: hs.append(i); hs.sort()
        heads = hs
    out = []
    if heads:
        heads.append(len(blocks))
        for h0, h1 in zip(heads, heads[1:]):
            title = re.sub(r"\s*\n\s*", " · ", blocks[h0].strip()).rstrip(".")
            out.append((title, blocks[h0 + 1:h1]))
    else:
        st = next((i for i, x in enumerate(blocks) if len(x) > 200), 0)
        out.append(("", blocks[st:]))
    res = []
    for h, bs in out:
        if poem: txt = "\n\n".join(re.sub(r"[ \t]*\n[ \t]*", "\n", x).strip() for x in bs)
        else: txt = "\n\n".join(re.sub(r"\s*\n\s*", " ", x).strip() for x in bs)
        txt = re.sub(r"[ \t]{2,}", " ", txt).replace("…", "...").strip()
        txt = re.sub(r"\n*\bTHE END\.?\s*$", "", txt).strip()
        if len(txt) < (40 if poem else 200): continue
        if not poem:
            while bs and not re.search(r"[a-z]", bs[-1]): bs = bs[:-1]  # 끝의 인쇄소·FINIS 줄
            txt = "\n\n".join(re.sub(r"\s*\n\s*", " ", x).strip() for x in bs)
            txt = re.sub(r"[ \t]{2,}", " ", txt).replace("…", "...").strip()
        if h.isupper() and len(h) > 6:
            h = " ".join(w if re.fullmatch(r"[IVXLC]+[.:]?", w) else w.capitalize() for w in h.split(" "))
        res.append((h, txt, False))
    return res


def en_library():
    books = []
    for gid, title, author, died, cat in EN_BOOKS:
        poem = cat == "시"
        try: parts = gutenberg(gid, poem)
        except Exception as e: print("   - 실패", gid, title, e); continue
        if not parts: print("   - 본문 없음", gid, title); continue
        books.append(dict(title=title, author=author, died=died, cat=cat, lang="en", poem=poem, parts=parts,
                          source=f"https://www.gutenberg.org/ebooks/{gid}", seed=f"g{gid}", gid=gid))
        print(f"{title}: {len(parts)}장 {sum(len(x) for _, x, _ in parts):,}자")
    return books


def write_library(books):
    import hashlib
    metas = []
    seen = collections.Counter((b["author"], b["title"]) for b in books)
    for b in books:
        if seen[(b["author"], b["title"])] > 1 and b.get("page"):  # 같은 작가의 같은 제목(무정 장편·단편) → 문서 이름의 괄호까지
            b["title"] = b["page"].replace("/", " ")
        bid = ("g%d" % b["gid"]) if b.get("gid") else "k" + hashlib.sha1(b["seed"].encode()).hexdigest()[:8]
        parts = b["parts"]; modern = any(m for _, _, m in parts)
        lic = "퍼블릭 도메인(저작권 보호기간 만료)" + (" · 일부 위키문헌 현대어 대조본(CC BY-SA 4.0)" if modern else "")
        meta = dict(id=bid, title=b["title"], author=b["author"], cat=b["cat"], lang=b["lang"], poem=b["poem"], **look(b["seed"], b["cat"], b["lang"]),
                    source=b["source"], license=lic, chars=sum(len(x) for _, x, _ in parts), died=b["died"], nparts=len(parts))
        body = {"text": parts[0][1]} if len(parts) == 1 else {"parts": [{"t": t, "x": x} for t, x, _ in parts]}
        json.dump({**meta, **body}, open(os.path.join(OUT, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        metas.append(meta)
    return metas


def main():
    os.makedirs(OUT, exist_ok=True)
    only = {a for a in sys.argv[1:] if not a.startswith("--")}
    index = {"themes": [], "updated": time.strftime("%Y-%m-%d")}
    for th in THEMES:
        books = []
        for b in th["books"]:
            if b.get("ref"): books.append({"ref": b["ref"]}); continue
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
    if "--no-library" not in sys.argv:
        skip = {b["page"] for th in THEMES for b in th["books"] if b.get("page") and b.get("host", "ko") == "ko"}
        lib = []
        if "--en-only" not in sys.argv: lib += ko_library(skip)
        if "--ko-only" not in sys.argv: lib += en_library()
        index["library"] = write_library(lib)
        byid = {m["id"]: m for m in index["library"]}
        for th in index["themes"]: th["books"] = [byid[b["ref"]] if b.get("ref") else b for b in th["books"] if not b.get("ref") or b["ref"] in byid]
        print(f"전체 서가 {len(index['library'])}권 · {sum(m['chars'] for m in index['library']):,}자")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import import_covers; import_covers.mark(index)  # 생성 표지(html/img/typing/<id>.webp)가 있으면 표시 유지
    json.dump(index, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("→", OUT)


if __name__ == "__main__":
    main()
