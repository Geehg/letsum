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
