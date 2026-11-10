# 로고모음 운영 (2026-11-09)

- 경로: `/logos/`, 상세 `/logos/brands/<id>/`.
- 제공받은 정적 소스는 `tools/logo-app/`에 보관. 데이터: `data/catalog.json`, `sources.json`, `taxonomy.json`.
- 현재 28개 기관, 30개 아이덴티티 정보. 공식 로고 이미지나 원본 파일을 제공하지 않으며 실제 파일 검증·현행 여부·이용 허가를 별도로 표시한다.
- 공식 출처 확인 범위와 날짜는 제공된 데이터 그대로 유지한다. 이번 작업은 서비스 통합이며 36개 출처를 새로 검수한 작업이 아니다.
- 로컬 검수 UI는 공개 라우트에서 비활성화. 제보는 기존 `/contact.html`로 연결. 보관함은 브라우저 저장 방식이다.
- `tools/build_logos.mjs`가 원본 빌드를 실행한 후 CSS·JS·데이터를 공용 자산 3개로 분리한다. 생성된 HTML을 직접 수정하지 않는다.
- `node tools/build_pages.js`는 로고모음, 통합 딩벳 페이지, 공통 메뉴 및 사이트맵도 생성한다.
- `tools/build_navigation.js`: 헤더 로고모음/마스코트/딩벳&특수, 웹폰트 코드 푸터 전용.
- `/dingbat/` 내부 두 서브메뉴. `?view=symbols`로 특수기호 진입. 기존 `/symbols.html`은 해시를 보존해 이동한다.
- 특수기호 마크업 원본은 `tools/symbols_content.html`. JS는 기존 `html/js/symbols.js`를 공유한다.
- 마스코트는 메뉴와 준비 중 화면만 제공하며 검색 색인에서 제외한다.

## 확인
- `npm --prefix tools/logo-app test`: 46개 테스트.
- `npm --prefix tools/logo-app run validate`: 데이터 스키마 검증.
- `python3 -I tools/validate.py`: 기존 카탈로그 검증.
- 브라우저 로컬 확인: 고양시 검색 1건, 상세 사용승인/미확인 조건, 보관함 저장 및 조회, 모바일 390px 레이아웃, 딩벳 48종, 특수기호 하트 검색 24건 및 ♥ 복사.

## 공통 헤더·보기 방식·썸네일 (2026-11-09 추가)
- 헤더·푸터·폰트: `tools/build_logos.mjs`가 완성된 `html/index.html`의 head 자산·`<header>`·`<footer>`를 그대로 가져와 끼운다(마스코트 페이지와 같은 방식). 그래서 `build_pages.js`에서 로고 빌드는 맨 마지막에 실행한다. 로고 앱 CSS 변수는 `.logo-app` 안으로 범위를 좁혀 사이트 색·다크 모드를 덮어쓰지 않는다.
- 로고 앱 자체 헤더(LETSUM. 로고모음)는 제거하고, 로고 찾기/보관함/이용안내는 딩벳 페이지와 같은 탭 스타일.
- 보기 방식 3가지: 명함(기본, 앞·뒷면), 아이콘(`?view=icons`, 기울어진 앱 아이콘 타일), 목록.
- 썸네일: `node tools/fetch_logo_thumbs.mjs [id ...]` → `html/logos/thumbs/`에 내려받아 자체 서버에서 제공(핫링크 없음). 출처 순서는 `tools/logo-app/data/thumbnail-sources.json`, 결과·출처 URL·라이선스·SHA-256은 `tools/logo-app/data/thumbnails.json`.
  - 출처 종류: `simple-icons`(CC0 글리프, 브랜드 색 포함) · `image`(공식 페이지에 게시된 로고 이미지) · `commons`(Wikimedia Commons, 파일 페이지 라이선스 기록) · `site-icon`(공식 사이트 아이콘, 최후 대체).
  - 모든 출처가 실패하면 기존 파일과 기록을 유지한다. 화면에서 이미지가 깨지면 기관명 글자 워드마크로 자동 대체된다.
  - 카탈로그 스키마(`catalog.json`)에는 이미지 필드를 넣지 않는다(검증기가 금지). 썸네일은 빌드 때 부트스트랩에 따로 주입된다.
  - 상세 페이지에 이미지 출처·라이선스와 '상표권은 각 권리자에게 있음' 안내를 표시한다. 식별용 미리보기이며 이용 허락을 뜻하지 않는다.
