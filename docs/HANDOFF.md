# HANDOFF — LETSUM 폰트 수집 작업 인수인계

다른 AI(GPT·Codex·muse.ai·Claude)나 사람이 수집 작업을 이어받을 때 보는 문서. 규칙 요약은 루트의 `AGENTS.md`.

## 0. 지금 상태 (2026-10-11)
- 사이트 폰트 **202종**: Google Fonts 한글 38 + 공공 안심글꼴 OFL 85 + 공공누리 제1유형 78 + 2026 신규 1(원주체)
- 출시일 확인 192/201, 라이선스 원문 대조 완료(`verified`) 182/201
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

## 3. 폰트를 추가하는 세 가지 경로

### A. 공공 안심글꼴 (OFL·공공누리 제1유형) — 자동 변환
원본: 문체부 '안심글꼴 한번에 내려받기' `https://www.kogl.or.kr/freeFontFileDown.do?idx=456` (동의 절차 없는 공식 링크)
```bash
curl -L -o tools/archive/kogl/safe_fonts_365.zip "https://www.kogl.or.kr/freeFontFileDown.do?idx=456"   # git 제외 폴더
.venv/bin/python tools/build_webfonts.py --mirror ../letsum-mirror --licenses "OFL,공공누리 제1유형"
(cd ../letsum-mirror && git add -A && git commit -m "webfonts: ..." && git push)   # Pages 반영 1~2분
python3 -I tools/import_webfonts.py      # data.js에 '확인 중'으로 추가 (분류는 이름 추정)
```
그다음 **분류 검수**(4장)와 `tools/run.sh dates / verify`.
- 매칭이 잘못 섞였는지 `tools/state/webfonts.json`의 `source_files`를 반드시 본다(예: 다른 폰트 파일이 한 패밀리에 섞임).
- 아이콘·딩뱃 폰트(`cov`가 한 자릿수)는 제외.

### B. Google Fonts·GitHub 폰트 — 수동 추가
`tools/state/report.md`에 '🆕 Google Fonts 새 한글 패밀리'가 뜨면 data.js에 아래 템플릿으로 추가(웹폰트는 Google CDN이 맡으므로 `webfont` 없음).

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
2. 라이선스 '확인 중' 19종 원문 대조 (`tools/state/license_check.json`에서 판정 불가 항목)
3. 출시일 빈 9종 (`release_dates.py` 출력의 '빈 값')
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
