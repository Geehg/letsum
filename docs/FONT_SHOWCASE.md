# 폰트 사용 사례 및 렛썸봇 참고 자료 30종

- 기존 한글 카탈로그의 pop 정렬 상위 30종을 유지. 시장 순위라는 주장은 하지 않음.
- 실제 웹사이트 사용 확인 12종, 공식 견본 참고 자료 16종, 이미지 미첨부 2종.
- 출처가 있는 글의 작성자: 렛썸봇. 공식 견본은 참고용 게시물이며 실제 서비스 사례·이용자 후기가 아니라는 안내를 피드와 리뷰 패널 양쪽에 표시.
- 렛썸봇 자료에는 데모 좋아요를 표시하지 않음. D1 댓글·좋아요·베스트 리뷰·인기순 집계에 포함하지 않음.
- 실제 사용 검증: CSS 이름만으로 판정하지 않고 Chrome CSS.getPlatformFontsForNode의 실제 familyName·glyphCount를 대조. 캡처 이미지 SHA-256과 확인 시각을 저장하고 빌드 때 무결성 검사.
- 페이퍼로지는 확인 환경에서 실제 로컬 설치 폰트로 렌더링됨(isCustomFont=false). 사이트 지정 CSS 이름 Paperlogy와 실제 Paperlogy 8 ExtraBold를 대조. 모든 방문자의 동일 렌더링을 주장하지 않음.
- 본명조는 삼일PwC 제목의 한글 2글자만 확인. 같은 제목의 영문은 CharterITCW05-Regular로 구분.
- 고운돋움·고딕 A1·함렛은 실제 사이트의 라틴 문자 사용 사례. 한글 적용으로 오인하게 설명하지 않음.
- 폰트 소개·배포 사이트 자체 화면은 외부 실사용으로 계산하지 않음. 광고·패키지 사진은 폰트가 명확히 확인된 추가 자료를 찾지 못해 추정 등록하지 않음.
- 자료 및 근거: tools/state/font_showcase.json. 이전 출처와 교체 판단: tools/state/font_showcase_research.json.
- 재생성: node tools/build_ui_language.js. 생성 파일 html/js/font-showcase.js는 직접 수정하지 않음.
- 확인일: 2026-10-29. 각 출처의 화면 일부만 글꼴 식별·비교 목적으로 출처와 함께 표시.

| 폰트 | 구분 | 출처 |
|---|---|---|
| 본고딕 | 실제 웹사이트 사용 | [대한민국 정책브리핑](https://www.korea.kr/) |
| 본명조 | 실제 웹사이트 사용 | [삼일PwC](https://www.pwc.com/kr/ko.html) |
| 프리텐다드 | 실제 웹사이트 사용 | [flex](https://flex.team/) |
| 주아체 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Jua) |
| 나눔고딕 | 실제 웹사이트 사용 | [서울특별시](https://www.seoul.go.kr/) |
| 검은고딕 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Black+Han+Sans) |
| 고운돋움 | 실제 웹사이트 사용 | [Muria Hutle](https://muriahutle.com/) |
| 나눔명조 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Nanum+Myeongjo) |
| 고운바탕 | 실제 웹사이트 사용 | [리담한의원](https://ridam-clinic.imweb.me/) |
| 도현체 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Do+Hyeon) |
| G마켓 산스 | 실제 웹사이트 사용 | [넥슨 메이플스토리](https://maplestory.nexon.com/) |
| 여기어때 잘난체2 | 렛썸봇 공식 견본 · 참고용 | [여기어때](https://gccompany.co.kr/font) |
| 고딕 A1 | 실제 웹사이트 사용 | [AFL Hyperscale](https://www.aflhyperscale.com/) |
| 나눔손글씨 펜 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Nanum+Pen+Script) |
| IBM Plex Sans KR | 실제 웹사이트 사용 | [IBM](https://www.ibm.com/kr-ko) |
| 아스타 산스 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Asta+Sans) |
| 페이퍼로지 | 실제 웹사이트 사용 | [서울디지털평생교육원](https://www.sdulife.com/) |
| 프리젠테이션 | 렛썸봇 공식 견본 · 참고용 | [Freesentation](https://freesentation.blog/) |
| 싱글데이 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Single+Day) |
| 나눔손글씨 붓 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Nanum+Brush+Script) |
| 개구체 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Gaegu) |
| ACC어린이하늘맑은체 | 이미지 미첨부 | 검증된 이미지 없음 |
| 수트 | 실제 웹사이트 사용 | [SK네트웍스](https://www.sknetworks.co.kr/) |
| 넥슨 Lv.1 고딕 | 렛썸봇 공식 견본 · 참고용 | [NEXON](https://brand.nexon.com/ko/ci-brand-guidelines/typeface) |
| 함렛 | 실제 웹사이트 사용 | [Satisfly](https://satisfly.co/) |
| 연성 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Yeon+Sung) |
| KCC도담도담체 | 이미지 미첨부 | 검증된 이미지 없음 |
| 베이글 팻 원 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Bagel+Fat+One) |
| 동글체 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Dongle) |
| 감자꽃 | 렛썸봇 공식 견본 · 참고용 | [Google Fonts](https://fonts.google.com/specimen/Gamja+Flower) |
