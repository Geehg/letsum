# 폰트 반복 열람 성능 개선 — 2026-10-30

## 재현과 원인

기준 소스: `8339f479`의 `html/js/main.js`. Chrome의 별도 프로필에서 피드 24→240개(더 보기 9회), 예문 12회 변경, 상세 24개 열기/닫기, hover 자동 슬라이드 중 예문 변경, 목록 보기 전환을 실행했다.

- 더 보기마다 기존 카드까지 `innerHTML`로 다시 만들었다. 카드 수에 비례해 파싱·이벤트 연결·번역·레이아웃 작업이 늘었다.
- hover 중 카드를 교체하면 `mouseleave` 없이 사라질 수 있었다. 1.6초 슬라이드 interval이 남아 제거된 카드와 이전 목록을 붙잡았다. 목록 보기로 바꾸어도 interval과 이전 DOM이 남는 것을 재현했다.
- 보이는 굵기 이후 모든 굵기를 백그라운드 로드하고 `document.fonts`에 계속 유지했다. 상세·유사 폰트 열람도 누적됐다.
- 측정값이 도착하면 상세 창 전체를 다시 만들고 리뷰·이미지 API 처리를 다시 시작했다.
- 한국어에서도 영어 번역용 DOM 순회가 실행됐다. 영문·딩벳 카테고리는 모든 Google Fonts 가족을 한 번에 CSS로 등록하고 불필요한 한글 형태 측정을 했다.

IntersectionObserver의 제거된 대상은 약한 참조 계측과 강제 GC 후 0개였다. 따라서 이를 실제 메모리 누수로 단정하지 않았다. 감시자는 결과 교체 때 명시적으로 해제하고 현재 카드에 다시 연결하도록 수명도 정리했다.

## 변경

- 피드·목록·격자·용도 보기의 다음 묶음만 추가. 기존 카드 노드·슬라이드 상태·이벤트를 유지하고 새 노드만 연결한다.
- 결과 교체 때 carousel interval/timeout 및 감시자를 해제. 분리된 요소·숨긴 문서에서 슬라이드 반복을 중단한다. 사용 사례 이미지가 뒤늦게 추가되어도 실제 슬라이드 개수로 계산한다.
- 웹폰트는 폰트/굵기별 중복 작업을 합치고 필요한 굵기만 요청한다. 동시 로드는 6개. 로드 완료한 파일은 최근 사용 기준 96개를 목표로 정리하되, 주변 카드·현재 히어로·열린 상세/비교에서 쓰는 폰트는 유지한다. 따라서 화면에 동시에 필요한 양이 예산을 넘으면 일시 초과할 수 있다. 다시 스크롤하면 필요한 파일을 재등록하며 브라우저 HTTP 캐시를 사용할 수 있다.
- 영문/딩벳 Google Fonts CSS는 필요한 가족만 요청, 최근 24가족 기준으로 유지. 현재 보거나 로드 중인 가족은 일시 초과 가능. 한국어 Google Fonts 38종은 전체 글자 지원 필터와 기존 진단을 위해 기존 공유 CSS 유지. **96개는 모든 CSS 글꼴·브라우저 전체 메모리의 절대 상한이 아니다.**
- 상세의 측정값 셀만 갱신. 닫힌 창의 DOM을 비우고 늦게 도착한 측정·근거·사진 응답은 해당 노드가 살아 있을 때만 반영한다. 비교창의 크기 측정 도중 닫기도 보호한다.
- 고정 크기 `.ig-track`에만 `content-visibility:auto`를 적용해 화면 밖 미리보기의 렌더링을 줄인다. 카드의 실제 폭·높이를 바꾸지 않는다. 미지원 브라우저는 일반 렌더링으로 동작한다.
- 한국어에서는 번역 MutationObserver를 연결하지 않는다. 영어에서는 겹치는 변경 루트 및 속성 변경의 중복 하위 트리 순회를 줄인다. 한국어↔영어 복원과 사용자 입력 보존은 기존 검사를 통과했다.

## 동일 조건에서의 측정

macOS, Chrome headless, 1440×900. 외부 CDN/네트워크 편차를 제거하기 위해 테스트에서 요청된 폰트 URL에는 동일한 로컬 Arial TTF를 응답하고 API는 fixture로 대체했다. 실제 서체의 다운로드 시간·디코딩 메모리 비교가 아니라 DOM/로더/화면 갱신 비용 비교다. 시간은 클릭부터 두 번째 animation frame까지이며 단일 실행에서 관측한 값이다.

| 항목 | 이전 | 개선 후보 |
|---|---:|---:|
| 240개까지 펼치는 마지막 더 보기 | 324.1ms | 64.6ms |
| 상세 24회 열기 중앙값 | 165.8ms | 82.6ms |
| 목록 보기로 돌아온 뒤 등록된 테스트 웹폰트 | 498 | 96 |
| 목록 복귀 뒤 retained DOM 노드(CDP, GC 후) | 49,843 | 8,685 |
| 목록 복귀 뒤 이벤트 리스너 | 3,860 | 464 |
| 목록 복귀 뒤 JS heap | 8.76MiB | 4.86MiB |
| 제거된 카드의 자동 슬라이드 interval | 1 | 0 |

반복 열람 후 살아 있는 이전 목록은 해제된다. 현재 펼친 카드 자체의 DOM은 사용자가 더 볼수록 늘어나며, 전체 목록을 가상화한 구현은 아니다. JS heap은 이미지·GPU·폰트 디코더를 포함한 탭 전체 RSS와 다르다. 기기·브라우저·네트워크에 따라 체감 수치는 달라진다.

## 검증과 재실행

- `check_font_browsing.cjs`: 240개 확장·기존 노드 유지·중복 없음·웹폰트 정리 후 재방문·타이머 해제·리뷰 입력 보존·늦은 응답·비교 측정 중 닫기·폰트 실패·영문/딩벳 모바일 및 CSS 캐시·최적화 전후 미리보기 크기.
- 기존 `check_ui_language.mjs` 브라우저 검사, `check_font_showcase.cjs` 전체 통과.
- 실제 CDN 파일 별도 검증: 프리텐다드 30 glyph와 Inter 41 glyph가 각각 `Pretendard-Regular`, `Inter-Regular`의 custom font로 렌더링됨을 Chrome `CSS.getPlatformFontsForNode`로 확인. 데스크톱·모바일 캡처 확인.
- 저장소 validator 오류 0, 기존 경고 264. 사용자 필사·즐겨찾기·보관함·리뷰 데이터와 API 스키마는 변경하지 않음.

```sh
# html을 루트로 로컬 서버를 띄운 뒤 경로를 환경에 맞게 지정
LETSUM_PLAYWRIGHT=/path/to/playwright \
LETSUM_TEST_FONT=/path/to/a-valid-local-font.ttf \
LETSUM_TEST_URL=http://127.0.0.1:8889 \
node tools/check_font_browsing.cjs

# 같은 절차를 기준/변경 소스에서 각각 실행해 JSON 비교
LETSUM_PLAYWRIGHT=/path/to/playwright \
LETSUM_TEST_FONT=/path/to/a-valid-local-font.ttf \
LETSUM_TEST_URL=http://127.0.0.1:8889 \
node tools/benchmark_font_browsing.cjs after
```

API 참고: [FontFaceSet.delete](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/delete), [IntersectionObserver.disconnect](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/disconnect), [content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility).
