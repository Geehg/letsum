# 타자기 표면 자료와 매핑 — 2026-10-27

## 관찰 근거

사진에서 확인한 표면 특성을 참고해 제작한 재질이다. 실물 스캔이나 측색 자료가 아니며, 렌더러의 색·거칠기·요철 수치는 재현을 위한 설계값이다. 현재 앱의 형태, 61키 배열, 모델별 색상 선택을 유지한다.

- **Hermes 3000**: [1959년 개체, Mark Schrad의 직접 촬영](https://typewriterdatabase.com/1959-hermes-3000.23095.typewriter). 연한 회녹색 몸체의 매끈하고 약한 도장 결, 민트 키캡의 더 선명한 반사, 금속 레버를 관찰했다. 해당 개체의 찍힘·벗겨짐을 모든 기계의 공통 특징으로 복제하지 않았다.
- **Lettera 32**: [1964년 개체, Francisco Parada의 직접 촬영](https://typewriterdatabase.com/1964-olivetti-lettera-32.6832.typewriter), [Australian War Memorial 소장품](https://www.awm.gov.au/collection/C2689906), [제조사 사용설명서](https://site.xavier.edu/polt/typewriters/OlivettiLettera32_ManualEN.pdf). 도장된 금속 외장과 검정 성형 키, 사용된 키 윗면의 반사를 참고했다. 자료의 녹색 개체와 사용자 제공 연청색 레퍼런스는 다른 색상이다. 앱은 제공된 연청색을 유지하며 가장 고운 도장 입자와 부드러운 광택을 적용했다.
- **Olympia SM3**: [1956년 개체, Teresa C의 직접 촬영·기록](https://typewriterdatabase.com/1956-olympia-sm3.17859.typewriter). 소유자는 올리브색 crinkle finish와 검정 키를 명시했다. 작은 요철이 촘촘한 도장, 반사되는 크롬 둘레를 참고했다. 앱의 키 색상은 사용자 레퍼런스의 짙은 녹색을 유지한다. 모든 SM3의 키 색상이 같다고 주장하지 않는다.

참고 사진은 관찰용이며 사이트 자산으로 복제하지 않았다. 심한 녹·스크래치·때를 임의로 추가하지 않았다.

## 생성 자산

내장 ImageGen으로 모델별 흑백 미세 요철 원본 3종을 생성했다. 프롬프트 전문: `docs/typewriter-surface-prompts.json`.

- 원본: `/Volumes/AI_dev/web/typewriter-surfaces/generated/*-source.png`
- 서비스: `html/img/typewriters/surfaces/{hermes3000,lettera32,olympiasm3}-relief-v1.webp`
- 변환: `cwebp -q 90 -resize 512 512`. 선택한 모델 한 장만 로드, 약 80–106 KB.
- 생성 그림은 색상으로 직접 덮지 않는다. 요철과 약한 거칠기 변화에만 사용하므로 그림의 명암이 조명 그림자로 중복되지 않는다.

## 매핑과 동작

`html/js/typing-surfaces.js`에서 형상 변형이 끝난 기준 좌표를 별도 속성으로 저장한다. 세 방향 투영을 법선 비중으로 섞어 상판·옆면·굽은 모서리에서 같은 입자 크기를 유지한다. 애니메이션이 움직여도 재질 좌표는 부품에 붙어 있다. 미러 반복과 밉맵으로 경계와 먼 거리 깜빡임을 줄인다.

외장은 모델별 입자 크기·요철·광택을 사용한다. 키캡은 훨씬 얕은 결과 윗면의 낮은 거칠기, 금속은 더 작은 미세 결을 사용해 외장 도장과 구별한다. 기존 반사 환경과 광원, 키캡의 윗면/옆면 명암은 유지한다.

텍스처 다운로드는 입력 가능 상태를 막지 않는다. 실패 시 중립 표면으로 작동하고 모델 교체 시 자원을 정리한다. 색상은 sRGB 그림으로 덧칠하지 않으며 요철 이미지는 LinearEncoding으로 해석한다.

## 검증

- 세 모델의 실제 GLB 기반 회귀 검사: 표면 좌표의 유한성·정점 수·움직임 중 고정, 모델별 로드, 선형 색공간과 반복 설정.
- 기존 닫힌 형상·키 동작·IME·줄바꿈·종이 이송·모델 전환·WebGL 실패 복구 검사.
- 실제 브라우저에서 셰이더 컴파일 및 세 모델 확대 렌더 확인.
