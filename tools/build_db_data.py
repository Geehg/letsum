#!/usr/bin/env python3
"""딩벳(기호·아이콘) 폰트 데이터(html/js/data_db.js) 생성 — 제작사 공식 배포본만.

출처 두 가지(둘 다 변환·보관 없이 공식 웹폰트 주소를 그대로 미리보기에 쓴다):
  1) Google Fonts — 이모지·기호·음악 기호·바코드·가림(Redacted)·데이터 표현 글꼴, Material Icons·Symbols
     미리보기는 견본 글자만 담은 공식 CSS(text=·icon_names=)가 알려 주는 fonts.gstatic.com 주소
  2) 제작사 공식 npm 패키지(jsDelivr) — Bootstrap Icons·Tabler·Phosphor·Font Awesome Free 등 아이콘 폰트
     패키지의 CSS에서 아이콘 이름 → 코드포인트를 읽어 견본 아이콘을 고른다
라이선스는 각 저장소 원문을 사람이 확인해 아래 표(LIC)에 적었다. 새 폰트를 넣을 때도 원문을 먼저 읽는다.
손으로 고친 항목(manual: true)의 설명·분류는 덮어쓰지 않는다. 한 번 등록된 id는 바꾸지 않는다.

사용: python tools/build_db_data.py
"""
import io, json, os, re, subprocess, sys, time, unicodedata, urllib.parse, urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "html", "js", "data_db.js")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
TODAY = date.today().isoformat()
JSD = "https://cdn.jsdelivr.net/npm/"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r: return r.read()
        except Exception:
            if i == 2: raise
            time.sleep(2)


def js(v): return json.dumps(v, ensure_ascii=False)


# ---------- 라이선스(원문 확인: 2026-10-20) ----------
OK = {"print": "ok", "web": "ok", "video": "ok", "embed": "ok", "bici": "ok", "package": "ok", "ofl": "ok"}
LIC = {
    "OFL": dict(OK),
    "Apache 2.0": dict(OK),
    "MIT": dict(OK),
    "ISC": dict(OK),
    "Font Awesome Free License": dict(OK),
    "Remix Icon License": dict(OK, bici="no", ofl="cond"),
    "CC BY 4.0": dict(OK, ofl="cond"),
    "CoreUI Icons Free License": dict(OK),
}
LICENSE_INFO_DB = {
    "Apache 2.0": {"full": "Apache License 2.0", "short": "Apache 2.0", "note": "상업 사용·수정·재배포 가능 / 저작권·라이선스 고지 유지", "url": "https://www.apache.org/licenses/LICENSE-2.0"},
    "MIT": {"full": "MIT License", "short": "MIT", "note": "상업 사용·수정·재배포 가능 / 저작권·허가 고지 유지", "url": "https://opensource.org/license/mit"},
    "ISC": {"full": "ISC License", "short": "ISC", "note": "상업 사용·수정·재배포 가능 / 저작권·허가 고지 유지", "url": "https://opensource.org/license/isc-license-txt"},
    "Font Awesome Free License": {"full": "Font Awesome Free License(글꼴 SIL OFL 1.1 · 아이콘 CC BY 4.0 · 코드 MIT)", "short": "Font Awesome Free", "note": "상업 사용 가능 / 글꼴 파일은 OFL 1.1(예약 이름 'Font Awesome'), SVG·JS 아이콘은 CC BY 4.0(출처 표시) · 브랜드 로고 아이콘은 각 상표권자 소유", "url": "https://fontawesome.com/license/free"},
    "CC BY 4.0": {"full": "Creative Commons 저작자표시 4.0 국제(CC BY 4.0)", "short": "CC BY 4.0", "note": "상업 사용·수정·재배포 가능 / 저작자 표시 필수", "url": "https://creativecommons.org/licenses/by/4.0/deed.ko"},
    "CoreUI Icons Free License": {"full": "CoreUI Icons Free License(글꼴 SIL OFL 1.1 · 아이콘 CC BY 4.0 · 코드 MIT)", "short": "CoreUI Icons Free", "note": "상업 사용 가능 / 글꼴 파일은 OFL 1.1, SVG 아이콘은 CC BY 4.0(출처 표시)", "url": "https://coreui.io/icons/license/"},
    "Remix Icon License": {"full": "Remix Icon License v1.0 (2026-01)", "short": "Remix Icon License", "note": "개인·상업 프로젝트 사용·수정 가능, 출처 표시 선택 / 아이콘만 따로 파는 것·경쟁 아이콘 세트 제작 금지, 로고·상표·브랜드 아이덴티티로 사용 금지", "url": "https://github.com/Remix-Design/RemixIcon/blob/master/License"},
}

