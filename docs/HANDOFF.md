# HANDOFF — LETSUM 폰트 수집 작업 인수인계

다른 AI(GPT·Codex·muse.ai·Claude)나 사람이 수집 작업을 이어받을 때 보는 문서. 규칙 요약은 루트의 `AGENTS.md`.

## 0. 지금 상태 (2026-10-11)
- 사이트 폰트 **213종**(소개 전용 4종 포함): Google Fonts 한글 38 + 공공 안심글꼴 OFL 85 + 공공누리 제1유형 76 + KCC OFL 2 + 2026 신규 7(원주체·빗썸고딕 2·부산단디 3·부산교육 고은체)
- 출시일 확인 209/209, 라이선스 원문 대조 완료. 서울서체 5종·HS효성체는 재배포 금지라 letsum.app 서버 전용(`fonts-hosted`)
- 카탈로그(`tools/state/catalog.json`) 약 570건 누적, 검수 대기 목록 `tools/state/review.md`
- 미리보기 웹폰트: `github.com/Geehg/letsum-mirror` → GitHub Pages `geehg.github.io/letsum-mirror/webfonts/<id>/<굵기>.woff2`

## 1. 환경 준비 (처음 한 번)
```bash
git clone https://github.com/Geehg/letsum.git && cd letsum
git config core.hooksPath tools/hooks          # 커밋 전 자동 검증
python3 -m venv .venv && .venv/bin/pip install fonttools brotli pillow   # 웹폰트 변환·견본 렌더링에만 필요
node -v                                          # 페이지 생성·검증에 필요(18+)
```
웹폰트를 새로 올리려면 미러 저장소도 받는다: `git clone https://github.com/Geehg/letsum-mirror.git ../letsum-mirror`

## 2. 작업 흐름 — 반드시 이 순서
```
tools/run.sh start <이름>    ① 잠금
tools/run.sh watch           ② 수집: 새 폰트·새 릴리스·새 배포 뉴스 → tools/state/report.md 확인
   (판단)                    ③ 무엇을 추가할지 결정 — 아래 3장
tools/run.sh dates           ④ 출시일
tools/run.sh verify          ⑤ 라이선스 대조
tools/run.sh pages           ⑥ 폰트별 페이지
tools/run.sh check           ⑦ 검증(오류 0)
tools/run.sh finish "메시지"  ⑧ 커밋·푸시·잠금 해제 → 운영자가 NAS 패널 "받아와 재배포"
```
도구가 실패하면 고치기 전에 **다른 단계로 넘어가지 않는다.** 실패를 숨기려고 데이터를 손으로 덮어쓰지 않는다.

### 좋아요·댓글 API (worker/)
- Cloudflare Worker `letsum-api`가 `letsum.app/api/*`만 처리(나머지는 NAS). DB는 D1 `letsum`. 구조: `worker/migrations/0001_init.sql`
- 로컬 실행: `cd worker && npm i && npx wrangler d1 migrations apply letsum --local && npx wrangler dev --local` (`.dev.vars`에 ADMIN_KEY·VOTER_SALT — git 제외)
- 배포: `worker/**`를 main에 푸시하면 GitHub Actions(`deploy-worker.yml`)가 배포. 저장소 비밀 `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID` 필요(없으면 건너뜀)
- 댓글 관리: `admin.html` → 댓글 관리(관리자 키 = Worker 비밀 ADMIN_KEY)
- 사용 사례 사진: 방문자 업로드(브라우저에서 1280px·700KB 이하로 축소) → D1 `shots`에 pending → `admin.html` '사용 사례 사진 검토'에서 승인해야 공개(거절=삭제). 승인 사진은 피드 카드 두 번째 슬라이드·상세 '사용 사례'에 표시
- 검토 알림: `.github/workflows/review-queue.yml`이 매일 09:00 KST 대기 건수를 확인해 GitHub 이슈(라벨 review)로 알림. 저장소 비밀 `LETSUM_ADMIN_KEY` 필요

### 운영 감시·백업
- 가동 감시: `.github/workflows/uptime.yml`이 10분마다 사이트·API·미러를 확인 → 실패하면 이슈(라벨 outage) + 메일, 복구되면 자동 종료
- D1 백업: **운영자 결정으로 보류(2026-10-12)** — 댓글·사진이 실제로 쌓이기 전까지는 Cloudflare D1 자체 복구(7일)만 사용. 다시 권할 때는 실제 데이터 양을 근거로. 준비된 도구: `tools/backup_d1.sh`를 NAS 작업 스케줄러에서 주 1회 실행 → `/volume1/docker/letsum-backup/`에 12주 보관(공개 저장소에 올리지 말 것 — IP 해시·닉네임·사진 포함). Cloudflare D1 자체 복구(무료 7일)도 있음
- 복구: 백업 JSON을 읽어 `wrangler d1 execute letsum --remote`로 INSERT(필요할 때 스크립트 작성)

