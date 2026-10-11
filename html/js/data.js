// LETSUM 데모 데이터
// 전부 실제로 존재하는 OFL(오픈 폰트 라이선스) 한글 폰트이며, 미리보기는 Google Fonts 웹폰트로 실제 렌더링됩니다.
// 라이선스 매트릭스 값: ok(사용 가능) / no(금지) / cond(조건부)
const LICENSE_CATS = [
  { key: "print",   label: "인쇄",     desc: "브로슈어, 포스터, 책, 잡지 및 출판용 인쇄물 등" },
  { key: "web",     label: "웹사이트", desc: "웹페이지, 광고 배너, 메일, E-브로슈어 등" },
  { key: "video",   label: "영상",     desc: "유튜브, CF, 상업영화, 영상 자막, 크레딧 등" },
  { key: "embed",   label: "임베딩",   desc: "웹사이트 및 프로그램 서버 내 폰트 탑재, E-book 제작" },
  { key: "bici",    label: "BI/CI",    desc: "회사명, 브랜드명, 상품명, 로고, 마크, 슬로건 등" },
  { key: "package", label: "포장지",   desc: "판매용 상품의 패키지" },
  { key: "ofl",     label: "OFL",      desc: "폰트 파일의 수정·복제·배포 가능 여부 (유료 판매는 금지)" },
];

const OFL_ALL_OK = { print: "ok", web: "ok", video: "ok", embed: "ok", bici: "ok", package: "ok", ofl: "ok" };

// 한글 폰트와 짝지을 라틴 폰트 (한글 폰트의 영문·숫자가 약할 때 조합) — Google Fonts
const LATIN_PAIRS = [
  { id: "inter",   name: "Inter",            family: "'Inter', sans-serif",            note: "중립적인 UI 산세리프" },
  { id: "grotesk", name: "Space Grotesk",    family: "'Space Grotesk', sans-serif",    note: "개성 있는 제목용 산세리프" },
  { id: "playfair",name: "Playfair Display", family: "'Playfair Display', serif",      note: "고전적인 세리프" },
  { id: "plexmono",name: "IBM Plex Mono",    family: "'IBM Plex Mono', monospace",     note: "코드·숫자 표" },
];

// 분위기 태그 (Google Fonts의 'Feeling' 필터에 해당)
const MOODS = ["단정한", "차분한", "따뜻한", "세련된", "고전적", "발랄한", "귀여운", "강렬한"];