# ---------- 견본 아이콘: 개념별 이름 후보(제작사마다 이름이 달라 차례로 찾는다) ----------
CONCEPTS = [
    ("집", ["house", "home", "home-alt", "house-door", "home-1"]), ("하트", ["heart", "favorite", "suit-heart"]), ("별", ["star"]),
    ("검색", ["search", "magnifying-glass", "magnify", "magnifier", "zoom"]), ("사람", ["user", "person", "account", "user-alt", "user-2"]),
    ("설정", ["gear", "settings", "cog", "gear-six"]), ("카메라", ["camera", "photo-camera"]), ("알림", ["bell", "notifications", "notification"]),
    ("장바구니", ["cart", "shopping-cart", "cart-shopping", "basket", "shopping-cart-simple", "shopping-bag", "bag"]), ("메일", ["envelope", "mail", "email", "envelope-simple"]),
    ("전화", ["telephone", "phone", "call"]), ("달력", ["calendar", "calendar-event", "calendar-blank", "calendar-days"]), ("구름", ["cloud"]),
    ("자물쇠", ["lock", "lock-simple", "lock-closed"]), ("음악", ["music", "music-note", "music-notes", "musical-note", "music-tone", "music-2"]),
    ("위치", ["map-pin", "geo-alt", "location", "location-pin", "map-marker", "map-marker-alt", "location-dot", "pin", "map"]), ("이미지", ["image", "photo", "picture", "file-media"]),
    ("대화", ["chat", "chat-dots", "message", "comment", "chat-circle", "message-circle", "bubble", "comment-discussion", "chat-1"]), ("다운로드", ["download", "cloud-download", "arrow-download"]), ("체크", ["check", "checkmark"]),
]
WEATHER = [("맑음", "day-sunny"), ("구름", "cloudy"), ("비", "rain"), ("눈", "snow"), ("뇌우", "thunderstorm"), ("안개", "fog"), ("바람", "strong-wind"),
           ("맑은 밤", "night-clear"), ("우산", "umbrella"), ("온도계", "thermometer"), ("일출", "sunrise"), ("일몰", "sunset"), ("우박", "hail"),
           ("토네이도", "tornado"), ("태풍", "hurricane"), ("한파", "snowflake-cold"), ("빗방울", "raindrops"), ("번개", "lightning"), ("습도", "humidity"), ("보름달", "moon-full")]
MAT = [("집", "home"), ("하트", "favorite"), ("별", "star"), ("검색", "search"), ("사람", "person"), ("설정", "settings"), ("카메라", "photo_camera"),
       ("알림", "notifications"), ("장바구니", "shopping_cart"), ("메일", "mail"), ("전화", "call"), ("달력", "calendar_month"), ("구름", "cloud"),
       ("자물쇠", "lock"), ("음악", "music_note"), ("위치", "location_on"), ("이미지", "image"), ("대화", "chat"), ("다운로드", "download"), ("체크", "check")]


def css_icons(css, prefix):
    """아이콘 CSS → {이름: 코드포인트}. content:"\\f425" 와 Font Awesome 7의 --fa:"\\f015" 둘 다."""
    out = {}
    for sel, cp in re.findall(r"((?:\.[a-z0-9_-]+(?::{1,2}before)?\s*,?\s*)+)\{[^}]*?(?:content|--fa)\s*:\s*[\"']\\([0-9a-fA-F]{2,6})[\"']", css):
        for name in re.findall(r"\." + re.escape(prefix) + r"([a-z0-9_-]+)", sel):
            out.setdefault(name, int(cp, 16))
    return out


def pick(icons, concepts, suffixes=("", "-line", "-outline", "-alt", "-simple", "-o", "-1-line", "_24_regular", "_20_regular")):
    """이름 후보를 차례로 — 제작사마다 '-'/'_' 구분과 접미사(-line, _24_regular 등)가 달라 둘 다 시도"""
    got = []
    for label, names in concepts:
        hit = None
        for n in names:
            for base_ in (n, n.replace("-", "_")):
                for sfx in suffixes:
                    for cand in (base_ + sfx, base_ + sfx.replace("-", "_")):
                        if cand in icons: hit = cand; break
                    if hit: break
                if hit: break
            if hit: break
        if hit: got.append([chr(icons[hit]), label, hit])
    return got