### 배포 주의
- `nginx/default.conf`는 컨테이너에 **파일 단위로** 연결돼 있어, 바꾼 뒤 "받아와 재배포"만으로는 반영되지 않는다. 운영자가 컨테이너를 **재시작**(`sudo docker restart letsum-web`)해야 한다.
- html·css·js·data는 재배포만으로 반영된다(nginx no-cache + `?v=` 버전). css/js를 바꾸면 HTML의 `?v=` 숫자를 올린다.

## 3. 폰트를 추가하는 세 가지 경로

### A. 공공 안심글꼴 (OFL·공공누리 제1유형) — 자동 변환
원본: 문체부 '안심글꼴 한번에 내려받기' `https://www.kogl.or.kr/freeFontFileDown.do?idx=456` (동의 절차 없는 공식 링크)
```bash
curl -L -o tools/archive/kogl/safe_fonts_365.zip "https://www.kogl.or.kr/freeFontFileDown.do?idx=456"   # git 제외 폴더
.venv/bin/python tools/build_webfonts.py --mirror ../letsum-mirror --licenses "OFL,공공누리 제1유형"
(cd ../letsum-mirror && git add -A && git commit -m "webfonts: ..." && git push)   # Pages 반영 1~2분
python3 -I tools/import_webfonts.py      # data.js에 '확인 중'으로 추가 (분류는 이름 추정)
```
그다음 **분류 검수**(4장)와 `tools/run.sh dates / verify`, 그리고 **글자 수 계산**:
```bash
.venv/bin/python -I tools/build_coverage.py ../letsum-mirror/webfonts   # cmap에 있어도 비어 있는 글자를 빼고 실제 글자 수·목록 계산 → coverage.json + data.js cov
```
- 공공 폰트 상당수가 11,172칸을 다 채워 두고 2,350~2,800자만 실제로 그려 둔다. cmap 개수로 '완성형 전체'라고 쓰지 않는다.
- 브라우저가 파일을 거부하면(콘솔 `OTS parsing error`) `tools/repair_webfonts.py`로 부속 표만 수리(AGENTS.md 4-3).
- 매칭이 잘못 섞였는지 `tools/state/webfonts.json`의 `source_files`를 반드시 본다(예: 다른 폰트 파일이 한 패밀리에 섞임).
- 아이콘·딩뱃 폰트(`cov`가 한 자릿수)는 제외.

### B. Google Fonts·GitHub 폰트 — 수동 추가
`tools/state/report.md`에 '🆕 Google Fonts 새 한글 패밀리'가 뜨면 data.js에 아래 템플릿으로 추가(웹폰트는 Google CDN이 맡으므로 `webfont` 없음).

### B-2. 배포처가 공식 웹폰트를 운영하는 폰트 (네이버 나눔·스포카 등)
1. 공식 웹폰트 CSS·파일 주소를 찾고 `curl -I -H 'Origin: https://letsum.app'`로 `access-control-allow-origin`을 확인한다(없으면 이 방식 불가).
2. `tools/state/cdn_fonts.json`에 굵기별 주소 등록 → 파일을 `tools/archive/cdn/<id>/<굵기>.<확장자>`에 받아 둔다(글자 수 계산용, git 제외).
3. data.js에 항목 추가(`webfont`에 공식 주소 그대로) → 라이선스 근거(공유마당 개별 페이지 OFL 표시·저장소 LICENSE)를 `license_manual.json`에 → `aliases.json`에 카탈로그 이름 연결.
4. `build_coverage.py`·`build_evidence.py`·`fetch_icons.py`(피드 카드 로고 — 빠뜨리면 카드에 첫 글자만 나옴)·`build_og.py`(카톡·SNS 미리보기 카드 `img/og/<id>.png`)·`build_pages.js`·`validate.py`.

### C. 기업·지자체 신규 전용서체(뉴스로 감지) — 사람 판단 필수
`report.md`의 '📰 새 배포 소식'에서 시작한다.
1. 기사에서 폰트명·배포 기관·배포 페이지를 찾는다. **원 배포처 페이지**를 직접 연다.
2. 라이선스 원문을 읽는다.
   - OFL / 공공누리 제1유형 → 원본 파일로 A처럼 웹폰트 변환 가능
   - 그 외(재배포 금지 등) → **웹폰트를 만들지 않는다.** 배포처가 웹폰트 CDN을 제공하면 그 주소만 쓰고, 없으면 등록 보류(미리보기가 불가능하므로)
