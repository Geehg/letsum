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

## 방문 통계·검색 키워드·모니터링 (2026-10-18~)
- 관리자(`admin.html`) 탭: **방문 통계**(방문·페이지뷰·일별·시간대·요일·유입 채널·유입 사이트·첫 페이지·인기 페이지·국가·기기·브라우저·OS·화면 폭·utm) · **검색 키워드**(구글 Search Console · 검색엔진이 넘긴 검색어 · 사이트 안 검색어 · 결과 없는 검색어) · **모니터링**(지금 점검: 사이트·API·미러·NAS 폰트·Google Fonts 응답 시간 / 가동 감시 이슈 / 자동 작업 결과 / 미리보기 실패 폰트 / 스크립트 오류 / 검색 로봇) · **기능 이용**(기존 지표).
- 수집: `html/js/pv.js`(모든 공개 페이지, 관리자 제외) → `POST /api/pv` → D1 `traffic(day, dim, key, n)` **날짜별 합계만**. IP·쿠키·식별값·유입 주소 전체는 저장 안 함(호스트·검색어만 추출). 이메일·6자리 이상 숫자 든 검색어는 버림. '추적 안 함'·GPC면 안 보냄. 약 13개월(400일) 지나면 자동 삭제.
- **시작일 2026-10-25**: 개인정보처리방침 변경(2026-10-18 공지)의 시행일. 그 전에는 `/api/pv`가 받기만 하고 버린다(`TRAFFIC_FROM`). 로컬 시험은 `worker/.dev.vars`에 `TRAFFIC_FROM=2026-01-01`.
- 미리보기 실패(`ffail`)는 기존 기능 집계(`/api/e`)로 바로 쌓인다(폰트별 합계).
- D1 쓰기량: 방문 1회 ≈ 13행 + 페이지뷰마다 3행. 무료 한도(하루 10만 행)면 하루 약 5,000방문까지 여유.

### 구글 검색어 연결(선택, 한 번만) — 운영자가 직접
비밀 키를 다루는 작업이라 운영자가 직접 한다(에이전트는 키를 입력하지 않음).
1. Google Cloud 콘솔 → 프로젝트 하나 → 'Google Search Console API' 사용 설정.
2. IAM → 서비스 계정 만들기(역할 없음) → 키 → JSON 키 받기.
3. Search Console(letsum.app 속성) → 설정 → 사용자 및 권한 → 서비스 계정 이메일을 **제한됨** 권한으로 추가.
4. `cd worker && npx wrangler secret put GSC_SA < 받은키.json` (letsum.app 속성은 URL 접두어 방식 `https://letsum.app/` — 코드 기본값과 같아 따로 등록할 필요 없음). 받은 키 파일은 지운다.

### Cloudflare 통계를 관리자 화면에서 보기(선택)
1. Cloudflare → Web Analytics → letsum.app 추가(자동 설정) — 켜면 바로 대시보드에서 볼 수 있음.
2. 관리자 화면에도 띄우려면: My Profile → API 토큰 → 'Account Analytics 읽기' 토큰 생성 →
   `npx wrangler secret put CF_API_TOKEN`, `CF_ACCOUNT_ID`(계정 ID), `CF_WA_SITE_TAG`(Web Analytics 사이트 태그).

