# GPT(Codex) 인수인계 — LETSUM · 필사독서(type.letsum.app)

이 문서는 다른 AI가 이 저장소를 바로 이어서 고칠 수 있도록 **지금 상태와 지켜야 할 것**만 모은 요약이다.
전체 규칙은 `AGENTS.md`, 날짜별 상세 기록은 `docs/HANDOFF.md`. 운영자에게는 **항상 한국어로** 보고한다.

---

## 1. 사이트 두 개, 저장소 하나

| 주소 | 내용 | 주요 파일 |
|---|---|---|
| https://letsum.app | 상업용 무료 폰트(한글 562·영문 601·딩벳 48), 특수기호, 필사독서 **소개 페이지** | `html/index.html`, `html/js/main.js`, `html/js/data*.js`, `html/symbols.html`, `html/typing.html`(소개) |
| https://type.letsum.app | **필사독서** — 저작권 만료 명작 474권을 한 글자씩 따라 쓰는 타이핑 독서 | 원본 `tools/typing_app.html` → 생성 `html/type/index.html`, 엔진 `html/js/typing.js`, 스타일 `html/css/style.css`(`.tb-*`) |

- 정적 사이트. 서버는 Synology NAS의 nginx 컨테이너 하나(`letsum-web`, 포트 8516), Cloudflare 터널 `kuri-nas`가 두 주소를 같은 포트로 보낸다. nginx가 Host로 나눔(`nginx/default.conf`).
- type.letsum.app은 **css·js·data/typing·img를 letsum.app과 같은 파일로 공유**한다(nginx `location ~ ^/(css|js|img|data/typing)/`). 첫 화면 `/`만 `html/type/index.html`.
- 좋아요·댓글 API는 Cloudflare Worker(`worker/`), letsum.app 전용.

## 2. 절대 규칙(요약)

1. 사용자 대상 AI 기능 금지(운영비 0원). 계산은 브라우저·정적 데이터로.
2. **지어내지 않는다** — 날짜·라이선스·순위·별점·인기 수치 금지. 필사독서의 '오늘의 한 편' 같은 것은 날짜로만 고른다.
3. 필사독서 본문은 **저작자 사망 1955년 이전(국내 보호기간 만료)** 작품만. 한국 = 위키문헌, 영어 = Project Gutenberg 공개 원문. 번역본 넣지 않음.
4. 필사 기록은 브라우저 localStorage(`typebook-v1:*`)에만. 서버 전송·계정·랭킹 만들지 않음(가짜 랭킹 금지).
5. 비밀번호·토큰을 코드·문서에 넣지 않는다.
6. 운영자가 시킨 것만 지우고, 고친 뒤 실제 화면을 확인하고 보고한다.

## 3. 작업 순서(반드시)

```bash
git stash -u; bash tools/run.sh start gpt; git stash pop   # 최신 받기 + 잠금(tools/state/LOCK). 잠겨 있으면 멈추고 운영자에게 묻기
# … 수정 …
node tools/build_pages.js          # html/type/index.html, 폰트 상세·주제 페이지, 사이트맵 다시 만듦
python3 -I tools/validate.py       # 오류 0이어야 함(모든 html/js/*.js 문법 검사 포함)
bash tools/run.sh finish "커밋 메시지"   # 검증 → git add -A → 커밋·푸시 → 잠금 해제
```
- 푸시 후 **운영자가 NAS 패널 '받아와 재배포'** 를 눌러야 사이트에 반영된다.
- `nginx/default.conf`를 바꾸면 재배포만으로 안 되고 컨테이너 재시작(`docker restart letsum-web`) 필요 — 운영자에게 요청.
- css·js를 바꾸면 **`?v=` 숫자를 올린다**: 필사독서는 `tools/typing_app.html`의 `css/style.css?v=`·`js/typing.js?v=` (현재 108·18). letsum.app 페이지는 각 html의 `?v=`.

## 4. 필사독서 구조(가장 자주 고칠 곳)

### 화면 원본 vs 생성물
- **`tools/typing_app.html`을 고친다.** `html/type/index.html`은 build_pages.js가 덮어쓴다(머리글만 필사독서 전용으로 바꾸고 경로를 `/`로 시작하게 바꿈).
- `html/typing.html`은 letsum.app의 **소개 페이지**(손으로 고침). `<!--TI:STATS-->`·`<!--TI:PICKS-->` 사이는 build_pages.js가 채움.

### 화면 구성(`tools/typing_app.html`)
- 위 막대: 위치(MY LIBRARY / 작품), **디자인 선택**(몰입 밝게·몰입 어둡게·레트로·책상·잉크), **⚙ 설정**(읽기 화면에서만), 도서 가져오기, ?.
- 서가 `#tbShelf`: 소개·기록(`#tbMe`) → 추천 줄(`#tbThemes`, index.json의 themes) → 전체 서가(`#tbLib`: 검색 `#tbQ`·갈래·작가 필터·'더 보기') → 안내.
- 읽기 `#tbRead`: 머리 `.tb-rh`(입체 표지 `#tbCv` + 도서 정보 `.tb-rh-body`: 제목·목차 `#tbToc`·정보 `#tbInfo`·쪽 넘김 `.tb-pager`) + 진행 수치 `.tb-stats` → `.tb-machine`(레트로 캐리지 + 원문 `#tbOrig`/필사 `#tbInput`) → 가상 키보드 `#tbKb`.
- 창: `#tbImport`(TXT·MD·EPUB), `#tbSet`(필사 설정: 글꼴·글자 크기·레트로 타건음·음량·용지·다시 쓰기·인쇄), `#tbHelp`, `#tbFinish`(쪽 완성).