// 글자 범위 — cov: 한글 완성형 수. 옛한글·한자는 브라우저에서 자동 검출
const FONTS = [
  { id: "noto-sans-kr", name: "본고딕", en: "Noto Sans KR", family: "'Noto Sans KR', sans-serif",
    designer: "Google · Adobe", holder: "Google LLC", category: "고딕",
    tags: ["본문", "UI", "깔끔한"], mood: ["단정한", "세련된"], weights: [100,300,400,500,700,900], formats: ["OTF","TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/noto-sans-kr/noto-sans-kr.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-11", status: "verified",
    pair: "inter", pop: 98, added: "2026-09-02",
    desc: "구글과 어도비가 함께 만든 본고딕. 화면과 인쇄 모두에서 가장 무난한 기본 고딕으로, 긴 본문부터 UI까지 폭넓게 쓰입니다." },
  { id: "noto-serif-kr", name: "본명조", en: "Noto Serif KR", family: "'Noto Serif KR', serif",
    designer: "Google · Adobe", holder: "Google LLC", category: "명조",
    tags: ["본문", "책", "격식"], mood: ["차분한", "고전적"], weights: [200,300,400,600,700,900], formats: ["OTF","TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/noto-serif-kr/noto-serif-kr.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-11", status: "verified",
    pair: "playfair", pop: 95, added: "2026-09-02",
    desc: "책 본문에 바로 쓸 수 있는 무료 명조. 굵기 단계가 촘촘해 제목과 본문을 한 가족으로 조판하기 좋습니다." },
  { id: "ibm-plex-sans-kr", name: "IBM Plex Sans KR", en: "IBM Plex Sans KR", family: "'IBM Plex Sans KR', sans-serif",
    designer: "IBM", holder: "IBM Corp.", category: "고딕",
    tags: ["기업", "문서", "테크"], mood: ["단정한", "세련된"], weights: [100,200,300,400,500,600,700], formats: ["OTF","TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/ibm-plex-sans-kr/ibm-plex-sans-kr.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-10", status: "verified",
    pair: "plexmono", pop: 82, added: "2026-09-05",
    desc: "IBM의 기업 아이덴티티 폰트. 중립적이고 기술적인 인상으로 제안서·기술 문서에 잘 어울립니다." },
  { id: "gowun-dodum", name: "고운돋움", en: "Gowun Dodum", family: "'Gowun Dodum', sans-serif",
    designer: "류양희", holder: "류양희", category: "고딕",
    tags: ["부드러운", "동글동글", "본문"], mood: ["따뜻한", "단정한"], weights: [400], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/gowun-dodum/gowun-dodum.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-10", status: "verified",
    pair: "inter", pop: 88, added: "2026-09-08",
    desc: "모서리가 둥글게 다듬어진 돋움체. 딱딱하지 않은 본문용 고딕을 찾을 때 좋은 선택입니다." },
  { id: "gowun-batang", name: "고운바탕", en: "Gowun Batang", family: "'Gowun Batang', serif",
    designer: "류양희", holder: "류양희", category: "명조",
    tags: ["에세이", "소설", "차분한"], mood: ["따뜻한", "차분한"], weights: [400,700], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/gowun-batang/gowun-batang.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-09", status: "verified",
    pair: "playfair", pop: 86, added: "2026-09-08",
    desc: "손글씨의 온기가 살짝 남은 바탕체. 에세이와 소설 본문에서 편안하게 읽힙니다." },
  { id: "hahmlet", name: "함렛", en: "Hahmlet", family: "'Hahmlet', serif",
    designer: "김재희 외", holder: "Hahmlet Contributors", category: "명조",
    tags: ["제목", "클래식", "디스플레이"], mood: ["고전적", "강렬한"], weights: [100,200,300,400,500,600,700,800,900], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/hahmlet/hahmlet.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-09", status: "verified",
    pair: "playfair", pop: 74, added: "2026-09-12",
    desc: "베트남 문자까지 지원하는 세리프. 클래식한 제목용으로 표지·포스터에서 존재감이 있습니다." },
  { id: "jua", name: "주아체", en: "Jua", family: "'Jua', sans-serif",
    designer: "양희재", holder: "양희재", category: "디스플레이",
    tags: ["썸네일", "둥근", "강조"], mood: ["발랄한", "귀여운"], weights: [400], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/jua/jua.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-08", status: "verified",
    pair: "grotesk", pop: 93, added: "2026-09-15",
    desc: "붓으로 쓴 듯 통통한 글자. 유튜브 썸네일과 카드뉴스 제목의 단골 폰트입니다." },
  { id: "do-hyeon", name: "도현체", en: "Do Hyeon", family: "'Do Hyeon', sans-serif",
    designer: "폰트랩", holder: "폰트랩", category: "디스플레이",
    tags: ["제목", "시원한", "포스터"], mood: ["강렬한", "세련된"], weights: [400], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/do-hyeon/do-hyeon.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-08", status: "verified",
    pair: "grotesk", pop: 85, added: "2026-09-15",
    desc: "세로로 긴 프로포션의 시원한 제목체. 포스터 헤드라인에서 공간을 적게 차지합니다." },
  { id: "black-han-sans", name: "검은고딕", en: "Black Han Sans", family: "'Black Han Sans', sans-serif",
    designer: "지해수", holder: "지해수", category: "디스플레이",
    tags: ["초강조", "헤드라인", "임팩트"], mood: ["강렬한"], weights: [400], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/black-han-sans/black-han-sans.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-07", status: "verified",
    pair: "grotesk", pop: 90, added: "2026-09-18",
    desc: "가장 두꺼운 한글 고딕 중 하나. 한 줄 헤드라인에서 압도적인 임팩트를 줍니다." },
  { id: "dongle", name: "동글체", en: "Dongle", family: "'Dongle', sans-serif",
    designer: "김양희", holder: "김양희", category: "디스플레이",
    tags: ["둥근", "귀여운", "짧은문구"], mood: ["귀여운", "발랄한"], weights: [300,400,700], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/dongle/dongle.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-07", status: "verified",
    pair: "inter", pop: 71, added: "2026-09-20",
    desc: "작은 크기에서도 또렷하게 읽히는 둥근 글자. 짧은 문구와 자막에 적합합니다." },
  { id: "single-day", name: "싱글데이", en: "Single Day", family: "'Single Day', cursive",
    designer: "이정연", holder: "이정연", category: "손글씨",
    tags: ["손글씨", "감성", "다이어리"], mood: ["따뜻한", "귀여운"], weights: [400], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/single-day/single-day.zip" },
    cov: 2780, glyphs: "한글 2,780자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-06", status: "verified",
    pair: "inter", pop: 79, added: "2026-09-22",
    desc: "또박또박 쓴 다이어리 손글씨. 감성 문구와 손편지 느낌의 디자인에 어울립니다." },
  { id: "gaegu", name: "개구체", en: "Gaegu", family: "'Gaegu', cursive",
    designer: "김한결", holder: "김한결", category: "손글씨",
    tags: ["손글씨", "발랄한", "어린이"], mood: ["발랄한", "귀여운"], weights: [300,400,700], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/gaegu/gaegu.zip" },
    cov: 11172, glyphs: "한글 11,172자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-06", status: "verified",
    pair: "grotesk", pop: 76, added: "2026-09-22",
    desc: "개구쟁이처럼 삐뚤빼뚤한 손글씨. 아이들 콘텐츠와 가벼운 안내문에 잘 맞습니다." },
  { id: "poor-story", name: "푸어스토리", en: "Poor Story", family: "'Poor Story', cursive",
    designer: "김준연", holder: "김준연", category: "손글씨",
    tags: ["손글씨", "차분한", "일상"], mood: ["따뜻한", "차분한"], weights: [400], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/poor-story/poor-story.zip" },
    cov: 2780, glyphs: "한글 2,780자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-05", status: "checking",
    pair: "inter", pop: 68, added: "2026-09-25",
    desc: "힘 뺀 일상 손글씨. 브이로그 자막과 일상 기록 콘텐츠에서 자주 보입니다." },
  { id: "nanum-pen", name: "나눔손글씨 펜", en: "Nanum Pen Script", family: "'Nanum Pen Script', cursive",
    designer: "네이버 · 산돌", holder: "네이버", category: "손글씨",
    tags: ["펜글씨", "메모", "친근한"], mood: ["따뜻한", "발랄한"], weights: [400], formats: ["TTF","WOFF2"],
    dl: { mirror: "https://github.com/Geehg/letsum-mirror/releases/download/nanum-pen/nanum-pen.zip" },
    cov: 2350, glyphs: "한글 2,350자", license: "OFL", matrix: OFL_ALL_OK, verified: "2026-10-05", status: "checking",
    pair: "inter", pop: 83, added: "2026-09-25",
    desc: "펜으로 슥슥 쓴 메모 같은 글씨. 주석과 말풍선, 짧은 코멘트에 포인트로 쓰기 좋습니다." },
];

// 데모 관리자 계정 (시안용 — 실제 운영 시 교체)
const ADMIN_ACCOUNT = { id: "admin", pw: "font1234" };

// 미리보기 문장 프리셋 — 한글 검증 포인트별
const TEXT_PRESETS = [
  { id: "body",   label: "본문",         t: "책을 읽는 시간은 언제나 옳다" },
  { id: "title",  label: "제목",         t: "새해 복 많이 받으세요" },
  { id: "pang",   label: "자소 전체",    t: "다람쥐 헌 쳇바퀴에 타고파" },
  { id: "batchim",label: "겹받침·희귀자", t: "꿇 뚫 읊 핥 뷁 똠 햏" },
  { id: "mixed",  label: "영문·숫자 혼용", t: "한글 Hangul 2026 · ₩4,500" },
  { id: "old",    label: "옛한글",       t: "나랏말ᄊᆞ미 듕귁에 달아" },
  { id: "hanja",  label: "한자 혼용",    t: "韓國語 漢字 混用 文章" },
];

// 상황별 큐레이션 = 필터 + 맥락 미리보기를 한 번에 적용
const COLLECTIONS = [
  { id: "thumb",    title: "유튜브 썸네일",  desc: "굵은 제목체를 썸네일 프레임에서", cat: "디스플레이", ctx: "thumb", text: "이걸 몰랐다고?" },
  { id: "book",     title: "책 본문",        desc: "장문 가독성을 지면에서",          cat: "명조",       ctx: "book",  text: "책을 읽는 시간은 언제나 옳다" },
  { id: "subtitle", title: "영상 자막",      desc: "자막 바 위에서 또렷한지",          cat: "전체",       ctx: "sub",   text: "오늘도 끝까지 봐주셔서 감사합니다" },
  { id: "menu",     title: "카페 메뉴판",    desc: "가격·숫자와 함께 보기",            cat: "전체",       ctx: "menu",  text: "오늘의 커피" },
  { id: "card",     title: "카드뉴스",       desc: "정사각 프레임의 제목+본문",         cat: "전체",       ctx: "card",  text: "알아두면 쓸모 있는 한 가지" },
  { id: "doc",      title: "문서·UI",        desc: "깔끔한 고딕을 화면 밀도로",         cat: "고딕",       ctx: "ui",    text: "설정이 저장되었습니다" },
];

// 유료·기본 폰트 대신 쓸 무료 대안 (인상이 비슷한 폰트 — 동일한 폰트는 아닙니다)
const ALTERNATIVES = [
  { for: "산돌고딕Neo · Apple SD Gothic 계열 본문 고딕", ids: ["noto-sans-kr", "ibm-plex-sans-kr", "gowun-dodum"] },
  { for: "SM신명조 · 윤명조 계열 책 본문 명조", ids: ["noto-serif-kr", "gowun-batang"] },
  { for: "유료 제목체(격동고딕·헤드라인류) 느낌", ids: ["black-han-sans", "do-hyeon", "jua"] },
  { for: "캘리그래피·손글씨 유료 폰트 느낌", ids: ["single-day", "nanum-pen", "poor-story"] },
];