## 영문 폰트 섹션 `/en/` (2026-10-18~)
- 헤더 메뉴: **한글 폰트**(기본, `/`) | **영문 폰트**(`/en/`) — 모든 페이지·상세 페이지 공통.
- 데이터: `html/js/data_en.js`(`FONTS_EN`, id `e-…`, 2026-10-20 기준 601종) ← `tools/build_en_data.py --top 600`(인기 600 + 이미 등록된 것 유지 + Fontshare OFL 중 GF에 없는 것)(Google Fonts 공식 메타데이터 인기순, 라이선스는 google/fonts 폴더 ofl·apache·ufl로 확인). 미리보기는 Google Fonts 공식 웹폰트 주소(latin 구간, 평균 20KB)를 굵기별로 그대로 사용 — 변환·보관 없음. 출시일은 'Google Fonts 등록일'(원 출시일과 다를 수 있음).
- `/en/index.html`은 `tools/build_pages.js`가 `index.html`로 **자동 생성**(`<base href="/">` + `LS_LANG="en"`) — 직접 고치지 말고 index.html을 고친다. 상세 페이지는 같은 `font/` 폴더에 `e-…html`.
- main.js `EN` 분기: 한글 글자 검사·옛한글·한자·완성형 필터 끔, 견본 글자 'Aa', 영문 히어로 문구·장문 샘플. 예시 문장은 `/api/samples?lang=en`(관리자 '예시 문장' 탭에서 페이지 선택).
- Fontshare: ITF Free Font License v2.0(2026-08)이 '제3자가 고를 수 있는 글꼴로 제공' 금지·형식 변환 금지 → 직접 입력 미리보기 불가. OFL 36종은 개별 확인 후 추가 가능, ITF 64종은 소개 전용(견본 이미지) 후보.
- 남은 일: 영문 카톡 카드(build_og가 data.js만 읽음 → 지금은 기본 카드), 관리자 '폰트 목록'에 영문 표시, 매주 자동 갱신(watch-sources에 build_en_data 추가), 영문 설명 다듬기(지금은 메타데이터 기반 기본 문장).
- 절차는 스킬 `.claude/skills/font-collect/SKILL.md`.


## 딩벳 폰트 섹션(/dingbat/) — 2026-10-20
- 헤더 메뉴 "한글 폰트 | 영문 폰트 | 딩벳 폰트". `/dingbat/index.html`은 `build_pages.js`가 `index.html`로 생성(LS_LANG="db", 직접 고치지 말 것). 상세 페이지 `font/d-*.html`.
- 데이터 `html/js/data_db.js` ← `tools/build_db_data.py`(Google Fonts 공식 + 제작사 공식 npm/GitHub 아이콘 폰트, 2026-10-20 기준 48종). 매주 자동 갱신(`watch-sources.yml`)에서 다시 만들고 카드(`build_og.py --db --missing`)도 채운다.
- 검증: `validate.py`가 d- 접두사·분류·라이선스·견본 기호·웹폰트 주소를 검사.
- 수집 절차는 `.claude/skills/font-collect/SKILL.md`의 '딩벳 폰트' 절.

## 특수기호(/symbols.html) — 2026-10-20
- 헤더 메뉴 "… 딩벳 폰트 | 특수기호". 정적 페이지 `html/symbols.html` + `html/js/symbols.js`(손으로 고침) + 데이터 `html/data/symbols.json` ← `python3 -I tools/build_symbols.py`(파이썬 내장 unicodedata만, 2,891자·14분류).
- 기능: 누르면 복사 / 모으기(여러 개 모아 복사) / 한글 이름·영문 이름·U+코드·글자 붙여넣기 검색 / 최근·즐겨찾기(localStorage) / 코드(HTML·CSS·JS·URL) / 한글 입력기 '자음 + 한자' 표(KS X 1001 특수문자 영역을 행·유니코드 성질로 분류한 참고표) / 글자 꾸미기(유니코드 수학 영숫자·원문자·전각·결합 문자) / 이모티콘·꾸밈선 / 기호 알아보기. 서버로 보내는 것 없음.
- 한국어 검색어: `KO`(기호 고유 이름) > `TR`(영문 이름 단어 번역) > 분류 검색어(앞에서 결과가 없을 때만).
- 특수기호 히어로(2026-10-20): 최근 30일 '많이 복사된 기호·이모티콘'을 `GET /api/symtop`(D1 traffic dim `sym`, 1시간 캐시)에서 받아 보여 준다. 집계는 `POST /api/pv {t:"sym",k}` — 기호표·자음+한자·이모티콘 목록에서 복사/모으기한 항목만(직접 입력한 글은 보내지 않음), **2026-10-27부터**(`SYM_FROM`, 개인정보처리방침 10-20 추가 공지). 화면에는 사이트 목록에 있는 기호만 다시 보여 주므로 임의 문자열이 히어로에 올라오지 않는다. 집계 전에는 '자주 쓰는 기호'로 표시(순위 표시 없음).

