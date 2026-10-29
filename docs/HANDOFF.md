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

- 2026-10-25: **Hermes 3000 정면 타자기 + 실제 입력용 종이**. 운영자 제공 초기형 참고 이미지 기반의 시각적 재현(실측 CAD 아님), Higgsfield 프로젝트 `97a11171-2038-4d28-837e-087e65dd9170`. GLB와 메타데이터 `html/img/typewriters/hermes3000.*`, 새 모듈 `html/js/typing-hermes.js`. 49개 키·40개 타입바·리본·캐리지·롤러·복귀 레버·Shift 바스켓 분리. 타건음은 기존 합성음을 사용(실물 녹음 아님).
- Hermes는 별도 미리보기 입력을 만들지 않고, 기존 #tbInput을 #tbHermesPaper 안으로 실제 이동. WebGL 정면 직교 카메라로 종이 세 모서리를 투영해 HTML matrix와 캐리지 위치를 맞춤. 종이 하단에 현재 줄을 배치, 이전 줄은 위로 공급. native textarea를 유지하여 한글 IME·커서·선택·키보드 편집·localStorage 기록은 기존 엔진 그대로. 모델/스킨 전환 시 #tbInputHome 뒤로 복원. 실패 시 기존 입력·키보드 표시. 입력 조합 중 캐리지 전진 보류, 확정 후 이동.
- 모델 선택 저장키 `typebook-v1:model-v2`, 기본 Hermes 3000; Classic 12 및 기본 레트로도 선택 가능. typing-3d CSS/JS v3, typing-hermes JS v1. 수정 원본은 계속 tools/typing_app.html. 참고 자료의 인물·홍보 문구는 모델링 근거로 사용하지 않음.
- Hermes 검증: 실제 GLB로 키 눌림·타격점·리본·Enter 복귀·롤러 축, IME 조합 보류, 입력창 복원·값 보존 검사 통과. 최종 Higgsfield revision 3. Blender 원본 `/Volumes/AI_dev/web/letsum-hermes-3000/hermes3000.blend`.

- 2026-10-25: **Hermes 3000 87키 정교화** — 운영자가 87키 텐키리스 선택. 49→87개 키, 40→47개 printable typebar. 외장은 378→468mm(약24%)로 단면을 재설계, root scale 1 유지. 역사적 실물의 정확한 복원이 아니라 Hermes 형태를 참고한 87키 확장 모델임. Higgsfield 최종 revision 6, 원본 /Volumes/AI_dev/web/letsum-hermes-3000/hermes3000-87.blend. GLB 약7MB.
- 연속 곡면·안쪽 립·오목한 키캡·개별 폭의 기능키·각인·노브 리딩 부모 구조 보정. 자체 생성 PMREM 반사 환경, 에나멜 코팅/미세 표면, 금속 반사, VSM 그림자와 접촉 그림자를 사용. 카메라는 좌우 대칭 정면, 키캡 상판이 보이는 높이.
- 종이 padding을 즉시 바꾸던 방식을 없애고 종이 전체를 위로 이송(HTML textarea 높이와 투영 위치 연동). 롤러 회전각=종이 이송거리/18mm. 타격42ms→캐리지58ms, 리턴390ms·줄이송180ms. 한글 조합 중 이송 보류, 확정 때 반영. 기존 입력 노드·기록 유지. context lost 시 기본 입력으로 복원.
- 타건음은 계속 합성음. Hermes에만 눌림/타격/복귀음을 나누고 타격 시점42ms에 맞춤. 줄 끝 근처에서 벨1회, Enter에서는 리턴 소리. 나머지 모델 소리는 유지. typing-hermes.js v2, typing-3d.css v4.
- 검증 node tools/check_typing_hermes.mjs: 실제 GLB/Three.js로 87키·47바·타격점·키복귀·모디파이어·캐리지·IME·종이이송·롤러축·마진벨 중복방지·모델전환·WebGL 복원 검사. 실제 브라우저 데스크톱 입력/Enter, 390px 모바일 표시 확인. validate.py 오류0, 기존 경고264.

- 2026-10-25: 키캡 상판/두께면 명암 보강. typing-hermes.js에서 키캡에만 로컬 높이·법선 기반 vertex color를 적용(밝은 상판, 짙은 스커트/아랫단, 얇은 상단 림 반사). 공유 물리 재질 하나로 draw call 수 유지, 노브·몸체·기존 GLB/타건 기구는 그대로. typing-hermes.js v3. 브라우저 외형 확인 및 기존 타건 회귀 검사 통과.