# ---------- 제작사 공식 npm 아이콘 폰트 ----------
NPM = [
    dict(id="d-bootstrap-icons", name="Bootstrap Icons", pkg="bootstrap-icons", css="font/bootstrap-icons.min.css", prefix="bi-",
         files={400: "font/fonts/bootstrap-icons.woff2"}, lic="MIT", designer="Bootstrap 팀(The Bootstrap Authors)", page="https://icons.getbootstrap.com/",
         desc="부트스트랩 팀이 만든 범용 UI 아이콘. 16px 격자에 맞춘 단정한 선과 면이라 웹·앱 화면의 버튼·메뉴에 바로 어울립니다."),
    dict(id="d-tabler-icons", name="Tabler Icons", pkg="@tabler/icons-webfont", css="dist/tabler-icons.min.css", prefix="ti-",
         files={200: "dist/fonts/tabler-icons-200.woff2", 300: "dist/fonts/tabler-icons-300.woff2", 400: "dist/fonts/tabler-icons.woff2"}, lic="MIT",
         designer="Paweł Kuna(Tabler)", page="https://tabler.io/icons", desc="24px 격자·2px 선으로 통일한 대규모 선 아이콘. 선 굵기(200·300·400)를 골라 화면 밀도에 맞출 수 있습니다."),
    dict(id="d-phosphor", name="Phosphor Icons", pkg="@phosphor-icons/web", css="src/regular/style.css", prefix="ph-",
         files={100: "src/thin/Phosphor-Thin.woff2", 300: "src/light/Phosphor-Light.woff2", 400: "src/regular/Phosphor.woff2", 700: "src/bold/Phosphor-Bold.woff2"}, lic="MIT",
         designer="Helena Zhang, Tobias Fried", page="https://phosphoricons.com/", desc="둥근 끝처리의 부드러운 아이콘 가족. Thin부터 Bold까지 같은 모양을 굵기만 달리해 글자와 굵기를 맞추기 좋습니다."),
    dict(id="d-font-awesome", name="Font Awesome Free (Solid)", pkg="@fortawesome/fontawesome-free", css="css/all.min.css", prefix="fa-",
         files={900: "webfonts/fa-solid-900.woff2"}, lic="Font Awesome Free License", designer="Fonticons, Inc.", page="https://fontawesome.com/search?ic=free",
         desc="가장 널리 쓰이는 웹 아이콘 세트의 무료판 중 꽉 찬(Solid) 스타일. 굵고 또렷해 작은 크기의 버튼·배지에서도 잘 읽힙니다."),
    dict(id="d-mdi", name="Material Design Icons", pkg="@mdi/font", css="css/materialdesignicons.min.css", prefix="mdi-",
         files={400: "fonts/materialdesignicons-webfont.woff2"}, lic="Apache 2.0", designer="Pictogrammers", page="https://pictogrammers.com/library/mdi/",
         desc="머티리얼 디자인 규칙으로 커뮤니티가 7,000개 넘게 그린 아이콘 모음. 구글 기본 세트에 없는 기기·서비스·도구 아이콘이 많습니다."),
    dict(id="d-lucide", name="Lucide", pkg="lucide-static", css="font/lucide.css", prefix="icon-",
         files={400: "font/lucide.woff2"}, lic="ISC", designer="Lucide 커뮤니티(Feather 계승)", page="https://lucide.dev/",
         desc="Feather 아이콘을 이어받아 커뮤니티가 키운 선 아이콘. 가볍고 깔끔한 2px 선이라 미니멀한 화면에 잘 맞습니다."),
    dict(id="d-remixicon", name="Remix Icon", pkg="remixicon", css="fonts/remixicon.css", prefix="ri-",
         files={400: "fonts/remixicon.woff2"}, lic="Remix Icon License", designer="Remix Design", page="https://remixicon.com/",
         desc="선(line)·면(fill) 두 벌로 짝을 이룬 중립적인 아이콘. 같은 아이콘을 상태(선택·비선택)에 따라 바꿔 쓰기 좋습니다. 로고·브랜드 마크로는 쓸 수 없습니다."),
    dict(id="d-line-awesome", name="Line Awesome", pkg="line-awesome", css="dist/line-awesome/css/line-awesome.min.css", prefix="la-",
         files={900: "dist/line-awesome/fonts/la-solid-900.woff2"}, lic="MIT", designer="Icons8", page="https://icons8.com/line-awesome",
         desc="Font Awesome과 같은 이름 체계를 선(line) 스타일로 다시 그린 아이콘. 기존 Font Awesome 화면을 가볍게 바꾸고 싶을 때 맞습니다."),
    dict(id="d-boxicons", name="Boxicons", pkg="boxicons", css="css/boxicons.min.css", prefix="bx-",
         files={400: "fonts/boxicons.woff2"}, lic="MIT", designer="Atisa", page="https://boxicons.com/",
         desc="둥근 모서리의 단순한 선 아이콘. 친근한 인상이라 서비스 소개 페이지·카드 UI에 잘 어울립니다."),
    dict(id="d-typicons", name="Typicons", pkg="typicons.font", css="src/font/typicons.css", prefix="typcn-",
         files={400: "src/font/typicons.woff2"}, lic="OFL", designer="Stephen Hutchings", page="https://www.s-ings.com/typicons/",
         desc="2012년부터 이어진 개성 있는 아이콘 세트. 획 끝이 살짝 둥글고 면과 선이 섞여 있어 손맛 있는 화면에 어울립니다."),
]
NPM += [  # 2026-10-20 추가(저장소 라이선스 원문 확인)
    dict(id="d-eva-icons", name="Eva Icons", pkg="eva-icons", css="style/eva-icons.css", prefix="eva-",
         files={400: "style/fonts/Eva-Icons.woff2"}, lic="MIT", designer="Akveo", page="https://akveo.github.io/eva-icons/",
         desc="선(outline)·면(fill) 두 벌로 짝을 이룬 480여 개 아이콘. 모서리가 둥글고 획이 고른 편이라 대시보드·관리 화면에 잘 어울립니다."),
    dict(id="d-simple-line-icons", name="Simple Line Icons", pkg="simple-line-icons", css="css/simple-line-icons.css", prefix="icon-",
         files={400: "dist/fonts/Simple-Line-Icons.woff2"}, lic="MIT", designer="Sabbir Ahmed, Jamal Jama", page="https://simplelineicons.github.io/",
         desc="아주 가는 한 줄 선으로 그린 189개 아이콘. 여백이 많은 미니멀 포트폴리오·랜딩 페이지에 잘 맞습니다."),
    dict(id="d-fork-awesome", name="Fork Awesome", pkg="fork-awesome", css="css/fork-awesome.min.css", prefix="fa-",
         files={400: "fonts/forkawesome-webfont.woff2"}, lic="OFL", designer="Fork Awesome 커뮤니티", page="https://forkaweso.me/Fork-Awesome/",
         desc="Font Awesome 4.7을 이어받아 커뮤니티가 키운 아이콘 글꼴. 4.7과 같은 이름(fa-home)을 그대로 쓸 수 있습니다."),
    dict(id="d-open-iconic", name="Open Iconic", pkg="open-iconic", css="font/css/open-iconic-bootstrap.css", prefix="oi-",
         files={400: "font/fonts/open-iconic.woff"}, lic="OFL", designer="Waybury(Iconic)", page="https://github.com/iconic/open-iconic",
         desc="8px 격자에 맞춘 223개 소형 아이콘. 아주 작은 크기에서도 형태가 뭉개지지 않도록 단순하게 그렸습니다."),
    dict(id="d-coreui-icons", name="CoreUI Icons Free", pkg="@coreui/icons", css="css/free.css", prefix="cil-",
         files={400: "fonts/CoreUI-Icons-Free.woff2"}, lic="CoreUI Icons Free License", designer="creativeLabs(CoreUI)", page="https://coreui.io/icons/",
         desc="CoreUI 관리자 템플릿용 선 아이콘 무료판. 업무용 화면에 필요한 문서·차트·설정 아이콘이 고루 있습니다."),
    dict(id="d-pixelarticons", name="Pixelarticons", pkg="pixelarticons", css="fonts/pixelart-icons-font.css", prefix="pixelart-icons-font-",
         files={400: "fonts/pixelart-icons-font.woff2"}, lic="MIT", designer="Gerrit Halfmann", page="https://pixelarticons.com/",
         desc="24px 도트로 찍은 픽셀 아트 아이콘. 레트로 게임·8비트 콘셉트의 화면과 포스터에 어울립니다."),
    dict(id="d-mingcute", name="MingCute", pkg="mingcute_icon", css="font/Mingcute.css", prefix="mgc_",
         files={400: "font/MingCute.woff"}, lic="Apache 2.0", designer="MingCute Design", page="https://www.mingcute.com/", prefer={"집": "home_3_line", "설정": "settings_5_line"},
         desc="둥글고 귀여운 인상의 선·면 아이콘. 모바일 앱·소비자 서비스 화면에 부드럽게 어울립니다."),
    dict(id="d-codicons", name="Codicons", pkg="@vscode/codicons", css="dist/codicon.css", prefix="codicon-",
         files={400: "dist/codicon.ttf"}, lic="CC BY 4.0", designer="Microsoft(Visual Studio Code)", page="https://microsoft.github.io/vscode-codicons/",
         desc="VS Code 화면에 쓰이는 개발 도구 아이콘. 파일·브랜치·디버그·터미널처럼 개발 문서와 도구 화면에 필요한 기호가 많습니다. 쓸 때 출처 표시가 필요합니다."),
    dict(id="d-uiw-icons", name="uiw Icons", pkg="@uiw/icons", css="fonts/w-icon.css", prefix="w-icon-",
         files={400: "fonts/w-icon.woff2"}, lic="MIT", designer="uiw", page="https://uiwjs.github.io/icons/",
         desc="React 컴포넌트 모음 uiw의 기본 아이콘. 굵기가 일정한 면 아이콘이라 버튼·입력창 안에 넣기 좋습니다."),
]
GH = [  # npm에 공식 패키지가 없어 GitHub 공식 저장소(jsDelivr gh)를 쓰는 것
    dict(id="d-weather-icons", name="Weather Icons", gh="erikflowers/weather-icons@2.0.12", css="css/weather-icons.min.css", prefix="wi-",
         files={400: "font/weathericons-regular-webfont.woff2"}, lic="OFL", designer="Erik Flowers", page="https://erikflowers.github.io/weather-icons/",
         desc="날씨 표현만 220여 개 모은 아이콘 글꼴. 맑음·비·눈·바람·일출처럼 예보 화면에 필요한 기호가 한 벌로 갖춰져 있습니다.", concepts="weather"),
    dict(id="d-fluent-system-icons", name="Fluent System Icons", gh="microsoft/fluentui-system-icons@1.1.344", css="fonts/FluentSystemIcons-Regular.css", prefix="icon-ic_fluent_",
         files={400: "fonts/FluentSystemIcons-Regular.woff2"}, lic="MIT", designer="Microsoft", page="https://github.com/microsoft/fluentui-system-icons",
         desc="윈도우·오피스와 같은 마이크로소프트 Fluent 디자인 아이콘. 둥근 모서리와 일정한 선 굵기로 업무용 앱 화면에 잘 어울립니다."),
]