- 다크 모드: 공통 헤더·푸터는 다크로 바뀌지만 로고 본문 영역은 밝은 색 그대로다(로고 앱 CSS의 고정 색상이 많아 별도 작업 필요).

## 카테고리별 전수조사·CI 컬러 (2026-11-09 추가)
명단 → 수집 → 합치기 3단계. 결과물은 모두 다시 만들 수 있고, 자동 수집분(`kr-` 접두사)만 교체된다. 수작업 레코드는 건드리지 않는다.

```bash
python3 -I tools/logo-survey/build_orgs.py      # 1) 명단: 위키백과 목록·분류 틀 + 위키데이터(홈페이지·로고 파일·폐지 여부)
python3 tools/logo-survey/crawl.py              # 2) 수집: 홈페이지 → CI 페이지·색상 표기·로고 (Pillow 필요해서 -I 없이)
python3 tools/logo-survey/crawl.py --colours-only   #    색상 추출 규칙만 고쳤을 때 CI 페이지만 다시 읽기
python3 -I tools/logo-survey/merge.py           # 3) 합치기: catalog·sources·thumbnails·colors.json
python3 tools/logo-survey/curated_colors.py     #    수작업 레코드의 컬러
node tools/build_pages.js                       #    페이지 생성(로고 빌드 포함)
```
- 범위(2차): 중앙행정기관, 광역·기초자치단체, 시도교육청, 공기업·준정부기관·기타공공기관, 대학. 명단 출처는 각 레코드의 출처 메모에 남는다.
- 자동 수집 레코드는 `needs-review`(화면 표기 "자동 수집·검수 대기"). 사람이 원문을 대조하면 `source-reviewed`로 올린다. 이용 허락은 모두 `unknown`.
- 컬러(`tools/logo-app/data/colors.json`): `official`은 공식 페이지 본문·이미지 대체 텍스트에 적힌 PANTONE·CMYK·RGB·HEX를 그대로 옮긴 값. HEX가 없으면 RGB/CMYK에서 환산하고 `hex_derived`로 표시(CMYK 환산은 근사). `extracted`는 공식 표기를 못 찾았을 때 로고 이미지에서 뽑은 대표색으로, 화면에 "추출값(비공식)"으로 표시한다.
- 색상 표기가 이미지로만 된 CI 페이지는 자동으로 읽지 못한다(추출값으로 대체). TLS 인증서가 깨진 사이트는 검증을 끄지 않고 오류로 남긴다(`crawl.json`의 `errors`).

## 로고 보충·정규화·균일 배치 (2026-11-10 추가)
```bash
python3 tools/logo-survey/fill_logos.py        # 로고 없는 기관 보충: 위키데이터 로고·문장·인장 → 위키백과 대표/로고 파일(기관명이 파일명에 있을 때만, 지자체는 시·군기) → 공용 검색(한글·로마자) → 홈페이지(정적·Chrome 렌더링) 헤더 로고·인라인 SVG·공유 이미지·아이콘
python3 tools/logo-survey/normalize_logos.py   # 모든 썸네일 여백 제거·비율 기록(logo-geometry.json). SVG는 Chrome 캔버스 렌더링 픽셀로 범위 측정
python3 -I tools/logo-survey/merge.py
```
- 화면 배치: 로고마다 여백을 뺀 가로세로 비율 r로 높이 = min(1, B/r, √(A/r))를 계산해 넓은 글자형과 정사각 심벌이 비슷한 면적으로 보이게 한다(app.js `logoHeight`). 모든 표면(명함 앞·뒷면, 아이콘, 상세)이 같은 규칙.
- 흰색·반투명 흰 로고는 정규화에서 판별(`tone: light`)해 어두운 바탕에 표시. 반투명 푸터 로고는 불투명도를 복원한다.
- 아이콘 보기 타일은 회전 없이 똑바로 표시.
- 로고가 아닌 이미지(사진·배너·캐릭터·위젯 아이콘 등)는 `tools/logo-survey/data/thumbnail-rejects.json`의 `reject_files`(파일 단위)로 제외. 전수 육안 점검 2026-11-10.
- 공용(Commons)에 없는 위키백과 전용(비자유) 파일은 쓰지 않는다.

