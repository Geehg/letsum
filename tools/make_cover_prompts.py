#!/usr/bin/env python3
"""필사독서 도서 표지 생성용 프롬프트(GPT 이미지) — A5 세로(1:1.414).

모든 권이 한 시리즈처럼 보이도록 판형·레이아웃·질감은 같고, 장면만 작품마다 다르다.
장면: 잘 알려진 작품은 대표 장면(MOTIF), 그 밖의 작품은 실제 본문 첫 문장을 근거로(지어내지 않음).
출력: docs/typing_cover_prompts.md(읽기용) · docs/typing_cover_prompts.csv(일괄 처리용)
사용: python3 tools/make_cover_prompts.py
"""
import colorsys, csv, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "html", "data", "typing")

MOTIF = {
    # 한국 — 추천
    "서시": "깊은 밤 언덕 위 한 사람의 뒷모습, 하늘 가득한 별과 그 사이를 스치는 바람결",
    "별 헤는 밤": "가을밤 언덕 위 풀밭, 무덤가의 파란 잔디와 하늘 가득 하나씩 빛나는 별",
    "자화상": "산모퉁이 외딴 우물을 들여다보는 사나이, 우물 속에 비친 달·구름·파란 바람",
    "쉽게 씌어진 시": "창밖에 밤비가 속살거리는 다다미 육조방, 등불 아래 원고지와 펜",
    "진달래꽃": "영변 약산 비탈에 흐드러진 진달래, 길 위에 뿌려진 꽃잎",
    "엄마야 누나야": "강변 금모래빛과 뒷문 밖 갈잎, 손잡은 아이 둘의 작은 뒷모습",
    "님의 침묵": "푸른 산빛을 깨치고 단풍나무 숲으로 난 작은 길, 길 끝으로 사라지는 사람",
    "광야": "까마득한 광야 위로 눈 내리는 하늘, 멀리 백마 탄 사람의 실루엣",
    "빼앗긴 들에도 봄은 오는가": "봄 신령이 지핀 듯 푸른 보리밭 사이 가르마 같은 논길을 걷는 사람",
    "향수": "넓은 벌 동쪽 끝으로 휘돌아 나가는 실개천, 얼룩배기 황소와 초가 지붕",
    "운수 좋은 날": "추적추적 비 내리는 경성 거리, 빈 인력거를 끄는 김첨지와 설렁탕 한 그릇",
    "메밀꽃 필 무렵": "달빛 아래 소금을 뿌린 듯 하얀 메밀꽃밭, 나귀를 끌고 가는 장돌뱅이들",
    "동백꽃": "알싸한 노란 동백꽃(생강나무꽃) 덤불, 수탉 두 마리의 닭싸움",
    "봄봄": "봄 들판의 밭둑, 키 작은 점순이를 사이에 둔 데릴사위와 장인의 실랑이",
    # 김유정
    "산골 나그네": "깊은 산골 외딴 주막에 밤길로 찾아든 낯선 여인, 희미한 호롱불",
    "총각과 맹꽁이": "여름밤 논두렁에서 맹꽁이가 우는 산골 밭, 들병이와 총각들",
    "소낙비": "산골 오두막 위로 쏟아지는 소낙비, 처마 밑에 선 여인",
    "금 따는 콩밭": "곡괭이로 파헤쳐 구덩이가 난 콩밭, 흙투성이 사내 둘",
    "노다지": "어두운 금광 굴 속 칸델라 불빛에 반짝이는 금줄",
    "만무방": "가을 달밤 산골의 누렇게 익은 논, 벼 이삭을 지키는 그림자",
    "땡볕": "한여름 땡볕 아래 병든 아내를 지게에 지고 경성 거리를 걷는 남편",
    "따라지": "사직공원이 내려다보이는 언덕 셋방 골목, 쪽대문",
    "두포전": "산골 옛이야기 속 힘센 아이와 산짐승",
    "홍길동전": "구름 위를 나는 홍길동, 도포 자락과 칼",
    "심청": "인당수 푸른 물결 위의 연꽃 한 송이",
    # 현진건
    "빈처": "가난한 신혼 단칸방, 등불 아래 바느질하는 아내와 책상 앞 남편",
    "술 권하는 사회": "깊은 밤 호롱불 아래 남편을 기다리는 아내, 비틀거리는 그림자",
    "B사감과 러브레터": "여학교 기숙사 한밤, 연애편지를 들고 혼자 연기하는 사감의 그림자",
    "고향": "만주에서 돌아오는 기차 안, 낡은 옷의 사내와 차창 밖 고향 들판",
    "무영탑": "불국사 석가탑과 그림자가 비치지 않는 연못 영지, 탑을 기다리는 아사녀",
    "할머니의 죽음": "시골 한옥 안방, 병풍과 약사발, 모여 앉은 가족의 그림자",
    "선화공주": "서동요가 퍼지는 신라 서라벌 골목, 공주와 마를 캐는 소년",
    "흑치상지": "백제 부흥군 장수가 선 산성과 깃발",
    "적도": "1920년대 경성 밤거리와 붉은 등불",
    # 이효석
    "돈": "돼지우리 앞 소년과 장날 길",
    "산": "깊은 산 나무들 사이 낙엽 위에 누운 머슴, 나무와 하나 된 삶",
    "들": "봄 들판을 걷는 사람과 개, 바람에 눕는 풀",
    "분녀": "달밤 시골 방앗간 앞에 선 처녀",
    "화분": "꽃가루 날리는 푸른 집 정원",
    "벽공무한": "하얼빈의 푸른 하늘과 러시아풍 건물, 바이올린",
    "하얼빈": "하얼빈 키타이스카야 거리와 러시아풍 둥근 지붕",
    "도시와 유령": "밤 경성 공터 다리 밑에 떠도는 도깨비불",
    "낙엽기": "늦가을 정원 낙엽 더미와 연기",
    "석류": "붉게 벌어진 석류 한 알",
    "수탉": "볏이 찢긴 수탉과 시골 마당",
    "해바라기": "해를 향한 커다란 해바라기 한 송이",
    "장미 병들다": "시든 장미 한 송이가 꽂힌 유리병",
    "노령근해": "블라디보스토크로 가는 기선의 갑판과 차가운 바다",
    # 나도향
    "벙어리 삼룡이": "불타는 기와집 지붕 위에서 아씨를 안고 있는 하인 삼룡",
    "물레방아": "개울가 물레방앗간, 돌아가는 물레바퀴와 달빛",
    "뽕": "누에 치는 뽕밭, 뽕잎을 따는 여인의 손",
    "행랑자식": "대갓집 행랑채 마당을 쓰는 소년",
    "여이발사": "1920년대 이발소의 거울과 가위",
    # 최서해
    "탈출기": "간도 눈 덮인 초막, 대구를 줍는 아내와 편지를 쓰는 사내",
    "홍염": "눈 덮인 만주 마을, 지주의 집을 삼키는 붉은 불길",
    "박돌의 죽음": "가난한 오두막 앞 우는 어머니와 아이",
    "큰물 진 뒤": "홍수가 쓸고 간 마을과 무너진 초가",
    "기아와 살륙": "눈보라 치는 간도 벌판의 초막",
    # 이상
    "날개": "정오 사이렌이 울리는 경성 백화점 옥상, 겨드랑이에 돋으려는 날개",
    "봉별기": "온천 마을 여관의 장지문과 기생 금홍의 실루엣",
    "종생기": "흰 원고지 위에 놓인 만년필과 담배 연기",
    "지주회시": "천장 구석의 거미줄과 거미 두 마리",
    "실화": "도쿄 밤거리의 카페와 안개",
    "동해": "바닷가 모래사장과 흰 파도",
    "황소와 도깨비": "산길에서 황소 배 속으로 들어간 작은 도깨비",
    # 김동인
    "감자": "평양 칠성문 밖 빈민굴과 가을 감자밭",
    "배따라기": "대동강 위 배따라기 노래가 들리는 뱃전과 바다",
    "광염 소나타": "불타는 집을 배경으로 피아노 앞에 앉은 음악가",
    "붉은 산": "만주 벌판 끝의 붉은 산과 쓰러진 사내 '삵'",
    "발가락이 닮았다": "아기 발과 어른 발을 나란히 비교하는 두 손",
    "광화사": "인왕산 계곡 초막에서 눈먼 처녀를 그리는 늙은 화공",
    "운현궁의 봄": "운현궁 처마에 핀 봄꽃과 흥선대원군의 뒷모습",
    "젊은 그들": "조선 말 활빈당 젊은이들과 달밤 성곽",
    "대수양": "왕좌를 바라보는 수양대군의 그림자와 궁궐",
    "을지문덕": "살수 강가에 선 고구려 장수와 깃발",
    "견훤": "후백제 왕성과 왕관을 쓴 장수",
    "서라벌": "신라 서라벌 첨성대와 기와집",
    "태형": "한여름 비좁은 감방의 창살과 땀",
    "대동강은 속삭인다": "봄날 대동강 버드나무와 능라도",
    "약한 자의 슬픔": "1910년대 양장 여학생의 뒷모습과 비 오는 거리",
    "김연실전": "신여성의 단발과 양장, 경성 거리",
    "아편전쟁": "청나라 항구의 범선과 대포",
    "왕부의 낙조": "고려 궁궐 위로 지는 해",
    "배회": "공장 굴뚝이 선 거리를 걷는 청년",
    # 채만식
    "태평천하": "1930년대 서울 거리, 인력거에 탄 갓 쓴 윤직원 영감",
    "탁류": "군산 금강 하구의 흐린 물결과 미두장 거리",
    "레디메이드 인생": "종로 거리를 걷는 양복 입은 실직 지식인",
    "치숙": "셋방에 누운 지식인 아저씨와 조카",
    "미스터 방": "해방 직후 서울, 미군 지프와 통역",
    "논이야기": "해방 무렵 논두렁에 선 늙은 농부",
    "허생전": "남산 아래 오두막에서 책 읽는 허생과 장사 배",
    "인형의 집을 나와서": "집을 나와 경성 거리를 걷는 신여성 노라",
    # 이광수
    "무정": "1910년대 경성, 영어 교사와 증기기관차가 달리는 철로",
    "흙": "살여울 마을의 논밭과 흙 묻은 손",
    "유정": "시베리아 바이칼 호수의 눈보라와 외로운 사내",
    "단종애사": "청령포 강물에 둘러싸인 소나무 숲과 어린 왕",
    "마의태자": "베옷을 입고 금강산으로 들어가는 신라 태자",
    "이순신": "남해 바다 위의 거북선과 학익진",
    "원효대사": "달밤 동굴의 해골 물그릇과 승려",
    "재생": "1920년대 경성 다방과 엇갈린 연인",
    "사랑의 동명왕": "활을 든 고구려 동명왕과 말",
    "이차돈의 사": "신라 궁궐 앞, 흰 피가 솟는 순교 장면을 상징하는 흰 꽃잎",
    "세조대왕": "경복궁 근정전과 곤룡포",
    "그 여자의 일생": "한 여인의 일생을 상징하는 계절 네 개의 창",
    "개척자": "실험실의 유리 플라스크와 젊은 화학자",
    "어린 벗에게": "망망한 바다 위 배와 편지",
    "소년의 비애": "시골 강가에 앉은 소년",
    "일설 춘향전": "광한루 그네 타는 춘향과 이몽룡",
    # 심훈·강경애·조명희 외
    "상록수": "바닷가 농촌 마을의 상록수 아래 야학, 청년 남녀",
    "직녀성": "밤하늘 직녀성과 베틀",
    "영원의 미소": "1930년대 경성 거리의 젊은 연인",
    "인간문제": "원소 연못이 있는 시골 마을과 인천 방직 공장 굴뚝",
    "지하촌": "가난한 산촌 오두막 앞의 아이들",
    "소금": "간도 산길을 소금 자루를 이고 넘는 여인",
    "어머니와 딸": "등잔 아래 어머니와 딸",
    "낙동강": "낙동강 나룻배와 갈대",
    "꺼래이": "시베리아 국경 눈길을 걷는 조선 여인과 가족",
    "적빈": "빈 쌀독과 가난한 부엌",
    "은세계": "눈 덮인 강원도 산골 마을",
    "귀의 성": "비 오는 밤 오래된 기와집",
    "공진회": "1915년 경복궁 조선물산공진회의 깃발과 인파",
    "구마검": "무당굿의 칼과 방울",
    # 영어
    "Pride and Prejudice": "Regency-era English country ballroom, a proud gentleman and a spirited young woman exchanging glances",
    "Sense and Sensibility": "two sisters walking on a misty Devonshire hill, one composed, one windswept",
    "Emma": "an English village garden at Highbury, a young matchmaker arranging a bouquet",
    "Persuasion": "the stone Cobb at Lyme Regis with the sea, a letter in the wind",
    "Alice's Adventures in Wonderland": "a girl following a white rabbit with a pocket watch down a rabbit-hole among falling teacups and playing cards",
    "Through the Looking-Glass": "a girl stepping through a mirror onto a giant chessboard landscape",
    "The Adventures of Sherlock Holmes": "foggy Baker Street gaslight, silhouette with deerstalker cap and pipe",
    "The Hound of the Baskervilles": "a moonlit moor with a looming spectral hound and a lone manor",
    "A Study in Scarlet": "a dim London room with the word written on the wall hinted only as a red streak, a magnifying glass",
    "Jane Eyre": "a governess in grey walking toward the gothic Thornfield Hall at dusk",
    "Wuthering Heights": "a wind-bent tree on wild Yorkshire moors beside a dark farmhouse",
    "Frankenstein": "a laboratory under a stormy sky with lightning and an arctic ice field",
    "Dracula": "a Carpathian castle on a crag under a full moon, bats and a lone carriage",
    "A Christmas Carol": "a snowy Victorian London street at night, a miser with a candle and a ghostly figure",
    "A Tale of Two Cities": "London and Paris split by the Channel, a guillotine silhouette and a knitting needle",
    "Great Expectations": "foggy marshes with a convict's iron, and a decaying wedding cake with stopped clocks",
    "The Adventures of Tom Sawyer": "a boy whitewashing a fence by the Mississippi, a straw hat",
    "Adventures of Huckleberry Finn": "a raft drifting down the Mississippi at dawn",
    "The Picture of Dorian Gray": "an ornate gilt frame with a veiled portrait in an attic",
    "The Happy Prince and Other Tales": "a golden prince statue on a column with a swallow on its shoulder, winter town",
    "The Great Gatsby": "a green light at the end of a dock across a bay, 1920s mansion with a party",
    "Anne of Green Gables": "a red-haired girl in a straw hat before a green-gabled farmhouse with cherry blossoms",
    "Little Women": "four sisters around a fireplace reading letters in a New England parlor",
    "Peter Pan": "a boy and children flying past Big Ben toward a second star to the right",
    "Treasure Island": "a treasure map, a parrot and a pirate ship near a jungle island",
    "Strange Case of Dr Jekyll and Mr Hyde": "a gaslit London door with one silhouette splitting into two",
    "The Wonderful Wizard of Oz": "a yellow brick road leading to an emerald city, silver shoes",
    "The Secret Garden": "an ivy-covered wall with a hidden door and a robin, roses inside",
    "The Call of the Wild": "a husky-wolf dog howling under the northern lights in the Yukon snow",
    "The Jungle Book": "a boy with a wolf, bear and panther in an Indian jungle at night",
    "Moby-Dick": "a white whale breaching beside a small whaleboat on a wild sea",
    "The Scarlet Letter": "a Puritan woman with an embroidered red letter on her breast, a scaffold in Boston",
    "The Time Machine": "a brass Victorian time machine in a misty far-future landscape",
    "The War of the Worlds": "tripod machines striding over the English countryside with red weed",
    "Dubliners": "a snowy Dublin street with gaslights and a quiet window",
    "The Four Million": "a 1900s New York street of brownstones and shop windows, a comb and a watch chain",
    "Heart of Darkness": "a small steamboat on a dark winding river under dense jungle",
    "The Yellow Wallpaper": "a room with peeling patterned yellow wallpaper and a barred window",
    "Shakespeare's Sonnets": "a quill, a rose and a summer's day sky",
    "Poems, Three Series": "a white dress, a bee on a flower and a garden window in Amherst",
    "The Prophet": "a robed figure on a hill above a harbor watching a ship arrive",
    "Grimms' Fairy Tales": "a dark German forest with a gingerbread house, a frog prince and a golden ball",
    "Andersen's Fairy Tales": "a little mermaid, a tin soldier and a snow queen's sleigh",
    "Aesop's Fables": "a tortoise and a hare racing, a fox looking at grapes",
    "Sonnet 18": "a sunlit summer meadow with a quill and a rose",
    "The Gift of the Magi": "a tortoiseshell comb set and a pocket watch chain on a Christmas table",
    "오늘의 작은 문장": "아침 햇살이 건너는 책상 위의 펼친 책과 작은 그림자",
    "The Quiet Page": "a quiet desk by a window with an open book and a cup of tea",
}
POETS = {
    "김소월": "진달래꽃·산유화·엄마야 누나야·초혼의 세계 — 산에 피는 꽃과 강변의 금모래빛",
    "윤동주": "서시·별 헤는 밤·자화상의 세계 — 별 가득한 밤하늘과 외딴 우물",
    "한용운": "님의 침묵·알 수 없어요·나룻배와 행인의 세계 — 단풍 숲길과 강의 나룻배",
    "이육사": "광야·청포도·절정의 세계 — 청포도가 익어 가는 칠월과 눈 내리는 광야",
    "이상화": "빼앗긴 들에도 봄은 오는가·나의 침실로의 세계 — 봄 들판의 논길",
    "정지용": "향수·유리창·바다의 세계 — 얼룩배기 황소, 실개천, 차가운 유리창",
    "김영랑": "모란이 피기까지는·돌담에 속삭이는 햇발의 세계 — 붉은 모란과 남도의 돌담",
    "박용철": "떠나가는 배의 세계 — 항구를 떠나는 배",
    "이장희": "봄은 고양이로다의 세계 — 봄볕 속 고양이의 눈과 털",
    "오장환": "성벽·고향 앞에서의 세계 — 무너진 성벽과 고향 마을",
    "임화": "우리 오빠와 화로·네거리의 순이의 세계 — 깨진 화로와 종로 네거리",
    "윤곤강": "동물 시집·피리의 세계 — 나비와 피리",
    "김상용": "남으로 창을 내겠소의 세계 — 남쪽으로 난 창과 밭",
    "노자영": "처녀의 화환의 세계 — 장미 화환",
    "심훈": "그날이 오면의 세계 — 종로 인경(종)과 새벽 하늘",
    "이상": "거울·꽃나무의 세계 — 거울 속 왼손잡이와 꽃나무 한 그루",
    "나도향": "청춘의 서정 — 별과 편지",
    "강경애": "간도의 서정 — 두만강과 산딸기",
    "홍사용": "나는 왕이로소이다의 세계 — 눈물의 왕관",
}
STYLE = {
    "소설": "1910~40년대 조선·경성의 시대감을 살린 목판화·리노컷 풍 일러스트, 굵고 단단한 선, 인물은 실루엣이나 뒷모습 위주",
    "역사": "삼국·고려·조선 시대 장면을 목판화 풍으로, 단청 색은 절제",
    "시": "여백이 넓은 미니멀 구성, 붓 터치 한두 획과 상징 사물 하나, 시집 같은 정적",
    "수필": "작가의 책상·창가 정물을 담백한 선화로, 차분하고 여백 많은 구성",
    "동화": "따뜻한 그림책 일러스트, 둥근 형태와 아이 눈높이, 손그림 질감",
    "en-소설": "vintage paperback cover illustration, linocut and stencil look, period-accurate details",
    "en-동화": "classic storybook illustration with warm hand-drawn texture",
    "en-시": "minimal poetic composition with generous negative space and a single symbolic object",
}
HIST = {"무영탑", "흑치상지", "선화공주", "운현궁의 봄", "젊은 그들", "대수양", "을지문덕", "견훤", "서라벌", "왕부의 낙조", "아편전쟁", "남경조약",
        "단종애사", "마의태자", "이순신", "원효대사", "사랑의 동명왕", "이차돈의 사", "세조대왕", "일설 춘향전", "허생전", "홍길동전", "심청", "두포전"}