### 디자인(스킨) 체계 — `style.css`
- `main.tb`의 속성: `data-skin`(색·질감: `focus`·`retro`·`book`·`ink`), `data-tone`(`light`/`dark`, 몰입만), `data-layout`(`focus` = 몰입·레트로 한 단 / `wide` = 책상·잉크 왼쪽 칸), `data-paper`(레트로 용지).
- 색은 `--t-*` 변수로만. 스킨마다 변수 묶음이 있음. 바닥 색은 JS가 `--tb-page`로 맞춤.
- 기본 디자인: 몰입(사이트가 어두우면 어둡게). 저장 키 `typebook-v1:skin2`.
- 기본 글꼴: 원문 KoPub World 바탕체(`k-kopubworldbatang`), 필사 프리텐다드(`k-pretendard`) — 운영자 지정.

### 엔진(`html/js/typing.js`)
- 해시 라우팅: `#/` 서가, `#/read/<id>` 읽기.
- 한글 IME: compositionstart/end로 조합 중 글자는 판정 보류, 확정 글자만 시도·오타 집계. NFC 정규화, 문장부호 동치(`EQ`: “→" 등). 줄 끝 ↵ = Enter.
- 쪽: 문단 기준 약 350자(시는 연 단위, 줄바꿈 유지). 장(parts)마다 새 쪽.
- 완성한 쪽 다음 쪽까지만 이동(새 장 첫 쪽은 언제든). 붙여 넣기 막음.
- 레트로: Web Audio 합성 타건음(외부 음원 없음), 캐리지 이동, A4 인쇄(`#tbPrintArea` + `@media print`).

### 데이터
- `html/data/typing/index.json`: `themes`(추천 줄) + `library`(전체 456권). 항목: id·title·author·cat·lang·poem·color·ink·font·chars·nparts·source·license·cover(표지 시각)·sc/si(책등 색·글자색).
- `html/data/typing/<id>.json`: `{…meta, text}` 또는 `{…meta, parts:[{t,x}]}`.
- 만드는 도구: `.venv/bin/python -I tools/build_typing_books.py` (위키문헌 작가 문서 32명 + Gutenberg 44권, 받은 원문은 `../tmp/typing-cache`). 옛한글(아래아)·국한문·일본어 위주 글은 자동 제외, 된시옷(ᄯᅢ→때)은 현대 쌍자음으로.
- 글꼴 목록 `html/data/typing/fonts.json` ← build_pages.js.
- **표지**: `html/img/typing/<id>.webp`(480×679, A5). 넣기 `.venv/bin/python -I tools/import_covers.py <폴더>` (폴더의 generation-manifest.json `source_id`로 짝지음, 없으면 `<id>.png`나 제목 파일명). 표지 생성 프롬프트 `docs/typing_cover_prompts.md/.csv` ← `tools/make_cover_prompts.py`.
- 서가 카드에 표지가 있으면 `.tb-card.tb-cov`: 그림만 보이고, 마우스를 올리면 입체 책(`.tb-b3`)이 rotateY(40deg)·원근 1800px로 돌며 책등(`.tb-sp3`, 표지 색·세로 제목)과 아래 정보 띠가 나타남.

## 5. 이미 겪은 함정

| 함정 | 결과 | 지금 상태 |
|---|---|---|
| 클래스 이름 `.cov` | 사이트의 글자 지원 표시 스타일과 겹쳐 표지에 테두리 | 표지 카드는 `.tb-cov` — `.cov` 쓰지 말 것 |
| 사이트 전역 `.sp` 클래스 | 가상 키보드 글쇠가 사라짐 | 기능키는 `.fn` |
| nginx 첫 server 블록이 기본 서버가 됨 | type 블록을 위에 두자 letsum.app이 잘못 응답 | letsum 블록 `listen 80 default_server` 유지 |
| 한 줄 안 `//` 주석 | 뒤 코드가 주석 처리돼 문법 오류 | 줄 중간 설명은 `/* */` |
| 정규식 한자 범위에 다른 글자(豈 U+8C48) 섞임 | 한글을 한자로 셈 | `㐀-鿿豈-﫿`로 씀 |
| 원근이 작으면(800px) 회전 시 책 윗부분 잘림 | 가로 스크롤 줄이 잘라냄 | 1800px + 줄 위아래 여백 |
| 이미지 alt 글자 | 불러오는 동안 제목이 비침 | 카드에 aria-label, img는 alt="" |

## 6. 확인 방법
- 로컬: 필사독서는 루트 경로를 쓰므로 임시 폴더에 `index.html`(→ `html/type/index.html`), `css`·`js`·`data`·`img` 심볼릭 링크를 만들고 `python3 -m http.server`로 연다. `?skin=retro` 처럼 주소로 디자인 고정 가능.
- 스크린숏: 헤드리스 Chrome `--window-size=1440,…` (휴대폰 폭은 500px 미만이 잘 안 됨 → 브라우저 모바일 에뮬레이션).
- 실제 사이트: `curl -s https://type.letsum.app/ | grep -o 'typing.js?v=[0-9]*'` 로 새 버전이 나가는지.

## 7. 운영자 성향
- 한국어로, 짧게, 바뀐 것과 확인한 것을 표로 보고.
- 결과를 실제 화면으로 확인한 뒤 보고. 못 확인한 것은 못 했다고 말하기.
- 그라데이션·과한 장식보다 정돈된 화면 선호. 기능 없는 장식은 빼는 쪽.
- 마음에 안 들면 "이전으로 복구"를 요청함 → `git revert`로 되돌리고 바로 반영.