## 폰트 조합(/pairing.html) — 2026-10-21
- 헤더 메뉴 "… 특수기호 | 폰트 조합". 정적 페이지 `html/pairing.html` + `html/js/pairing.js`(손으로 고침). 데이터는 `data.js`·`data_en.js`를 그대로 읽는다(주소 뒤 해시는 `build_pages.js`가 갱신).
- 제목·본문 × 한글·영문 4칸. 혼용: `font-family: '영문', '한글'` 순서로 영문·숫자만 영문 폰트. 영문 크기는 `FontFace`의 `sizeAdjust`로 보정, '맞춤'은 한글 폰트에 들어 있는 영문 대문자 높이를 기준(캔버스 측정).
- 조합 사용 범위 = 항목별 가장 엄격한 값. 추천 조합 = 규칙(분류 짝·굵기 3종 이상·인쇄·웹 상업 이용 가능·인기순), AI 없음.
- 상세 모달·상세 페이지에 '이 폰트로 조합 만들기'(`pairing.html?f=<id>`).

## 이미지로 저장·공유(shot.js) — 2026-10-21
- `html/js/shot.js`(`LSShot.open(spec)`): 이미 불러온 웹폰트로 캔버스에 그려 미리보기 창 → PNG 저장 / 이미지 복사 / 공유(휴대폰 공유 시트). 외부 라이브러리·서버 없음.
- 쓰는 곳: 폰트 조합(4:5, 실제 조합 폰트로), 폰트 상세 창(정사각, 한글·영문·딩벳), 나란히 비교(세로 길이 자동). 하단에 letsum.app 주소.
- `validate.py`가 `html/js/*.js` 문법을 검사(오류 있으면 커밋 차단) — 2026-10-21 pairing.js 한 줄 주석 사고 이후 추가.

## 검색 노출(SEO) — 2026-10-21
- 주제별 소개 페이지 19개 `/topics/<slug>.html` ← `tools/seo_topics.js`(주제·문구·자주 묻는 질문) + `build_pages.js`(생성·사이트맵). 목록은 data.js 실제 값으로만 거르고, 견본은 기존 OG 카드 이미지(lazy).
- 홈: 보이는 h1('무료 한글 폰트 · 상업용 무료 폰트 N종')·소개·주제 바로가기(`<!--SEO:INTRO-->`), 하단 전체 폰트 이름 목록(`<!--SEO:DIR-->`) — build_pages.js가 채움(영문·딩벳 홈은 각자 내용). 제목·설명의 종수는 자동 갱신. WebSite+SearchAction 구조화 데이터.
- 상세 페이지: BreadcrumbList + '이 폰트가 포함된 목록' 링크.
- 키워드 근거: `tools/state/seo_keywords.md`(구글·네이버 자동완성 조사).
- 2026-10-22: 홈의 주제 칩은 페이지 이동 없이 메인 화면에서 걸러 보기(`?topic=<slug>`, `html/data/topics.json`, main.js `applyTopic`). 주제 페이지에 '메인 화면에서 이 목록 보기', 상세 페이지에 보이는 경로(홈 › 주제 › 폰트). 주제 21개(한자 지원·옛한글 지원 추가).
- 2026-10-22: 주제 칩을 누르면 미리보기 문장이 그 주제 문장(seo_topics.js `lines`, 3~4개 중 무작위)으로 바뀜(직접 입력한 문장은 유지, 해제하면 원래 문장). 영문·딩벳 홈은 각자 주제만(영문 7·딩벳 4 추가, 총 32). 옛한글 판정을 '실제 조합되는 폰트'로 정정(37→4종: Kopub 돋움·바탕, 나눔바른고딕·나눔명조 옛한글) — build_coverage.py `old_composes`.
- 2026-10-22: 홈 소개를 안 3으로 — 한 줄 h1('무료 한글 폰트 N종' + 한 줄 설명) + '주제로 보기'(details, 기본 펼침, 접으면 localStorage `ls_intro_closed`) + 묶음별 글자 목록(`INTRO_GROUPS` in build_pages.js: 한글 4묶음·영문 2·딩벳 1). 소개 문단·네모 칩은 없앰.

