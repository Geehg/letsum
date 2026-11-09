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