- 2026-10-25: Hermes 부품 사실 대조. Paillard 3003 B 제조사 설명서(https://site.xavier.edu/polt/typewriters/Hermes3000.pdf)와 Stephen Hanafin의 실물 일련번호3138796 사진(https://typewriterdatabase.com/1962-hermes-3000.17953.typewriter)을 확인. 원형·사용자 참고 시트·87키 확장 설계를 혼동하지 않는다. **기존 기록의 378→468mm, 롤러 반지름18mm, 동작ms는 제작 설정값이며 실물 측정값이 아님.** 키 영역 여백·베젤 두께·노브 홈 개수·정확한 합금/도금 규격은 검증되지 않았다. JSON accuracy/dimensions_status/verified_facts/adaptation_limits에 근거와 한계를 기록.
- 외형: 연속 측벽과 스페이스바 앞 낮은 립, 부채꼴 덮개 개구부, 분리된 캐리지 끝판/베어링, 페이퍼 베일 내부 눈금/마진 표시, 종이 받침/지지대, 투명 카드 홀더, 고정 활자 가이드, 움직이는 리본 캐리어와 좌우 가이드, 흑상·적하 13mm 리본, 가시적인 활자봉 휴지 위치 및 2열 역상 글자를 추가. 마진/종이해제/줄간격 레버의 수동 포인터 조작은 미구현. 눈금 수와 위치는 웹 용지에 맞춘 설계. 실측 복원 또는 내부 탈진기 재현으로 소개하지 말 것.
- 리본 중앙은 캐리어와 함께 올라가고 양끝은 고정 가이드에 유지. 활자봉은 개별 휴지 회전에서 공통 타격점으로 보간. HTML 용지가 뒤쪽 종이 받침을 가리도록 투명 깊이용 mesh를 동기화(텍스트를 중복 렌더하지 않음). 87키 유지. GLB 최종 revision9, typing-hermes.js v4/GLB v3, 편집원본 /Volumes/AI_dev/web/letsum-hermes-3000/hermes3000-verified-v9.blend.

- 2026-10-25: **레트로 몰입** 메뉴 추가(`?skin=retro-focus`, 저장은 기존 skin2). 기존 레트로와 별개 모드이며 data-skin=retro / data-reading-mode=immersive로 구분. `typing-retro-focus.js/.css`는 원문 #tbOrig를 기존 native #tbInput과 함께 Hermes 종이 안으로 이동한다. 별도 초안/입력창 없음. 미입력은 연한 회색, 완료는 짙은 잉크, 오타는 실제 입력 글자를 붉게, 조합 중은 황토색으로 표시. 원문과 필사는 필사 글꼴/동일 줄간격으로 정렬하며 ↵는 원래 줄바꿈을 유지. 긴 글은 종이 내부에서 커서를 따라가고, 선택·초과 입력·Backspace를 유지. WebGL 실패/모드 종료 시 원문과 입력이 각 home 마커로 복원된다.
- 몰입 종이는 고정 표시 높이이며 긴 문장에도 외부 페이지가 늘어나지 않는다. 화면 높이에서 상단/작품정보/하단 도구 높이를 뺀 크기로 무대를 맞추고, 좁고 긴 화면은 종이를 세로로 확장. 별도 원문 카드·표지·통계 패널은 이 모드에서 숨기며 쪽 넘김/글자 수/설정/출처를 유지. 타건·캐리지·리턴·롤러는 기존 Hermes 기구 사용. Hermes 87키를 사용하지만 기존 레트로의 모델 선택 저장값은 바꾸지 않는다.
- 버전: typing.js v21, typing-3d.js v4, typing-hermes.js v5, typing-retro-focus CSS/JS v1. HTML 원본 tools/typing_app.html, 생성 html/type/index.html. node tools/check_typing_hermes.mjs에 몰입 고정 종이·원문 기준 캐리지·IME 보류·원래 종이/초안 복원 검사 추가. 실제 브라우저에서 한국어 190자(줄바꿈 포함), 오타/Backspace, 레트로 기본 모델 왕복 및 390px 모바일 확인. 데스크톱 720/876px 뷰포트에서 문서 높이=뷰포트 높이, 페이지 스크롤0. validate.py 오류0, 기존 경고264.

- 2026-10-25: **Hermes 외장/키캡 마감 보정** — 사용자 지적(하단 돌출판, 스페이스바 주변 절단감)에 따라 Higgsfield revision10. 기존 Cast_Perimeter의 열린 경계320개를 닫힌 연속 단면으로 재제작. 안쪽 벽/하단 복귀면, 일정한 앞쪽 베젤, 같은 모서리 곡률의 매립 바닥판/가스켓을 적용. 원형 실물의 실측 복원이 아닌 기존 87키 모델의 제작상 마감 수정이다. 스페이스바 앞 비대칭 홈 제거, 노출된 장식 연결봉은 키베드 아래로 이동. 키베드도 닫힌 표면으로 제작.
- 87키를 그대로 두고 각 키 폭의 직선부만 늘어나는 일정 모서리 반지름의 키캡으로 교체. 스페이스바는 별도 완만한 볼록 상판, 다른 키는 오목 상판. 글자 메시를 상판 곡면에 투영하여 파묻힘/뜸을 줄임. 몸체 에나멜 반사와 키캡 스커트 명암을 완화, 데스크톱 그림자 해상도2048, 접촉 그림자 범위를 본체 크기에 맞춤. 원본 finish-continuous-v10.py / hermes3000-finished-v10.blend, 정면/낮은 측면 렌더는 /Volumes/AI_dev/web/letsum-hermes-3000/.
- GLB v4(7,702,588bytes), typing-hermes.js v6. tools/check_typing_hermes.mjs에서 실제 GLB의 외장/바닥판/키베드/키캡 열린 경계 및 바닥판 범위 검사를 추가; 기존 87키/47바/IME/종이/모드복원/WebGL 회귀 검사 통과. 실제 웹 렌더와 스페이스바·Backspace 입력 확인. 레트로와 레트로 몰입이 같은 개선 모델을 사용한다.

- 2026-10-25: 레트로 몰입 글자 비율/크기 및 독서 패널 개선. Hermes 종이는 기존 표시 크기와 타자기 +15% 구도를 유지하며, 종이 투영으로 눌리던 원문/입력 글자는 역방향 세로 보정을 같이 적용해 최종 가로·세로 배율을 동일하게 함. --tb-size는 documentElement에 저장되므로 getComputedStyle(main)에서 상속값을 읽도록 수정. 몰입 별도 trace-font 설정은 기본14px/최소10px/최대28px, 일반 모드는 기존 font 설정 유지. 논리 글자 최소28px 제한 제거. 원문과 native 입력의 높이/변환/스크롤 일치.
- 좌측 실제 도서 표지/제목/저자, 우측 실제 b.pages[i+1] 본문 미리보기 추가. 쪽 변경 시 내용 갱신; 현재 쪽 완료 전 이동 제한과 마지막 쪽 안내 유지. 패널은 종이·캐리지 이동 여유를 남겨 배치하며 좁은 화면은 하단 두 칸. 모바일 빈 무대 높이 축소. typing.js v22, typing-hermes.js v10, typing-retro-focus.js/css v2. 브라우저에서 10px 조절, 미리보기/실제 다음 본문 일치, 마지막 쪽, 기본 레트로 복원, 모바일 확인. 원본 tools/typing_app.html.

- 최초 로딩/창 크기 변경 후 tb:hermes-layout 이벤트로 종이 투영이 확정된 뒤 좌우 패널 폭을 재계산. 세로가 긴 데스크톱에서는 양측 패널과 캐리지 이동 공간을 확보하도록 카메라 최대 배율을 제한. 최종 typing-hermes.js v11 / typing-retro-focus.js v3.

- 2026-10-25: 몰입 좌우 패널 20% 확대(표지 최대200→240px, 다음 쪽226→271.2px). 좌측 제목12px/저자10px. 다음 본문11px 기본, 실제 내용·폭·글꼴 변경 시 8px까지 자동 맞춤 후 필요한 경우 종이 높이를 늘려 본문 내부 스크롤과 잘림 방지. 확대 패널용 캐리지 여유 공간 보정. typing-hermes.js v12 / typing-retro-focus.js v4 / CSS v3. 1280×720에서 표지240px, 다음 쪽271.2px, 다음 본문 scrollHeight=clientHeight, 문서 높이720 확인.

- 2026-10-25: 사용자 표시 영역에 따라 Hermes 상단 Esc/F1–F12/PrtSc/Scroll/Pause 및 우측 탐색/방향키 26개와 하위 cap/glyph/stem을 제거, 61키 5줄로 재배치. 남은 키는 1.28 등방 확대(문자 왜곡 없음), 본체 폭/베젤/종이/카메라 크기는 유지. 키 영역 중앙 정렬, 확대된 키의 베젤 안쪽 범위·간격 검증. 실제 키보드의 방향키/Delete 편집은 native textarea가 그대로 처리.
- Higgsfield project 97a11171-2038-4d28-837e-087e65dd9170 revision11, GLB 7,294,284bytes. 편집 원본 /Volumes/AI_dev/web/letsum-hermes-3000/hermes3000-61-v11.blend, 변환 스크립트 compact-61-v11.py. typing-hermes.js v13 / GLB v5, 모델 선택·aria·JSON 61키로 갱신. node tools/check_typing_hermes.mjs: 삭제 노드 부재, 61키 등방 배율/중앙/베젤 범위 및 기존 47타입바·IME·캐리지·종이·모드 복원·WebGL 검사 통과. 레트로/레트로 몰입 실제 웹 외형 확인. 제작 치수·배율은 웹용 설계값이며 역사적 실물 복원이 아님.

- 2026-10-25: 운영자 요청으로 Hermes 리본의 아래쪽 빨간 띠도 기존 위쪽 검정 직물 재질로 통일. 두 리본 mesh의 형상/타건 리프트 유지, 마진 표시와 리본 선택기 점은 유지. 웹 재질 오버라이드로 적용, GLB는 그대로. typing-hermes.js v14.

- 2026-10-25: A4 하단 접촉 그림자 추가. .tb-hermes-paper::after의 44px 페이드와 아래쪽 외부 그림자로 플래튼에 닿는 종이 끝을 표현. 종이 투영/이송을 함께 따라가며 pointer-events:none으로 입력 유지. typing-3d.css v5, 레트로/레트로 몰입 공통.

- 2026-10-25: Hermes 미세 도장 질감 보강. 고정 시드 256px 표면 노이즈로 에나멜의 색/거칠기/미세 요철을 약하게 변화시키고 키캡 요철은 더 약하게 적용. UV에 붙는 정적 질감이며 mipmap으로 축소 시 반짝임 억제. 종이·활자·배경에 노이즈 없음. typing-hermes.js v15.

- 2026-10-25: 레트로 몰입 상단 중복 작품 제목/쪽 넘김 줄 제거(Hermes 준비 완료 시). 실제 목차·출처·이전 쪽·현재/전체 쪽 노드를 좌측 표지 아래로 이동하고 우측 다음 쪽 버튼 유지. 다른 모드나 WebGL 실패 시 home comment 위치로 원래 컨트롤 복원; 핸들러·진행 제한 그대로. 상단 줄 높이만큼 종이 무대가 자동 확장. typing-retro-focus.css v4 / js v5. 실제 브라우저에서 12장 도서 목차 이동·이전/다음 쪽 이동·스킨 왕복 복원 확인, Hermes 회귀 검사 통과.

- 2026-10-25: Enter/자동 줄바꿈 동작 보강. 몰입 모드 캐리지는 실제 원문 span의 DOM offset으로 줄/열을 판단(폰트·브라우저 줄바꿈 반영). 확정 입력이 다음 줄로 이동하거나 개행을 삽입하면 복귀 레버+캐리지390ms+롤러 회전+복귀음1회를 실행. 복귀 도중 다음 타자를 입력하면 이동 완료 후 해당 열로 전진하여 복귀가 잘리지 않음. 키다운만으로 리턴하지 않아 IME 확정 Enter 오작동 방지; Hermes Enter 소리는 입력 확정 이벤트로 통합. 클릭·삭제·리사이즈·페이지 복원에는 리턴 없음.
- 전체 A4를 보이게 하는 기존 요청을 유지하기 위해 몰입 용지는 최대8mm(모델 좌표) 짧게 이송 후520ms 내 읽기 위치로 복귀하며 롤러 회전은 누적. 실물처럼 용지를 계속 위로 누적 공급하는 방식은 일반 레트로에 유지. reduced-motion 존중. typing-hermes.js v16 / typing.js v23. tools/check_typing_hermes.mjs에 DOM 자동랩·빠른 타이핑·중복음 억제·IME 확정·페이지 복원 회귀 검사 추가/통과. 브라우저에서 실제31번째 글자 자동랩 후 좌우 복귀 위치, 문단 Enter 후 레버/용지 이송 확인.

- 2026-10-25: 사용자 참고 이미지의 옅은 세이지 바탕/청회색 가는 체크 테이블보를 Hermes 바닥에 추가. 256px 고정 시드 직조 텍스처를 3D 평면에 반복, 모델 단위 체크 간격20mm, 좌우·앞으로 길게 확장. 낮은 화면에서도 보이도록 뒤쪽 경계를 본체 뒤로 배치. 천 앞부분에 미세한 굴곡, 거친 무광 재질, 기존 조명과 실제 캐스트/접촉 그림자 수용. 파일 다운로드·이미지 생성 비용 없이 코드로 생성. 타자기/종이/키 동작·크기는 유지. typing-hermes.js v17, 실제 몰입 화면 및 WebGL 오류 없음 확인, 타건 회귀 검사 통과.

- 2026-10-25: 사용자 빨간 표시선에 맞춰 테이블보 뒤쪽 경계를 +0.30 모델 단위 이동(본체 덮개 중간 높이부터 표시). 3D 캔버스를 뷰포트 좌우 끝까지 확장하고 직교 카메라의 좌우 frustum/HTML 종이 투영을 보정하여 기존 본체·종이 크기 유지. 무대의 세로 crop은 clip-path로 유지하고 좌우만 bleed 허용. 넓은 화면은 천 폭/텍스처 반복을 함께 확대하여 체크 간격 유지. typing-hermes.js v18 / typing-3d.css v6. 브라우저 canvas bounds 0~1280px, 문서 scrollWidth=1280 확인. 종이 투영 불변 회귀 검사 추가.

- 2026-10-25: 운영자 요청으로 94ad8b19의 Enter/자동 줄바꿈 모션 보강을 이전 동작으로 복원. DOM 기반 줄바꿈 감지·짧은 A4 이송/복귀·복귀 중 후속 타자 대기·확정 이벤트 복귀음을 되돌리고 기존 키다운 Enter/원문 측정 기반 동작 유지. 이후 추가한 체크 테이블보, 낮춘 시작선, 좌우 full-bleed 및 종이 투영 보정은 유지. typing-hermes.js v19 / typing.js v24. 기존 동작과 full-bleed 회귀 검사 유지.


### 2026-10-25 — 실제 녹음 타자기 소리
- 합성 tone/noise를 제거하고 `typing-audio.js`에서 10개 CC0 녹음(총 약 104KB)을 자체 호스팅해 재생. 타건은 Hermes 3000 6개 구간, 벨·공백은 Hermes Precisa 305, 캐리지 ramsamba, 종이 LilMati. 정확한 모델·라이선스·편집 구간은 `html/data/typing/audio/credits.html`과 `segments.json`. 모든 소리를 Hermes 3000 원음이라고 부르지 않음.
- 실제 입력 변경과 화면의 원문 행 위치로 줄 끝 벨/줄바꿈 복귀 재생. IME 확정 Enter만으로는 복귀 안 함. 페이지 이동은 `tb:page-loaded`로 소리·행 기준 초기화, 성공한 쪽 변경에만 종이 소리. 소리 OFF·음량 0·스킨 이동·숨김 때 진행 중/대기 소리 취소. 오디오 실패 시 합성음 대체 없음. 기존 모션 및 테이블보 배치는 변경하지 않음.


### 2026-10-25 — 테이블보 선택 / 크림 잔꽃
- 설정 → 레트로 타자기에 테이블보 선택 추가: 크림 잔꽃(기본), 세이지 체크(기존), 내추럴 린넨. `retro.table`을 기존 브라우저 설정에 저장하고 `data-table`로 즉시 3D 바닥 재질만 변경. 기존 설정에 table 값이 없으면 잔꽃으로 표시.
- 참조 사진의 크림색 직물·작은 노란/살구색 꽃·올리브 잎을 코드로 그린 반복 텍스처로 표현. 타일 경계의 꽃/잎은 반대편으로 이어 그리며, 패턴 크기와 좌우 확장·바닥 시작 위치·그림자·종이 위치 유지.


### 2026-10-25 — 효과음 반응 지연 수정
- 오디오 준비·디코딩을 스킨 진입/설정 시 미리 수행. 준비된 녹음 재생은 await 없는 동기 경로, 현재 AudioContext 시간에 바로 예약. 타건 12ms·복귀 25/100ms 추가 지연 제거. cold/resume 중 입력은 나중에 몰아서 재생하지 않음. 입력 포커스/포인터로 컨텍스트 재개.
- 파일별 실측 앞부분 공격음 오프셋(6~50ms)부터 재생하여 무음/준비 잡음 축소. 파일과 음높이·자연 잔향 유지. 실제 출력 장치의 버퍼/블루투스 지연까지 0ms라고 주장하지 않음.
- input/compositionend에서 기존 원문 span을 이용해 즉시 행 판정(전체 화면 refresh와 localStorage 저장 뒤 microtask 대기 제거). 쪽 소리는 `tb:page-changing`에서 화면 갱신 전 시작하고 loaded 이벤트는 기준만 초기화.


### 2026-10-25 — 잔꽃 색감 재보정
- 첨부 확대 이미지의 실제 픽셀과 렌더 화면을 비교: 기존 화면의 주 바탕 RGB(236,233,227)는 참조 크림색(약233,222,190)보다 푸르고 희었음. 잔꽃 albedo를 조명/ACES 적용 후 색 기준으로 보정하고 살구·노랑 꽃잎 및 올리브 잎 대비·밀도를 높임. 체크·린넨 재질과 타자기 조명은 유지.


### 2026-10-25 — 몰입모드 하단 띠 제거 / 창 안 글자 수
- 하단 안내·종이에 쓰기 버튼 삭제. 진행 글자 수는 첨부에서 지정한 고정 카드 홀더의 검은 칸 내부에 표시. 움직이는 캐리지와 혼동하지 않으며 화면 크기에 따라 칸에 맞춰 조절. 상태 문구는 스크린리더에만 유지.
- 몰입모드 종이 커서가 초기 위치부터 깜빡이고, 입력 포커스 가능한 상태에서 진입 시 실제 textarea도 포커스. reduced-motion에서는 커서 고정. 하단 컨트롤 높이와 8px 여백을 빼던 fit 계산 제거, 화면 끝까지 테이블보를 채움.

- 후속 시각 검증: 숫자를 HTML 오버레이 대신 실제 카드 홀더 내부 3D 표시판 CanvasTexture에 인쇄하도록 변경. 표시판과 왼쪽 홀더는 고정 카메라의 시선 방향으로 전진시켜 외곽 위치를 유지하면서 이동 노브 앞에서 숫자를 읽을 수 있게 함. DOM 글자 수는 접근성용으로 유지.

### 2026-10-25 — 차분한 레트로 톤 / 허니 브라운 체크
- 첨부 1의 크림색 종이·따뜻한 저채도 재질을 기준으로 레트로 몰입 배경/종이/잉크를 웜 그레이·아이보리·짙은 갈색으로 조정. 텍스트 전체 필터 없이 용지 배경에만 미세 섬유 질감 적용, 백색/양피지 선택 유지.
- Hermes 조명 노출 .94→.86, 주광 1.65→1.30, 따뜻한 보조광 및 부드러운 그림자. 에나멜·키캡 저채도화, 금속/도장의 거칠기 증가와 clearcoat 감소. 형상·타건·음원·입력 동작 변경 없음.
- 첨부 2의 황토/허니 바탕, 넓은 브라운 띠, 짙은 교차점, 이중 가는 실선을 주기형 DataTexture로 재현. 원근에서 무늬가 부자연스럽게 늘어지지 않도록 직물 좌표에서 사선 체크를 계산하고 직조 밝기 차이 반영. 기존 전폭 테이블 영역 유지.
- 설정 > 테이블보에 '허니 브라운 체크' 추가, 신규 사용자 기본값. 저장된 다른 테이블보 선택은 유지. 기존 크림 잔꽃·세이지 체크·린넨 선택 가능.
- 로컬 실제 렌더/선택 유지 확인, check_typing_hermes 전체 통과. 템플릿 캐시: typing.js v28, typing-hermes.js v24, typing-retro-focus.css v6.

### 2026-10-25 — 테이블보 10% 아래로
- 레트로 몰입의 테이블보 시작점을 타자기 뷰 높이의 10%만큼 아래로 이동. 고정 카메라 투영값에서 지면 z 이동량을 계산하여 창 크기 변경에도 동일 비율 유지. 종이·타자기·패턴 크기와 좌우 전폭 유지. typing-hermes.js v25.

### 2026-10-25 — 상판 곡면 / 개구부 비례 보정
- 사용자 첨부 정면·사선 참고의 상판 감싸는 형태에 맞춰 Ribbon_Hood GLB 메시를 보정. 전면 크라운 높이 증가, 안쪽으로 좁아지는 양옆 곡면, 활자 바스켓 앞쪽을 덮는 apron 확장. 고정 외곽폭·밑단·후방 타격 목 부분 및 키/캐리지 구조는 유지. 명판/선택부를 새 전면 높이에 맞춰 이동.
- 법선은 변형 Jacobian 역전치로 보정; GLB accessor bounds 재계산. tools/refine_hermes_hood.py에 재현 절차 보관(원본 v11 GLB 입력, 중복 변형 거부). 사진 비례에 따른 웹 모델 수정이며 실물 치수 재현으로 표기하지 않음. 기존 Blender v11 원본은 변경하지 않음.
- 상판을 기존 닫힌 메시 검사에 추가해 통과. 실제 브라우저 초기/30자 캐리지 이동 화면과 기존 입력·타건 검증 통과. GLB revision12/cache v6, JS v26.

### 2026-10-25 — 종이·타자기와 양옆 페이지 상단 정렬
- 레트로 몰입에서 다음 페이지 실제 상단을 측정해 중앙 종이 상단을 맞추고 타자기 전체를 함께 이동. CSS --tb-focus-sheet-top 변경 시 카메라 재정렬, 좁은 화면의 패널 하단 배치에서는 기존 16px 유지. 테이블보 시작 위치는 카메라 이동을 역보정해 유지.
- 브라우저에서 표지/중앙 종이/다음 페이지 top 모두 164.5px 확인(기존 중앙118px). 입력·캐리지 검증 통과. typing-hermes.js v27 / typing-retro-focus.js v7.

### 2026-10-26 — 효과음 온오프 / 볼륨 설정 명확화
- 작은 스피커 아이콘을 '효과음 켜짐/꺼짐' switch로 교체. 별도 볼륨 행에 0~100% 전체 폭 슬라이더와 실시간 퍼센트, 0% 음소거 접근성 설명 제공. 타건·벨·캐리지·종이에 공통 적용.
- 기존 오디오 master gain/configure/stop 경로와 localStorage retro 설정 유지. 음량값 범위 정규화. OFF 시 재생 중 소리 중지 및 슬라이더 비활성화, 다시 켤 때 기존 볼륨 유지.
- 로컬 UI: 67%로 변경→OFF→새로고침 후 OFF/67%/disabled 유지, ON 후 활성화 및 Home 키 0% 음소거 설명 확인. 운영 사용자 볼륨 값은 임의 변경하지 않음. style.css v109, typing.js v29.

### 2026-10-26 — Olivetti Lettera 32 모델 선택 추가 (Codex)
- 모델 선택을 본체 아래에서 **설정 > 레트로 타자기**로 이동. Hermes 3000 / Olivetti Lettera 32를 일반 레트로와 레트로 몰입 양쪽에서 선택·저장한다. 기존 Classic 12/기본 레트로는 일반 모드에 보존.
- `typing-lettera.js`는 새 외곽 몸체·분리 상판·좁은 리본 개구부·낮은 검정 키캡·밝은 각인·검정 노브·금속 눈금·곡선 리턴 레버·분할 명판을 제작. `hermes3000.glb`의 공유 입력/기계 리그 위에 전용 형상을 구성한다. Hermes 원본 GLB는 수정하지 않음.
- 사실 근거와 웹 재구성 범위: `docs/LETTERA32_MODEL.md`. 제조사 British Olivetti 안내서 실물 사진/부품 번호/재질/사양 확인. 실물 측정 CAD나 Lettera 전용 녹음으로 표방하지 않음. 기존 61키 현대 입력, A4, 검정 리본, 카운터·효과음·테이블 설정 유지.
- 모델 변경 때 이벤트·Resize/MutationObserver·프레임·GPU 자원을 해제. 필사 입력값 보존, 로딩 중 재선택 및 이전 모델 WebGL 실패 후 다른 모델 복구 지원.
- 버전: typing-3d.css v9, typing-3d.js v5, typing-hermes.js v28, typing-lettera.js v1. 템플릿 원본과 생성 페이지 동기화.
- 검사: `node tools/check_typing_hermes.mjs` 및 `--lettera` 각각 통과(IME, 타건, 캐리지, 종이, 폐곡면, 반복 전환/리스너 중복/오류 복귀). `validate.py` 오류0 / 기존 경고264. 실제 로컬 브라우저 선택·새로고침·왕복 전환 후 입력30자 유지, 캔버스1개 확인. 별도 1132×873 iframe에서 한글25자 입력과 전체 모델 시각 확인.

### 2026-10-26 — Olympia SM3 세 번째 모델 (Codex)
- 설정 > 레트로 타자기 > 타자기 모델에 Olympia SM3 추가. 일반 레트로/레트로 몰입 양쪽에서 선택·저장, 기존 Hermes/Lettera와 같은 입력·용지·소리·테이블 설정 공유.
- `typing-olympia.js`: 독립 외곽/상판/앞쪽 apron, 올리브 그레이 미세 crinkle, 짙은 녹색 두꺼운 오목 키캡, 상·하 크롬 테두리, 오른쪽 필기체 마크, 단일 종이 지지대, 홈 노브, 곡선 리턴 레버, 중앙 가이드와 고정 세그먼트 분리 제작.
- 제조사 SM3 사용설명서 4개 펼침면 확인: Shift는 바스켓이 아니라 캐리지 상승. SM3에서 캐리지/종이/깊이 마스크를 함께 올리고 양쪽 Shift 유지 처리. 사실 근거와 61키 웹 적용 한계는 `docs/OLYMPIA_SM3_MODEL.md`.
- 공유 GLB 원본은 변경하지 않음. 입력값 보존·모델 교체 자원 정리 유지. 버전 typing-3d.css v10 / typing-3d.js v6 / typing-hermes.js v29 / typing-olympia.js v1.
- 회귀 검사에 SM3 전용 Shift·단일 지지대·외장/재질 및 세 모델 왕복 전환 추가. 기존 키 입력·IME·종이·타격점·실패 복구 검사 유지.

### 2026-10-26 — SM3 외장 간섭 / 재질·금속 마감 보강
- 노브와 본체 겹침: SM3 후면 어깨·상판을 연속 곡면으로 낮춰 캐리지 이동 공간 확보. 종이·타격점·기계 리그 위치는 유지. 실제 정점으로 구한 노브/플래튼/프레임/양끝 지지부 경계를 좌우 전체 범위에서 외장과 레이 검사하는 회귀 항목 추가.
- 짙은 회녹색 도장, 미세 bump+albedo+roughness, 측면 UV 높이 보정(세로줄 제거), 상판 크라운 보강. 검녹색 키의 clearcoat/roughness를 SM3 전용으로 분리하고 각인 식별성 개선.
- 크롬 띠를 타원 단면과 하부 이음새로 변경, 전용 금속 재질/반사 환경, 로고 양각 두께·하부 그림자 보강. 이전 모델 재질 값 유지.
- typing-olympia.js v2 / typing-hermes.js v30. 상세 근거 및 측정값이 아닌 제작값 구분은 OLYMPIA_SM3_MODEL.md.

### 2026-10-26 — Lettera 32 곡면·베젤·광택 보강
- 외장 loft를 직선/곡선 구간별 대응 정점으로 연결해 앞 모서리의 비틀린 면 제거. 키 바닥 둘레 여유, 후면 캐리지 통로, 별도 전면 apron과 상판 연속 이음새 구성.
- 전면 경사→평탄한 상판 전환과 좌우 크라운 보강. 원래 bevel 법선을 곡면 기울기로 변환해 반사 삼각 패치 축소. 상판 UV/측면 둘레·높이 UV 정리.
- Lettera 도장 clearcoat/roughness를 공통 무광 보정에서 분리. 별도 창 반사, 극미세 bump만 적용. 낮은 검정 오목 키캡·선명한 각인·키 링크 밝기 조정. 다른 모델 재질·종이 좌표·입력 배열 유지.
- 버전 typing-lettera.js v2 / typing-hermes.js v31. 전용 광택·법선·캐리지 간격 회귀 검사 추가. 근거와 사진 기반 표현 한계는 LETTERA32_MODEL.md.

### 2026-10-26 — 우드 테이블 추가
- 설정 > 레트로 타자기 > 테이블에 '우드 테이블 · 내추럴' 추가. 기존 retro.table 저장·복원 경로에 wood 허용. 기존 체크/잔꽃/린넨 선택 유지.
- 사용자 제공 740×740 나뭇결 PNG를 `html/img/typewriters/table-light-wood.png`에 변경 없이 보관하고 TextureLoader로 필요할 때 한 번 로드. MirroredRepeatWrapping으로 경계를 연속 연결하고 기존 전폭 배치/시작 위치/그림자 유지.
- wood에서는 천 굴곡을 평면으로 바꾸고 무광 목재 재질 사용, 천으로 전환하면 기존 굴곡·재질 복원. 원본 평균색 RGB(236,202,169)에 비해 초기 렌더가 RGB(229,216,199)로 희고 푸르게 보여 wood 재질에만 조명/ACES 색 보정 적용. 나무 수종을 추정해 명명하지 않음.
- 회귀 검사: 원본 이미지 단일 로드·반복 연결·전폭 크기·평면 전환·천 굴곡 복원. 로컬 실제 선택 및 새로고침 유지 확인. 버전 typing.js v30 / typing-hermes.js v32.

### 2026-10-26 — 레트로 몰입 왼쪽 도서 하단 통계
- 기존 `.tb-stats` 노드 전체를 `tbFocusStats`로 이동하여 읽기 진행률/진행 바, 분당 타수, 정확도/오타, 필사 시간을 2×2로 표시. 별도 카운터나 중복 ID를 만들지 않고 기존 입력·시간 집계 그대로 연결. 모드 이탈 시 anchor 위치로 복귀.
- 표지·도서 정보·목차/출처·쪽 이동 아래에 배치. 레트로의 낮은 채도·세리프 숫자 유지. 780px 이하 데스크톱 높이에서는 간격을 줄이며 좁은 화면에서는 기존 하단 패널 흐름 사용.
- 실제 브라우저: 레트로 왕복 전환 후 통계 ID 1개, 부모 복귀/재배치 확인. 입력 150→151자에서 정확도 갱신 및 원문150자로 복구. 1280×720에서 통계 하단714px로 화면 내 표시. validate 오류0/기존 경고264.
- typing-retro-focus.css v7 / typing-retro-focus.js v8. 원본 템플릿 및 생성 페이지 동기화.

### 2026-10-26 — Olympia 상판 얼룩·로고 금속 마감
- 상판 법선을 곡면 변형식으로 변환하여 삼각형 반사 패치 제거, 분할 보강 및 뒤 개구부 베벨 간격 확보. 외곽 loft의 모서리 대응 보정. 도장 bump .00085→.00030, 색 편차 축소.
- Olympia 로고를 닫힌 둥근 사각 단면(평평한 전면/모서리/측면)의 입체 획으로 교체. 독립 금속 재질 및 곡면 추종 배치, 끊어진 획은 분리. 실제 상판과의 간격 레이 검사 추가.
- 세 모델 동작 회귀 검사 통과. 로컬 화면에서 로고 전체 가시성과 상판 음영 확인. typing-olympia.js v3 / typing-hermes.js v33.

### 2026-10-26 — 기본 레트로 몰입 · 타자기 선택 갤러리
- 첫 진입 기본 retro-focus, 명시적 skin 쿼리 존중. native dialog에서 Hermes/Lettera/SM3를 비교 후 선택. 종이+실제 구현 모델 렌더 3열, 좁은 화면 1열. 선택 전 엔진 gate와 modal inert, 필사 시간 중단. 재진입/취소/설정 재선택 및 기존 draft 유지.
- Larry McMurtry / Cormac McCarthy / Woody Allen 사용 모델 근거와 인물 사진·크레딧 연결. 원본 세대와 인물 소유 개별 기기의 동일성은 단정하지 않음. TYPEWRITER_GALLERY.md에 근거·사진 조건·렌더 절차 기록.
- 확인: 기본 서가 및 직접 필사 진입, 모드 왕복/취소, 설정 재선택 후 입력150자 유지·canvas1개·ready true. 390px 모바일 1열 실제 화면 확인. 기존 Hermes 동작 회귀 검사 통과.
- typing.js v31 / typing-hermes.js v34 / 새 typing-model-gallery.js·css v1. 원본 템플릿과 생성 페이지 동기화.

### 2026-10-26 — 선택형 실제 종이 이송
- 설정 → 레트로 타자기 → **실제 종이 이송** 스위치 추가. 기본 OFF, 기존 retro 저장 객체의 paperFeed 불리언으로 지속. 세 3D 모델의 레트로/레트로 몰입에서 공통 지원.
- ON: 첫 줄을 플래튼 위 타격선에 두고, 자동 줄바꿈/원문의 개행을 넘을 때 종이와 플래튼을 함께 이송. 숨겨진 종이 꼬리가 본체를 가리거나 문서 스크롤을 늘리지 않도록 노출 높이와 depth mask만 갱신. IME 조합 중 이동 보류, 긴 원문은 A4 높이에 맞춰 다음 용지 구간으로 이어짐.
- OFF: 전체 A4 표시와 기존 커서 추적 복원. 초안/모델/용지 폭 유지. 프레임과 타자기 위치는 기존과 동일.
- 검증: check_typing_hermes.mjs에 첫 줄/동일 줄/자동 줄바꿈/IME/다음 용지/OFF 복원 검증 추가, Hermes·Lettera·Olympia 모두 통과. 로컬 브라우저 토글·새로고침 저장·큰 글꼴 이어쓰기 확인.

### 2026-10-26 — 모바일·세로 태블릿 기본 구도
- 레트로 몰입에서 600px 이하 화면 또는 1100px 이하 세로 화면은 종이·타자기·테이블을 한 화면 높이로 표시. 본체와 A4를 자르지 않는 별도 직교 카메라 프레이밍, 캐리지 이동 중 화면 중심을 일부 따라가 좁은 화면의 가장자리 보존.
- 글로벌 헤더/전체 도구막대는 접고 서가·화면·설정 도구만 작게 유지. ‘화면’에서 기존 디자인/가져오기/도움말 접근. 표지·다음 쪽·진행 통계는 첫 장면 아래에서 그대로 사용. 모드 종료 시 기존 레이아웃 복원.
- 세로로 긴 화면에서도 테이블 끝/카메라 근접면에 패턴이 잘리지 않도록 테이블 깊이·직교 카메라 거리 보정. 실제 종이 이송 선택은 유지.
- 확인: 390×844 및 768×1024 브라우저 프레임에서 기본 구도/메뉴/설정/하단 정보 확인. 세 모델에 390×844·768×1024·1024×1366 전체 용지·본체·캐리지 범위 검증 추가, 기존 회귀검증 통과.

### 2026-10-26 — 세 모델 외형 재점검·키캡/금속 마감
- 공통 `typing-details.js` 추가: 닫힌 곡면 키캡, 긴 키의 중앙 크라운 유지, 접선 기반 연속 법선, 오목한 면을 따라 각인 배치. 키 피벗/61키 배열/종이·IME 좌표는 유지.
- Hermes 외장 완만한 경계 법선 연결, 도장 광택/미세 요철 조정, 금속 명판 테두리·인레이·양각 두께. Lettera 외장 샘플과 공유 모서리 기반 상판 분할, 커버 이음새, 분할 명판 금속 backing. Olympia 외장 샘플 보강, 키 광택 및 활자봉/팁/분리판 재질 차등.
- 선택용 세 모델 썸네일 재렌더. typing-hermes v37 / typing-lettera v3 / typing-olympia v4 / typing-details v1 / preview v3.
- 세 모델 회귀 검사 통과: 닫힌 형상·키캡 정상 법선/중앙 표면, 입력·종이 이송·모델 교체·세로 화면 범위. 브라우저 정면/사선 렌더 확인. 사실 근거·남는 실측 한계는 `TYPEWRITER_DETAIL_REVIEW.md`.

### 2026-10-26 — 필사독서 선택 회원(카카오·네이버·구글) · 기록 동기화 · 찜 · 나의 학습
- **운영자 결정으로 2026-10-26 즉시 시행**(처음엔 7일 뒤 11-02로 잡았으나, 기존 이용자에게 불리하지 않은 선택 기능 추가라 공지일 시행으로 변경 — 약관 8항에 예외 문구 추가). `AUTH_FROM` 이전에는 `/api/auth/status`가 `{open:false}`.
- 네이버는 검수 승인 전이라 `AUTH_PAUSED = "naver"`(wrangler.toml) → 로그인 창에 '네이버 로그인 · 준비 중' 비활성 버튼. 승인 후 `AUTH_PAUSED = ""`로 비우고 `npx wrangler deploy`.
- 서버: `worker/src/account.js`(라우트 `type.letsum.app/api/*`), D1 `0008_accounts.sql`(tb_users·tb_sessions·tb_data), 매일 크론 `17 3 * * *`(만료 세션·2년 미접속 회원 삭제). 회원 ID는 `HMAC(AUTH_SALT, 제공자:고유번호)`만, 세션은 쿠키 값의 SHA-256만 저장. 이메일·이름 받지 않음.
- 클라이언트: `html/js/typing-sync.js` — 로그인 창(만 14세·동의 체크 필수), 계정 창(지금 동기화·내 데이터 내려받기·로그아웃·탈퇴). 45초마다(보이는 동안)·창 숨김 시 동기화.
- 서버 키: `p:<책id>`(쪽 번호·완성 쪽 구간·지금 쓰는 쪽 초안·t), `days`·`points`·`marks`·`learn`·`last`·`prefs`. 합치기: 완성 쪽 합집합, 날짜별 값 큰 쪽, 찜은 책마다 최근(음수 = 해제), 설정·마지막 책은 최근. 가져온 글(import-*)은 보내지 않음.
- 새 기능(로그인과 무관): 서가 카드 ♡ 찜 + 갈래 '♥ 찜한 책', 상단 `📈 나의 학습`(날짜별 글자·정확도·시간, 30회 이상 친 글쇠의 오타율). 저장 키 `typebook-v1:marks`·`typebook-v1:learn`.
- 앱 등록 현황(10-26): 구글 = 프로젝트 letsum-512005 웹 클라이언트·프로덕션 게시 완료 / 카카오 = 앱 1622658 "LETSUM 필사독서"(로그인 ON, 닉네임 선택 동의, 클라이언트 시크릿 ON) / 네이버 = 운영자가 직접 등록(별명 추가 동의, PC 웹), 검수 필요.
- 운영자 몫(보안상 직접): 개발자 앱 등록 → 리디렉션 URI `https://type.letsum.app/api/auth/<kakao|naver|google>/callback` → 클라이언트 ID는 `worker/wrangler.toml` vars에, 비밀값은 `npx wrangler secret put NAVER_CLIENT_SECRET`·`GOOGLE_CLIENT_SECRET`(·`KAKAO_CLIENT_SECRET` 선택). `AUTH_SALT`는 설정 완료(바꾸면 기존 회원과 연결이 끊김).
- 로컬 시험: `npx wrangler dev --port 8787 --local-upstream type.letsum.app --var AUTH_FROM:2020-01-01 --var AUTH_SALT:… --var KAKAO_CLIENT_ID:dummy` + 정적 파일과 /api를 함께 내주는 프록시(Origin을 https://type.letsum.app으로). 동기화·다른 기기 복원·병합·탈퇴(서버 0행) 확인.
- 비용: Workers 무료 10만 요청/일, D1 무료 읽기 500만·쓰기 10만 행/일. 넘으면 요청이 실패할 뿐 과금 없음(무료 플랜).

### 2026-10-26 — 몸체 비율·홀더·종이 바깥 진행 표시
- 세 모델 몸체/키/타격 리그를 타격점 중심으로 균등 0.9배, X축 3도 기울여 약간 위에서 내려다보는 구도로 변경. 캐리지와 종이는 독립 유지하여 용지 폭/입력 폰트/타격점 유지. Lettera/SM3 후면 외장·이음새는 캐리지 전체 이동 간격을 확보하도록 완만하게 보정.
- 용지 앞 좌우 Card_Holder는 안쪽 타격 간격과 끝 윤곽·높이를 유지하면서 중앙 직선 구간만 늘려 각각 가로폭 10% 확대. 이전 진행 숫자용 입체 플레이트와 좌측 홀더의 앞쪽 돌출 보정 제거.
- 글자 수 DOM을 종이 바깥 우측 상단으로 이동하고 종이 이동에 동기화. 옆 패널/좁은 화면과 겹치는 경우 우측 상단 바로 위로 배치. 종이 텍스트처럼 확대·축소하지 않아 가독성 유지.
- 회귀 검사: 균등 축소·각도·타격점 고정, 홀더 폭과 안쪽 간격, 종이 바깥 수치 위치, 기존 IME/종이 이송/모델 교체·세로 구도. 브라우저 768×1024 / 390×844, 입력151→152→151 갱신 확인.
- typing-hermes.js v38 / typing-3d.css v12. 필수 페이지 생성에서 함께 갱신된 주제/짝짓기 페이지는 생성 결과대로 보존.

### 2026-10-26 — 실제 종이 이송 기본 ON
- 최신 Claude 변경(a86a3a09) 확인 후, retro.paperFeed 기본값을 true로 변경. 저장된 명시적 false는 존중하며 새 사용자/종이 이송 값이 없는 기존 설정은 ON으로 시작. 토글과 저장 흐름은 유지.
- 초기 설정 스위치의 aria-checked/표시 문구도 ON으로 동기화. typing.js v34.


## 2026-10-26 — 타자기 선택 인물 초상 동판화 스타일
- Larry McMurtry / Cormac McCarthy / Woody Allen 사진을 참조해 built-in image_gen으로 3종 일러스트 생성. 원본 사진 보존, `html/img/typewriters/people/*-engraved.webp` 사용.
- 얼굴 특징·시선·의복 유지, 올리브 차콜의 곡선/교차 해칭. portrait 크기를 76×95로 정리하고 잘림/사진 필터 제거. CSS v3.
- 출처 상세에는 사진 기반 재해석과 원본 촬영자·라이선스 유지. 생성 프롬프트 `docs/typewriter-portrait-prompts.json`.


## 2026-10-26 — 실제 종이 이송의 줄바꿈 동기화 수정
- 원인 재현: 1280px 화면의 「검둥이」 첫 줄 33글자를 입력하면 원문 커서는 다음 줄인데 기존 canvas는 입력한 접두부만 재어 첫 줄로 판단. 종이 노출 높이가 96.76px에 머물러 다음 커서가 하단 밖으로 내려감.
- 몰입 모드 캐리지/종이/플래튼/마진벨의 위치를 `tbOrig` 다음 글자의 실제 DOM 줄·열로 통일. 웹폰트 로딩 후 재동기화. 일반 레트로 입력의 기존 텍스트 측정 경로 유지. typing-hermes.js v39.
- 브라우저 확인: Hermes/Lettera/Olympia 자동 줄바꿈, 경계 Backspace 후 복귀, 실제 Enter(84→85자), 글자 크기 14→16px. Hermes 첫 줄 완료 시 종이 높이 96.76→138.86px, 캐리지 오른쪽 복귀, 다음 글자와 커서가 용지 안에 표시됨.
- 페이지 빌드 및 validate 오류 0, 기존 경고 264. 사용자 운영 필사 내용은 수정하지 않음.


## 2026-10-26 — 모델별 추가 사용 인물
- Hermes 3000: Sylvia Plath, Lettera 32: Francis Ford Coppola, Olympia SM3: Evan S. Connell. 각 모델에 기존 인물 아래 1명씩 추가하여 총 6명. 사용 근거 링크와 일러스트 참고 출처 제공.
- 기존과 동일한 지폐 동판화풍 초상 3종 생성, 모델 선택 로직은 유지. typing-model-gallery.css v4. 상세 출처 TYPEWRITER_GALLERY.md, 프롬프트 typewriter-portrait-prompts.json.


## 2026-10-26 — 타자기 뒤 벽면 그림자
- Claude 최신 d50c1b75(회원·동기화) 확인 및 보존. 세 3D 모델 공통으로 기존 주광원에 연결된 투명 ShadowMaterial 후면 수신 면 추가. 기존 배경색은 유지하고 벽 그림자는 24% 농도로 표현.
- 기존 DOM 종이의 깊이 마스크를 shadow caster로 사용해 실제 노출 높이·캐리지·종이 이송과 그림자가 함께 움직임. 숨겨진 종이 꼬리는 투영하지 않으며 글자 위로 그림자가 덮이지 않음.
- A4 전체 그림자가 잘리지 않도록 주광원 shadow camera 범위 확대. VSM 수신 면의 자기 그림자 방지. typing-hermes.js v40.
- 세 모델 입력/IME/이송 회귀 검사 및 A4 그림자 범위 검사. 기존 테스트 DOM의 children 누락 보완. 로컬 브라우저에서 Hermes 물리 이송·Lettera/Olympia 전체 용지 및 세로 태블릿 화면 확인.


## 2026-10-26 — 타자기 초기 진입·로딩 안정화
- 첫 페인트 전 boot guard 적용. 데이터·작품 route·모드 준비가 완료된 후 갤러리 또는 명시한 모드를 노출해 서가/일반 입력 화면이 먼저 보이는 현상 방지. 초기 지연/실패 시 재시도 안내 제공.
- 모델 다운로드 완료 전 GPU context를 만들지 않음. 원본 파일 캐시, 30초 다운로드 제한, 늦게 도착한 이전 선택 결과 폐기. 모델 교체/실패에서 context를 명시적으로 해제하고 이벤트·geometry·material·texture 정리.
- loading/ready/error 상태 분리. 첫 렌더 완료 전 종이·canvas는 숨기고 준비 안내 표시. 다운로드/프레임 예외/context loss는 기본 입력창으로 복귀하고 같은 모델을 다시 불러올 수 있음. 초안은 유지.
- 데스크톱 카메라는 전체 A4와 본체 하단을 함께 계산해 화면 높이에 맞춤. 기존 종이 상단만 기준으로 삼아 본체가 화면 아래로 밀리던 현상 수정.
- 검증: startup guard와 명시적 모드 진입 검사, 세 모델 입력/IME/이송 및 데스크톱·세로 구도, 다운로드 실패·렌더 실패·context loss 후 같은 모델 재시도, 지연 다운로드 중 모델 변경, GPU 해제/단일 핸들러 검사 통과. 로컬 「운수 좋은 날」 첫 줄에서 본체 전체 표시 확인.
- typing.js v35 / typing-hermes.js v41 / typing-model-gallery.js v2 / typing-3d.css v13.

- 운영 최초 다운로드 확인 후, 준비 중 가상 키보드도 숨겨 일반 모드의 순간 노출을 완전히 차단. typing-3d.css v14.


## 2026-10-26 — 서가 진입 후 도서별 타자기 선택
- 루트 메인/서가에서는 모델 선택 팝업을 열지 않음. 레트로 몰입에서 도서를 열 때만 3종 팝업 표시. 서가에서 같은 책 재진입/다른 책 선택/직접 읽기 링크도 선택 화면 제공, 같은 책의 쪽 넘김에는 반복하지 않음.
- 읽기 영역의 data-book-id와 hidden 상태로 도서 진입을 구분하고, 본문 준비 시 modelGate를 먼저 pending으로 설정. 취소 시 팝업을 닫고 서가 복귀. 명시적으로 선택한 다른 모드는 기존 동작 유지.
- startup 회귀 검사에 서가 첫 진입/재진입/책 변경/취소 추가. typing.js v36 / typing-model-gallery.js v3.


## 2026-10-26 — 백그라운드 타자기 프레임 일관성
- 첨부의 빈 타자기/늘어진 종이 보고 후 실제 Chrome 탭은 재표시 시 정상 상태였다. 코드 경로 검사에서 숨겨진 문서의 resize가 캔버스를 즉시 초기화하고 sync가 종이 높이를 전체 A4로 먼저 바꾸는 결함을 재현했다. 당시 첨부의 모든 발생 조건을 확정한 것은 아니다.
- `typing-hermes.js?v=42`: resize는 예약만 하고 실제 buffer 변경·카메라 계산·종이 크기·렌더를 같은 가시 프레임에서 처리한다. 같은 buffer 크기에는 setSize를 호출하지 않는다. 종이 노출 높이는 placePaper에서만 반영한다.
- 탭 숨김 시 예약 프레임 취소, 복귀/페이지 복원 시 크기 재계산. IntersectionObserver의 오래된 false 상태로 갱신이 막히지 않도록 on-demand 프레임은 문서 가시성으로 판정한다.
- 회귀 검사: 숨겨진 탭에서 resize+paper 이벤트가 마지막 캔버스/종이 높이를 유지하는지, 복귀 후 새 크기를 렌더하는지, 동일 크기 정렬이 buffer를 지우지 않는지 추가. 변경 전 실패, 변경 후 3개 모델 통과. 기존 startup 검사 및 로컬 화면도 확인.


## 2026-10-26 — 용지 입력 포커스 자동 복귀
- `typing-focus.js?v=1` 공통 처리 추가. 도서/모델 준비 완료, 설정/도움말/학습/완료/스크린숏 창 닫기, 읽기 화면 조작 완료, 창 복귀 시 실제 tbInput에 preventScroll 포커스. 입력값과 선택 범위는 변경하지 않음.
- 열린 모달/모델 선택 대기/모바일 메뉴/서가/숨겨진 입력창/한글 조합 중에는 포커스를 빼앗지 않는다. select·range는 선택 동작 완료 시 확인한다. 설정 내부 글꼴 변경·초기화에서 기존 직접 focus 호출 제거.
- typing.js v37. check_typing_focus.mjs: 진입·완료 조작·모달·모델 대기·IME·서가·창 복귀·선택 범위 유지 검사. startup 검사 통과. 로컬 브라우저에서 모델 로드 직후, 글자 크기 변경 후 설정 닫기, 도서 제목 클릭 뒤 tbInput 포커스 확인. 종이를 다시 클릭하지 않은 상태에서 a 입력/Backspace 복구 확인.

### 2026-10-27 — 레트로 몰입: '다음 쪽' 미리보기 삭제 · 머리글 자동 숨김 (Claude)
- 운영자 요청으로 오른쪽 `.tb-focus-next`(다음 쪽 종이·안내·버튼)를 HTML·`typing.js`·`typing-retro-focus.js/.css`에서 모두 삭제. 좁은 화면(`data-focus-sides="below"`)은 도서 정보 한 칸만 가운데.
- `html/js/typing-header-peek.js`(신규): `body.tb-retro-immersive`(세로 모드·모델 선택 중 제외)에서 머리글과 `.tb-topw`를 `position:fixed`로 띄워 3초 뒤 숨김(`body.tb-peek-off`). 맨 위 14px `.tb-peek-zone` 호버·탭 시 표시, 벗어나면 0.6초 뒤 숨김, 포커스가 안에 있으면 유지.
- Codex가 잠금(`codex-metal-lettera-olympia`)을 건 채 10시간 넘게 변경이 없어, 운영자 요청을 위해 **별도 worktree에서 커밋 66e7a3fd를 푸시**(잠금 파일은 건드리지 않음). Codex의 `run.sh finish` 중 `git pull --rebase`에서 `tools/typing_app.html` 스크립트 버전 줄이 충돌하면: 양쪽 버전을 모두 살리고(`typing-retro-focus.js?v=11`, `typing-header-peek.js?v=1` 유지 + Codex의 lettera·olympia·details·surfaces·badges·hermes 버전) `node tools/build_pages.js`로 `html/type/index.html`을 다시 만든 뒤 `git rebase --continue`.


### 2026-10-27 — 타자기 외형·재질·엠블럼 통합 배포 (Codex)
- Claude의 66e7a3fd / 0785d50f를 먼저 반영하고, 다음 쪽 미리보기 삭제·상단 메뉴 자동 숨김을 유지했다. 충돌은 템플릿의 스크립트 버전만 양쪽 최신 값으로 병합하고 HTML을 재생성했다.
- 세 모델의 상판 개구부·내측 접힘·캐리지 연결부·리본·키캡을 보강하고 어두운 실버 재질, 투명 배경 엠블럼, PCF 그림자를 반영했다. 상세: TYPEWRITER_ASSEMBLY_REVIEW.md / TYPEWRITER_SURFACES.md / TYPEWRITER_BADGES.md.
- three-model 회귀 검사(각 20 항목), 재질·엠블럼 검사 통과. validate.py 오류 0, 기존 경고 264. 로컬 통합 화면에서 모델 로딩·입력 포커스·메뉴 숨김·미리보기 제거 확인.
- 운영자가 현재 버전 배포를 명시적으로 요청해 GitHub main 및 NAS 정적 서비스에 반영하는 작업이다.

### 2026-10-27 — Hermes 3000 실물 대조 Blender 제작본 (로컬 검토)
- 기준: Stephen Hanafin의 1962 #3138796 직접 촬영과 Paillard 3003 B 설명서. 출처·관찰·제작값 구분은 HERMES_REFERENCE_BUILD.md.
- tools/modeling/build_hermes_reference.py: Blender 4.5.15 LTS에서 독립 생성. 곡면 외장·개구부·접힘·캐리지 측판·44 문자키/54 전체키·PBR/normal. 편집 원본: /Volumes/AI_dev/web/typewriter-precision/hermes3000-reference.blend.
- html/hermes-reference-review.html + html/js/hermes-reference-review.js: 4각도·회전·확대·형태 보기·키 누름. html/img/typewriters/reference/ GLB 약 13 MB. 로컬 8777 연결. 기존 필사 모델 교체나 NAS 배포는 하지 않음.
- tools/check_hermes_reference.py 통과: GLB 구조·유한 좌표·11/12/11/10 문자키·54 전체키·캐리지 부모·내장 이미지/normal. validate 오류 0/기존 경고 264. 브라우저 로딩·각도·형태 보기·입력 확인, 경고/오류 로그 없음.
- 사진 비례 제작이며 실측 CAD 아님. 국가별 이중 각인·내부 전체 기구는 미완전. 운영 모델 연결·모바일 성능 최적화·나머지 두 기종 재제작은 다음 단계.
- 원격 커밋·푸시 및 잠금 해제는 자동 승인 검토에서 신규 모델 원격 반영의 명시적 승인이 없다는 이유로 차단. 로컬 변경과 codex-hermes-reference-rebuild 잠금 유지. 승인 없이 우회 실행하지 않음.

- 이어서 재질 보강(로컬만): 독립 normal/roughness 맵 5개 내장 GLB 13,194,052바이트, Mapping 반복 보존, PMREM 창/띠 반사, VSM 그림자와 하부 깊이 기반 접촉 그림자. Blender 원본과 PNG 재생성. `check_hermes_reference.py` 통과, 전체 검증 오류 0/기존 경고 264, 브라우저 각도·형태 전환/키 입력 확인, 콘솔 오류·경고 없음. 결과 `/Volumes/AI_dev/web/typewriter-precision/material-after.png`. 커밋·푸시·운영 배포 미실행.

- 레버 재제작(로컬만): 기존 3구간 튜브+수평 손잡이를 단일 연속 닫힌 메시로 교체. 상승부·둥근 꺾임·하향 손잡이·목의 점진적 비틀림·보이는 체결부 구성, 캐리지 하위 조립체로 묶음. 측면 버튼은 좌측으로 변경. GLB 13,712,936 bytes / 572 meshes / 54 keys, 구조 검증 통과, 전체 오류 0/기존 경고 264, 브라우저 정면·좌측·사선 확인 및 콘솔 오류·경고 없음. Blender/GLB/PNG 갱신, 스크린샷 `typewriter-precision/lever-after.png`, `lever-after-side.png`. JS/GLB 캐시 v5. 커밋·푸시·배포 미실행.

- 레버 실제 필사 화면 연결(로컬): Hermes에만 `reference/hermes-return-lever.glb?v=1`(약 537 KB)을 추가 로드, 기존 Return_Lever 피벗과 줄바꿈 애니메이션 유지. 옛 샤프트/손잡이 숨김, 키보드·본문·종이 이송 변경 없음. typing-hermes.js v49, 원본 템플릿 및 생성 페이지 갱신. Hermes/Lettera/Olympia 회귀 테스트 모두 통과, 검증 오류 0/기존 경고 264. 브라우저 로컬 필사 화면에서 위치·로드 확인, 콘솔 오류/경고 없음. 독립 정밀 모델 전체 교체가 아닌 레버 부품 적용. 운영 배포·커밋·푸시 미실행.

- 2026-10-27 Lettera 32 실물 대조 독립 모델: 1965 #2330939(Tas Kyprianou)의 정면·상면·내부·양 측면을 기준으로 Blender 새 제작. 빨간 오른쪽 키는 해당 개체의 특징이며 사용자가 준 검정 키 사진과 차이가 있음. 덮개 개구부·바스켓·뒤쪽 연속 외곽·검은 키·금속 재질과 캐리지·레버를 별도 구성. `docs/LETTERA_REFERENCE_BUILD.md` 출처/한계. 로컬 `http://localhost:8777/lettera-reference-review.html`, Blender/GLB/렌더 `/Volumes/AI_dev/web/typewriter-precision/lettera32-reference.*`, 웹 GLB 11,597,664 bytes, 545 meshes, 50 keys. `tools/check_lettera_reference.py` 통과, 전체 검증 오류 0/기존 경고 264, 웹 각도·입력과 로딩 확인, 콘솔 오류 없음. 명판 글꼴·일부 각인·캐리지 측면은 추가 보강 여지. 기존 필사 앱 미교체, 커밋·푸시·배포 미실행. 기존 Hermes 작업 LOCK 유지.


### 2026-10-27 Lettera reference integrated into local typing
- typing-lettera-reference.js attaches complete #2330939 reconstruction with embedded PBR materials to existing typing events; hidden legacy rig retained for input/paper compatibility. 50 visible reference keys, carriage, roller, lever and typebars follow motion. No duplicate legacy emblem.
- typing-hermes.js v50; template and generated page updated. Local only; no push/deployment.
- Separate reference review remains available. Photo-derived appearance and authored animation, not measured mechanical CAD.

### 2026-10-28 Lettera interior contrast
- Darkened recessed keybed and lowered internal mechanism reflection in typing-lettera-reference.js v2. Per-role cloned materials preserve exterior paint, keycaps and carriage chrome. Embedded texture maps retained.

### 2026-10-28 Olympia SM3 standalone reference reconstruction
- tools/modeling/build_olympia_reference.py: new scalloped hood opening, continuous shoulder curvature, separate chrome bands, open underframe/linkages, tall dished green keys, concentric knobs and long swept lever. Based on Typewriters101 p578 green specimen; gray #1103959 for supplemental internal structure only. docs/OLYMPIA_REFERENCE_BUILD.md documents evidence/limits.
- 608 meshes, 51 keys, 5 embedded images. Structure check and repository validation pass (0 errors / existing 264 warnings). Existing generated emblem reused; dimensions/curves are authored, not measured CAD.
- Local http://localhost:8777/olympia-reference-review.html; Blender/GLB/PNG in /Volumes/AI_dev/web/typewriter-precision/. Standalone review only, NOT integrated into typing engine or deployed. Own codex-olympia-reference lock retained for follow-up.

- SM3 lever refinement: reduced authored blade twist 75→32 degrees, wider continuous neck/grip with rounded rectangular section, slightly thicker edge; lower chrome band moved outside shell to eliminate burial. GLB cache v2 / review JS v3. Front browser view verified; structure validation passed, repository errors 0 (264 existing warnings). Local review only; no deployment.

- Olympia full reference integration (local): typing-olympia-reference.js attaches the exact review GLB v2, embedded paint/normal/roughness/emblem retained. 51 visible keys, moving carriage, shift lift, roller, return lever and typebar motion follow existing input engine. Hidden old rig only supports compatibility; old external badge suppressed. Reflection cards/exposure match review. typing-hermes.js v51; local only, no deployment.


## 2026-10-28 메인 사이트 헤더 로고
- 제공된 LETSUM_03_Retro_v1.0.svg를 html/img/logo-retro-v1.svg로 원본 그대로 추가. 메인 및 하위 페이지 헤더를 높이 44px, 원본 비율로 교체. 생성 템플릿도 반영. 필사독서 전용 헤더와 푸터는 유지.
- build_pages.js 및 validate.py 완료(오류 0, 기존 경고 264). 로컬 8780에서 시각 확인. 운영 미배포.


## 2026-10-28 세종자으미모으미체 컬러 견본
- 소개 전용으로 빈 미리보기가 표시되던 컬러판에 원본 WOFF2의 SVG 글리프를 원형·색상 그대로 조판한 SVG 견본을 추가. 폰트 파일 수정 없음. 실시간 입력 미리보기는 미지원이며 안내 문구로 명시.
- 공식 배포처 현재 형식별 다운로드 응답은 HTML이므로 보관된 공식 원본 사용. 상세 페이지에서 색상 견본 확인. 운영 미배포.


## 2026-10-28 운영 배포
- 사용자 배포 요청: Olympia 전체 모델 통합, 메인/필사독서 Retro 헤더 로고, Balanced 푸터 로고, 필사 헤더 외부 메뉴 제거 및 로고 letsum.app 링크, 세종 컬러 원본 견본을 함께 배포.
- 회귀 테스트 3모델 통과, 전체 검증 오류 0/기존 경고 264.


## 2026-10-28 파비콘 등록
- 사용자 제공 SVG/512px PNG 등록. PNG에서 32px 탭 아이콘 및 180px Apple touch icon 생성. 메인/필사 및 생성 페이지 아이콘 URL에 v=20261028 캐시 버전 적용. 검증 오류 0/기존 경고 264.


## 2026-10-28 타자기 선택 화면 용지 인터랙션
- 기본 용지와 기존 용지 문구 제거. 모델명 아래 설명을 용지에 옮겨 pointer hover/focus/touch 시 용지가 올라온 뒤 40ms 간격으로 출력. 이탈·닫기 때 타이머와 문구 초기화. reduced-motion은 즉시 출력.
- gallery CSS v5 / JS v4. 로컬 시각 확인 및 검증 오류 0(기존 경고 264). 운영 미배포.


## 2026-10-28 화방 구현 (로컬)
- #/studio 메뉴/3종 선택/이미지 업로드/로컬 Worker 명암·윤곽 문자 매칭·중첩/타이핑 재생/A4 PNG·PDF·인쇄·파일 공유를 추가. 설명 및 검증: docs/TYPEWRITER_STUDIO.md.
- 원본은 서버 전송하지 않음. 사진의 실제 3D 깊이 추정/AI 없음. 타자기는 기존 정면 미리보기 자산 사용.
- 문자 엔진 회귀 검사, 시작/입력 포커스 회귀, 전체 검증 오류 0(기존 경고 264). 브라우저 업로드/완성/모델 전환/모바일 확인, PNG/PDF 실제 저장 및 A4 1페이지 검증. 운영 미배포.

화방 타건 재생 보정: 개별 문자/중첩 타건, 8·20·45타/초, 줄 끝 정지/캐리지 복귀/한 줄 이송으로 변경. `check_typing_studio_motion.cjs` 통과, validate 오류 0(기존 경고264). 로컬 작업 유지, 미배포.

화방 정적 PNG 재생을 `typing-studio-machine.js`의 reference GLB 구동으로 교체. 종이와 캐리지 결합, 키/타입바/리본/레버/롤러 구동. Three.js 구버전 호환으로 parent.remove 사용. 현재 로컬 미배포.

2026-10-28 운영자 배포 승인: 화방 전체(로컬 이미지 분석, 문자 중첩, A4 PNG/PDF/인쇄/공유, 세 reference 타자기 부품 구동)를 운영 반영. studio/core/motion 및 기존 startup/focus 검사 통과.

화방 글꼴/확대 로컬 변경: Courier Prime 로딩 후 atlas 생성, 모든 타건 색 #211f1c·alpha1 고정. 용지 확대 100~300% 글리프 재렌더링 및 재생 정지/복원. 타건 밀도 문구로 변경. 현재 미배포.

2026-10-28 운영자 배포 승인: 화방 Courier Prime 전용 글꼴, 동일 잉크색/불투명도, 100~300% 용지 확대를 운영 반영.

화방 캐리지/조명 보강 로컬 작업: 양 끝 캐리지+레버 회전 mesh bounds로 카메라 자동 맞춤, VSM 그림자/접촉 음영/방향광 및 재질 반사 조정. studio JS v5, machine v4. 미배포.

화방 방향성/본문 로컬 구현: 흑백+자동레벨 항상 적용, 구조 텐서 방향 곡선 문자, 직접 칠하는 인물 마스크와 가로 배경, 영문/한글/일본어 및 사용자 본문 반복. 단어 의미 기반 인물 인식은 없으며 초기 타원 보정 필요. 앞선 조명/잘림 변경과 함께 미배포. flow/core/motion 검사 추가/통과.

2026-10-28 모나리자 실험 로컬 보완: 본문 치환 후 명암 불일치 제거(실제 glyph ink union으로0~5타 선택), 흰 여백 제외 자동 레벨/국소 대비/균열 억제, 곡선 방향 안정화, 흰 배경 강제 타건 제거. 피사체1.2/1.4/1.6/2배+상하좌우 구도, 마스크 동반 변환 추가. 본문·자유영문과1.2배 PNG 실물 확인. core v5/flow v3/studio v8/worker v5, machine v4. 검증 오류0·기존 경고264. 앞선 로컬 변경과 함께 아직 미배포. 세부 docs/TYPEWRITER_STUDIO.md.

2026-10-28 수작업 문자화 참고 보강(로컬): 실제6~16문자 곡선 앵커/RK2, 어두운 옷 평탄부 방향 연장, anchor위치에서 명암 재샘플링. 최대9타/피부 밝은 중간톤 보존/짙은 잉크, 진갈색 기본+차콜 선택(alpha1 동일), 지정 본문 하이라이트 고착 수정. 100%용지 확대는 높이 맞춤. 모나리자 자유문자와 MONA LISA 본문 PNG검증 완료. docs/TYPEWRITER_STUDIO.md에 비교/한계/결과 기록. core v6/flow v4/streamlines v2/studio v9/worker v6. 검증 오류0(기존 경고264), 미배포.

2026-10-28 화방 인물 경계/여백 수정(로컬): 이진 마스크의 잘라붙인 경계를 양쪽 전환 폭의 연속 방향·동일 배치 규칙으로 연결. 이전 하이라이트 압축 삭제, 밝기0.82 이상 무타건 및 오차확산 유입 차단. 모나리자 자유문자/MONA LISA PNG 확인. core7/flow5/streamlines3/worker7/studio10. 관련 검사 및 validate 오류0(기존 경고264), 미배포.

2026-10-28 화방 경계 추가 보강(로컬): 가로/곡선 run 혼합, 외곽step 우선순위·길이 감소, 국소밀도 잉크보정, 대비halo 억제. 모나리자 PNG/화면 확인. 전체오류0(기존264경고), core8/flow6/streamlines5/worker9/studio12. GitHub 후보 검토는 TYPEWRITER_STUDIO.md에 기록. 외부코드 미도입, 미배포.


2026-10-28 화방 GitHub 검토안 반영(로컬): 공식 OpenCV.js4.13.0/Apache-2.0 보관 + 별도 Worker에서 RGB GrabCut 전경 보정. 수동 FG/BG 보정 보존, signed-distance softmask 유지, 초기 자동분석/재시도/중단/30초유휴메모리해제. SSARCandy ETF식 CPU이식(MIT/고정commit/출처포함),640px/2회, 기존tensor 명암근거로 신뢰도제한. 밝은부분무타건·진갈색고정 유지. 완성/확대/저장 분할렌더와exportcanvas재사용, 범위분석중 경로이탈의 잠금해제 수정. ETF/실제OpenCV/분할렌더 회귀추가 및기존검사통과, validate0오류/기존264경고. 모나리자1.2배160열 실제124,376타/확대 확인. color-based 분리의 배경포함오차는브러시보정필요. 상세 TYPEWRITER_STUDIO.md. core8/flow7/streamlines6/etf1/seg-worker1/worker10/studio13, 미배포. 기존 codex-studio-lighting 잠금 유지.


2026-10-28 이전 화방 CV/ETF 배포 확인: 7ee01774가 GitHub main 및 NAS에 반영됨.
2026-10-28 화방 추가 기능: 효과음 on/off·음량·미리듣기·타건동기, A4 표시10%확대, TXT/MD/DOCX/EPUB 장문100만자 가져오기/직접입력·잔여본문 이어쓰기. studio14/flow8/worker11/machine5/CSS6/audio1/documents1. 상세와 검증 TYPEWRITER_STUDIO.md. 사용자 배포 확인 요청에 따라 운영 반영 진행.


## 2026-10-29 한국어/영어 화면
- 국가별 기본 UI: 한국은 한국어, 확인된 해외 국가는 영어. 수동 선택을 최우선으로 저장하며, 국가 미확인 시 브라우저 언어로 동작. `/en/` 폰트 카테고리와 독립.
- `worker/src/locale.js`, `tools/i18n/`, `tools/build_ui_language.js`. 생성은 build_pages.js 마지막에서 자동 실행. 상세·주제 페이지에도 공통 언어 전환.
- 테스트·유지보수·원문 유지 범위: `docs/I18N.md`. 필사독서 별도 앱(type.letsum.app)은 변경하지 않음.


## 2026-10-29 — 화방 4초 고정 재생
- 이미지 분석과 문자 래스터 준비 후 재생시간 3.6초, 마지막 종이/캐리지 정착 여유 0.4초. UI에 분석·준비 시간 별도를 표시. 사용자 일시정지 시간은 제외.
- 모든 원래 문자·중첩·좌표·잉크를 준비 canvas에 분할 렌더하고 진행 위치까지만 노출. 문자 수에 비례하던 타건 대기 제거, 고해상도 저장은 기존 원본 plan 유지. 키/캐리지/효과음은 각각45/280ms 간격으로 합쳐 과도한 동시재생 방지.
- motion 회귀검사:24,960/224,640타,16/100ms 프레임 모두3,600ms 완성. render/core/audio 검사 통과. 실제 로컬 브라우저160열 예제30,930타3,628ms 완료, 오류 없음.
- typing-studio.js v15.


## 2026-10-29 — 도트레트로 구현·리소스 검토 (운영 배포 전)
- 헤더 서가/화방 우측 `#/dot-retro` 메뉴. 로컬 Worker의 레트로 입자/Floyd–Steinberg/원형 망점, 대비·밝기·점 크기·잉크/종이색·투명 PNG·원본 비교·실제 크기·PNG 저장. 도트 엔진은 AI/3D/OpenCV 의존 없음.
- 데스크톱 긴 변1600 기본/2400 최대, 모바일1200 기본/1600 최대, 파일20MiB/24MP. 새 입력·경로 이탈 중단, 20초 타임아웃, 사진 삭제시 Canvas 해제. 서버 사진 전송/보관 없음.
- Chrome 실측 변환1MP12~16ms/4MP34~36ms/5.76MP44~50ms. 디코딩·PNG 인코딩 제외이며 기기별 다름. 신규 정적파일+마크업 약26.2KB. 메모리 산식·한계·브라우저 검증은 docs/DOT_RETRO.md.
- 기존 typing.js40/studio16은 새 경로/메뉴 선택 처리만 변경, dot JS/core/worker/CSS1. 핵심·기존 시작/화방 검사, 데스크톱/390px 브라우저/실제PNG다운로드, POST0건, validate0오류/기존264경고 확인. 운영은 아직 반영하지 않음.


## 2026-10-29 — 용지 점프·조기 줄바꿈 알림·다음 글자 잘림 수정
- 별 헤는 밤/Olympia 1310×863에서 211번째 입력의 용지471→55px 급축소 재현. 행 모듈로 초기화 대신 A4 노출 높이 유지+초과 본문 연속 스크롤. 개행 기호가 행 높이를 늘리던 CSS와 DOM/고정 줄 높이 오차도 수정.
- 공통 typing-paper-layout의 실제 DOM Range 좌표로 종이/캐리지/오디오를 맞춤. 이송 중 미노출 높이를 스크롤로 보상해 Enter 직후 다음 글자를 계속 표시. 86% 마진벨 제거, 실제 확정 개행/자동 줄 전환에서만 1회. IME Enter·resize 조기 처리 방지.
- 브라우저6조건/세모델/14·18·28px/모바일·태블릿: 2,340자·4,567프레임, 글자 잘림0·용지 역방향 점프0·157회 알림 일치. 실제 Enter/Backspace반복·IME·회전·종이모드·다음쪽·초안보존 확인. 기존 기계/오디오/시작/포커스/도트 검사 및 validate 오류0·기존264경고.
- paper-layout1/audio3/hermes52/retro-focus CSS10. 상세 원인·검증·한계: docs/TYPING_PAPER_FIX.md. 사용자 원래 필사 기록은 변경하지 않음.
