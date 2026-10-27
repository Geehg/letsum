# Olivetti Lettera 32 실물 대조 제작본 — 2026-10-27

## 기준 자료

- Tas Kyprianou가 소장·촬영한 [1965년 Lettera 32 #2330939](https://typewriterdatabase.com/1965-olivetti-lettera-32.17916.typewriter). 정면·키보드·상면·내부·양 측면 사진을 같은 개체 기준으로 삼았다. 사진에는 파란 외장, 짙은 회색 키, 오른쪽의 빨간 키, 밝은 금속색 키보드 아래면, 앞면 Lettera 32 명판, 리본 개구부와 측면 노브 및 레버가 보인다. 이 색상과 명판은 다른 생산품이나 사용자가 제공한 참고 이미지와 차이가 있을 수 있다.
- [British Olivetti 사용 설명서](https://site.xavier.edu/polt/typewriters/OlivettiLettera32_ManualEN.pdf): 구동부와 사용자 조작 명칭 대조. 설명서는 기준 개체와 정확히 같은 키보드 변형이라고 단정하지 않는다.
- [Smithsonian Cooper Hewitt 소장 기록](https://www.si.edu/object/lettera-32%3Achndm_1992-115-1-a_b): Lettera 32, Marcello Nizzoli, 제조사 Olivetti, 1963, 에나멜 금속. 이 소장 개체는 색이 다르므로 #2330939 색상 근거로 사용하지 않는다.
- 실물 사진은 관찰용으로 임시 폴더에만 두고 3D 파일에 복제하지 않았다.

## 구현 및 한계

`tools/modeling/build_lettera_reference.py`는 낮은 외장과 키보드 함몰부, 분리된 파란 상판 및 실제 열린 리본 개구부, 개구부 아래 활자 바스켓, 캐리지·롤러, 짧은 금속 레버, 검정 노브, 독립 키캡과 빨간 조작키, 간결한 앞 명판을 별도 부품으로 제작한다. 원본은 실측 모델이 아니라 초기 외형 검토본이며 특히 캐리지 옆판과 커버 앞면·키보드 바닥은 추가 사진 대조와 세부 보강이 필요하다. 도장·키·금속은 거칠기 및 요철 맵이 포함된 PBR 재질이다. 키보드는 사진에서 확인할 수 있는 배열을 바탕으로 한 재구성으로, 잘 읽히지 않는 각인은 비워두었으며 모든 부호나 작동을 완전 복제하지 않는다. 앞 명판 글꼴은 근사 표현이다.

치수·곡률·키의 위치·표면 색과 광택은 **실측하지 않은 제작값**이다. 사진에서 보이지 않는 힌지, 스프링 및 전달 기구의 정확한 구조나 실제 타이핑 기능을 주장하지 않는다. 검토 화면의 키 누름은 외형 미리보기이며 기존 필사 앱에 교체·배포한 모델이 아니다.

## 재생성 및 검증

```
blender --background --factory-startup --python tools/modeling/build_lettera_reference.py -- --output /path/to/output
python3 tools/check_lettera_reference.py
```

Blender 원본 및 GLB, 오프라인 렌더 PNG를 생성한다. 웹 검토 화면은 `html/lettera-reference-review.html`이다.
