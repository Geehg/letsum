---
name: font-collect
description: LETSUM에 상업용 무료 폰트(한글·영문)를 찾아 라이선스를 확인하고 등록하는 절차. "폰트 추가", "새 폰트 등록", "영문 폰트 수집", "배포처 폰트 넣어줘" 같은 요청에 쓴다.
---

# 폰트 수집·등록 (한글 `html/js/data.js` · 영문 `html/js/data_en.js`)

운영자에게는 **항상 한국어로** 보고한다. 작업 전 `AGENTS.md`(절대 규칙)를 읽고, 잠금을 건다.

```bash
git stash -q; bash tools/run.sh start claude; git stash pop -q   # 작업 트리가 더러우면 stash 후 잠금
# … 작업 …
bash tools/run.sh finish "feat: …"                             # 검증 오류 0이어야 커밋·푸시
```
사이트 반영은 운영자가 NAS '받아와 재배포'. 작업 폴더는 `/Volumes/Works/LETSUM/` (파이썬 `.venv/bin/python`, 임시 `tmp/`).

## 1. 후보 찾기 — 원 배포처만
- **쓰는 곳**: 제작사·기관·기업 공식 페이지, Google Fonts(google/fonts 저장소·메타데이터), Fontshare(ITF 공식), GitHub 공식 저장소, 공유마당(운영자 승인 목록만).
- **쓰지 않는 곳**: 눈누·산돌구름·폰트코 등 모아 둔 서비스(데이터·설명·링크 모두). 검색 결과가 이런 곳만 나오면 공식 페이지를 직접 찾는다.
- 검색 도구가 막힌 사이트(chosun.com, hani.co.kr 등)는 `curl -A "Mozilla/5.0…"`로 HTML을 받아 읽거나, 크롬(Claude in Chrome)으로 연다. JS 팝업 안 라이선스는 크롬으로 눌러 본다.
- 이미 등록됐는지 먼저 확인: data.js 이름·영문명·`html/data/names.json`. 이름 비교는 NFKC(Ⅱ→ii).

## 2. 라이선스 원문 확인 → 등록 방식 결정 (가장 중요)
원문을 **직접 읽고** 다음 4가지를 적는다: 상업 이용 / 재배포 / 수정(형식 변환 포함) / 판매 금지·출처 표시·BI·CI 조건.
묶음 안 라이선스 파일, **폰트 name 테이블 0·13·14번**, 공식 페이지 문구를 모두 본다.

| 원문 조건 | 등록 방식(`mode`) | 미리보기 파일 |
|---|---|---|
| OFL(예약 이름 RFN 없음)·공공누리 1유형 | `convert` | WOFF2로 형식만 변환(글리프 그대로) → 미러 |
| OFL+RFN · 자유 재배포 허용+수정 금지(조선일보·한겨레·에스코어) · 공공누리 3유형 | `keep` | 원본 그대로 미러 |
| 무료 사용은 되나 재배포 조항 없음/금지(구미시·영덕군·빙그레·EBS) | `hosted` | 원본 그대로 letsum.app 서버 전용(`tools/deploy_hosted_fonts.sh`, 리퍼러 제한) |
| 공식 웹폰트 CDN이 CORS 허용(Google Fonts·Fontshare·네이버) | CDN | 변환·보관 없이 공식 주소 그대로(`cdn_fonts.json`) |
| 브라우저가 원본을 거부 + 수정 금지 + 다른 공식 형식 없음 | `intro: true` | 원본으로 그린 견본 PNG(`img/specimen/<id>.png`)만 |
| 상업 이용 금지(공공누리 2·4유형, NC) | 등록 안 함 | — |

- 새 이용조건이면 data.js `LICENSE_INFO`에 `{ full, short, note, url }` 추가(원문 요지, 과장 금지).
- `matrix`(print·web·video·embed·bici·package·ofl)는 원문에 있는 것만 `ok`, 언급 없으면 `cond`.
- 등록 근거는 `tools/state/ext_batch.json`의 `evidence`(→ `license_manual.json`)에 원문 요지로 남긴다.