## 필사독서(/typing.html) — 2026-10-24
- 헤더 메뉴 "… 특수기호 | 필사독서". 운영자가 준 TYPEBOOK v1.0.0(명세 `TYPEBOOK_PRODUCT_SPEC_v1.0.0.md`) 엔진을 LETSUM에 맞게 옮김: `html/typing.html` + `html/js/typing.js`(손으로 고침) + CSS `.tb-*`.
- 서가 데이터 `html/data/typing/index.json`·`<id>.json` ← `.venv/bin/python -I tools/build_typing_books.py [id …]`(위키문헌 parse API, 저작권 만료작만 + 자체 예문 2편, 한자 병기 제거·한자→독음 `hanja` 패키지). 4주제 22편(처음 필사·시·소설·영어 고전). 새 작품은 스크립트 `BOOKS`에 추가.
- 글꼴 목록 `html/data/typing/fonts.json` ← build_pages.js(LETSUM 등록 폰트 중 본문용 한글 41·영문 22).
- 판정: NFC 정규화 + 완전 일치, 한글 IME 조합 중엔 판정 보류(compositionstart/end), “”‘’「」·― 는 키보드 기호와 같게 봄(`EQ`), 시·문단 끝은 ↵(Enter). 붙여 넣기·끌어 놓기 막음. 완성한 쪽 다음 쪽까지만 이동(명세 FR-07).
- 기록은 localStorage `typebook-v1:*`(진행·초안·포인트·날짜별 글자 수→연속 필사일)만 — 서버 전송 없음. **랭킹은 만들지 않음**(가짜 순위 금지; 진짜 랭킹은 계정·서버 검증·부정 입력 방지가 필요 → 명세 7단계).
- 내 글 가져오기: TXT·MD(UTF-8, 깨지면 EUC-KR)·EPUB(JSZip 3.10.1 `html/js/jszip.min.js`, 필요할 때만 불러옴, textContent만 읽음). 12만 자 이하만 브라우저에 본문 보관.
- 완성 창에서 이 쪽을 이미지로(shot.js, 1080×1350, 필사 글꼴로).
- 헤더 메뉴가 8개라 761~960px에선 메뉴를 둘째 줄로(`--hd:88px`), 961~1200px는 간격을 줄임.
- 2026-10-24(추가): 기본 디자인 = 몰입. 몰입은 밝게(data-tone="light")·어둡게 두 가지, 버튼 순서 몰입 밝게·몰입 어둡게·책상·잉크. 저장 키 `typebook-v1:skin2`(처음엔 사이트 밝기 따라 밝게/어둡게).
- 2026-10-24: 화면 디자인 3종(위쪽 '디자인' 전환, localStorage `typebook-v1:skin`, 주소 `?skin=` 도 가능) — **책상**(기본, 운영자가 준 TYPEBOOK 화면 그대로: 흰 카드·코럴·왼쪽 '나의 서재'·펼친 책), **잉크**(LETSUM 평면 잉크·라임), **몰입**(어두운 한 단). CSS는 `main.tb[data-skin]`의 `--t-*` 변수로 갈아 끼움(사이트 다크 모드는 책상 스킨에도 반영).
- 2026-10-24: **전체 서가 456권**(한국 412·영어 44, 본문 약 3,700만 자, `html/data/typing/` 약 63MB) — `build_typing_books.py`가 위키문헌 작가 32명(사망 1955년 이전)의 작가 문서를 갈래별로 따라가 수집, 영어는 Project Gutenberg 44권(저자 사망 1955년 이전, 번역본 제외). 긴 책은 장(parts) 단위 JSON `{parts:[{t,x}]}` → 화면에 '목차' 선택, 새 장 첫 쪽은 언제든 이동. 서가에 검색·갈래·작가 필터와 '더 보기'. 옛한글·국한문·일본어 위주 글 약 60편은 뺌(목록은 빌드 로그). 목록 `docs/typing_library.md`.
- 2026-10-24: 기본 글꼴 = 원문 KoPub World 바탕체(k-kopubworldbatang)·필사 프리텐다드(k-pretendard), 운영자 지정. 직접 바꾼 글꼴은 책마다 localStorage `fonts:<id>`.
- 2026-10-24: 생성 표지 자리 마련 — 운영자가 GPT로 만든 표지(A5 세로, `docs/typing_cover_prompts.*`)를 폴더에 모아 `.venv/bin/python tools/import_covers.py <폴더>` → `html/img/typing/<id>.webp`(600×848) + index.json `cover` 표시 → 서가·서재 목록이 그림 표지로 바뀜(없으면 CSS 표지). 파일 이름은 <id>.png 또는 작품 제목. 표지 칸은 A5 비율(1:1.414)로 통일.
- 사이트 반영을 운영자 대신 할 때: `ssh interq4@192.168.219.103` 후 `docker run --rm -v /volume1/docker/letsum:/git -w /git alpine/git -c safe.directory=/git pull --ff-only origin main`(패널 '받아와 재배포'와 같은 결과, html은 디렉터리 연결이라 재시작 불필요).
- 2026-10-25: **레트로 타자기 디자인**(data-skin="retro") — 운영자 제공 TYPEBOOK RETRO v1.1.0을 옮김: 캐리지·롤러·레버(줄 안 글자 수만큼 왼쪽으로, Enter면 복귀), 잉크 리본, 명판(LETSUM FILSA·TYPEWRITER)과 상태등, 둥근 키캡 키보드, Web Audio 합성 타건음·Enter 벨(외부 음원 없음), 용지 3종(아이보리·백색·양피지), '필사 인쇄'(이 책에서 쓴 쪽만 A4, `#tbPrintArea` + @media print). 설정은 localStorage `typebook-v1:retro`. 디자인 순서: 몰입 밝게·몰입 어둡게·레트로·책상·잉크. 배치는 `data-layout`(focus = 몰입·레트로 한 단, wide = 책상·잉크 왼쪽 칸)로 색(data-skin)과 분리.
- 2026-10-25: **필사독서 별도 사이트 type.letsum.app** — 필사 화면 원본은 `tools/typing_app.html`(여기를 고칠 것), `html/type/index.html`은 build_pages.js가 만듦(머리글만 필사독서 전용, 경로는 /로 시작). nginx `server_name type.letsum.app`가 `/`에 type/index.html, `/css /js /img /data/typing`은 letsum.app과 같은 파일, 그 밖은 letsum.app으로 301. letsum.app의 `/typing.html`은 type.letsum.app **소개·링크 페이지**(손으로 고침, 숫자·대표 작품은 build_pages.js가 `<!--TI:STATS-->`·`<!--TI:PICKS-->`에 채움, 예전 `#/read/…` 주소는 새 사이트로 넘김), `/type/`은 301. 메뉴 '필사독서'는 소개 페이지. Cloudflare 터널 kuri-nas 경로 type.letsum.app → http://192.168.219.103:8516. 방문 통계(pv.js)는 letsum.app 전용이라 type에는 없음(Cloudflare Web Analytics만). 필사 기록(localStorage)은 주소마다 따로라 letsum.app/typing.html 기록은 넘어가지 않음.
- nginx/default.conf를 바꾸면 '받아와 재배포'만으로는 안 되고 `docker restart letsum-web` 필요(파일 단위 연결).
- 2026-10-25: **생성 표지 474권 적용** — 운영자 폴더 `/Volumes/AI_dev/web/letsum-covers-20261024`(generation-manifest.json의 source_id로 짝지음)를 `import_covers.py`로 `html/img/typing/<id>.webp`(480×679, 약 28MB). 표지 있는 카드(`.tb-card.cov`)는 그림만 보이고 제목·저자·분량·'필사 시작'은 마우스를 올리거나 키보드로 고를 때만(쓰던 책은 표지 아래 진행 막대만). letsum.app 소개 페이지의 대표 작품도 같은 방식.
- 2026-10-25: 표지 카드(`.tb-card.tb-cov` — `.cov`는 사이트의 글자 지원 표시 클래스와 겹쳐 쓰지 말 것) **입체 책** — `.tb-b3`(앞표지 + `.tb-sp3` 책등). 책등 색은 표지 그림 아래 60% 평균을 조금 어둡게(`import_covers.py` → index.json `sc`, 글자색 `si`), 두께는 글자 수 로그(16~34px). 마우스를 올리면 rotateY(40deg)·원근 1800px(yes24와 같은 값, 위가 잘리지 않음)로 돌아가며 책등의 세로 제목·저자가 보이고 아래쪽에 분량 띠. 터치 기기는 회전 없음.
- 2026-10-25: 레트로 아래쪽 명판(LETSUM FILSA·TYPEWRITER)·상태등·잉크 리본·설정 줄 삭제 → 타건음(🔊 켜기·끄기)·음량·용지는 작품 제목 옆 도구 줄(`.tb-retro-tools`, 레트로에서만), '인쇄'는 모든 디자인에서 도구 줄에. 캐리지(위쪽 롤러)는 유지.
- 2026-10-25: 읽기 화면 머리 통합 — `.tb-rh`에 입체 표지(`#tbCv`, 서가와 같은 책등 회전) + 제목·도구(`.tb-rh-body`). 몰입·레트로(data-layout=focus)에서는 `.tb-left/.tb-main/.tb-reading`을 display:contents로 풀어 `.tb-app` 격자에서 머리(왼쪽)와 진행 수치 2×2(오른쪽, 280px)를 한 카드로 나란히(세로 약 150px, 이전의 1/3). 휴대폰은 머리 아래 수치 4칸.
- 2026-10-25: 필사 설정을 헤더 **⚙ 설정** 팝업(`#tbSet`, 읽기 화면에서만 보임)으로 — 글꼴(원문·필사)·글자 크기·레트로 타건음·음량·용지·이 쪽 다시 쓰기·인쇄. 표지 옆(`.tb-rh-body`)에는 도서 정보만(NOW READING/저자·연도·출처, 제목, 목차, `#tbInfo` 갈래·편/장·글자·쪽·저작권)과 그 아래 쪽 넘김(`.tb-pager`).