# ---------- Google Fonts ----------
GF_GLYPH = [  # (패밀리, 분류, 견본 [(글자, 이름)], 설명, 분위기)
    ("Noto Emoji", "이모지·기호", "😀😂🥰😎🤔😭👍👏🙏💪❤🔥⭐🎉🍕☕🌸🐱🚀🎵", "구글 Noto 프로젝트의 흑백(선) 이모지. 색이 없어 글자처럼 굵기(300~700)를 바꾸고 원하는 색을 입힐 수 있습니다.", ["단정한", "귀여운"]),
    ("Noto Color Emoji", "이모지·기호", "😀😂🥰😎🤔😭👍👏🙏💪❤🔥⭐🎉🍕☕🌸🐱🚀🎵", "안드로이드와 같은 구글 컬러 이모지. 운영체제와 상관없이 같은 모양의 이모지를 보여 줄 때 씁니다.", ["발랄한", "귀여운"]),
    ("Noto Sans Symbols", "이모지·기호", "⌘⌛⏏⎈⚙⚓⚔⚖⚛⚜☯☮☸♻♈♉♊♋⛵⛰⛪①②③ⒶⒷⒸ", "Noto의 기호 글꼴. 기술 기호(⌘⏏)·별자리·종교·원문자(①Ⓐ) 같은 유니코드 기호를 본문 글자와 어울리게 100~900 굵기로 담았습니다.", ["단정한"]),
    ("Noto Sans Symbols 2", "이모지·기호", "✂✈✉✌✍✎✓✔✗✘❤➔➜➤⚑⚐♻⚓⚡⛄⛅⛔⛺", "Noto의 두 번째 기호 글꼴. 딩벳(✂✈✉)·화살표·체크 표시처럼 문서와 표에 자주 쓰는 기호가 많습니다.", ["단정한"]),
    ("Noto Music", "이모지·기호", "𝄞𝄢𝄡♩♪♫♬♭♮♯𝄪𝄫𝅝𝅗𝅥𝅘𝅥𝅘𝅥𝅮𝅘𝅥𝅯𝄐𝄑𝄋𝄌", "악보 기호(유니코드 음악 기호 블록)를 담은 Noto 글꼴. 음자리표·음표·쉼표·셈여림 기호를 글자처럼 입력할 수 있습니다.", ["고전적"]),
]
GF_TYPE = [  # 글자를 입력하면 바코드·가림 막대·그래프로 바뀌는 글꼴: (패밀리, 분류, 견본 문장, 설명, 분위기)
    ("Libre Barcode 39 Text", "바코드", "*LETSUM-2026*", "Code 39 바코드를 글자로 입력하는 글꼴(아래에 사람이 읽는 글자 포함). 앞뒤에 *를 붙이면 스캐너로 읽힙니다.", ["단정한"]),
    ("Libre Barcode 39 Extended Text", "바코드", "*Letsum 2026*", "소문자·기호까지 넣을 수 있는 Code 39 확장판(글자 포함). 앞뒤에 *를 붙여 씁니다.", ["단정한"]),
    ("Libre Barcode 128 Text", "바코드", "LETSUM 2026", "Code 128 바코드 모양을 내는 글꼴(글자 포함). 실제로 스캔하려면 체크섬 인코딩 도구를 함께 써야 합니다.", ["단정한"]),
    ("Libre Barcode 39", "바코드", "*LETSUM-2026*", "Code 39 바코드만 그리는 글꼴(아래 글자 없음). 앞뒤에 *를 붙이면 스캐너로 읽힙니다.", ["단정한"]),
    ("Libre Barcode 39 Extended", "바코드", "*Letsum 2026*", "소문자·기호까지 넣을 수 있는 Code 39 확장판(아래 글자 없음).", ["단정한"]),
    ("Libre Barcode 128", "바코드", "LETSUM 2026", "Code 128 바코드 모양만 그리는 글꼴(아래 글자 없음). 실제 스캔용은 체크섬 인코딩 도구와 함께 씁니다.", ["단정한"]),
    ("Libre Barcode EAN13 Text", "바코드", "9791163030010", "상품 바코드(EAN-13) 글꼴. 숫자 12~13자리를 그대로 입력하면 바코드와 숫자가 함께 그려집니다.", ["단정한"]),
    ("Redacted", "장식·데이터", "Lorem ipsum dolor sit amet", "글자를 검은 막대로 가리는 와이어프레임용 글꼴. 시안에서 아직 정해지지 않은 문장 자리를 표시할 때 씁니다.", ["단정한"]),
    ("Redacted Script", "장식·데이터", "Lorem ipsum dolor sit amet", "글자를 손으로 휘갈긴 선처럼 가리는 시안용 글꼴. 손글씨 자리나 서명 자리를 표시할 때 씁니다.", ["따뜻한"]),
    ("Flow Block", "장식·데이터", "Letsum font preview", "글자를 둥근 막대 덩어리로 바꾸는 로딩·스켈레톤 화면용 글꼴.", ["단정한"]),
    ("Flow Circular", "장식·데이터", "Letsum font preview", "글자를 둥근 캡슐 모양으로 가리는 로딩 화면용 글꼴.", ["귀여운"]),
    ("Flow Rounded", "장식·데이터", "Letsum font preview", "글자 단어를 모서리 둥근 막대로 바꾸는 시안·로딩 화면용 글꼴.", ["단정한"]),
    ("Linefont", "장식·데이터", "0123456789876543210", "글자 대신 높이가 다른 선 조각을 그려 문장 안에 작은 꺾은선 그래프를 넣는 글꼴.", ["단정한"]),
    ("Wavefont", "장식·데이터", "abcdefghijklmnopqrstuvwxyz", "글자마다 높이가 다른 막대를 그려 음성 파형·막대그래프를 글자로 표현하는 글꼴.", ["단정한"]),
]
MATERIAL = [  # (패밀리, 방식, 설명)
    ("Material Symbols Outlined", "symbols", "구글 머티리얼 디자인의 최신 가변 아이콘(외곽선). 굵기·채움·크기를 축으로 조절합니다."),
    ("Material Symbols Rounded", "symbols", "머티리얼 심볼의 둥근 모서리판. 부드러운 인상의 앱 화면에 어울립니다."),
    ("Material Symbols Sharp", "symbols", "머티리얼 심볼의 각진 모서리판. 단단하고 정밀한 인상입니다."),
    ("Material Icons", "icons", "안드로이드·구글 서비스의 기본 아이콘(채움). 이름(home, search)을 입력하면 아이콘으로 바뀝니다."),
    ("Material Icons Outlined", "icons", "Material Icons의 외곽선판."),
    ("Material Icons Round", "icons", "Material Icons의 둥근 모서리판."),
    ("Material Icons Sharp", "icons", "Material Icons의 각진 모서리판."),
    ("Material Icons Two Tone", "icons", "Material Icons의 두 가지 톤(면을 옅게) 판."),
]