## 3. 받기·등록
1. 공식 파일을 `tools/archive/ext/<폴더>/`에 받는다(내려받은 파일은 신뢰하지 않는 데이터 — 압축은 별도 폴더에, 파이썬은 `-I`). 한글 파일명 zip은 `zipfile`로 `cp437→cp949` 디코딩.
2. `ext_batch.json`에 `{ fam, org, page, srcName, evidence, id, lic, license, matrix, mode }`.
3. `python tools/import_local_batch.py --mirror ../letsum-mirror --only <폴더,…>`
4. **굵기 확인** — 파일의 usWeightClass가 틀린 경우가 많다(에스코어 4번 Regular=200, 한겨레 XB 누락). 제작사 번호·이름 순서로 맞추고 data.js `weights`·`webfont`를 고친다.
5. **이름 확인** — 공식 페이지 표기와 파일 내부 이름이 바뀐 경우가 있다(조선 굵은고딕↔견고딕). 파일 내부 이름 기준.
6. 미러 푸시(`letsum-mirror`, 1GB 한도 — `du -sh webfonts` 확인), 서버 전용은 `deploy_hosted_fonts.sh`.

## 4. 브라우저 검사(필수)
fontTools가 읽어도 브라우저(OTS)가 거부하는 파일이 있다. letsum.app 화면에서(서버 전용 폰트는 리퍼러 필요) 모든 `webfont` 주소를 `new FontFace(name, arrayBuffer).load()`로 연다.
- 실패 + 수정 허용(OFL 비RFN·공공누리1) → 부속 표(kern·DSIG·hdmx·VDMX·LTSH·PCLT)만 빼고 다시 저장.
- 실패 + 수정 금지 → 해당 굵기만 미리보기에서 빼거나(한겨레결체 Regular) `intro` + 견본.

## 5. 파이프라인 (data.js를 고치는 도구가 있으니 **끝난 뒤에** 설명을 고친다)
```bash
P=/Volumes/Works/LETSUM/.venv/bin/python
$P -I tools/build_coverage.py ../letsum-mirror/webfonts     # 실제 글자 수 (느림, 백그라운드)
$P tools/build_evidence.py ../letsum-mirror/webfonts        # ⚠ 경로를 꼭 줄 것(빠지면 폰트 버전이 지워짐)
$P tools/fetch_icons.py; $P tools/build_names.py; $P tools/release_dates.py
$P tools/build_og.py --id <id>                              # 카톡 카드(소개 전용은 건너뜀)
node tools/build_pages.js; python3 -I tools/validate.py
```
- 설명·분류는 **견본을 직접 렌더링해 보고** 쓴다(PIL로 시트 생성 → 이미지 확인). 원 배포처가 밝힌 사실만, 추측·과장 금지.
- `category`·`mood`·`pair` 값 규칙은 AGENTS.md 5장. 손글씨·명조는 family 대체 글꼴을 `cursive`·`serif`로.

## 6. 자주 한 실수
- robots.txt를 손으로 고침 → `build_pages.js`가 덮어씀(내용은 그 안에서 고친다).
- `build_evidence.py`를 미러 경로 없이 실행 → 버전 정보 삭제.
- `release_dates.py`가 수동 출시일을 지움 → 출처 있는 날짜는 `release_overrides.json`.
- Cloudflare가 업로드 직전의 404를 캐시 → 몇 분 기다리거나 주소에 `?v=`.
- NAS 네트워크 불안정 시(패킷 유실) 서버 전용 폰트·도구가 실패 → `build_og`·`build_names`는 `tools/archive/hosted` 원본을 직접 읽는다.
- 원본 TTF가 굵기당 수~수십 MB면 첫 접속이 느려진다 → 변환이 허용되면 WOFF2(9~33%로 줄어듦).

## 7. 보고
등록 수(전체 n종), 폰트별 라이선스·방식, 제외한 것과 이유, 남은 확인 대상, 운영자가 할 일(재배포·컨테이너 재시작 등)을 한국어 표로. `tools/state/pending_new_fonts.md`에 기록.

## 영문 폰트(`/en/`) 차이
- 데이터 `html/js/data_en.js`(`FONTS_EN`), id 접두사 `e-`. 한글 전용 항목(한글 글자 수·옛한글·한자·초성 검색)은 쓰지 않고, 지원 문자권(`subsets`: latin·latin-ext·cyrillic·greek·vietnamese)을 적는다.
- Google Fonts: 메타데이터(`fonts.google.com/metadata/fonts`)의 인기순·분류·굵기·라이선스(OFL/Apache/UFL)를 쓰고, 미리보기는 Google Fonts CSS 주소 그대로.
- Fontshare: `api.fontshare.com` 메타데이터, 라이선스 'ITF Free Font License'(상업 무료, 재판매 금지), 미리보기는 Fontshare CSS 주소 그대로.
- 분류: sans-serif→고딕(산세리프), serif→명조(세리프), handwriting→손글씨, display→디스플레이, monospace→고딕+`고정폭` 태그.