3. 출시일 = 기관 발표일. `release_overrides.json`에 출처 기사·배포처 링크와 함께.
4. LICENSE_INFO에 없는 라이선스를 새로 쓰려면 data.js의 `LICENSE_INFO`에 이름·요약·원문 링크를 먼저 추가하고, 매트릭스(인쇄·웹·영상·임베딩·BI/CI·포장·수정재배포)를 원문 기준으로 하나씩 채운다. 모르는 칸은 `cond`.

### data.js 항목 템플릿
```js
  { id: "font-id", name: "한글명", en: "English Name", family: "'English Name', sans-serif",
    designer: "제작", holder: "저작권자", category: "고딕",
    tags: ["본문"], mood: ["단정한"], weights: [400,700], formats: ["TTF","WOFF2"],
    cov: 11172, glyphs: "한글 11,172자",
    dl: { page: "https://원-배포처-페이지", srcName: "배포처 이름" },
    license: "OFL", matrix: OFL_ALL_OK, verified: "YYYY-MM-DD", status: "checking",
    pair: "inter", pop: 50, added: "YYYY-MM-DD",
    desc: "한두 문장 — 생김새와 어울리는 쓰임새" },
```
`released`는 직접 쓰지 말고 `release_overrides.json`에 넣은 뒤 `tools/run.sh dates`.

## 4. 분류 검수 (사람·AI의 눈이 필요한 단계)
1. 견본 이미지를 만든다 — 폰트 파일로 같은 문장을 렌더링(Pillow). 예시는 이 문서 끝.
2. 견본을 보고 `tools/state/review_<이름>.json`에 작성: `{ "<id>": ["분류", "설명", ["태그"], ["분위기"]] }`
3. `python3 -I tools/apply_review.py tools/state/review_*.json` (멱등 — 여러 번 실행해도 같음)
- 분류 기준: 고딕(민부리 본문·제목) / 명조(부리·바탕) / 손글씨(손으로 쓴 느낌, 붓·펜 포함) / 디스플레이(제목 전용·장식·초굵기)
- 설명은 생김새 + 어울리는 쓰임새. 과장·추측 금지("가장 인기" 같은 말 금지)

## 5. 중복·꼬임 방지 장치
| 위험 | 장치 |
|---|---|
| 두 작업자가 동시에 data.js 수정 | `tools/run.sh start`의 LOCK 파일 + `git pull --rebase` |
| 같은 폰트가 두 번 등록 | validate.py가 id·이름·영문명 중복 검사 / `aliases.json`으로 다른 이름 연결 |
| 잘못된 값·문법 오류 | validate.py(node로 실제 실행) + pre-commit 훅 |
| 생성 파일을 손으로 고쳐 다음 실행에 덮어써짐 | AGENTS.md 4장 소유권 표 |
| 같은 웹폰트 재업로드 | archive·webfonts는 내용 해시 기준, ZIP 시각 고정 |
| 날짜·라이선스 추측 | 출처 필드 필수(validate), verify_licenses.py 대조 결과 `license_check.json` |

## 6. 남은 일 (우선순위)
1. 2026년 신규 배포(뉴스 감지분) — 진행표 `tools/state/pending_new_fonts.md`. 원주체 등록 완료, 나머지는 라이선스 원문 확인 대기. 3장 C 절차.
2. (완료) 서울서체 — 서울시 저작권 안내상 무단배포 금지 → 서버 전용으로 이동
3. 소개 전용 4종(온글잎 범준필기체·GS혜자로운체·이옥선체·길원옥체) — 웹폰트 허용이 확인되면 일반 항목으로 전환(AGENTS.md 4-2). GS혜자로운체는 배포 사이트 라이선스 원문·굵기·분류 확인 필요, 이옥선체·길원옥체는 공유마당 ZIP 안 이용 조건 확인 필요
4. 공공 목록에는 있으나 묶음에 없는 OFL·공공누리 폰트 — 각 배포처에서 원본 확보 후 A
5. 공공데이터포털 CSV 갱신(연 1회) → `tools/sources/`에 UTF-8로 저장(파일명 규칙 유지)

## 부록: 견본 렌더링 예시
```python
from PIL import Image, ImageDraw, ImageFont
img = Image.new("RGB", (1500, 100), "white"); d = ImageDraw.Draw(img)
d.text((10, 30), "책을 읽는 시간은 언제나 옳다 가나다 ABC 123", fill="black",
       font=ImageFont.truetype("../letsum-mirror/webfonts/<id>/400.woff2", 40))
img.save("sample.png")
```