def faces(css):
    out = {}
    for body in re.findall(r"@font-face\s*\{([^}]*)\}", css):
        w = re.search(r"font-weight:\s*(\d+)", body); u = re.search(r"url\((https://[^)]+)\)", body)
        if w and u: out.setdefault(int(w.group(1)), u.group(1))
    return out


def cmap_of(url):
    from fontTools.ttLib import TTFont
    return set(TTFont(io.BytesIO(get(url))).getBestCmap())


def gf_meta():
    return {m["family"]: m for m in json.loads(get("https://fonts.google.com/metadata/fonts"))["familyMetadataList"]}


def npm_created(pkg):
    try: return json.loads(get("https://registry.npmjs.org/" + pkg.replace("/", "%2F")))["time"]["created"][:10]
    except Exception: return ""


def npm_ver(pkg): return json.loads(get("https://registry.npmjs.org/" + pkg.replace("/", "%2F") + "/latest"))["version"]


TAGS = {"아이콘": ["웹·앱 UI", "아이콘 글꼴"], "이모지·기호": ["유니코드", "문서·SNS"], "바코드": ["상품·물류", "라벨"], "장식·데이터": ["시안·와이어프레임", "데이터 표현"]}


def base(fid, name, cat, designer, holder, ws, urls, src, page, srcname, lic, desc, mood, icons, sample, typeable, nicons, glyphs):
    return {"id": fid, "name": name, "en": name, "family": f"'LS {fid}', sans-serif", "designer": designer, "holder": holder,
            "category": cat, "tags": TAGS.get(cat, []), "mood": mood, "weights": ws, "formats": sorted({u.split("?")[0].rsplit(".", 1)[-1].upper() if "." in u.split("/")[-1] else "WOFF2" for u in urls.values()}), "cov": 0, "glyphs": glyphs,
            "icons": icons, "sample": sample, "typeable": typeable, "nIcons": nicons, "variable": False,
            "webfont": {w: urls[w] for w in ws}, "webfontSrc": src, "dl": {"page": page, "srcName": srcname},
            "license": lic, "matrix": LIC[lic], "verified": TODAY, "status": "verified", "pair": "inter", "pop": 50, "added": TODAY, "desc": desc}