- 필사 서가 히어로: `tools/typing_app.html` + `html/css/typing-hero.css`, 초원·타자기 이미지 `html/img/typing-hero-meadow.webp`. 원본 생성 이미지 `/Volumes/AI_dev/web/letsum-typing-hero/hero-typewriter-meadow.png`. 문구·버튼은 HTML, 기록은 히어로 아래 6칸(모바일 3×2). 읽기 화면에는 적용 안 함.

- 2026-10-25: **Classic 12 3D 타자기** — 운영자 사진의 SCM 로고·CL 표기를 근거로 Classic 12 계열로 잠정 식별(정확한 연식 미확정). Higgsfield 3D Jutsu 프로젝트 `6c078d37-3501-4fc3-83a1-1a019a5d8c88`에서 부품을 분리해 제작. GLB는 `html/img/typewriters/classic12.glb`, 출처·부품 명세는 같은 폴더 JSON. 실측 CAD/물리 시뮬레이션이 아닌 시각적 재현이며, 영어 실물에 한국어 입력·디지털 편집을 결합함.
- 화면 원본 `tools/typing_app.html`: 레트로에서 모델 선택(3D Classic 12 / 기존 LETSUM 레트로). `html/js/typing-3d.js`가 Three.js r128·GLTFLoader를 같은 도메인에서 지연 로딩. 키캡·40개 활자봉·리본 가이드·캐리지·롤러·복귀 레버와 용지 캔버스가 입력에 연동. `typing.js` carriage에서 `tb:paper` 이벤트를 발행하여 페이지/초안 전환도 반영. 원래 textarea·IME 판정·기록은 그대로 사용. 설정 저장 키 `typebook-v1:model`; CSS `typing-3d.css`로 범위를 한정. 화면 밖·비활성 탭 렌더 중단, 동작 줄이기 설정 존중, WebGL 실패해도 기본 필사 유지.
- 검증: 390px 모바일·데스크톱 실제 브라우저 표시, 모델 전환, 입력·Enter·Backspace 확인. 실제 GLB와 Three.js 수학을 이용한 동작 검사(키 복원·활자봉·리본·캐리지·레버·롤러 축 유지·한글 텍스트 보존) 통과. `validate.py` 오류 0, 기존 경고 264. 로컬 편집 원본 `/Volumes/AI_dev/web/letsum-typewriter-3d/classic12.blend`, Higgsfield revision 4. 이후 다른 실물 기종은 별도 GLB/부품 명세를 만들어 추가해야 함.

- 2026-10-25: 운영자 요청으로 서가 히어로를 imagegen으로 새로 생성한 24:9 이미지(2048×768, `typing-hero-meadow-wide.webp`)로 교체. 가로 폭 유지, 높이는 기존 clamp(620px,56.28vw,780px)의 절반인 clamp(310px,28.14vw,390px), 모바일 310px. 글자·버튼 간격도 축소. CSS v2.

- 2026-10-25: 운영자 지시에 따라 3D 타자기를 좌측 미리보기에서 제거하고 하단 가상 키보드 위치로 이동. Classic 12 선택 시 기존 #tbKb를 숨기고 큰 3D 본체를 표시(실패 시 기존 키보드 복원). 상단 원문·필사는 데스크톱 2열, 모바일 1열. 타자기 클릭으로 textarea에 스크롤 이동 없이 포커스, 키보드 연동 유지. CSS/JS typing-3d v2.