## 히어로 브랜드 테마 (2026-10-12)
- 우선순위: 관리자 저장(D1 `brand_themes`, `/api/brand`, off 가능) > main.js `BRAND` 기본 등록 > 자동 추천(`html/data/brand_auto.json`, 확인 전에도 게시) > 분위기 팔레트.
- 자동 추천: `tools/extract_brand.py` (AI 없음 — theme-color·CSS 변수·CSS 빈도·og:image 색, 대비 계산). 매주 watch-sources에서 실행. 여러 제작사가 쓰는 배포 플랫폼 도메인(공유마당 등)과 robots.txt 차단 사이트는 건너뜀 — 필요하면 data.js에 `brandPage`로 제작사 페이지 지정.
- 관리자 화면 `admin.html` → '히어로 테마' 탭에서 색·표현(기본/스티커/그림자)·문구·강조 글자 수 저장. admin.js의 SPOT_PAL/LAYOUT/LINES/BUILTIN은 main.js와 같게 유지할 것.

## 설치 후 보이는 이름 (2026-10-13)
- `tools/build_names.py`(fontTools) — 미리보기·공식 웹폰트 파일, Google Fonts는 google/fonts 원본 TTF의 name 테이블을 읽어 `html/data/names.json` 생성. 캐시 `tools/state/names_cache.json`(주소별). 매주 watch-sources에서 실행.
- 규칙: Windows 앱 목록 = Windows 기록 nameID1(한국어 우선) · Mac 서체 관리자/Adobe = nameID16→1 + 17→2 · 포토샵 '글꼴 누락' = PostScript(nameID6). Mac 규칙은 CoreText(macOS 한국어)로 표본 검증함.
- 사이트: 검색이 모든 이름으로 찾음(결과 위 라임 안내), 카드·히어로 '설치 후 이름'(LETSUM 표기와 다를 때만), 상세 '설치 후 보이는 이름' 표(복사), 확인 기록 txt, 정적 font/*.html.

## OFL 한글 폰트 자동 등록 (2026-10-16~)
- `tools/auto_register.py` — 매주 월요일 `watch-font-sources` 워크플로에서 실행. GitHub 검색·감시 목록에서 OFL 한글 폰트를 찾아 **조건을 모두 만족하면 바로 등록**(data.js·cdn_fonts·근거·글자 수·이름·로고·카톡 카드·상세 페이지), 등록되면 `auto-register` 라벨 이슈로 알림.
- 조건: 저장소 라이선스 OFL-1.1 + LICENSE 본문 확인, 포크·보관·사본 계정 제외, 별 15개 이상, 저장소 파일을 jsDelivr로 버전 고정해 그대로 사용(미러·변환 없음), 실제 한글 2,350자 이상, 기존 이름과 중복 없음. 한 번에 최대 5종.
- 자동 항목은 `autoReg: true`. 설명·태그·분류는 기본 틀(분류는 이름·설명 키워드로 추정) → 필요하면 사람이 다듬는다.
- 기록: `tools/state/auto_register.json`(본 저장소·결과·사유, 바뀌지 않은 저장소는 다시 보지 않음). 수동 점검: `python tools/auto_register.py --dry`.
- 기업·지자체 자체 라이선스·공유마당(동의 절차)·산돌구름 전용은 자동 대상이 아니다 — 이슈 알림 후 운영자가 "등록해"라고 하면 원문 대조로 처리.
- 사이트 반영은 여전히 NAS '받아와 재배포'.

## 브라우저 호환 점검 (2026-10-17~)
- fontTools가 정상으로 읽어도 브라우저(OTS 검사)가 거부하는 폰트가 있다(손상된 kern·hinting 표 등). 새 폰트를 등록한 뒤 실제 사이트 콘솔에서 전수 검사:
  `FONTS` 각 `webfont` 주소를 `new FontFace(...).load()`로 열어 실패 목록 확인(동시 8개, 662파일 약 3분).
- 처리: 수정 허용 라이선스(OFL·공공누리 1유형·수정 허용 자체 라이선스)는 손상 부가 표(kern·DSIG·hdmx·VDMX·LTSH·PCLT, 필요 시 hinting·post 3)를 빼고 다시 저장, LICENSE.txt에 기록.
  수정 금지·불명확 → 배포처의 다른 공식 형식(TTF/WOFF) 시도 → 그래도 안 되면 `intro: true` + 원본으로 그린 견본 이미지.
- 2026-10-17 결과: 헬스셋고딕·EBS 주시경체 → 견본 이미지(소개 전용), 동그라미재단체 700 → 표 정리, 나눔명조 옛한글 → 네이버 공식 TTF 주소로.