## 대분류·소분류, 파일 형식 (2026-11-10 추가)
```bash
python3 tools/logo-survey/find_formats.py   # CI 페이지(없으면 Chrome 렌더링 홈에서 CI 메뉴 재탐색)에서 AI·EPS·SVG·PDF·PNG·JPG·ZIP 표기·다운로드 링크 → page-listed 자료 항목
python3 -I tools/logo-survey/merge.py
python3 -I tools/logo-survey/classify.py    # 화면용 대분류·소분류(tools/logo-app/data/groups.json). 스키마 category와 별개
python3 -I tools/logo-survey/check_downloads.py  # find_formats가 찾은 파일 링크를 실제 요청해 파일 서명(PK·%PDF·%!PS·PNG·JPG·SVG)으로 바로 받기 가능 여부 확인 → tools/logo-app/data/downloads.json. 형식 배지·상세 '파일 받기' 버튼이 공식 사이트 파일로 직접 연결(폰트 페이지와 같은 방식, LETSUM은 파일을 보관하지 않음). ci_ai.zip처럼 이름에 형식이 하나 있는 ZIP은 그 형식(contains)으로 연결
python3 -I tools/logo-survey/popularity.py      # 기본 정렬(인지도순) 점수 → tools/logo-app/data/popularity.json. 점수 = log10(한국어 위키백과 최근 12개월 조회수+10) + 0.6×log10(위키백과 언어판 수+1). 모든 카테고리에서 검색어가 없으면 이 순서, 검색어가 있으면 관련도 다음 기준
```
- 대분류: 중앙정부 · 지방정부 · 금융 · 공공기관 · 연구기관 · 대학·교육 · 의료기관 · 기업·브랜드 · 국제기구·비영리. 소분류는 classify.py의 GROUPS. 배정은 명단 그룹·기관명 규칙(공공기관은 이름 핵심어로 분야 판정), 수작업 레코드는 CURATED.
- 화면: 대분류 바 아래 소분류 칩(`?group=…&sub=…`). groups.json이 없는 단독 빌드(테스트)는 기존 category 바.
- 카드에는 분류·이름·확인된 파일 형식·공식 출처만 표시. 검토 상태·확인일·요약은 상세 페이지에.
- 파일 형식은 공식 페이지 표기 기준이며 실제 파일 검증 전(`page-listed`). 다운로드 링크는 공식 사이트 원 링크(세션 ID 제거).

## 첫 화면 로딩 (tools/build_logos.mjs)

- 앱이 그리기 전에는 JS 없는 사용자·검색엔진용 대체 목록(static-fallback)을 숨기고 글자 없는 스켈레톤만 보인다(`html.logo-js`). 앱이 10초 안에 뜨지 않으면 대체 목록을 다시 보인다.
- 대체 목록에는 기관명과 공식 링크만 남긴다(자동 수집 설명 문장 제거).
- 공유 부트스트랩에서 상세 전용 데이터(출처 근거 sources, 이미지 출처 표기, 컬러 전체 스펙)를 빼고 각 상세 페이지 인라인 스크립트로 붙인다. 목록용 컬러는 HEX 4개까지만.
- 데이터·앱 스크립트는 head에서 preload/modulepreload로 먼저 받기 시작한다.
