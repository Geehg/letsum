# 타자기 선택 화면 · 2026-10-26

## 진입 흐름
- 새 페이지 기본 skin은 retro-focus. `?skin=`으로 다른 모드를 명시하면 존중. 과거 skin2 선호가 남아 있어도 기본 진입을 바꾸라는 사용자 지시를 적용.
- 첫 진입과 다른 스킨에서 레트로 몰입으로 진입할 때 native dialog 표시. 모델 선택 전 modelGate=pending으로 3D 입력 엔진을 정지하며, native modal의 inert/focus containment로 뒤쪽 입력 차단. 모델을 선택하면 기존 tbModel change 경로로 저장하고 ready로 변경.
- 서가에서 이미 선택한 후 책을 여는 경우 중복 선택을 요구하지 않음. 취소하면 서가로 돌아가고, 모델을 고르지 않은 채 책을 열면 선택 화면을 다시 표시. Escape와 뒤로 버튼 동일.
- 설정에서 '타자기 3종 비교해서 고르기' 제공. 설정에서 열린 경우 취소는 설정으로 복귀. 필사 문장·시간·설정 보존, 선택 중 필사 시간 증가 중단.

## 인물과 모델 근거
- Hermes 3000 / Larry McMurtry: Robert Messenger, The Canberra Times, 2009-02-14, p.16. 사용 모델 및 2006 Golden Globe 수상 소감 확인. https://site.xavier.edu/polt/typewriters/typingwriters.pdf
- Olivetti Lettera 32 / Cormac McCarthy: Christie's 2009 경매 lot5273848 및 연계 기사에서 모델 확인. https://www.christies.com/en/lot/lot-5273848 / https://www.bookbrowse.com/news/detail/index.cfm/news_item_number/828/news/cormac-mccarthys-typewriter-sold-for-254500
  - 경매의 1958 취득 서술은 모델 출시 연도와 충돌하므로 화면에서 연도·평생 모든 작품 등의 단정은 제외. 2009년 경매와 Santa Fe Institute 지원만 기재.
- Olympia SM3 / Woody Allen: Olympia Werke 역사 사이트의 'Olympia (and how to use)' 문단. https://www.olympia-werke.com/
- Lettera 32 디자이너·제조사: SFMOMA 2004.182.A-B. https://www.sfmoma.org/artwork/2004.182.A-B/
- SM3 캐리지 시프트: 제조사 설명서. https://site.xavier.edu/polt/typewriters/OlympiaSM3.pdf
- 화면 모델의 색상/생산 세대와 인물의 개별 기기가 같다는 주장 및 인물의 서비스 추천·보증을 하지 않는다.

## 초상 일러스트 · 사진 크레딧
2026-10-26: 기존 사진을 참조하여 built-in image_gen으로 지폐 동판화풍 초상화 3종을 생성. 얼굴·나이·시선·의복 특징을 유지하고 배경을 제거, 올리브 차콜 단색의 곡선 해칭과 교차선으로 재해석. 화면은 `people/*-engraved.webp`(480×600)를 사용하며, CSS 필터 없이 종이 배경에 multiply 합성. 원본 사진은 아래 경로에 그대로 보존. 각 카드 기록 링크, 접을 수 있는 크레딧에 원본·라이선스와 일러스트 변형 사실을 명시. 우디 앨런 참조 사진의 David Shankbone / CC BY 3.0 크레딧 유지. 생성 프롬프트는 `docs/typewriter-portrait-prompts.json`. PNG 마스터는 작업 워크스페이스 `/Volumes/AI_dev/web/letsum-engraved-portraits/`에 보관.
- `people/larry-mcmurtry.png`: 촬영자 미상, 1966년 The Last Picture Show 재킷 사진. Wikimedia Commons PD-US-no notice 표기. https://commons.wikimedia.org/wiki/File:Larry_McMurtry_Photo_Last_Picture_Show_1966.png
- `people/cormac-mccarthy.jpg`: David Styles, 1973년 Child of God 재킷 사진. Commons 업로더 Blz 2049 크롭/보정본, PD-US-no notice/PD-scan 표기. https://commons.wikimedia.org/wiki/File:Cormac_McCarthy_(Child_of_God_author_portrait_-_high-res).jpg
- `people/woody-allen.jpg`: David Shankbone, 2009 Tribeca Film Festival, CC BY 3.0. https://commons.wikimedia.org/wiki/File:Woody_Allen_portrait_2009.jpg / https://creativecommons.org/licenses/by/3.0/

## 타자기 이미지
`tools/typewriter-preview.html`을 개발 서버에 임시로 제공하여 동일 카메라·조명으로 각 모델 렌더. GLB 및 현재 Lettera/SM3 builder를 사용. 검정 리본, 투명 배경 720×440 PNG. `/img/typewriters/*-preview.png`로 저장. 운영 화면은 정적 PNG만 사용하므로 모델 선택 중 3개 WebGL 엔진을 계속 실행하지 않는다. 제작 모델이며 실물 사진으로 표시하지 않는다.