def color_name(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    hue = hh * 360
    base = ("붉은" if hue < 15 or hue >= 345 else "주황" if hue < 40 else "황토" if hue < 60 else "올리브" if hue < 90 else "초록" if hue < 160
            else "청록" if hue < 200 else "남색" if hue < 250 else "보라" if hue < 290 else "자줏빛" if hue < 330 else "장밋빛")
    tone = "짙은 " if l < 0.3 else "차분한 " if l < 0.55 else "옅은 "
    if s < 0.12: base = "회색"
    return f"{tone}{base}({h})"


def josa(w, a, b):
    """받침 있으면 a(을·과), 없으면 b(를·와)."""
    c = ord(w.strip()[-1]) if w.strip() else 0
    return a if 0xAC00 <= c <= 0xD7A3 and (c - 0xAC00) % 28 else b if 0xAC00 <= c <= 0xD7A3 else a + "(" + b + ")"


def first_sentence(j):
    x = (j.get("parts") or [{"x": j.get("text", "")}])[0]["x"]
    x = re.sub(r"\s+", " ", x).strip()
    m = re.match(r"(.{12,110}?[.?!。」”\"])(\s|$)", x)
    s = m.group(1) if m else x[:90]
    return s.replace('"', "'")


def prompt(b, j):
    t, a, cat, en = b["title"], b["author"], b.get("cat") or ("시" if b.get("poem") else "소설"), b.get("lang") == "en"
    own = a == "필사독서 예문"
    if own: a = "LETSUM 필사독서"
    if en:
        key = "en-" + ("시" if cat == "시" else "동화" if cat == "동화" else "소설")
        if own: STYLE["own"] = "modern minimal illustration with soft morning light and still life"; key = "own"
        scene = MOTIF.get(t) or f"a single symbolic scene drawn from the opening line: '{first_sentence(j)}'"
        return (f"Book cover illustration, A5 portrait ratio 1:1.414 (e.g. 1240×1754 px). Title: \"{t}\" — Author: {a}. "
                f"Part of one consistent classic series: same layout on every volume. Scene: {scene}. Style: {STYLE[key]}. "
                f"Colors: dominant {b.get('color')} with an ivory paper tone and one small accent color; flat color areas with no gradients, "
                f"risograph print texture with subtle paper grain. Layout: keep the top quarter as a calm solid band and set the title \"{t}\" there "
                f"in a large, clean serif typeface spelled exactly as written, with \"{a}\" small beneath it; illustration fills the lower three quarters; 6% margin on all sides. "
                f"Do not add any other text, logos, watermarks, publisher marks, photographic or 3D rendering.")
    if t.endswith(" 시 모음"): scene = POETS.get(a, f"{a} 시의 서정") + "을 하나의 상징적 장면으로"
    elif t.endswith(" 수필 모음"): scene = f"{a}의 책상과 창가 — 원고지, 펜, 계절이 보이는 창"
    elif t.endswith("동화·동요 모음"): scene = "옛날이야기를 듣는 아이들과 동물 친구들, 반짝이는 별"
    else: scene = MOTIF.get(t) or MOTIF.get(re.sub(r"\s*\(.*\)$", "", t)) or f"제목 「{t}」{josa(t, '과', '와')} 작품의 첫 문장 「{first_sentence(j)}」에서 떠오르는 장면 하나를 상징적으로"
    style = "현대적인 미니멀 일러스트, 부드러운 아침빛과 정물" if own else STYLE["역사" if t in HIST else "시" if t.endswith("시 모음") or cat == "시" else "수필" if cat == "수필" else "동화" if cat == "동화" else "소설"]
    return (f"책 표지 일러스트, A5 세로 비율 1:1.414(예: 1240×1754px). 제목 「{t}」, 지은이 {a}. "
            f"모든 권이 같은 레이아웃을 쓰는 {'필사독서 시리즈' if own else '한국 근대문학 고전 시리즈'}의 한 권. 장면: {scene}. 스타일: {style}. "
            f"색: 주조색 {color_name(b.get('color', '#444444'))} + 아이보리 종이색 + 작은 포인트 1색, 그라데이션 없는 평면 색면, 리소그래프 인쇄 질감과 은은한 종이 결. "
            f"레이아웃: 위쪽 1/4은 차분한 단색 띠로 비우고 그 안에 제목 '{t}'{josa(t, '을', '를')} 크고 또렷한 한글 명조체로 글자 그대로 정확히 쓰고, 그 아래 작게 '{a}'. "
            f"아래 3/4에 일러스트, 사방 여백 6%. 제목·지은이 외의 글자, 로고, 워터마크, 출판사 표시, 사진·3D 질감은 넣지 말 것.")


def main():
    idx = json.load(open(os.path.join(D, "index.json"), encoding="utf-8"))
    seen, books = set(), []
    for th in idx["themes"]:
        for b in th["books"]:
            if b["id"] not in seen: seen.add(b["id"]); books.append((th["title"], b))
    for b in idx.get("library", []):
        if b["id"] not in seen: seen.add(b["id"]); books.append(("전체 서가", b))
    rows = []
    for grp, b in books:
        j = json.load(open(os.path.join(D, b["id"] + ".json"), encoding="utf-8"))
        rows.append({"id": b["id"], "file": b["id"] + ".png", "group": grp, "title": b["title"], "author": b["author"],
                     "cat": ("English " if b.get("lang") == "en" else "") + (b.get("cat") or ("시" if b.get("poem") else "소설")),
                     "scene": "대표 장면" if b["title"] in MOTIF or b["title"].endswith("모음") else "첫 문장 근거", "prompt": prompt(b, j)})
    with open(os.path.join(ROOT, "docs", "typing_cover_prompts.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    md = ["# 필사독서 표지 생성 프롬프트 (A5 세로 1:1.414)", "",
          f"총 {len(rows)}권 · 대표 장면 {sum(r['scene'] == '대표 장면' for r in rows)}권 · 첫 문장 근거 {sum(r['scene'] == '첫 문장 근거' for r in rows)}권", "",
          "- 모든 권이 한 시리즈로 보이도록 판형·레이아웃(위 1/4 제목 띠, 아래 3/4 그림)·질감(평면 색면, 리소그래프)은 같고 장면만 다릅니다.",
          "- 주조색은 사이트 서가의 표지 색과 같게 맞췄습니다.",
          "- 한글 제목이 깨지면 프롬프트 끝에 다음 문장을 붙여 글자 없는 그림만 만든 뒤 제목은 따로 얹으세요: `제목·지은이 글자는 넣지 말고 위쪽 1/4 띠를 비워 둘 것.`",
          "- 이미지는 `파일명` 열의 이름(<id>.png)으로 저장해 주시면 사이트 표지에 바로 연결할 수 있습니다.", ""]
    grp = None
    for r in rows:
        if r["group"] != grp: grp = r["group"]; md += [f"## {grp}", ""]
        md += [f"### {r['title']} — {r['author']}", f"`{r['file']}` · {r['cat']} · {r['scene']}", "", "```", r["prompt"], "```", ""]
    open(os.path.join(ROOT, "docs", "typing_cover_prompts.md"), "w", encoding="utf-8").write("\n".join(md))
    print(len(rows), "권")


if __name__ == "__main__":
    main()
