# AGENTS.md — LETSUM 작업 규칙 (모든 AI·사람 공통)

이 저장소를 이어받는 AI(Claude, GPT/Codex, muse.ai 등)와 사람은 **작업 전에 이 문서를 끝까지 읽는다.**
자세한 배경·절차는 `docs/HANDOFF.md`.

## 1. 한 줄 요약
letsum.app = 상업용 무료 한글 폰트 사이트. 정적 사이트(`html/`) + 수집 도구(`tools/`). 서버·DB·AI 기능 없음.
데이터의 중심은 `html/js/data.js`의 `FONTS` 배열. 배포는 GitHub `main` 푸시 → NAS 패널 "받아와 재배포".

## 2. 절대 규칙 (어기면 안 됨)
1. **사용자 대상 AI 기능 금지** — 유지비 0원. 추천·검색·분류는 규칙·정적 데이터·브라우저 계산으로.
2. **다운로드는 원 배포처 링크가 기본.** LETSUM은 파일 제공자가 아니다. 보관본(미러)은 원 링크가 끊겼을 때만 대체.
3. **날짜·라이선스를 지어내지 않는다(목업 금지).** 출시일은 출처(`releasedSrc`·`releasedUrl`)가 있을 때만. 모르면 비운다.
4. **웹폰트(미리보기) 변환은 원문이 무상 재배포를 허용하는 라이선스만**: OFL, 공공누리 제1유형, 그리고 원문에 '무료로 자유롭게 사용·배포'가 명시되고 수정 금지 조항이 없는 기관 이용조건(예: 부산시 전용서체). 이런 경우 `license_manual.json`에 원문 근거를 남기고 `LICENSE_INFO`에 항목을 추가한다. 공공누리 2·3·4유형·CC BY-NC/ND·수정/재배포 금지·'다운로드 시 약관 동의 간주' 라이선스는 운영자 확인 없이 변환·업로드 금지.
4-1. **화면 표시만 허용되고 재배포가 금지된 웹폰트**(예: HS효성체)는 공개 저장소·미러에 올리지 않는다. 배포처가 준 WOFF2를 그대로 `tools/archive/hosted/<폴더>/`(git 제외)에 두고 `tools/deploy_hosted_fonts.sh`로 letsum.app 서버에만 올린다(운영 서버 작업이므로 운영자 허락 후). 주소는 `https://letsum.app/fonts-hosted/<폴더>/<굵기>.woff2`.
5. **글리프를 바꾸지 않는다** — 서브셋 금지(OFL 예약 글꼴 이름 조항). 압축 형식(WOFF2) 변환만.
6. **수집 금지 대상**: 눈누·산돌구름·폰코 등 상업·편집 서비스의 데이터. 공유마당 개별 다운로드의 '이용 범위 동의' 절차를 자동으로 통과시키지 않는다.
7. **히어로(첫 화면 슬라이드)는 원 제작사 출시·배포일(`released`) 기준.** 사이트 등록일(`added`)이 아니다.
8. 비밀번호·토큰을 코드·문서·커밋에 넣지 않는다. (관리자 비밀번호는 SHA-256 해시만 data.js에)

## 3. 작업 순서 (꼬임·중복 방지)
```bash
tools/run.sh start <작업자이름>     # 최신 받기 + 잠금. 잠겨 있으면 멈추고 사람에게 묻는다
# ... 작업 ...
tools/run.sh all                    # 수집 → 출시일 → 라이선스 대조 → 페이지 → 검증
tools/run.sh finish "커밋 메시지"    # 검증 통과해야 커밋·푸시, 잠금 해제
```
- **한 번에 한 작업자만.** `tools/state/LOCK`이 있으면 다른 작업 중이다.
- 처음 한 번: `git config core.hooksPath tools/hooks` (커밋 전 자동 검증)
- 검증(`python3 -I tools/validate.py`)이 **오류 0**이 아니면 커밋하지 않는다.

## 4. 파일 소유권 — 손으로 고치는 것 vs 생성되는 것
| 손으로 고침 (사람·AI가 판단해 작성) | 도구가 생성 (직접 고치지 말 것) |
|---|---|
| `tools/state/review_*.json` — 분류·설명 검수 | `html/font/*.html`, `html/sitemap.xml` ← build_pages.js |
| `tools/state/release_overrides.json` — 출처 있는 출시일 | `html/data/links.json` ← watch_sources.py |
| `tools/state/aliases.json` — 같은 폰트 다른 이름 | `tools/state/catalog.json`, `sources.json`, `report.md` ← watch_sources.py |
| `tools/state/license_manual.json` — 원문을 직접 읽고 확인한 라이선스 근거 | `tools/state/license_check.json` ← verify_licenses.py |
| `tools/state/catalog.json`의 `review` 필드만 | `tools/state/webfonts.json` ← build_webfonts.py |
| `html/js/data.js` — 새 폰트 수동 추가 시 (템플릿: docs/HANDOFF.md) | data.js의 `released*` ← release_dates.py |

data.js를 고칠 때 이미 있는 `id`를 바꾸지 않는다(즐겨찾기·링크·미러 경로가 깨짐).

## 5. 값 규칙 (validate.py가 검사)
- `category`: 고딕 | 명조 | 손글씨 | 디스플레이
- `mood`: 단정한·차분한·따뜻한·세련된·고전적·발랄한·귀여운·강렬한 중에서
- `license`: `LICENSE_INFO`에 있는 이름만 (지금: `OFL`, `공공누리 제1유형`, `부산시 전용서체 이용조건`, `부산시교육청 무료 글꼴 이용조건`, `HS효성체 라이선스`). 공공누리는 `attribution` 필수
- `released`: `YYYY` / `YYYY-MM` / `YYYY-MM-DD` + `releasedSrc` + `releasedUrl`
- `status`: 라이선스 원문을 대조했으면 `verified`, 아니면 `checking`
- `id`: 소문자·숫자·하이픈. 공공 웹폰트는 `k-` 접두사

## 6. 응답 언어
사용자(운영자)에게는 한국어로 보고한다.
