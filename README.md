# letsum

> 작업을 이어받는 AI·사람은 먼저 [AGENTS.md](AGENTS.md)와 [docs/HANDOFF.md](docs/HANDOFF.md)를 읽으세요. 작업은 `tools/run.sh start <이름>`으로 시작합니다.

LETSUM(렛섬) — 상업용 무료 한글 폰트. 상업용 무료 한글 폰트를 **고르고, 검증하고, 바로 적용**하는 흐름을 한 화면에 둡니다.

- 사이트: https://letsum.app (NAS 컨테이너 포트 8516, nginx 정적 서빙)
- 소스: `html/` — `index.html`(홈) · `guide.html`(라이선스 가이드) · `subset.html`(서브셋 생성기) · `submit.html`(폰트 등록) · `admin.html`(관리자, 브라우저 저장 데모) · `privacy.html` · `terms.html`
- 데이터: `html/js/data.js` — 폰트 123종(Google Fonts 한글 38 + 공공 안심글꼴 OFL 85, 전부 OFL), 문장 프리셋, 상황별 큐레이션, 유료 폰트 대안, 라틴 짝꿍
- 리서치: `docs/research_v2_global_benchmark.md`, `docs/demand_and_download_strategy.md`(실수요·다운로드 전략), `docs/automation_feasibility.md` — 국내·해외 벤치마크와 리디자인 근거

## 주요 기능
- 전역 컨트롤 데크: 문장(프리셋 7종)·크기·굵기·반전·영문 짝꿍이 모든 행에 동시 적용
- 목록 / 격자 / 맥락(썸네일·책 본문·자막·메뉴판·카드뉴스·UI) 3가지 보기
- 한글 특화 검증: 내 문장 글자 누락 검사, 옛한글·한자 자동 검출, 글자 범위 태그, 초성 검색
- 필터: 분류·분위기·사용 범위(라이선스 매트릭스)·글자 범위·즐겨찾기 / 상황별 큐레이션 / 유료 폰트 대안
- 받기 패널: 원 배포처 ZIP 직링크(주간 상태 점검, 끊기면 페이지 안내) · 설치/PPT 적용 안내 · 라이선스 증빙 텍스트 저장
- 히어로: 이번 주 신규 배포 폰트 슬라이드(없으면 최근 등록순)
- 폰트별 정적 페이지 `font/<id>.html` + sitemap (`node tools/build_pages.js`, 검색 유입구)
- 비교 트레이(최대 4종) → 나란히 보기, 상세 모달(테스터·매트릭스·임베드 코드·npm)

## 운영 원칙
- 사용자 대상 AI 기능 없음(유지비 0 원칙). 닮은 폰트·글자 누락·옛한글/한자 판정은 모두 브라우저 캔버스 측정으로 처리. 자세한 대체 기술 표는 `docs/research_v2_global_benchmark.md` 5장.

## 수집 자동화
- `tools/watch_sources.py`: Google Fonts·Fontsource·GitHub 릴리스·공공데이터 CSV·공공 목록 페이지를 매주 돌며 `tools/state/catalog.json`에 누적(자산). 변경 시 GitHub 이슈로 알림. 라이선스 해석·공개는 사람이 함. 타당성 조사: `docs/automation_feasibility.md`

## 공공 안심글꼴 미리보기 웹폰트
- 원본: 문체부 안심 글꼴파일 서비스 '안심글꼴(365종) 한번에 내려받기'(tools/archive/kogl, git 제외)
- `tools/build_webfonts.py --mirror <letsum-mirror>`: 카탈로그 OFL과 매칭 → 굵기별 WOFF2(글리프 무변경) → `Geehg/letsum-mirror` GitHub Pages
- `tools/import_webfonts.py`: data.js에 추가(status 확인 중, 분류는 이름 추정 → 검수 필요). 사이트는 화면에 보일 때만 @font-face 선언(지연 로딩)

## 배포
GitHub `main`에 푸시 → SynoDockPilot 패널에서 "받아와 재배포". 로컬 확인은 `html/`에서 `python3 -m http.server`.