def main():
    old = load_existing(); out = []
    meta = gf_meta()
    # 1) Google Fonts 기호·이모지 — 견본 글자만 담은 공식 파일, 실제 글리프가 있는 것만 견본으로
    for fam, cat, chars, desc, mood in GF_GLYPH:
        m = meta.get(fam); ws = sorted({int(k) for k in m["fonts"] if k.isdigit()}) or [400]
        q = lambda t: "https://fonts.googleapis.com/css2?family=" + fam.replace(" ", "+") + ":wght@" + ";".join(map(str, ws)) + "&text=" + urllib.parse.quote(t) + "&display=swap"
        urls = faces(get(q(chars)).decode()); cm = cmap_of(urls[ws[0]] if ws[0] in urls else next(iter(urls.values())))
        keep = [c for c in chars if ord(c) in cm]
        urls = faces(get(q("".join(keep))).decode()); ws = [w for w in ws if w in urls]
        icons = [[c, unicodedata.name(c, "").title()] for c in keep]
        fid = "d-" + re.sub(r"[^a-z0-9]+", "-", fam.lower()).strip("-")
        e = base(fid, fam, cat, ", ".join(m.get("designers") or ["Google"]), "Google", ws, urls, "Google Fonts 공식 웹폰트(견본 글자만)",
                 "https://fonts.google.com/specimen/" + fam.replace(" ", "+"), "Google Fonts", "OFL", desc, mood, icons, "".join(keep), False, 0, "유니코드 " + ("이모지" if "Emoji" in fam else "기호"))
        if m.get("dateAdded"): e.update(released=m["dateAdded"], releasedSrc="Google Fonts 등록일", releasedUrl=e["dl"]["page"])
        e["pop"] = max(10, 99 - (m.get("popularity") or 999) // 25); out.append(e); print(fid, len(keep), "글자", ws)
    for fam, cat, text, desc, mood in GF_TYPE:
        m = meta.get(fam); ws = sorted({int(k) for k in m["fonts"] if k.isdigit()}) or [400]
        if len(ws) > 4: ws = [w for w in ws if w in (100, 400, 700, 1000)] or ws[:4]
        css = get("https://fonts.googleapis.com/css2?family=" + fam.replace(" ", "+") + ":wght@" + ";".join(map(str, ws)) + "&text=" + urllib.parse.quote(text) + "&display=swap").decode()
        urls = faces(css); ws = [w for w in ws if w in urls]
        fid = "d-" + re.sub(r"[^a-z0-9]+", "-", fam.lower()).strip("-")
        e = base(fid, fam, cat, ", ".join(m.get("designers") or ["Google"]), ", ".join(m.get("designers") or ["Google"]), ws, urls, "Google Fonts 공식 웹폰트(견본 글자만)",
                 "https://fonts.google.com/specimen/" + fam.replace(" ", "+"), "Google Fonts", "OFL", desc, mood, [[text, "입력 예"]], text, True, 0, "라틴 글자 입력 → " + cat)
        if m.get("dateAdded"): e.update(released=m["dateAdded"], releasedSrc="Google Fonts 등록일", releasedUrl=e["dl"]["page"])
        e["pop"] = max(10, 99 - (m.get("popularity") or 999) // 25); out.append(e); print(fid, ws)
    # 2) Material Icons·Symbols(구글, Apache 2.0) — 이름(ligature)으로 입력하는 아이콘
    names = sorted(n for _, n in MAT)
    for fam, kind, desc in MATERIAL:
        fq = fam.replace(" ", "+")
        if kind == "symbols":
            css = get(f"https://fonts.googleapis.com/css2?family={fq}:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names={','.join(names)}&display=block").decode()
            u = re.search(r"url\((https://[^)]+)\)", css).group(1); ws = [100, 200, 300, 400, 500, 600, 700]; urls = {w: u for w in ws}; var = True
        else:
            css = get(f"https://fonts.googleapis.com/icon?family={fq}").decode()
            u = re.search(r"url\((https://[^)]+)\)", css).group(1); ws = [400]; urls = {400: u}; var = False
        fid = "d-" + re.sub(r"[^a-z0-9]+", "-", fam.lower()).strip("-")
        e = base(fid, fam, "아이콘", "Google", "Google", ws, urls, "Google Fonts 공식 아이콘 웹폰트" + ("(견본 아이콘만)" if kind == "symbols" else ""),
                 "https://fonts.google.com/icons", "Google Fonts(Material)", "Apache 2.0", desc, ["단정한"], [[n, l] for l, n in MAT], " ".join(n for _, n in MAT), False, 0,
                 "아이콘 이름 입력(ligature)")
        e["variable"] = var; e["liga"] = True; e["pop"] = 90 if "Symbols Outlined" in fam or fam == "Material Icons" else 70; out.append(e); print(fid, ws)
    # 3) 제작사 공식 npm·GitHub 아이콘 폰트
    for c in NPM + GH:
        if "pkg" in c: ver = npm_ver(c["pkg"]); root = f"{JSD}{c['pkg']}@{ver}/"; created = npm_created(c["pkg"]); src = f"제작사 공식 npm 패키지({c['pkg']}@{ver})"
        else: root = f"https://cdn.jsdelivr.net/gh/{c['gh']}/"; created = ""; src = f"제작사 공식 GitHub 저장소({c['gh']})"
        icons = css_icons(get(root + c["css"]).decode("utf-8", "ignore"), c["prefix"])
        conc = [(l, [n]) for l, n in WEATHER] if c.get("concepts") == "weather" else CONCEPTS
        conc = [(l, [c["prefer"][l]] + n) if l in c.get("prefer", {}) else (l, n) for l, n in conc]  # 이름이 같아도 모양이 다른 경우(견본을 그려 보고 고름)
        got = pick(icons, conc)
        urls = {w: root + p for w, p in c["files"].items()}; ws = sorted(urls)
        e = base(c["id"], c["name"], "아이콘", c["designer"], c["designer"], ws, urls, src, c["page"], c["name"] + "(공식)", c["lic"], c["desc"], ["단정한"],
                 [[g[0], g[1], g[2]] for g in got], "".join(g[0] for g in got), False, len(icons), f"아이콘 {len(icons):,}개")
        if created: e.update(released=created, releasedSrc="npm 첫 공개일", releasedUrl="https://www.npmjs.com/package/" + c["pkg"])
        e["pop"] = 80; out.append(e); print(c["id"], len(icons), "개 · 견본", len(got), ws)
    for e in out:
        o = old.get(e["id"])
        if o: e["added"] = o.get("added", e["added"])
        if o and o.get("manual"):
            for k in ("desc", "tags", "mood", "category", "pair", "manual"):
                if k in o: e[k] = o[k]
    write(out)


def load_existing():
    if not os.path.exists(OUT): return {}
    code = "const fs=require('fs');const src=fs.readFileSync(process.argv[1],'utf8')+fs.readFileSync(process.argv[2],'utf8');const F=new Function('var window={};'+src+';return FONTS_DB')();console.log(JSON.stringify(F))"
    try: return {f["id"]: f for f in json.loads(subprocess.run(["node", "-e", code, os.path.join(ROOT, "html", "js", "data.js"), OUT], capture_output=True, text=True, check=True).stdout)}
    except Exception: return {}


def write(out):
    body = ",\n".join("  " + js(e) for e in out)
    hdr = ("// LETSUM 딩벳(기호·아이콘) 폰트 데이터 — tools/build_db_data.py가 제작사 공식 배포본(Google Fonts·공식 npm/GitHub)으로 생성(손으로 고친 항목은 manual: true).\n"
           "// /dingbat/ 페이지에서만 쓴다: data.js 다음에 불러오고, LS_LANG === \"db\"이면 FONTS를 이 목록으로 바꾼다.\n"
           "// icons: [글자(또는 아이콘 이름), 설명, 원래 이름] · sample: 카드에 보일 견본 · typeable: 입력한 글자가 바코드·막대로 바뀌는 글꼴 · liga: 이름을 입력하면 아이콘이 되는 글꼴\n")
    tail = ("\nObject.assign(LICENSE_INFO, " + js(LICENSE_INFO_DB) + ");\n"
            "if (typeof window !== \"undefined\" && window.LS_LANG === \"db\") FONTS.splice(0, FONTS.length, ...FONTS_DB);\n")
    with open(OUT, "w", encoding="utf-8") as fp: fp.write(hdr + "const FONTS_DB = [\n" + body + "\n];\n" + tail)
    print(f"→ {OUT} ({len(out)}종)")


if __name__ == "__main__":
    main()
